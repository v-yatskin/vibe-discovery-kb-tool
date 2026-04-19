import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import chalk from 'chalk';
import * as readline from 'readline';
import { getConfig } from '../config';
import { findOneDriveCandidates, ensureFilesSymlink } from './files';
import matter from 'gray-matter';
import { upsertLinksSection } from '../vault/wikilinks';
import { readAllCanonical } from '../vault/reader';

const DEFAULT_VAULT_PATH = path.join(os.homedir(), 'Documents', 'ProductVault');

// v1 + Phase 8 folder set.
const CANONICAL_FOLDERS = [
  '00_Drafts',
  '01_Problems',
  '02_Insights',
  '03_Experiments',
  '04_Decisions',
  '05_Initiatives',
  '06_Features',
  '07_Meeting-Notes',
  '08_Integrations',
  '09_Templates',
  '10_Ceremonies',
  '11_Data',
  '_files',
  '_private',
  'archive',
  '.obsidian',
  '.claude/agents',
  '.claude/agents.private',
];

interface InitAnswers {
  vaultPath: string;
  productName: string;
  author: string;
  team: string[];
}

// Prompt session that works for both interactive TTY and piped input.
// readline.question() is unreliable with piped stdin (buffering / close timing);
// in piped mode we collect all lines up front and dispense them synchronously.
class PromptSession {
  private queued: string[] | null = null;
  private rl: readline.Interface | null = null;

  async open(): Promise<void> {
    if (process.stdin.isTTY) {
      this.rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    } else {
      this.queued = await new Promise<string[]>((resolve) => {
        let data = '';
        process.stdin.setEncoding('utf-8');
        process.stdin.on('data', (chunk) => { data += chunk; });
        process.stdin.on('end', () => resolve(data.split('\n')));
      });
    }
  }

  ask(question: string, defaultValue?: string): Promise<string> {
    const suffix = defaultValue ? chalk.dim(` [${defaultValue}] `) : ' ';
    if (this.queued !== null) {
      const line = this.queued.shift() ?? '';
      process.stdout.write(question + suffix + line + '\n');
      return Promise.resolve(line.trim() || defaultValue || '');
    }
    return new Promise((resolve) => {
      this.rl!.question(question + suffix, (answer) => {
        resolve(answer.trim() || defaultValue || '');
      });
    });
  }

  close(): void {
    if (this.rl) this.rl.close();
  }
}

function teamToTable(team: string[]): string {
  if (team.length === 0) {
    return '| Name | Role |\n|---|---|\n| _(add team members here)_ |  |';
  }
  const rows = team.map((person) => {
    const m = person.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
    if (m) return `| ${m[1].trim()} | ${m[2].trim()} |`;
    return `| ${person.trim()} |  |`;
  });
  return `| Name | Role |\n|---|---|\n${rows.join('\n')}`;
}

function substitute(content: string, vars: Record<string, string>): string {
  let result = content;
  for (const [k, v] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v);
  }
  return result;
}

function scaffoldRoot(): string {
  return path.resolve(__dirname, '..', '..', 'scaffold');
}

function copyScaffoldDir(
  srcDir: string,
  destDir: string,
  vars: Record<string, string>,
  skipExisting: boolean,
  log: (msg: string) => void
): void {
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyScaffoldDir(srcPath, destPath, vars, skipExisting, log);
    } else {
      if (skipExisting && fs.existsSync(destPath)) continue;
      fs.writeFileSync(destPath, substitute(fs.readFileSync(srcPath, 'utf-8'), vars), 'utf-8');
      log(`  + ${path.relative(process.cwd(), destPath)}`);
    }
  }
}

function checkGh(): boolean {
  try {
    execSync('gh --version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function isGitRepo(p: string): boolean {
  return fs.existsSync(path.join(p, '.git'));
}

// Set up a remote GitHub repo. Returns a log line or null if skipped.
async function setupGitRemote(
  session: PromptSession,
  vaultPath: string,
  hasGh: boolean
): Promise<string | null> {
  const want = await session.ask(chalk.cyan('Set up a remote GitHub repo now?'), 'Y/n');
  if (want.toLowerCase().startsWith('n')) return null;

  // If gh is available, let them choose: create new or link existing.
  let useExisting = !hasGh;
  if (hasGh) {
    const mode = await session.ask(
      chalk.cyan('  Create a new repo or link to an existing one? (new/existing)'),
      'new'
    );
    useExisting = mode.trim().toLowerCase().startsWith('e');
  }

  if (!useExisting) {
    const vis = await session.ask(chalk.cyan('  Visibility (private/public)?'), 'private');
    const repoName = path.basename(vaultPath).toLowerCase().replace(/[^a-z0-9-]/g, '-');
    try {
      const out = execSync(
        `gh repo create "${repoName}" --${vis} --source . --remote origin --push`,
        { cwd: vaultPath, stdio: 'pipe' }
      ).toString().trim();
      const url = out.match(/https:\/\/\S+/)?.at(0) ?? repoName;
      return chalk.green(`  ✓ Repo created and pushed: ${url}`);
    } catch (e: any) {
      return chalk.yellow(`  ⚠ gh repo create failed: ${e.message.trim()}`);
    }
  }

  // Link to existing repo.
  const url = await session.ask(chalk.cyan('  Existing repo URL?'), '');
  if (!url) return null;
  try {
    execSync(`git remote add origin "${url}"`, { cwd: vaultPath, stdio: 'pipe' });
    execSync('git push -u origin main', { cwd: vaultPath, stdio: 'pipe' });
    return chalk.green(`  ✓ Remote set and pushed: ${url}`);
  } catch (e: any) {
    return chalk.yellow(`  ⚠ Could not push to ${url}: ${e.message.trim()}`);
  }
}

// Interactive OneDrive setup. Returns a log line to show the user.
// Silent if they opt out. Never throws — OneDrive is optional.
async function setupOneDriveSync(
  session: PromptSession,
  vaultPath: string,
  defaultFolderName: string
): Promise<string | null> {
  const filesPath = path.join(vaultPath, '_files');
  // If _files/ doesn't exist or is already a symlink, skip gracefully.
  if (!fs.existsSync(filesPath)) return null;
  const stat = fs.lstatSync(filesPath);
  if (stat.isSymbolicLink()) return null; // already linked, don't offer again

  const candidates = findOneDriveCandidates();
  if (candidates.length === 0) {
    return chalk.dim('  (OneDrive not detected — install it later and run `kb files --link` to enable binary sync)');
  }

  const want = await session.ask(
    chalk.cyan('Sync _files/ with OneDrive now?'),
    'Y/n'
  );
  if (want.toLowerCase().startsWith('n')) return null;

  let account = candidates[0];
  if (candidates.length > 1) {
    console.log(chalk.bold('\n  OneDrive accounts found:'));
    candidates.forEach((c, i) => console.log(`    ${i + 1}. ${path.basename(c)}`));
    const choice = await session.ask(chalk.cyan('  Pick one by number'), '1');
    const idx = parseInt(choice, 10) - 1;
    if (!isNaN(idx) && idx >= 0 && idx < candidates.length) {
      account = candidates[idx];
    }
  }

  const folderName = await session.ask(
    chalk.cyan('  OneDrive folder name?'),
    defaultFolderName
  );
  const target = path.join(account, folderName);
  try {
    await ensureFilesSymlink(vaultPath, target);
    return chalk.green(`  ✓ _files/ → ${target}`);
  } catch (e: any) {
    return chalk.yellow(`  ⚠ Could not link _files/: ${e.message} (run \`kb files --link\` later)`);
  }
}

function buildPostMergeHook(): string {
  // Resolve kb at hook-write time so the hook uses the absolute path.
  // Falls back to ~/.local/bin/kb (our install location) if `which` fails.
  let kbPath = `$HOME/.local/bin/kb`;
  try {
    const resolved = execSync('which kb 2>/dev/null', { stdio: 'pipe' }).toString().trim();
    if (resolved) kbPath = resolved;
  } catch {
    // which not available or kb not on PATH yet — use default
  }
  return `#!/bin/sh
# Installed by kb init — runs after git merge / git pull.
# Generates an update log and refreshes the semantic search index.
KB=${kbPath}
if [ -x "$KB" ]; then
  "$KB" updates --generate --quiet 2>/dev/null || true
  "$KB" index --diff --quiet 2>/dev/null || true
fi
`;
}

// Returns: 'installed' | 'exists' | 'skipped' (not a git repo)
function installPostMergeHook(vaultPath: string): 'installed' | 'exists' | 'skipped' {
  const hooksDir = path.join(vaultPath, '.git', 'hooks');
  if (!fs.existsSync(hooksDir)) return 'skipped';
  const hookPath = path.join(hooksDir, 'post-merge');
  if (fs.existsSync(hookPath)) return 'exists';
  fs.writeFileSync(hookPath, buildPostMergeHook(), 'utf-8');
  fs.chmodSync(hookPath, 0o755);
  return 'installed';
}

const CRON_MARKER = '# kb-tool auto-update';

// Add a weekly cron job that runs `kb update` every Monday at 09:00.
// Idempotent — skips if the marker is already in the crontab.
// Returns a log line or null on failure.
function scheduleWeeklyUpdate(): string | null {
  let kbPath = `${os.homedir()}/.local/bin/kb`;
  try {
    const resolved = execSync('which kb 2>/dev/null', { stdio: 'pipe' }).toString().trim();
    if (resolved) kbPath = resolved;
  } catch { /* use default */ }

  const cronLine = `0 9 * * 1 ${kbPath} update --quiet 2>/dev/null ${CRON_MARKER}`;

  try {
    const current = execSync('crontab -l 2>/dev/null', { stdio: 'pipe' }).toString();
    if (current.includes(CRON_MARKER)) return null; // already scheduled
    const updated = current.trimEnd() + (current.length ? '\n' : '') + cronLine + '\n';
    execSync('crontab -', { input: updated, stdio: ['pipe', 'pipe', 'pipe'] });
    return chalk.green('  ✓ Weekly auto-update scheduled (Mondays 09:00 via cron)');
  } catch {
    return chalk.dim('  (crontab unavailable — run `kb update` manually to upgrade)');
  }
}

async function gatherAnswers(session: PromptSession): Promise<InitAnswers> {
  console.log(chalk.bold('\nkb init — create a new product discovery vault\n'));
  const vaultPath = await session.ask(chalk.cyan('Where should the vault live?'), DEFAULT_VAULT_PATH);
  const productName = await session.ask(chalk.cyan('Product name?'), 'YourProduct');
  const author = await session.ask(chalk.cyan('Your name?'));
  const teamInput = await session.ask(
    chalk.cyan('Team members? (comma-separated, e.g. "Alex (PM), Sam (Designer)")'),
    ''
  );
  const team = teamInput
    ? teamInput.split(',').map((s) => s.trim()).filter(Boolean)
    : [];
  return { vaultPath, productName, author, team };
}

async function freshInit(scaffoldDir: string) {
  const session = new PromptSession();
  await session.open();
  try {
    await runFreshInit(scaffoldDir, session);
  } finally {
    session.close();
  }
}

async function runFreshInit(scaffoldDir: string, session: PromptSession) {
  const answers = await gatherAnswers(session);
  const { vaultPath, productName, author, team } = answers;

  if (fs.existsSync(vaultPath) && fs.readdirSync(vaultPath).length > 0) {
    console.error(chalk.red(`\n${vaultPath} exists and isn't empty.`));
    console.log(chalk.dim('Pick a different path, or cd into it and run `kb init --upgrade` instead.\n'));
    process.exit(1);
  }

  console.log();
  fs.mkdirSync(vaultPath, { recursive: true });

  const vars: Record<string, string> = {
    PRODUCT_NAME: productName,
    VAULT_NAME: path.basename(vaultPath),
    AUTHOR: author,
    TEAM: team.join(', ') || '(add team members here)',
    TEAM_TABLE: teamToTable(team),
  };

  // Folders
  for (const folder of CANONICAL_FOLDERS) {
    fs.mkdirSync(path.join(vaultPath, folder), { recursive: true });
  }

  // Root files
  for (const file of ['Home.md', 'README.md', '.gitignore']) {
    const src = path.join(scaffoldDir, file);
    if (!fs.existsSync(src)) continue;
    fs.writeFileSync(path.join(vaultPath, file), substitute(fs.readFileSync(src, 'utf-8'), vars), 'utf-8');
  }

  // Templates → 09_Templates/
  const templatesSrc = path.join(scaffoldDir, 'templates');
  for (const entry of fs.readdirSync(templatesSrc)) {
    fs.writeFileSync(
      path.join(vaultPath, '09_Templates', entry),
      substitute(fs.readFileSync(path.join(templatesSrc, entry), 'utf-8'), vars),
      'utf-8'
    );
  }

  // .claude/
  const claudeSrc = path.join(scaffoldDir, '.claude');
  const claudeDest = path.join(vaultPath, '.claude');
  fs.mkdirSync(claudeDest, { recursive: true });
  copyScaffoldDir(claudeSrc, claudeDest, vars, false, () => {});

  // Bases → Bases/ (Obsidian-native live filtered views)
  const basesSrc = path.join(scaffoldDir, 'Bases');
  if (fs.existsSync(basesSrc)) {
    const basesDest = path.join(vaultPath, 'Bases');
    fs.mkdirSync(basesDest, { recursive: true });
    for (const entry of fs.readdirSync(basesSrc)) {
      fs.writeFileSync(
        path.join(basesDest, entry),
        fs.readFileSync(path.join(basesSrc, entry), 'utf-8'),
        'utf-8'
      );
    }
  }

  // _private/README.md — only file committed from _private/
  const privateReadmeSrc = path.join(scaffoldDir, '_private', 'README.md');
  if (fs.existsSync(privateReadmeSrc)) {
    fs.writeFileSync(
      path.join(vaultPath, '_private', 'README.md'),
      fs.readFileSync(privateReadmeSrc, 'utf-8'),
      'utf-8'
    );
  }

  // .obsidian/app.json — pre-configure key settings so teammates get
  // "show all file types" + "_files/ as attachment folder" without manual setup
  const obsidianAppSrc = path.join(scaffoldDir, '.obsidian', 'app.json');
  const obsidianAppDest = path.join(vaultPath, '.obsidian', 'app.json');
  if (fs.existsSync(obsidianAppSrc)) {
    fs.mkdirSync(path.dirname(obsidianAppDest), { recursive: true });
    fs.writeFileSync(obsidianAppDest, fs.readFileSync(obsidianAppSrc, 'utf-8'), 'utf-8');
  }

  const hasGh = checkGh();

  // git init
  if (!isGitRepo(vaultPath)) {
    try {
      execSync('git init -b main', { cwd: vaultPath, stdio: 'pipe' });
    } catch {
      try {
        execSync('git init', { cwd: vaultPath, stdio: 'pipe' });
      } catch {
        console.log(chalk.yellow('  ⚠ git init failed — vault created but not a git repo'));
      }
    }
  }

  // Initial commit so the vault is ready to push.
  try {
    execSync('git add .', { cwd: vaultPath, stdio: 'pipe' });
    execSync(`git commit -m "feat: init vault"`, { cwd: vaultPath, stdio: 'pipe' });
  } catch {
    // Non-fatal — vault still usable without an initial commit.
  }

  // Post-merge hook
  installPostMergeHook(vaultPath);

  // OneDrive sync setup for _files/ (optional, asks the user)
  const oneDriveLog = await setupOneDriveSync(session, vaultPath, `${productName} Files`);

  // Remote GitHub repo setup (optional, asks the user)
  const remoteLog = await setupGitRemote(session, vaultPath, hasGh);

  // Config
  const configDir = path.join(os.homedir(), '.kb');
  if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
  const configPath = path.join(configDir, 'config.json');
  fs.writeFileSync(
    configPath,
    JSON.stringify(
      { vault_path: vaultPath, author, team, editor: 'obsidian', auto_git_commit: true },
      null,
      2
    ),
    'utf-8'
  );

  console.log(chalk.green.bold(`\n✓ Vault created\n`));
  console.log(`  ${chalk.white('Path:')}     ${vaultPath}`);
  console.log(`  ${chalk.white('Product:')}  ${productName}`);
  console.log(`  ${chalk.white('Author:')}   ${author}`);
  if (team.length) console.log(`  ${chalk.white('Team:')}     ${team.join(', ')}`);
  console.log(`  ${chalk.white('Config:')}   ${configPath}`);
  const updateLog = scheduleWeeklyUpdate();

  if (oneDriveLog) console.log(oneDriveLog);
  if (remoteLog) console.log(remoteLog);
  if (updateLog) console.log(updateLog);

  console.log(chalk.bold('\nNext steps:'));
  console.log(`  1. Open ${path.basename(vaultPath)}/ in Claude Code (drag it into the app as a project)`);
  console.log(`  2. Open it in Obsidian (Open folder as vault)`);
  if (!hasGh) {
    console.log(chalk.yellow(`  3. Install gh CLI for the publish flow:  brew install gh && gh auth login`));
  } else {
    console.log(`  3. ${chalk.dim('gh CLI detected ✓')}`);
  }
  console.log(`  4. In Claude Code, type /resume to begin.\n`);
  if (!remoteLog) {
    console.log(chalk.dim(`  No remote set yet — create a GitHub repo and run: git remote add origin <url> && git push -u origin main\n`));
  }
}

async function upgradeInit(scaffoldDir: string) {
  const session = new PromptSession();
  await session.open();
  try {
    await runUpgradeInit(scaffoldDir, session);
  } finally {
    session.close();
  }
}

async function runUpgradeInit(scaffoldDir: string, session: PromptSession) {
  const vaultPath = process.cwd();
  console.log(chalk.bold(`\nkb init --upgrade — ${vaultPath}\n`));

  const added: string[] = [];

  // Missing folders
  for (const folder of CANONICAL_FOLDERS) {
    const full = path.join(vaultPath, folder);
    if (!fs.existsSync(full)) {
      fs.mkdirSync(full, { recursive: true });
      added.push(folder + '/');
    }
  }

  const existingConfig = getConfig();
  const vars: Record<string, string> = {
    PRODUCT_NAME: 'Product',
    VAULT_NAME: path.basename(vaultPath),
    AUTHOR: existingConfig?.author || '',
    TEAM: (existingConfig?.team || []).join(', ') || '(add team members here)',
    TEAM_TABLE: teamToTable(existingConfig?.team || []),
  };

  // Only add missing slash commands — don't clobber an existing CLAUDE.md
  const claudeCmdSrc = path.join(scaffoldDir, '.claude', 'commands');
  const claudeCmdDest = path.join(vaultPath, '.claude', 'commands');
  if (fs.existsSync(claudeCmdSrc)) {
    fs.mkdirSync(claudeCmdDest, { recursive: true });
    for (const entry of fs.readdirSync(claudeCmdSrc)) {
      const dest = path.join(claudeCmdDest, entry);
      if (!fs.existsSync(dest)) {
        fs.writeFileSync(dest, substitute(fs.readFileSync(path.join(claudeCmdSrc, entry), 'utf-8'), vars), 'utf-8');
        added.push(`.claude/commands/${entry}`);
      }
    }
  }

  // Only add missing team subagents
  const claudeAgentsSrc = path.join(scaffoldDir, '.claude', 'agents');
  const claudeAgentsDest = path.join(vaultPath, '.claude', 'agents');
  if (fs.existsSync(claudeAgentsSrc)) {
    fs.mkdirSync(claudeAgentsDest, { recursive: true });
    for (const entry of fs.readdirSync(claudeAgentsSrc)) {
      if (entry === '.gitkeep') continue; // placeholder, skip once real agents exist
      const dest = path.join(claudeAgentsDest, entry);
      if (!fs.existsSync(dest)) {
        fs.writeFileSync(dest, substitute(fs.readFileSync(path.join(claudeAgentsSrc, entry), 'utf-8'), vars), 'utf-8');
        added.push(`.claude/agents/${entry}`);
      }
    }
  }

  // Missing templates
  const templatesSrc = path.join(scaffoldDir, 'templates');
  const templatesDest = path.join(vaultPath, '09_Templates');
  if (fs.existsSync(templatesSrc)) {
    fs.mkdirSync(templatesDest, { recursive: true });
    for (const entry of fs.readdirSync(templatesSrc)) {
      const dest = path.join(templatesDest, entry);
      if (!fs.existsSync(dest)) {
        fs.writeFileSync(dest, substitute(fs.readFileSync(path.join(templatesSrc, entry), 'utf-8'), vars), 'utf-8');
        added.push(`09_Templates/${entry}`);
      }
    }
  }

  // Missing Bases (Phase 7)
  const basesSrc = path.join(scaffoldDir, 'Bases');
  const basesDest = path.join(vaultPath, 'Bases');
  if (fs.existsSync(basesSrc)) {
    fs.mkdirSync(basesDest, { recursive: true });
    for (const entry of fs.readdirSync(basesSrc)) {
      const dest = path.join(basesDest, entry);
      if (!fs.existsSync(dest)) {
        fs.writeFileSync(dest, fs.readFileSync(path.join(basesSrc, entry), 'utf-8'), 'utf-8');
        added.push(`Bases/${entry}`);
      }
    }
  }

  // Missing _private/README.md (Phase 8 — skeleton file so the folder ships via clone)
  const privateReadmeSrc = path.join(scaffoldDir, '_private', 'README.md');
  const privateReadmeDest = path.join(vaultPath, '_private', 'README.md');
  if (fs.existsSync(privateReadmeSrc) && !fs.existsSync(privateReadmeDest)) {
    fs.mkdirSync(path.dirname(privateReadmeDest), { recursive: true });
    fs.writeFileSync(privateReadmeDest, fs.readFileSync(privateReadmeSrc, 'utf-8'), 'utf-8');
    added.push('_private/README.md');
  }

  // .obsidian/app.json — install if missing; merge key settings if present
  // but don't clobber user customizations
  const obsidianAppSrc = path.join(scaffoldDir, '.obsidian', 'app.json');
  const obsidianAppDest = path.join(vaultPath, '.obsidian', 'app.json');
  if (fs.existsSync(obsidianAppSrc)) {
    fs.mkdirSync(path.dirname(obsidianAppDest), { recursive: true });
    if (!fs.existsSync(obsidianAppDest)) {
      fs.writeFileSync(obsidianAppDest, fs.readFileSync(obsidianAppSrc, 'utf-8'), 'utf-8');
      added.push('.obsidian/app.json');
    } else {
      // Merge: existing wins, but fill in keys we care about if missing
      try {
        const existing = JSON.parse(fs.readFileSync(obsidianAppDest, 'utf-8'));
        const scaffold = JSON.parse(fs.readFileSync(obsidianAppSrc, 'utf-8'));
        let changed = false;
        for (const [k, v] of Object.entries(scaffold)) {
          if (!(k in existing)) {
            existing[k] = v;
            changed = true;
          }
        }
        if (changed) {
          fs.writeFileSync(obsidianAppDest, JSON.stringify(existing, null, 2) + '\n', 'utf-8');
          added.push('.obsidian/app.json (merged missing keys)');
        }
      } catch {
        // Parse error — leave alone, user can fix manually
      }
    }
  }

  // Post-merge hook — install if missing, or repair if it uses bare `kb` (no full path)
  const hooksDir = path.join(vaultPath, '.git', 'hooks');
  const hookPath = path.join(hooksDir, 'post-merge');
  const existingHook = fs.existsSync(hookPath) ? fs.readFileSync(hookPath, 'utf-8') : '';
  const needsRepair = existingHook.includes('command -v kb') || (existingHook.includes('kb ') && !existingHook.includes('KB='));
  if (!fs.existsSync(hookPath) || needsRepair) {
    if (fs.existsSync(hooksDir)) {
      fs.writeFileSync(hookPath, buildPostMergeHook(), 'utf-8');
      fs.chmodSync(hookPath, 0o755);
      added.push(needsRepair ? '.git/hooks/post-merge (repaired — fixed kb path)' : '.git/hooks/post-merge');
    }
  }

  // Backfill `## Links` sections on existing canonical files. Phase 7
  // added auto-generation to `kb publish`, but files published before
  // that (or before Phase 7 shipped) never got the section. This walks
  // all canonical files, regenerates the section from frontmatter, and
  // writes only when changed. Idempotent.
  try {
    const canonical = readAllCanonical(vaultPath);
    let updated = 0;
    for (const file of canonical) {
      const original = fs.readFileSync(file.path, 'utf-8');
      const parsed = matter(original);
      const fm = parsed.data || {};
      const hasAnyLinks = Object.keys(fm).some(
        (k) => k.startsWith('linked_') && Array.isArray(fm[k]) && fm[k].length > 0
      );
      if (!hasAnyLinks) continue;
      const newBody = upsertLinksSection(parsed.content, fm);
      if (newBody === parsed.content) continue;
      const rewritten = matter.stringify(newBody, fm);
      if (rewritten !== original) {
        fs.writeFileSync(file.path, rewritten, 'utf-8');
        updated++;
      }
    }
    if (updated > 0) added.push(`regenerated ## Links in ${updated} canonical file(s)`);
  } catch (e: any) {
    console.log(chalk.yellow(`  ⚠ Could not backfill wikilinks: ${e.message}`));
  }

  if (added.length === 0) {
    console.log(chalk.dim('  Everything up to date — nothing to add.\n'));
  } else {
    console.log(chalk.green(`✓ Added ${added.length} item${added.length === 1 ? '' : 's'}:`));
    added.forEach((a) => console.log(chalk.dim(`  + ${a}`)));
    console.log();
  }

  // OneDrive sync setup (only if _files/ exists and isn't already linked)
  const defaultName = `${path.basename(vaultPath)} Files`;
  const oneDriveLog = await setupOneDriveSync(session, vaultPath, defaultName);
  if (oneDriveLog) {
    console.log(oneDriveLog);
    console.log();
  }
}

export async function initCommand(options: { upgrade?: boolean }) {
  const scaffoldDir = scaffoldRoot();
  if (!fs.existsSync(scaffoldDir)) {
    console.error(chalk.red(`\nScaffold dir missing: ${scaffoldDir}`));
    console.error(chalk.red('Reinstall kb.\n'));
    process.exit(1);
  }

  if (options.upgrade) {
    await upgradeInit(scaffoldDir);
  } else {
    await freshInit(scaffoldDir);
  }
}

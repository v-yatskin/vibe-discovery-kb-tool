import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import chalk from 'chalk';
import * as readline from 'readline';
import { getConfig } from '../config';

const DEFAULT_VAULT_PATH = path.join(os.homedir(), 'Documents', 'ProductVault');

// v1 canonical folder set. Phase 8 adds _files/, _private/, 11_Data/.
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
  'archive',
  '.obsidian',
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

async function gatherAnswers(session: PromptSession): Promise<InitAnswers> {
  console.log(chalk.bold('\nkb init — create a new product discovery vault\n'));
  const vaultPath = await session.ask(chalk.cyan('Where should the vault live?'), DEFAULT_VAULT_PATH);
  const productName = await session.ask(chalk.cyan('Product name?'), 'YourProduct');
  const author = await session.ask(chalk.cyan('Your name?'));
  const teamInput = await session.ask(
    chalk.cyan('Team members? (comma-separated, e.g. "Viktor (PM), Anna (Designer)")'),
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
  let answers: InitAnswers;
  try {
    answers = await gatherAnswers(session);
  } finally {
    session.close();
  }
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

  const hasGh = checkGh();

  console.log(chalk.green.bold(`✓ Vault created\n`));
  console.log(`  ${chalk.white('Path:')}     ${vaultPath}`);
  console.log(`  ${chalk.white('Product:')}  ${productName}`);
  console.log(`  ${chalk.white('Author:')}   ${author}`);
  if (team.length) console.log(`  ${chalk.white('Team:')}     ${team.join(', ')}`);
  console.log(`  ${chalk.white('Config:')}   ${configPath}`);

  console.log(chalk.bold('\nNext steps:'));
  console.log(`  1. Open ${path.basename(vaultPath)}/ in Claude Code (drag it into the app as a project)`);
  console.log(`  2. Open it in Obsidian (Open folder as vault)`);
  if (!hasGh) {
    console.log(chalk.yellow(`  3. Install gh CLI for the publish flow:  brew install gh && gh auth login`));
  } else {
    console.log(`  3. ${chalk.dim('gh CLI detected ✓')}`);
  }
  console.log(`  4. In Claude Code, type /resume to begin.\n`);
  console.log(chalk.dim(`  Once you push this vault to GitHub, edit README.md and replace [VAULT_REPO_URL] with your repo URL.\n`));
}

async function upgradeInit(scaffoldDir: string) {
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

  if (added.length === 0) {
    console.log(chalk.dim('  Everything up to date — nothing to add.\n'));
  } else {
    console.log(chalk.green(`✓ Added ${added.length} item${added.length === 1 ? '' : 's'}:`));
    added.forEach((a) => console.log(chalk.dim(`  + ${a}`)));
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

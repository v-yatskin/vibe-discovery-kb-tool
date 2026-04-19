import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import chalk from 'chalk';
import { getVaultPath } from '../config';

const UPDATES_DIR = 'Updates-Log';

interface CommitInfo {
  hash: string;
  author: string;
  email: string;
  relDate: string;
  date: string;
  subject: string;
  files: Array<{ status: string; path: string }>;
}

function git(vaultPath: string, cmd: string): string {
  return execSync(`git ${cmd}`, { cwd: vaultPath, encoding: 'utf-8' }).trim();
}

function gitOrEmpty(vaultPath: string, cmd: string): string {
  try {
    return git(vaultPath, cmd);
  } catch {
    return '';
  }
}

function hasRef(vaultPath: string, ref: string): boolean {
  try {
    execSync(`git rev-parse --verify --quiet ${ref}`, { cwd: vaultPath, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function parseCommits(vaultPath: string, range: string): CommitInfo[] {
  // Separator-based parse; %x1f is ASCII unit separator — unlikely to appear in commit text.
  const sep = '\x1f';
  const recSep = '\x1e';
  const fmt = `${recSep}%H${sep}%an${sep}%ae${sep}%ar${sep}%ai${sep}%s`;
  const raw = gitOrEmpty(vaultPath, `log ${range} --name-status --pretty=format:${fmt}`);
  if (!raw) return [];

  const records = raw.split(recSep).filter((r) => r.trim().length > 0);
  return records.map((rec) => {
    const firstNewline = rec.indexOf('\n');
    const metaLine = firstNewline >= 0 ? rec.slice(0, firstNewline) : rec;
    const fileLines = firstNewline >= 0 ? rec.slice(firstNewline + 1).split('\n').filter(Boolean) : [];
    const [hash, author, email, relDate, date, subject] = metaLine.split(sep);
    const files = fileLines.map((line) => {
      const [status, ...rest] = line.split('\t');
      return { status: status.trim(), path: rest.join('\t').trim() };
    }).filter((f) => f.path);
    return { hash, author, email, relDate, date, subject, files };
  });
}

function statusLabel(s: string): string {
  if (s.startsWith('A')) return 'added';
  if (s.startsWith('M')) return 'updated';
  if (s.startsWith('D')) return 'deleted';
  if (s.startsWith('R')) return 'renamed';
  return s;
}

function timestampSlug(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function buildLog(commits: CommitInfo[]): string {
  const authors = Array.from(new Set(commits.map((c) => c.author)));
  const date = new Date();
  const dateStr = date.toISOString().substring(0, 10);
  const timeStr = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

  const byAuthor: Record<string, CommitInfo[]> = {};
  for (const c of commits) {
    if (!byAuthor[c.author]) byAuthor[c.author] = [];
    byAuthor[c.author].push(c);
  }

  const lines: string[] = [];
  lines.push('---');
  lines.push(`date: ${dateStr}`);
  lines.push(`time: "${timeStr}"`);
  lines.push(`commits: ${commits.length}`);
  lines.push(`authors: [${authors.map((a) => JSON.stringify(a)).join(', ')}]`);
  lines.push('---');
  lines.push('');
  lines.push(`# Pulled ${commits.length} commit${commits.length === 1 ? '' : 's'} — ${dateStr} ${timeStr}`);
  lines.push('');

  for (const author of authors) {
    const authorCommits = byAuthor[author];
    lines.push(`## ${author} (${authorCommits.length} commit${authorCommits.length === 1 ? '' : 's'})`);
    lines.push('');
    for (const c of authorCommits) {
      lines.push(`**${c.subject}** _(${c.relDate})_`);
      if (c.files.length === 0) {
        lines.push('- _(no file changes)_');
      } else {
        for (const f of c.files) {
          lines.push(`- ${statusLabel(f.status)}: \`${f.path}\``);
        }
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

export function updatesCommand(options: { generate?: boolean; list?: boolean; quiet?: boolean }) {
  const vaultPath = getVaultPath();
  const quiet = !!options.quiet;

  if (options.list) {
    const dir = path.join(vaultPath, UPDATES_DIR);
    if (!fs.existsSync(dir)) {
      console.log(chalk.dim(`\nNo updates logged yet (${UPDATES_DIR}/ is empty).\n`));
      return;
    }
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort().reverse();
    if (files.length === 0) {
      console.log(chalk.dim(`\nNo updates logged yet.\n`));
      return;
    }
    console.log(chalk.bold(`\n${files.length} update log${files.length === 1 ? '' : 's'}:\n`));
    files.slice(0, 20).forEach((f) => console.log(`  · ${f}`));
    console.log();
    return;
  }

  // Default: generate
  if (!fs.existsSync(path.join(vaultPath, '.git'))) {
    if (!quiet) console.error(chalk.red('\nNot a git repo — nothing to log.\n'));
    return;
  }

  // Determine range
  let range: string;
  if (hasRef(vaultPath, 'ORIG_HEAD')) {
    // Post-pull context: log what came in
    range = 'ORIG_HEAD..HEAD';
  } else {
    // Standalone run: show the last day's worth of commits on current branch
    range = '--since="24 hours ago"';
  }

  const commits = parseCommits(vaultPath, range);

  if (commits.length === 0) {
    if (!quiet) console.log(chalk.dim('\nNo new commits to log.\n'));
    return;
  }

  const dir = path.join(vaultPath, UPDATES_DIR);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filename = `${timestampSlug()}.md`;
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, buildLog(commits), 'utf-8');

  if (!quiet) {
    console.log(chalk.green(`\n✓ Logged ${commits.length} commit${commits.length === 1 ? '' : 's'} → ${UPDATES_DIR}/${filename}\n`));
  }
}

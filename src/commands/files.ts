import fs from 'fs';
import path from 'path';
import os from 'os';
import chalk from 'chalk';
import * as readline from 'readline';
import { getVaultPath } from '../config';

// _files/ is Phase-8 gitignored storage for OneDrive-synced binaries.
// This command automates the "symlink _files/ into your OneDrive folder" setup
// so teammates don't have to eyeball the CloudStorage path and run `ln -s`.

export function findOneDriveCandidates(): string[] {
  const cloudStorage = path.join(os.homedir(), 'Library', 'CloudStorage');
  if (!fs.existsSync(cloudStorage)) return [];
  return fs
    .readdirSync(cloudStorage)
    .filter((name) => name.startsWith('OneDrive'))
    .map((name) => path.join(cloudStorage, name));
}

// Non-interactive helper used by `kb init` during setup. Throws on error
// so the caller can decide how to surface (print, skip, abort).
export async function ensureFilesSymlink(
  vaultPath: string,
  target: string,
  opts: { force?: boolean } = {}
): Promise<void> {
  const filesPath = path.join(vaultPath, '_files');
  const state = describeFilesState(filesPath);

  if (state.kind === 'dir-with-content') {
    throw new Error(`_files/ already contains ${state.entries} entries — move them first`);
  }
  if (state.kind === 'symlink' && !opts.force) {
    throw new Error(`_files/ is already symlinked to ${state.target}`);
  }

  if (!fs.existsSync(target)) fs.mkdirSync(target, { recursive: true });
  if (state.kind === 'symlink') fs.unlinkSync(filesPath);
  else if (state.kind === 'empty-dir') fs.rmdirSync(filesPath);
  fs.symlinkSync(target, filesPath, 'dir');
}

async function pickCandidate(candidates: string[]): Promise<string> {
  if (candidates.length === 1) return candidates[0];
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    console.log(chalk.bold('\nMultiple OneDrive folders found:'));
    candidates.forEach((c, i) => console.log(`  ${i + 1}. ${c}`));
    const answer: string = await new Promise((resolve) => {
      rl.question(chalk.cyan('\nPick one by number: '), (a) => resolve(a.trim()));
    });
    const idx = parseInt(answer, 10) - 1;
    if (isNaN(idx) || idx < 0 || idx >= candidates.length) {
      console.error(chalk.red(`\nInvalid selection.\n`));
      process.exit(1);
    }
    return candidates[idx];
  } finally {
    rl.close();
  }
}

function describeFilesState(filesPath: string): { kind: 'missing' | 'symlink' | 'empty-dir' | 'dir-with-content'; target?: string; entries?: number } {
  if (!fs.existsSync(filesPath) && !fs.lstatSync(filesPath, { throwIfNoEntry: false })) {
    return { kind: 'missing' };
  }
  const stat = fs.lstatSync(filesPath);
  if (stat.isSymbolicLink()) {
    return { kind: 'symlink', target: fs.readlinkSync(filesPath) };
  }
  if (stat.isDirectory()) {
    const entries = fs.readdirSync(filesPath).length;
    return entries === 0 ? { kind: 'empty-dir', entries: 0 } : { kind: 'dir-with-content', entries };
  }
  return { kind: 'missing' };
}

async function linkAction(explicitTarget?: string, force?: boolean) {
  const vaultPath = getVaultPath();
  const filesPath = path.join(vaultPath, '_files');
  const state = describeFilesState(filesPath);

  // Safety: refuse to clobber a real directory with content.
  if (state.kind === 'dir-with-content') {
    console.error(chalk.red(`\n_files/ already contains ${state.entries} entrie(s).`));
    console.log(chalk.dim('Move the content somewhere safe first, then re-run this.\n'));
    process.exit(1);
  }

  if (state.kind === 'symlink' && !force) {
    console.log(chalk.yellow(`\n_files/ is already a symlink → ${state.target}`));
    console.log(chalk.dim('Use --force to replace it, or --unlink to remove.\n'));
    process.exit(1);
  }

  // Determine target
  let target: string;
  if (explicitTarget) {
    target = path.resolve(explicitTarget);
  } else {
    const candidates: string[] = findOneDriveCandidates();
    if (candidates.length === 0) {
      console.error(chalk.red(`\nNo OneDrive folder detected under ~/Library/CloudStorage/`));
      console.log(chalk.dim('Install OneDrive and sign in, or re-run with an explicit path:'));
      console.log(chalk.dim('  kb files --link /path/to/your/OneDrive/folder\n'));
      process.exit(1);
    }
    const oneDriveRoot = await pickCandidate(candidates);
    const vaultName = path.basename(vaultPath);
    target = path.join(oneDriveRoot, `${vaultName}-Files`);
  }

  // Create target if missing
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
    console.log(chalk.dim(`  ✓ Created  ${target}`));
  }

  // Replace _files/ with a symlink
  if (state.kind === 'symlink') fs.unlinkSync(filesPath);
  else if (state.kind === 'empty-dir') fs.rmdirSync(filesPath);
  fs.symlinkSync(target, filesPath, 'dir');

  console.log(chalk.green(`\n✓ _files/ → ${target}\n`));
  console.log(chalk.dim('OneDrive will sync everything you put in _files/ to the cloud.'));
  console.log(chalk.dim('Markdown entities can reference files here via `![[_files/...]]` embeds.\n'));
  console.log(chalk.bold('To share with the team:'));
  console.log(`  1. Right-click ${path.basename(target)}/ in OneDrive (web or desktop) → Share → add teammates`);
  console.log(`  2. Each teammate accepts the share (OneDrive pulls it into their sync area)`);
  console.log(`  3. Each teammate runs:  ${chalk.white(`kb files --link "<their local path to the shared folder>"`)}\n`);
}

function statusAction() {
  const vaultPath = getVaultPath();
  const filesPath = path.join(vaultPath, '_files');
  const state = describeFilesState(filesPath);

  console.log(chalk.bold('\n_files/ status:'));
  switch (state.kind) {
    case 'missing':
      console.log(chalk.yellow(`  missing — run \`kb init --upgrade\` to create, then \`kb files --link\`\n`));
      break;
    case 'empty-dir':
      console.log(chalk.dim(`  empty directory (not synced)`));
      console.log(chalk.dim(`  run \`kb files --link\` to sync with OneDrive\n`));
      break;
    case 'symlink':
      console.log(chalk.green(`  ✓ symlinked → ${state.target}`));
      const exists = state.target ? fs.existsSync(state.target) : false;
      if (!exists) console.log(chalk.yellow(`  ⚠ target doesn't exist — link is broken`));
      console.log();
      break;
    case 'dir-with-content':
      console.log(chalk.dim(`  regular directory with ${state.entries} entrie(s) (not synced)`));
      console.log(chalk.dim(`  move content aside and run \`kb files --link\` to start syncing\n`));
      break;
  }
}

async function unlinkAction() {
  const vaultPath = getVaultPath();
  const filesPath = path.join(vaultPath, '_files');
  const state = describeFilesState(filesPath);

  if (state.kind !== 'symlink') {
    console.log(chalk.dim(`\n_files/ is not a symlink — nothing to unlink.\n`));
    return;
  }

  fs.unlinkSync(filesPath);
  fs.mkdirSync(filesPath);
  console.log(chalk.green(`\n✓ Unlinked. _files/ is now a regular empty directory.`));
  console.log(chalk.dim(`  The OneDrive folder itself (${state.target}) was not touched.\n`));
}

export async function filesCommand(options: { link?: string | boolean; unlink?: boolean; status?: boolean; force?: boolean }) {
  if (options.unlink) {
    await unlinkAction();
    return;
  }
  if (options.link !== undefined) {
    const explicit = typeof options.link === 'string' ? options.link : undefined;
    await linkAction(explicit, options.force);
    return;
  }
  // Default: status
  statusAction();
}

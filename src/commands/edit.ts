import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { getVaultPath } from '../config';
import { readAllCanonical } from '../vault/reader';
import { markEdit } from '../vault/edits';

function todayISO(): string {
  return new Date().toISOString().substring(0, 10);
}

export function editCommand(target: string) {
  const vaultPath = getVaultPath();
  if (!target) {
    console.error(chalk.red('\nUsage: kb edit <path or slug>\n'));
    process.exit(1);
  }

  // Find the canonical file. Accept either a path (01_Problems/foo.md) or a slug (foo).
  let absPath: string | null = null;
  const direct = path.join(vaultPath, target);
  if (fs.existsSync(direct)) {
    absPath = direct;
  } else {
    const needle = target.replace(/\.md$/, '').toLowerCase();
    const canonical = readAllCanonical(vaultPath);
    const match = canonical.find((f) => f.filename.replace(/\.md$/, '').toLowerCase() === needle);
    if (match) absPath = match.path;
  }

  if (!absPath || !fs.existsSync(absPath)) {
    console.error(chalk.red(`\nFile not found: ${target}`));
    console.log(chalk.dim('Pass a relative path (e.g. `02_Insights/foo.md`) or a slug.\n'));
    process.exit(1);
  }

  const canonicalRel = path.relative(vaultPath, absPath);
  const baseSlug = path.basename(absPath).replace(/\.md$/, '');
  const draftFilename = `${todayISO()}-edit-${baseSlug}.md`;
  const draftPath = path.join(vaultPath, '00_Drafts', draftFilename);

  if (fs.existsSync(draftPath)) {
    console.error(chalk.red(`\nAn edit-draft for this file already exists: 00_Drafts/${draftFilename}`));
    console.log(chalk.dim(`Finish it (run kb publish) or delete it, then retry.\n`));
    process.exit(1);
  }

  const draftsDir = path.join(vaultPath, '00_Drafts');
  if (!fs.existsSync(draftsDir)) fs.mkdirSync(draftsDir, { recursive: true });
  fs.copyFileSync(absPath, draftPath);

  markEdit(vaultPath, draftFilename, canonicalRel);

  console.log(chalk.green(`\n✓ Edit-draft created\n`));
  console.log(`  ${chalk.white('Source:')}   ${canonicalRel}`);
  console.log(`  ${chalk.white('Draft:')}    00_Drafts/${draftFilename}`);
  console.log();
  console.log(chalk.bold('Next:'));
  console.log(`  1. Edit the draft in Obsidian`);
  console.log(`  2. Say "publish" — kb publish will detect the edit, show a diff, and update the canonical file in place\n`);
}

import chalk from 'chalk';
import { getVaultPath } from '../config';
import { readFolder, FOLDER_MAP } from '../vault/reader';
import { gitLastCommit, gitStatusShort, isGitRepo } from '../vault/git';

const SECTIONS = [
  { type: 'problem',      folder: '01_Problems',     label: 'Problems' },
  { type: 'insight',      folder: '02_Insights',     label: 'Insights' },
  { type: 'experiment',   folder: '03_Experiments',  label: 'Experiments' },
  { type: 'decision',     folder: '04_Decisions',    label: 'Decisions' },
  { type: 'initiative',   folder: '05_Initiatives',  label: 'Initiatives' },
  { type: 'feature',      folder: '06_Features',     label: 'Features' },
  { type: 'meeting-note', folder: '07_Meeting-Notes',label: 'Meeting Notes' },
  { type: 'integration',  folder: '08_Integrations', label: 'Integrations' },
  { type: 'ceremony',     folder: '10_Ceremonies',   label: 'Ceremonies' },
];

export function statusCommand() {
  const vaultPath = getVaultPath();

  console.log(chalk.bold('\n── kb vault status ───────────────────────────────────────'));
  console.log(chalk.dim(`  vault: ${vaultPath}`));

  if (isGitRepo(vaultPath)) {
    const lastCommit = gitLastCommit(vaultPath);
    const dirty = gitStatusShort(vaultPath);
    const gitState = dirty ? `${dirty.split('\n').length} uncommitted change(s)` : 'clean';
    console.log(chalk.dim(`  git:   ${gitState}   last: ${lastCommit}`));
  } else {
    console.log(chalk.dim('  git:   not a git repo'));
  }

  console.log();

  let hasAny = false;
  for (const { folder, label } of SECTIONS) {
    const files = readFolder(vaultPath, folder);
    if (files.length === 0) continue;
    hasAny = true;

    // Count by primary status field (varies by type)
    const counts: Record<string, number> = {};
    for (const f of files) {
      const fm = f.frontmatter;
      const s = String(
        fm.status || fm.ceremony_type || fm.confidence || fm.meeting_type || '—'
      );
      counts[s] = (counts[s] || 0) + 1;
    }

    const breakdown = Object.entries(counts)
      .map(([s, n]) => chalk.dim(`${s}: ${n}`))
      .join('   ');

    console.log(
      `  ${chalk.white(label.padEnd(16))} ${chalk.bold(String(files.length).padEnd(4))} ${breakdown}`
    );
  }

  if (!hasAny) {
    console.log(chalk.dim('  No entities found. Is this a kb vault?'));
  }

  console.log();

  const drafts = readFolder(vaultPath, '00_Drafts');
  if (drafts.length > 0) {
    console.log(
      `  ${chalk.yellow('Drafts')}           ${chalk.yellow.bold(String(drafts.length))}    pending structure`
    );
    drafts.forEach((d) =>
      console.log(chalk.dim(`    · ${d.filename}`))
    );
  } else {
    console.log(chalk.dim('  No pending drafts'));
  }

  console.log(chalk.bold('\n──────────────────────────────────────────────────────────\n'));
}

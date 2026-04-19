import chalk from 'chalk';
import { getVaultPath } from '../config';
import { readFolder, FOLDER_MAP, VaultFile } from '../vault/reader';

const TYPE_LABELS: Record<string, string> = {
  problem: 'PROBLEMS',
  insight: 'INSIGHTS',
  experiment: 'EXPERIMENTS',
  decision: 'DECISIONS',
  initiative: 'INITIATIVES',
  feature: 'FEATURES',
  'meeting-note': 'MEETING NOTES',
  integration: 'INTEGRATIONS',
  ceremony: 'CEREMONIES',
  draft: 'DRAFTS',
};

const STATUS_COLORS: Record<string, (s: string) => string> = {
  open: (s) => chalk.yellow(s),
  validated: (s) => chalk.green(s),
  solved: (s) => chalk.gray(s),
  planned: (s) => chalk.blue(s),
  in_progress: (s) => chalk.cyan(s),
  done: (s) => chalk.gray(s),
  idea: (s) => chalk.magenta(s),
  concluded: (s) => chalk.gray(s),
  running: (s) => chalk.cyan(s),
  decided: (s) => chalk.green(s),
  proposed: (s) => chalk.yellow(s),
  superseded: (s) => chalk.gray(s),
  spec: (s) => chalk.blue(s),
  'in-dev': (s) => chalk.cyan(s),
  shipped: (s) => chalk.gray(s),
  archived: (s) => chalk.gray(s),
  live: (s) => chalk.green(s),
  deprecated: (s) => chalk.gray(s),
  draft: (s) => chalk.dim(s),
};

function colorStatus(status: string): string {
  const fn = STATUS_COLORS[status];
  return fn ? fn(status.padEnd(11)) : chalk.white(status.padEnd(11));
}

function printSection(label: string, files: VaultFile[]) {
  if (files.length === 0) return;
  console.log('\n' + chalk.bold(label) + chalk.dim(` (${files.length})`));

  for (const file of files) {
    const fm = file.frontmatter;
    const status = fm.status || fm.ceremony_type || 'draft';
    const severity = fm.severity ? chalk.dim(fm.severity.padEnd(7)) : '       ';
    const title = String(fm.title || file.filename).substring(0, 48).padEnd(48);
    const author = chalk.dim(
      String(fm.author || (fm.attendees || [])[0] || '').substring(0, 8).padEnd(8)
    );
    const date = chalk.dim(
      String(fm.created || fm.date || '').substring(0, 10)
    );

    console.log(
      `  ${colorStatus(status)} ${severity} ${chalk.white(title)} ${author} ${date}`
    );
  }
}

// Accept both singular and plural, e.g. "problems" → "problem"
function normalizeType(raw: string): string {
  const aliases: Record<string, string> = {
    problems: 'problem',
    insights: 'insight',
    experiments: 'experiment',
    decisions: 'decision',
    initiatives: 'initiative',
    features: 'feature',
    'meeting-notes': 'meeting-note',
    meetings: 'meeting-note',
    integrations: 'integration',
    ceremonies: 'ceremony',
    drafts: 'draft',
  };
  return aliases[raw.toLowerCase()] ?? raw.toLowerCase();
}

export function listCommand(
  type: string | undefined,
  options: { status?: string }
) {
  const vaultPath = getVaultPath();

  if (!type) {
    // Show all
    let total = 0;
    for (const [t, folder] of Object.entries(FOLDER_MAP)) {
      if (t === 'draft') continue;
      const files = readFolder(vaultPath, folder);
      const filtered = options.status
        ? files.filter((f) => f.frontmatter.status === options.status)
        : files;
      total += filtered.length;
      printSection(TYPE_LABELS[t], filtered);
    }
    // Drafts always last
    const drafts = readFolder(vaultPath, '00_Drafts');
    if (drafts.length > 0) {
      printSection('DRAFTS — pending structure', drafts);
      total += drafts.length;
    }
    console.log(chalk.dim(`\nTotal: ${total} files\n`));
    return;
  }

  type = normalizeType(type);

  if (type === 'draft') {
    const drafts = readFolder(vaultPath, '00_Drafts');
    printSection('DRAFTS — pending structure', drafts);
    if (drafts.length === 0)
      console.log(chalk.dim('\n  No pending drafts in 00_Drafts/'));
    console.log();
    return;
  }

  const folder = FOLDER_MAP[type];
  if (!folder) {
    console.error(chalk.red(`Unknown type: "${type}"`));
    console.log(
      `Valid types: ${Object.keys(FOLDER_MAP).join(', ')}`
    );
    process.exit(1);
  }

  const files = readFolder(vaultPath, folder);
  const filtered = options.status
    ? files.filter((f) => f.frontmatter.status === options.status)
    : files;

  printSection(TYPE_LABELS[type] || type.toUpperCase(), filtered);

  if (filtered.length === 0) {
    const msg = options.status
      ? `No ${type}s with status "${options.status}"`
      : `No ${type}s found in ${folder}/`;
    console.log(chalk.dim(`  ${msg}`));
  }
  console.log();
}

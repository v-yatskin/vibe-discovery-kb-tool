import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { getVaultPath } from '../config';
import { FOLDER_MAP } from '../vault/reader';

function toSlug(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .substring(0, 40);
}

export function draftCommand(options: { type: string; title?: string }) {
  const vaultPath = getVaultPath();
  const { type, title } = options;

  if (!FOLDER_MAP[type] || type === 'draft') {
    console.error(chalk.red(`Unknown type: "${type}"`));
    const valid = Object.keys(FOLDER_MAP).filter((t) => t !== 'draft');
    console.log(`Valid types: ${valid.join(', ')}`);
    process.exit(1);
  }

  const today = new Date().toISOString().substring(0, 10);
  const slug = toSlug(title || type);
  const filename = `${today}-${slug}.md`;
  const draftsDir = path.join(vaultPath, '00_Drafts');
  const draftPath = path.join(draftsDir, filename);

  if (!fs.existsSync(draftsDir)) {
    fs.mkdirSync(draftsDir, { recursive: true });
  }

  // Read template from vault's 09_Templates/ first, then fall back to minimal stub
  const templatePath = path.join(vaultPath, '09_Templates', `${type}.md`);
  let content: string;

  if (fs.existsSync(templatePath)) {
    content = fs
      .readFileSync(templatePath, 'utf-8')
      .replace(/\{\{date\}\}/g, today);
  } else {
    content = `---\ntype: ${type}\ntitle: "${title || ''}"\ncreated: ${today}\nauthor: ""\ntags: []\n---\n\n`;
  }

  fs.writeFileSync(draftPath, content, 'utf-8');

  console.log(chalk.green(`\n✓ Draft created:`));
  console.log(`  ${chalk.white(path.join('00_Drafts', filename))}`);
  console.log(
    chalk.dim(
      `\n  Fill in the fields, then run:  kb publish ${filename}\n`
    )
  );
}

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import matter from 'gray-matter';
import * as readline from 'readline';
import { getVaultPath } from '../config';
import { readFolder, FOLDER_MAP } from '../vault/reader';
import { validate } from '../schema/validate';
import { gitAdd, gitCommit, isGitRepo } from '../vault/git';
import { readSession, writeSession } from '../vault/session';

const LINKED_FIELD_LABELS: Record<string, string> = {
  linked_problems: 'Linked problems',
  linked_insights: 'Linked insights',
  linked_experiments: 'Linked experiments',
  linked_decisions: 'Linked decisions',
  linked_initiatives: 'Linked initiatives',
  linked_features: 'Linked features',
};

function buildLinksSection(fm: Record<string, any>): string {
  const lines: string[] = [];
  for (const [field, label] of Object.entries(LINKED_FIELD_LABELS)) {
    const arr = fm[field];
    if (!Array.isArray(arr) || arr.length === 0) continue;
    const links = arr
      .map((v) => String(v).trim())
      .filter(Boolean)
      .map((slug) => `[[${slug}]]`)
      .join(', ');
    if (links) lines.push(`- ${label}: ${links}`);
  }
  if (lines.length === 0) return '';
  return ['## Links', '', ...lines, ''].join('\n');
}

// Append or replace an auto-generated `## Links` block at the end of the
// body. Removes any existing `## Links` (and everything after it) first so
// re-publishing an edited entity doesn't duplicate.
function upsertLinksSection(body: string, fm: Record<string, any>): string {
  const stripped = body.replace(/\n##\s+Links\s*\n[\s\S]*$/m, '\n');
  const newSection = buildLinksSection(fm);
  if (!newSection) return stripped;
  const joiner = stripped.endsWith('\n\n') ? '' : stripped.endsWith('\n') ? '\n' : '\n\n';
  return stripped + joiner + newSection;
}

function toSlug(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .substring(0, 50);
}

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export async function publishCommand(filename?: string) {
  const vaultPath = getVaultPath();

  // No filename — show pending drafts and exit
  if (!filename) {
    const drafts = readFolder(vaultPath, '00_Drafts');
    if (drafts.length === 0) {
      console.log(chalk.dim('\nNo pending drafts in 00_Drafts/\n'));
      return;
    }
    console.log(chalk.bold('\nPending drafts:'));
    drafts.forEach((d, i) =>
      console.log(`  ${chalk.dim(String(i + 1) + '.')} ${d.filename}`)
    );
    console.log(chalk.dim('\nRun:  kb publish <filename>\n'));
    return;
  }

  const draftPath = path.join(vaultPath, '00_Drafts', filename);
  if (!fs.existsSync(draftPath)) {
    console.error(chalk.red(`\nDraft not found: 00_Drafts/${filename}\n`));
    process.exit(1);
  }

  const raw = fs.readFileSync(draftPath, 'utf-8');
  let fm: Record<string, any>;
  let content: string;
  try {
    const parsed = matter(raw);
    fm = parsed.data;
    content = parsed.content;
  } catch (e: any) {
    console.error(chalk.red(`\n  YAML parse error in ${filename}:`));
    console.error(chalk.red(`  ${e.message?.split('\n')[0]}`));
    console.log(chalk.dim('  Fix the frontmatter and try again.\n'));
    process.exit(1);
  }

  // Resolve type — draft files may have subtype
  let canonicalType = String(
    fm.subtype || fm.type || ''
  ).toLowerCase().replace('draft', '').trim();
  if (!canonicalType || canonicalType === 'draft') canonicalType = 'insight';

  const targetFolder = FOLDER_MAP[canonicalType];
  if (!targetFolder) {
    console.error(
      chalk.red(`\nUnknown type "${canonicalType}" in frontmatter.\n`)
    );
    console.log(`Set 'type' to one of: ${Object.keys(FOLDER_MAP).filter(t => t !== 'draft').join(', ')}`);
    process.exit(1);
  }

  console.log(chalk.bold(`\nPublishing: ${filename}`));
  console.log(chalk.dim(`  type:   ${canonicalType}`));
  console.log(chalk.dim(`  target: ${targetFolder}/`));

  // Validate schema
  const result = validate(canonicalType, fm);

  if (result.missing.length > 0) {
    console.log(chalk.yellow('\n  Missing required fields:'));
    result.missing.forEach((f) => console.log(chalk.yellow(`    ✗ ${f}`)));
  }
  if (result.invalid.length > 0) {
    console.log(chalk.red('\n  Invalid values:'));
    result.invalid.forEach((f) => console.log(chalk.red(`    ✗ ${f}`)));
  }
  if (result.valid) {
    console.log(chalk.green('\n  ✓ Schema valid'));
  } else {
    console.log(chalk.dim('\n  (you can still accept with missing fields — they will be flagged)'));
  }

  // Determine target filename
  const targetFilename = fm.title
    ? toSlug(String(fm.title)) + '.md'
    : filename;
  const targetPath = path.join(vaultPath, targetFolder, targetFilename);

  console.log(
    chalk.dim(`\n  Will move to: ${targetFolder}/${targetFilename}`)
  );

  const answer = await prompt(chalk.bold('\n  [a]ccept  [s]kip  > '));

  if (!['a', 'accept'].includes(answer.toLowerCase())) {
    console.log(chalk.dim('  Skipped.\n'));
    return;
  }

  // Prepare canonical frontmatter
  const canonicalFm = { ...fm };
  if (canonicalFm.subtype) delete canonicalFm.subtype;
  canonicalFm.type = canonicalType;

  // Regenerate the `## Links` section from linked_* frontmatter fields so
  // Obsidian's backlink graph actually sees the connections. Idempotent —
  // strips any prior "## Links" block before appending the new one.
  const bodyWithLinks = upsertLinksSection(content, canonicalFm);
  const newContent = matter.stringify(bodyWithLinks, canonicalFm);

  // Write to target folder
  const targetDir = path.join(vaultPath, targetFolder);
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(targetPath, newContent, 'utf-8');

  // Archive draft
  const archiveDir = path.join(vaultPath, 'archive');
  if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir, { recursive: true });
  fs.renameSync(draftPath, path.join(archiveDir, filename));

  console.log(chalk.green(`\n  ✓ Saved:    ${targetFolder}/${targetFilename}`));
  console.log(chalk.dim(`  ✓ Archived: archive/${filename}`));

  // Git commit
  if (isGitRepo(vaultPath)) {
    try {
      gitAdd(vaultPath, targetPath);
      const title = fm.title || filename.replace('.md', '');
      const commitMsg = `publish: ${title} (${canonicalType})`;
      gitCommit(vaultPath, commitMsg);
      console.log(chalk.green(`  ✓ Committed: "${commitMsg}" (local — pushed at kb branch --close)`));

      // Update active session if one exists
      const session = readSession(vaultPath);
      if (session) {
        const relPath = path.relative(vaultPath, targetPath);
        if (!session.artifacts.includes(relPath)) {
          session.artifacts.push(relPath);
          writeSession(vaultPath, session);
        }

        console.log(chalk.dim(`  ✓ Added to session: ${relPath}  (${session.artifacts.length} artifact${session.artifacts.length !== 1 ? 's' : ''} total)`))
      }
    } catch (e: any) {
      console.log(chalk.yellow(`  ⚠ Git commit failed: ${e.message?.split('\n')[0]}`));
      console.log(chalk.dim('    Run: git add + git commit manually'));
    }
  } else {
    console.log(chalk.dim('  (not a git repo — skipping commit)'));
  }

  console.log();
}

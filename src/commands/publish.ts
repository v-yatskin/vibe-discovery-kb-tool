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
import { upsertLinksSection } from '../vault/wikilinks';
import { peekEdit, consumeEdit } from '../vault/edits';
import { writeArchiveEntry } from '../vault/archive';

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

  // Edit-draft path: created by `kb edit`. We overwrite the original
  // canonical file in place rather than deriving a target from fm.type.
  const editTarget = peekEdit(vaultPath, filename);
  if (editTarget) {
    await publishEdit(vaultPath, draftPath, filename, editTarget, fm, content, raw);
    return;
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

  // Delete draft (was never committed — gitignored) and write archive entry
  fs.unlinkSync(draftPath);
  const session = readSession(vaultPath);
  const archiveRel = writeArchiveEntry(vaultPath, {
    action: 'publish',
    canonicalRel: path.join(targetFolder, targetFilename),
    fm: canonicalFm,
    session,
  });

  console.log(chalk.green(`\n  ✓ Saved:    ${targetFolder}/${targetFilename}`));
  console.log(chalk.dim(`  ✓ Archive:  ${archiveRel}`));

  // Git commit
  if (isGitRepo(vaultPath)) {
    try {
      gitAdd(vaultPath, targetPath);
      const title = fm.title || filename.replace('.md', '');
      const commitMsg = `publish: ${title} (${canonicalType})`;
      gitCommit(vaultPath, commitMsg);
      console.log(chalk.green(`  ✓ Committed: "${commitMsg}" (local — pushed at kb branch --close)`));

      // Update active session if one exists (session already read above for archive entry)
      if (session) {
        const relPath = path.relative(vaultPath, targetPath);
        if (!session.artifacts.includes(relPath)) {
          session.artifacts.push(relPath);
          writeSession(vaultPath, session);
        }
        console.log(chalk.dim(`  ✓ Added to session: ${relPath}  (${session.artifacts.length} artifact${session.artifacts.length !== 1 ? 's' : ''} total)`));
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

// Handles drafts created by `kb edit` — update the canonical file in
// place, no folder move, commit as `update: ...`.
async function publishEdit(
  vaultPath: string,
  draftPath: string,
  draftFilename: string,
  canonicalRel: string,
  fm: Record<string, any>,
  content: string,
  draftRaw: string
): Promise<void> {
  const targetPath = path.join(vaultPath, canonicalRel);
  if (!fs.existsSync(targetPath)) {
    console.error(chalk.red(`\nOriginal file no longer exists: ${canonicalRel}`));
    console.log(chalk.dim('The edit is stale — remove the draft manually or retry kb edit.\n'));
    process.exit(1);
  }

  console.log(chalk.bold(`\nPublishing edit: ${draftFilename}`));
  console.log(chalk.dim(`  → ${canonicalRel} (in place)`));

  // Schema validation (best effort — use draft's type)
  const typeForValidation = String(fm.type || '').toLowerCase();
  if (typeForValidation) {
    const result = validate(typeForValidation, fm);
    if (result.missing.length > 0) {
      console.log(chalk.yellow('\n  Missing required fields:'));
      result.missing.forEach((f) => console.log(chalk.yellow(`    ✗ ${f}`)));
    }
    if (result.invalid.length > 0) {
      console.log(chalk.red('\n  Invalid values:'));
      result.invalid.forEach((f) => console.log(chalk.red(`    ✗ ${f}`)));
    }
    if (result.valid) console.log(chalk.green('\n  ✓ Schema valid'));
  }

  // Diff frontmatter fields so the user can see what changed before accepting.
  const originalRaw = fs.readFileSync(targetPath, 'utf-8');
  const originalParsed = matter(originalRaw);
  const originalFm = originalParsed.data || {};
  const allKeys = new Set([...Object.keys(originalFm), ...Object.keys(fm)]);
  const changes: string[] = [];
  for (const k of allKeys) {
    const a = JSON.stringify(originalFm[k] ?? null);
    const b = JSON.stringify(fm[k] ?? null);
    if (a !== b) changes.push(`    ${k}: ${chalk.dim(a)} → ${chalk.white(b)}`);
  }
  if (changes.length > 0) {
    console.log(chalk.bold('\n  Frontmatter changes:'));
    changes.forEach((c) => console.log(c));
  } else {
    console.log(chalk.dim('\n  (no frontmatter changes — body edits only)'));
  }

  const bodyChanged = originalParsed.content.trim() !== content.trim();
  if (bodyChanged) console.log(chalk.dim('\n  Body: changed'));

  const answer = await prompt(chalk.bold('\n  [a]ccept  [s]kip  > '));
  if (!['a', 'accept'].includes(answer.toLowerCase())) {
    console.log(chalk.dim('  Skipped — draft remains in 00_Drafts/.\n'));
    return;
  }

  // Regenerate Links section from the edited fm
  const bodyWithLinks = upsertLinksSection(content, fm);
  const newContent = matter.stringify(bodyWithLinks, fm);
  fs.writeFileSync(targetPath, newContent, 'utf-8');

  // Delete draft and write archive entry
  fs.unlinkSync(draftPath);
  consumeEdit(vaultPath, draftFilename);
  const editSession = readSession(vaultPath);
  const diffedFields = changes.length > 0
    ? Object.keys(originalFm).filter((k) => JSON.stringify(originalFm[k]) !== JSON.stringify(fm[k]))
    : [];
  const archiveRel = writeArchiveEntry(vaultPath, {
    action: 'update',
    canonicalRel,
    fm,
    changedFields: diffedFields,
    session: editSession,
  });

  console.log(chalk.green(`\n  ✓ Updated:  ${canonicalRel}`));
  console.log(chalk.dim(`  ✓ Archive:  ${archiveRel}`));

  if (isGitRepo(vaultPath)) {
    try {
      gitAdd(vaultPath, targetPath);
      const title = fm.title || path.basename(targetPath).replace(/\.md$/, '');
      const changedLabel = diffedFields.length > 0 ? ` (${diffedFields.join(', ') || 'content'})` : '';
      const commitMsg = `update: ${title}${changedLabel}`;
      gitCommit(vaultPath, commitMsg);
      console.log(chalk.green(`  ✓ Committed: "${commitMsg}" (local — push at kb branch --close)`));

      if (editSession) {
        const relPath = path.relative(vaultPath, targetPath);
        if (!editSession.artifacts.includes(relPath)) {
          editSession.artifacts.push(relPath);
          writeSession(vaultPath, editSession);
        }
      }
    } catch (e: any) {
      console.log(chalk.yellow(`  ⚠ Git commit failed: ${e.message?.split('\n')[0]}`));
    }
  }
  console.log();
}

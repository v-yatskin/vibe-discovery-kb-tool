import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import matter from 'gray-matter';
import { getVaultPath } from '../config';
import { readAllCanonical } from '../vault/reader';
import { gitAdd, gitCommit, isGitRepo } from '../vault/git';

function findFile(vaultPath: string, target: string) {
  const direct = path.join(vaultPath, target);
  if (fs.existsSync(direct) && fs.statSync(direct).isFile()) return direct;
  const needle = target.replace(/\.md$/, '').toLowerCase();
  const match = readAllCanonical(vaultPath).find(
    (f) => f.filename.replace(/\.md$/, '').toLowerCase() === needle
  );
  return match ? match.path : null;
}

// Find other canonical files whose linked_* frontmatter references this slug.
function findBacklinks(vaultPath: string, retiredSlug: string, excludePath: string) {
  const canonical = readAllCanonical(vaultPath);
  const hits: { path: string; fields: string[] }[] = [];
  for (const file of canonical) {
    if (file.path === excludePath) continue;
    const fm = file.frontmatter || {};
    const matchingFields: string[] = [];
    for (const [k, v] of Object.entries(fm)) {
      if (!k.startsWith('linked_') || !Array.isArray(v)) continue;
      const normalized = v.map((x) => String(x).trim().replace(/\.md$/, ''));
      if (normalized.includes(retiredSlug)) matchingFields.push(k);
    }
    if (matchingFields.length > 0) hits.push({ path: file.path, fields: matchingFields });
  }
  return hits;
}

export function retireCommand(target: string, options: { reason?: string }) {
  const vaultPath = getVaultPath();
  if (!target) {
    console.error(chalk.red('\nUsage: kb retire <path or slug> --reason "..."\n'));
    process.exit(1);
  }
  if (!options.reason) {
    console.error(chalk.red('\nA --reason is required so future-you knows why this was retired.\n'));
    process.exit(1);
  }

  const absPath = findFile(vaultPath, target);
  if (!absPath) {
    console.error(chalk.red(`\nFile not found: ${target}\n`));
    process.exit(1);
  }

  const canonicalRel = path.relative(vaultPath, absPath);
  const retiredSlug = path.basename(absPath).replace(/\.md$/, '');

  // Read + update frontmatter
  const raw = fs.readFileSync(absPath, 'utf-8');
  const parsed = matter(raw);
  const fm = parsed.data || {};
  const priorStatus = fm.status;
  fm.status = 'archived';
  fm.archived_reason = options.reason;
  fm.archived_date = new Date().toISOString().substring(0, 10);
  if (priorStatus) fm.status_before_archive = priorStatus;
  const newRaw = matter.stringify(parsed.content, fm);

  // Destination: archive/[original-parent]/[filename]
  const parentFolder = path.basename(path.dirname(absPath));
  const archiveFolder = path.join(vaultPath, 'archive', parentFolder);
  if (!fs.existsSync(archiveFolder)) fs.mkdirSync(archiveFolder, { recursive: true });
  const destPath = path.join(archiveFolder, path.basename(absPath));
  fs.writeFileSync(destPath, newRaw, 'utf-8');
  fs.unlinkSync(absPath);

  const archiveRel = path.relative(vaultPath, destPath);
  console.log(chalk.green(`\n✓ Retired\n`));
  console.log(`  ${chalk.white('From:')}   ${canonicalRel}`);
  console.log(`  ${chalk.white('To:')}     ${archiveRel}`);
  console.log(`  ${chalk.white('Reason:')} ${options.reason}`);

  // Warn about backlinks
  const backlinks = findBacklinks(vaultPath, retiredSlug, absPath);
  if (backlinks.length > 0) {
    console.log(chalk.yellow(`\n  ⚠ ${backlinks.length} file(s) still link to ${retiredSlug}:`));
    backlinks.forEach((h) => {
      console.log(chalk.yellow(`    · ${path.relative(vaultPath, h.path)} (${h.fields.join(', ')})`));
    });
    console.log(chalk.dim(`\n  Clean them up with \`kb edit\` or accept the broken links.`));
  }
  console.log();

  if (isGitRepo(vaultPath)) {
    try {
      // Original path is tracked — normal add picks up the deletion
      gitAdd(vaultPath, absPath);
      // archive/ is gitignored (protects kb publish's draft-archival); force-add so
      // retired canonical files become tracked in the team repo
      gitAdd(vaultPath, destPath, { force: true });
      const title = fm.title || retiredSlug;
      gitCommit(vaultPath, `retire: ${title} — ${options.reason}`);
      console.log(chalk.green(`  ✓ Committed (local — push at kb branch --close)\n`));
    } catch (e: any) {
      console.log(chalk.yellow(`  ⚠ Git commit failed: ${e.message?.split('\n')[0]}\n`));
    }
  }
}

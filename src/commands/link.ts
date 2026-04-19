import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import matter from 'gray-matter';
import { getVaultPath } from '../config';
import { readAllCanonical } from '../vault/reader';
import { upsertLinksSection } from '../vault/wikilinks';
import { gitAdd, gitCommit, isGitRepo } from '../vault/git';

// Map an entity's type to the frontmatter field that points AT it from
// other entities. E.g., to link source→target where target is a problem,
// we add target's slug to source.linked_problems.
const TYPE_TO_LINKED_FIELD: Record<string, string> = {
  problem: 'linked_problems',
  insight: 'linked_insights',
  experiment: 'linked_experiments',
  decision: 'linked_decisions',
  initiative: 'linked_initiatives',
  feature: 'linked_features',
  'data-snapshot': 'linked_data',
};

function findFile(vaultPath: string, target: string) {
  const direct = path.join(vaultPath, target);
  if (fs.existsSync(direct) && fs.statSync(direct).isFile()) return direct;
  const needle = target.replace(/\.md$/, '').toLowerCase();
  const match = readAllCanonical(vaultPath).find(
    (f) => f.filename.replace(/\.md$/, '').toLowerCase() === needle
  );
  return match ? match.path : null;
}

export function linkCommand(src: string, target: string) {
  const vaultPath = getVaultPath();
  if (!src || !target) {
    console.error(chalk.red('\nUsage: kb link <source> <target>\n'));
    console.log(chalk.dim('Adds target\'s slug to source\'s linked_[type] frontmatter, regenerates ## Links section, commits.\n'));
    process.exit(1);
  }

  const srcPath = findFile(vaultPath, src);
  const targetPath = findFile(vaultPath, target);
  if (!srcPath) {
    console.error(chalk.red(`\nSource file not found: ${src}\n`));
    process.exit(1);
  }
  if (!targetPath) {
    console.error(chalk.red(`\nTarget file not found: ${target}\n`));
    process.exit(1);
  }

  const srcRaw = fs.readFileSync(srcPath, 'utf-8');
  const srcParsed = matter(srcRaw);
  const srcFm = srcParsed.data || {};
  const srcBody = srcParsed.content;

  const targetRaw = fs.readFileSync(targetPath, 'utf-8');
  const targetFm = matter(targetRaw).data || {};
  const targetType = String(targetFm.type || '').toLowerCase();
  const targetSlug = path.basename(targetPath).replace(/\.md$/, '');

  const field = TYPE_TO_LINKED_FIELD[targetType];
  if (!field) {
    console.error(chalk.red(`\nTarget has unknown type: "${targetType}" — can't determine which linked_* field to update.\n`));
    process.exit(1);
  }

  const existing = Array.isArray(srcFm[field]) ? srcFm[field] : [];
  const existingSlugs = existing.map((v: any) => String(v).trim().replace(/\.md$/, ''));
  if (existingSlugs.includes(targetSlug)) {
    console.log(chalk.dim(`\n${path.relative(vaultPath, srcPath)} already links to ${targetSlug} — nothing to do.\n`));
    return;
  }

  srcFm[field] = [...existing, targetSlug];
  const newBody = upsertLinksSection(srcBody, srcFm);
  const newRaw = matter.stringify(newBody, srcFm);
  fs.writeFileSync(srcPath, newRaw, 'utf-8');

  const srcRel = path.relative(vaultPath, srcPath);
  const targetRel = path.relative(vaultPath, targetPath);

  console.log(chalk.green(`\n✓ Linked\n`));
  console.log(`  ${chalk.white(srcRel)}`);
  console.log(`  ${chalk.dim('  →')} ${field}: [...${targetSlug}]`);
  console.log(`  ${chalk.dim('  →')} ${targetRel}\n`);

  if (isGitRepo(vaultPath)) {
    try {
      gitAdd(vaultPath, srcPath);
      const srcTitle = srcFm.title || path.basename(srcPath).replace(/\.md$/, '');
      const targetTitle = targetFm.title || targetSlug;
      gitCommit(vaultPath, `link: ${srcTitle} → ${targetTitle}`);
      console.log(chalk.green(`  ✓ Committed (local — push at kb branch --close)\n`));
    } catch (e: any) {
      console.log(chalk.yellow(`  ⚠ Git commit failed: ${e.message?.split('\n')[0]}\n`));
    }
  }
}

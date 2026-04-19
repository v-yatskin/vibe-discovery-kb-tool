import chalk from 'chalk';
import Fuse from 'fuse.js';
import path from 'path';
import { getVaultPath } from '../config';
import { readAllCanonical, VaultFile } from '../vault/reader';
import { loadIndex, cosineSimilarity } from '../search/vectors';
import { embed } from '../search/embed';

interface SearchItem extends VaultFile {
  searchText: string;
}

export async function searchCommand(
  query: string,
  options: { type?: string; limit?: number }
) {
  const vaultPath = getVaultPath();
  const limit = options.limit || 8;

  let files = readAllCanonical(vaultPath);
  if (options.type) {
    files = files.filter((f) => f.frontmatter.type === options.type);
  }

  // ── Keyword (fuse.js) ────────────────────────────────────────────────
  const items: SearchItem[] = files.map((f) => ({
    ...f,
    searchText: [
      f.frontmatter.title || '',
      f.frontmatter.type || '',
      String(f.frontmatter.source || ''),
      String(f.frontmatter.partner || ''),
      (f.frontmatter.tags || []).join(' '),
      f.content,
    ].join(' '),
  }));

  const fuse = new Fuse(items, {
    keys: ['searchText'],
    threshold: 0.45,
    includeScore: true,
    ignoreLocation: true,
    minMatchCharLength: 2,
  });
  const keywordRanked = fuse.search(query).map((r) => path.relative(vaultPath, r.item.path));

  // ── Semantic (if index exists) ───────────────────────────────────────
  const index = loadIndex(vaultPath);
  let semanticRanked: string[] = [];
  if (index) {
    const queryVec = await embed(query);
    const inScope = new Set(files.map((f) => path.relative(vaultPath, f.path)));
    semanticRanked = index.entries
      .filter((e) => inScope.has(e.path))
      .map((e) => ({ relPath: e.path, score: cosineSimilarity(queryVec, e.vector) }))
      .sort((a, b) => b.score - a.score)
      .map((e) => e.relPath);
  }

  // ── Reciprocal Rank Fusion ───────────────────────────────────────────
  // RRF doesn't require score calibration across sources — each adds 1/(k+rank).
  const K = 60;
  const fused = new Map<string, number>();
  keywordRanked.forEach((rel, rank) => {
    fused.set(rel, (fused.get(rel) || 0) + 1 / (K + rank));
  });
  semanticRanked.forEach((rel, rank) => {
    fused.set(rel, (fused.get(rel) || 0) + 1 / (K + rank));
  });

  const ranked = Array.from(fused.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);

  if (ranked.length === 0) {
    console.log(chalk.yellow(`\nNo results for: "${query}"\n`));
    return;
  }

  const mode = index
    ? chalk.dim('hybrid — keyword + semantic')
    : chalk.dim('keyword only — run `kb index` to enable semantic search');
  console.log(chalk.bold(`\nSEARCH: "${query}"`) + '  ' + mode);
  console.log();

  const fileByRel = new Map(files.map((f) => [path.relative(vaultPath, f.path), f]));
  ranked.forEach(([relPath]) => {
    const file = fileByRel.get(relPath);
    if (!file) return;
    const author = String(file.frontmatter.author || (file.frontmatter.attendees || [])[0] || '');
    const date = String(file.frontmatter.created || file.frontmatter.date || '').substring(0, 10);
    console.log(
      `  ${chalk.white(relPath.padEnd(58))} ${chalk.dim(author.padEnd(8))} ${chalk.dim(date)}`
    );
  });
  console.log();
}

import chalk from 'chalk';
import Fuse from 'fuse.js';
import path from 'path';
import { getVaultPath } from '../config';
import { readAllCanonical, VaultFile } from '../vault/reader';

interface SearchItem extends VaultFile {
  searchText: string;
}

export function searchCommand(
  query: string,
  options: { type?: string; limit?: number }
) {
  const vaultPath = getVaultPath();
  const limit = options.limit || 8;

  let files = readAllCanonical(vaultPath);

  if (options.type) {
    files = files.filter((f) => f.frontmatter.type === options.type);
  }

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

  const results = fuse.search(query).slice(0, limit);

  if (results.length === 0) {
    console.log(chalk.yellow(`\nNo results for: "${query}"\n`));
    return;
  }

  console.log(chalk.bold(`\nSEARCH: "${query}"`) + chalk.dim('  (keyword — run kb index for semantic search)'));
  console.log();

  results.forEach(({ item, score }) => {
    const pct = Math.round((1 - (score || 0)) * 100);
    const relPath = path.relative(vaultPath, item.path);
    const title = String(item.frontmatter.title || item.filename).substring(0, 50);
    const author = String(item.frontmatter.author || (item.frontmatter.attendees || [])[0] || '');
    const date = String(item.frontmatter.created || item.frontmatter.date || '').substring(0, 10);

    console.log(
      `  ${chalk.dim(String(pct).padStart(3) + '%')}  ${chalk.white(relPath.padEnd(58))} ${chalk.dim(author.padEnd(8))} ${chalk.dim(date)}`
    );
  });

  console.log();
}

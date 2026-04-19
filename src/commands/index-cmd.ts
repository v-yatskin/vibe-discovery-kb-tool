import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { getVaultPath } from '../config';
import { readAllCanonical, VaultFile } from '../vault/reader';
import { embed, EMBED_MODEL } from '../search/embed';
import { IndexEntry, loadIndex, saveIndex, hashContent } from '../search/vectors';

function buildIndexText(file: VaultFile): string {
  const fm = file.frontmatter || {};
  const parts = [
    String(fm.type || ''),
    String(fm.title || ''),
    String(fm.source || ''),
    String(fm.partner || ''),
    (fm.tags || []).join(' '),
    file.content || '',
  ];
  // Cap at 4000 chars — embedder tokenizer truncates at ~512 tokens anyway,
  // and reading less content off disk speeds up `kb index --diff`.
  return parts.filter(Boolean).join(' ').substring(0, 4000);
}

export async function indexCommand(options: { diff?: boolean; quiet?: boolean; rebuild?: boolean }) {
  const vaultPath = getVaultPath();
  const quiet = !!options.quiet;
  const useDiff = !!options.diff && !options.rebuild;

  const files = readAllCanonical(vaultPath);
  if (files.length === 0) {
    if (!quiet) console.log(chalk.dim('\nNo canonical files to index.\n'));
    return;
  }

  const existing = useDiff ? loadIndex(vaultPath) : null;
  const existingByPath = new Map<string, IndexEntry>();
  if (existing) {
    for (const e of existing.entries) existingByPath.set(e.path, e);
  }

  const spinner = quiet
    ? null
    : ora(`Loading ${EMBED_MODEL} (first run downloads ~22MB to ~/.kb/model/)...`).start();

  const entries: IndexEntry[] = [];
  let embedded = 0;
  let reused = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const relPath = path.relative(vaultPath, file.path);
    const text = buildIndexText(file);
    const hash = hashContent(text);
    const prev = existingByPath.get(relPath);

    if (prev && prev.hash === hash) {
      entries.push(prev);
      reused++;
    } else {
      try {
        const vector = await embed(text);
        entries.push({ path: relPath, hash, vector });
        embedded++;
      } catch (e: any) {
        if (spinner) spinner.stop();
        console.error(chalk.red(`\n✗ Failed to embed ${relPath}: ${e?.message || e}`));
        throw e;
      }
    }

    if (spinner) {
      spinner.text = `Indexing ${i + 1}/${files.length}: ${relPath}`;
    }
  }

  saveIndex(vaultPath, entries);

  if (spinner) {
    spinner.succeed(
      `Indexed ${entries.length} files  ${chalk.dim(`(${embedded} embedded, ${reused} reused)`)}`
    );
  }
}

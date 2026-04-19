import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import * as readline from 'readline';
import { getVaultPath } from '../config';

function toSlug(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .substring(0, 50);
}

function todayISO(): string {
  return new Date().toISOString().substring(0, 10);
}

function isValidDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}

function askOnce(rl: readline.Interface, q: string, def?: string): Promise<string> {
  const suffix = def ? chalk.dim(` [${def}] `) : ' ';
  return new Promise((resolve) => {
    rl.question(q + suffix, (a) => resolve(a.trim() || def || ''));
  });
}

export async function snapshotCommand(options: { title?: string; date?: string }) {
  const vaultPath = getVaultPath();
  let { title, date } = options;

  // Interactive fallback for anything missing
  if (!title || !date) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    try {
      if (!title) title = await askOnce(rl, chalk.cyan('Snapshot title? (e.g. "monthly retention by cohort")'));
      if (!date) date = await askOnce(rl, chalk.cyan('Date? (YYYY-MM-DD)'), todayISO());
    } finally {
      rl.close();
    }
  }

  if (!title) {
    console.error(chalk.red('\nA title is required.\n'));
    process.exit(1);
  }
  if (!date || !isValidDate(date)) {
    console.error(chalk.red(`\nInvalid date: "${date}". Expected YYYY-MM-DD.\n`));
    process.exit(1);
  }

  const slug = toSlug(title);
  if (!slug) {
    console.error(chalk.red(`\nCan't derive a slug from title: "${title}".\n`));
    process.exit(1);
  }

  const dirName = `${date}-${slug}`;
  const dataDir = path.join(vaultPath, '11_Data');
  const snapshotDir = path.join(dataDir, dirName);

  if (fs.existsSync(snapshotDir)) {
    console.error(chalk.red(`\nSnapshot folder already exists: 11_Data/${dirName}/\n`));
    process.exit(1);
  }

  fs.mkdirSync(snapshotDir, { recursive: true });

  const metadata = `---
type: data-snapshot
title: "${title}"
date: ${date}
source: ""
linked_insights: []
linked_decisions: []
confidence: medium
---

## Source

Where did this data come from? (Amplitude query, CSV export, manual pull, etc.)
Include the exact query or URL if possible — future-you will want to reproduce it.

## What this shows

1-2 sentences describing the data and the shape of the table.

## Numbers worth calling out

- ...

## Caveats

Sampling, date range, known exclusions, anything that could mislead a reader.
`;

  fs.writeFileSync(path.join(snapshotDir, 'snapshot.md'), metadata, 'utf-8');

  console.log(chalk.green.bold(`\n✓ Snapshot folder created\n`));
  console.log(`  ${chalk.white('Path:')}  11_Data/${dirName}/`);
  console.log(`  ${chalk.white('Files:')} snapshot.md (metadata template)`);
  console.log();
  console.log(chalk.bold('Next:'));
  console.log(`  1. Drop your data file in: ${chalk.dim(`11_Data/${dirName}/data.csv`)} (or .json / .tsv)`);
  console.log(`  2. Optionally add: ${chalk.dim(`chart.png`)} or any other artifacts`);
  console.log(`  3. Edit snapshot.md — fill in Source, What this shows, Numbers, Caveats`);
  console.log(`  4. Link the snapshot from relevant insights/decisions by adding its path to \`linked_data\` frontmatter`);
  console.log();
}

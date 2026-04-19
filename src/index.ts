#!/usr/bin/env node
import { Command } from 'commander';
import { listCommand } from './commands/list';
import { draftCommand } from './commands/draft';
import { publishCommand } from './commands/publish';
import { searchCommand } from './commands/search';
import { statusCommand } from './commands/status';
import { branchCommand } from './commands/branch';
import { initCommand } from './commands/init';
import { updatesCommand } from './commands/updates';
import { indexCommand } from './commands/index-cmd';
import { baseCommand } from './commands/base';

const program = new Command();

program
  .name('kb')
  .description('Product knowledge vault CLI')
  .version('0.3.0');

program
  .command('init')
  .description('Create a new vault (or add missing structure with --upgrade)')
  .option('--upgrade', 'Add missing folders/slash commands/templates to an existing vault')
  .action((options) => initCommand(options));

program
  .command('base')
  .description('List the vault\'s Obsidian bases (.base files under Bases/)')
  .option('--list', 'List all bases (default)')
  .action((options) => baseCommand(options));

program
  .command('index')
  .description('Build/refresh the semantic search index (.kb/vectors.json)')
  .option('--diff', 'Only re-embed files whose content hash changed (fast)')
  .option('--rebuild', 'Force full re-embed (overrides --diff)')
  .option('--quiet', 'Suppress output (used by post-merge hook)')
  .action((options) => indexCommand(options));

program
  .command('updates')
  .description('Log what changed after a git pull (--generate is the default action)')
  .option('--generate', 'Write Updates-Log/YYYY-MM-DD-HHMM.md for ORIG_HEAD..HEAD (default)')
  .option('--list', 'List existing update logs')
  .option('--quiet', 'Suppress output (used by post-merge hook)')
  .action((options) => updatesCommand(options));

program
  .command('list [type]')
  .description('List vault entities by type (problem, insight, feature, ...)')
  .option('--status <status>', 'Filter by status')
  .action((type, options) => listCommand(type, options));

program
  .command('draft')
  .description('Create a draft file from template in 00_Drafts/')
  .requiredOption('--type <type>', 'Entity type (problem, insight, feature, ...)')
  .option('--title <title>', 'Title / slug hint')
  .action((options) => draftCommand(options));

program
  .command('publish [filename]')
  .description('Validate schema and commit a draft to the vault')
  .action((filename) => publishCommand(filename));

program
  .command('search <query>')
  .description('Keyword search across all vault files')
  .option('--type <type>', 'Filter by entity type')
  .option('--limit <n>', 'Max results (default: 8)')
  .action((query, options) =>
    searchCommand(query, {
      type: options.type,
      limit: options.limit ? parseInt(options.limit) : 8,
    })
  );

program
  .command('status')
  .description('Show vault health dashboard')
  .action(() => statusCommand());

program
  .command('branch')
  .description('Manage session branches and draft PRs')
  .option('--open <topic>', 'Open a new session branch for this topic')
  .option('--close', 'Update PR body, squash-merge, return to main')
  .option('--status', 'Show active session state')
  .action((options) => branchCommand(options));

program.parse();

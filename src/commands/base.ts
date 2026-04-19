import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { getVaultPath } from '../config';

// Bases live at <vault>/Bases/*.base. Obsidian 1.9+ renders each as a
// live filtered table. `kb base` is a thin CLI convenience — creating
// and filtering bases happens in Obsidian.

function basesDir(vaultPath: string): string {
  return path.join(vaultPath, 'Bases');
}

export function baseCommand(options: { list?: boolean }) {
  const vaultPath = getVaultPath();

  // Default action is --list (only action for now).
  if (options.list !== false) {
    const dir = basesDir(vaultPath);
    if (!fs.existsSync(dir)) {
      console.log(chalk.dim(`\nNo Bases/ folder yet. Run \`kb init --upgrade\` to seed starter bases.\n`));
      return;
    }
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.base')).sort();
    if (files.length === 0) {
      console.log(chalk.dim(`\nBases/ is empty. Run \`kb init --upgrade\` to seed starter bases.\n`));
      return;
    }
    console.log(chalk.bold(`\n${files.length} base${files.length === 1 ? '' : 's'} in ${path.relative(vaultPath, dir)}/:\n`));
    files.forEach((f) => {
      console.log(`  · ${chalk.white(f.replace('.base', ''))}`);
    });
    console.log(chalk.dim('\n  Open any of these in Obsidian to see the live filtered view.\n'));
  }
}

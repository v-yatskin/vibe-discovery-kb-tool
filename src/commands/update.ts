import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync, spawnSync } from 'child_process';
import chalk from 'chalk';

const INSTALL_DIR = process.env.KB_INSTALL_DIR || path.join(os.homedir(), '.kb', 'app');

export function updateCommand() {
  const installScript = path.join(INSTALL_DIR, 'scripts', 'install.sh');

  if (!fs.existsSync(installScript)) {
    console.error(chalk.red(`\n✗ Can't find install script at ${installScript}`));
    console.log(chalk.dim('  Re-install from scratch:'));
    console.log(chalk.dim('  curl -fsSL https://raw.githubusercontent.com/v-yatskin/vibe-discovery-kb-tool/main/scripts/install.sh | bash\n'));
    process.exit(1);
  }

  // Show current version before update
  let before = 'unknown';
  try {
    before = execSync(`${process.argv[1]} --version`, { stdio: 'pipe' }).toString().trim();
  } catch { /* non-fatal */ }

  console.log(chalk.bold(`\nUpdating kb  ${chalk.dim(`(current: ${before})`)}\n`));

  const result = spawnSync('bash', [installScript], { stdio: 'inherit' });

  if (result.status !== 0) {
    console.error(chalk.red('\n✗ Update failed.\n'));
    process.exit(result.status ?? 1);
  }
}

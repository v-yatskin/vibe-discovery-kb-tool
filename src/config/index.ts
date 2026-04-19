import fs from 'fs';
import path from 'path';
import os from 'os';

export interface KbConfig {
  vault_path: string;
  author: string;
  team: string[];
  editor: string;
  auto_git_commit: boolean;
}

const CONFIG_PATH = path.join(os.homedir(), '.kb', 'config.json');

export function getConfig(): KbConfig | null {
  if (!fs.existsSync(CONFIG_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  } catch {
    return null;
  }
}

// Walk up from CWD looking for a git repo. A teammate with multiple vaults
// (or two people on one machine) expects `kb X` to operate on whichever vault
// they're cd'd into — not the configured default from whoever ran `kb init` last.
function findVaultFromCwd(): string | null {
  let dir = process.cwd();
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, '.git'))) return dir;
    dir = path.dirname(dir);
  }
  return null;
}

export function getVaultPath(): string {
  const fromCwd = findVaultFromCwd();
  if (fromCwd) return fromCwd;
  const config = getConfig();
  if (config?.vault_path && fs.existsSync(config.vault_path)) {
    return config.vault_path;
  }
  return process.cwd();
}

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

export function getVaultPath(): string {
  const config = getConfig();
  if (config?.vault_path && fs.existsSync(config.vault_path)) {
    return config.vault_path;
  }
  // PoC default: current working directory
  return process.cwd();
}

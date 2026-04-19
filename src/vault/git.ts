import { execSync } from 'child_process';

export function gitAdd(vaultPath: string, filePath: string): void {
  execSync(`git add "${filePath}"`, { cwd: vaultPath, stdio: 'pipe' });
}

export function gitCommit(vaultPath: string, message: string): void {
  execSync(`git commit -m "${message}"`, { cwd: vaultPath, stdio: 'pipe' });
}

export function gitStatusShort(vaultPath: string): string {
  try {
    return execSync('git status --short', { cwd: vaultPath, stdio: 'pipe' })
      .toString()
      .trim();
  } catch {
    return '';
  }
}

export function gitLastCommit(vaultPath: string): string {
  try {
    return execSync('git log --oneline -1', { cwd: vaultPath, stdio: 'pipe' })
      .toString()
      .trim();
  } catch {
    return 'no commits yet';
  }
}

export function isGitRepo(vaultPath: string): boolean {
  try {
    execSync('git rev-parse --git-dir', { cwd: vaultPath, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

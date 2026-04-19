import fs from 'fs';
import path from 'path';

export interface Session {
  branch: string;
  pr_number: number;   // 0 = no PR yet (gh not available or no remote)
  pr_url: string;
  topic: string;
  opened_at: string;
  author: string;
  artifacts: string[]; // relative paths, e.g. "06_Features/delayed-messages.md"
}

function sessionFilePath(vaultPath: string): string {
  return path.join(vaultPath, '.kb', 'session.json');
}

export function readSession(vaultPath: string): Session | null {
  const p = sessionFilePath(vaultPath);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    return null;
  }
}

export function writeSession(vaultPath: string, session: Session): void {
  const dir = path.join(vaultPath, '.kb');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(sessionFilePath(vaultPath), JSON.stringify(session, null, 2), 'utf-8');
}

export function clearSession(vaultPath: string): void {
  const p = sessionFilePath(vaultPath);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

export function buildPRBody(session: Session): string {
  const artifactList =
    session.artifacts.length > 0
      ? session.artifacts.map((a) => `- [x] ${a}`).join('\n')
      : '- (none yet)';

  return `## Context
**Topic:** ${session.topic}
**Branch:** ${session.branch}
**Opened:** ${session.opened_at.substring(0, 10)}${session.author ? ' by ' + session.author : ''}

## Artifacts in this PR
${artifactList}

## Review checklist
- [ ] All entities have valid schema
- [ ] Features linked to at least one problem
- [ ] Figma URLs filled in for features in spec or in-dev
- [ ] Grooming entry exists for new features`;
}

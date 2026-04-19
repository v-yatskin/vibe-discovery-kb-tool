import fs from 'fs';
import path from 'path';

// Tracks drafts that were created by `kb edit` so `kb publish` knows to
// treat them as updates-in-place instead of new entities.

const EDITS_FILE = '.kb/pending-edits.json';

export type PendingEdits = Record<string, string>; // draftFilename -> canonicalRelativePath

function editsPath(vaultPath: string): string {
  return path.join(vaultPath, EDITS_FILE);
}

export function readPendingEdits(vaultPath: string): PendingEdits {
  const p = editsPath(vaultPath);
  if (!fs.existsSync(p)) return {};
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    return {};
  }
}

export function writePendingEdits(vaultPath: string, edits: PendingEdits): void {
  const p = editsPath(vaultPath);
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(p, JSON.stringify(edits, null, 2), 'utf-8');
}

export function markEdit(vaultPath: string, draftFilename: string, canonicalRelPath: string): void {
  const edits = readPendingEdits(vaultPath);
  edits[draftFilename] = canonicalRelPath;
  writePendingEdits(vaultPath, edits);
}

export function consumeEdit(vaultPath: string, draftFilename: string): string | null {
  const edits = readPendingEdits(vaultPath);
  const canonical = edits[draftFilename];
  if (!canonical) return null;
  delete edits[draftFilename];
  writePendingEdits(vaultPath, edits);
  return canonical;
}

export function peekEdit(vaultPath: string, draftFilename: string): string | null {
  return readPendingEdits(vaultPath)[draftFilename] || null;
}

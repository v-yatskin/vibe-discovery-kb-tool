import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { EMBED_MODEL } from './embed';

export interface IndexEntry {
  path: string;       // relative to vaultPath
  hash: string;       // content hash — used by `kb index --diff`
  vector: number[];   // length EMBED_DIM, normalized
}

export interface VectorIndex {
  model: string;
  version: number;
  entries: IndexEntry[];
}

const INDEX_VERSION = 1;

export function indexFilePath(vaultPath: string): string {
  return path.join(vaultPath, '.kb', 'vectors.json');
}

export function loadIndex(vaultPath: string): VectorIndex | null {
  const p = indexFilePath(vaultPath);
  if (!fs.existsSync(p)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
    // Model mismatch → drop the index; kb index will rebuild.
    if (data.model !== EMBED_MODEL || data.version !== INDEX_VERSION) return null;
    return data;
  } catch {
    return null;
  }
}

export function saveIndex(vaultPath: string, entries: IndexEntry[]): void {
  const p = indexFilePath(vaultPath);
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const index: VectorIndex = { model: EMBED_MODEL, version: INDEX_VERSION, entries };
  fs.writeFileSync(p, JSON.stringify(index), 'utf-8');
}

export function hashContent(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex').substring(0, 16);
}

// Vectors from transformer.js with normalize:true are unit-length,
// so cosine = dot product.
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

import path from 'path';
import os from 'os';

// @xenova/transformers is ESM-only; CJS dist uses dynamic import.
// The model (~22MB) downloads to ~/.kb/model/ on first call, then caches.

export const EMBED_MODEL = 'all-MiniLM-L6-v2';
export const EMBED_DIM = 384;

type Embedder = (text: string, opts?: Record<string, unknown>) => Promise<{ data: Float32Array }>;

let embedderPromise: Promise<Embedder> | null = null;

export async function getEmbedder(): Promise<Embedder> {
  if (!embedderPromise) {
    embedderPromise = (async () => {
      const mod: any = await import('@xenova/transformers');
      mod.env.cacheDir = path.join(os.homedir(), '.kb', 'model');
      mod.env.allowLocalModels = false;
      // Suppress ONNX runtime warnings on stdout
      mod.env.logLevel = 'error';
      return (await mod.pipeline('feature-extraction', `Xenova/${EMBED_MODEL}`)) as Embedder;
    })();
  }
  return embedderPromise;
}

export async function embed(text: string): Promise<number[]> {
  const embedder = await getEmbedder();
  const out = await embedder(text, { pooling: 'mean', normalize: true });
  return Array.from(out.data);
}

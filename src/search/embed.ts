import path from 'path';
import os from 'os';

// @xenova/transformers is ESM-only; CJS dist uses dynamic import.
// The model (~22MB) downloads to ~/.kb/model/ on first call, then caches.

export const EMBED_MODEL = 'all-MiniLM-L6-v2';
export const EMBED_DIM = 384;

type Embedder = (text: string, opts?: Record<string, unknown>) => Promise<{ data: Float32Array }>;

let embedderPromise: Promise<Embedder> | null = null;

const NODE_MAJOR = parseInt(process.versions.node.split('.')[0], 10);

export async function getEmbedder(): Promise<Embedder> {
  if (NODE_MAJOR < 20) {
    throw new Error(
      `Semantic search requires Node.js 20+ (running ${process.version}). ` +
      `Upgrade Node and re-run \`kb index\` to enable it.`
    );
  }
  if (!embedderPromise) {
    embedderPromise = (async () => {
      // eslint-disable-next-line no-new-func
      const mod: any = await (Function('return import("@xenova/transformers")')() as Promise<any>);
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

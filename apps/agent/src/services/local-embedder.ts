import { pipeline, env } from "@huggingface/transformers";

if (process.env["HF_HOME"]) env.cacheDir = process.env["HF_HOME"]; // respect custom cache path

const MODEL_ID = "Xenova/all-MiniLM-L6-v2";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FeaturePipeline = (input: string | string[], opts?: Record<string, unknown>) => Promise<any>;

let modelInstance: FeaturePipeline | null = null;
let loadingPromise: Promise<FeaturePipeline> | null = null;

async function getModel(): Promise<FeaturePipeline> {
  if (modelInstance) return modelInstance;
  if (!loadingPromise) {
    loadingPromise = (pipeline("feature-extraction", MODEL_ID) as Promise<FeaturePipeline>)
      .then((p) => { modelInstance = p; console.log("[local-embedder] ready"); return p; })
      .catch((err: unknown) => { loadingPromise = null; throw err; });
  }
  return loadingPromise;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const model = await getModel();
  const output = await model(texts.map((t) => t.slice(0, 1000)), { pooling: "mean", normalize: true });
  return output.tolist() as number[][];
}

export async function warmupEmbedder(): Promise<void> {
  try {
    console.log("[local-embedder] loading...");
    await getModel();
  } catch (err) {
    console.warn("[local-embedder] warmup failed:", err instanceof Error ? err.message : err);
  }
}

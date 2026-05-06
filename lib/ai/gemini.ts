import { GoogleGenerativeAI } from "@google/generative-ai";

// Read env lazily so Next.js dev hot-reload picks up `.env.local` changes
// after the module has already been imported.
function readApiKey(): string | undefined {
  // Treat empty/sentinel values as absent so a stale system-level
  // GOOGLE_GENERATIVE_AI_API_KEY=placeholder cannot mask a real key in
  // .env.local (which we expose via GOOGLE_API_KEY).
  const sanitize = (v: string | undefined) => {
    if (!v) return undefined;
    const t = v.trim();
    if (!t) return undefined;
    if (/^placeholder$/i.test(t)) return undefined;
    return t;
  };
  return (
    sanitize(process.env.GOOGLE_GENERATIVE_AI_API_KEY) ??
    sanitize(process.env.GOOGLE_API_KEY)
  );
}

// Model name can be bare ("gemini-2.5-flash") or fully qualified
// ("models/gemini-2.5-flash"). We normalise by stripping the "models/" prefix.
function normaliseModel(m?: string | null, fallback = "gemini-2.5-flash") {
  const raw = (m ?? fallback).trim();
  return raw.replace(/^models\//, "");
}

export const CHAT_MODEL = normaliseModel(
  process.env.GEMINI_CHAT_MODEL ?? process.env.GOOGLE_MODEL,
  "gemini-2.5-flash",
);
export const EMBED_MODEL = normaliseModel(
  process.env.GEMINI_EMBED_MODEL,
  "gemini-embedding-001",
);
// Our pgvector column is vector(768); gemini-embedding-001 defaults to 3072
// but supports Matryoshka truncation via outputDimensionality.
export const EMBED_DIM = Number(process.env.GEMINI_EMBED_DIM ?? 768);

export function getGemini() {
  const apiKey = readApiKey();
  if (!apiKey)
    throw new Error("GOOGLE_GENERATIVE_AI_API_KEY / GOOGLE_API_KEY is required");
  return new GoogleGenerativeAI(apiKey);
}

export function isGeminiConfigured(): boolean {
  return Boolean(readApiKey());
}

/** Max safety settings — education product for minors. */
export const SAFETY_SETTINGS = [
  { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_LOW_AND_ABOVE" },
  { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_LOW_AND_ABOVE" },
  { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_LOW_AND_ABOVE" },
  { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_LOW_AND_ABOVE" },
] as const;

/**
 * Direct REST call to Gemini embedContent. We bypass the SDK because older
 * versions of @google/generative-ai point at model paths that 404 against
 * the current Gemini API; REST lets us pin the `v1beta` path + pass
 * `outputDimensionality` (Matryoshka truncation) so vectors match our
 * pgvector column dimension.
 */
async function embedOne(text: string): Promise<number[]> {
  const key = readApiKey();
  if (!key) throw new Error("GOOGLE_API_KEY missing");
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent?key=${key}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      content: { parts: [{ text }] },
      outputDimensionality: EMBED_DIM,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`embedContent ${res.status}: ${body.slice(0, 300)}`);
  }
  const json: any = await res.json();
  const values: number[] | undefined = json?.embedding?.values;
  if (!Array.isArray(values)) throw new Error("embedContent: no values");
  return values;
}

export async function embed(text: string): Promise<number[]> {
  return embedOne(text);
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  // No native batch endpoint on v1beta for gemini-embedding-001; fan out
  // with small concurrency so we stay under the 1,500 RPM free-tier ceiling.
  const CONCURRENCY = 4;
  const out: number[][] = new Array(texts.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= texts.length) return;
      out[i] = await embedOne(texts[i]);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return out;
}

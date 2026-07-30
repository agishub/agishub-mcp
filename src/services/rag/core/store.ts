/**
 * Semantic memory on Cloudflare Vectorize + Workers AI embeddings (BGE-M3, 1024d).
 * Multi-tenant by `namespace` (stored in metadata, filtered on query, and prefixed
 * onto the vector id to avoid cross-namespace id collisions). NOTE: the store is
 * shared and namespace is a soft key — not hard auth.
 *
 * Embeddings go through `runAi`, so RAG usage counts against the daily Workers AI
 * budget and is paused on the free MCP channel when the free allowance is spent.
 */
import type { OperationContext } from "../../types";
import { runAi } from "../../../ai-budget";

const EMBED = "@cf/baai/bge-m3";

async function embed(ctx: OperationContext<unknown>, text: string): Promise<number[]> {
  const r = (await runAi(ctx, EMBED, { text }, "embed")) as { data?: number[][] };
  const v = r?.data?.[0];
  if (!v || v.length === 0) throw new Error("Embedding failed.");
  return v;
}

function requireVectorize(env: Env | undefined): asserts env is Env {
  if (!env?.VECTORIZE || !env?.AI) {
    throw new Error("The memory service is temporarily unavailable.");
  }
}

// Vectorize ids are capped at 64 bytes, so we derive a short, deterministic id
// from namespace+id (same input → same vector → upsert overwrites). The original
// id is preserved in metadata.
async function vectorId(namespace: string, vid: string): Promise<string> {
  const data = new TextEncoder().encode(`${namespace} ${vid}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 48);
}

export async function upsert(ctx: OperationContext<unknown>, namespace: string, text: string, id?: string) {
  requireVectorize(ctx.env);
  const values = await embed(ctx, text);
  const vid = id || crypto.randomUUID();
  await ctx.env.VECTORIZE.upsert([
    { id: await vectorId(namespace, vid), values, metadata: { namespace, id: vid, text: text.slice(0, 9000) } },
  ]);
  return { id: vid, namespace, stored: true, dimensions: values.length };
}

export async function search(ctx: OperationContext<unknown>, namespace: string, query: string, topK = 5) {
  requireVectorize(ctx.env);
  const values = await embed(ctx, query);
  const res = await ctx.env.VECTORIZE.query(values, { topK, filter: { namespace }, returnMetadata: "all" });
  const matches = (res.matches || []).map((m) => {
    const meta = m.metadata as { id?: string; text?: string } | undefined;
    return { id: meta?.id ?? m.id, score: m.score, text: meta?.text ?? null };
  });
  return { namespace, query, count: matches.length, matches };
}

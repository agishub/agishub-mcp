/**
 * Workers AI handlers. Text tools use a small, cheap current model to stretch the
 * free daily Neuron allowance; every call goes through `runAi`, which enforces the
 * daily budget guard (free MCP is paused once the free allowance is spent) and
 * counts estimated neuron usage.
 */
import type { z } from "zod";
import type { OperationContext } from "../types";
import * as S from "./schemas";
import { runAi } from "../../ai-budget";

// Cheap, current instruct model for the high-volume text tools (was llama-3.3-70b).
const LLM = "@cf/meta/llama-3.1-8b-instruct-fp8";
const EMBED = "@cf/baai/bge-m3";
const WHISPER = "@cf/openai/whisper";
const VISION = "@cf/meta/llama-3.2-11b-vision-instruct";
const TTS = "@cf/myshell-ai/melotts";

const asText = (r: { response?: unknown }): string =>
  typeof r?.response === "string" ? r.response : String(r?.response ?? "");

async function fetchBytes(url: string, cap = 8_000_000): Promise<number[]> {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Could not fetch ${url} (HTTP ${res.status}).`);
  const buf = await res.arrayBuffer();
  if (buf.byteLength > cap) throw new Error(`File too large (${buf.byteLength} bytes, max ${cap}).`);
  return [...new Uint8Array(buf)];
}

export async function summarize(ctx: OperationContext<z.infer<typeof S.summarize>>) {
  const { text, max_words } = ctx.input;
  const target = max_words ?? 80;
  const system = `You are a concise summarizer. Summarize the user's text in about ${target} words or fewer. Return ONLY the summary — no preamble, no headings.`;
  const r = (await runAi(ctx, LLM, {
    messages: [{ role: "system", content: system }, { role: "user", content: text }],
    max_tokens: Math.min(target * 3, 1000),
  }, "text")) as { response?: unknown };
  return { summary: asText(r).trim() };
}

export async function classify(ctx: OperationContext<z.infer<typeof S.classify>>) {
  const { text, labels } = ctx.input;
  const system =
    "You are a precise text classifier. Choose exactly ONE label from the provided list that best fits the text. Reply with ONLY the label, nothing else.";
  const user = `Labels: ${labels.join(", ")}\n\nText:\n"""${text}"""\n\nBest label:`;
  const r = (await runAi(ctx, LLM, {
    messages: [{ role: "system", content: system }, { role: "user", content: user }],
    max_tokens: 20,
  }, "text")) as { response?: unknown };
  const out = asText(r).trim();
  const label = labels.find((l) => out.toLowerCase().includes(l.toLowerCase())) ?? out;
  return { label, labels };
}

export async function extract_entities(ctx: OperationContext<z.infer<typeof S.extractEntities>>) {
  const { text } = ctx.input;
  const system =
    'Extract named entities from the user text. Return ONLY compact JSON with these keys: {"people":[],"organizations":[],"locations":[],"dates":[],"misc":[]}. No prose, no code fences.';
  const r = (await runAi(ctx, LLM, {
    messages: [{ role: "system", content: system }, { role: "user", content: text }],
    max_tokens: 500,
  }, "text")) as { response?: unknown };
  if (r?.response && typeof r.response === "object") {
    return { entities: r.response };
  }
  const raw = asText(r).trim();
  try {
    const entities = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
    return { entities };
  } catch {
    return { raw, note: "Model did not return valid JSON." };
  }
}

export async function transcribe(ctx: OperationContext<z.infer<typeof S.transcribe>>) {
  const audio = await fetchBytes(ctx.input.audio_url);
  const r = (await runAi(ctx, WHISPER, { audio }, "audio")) as { text?: string; word_count?: number };
  return { text: (r?.text ?? "").trim(), word_count: r?.word_count };
}

export async function ocr(ctx: OperationContext<z.infer<typeof S.ocr>>) {
  const image = await fetchBytes(ctx.input.image_url, 6_000_000);
  const prompt = ctx.input.prompt || "Read and transcribe ALL text visible in this image. Preserve tables and layout where possible.";
  const r = (await runAi(ctx, VISION, { image, prompt, max_tokens: 1024 }, "image")) as { description?: string; response?: unknown };
  const text = (typeof r?.description === "string" ? r.description : asText(r as { response?: unknown })).trim();
  return { text };
}

export async function embed(ctx: OperationContext<z.infer<typeof S.embed>>) {
  const r = (await runAi(ctx, EMBED, { text: ctx.input.text }, "embed")) as { data?: number[][]; shape?: number[] };
  const vector = r?.data?.[0] ?? [];
  return { dimensions: vector.length, embedding: vector };
}

export async function chat(ctx: OperationContext<z.infer<typeof S.chat>>) {
  const { prompt, system, max_tokens } = ctx.input;
  const messages = system
    ? [{ role: "system", content: system }, { role: "user", content: prompt }]
    : [{ role: "user", content: prompt }];
  const r = (await runAi(ctx, LLM, { messages, max_tokens: max_tokens ?? 512 }, "text")) as { response?: unknown };
  return { response: asText(r).trim() };
}

export async function tts(ctx: OperationContext<z.infer<typeof S.tts>>) {
  const { text, lang } = ctx.input;
  const r = (await runAi(ctx, TTS, { prompt: text, lang: lang ?? "en" }, "audio")) as { audio?: string };
  const base64 = r?.audio ?? "";
  return { format: "mp3", base64, data_uri: `data:audio/mpeg;base64,${base64}` };
}

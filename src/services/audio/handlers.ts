/**
 * Audio handlers: transcribe and text-to-speech.
 */
import type { z } from "zod";
import type { OperationContext } from "../types";
import * as S from "./schemas";
import { runAi } from "../../ai-budget";
import { freemiumGate } from "../_shared/freemium";

const WHISPER = "@cf/openai/whisper";
const TTS = "@cf/myshell-ai/melotts";

async function fetchBytes(url: string, cap = 8_000_000): Promise<number[]> {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Could not fetch ${url} (HTTP ${res.status}).`);
  const buf = await res.arrayBuffer();
  if (buf.byteLength > cap) throw new Error(`File too large (${buf.byteLength} bytes, max ${cap}).`);
  return [...new Uint8Array(buf)];
}

export async function transcribe(ctx: OperationContext<z.infer<typeof S.transcribe>>) {
  const audio = await fetchBytes(ctx.input.audio_url);
  const r = (await runAi(ctx, WHISPER, { audio }, "audio")) as { text?: string; word_count?: number };
  const result = { text: (r?.text ?? "").trim(), word_count: r?.word_count };
  // Free tier: cap transcription to 5000 chars
  return freemiumGate(ctx, result, {
    capField: "text",
    freeCap: 5000,
    upsell: "Free MCP tier: transcriptions capped at 5,000 chars. For longer audio, use the paid HTTP endpoint (x402).",
  });
}

export async function speak(ctx: OperationContext<z.infer<typeof S.tts>>) {
  const { text, lang } = ctx.input;
  const r = (await runAi(ctx, TTS, { prompt: text, lang: lang ?? "en" }, "audio")) as { audio?: string };
  const base64 = r?.audio ?? "";
  return { format: "mp3", base64, data_uri: `data:audio/mpeg;base64,${base64}` };
}

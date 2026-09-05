import { z } from "zod";

export const summarize = z.object({
  text: z.string().min(1).describe("The text to summarize."),
  max_words: z.number().int().positive().max(400).optional().describe("Approximate maximum length of the summary, in words (default ~80)."),
});

export const classify = z.object({
  text: z.string().min(1).describe("The text to classify."),
  labels: z.array(z.string().min(1)).min(2).max(20).describe("Candidate labels to choose from, e.g. ['positive','negative','neutral']."),
});

export const extractEntities = z.object({
  text: z.string().min(1).describe("The text to extract named entities from."),
});

export const transcribe = z.object({
  audio_url: z.string().url().describe("Public URL of an audio file (mp3, wav, m4a, ogg, ...) to transcribe to text."),
});

export const ocr = z.object({
  image_url: z.string().url().describe("Public URL of an image to read text from (OCR)."),
  prompt: z.string().optional().describe("Optional instruction, e.g. 'extract the table as CSV'. Defaults to transcribing all visible text."),
});

export const embed = z.object({
  text: z.string().min(1).describe("Text to embed into a numeric vector for semantic search / RAG."),
});

export const chat = z.object({
  prompt: z.string().min(1).describe("The user's message or question for the assistant."),
  system: z.string().optional().describe("Optional system instruction to steer the assistant's behaviour/persona."),
  max_tokens: z.number().int().positive().max(2048).optional().describe("Maximum tokens to generate (default 512)."),
});

export const tts = z.object({
  text: z.string().min(1).describe("The text to convert to spoken audio."),
  lang: z.enum(["en", "es", "fr", "zh", "jp", "kr"]).optional().describe("Language of the text (default 'en')."),
});

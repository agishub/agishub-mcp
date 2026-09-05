import { z } from "zod";

export const transcribe = z.object({
  audio_url: z.string().url().describe("Public URL of an audio file (mp3, wav, m4a, ogg, ...) to transcribe to text."),
});

export const tts = z.object({
  text: z.string().min(1).describe("The text to convert to spoken audio."),
  lang: z.enum(["en", "es", "fr", "zh", "jp", "kr"]).optional().describe("Language of the text (default 'en')."),
});

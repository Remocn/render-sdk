import type { Codec } from "./types";

/**
 * Single source of truth mapping each {@link Codec} to its output file
 * extension. Exhaustive `Record` — adding a codec without an ext is a compile
 * error.
 */
export const CODEC_EXT: Record<Codec, string> = {
  h264: "mp4",
  h265: "mp4",
  vp8: "webm",
  vp9: "webm",
  gif: "gif",
  prores: "mov",
  mp3: "mp3",
  aac: "aac",
  wav: "wav",
};

/** Resolve the output extension for a codec; defaults to `"h264"` → `"mp4"`. */
export function extForCodec(codec?: Codec): string {
  return CODEC_EXT[codec ?? "h264"];
}

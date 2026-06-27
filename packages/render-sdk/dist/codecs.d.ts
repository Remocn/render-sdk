import type { Codec } from "./types";
/**
 * Single source of truth mapping each {@link Codec} to its output file
 * extension. Exhaustive `Record` — adding a codec without an ext is a compile
 * error.
 */
export declare const CODEC_EXT: Record<Codec, string>;
/** Resolve the output extension for a codec; defaults to `"h264"` → `"mp4"`. */
export declare function extForCodec(codec?: Codec): string;

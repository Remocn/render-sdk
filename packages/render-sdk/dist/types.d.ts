/**
 * Public core types for `@remocn/render-sdk`.
 *
 * This file is the dependency-free contract every adapter and the SDK depend on.
 * It intentionally declares its own `Codec` / `PixelFormat` unions instead of
 * importing them from remotion, so the root export stays remotion-free.
 */
export type RenderStatus = "queued" | "rendering" | "done" | "error";
/**
 * An opaque, branded render handle. The brand exists only at compile time; the
 * runtime value is a plain string produced by the `handle` encode helpers.
 */
export type RenderHandle = string & {
    readonly __brand: unique symbol;
};
export type Codec = "h264" | "h265" | "vp8" | "vp9" | "gif" | "prores" | "mp3" | "aac" | "wav";
export type PixelFormat = "yuv420p" | "yuva420p" | "yuv422p" | "yuv444p" | "yuv420p10le" | "yuv422p10le" | "yuv444p10le" | "yuva444p10le";
export type RenderState = {
    status: RenderStatus;
    progress: number;
    error?: string;
};
export type RenderInput = {
    compositionId: string;
    inputProps?: Record<string, unknown>;
    serveUrl?: string;
    /** Output codec. Defaults to `"h264"` when omitted. */
    codec?: Codec;
    frameRange?: [number, number];
    scale?: number;
    width?: number;
    height?: number;
    jpegQuality?: number;
    pixelFormat?: PixelFormat;
};
export type WaitOptions = {
    onProgress?: (progress: number) => void;
    /** Poll interval in milliseconds. Defaults to ~1000. */
    intervalMs?: number;
    signal?: AbortSignal;
    timeoutMs?: number;
};

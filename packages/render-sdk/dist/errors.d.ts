/**
 * The single error type surfaced by the SDK and every adapter.
 *
 * `code` is a stable, machine-readable discriminant; `message` is human-facing.
 * `cause` is propagated through the native `Error` options so the original
 * failure (e.g. a remotion error) is retained for debugging.
 */
export declare class RenderError extends Error {
    readonly code: "invalid_input" | "render_failed" | "timeout" | "not_found" | "version_mismatch" | "adapter_error";
    constructor(code: RenderError["code"], message: string, options?: {
        cause?: unknown;
    });
}
export declare function isBlank(field: string): boolean;
export declare function rejectEmptyHandle(handle: string): void;
export declare function rejectMalformedServerHandle(parts: string[], handle: string): void;
export declare function rejectMalformedLambdaHandle(parts: string[], handle: string): void;
export declare function rejectUnknownAdapterTag(handle: string): never;
export declare function classifyRenderError(message: string): RenderError["code"];

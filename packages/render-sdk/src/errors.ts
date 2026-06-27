/**
 * The single error type surfaced by the SDK and every adapter.
 *
 * `code` is a stable, machine-readable discriminant; `message` is human-facing.
 * `cause` is propagated through the native `Error` options so the original
 * failure (e.g. a remotion error) is retained for debugging.
 */
export class RenderError extends Error {
  readonly code:
    | "invalid_input"
    | "render_failed"
    | "timeout"
    | "not_found"
    | "version_mismatch"
    | "adapter_error";

  constructor(
    code: RenderError["code"],
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "RenderError";
    this.code = code;
  }
}

export function isBlank(field: string): boolean {
  return field.trim().length === 0;
}

export function rejectEmptyHandle(handle: string): void {
  if (typeof handle !== "string" || handle.length === 0) {
    throw new RenderError("not_found", `Malformed render handle: ${String(handle)}`);
  }
}

export function rejectMalformedServerHandle(parts: string[], handle: string): void {
  if (parts.length !== 2 || isBlank(parts[1]!)) {
    throw new RenderError("not_found", `Malformed server handle: ${handle}`);
  }
}

export function rejectMalformedLambdaHandle(parts: string[], handle: string): void {
  if (parts.length !== 4 || parts.slice(1).some(isBlank)) {
    throw new RenderError("not_found", `Malformed lambda handle: ${handle}`);
  }
}

export function rejectUnknownAdapterTag(handle: string): never {
  throw new RenderError("not_found", `Unknown handle adapter tag: ${handle}`);
}

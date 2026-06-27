import type { RenderAdapter } from "./adapter";
import type { RenderHandle, RenderState, WaitOptions } from "./types";
/**
 * Poll an adapter's `getState` until the render reaches a terminal status.
 *
 * - Calls `onProgress(progress)` on every tick.
 * - Resolves with the final state when `status === "done"`.
 * - Throws `RenderError("render_failed")` when `status === "error"`.
 * - Rejects `RenderError("timeout")` once `timeoutMs` elapses.
 * - Rejects `RenderError("adapter_error", "aborted")` when `signal` aborts.
 *
 * Adapter-agnostic and remotion-free: it only needs `getState`.
 */
export declare function waitForCompletion(adapter: Pick<RenderAdapter<unknown>, "getState">, handle: RenderHandle, opts?: WaitOptions): Promise<RenderState>;

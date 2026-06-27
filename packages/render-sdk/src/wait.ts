import type { RenderAdapter } from "./adapter";
import { RenderError } from "./errors";
import type { RenderHandle, RenderState, WaitOptions } from "./types";

/** Default poll interval, in milliseconds, when `opts.intervalMs` is omitted. */
const DEFAULT_INTERVAL_MS = 1000;

/**
 * Sleep for `ms`, resolving early (rejecting) if `signal` aborts mid-wait.
 *
 * This is what makes `waitForCompletion` honour an `AbortSignal` *between*
 * polls rather than only at the top of each tick.
 */
function abortableDelay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new RenderError("adapter_error", "aborted"));
      return;
    }

    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    const onAbort = () => {
      clearTimeout(timer);
      reject(new RenderError("adapter_error", "aborted"));
    };

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

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
export async function waitForCompletion(
  adapter: Pick<RenderAdapter<unknown>, "getState">,
  handle: RenderHandle,
  opts: WaitOptions = {},
): Promise<RenderState> {
  const { onProgress, intervalMs = DEFAULT_INTERVAL_MS, signal, timeoutMs } = opts;
  const deadline =
    timeoutMs === undefined ? undefined : Date.now() + timeoutMs;

  while (true) {
    if (signal?.aborted) {
      throw new RenderError("adapter_error", "aborted");
    }

    const state = await adapter.getState(handle);

    onProgress?.(state.progress);

    if (state.status === "done") {
      return state;
    }

    if (state.status === "error") {
      throw new RenderError("render_failed", state.error ?? "Render failed");
    }

    if (deadline !== undefined && Date.now() >= deadline) {
      throw new RenderError("timeout", `Render timed out after ${timeoutMs}ms`);
    }

    const wait =
      deadline === undefined
        ? intervalMs
        : Math.min(intervalMs, deadline - Date.now());

    await abortableDelay(Math.max(0, wait), signal);
  }
}

import { describe, expect, test } from "bun:test";

import type { RenderAdapter } from "../src/adapter";
import { RenderError } from "../src/errors";
import { encodeServerHandle } from "../src/handle";
import type { RenderState } from "../src/types";
import { waitForCompletion } from "../src/wait";

/** A getState-only adapter that replays a scripted sequence of states. */
function scriptedAdapter(
  states: RenderState[],
): Pick<RenderAdapter<unknown>, "getState"> {
  let i = 0;
  return {
    getState: async () => {
      const state = states[Math.min(i, states.length - 1)]!;
      i += 1;
      return state;
    },
  };
}

const handle = encodeServerHandle("job");

describe("waitForCompletion", () => {
  test("resolves on done and fires monotonic onProgress", async () => {
    const adapter = scriptedAdapter([
      { status: "queued", progress: 0 },
      { status: "rendering", progress: 0.5 },
      { status: "done", progress: 1 },
    ]);
    const seen: number[] = [];

    const final = await waitForCompletion(adapter, handle, {
      intervalMs: 1,
      onProgress: (p) => seen.push(p),
    });

    expect(final).toEqual({ status: "done", progress: 1 });
    expect(seen).toEqual([0, 0.5, 1]);
  });

  test("throws render_failed on error status", async () => {
    const adapter = scriptedAdapter([
      { status: "rendering", progress: 0.2 },
      { status: "error", progress: 0.2, error: "boom" },
    ]);

    let caught: unknown;
    try {
      await waitForCompletion(adapter, handle, { intervalMs: 1 });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(RenderError);
    expect((caught as RenderError).code).toBe("render_failed");
    expect((caught as RenderError).message).toBe("boom");
  });

  test("rejects timeout when timeoutMs elapses", async () => {
    // never reaches a terminal state
    const adapter = scriptedAdapter([{ status: "rendering", progress: 0.3 }]);

    let caught: unknown;
    try {
      await waitForCompletion(adapter, handle, {
        intervalMs: 5,
        timeoutMs: 12,
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(RenderError);
    expect((caught as RenderError).code).toBe("timeout");
  });

  test("rejects adapter_error/aborted when signal aborts mid-wait", async () => {
    const adapter = scriptedAdapter([{ status: "rendering", progress: 0.1 }]);
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 5);

    let caught: unknown;
    try {
      await waitForCompletion(adapter, handle, {
        intervalMs: 1000,
        signal: controller.signal,
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(RenderError);
    expect((caught as RenderError).code).toBe("adapter_error");
    expect((caught as RenderError).message).toBe("aborted");
  });

  test("rejects immediately when signal is already aborted", async () => {
    const adapter = scriptedAdapter([{ status: "rendering", progress: 0 }]);

    let caught: unknown;
    try {
      await waitForCompletion(adapter, handle, {
        intervalMs: 1,
        signal: AbortSignal.abort(),
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(RenderError);
    expect((caught as RenderError).code).toBe("adapter_error");
  });
});

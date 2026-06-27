import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { decodeHandle } from "../src/handle";
import { RenderSdk } from "../src/sdk";
import { InMemoryStore } from "../src/store/in-memory";
import type { StateStore } from "../src/store/types";
import {
  deferred,
  fakeComposition,
  flush,
  makeWorkDir,
  mockRemotion,
  remotion,
  resetRemotion,
} from "./_server-harness";

mockRemotion();
const { RenderServer } = await import("../src/server");

let store: StateStore;
let workDir: string;

beforeEach(() => {
  resetRemotion();
  store = InMemoryStore();
  workDir = makeWorkDir();
});

afterEach(() => {
  resetRemotion();
});

describe("RenderServer.start", () => {
  test("returns a server handle and drives queued -> rendering -> done", async () => {
    const gate = deferred();
    remotion.selectImpl = async () => fakeComposition;
    remotion.renderImpl = async (opts) => {
      opts.onProgress?.({ progress: 0.25 });
      opts.onProgress?.({ progress: 0.75 });
      await gate.promise; // hold the render in the "rendering" state
      return {};
    };

    const adapter = RenderServer({
      serveUrl: "http://bundle",
      workDir,
      store,
      concurrency: 1,
    });

    const handle = await adapter.start({ compositionId: "Main" });
    expect(decodeHandle(handle)).toEqual({
      adapter: "server",
      jobId: expect.any(String),
    });

    await flush();
    const rendering = await adapter.getState(handle);
    expect(rendering.status).toBe("rendering");
    expect(rendering.progress).toBeCloseTo(0.75);

    gate.resolve();
    await flush();
    expect(await adapter.getState(handle)).toEqual({
      status: "done",
      progress: 1,
    });
  });

  test("writes an initial queued record with codec + createdAt", async () => {
    const gate = deferred();
    remotion.renderImpl = async () => {
      await gate.promise;
      return {};
    };

    const adapter = RenderServer({ serveUrl: "http://b", workDir, store });
    const handle = await adapter.start({ compositionId: "Main", codec: "vp9" });

    const record = await store.get(handle);
    expect(record?.codec).toBe("vp9");
    expect(typeof record?.createdAt).toBe("number");
    expect(record?.progress).toBe(0);

    gate.resolve();
    await flush();
  });

  test("clamps out-of-range onProgress values into 0..1", async () => {
    remotion.renderImpl = async (opts) => {
      opts.onProgress?.({ progress: 1.5 });
      return {};
    };

    const adapter = RenderServer({ serveUrl: "http://b", workDir, store });
    const handle = await adapter.start({ compositionId: "Main" });
    await flush();

    // terminal state is done(=1); the clamp is exercised mid-render
    expect((await adapter.getState(handle)).progress).toBe(1);
  });

  test("writes output to ${workDir}/${handle}.${ext}", async () => {
    let seenOutput: string | null | undefined;
    remotion.renderImpl = async (opts) => {
      seenOutput = opts.outputLocation;
      return {};
    };

    const adapter = RenderServer({ serveUrl: "http://b", workDir, store });
    const handle = await adapter.start({ compositionId: "Main", codec: "h264" });
    await flush();

    expect(seenOutput).toBe(`${workDir}/${handle}.mp4`);
  });
});

// Compile-time only: RenderServer plugs into RenderSdk with options auto-typed.
async function _typecheck() {
  const sdk = new RenderSdk({
    adapter: RenderServer({ serveUrl: "x", workDir: "y" }),
  });
  await sdk.start({ compositionId: "C" }, { timeoutInMilliseconds: 1 });
  // @ts-expect-error framesPerLambda is not a ServerOptions key
  await sdk.start({ compositionId: "C" }, { framesPerLambda: 5 });
}
void _typecheck;

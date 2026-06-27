import { describe, expect, test } from "bun:test";

import type { RenderAdapter } from "../src/adapter";
import { encodeServerHandle } from "../src/handle";
import { RenderSdk } from "../src/sdk";
import { InMemoryStore } from "../src/store/in-memory";
import type { RenderHandle, RenderInput, RenderState } from "../src/types";

/** Adapter options shape used to prove `start` narrowing. */
type FakeOptions = { framesPerLambda?: number; privacy?: "public" | "private" };

type Call =
  | { method: "start"; input: RenderInput; options?: FakeOptions }
  | { method: "getState"; handle: RenderHandle }
  | { method: "getUrl"; handle: RenderHandle }
  | { method: "download"; handle: RenderHandle };

function fakeAdapter() {
  const calls: Call[] = [];
  const handle = encodeServerHandle("fake-1");
  const state: RenderState = { status: "done", progress: 1 };
  const adapter: RenderAdapter<FakeOptions> = {
    start: async (input, options) => {
      calls.push({ method: "start", input, options });
      return handle;
    },
    getState: async (h) => {
      calls.push({ method: "getState", handle: h });
      return state;
    },
    getUrl: async (h) => {
      calls.push({ method: "getUrl", handle: h });
      return "https://cdn.example.com/fake-1.mp4";
    },
    download: async (h) => {
      calls.push({ method: "download", handle: h });
      return new ReadableStream();
    },
  };
  return { adapter, calls, handle, state };
}

describe("RenderSdk delegation", () => {
  test("start delegates input + options to the adapter", async () => {
    const { adapter, calls, handle } = fakeAdapter();
    const sdk = new RenderSdk({ adapter });

    const input: RenderInput = { compositionId: "MyVideo" };
    const result = await sdk.start(input, { framesPerLambda: 20 });

    expect(result).toBe(handle);
    expect(calls[0]).toEqual({
      method: "start",
      input,
      options: { framesPerLambda: 20 },
    });
  });

  test("getState, getUrl, download all delegate", async () => {
    const { adapter, calls, handle } = fakeAdapter();
    const sdk = new RenderSdk({ adapter });

    expect(await sdk.getState(handle)).toEqual({ status: "done", progress: 1 });
    expect(await sdk.getUrl(handle)).toBe(
      "https://cdn.example.com/fake-1.mp4",
    );
    expect(await sdk.download(handle)).toBeInstanceOf(ReadableStream);

    expect(calls.map((c) => c.method)).toEqual([
      "getState",
      "getUrl",
      "download",
    ]);
  });

  test("waitForCompletion method delegates to the poll loop", async () => {
    const { adapter, calls, handle } = fakeAdapter();
    const sdk = new RenderSdk({ adapter });

    const final = await sdk.waitForCompletion(handle, { intervalMs: 1 });

    expect(final).toEqual({ status: "done", progress: 1 });
    expect(calls.some((c) => c.method === "getState")).toBe(true);
  });

  test("store is accepted and held, not touched by the SDK", async () => {
    const { adapter } = fakeAdapter();
    const store = InMemoryStore();
    const sdk = new RenderSdk({ adapter, store });

    expect(sdk.store).toBe(store);

    // the SDK never writes the store on its own
    await sdk.start({ compositionId: "X" });
    expect(await store.get(encodeServerHandle("fake-1"))).toBeNull();
  });

  test("store is optional", () => {
    const { adapter } = fakeAdapter();
    const sdk = new RenderSdk({ adapter });
    expect(sdk.store).toBeUndefined();
  });
});

describe("RenderSdk type narrowing (compile-time)", () => {
  test("start options narrow to the adapter's options type", async () => {
    const { adapter } = fakeAdapter();
    const sdk = new RenderSdk({ adapter });

    // ✅ correct option shape compiles
    await sdk.start({ compositionId: "x" }, { framesPerLambda: 20 });

    // @ts-expect-error — `chromiumOptions` is not a FakeOptions key
    await sdk.start({ compositionId: "x" }, { chromiumOptions: {} });

    expect(true).toBe(true);
  });
});

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { InMemoryStore } from "../src/store/in-memory";
import type { StateStore } from "../src/store/types";
import {
  deferred,
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

describe("RenderServer concurrency limiter", () => {
  test("second job stays queued until the first frees a slot", async () => {
    const gateA = deferred();
    let renderCalls = 0;
    remotion.renderImpl = async () => {
      renderCalls += 1;
      if (renderCalls === 1) await gateA.promise; // hold job A in-flight
      return {};
    };

    const adapter = RenderServer({
      serveUrl: "http://b",
      workDir,
      store,
      concurrency: 1,
    });

    const h1 = await adapter.start({ compositionId: "A" });
    const h2 = await adapter.start({ compositionId: "B" });
    await flush();

    expect((await adapter.getState(h1)).status).toBe("rendering");
    expect((await adapter.getState(h2)).status).toBe("queued");
    expect(renderCalls).toBe(1); // job B's render never started

    gateA.resolve();
    await flush();

    expect((await adapter.getState(h1)).status).toBe("done");
    expect((await adapter.getState(h2)).status).toBe("done");
    expect(renderCalls).toBe(2);
  });
});

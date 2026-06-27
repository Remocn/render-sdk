import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { encodeServerHandle } from "../src/handle";
import { InMemoryStore } from "../src/store/in-memory";
import type { StateStore } from "../src/store/types";
import {
  expectRenderErrorCode,
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

describe("RenderServer error classification", () => {
  test("a render rejection lands as error state with render_failed", async () => {
    remotion.renderImpl = async () => {
      throw new Error("boom");
    };

    const adapter = RenderServer({ serveUrl: "http://b", workDir, store });
    const handle = await adapter.start({ compositionId: "Main" });
    await flush();

    const state = await adapter.getState(handle);
    expect(state.status).toBe("error");
    expect(state.error).toBe("boom");

    const record = await store.get(handle);
    expect(record?.errorCode).toBe("render_failed");
  });

  test("a version-mismatch-shaped error is classified version_mismatch", async () => {
    remotion.renderImpl = async () => {
      throw new Error(
        "The version of @remotion/renderer (4.0.1) does not match the version of remotion (4.0.2)",
      );
    };

    const adapter = RenderServer({ serveUrl: "http://b", workDir, store });
    const handle = await adapter.start({ compositionId: "Main" });
    await flush();

    const record = await store.get(handle);
    expect(record?.errorCode).toBe("version_mismatch");
    expect((await adapter.getState(handle)).status).toBe("error");
  });

  test("a failure in selectComposition is also captured (no unhandled rejection)", async () => {
    remotion.selectImpl = async () => {
      throw new Error("cannot select composition");
    };

    const adapter = RenderServer({ serveUrl: "http://b", workDir, store });
    const handle = await adapter.start({ compositionId: "Main" });
    await flush();

    expect((await adapter.getState(handle)).status).toBe("error");
    const record = await store.get(handle);
    expect(record?.error).toBe("cannot select composition");
  });

  test("getState on an unknown handle throws not_found", async () => {
    const adapter = RenderServer({ serveUrl: "http://b", workDir, store });
    await expectRenderErrorCode(
      adapter.getState(encodeServerHandle("missing")),
      "not_found",
    );
  });
});

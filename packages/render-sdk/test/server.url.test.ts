import { beforeEach, describe, expect, test } from "bun:test";

import { encodeServerHandle } from "../src/handle";
import { InMemoryStore } from "../src/store/in-memory";
import type { StateStore } from "../src/store/types";
import {
  expectRenderErrorCode,
  makeWorkDir,
  mockRemotion,
  seedDone,
} from "./_server-harness";

mockRemotion();
const { RenderServer } = await import("../src/server");

let store: StateStore;
let workDir: string;

beforeEach(() => {
  store = InMemoryStore();
  workDir = makeWorkDir();
});

describe("RenderServer.getUrl", () => {
  test("prefixes publicUrl and resolves ext from codec", async () => {
    const adapter = RenderServer({
      serveUrl: "http://b",
      workDir,
      publicUrl: "https://cdn.example.com",
      store,
    });
    await seedDone(store, "job-1", "h264");
    expect(await adapter.getUrl(encodeServerHandle("job-1"))).toBe(
      "https://cdn.example.com/s~job-1.mp4",
    );
  });

  test("trims a trailing slash on publicUrl", async () => {
    const adapter = RenderServer({
      serveUrl: "http://b",
      workDir,
      publicUrl: "https://cdn.example.com/",
      store,
    });
    await seedDone(store, "job-2", "vp9");
    expect(await adapter.getUrl(encodeServerHandle("job-2"))).toBe(
      "https://cdn.example.com/s~job-2.webm",
    );
  });

  test("returns a bare filename without publicUrl", async () => {
    const adapter = RenderServer({ serveUrl: "http://b", workDir, store });
    await seedDone(store, "job-3", "prores");
    expect(await adapter.getUrl(encodeServerHandle("job-3"))).toBe(
      "s~job-3.mov",
    );
  });

  test("unknown handle throws not_found", async () => {
    const adapter = RenderServer({ serveUrl: "http://b", workDir, store });
    await expectRenderErrorCode(
      adapter.getUrl(encodeServerHandle("nope")),
      "not_found",
    );
  });
});

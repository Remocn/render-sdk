import { beforeEach, describe, expect, test } from "bun:test";
import { join } from "node:path";

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

describe("RenderServer.download", () => {
  test("streams the file contents as a web ReadableStream", async () => {
    const adapter = RenderServer({ serveUrl: "http://b", workDir, store });
    await seedDone(store, "dl-1", "h264");
    const handle = encodeServerHandle("dl-1");
    await Bun.write(join(workDir, `${handle}.mp4`), "hello-bytes");

    const stream = await adapter.download(handle);
    expect(stream).toBeInstanceOf(ReadableStream);
    expect(await new Response(stream).text()).toBe("hello-bytes");
  });

  test("missing output file throws not_found", async () => {
    const adapter = RenderServer({ serveUrl: "http://b", workDir, store });
    await seedDone(store, "dl-2", "h264"); // record exists, no file on disk
    await expectRenderErrorCode(
      adapter.download(encodeServerHandle("dl-2")),
      "not_found",
    );
  });

  test("unknown handle throws not_found", async () => {
    const adapter = RenderServer({ serveUrl: "http://b", workDir, store });
    await expectRenderErrorCode(
      adapter.download(encodeServerHandle("ghost")),
      "not_found",
    );
  });
});

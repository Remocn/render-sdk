/**
 * In-process server adapter for `@remocn/render-sdk`.
 *
 * `RenderServer(config)` renders with `@remotion/renderer` behind a `p-limit`
 * concurrency limiter, persists progress to a {@link StateStore}, writes output
 * to `${workDir}/${handle}.${ext}`, and serves `getUrl` / `download` from disk.
 *
 * `@remotion/renderer` is an optional peer dependency: importing this subpath
 * requires it to be installed. The root export (`@remocn/render-sdk`) stays
 * remotion-free; only adapters pull it in.
 */

import { createReadStream } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { Readable } from "node:stream";
import type { ChromiumOptions } from "@remotion/renderer";
import { renderMedia, selectComposition } from "@remotion/renderer";
import pLimit from "p-limit";

import type { RenderAdapter } from "../adapter";
import { extForCodec } from "../codecs";
import { classifyRenderError, RenderError } from "../errors";
import { encodeServerHandle } from "../handle";
import { InMemoryStore } from "../store/in-memory";
import type { StateStore } from "../store/types";
import type { Codec, RenderHandle, RenderInput, RenderState } from "../types";

/** Configuration for {@link RenderServer}. */
export type ServerConfig = {
  /** Bundle location passed to remotion (a served URL or a local bundle path). */
  serveUrl: string;
  /** Directory output files are written to (created on demand). */
  workDir: string;
  /** Public HTTP base for {@link RenderAdapter.getUrl}; omit for a bare filename. */
  publicUrl?: string;
  /** Max concurrent renders for this adapter instance. Defaults to 2. */
  concurrency?: number;
  /**
   * Progress source-of-truth. Defaults to a fresh {@link InMemoryStore}. Pass
   * the same store instance you give `new RenderSdk({ store })` to share state.
   */
  store?: StateStore;
};

/** Per-job start options (2nd argument of `start`). */
export type ServerOptions = {
  /** Per-render browser-tab concurrency forwarded to `renderMedia`. */
  concurrency?: number;
  /** Chromium launch options forwarded to `selectComposition` / `renderMedia`. */
  chromiumOptions?: ChromiumOptions;
  /** Per-operation timeout forwarded to remotion. */
  timeoutInMilliseconds?: number;
};

const DEFAULT_CONCURRENCY = 2;

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

/**
 * Classify a thrown render failure. Remotion surfaces a version mismatch
 * between `remotion` and `@remotion/*` packages as an error whose message
 * mentions a version that does not match — map those to `version_mismatch`,
 * everything else to `render_failed`.
 */

export function RenderServer(
  config: ServerConfig,
): RenderAdapter<ServerOptions> {
  const store = config.store ?? InMemoryStore();
  const limit = pLimit(config.concurrency ?? DEFAULT_CONCURRENCY);

  async function runRender(
    handle: RenderHandle,
    input: RenderInput,
    codec: Codec,
    options?: ServerOptions,
  ): Promise<void> {
    try {
      await store.update(handle, { status: "rendering", progress: 0 });

      const serveUrl = input.serveUrl ?? config.serveUrl;

      const composition = await selectComposition({
        serveUrl,
        id: input.compositionId,
        inputProps: input.inputProps,
        chromiumOptions: options?.chromiumOptions,
        timeoutInMilliseconds: options?.timeoutInMilliseconds,
      });

      await mkdir(config.workDir, { recursive: true });
      const outputLocation = join(
        config.workDir,
        `${handle}.${extForCodec(codec)}`,
      );

      await renderMedia({
        composition,
        serveUrl,
        codec,
        outputLocation,
        inputProps: input.inputProps,
        scale: input.scale,
        frameRange: input.frameRange,
        pixelFormat: input.pixelFormat,
        jpegQuality: input.jpegQuality,
        concurrency: options?.concurrency,
        chromiumOptions: options?.chromiumOptions,
        timeoutInMilliseconds: options?.timeoutInMilliseconds,
        onProgress: (p) => {
          void store.update(handle, {
            status: "rendering",
            progress: clamp01(p.progress),
          });
        },
      });

      await store.update(handle, { status: "done", progress: 1 });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await store.update(handle, {
        status: "error",
        error: message,
        errorCode: classifyRenderError(message),
      });
    }
  }

  async function start(
    input: RenderInput,
    options?: ServerOptions,
  ): Promise<RenderHandle> {
    const codec: Codec = input.codec ?? "h264";
    const handle = encodeServerHandle(crypto.randomUUID());

    await store.create(handle, {
      status: "queued",
      progress: 0,
      codec,
      createdAt: Date.now(),
    });

    // Detached: the render runs on the limiter without blocking `start`. All
    // failures are caught inside `runRender` and written to the store, so the
    // unawaited promise never rejects (no unhandledRejection).
    void limit(() => runRender(handle, input, codec, options));

    return handle;
  }

  async function getState(handle: RenderHandle): Promise<RenderState> {
    const record = await store.get(handle);
    if (!record) {
      throw new RenderError("not_found", `No render for handle: ${handle}`);
    }
    return {
      status: record.status,
      progress: record.progress,
      ...(record.error !== undefined ? { error: record.error } : {}),
    };
  }

  async function getUrl(handle: RenderHandle): Promise<string> {
    const record = await store.get(handle);
    if (!record) {
      throw new RenderError("not_found", `No render for handle: ${handle}`);
    }
    const file = `${handle}.${extForCodec(record.codec)}`;
    if (!config.publicUrl) return file;
    return `${config.publicUrl.replace(/\/+$/, "")}/${file}`;
  }

  async function download(handle: RenderHandle): Promise<ReadableStream> {
    const record = await store.get(handle);
    if (!record) {
      throw new RenderError("not_found", `No render for handle: ${handle}`);
    }
    const path = join(config.workDir, `${handle}.${extForCodec(record.codec)}`);
    try {
      await stat(path);
    } catch (err) {
      throw new RenderError("not_found", `Output file missing: ${path}`, {
        cause: err,
      });
    }
    // `Readable.toWeb` yields a `node:stream/web` ReadableStream; it is the
    // global `ReadableStream` at runtime, but TS models the two nominally.
    return Readable.toWeb(createReadStream(path)) as unknown as ReadableStream;
  }

  return { start, getState, getUrl, download };
}

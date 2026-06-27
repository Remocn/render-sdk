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
import type { ChromiumOptions } from "@remotion/renderer";
import type { RenderAdapter } from "../adapter";
import type { StateStore } from "../store/types";
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
export declare function RenderServer(config: ServerConfig): RenderAdapter<ServerOptions>;

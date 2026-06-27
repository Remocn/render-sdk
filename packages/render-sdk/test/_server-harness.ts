/**
 * Shared test harness for the server adapter suite.
 *
 * The server adapter statically imports `@remotion/renderer`; these helpers
 * provide a controllable mock plus small async utilities. Each test file calls
 * {@link mockRemotion} once (before importing the adapter), then swaps
 * `selectImpl` / `renderImpl` per test.
 */

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { mock } from "bun:test";

import { RenderError } from "../src/errors";
import { encodeServerHandle } from "../src/handle";
import type { RenderRecord, StateStore } from "../src/store/types";
import type { Codec } from "../src/types";

/** A minimal stand-in for remotion's `VideoConfig` (the adapter only forwards it). */
export const fakeComposition = {
  id: "Main",
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: 90,
} as unknown;

type RenderMediaOpts = {
  composition: unknown;
  codec: string;
  serveUrl: string;
  outputLocation?: string | null;
  onProgress?: (p: { progress: number }) => void;
};

/** Per-test mock implementations, reassigned in each `test`. */
export const remotion = {
  selectImpl: async (_opts: unknown): Promise<unknown> => fakeComposition,
  renderImpl: async (_opts: RenderMediaOpts): Promise<unknown> => ({}),
};

/** Register the `@remotion/renderer` mock. Call before importing the adapter. */
export function mockRemotion(): void {
  mock.module("@remotion/renderer", () => ({
    selectComposition: (opts: unknown) => remotion.selectImpl(opts),
    renderMedia: (opts: RenderMediaOpts) => remotion.renderImpl(opts),
  }));
}

/** Reset the mock impls to inert defaults. */
export function resetRemotion(): void {
  remotion.selectImpl = async () => fakeComposition;
  remotion.renderImpl = async () => ({});
}

export interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}

export function deferred<T = void>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Flush pending macro/microtasks so detached render work can advance. */
export async function flush(ticks = 4): Promise<void> {
  while (ticks-- > 0) {
    await new Promise<void>((r) => setTimeout(r, 0));
  }
}

export function makeWorkDir(): string {
  return mkdtempSync(join(tmpdir(), "remocn-server-"));
}

/** Insert a completed-render record so getUrl/download can be tested in isolation. */
export function seedDone(
  store: StateStore,
  jobId: string,
  codec: Codec,
): Promise<void> {
  const record: RenderRecord = {
    status: "done",
    progress: 1,
    codec,
    createdAt: 0,
  };
  return store.create(encodeServerHandle(jobId), record);
}

/** Assert a rejected promise throws a {@link RenderError} with the given code. */
export async function expectRenderErrorCode(
  promise: Promise<unknown>,
  code: RenderError["code"],
): Promise<void> {
  let thrown: unknown;
  try {
    await promise;
  } catch (err) {
    thrown = err;
  }
  if (!(thrown instanceof RenderError)) {
    throw new Error(`Expected RenderError, got ${String(thrown)}`);
  }
  if (thrown.code !== code) {
    throw new Error(`Expected code "${code}", got "${thrown.code}"`);
  }
}

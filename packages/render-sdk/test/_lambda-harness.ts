/**
 * Shared test harness for the lambda adapter suite.
 *
 * The lambda adapter statically imports `@remotion/lambda/client`; these helpers
 * provide a controllable mock plus small utilities. Each test file calls
 * {@link mockLambda} once (before importing the adapter), then swaps
 * `lambda.renderImpl` / `lambda.progressImpl` per test.
 *
 * CRITICAL: `mockLambda()` must be called BEFORE dynamically importing the
 * adapter so that Bun's module registry resolves the mock instead of the real
 * package.
 */

import { mock } from "bun:test";

import { RenderError } from "../src/errors";

// ── Progress factory ─────────────────────────────────────────────────────────

export type ProgressOverride = Partial<{
  done: boolean;
  overallProgress: number;
  fatalErrorEncountered: boolean;
  errors: { message: string }[];
  outputFile: string | null;
}>;

/**
 * Build a progress object with the only five fields the adapter reads
 * (`done`, `overallProgress`, `fatalErrorEncountered`, `errors`, `outputFile`).
 * `getRenderProgress` is mocked, so the adapter never sees the other ~30
 * `RenderProgress` fields — modelling them here would be dead weight.
 */
export function makeProgress(
  partial?: ProgressOverride,
): Record<string, unknown> {
  return {
    done: false,
    overallProgress: 0,
    fatalErrorEncountered: false,
    errors: [],
    outputFile: null,
    ...partial,
  };
}

// ── Mock state ───────────────────────────────────────────────────────────────

/** Per-test mock implementations, reassigned in each `test`. */
export const lambda = {
  renderImpl: async (
    _o: unknown,
  ): Promise<{ renderId: string; bucketName: string }> => ({
    renderId: "rid-1",
    bucketName: "remotionlambda-useast1-abc",
  }),
  progressImpl: async (_o: unknown): Promise<Record<string, unknown>> =>
    makeProgress(),
};

/** Register the `@remotion/lambda/client` mock. Call before importing the adapter. */
export function mockLambda(): void {
  mock.module("@remotion/lambda/client", () => ({
    renderMediaOnLambda: (o: unknown) => lambda.renderImpl(o),
    getRenderProgress: (o: unknown) => lambda.progressImpl(o),
  }));
}

/** Reset the mock impls to inert defaults. */
export function resetLambda(): void {
  lambda.renderImpl = async () => ({
    renderId: "rid-1",
    bucketName: "remotionlambda-useast1-abc",
  });
  lambda.progressImpl = async () => makeProgress();
}

// ── Shared assertion ─────────────────────────────────────────────────────────

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

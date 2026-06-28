import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { encodeLambdaHandle } from "../src/handle";
import {
  lambda,
  makeProgress,
  mockLambda,
  resetLambda,
} from "./_lambda-harness";

mockLambda();
const { RenderLambda } = await import("../src/lambda");

const CONFIG = {
  region: "us-east-1" as const,
  functionName: "remotion-render-fn",
  serveUrl: "https://example.com/bundle",
};

const HANDLE = encodeLambdaHandle({
  renderId: "rid-1",
  bucket: "remotionlambda-useast1-abc",
  ext: "mp4",
});

beforeEach(() => {
  resetLambda();
});

afterEach(() => {
  resetLambda();
});

describe("RenderLambda.getState", () => {
  test("done=true => {status:done, progress:1}", async () => {
    lambda.progressImpl = async () => makeProgress({ done: true });

    const adapter = RenderLambda(CONFIG);
    const state = await adapter.getState(HANDLE);

    expect(state).toEqual({ status: "done", progress: 1 });
  });

  test("fatalErrorEncountered => {status:error, progress:overallProgress, error:errors[0].message}", async () => {
    lambda.progressImpl = async () =>
      makeProgress({
        fatalErrorEncountered: true,
        overallProgress: 0.4,
        errors: [{ message: "Out of memory" }],
      });

    const adapter = RenderLambda(CONFIG);
    const state = await adapter.getState(HANDLE);

    expect(state).toEqual({
      status: "error",
      progress: 0.4,
      error: "Out of memory",
    });
  });

  test("fatalErrorEncountered with empty errors => no error key in state", async () => {
    lambda.progressImpl = async () =>
      makeProgress({
        fatalErrorEncountered: true,
        overallProgress: 0.2,
        errors: [],
      });

    const adapter = RenderLambda(CONFIG);
    const state = await adapter.getState(HANDLE);

    expect(state.status).toBe("error");
    expect(state.progress).toBe(0.2);
    expect("error" in state).toBe(false);
  });

  test("overallProgress > 0 => {status:rendering, progress:overallProgress}", async () => {
    lambda.progressImpl = async () => makeProgress({ overallProgress: 0.6 });

    const adapter = RenderLambda(CONFIG);
    const state = await adapter.getState(HANDLE);

    expect(state).toEqual({ status: "rendering", progress: 0.6 });
  });

  test("overallProgress === 0 and not done/error => {status:queued, progress:0}", async () => {
    lambda.progressImpl = async () => makeProgress();

    const adapter = RenderLambda(CONFIG);
    const state = await adapter.getState(HANDLE);

    expect(state).toEqual({ status: "queued", progress: 0 });
  });

  test("non-lambda handle throws RenderError not_found", async () => {
    const { encodeServerHandle } = await import("../src/handle");
    const serverHandle = encodeServerHandle("some-job-id");

    const adapter = RenderLambda(CONFIG);
    let thrown: unknown;
    try {
      await adapter.getState(serverHandle);
    } catch (err) {
      thrown = err;
    }

    const { RenderError } = await import("../src/errors");
    expect(thrown).toBeInstanceOf(RenderError);
    expect((thrown as InstanceType<typeof RenderError>).code).toBe("not_found");
  });
});

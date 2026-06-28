import { afterEach, beforeEach, describe, test } from "bun:test";

import {
  expectRenderErrorCode,
  lambda,
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

beforeEach(() => {
  resetLambda();
});

afterEach(() => {
  resetLambda();
});

describe("RenderLambda.start — error classification", () => {
  test("version mismatch message => RenderError code version_mismatch", async () => {
    lambda.renderImpl = async () => {
      throw new Error(
        "The Lambda function version does not match the client version",
      );
    };

    const adapter = RenderLambda(CONFIG);
    await expectRenderErrorCode(
      adapter.start({ compositionId: "Main" }),
      "version_mismatch",
    );
  });

  test("generic error message => RenderError code render_failed", async () => {
    lambda.renderImpl = async () => {
      throw new Error("Task timed out after 120.00 seconds");
    };

    const adapter = RenderLambda(CONFIG);
    await expectRenderErrorCode(
      adapter.start({ compositionId: "Main" }),
      "render_failed",
    );
  });

  test("non-Error thrown value is also wrapped", async () => {
    lambda.renderImpl = async () => {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw "plain string error";
    };

    const adapter = RenderLambda(CONFIG);
    await expectRenderErrorCode(
      adapter.start({ compositionId: "Main" }),
      "render_failed",
    );
  });
});

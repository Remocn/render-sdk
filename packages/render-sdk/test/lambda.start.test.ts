import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { decodeHandle } from "../src/handle";
import {
  expectRenderErrorCode,
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
  serveUrl: "https://remotionlambda-useast1-abc.s3.us-east-1.amazonaws.com/sites/my-site/index.html",
};

beforeEach(() => {
  resetLambda();
});

afterEach(() => {
  resetLambda();
});

describe("RenderLambda.start", () => {
  test("calls renderMediaOnLambda once with correct fields", async () => {
    let capturedInput: unknown;
    lambda.renderImpl = async (o) => {
      capturedInput = o;
      return { renderId: "rid-1", bucketName: "remotionlambda-useast1-abc" };
    };
    lambda.progressImpl = async () => makeProgress({ done: true, outputFile: "https://cdn/out.mp4" });

    const adapter = RenderLambda(CONFIG);
    await adapter.start({ compositionId: "Main" });

    expect(capturedInput).toMatchObject({
      composition: "Main",
      codec: "h264",
      region: CONFIG.region,
      functionName: CONFIG.functionName,
      serveUrl: CONFIG.serveUrl,
    });
  });

  test("returned handle decodes to {adapter:lambda, renderId, bucket, ext:mp4} for default h264", async () => {
    const adapter = RenderLambda(CONFIG);
    const handle = await adapter.start({ compositionId: "Main" });

    expect(decodeHandle(handle)).toEqual({
      adapter: "lambda",
      renderId: "rid-1",
      bucket: "remotionlambda-useast1-abc",
      ext: "mp4",
    });
  });

  test("explicit codec gif => ext gif in handle", async () => {
    const adapter = RenderLambda(CONFIG);
    const handle = await adapter.start({ compositionId: "Main", codec: "gif" });

    expect(decodeHandle(handle)).toMatchObject({ ext: "gif" });
  });

  test("forwards inputProps, scale, frameRange, jpegQuality, pixelFormat to renderMediaOnLambda", async () => {
    let capturedInput: unknown;
    lambda.renderImpl = async (o) => {
      capturedInput = o;
      return { renderId: "rid-2", bucketName: "remotionlambda-useast1-abc" };
    };

    const adapter = RenderLambda(CONFIG);
    await adapter.start({
      compositionId: "Intro",
      inputProps: { title: "Hello" },
      scale: 2,
      frameRange: [0, 30],
      jpegQuality: 80,
      pixelFormat: "yuv420p",
    });

    expect(capturedInput).toMatchObject({
      inputProps: { title: "Hello" },
      scale: 2,
      frameRange: [0, 30],
      jpegQuality: 80,
      pixelFormat: "yuv420p",
    });
  });

  test("forwards LambdaOptions to renderMediaOnLambda", async () => {
    let capturedInput: unknown;
    lambda.renderImpl = async (o) => {
      capturedInput = o;
      return { renderId: "rid-3", bucketName: "remotionlambda-useast1-abc" };
    };

    const adapter = RenderLambda(CONFIG);
    await adapter.start({ compositionId: "Main" }, {
      framesPerLambda: 40,
      webhook: { url: "https://hook.example.com", secret: null },
      privacy: "public",
      outName: "my-output.mp4",
      maxRetries: 2,
    });

    expect(capturedInput).toMatchObject({
      framesPerLambda: 40,
      webhook: { url: "https://hook.example.com", secret: null },
      privacy: "public",
      outName: "my-output.mp4",
      maxRetries: 2,
    });
  });

  test("per-render serveUrl overrides config.serveUrl", async () => {
    let capturedInput: unknown;
    lambda.renderImpl = async (o) => {
      capturedInput = o;
      return { renderId: "rid-4", bucketName: "remotionlambda-useast1-abc" };
    };

    const adapter = RenderLambda(CONFIG);
    await adapter.start({ compositionId: "Main", serveUrl: "https://custom-serve.com" });

    expect((capturedInput as { serveUrl: string }).serveUrl).toBe("https://custom-serve.com");
  });

  test("wraps renderMediaOnLambda rejection as RenderError render_failed", async () => {
    lambda.renderImpl = async () => { throw new Error("Something went wrong"); };

    const adapter = RenderLambda(CONFIG);
    await expectRenderErrorCode(
      adapter.start({ compositionId: "Main" }),
      "render_failed",
    );
  });
});

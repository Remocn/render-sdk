import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { encodeLambdaHandle } from "../src/handle";
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
  serveUrl: "https://example.com/bundle",
};

const HANDLE = encodeLambdaHandle({
  renderId: "rid-1",
  bucket: "remotionlambda-useast1-abc",
  ext: "mp4",
});

const OUTPUT_URL = "https://remotionlambda-useast1-abc.s3.amazonaws.com/renders/rid-1/out.mp4";

/** Saved reference so we can restore after each test. */
const originalFetch = globalThis.fetch;

beforeEach(() => {
  resetLambda();
});

afterEach(() => {
  resetLambda();
  globalThis.fetch = originalFetch;
});

describe("RenderLambda.getUrl", () => {
  test("returns outputFile when render is done", async () => {
    lambda.progressImpl = async () =>
      makeProgress({ done: true, outputFile: OUTPUT_URL });

    const adapter = RenderLambda(CONFIG);
    const url = await adapter.getUrl(HANDLE);

    expect(url).toBe(OUTPUT_URL);
  });

  test("throws not_found when outputFile is null", async () => {
    lambda.progressImpl = async () =>
      makeProgress({ overallProgress: 0.5, outputFile: null });

    const adapter = RenderLambda(CONFIG);
    await expectRenderErrorCode(adapter.getUrl(HANDLE), "not_found");
  });

  test("throws not_found for a non-lambda handle", async () => {
    const { encodeServerHandle } = await import("../src/handle");
    const serverHandle = encodeServerHandle("some-job");

    const adapter = RenderLambda(CONFIG);
    await expectRenderErrorCode(adapter.getUrl(serverHandle), "not_found");
  });
});

describe("RenderLambda.download", () => {
  test("returns response body ReadableStream when fetch succeeds", async () => {
    lambda.progressImpl = async () =>
      makeProgress({ done: true, outputFile: OUTPUT_URL });

    const fakeBody = new ReadableStream();
    globalThis.fetch = (async (url: string | URL | Request) => {
      expect(String(url)).toBe(OUTPUT_URL);
      return { ok: true, status: 200, body: fakeBody } as unknown as Response;
    }) as typeof globalThis.fetch;

    const adapter = RenderLambda(CONFIG);
    const stream = await adapter.download(HANDLE);

    expect(stream).toBe(fakeBody);
  });

  test("throws adapter_error when fetch returns non-ok status", async () => {
    lambda.progressImpl = async () =>
      makeProgress({ done: true, outputFile: OUTPUT_URL });

    globalThis.fetch = (async () =>
      ({ ok: false, status: 500, body: null }) as unknown as Response) as unknown as typeof globalThis.fetch;

    const adapter = RenderLambda(CONFIG);
    await expectRenderErrorCode(adapter.download(HANDLE), "adapter_error");
  });

  test("throws adapter_error when fetch returns ok but body is null", async () => {
    lambda.progressImpl = async () =>
      makeProgress({ done: true, outputFile: OUTPUT_URL });

    globalThis.fetch = (async () =>
      ({ ok: true, status: 200, body: null }) as unknown as Response) as unknown as typeof globalThis.fetch;

    const adapter = RenderLambda(CONFIG);
    await expectRenderErrorCode(adapter.download(HANDLE), "adapter_error");
  });

  test("throws not_found when outputFile is null (via getUrl)", async () => {
    lambda.progressImpl = async () => makeProgress({ outputFile: null });

    const adapter = RenderLambda(CONFIG);
    await expectRenderErrorCode(adapter.download(HANDLE), "not_found");
  });
});

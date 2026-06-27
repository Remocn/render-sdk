/**
 * Distributed Lambda adapter for `@remocn/render-sdk`.
 *
 * `RenderLambda(config)` fires renders on AWS Lambda via `@remotion/lambda`
 * immediately — no concurrency limiter, no local state store. AWS scales
 * horizontally; each frame chunk runs in its own Lambda invocation.
 *
 * Stateless by design: the returned handle carries `renderId + bucket + ext`
 * so that `getState`, `getUrl`, and `download` can reconstruct all required
 * context without any out-of-band storage.
 *
 * `region` and `functionName` come from the adapter config, not the handle —
 * the same function can serve multiple renders.
 *
 * `@remotion/lambda` is an optional peer dependency: importing this subpath
 * (`@remocn/render-sdk/lambda`) requires it to be installed. The root export
 * (`@remocn/render-sdk`) stays remotion-free; only adapters pull it in.
 */

import { getRenderProgress, renderMediaOnLambda } from "@remotion/lambda/client";
import type { AwsRegion } from "@remotion/lambda/client";

import type { RenderAdapter } from "../adapter";
import { extForCodec } from "../codecs";
import { classifyRenderError, RenderError } from "../errors";
import { decodeHandle, encodeLambdaHandle } from "../handle";
import type { RenderHandle, RenderInput, RenderState } from "../types";

/** Configuration for {@link RenderLambda}. */
export type LambdaConfig = {
  /** AWS region where the Remotion Lambda function is deployed. */
  region: AwsRegion;
  /** Name of the deployed Remotion Lambda function. */
  functionName: string;
  /** Default bundle serve URL; overridable per-render via `RenderInput.serveUrl`. */
  serveUrl: string;
};

/** Per-job start options (2nd argument of `start`). */
export type LambdaOptions = {
  /** Number of frames per Lambda invocation. Remotion chooses a default if omitted. */
  framesPerLambda?: number;
  /** Webhook to call on render completion or failure. */
  webhook?: { url: string; secret: string | null };
  /** S3 output privacy. Defaults to remotion's own default. */
  privacy?: "public" | "private";
  /** Custom output S3 key name. */
  outName?: string;
  /** Max number of Lambda retries per chunk. */
  maxRetries?: number;
};

export function RenderLambda(config: LambdaConfig): RenderAdapter<LambdaOptions> {
  /**
   * Decode a handle and assert it belongs to the lambda adapter, then fetch
   * the current render progress from AWS. Used by `getState`, `getUrl`, and
   * `download` to avoid repeating the same two steps.
   */
  async function fetchProgress(handle: RenderHandle) {
    const decoded = decodeHandle(handle);
    if (decoded.adapter !== "lambda") {
      throw new RenderError(
        "not_found",
        `Handle does not belong to the lambda adapter: ${handle}`,
      );
    }

    const progress = await getRenderProgress({
      renderId: decoded.renderId,
      bucketName: decoded.bucket,
      functionName: config.functionName,
      region: config.region,
    });

    return { decoded, progress };
  }

  function mapProgress(p: Awaited<ReturnType<typeof getRenderProgress>>): RenderState {
    if (p.done) {
      return { status: "done", progress: 1 };
    }
    if (p.fatalErrorEncountered) {
      return {
        status: "error",
        progress: p.overallProgress,
        ...(p.errors[0]?.message !== undefined
          ? { error: p.errors[0].message }
          : {}),
      };
    }
    if (p.overallProgress > 0) {
      return { status: "rendering", progress: p.overallProgress };
    }
    return { status: "queued", progress: 0 };
  }

  async function start(
    input: RenderInput,
    options?: LambdaOptions,
  ): Promise<RenderHandle> {
    const codec = input.codec ?? "h264";

    try {
      const { renderId, bucketName } = await renderMediaOnLambda({
        region: config.region,
        functionName: config.functionName,
        serveUrl: input.serveUrl ?? config.serveUrl,
        composition: input.compositionId,
        codec,
        inputProps: input.inputProps,
        pixelFormat: input.pixelFormat,
        frameRange: input.frameRange,
        scale: input.scale,
        jpegQuality: input.jpegQuality,
        framesPerLambda: options?.framesPerLambda,
        webhook: options?.webhook,
        privacy: options?.privacy,
        outName: options?.outName,
        maxRetries: options?.maxRetries,
      });

      return encodeLambdaHandle({
        renderId,
        bucket: bucketName,
        ext: extForCodec(codec),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new RenderError(
        classifyRenderError(message),
        `Lambda render failed: ${message}`,
        { cause: err },
      );
    }
  }

  async function getState(handle: RenderHandle): Promise<RenderState> {
    const { progress } = await fetchProgress(handle);
    return mapProgress(progress);
  }

  async function getUrl(handle: RenderHandle): Promise<string> {
    const { progress } = await fetchProgress(handle);
    if (!progress.outputFile) {
      throw new RenderError(
        "not_found",
        `Render output not ready: ${handle}`,
      );
    }
    return progress.outputFile;
  }

  async function download(handle: RenderHandle): Promise<ReadableStream> {
    const url = await getUrl(handle);
    const res = await fetch(url);
    if (!res.ok || !res.body) {
      throw new RenderError(
        "adapter_error",
        `Failed to fetch output (${res.status}): ${url}`,
      );
    }
    return res.body;
  }

  return { start, getState, getUrl, download };
}

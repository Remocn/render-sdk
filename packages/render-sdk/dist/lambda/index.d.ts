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
import type { AwsRegion } from "@remotion/lambda/client";
import type { RenderAdapter } from "../adapter";
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
    webhook?: {
        url: string;
        secret: string | null;
    };
    /** S3 output privacy. Defaults to remotion's own default. */
    privacy?: "public" | "private";
    /** Custom output S3 key name. */
    outName?: string;
    /** Max number of Lambda retries per chunk. */
    maxRetries?: number;
};
export declare function RenderLambda(config: LambdaConfig): RenderAdapter<LambdaOptions>;

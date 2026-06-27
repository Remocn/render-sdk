import type { RenderHandle } from "./types";
/**
 * Render handles are encoded as `~`-delimited strings with the adapter tag
 * first, so a handle is self-describing without out-of-band context:
 *
 *   server:  `s~<jobId>`
 *   lambda:  `l~<renderId>~<bucket>~<ext>`
 *
 * Region / function name are configuration, not part of the handle.
 */
export type DecodedHandle = {
    adapter: "server";
    jobId: string;
} | {
    adapter: "lambda";
    renderId: string;
    bucket: string;
    ext: string;
};
export declare function encodeServerHandle(jobId: string): RenderHandle;
export declare function encodeLambdaHandle(p: {
    renderId: string;
    bucket: string;
    ext: string;
}): RenderHandle;
export declare function decodeHandle(handle: string): DecodedHandle;

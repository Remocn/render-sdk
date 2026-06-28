import {
  rejectEmptyHandle,
  rejectMalformedLambdaHandle,
  rejectMalformedServerHandle,
  rejectUnknownAdapterTag,
} from "./errors";
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

export type DecodedHandle =
  | { adapter: "server"; jobId: string }
  | { adapter: "lambda"; renderId: string; bucket: string; ext: string };

const DELIMITER = "~";

export function encodeServerHandle(jobId: string): RenderHandle {
  return `s${DELIMITER}${jobId}` as RenderHandle;
}

export function encodeLambdaHandle(p: {
  renderId: string;
  bucket: string;
  ext: string;
}): RenderHandle {
  return ["l", p.renderId, p.bucket, p.ext].join(DELIMITER) as RenderHandle;
}

export function decodeHandle(handle: string): DecodedHandle {
  rejectEmptyHandle(handle);

  const parts = handle.split(DELIMITER);
  const tag = parts[0];

  if (tag === "s") {
    rejectMalformedServerHandle(parts, handle);
    return { adapter: "server", jobId: parts[1]! };
  }

  if (tag === "l") {
    rejectMalformedLambdaHandle(parts, handle);
    return {
      adapter: "lambda",
      renderId: parts[1]!,
      bucket: parts[2]!,
      ext: parts[3]!,
    };
  }

  return rejectUnknownAdapterTag(handle);
}

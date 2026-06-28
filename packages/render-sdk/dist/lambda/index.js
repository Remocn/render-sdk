// src/lambda/index.ts
import {
  getRenderProgress,
  renderMediaOnLambda
} from "@remotion/lambda/client";

// src/codecs.ts
var CODEC_EXT = {
  h264: "mp4",
  h265: "mp4",
  vp8: "webm",
  vp9: "webm",
  gif: "gif",
  prores: "mov",
  mp3: "mp3",
  aac: "aac",
  wav: "wav"
};
function extForCodec(codec) {
  return CODEC_EXT[codec ?? "h264"];
}

// src/errors.ts
class RenderError extends Error {
  code;
  constructor(code, message, options) {
    super(message, options);
    this.name = "RenderError";
    this.code = code;
  }
}
function isBlank(field) {
  return field.trim().length === 0;
}
function rejectEmptyHandle(handle) {
  if (typeof handle !== "string" || handle.length === 0) {
    throw new RenderError("not_found", `Malformed render handle: ${String(handle)}`);
  }
}
function rejectMalformedServerHandle(parts, handle) {
  if (parts.length !== 2 || isBlank(parts[1])) {
    throw new RenderError("not_found", `Malformed server handle: ${handle}`);
  }
}
function rejectMalformedLambdaHandle(parts, handle) {
  if (parts.length !== 4 || parts.slice(1).some(isBlank)) {
    throw new RenderError("not_found", `Malformed lambda handle: ${handle}`);
  }
}
function rejectUnknownAdapterTag(handle) {
  throw new RenderError("not_found", `Unknown handle adapter tag: ${handle}`);
}
function classifyRenderError(message) {
  return /version/i.test(message) && /match/i.test(message) ? "version_mismatch" : "render_failed";
}

// src/handle.ts
var DELIMITER = "~";
function encodeServerHandle(jobId) {
  return `s${DELIMITER}${jobId}`;
}
function encodeLambdaHandle(p) {
  return ["l", p.renderId, p.bucket, p.ext].join(DELIMITER);
}
function decodeHandle(handle) {
  rejectEmptyHandle(handle);
  const parts = handle.split(DELIMITER);
  const tag = parts[0];
  if (tag === "s") {
    rejectMalformedServerHandle(parts, handle);
    return { adapter: "server", jobId: parts[1] };
  }
  if (tag === "l") {
    rejectMalformedLambdaHandle(parts, handle);
    return {
      adapter: "lambda",
      renderId: parts[1],
      bucket: parts[2],
      ext: parts[3]
    };
  }
  return rejectUnknownAdapterTag(handle);
}

// src/lambda/index.ts
function RenderLambda(config) {
  async function fetchProgress(handle) {
    const decoded = decodeHandle(handle);
    if (decoded.adapter !== "lambda") {
      throw new RenderError("not_found", `Handle does not belong to the lambda adapter: ${handle}`);
    }
    const progress = await getRenderProgress({
      renderId: decoded.renderId,
      bucketName: decoded.bucket,
      functionName: config.functionName,
      region: config.region
    });
    return { decoded, progress };
  }
  function mapProgress(p) {
    if (p.done) {
      return { status: "done", progress: 1 };
    }
    if (p.fatalErrorEncountered) {
      return {
        status: "error",
        progress: p.overallProgress,
        ...p.errors[0]?.message !== undefined ? { error: p.errors[0].message } : {}
      };
    }
    if (p.overallProgress > 0) {
      return { status: "rendering", progress: p.overallProgress };
    }
    return { status: "queued", progress: 0 };
  }
  async function start(input, options) {
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
        maxRetries: options?.maxRetries
      });
      return encodeLambdaHandle({
        renderId,
        bucket: bucketName,
        ext: extForCodec(codec)
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new RenderError(classifyRenderError(message), `Lambda render failed: ${message}`, { cause: err });
    }
  }
  async function getState(handle) {
    const { progress } = await fetchProgress(handle);
    return mapProgress(progress);
  }
  async function getUrl(handle) {
    const { progress } = await fetchProgress(handle);
    if (!progress.outputFile) {
      throw new RenderError("not_found", `Render output not ready: ${handle}`);
    }
    return progress.outputFile;
  }
  async function download(handle) {
    const url = await getUrl(handle);
    const res = await fetch(url);
    if (!res.ok || !res.body) {
      throw new RenderError("adapter_error", `Failed to fetch output (${res.status}): ${url}`);
    }
    return res.body;
  }
  return { start, getState, getUrl, download };
}
export {
  RenderLambda
};

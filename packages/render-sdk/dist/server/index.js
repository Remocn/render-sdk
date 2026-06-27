// src/server/index.ts
import { createReadStream } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { Readable } from "node:stream";
import { renderMedia, selectComposition } from "@remotion/renderer";
import pLimit from "p-limit";

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

// src/store/in-memory.ts
function InMemoryStore() {
  const records = new Map;
  return {
    async create(handle, initial) {
      records.set(handle, initial);
    },
    async get(handle) {
      return records.get(handle) ?? null;
    },
    async update(handle, patch) {
      const existing = records.get(handle);
      if (existing === undefined) {
        throw new RenderError("not_found", `No render record for handle: ${handle}`);
      }
      records.set(handle, { ...existing, ...patch });
    },
    async delete(handle) {
      records.delete(handle);
    }
  };
}

// src/server/index.ts
var DEFAULT_CONCURRENCY = 2;
function clamp01(n) {
  if (Number.isNaN(n))
    return 0;
  return Math.min(1, Math.max(0, n));
}
function RenderServer(config) {
  const store = config.store ?? InMemoryStore();
  const limit = pLimit(config.concurrency ?? DEFAULT_CONCURRENCY);
  async function runRender(handle, input, codec, options) {
    try {
      await store.update(handle, { status: "rendering", progress: 0 });
      const serveUrl = input.serveUrl ?? config.serveUrl;
      const composition = await selectComposition({
        serveUrl,
        id: input.compositionId,
        inputProps: input.inputProps,
        chromiumOptions: options?.chromiumOptions,
        timeoutInMilliseconds: options?.timeoutInMilliseconds
      });
      await mkdir(config.workDir, { recursive: true });
      const outputLocation = join(config.workDir, `${handle}.${extForCodec(codec)}`);
      await renderMedia({
        composition,
        serveUrl,
        codec,
        outputLocation,
        inputProps: input.inputProps,
        scale: input.scale,
        frameRange: input.frameRange,
        pixelFormat: input.pixelFormat,
        jpegQuality: input.jpegQuality,
        concurrency: options?.concurrency,
        chromiumOptions: options?.chromiumOptions,
        timeoutInMilliseconds: options?.timeoutInMilliseconds,
        onProgress: (p) => {
          store.update(handle, {
            status: "rendering",
            progress: clamp01(p.progress)
          });
        }
      });
      await store.update(handle, { status: "done", progress: 1 });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await store.update(handle, {
        status: "error",
        error: message,
        errorCode: classifyRenderError(message)
      });
    }
  }
  async function start(input, options) {
    const codec = input.codec ?? "h264";
    const handle = encodeServerHandle(crypto.randomUUID());
    await store.create(handle, {
      status: "queued",
      progress: 0,
      codec,
      createdAt: Date.now()
    });
    limit(() => runRender(handle, input, codec, options));
    return handle;
  }
  async function getState(handle) {
    const record = await store.get(handle);
    if (!record) {
      throw new RenderError("not_found", `No render for handle: ${handle}`);
    }
    return {
      status: record.status,
      progress: record.progress,
      ...record.error !== undefined ? { error: record.error } : {}
    };
  }
  async function getUrl(handle) {
    const record = await store.get(handle);
    if (!record) {
      throw new RenderError("not_found", `No render for handle: ${handle}`);
    }
    const file = `${handle}.${extForCodec(record.codec)}`;
    if (!config.publicUrl)
      return file;
    return `${config.publicUrl.replace(/\/+$/, "")}/${file}`;
  }
  async function download(handle) {
    const record = await store.get(handle);
    if (!record) {
      throw new RenderError("not_found", `No render for handle: ${handle}`);
    }
    const path = join(config.workDir, `${handle}.${extForCodec(record.codec)}`);
    try {
      await stat(path);
    } catch (err) {
      throw new RenderError("not_found", `Output file missing: ${path}`, {
        cause: err
      });
    }
    return Readable.toWeb(createReadStream(path));
  }
  return { start, getState, getUrl, download };
}
export {
  RenderServer
};

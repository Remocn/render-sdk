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

// src/index.ts
var VERSION = "0.0.0";
export {
  extForCodec,
  encodeServerHandle,
  encodeLambdaHandle,
  decodeHandle,
  VERSION,
  RenderError,
  InMemoryStore,
  CODEC_EXT
};

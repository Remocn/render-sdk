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
// src/wait.ts
var DEFAULT_INTERVAL_MS = 1000;
function abortableDelay(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new RenderError("adapter_error", "aborted"));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new RenderError("adapter_error", "aborted"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
async function waitForCompletion(adapter, handle, opts = {}) {
  const { onProgress, intervalMs = DEFAULT_INTERVAL_MS, signal, timeoutMs } = opts;
  const deadline = timeoutMs === undefined ? undefined : Date.now() + timeoutMs;
  for (;; ) {
    if (signal?.aborted) {
      throw new RenderError("adapter_error", "aborted");
    }
    const state = await adapter.getState(handle);
    onProgress?.(state.progress);
    if (state.status === "done") {
      return state;
    }
    if (state.status === "error") {
      throw new RenderError("render_failed", state.error ?? "Render failed");
    }
    if (deadline !== undefined && Date.now() >= deadline) {
      throw new RenderError("timeout", `Render timed out after ${timeoutMs}ms`);
    }
    const wait = deadline === undefined ? intervalMs : Math.min(intervalMs, deadline - Date.now());
    await abortableDelay(Math.max(0, wait), signal);
  }
}

// src/sdk.ts
class RenderSdk {
  adapter;
  store;
  constructor(config) {
    this.adapter = config.adapter;
    this.store = config.store;
  }
  start(input, options) {
    return this.adapter.start(input, options);
  }
  getState(handle) {
    return this.adapter.getState(handle);
  }
  getUrl(handle) {
    return this.adapter.getUrl(handle);
  }
  download(handle) {
    return this.adapter.download(handle);
  }
  waitForCompletion(handle, opts) {
    return waitForCompletion(this.adapter, handle, opts);
  }
}

// src/index.ts
var VERSION = "0.0.0";
export {
  waitForCompletion,
  extForCodec,
  encodeServerHandle,
  encodeLambdaHandle,
  decodeHandle,
  VERSION,
  RenderSdk,
  RenderError,
  InMemoryStore,
  CODEC_EXT
};

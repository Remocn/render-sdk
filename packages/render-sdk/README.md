<p align="left">
  <img alt="header" src="https://remocn.dev/render-sdk.png" />
</p>

![badge group](https://shieldcn.dev/group/npm/@remocn/render-sdk/+npm/license/@remocn/render-sdk/.svg?variant=secondary)

Render SDK

Backend-swappable render engine for [Remotion](https://remotion.dev). One API, two execution targets: a local Node.js server and AWS Lambda. Swap adapters without changing application code.

## Installation

```bash
bun add @remocn/render-sdk
# server adapter (requires @remotion/renderer)
bun add @remotion/renderer
# lambda adapter (requires @remotion/lambda)
bun add @remotion/lambda
```

## Quickstart — Server Adapter

```ts
import { bundle } from "@remotion/bundler";
import { RenderSdk } from "@remocn/render-sdk";
import { RenderServer } from "@remocn/render-sdk/server";

// 1. Bundle your Remotion composition once at startup
const serveUrl = await bundle({ entryPoint: "./src/remotion/index.ts" });

// 2. Create the SDK with a server adapter
const sdk = new RenderSdk({
  adapter: RenderServer({
    serveUrl,
    workDir: "./out",
    publicUrl: "https://cdn.example.com/renders",
    concurrency: 2, // default
  }),
});

// 3. Start a render
const handle = await sdk.start({
  compositionId: "Main",
  inputProps: { title: "Hi" },
});

// 4. Wait for it to finish
const state = await sdk.waitForCompletion(handle, {
  onProgress: (p) => console.log(`${Math.round(p * 100)}%`),
});

// 5. Get the public URL (only valid when status === "done")
const url = await sdk.getUrl(handle);
console.log(url); // https://cdn.example.com/renders/<handle>.mp4
```

## Quickstart — Lambda Adapter

```ts
import { RenderSdk } from "@remocn/render-sdk";
import { RenderLambda } from "@remocn/render-sdk/lambda";

const sdk = new RenderSdk({
  adapter: RenderLambda({
    region: "us-east-1",
    functionName: "remotion-render",
    serveUrl: "https://remotionlambda-xxxx.s3.us-east-1.amazonaws.com/sites/my-site/index.html",
  }),
});

const handle = await sdk.start({ compositionId: "Main", inputProps: { title: "Hi" } });
const state = await sdk.waitForCompletion(handle, {
  onProgress: (p) => console.log(`${Math.round(p * 100)}%`),
});
const url = await sdk.getUrl(handle); // S3 URL — available only when status === "done"
```

## API

### `new RenderSdk(config)`

| field | type | description |
|---|---|---|
| `adapter` | `RenderAdapter<A>` | The execution backend (server or lambda). |
| `store?` | `StateStore` | Optional state store override (server adapter only). |

### Methods

| method | returns | description |
|---|---|---|
| `start(input, options?)` | `Promise<RenderHandle>` | Enqueue a render. |
| `getState(handle)` | `Promise<RenderState>` | Current status and progress (0–1). |
| `getUrl(handle)` | `Promise<string>` | Output URL — only valid when `status === "done"`. |
| `download(handle)` | `Promise<ReadableStream>` | Stream the output bytes. |
| `waitForCompletion(handle, opts?)` | `Promise<RenderState>` | Poll until `done` or `error`. |

### `RenderInput`

```ts
type RenderInput = {
  compositionId: string;
  inputProps?: Record<string, unknown>;
  serveUrl?: string;        // per-render override of the adapter's serveUrl
  codec?: Codec;            // default "h264"
  frameRange?: [number, number];
  scale?: number;
  width?: number;
  height?: number;
  jpegQuality?: number;
  pixelFormat?: PixelFormat;
};
```

### `WaitOptions`

```ts
type WaitOptions = {
  onProgress?: (progress: number) => void; // progress is 0..1
  intervalMs?: number;                     // default ~1000 ms
  signal?: AbortSignal;
  timeoutMs?: number;
};
```

### `RenderState`

```ts
type RenderState = { status: RenderStatus; progress: number; error?: string };
type RenderStatus = "queued" | "rendering" | "done" | "error";
```

### `RenderError`

```ts
import { RenderError } from "@remocn/render-sdk";

// error.code is one of:
// "invalid_input" | "render_failed" | "timeout" | "not_found" | "version_mismatch" | "adapter_error"
```

### `InMemoryStore()`

Factory (not a class) that returns a `StateStore` backed by a plain `Map`. Useful in tests and for single-process server deployments.

```ts
import { InMemoryStore } from "@remocn/render-sdk";
const store = InMemoryStore(); // no "new"
```

### Handle helpers

```ts
import { encodeServerHandle, encodeLambdaHandle, decodeHandle } from "@remocn/render-sdk";

const handle = encodeServerHandle("job-123");
const lambdaHandle = encodeLambdaHandle({ renderId: "abc", bucket: "my-bucket", ext: "mp4" });
const decoded = decodeHandle(handle); // DecodedHandle
```

### Codec utilities

```ts
import { CODEC_EXT, extForCodec } from "@remocn/render-sdk";

extForCodec("h264"); // "mp4"
extForCodec();       // "mp4" (default codec)
```

## Adapters

### `RenderServer(config)` — `@remocn/render-sdk/server`

Requires `@remotion/renderer` as an optional peer dependency.

```ts
type ServerConfig = {
  serveUrl: string;
  workDir: string;
  publicUrl?: string;   // base URL for getUrl(); SDK does NOT serve files
  concurrency?: number; // default 2 (p-limit)
  store?: StateStore;   // default InMemoryStore()
};
```

- Renders are queued through a `p-limit` limiter (default concurrency 2).
- Output is written to `${workDir}/${handle}.${ext}`.
- `getUrl()` returns `${publicUrl}/${handle}.${ext}` when `publicUrl` is set, or a bare filename otherwise. **The SDK does not serve files — you must expose `workDir` over HTTP.**
- `download()` streams the file from disk.

### `RenderLambda(config)` — `@remocn/render-sdk/lambda`

Requires `@remotion/lambda` as an optional peer dependency.

```ts
type LambdaConfig = {
  region: AwsRegion;
  functionName: string;
  serveUrl: string;
};
```

- Fires renders immediately through `@remotion/lambda` — no local queue, AWS scales.
- Stateless: renderId + bucket + ext are encoded into the handle; no `StateStore` needed.
- `getUrl()` returns the S3 `outputFile` URL — **only available once status is `done`**.
- `download()` calls `fetch(getUrl())` and returns `response.body`.

## Standalone `waitForCompletion`

If you only have an adapter (not a full `RenderSdk` instance) you can call the standalone function directly:

```ts
import { waitForCompletion } from "@remocn/render-sdk";

const state = await waitForCompletion(adapter, handle, { timeoutMs: 60_000 });
```

The adapter only needs to implement `getState`.

## Provisioning

The SDK does **not** bundle, deploy, or configure Remotion infrastructure. That is the consumer's responsibility.

**Server:** run `bundle()` at startup, pass the resulting `serveUrl` to `RenderServer`.

**Lambda:** run `deploySite`, `deployFunction`, and `getOrCreateBucket` from `@remotion/lambda` in CI, then pass `functionName`, `serveUrl`, and `region` to `RenderLambda`.

See the [provisioning guide](https://your-docs-url/docs/provisioning) for copy-paste recipes.

## `VERSION`

```ts
import { VERSION } from "@remocn/render-sdk";
console.log(VERSION); // e.g. "0.1.0"
```

## License

MIT

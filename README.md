<p align="left">
  <img alt="header" src="https://shieldcn.dev/header/transparent.svg?mode=dark&amp;align=left&amp;border=false&amp;image=https%3A%2F%2Fremocn.dev%2Frender-sdk.png&amp;overlay=0" />
</p>

![badge group](https://shieldcn.dev/group/npm/@remocn/render-sdk/+npm/license/@remocn/render-sdk/.svg?variant=secondary)

# Render SDK

### One render API. Swap the backend, not your code.

A backend-swappable render engine for [Remotion](https://www.remotion.dev/) — run renders **in-process** on your own server or fan them out to **AWS Lambda**, behind a single, fully-typed API.

```ts
const sdk = new RenderSdk({ adapter });          // ← swap server ⇄ lambda here, nothing else
const handle = await sdk.start({ compositionId: "MyVideo", inputProps });
const state  = await sdk.waitForCompletion(handle, { onProgress: p => console.log(p) });
const url    = await sdk.getUrl(handle);
```

## The problem

Remotion ships two completely different rendering APIs:

- `@remotion/renderer` — renders locally, in your Node process. Great for self-hosting.
- `@remotion/lambda` — renders on AWS Lambda at scale. Great for production load.

They share almost nothing. Different function names, different options, different progress shapes, different ways to get the finished file. So the moment you want to **start self-hosted and graduate to Lambda** (or run cheap previews locally and ship final renders to the cloud), you rewrite your entire orchestration layer — queueing, progress tracking, output handling — twice.

On top of that, neither gives you the boring-but-essential plumbing every app needs around a render: a **job handle**, **progress polling**, **concurrency limiting**, and a **place to store state**.

## The solution

`@remocn/render-sdk` is a thin, opinionated layer that hides *which* backend renders your video behind one interface:

```ts
interface RenderAdapter<TOptions> {
  start(input: RenderInput, options?: TOptions): Promise<RenderHandle>;
  getState(handle: RenderHandle): Promise<RenderState>;
  getUrl(handle: RenderHandle): Promise<string>;
  download(handle: RenderHandle): Promise<ReadableStream>;
}
```

Your application code calls `start` / `getState` / `getUrl` / `download` / `waitForCompletion`. The adapter — `RenderServer` or `RenderLambda` — decides *where* the pixels are produced. Switching is a one-line change to the SDK constructor.

## Why you'll like it

|  |  |
| --- | --- |
| **Swap backends in one line** | The same code drives local rendering and AWS Lambda. Start on a box, scale to the cloud — no rewrite. |
| **Remotion-free core** | Types, handles, codecs and errors carry **zero** `@remotion/*` imports. `@remotion/renderer` / `@remotion/lambda` are *optional peer deps* of the adapters only — pull the types without installing Remotion at all. |
| **Fully typed, no casts** | `start`'s options argument auto-narrows to the chosen adapter. Passing a Lambda-only option to the server adapter is a **compile error**, not a runtime surprise. |
| **Progress, the easy way** | `waitForCompletion` polls for you with `onProgress`, `timeoutMs` and `AbortSignal` support — perfect for CLIs, cron jobs and Lambda pollers. |
| **Built-in concurrency limit** | The server adapter bounds in-flight renders with `p-limit` so a burst of jobs can't melt your box. Extra jobs stay `queued` until a slot frees. |
| **Pluggable state store** | Progress lives behind a tiny `StateStore` SPI. Ships with an `InMemoryStore`; swap in Redis or SQL later without touching the SDK. |
| **Unified output access** | `getUrl` and `download` return a public URL and a web `ReadableStream` whether the file sits on local disk or in S3. |

## Install

```bash
# core SDK
bun add @remocn/render-sdk        # or: npm / pnpm / yarn

# the renderer you actually use (optional peer deps)
bun add @remotion/renderer        # for the server adapter
bun add @remotion/lambda          # for the lambda adapter
```

> Requires Node ≥ 17 for the server adapter (`Readable.toWeb`).

---

## Quickstart

### Self-hosted — `RenderServer`

Renders in your own process with a bounded concurrency limiter, writing output to `workDir`.

```ts
import { RenderSdk, InMemoryStore } from "@remocn/render-sdk";
import { RenderServer } from "@remocn/render-sdk/server";

const store = InMemoryStore();

const sdk = new RenderSdk({
  adapter: RenderServer({
    serveUrl:  "/path/to/bundle",        // your bundled Remotion project
    workDir:   "/var/renders",           // where finished files land
    publicUrl: "https://cdn.example.com/renders",
    concurrency: 2,
    store,
  }),
  store,
});

const handle = await sdk.start(
  { compositionId: "MyVideo", inputProps: { title: "Hello" }, codec: "h264" },
  { timeoutInMilliseconds: 120_000 },    // ← ServerOptions, auto-typed
);

await sdk.waitForCompletion(handle, { onProgress: p => console.log(`${Math.round(p * 100)}%`) });

const url    = await sdk.getUrl(handle);     // https://cdn.example.com/renders/s~<jobId>.mp4
const stream = await sdk.download(handle);   // web ReadableStream
```

### At scale — `RenderLambda`

Fires renders straight at AWS Lambda — no local limiter, AWS scales. Stateless: every job's data is encoded into the handle, so there's no store to run.

```ts
import { RenderSdk } from "@remocn/render-sdk";
import { RenderLambda } from "@remocn/render-sdk/lambda";

const sdk = new RenderSdk({
  adapter: RenderLambda({
    region:       "us-east-1",
    functionName: "remotion-render-prod",
    serveUrl:     "https://remotionlambda-xyz.s3.amazonaws.com/sites/my-video",
  }),
});

const handle = await sdk.start(
  { compositionId: "MyVideo", inputProps: { title: "Hello" } },
  { framesPerLambda: 20, privacy: "public" },   // ← LambdaOptions, auto-typed
);

const state = await sdk.waitForCompletion(handle);
const url   = await sdk.getUrl(handle);          // the S3 output URL
```

**That's the whole point:** the application code above the `new RenderSdk({ ... })` line is identical for both backends

| Method | Returns | Notes |
| --- | --- | --- |
| `start(input, options?)` | `RenderHandle` | Queues/fires the render and returns immediately. |
| `getState(handle)` | `{ status, progress, error? }` | `queued` → `rendering` → `done` \\\| `error`. |
| `waitForCompletion(handle, opts?)` | `RenderState` | Polls with `onProgress` / `timeoutMs` / `signal`; throws on render failure. |
| `getUrl(handle)` | `string` | Public URL or S3 URL. Valid once `status === "done"`. |
| `download(handle)` | `ReadableStream` | Web stream of the finished file (disk or S3). |

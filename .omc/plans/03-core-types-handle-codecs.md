# PRD 03 — Core: Types, Errors, Handle, Codecs, Adapter SPI

| | |
|---|---|
| **Task ID** | 03 |
| **Branch (you create)** | `feat/03-core-types` |
| **Depends on** | 02 |
| **Blocks** | 04, 05, 06, 07 |
| **Status** | Ready |

## 1. Goal

Implement the dependency-free core: all public types, `RenderError`, the `handle`
encode/decode (`~` delimiter scheme), the `Codec` union + `codec→ext` table, and the
`RenderAdapter` SPI with the `OptionsOf` helper that drives auto-typing. **No `@remotion/*`
imports anywhere in this PR** — this is the surface a consumer can use standalone.

## 2. Why

This is the contract every other piece depends on (store, sdk, both adapters). Keeping it
remotion-free guarantees the root export's `.d.ts` never references remotion, so a consumer
pulling only types/handle/errors doesn't need remotion installed (§3). It ships before the
store/sdk so their PRs only import, never redefine, these types.

## 3. Scope

### In
- `src/types.ts` — `RenderStatus`, `RenderHandle` (branded), `RenderState`, `RenderInput`,
  `WaitOptions`, `Codec`, `PixelFormat` (own string unions, NOT from remotion).
- `src/errors.ts` — `RenderError extends Error` with the §5 `code` union.
- `src/handle.ts` — `encodeServerHandle`, `encodeLambdaHandle`, `decodeHandle` (tagged `~`).
- `src/codecs.ts` — `CODEC_EXT: Record<Codec, string>` + `extForCodec(codec)`.
- `src/adapter.ts` — `RenderAdapter<TOptions>` interface + `OptionsOf<A>` type helper.
- `src/index.ts` — re-export the public surface.
- Tests for handle round-trip, bad handle, codec map.

### Out
- `StateStore`/`RenderRecord` (PR 04 — though `RenderRecord` may be previewed if cheap).
- `RenderSdk`, `waitForCompletion` (PR 05).
- Adapter implementations (06/07).

## 4. API contract (authoritative)

```ts
export type RenderStatus = "queued" | "rendering" | "done" | "error";
export type RenderHandle = string & { readonly __brand: unique symbol };

export type Codec =
  | "h264" | "h265" | "vp8" | "vp9" | "gif"
  | "prores" | "mp3" | "aac" | "wav";
export type PixelFormat =
  | "yuv420p" | "yuva420p" | "yuv422p" | "yuv444p"
  | "yuv420p10le" | "yuv422p10le" | "yuv444p10le" | "yuva444p10le";

export type RenderState = { status: RenderStatus; progress: number; error?: string };

export type RenderInput = {
  compositionId: string;
  inputProps?: Record<string, unknown>;
  serveUrl?: string;
  codec?: Codec;                 // default "h264"
  frameRange?: [number, number];
  scale?: number;
  width?: number;
  height?: number;
  jpegQuality?: number;
  pixelFormat?: PixelFormat;
};

export type WaitOptions = {
  onProgress?: (progress: number) => void;
  intervalMs?: number;           // default ~1000
  signal?: AbortSignal;
  timeoutMs?: number;
};

export class RenderError extends Error {
  code: "invalid_input" | "render_failed" | "timeout"
      | "not_found" | "version_mismatch" | "adapter_error";
  constructor(code: RenderError["code"], message: string, options?: { cause?: unknown });
}

export interface RenderAdapter<TOptions> {
  start(input: RenderInput, options?: TOptions): Promise<RenderHandle>;
  getState(handle: RenderHandle): Promise<RenderState>;
  getUrl(handle: RenderHandle): Promise<string>;
  download(handle: RenderHandle): Promise<ReadableStream>;
}
export type OptionsOf<A> = A extends RenderAdapter<infer O> ? O : never;
```

### Handle scheme (`~` delimiter, adapter tag first)

```
server:  s~<jobId>
lambda:  l~<renderId>~<bucket>~<ext>
```

```ts
export function encodeServerHandle(jobId: string): RenderHandle;          // `s~${jobId}`
export function encodeLambdaHandle(p: {                                    // `l~r~b~ext`
  renderId: string; bucket: string; ext: string;
}): RenderHandle;
export type DecodedHandle =
  | { adapter: "server"; jobId: string }
  | { adapter: "lambda"; renderId: string; bucket: string; ext: string };
export function decodeHandle(handle: string): DecodedHandle;              // throws RenderError("not_found") on garbage / wrong field count
```

### Codec → ext

```ts
export const CODEC_EXT: Record<Codec, string> = {
  h264: "mp4", h265: "mp4", vp8: "webm", vp9: "webm", gif: "gif",
  prores: "mov", mp3: "mp3", aac: "aac", wav: "wav",
};
export function extForCodec(codec?: Codec): string; // default codec "h264" → "mp4"
```

## 5. Acceptance criteria

- [ ] `import { RenderError, decodeHandle, extForCodec } from "@remocn/render-sdk"` resolves
      from the built dist; root `.d.ts` references **no** `@remotion/*` (grep the declaration).
- [ ] `decodeHandle(encodeServerHandle("abc"))` ⇒ `{adapter:"server", jobId:"abc"}`.
- [ ] `decodeHandle(encodeLambdaHandle({renderId,bucket,ext:"mp4"}))` round-trips all fields.
- [ ] `decodeHandle("nonsense")` and wrong-arity handles throw `RenderError` with
      `code:"not_found"`.
- [ ] `extForCodec()` ⇒ `"mp4"`; every `Codec` has an ext (exhaustive `Record`).
- [ ] `RenderError` is `instanceof Error`, carries `.code`, supports `cause`.

## 6. Test plan (`bun test`)

- `handle.test.ts`: round-trips both adapters; rejects garbage / extra `~` segments / empty
  fields; bucket containing `.` survives (no collision with delimiter).
- `codecs.test.ts`: full map coverage; default behavior.
- `errors.test.ts`: code + instanceof + cause propagation.

## 7. Risks / notes

- Branded `RenderHandle` is a compile-time brand only — encode helpers cast internally; no
  runtime cost.
- Reject empty/whitespace fields in `decodeHandle` to avoid `s~` (empty jobId) passing.
- Keep `Codec`/`PixelFormat` as the single source of truth in core; adapters (06/07) type-guard
  these against remotion's own unions.

## 8. Execution (OMC)

`executor` implements; `code-reviewer` reviews the contract + a `verifier` pass runs tests and
the "no remotion in core .d.ts" check. Git is yours.

## 9. Spec references

CLAUDE.md §5 Types + typing requirement, §7 getUrl (ext source). Design record: handle `~`
scheme, own codec union, core remotion-free.

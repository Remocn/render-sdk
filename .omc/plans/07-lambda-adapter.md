# PRD 07 — Lambda Adapter (`@remocn/render-sdk/lambda`)

| | |
|---|---|
| **Task ID** | 07 |
| **Branch (you create)** | `feat/07-lambda-adapter` |
| **Depends on** | 03, 05 |
| **Blocks** | 08 |
| **Status** | Ready |
| **Parallel with** | 06 |

## 1. Goal

Implement `RenderLambda(config)` — the distributed adapter backed by `@remotion/lambda`. It
fires renders immediately (no local limiter, AWS scales), reads state from `getRenderProgress`,
encodes all per-job data into the handle (no store), and maps Remotion's version error to
`RenderError("version_mismatch")`.

## 2. Why

The cloud backend for studio/stars at scale (§13). Stateless by design (§10): the handle
carries `renderId + bucket + ext`; `region`/`functionName` come from config. Independent of
the server adapter — can be built in parallel after the SDK (05) lands.

## 3. Scope

### In
- `src/lambda/index.ts` — `RenderLambda(config: LambdaConfig): RenderAdapter<LambdaOptions>`.
- `LambdaConfig`: `region`, `functionName`, `serveUrl`.
- `LambdaOptions` (2nd arg): `framesPerLambda?`, `webhook?`, `privacy?`, `outName?`,
  `maxRetries?` (types from `@remotion/lambda`).
- `start`: `renderMediaOnLambda({ region, functionName, serveUrl, composition, codec,
  inputProps, ...options })` ⇒ `{ renderId, bucketName }` → `encodeLambdaHandle({renderId,
  bucket, ext})` → return handle. **No store.**
- `getState`: `decodeHandle` → `getRenderProgress({ renderId, bucketName, functionName,
  region })` → map to `{status, progress: overallProgress, error?}`
  (done⇒`done`, fatalError⇒`error`, else `rendering`/`queued`).
- `getUrl`: return the S3 `outputFile` from progress (signed if private bucket) — derive from
  `getRenderProgress`/`getRenderOutputUrl` or construct from bucket+key+region+ext.
- `download`: `fetch(getUrl)` ⇒ `response.body` (web `ReadableStream`).
- **Version mismatch**: wrap `renderMediaOnLambda` in try/catch; if Remotion throws its
  function/client version error, rethrow as `RenderError("version_mismatch", ...)`; other
  failures ⇒ `RenderError("render_failed"/"adapter_error", ...)`.
- **Type-guard test**: our `Codec` union is assignable to `@remotion/lambda`'s codec type
  (fails to compile if Remotion drifts).

### Out
- A local limiter / store (lambda is stateless, AWS scales — §10).
- Native AWS webhook handling beyond passing `webhook` through (consumer owns the endpoint).
- Server adapter (06).

## 4. API contract (authoritative)

```ts
export type LambdaConfig = {
  region: string;
  functionName: string;
  serveUrl: string;
};
export type LambdaOptions = {
  framesPerLambda?: number;
  webhook?: import("@remotion/lambda/client").WebhookOption | { url: string; secret: string | null };
  privacy?: "public" | "private";
  outName?: string;
  maxRetries?: number;
};
export function RenderLambda(config: LambdaConfig): RenderAdapter<LambdaOptions>;
```

### State mapping (`getRenderProgress` → `RenderState`)
| progress field | → RenderState |
|---|---|
| `done === true` | `{ status: "done", progress: 1 }` |
| `fatalErrorEncountered` | `{ status: "error", progress, error: errors[0]?.message }` |
| `overallProgress > 0` | `{ status: "rendering", progress: overallProgress }` |
| else | `{ status: "queued", progress: 0 }` |

> Confirm exact `renderMediaOnLambda` / `getRenderProgress` field names against the installed
> `@remotion/lambda` version (esp. `bucketName` vs `outBucket`, `outputFile`, `errors[]`).

## 5. Acceptance criteria

- [ ] `RenderLambda(...)` satisfies `RenderAdapter<LambdaOptions>`; plugs into `RenderSdk` with
      options auto-typed; passing `chromiumOptions` is a **compile error** (server-only).
- [ ] `start` calls `renderMediaOnLambda` once and returns a handle that round-trips through
      `decodeHandle` to `{adapter:"lambda", renderId, bucket, ext}`.
- [ ] `getState` maps each progress case per §4 table.
- [ ] `getUrl` returns the S3 URL; `download` streams it via `fetch().body`.
- [ ] Remotion version error ⇒ `RenderError` `version_mismatch`; other errors mapped sensibly.
- [ ] No `StateStore` usage anywhere in the lambda path.
- [ ] `Codec` type-guard test compiles; build keeps `@remotion/lambda` external.

## 6. Test plan (`bun test`)

- Mock `@remotion/lambda` (`renderMediaOnLambda`, `getRenderProgress`, composition select).
- `lambda.start.test.ts`: single call, handle encodes renderId/bucket/ext.
- `lambda.state.test.ts`: each row of the §4 mapping table.
- `lambda.url-download.test.ts`: getUrl returns S3 url; download uses fetch body (mock fetch).
- `lambda.version.test.ts`: simulate Remotion version error ⇒ `version_mismatch`.
- `lambda.types.test-d.ts`: `Codec` assignable to remotion codec; wrong options rejected.

## 7. Risks / notes

- **Reactive** version handling only — no proactive version probing (design record). The map
  must recognize Remotion's version-error shape; keep the matcher loose + documented so a
  message-format change degrades to `adapter_error`, never a crash.
- `getUrl`/`download` valid only when `status === "done"` (§15) — before that the object 404s.
- Private bucket ⇒ signed URL path; confirm the helper (`getRenderProgress.outputFile` is
  usually already usable; signing may need `presignUrl`).
- Composition selection on lambda may use `serveUrl`-based metadata; confirm whether
  `renderMediaOnLambda` needs `composition` object or just `composition` id string.

## 8. Execution (OMC)

`executor` implements; `code-reviewer` (error mapping, statelessness); `verifier` runs mocked
suite + type tests. Git is yours.

## 9. Spec references

CLAUDE.md §6 lambda config + options, §7 getUrl (S3), §10 lambda semantics, design record:
reactive `version_mismatch` mapping, handle `l~renderId~bucket~ext`.

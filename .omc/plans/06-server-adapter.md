# PRD 06 — Server Adapter (`@remocn/render-sdk/server`)

| | |
|---|---|
| **Task ID** | 06 |
| **Branch (you create)** | `feat/06-server-adapter` |
| **Depends on** | 03, 04, 05 |
| **Blocks** | 08 |
| **Status** | Ready |
| **Parallel with** | 07 |

## 1. Goal

Implement `RenderServer(config)` — the in-process adapter backed by `@remotion/renderer` with
a `p-limit` concurrency limiter, writing progress to the `StateStore`, rendering to
`${workDir}/${handle}.${ext}`, and serving `getUrl`/`download` from disk.

## 2. Why

Replaces the duplicated `lib/server/render-queue.ts` + `site-video` engines in remocn with one
limiter per process (§13). It's the self-hosted backend; lambda (07) is its sibling. Depends on
core types, the store (source-of-truth for progress), and the SDK facade.

## 3. Scope

### In
- `src/server/index.ts` — `RenderServer(config: ServerConfig): RenderAdapter<ServerOptions>`.
- `ServerConfig`: `serveUrl` (bundle path/URL), `workDir` (required output dir),
  `publicUrl?` (http base), `concurrency?` (default 2), `store?` (defaults to the SDK's).
- `ServerOptions` (2nd arg of `start`): `concurrency?`, `chromiumOptions?` (from
  `@remotion/renderer`), `timeoutInMilliseconds?`.
- `start`: generate jobId → `encodeServerHandle` → `store.create({status:"queued", codec, ...})`
  → enqueue a **detached** render task on the limiter → return handle immediately.
- Render task: `selectComposition` → `renderMedia({ outputLocation: ${workDir}/${handle}.${ext},
  onProgress })` → `store.update` progress → on finish `status:"done"`; on throw
  `status:"error"` + message (map version errors → `version_mismatch`, else `render_failed`).
- `getState`: read store ⇒ `{status, progress, error?}`; missing ⇒ `RenderError("not_found")`.
- `getUrl`: `publicUrl ? \`${publicUrl}/${handle}.${ext}\` : \`${handle}.${ext}\``; ext from store.
- `download`: open `${workDir}/${handle}.${ext}`, return a **web `ReadableStream`**
  (`fs.createReadStream` → `stream.Readable.toWeb`); missing file ⇒ `RenderError("not_found")`.

### Out
- HTTP routes (consumer's — recipes in PR 08).
- Upload/storage, cleanup/TTL (§14).
- Lambda (07).

## 4. API contract (authoritative)

```ts
export type ServerConfig = {
  serveUrl: string;
  workDir: string;
  publicUrl?: string;
  concurrency?: number;          // default 2
  store?: StateStore;            // default: shared SDK store
};
export type ServerOptions = {
  concurrency?: number;          // per-job override
  chromiumOptions?: import("@remotion/renderer").ChromiumOptions;
  timeoutInMilliseconds?: number;
};
export function RenderServer(config: ServerConfig): RenderAdapter<ServerOptions>;
```

### Progress mapping
`renderMedia`'s `onProgress` reports rendered/encoded frames; normalize to `progress` in
`0..1` (e.g. `renderedFrames / composition.durationInFrames`, clamped). Confirm the exact
`onProgress` payload against the installed `@remotion/renderer` version during implementation.

## 5. Acceptance criteria

- [ ] `RenderServer(...)` satisfies `RenderAdapter<ServerOptions>` and plugs into `RenderSdk`
      with options auto-typed (no `as`).
- [ ] `start` returns a handle synchronously-ish (does not block on the render); store shows
      `queued`→`rendering`→`done` across polls.
- [ ] Concurrency is bounded by the limiter (N+1th job stays `queued` until a slot frees) —
      proven with a mocked renderer that we can gate.
- [ ] Output file lands at `${workDir}/${handle}.${ext}`; `ext` matches the job codec.
- [ ] `getUrl` returns `${publicUrl}/${handle}.${ext}` with `publicUrl`, else bare
      `${handle}.${ext}`.
- [ ] `download` yields a web `ReadableStream` of the file; missing ⇒ `not_found`.
- [ ] Render throw ⇒ store `status:"error"` with message; version-ish errors ⇒
      `version_mismatch` code surfaced via `getState`/error.
- [ ] `bun run build` keeps `@remotion/renderer` external (not bundled).

## 6. Test plan (`bun test`)

- Mock `@remotion/renderer` (`selectComposition`/`renderMedia`) — no real Chromium.
- `server.start.test.ts`: handle shape, store transitions, onProgress→store.
- `server.limiter.test.ts`: gate the mock to assert concurrency bound.
- `server.url.test.ts`: getUrl with/without `publicUrl`; ext per codec.
- `server.download.test.ts`: write a temp file, assert stream contents; missing ⇒ not_found.
- `server.error.test.ts`: renderMedia rejects ⇒ error state; simulated version error ⇒
  `version_mismatch`.

## 7. Risks / notes

- **Detached render**: the task runs as an unawaited promise; ensure rejections are caught and
  written to the store (no unhandledRejection). Single-process model only (§15).
- `workDir` must exist / be created (`mkdir -p`) before write.
- `Readable.toWeb` is Node ≥17; document the Node floor.
- Limiter is per-process (§15) — multi-instance is out of scope.
- Confirm `renderMedia` codec naming matches our `Codec` union; add the **type-guard test**
  (`Codec` assignable to remotion's `Codec`) here or in 07.

## 8. Execution (OMC)

`executor` implements; `code-reviewer` (async/detached correctness, resource leaks);
`verifier` runs the mocked suite. Git is yours.

## 9. Spec references

CLAUDE.md §6 configs, §7 getUrl, §9 store, §10 server semantics, §13 stars/site-video.

# PRD 05 — RenderSdk + waitForCompletion

| | |
|---|---|
| **Task ID** | 05 |
| **Branch (you create)** | `feat/05-render-sdk` |
| **Depends on** | 03, 04 |
| **Blocks** | 06, 07 |
| **Status** | Ready |

## 1. Goal

Implement the public `RenderSdk<A>` facade — auto-typed via `OptionsOf<A>` so consumers never
write `as Type` — and the server-side `waitForCompletion` poll loop. Both are adapter-agnostic
and remotion-free; verified against a fake in-memory adapter.

## 2. Why

This is the entry point consumers instantiate (`new RenderSdk({ adapter })`). The hard
typing requirement (§5) lives here: the second arg of `start` must narrow to the adapter's
own options type. Shipping it before the adapters lets 06/07 be validated by plugging into a
real `RenderSdk` immediately. `waitForCompletion` is the CLI/cron/lambda-polling driver (§4).

## 3. Scope

### In
- `src/sdk.ts` — `RenderSdk<A extends RenderAdapter<any>>` class:
  `constructor({ adapter, store? })`; methods `start`, `getState`, `getUrl`, `download`,
  `waitForCompletion` delegating to the adapter; `start`'s options arg typed `OptionsOf<A>`.
- `src/wait.ts` — standalone `waitForCompletion(adapter, handle, opts?)` poll loop
  (also exposed as a method on the SDK).
- Re-export `RenderSdk`, `waitForCompletion` from `src/index.ts`.
- Tests with a **fake adapter** (scripted state progression).

### Out
- Real server/lambda adapters (06/07).
- The store is *accepted and held* here; only the server adapter (06) reads/writes it.

## 4. API contract (authoritative)

```ts
export class RenderSdk<A extends RenderAdapter<any>> {
  constructor(config: { adapter: A; store?: StateStore });
  start(input: RenderInput, options?: OptionsOf<A>): Promise<RenderHandle>;
  getState(handle: RenderHandle): Promise<RenderState>;
  getUrl(handle: RenderHandle): Promise<string>;
  download(handle: RenderHandle): Promise<ReadableStream>;
  waitForCompletion(handle: RenderHandle, opts?: WaitOptions): Promise<RenderState>;
}

export function waitForCompletion(
  adapter: Pick<RenderAdapter<unknown>, "getState">,
  handle: RenderHandle,
  opts?: WaitOptions,
): Promise<RenderState>;
```

### `waitForCompletion` semantics
- Polls `getState` every `intervalMs` (default ~1000ms).
- Calls `onProgress(progress)` on each tick.
- Resolves when `status === "done"` (returns final state) **or** `status === "error"`
  (resolve with the error state OR throw `RenderError("render_failed", state.error)` — pick
  throw; document it).
- `signal` aborted ⇒ reject `RenderError("adapter_error", "aborted")` (or a dedicated cause).
- `timeoutMs` exceeded ⇒ reject `RenderError("timeout", ...)`.
- No tight-loop: await the interval between polls; honor `signal` during the wait.

### Typing requirement (must hold)
```ts
const r = new RenderSdk({ adapter: RenderLambda({ ... }) });
r.start({ compositionId: "x" }, { framesPerLambda: 20 });   // ✅ LambdaOptions
r.start({ compositionId: "x" }, { chromiumOptions: {} });   // ❌ compile error
```
A type-level test (`expectTypeOf`/`@ts-expect-error`) must encode this.

## 5. Acceptance criteria

- [ ] `new RenderSdk({ adapter })` delegates all five methods to the adapter.
- [ ] `start` options arg is inferred as the adapter's options type (no `as`); the wrong-shape
      call fails to compile (covered by a `@ts-expect-error` test).
- [ ] `waitForCompletion` resolves on `done`, throws `render_failed` on `error`,
      `timeout` on `timeoutMs`, aborts on `signal`.
- [ ] `onProgress` fires with monotonic-ish 0..1 values from the fake adapter.
- [ ] Remotion-free (no `@remotion/*` import).

## 6. Test plan (`bun test`)

- `sdk.test.ts`: delegation via a fake adapter; store is held and passed through.
- `wait.test.ts`: scripted adapter that returns queued→rendering(.5)→done; assert progress
  callbacks, resolution; separate cases for error, timeout, abort.
- `types.test-d.ts` (or inline `@ts-expect-error`): options narrowing per adapter.

## 7. Risks / notes

- Decide and document the error-state contract (throw vs resolve) — PRD picks **throw
  `render_failed`** for `waitForCompletion`; `getState` itself always resolves a state object.
- Use an abortable delay helper so `signal` interrupts mid-wait, not just between polls.
- `RenderSdk.start` may need to seed the store (`create`) for the server path — but since the
  server adapter owns its store writes (06), keep SDK a thin delegator; the adapter receives
  the store via config, not via the SDK. Confirm wiring direction in 06.

## 8. Execution (OMC)

`executor` implements; `code-reviewer` checks the generic typing; `verifier` runs unit +
type tests. Git is yours.

## 9. Spec references

CLAUDE.md §4 public surface, §5 typing requirement, §8 lifecycle, `waitForCompletion` row.

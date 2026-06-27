# PRD 04 — State Store SPI + InMemoryStore

| | |
|---|---|
| **Task ID** | 04 |
| **Branch (you create)** | `feat/04-state-store` |
| **Depends on** | 03 |
| **Blocks** | 05, 06 |
| **Status** | Ready |

## 1. Goal

Define the `StateStore` SPI and `RenderRecord` type (§9) and ship the default
`InMemoryStore`. This is the progress source-of-truth the server adapter writes to and
`getState` reads from; lambda does not use it.

## 2. Why

Splitting the store into its own SPI lets consumers swap it for Redis/SQL later (§16) without
touching the SDK. It must exist before the SDK (PR 05 wires the default store) and the server
adapter (PR 06 writes records). Kept remotion-free like core.

## 3. Scope

### In
- `src/store/types.ts` — `StateStore` interface + `RenderRecord`.
- `src/store/in-memory.ts` — `InMemoryStore()` factory backed by a `Map`.
- Re-export `InMemoryStore`, `StateStore`, `RenderRecord` from `src/index.ts`.
- Tests: CRUD + partial update + delete + get-missing.

### Out
- Redis/SQL stores (future, §16).
- SDK wiring (PR 05) and adapter usage (PR 06).

## 4. API contract (authoritative)

```ts
export type RenderRecord = {
  status: RenderStatus;
  progress: number;            // 0..1
  error?: string;
  codec: Codec;                // → ext for getUrl/download
  createdAt: number;
  meta?: Record<string, unknown>;  // consumer data; SDK is domain-agnostic
};

export interface StateStore {
  create(handle: RenderHandle, initial: RenderRecord): Promise<void>;
  get(handle: RenderHandle): Promise<RenderRecord | null>;
  update(handle: RenderHandle, patch: Partial<RenderRecord>): Promise<void>;
  delete(handle: RenderHandle): Promise<void>;
}

export function InMemoryStore(): StateStore;
```

Semantics:
- `create` on an existing handle: overwrite is acceptable (document it); no throw.
- `update` on a missing handle: throw `RenderError("not_found", ...)` (callers rely on this to
  surface stale/lost jobs — see §15 per-process caveat).
- `get` missing ⇒ `null` (not a throw).
- `delete` is idempotent.

## 5. Acceptance criteria

- [ ] `create` then `get` returns the same record (structural equality).
- [ ] `update` applies a partial patch, leaves untouched fields intact, and persists.
- [ ] `update` on an unknown handle throws `RenderError` `not_found`.
- [ ] `get` on unknown handle ⇒ `null`.
- [ ] `delete` removes; subsequent `get` ⇒ `null`; double-delete does not throw.
- [ ] No `@remotion/*` import; module is sync-in/async-out (returns resolved Promises).

## 6. Test plan (`bun test`)

- `in-memory.test.ts`: full CRUD lifecycle, partial update preserves fields, missing-handle
  update throws `not_found`, idempotent delete, `createdAt`/`meta` round-trip.

## 7. Risks / notes

- `Map` keyed by the raw handle string. No TTL/sweep in v1 (§14 — consumer cleans up).
- Returning `Promise` even though in-memory is sync keeps the SPI uniform with Redis/SQL.

## 8. Execution (OMC)

`executor` implements; `verifier` runs CRUD tests. Git is yours.

## 9. Spec references

CLAUDE.md §9 State-store SPI, §10 (server uses store, lambda doesn't), §15 per-process caveat.

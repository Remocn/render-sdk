# PRD 08 — Docs + README

| | |
|---|---|
| **Task ID** | 08 |
| **Branch (you create)** | `feat/08-docs` |
| **Depends on** | 06, 07 |
| **Status** | Ready |

## 1. Goal

Document the stable public surface: a package `README.md` and Fumadocs pages under
`apps/docs`. Since the SDK ships no HTTP/client, the docs carry the transport (§11) and
provisioning (§12) recipes that make it usable end-to-end.

## 2. Why

The SDK deliberately offloads HTTP + provisioning to recipes (§2, §14). Those recipes are
part of the product — without them a consumer can't wire the browser↔consumer↔SDK flow (§8).
Docs land last, once both adapters' surfaces are frozen, so examples can't go stale.

## 3. Scope

### In
- `packages/render-sdk/README.md` — what it is, install (+ optional peers), 30-line quickstart
  (server and lambda), public surface table, link to docs site.
- Fumadocs pages in `apps/docs/content/docs/`:
  - **Overview / responsibility boundary** (§2): where Remotion provisioning ends and the SDK
    begins; what's out of scope (§14).
  - **Public surface** (§4): `start`/`getState`/`getUrl`/`download`/`waitForCompletion` with
    types (§5).
  - **Adapters**: `RenderServer` and `RenderLambda` configs/options (§6); server-vs-lambda
    table (§10); unified `getUrl` table (§7).
  - **Transport recipes** (§11): Next.js POST + two GET routes, browser poll loop.
  - **Provisioning recipes** (§12): `bundle` (server build step), `deploySite`/`deployFunction`
    (lambda CI) — explicitly the consumer's job.
  - **State store** (§9) + swapping to Redis/SQL (§16).
  - **Limitations** (§15) + out-of-scope (§14).
- Update `apps/docs` nav/meta + the home page to describe the SDK (replace the Fumadocs
  starter copy).

### Out
- Implementing any client/HTTP (recipes only — copy-paste snippets).
- API reference auto-generation (manual docs in v1).

## 4. Deliverables

```
packages/render-sdk/README.md
apps/docs/content/docs/
├─ index.mdx                 # overview + boundary
├─ public-surface.mdx
├─ adapters.mdx
├─ transport-recipes.mdx
├─ provisioning.mdx
├─ state-store.mdx
└─ limitations.mdx
apps/docs/content/docs/meta.json   # nav order
```
(Remove the starter `test.mdx`.)

## 5. Acceptance criteria

- [ ] `bun --filter docs build` is green with the new pages; nav renders in order.
- [ ] README quickstart compiles conceptually against the real exports (imports match
      `@remocn/render-sdk`, `/server`, `/lambda`).
- [ ] Every code snippet uses the **final** type/config names from PRs 03–07 (no drift).
- [ ] Recipes cover: POST route, poll GET route, download GET route, browser loop,
      `bundle`, `deploySite`/`deployFunction`.
- [ ] All prose is English; the boundary/out-of-scope sections match §2/§14 verbatim in intent.

## 6. Test plan

- Docs build is the gate. Manual read-through against §§2,4,6,7,9,10,11,12,14,15.
- Optional: a snippet-extraction typecheck (compile fenced TS blocks) — nice-to-have.

## 7. Risks / notes

- Keep snippets honest: `getUrl` valid only when `done` (§15); `publicUrl` serves nothing by
  itself (§7). Call these out so consumers don't 404.
- Don't document features that are out of scope (cancel/list/delete/upload — §14).
- This PR may touch `apps/docs` config (nav) — keep it within the docs app.

## 8. Execution (OMC)

`writer` drafts; `document-specialist` cross-checks recipes against Remotion docs;
`code-reviewer` verifies snippet/type accuracy vs the shipped API. Git is yours.

## 9. Spec references

CLAUDE.md §2, §4–§12, §14, §15, §16.

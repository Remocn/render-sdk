# @remocn/render-sdk — PRD index

One PRD per task = one branch + one PR (you own all git). Each PRD has explicit
Scope / Deliverables / Acceptance / Test plan and is merged green.

| # | PRD | Branch | Depends on |
|---|---|---|---|
| 01 | [Workspace skeleton](01-workspace-skeleton.md) | `feat/01-workspace-skeleton` | — |
| 02 | [Package scaffold + tooling](02-package-scaffold.md) | `feat/02-package-scaffold` | 01 |
| 03 | [Core: types, errors, handle, codecs, SPI](03-core-types-handle-codecs.md) | `feat/03-core-types` | 02 |
| 04 | [State store + InMemoryStore](04-state-store.md) | `feat/04-state-store` | 03 |
| 05 | [RenderSdk + waitForCompletion](05-render-sdk-wait.md) | `feat/05-render-sdk` | 03, 04 |
| 06 | [Server adapter](06-server-adapter.md) | `feat/06-server-adapter` | 03, 04, 05 |
| 07 | [Lambda adapter](07-lambda-adapter.md) | `feat/07-lambda-adapter` | 03, 05 |
| 08 | [Docs + README](08-docs-readme.md) | `feat/08-docs` | 06, 07 |
| 09 | [CI (GitHub Actions)](09-ci.md) | `feat/09-ci` | 02 |

## Dependency graph

```
01 ──► 02 ──► 03 ──► 04 ──► 05 ──┬──► 06 ──┐
              │                  └──► 07 ──┴──► 08
              └──► 09 (CI, parallel)
```

- Strictly sequential: 01 → 02 → 03 → 04 → 05.
- 06 and 07 are independent — parallel branches after 05 merges.
- 09 (CI) can start right after 02; most useful once 03+ exist.
- 08 (docs) last, after both adapters freeze.

## Design record (locked)

- Layout: `apps/docs` + `packages/render-sdk`, bun workspaces.
- Build: `scripts/build.ts` (Bun.build, node target) + `.d.ts` via `tsc`.
- Limiter: `p-limit`.
- Handle: delimiter scheme `~`, adapter tag first — `s~jobId` / `l~renderId~bucket~ext`
  (region/functionName come from config, not the handle).
- Version check: reactive — map Remotion's error to `RenderError("version_mismatch")`,
  no proactive version probing.
- Codecs: own full `Codec` union + `codec→ext` table in core + type-guard test vs remotion.
- `@remotion/*`: optional peer deps of the adapters only; root export stays remotion-free.

## Execution (OMC)

`executor` implements, `code-reviewer`/`verifier` accept in a separate pass. The assistant
never runs git — branches, commits, PRs, merges are all yours.

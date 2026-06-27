# PRD 02 — Package Scaffold + Build Tooling

| | |
|---|---|
| **Task ID** | 02 |
| **Branch (you create)** | `feat/02-package-scaffold` |
| **Depends on** | 01 |
| **Blocks** | 03–08 |
| **Status** | Ready |

## 1. Goal

Create the `@remocn/render-sdk` package shell with its build pipeline: `package.json`
(subpath exports + optional peer deps), TypeScript configs, `bunfig.toml`, and a
`scripts/build.ts` that emits ESM + `.d.ts` to `dist/`. No SDK logic yet — an empty
`src/index.ts` that builds green proves the toolchain.

## 2. Why

Every later task writes into this package and is gated by `bun run build`. Standing up the
toolchain first (mirroring files-sdk's Bun.build + separate type emit) means tasks 03–08 only
add source files, never touch packaging. Isolating "does the bundler/exports/declarations
pipeline work" into one PR keeps that infra review separate from product code.

## 3. Scope

### In
- `packages/render-sdk/package.json` (see §5).
- `tsconfig.json` (editor/typecheck) + `tsconfig.build.json` (declaration emit only).
- `bunfig.toml` (test config; coverage threshold optional, lighter than files-sdk's 98%).
- `scripts/build.ts` — `Bun.build()` per entry, externals = peer+optional+runtime deps,
  target `node`, format `esm`; then `.d.ts` via `tsc -p tsconfig.build.json`.
- `src/index.ts` with a trivial placeholder export (`export {}` or a `VERSION` const).
- Package `README.md` stub (filled in PR 08).

### Out
- Any types/SDK/adapter/store logic (PRs 03–07).
- Publishing / changesets / CI (CI is PR 09).

## 4. Deliverables

```
packages/render-sdk/
├─ package.json
├─ tsconfig.json
├─ tsconfig.build.json
├─ bunfig.toml
├─ scripts/build.ts
├─ src/index.ts          # placeholder
└─ README.md             # stub
```

## 5. package.json (target shape)

```jsonc
{
  "name": "@remocn/render-sdk",
  "version": "0.0.0",
  "description": "Backend-swappable render engine for Remotion (server + AWS Lambda).",
  "license": "MIT",
  "type": "module",
  "sideEffects": false,
  "files": ["dist", "README.md"],
  "exports": {
    ".":        { "types": "./dist/index.d.ts",        "import": "./dist/index.js" },
    "./server": { "types": "./dist/server/index.d.ts", "import": "./dist/server/index.js" },
    "./lambda": { "types": "./dist/lambda/index.d.ts", "import": "./dist/lambda/index.js" }
  },
  "scripts": {
    "build": "bun run scripts/build.ts",
    "dev": "bun run scripts/build.ts --watch",
    "test": "bun test",
    "types": "tsc --noEmit"
  },
  "dependencies": { "p-limit": "^6.1.0" },
  "peerDependencies": {
    "@remotion/renderer": ">=4.0.0",
    "@remotion/lambda": ">=4.0.0"
  },
  "peerDependenciesMeta": {
    "@remotion/renderer": { "optional": true },
    "@remotion/lambda": { "optional": true }
  },
  "devDependencies": {
    "@remotion/renderer": ">=4.0.0",
    "@remotion/lambda": ">=4.0.0",
    "typescript": "^6.0.3"
  },
  "publishConfig": { "access": "public" }
}
```
> Both remotion peers are **optional** (§3: install only the backend you use). They're also
> devDeps so the package typechecks/builds + tests can mock them. Exact `p-limit`/peer ranges
> confirmed against the lockfile during implementation.

## 6. scripts/build.ts (behavior contract)

- Read entry points from `pkg.exports` (`.`, `./server`, `./lambda`), map `./dist/x.js → src/x.ts`.
- `Bun.build({ entrypoints, outdir: "dist", target: "node", format: "esm", external })`
  where `external` = keys of `peerDependencies` + `dependencies` + node builtins (so remotion,
  p-limit, `node:fs` etc. are never bundled in).
- Generate declarations: `tsc -p tsconfig.build.json` (emits `dist/**/*.d.ts`, no `.js`).
- `--watch` flag re-runs on change (dev).
- Clean `dist/` before build.

## 7. tsconfig (key settings)

- `tsconfig.json`: `strict`, `module`/`moduleResolution` = `nodenext` or `bundler`,
  `verbatimModuleSyntax`, `noEmit`, `lib: ["ESNext","DOM"]` (DOM for `ReadableStream` global).
- `tsconfig.build.json`: `extends` base, `declaration: true`, `emitDeclarationOnly: true`,
  `outDir: dist`, `noEmit: false`, `include: ["src"]`.

## 8. Acceptance criteria

- [ ] `bun install` resolves; remotion peers present (devDeps) without errors.
- [ ] `bun run build` produces `dist/index.js`, `dist/server/index.js`, `dist/lambda/index.js`
      and matching `*.d.ts`.
- [ ] No `@remotion/*` or `p-limit` code is bundled into the output (they're external).
- [ ] `node -e "import('@remocn/render-sdk').then(m=>console.log(m))"` (via the dist path)
      resolves the root export.
- [ ] `bun test` runs (zero tests OK) and `tsc --noEmit` passes.

## 9. Test plan

- Build is the gate. A tiny `test/build-output.test.ts` asserting the three `dist` entries
  exist + import is allowed but optional in this PR.

## 10. Risks / notes

- `.d.ts` for subpaths must land at `dist/server/index.d.ts` etc. — keep `src/server/index.ts`
  / `src/lambda/index.ts` directory shape from day one so paths line up.
- Don't bundle node builtins or peers — verify `external` covers them.
- `ReadableStream` is a global (DOM lib) — ensure `lib` includes DOM so types resolve without
  importing from `node:stream/web`.

## 11. Execution (OMC)

`executor` implements; `verifier` checks the acceptance list (build artifacts + externals).
Git is yours.

## 12. Spec references

CLAUDE.md §3 Packaging, §5 typing requirement. files-sdk reference: Bun.build + `tsgo`/`tsc`
for declarations, `type: module`, `sideEffects: false`, externals from peers.

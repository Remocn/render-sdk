# Release & CI/CD

This repo uses **Bun** for install/build/test/lint and **npm (OIDC trusted
publishing)** for publishing `@remocn/render-sdk` to the npm registry.
Versioning and changelogs are driven by **Changesets**.

## Pipelines

| Workflow | Trigger | What it does |
| --- | --- | --- |
| `.github/workflows/ci.yml` | every PR + push to `main` | `bun install` → `lint` → `typecheck` → `test` → `build`, plus an advisory `changeset status` |
| `.github/workflows/release.yml` | push to `main` | runs `changesets/action`: opens/updates a **"Version Packages"** PR, and on merge publishes to npm via OIDC |

### Lint / format engine

Single engine — **Biome 2.4.16** — across the monorepo:

- `apps/docs` → **ultracite@7** configured with `--linter biome`
  (`apps/docs/biome.jsonc` extends `ultracite/biome/core`). Scripts: `lint` = `ultracite check`, `format` = `ultracite fix`.
- `packages/render-sdk` → plain Biome (`packages/render-sdk/biome.json`).
  Scripts: `lint` = `biome ci .`, `format` = `biome check --write .`.

Root aggregators fan out with `bun --filter '*' run <script>`:
`bun run lint`, `bun run format`, `bun run typecheck`, `bun run test`, `bun run build`.

## Day-to-day: adding a change

1. Make your change on a branch, open a PR.
2. Add a changeset: `bun run changeset` → pick `@remocn/render-sdk`, choose
   patch/minor/major, write a summary. Commit the generated `.changeset/*.md`.
3. CI runs lint/typecheck/test/build. The advisory `changeset status` step hints
   if a changeset is missing (non-blocking — docs/chore PRs don't need one).
4. Merge the PR. `release.yml` opens/updates the **"Version Packages"** PR.
5. Merge **"Version Packages"** → the package is versioned, the changelog is
   written, and it is published to npm automatically.

## One-time manual setup (owner / npm account holder)

These steps are required **once** before automated publishing works. They are
not done by this repo's code.

### 1. Claim the package name with a first manual publish

OIDC trusted publishing is configured on an **existing** npm package, but
`@remocn/render-sdk` has never been published. Publish once by hand to claim it:

```bash
# from packages/render-sdk, after bumping version (e.g. 0.1.0)
npm publish --access public
```

Use a granular npm automation token or interactive 2FA for this single publish.

### 2. Configure the npm Trusted Publisher

On npmjs.com → the `@remocn/render-sdk` package → **Settings → Trusted Publishers**
→ add a **GitHub Actions** publisher:

- Organization / user: `Remocn`
- Repository: `render-sdk`
- Workflow filename: `release.yml`
- Environment: *(leave empty unless you add one to the workflow)*

After this, the workflow publishes with **no `NPM_TOKEN`** — auth is via the
GitHub OIDC token (`id-token: write`). Provenance is attached automatically
(`NPM_CONFIG_PROVENANCE=true`).

### 3. Allow GitHub Actions to open PRs

GitHub repo → **Settings → Actions → General → Workflow permissions** →
enable **"Allow GitHub Actions to create and approve pull requests"**.
Without this, `changesets/action` cannot open the "Version Packages" PR.

### 4. (Optional) Protect `main`

Add a branch-protection rule on `main` requiring the **CI** check to pass
before merge.

## Notes & gotchas

- **`repository` field is required for provenance**: OIDC trusted publishing
  auto-generates provenance, which needs a resolvable `repository.url` (plus
  `repository.directory` for this monorepo) in `packages/render-sdk/package.json`.
  Without it the **automated** publish aborts — but the manual claim-publish in
  step 1 (no provenance) still succeeds, so the gap only surfaces on the first
  automated release. The field is already set in this repo.
- **npm version**: Node 22 ships npm 10; the release job upgrades to
  `npm@^11.5` so OIDC (needs npm ≥ 11.5.1) works. Pinned to a range rather than
  `@latest` for reproducibility on the credential-bearing publish job.
- **No `registry-url` with an empty token**: `setup-node`'s `registry-url`
  writes an `_authToken` line into `.npmrc`; with OIDC we intentionally omit it
  so it does not conflict with trusted publishing.
- **`docs` is `private`** → never published; Changesets ignores it.
- **Bun is pinned** to `1.3.2` in both workflows for reproducible CI. Bump it in
  the workflow files (and locally) together.

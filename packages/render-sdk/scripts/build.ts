/**
 * Build script for @remocn/render-sdk.
 *
 * - Derives entrypoints from package.json `exports` (`.`, `./server`, `./lambda`).
 * - Bundles each entry with Bun.build (target node, format esm).
 * - Externalizes peer deps, runtime deps, and node builtins (never bundled).
 * - Emits declarations via `tsc -p tsconfig.build.json`.
 * - Supports `--watch` to rebuild on src changes.
 */

import { rmSync, watch } from "node:fs";
import { builtinModules } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(__dirname, "..");
const srcDir = join(pkgRoot, "src");
const distDir = join(pkgRoot, "dist");

interface PackageJson {
  exports: Record<string, { types?: string; import?: string }>;
  peerDependencies?: Record<string, string>;
  dependencies?: Record<string, string>;
}

const pkg = (await Bun.file(
  join(pkgRoot, "package.json"),
).json()) as PackageJson;

/**
 * Map each export's `import` dist path back to its source entry under `src/`.
 *   "."        -> "./dist/index.js"        -> src/index.ts
 *   "./server" -> "./dist/server/index.js" -> src/server/index.ts
 */
function resolveEntrypoints(): string[] {
  const entrypoints: string[] = [];
  for (const [, target] of Object.entries(pkg.exports)) {
    const importPath = target.import;
    if (!importPath) continue;
    // ./dist/server/index.js -> server/index.js -> server/index.ts
    const rel = importPath.replace(/^\.\/dist\//, "").replace(/\.js$/, ".ts");
    entrypoints.push(join(srcDir, rel));
  }
  return entrypoints;
}

function buildExternals(): string[] {
  const peer = Object.keys(pkg.peerDependencies ?? {});
  const runtime = Object.keys(pkg.dependencies ?? {});
  const node = builtinModules.flatMap((m) => [m, `node:${m}`]);
  return [...peer, ...runtime, ...node];
}

async function build(): Promise<boolean> {
  rmSync(distDir, { recursive: true, force: true });

  const entrypoints = resolveEntrypoints();
  const external = buildExternals();

  const result = await Bun.build({
    entrypoints,
    outdir: distDir,
    target: "node",
    format: "esm",
    root: srcDir,
    external,
  });

  if (!result.success) {
    console.error("Bun.build failed:");
    for (const message of result.logs) console.error(message);
    return false;
  }

  // Verify the three expected output files mirror src structure.
  const expected = ["index.js", "server/index.js", "lambda/index.js"];
  for (const rel of expected) {
    if (!(await Bun.file(join(distDir, rel)).exists())) {
      console.error(`Expected build output missing: dist/${rel}`);
      return false;
    }
  }

  // Emit declarations.
  const tsc = Bun.spawnSync(
    ["bunx", "tsc", "-p", join(pkgRoot, "tsconfig.build.json")],
    { cwd: pkgRoot, stdout: "inherit", stderr: "inherit" },
  );
  if (tsc.exitCode !== 0) {
    console.error("tsc declaration emit failed.");
    return false;
  }

  console.log("Build succeeded.");
  return true;
}

const isWatch = process.argv.includes("--watch");

if (isWatch) {
  let building = false;
  let queued = false;

  const run = async () => {
    if (building) {
      queued = true;
      return;
    }
    building = true;
    await build();
    building = false;
    if (queued) {
      queued = false;
      void run();
    }
  };

  await run();
  console.log("Watching src/ for changes...");
  watch(srcDir, { recursive: true }, () => {
    void run();
  });
} else {
  const ok = await build();
  process.exit(ok ? 0 : 1);
}

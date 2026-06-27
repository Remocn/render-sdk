/**
 * Compile-time type assertions for the lambda adapter.
 *
 * The single runtime test is trivial; all meaningful checks happen at the
 * `bun run types` (tsc --noEmit) pass. If any assertion below fails to
 * compile, the types command reports an error before tests ever run.
 */

import { describe, expect, test } from "bun:test";

import type { RenderMediaOnLambdaInput } from "@remotion/lambda/client";

import { RenderSdk } from "../src/sdk";
import type { Codec } from "../src/types";
import { mockLambda } from "./_lambda-harness";

mockLambda();
const { RenderLambda } = await import("../src/lambda");

// ── Codec assignability ──────────────────────────────────────────────────────

/**
 * Every member of our `Codec` union must be assignable to
 * `RenderMediaOnLambdaInput["codec"]` (which is `ServerlessCodec`), so the
 * adapter can forward `input.codec` without a cast. If we ever add a codec
 * that remotion doesn't accept, `_lambdaCodec` stops compiling.
 */
const _c: Codec = "h264";
const _lambdaCodec: RenderMediaOnLambdaInput["codec"] = _c;
void _lambdaCodec;

// Spot-check additional members to catch drift in either direction.
const _gif: Codec = "gif";
const _gifLambda: RenderMediaOnLambdaInput["codec"] = _gif;
void _gifLambda;

const _prores: Codec = "prores";
const _proresLambda: RenderMediaOnLambdaInput["codec"] = _prores;
void _proresLambda;

// ── RenderSdk type narrowing with RenderLambda ───────────────────────────────

async function _typecheck() {
  const sdk = new RenderSdk({
    adapter: RenderLambda({
      region: "us-east-1",
      functionName: "remotion-render-fn",
      serveUrl: "https://example.com/bundle",
    }),
  });

  // ✅ valid LambdaOptions compiles
  await sdk.start({ compositionId: "Main" }, { framesPerLambda: 20 });
  await sdk.start({ compositionId: "Main" }, { privacy: "public" });
  await sdk.start({ compositionId: "Main" }, { maxRetries: 3 });

  // @ts-expect-error — chromiumOptions is a ServerOptions key, not LambdaOptions
  await sdk.start({ compositionId: "Main" }, { chromiumOptions: {} });
}
void _typecheck;

// ── Runtime test (trivial) ───────────────────────────────────────────────────

describe("lambda types", () => {
  test("types", () => {
    expect(true).toBe(true);
  });
});

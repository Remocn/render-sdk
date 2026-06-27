import { describe, expect, test } from "bun:test";

import type { Codec as RemotionCodec } from "@remotion/renderer";

import type { Codec } from "../src/types";

/**
 * Compile-time guard: every member of our `Codec` union must be assignable to
 * remotion's `Codec`, so the server adapter can forward `input.codec` to
 * `renderMedia` without a cast. If we ever add a codec remotion doesn't accept,
 * `widenCodec` stops compiling and `bun run types` fails.
 */
const widenCodec = (codec: Codec): RemotionCodec => codec;

describe("Codec compatibility with @remotion/renderer", () => {
  test("our Codec union widens to remotion's Codec", () => {
    expect(widenCodec("h264")).toBe("h264");
    expect(widenCodec("vp9")).toBe("vp9");
    expect(widenCodec("prores")).toBe("prores");
  });
});

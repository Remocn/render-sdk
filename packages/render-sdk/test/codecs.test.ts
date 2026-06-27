import { describe, expect, test } from "bun:test";

import { CODEC_EXT, extForCodec } from "../src/codecs";
import type { Codec } from "../src/types";

describe("codec → ext map", () => {
  test("full map coverage", () => {
    expect(CODEC_EXT).toEqual({
      h264: "mp4",
      h265: "mp4",
      vp8: "webm",
      vp9: "webm",
      gif: "gif",
      prores: "mov",
      mp3: "mp3",
      aac: "aac",
      wav: "wav",
    });
  });

  test("every codec resolves to a non-empty ext", () => {
    const codecs: Codec[] = [
      "h264",
      "h265",
      "vp8",
      "vp9",
      "gif",
      "prores",
      "mp3",
      "aac",
      "wav",
    ];
    for (const codec of codecs) {
      expect(extForCodec(codec)).toBe(CODEC_EXT[codec]);
      expect(extForCodec(codec).length).toBeGreaterThan(0);
    }
  });

  test("defaults to h264 → mp4", () => {
    expect(extForCodec()).toBe("mp4");
    expect(extForCodec(undefined)).toBe("mp4");
  });
});

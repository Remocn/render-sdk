import { describe, expect, test } from "bun:test";

import { RenderError } from "../src/errors";

describe("RenderError", () => {
  test("is an instanceof Error and carries code", () => {
    const err = new RenderError("invalid_input", "bad input");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(RenderError);
    expect(err.code).toBe("invalid_input");
    expect(err.message).toBe("bad input");
    expect(err.name).toBe("RenderError");
  });

  test("propagates cause", () => {
    const cause = new Error("underlying");
    const err = new RenderError("render_failed", "wrapped", { cause });
    expect(err.cause).toBe(cause);
  });

  test("supports every documented code", () => {
    const codes = [
      "invalid_input",
      "render_failed",
      "timeout",
      "not_found",
      "version_mismatch",
      "adapter_error",
    ] as const;
    for (const code of codes) {
      expect(new RenderError(code, code).code).toBe(code);
    }
  });
});

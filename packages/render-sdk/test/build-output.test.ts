import { describe, expect, test } from "bun:test";

import { VERSION } from "../src/index";

describe("@remocn/render-sdk scaffold", () => {
  test("root export exposes a version placeholder", () => {
    expect(VERSION).toBe("0.0.0");
  });
});

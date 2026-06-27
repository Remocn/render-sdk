import { describe, expect, test } from "bun:test";

import { RenderError } from "../src/errors";
import {
  decodeHandle,
  encodeLambdaHandle,
  encodeServerHandle,
} from "../src/handle";

describe("handle round-trip", () => {
  test("server handle round-trips jobId", () => {
    const handle = encodeServerHandle("abc");
    expect(handle as string).toBe("s~abc");
    expect(decodeHandle(handle)).toEqual({ adapter: "server", jobId: "abc" });
  });

  test("lambda handle round-trips all fields", () => {
    const handle = encodeLambdaHandle({
      renderId: "r1",
      bucket: "my-bucket",
      ext: "mp4",
    });
    expect(handle as string).toBe("l~r1~my-bucket~mp4");
    expect(decodeHandle(handle)).toEqual({
      adapter: "lambda",
      renderId: "r1",
      bucket: "my-bucket",
      ext: "mp4",
    });
  });

  test("bucket containing '.' survives round-trip", () => {
    const handle = encodeLambdaHandle({
      renderId: "r1",
      bucket: "remotionlambda-useast1.example",
      ext: "mp4",
    });
    expect(decodeHandle(handle)).toEqual({
      adapter: "lambda",
      renderId: "r1",
      bucket: "remotionlambda-useast1.example",
      ext: "mp4",
    });
  });
});

describe("handle rejection", () => {
  const garbage = [
    "nonsense",
    "",
    "s~",
    "s~ ",
    "s~a~b", // server with extra segment
    "l~r~b", // lambda missing a field
    "l~r~b~mp4~extra", // lambda with extra segment
    "l~~b~mp4", // empty renderId
    "l~r~ ~mp4", // whitespace bucket
    "x~whatever", // unknown tag
  ];

  for (const input of garbage) {
    test(`rejects ${JSON.stringify(input)} with RenderError not_found`, () => {
      let caught: unknown;
      try {
        decodeHandle(input);
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(RenderError);
      expect((caught as RenderError).code).toBe("not_found");
    });
  }
});

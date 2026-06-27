import { describe, expect, test } from "bun:test";

import { RenderError } from "../src/errors";
import { encodeServerHandle } from "../src/handle";
import { InMemoryStore } from "../src/store/in-memory";
import type { RenderRecord } from "../src/store/types";

function sampleRecord(overrides: Partial<RenderRecord> = {}): RenderRecord {
  return {
    status: "queued",
    progress: 0,
    codec: "h264",
    createdAt: 1_700_000_000_000,
    meta: { compositionId: "Main" },
    ...overrides,
  };
}

describe("InMemoryStore", () => {
  test("create then get returns the same record", async () => {
    const store = InMemoryStore();
    const handle = encodeServerHandle("job-1");
    const record = sampleRecord();

    await store.create(handle, record);
    expect(await store.get(handle)).toEqual(record);
  });

  test("createdAt and meta round-trip", async () => {
    const store = InMemoryStore();
    const handle = encodeServerHandle("job-meta");
    const record = sampleRecord({
      createdAt: 1_234,
      meta: { userId: 7, nested: { a: 1 } },
    });

    await store.create(handle, record);
    const got = await store.get(handle);
    expect(got?.createdAt).toBe(1_234);
    expect(got?.meta).toEqual({ userId: 7, nested: { a: 1 } });
  });

  test("update applies a partial patch and preserves untouched fields", async () => {
    const store = InMemoryStore();
    const handle = encodeServerHandle("job-2");
    await store.create(handle, sampleRecord());

    await store.update(handle, { status: "rendering", progress: 0.5 });

    const got = await store.get(handle);
    expect(got).toEqual(
      sampleRecord({ status: "rendering", progress: 0.5 }),
    );
  });

  test("update on an unknown handle throws RenderError not_found", async () => {
    const store = InMemoryStore();
    const handle = encodeServerHandle("missing");

    let caught: unknown;
    try {
      await store.update(handle, { progress: 1 });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(RenderError);
    expect((caught as RenderError).code).toBe("not_found");
  });

  test("get on an unknown handle resolves null", async () => {
    const store = InMemoryStore();
    expect(await store.get(encodeServerHandle("nope"))).toBeNull();
  });

  test("delete removes the record and is idempotent", async () => {
    const store = InMemoryStore();
    const handle = encodeServerHandle("job-3");
    await store.create(handle, sampleRecord());

    await store.delete(handle);
    expect(await store.get(handle)).toBeNull();

    // double-delete does not throw
    await store.delete(handle);
    expect(await store.get(handle)).toBeNull();
  });

  test("create overwrites an existing handle without throwing", async () => {
    const store = InMemoryStore();
    const handle = encodeServerHandle("job-4");
    await store.create(handle, sampleRecord({ progress: 0 }));
    await store.create(handle, sampleRecord({ progress: 0.9, status: "rendering" }));

    const got = await store.get(handle);
    expect(got?.progress).toBe(0.9);
    expect(got?.status).toBe("rendering");
  });

  test("stores are independent instances", async () => {
    const a = InMemoryStore();
    const b = InMemoryStore();
    const handle = encodeServerHandle("shared");
    await a.create(handle, sampleRecord());
    expect(await b.get(handle)).toBeNull();
  });
});

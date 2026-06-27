import { RenderError } from "../errors";
import type { RenderHandle } from "../types";
import type { RenderRecord, StateStore } from "./types";

/**
 * The default in-process {@link StateStore}, backed by a `Map` keyed by the raw
 * handle string. No TTL or sweep — the consumer owns cleanup via `delete`.
 *
 * Records are stored by reference; callers should treat returned records as
 * read-only snapshots and go through `update` to mutate persisted state.
 */
export function InMemoryStore(): StateStore {
  const records = new Map<string, RenderRecord>();

  return {
    async create(handle: RenderHandle, initial: RenderRecord): Promise<void> {
      records.set(handle, initial);
    },

    async get(handle: RenderHandle): Promise<RenderRecord | null> {
      return records.get(handle) ?? null;
    },

    async update(
      handle: RenderHandle,
      patch: Partial<RenderRecord>,
    ): Promise<void> {
      const existing = records.get(handle);
      if (existing === undefined) {
        throw new RenderError("not_found", `No render record for handle: ${handle}`);
      }
      records.set(handle, { ...existing, ...patch });
    },

    async delete(handle: RenderHandle): Promise<void> {
      records.delete(handle);
    },
  };
}

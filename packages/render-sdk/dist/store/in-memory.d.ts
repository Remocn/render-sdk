import type { StateStore } from "./types";
/**
 * The default in-process {@link StateStore}, backed by a `Map` keyed by the raw
 * handle string. No TTL or sweep — the consumer owns cleanup via `delete`.
 *
 * Records are stored by reference; callers should treat returned records as
 * read-only snapshots and go through `update` to mutate persisted state.
 */
export declare function InMemoryStore(): StateStore;

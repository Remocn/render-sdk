import type { Codec, RenderHandle, RenderStatus } from "../types";
/**
 * The persisted progress record for a single render. The server adapter writes
 * these; `getState` reads them. Lambda does not use the store (it queries AWS
 * directly), so this is the server-side source of truth.
 */
export type RenderRecord = {
    status: RenderStatus;
    /** Normalized progress in the range 0..1. */
    progress: number;
    error?: string;
    /** Output codec — resolved to an extension for `getUrl` / `download`. */
    codec: Codec;
    createdAt: number;
    /** Opaque consumer data; the SDK is domain-agnostic about its contents. */
    meta?: Record<string, unknown>;
};
/**
 * Pluggable progress store. The default is {@link InMemoryStore}; consumers can
 * swap in Redis/SQL without touching the SDK. Every method is async so the SPI
 * stays uniform across sync (in-memory) and remote backends.
 */
export interface StateStore {
    /** Insert the initial record. Overwrites if the handle already exists. */
    create(handle: RenderHandle, initial: RenderRecord): Promise<void>;
    /** Resolve the record, or `null` when the handle is unknown. */
    get(handle: RenderHandle): Promise<RenderRecord | null>;
    /** Merge a partial patch. Throws `RenderError("not_found")` if unknown. */
    update(handle: RenderHandle, patch: Partial<RenderRecord>): Promise<void>;
    /** Remove the record. Idempotent — deleting an unknown handle is a no-op. */
    delete(handle: RenderHandle): Promise<void>;
}

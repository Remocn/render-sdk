import type { RenderHandle, RenderInput, RenderState } from "./types";

/**
 * The backend SPI. Each backend (server, lambda) implements this interface;
 * the SDK and consumers program against it. `TOptions` is the adapter-specific
 * start options shape, surfaced to callers via {@link OptionsOf}.
 */
export interface RenderAdapter<TOptions> {
  start(input: RenderInput, options?: TOptions): Promise<RenderHandle>;
  getState(handle: RenderHandle): Promise<RenderState>;
  getUrl(handle: RenderHandle): Promise<string>;
  download(handle: RenderHandle): Promise<ReadableStream>;
}

/** Extract the start-options type of a concrete {@link RenderAdapter}. */
export type OptionsOf<A> = A extends RenderAdapter<infer O> ? O : never;

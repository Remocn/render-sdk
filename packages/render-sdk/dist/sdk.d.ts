import type { OptionsOf, RenderAdapter } from "./adapter";
import type { StateStore } from "./store/types";
import type { RenderHandle, RenderInput, RenderState, WaitOptions } from "./types";
/** Configuration for {@link RenderSdk}. */
export type RenderSdkConfig<A extends RenderAdapter<any>> = {
    adapter: A;
    /**
     * Optional progress store. Held for adapters that need it (the server adapter
     * reads/writes it); the SDK itself never touches it.
     */
    store?: StateStore;
};
/**
 * The public facade consumers instantiate: `new RenderSdk({ adapter })`.
 *
 * Every method is a thin delegation to the configured adapter, so the same
 * application code drives any backend. `start`'s options argument auto-narrows
 * to the adapter's own options type via {@link OptionsOf} — passing a
 * wrong-shape option is a compile error, not a runtime surprise.
 */
export declare class RenderSdk<A extends RenderAdapter<any>> {
    readonly adapter: A;
    /** The store passed at construction, retained for adapters that use it. */
    readonly store?: StateStore;
    constructor(config: RenderSdkConfig<A>);
    start(input: RenderInput, options?: OptionsOf<A>): Promise<RenderHandle>;
    getState(handle: RenderHandle): Promise<RenderState>;
    getUrl(handle: RenderHandle): Promise<string>;
    download(handle: RenderHandle): Promise<ReadableStream>;
    waitForCompletion(handle: RenderHandle, opts?: WaitOptions): Promise<RenderState>;
}

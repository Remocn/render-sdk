export const VERSION = "0.0.0";

export type { OptionsOf, RenderAdapter } from "./adapter";
export { CODEC_EXT, extForCodec } from "./codecs";
export { RenderError } from "./errors";
export {
  type DecodedHandle,
  decodeHandle,
  encodeLambdaHandle,
  encodeServerHandle,
} from "./handle";
export { RenderSdk, type RenderSdkConfig } from "./sdk";

export { InMemoryStore } from "./store/in-memory";
export type { RenderRecord, StateStore } from "./store/types";
export type {
  Codec,
  PixelFormat,
  RenderHandle,
  RenderInput,
  RenderState,
  RenderStatus,
  WaitOptions,
} from "./types";
export { waitForCompletion } from "./wait";

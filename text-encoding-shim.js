// text-encoding-shim polyfill - browsers already have these natively
export const TextEncoder = globalThis.TextEncoder;
export const TextDecoder = globalThis.TextDecoder;
export default { TextEncoder: globalThis.TextEncoder, TextDecoder: globalThis.TextDecoder };

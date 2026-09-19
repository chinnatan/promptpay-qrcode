// Optional QR-image helpers. These wrap the `qrcode` npm package, which is a
// PEER dependency: the core payload generators stay zero-dependency, and
// `qrcode` is only required the moment one of these functions is called.
//
//   bun add qrcode
//
// All functions take a payload string (from generatePromptPay / generateKShopQR
// / generateBillPayment) plus an optional `options` object forwarded to the
// underlying `qrcode` library (e.g. { width, margin, color, errorCorrectionLevel }).

// Minimal structural type for the lazily-loaded `qrcode` package — `qrcode` is
// an optional peer, so we must not import it at module level (top-level
// `import` would compile to a require at load time and break zero-dep installs).
interface QrcodeLib {
  toFile(path: string, text: string, opts: Record<string, unknown>): Promise<void>;
  toDataURL(text: string, opts: Record<string, unknown>): Promise<string>;
  toBuffer(text: string, opts: Record<string, unknown>): Promise<Buffer>;
  toString(text: string, opts: Record<string, unknown>): Promise<string>;
}

export type QrRenderOptions = Record<string, unknown>;

/**
 * Lazily load the `qrcode` package, throwing a helpful error if it's missing.
 */
function loadQrcode(): QrcodeLib {
  try {
    return require('qrcode') as QrcodeLib;
  } catch (err) {
    throw new Error(
      "The 'qrcode' package is required for image generation. Install it with: bun add qrcode"
    );
  }
}

// Each wrapper is `async` so a missing-`qrcode` error surfaces as a promise
// rejection (catchable with .catch / try-await), not a synchronous throw.

/**
 * Render a payload to a PNG file on disk.
 */
export async function toFile(filePath: string, payload: string, options: QrRenderOptions = {}): Promise<void> {
  return loadQrcode().toFile(filePath, payload, options);
}

/**
 * Render a payload to a data URL (PNG by default), e.g. for an <img src>.
 */
export async function toDataURL(payload: string, options: QrRenderOptions = {}): Promise<string> {
  return loadQrcode().toDataURL(payload, options);
}

/**
 * Render a payload to a PNG image Buffer.
 */
export async function toBuffer(payload: string, options: QrRenderOptions = {}): Promise<Buffer> {
  return loadQrcode().toBuffer(payload, Object.assign({ type: 'png' }, options));
}

/**
 * Render a payload to an SVG string.
 */
export async function toSVG(payload: string, options: QrRenderOptions = {}): Promise<string> {
  return loadQrcode().toString(payload, Object.assign({ type: 'svg' }, options));
}

/**
 * Render a payload as a scannable QR in the terminal (UTF-8 blocks).
 */
export async function toTerminal(payload: string, options: QrRenderOptions = {}): Promise<string> {
  return loadQrcode().toString(payload, Object.assign({ type: 'terminal', small: true }, options));
}

export const image = { toFile, toDataURL, toBuffer, toSVG, toTerminal };

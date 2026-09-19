'use strict';

// Optional QR-image helpers. These wrap the `qrcode` npm package, which is a
// PEER dependency: the core payload generators stay zero-dependency, and
// `qrcode` is only required the moment one of these functions is called.
//
//   bun add qrcode
//
// All functions take a payload string (from generatePromptPay / generateKShopQR
// / generateBillPayment) plus an optional `options` object forwarded to the
// underlying `qrcode` library (e.g. { width, margin, color, errorCorrectionLevel }).

/**
 * Lazily load the `qrcode` package, throwing a helpful error if it's missing.
 * @returns {import('qrcode')}
 */
function loadQrcode() {
  try {
    return require('qrcode');
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
 * @param {string} filePath Destination path (e.g. './qr.png').
 * @param {string} payload  QR payload string.
 * @param {object} [options] Options forwarded to qrcode.toFile.
 * @returns {Promise<void>}
 */
async function toFile(filePath, payload, options = {}) {
  return loadQrcode().toFile(filePath, payload, options);
}

/**
 * Render a payload to a data URL (PNG by default), e.g. for an <img src>.
 * @param {string} payload QR payload string.
 * @param {object} [options] Options forwarded to qrcode.toDataURL.
 * @returns {Promise<string>} data: URL string.
 */
async function toDataURL(payload, options = {}) {
  return loadQrcode().toDataURL(payload, options);
}

/**
 * Render a payload to a PNG image Buffer.
 * @param {string} payload QR payload string.
 * @param {object} [options] Options forwarded to qrcode.toBuffer.
 * @returns {Promise<Buffer>}
 */
async function toBuffer(payload, options = {}) {
  return loadQrcode().toBuffer(payload, Object.assign({ type: 'png' }, options));
}

/**
 * Render a payload to an SVG string.
 * @param {string} payload QR payload string.
 * @param {object} [options] Options forwarded to qrcode.toString.
 * @returns {Promise<string>} SVG markup.
 */
async function toSVG(payload, options = {}) {
  return loadQrcode().toString(payload, Object.assign({ type: 'svg' }, options));
}

/**
 * Render a payload as a scannable QR in the terminal (UTF-8 blocks).
 * @param {string} payload QR payload string.
 * @param {object} [options] Options forwarded to qrcode.toString.
 * @returns {Promise<string>} The terminal-art string (also handy to print).
 */
async function toTerminal(payload, options = {}) {
  return loadQrcode().toString(payload, Object.assign({ type: 'terminal', small: true }, options));
}

module.exports = { toFile, toDataURL, toBuffer, toSVG, toTerminal };

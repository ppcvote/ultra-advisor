// Pure helpers for Pin webhook integration — no Firebase deps, fully testable.
const crypto = require('crypto');

const PIN_TOKEN_REGEX = /^[0-9a-fA-F]{8}$/;

/**
 * @param {unknown} token
 * @returns {boolean}
 */
function validatePinToken(token) {
  return typeof token === 'string' && PIN_TOKEN_REGEX.test(token);
}

/**
 * Compute X-Pin-Signature header value.
 * Signs bodyBytes directly — caller must NOT re-serialize after calling this.
 * Key order / whitespace differences in the serialized string would break the hash.
 * @param {string} secret
 * @param {Buffer|string} bodyBytes  raw bytes to sign
 * @returns {string} "sha256=<64 hex chars>"
 */
function computePinSignature(secret, bodyBytes) {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(bodyBytes).digest('hex');
}

module.exports = { validatePinToken, computePinSignature, PIN_TOKEN_REGEX };

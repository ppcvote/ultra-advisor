// Unit tests for Pin webhook pure helpers
// Run: node --test pin.test.js
// (Node 20 built-in test runner, no extra deps)

const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { validatePinToken, computePinSignature } = require('./pin-helpers');

// ============================================================
// Token validation
// ============================================================

test('validatePinToken: valid 8-char lowercase hex', () => {
  assert.ok(validatePinToken('a1b2c3d4'));
});
test('validatePinToken: valid 8-char uppercase hex', () => {
  assert.ok(validatePinToken('AABBCCDD'));
});
test('validatePinToken: valid all zeros', () => {
  assert.ok(validatePinToken('00000000'));
});
test('validatePinToken: valid all f', () => {
  assert.ok(validatePinToken('ffffffff'));
});
test('validatePinToken: rejects 7-char', () => {
  assert.equal(validatePinToken('a1b2c3d'), false);
});
test('validatePinToken: rejects 9-char', () => {
  assert.equal(validatePinToken('a1b2c3d45'), false);
});
test('validatePinToken: rejects empty string', () => {
  assert.equal(validatePinToken(''), false);
});
test('validatePinToken: rejects non-hex char g', () => {
  assert.equal(validatePinToken('a1b2c3g4'), false);
});
test('validatePinToken: rejects space', () => {
  assert.equal(validatePinToken('a1 2c3d4'), false);
});
test('validatePinToken: rejects null', () => {
  assert.equal(validatePinToken(null), false);
});
test('validatePinToken: rejects undefined', () => {
  assert.equal(validatePinToken(undefined), false);
});
test('validatePinToken: rejects number type', () => {
  assert.equal(validatePinToken(12345678), false);
});

// ============================================================
// Signature computation
// ============================================================

test('computePinSignature: format is sha256= + 64 lowercase hex chars', () => {
  const sig = computePinSignature('secret', Buffer.from('hello'));
  assert.ok(sig.startsWith('sha256='), 'missing sha256= prefix');
  assert.equal(sig.length, 71); // 7 + 64
  assert.ok(/^sha256=[0-9a-f]{64}$/.test(sig), `invalid format: ${sig}`);
});

test('computePinSignature: deterministic for same input', () => {
  const body = Buffer.from(JSON.stringify({ pin_user_id: 'tg:123', data: { text: 'test' } }));
  assert.equal(computePinSignature('key', body), computePinSignature('key', body));
});

test('computePinSignature: different secret → different sig', () => {
  const body = Buffer.from('{"test":true}');
  assert.notEqual(computePinSignature('secret_a', body), computePinSignature('secret_b', body));
});

test('computePinSignature: different body → different sig', () => {
  assert.notEqual(
    computePinSignature('key', Buffer.from('body_one')),
    computePinSignature('key', Buffer.from('body_two'))
  );
});

test('computePinSignature: matches expected HMAC-SHA256 reference value', () => {
  const secret = 'webhook_secret';
  const bodyStr = '{"pin_user_id":"tg:456","data":{"date":"2026-01-01","text":"每日金句"}}';
  const bodyBytes = Buffer.from(bodyStr);
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(bodyBytes).digest('hex');
  assert.equal(computePinSignature(secret, bodyBytes), expected);
});

test('computePinSignature: Buffer and string input produce identical sig', () => {
  const secret = 'test_key';
  const bodyStr = '{"hello":"world"}';
  assert.equal(
    computePinSignature(secret, bodyStr),
    computePinSignature(secret, Buffer.from(bodyStr))
  );
});

test('computePinSignature: key order matters (raw bytes, not re-serialized)', () => {
  // Two JSON strings with same keys in different order → different byte sequences → different sigs.
  // Confirms the function signs raw bytes without re-parsing/re-serializing.
  const secret = 'key';
  const body1 = Buffer.from('{"a":1,"b":2}');
  const body2 = Buffer.from('{"b":2,"a":1}');
  assert.notEqual(computePinSignature(secret, body1), computePinSignature(secret, body2));
});

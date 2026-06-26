/**
 * scripts/lib/tii-diff.test.js
 *
 * Unit tests for tii-diff.cjs classifier.
 * Run: node --test scripts/lib/tii-diff.test.js
 *
 * No npm deps. Uses built-in node:test + node:assert.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { classifyDiff, diffSummary } = require('./tii-diff.cjs');

// ----- fixtures -----

function makeCrawled(overrides = {}) {
  return {
    company: 'cathay',
    productCode: 'ABC123',
    companyShortName: '國泰',
    pdfSha256: 'sha-v1',
    status: 'active',
    endDateRoc: null,
    ...overrides,
  };
}

function makePrior(overrides = {}) {
  return {
    pdfSha256: 'sha-v1',
    version: 1,
    companyShortName: '國泰',
    status: 'active',
    ...overrides,
  };
}

// ----- NEW -----

test('classifyDiff: NEW when key not in existing map', () => {
  const crawled = makeCrawled();
  const existing = new Map();
  const diff = classifyDiff(crawled, existing);

  assert.equal(diff.kind, 'NEW');
  assert.equal(diff.key, 'cathay_ABC123');
  assert.deepEqual(diff.crawled, crawled);
});

// ----- REVISION -----

test('classifyDiff: REVISION when pdfSha256 differs', () => {
  const crawled = makeCrawled({ pdfSha256: 'sha-v2' });
  const existing = new Map([
    ['cathay_ABC123', makePrior({ pdfSha256: 'sha-v1', version: 1 })],
  ]);
  const diff = classifyDiff(crawled, existing);

  assert.equal(diff.kind, 'REVISION');
  assert.equal(diff.key, 'cathay_ABC123');
  assert.deepEqual(diff.from, { sha: 'sha-v1', version: 1 });
  assert.deepEqual(diff.to,   { sha: 'sha-v2', version: 2 });
  assert.equal(diff.crawled.pdfSha256, 'sha-v2');
});

test('classifyDiff: REVISION defaults prior.version to 1 when missing', () => {
  const crawled = makeCrawled({ pdfSha256: 'sha-v9' });
  const prior = makePrior({ pdfSha256: 'sha-v8' });
  delete prior.version;
  const existing = new Map([['cathay_ABC123', prior]]);

  const diff = classifyDiff(crawled, existing);
  assert.equal(diff.kind, 'REVISION');
  assert.deepEqual(diff.from, { sha: 'sha-v8', version: 1 });
  assert.deepEqual(diff.to,   { sha: 'sha-v9', version: 2 });
});

// ----- DISCONTINUED -----

test('classifyDiff: DISCONTINUED when active → discontinued (same sha)', () => {
  const crawled = makeCrawled({
    status: 'discontinued',
    endDateRoc: '115/06/30',
  });
  const existing = new Map([
    ['cathay_ABC123', makePrior({ status: 'active' })],
  ]);
  const diff = classifyDiff(crawled, existing);

  assert.equal(diff.kind, 'DISCONTINUED');
  assert.equal(diff.key, 'cathay_ABC123');
  assert.equal(diff.endDate, '115/06/30');
});

// ----- COMPANY_RENAME -----

test('classifyDiff: COMPANY_RENAME when companyShortName changes (same sha, same status)', () => {
  const crawled = makeCrawled({ companyShortName: '國泰人壽' });
  const existing = new Map([
    ['cathay_ABC123', makePrior({ companyShortName: '國泰' })],
  ]);
  const diff = classifyDiff(crawled, existing);

  assert.equal(diff.kind, 'COMPANY_RENAME');
  assert.equal(diff.key, 'cathay_ABC123');
  assert.equal(diff.from, '國泰');
  assert.equal(diff.to,   '國泰人壽');
});

// ----- UNCHANGED -----

test('classifyDiff: UNCHANGED when everything matches', () => {
  const crawled = makeCrawled();
  const existing = new Map([['cathay_ABC123', makePrior()]]);
  const diff = classifyDiff(crawled, existing);

  assert.equal(diff.kind, 'UNCHANGED');
  assert.equal(diff.key, 'cathay_ABC123');
});

// ----- precedence sanity -----

test('classifyDiff: REVISION wins over DISCONTINUED when both occur', () => {
  const crawled = makeCrawled({
    pdfSha256: 'sha-v2',
    status: 'discontinued',
    endDateRoc: '115/06/30',
  });
  const existing = new Map([
    ['cathay_ABC123', makePrior({ pdfSha256: 'sha-v1', status: 'active' })],
  ]);
  const diff = classifyDiff(crawled, existing);
  assert.equal(diff.kind, 'REVISION');
});

test('classifyDiff: empty crawled.companyShortName does not trigger rename', () => {
  const crawled = makeCrawled({ companyShortName: '' });
  const existing = new Map([
    ['cathay_ABC123', makePrior({ companyShortName: '國泰' })],
  ]);
  const diff = classifyDiff(crawled, existing);
  assert.equal(diff.kind, 'UNCHANGED');
});

// ----- diffSummary -----

test('diffSummary: counts by kind and total', () => {
  const items = [
    { kind: 'NEW', key: 'a' },
    { kind: 'NEW', key: 'b' },
    { kind: 'REVISION', key: 'c' },
    { kind: 'DISCONTINUED', key: 'd' },
    { kind: 'COMPANY_RENAME', key: 'e' },
    { kind: 'UNCHANGED', key: 'f' },
    { kind: 'UNCHANGED', key: 'g' },
  ];
  const s = diffSummary(items);
  assert.equal(s.NEW, 2);
  assert.equal(s.REVISION, 1);
  assert.equal(s.DISCONTINUED, 1);
  assert.equal(s.COMPANY_RENAME, 1);
  assert.equal(s.UNCHANGED, 2);
  assert.equal(s.total, 7);
});

test('diffSummary: handles empty / non-array / unknown kinds gracefully', () => {
  assert.equal(diffSummary([]).total, 0);
  assert.equal(diffSummary(null).total, 0);
  assert.equal(diffSummary(undefined).total, 0);
  assert.equal(diffSummary([{ kind: 'BOGUS' }, null, {}]).total, 0);
});

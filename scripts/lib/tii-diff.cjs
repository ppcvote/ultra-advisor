/**
 * scripts/lib/tii-diff.cjs
 *
 * Diff classifier for TII monthly crawl results.
 *
 * Compares freshly crawled product rows against the existing Firestore
 * snapshot (keyed by `${company}_${productCode}`) and emits one of five
 * kinds: NEW / REVISION / DISCONTINUED / COMPANY_RENAME / UNCHANGED.
 *
 * Pure function, no side effects, no wall-clock reads, no npm deps.
 * Suitable for unit testing in isolation.
 */

'use strict';

/**
 * Classify a single crawled row vs existing snapshot.
 *
 * @param {object} crawled - freshly crawled product row, expected fields:
 *   { company, productCode, companyShortName, pdfSha256, status, endDateRoc }
 * @param {Map<string, object>} existing - keyed by `${company}_${productCode}`,
 *   value shape: { pdfSha256, version, companyShortName, status, ... }
 * @returns {object} diff record. Always has { kind, key }.
 *   - NEW:            { kind, key, crawled }
 *   - REVISION:       { kind, key, from: {sha,version}, to: {sha,version}, crawled }
 *   - DISCONTINUED:   { kind, key, endDate }
 *   - COMPANY_RENAME: { kind, key, from, to }
 *   - UNCHANGED:      { kind, key }
 *
 * Precedence (when multiple changes occur simultaneously, only one kind is
 * emitted): REVISION > DISCONTINUED > COMPANY_RENAME > UNCHANGED.
 * NEW short-circuits everything (no prior to compare against).
 */
function classifyDiff(crawled, existing) {
  const key = crawled.company + '_' + crawled.productCode;
  const prior = existing.get(key);

  if (!prior) {
    return { kind: 'NEW', key, crawled };
  }

  if (prior.pdfSha256 !== crawled.pdfSha256) {
    const priorVersion = prior.version || 1;
    return {
      kind: 'REVISION',
      key,
      from: { sha: prior.pdfSha256, version: priorVersion },
      to:   { sha: crawled.pdfSha256, version: priorVersion + 1 },
      crawled,
    };
  }

  if (prior.status === 'active' && crawled.status === 'discontinued') {
    return { kind: 'DISCONTINUED', key, endDate: crawled.endDateRoc };
  }

  if (
    prior.companyShortName !== crawled.companyShortName &&
    crawled.companyShortName
  ) {
    return {
      kind: 'COMPANY_RENAME',
      key,
      from: prior.companyShortName,
      to: crawled.companyShortName,
    };
  }

  return { kind: 'UNCHANGED', key };
}

/**
 * Aggregate diff records into kind counts.
 *
 * @param {Array<object>} items - array of classifyDiff() outputs
 * @returns {object} { NEW, REVISION, DISCONTINUED, COMPANY_RENAME, UNCHANGED, total }
 */
function diffSummary(items) {
  const counts = {
    NEW: 0,
    REVISION: 0,
    DISCONTINUED: 0,
    COMPANY_RENAME: 0,
    UNCHANGED: 0,
    total: 0,
  };
  if (!Array.isArray(items)) return counts;
  for (const it of items) {
    if (!it || !it.kind) continue;
    if (counts[it.kind] === undefined) continue;
    counts[it.kind] += 1;
    counts.total += 1;
  }
  return counts;
}

module.exports = { classifyDiff, diffSummary };

// Generate api/_daily-quotes.json from the front-end source of truth
// (src/data/dailyQuotes.ts). Run when the quote list changes:
//   node --import tsx scripts/gen-quotes-json.mjs
// The API function reads the JSON (same-dir) instead of importing across
// ../src, which @vercel/node fails to bundle (FUNCTION_INVOCATION_FAILED).
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { dailyQuotes } from '../src/data/dailyQuotes.ts';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', 'api', '_daily-quotes.json');
writeFileSync(out, JSON.stringify(dailyQuotes.map((q) => q.text)), 'utf-8');
console.log(`wrote ${dailyQuotes.length} quotes -> ${out}`);

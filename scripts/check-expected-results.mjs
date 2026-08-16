/**
 * Compares a Playwright JSON run against ci/expected-results.json and decides
 * whether CI goes red.
 *
 * WHY THIS EXISTS. test.fail() was removed from the suite by team decision on
 * 13 August, because it made Playwright print "passed" for a procedure whose
 * assertions failed, contradicting the Defect Log. Without it, Playwright's
 * exit code cannot distinguish "this defect is known and recorded" from "this
 * just broke" — every run with a confirmed defect exits 1. This script draws
 * that distinction from a declared baseline instead, so the build is red only
 * where reality diverges from the recorded findings.
 *
 * It also catches what test.fail() never could: an UNEXPECTED PASS. A-004
 * permits store content to change without notice and the suite runs against
 * live production, so a defect being silently fixed is a real event that has
 * to reach a human.
 *
 * Usage:
 *   node scripts/check-expected-results.mjs <results.json> --scope smoke
 *
 * Exit 0 when the run agrees with the baseline, 1 otherwise.
 */

import { readFileSync, appendFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Writes the verdict to GitHub's job summary, so the result is readable on the
 * run page itself. Without this the only way to see which procedure diverged
 * is to download and unzip the report artefact, which nobody does for a
 * routine check. No-ops outside CI.
 */
function summary(markdown) {
  const file = process.env.GITHUB_STEP_SUMMARY;
  if (!file) return;
  try {
    appendFileSync(file, markdown + '\n');
  } catch {
    /* the summary is a convenience; never fail a run over it */
  }
}

const HERE = dirname(fileURLToPath(import.meta.url));
const MANIFEST_PATH = resolve(HERE, '..', 'ci', 'expected-results.json');
const TP_PATTERN = /TP-\d{2}-\d{3}/;

const [, , resultsArg, ...rest] = process.argv;
const scopeIndex = rest.indexOf('--scope');
const scope = scopeIndex === -1 ? null : rest[scopeIndex + 1];

const problems = [];
const lines = [];

function fatal(message, detail) {
  console.error(`\nFAIL  ${message}`);
  if (detail) console.error(`      ${detail}`);
  summary(`## Expected-results check\n\n**FAILED — ${message}**\n\n${detail ?? ''}`);
  process.exit(1);
}

if (!resultsArg) {
  fatal('no results file given', 'usage: node scripts/check-expected-results.mjs <results.json> [--scope <name>]');
}

/**
 * Check 1 — the results file is present and parseable.
 *
 * This is the single most likely real-world failure: Playwright crashed, hit
 * the per-test timeout, or was served a Cloudflare interstitial before it
 * could write JSON. It must be loud. Treating a missing file as "nothing to
 * compare, therefore fine" would turn the worst outcome into a green build.
 */
let report;
try {
  report = JSON.parse(readFileSync(resolve(process.cwd(), resultsArg), 'utf8'));
} catch (error) {
  fatal(
    'results file missing or unparseable',
    `${resultsArg} — ${error.message}. Playwright most likely crashed, timed out or was ` +
      'blocked before writing its report. Check the run log and the uploaded artefacts.',
  );
}

let manifest;
try {
  manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
} catch (error) {
  fatal('ci/expected-results.json missing or unparseable', error.message);
}

/** Walk the nested suite tree; Playwright nests suites per file and per describe. */
function collectTests(suite, out) {
  for (const spec of suite.specs ?? []) {
    for (const test of spec.tests ?? []) {
      const status = test.results?.[test.results.length - 1]?.status ?? 'unknown';
      out.push({
        title: spec.title,
        status,
        annotations: (test.annotations ?? []).map((a) => a.type),
      });
    }
  }
  for (const child of suite.suites ?? []) collectTests(child, out);
}

const actualTests = [];
for (const suite of report.suites ?? []) collectTests(suite, actualTests);

if (actualTests.length === 0) {
  fatal(
    'the run contains no tests',
    'Playwright produced a report with zero results. A filter that matched nothing, or a ' +
      'collection error — either way nothing was verified.',
  );
}

/** Index the run by TP identifier, taken from the test title. */
const actualByTp = new Map();
for (const test of actualTests) {
  const id = test.title.match(TP_PATTERN)?.[0];
  if (!id) {
    problems.push({
      id: test.title,
      message: 'test title carries no TP-xx-xxx identifier, so it cannot be matched to the baseline',
    });
    continue;
  }
  actualByTp.set(id, test);
}

const declared = Object.entries(manifest).filter(([id]) => TP_PATTERN.test(id));
const declaredIds = new Set(declared.map(([id]) => id));

/**
 * Check 2 — run to manifest. Anything executed must be declared, so new work
 * cannot slip through the gate unverified.
 */
for (const id of actualByTp.keys()) {
  if (!declaredIds.has(id)) {
    problems.push({
      id,
      message: 'ran but is not declared in ci/expected-results.json',
      hint: 'Add an entry stating its expected outcome, or remove it from this run.',
    });
  }
}

/**
 * Check 3 — manifest to run. Without this, a renamed or deleted spec silently
 * stops being checked and the gate keeps reporting green over a hole.
 */
if (scope) {
  for (const [id, entry] of declared) {
    const inScope = (entry.scope ?? []).includes(scope);
    if (inScope && !actualByTp.has(id)) {
      problems.push({
        id,
        message: `is declared in scope "${scope}" but did not run`,
        hint: 'The spec may have been renamed, deleted, or filtered out of the run command.',
      });
    }
  }
}

/** Check 4 — status agreement, per declared procedure that actually ran. */
for (const [id, entry] of declared) {
  const actual = actualByTp.get(id);
  if (!actual) continue;

  const isBlocked = actual.annotations.includes('blocked');
  const passed = actual.status === 'passed';

  if (entry.expect === 'pass') {
    if (!passed) {
      problems.push({
        id,
        message: `expected pass, got ${actual.status}`,
        hint: 'A procedure with no known defect stopped passing. This is a genuine regression, or the store changed.',
      });
    } else if (isBlocked) {
      problems.push({
        id,
        message: 'expected pass, but the run carries a "blocked" annotation',
        hint: 'Either the procedure has been reclassified as blocked, or the baseline is out of date.',
      });
    }
  } else if (entry.expect === 'blocked') {
    if (!passed) {
      problems.push({
        id,
        message: `expected blocked (which runs green), got ${actual.status}`,
        hint: `${entry.assumption ?? 'The assumption'} may no longer hold, or the block-condition assertion failed. A blocked procedure executes in full and should not fail.`,
      });
    } else if (!isBlocked) {
      problems.push({
        id,
        message: 'expected blocked, but the run carries no "blocked" annotation',
        hint: `The annotation naming ${entry.assumption ?? 'the assumption'} has been removed from the spec. Blocked status must stay visible in the report.`,
      });
    }
  } else if (entry.expect === 'fail') {
    if (passed) {
      problems.push({
        id,
        message: 'expected fail, got passed',
        hint: `${entry.defect ?? 'The defect'} may have been resolved. Re-check the Defect Log and update ci/expected-results.json — do not update this file alone.`,
      });
    } else if (actual.status !== 'failed') {
      problems.push({
        id,
        message: `expected fail, got ${actual.status}`,
        hint: 'A timeout or crash is not the recorded finding. Check the artefacts for a Cloudflare interstitial.',
      });
    }
  } else {
    problems.push({
      id,
      message: `baseline declares an unknown expectation "${entry.expect}"`,
      hint: 'Valid values are: pass, blocked, fail.',
    });
  }
}

/* ---------------------------------------------------------------- report -- */

lines.push('');
lines.push(`Comparing ${actualByTp.size} procedure(s) against ci/expected-results.json${scope ? ` (scope: ${scope})` : ''}`);
lines.push('');

for (const [id, entry] of declared) {
  const actual = actualByTp.get(id);
  if (!actual) continue;
  const failed = problems.some((p) => p.id === id);
  const mark = failed ? 'FAIL' : ' ok ';
  const tag = actual.annotations.includes('blocked') ? ' [blocked]' : '';
  lines.push(`  ${mark}  ${id}  expected ${entry.expect.padEnd(7)} actual ${actual.status}${tag}`);
}

console.log(lines.join('\n'));

/* Same table, rendered on the GitHub run page so no download is needed. */
const summaryRows = declared
  .filter(([id]) => actualByTp.has(id))
  .map(([id, entry]) => {
    const actual = actualByTp.get(id);
    const failed = problems.some((p) => p.id === id);
    const tag = actual.annotations.includes('blocked') ? ' `blocked`' : '';
    const ref = entry.defect ?? entry.assumption ?? '';
    return `| ${failed ? '❌' : '✅'} | ${id} | ${entry.expect} | ${actual.status}${tag} | ${ref} |`;
  });

summary(
  `## Expected-results check\n\n` +
    `${problems.length === 0 ? '**Run agrees with the recorded findings.**' : `**${problems.length} divergence(s) from the baseline.**`}\n\n` +
    `| | Procedure | Expected | Actual | Ref |\n|---|---|---|---|---|\n${summaryRows.join('\n')}\n\n` +
    (problems.length === 0
      ? '_A failing procedure here is the recorded finding, not a broken build._'
      : problems
          .map((p) => `**${p.id}** — ${p.message}\n\n> ${p.hint ?? ''}`)
          .join('\n\n')),
);

if (problems.length > 0) {
  console.error('');
  console.error(`${problems.length} divergence(s) from the baseline:`);
  for (const p of problems) {
    console.error('');
    console.error(`  ${p.id}  ${p.message}`);
    if (p.hint) console.error(`      ${p.hint}`);
  }
  console.error('');
  console.error('The run disagrees with the recorded findings. Either the store changed, or');
  console.error('the baseline is stale. Investigate before updating ci/expected-results.json.');
  console.error('');
  process.exit(1);
}

console.log('');
console.log('Run agrees with the recorded findings.');
console.log('');
process.exit(0);

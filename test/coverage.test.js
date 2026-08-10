import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { RECENT_WINDOW_DAYS, coverage, missingNights } from '../src/lib/coverage.js';
import { METRICS, missingNightsSentence } from '../src/lib/metrics.js';

const metric = (id) => METRICS.find((m) => m.id === id);

/** `days` days ending today, each one built by the caller. */
const history = (count, build) =>
  Array.from({ length: count }, (_, i) => ({
    date: `2026-01-${String((i % 28) + 1).padStart(2, '0')}`,
    ...build(i, count),
  }));

describe('coverage', () => {
  it('counts recorded days lately and over the whole record', () => {
    const days = history(200, (i) => ({ hrv: i % 2 === 0 ? 40 : undefined }));
    const [row] = coverage(days, [metric('hrv')]);

    assert.equal(row.recentOf, RECENT_WINDOW_DAYS);
    assert.equal(row.recentDays, 45);
    assert.equal(row.totalDays, 100);
  });

  it('reports when the record for a metric begins', () => {
    const days = history(50, (i) => ({ hrv: i >= 10 ? 40 : undefined }));
    const [row] = coverage(days, [metric('hrv')]);

    assert.equal(row.firstDate, days[10].date);
  });

  it('says so rather than guessing when a metric was never recorded', () => {
    const [row] = coverage(history(50, () => ({})), [metric('hrv')]);

    assert.equal(row.totalDays, 0);
    assert.equal(row.firstDate, null);
  });
});

describe('missingNights', () => {
  it('sorts the blank nights by what the watch was doing', () => {
    const days = history(RECENT_WINDOW_DAYS, (i) => {
      if (i % 5 === 0) return { sleepHours: 7, wristOvernight: 'worn' };
      if (i % 5 === 1) return { wristOvernight: 'off' };
      if (i % 5 === 2) return { wristOvernight: 'partly' };
      return { wristOvernight: 'worn' };
    });

    const tally = missingNights(days);
    assert.equal(tally.total, 72);
    assert.equal(tally.off, 18);
    assert.equal(tally.partly, 18);
    assert.equal(tally.worn, 36);
  });

  it('counts nothing when every night is accounted for', () => {
    const days = history(30, () => ({ sleepHours: 7, wristOvernight: 'worn' }));
    assert.equal(missingNights(days).total, 0);
  });
});

describe('missingNightsSentence', () => {
  it('names only the causes that actually occurred', () => {
    const line = missingNightsSentence({ total: 10, off: 10, partly: 0, worn: 0 });

    assert.match(line, /the watch was off for 10/);
    assert.doesNotMatch(line, /part of the night/);
  });

  it('singles out the nights that are a settings problem', () => {
    // Worn all night and recording nothing is the one cause a person can
    // actually go and fix.
    const line = missingNightsSentence({ total: 10, off: 6, partly: 1, worn: 3 });

    assert.match(line, /settings problem/);
  });

  it('does not raise a settings problem that did not happen', () => {
    const line = missingNightsSentence({ total: 10, off: 8, partly: 2, worn: 0 });

    assert.doesNotMatch(line, /settings/);
  });

  it('has something to say when nothing is missing', () => {
    const line = missingNightsSentence({ total: 0, off: 0, partly: 0, worn: 0 });

    assert.ok(line.length > 0);
    assert.doesNotMatch(line, /0/);
  });
});

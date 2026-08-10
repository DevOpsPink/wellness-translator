import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  MIN_DAYS_FOR_BASELINE,
  driftSeries,
  rollingBaseline,
  typicalDeviations,
} from '../src/lib/baseline.js';

/** Days of one metric, `null` where nothing was recorded. */
const daysOf = (values) =>
  values.map((v, i) => ({
    date: `2026-01-${String(i + 1).padStart(2, '0')}`,
    x: v === null ? undefined : v,
  }));

describe('rollingBaseline', () => {
  it('averages the seven days before the one being judged', () => {
    const days = daysOf([1, 2, 3, 4, 5, 6, 7, 100]);
    const { average, days: used } = rollingBaseline(days, 'x', 7);
    assert.equal(used, 7);
    assert.equal(average, 4); // (1+2+3+4+5+6+7)/7 — the 100 is excluded
  });

  it('leaves today out of its own baseline', () => {
    // Otherwise an unusual day drags the normal it is measured against
    // toward itself and partly excuses itself.
    const calm = daysOf([10, 10, 10, 10, 10, 10, 10, 20]);
    assert.equal(rollingBaseline(calm, 'x', 7).average, 10);
  });

  it('skips days with no reading rather than counting them as zero', () => {
    const days = daysOf([8, null, 8, null, 8, 8, null, 0]);
    const { average, days: used } = rollingBaseline(days, 'x', 7);
    assert.equal(used, 4);
    assert.equal(average, 8);
  });

  it('gives no baseline below the minimum number of readings', () => {
    const days = daysOf([5, null, 5, null, 5, 0]);
    const { average, days: used } = rollingBaseline(days, 'x', 5);
    assert.equal(used, 3);
    assert.equal(average, null);
    assert.ok(used < MIN_DAYS_FOR_BASELINE);
  });

  it('reaches back seven days and no further', () => {
    // The 999 sits eight days back and must not be in the window.
    const days = daysOf([999, 1, 1, 1, 1, 1, 1, 1, 0]);
    assert.equal(rollingBaseline(days, 'x', 8).average, 1);
  });
});

describe('typicalDeviations', () => {
  /** Alternates around 100 by a fixed fraction, so the median is known. */
  const wobble = (count, fraction) =>
    daysOf(
      Array.from({ length: count }, (_, i) =>
        i % 2 === 0 ? 100 : 100 * (1 + fraction),
      ),
    );

  it('says nothing until there is enough history to say it', () => {
    const spread = typicalDeviations(wobble(10, 0.1), 'x');
    assert.ok(spread.every((value) => value === null));
  });

  it('measures roughly how far an ordinary day sits from baseline', () => {
    const calm = typicalDeviations(wobble(120, 0.04), 'x').at(-1);
    const wild = typicalDeviations(wobble(120, 0.4), 'x').at(-1);

    assert.ok(calm > 0 && wild > 0);
    // The point of the whole scheme: a metric that swings ten times as far
    // has to be measured against a bar ten times as high.
    assert.ok(wild > calm * 5, `expected ${wild} to dwarf ${calm}`);
  });

  it('counts recorded days, not days on the calendar', () => {
    // The shape sleep actually has: recorded most nights for years, then
    // barely at all lately. A ninety-*day* window finds too few readings in
    // that tail and falls back to a guess — on the metric whose spread is
    // furthest from the guess. Ninety *recorded* days reaches back to when
    // the watch was worn.
    const denseThenSparse = daysOf([
      ...Array.from({ length: 300 }, (_, i) => (i % 2 === 0 ? 100 : 130)),
      ...Array.from({ length: 90 }, (_, i) => (i % 9 === 0 ? 100 : null)),
    ]);

    const recentReadings = denseThenSparse
      .slice(-90)
      .filter((day) => Number.isFinite(day.x)).length;
    assert.ok(recentReadings < 14, 'the tail is too thin to learn from');

    assert.ok(
      typicalDeviations(denseThenSparse, 'x').at(-1) > 0,
      'so the spread has to come from further back, not from a guess',
    );
  });

  it('keeps the day being judged out of its own measure', () => {
    const days = daysOf([...Array(60).fill(50), 5000]);
    const spread = typicalDeviations(days, 'x');
    const beforeTheSpike = spread.at(-2);
    const atTheSpike = spread.at(-1);
    assert.equal(atTheSpike, beforeTheSpike);
  });
});

describe('driftSeries', () => {
  it('compares the recent week against the recent season', () => {
    // A hundred days at 100, then seven at 120.
    const days = daysOf([...Array(100).fill(100), ...Array(7).fill(120)]);
    const { gap } = driftSeries(days, 'x').at(-1);
    assert.ok(gap > 0.1, `expected a clear upward gap, got ${gap}`);
  });

  it('reports no gap while a week sits on its season', () => {
    const days = daysOf(Array(200).fill(42));
    const { gap } = driftSeries(days, 'x').at(-1);
    assert.equal(gap, 0);
  });

  it('sees the sustained shift the daily baseline cannot', () => {
    // The seven-day baseline absorbs a lasting change within a few days;
    // this is the comparison that exists because of it.
    const days = daysOf([...Array(120).fill(100), ...Array(20).fill(80)]);
    const last = days.length - 1;

    const { average } = rollingBaseline(days, 'x', last);
    assert.equal(average, 80, 'the daily baseline has moved to the new level');

    const { gap } = driftSeries(days, 'x').at(-1);
    assert.ok(gap < -0.05, `the drift still sees it: ${gap}`);
  });
});

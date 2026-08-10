import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { typicalDeviations } from '../src/lib/baseline.js';
import { sampleHealthData } from '../src/data/sample-data.js';
import { donut } from '../src/lib/donut.js';
import { METRICS, STATUS } from '../src/lib/metrics.js';

describe('sampleHealthData', () => {
  it('is the same every time it is generated', () => {
    // The demo is something to point at and discuss, which it cannot be if
    // it reshuffles on every reload.
    assert.deepEqual(sampleHealthData(), sampleHealthData());
  });

  it('ends on the day it is asked for', () => {
    const days = sampleHealthData({ endingOn: new Date(2026, 0, 31) });
    assert.equal(days.at(-1).date, '2026-01-31');
  });

  it('is long enough for every part of the app to engage', () => {
    // Seven days for a baseline, thirty for the strip, ninety for the
    // variability, and ninety more behind that for week-against-season.
    assert.ok(sampleHealthData().length >= 300);
  });

  it('wanders as much as the real thing does', () => {
    // Thresholds are derived from spread, so a sample without a realistic
    // spread has nothing to derive them from. These are the figures measured
    // on a real five-year export.
    const days = sampleHealthData();
    const real = {
      restingHeartRate: 0.033,
      hrv: 0.154,
      sleepHours: 0.162,
      walkingHeartRate: 0.029,
      walkingSpeed: 0.038,
      daylightMinutes: 0.364,
    };

    for (const [id, expected] of Object.entries(real)) {
      const measured = typicalDeviations(days, id).at(-1);
      assert.ok(
        measured > expected / 2 && measured < expected * 2,
        `${id}: ${measured?.toFixed(3)} is not in the region of ${expected}`,
      );
    }
  });

  it('has holes in it', () => {
    // The blank card, the explanation for a missing night and the coverage
    // screen would never be seen in a sample without gaps.
    const days = sampleHealthData();
    const nights = days.filter((day) => Number.isFinite(day.sleepHours)).length;

    assert.ok(nights < days.length, 'some nights must be missing');
    assert.ok(nights > days.length / 4, 'but sleep still has to be usable');
  });

  it('never says the watch was worn on a night it recorded nothing about', () => {
    for (const day of sampleHealthData()) {
      if (Number.isFinite(day.sleepHours)) {
        assert.equal(day.wristOvernight, 'worn', day.date);
      }
      assert.ok(['worn', 'partly', 'off'].includes(day.wristOvernight), day.date);
    }
  });
});

describe('donut', () => {
  const statuses = METRICS.map(() => STATUS.GOOD);

  it('draws one segment per card', () => {
    const svg = donut(statuses);
    assert.equal(svg.match(/<path/g).length, METRICS.length);
  });

  it('colours each segment by its own state', () => {
    const svg = donut([STATUS.GOOD, STATUS.WATCH, STATUS.ALERT, STATUS.COLLECTING]);

    for (const status of ['good', 'watch', 'alert', 'collecting']) {
      assert.match(svg, new RegExp(`ring__part--${status}`));
    }
  });

  it('leaves gaps, so the segments can be counted', () => {
    // Rounded ends once bulged past where each arc stopped and closed the
    // gaps, turning six segments into one unbroken hoop.
    const svg = donut(statuses);
    const arcs = [...svg.matchAll(/d="M ([\d.]+) ([\d.]+) A/g)];
    assert.equal(arcs.length, METRICS.length);

    const starts = new Set(arcs.map(([, x, y]) => `${x},${y}`));
    assert.equal(starts.size, METRICS.length, 'no two segments start together');
  });

  it('draws nothing when there is nothing to draw', () => {
    assert.equal(donut([]), '');
  });
});

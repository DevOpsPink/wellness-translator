import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  METRICS,
  STATUS,
  THRESHOLDS,
  compareToBaseline,
  driftSentence,
  phraseFor,
  runOfOffDays,
  summaryFor,
  trendSentence,
} from '../src/lib/metrics.js';

const rhr = METRICS.find((m) => m.id === 'restingHeartRate'); // worse when higher
const sleep = METRICS.find((m) => m.id === 'sleepHours'); // worse when lower

/** Status for a reading `percent` away from a baseline of 100. */
const at = (metric, percent, typical) =>
  compareToBaseline(metric, 100 * (1 + percent), 100, typical).status;

describe('compareToBaseline', () => {
  it('counts distance in typical days, not in fixed percentages', () => {
    // The app's worst bug: 5% is a rare event for a resting heart rate and
    // an ordinary Tuesday for time in daylight. One fixed line flagged 96%
    // of daylight days.
    assert.equal(at(rhr, 0.08, 0.03), STATUS.WATCH); // 2.7x a steady metric
    assert.equal(at(rhr, 0.08, 0.35), STATUS.GOOD); // nothing for a wild one
  });

  it('puts the boundaries where the thresholds say', () => {
    const typical = 0.1;
    assert.equal(at(rhr, typical * THRESHOLDS.WATCH, typical), STATUS.GOOD);
    assert.equal(at(rhr, 0.201, typical), STATUS.WATCH);
    assert.equal(at(rhr, typical * THRESHOLDS.ALERT, typical), STATUS.WATCH);
    assert.equal(at(rhr, 0.301, typical), STATUS.ALERT);
  });

  it('survives a boundary that floating point cannot represent', () => {
    // (7.6 - 8) / 8 is exactly -5% on paper and -0.05000000000000002 in a
    // computer, which once tipped an on-the-line green card to yellow.
    assert.equal(
      compareToBaseline(sleep, 7.6, 8, 0.025).status,
      STATUS.GOOD,
      'exactly twice a typical day must still be green',
    );
  });

  it('knows which way is bad for each metric', () => {
    assert.equal(at(rhr, 0.3, 0.05), STATUS.ALERT); // heart rate up: bad
    assert.equal(at(rhr, -0.3, 0.05), STATUS.GOOD); // heart rate down: fine
    assert.equal(at(sleep, -0.3, 0.05), STATUS.ALERT); // sleep down: bad
    assert.equal(at(sleep, 0.3, 0.05), STATUS.GOOD); // sleep up: fine
  });

  it('never treats a big move the good way as a warning', () => {
    for (const metric of METRICS) {
      const better = metric.worseWhen === 'higher' ? -0.9 : 0.9;
      assert.equal(at(metric, better, 0.02), STATUS.GOOD, metric.label);
    }
  });

  it('tells two silences apart', () => {
    assert.equal(compareToBaseline(rhr, undefined, 60, 0.03).reason, 'no-reading');
    assert.equal(compareToBaseline(rhr, 60, null, 0.03).reason, 'no-baseline');
    assert.equal(compareToBaseline(rhr, 60, 0, 0.03).reason, 'no-baseline');
  });

  it('falls back to a default rather than calling everything an emergency', () => {
    // A typical of zero would make any reading at all infinitely unusual.
    assert.equal(at(rhr, 0.04, 0), STATUS.GOOD);
    assert.equal(at(rhr, 0.04, null), STATUS.GOOD);
  });
});

describe('phraseFor', () => {
  const VOICES = ['plain', 'playful'];

  it('has a line for every metric, state and voice', () => {
    for (const metric of METRICS) {
      for (const voice of VOICES) {
        for (const key of [STATUS.GOOD, STATUS.WATCH, STATUS.ALERT, 'better']) {
          const line = metric.voices[voice][key];
          assert.equal(typeof line, 'string', `${metric.id}/${voice}/${key}`);
          assert.ok(line.length > 0, `${metric.id}/${voice}/${key} is empty`);
        }
      }
    }
  });

  it('says "better" only when the day really was better', () => {
    const said = (worse) =>
      phraseFor(sleep, STATUS.GOOD, { worse, ordinary: 0.1, voice: 'plain' });

    assert.equal(said(-0.3), sleep.voices.plain.better);
    assert.equal(said(0.05), sleep.voices.plain[STATUS.GOOD]);
  });

  it('explains a blank night three different ways', () => {
    const said = (wrist) =>
      phraseFor(sleep, STATUS.COLLECTING, { reason: 'no-reading', wristOvernight: wrist });

    const answers = ['off', 'partly', 'worn'].map(said);
    assert.equal(new Set(answers).size, 3, 'each cause needs its own answer');
    assert.ok(answers.every((a) => a.length > 0));
  });

  it('claims no cause for metrics that have no evidence of one', () => {
    // The overnight heart rate says whether the watch was on a wrist. It
    // says nothing about why a daytime figure is missing.
    const daylight = METRICS.find((m) => m.id === 'daylightMinutes');
    const said = phraseFor(daylight, STATUS.COLLECTING, {
      reason: 'no-reading',
      wristOvernight: 'off',
    });
    assert.doesNotMatch(said, /watch/i);
  });
});

describe('summaryFor', () => {
  const shape = (statuses) =>
    METRICS.map((metric, i) => ({ metric, status: statuses[i] }));
  const G = STATUS.GOOD;
  const C = STATUS.COLLECTING;

  it('holds together across every combination of states', () => {
    const all = [G, STATUS.WATCH, STATUS.ALERT, C];
    const faults = [];

    for (let n = 0; n < all.length ** METRICS.length; n += 1) {
      let rest = n;
      const statuses = METRICS.map(() => {
        const status = all[rest % all.length];
        rest = Math.floor(rest / all.length);
        return status;
      });

      for (const voice of ['plain', 'playful']) {
        const line = summaryFor(shape(statuses), voice);

        if (/\s{2,}|undefined|your your/.test(line)) faults.push(line);
        if (/(and|,|—)\s*$/.test(line)) faults.push(line);

        for (const clause of line.split(', and ')) {
          const [subject] = clause.split(/ (?:is|are) /);
          const verb = clause.match(/ (is|are) /)?.[1];
          if (verb === undefined) continue;
          const plural = subject.includes(' and ') || /^\d+ of the/.test(subject);
          if (plural !== (verb === 'are') && !subject.includes('everything')) {
            faults.push(`${verb}: ${clause}`);
          }
        }
      }
    }

    assert.deepEqual(faults, []);
  });

  it('will not vouch for a metric it has not judged', () => {
    // "Everything is where it usually is" is a claim about all of them, and
    // was once being made after judging only some.
    const partly = summaryFor(shape([G, G, C, G, G, C]));
    assert.doesNotMatch(partly, /^Everything/);
    assert.doesNotMatch(partly, /the rest looks typical/);
  });

  it('counts rather than lists once the list gets long', () => {
    const R = STATUS.ALERT;
    assert.match(summaryFor(shape([R, R, R, R, G, G])), /4 of the 6/);
    assert.match(summaryFor(shape([R, R, R, R, R, R])), /^Everything/);
  });
});

describe('runs and trends', () => {
  const G = STATUS.GOOD;
  const Y = STATUS.WATCH;
  const C = STATUS.COLLECTING;

  it('counts consecutive off days ending today', () => {
    assert.equal(runOfOffDays([G, G, Y, Y, Y]), 3);
    assert.equal(runOfOffDays([G, Y, Y, G]), 0);
  });

  it('lets a gap end a run rather than counting through it', () => {
    // "Five days running" is a claim about five days that were seen.
    assert.equal(runOfOffDays([Y, Y, C, Y, Y]), 2);
  });

  it('stays quiet until there is enough judged history to speak', () => {
    assert.equal(trendSentence([...Array(25).fill(C), Y, Y, Y]), '');
  });

  it('does not claim every day was the same when one was not', () => {
    // "You slept longer than you usually do" once sat directly above "In
    // your usual range on all of the last 15 days" — both true, and read
    // together as a contradiction.
    const line = trendSentence(Array(15).fill(G));
    assert.doesNotMatch(line, /in your usual range/i);
    assert.match(line, /Nothing off your usual/);
  });

  it('leads with the run when there is one', () => {
    assert.match(trendSentence([...Array(20).fill(G), Y, Y, Y]), /3 days running/);
    assert.doesNotMatch(trendSentence([...Array(20).fill(G), Y, Y]), /running/);
  });
});

describe('driftSentence', () => {
  it('speaks only when a week is unusually far from its season', () => {
    assert.equal(driftSentence({ gap: 0.05, typical: 0.1 }), '');
    assert.match(driftSentence({ gap: 0.3, typical: 0.1 }), /30% above/);
    assert.match(driftSentence({ gap: -0.3, typical: 0.1 }), /30% below/);
  });

  it('says nothing when it has nothing to compare', () => {
    assert.equal(driftSentence(null), '');
    assert.equal(driftSentence({ gap: null, typical: 0.1 }), '');
    assert.equal(driftSentence({ gap: 0.5, typical: null }), '');
  });
});

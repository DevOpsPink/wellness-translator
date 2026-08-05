/**
 * What the app measures, and what the traffic light means.
 *
 * Definitions and wording only — no DOM, no data. The baseline itself is
 * worked out in baseline.js; this file decides what a deviation from it means.
 */
import { MIN_DAYS_FOR_BASELINE } from './baseline.js';

/**
 * The four states a card can be in.
 *
 * Named by meaning rather than by colour: the colour is a presentation
 * detail that lives in styles.css, and one day someone may want a
 * colour-blind-safe palette without renaming anything here.
 */
export const STATUS = {
  GOOD: 'good', // within ±5% of baseline
  WATCH: 'watch', // 5–10% worse than baseline
  ALERT: 'alert', // more than 10% worse than baseline
  COLLECTING: 'collecting', // fewer than 4 days of history — no verdict yet
};

/**
 * The three metrics, in display order.
 *
 * `worseWhen` records which direction is the bad one. Resting heart rate
 * going up is bad; HRV and sleep going down is bad. The comparison logic
 * reads this instead of hard-coding a rule per metric.
 *
 * `phrases` is the translation the whole app exists for: 59 bpm means nothing
 * to most people, "your heart is working a little harder at rest than usual"
 * means something. Three rules hold for every line written here:
 *
 *   1. Describe, never diagnose or prescribe. "Your recovery signal is well
 *      below your usual" — yes. "You are coming down with something", "take
 *      it easy today" — no. The app can see a number move; it cannot see why,
 *      and it is not a doctor.
 *   2. Say it plainly and once. No exclamation marks, no cheerleading, no
 *      nudge to come back tomorrow.
 *   3. Always "than usual", never "than normal". The comparison is against
 *      this person last week, not against anybody else.
 */
export const METRICS = [
  {
    id: 'restingHeartRate',
    label: 'Resting Heart Rate',
    // Lower case, because it only ever appears inside the summary sentence.
    shortLabel: 'resting heart rate',
    unit: 'bpm',
    worseWhen: 'higher',
    format: (value) => Math.round(value).toString(),
    phrases: {
      [STATUS.GOOD]: 'Your heart is ticking over at its usual rate.',
      [STATUS.WATCH]:
        'Your heart is working a little harder at rest than it usually does.',
      [STATUS.ALERT]:
        'Your heart is working noticeably harder at rest than it usually does.',
    },
  },
  {
    id: 'hrv',
    label: 'HRV',
    shortLabel: 'HRV',
    unit: 'ms',
    worseWhen: 'lower',
    format: (value) => Math.round(value).toString(),
    phrases: {
      [STATUS.GOOD]: 'Your recovery signal is where it usually sits.',
      [STATUS.WATCH]: 'Your recovery signal is a little below your usual.',
      [STATUS.ALERT]: 'Your recovery signal is well below your usual.',
    },
  },
  {
    id: 'sleepHours',
    label: 'Sleep',
    shortLabel: 'sleep',
    unit: 'h',
    worseWhen: 'lower',
    format: (value) => value.toFixed(1),
    phrases: {
      [STATUS.GOOD]: 'You slept about as long as you usually do.',
      [STATUS.WATCH]: 'You slept a little less than you usually do.',
      [STATUS.ALERT]: 'You slept a lot less than you usually do.',
    },
  },
];

/**
 * How far from baseline is far enough to say something, as a fraction.
 *
 * Both bounds are inclusive of the gentler verdict: exactly 5% worse is still
 * green, exactly 10% worse is still yellow.
 */
export const THRESHOLDS = {
  WATCH: 0.05, // 5% worse than usual
  ALERT: 0.1, // 10% worse than usual
};

/**
 * Turn today's number into a traffic-light status.
 *
 * @param metric   one entry from METRICS
 * @param value    today's reading
 * @param baseline the personal average, or null if there isn't one yet
 * @returns {{status: string, deviation: number|null}} `deviation` is the
 *   signed change against baseline (+0.06 = 6% higher), regardless of whether
 *   higher is good or bad for this metric.
 */
export function compareToBaseline(metric, value, baseline) {
  if (!Number.isFinite(value) || !Number.isFinite(baseline) || baseline === 0) {
    return { status: STATUS.COLLECTING, deviation: null };
  }

  const deviation = (value - baseline) / baseline;

  // Restate the change as "how far in the direction that is bad for this
  // metric". After this line one set of thresholds serves all three metrics,
  // and nothing below needs to know which way round each one runs.
  const rawWorse = metric.worseWhen === 'higher' ? deviation : -deviation;

  // Round before comparing. (7.6 - 8) / 8 is exactly -5% on paper but comes
  // out of floating-point division as -0.05000000000000002, which would fall
  // past an inclusive 5% bound and turn a green card yellow. Six decimal
  // places is far finer than the whole numbers of percent ever displayed.
  const worse = Math.round(rawWorse * 1e6) / 1e6;

  // Note that a big move the *good* way lands here as a large negative
  // `worse` and comes out green, which is the intended reading: nine hours of
  // sleep is not a warning.
  let status;
  if (worse <= THRESHOLDS.WATCH) {
    status = STATUS.GOOD;
  } else if (worse <= THRESHOLDS.ALERT) {
    status = STATUS.WATCH;
  } else {
    status = STATUS.ALERT;
  }

  return { status, deviation };
}

/**
 * The sentence on a card.
 *
 * While the baseline is still being built there is nothing to translate, so
 * the card says what it is waiting for instead of guessing.
 */
export function phraseFor(metric, status, { days = 0 } = {}) {
  if (status === STATUS.COLLECTING) {
    return `Collecting data — ${days} of ${MIN_DAYS_FOR_BASELINE} days`;
  }
  return metric.phrases[status];
}

/** "sleep and HRV", "sleep, HRV and resting heart rate". */
function joinList(items) {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function capitalise(sentence) {
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

/**
 * The one line above the cards.
 *
 * Deliberately *not* a score. Averaging three metrics into a single number
 * would invent a precision none of them has, and would hide the one thing
 * worth knowing — which of them moved. So the line names the worst group and
 * says whether it stands alone; the cards below carry the detail.
 *
 * It also names metrics, never the person. "Sleep is well off your usual" is
 * an observation about a number. "You are having a rough day" is a verdict on
 * someone's life, from an app that has seen three figures.
 *
 * @param readings the per-metric objects built in app.js, each carrying its
 *   `metric` and its `status`
 */
export function summaryFor(readings) {
  const graded = readings.filter(({ status }) => status !== STATUS.COLLECTING);
  if (graded.length === 0) return 'Still learning your normal';

  const labelsWith = (wanted) =>
    graded
      .filter(({ status }) => status === wanted)
      .map(({ metric }) => metric.shortLabel);

  const alert = labelsWith(STATUS.ALERT);
  const watch = labelsWith(STATUS.WATCH);

  const stillCollecting = readings
    .filter(({ status }) => status === STATUS.COLLECTING)
    .map(({ metric }) => metric.shortLabel);

  if (alert.length === 0 && watch.length === 0) {
    // "Everything" is a claim about all three metrics, so it may only be made
    // once all three have been judged. The sentences further down name the
    // metrics they are about and so claim nothing about the others; this one
    // covers the lot, which is why it alone needs the qualifier.
    return stillCollecting.length === 0
      ? 'Everything is where it usually is'
      : `Nothing unusual so far — still learning your ${joinList(stillCollecting)}`;
  }

  const clauses = [];
  if (alert.length > 0) {
    clauses.push(
      `${joinList(alert)} ${alert.length === 1 ? 'is' : 'are'} well off your usual`,
    );
  }
  if (watch.length > 0) {
    clauses.push(
      `${joinList(watch)} ${watch.length === 1 ? 'is' : 'are'} a little off`,
    );
  }

  let sentence = capitalise(clauses.join(', and '));

  // Only claim the rest is fine when the rest really is all green. With a
  // metric still collecting, there is something the app cannot vouch for.
  const everythingElseIsGood =
    graded.length === readings.length &&
    graded.length > alert.length + watch.length;
  if (everythingElseIsGood) {
    sentence += ' — the rest looks typical';
  }

  return sentence;
}

/** e.g. 0.064 -> "+6%". Rounded, because false precision invites reading in. */
export function formatDeviation(deviation) {
  const percent = Math.round(deviation * 100);
  return `${percent > 0 ? '+' : ''}${percent}%`;
}

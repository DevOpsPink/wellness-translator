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
 */
export const METRICS = [
  {
    id: 'restingHeartRate',
    label: 'Resting Heart Rate',
    unit: 'bpm',
    worseWhen: 'higher',
    format: (value) => Math.round(value).toString(),
  },
  {
    id: 'hrv',
    label: 'HRV',
    unit: 'ms',
    worseWhen: 'lower',
    format: (value) => Math.round(value).toString(),
  },
  {
    id: 'sleepHours',
    label: 'Sleep',
    unit: 'h',
    worseWhen: 'lower',
    format: (value) => value.toFixed(1),
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
 * Placeholder verdicts, one per status.
 *
 * Step 3 of the plan replaces these with real per-metric phrasing
 * ("your heart is working harder than usual today"). For now they exist so
 * a card is readable while the machinery underneath gets built.
 */
export const STATUS_LABEL = {
  [STATUS.GOOD]: 'In your usual range',
  [STATUS.WATCH]: 'A little off your usual',
  [STATUS.ALERT]: 'Well off your usual',
  [STATUS.COLLECTING]: 'Collecting data',
};

/** The status line on a card. Says how far off the baseline still is. */
export function statusText(status, { days = 0 } = {}) {
  if (status === STATUS.COLLECTING) {
    return `Collecting data — ${days} of ${MIN_DAYS_FOR_BASELINE} days`;
  }
  return STATUS_LABEL[status];
}

/** e.g. 0.064 -> "+6%". Rounded, because false precision invites reading in. */
export function formatDeviation(deviation) {
  const percent = Math.round(deviation * 100);
  return `${percent > 0 ? '+' : ''}${percent}%`;
}

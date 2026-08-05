/**
 * What the app measures, and what the traffic light means.
 *
 * This file holds definitions only — no DOM, no data. Keeping it separate
 * means the baseline maths we add next has one obvious home.
 */

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
 * Placeholder verdicts, one per status.
 *
 * Step 5 of the plan replaces these with real per-metric phrasing
 * ("your heart is working harder than usual today"). For now they exist so
 * a card is readable while we get the layout right.
 */
export const STATUS_LABEL = {
  [STATUS.GOOD]: 'In your usual range',
  [STATUS.WATCH]: 'A little off your usual',
  [STATUS.ALERT]: 'Well off your usual',
  [STATUS.COLLECTING]: 'Collecting data',
};

/**
 * TEMPORARY — step 1 only.
 *
 * Hard-coded so all three colours appear on screen while we build the
 * layout. Step 2 replaces the body of this function with a real comparison
 * against the 7-day rolling baseline; everything that calls it stays put.
 */
export function getStatus(metricId) {
  const placeholder = {
    restingHeartRate: STATUS.WATCH,
    hrv: STATUS.GOOD,
    sleepHours: STATUS.ALERT,
  };
  return placeholder[metricId] ?? STATUS.COLLECTING;
}

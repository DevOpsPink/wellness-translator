/**
 * Your personal normal.
 *
 * The whole point of the app: 59 bpm is not "high" or "low" in the abstract,
 * it is high or low *for you, this week*. That comparison needs a baseline,
 * and this file is the only place it is worked out.
 */

/** How many days of history feed the baseline. */
export const BASELINE_WINDOW_DAYS = 7;

/**
 * Fewest readings needed before any verdict is given.
 *
 * With one or two nights, the "average" is just the last night restated, and
 * every deviation from it looks dramatic. Four is the point where the number
 * starts describing a habit rather than an incident.
 */
export const MIN_DAYS_FOR_BASELINE = 4;

/**
 * Average one metric over the days *before* `index`.
 *
 * Today is deliberately left out of its own baseline. Including it would let
 * an unusual day drag the "normal" it is being measured against toward
 * itself, which quietly shrinks every deviation — a bad night would partly
 * excuse itself.
 *
 * Days with a missing reading are skipped rather than counted as zero: a
 * watch left on the charger is absent data, not a night of no sleep.
 *
 * @returns {{average: number|null, days: number}} `average` is null until
 *   MIN_DAYS_FOR_BASELINE readings exist; `days` is how many were found.
 */
export function rollingBaseline(records, metricId, index = records.length - 1) {
  const windowStart = Math.max(0, index - BASELINE_WINDOW_DAYS);

  const readings = records
    .slice(windowStart, index)
    .map((day) => day[metricId])
    .filter((value) => Number.isFinite(value));

  if (readings.length < MIN_DAYS_FOR_BASELINE) {
    return { average: null, days: readings.length };
  }

  const total = readings.reduce((sum, value) => sum + value, 0);
  return { average: total / readings.length, days: readings.length };
}

/**
 * How many recorded days the "a typical day for you" figure is measured over.
 *
 * Counted in days that have a reading rather than days on the calendar. Sleep
 * can go missing for weeks at a time, and a calendar window would keep
 * finding too few to work with and fall back to a guess — on the metric whose
 * spread is furthest from that guess.
 */
export const VARIABILITY_SAMPLES = 90;

/** Fewest days needed before a metric's own spread is trusted. */
export const MIN_DAYS_FOR_VARIABILITY = 14;

/**
 * How far a typical day sits from the baseline, per metric.
 *
 * Fixed thresholds were the app's worst mistake. Five percent is a rare event
 * for a resting heart rate, which drifts by under four percent on an ordinary
 * day — and nothing at all for time in daylight, where the ordinary gap
 * between one day and the next is fifty percent, because some days you are
 * out for twenty minutes and some days for four hours.
 *
 * Judged against one fixed line, the same colour meant "unusual" on one card
 * and "Tuesday" on another: daylight came out red on nine days in ten. An
 * alarm that sounds every day is not an alarm.
 *
 * So each metric is measured against its own ordinary day. The median is used
 * rather than the mean because a fortnight of illness should not raise the bar
 * for noticing the next one.
 *
 * @returns one figure per day — the fraction a typical day differs by, or
 *   null while there is too little history to say.
 */
export function typicalDeviations(records, metricId) {
  const deviations = records.map((day, index) => {
    const value = day[metricId];
    const { average } = rollingBaseline(records, metricId, index);
    if (!Number.isFinite(value) || !Number.isFinite(average) || average === 0) {
      return undefined;
    }
    return Math.abs((value - average) / average);
  });

  // Swept forwards, carrying the readings seen so far. The day being judged is
  // never in its own window, for the same reason it is not in its own
  // baseline.
  const seen = [];

  return deviations.map((deviation) => {
    const window = seen.slice(-VARIABILITY_SAMPLES).sort((a, b) => a - b);
    if (Number.isFinite(deviation)) seen.push(deviation);

    if (window.length < MIN_DAYS_FOR_VARIABILITY) return null;

    const middle = Math.floor(window.length / 2);
    return window.length % 2 === 0
      ? (window[middle - 1] + window[middle]) / 2
      : window[middle];
  });
}

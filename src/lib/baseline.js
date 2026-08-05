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

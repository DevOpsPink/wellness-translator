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
 * can go missing for weeks at a time, and a calendar window then keeps finding
 * too few readings to work with and falls back to a guess — on the metric
 * whose spread is furthest from that guess.
 */
export const VARIABILITY_SAMPLES = 90;

/** Fewest days needed before a metric's own spread is trusted. */
export const MIN_DAYS_FOR_VARIABILITY = 14;

/** What "lately" and "the last few months" mean, in recorded days. */
export const RECENT_SAMPLES = 7;
export const SEASON_SAMPLES = 90;

/** Mean of the last `want` days that have a reading, ending at `index`. */
function meanOfRecent(records, metricId, index, want) {
  const values = [];

  for (let at = index; at >= 0 && values.length < want; at -= 1) {
    const value = records[at][metricId];
    if (Number.isFinite(value)) values.push(value);
  }

  if (values.length < Math.min(want, MIN_DAYS_FOR_BASELINE)) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * This week against the last few months.
 *
 * The daily verdict cannot see a slow slide, and not by oversight: the
 * baseline is a seven-day average, so a metric that drops and stays down is
 * back inside its own normal within about four days. Measured over five years
 * of this export, runs of three consecutive off days happen seven times in
 * total and never reach four — the baseline chases the change and swallows it.
 *
 * So the sustained shift needs a second, slower comparison. A week's average
 * against a season's answers a different question from today's card: not "is
 * today unusual" but "has your usual moved".
 *
 * Unlike the baseline, the day being judged is included — it is part of the
 * week being described, not something being tested against it.
 *
 * @returns per day: the fraction this week sits above or below the season,
 *   and how big that gap normally is for this metric.
 */
export function driftSeries(records, metricId) {
  const gaps = records.map((_, index) => {
    const week = meanOfRecent(records, metricId, index, RECENT_SAMPLES);
    const season = meanOfRecent(records, metricId, index, SEASON_SAMPLES);
    if (week === null || season === null || season === 0) return null;
    return (week - season) / season;
  });

  const seen = [];

  return gaps.map((gap) => {
    const window = seen.slice(-VARIABILITY_SAMPLES).sort((a, b) => a - b);
    if (gap !== null) seen.push(Math.abs(gap));

    if (window.length < MIN_DAYS_FOR_VARIABILITY) return { gap, typical: null };

    const middle = Math.floor(window.length / 2);
    const typical =
      window.length % 2 === 0
        ? (window[middle - 1] + window[middle]) / 2
        : window[middle];

    return { gap, typical };
  });
}

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

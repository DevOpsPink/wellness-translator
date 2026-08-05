/**
 * What the data itself looks like.
 *
 * Every other app in this space quietly shows whatever it has. This one says
 * out loud how much of the record is missing and, where there is evidence for
 * it, why — because a metric recorded on a handful of nights in ninety is not a health
 * finding, it is a watch left on the bedside table, and the two need telling
 * apart before anything else on screen means much.
 *
 * Numbers only. The sentences built from them live in metrics.js.
 */

/** The stretch treated as "lately". */
export const RECENT_WINDOW_DAYS = 90;

/** How completely each metric is recorded, lately and over the whole export. */
export function coverage(records, metrics) {
  const recent = records.slice(-RECENT_WINDOW_DAYS);

  return metrics.map((metric) => {
    const has = (day) => Number.isFinite(day[metric.id]);
    const first = records.find(has);

    return {
      metric,
      recentDays: recent.filter(has).length,
      recentOf: recent.length,
      totalDays: records.filter(has).length,
      firstDate: first === undefined ? null : first.date,
    };
  });
}

/**
 * Why the recent nights with no sleep have no sleep.
 *
 * Sleep is the only metric that can be asked this. The evidence is the
 * overnight heart rate, which says whether the watch was on a wrist — and it
 * says nothing about daytime figures, so nothing else gets an explanation.
 */
export function missingNights(records) {
  const missing = records
    .slice(-RECENT_WINDOW_DAYS)
    .filter((day) => !Number.isFinite(day.sleepHours));

  const tally = { total: missing.length, off: 0, partly: 0, worn: 0 };
  for (const day of missing) {
    if (day.wristOvernight in tally) tally[day.wristOvernight] += 1;
  }

  return tally;
}

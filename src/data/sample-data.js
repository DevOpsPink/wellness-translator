/**
 * Made-up data for the sample view.
 *
 * Not a stand-in for a parser any more — the importer handles real exports.
 * This exists so that someone opening the page without an export.xml sees the
 * app working rather than an empty shell, which means it has to be long enough
 * for the machinery to engage: seven days for a baseline, thirty for the strip
 * of daily verdicts, ninety for the variability that sets the thresholds, and
 * ninety more behind that for the week-against-season comparison.
 *
 * Generated rather than typed out, because the shape matters more than the
 * figures: each metric has to wander by roughly as much as it really does, or
 * the calibration has nothing to calibrate against. The spreads below are the
 * ones measured on a real five-year export.
 *
 * Deterministic, from a fixed seed. The demo is the same every time it loads,
 * which makes it something that can be pointed at and discussed.
 */

const SEED = 20260805;
const DAYS = 400;

/** Small, fast, seeded — enough for plausible noise, not for cryptography. */
function seededRandom(seed) {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * How each metric behaves: where it sits, and how widely it swings.
 *
 * `spread` is not the figure the app ends up measuring. Noise here passes
 * through a bell curve narrower than one, and the baseline it is compared
 * against is itself an average of seven noisy days, so what comes out the far
 * end is roughly half what goes in. These numbers were tuned by generating the
 * data and measuring it until the app saw the same wander it sees on a real
 * export — a steady heart rate against a daylight figure that swings ten times
 * as far.
 */
const SHAPES = {
  restingHeartRate: { centre: 58, spread: 0.059, drift: 0.02 },
  hrv: { centre: 45, spread: 0.31, drift: 0.05 },
  sleepHours: { centre: 7.2, spread: 0.355, drift: 0.04 },
  walkingHeartRate: { centre: 98, spread: 0.044, drift: 0.02 },
  walkingSpeed: { centre: 4.8, spread: 0.069, drift: 0.02 },
  daylightMinutes: { centre: 110, spread: 0.89, drift: 0.06 },
};

/**
 * A few days where everything moves at once, the way it does when someone is
 * coming down with something: the heart works harder, recovery drops, sleep
 * goes short. Without an event or two the sample is a field of green, which
 * shows the app running but not the app working.
 */
const EPISODES = [
  {
    from: DAYS - 48,
    to: DAYS - 43,
    shift: {
      restingHeartRate: 0.1,
      hrv: -0.3,
      sleepHours: -0.22,
      walkingHeartRate: 0.09,
      walkingSpeed: -0.06,
    },
  },
  // A milder one running up to the last day, so the day on screen has
  // something to say and a run of days behind it.
  {
    from: DAYS - 3,
    to: DAYS - 1,
    shift: { walkingHeartRate: 0.08, hrv: -0.22, restingHeartRate: 0.05 },
  },
];

/** Daylight follows the seasons before it follows anything else. */
function seasonalDaylight(date) {
  const start = Date.UTC(date.getUTCFullYear(), 0, 1);
  const dayOfYear = (date.getTime() - start) / 86_400_000;
  return 1 + 0.55 * Math.sin((2 * Math.PI * (dayOfYear - 80)) / 365);
}

export function sampleHealthData({ days = DAYS, endingOn = new Date() } = {}) {
  const random = seededRandom(SEED);
  const bellCurve = () => (random() + random() + random() + random() - 2) / 1.1;

  // A slowly wandering personal level per metric, so that "your usual" is
  // itself a moving thing — which is the whole reason the app compares a week
  // against a season.
  const level = Object.fromEntries(Object.keys(SHAPES).map((id) => [id, 1]));

  const midnight = Date.UTC(
    endingOn.getFullYear(),
    endingOn.getMonth(),
    endingOn.getDate(),
  );

  const records = [];

  for (let index = 0; index < days; index += 1) {
    const date = new Date(midnight - (days - 1 - index) * 86_400_000);
    const day = { date: date.toISOString().slice(0, 10) };

    for (const [id, shape] of Object.entries(SHAPES)) {
      // Mean-reverting wander: it drifts, but never wanders off for good.
      level[id] += bellCurve() * shape.drift - (level[id] - 1) * 0.08;

      const episode = EPISODES.find(
        (e) => index >= e.from && index <= e.to,
      )?.shift[id];

      const season = id === 'daylightMinutes' ? seasonalDaylight(date) : 1;
      const value =
        shape.centre *
        level[id] *
        season *
        (1 + bellCurve() * shape.spread) *
        (1 + (episode ?? 0));

      day[id] = Math.max(value, shape.centre * 0.2);
    }

    records.push(day);
  }

  return withRealisticGaps(records, seededRandom(SEED + 1));
}

/**
 * Punch holes in it.
 *
 * A record with no gaps would make the app look better than it can be. Sleep
 * in particular goes missing constantly in real life, and the states built to
 * handle that — the blank card, the explanation of why the watch has nothing,
 * the coverage screen — would never appear in a sample without holes.
 */
function withRealisticGaps(records, random) {
  const drop = (from, length, ids) => {
    for (let at = from; at < from + length && at < records.length; at += 1) {
      for (const id of ids) records[at][id] = undefined;
    }
  };

  const last = records.length;

  // A fortnight with the watch off entirely — a holiday, or a lost charger.
  drop(last - 150, 12, Object.keys(SHAPES));
  // Two stretches of nights without wearing it to bed.
  drop(last - 95, 16, ['sleepHours']);
  drop(last - 34, 9, ['sleepHours']);

  for (const [index, day] of records.entries()) {
    // Scattered single days, more often for sleep than for anything else.
    if (random() < 0.28) day.sleepHours = undefined;
    if (random() < 0.04) day.walkingSpeed = undefined;
    if (random() < 0.03) day.daylightMinutes = undefined;

    const sleeping = Number.isFinite(day.sleepHours);
    const anything = Object.keys(SHAPES).some((id) =>
      Number.isFinite(day[id]),
    );

    day.wristOvernight = sleeping
      ? 'worn'
      : !anything
        ? 'off'
        : // A handful of nights where the watch was on and recorded nothing
          // anyway, which is the one case worth telling apart: a setting,
          // not a habit.
          index % 37 === 0
          ? 'worn'
          : random() < 0.7
            ? 'off'
            : 'partly';
  }

  return records;
}

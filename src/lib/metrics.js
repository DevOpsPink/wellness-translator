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
 * `voices` is the translation the whole app exists for: 59 bpm means nothing
 * to most people, "your heart is working a little harder at rest than usual"
 * means something.
 *
 * Two ways of saying it. `plain` is flat and careful. `playful` has a pulse —
 * dry rather than loud, and never at the reader's expense. Note that the red
 * lines stay warm in both: the app can see a number move and cannot see why,
 * and behind a bad week there may be flu, a sick child or a funeral. A joke
 * lands on all of them equally, which is the problem.
 *
 * Three rules hold for every line in either voice:
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
    // Named the way a person would say it, not the way HealthKit does.
    // "Resting Heart Rate" is a field name; "Heart at rest" is a thing that
    // happens to you.
    label: 'Heart at rest',
    // Lower case, because it only ever appears inside the summary sentence.
    shortLabel: 'your heart at rest',
    unit: 'bpm',
    worseWhen: 'higher',
    format: (value) => Math.round(value).toString(),
    voices: {
      plain: {
        [STATUS.GOOD]: 'Your heart is ticking over at its usual rate.',
        better: 'Your heart is resting easier than it usually does.',
        [STATUS.WATCH]:
          'Your heart is working a little harder at rest than it usually does.',
        [STATUS.ALERT]:
          'Your heart is working noticeably harder at rest than it usually does.',
      },
      playful: {
        [STATUS.GOOD]: 'Heart’s just ticking along.',
        better: 'Your heart is barely bothering today.',
        [STATUS.WATCH]: 'Your heart is putting in a bit of overtime.',
        [STATUS.ALERT]:
          'Your heart is working properly hard for someone sitting still.',
      },
    },
  },
  {
    id: 'hrv',
    // "HRV" is three letters that mean nothing to most people, and "recovery
    // signal" was not much better — it named an instrument rather than a
    // state. What the number is actually about is how rested the body seems.
    label: 'How rested you seem',
    shortLabel: 'how rested you seem',
    unit: 'ms',
    worseWhen: 'lower',
    format: (value) => Math.round(value).toString(),
    voices: {
      plain: {
        [STATUS.GOOD]: 'Your body looks about as rested as it usually does.',
        better: 'Your body looks more rested than it usually does.',
        [STATUS.WATCH]: 'Your body looks a little less rested than usual.',
        [STATUS.ALERT]: 'Your body looks a lot less rested than usual.',
      },
      playful: {
        [STATUS.GOOD]: 'Your body seems fine with things.',
        better: 'Your body is in unusually good shape today.',
        [STATUS.WATCH]: 'Your body is a bit less bouncy than usual.',
        [STATUS.ALERT]:
          'Your body is running on fumes, by its own standards.',
      },
    },
  },
  {
    id: 'sleepHours',
    label: 'Sleep',
    shortLabel: 'your sleep',
    unit: 'h',
    worseWhen: 'lower',
    format: (value) => value.toFixed(1),
    voices: {
      plain: {
        [STATUS.GOOD]: 'You slept about as long as you usually do.',
        better: 'You slept longer than you usually do.',
        [STATUS.WATCH]: 'You slept a little less than you usually do.',
        [STATUS.ALERT]: 'You slept a lot less than you usually do.',
      },
      playful: {
        [STATUS.GOOD]: 'A normal night.',
        better: 'You got a proper lie-in.',
        [STATUS.WATCH]: 'You short-changed yourself a bit last night.',
        [STATUS.ALERT]: 'That was not much of a night.',
      },
    },
    // A blank night has three quite different explanations, and which one it
    // is decides what, if anything, the person should do about it.
    explainMissing: (wristOvernight, voice) =>
      ({
        plain: {
          off: 'No sleep recorded — the watch was not on your wrist.',
          partly:
            'No sleep recorded — the watch was only on for part of the night.',
          worn: 'The watch was on all night but recorded no sleep.',
        },
        playful: {
          off: 'The watch spent the night on the side.',
          partly: 'The watch gave up partway through the night.',
          worn: 'The watch was on all night and noticed nothing.',
        },
      })[voice]?.[wristOvernight] ?? 'No sleep recorded.',
  },
  {
    id: 'walkingHeartRate',
    label: 'Heart when walking',
    shortLabel: 'your heart when walking',
    unit: 'bpm',
    worseWhen: 'higher',
    format: (value) => Math.round(value).toString(),
    // Resting heart rate says what the body costs while still. This says what
    // the same walk costs today, which moves earlier and for different
    // reasons.
    voices: {
      plain: {
        [STATUS.GOOD]: 'Walking cost your heart what it usually does.',
        better: 'Walking cost your heart less than it usually does.',
        [STATUS.WATCH]:
          'Your heart worked a little harder than usual while walking.',
        [STATUS.ALERT]:
          'Your heart worked noticeably harder than usual while walking.',
      },
      playful: {
        [STATUS.GOOD]: 'Walking felt normal to your heart.',
        better: 'Walking was easy work today.',
        [STATUS.WATCH]: 'Walking took a bit more out of you than usual.',
        [STATUS.ALERT]: 'Walking took real effort today.',
      },
    },
  },
  {
    id: 'walkingSpeed',
    label: 'Walking pace',
    shortLabel: 'your walking pace',
    unit: 'km/h',
    worseWhen: 'lower',
    format: (value) => value.toFixed(1),
    voices: {
      plain: {
        [STATUS.GOOD]: 'You walked at your usual pace.',
        better: 'You walked faster than you usually do.',
        [STATUS.WATCH]: 'You walked a little slower than you usually do.',
        [STATUS.ALERT]: 'You walked noticeably slower than you usually do.',
      },
      playful: {
        [STATUS.GOOD]: 'Same walking speed as ever.',
        better: 'You clearly had somewhere to be.',
        [STATUS.WATCH]: 'You dawdled a little.',
        [STATUS.ALERT]: 'You were properly slow today.',
      },
    },
  },
  {
    id: 'daylightMinutes',
    label: 'Time outside',
    shortLabel: 'your time outside',
    unit: 'min',
    worseWhen: 'lower',
    format: (value) => Math.round(value).toString(),
    voices: {
      plain: {
        [STATUS.GOOD]: 'You were out in daylight about as long as usual.',
        better: 'You were out in daylight longer than you usually are.',
        [STATUS.WATCH]: 'You saw a little less daylight than you usually do.',
        [STATUS.ALERT]: 'You saw much less daylight than you usually do.',
      },
      playful: {
        [STATUS.GOOD]: 'The usual amount of daylight.',
        better: 'You got out properly today.',
        [STATUS.WATCH]: 'A bit of a cave day.',
        [STATUS.ALERT]: 'You barely saw the sun.',
      },
    },
    // No explanation offered on purpose. Sleep can name its cause because the
    // overnight heart rate says whether the watch was on; nothing here
    // evidences why a daytime figure is missing, and the wrist signal is
    // about the night, so it cannot be borrowed to answer for the day.
  },
];

/**
 * How far from baseline is far enough to say something — counted in typical
 * days for that metric, not in fixed percentages.
 *
 * The original spec said 5% and 10%. Measured against years of real
 * data those turned out to fit resting heart rate almost exactly and to be
 * meaningless for everything noisier: daylight was flagged on half of all days and
 * sleep on nearly half. A warning that never stops is not a warning.
 *
 * Two and three times an ordinary day put roughly one day in seven at yellow
 * and one in twenty at red, whatever the metric — so the colour finally means
 * the same thing on every card.
 *
 * Both bounds are inclusive of the gentler verdict.
 */
export const THRESHOLDS = {
  WATCH: 2, // twice as far from usual as an ordinary day
  ALERT: 3, // three times
};

/**
 * Stands in until a metric has enough history to know its own spread — the
 * spec's original figure, now doing the one job it is actually suited to.
 */
export const DEFAULT_TYPICAL_DEVIATION = 0.05;

/**
 * Turn today's number into a traffic-light status.
 *
 * @param metric   one entry from METRICS
 * @param value    today's reading
 * @param baseline the personal average, or null if there isn't one yet
 * @param typical  how far an ordinary day sits from that average for this
 *                 metric, or null while there is too little history
 * @returns {{status: string, deviation: number|null}} `deviation` is the
 *   signed change against baseline (+0.06 = 6% higher), regardless of whether
 *   higher is good or bad for this metric.
 */
export function compareToBaseline(metric, value, baseline, typical = null) {
  // Two different silences, and the card should not confuse them: nothing was
  // measured today, or there is not yet enough history to measure it against.
  if (!Number.isFinite(value)) {
    return {
      status: STATUS.COLLECTING,
      deviation: null,
      worse: null,
      ordinary: null,
      reason: 'no-reading',
    };
  }
  if (!Number.isFinite(baseline) || baseline === 0) {
    return {
      status: STATUS.COLLECTING,
      deviation: null,
      worse: null,
      ordinary: null,
      reason: 'no-baseline',
    };
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

  // An ordinary day's drift for this metric, which is what the thresholds are
  // counted in. Zero would make every reading an emergency.
  const ordinary =
    Number.isFinite(typical) && typical > 0
      ? typical
      : DEFAULT_TYPICAL_DEVIATION;

  // Note that a big move the *good* way lands here as a large negative
  // `worse` and comes out green, which is the intended reading: nine hours of
  // sleep is not a warning.
  let status;
  if (worse <= ordinary * THRESHOLDS.WATCH) {
    status = STATUS.GOOD;
  } else if (worse <= ordinary * THRESHOLDS.ALERT) {
    status = STATUS.WATCH;
  } else {
    status = STATUS.ALERT;
  }

  return { status, deviation, worse, ordinary, reason: null };
}

/**
 * The sentence on a card.
 *
 * While the baseline is still being built there is nothing to translate, so
 * the card says what it is waiting for instead of guessing.
 *
 * Green covers two different days: one that matches your usual, and one that
 * beats it. Both are "nothing to flag", which is why they share a colour —
 * but "you slept about as long as you usually do" is simply false on a night
 * you slept an hour and a half longer, so the wording splits where the colour
 * does not. The dividing line is the same 5% that separates green from
 * yellow, read in the other direction.
 */
export function phraseFor(
  metric,
  status,
  {
    days = 0,
    worse = null,
    ordinary = null,
    reason = null,
    wristOvernight = null,
    voice = 'plain',
  } = {},
) {
  const said = metric.voices[voice] ?? metric.voices.plain;

  if (reason === 'no-reading') {
    return metric.explainMissing === undefined
      ? 'Nothing recorded for this day.'
      : metric.explainMissing(wristOvernight, voice);
  }
  if (status === STATUS.COLLECTING) {
    return `Collecting data — ${days} of ${MIN_DAYS_FOR_BASELINE} days`;
  }
  // Deliberately a lower bar than the warning. The two are not symmetrical in
  // what they cost: "you slept longer than you usually do" is a statement of
  // direction and is harmless if it is only a mild one, while a warning that
  // fires too easily is the bug this whole scheme exists to fix. At the same
  // bar as a warning, a night far longer than usual — nearly twice an
  // ordinary night's swing — was still being described as "about as long as
  // you usually do", directly under a printed +27%.
  const better =
    worse !== null && ordinary !== null && worse < -ordinary;
  if (status === STATUS.GOOD && better) {
    return said.better;
  }
  return said[status];
}

/** How many days the strip of daily verdicts covers. */
export const TREND_DAYS = 30;

/** Shorter runs than this are the ordinary flicker of a noisy metric. */
export const RUN_WORTH_MENTIONING = 3;

/**
 * How many days in a row, ending on the day shown, have been off your usual.
 *
 * This is the thing these metrics are actually good for. One low HRV reading
 * is mostly noise — the figure moves 15% on an ordinary day here. Five in a
 * row is not noise, and it is invisible if every day is judged alone.
 */
export function runOfOffDays(statuses) {
  let run = 0;

  for (let index = statuses.length - 1; index >= 0; index -= 1) {
    const status = statuses[index];
    if (status !== STATUS.WATCH && status !== STATUS.ALERT) {
      // A day with nothing recorded ends the run rather than being counted
      // through. "Five days running" is a claim about five days that were
      // seen, and a gap is not evidence that the stretch continued.
      break;
    }
    run += 1;
  }

  return run;
}

/**
 * The month in a sentence.
 *
 * This replaced a line chart. The chart scaled itself to whatever range the
 * days happened to cover, so a heart rate wandering between 68 and 72 drew
 * exactly the same dramatic peaks as one swinging from 50 to 90 — a picture
 * whose most eye-catching feature carried no information at all. Counting the
 * days that were actually off cannot be misread that way, and it answers the
 * question the shape was only gesturing at.
 */
export function trendSentence(statuses) {
  const judged = statuses.filter((status) => status !== STATUS.COLLECTING);
  // Under a week of verdicts, "off on 2 of 3 days" reads as a trend when it
  // is barely more than the day already on screen.
  if (judged.length < 7) return '';

  const off = judged.filter(
    (status) => status === STATUS.WATCH || status === STATUS.ALERT,
  ).length;

  if (off === 0) {
    // Phrased as "nothing was flagged", not "every day was the same". The
    // difference showed up on a card reading "You slept longer than you
    // usually do" directly above "In your usual range on all of the last 15
    // recorded days" — two true statements that read as a contradiction,
    // because one was about today's direction and the other about how many
    // days were worth flagging. A sentence has to be right about what a
    // reader will take it to mean, not only about what it counts.
    return `Nothing off your usual in the last ${judged.length} recorded days.`;
  }

  // A run is worth more than a tally, so it leads. The coloured marks above
  // the sentence are its evidence: the last few are visibly not green.
  const run = runOfOffDays(statuses);
  const tally = `${off} of the last ${judged.length} recorded days`;

  return run >= RUN_WORTH_MENTIONING
    ? `Off your usual ${run} days running — ${tally} in all.`
    : `Off your usual on ${tally}.`;
}

/**
 * Whether your usual itself has moved.
 *
 * Said only when the gap is unusual for this metric, on the same footing as
 * everything else: measured against how far a week normally drifts from its
 * season, not against a number somebody picked.
 */
export function driftSentence(drift) {
  if (drift === undefined || drift === null) return '';
  const { gap, typical } = drift;
  if (gap === null || typical === null || typical <= 0) return '';
  if (Math.abs(gap) < typical * THRESHOLDS.WATCH) return '';

  const percent = Math.abs(Math.round(gap * 100));
  if (percent === 0) return '';

  return `This week is running ${percent}% ${
    gap > 0 ? 'above' : 'below'
  } your last three months.`;
}

/**
 * The blank nights, accounted for.
 *
 * The three causes call for three different responses — wear the watch, wear
 * it all night, or go and look at the sleep settings — so they are counted
 * separately rather than added up into "no data".
 */
export function missingNightsSentence({ total, off, partly, worn }) {
  if (total === 0) return 'Every recent night has a sleep figure.';

  const parts = [];
  if (off > 0) parts.push(`the watch was off for ${off}`);
  if (partly > 0) parts.push(`on for part of the night for ${partly}`);
  if (worn > 0) parts.push(`on all night for ${worn}`);
  if (parts.length === 0) return `${total} recent nights have no sleep figure.`;

  const settings =
    worn > 0
      ? ` The last ${
          worn === 1 ? 'one is' : 'ones are'
        } a settings problem rather than a habit — the watch was there and recorded nothing.`
      : '';

  return `Of the ${total} recent nights with no sleep recorded, ${joinList(
    parts,
  )}.${settings}`;
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
/** The same sentence, in either voice. Structure fixed, wording swapped. */
const SUMMARY_VOICES = {
  plain: {
    nothingYet: 'Still learning your normal',
    allUsual: 'Everything is where it usually is',
    partlyUsual: 'Nothing unusual so far — still learning ',
    alert: 'well off your usual',
    watch: 'a little off',
    tail: ' — the rest looks typical',
  },
  playful: {
    nothingYet: 'Still working out what normal looks like for you',
    allUsual: 'Nothing to report today',
    partlyUsual: 'So far so good — still getting to know ',
    alert: 'properly off',
    watch: 'a bit off',
    tail: ' — the rest is behaving',
  },
};

export function summaryFor(readings, voice = 'plain') {
  const said = SUMMARY_VOICES[voice] ?? SUMMARY_VOICES.plain;

  const graded = readings.filter(({ status }) => status !== STATUS.COLLECTING);
  if (graded.length === 0) return said.nothingYet;

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
      ? said.allUsual
      : // The labels carry their own "your", so this must not add another.
        `${said.partlyUsual}${joinList(stillCollecting)}`;
  }

  // Naming every one of six is a paragraph, not a summary — past three the
  // count says more than the list does, and the cards below hold the detail.
  const clause = (labels, verdict) => {
    if (labels.length === readings.length) return `everything is ${verdict}`;
    const subject =
      labels.length <= 3
        ? joinList(labels)
        : `${labels.length} of the ${readings.length}`;
    return `${subject} ${labels.length === 1 ? 'is' : 'are'} ${verdict}`;
  };

  const clauses = [];
  if (alert.length > 0) clauses.push(clause(alert, said.alert));
  if (watch.length > 0) clauses.push(clause(watch, said.watch));

  let sentence = capitalise(clauses.join(', and '));

  // Only claim the rest is fine when the rest really is all green. With a
  // metric still collecting, there is something the app cannot vouch for.
  const everythingElseIsGood =
    graded.length === readings.length &&
    graded.length > alert.length + watch.length;
  if (everythingElseIsGood) {
    sentence += said.tail;
  }

  return sentence;
}

/** e.g. 0.064 -> "+6%". Rounded, because false precision invites reading in. */
export function formatDeviation(deviation) {
  const percent = Math.round(deviation * 100);
  return `${percent > 0 ? '+' : ''}${percent}%`;
}

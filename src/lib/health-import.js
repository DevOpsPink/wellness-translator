/**
 * Reading a real Apple Health export.
 *
 * The export is one `export.xml` inside export.zip, and it is enormous — a
 * few years of a watch writing every heartbeat runs to well over a gigabyte.
 * It cannot be read into a string, and it cannot go through DOMParser. So it
 * is streamed: chunk in, lines out, and the three record types we care about
 * plucked out as they pass. Everything else is dropped without ever being
 * looked at twice.
 */

/** The record types worth stopping for, out of the dozens in the file. */
const WANTED = new Map([
  ['HKQuantityTypeIdentifierRestingHeartRate', 'restingHeartRate'],
  ['HKQuantityTypeIdentifierHeartRateVariabilitySDNN', 'hrv'],
  ['HKCategoryTypeIdentifierSleepAnalysis', 'sleep'],
]);

/**
 * A day whose sleep adds up to less than this is treated as unrecorded.
 *
 * Real exports are full of days holding six or eight minutes of "asleep" —
 * a watch picked up briefly, or taken off in the night. That is missing data
 * wearing the costume of a number. Passed through, it reads as 98% below a
 * seven-hour baseline and lights up red: a false alarm manufactured out of an
 * absence. Above an hour the figure is taken at its word — a three-hour night
 * is a real three-hour night, and worth saying so.
 */
const MIN_CREDIBLE_SLEEP_HOURS = 1;

/** "2021-01-21 13:38:24 -0400" */
const STAMP =
  /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2}) ([+-])(\d{2})(\d{2})$/;

/**
 * Split a timestamp into the two things we need from it.
 *
 * `epoch` is an absolute instant, for working out whether two sleep segments
 * overlap. `date` is the wall clock date as it was written — which is the one
 * a person means by "Tuesday", even if they were in another time zone that
 * week. Keeping both is what makes travel and clock changes harmless.
 */
function parseStamp(text) {
  const m = STAMP.exec(text);
  if (m === null) return null;

  const [, year, month, day, hour, minute, second, sign, offHours, offMins] = m;
  const offsetMinutes =
    (sign === '-' ? -1 : 1) * (Number(offHours) * 60 + Number(offMins));

  return {
    epoch:
      Date.UTC(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour),
        Number(minute),
        Number(second),
      ) -
      offsetMinutes * 60_000,
    date: `${year}-${month}-${day}`,
  };
}

/** Pull one attribute out of a record line without parsing the whole tag. */
function attribute(line, name) {
  const key = ` ${name}="`;
  const start = line.indexOf(key);
  if (start === -1) return null;
  const from = start + key.length;
  const to = line.indexOf('"', from);
  return to === -1 ? null : line.slice(from, to);
}

/** Read the file line by line, reporting progress as bytes go past. */
async function forEachLine(file, onLine, onProgress) {
  const reader = file.stream().getReader();
  const decoder = new TextDecoder();
  let remainder = '';
  let bytesRead = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    bytesRead += value.byteLength;
    const lines = (remainder + decoder.decode(value, { stream: true })).split(
      '\n',
    );
    // The last piece is whatever came before the chunk boundary; it is only a
    // whole line once the next chunk arrives.
    remainder = lines.pop();

    for (const line of lines) onLine(line);
    onProgress(bytesRead / file.size);
  }

  if (remainder.length > 0) onLine(remainder);
}

/**
 * Merge overlapping stretches of sleep into one timeline.
 *
 * A watch and a phone will both happily record the same night, and the watch
 * alone splits a night into dozens of stage segments that butt up against
 * each other. Adding their durations up would invent hours of sleep, so the
 * segments are unioned first and measured afterwards.
 */
function mergeIntervals(intervals) {
  if (intervals.length === 0) return [];

  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged = [sorted[0]];

  for (const current of sorted.slice(1)) {
    const last = merged[merged.length - 1];
    if (current.start <= last.end) {
      // Overlapping or touching: stretch the open interval instead of adding.
      if (current.end > last.end) {
        merged[merged.length - 1] = {
          ...last,
          end: current.end,
          endDate: current.endDate,
        };
      }
    } else {
      merged.push(current);
    }
  }

  return merged;
}

/** Every calendar date from `first` to `last`, so gaps stay visible as gaps. */
function everyDateBetween(first, last) {
  const dates = [];
  const day = new Date(`${first}T00:00:00Z`);
  const end = new Date(`${last}T00:00:00Z`);

  while (day <= end) {
    dates.push(day.toISOString().slice(0, 10));
    day.setUTCDate(day.getUTCDate() + 1);
  }

  return dates;
}

/**
 * Turn an Apple Health export into the daily records the rest of the app
 * already understands: one object per calendar day, one number per metric.
 *
 * Days with nothing recorded are still included, with the metric left
 * undefined. That matters: the baseline counts back seven *days*, not seven
 * entries, so a fortnight of not wearing the watch has to look like a
 * fortnight of missing data rather than quietly closing up.
 *
 * @param file        the export.xml the user picked
 * @param onProgress  called with 0..1 as the file streams past
 */
export async function importAppleHealthExport(file, onProgress = () => {}) {
  const averages = { restingHeartRate: new Map(), hrv: new Map() };
  const sleepSegments = [];
  let recordsRead = 0;

  const addToAverage = (metric, date, value) => {
    const running = averages[metric].get(date) ?? { total: 0, count: 0 };
    running.total += value;
    running.count += 1;
    averages[metric].set(date, running);
  };

  await forEachLine(
    file,
    (line) => {
      // Cheapest possible rejection first: nearly every line in the file is a
      // record we do not want, and this is the only test most of them get.
      const typeAt = line.indexOf('type="HK');
      if (typeAt === -1) return;

      const typeEnd = line.indexOf('"', typeAt + 6);
      const metric = WANTED.get(line.slice(typeAt + 6, typeEnd));
      if (metric === undefined) return;

      const value = attribute(line, 'value');
      const start = parseStamp(attribute(line, 'startDate') ?? '');
      if (value === null || start === null) return;
      recordsRead += 1;

      if (metric === 'sleep') {
        // "InBed" is lying down, not sleeping, and it overlaps the asleep
        // segments it brackets. "Awake" is the opposite. Only Asleep* counts,
        // whether it is the modern Core/Deep/REM or the older Unspecified.
        if (!value.startsWith('HKCategoryValueSleepAnalysisAsleep')) return;

        const end = parseStamp(attribute(line, 'endDate') ?? '');
        if (end === null || end.epoch <= start.epoch) return;

        sleepSegments.push({
          start: start.epoch,
          end: end.epoch,
          // A night belongs to the morning it ends on, which is how a night's
          // sleep lines up with the day that follows it.
          endDate: end.date,
        });
        return;
      }

      const number = Number(value);
      if (Number.isFinite(number)) addToAverage(metric, start.date, number);
    },
    onProgress,
  );

  const sleepHoursByDate = new Map();
  for (const { start, end, endDate } of mergeIntervals(sleepSegments)) {
    const hours = (end - start) / 3_600_000;
    sleepHoursByDate.set(endDate, (sleepHoursByDate.get(endDate) ?? 0) + hours);
  }

  for (const [date, hours] of sleepHoursByDate) {
    if (hours < MIN_CREDIBLE_SLEEP_HOURS) sleepHoursByDate.delete(date);
  }

  const allDates = [
    ...averages.restingHeartRate.keys(),
    ...averages.hrv.keys(),
    ...sleepHoursByDate.keys(),
  ].sort();

  if (allDates.length === 0) {
    throw new Error(
      'No resting heart rate, HRV or sleep records found in that file.',
    );
  }

  const mean = (metric, date) => {
    const running = averages[metric].get(date);
    return running === undefined ? undefined : running.total / running.count;
  };

  const dailyHealthData = everyDateBetween(
    allDates[0],
    allDates[allDates.length - 1],
  ).map((date) => ({
    date,
    restingHeartRate: mean('restingHeartRate', date),
    hrv: mean('hrv', date),
    sleepHours: sleepHoursByDate.get(date),
  }));

  return { dailyHealthData, recordsRead };
}

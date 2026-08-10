import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { importAppleHealthExport } from '../src/lib/health-import.js';

const OFFSET = '-0400';

const record = (type, value, start, end = start, unit = 'count/min') =>
  `<Record type="HKQuantityTypeIdentifier${type}" unit="${unit}" ` +
  `startDate="${start} ${OFFSET}" endDate="${end} ${OFFSET}" value="${value}"/>`;

const sleep = (value, start, end) =>
  `<Record type="HKCategoryTypeIdentifierSleepAnalysis" ` +
  `startDate="${start} ${OFFSET}" endDate="${end} ${OFFSET}" ` +
  `value="HKCategoryValueSleepAnalysis${value}"/>`;

/** Overnight heart rate, which is the evidence that the watch was worn. */
const nightBeats = (date, count) =>
  Array.from({ length: count }, (_, i) =>
    record(
      'HeartRate',
      60,
      `${date} 0${Math.floor(i / 20)}:${String(i % 60).padStart(2, '0')}:00`,
    ),
  ).join('\n');

/** The importer only ever asks a file for `.size` and `.stream()`. */
const asFile = (records) =>
  new Blob([`<?xml version="1.0"?>\n<HealthData>\n${records.join('\n')}\n</HealthData>`]);

const read = (records) => importAppleHealthExport(asFile(records));
const on = (days, date) => days.find((day) => day.date === date);

describe('importAppleHealthExport', () => {
  it('averages readings of a quantity, and adds up daylight', () => {
    // Averaging five-minute daylight chunks would report five minutes a day;
    // adding up a day's heart rates would mean nothing at all.
    const records = [
      record('RestingHeartRate', 60, '2026-03-01 09:00:00'),
      record('RestingHeartRate', 70, '2026-03-01 10:00:00'),
      record('TimeInDaylight', 5, '2026-03-01 09:00:00', '2026-03-01 09:05:00', 'min'),
      record('TimeInDaylight', 5, '2026-03-01 09:05:00', '2026-03-01 09:10:00', 'min'),
      record('TimeInDaylight', 5, '2026-03-01 09:10:00', '2026-03-01 09:15:00', 'min'),
    ];

    return read(records).then(({ dailyHealthData }) => {
      const day = on(dailyHealthData, '2026-03-01');
      assert.equal(day.restingHeartRate, 65);
      assert.equal(day.daylightMinutes, 15);
    });
  });

  it('unions overlapping sleep instead of adding it up', async () => {
    // A watch and a phone both record the same night. Summing durations
    // invented twenty-hour nights.
    const { dailyHealthData } = await read([
      sleep('AsleepCore', '2026-03-04 23:00:00', '2026-03-05 07:00:00'),
      sleep('AsleepUnspecified', '2026-03-04 23:30:00', '2026-03-05 06:30:00'),
    ]);

    assert.equal(on(dailyHealthData, '2026-03-05').sleepHours, 8);
  });

  it('counts only time asleep, not time in bed', async () => {
    // InBed brackets the asleep segments and would double them; Awake is
    // the opposite of what is being measured.
    const { dailyHealthData } = await read([
      sleep('InBed', '2026-03-04 22:00:00', '2026-03-05 08:00:00'),
      sleep('AsleepDeep', '2026-03-04 23:00:00', '2026-03-05 05:00:00'),
      sleep('Awake', '2026-03-05 05:00:00', '2026-03-05 05:30:00'),
    ]);

    assert.equal(on(dailyHealthData, '2026-03-05').sleepHours, 6);
  });

  it('runs from the first day with anything to the last', () => {
    // Days outside that span are not "missing" — they are not days the
    // export knows about at all, and nothing should invent them.
    return read([
      record('RestingHeartRate', 60, '2026-03-03 09:00:00'),
      record('RestingHeartRate', 62, '2026-03-05 09:00:00'),
    ]).then(({ dailyHealthData }) => {
      assert.equal(dailyHealthData.at(0).date, '2026-03-03');
      assert.equal(dailyHealthData.at(-1).date, '2026-03-05');
      assert.equal(on(dailyHealthData, '2026-03-02'), undefined);
    });
  });

  it('files a night under the morning it ends on', async () => {
    const { dailyHealthData } = await read([
      record('RestingHeartRate', 60, '2026-03-04 09:00:00'), // anchors the span
      sleep('AsleepCore', '2026-03-04 23:00:00', '2026-03-05 07:00:00'),
    ]);

    assert.equal(on(dailyHealthData, '2026-03-04').sleepHours, undefined);
    assert.equal(on(dailyHealthData, '2026-03-05').sleepHours, 8);
  });

  it('treats a few minutes of sleep as no reading at all', async () => {
    // Exports are full of six-minute "nights" — a watch picked up briefly.
    // At face value that reads as 98% below baseline and lights up red.
    const { dailyHealthData } = await read([
      record('RestingHeartRate', 60, '2026-03-05 09:00:00'), // anchors the span
      sleep('AsleepCore', '2026-03-05 03:00:00', '2026-03-05 03:30:00'),
      sleep('AsleepCore', '2026-03-06 23:00:00', '2026-03-07 06:00:00'),
    ]);

    assert.equal(on(dailyHealthData, '2026-03-05').sleepHours, undefined);
    assert.equal(on(dailyHealthData, '2026-03-07').sleepHours, 7);
  });

  it('files a long reading under the day it mostly covers', async () => {
    // A resting heart rate spans thirteen hours on average and about one in
    // ten crosses midnight. Filing by start put a reading mostly taken on
    // Tuesday under Monday.
    const { dailyHealthData } = await read([
      // A different metric anchors the span, so the day under test can still
      // be shown to have no heart rate of its own.
      record('TimeInDaylight', 5, '2026-03-01 12:00:00', '2026-03-01 12:05:00', 'min'),
      record('RestingHeartRate', 58, '2026-03-01 19:00:00', '2026-03-02 15:00:00'),
    ]);

    assert.equal(on(dailyHealthData, '2026-03-01').restingHeartRate, undefined);
    assert.equal(on(dailyHealthData, '2026-03-02').restingHeartRate, 58);
  });

  it('emits the empty days between readings', async () => {
    // The baseline counts back seven days, not seven entries, so a fortnight
    // of nothing has to look like a fortnight.
    const { dailyHealthData } = await read([
      record('RestingHeartRate', 60, '2026-03-01 09:00:00'),
      record('RestingHeartRate', 62, '2026-03-11 09:00:00'),
    ]);

    assert.equal(dailyHealthData.length, 11);
    assert.equal(on(dailyHealthData, '2026-03-05').restingHeartRate, undefined);
  });

  it('takes units from the file rather than assuming them', async () => {
    // The export uses whatever the phone is set to, so a walking speed can
    // arrive as km/hr or mi/hr.
    const { units } = await read([
      record('WalkingSpeed', 3.1, '2026-03-01 09:00:00', '2026-03-01 09:01:00', 'mi/hr'),
    ]);

    assert.equal(units.walkingSpeed, 'mph');
  });

  it('reports progress all the way to the end', async () => {
    const seen = [];
    await importAppleHealthExport(
      asFile([record('RestingHeartRate', 60, '2026-03-01 09:00:00')]),
      (fraction) => seen.push(fraction),
    );

    assert.equal(seen.at(-1), 1);
  });

  it('refuses a file with nothing it can use', async () => {
    await assert.rejects(() => read([record('StepCount', 900, '2026-03-01 09:00:00')]));
  });
});

describe('was the watch on the wrist', () => {
  const night = (date, beats) => [
    record('RestingHeartRate', 60, `${date} 09:00:00`),
    nightBeats(date, beats),
  ];

  it('reads a full night of heart rate as worn', async () => {
    const { dailyHealthData } = await read(night('2026-03-01', 40));
    assert.equal(on(dailyHealthData, '2026-03-01').wristOvernight, 'worn');
  });

  it('reads a handful of readings as worn for part of the night', async () => {
    const { dailyHealthData } = await read(night('2026-03-01', 5));
    assert.equal(on(dailyHealthData, '2026-03-01').wristOvernight, 'partly');
  });

  it('reads none as off, once there is heart rate elsewhere to compare', async () => {
    const { dailyHealthData } = await read([
      ...night('2026-03-01', 40),
      record('RestingHeartRate', 61, '2026-03-02 09:00:00'),
    ]);

    assert.equal(on(dailyHealthData, '2026-03-02').wristOvernight, 'off');
  });

  it('says unknown when the export holds no heart rate at all', async () => {
    // Absence of the signal is not the signal. Told otherwise, the app
    // claimed confidently that the watch had been off on every single night.
    const { dailyHealthData } = await read([
      sleep('AsleepCore', '2026-03-04 23:00:00', '2026-03-05 07:00:00'),
    ]);

    assert.equal(on(dailyHealthData, '2026-03-05').wristOvernight, 'unknown');
  });
});

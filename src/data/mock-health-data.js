/**
 * Mock Apple Health data — 10 consecutive days, oldest first.
 *
 * This is the shape a real Apple Health export is reduced to: one record per
 * day, one number per metric. The importer produces exactly this, so the
 * sample view exercises the same code path as a real file.
 *
 * Units: restingHeartRate and walkingHeartRate = bpm, hrv = ms (SDNN),
 * sleepHours = hours, walkingSpeed = km/h, daylightMinutes = minutes.
 */
export const dailyHealthData = [
  // prettier-ignore
  { date: '2026-07-26', restingHeartRate: 57, hrv: 59, sleepHours: 7.1, walkingHeartRate: 102, walkingSpeed: 5.0, daylightMinutes: 100 },
  // prettier-ignore
  { date: '2026-07-27', restingHeartRate: 56, hrv: 61, sleepHours: 7.4, walkingHeartRate: 101, walkingSpeed: 5.1, daylightMinutes: 115 },
  // prettier-ignore
  { date: '2026-07-28', restingHeartRate: 55, hrv: 62, sleepHours: 7.5, walkingHeartRate: 101, walkingSpeed: 5.1, daylightMinutes: 95 },
  // prettier-ignore
  { date: '2026-07-29', restingHeartRate: 56, hrv: 58, sleepHours: 7.2, walkingHeartRate: 103, walkingSpeed: 5.0, daylightMinutes: 120 },
  // prettier-ignore
  { date: '2026-07-30', restingHeartRate: 54, hrv: 65, sleepHours: 7.8, walkingHeartRate: 100, walkingSpeed: 5.2, daylightMinutes: 80 },
  // prettier-ignore
  { date: '2026-07-31', restingHeartRate: 57, hrv: 60, sleepHours: 7.0, walkingHeartRate: 102, walkingSpeed: 4.9, daylightMinutes: 140 },
  // prettier-ignore
  { date: '2026-08-01', restingHeartRate: 55, hrv: 63, sleepHours: 7.6, walkingHeartRate: 101, walkingSpeed: 5.1, daylightMinutes: 110 },
  // prettier-ignore
  { date: '2026-08-02', restingHeartRate: 56, hrv: 59, sleepHours: 7.4, walkingHeartRate: 103, walkingSpeed: 5.0, daylightMinutes: 90 },
  // prettier-ignore
  { date: '2026-08-03', restingHeartRate: 55, hrv: 61, sleepHours: 7.3, walkingHeartRate: 102, walkingSpeed: 5.1, daylightMinutes: 105 },
  // Today: a short night. Sleep is well down, resting heart rate is up a
  // little, the walk was slower — and a long time outside, which is the sort
  // of day that produces exactly this combination.
  // prettier-ignore
  { date: '2026-08-04', restingHeartRate: 59, hrv: 60, sleepHours: 6.2, walkingHeartRate: 102, walkingSpeed: 4.75, daylightMinutes: 140 },
];

/** The most recent day — the one shown on screen. */
export function getLatestDay() {
  return dailyHealthData[dailyHealthData.length - 1];
}

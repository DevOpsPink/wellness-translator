/**
 * Mock Apple Health data — 10 consecutive days, oldest first.
 *
 * This is the shape a real Apple Health export will be reduced to:
 * one record per day, one number per metric. Keeping the mock in the same
 * shape means the parser we write later can drop straight in here.
 *
 * Units: restingHeartRate = bpm, hrv = ms (SDNN), sleepHours = hours
 */
export const dailyHealthData = [
  { date: '2026-07-26', restingHeartRate: 57, hrv: 59, sleepHours: 7.1 },
  { date: '2026-07-27', restingHeartRate: 56, hrv: 61, sleepHours: 7.4 },
  { date: '2026-07-28', restingHeartRate: 55, hrv: 62, sleepHours: 7.5 },
  { date: '2026-07-29', restingHeartRate: 56, hrv: 58, sleepHours: 7.2 },
  { date: '2026-07-30', restingHeartRate: 54, hrv: 65, sleepHours: 7.8 },
  { date: '2026-07-31', restingHeartRate: 57, hrv: 60, sleepHours: 7.0 },
  { date: '2026-08-01', restingHeartRate: 55, hrv: 63, sleepHours: 7.6 },
  { date: '2026-08-02', restingHeartRate: 56, hrv: 59, sleepHours: 7.4 },
  { date: '2026-08-03', restingHeartRate: 55, hrv: 61, sleepHours: 7.3 },
  // Today: a short night. Sleep is well down, resting heart rate is up a
  // little — the pattern the app is meant to catch.
  { date: '2026-08-04', restingHeartRate: 59, hrv: 60, sleepHours: 6.2 },
];

/** The most recent day — the one shown on screen. */
export function getLatestDay() {
  return dailyHealthData[dailyHealthData.length - 1];
}

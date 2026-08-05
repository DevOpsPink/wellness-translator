/**
 * The month behind today's number.
 *
 * A single reading says almost nothing on its own. "34 ms" reads one way if
 * last month was 33, and quite another if it was 45 and has been sliding ever
 * since — and the card cannot tell you which without showing the run-up.
 *
 * Deliberately plain: no axes, no grid, no labels. The exact figures are
 * already written above it in text; this is only the shape.
 */

/** How far back the line reaches. */
export const SPARKLINE_DAYS = 30;

const WIDTH = 240;
const HEIGHT = 34;
const PAD = 4;

/**
 * Build the SVG for one metric's recent run.
 *
 * @param values   oldest to newest, `undefined` where nothing was recorded.
 *                 The last entry is the day on screen.
 * @param baseline the personal average the day is judged against, or null
 * @returns SVG markup, or '' when there is too little to draw
 */
export function sparkline(values, baseline) {
  const measured = values.filter(Number.isFinite);
  if (measured.length < 2) return '';

  // Scaled to the range actually present, not to zero. These are deviations
  // from a personal normal, and a chart anchored at zero would flatten every
  // one of them into a straight line.
  let low = Math.min(...measured, ...(Number.isFinite(baseline) ? [baseline] : []));
  let high = Math.max(...measured, ...(Number.isFinite(baseline) ? [baseline] : []));
  if (high === low) {
    low -= 1;
    high += 1;
  }
  const margin = (high - low) * 0.12;
  low -= margin;
  high += margin;

  const x = (index) =>
    PAD + (index / (values.length - 1)) * (WIDTH - PAD * 2);
  const y = (value) =>
    HEIGHT - PAD - ((value - low) / (high - low)) * (HEIGHT - PAD * 2);

  // Days with no reading break the line rather than being bridged over: a
  // gap is missing data, and joining across it would draw a week that never
  // happened.
  const segments = [];
  let current = [];
  values.forEach((value, index) => {
    if (Number.isFinite(value)) {
      current.push(`${x(index).toFixed(1)},${y(value).toFixed(1)}`);
    } else if (current.length > 0) {
      segments.push(current);
      current = [];
    }
  });
  if (current.length > 0) segments.push(current);

  const lines = segments
    .filter((points) => points.length > 1)
    .map((points) => `<polyline points="${points.join(' ')}" />`)
    .join('');

  // Lone readings with a gap either side would vanish as zero-length lines.
  const orphans = segments
    .filter((points) => points.length === 1)
    .map((points) => {
      const [px, py] = points[0].split(',');
      return `<circle class="spark__orphan" cx="${px}" cy="${py}" r="1.4" />`;
    })
    .join('');

  const rule =
    Number.isFinite(baseline) && baseline >= low && baseline <= high
      ? `<line class="spark__baseline" x1="${PAD}" y1="${y(baseline).toFixed(
          1,
        )}" x2="${WIDTH - PAD}" y2="${y(baseline).toFixed(1)}" />`
      : '';

  // The marker belongs to the day on screen and to no other. When that day
  // has no reading there is nothing to mark: putting the dot on the most
  // recent measurement instead would point confidently at the wrong day.
  const today = values[values.length - 1];
  const marker = Number.isFinite(today)
    ? `<circle class="spark__today" cx="${x(values.length - 1).toFixed(
        1,
      )}" cy="${y(today).toFixed(1)}" r="2.6" />`
    : '';

  return `<svg class="spark" viewBox="0 0 ${WIDTH} ${HEIGHT}" preserveAspectRatio="none" aria-hidden="true">${rule}${lines}${orphans}${marker}</svg>`;
}

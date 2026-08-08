/**
 * The whole day as one ring.
 *
 * Six cards is six sentences, and six sentences is reading rather than
 * glancing. The ring answers the first question — how is today — before any
 * of them are read: all green and there is nothing to look into, a wedge of
 * amber or red and you already know how much of the day it covers.
 *
 * One segment per card, all the same size, in the same order as the cards
 * below. Equal segments rather than proportions on purpose: they can be
 * counted, and each one is a card you can go and read.
 */

const SIZE = 72;
const STROKE = 9;

/**
 * Degrees of blank between segments.
 *
 * Paired with square-cut ends in the stylesheet. Rounded ends looked better
 * but each one bulges half the stroke width past where the arc stops, which
 * at this size is wider than the gap — the segments ran together into one
 * unbroken ring and stopped being countable, which was the point of them.
 */
const GAP = 7;

/** Where a segment starts and ends, in SVG arc terms. */
function arc(centre, radius, fromDegrees, toDegrees) {
  const point = (degrees) => {
    // -90 so the first segment starts at the top rather than at 3 o'clock.
    const radians = ((degrees - 90) * Math.PI) / 180;
    return [
      centre + radius * Math.cos(radians),
      centre + radius * Math.sin(radians),
    ];
  };

  const [startX, startY] = point(fromDegrees);
  const [endX, endY] = point(toDegrees);
  const sweep = toDegrees - fromDegrees > 180 ? 1 : 0;

  return `M ${startX.toFixed(2)} ${startY.toFixed(2)} A ${radius} ${radius} 0 ${sweep} 1 ${endX.toFixed(2)} ${endY.toFixed(2)}`;
}

/**
 * @param statuses one per card, in card order
 * @returns SVG markup, or '' when there is nothing to draw
 */
export function donut(statuses) {
  if (statuses.length === 0) return '';

  const centre = SIZE / 2;
  const radius = centre - STROKE / 2;
  const slice = 360 / statuses.length;

  const segments = statuses
    .map((status, index) => {
      const from = index * slice + GAP / 2;
      const to = (index + 1) * slice - GAP / 2;
      return `<path class="ring__part ring__part--${status}" d="${arc(
        centre,
        radius,
        from,
        to,
      )}" />`;
    })
    .join('');

  return `<svg class="ring" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}" aria-hidden="true">${segments}</svg>`;
}

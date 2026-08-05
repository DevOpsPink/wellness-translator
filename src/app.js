/**
 * Entry point: work out where today sits against your baseline, then put
 * three cards on the page.
 */
import { dailyHealthData } from './data/mock-health-data.js';
import { rollingBaseline } from './lib/baseline.js';
import {
  METRICS,
  compareToBaseline,
  formatDeviation,
  phraseFor,
  summaryFor,
} from './lib/metrics.js';

/**
 * Dev aid: `?days=3` pretends only the first three days were ever recorded.
 * It is how you look at the "collecting data" state without editing the mock.
 */
function historyToShow(records) {
  const requested = Number(new URLSearchParams(location.search).get('days'));
  return Number.isInteger(requested) && requested > 0
    ? records.slice(0, requested)
    : records;
}

/** Everything one card needs to know, worked out in one place. */
function readMetric(records, metric) {
  const today = records[records.length - 1];
  const value = today[metric.id];
  const { average, days } = rollingBaseline(records, metric.id);
  const { status, deviation } = compareToBaseline(metric, value, average);

  return { metric, value, baseline: average, days, status, deviation };
}

function createCard({ metric, value, baseline, days, status, deviation }) {
  const card = document.createElement('article');
  card.className = `card card--${status}`;

  // Only shown once there is a baseline to compare against — before that
  // there is nothing honest to put here.
  const comparison =
    baseline === null
      ? ''
      : `<p class="card__baseline">Usually ${metric.format(baseline)} ${
          metric.unit
        } · ${formatDeviation(deviation)}</p>`;

  card.innerHTML = `
    <span class="card__dot" aria-hidden="true"></span>
    <h2 class="card__label">${metric.label}</h2>
    <p class="card__value">
      ${metric.format(value)}<span class="card__unit">${metric.unit}</span>
    </p>
    ${comparison}
    <p class="card__status">${phraseFor(metric, status, { days })}</p>
  `;

  return card;
}

function render() {
  const records = historyToShow(dailyHealthData);
  const today = records[records.length - 1];

  // The date the numbers describe — not "now". They are not the same thing
  // once we are reading a file that was exported days ago.
  document.getElementById('summary-date').textContent = new Date(
    `${today.date}T00:00:00`,
  ).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const readings = METRICS.map((metric) => readMetric(records, metric));

  document.getElementById('summary-verdict').textContent =
    summaryFor(readings);

  const container = document.getElementById('cards');
  for (const reading of readings) {
    container.append(createCard(reading));
  }
}

render();

/**
 * Entry point: read today's numbers, build three cards, put them on the page.
 */
import { getLatestDay } from './data/mock-health-data.js';
import { METRICS, STATUS_LABEL, getStatus } from './lib/metrics.js';

/** Build one card element for a metric. */
function createCard(metric, value, status) {
  const card = document.createElement('article');
  card.className = `card card--${status}`;

  card.innerHTML = `
    <span class="card__dot" aria-hidden="true"></span>
    <h2 class="card__label">${metric.label}</h2>
    <p class="card__value">
      ${metric.format(value)}<span class="card__unit">${metric.unit}</span>
    </p>
    <p class="card__status">${STATUS_LABEL[status]}</p>
  `;

  return card;
}

function render() {
  const today = getLatestDay();

  // The date the numbers describe — not "now". They are not the same thing
  // once we are reading a file that was exported days ago.
  document.getElementById('summary-date').textContent = new Date(
    `${today.date}T00:00:00`,
  ).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const container = document.getElementById('cards');
  for (const metric of METRICS) {
    container.append(createCard(metric, today[metric.id], getStatus(metric.id)));
  }
}

render();

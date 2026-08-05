/**
 * Entry point: get some daily data from somewhere, work out where the latest
 * day sits against its baseline, then put three cards on the page.
 */
import { dailyHealthData as sampleData } from './data/mock-health-data.js';
import { rollingBaseline } from './lib/baseline.js';
import { importAppleHealthExport } from './lib/health-import.js';
import * as stored from './lib/stored-data.js';
import {
  METRICS,
  compareToBaseline,
  formatDeviation,
  phraseFor,
  summaryFor,
} from './lib/metrics.js';

const el = (id) => document.getElementById(id);

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
  const { status, deviation, worse, reason } = compareToBaseline(
    metric,
    value,
    average,
  );

  return {
    metric,
    value,
    baseline: average,
    days,
    status,
    deviation,
    worse,
    reason,
    wristOvernight: today.wristOvernight ?? null,
  };
}

function createCard(reading) {
  const { metric, value, baseline, deviation, status } = reading;

  const card = document.createElement('article');
  card.className = `card card--${status}`;

  // Only shown once there is both a reading and a baseline to compare it
  // against — before that there is nothing honest to put here.
  const comparison =
    baseline === null || !Number.isFinite(value)
      ? ''
      : `<p class="card__baseline">Usually ${metric.format(baseline)} ${
          metric.unit
        } · ${formatDeviation(deviation)}</p>`;

  card.innerHTML = `
    <span class="card__dot" aria-hidden="true"></span>
    <h2 class="card__label">${metric.label}</h2>
    <p class="card__value">
      ${Number.isFinite(value) ? metric.format(value) : '—'}<span
        class="card__unit"
        >${Number.isFinite(value) ? metric.unit : ''}</span
      >
    </p>
    ${comparison}
    <p class="card__status">${phraseFor(metric, status, reading)}</p>
  `;

  return card;
}

function show(records, source) {
  const history = historyToShow(records);
  const today = history[history.length - 1];

  // The date the numbers describe — not "now". They are not the same thing
  // once we are reading a file that was exported days ago.
  el('summary-date').textContent = new Date(
    `${today.date}T00:00:00`,
  ).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const readings = METRICS.map((metric) => readMetric(history, metric));
  el('summary-verdict').textContent = summaryFor(readings);
  el('cards').replaceChildren(...readings.map(createCard));

  el('footer-source').textContent = source;
  el('import').hidden = true;
  el('summary').hidden = false;
  el('footer').hidden = false;
}

function showImport() {
  el('summary').hidden = true;
  el('footer').hidden = true;
  el('cards').replaceChildren();
  el('import').hidden = false;
  el('import-status').hidden = true;
  el('file-input').value = '';
}

async function loadFile(file) {
  const status = el('import-status');
  status.hidden = false;
  status.textContent = 'Reading…';

  try {
    const started = performance.now();
    const { dailyHealthData, recordsRead } = await importAppleHealthExport(
      file,
      (fraction) => {
        status.textContent = `Reading… ${Math.round(fraction * 100)}%`;
      },
    );

    const seconds = ((performance.now() - started) / 1000).toFixed(1);
    const { saved } = stored.save(dailyHealthData);

    show(
      dailyHealthData,
      `${recordsRead.toLocaleString()} records over ${dailyHealthData.length.toLocaleString()} days, read in ${seconds}s.${
        saved ? '' : ' Could not be saved for next time.'
      }`,
    );
  } catch (error) {
    status.textContent = `Could not read that file: ${error.message}`;
  }
}

el('file-input').addEventListener('change', (event) => {
  const [file] = event.target.files;
  if (file) loadFile(file);
});

el('use-sample').addEventListener('click', () => {
  show(sampleData, 'Sample data, not yours.');
});

el('another-file').addEventListener('click', showImport);

el('forget').addEventListener('click', () => {
  stored.forget();
  showImport();
});

const remembered = stored.load();
if (remembered !== null) {
  const when = new Date(remembered.importedAt).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
  });
  show(
    remembered.dailyHealthData,
    `${remembered.dailyHealthData.length.toLocaleString()} days, imported ${when}.`,
  );
}

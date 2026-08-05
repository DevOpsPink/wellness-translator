/**
 * Entry point: get some daily data from somewhere, work out where the chosen
 * day sits against its baseline, then put three cards on the page.
 */
import { dailyHealthData as sampleData } from './data/mock-health-data.js';
import { rollingBaseline } from './lib/baseline.js';
import { importAppleHealthExport } from './lib/health-import.js';
import { SPARKLINE_DAYS, sparkline } from './lib/sparkline.js';
import * as stored from './lib/stored-data.js';
import {
  METRICS,
  compareToBaseline,
  formatDeviation,
  phraseFor,
  summaryFor,
} from './lib/metrics.js';

const el = (id) => document.getElementById(id);

/** What is on screen: the loaded days, and which one is being looked at. */
let days = [];
let selected = 0;
/** Units as the export wrote them — km/h or mph, depending on the phone. */
let units = {};

const unitFor = (metric) => units[metric.id] ?? metric.unit;

/** Everything one card needs to know, worked out in one place. */
function readMetric(records, index, metric) {
  const day = records[index];
  const value = day[metric.id];
  const { average, days: history } = rollingBaseline(records, metric.id, index);
  const { status, deviation, worse, reason } = compareToBaseline(
    metric,
    value,
    average,
  );

  return {
    metric,
    value,
    baseline: average,
    days: history,
    status,
    deviation,
    worse,
    reason,
    wristOvernight: day.wristOvernight ?? null,
    recent: records
      .slice(Math.max(0, index - SPARKLINE_DAYS + 1), index + 1)
      .map((record) => record[metric.id]),
  };
}

function createCard(reading) {
  const { metric, value, baseline, deviation, status, recent } = reading;

  const card = document.createElement('article');
  card.className = `card card--${status}`;

  // Only shown once there is both a reading and a baseline to compare it
  // against — before that there is nothing honest to put here.
  const comparison =
    baseline === null || !Number.isFinite(value)
      ? ''
      : `<p class="card__baseline">Usually ${metric.format(baseline)} ${unitFor(
          metric,
        )} · ${formatDeviation(deviation)}</p>`;

  card.innerHTML = `
    <span class="card__dot" aria-hidden="true"></span>
    <h2 class="card__label">${metric.label}</h2>
    <p class="card__value">
      ${Number.isFinite(value) ? metric.format(value) : '—'}<span
        class="card__unit"
        >${Number.isFinite(value) ? unitFor(metric) : ''}</span
      >
    </p>
    ${comparison}
    <p class="card__status">${phraseFor(metric, status, reading)}</p>
    ${sparkline(recent, baseline)}
  `;

  return card;
}

function render() {
  const day = days[selected];

  // The date the numbers describe — not "now". They are not the same thing
  // once we are reading a file that was exported days ago.
  el('summary-date').textContent = new Date(
    `${day.date}T00:00:00`,
  ).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const readings = METRICS.map((metric) => readMetric(days, selected, metric));
  el('summary-verdict').textContent = summaryFor(readings);
  el('cards').replaceChildren(...readings.map(createCard));

  el('day-back').disabled = selected === 0;
  el('day-forward').disabled = selected === days.length - 1;
  el('day-latest').hidden = selected === days.length - 1;
}

/** Move through the history, stopping at either end. */
function goTo(index) {
  const clamped = Math.min(Math.max(index, 0), days.length - 1);
  if (clamped === selected) return;
  selected = clamped;
  render();
}

/**
 * Which day to open on.
 *
 * Not the last one in the file. An export is made partway through a day, so
 * its final entry has whatever had synced by then — often a heart rate and
 * nothing else. Opening on a screen of dashes makes the app look broken when
 * it is only early. So it opens on the most recent day that has most of its
 * readings in, and the forward arrow still reaches today.
 */
function mostRecentFullDay(records) {
  // Strictly more than half. Exactly half is what the trailing partial day
  // tends to have, which is the day this exists to skip.
  const enough = Math.floor(METRICS.length / 2) + 1;

  for (let index = records.length - 1; index >= 0; index -= 1) {
    const present = METRICS.filter((metric) =>
      Number.isFinite(records[index][metric.id]),
    ).length;
    if (present >= enough) return index;
  }

  return records.length - 1;
}

function show(records, source, recordedUnits = {}) {
  days = records;
  selected = mostRecentFullDay(records);
  units = recordedUnits;

  el('footer-source').textContent = source;
  el('import').hidden = true;
  el('summary').hidden = false;
  el('footer').hidden = false;
  render();
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
    const { dailyHealthData, recordsRead, units: found } =
      await importAppleHealthExport(file, (fraction) => {
        status.textContent = `Reading… ${Math.round(fraction * 100)}%`;
      });

    const seconds = ((performance.now() - started) / 1000).toFixed(1);
    const { saved } = stored.save(dailyHealthData, found);

    show(
      dailyHealthData,
      `${recordsRead.toLocaleString()} records over ${dailyHealthData.length.toLocaleString()} days, read in ${seconds}s.${
        saved ? '' : ' Could not be saved for next time.'
      }`,
      found,
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

el('day-back').addEventListener('click', () => goTo(selected - 1));
el('day-forward').addEventListener('click', () => goTo(selected + 1));
el('day-latest').addEventListener('click', () => goTo(days.length - 1));

// Arrow keys, because anyone reading a run of days will reach for them.
document.addEventListener('keydown', (event) => {
  if (el('summary').hidden) return;
  if (event.metaKey || event.ctrlKey || event.altKey) return;

  if (event.key === 'ArrowLeft') {
    goTo(selected - 1);
  } else if (event.key === 'ArrowRight') {
    goTo(selected + 1);
  } else {
    return;
  }
  event.preventDefault();
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
    remembered.units,
  );
}

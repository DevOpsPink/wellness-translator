/**
 * Entry point: get some daily data from somewhere, work out where the chosen
 * day sits against its baseline, then put three cards on the page.
 */
import { sampleHealthData } from './data/sample-data.js';
import {
  driftSeries,
  rollingBaseline,
  typicalDeviations,
} from './lib/baseline.js';
import { coverage, missingNights } from './lib/coverage.js';
import { importAppleHealthExport } from './lib/health-import.js';
import * as stored from './lib/stored-data.js';
import { openHealthExport } from './lib/zip.js';
import {
  METRICS,
  TREND_DAYS,
  compareToBaseline,
  driftSentence,
  formatDeviation,
  missingNightsSentence,
  phraseFor,
  summaryFor,
  trendSentence,
} from './lib/metrics.js';

const el = (id) => document.getElementById(id);

/** What is on screen: the loaded days, and which one is being looked at. */
let days = [];
let selected = 0;
/** Units as the export wrote them — km/h or mph, depending on the phone. */
let units = {};
/**
 * How far an ordinary day sits from baseline, per metric, per day. Worked out
 * once when the data arrives: it walks the whole history and is unchanged by
 * which day happens to be on screen.
 */
let ordinary = {};
/** This week against the last three months, per metric, per day. */
let drift = {};

const unitFor = (metric) => units[metric.id] ?? metric.unit;

/** Everything one card needs to know, worked out in one place. */
function readMetric(records, index, metric) {
  const day = records[index];
  const value = day[metric.id];
  const { average, days: history } = rollingBaseline(records, metric.id, index);
  const {
    status,
    deviation,
    worse,
    ordinary: typical,
    reason,
  } = compareToBaseline(metric, value, average, ordinary[metric.id]?.[index]);

  return {
    metric,
    value,
    baseline: average,
    days: history,
    status,
    deviation,
    worse,
    ordinary: typical,
    reason,
    wristOvernight: day.wristOvernight ?? null,
    recent: recentVerdicts(records, index, metric),
    drift: drift[metric.id]?.[index] ?? null,
  };
}

/**
 * The last month judged one day at a time.
 *
 * Each day is scored against the baseline it had at the time, not against
 * today's — otherwise a quiet week now would repaint a bad one in March.
 */
function recentVerdicts(records, index, metric) {
  const from = Math.max(0, index - TREND_DAYS + 1);
  const verdicts = [];

  for (let at = from; at <= index; at += 1) {
    const { average } = rollingBaseline(records, metric.id, at);
    verdicts.push(
      compareToBaseline(
        metric,
        records[at][metric.id],
        average,
        ordinary[metric.id]?.[at],
      ).status,
    );
  }

  return verdicts;
}

function createCard(reading) {
  const { metric, value, baseline, deviation, status, recent } = reading;
  const context = [trendSentence(recent), driftSentence(reading.drift)]
    .filter(Boolean)
    .join(' ');

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
    <div class="trend" aria-hidden="true">${recent
      .map((day) => `<span class="trend__day trend__day--${day}"></span>`)
      .join('')}</div>
    <p class="trend__note">${context}</p>
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
  units = recordedUnits;

  ordinary = Object.fromEntries(
    METRICS.map((metric) => [metric.id, typicalDeviations(records, metric.id)]),
  );
  drift = Object.fromEntries(
    METRICS.map((metric) => [metric.id, driftSeries(records, metric.id)]),
  );

  selected = mostRecentFullDay(records);

  el('footer-source').textContent = source;
  el('import').hidden = true;
  el('summary').hidden = false;
  el('cards').hidden = false;
  el('footer').hidden = false;
  closeDataView();
  render();
}

/** Put the coverage view away, wherever it was left. */
function closeDataView() {
  el('data').hidden = true;
  el('show-data').textContent = 'What was recorded';
}

const asDate = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

/** The coverage table: how much of each metric was actually written down. */
function renderData() {
  const rows = coverage(days, METRICS)
    .sort((a, b) => a.recentDays - b.recentDays)
    .map(({ metric, recentDays, recentOf, totalDays, firstDate }) => {
      const share = Math.round((recentDays / recentOf) * 100);
      return `
        <tr>
          <th scope="row">${metric.label}</th>
          <td class="data__count">${recentDays} of ${recentOf}</td>
          <td class="data__bar">
            <span style="width: ${share}%"></span>
          </td>
          <td class="data__total">${totalDays.toLocaleString()} days in all${
            firstDate === null ? '' : `, since ${asDate(firstDate)}`
          }</td>
        </tr>`;
    })
    .join('');

  el('data-table').innerHTML = `
    <caption>Days with a reading, out of the last 90</caption>
    ${rows}`;
  el('data-nights').textContent = missingNightsSentence(missingNights(days));
}

function showImport() {
  el('summary').hidden = true;
  el('footer').hidden = true;
  closeDataView();
  el('cards').hidden = false;
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

    // Health hands out a zip; the XML is what gets read. Taking either saves
    // the step people give up at.
    const zipped = /\.zip$/i.test(file.name);
    if (zipped) status.textContent = 'Opening the archive…';
    const source = zipped ? await openHealthExport(file) : file;

    const { dailyHealthData, recordsRead, units: found } =
      await importAppleHealthExport(source, (fraction) => {
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
  const sample = sampleHealthData();
  show(
    sample,
    `Sample data — invented, not yours. ${sample.length} made-up days.`,
  );
});

const NUMBERS_KEY = 'wellness-translator:show-numbers';

function setNumbers(on) {
  el('app').dataset.numbers = on ? 'on' : 'off';
  el('show-numbers').textContent = on ? 'Hide the numbers' : 'Show the numbers';
  try {
    localStorage.setItem(NUMBERS_KEY, on ? 'on' : 'off');
  } catch {
    // A refusal to remember a preference is not worth interrupting anyone for.
  }
}

el('show-numbers').addEventListener('click', () => {
  setNumbers(el('app').dataset.numbers !== 'on');
});

el('show-data').addEventListener('click', () => {
  const showing = el('data').hidden;
  if (showing) renderData();
  el('data').hidden = !showing;
  el('summary').hidden = showing;
  el('cards').hidden = showing;
  el('show-data').textContent = showing ? 'Back to the day' : 'What was recorded';
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

setNumbers(localStorage.getItem(NUMBERS_KEY) === 'on');

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

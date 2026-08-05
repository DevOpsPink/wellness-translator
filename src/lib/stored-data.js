/**
 * Remembering an import between visits.
 *
 * Re-reading a gigabyte every time the page opens is silly when the useful
 * part of it — one row per day — comes to a couple of hundred kilobytes. That
 * fits in localStorage, which never leaves the device and needs no
 * permission, no account and no server.
 *
 * It is still health data sitting on a disk, so `forget` exists and the
 * interface offers it plainly rather than burying it.
 */

const KEY = 'wellness-translator:daily-data';

/**
 * Bumped whenever the shape of a stored row changes. An older payload is
 * dropped rather than migrated: the source file is still on the user's disk,
 * so the cost of being wrong is one re-import, and guessing at what an old
 * row meant is how quietly wrong numbers get displayed.
 */
const VERSION = 2;

/**
 * Trim the stored numbers to the precision the screen actually shows.
 *
 * Deliberately blind to which metric is which: adding one to the app should
 * not mean remembering to teach this file about it, and a metric quietly
 * dropped on save would be a bug that only shows up on the second visit.
 */
function shrink(day) {
  const kept = {};
  for (const [key, value] of Object.entries(day)) {
    if (typeof value !== 'number') {
      kept[key] = value;
    } else if (Number.isFinite(value)) {
      kept[key] = Math.round(value * 100) / 100;
    }
  }
  return kept;
}

export function save(dailyHealthData, units = {}) {
  const payload = {
    version: VERSION,
    importedAt: new Date().toISOString(),
    units,
    days: dailyHealthData.map(shrink),
  };

  try {
    localStorage.setItem(KEY, JSON.stringify(payload));
    return { saved: true };
  } catch (error) {
    // A full or disabled localStorage is not worth failing an import over —
    // the data is already parsed and on screen.
    return { saved: false, error };
  }
}

export function load() {
  const raw = localStorage.getItem(KEY);
  if (raw === null) return null;

  try {
    const payload = JSON.parse(raw);
    if (payload.version !== VERSION) {
      localStorage.removeItem(KEY);
      return null;
    }
    return {
      dailyHealthData: payload.days,
      importedAt: payload.importedAt,
      units: payload.units ?? {},
    };
  } catch {
    localStorage.removeItem(KEY);
    return null;
  }
}

export function forget() {
  localStorage.removeItem(KEY);
}

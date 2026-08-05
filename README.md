# Wellness Translator

Reads Apple Health data and translates deviations from *your own* normal into
plain language, using a traffic-light system. No cloud, no accounts, no
engagement mechanics — the page tells you how your day looks and then gets out
of the way.

## The idea

Three metrics, compared against your personal 7-day rolling average rather than
against a population norm:

| Metric             | Bad direction |
| ------------------ | ------------- |
| Resting Heart Rate | higher        |
| HRV                | lower         |
| Sleep              | shorter       |

Traffic light, per metric:

- 🟢 **Green** — within ±5% of baseline
- 🟡 **Yellow** — 5–10% worse than baseline
- 🔴 **Red** — more than 10% worse than baseline
- ⚪️ **Collecting data** — fewer than 4 days of history, so no verdict is given

One screen: a summary line for the day on top, three cards below.

How the baseline is worked out:

- the mean of up to 7 days of history
- **today is excluded from its own baseline** — otherwise an unusual day drags
  the "normal" it is measured against toward itself, and partly excuses itself
- days with no reading are skipped, not counted as zero
- fewer than 4 readings and no verdict is given at all — with one or two
  nights the average is just the last night restated

## Principles

- No cloud storage — everything stays in the browser
- All local
- No engagement mechanics, no streaks, no notifications

## Running it

The app is plain HTML, CSS and ES modules — no build step and no dependencies.
Browsers refuse to load ES modules over `file://`, so serve the folder:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

Add `?days=3` to the URL to pretend only the first three days were ever
recorded — that is how to look at the "collecting data" state without editing
the mock.

## Layout

```
index.html                     the single screen
src/app.js                     pulls it together, renders the cards
src/styles.css                 all colours, including the traffic light
src/lib/baseline.js            the 7-day rolling average
src/lib/metrics.js             metric definitions, thresholds, wording
src/data/mock-health-data.js   10 days of stand-in Apple Health data
```

## Build order

Small pieces, one working before the next starts:

1. **Project structure and three cards with mock data** ✅ done
2. **Baseline, thresholds and the "collecting data" state** ✅ done
3. Plain-language phrasing per metric
4. The summary line for the day
5. Import a real Apple Health export instead of the mock

Steps 2 and 3 of the original plan landed together: a rolling average that
nothing compares against is dead code, so the baseline and the thresholds that
read it arrived in one piece.

## Status

Early MVP, web-first. iOS is not in scope yet — the point for now is getting
the translation logic right on exported data.

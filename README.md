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

## Layout

```
index.html                     the single screen
src/app.js                     reads today's data, renders the cards
src/styles.css                 all colours, including the traffic light
src/lib/metrics.js             metric definitions + status rules
src/data/mock-health-data.js   10 days of stand-in Apple Health data
```

## Build order

Small pieces, one working before the next starts:

1. **Project structure and three cards with mock data** ✅ done
2. Baseline: 7-day rolling average, plus the "collecting data" state
3. Real colour logic driven by the ±5% / 10% thresholds
4. Plain-language phrasing per metric
5. The summary line for the day
6. Import a real Apple Health export instead of the mock

Step 1 hard-codes one status per metric in `getStatus()` so all three colours
are visible while the layout is built. Step 2 replaces that function body.

## Status

Early MVP, web-first. iOS is not in scope yet — the point for now is getting
the translation logic right on exported data.

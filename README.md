# Wellness Translator

Reads Apple Health data and translates deviations from *your own* normal into
plain language, using a traffic-light system. No cloud, no accounts, no
engagement mechanics — the page tells you how your day looks and then gets out
of the way.

## The idea

Six metrics, compared against your personal 7-day rolling average rather than
against a population norm:

| Metric             | Bad direction | What it adds                          |
| ------------------ | ------------- | ------------------------------------- |
| Resting Heart Rate | higher        | what the body costs while still       |
| HRV                | lower         | how much slack the nervous system has |
| Sleep              | shorter       | the night behind the day              |
| Walking Heart Rate | higher        | what the same walk costs today        |
| Walking Speed      | lower         | fatigue you have not noticed yet      |
| Time in Daylight   | lower         | how much of the day happened outside  |

The first three were the original spec. The last three were picked from what a
real export turned out to contain: each is recorded on most of any
ninety days, and none of them is a step count.

Traffic light, per metric:

- 🟢 **Green** — within ±5% of baseline
- 🟡 **Yellow** — 5–10% worse than baseline
- 🔴 **Red** — more than 10% worse than baseline
- ⚪️ **Collecting data** — fewer than 4 days of history, so no verdict is given

One screen: a summary line for the day on top, six cards below, each showing
the last 30 days behind its number. A single reading says almost nothing on its
own — "34 ms" reads one way if last month was 33, quite another if it was 45
and sliding. The dashed line across each sparkline is the personal baseline, so
above and below are visible without doing the arithmetic.

Any day in the history can be brought up with the arrow keys.

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
- **Describe, never diagnose or prescribe.** The app can see that a number
  moved. It cannot see why, and it is not a doctor. Every phrase says what
  changed against your own last week — none of them says what it means for
  your health or what to do about it.

## Running it

The app is plain HTML, CSS and ES modules — no build step and no dependencies.
Browsers refuse to load ES modules over `file://`, so serve the folder:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000> and either pick an `export.xml` or click
through to the sample data.

Arrow keys, or the chevrons beside the date, walk back through the history.
Every state the app can be in is reachable that way, including the early days
when there was not yet enough history to judge anything.

## Reading an Apple Health export

On iPhone: Health → your picture, top right → Export All Health Data. Unzip
what arrives and pick `export.xml` out of it.

The file is big — a few years of a watch writing every heartbeat runs past a
gigabyte — so it is streamed rather than loaded: chunks in, lines out, and only
the three record types we want are ever parsed. A 1.6 GB export takes a couple
of seconds. It is read in the browser and never uploaded.

Four decisions were forced by what real exports actually contain:

- **Sleep segments are merged, not summed.** A watch and a phone will both
  record the same night, and the watch alone splits it into dozens of stage
  segments. Adding their durations up invents twenty-hour nights, so the
  intervals are unioned first and measured after.
- **Only `Asleep*` counts.** `InBed` is lying down, and it overlaps the asleep
  segments it brackets; `Awake` is the opposite. Both the modern
  `AsleepCore`/`Deep`/`REM` and the older `AsleepUnspecified` are sleep.
- **A night belongs to the morning it ends on**, which is how a night lines up
  with the day that follows it.
- **A day holding less than an hour of sleep is treated as unrecorded.** Real
  exports are full of days with six or eight minutes of "asleep" — a watch
  picked up briefly. Taken at face value that reads as 98% below baseline and
  lights up red: a false alarm manufactured out of missing data.

### Was the watch even on?

A night with no sleep recorded looks the same whether you slept badly or left
the watch on the charger — the records are simply absent either way. But a
watch on a wrist takes a heart rate reading every few minutes regardless of
what it thinks of your sleep, so the ordinary heart rate stream answers the
question the sleep records cannot.

On a real export the separation is stark. Counting readings between midnight
and six:

| overnight readings | sleep recorded | no sleep |
| ------------------ | -------------- | -------- |
| 0                  | 0              | 96       |
| 1–29               | 0              | 30       |
| 30+                | 273            | 1        |

So a blank night gets one of three explanations: the watch was off, it was on
for only part of the night, or it was on all night and recorded no sleep
anyway — which is a settings problem rather than a habit. If the export holds
no heart rate at all, the answer is "unknown" rather than "off": absence of
the signal is not the signal.

The window is local clock time, which suits someone who sleeps at night and
would misjudge someone who works nights.

### Remembering an import

The parsed days — one row each, a few hundred kilobytes — are kept in
`localStorage`, so opening the page again does not mean re-reading a gigabyte.
It never leaves the device, and **Forget this data** wipes it.

Timestamps carry their own UTC offset. Both readings are kept — the absolute
instant, for deciding whether two sleep segments overlap, and the wall clock
date as written, which is the one a person means by "Tuesday" even if they
were somewhere else that week.

Three more things the export forced:

- **Some metrics are summed, others averaged.** Daylight arrives as a stream of
  five-minute chunks and has to be added up. Averaging them would report five
  minutes a day; adding up a day's heart rates would be meaningless.
- **A reading belongs to the day its window mostly falls in.** Not every record
  is a moment — a resting heart rate covers thirteen hours on average, a
  walking heart rate nearly ten, and about one in ten of each runs across
  midnight. Filing those by the hour they began puts a reading mostly taken on
  Tuesday under Monday.
- **Units come from the file.** The export uses whatever the phone is set to,
  so a walking speed can arrive as km/hr or mi/hr. Reading the unit off the
  record keeps the label right on somebody else's export.

The app opens on the most recent day that has most of its readings in, not the
last row in the file. An export is made partway through a day, so its final
entry holds whatever had synced by then — often a heart rate and nothing else.
The forward arrow still reaches it.

## Colour

The palette is devops.pink's, taken the way that site builds it rather than by
eyedropper: one hue — 340 — with everything else derived from it in OKLCH.
`--hue` in `src/styles.css` is the single knob; move it and the whole interface
follows, greys included, since they carry a trace of the brand rather than
being neutral.

The traffic light is the exception. A red that has drifted towards the pink
beside it stops working as a warning, so the three statuses keep hues held well
away from 340 and from each other. What makes them look like one family is the
lightness they share — and that shared lightness is also what makes them
legible, so the palette and the contrast floor are settled by the same
decision. The fourth state has no colour of its own: a card with no verdict
borrows the muted text colour, because it is not making a quiet judgement, it
is making none.

Every text pair was measured against its real background rather than eyeballed
— all ten clear WCAG AA in both themes, the tightest being 4.69:1.

Roboto is the site's face. It is used if the reader has it and skipped if not:
a web font would mean a network request, and this app makes none.

## Layout

```
index.html                     the single screen
src/app.js                     pulls it together, renders the cards
src/styles.css                 all colours, including the traffic light
src/lib/health-import.js       streams export.xml into daily records
src/lib/stored-data.js         keeps the import in localStorage
src/lib/sparkline.js           the 30-day line under each number
src/lib/baseline.js            the 7-day rolling average
src/lib/metrics.js             metric definitions, thresholds, wording
src/data/mock-health-data.js   10 days of stand-in data, for the sample view
```

## Build order

Small pieces, one working before the next starts:

1. **Project structure and three cards with mock data** ✅ done
2. **Baseline, thresholds and the "collecting data" state** ✅ done
3. **Plain-language phrasing per metric** ✅ done
4. **The summary line for the day** ✅ done
5. **Import a real Apple Health export instead of the mock** ✅ done
6. **Remember the import, and explain blank nights** ✅ done
7. **Show the month behind each number, and walk the history** ✅ done
8. **Three more metrics, chosen from what the export actually holds** ✅ done

Everything in the original spec now works on real data.

The summary line is deliberately not a score. Averaging three metrics into one
number would invent a precision none of them has and hide the only thing worth
knowing — which one moved. It names the worst group and says whether it stands
alone.

All wording lives in the `phrases` field of each metric in `src/lib/metrics.js`
— that is the one file to open to reword the app or translate it.

Steps 2 and 3 of the original plan landed together: a rolling average that
nothing compares against is dead code, so the baseline and the thresholds that
read it arrived in one piece.

## Status

Early MVP, web-first. iOS is not in scope yet — the point for now is getting
the translation logic right on exported data.

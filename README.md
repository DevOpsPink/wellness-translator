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

Traffic light, per metric, counted in **typical days for that metric** rather
than in fixed percentages:

- 🟢 **Green** — no further off than twice an ordinary day
- 🟡 **Yellow** — two to three times an ordinary day
- 🔴 **Red** — more than three times
- ⚪️ **Collecting data** — too little history to judge, so nothing is claimed

The spec originally said 5% and 10%. Measured against years of real data
those fit resting heart rate almost exactly — an ordinary day moves it 3.1% —
and were meaningless for everything noisier. Daylight swings 32% on an ordinary
day, because some days you are out for twenty minutes and some for four hours,
so a 5% line raised a warning on half of all days. Sleep, 46%. An alarm that never
stops is not an alarm.

Each metric is now measured against its own ordinary day, taken as the median
distance from baseline over its last 90 *recorded* days. That levels the cards
out at roughly 90% green, 6% yellow, 4% red apiece, so a colour finally means
the same thing wherever it appears:

| Metric             | An ordinary day moves it | Was flagged | Now |
| ------------------ | ------------------------ | ----------- | --- |
| Walking Heart Rate | 2.7%                     | 8%          | 11% |
| Resting Heart Rate | 3.1%                     | 11%         | 8%  |
| Walking Speed      | 2.9%                     | 15%         | 8%  |
| HRV                | 13.2%                    | 39%         | 8%  |
| Sleep              | 15.0%                    | 46%         | 10% |
| Time in Daylight   | 32.0%                    | 49%         | 9%  |

The median is used rather than the mean so that a fortnight of illness does not
raise the bar for noticing the next one. The 5% figure survives as the fallback
for a metric with too little history to know its own spread.

### Two timescales, because one cannot see everything

The daily verdict is blind to a slow slide, and not by oversight. The baseline
is a seven-day average, so a metric that drops and stays down is back inside
its own normal within about four days — it chases the change and swallows it.
Measured over this export, runs of three consecutive off days happen **seven
times across years of real data** and never once reach four.

So the card carries a second, slower comparison: this week's average against
the last three months'. It answers a different question — not "is today
unusual" but "has your usual moved" — and it finds what the daily view cannot.
Sleep has run 22% below its season; HRV, 26% below.

The same rule applies as everywhere else: the gap is only mentioned when it is
large for *that* metric, measured against how far a week normally drifts from
its season. An ordinary week sits 2.6% from the season for walking heart rate
and 16% for daylight.

One screen: a line for the day on top, six cards below. A card is a name, a
colour and a sentence — nothing else, unless you ask.

The figures arrived one at a time, each defensible on its own: the reading,
the baseline, the percentage, thirty days of marks, two lines of statistics.
Together they buried the thing the app is for. Someone looking at *40 ms ·
−10%* has no way of knowing whether that is bad news, and the sentence beside
it — the actual product — had been reduced to a caption. So the numbers moved
behind **Show the numbers**, and the page opens plain.

The names went plain too. "HRV" is three letters that mean nothing; it is now
"How rested you seem", which is what the number is about.

With the numbers switched on, each card also carries the last 30 days as one
mark per day, coloured the way that day's card would have been, and a sentence
counting them: *off your usual on 14 of the last 30 recorded days*.

That started life as a line chart and was thrown away. The chart scaled itself
to whatever range the days happened to cover, so a heart rate wandering between
68 and 72 drew the same dramatic peaks as one swinging from 50 to 90 — its most
eye-catching feature carried no information. It was also the wrong instrument
for an app whose whole premise is turning numbers into words: it handed back a
shape to decode. Marks you can count cannot be misread, and the sentence
answers what the shape was only gesturing at.

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

The sample is 400 invented days, generated from a fixed seed so it is the same
every time, and ending on today so it never goes stale. It is long enough for
everything to engage — seven days for a baseline, thirty for the strip, ninety
for the variability, ninety more behind that for the week-against-season
comparison — and each metric is tuned to wander by as much as it really does,
so the calibration has something real to calibrate against. It has gaps in it
too, including a fortnight with the watch off, because the states built to
handle missing data would otherwise never be seen.

Arrow keys, or the chevrons beside the date, walk back through the history.
Every state the app can be in is reachable that way, including the early days
when there was not yet enough history to judge anything.

## Reading an Apple Health export

On iPhone: Health → your picture, top right → Export All Health Data. Pick the
`export.zip` that arrives; the `export.xml` inside works too.

Taking the zip directly needed about a hundred lines of `src/lib/zip.js`,
because asking someone to unzip first and then find `export.xml` among the
workout routes and electrocardiograms is a step people give up at. A zip is
read from its back end: the last record points at a table of everything in the
archive, each row of which points at where that file's bytes start. From there
the browser's own `DecompressionStream` inflates it. No ZIP64, no encryption —
Apple's export needs neither, and code that claims to handle them without
being tested on them is worse than code that says it does not.

The data is big — a few years of a watch writing every heartbeat runs past a
gigabyte — so it is streamed rather than loaded: chunks in, lines out, one
`indexOf` per line to reject the millions of records nothing here wants. A
1.6 GB export is read in about two seconds. Going in through the zip is
*faster* than reading the loose XML, because 90 MB off the disk plus native
inflate beats 1.6 GB off the disk.

It is read in the browser and never uploaded.

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

### What was actually recorded

A second screen, reachable from the footer, shows how complete the record is:
days with a reading out of the last ninety, per metric, and how far each one
goes back.

It exists because the most useful thing this app found in a real export was
not about health at all. Sleep is recorded on 55 of the last ninety nights.
Of the 35 blank ones the watch was off for 25 and on for part of
the night for 9 — and across the whole history, one night had the
watch on all night and still recorded nothing, which is a settings problem
rather than a habit. None of that is visible in Apple Health, or in any of the
apps built on top of it, and all of it is actionable in a way a heart rate
reading is not.

Only sleep gets its blanks explained. The evidence is the overnight heart
rate, which says whether the watch was on a wrist and says nothing whatever
about a daytime figure.

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
src/lib/zip.js                 reaches export.xml inside export.zip
src/lib/health-import.js       streams export.xml into daily records
src/lib/coverage.js            how complete the record is
src/lib/stored-data.js         keeps the import in localStorage
src/lib/baseline.js            the 7-day rolling average
src/lib/metrics.js             metric definitions, thresholds, wording
src/data/sample-data.js        400 invented days, for the sample view
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
9. **Replace the chart with something that needs no decoding** ✅ done
10. **Calibrate the thresholds to each metric's own variability** ✅ done
11. **Read runs of days, and this week against this season** ✅ done
12. **A screen for how complete the record actually is** ✅ done
13. **Sample data long enough to show the app working** ✅ done
14. **Take the zip directly, without unzipping first** ✅ done

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

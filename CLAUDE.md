# Working on this project

Read `README.md` first — it holds the spec, the traffic-light rules and the
build order. This file covers what the README does not: how to work here.

## Who this is for

The user is learning to program, and is writing about the experience
afterwards. Two things follow.

**Explain each step as you go** — what you are changing and, more importantly,
why one approach was chosen over another. The reasoning is the deliverable as
much as the code is. When a decision could have gone the other way, say what
the other way would have cost.

**Work in small pieces.** One thing working before the next one starts. Do not
implement three build-order steps because they are all small; land one, show
it, explain it.

The user writes in Russian — reply in Russian. The code, comments and commit
messages stay in English.

## Principles that constrain the code

These are product decisions, not preferences. If a change would break one,
raise it rather than quietly working around it.

- **No cloud, no accounts, no network.** Everything runs in the browser.
  Health data never leaves the machine. There is no analytics, no telemetry,
  no font CDN, nothing that makes a request.
- **No engagement mechanics.** No streaks, no scores, no notifications, no
  reason to come back tomorrow beyond wanting to.
- **Describe, never diagnose or prescribe.** The app sees a number move. It
  cannot see why, and it is not a doctor. Never "you are getting ill", never
  "take it easy today".
- **"Than usual", never "than normal".** Everything is measured against this
  person last week, not against a population.
- **No composite score.** Three metrics do not average into one number. That
  would invent precision none of them has and hide which one moved.

## Conventions already established

- **No dependencies and no build step.** Plain HTML, CSS and ES modules, served
  as they are. `package.json` has no dependencies and exists only to mark the
  files as ES modules and to name the test command. Do not introduce a
  bundler, a framework or a runtime dependency without asking — "it would be
  easier with X" is not a reason here.
- **Statuses are named by meaning, not colour**: `good`, `watch`, `alert`,
  `collecting`. Colour lives only in `styles.css`.
- **The palette is devops.pink's, derived from one hue in OKLCH.** `--hue: 340`
  in `styles.css` drives everything; use `oklch()` off it rather than adding
  hex values. The three traffic-light hues are deliberately held away from the
  brand and share one lightness — do not "harmonise" them towards pink, and do
  not change their lightness without re-measuring contrast. Every text pair
  currently clears WCAG AA in both themes; the tightest is 4.69:1, so there is
  little headroom.
- **All user-facing wording lives in `src/lib/metrics.js`** — the `phrases`
  field per metric, plus `summaryFor`. It is the one file to open to reword
  or translate the app.
- **Per-metric behaviour is data, not branches.** `worseWhen` says which
  direction is bad, `how` in the importer's `WANTED` map says summed or
  averaged; the logic reads them. Resist adding an `if` per metric. Adding a
  metric should mean one entry in `WANTED`, one in `METRICS`, and nothing
  else — if a third file needs teaching about it, that file is too specific.
- **Thresholds are relative to each metric's own spread, never fixed
  percentages.** This was the app's worst bug and it came straight from the
  spec: 5% is a rare event for a resting heart rate and an ordinary Tuesday
  for time in daylight, so one fixed line raised a warning on half of all daylight days. If a
  new threshold is ever needed, measure what an ordinary day looks like first.
- **A rolling baseline cannot see a sustained shift**, and no amount of
  cleverness in the daily verdict will change that: the seven-day average
  chases the change and absorbs it within about four days. That is why there
  is a second comparison of week against season. Do not try to make the daily
  card detect drift.
- **No charts that need decoding.** A line chart lived here briefly and was
  removed: it auto-scaled, so a flat week and a wild one drew the same
  dramatic shape, and it handed back a picture to interpret in an app whose
  premise is turning numbers into words. Anything visual added here has to be
  countable or nameable at a glance.
- **Never state a cause you cannot evidence.** Sleep can say the watch was off
  because the overnight heart rate proves it. Daylight deliberately says
  nothing about why it is missing, because the wrist signal is about the night
  and cannot answer for the day.
- **`baseline.js` owns the maths**, `metrics.js` owns the meaning, `app.js`
  owns the DOM. Keep them apart.

## Verifying changes

```bash
npm test
```

Node's own runner over `test/`, no dependencies. The logic is all pure
functions and is covered; add to the suite rather than checking things in the
browser console and throwing the result away. When fixing a bug, name the test
after what went wrong — most of the existing ones are named that way, and that
is what stops the same mistake returning.

The interface is not covered. For anything visual, serve the folder and drive
the page: check the render at desktop and 375px, in both light and dark.

Two traps worth knowing. Toggling a view with the `hidden` attribute only
works because of the `[hidden] { display: none !important }` rule near the top
of `styles.css` — the browser's own rule is the same weight as any class here,
so `.cards { display: grid }` beat it and the element stayed on screen. And
the browser pane caches modules hard: if an edit does not appear, check
whether the module is being served from cache before hunting for a bug in it.

```bash
python3 -m http.server 8000
```

Arrow keys walk back through the imported history, which is how to reach any
state the app can be in — including the early days with too little history to
judge. (This replaced an earlier `?days=N` URL parameter.)

The threshold boundaries are the part that has already broken once: an exact
5% deviation came out of floating-point division as 0.05000000000000002 and
turned a green card yellow. When touching `compareToBaseline`, check both
bounds from both directions on all three metrics.

## Where the plan stands

Every build-order step is done and the app runs on the user's real export,
which is remembered in localStorage between visits.

The user's own `export.xml` sits in `private-data/`, which `.gitignore`
excludes along with `*.xml` and `export*.zip`. Keep it that way and never
commit real health data. That file is useful for testing — a `File`-like
`{ size, stream() }` built from a `fetch` response drives the importer without
a file dialog.

Real data broke two things that the mock could not have caught, which is worth
remembering before trusting a change that only passes on `sample-data.js`:
sleep totals were nonsense until overlapping segments from different devices
were merged, and the green phrasing claimed "about as long as you usually do"
on a night far longer than usual.

One open question the user has not decided: the interface is in English while
the user writes in Russian. Do not switch it unasked.

#!/usr/bin/env bash
#
# Look for real health figures anywhere in the repository's history.
#
# Removing a number from a file removes it from the current version only. Git
# keeps every previous version, and every commit message, and both are public
# the moment the repository is. This walks all of it — every blob that has ever
# been committed, on every branch, plus every commit message — and fails if any
# of the listed figures is still reachable.
#
# Run it before making the repository public, and after any change that quotes
# a measurement. Every number in this project is supposed to come from
# src/data/sample-data.js; these are the ones that came from a real export.
#
#   ./scripts/audit-history.sh
#
set -uo pipefail
cd "$(dirname "$0")/.."

# Figures measured on a real Apple Health export, and the phrasings that
# carried them. Anything matching these should have been replaced with the
# sample equivalent.
#
# This list is itself full of the figures it hunts for, so every version of
# this file matches. Blobs carry no filename, so the scan below cannot skip
# it by name; the marker on the next line is how it recognises itself.
# AUDIT-SELF-MARKER-6f2a
PATTERNS=(
  # per-metric spreads from the real export
  '3\.3%' '15\.4%' '16\.2%' '36\.4%' '1\.9% from'
  # share of days the fixed rule flagged, measured on the real export
  '96% of (days|daylight)' '\| 96%' '\| 78%' '\| 76%' '\| 57%' '\| 44%' '\| 38%'
  'Sleep, 78%' 'HRV, 76%'
  # counts of the author's own days and nights
  '1,?235' '2,023 days' '1,?710 days' '1,?758 days' '1,?548 days' '1,?122 days'
  '481 days' '722 days' '92,252' '26,230' '705,008'
  'fifty-eight nights' 'sixty-eight' 'ten of the last ninety'
  'ten (days|nights) in ninety' 'eighty of any' '\| 1091' '\| 247' '\| 454'
  # the author's own readings and drifts
  '40% below its season' '16% above' '23% longer' '27% longer' '37 ms'
  '15% here'
  # how long the author has been wearing a watch
  'five and a half years' 'five years of real'
  # share of the author's records crossing midnight
  '7\.8%' '6\.6%'
)

REGEX=$(IFS='|'; echo "${PATTERNS[*]}")
failures=0

# Prose here is hard-wrapped, so a phrase like "five years of real data" is
# split across two lines and a line-by-line grep walks straight past it. This
# check missed exactly that on its first run. Collapsing whitespace first
# leaves phrases nowhere to hide in a line break.
flatten () { tr '\n' ' ' | tr -s '[:space:]' ' '; }

report () { # name, matches
  if [ -n "$2" ]; then
    failures=$((failures + 1))
    printf '\033[31mFOUND\033[0m  %s\n' "$1"
    printf '%s\n' "$2" | sed 's/^/         /' | head -20
  else
    printf '\033[32mclean\033[0m  %s\n' "$1"
  fi
}

echo "Scanning every commit message and every version of every file."
echo

messages=""
for commit in $(git rev-list --all); do
  hit=$(git log -1 --format='%s %b' "$commit" | flatten |
    grep -ioE ".{0,40}($REGEX).{0,40}" || true)
  [ -n "$hit" ] && messages+="$(git log -1 --format=%h "$commit"): $hit"$'\n'
done
report "commit messages, all branches" "$messages"

tree=""
while IFS= read -r file; do
  hit=$(flatten < "$file" | grep -ioE ".{0,40}($REGEX).{0,40}" || true)
  [ -n "$hit" ] && tree+="$file: $hit"$'\n'
done < <(git ls-files | grep -v "$(basename "$0")")
report "working tree ($(git ls-files | wc -l | tr -d ' ') tracked files)" "$tree"

# Every blob ever committed, including versions no branch points at any more.
blobs=$(git rev-list --all --objects |
  git cat-file --batch-check='%(objecttype) %(objectname) %(rest)' |
  awk '$1 == "blob" { print $2 }' | sort -u)

historical=""
skipped=0
for blob in $blobs; do
  body=$(git cat-file -p "$blob" 2>/dev/null)
  case "$body" in
    *AUDIT-SELF-MARKER-6f2a*) skipped=$((skipped + 1)); continue ;;
  esac
  hit=$(printf '%s' "$body" | flatten | grep -ioE ".{0,40}($REGEX).{0,40}" || true)
  [ -n "$hit" ] && historical+="$blob: $hit"$'\n'
done

report "every file version ever committed ($(echo "$blobs" | wc -l | tr -d ' ') blobs, $skipped of them this script)" \
  "$historical"

echo
if [ "$failures" -eq 0 ]; then
  echo "No real health figures anywhere in the history."
else
  echo "$failures place(s) still hold real figures. Do not publish yet."
  exit 1
fi

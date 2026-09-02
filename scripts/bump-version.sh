#!/usr/bin/env bash
#
# Single source of truth for the app version.
#
# The build version lives in five places that MUST match. When they drift the app
# breaks in a way that is hard to spot: version.json is what the running page
# compares itself against, so if index.html's __FIT_V is lower than version.json's
# "v", every client shows a permanent "New version ready / Update now" banner that
# reloading can never clear.
#
#   ./scripts/bump-version.sh 57     # bump everything to 57
#   ./scripts/bump-version.sh --check  # verify the five spots agree (exit 1 if not)
#
# Icons are versioned separately, by filename (icons/icon-192-vN.png). Browsers and
# installed PWAs key their icon cache on the URL, so a redrawn icon at the same path
# is never refetched — rename the files and update manifest.json + index.html +
# 404.html together whenever the artwork changes.
set -euo pipefail
cd "$(dirname "$0")/.."

read_versions() {
  V_JSON=$(sed -n 's/.*"v"[[:space:]]*:[[:space:]]*\([0-9]\+\).*/\1/p' version.json | head -1)
  V_INDEX=$(sed -n 's/.*window\.__FIT_V[[:space:]]*=[[:space:]]*\([0-9]\+\).*/\1/p' index.html | head -1)
  V_404=$(sed -n 's/.*window\.__FIT_V[[:space:]]*=[[:space:]]*\([0-9]\+\).*/\1/p' 404.html | head -1)
  V_SW=$(sed -n "s/.*fit-tracker-v\([0-9]\+\).*/\1/p" sw.js | head -1)
  V_LIB=$(sed -n 's/.*LOCAL_V[[:space:]]*=[[:space:]]*\([0-9]\+\).*/\1/p' src/lib/updates.js | head -1)
}

check() {
  read_versions
  printf 'version.json      %s\nindex.html        %s\n404.html          %s\nsw.js CACHE       %s\nupdates.js        %s\n' \
    "$V_JSON" "$V_INDEX" "$V_404" "$V_SW" "$V_LIB"
  if [ "$V_JSON" = "$V_INDEX" ] && [ "$V_JSON" = "$V_404" ] && [ "$V_JSON" = "$V_SW" ] && [ "$V_JSON" = "$V_LIB" ]; then
    echo "OK — all five agree on v$V_JSON"
    return 0
  fi
  echo "MISMATCH — run ./scripts/bump-version.sh <n> to resync" >&2
  return 1
}

case "${1:-}" in
  --check|-c|"") check; exit $? ;;
esac

N="$1"
case "$N" in
  ''|*[!0-9]*) echo "usage: $0 <integer version> | --check" >&2; exit 2 ;;
esac

read_versions
OLD_INDEX="$V_INDEX"
OLD_404="$V_404"

sed -i -E "s/(\"v\"[[:space:]]*:[[:space:]]*)[0-9]+/\1$N/" version.json
sed -i -E "s/(\"label\"[[:space:]]*:[[:space:]]*\")[^\"]*/\1$(date +%Y-%m-%d)/" version.json

sed -i -E "s/(window\.__FIT_V[[:space:]]*=[[:space:]]*)[0-9]+/\1$N/" index.html 404.html
sed -i -E "s|(src/(styles\.css\|app\.js)\?v=)[0-9]+|\1$N|g" index.html 404.html
sed -i -E "s/(fit-blank-reload-v)[0-9]+/\1$N/" index.html
sed -i -E "s/(fit-tracker-v)[0-9]+/\1$N/" sw.js
sed -i -E "s/(LOCAL_V[[:space:]]*=[[:space:]]*)[0-9]+/\1$N/" src/lib/updates.js

echo "bumped $OLD_INDEX/$OLD_404 -> $N"
check

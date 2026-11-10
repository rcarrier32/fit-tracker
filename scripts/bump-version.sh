#!/usr/bin/env bash
#
# Moves the app version everywhere it lives, so the copies can't drift apart.
#
#   ./scripts/bump-version.sh 117      # set every copy to 117 (and today's date in version.json)
#   ./scripts/bump-version.sh --check  # list each copy; exit 1 if they disagree
#
# Copies: version.json "v", index.html (__FIT_V, styles.css?v=, app.js?v=), sw.js CACHE,
# and 404.html, which is rebuilt from index.html (GitHub Pages serves it for unknown URLs;
# it sat at v31 while the app was at v116).
# src/lib/updates.js LOCAL_V is only a floor and is deliberately left alone.
set -euo pipefail
cd "$(dirname "$0")/.."

num() { sed -n "s/$1/\1/p" "$2" | head -1; }

check() {
  local ok=1 want; want=$(num '.*"v"[[:space:]]*:[[:space:]]*\([0-9]\+\).*' version.json)
  for spot in \
    "index.html __FIT_V|.*window\.__FIT_V[[:space:]]*=[[:space:]]*\([0-9]\+\).*|index.html" \
    "index.html styles.css|.*styles\.css?v=\([0-9]\+\).*|index.html" \
    "index.html app.js|.*app\.js?v=\([0-9]\+\).*|index.html" \
    "404.html __FIT_V|.*window\.__FIT_V[[:space:]]*=[[:space:]]*\([0-9]\+\).*|404.html" \
    "sw.js CACHE|.*fit-tracker-v\([0-9]\+\).*|sw.js"; do
    IFS='|' read -r label re file <<<"$spot"
    got=$(num "$re" "$file")
    printf '%-22s %s\n' "$label" "$got"
    [ "$got" = "$want" ] || ok=0
  done
  printf '%-22s %s\n' "version.json" "$want"
  if [ $ok = 1 ]; then echo "OK: all agree on v$want"; else echo "MISMATCH: run ./scripts/bump-version.sh <n>" >&2; return 1; fi
}

case "${1:-}" in --check|-c|"") check; exit $? ;; esac
N="$1"
case "$N" in ''|*[!0-9]*) echo "usage: $0 <integer version> | --check" >&2; exit 2 ;; esac

sed -i -E "s/(\"v\"[[:space:]]*:[[:space:]]*)[0-9]+/\1$N/" version.json
sed -i -E "s/(\"label\"[[:space:]]*:[[:space:]]*\")[^\"]*/\1$(date +%Y-%m-%d)/" version.json
sed -i -E "s/(window\.__FIT_V[[:space:]]*=[[:space:]]*)[0-9]+/\1$N/; s#(src/(styles\.css|app\.js)\?v=)[0-9]+#\1$N#g" index.html
sed -i -E "s/(fit-tracker-v)[0-9]+/\1$N/" sw.js
cp index.html 404.html
check

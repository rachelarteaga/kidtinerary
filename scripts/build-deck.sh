#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

PORT=${PORT:-3000}
URL="http://localhost:${PORT}/deck"
OUT="public/kidtinerary-deck.pdf"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

if ! curl -sf "${URL}" >/dev/null; then
  echo "Dev server not responding on ${URL}. Start it with 'npm run dev' first." >&2
  exit 1
fi

echo "→ printing ${URL} to ${OUT}…"
"${CHROME}" \
  --headless=new \
  --disable-gpu \
  --no-sandbox \
  --hide-scrollbars \
  --no-pdf-header-footer \
  --print-to-pdf-no-header \
  --virtual-time-budget=15000 \
  --print-to-pdf="${OUT}" \
  "${URL}"

echo "→ wrote ${OUT}"
ls -lh "${OUT}"

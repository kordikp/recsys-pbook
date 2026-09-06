#!/bin/bash
# ONE ENGINE, MANY BOOKS. This repo (recsys-pbook) is the p-book CORE; satellite
# book repos (mvi-pbook, …) carry ONLY content + project-specific files and pull
# the engine from here:
#
#   ./scripts/core-sync.sh /path/to/mvi-pbook
#
# ENGINE (overwritten in the target — never edit these in a satellite):
#   js/app.js js/recombee.js js/markdown.js js/qr.js js/tutor.js
#   api/generate.js api/drafts.js api/decks.js api/boss.js api/log.js
#   api/recs.js api/auth.js api/wallet.js api/proposals.js api/recombee.js
#   admin.html
#
# PROJECT-OWNED (never touched here):
#   content/ images/ games/ js/config.js js/diagrams.js index.html sw.js css/
#   robots.txt README EXAM.md missions … and the Vercel project itself.
#
# After syncing: bump app.js?v= in the target's index.html, smoke-test, deploy.
# (The Czech school book pbook-internet-skolni is still a translated fork — it
# mirrors engine changes by hand until the core grows an i18n string layer.)

set -euo pipefail
CORE="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="${1:?usage: core-sync.sh /path/to/book-repo}"
[ -d "$TARGET/content" ] || { echo "!! $TARGET does not look like a p-book (no content/)"; exit 1; }

ENGINE=(
  js/app.js js/recombee.js js/markdown.js js/qr.js js/tutor.js
  api/generate.js api/drafts.js api/decks.js api/boss.js api/log.js
  api/recs.js api/auth.js api/wallet.js api/proposals.js api/recombee.js
  admin.html
)
for f in "${ENGINE[@]}"; do
  [ -f "$CORE/$f" ] || { echo "?? core misses $f — skipping"; continue; }
  mkdir -p "$TARGET/$(dirname "$f")"
  cp "$CORE/$f" "$TARGET/$f"
  echo "→ $f"
done
echo "done. Now: bump app.js?v= in $TARGET/index.html, check js/config.js has the"
echo "keys the engine reads (facets, steering, aiEconomy), smoke-test, deploy."

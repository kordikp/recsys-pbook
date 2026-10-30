#!/bin/bash
# ONE ENGINE, MANY BOOKS. This repo (recsys-pbook) is the p-book CORE; satellite
# book repos (mvi-pbook, …) carry ONLY content + project-specific files and pull
# the engine from here:
#
#   ./scripts/core-sync.sh /path/to/mvi-pbook
#
# ENGINE (overwritten in the target — never edit these in a satellite):
#   js/app.js js/recombee.js js/markdown.js js/qr.js js/tutor.js js/games.js js/games-lab.js js/challenge.js js/ux.js js/completion.js js/teams.js
#   js/i18n.js js/i18n/*.js (interface language packs)
#   css/games.css css/figures.css css/challenge.css
#   api/generate.js api/drafts.js api/decks.js api/boss.js api/log.js
#   api/recs.js api/auth.js api/wallet.js api/proposals.js api/recombee.js api/mcp.js api/sync-recombee.js
#   scripts/migrate-facets.js scripts/check-games.mjs scripts/build-llms-index.js scripts/build-kb.js
#   scripts/check-i18n.mjs scripts/build-bundle.mjs (content/bundle.<lang>.json: the target's vercel.json
#   runs it as buildCommand; git-ignore content/bundle.*.json)
#   admin.html
#
# BOOK IDENTITY lives in the book, never in the engine: js/config.js (CONFIG.book
# title/author/inviteText/issuesUrl, CONFIG.facets incl. lens.worldLabels and
# lens.genericHint, CONFIG.goals, CONFIG.topics, CONFIG.defaultAffinity) and
# pbook.json (title, subject, author, audience, language, facets.lens + lensWorlds
# for the generator, datasets for /api/mcp). Missions: content/missions.json.
#
# PROJECT-OWNED (never touched here):
#   content/ images/ games/ js/config.js js/diagrams.js index.html sw.js css/
#   robots.txt README EXAM.md missions … and the Vercel project itself.
#
# LANGUAGE: the interface speaks CONFIG.book.lang (or the reader's ?lang= choice among
# CONFIG.book.languages) through js/i18n/<lang>.js; a book overrides single strings in
# CONFIG.strings[lang]. A Czech book no longer needs a translated fork of the engine.
#
# After syncing: bump app.js?v= in the target's index.html, smoke-test, deploy.

set -euo pipefail
CORE="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="${1:?usage: core-sync.sh /path/to/book-repo}"
[ -d "$TARGET/content" ] || { echo "!! $TARGET does not look like a p-book (no content/)"; exit 1; }

ENGINE=(
  js/app.js js/recombee.js js/markdown.js js/qr.js js/tutor.js js/games.js js/games-lab.js js/challenge.js js/ux.js js/completion.js js/teams.js
  js/i18n.js $(cd "$CORE" && ls js/i18n/*.js 2>/dev/null)
  css/games.css css/figures.css css/challenge.css
  api/generate.js api/drafts.js api/decks.js api/boss.js api/log.js
  api/recs.js api/auth.js api/wallet.js api/proposals.js api/recombee.js api/mcp.js api/sync-recombee.js
  scripts/migrate-facets.js scripts/check-games.mjs scripts/build-llms-index.js scripts/build-kb.js
  scripts/check-i18n.mjs scripts/build-bundle.mjs
  admin.html
)
for f in "${ENGINE[@]}"; do
  [ -f "$CORE/$f" ] || { echo "?? core misses $f — skipping"; continue; }
  mkdir -p "$TARGET/$(dirname "$f")"
  cp "$CORE/$f" "$TARGET/$f"
  echo "→ $f"
done
echo "done. Now: bump app.js?v= in $TARGET/index.html, check js/config.js has the"
echo "keys the engine reads (book, facets, goals, steering, aiEconomy), that pbook.json has"
echo "subject + facets.lens + lensWorlds, rebuild kb/ (node scripts/build-kb.js), smoke-test, deploy."

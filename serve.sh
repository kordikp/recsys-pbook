#!/bin/sh
cd "$(dirname "$0")"
PORT="${1:-8000}"

# Load token from .env if exists
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

echo ""
echo "  p-book dev server"
echo "  http://localhost:$PORT"
echo "  Recombee proxy: /.netlify/functions/recombee"
if [ -n "$RECOMBEE_TOKEN" ]; then
  echo "  Token: set"
else
  echo "  Token: NOT SET — create .env with RECOMBEE_TOKEN=..."
fi
echo ""

node serve-local.js "$PORT"

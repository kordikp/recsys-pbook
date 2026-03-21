#!/bin/bash
cd "$(dirname "$0")"
PORT=${1:-8000}

# Load token from .env if exists
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

echo ""
echo "  p-book dev server"
echo "  http://localhost:$PORT"
echo "  Recombee proxy: /.netlify/functions/recombee"
echo "  Token: ${RECOMBEE_TOKEN:+set (***${RECOMBEE_TOKEN: -8})}${RECOMBEE_TOKEN:-NOT SET — create .env with RECOMBEE_TOKEN=...}"
echo ""

node serve-local.js "$PORT"

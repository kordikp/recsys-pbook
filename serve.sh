#!/bin/bash
cd "$(dirname "$0")"
PORT=${1:-8000}
echo ""
echo "  p-book prototype"
echo "  Open http://localhost:$PORT in your browser"
echo "  Press Ctrl+C to stop"
echo ""

# Try Python 3 first, then Python 2, then Node
if command -v python3 &>/dev/null; then
  python3 -m http.server "$PORT"
elif command -v python &>/dev/null; then
  python -m SimpleHTTPServer "$PORT"
elif command -v npx &>/dev/null; then
  npx serve -l "$PORT"
else
  echo "Error: No Python or Node.js found. Install Python 3 to run the server."
  exit 1
fi

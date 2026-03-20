#!/bin/bash
# Vercel build script — injects RECOMBEE_TOKEN env var into config.js
# Set RECOMBEE_TOKEN in Vercel project settings → Environment Variables

if [ -n "$RECOMBEE_TOKEN" ]; then
  sed -i "s/RECOMBEE_TOKEN_PLACEHOLDER/$RECOMBEE_TOKEN/" js/config.js
  echo "Recombee token injected"
else
  echo "Warning: RECOMBEE_TOKEN not set — readers will use local mode"
fi

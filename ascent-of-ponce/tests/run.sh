#!/usr/bin/env bash
# Runs the scripts against mock Minecraft APIs to catch logic errors without the game.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p node_modules/@minecraft
rm -rf node_modules/@minecraft/server node_modules/@minecraft/server-ui
cp -r tests/mocks/server node_modules/@minecraft/server
cp -r tests/mocks/server-ui node_modules/@minecraft/server-ui
node tests/simulate.mjs

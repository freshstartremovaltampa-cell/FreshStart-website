#!/usr/bin/env bash
# Packages the add-on into dist/AscentOfPonce.mcaddon (open it to import into Minecraft).
set -euo pipefail
cd "$(dirname "$0")"
rm -rf dist && mkdir -p dist/tmp
(cd behavior_pack && zip -qr ../dist/tmp/AscentOfPonce_BP.mcpack .)
(cd resource_pack && zip -qr ../dist/tmp/AscentOfPonce_RP.mcpack .)
(cd dist/tmp && zip -q ../AscentOfPonce.mcaddon AscentOfPonce_BP.mcpack AscentOfPonce_RP.mcpack)
rm -rf dist/tmp
echo "Built dist/AscentOfPonce.mcaddon"

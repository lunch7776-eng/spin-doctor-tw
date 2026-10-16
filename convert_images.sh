#!/bin/bash
# raw PNG (codex 產出) → game/img/*.jpg，壓小給網頁用
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p game/img
for f in assets/raw/*.png; do
  n=$(basename "$f" .png)
  size=560; [ "$n" = "table" ] && size=1400
  sips -s format jpeg -s formatOptions 78 -Z "$size" "$f" --out "game/img/$n.jpg" >/dev/null
done
ls -la game/img | tail -n +2

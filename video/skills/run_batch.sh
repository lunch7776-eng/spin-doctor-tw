#!/bin/bash
# 依序處理一組招式：等關鍵畫面完成（檔案大小穩定）再生成
cd "$(dirname "$0")/../.."
for id in "$@"; do
  f=video/skills/${id}_key_raw.png
  for i in $(seq 1 120); do
    if [ -f "$f" ]; then s1=$(stat -f%z "$f"); sleep 4; s2=$(stat -f%z "$f"); [ "$s1" = "$s2" ] && break; else sleep 10; fi
  done
  [ -f "game/fx/${id}.mp4" ] && { echo "$id: 已存在，略過"; continue; }
  ./make_skill_fx.sh "$id"
done

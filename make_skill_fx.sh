#!/bin/bash
# 必殺短片量產：關鍵畫面裁 21:9 → 即夢 image2video（seedance2.0_vip 720p 5s）→ 840x360 去音
set -uo pipefail
cd "$(dirname "$0")"
ID="$1"; SK=video/skills; TMP="${TMPDIR:-/tmp}/skillfx_$ID"; mkdir -p "$TMP" game/fx
RAW="$SK/${ID}_key_raw.png"; [ -f "$RAW" ] || { echo "$ID: 沒有關鍵畫面"; exit 1; }
ffmpeg -y -loglevel error -i "$RAW" -vf "crop='if(gt(iw/ih,21/9),trunc(ih*21/9/2)*2,iw)':'if(gt(iw/ih,21/9),ih,trunc(iw*9/21/2)*2)'" "$SK/${ID}_key.png" || exit 1
cp "$SK/${ID}_key.png" "$TMP/key.png"
MOTION=$(awk -F'\t' -v k="$ID" '$1==k{print $2}' "$SK/motion_prompts.tsv")
PROMPT="格鬥遊戲必殺技動畫，保持原圖的漫畫風格與構圖。${MOTION} 嚴格保持角色臉型、髮型、眼鏡與西裝領帶一致。禁止任何文字、字幕、標誌、數字，禁止換臉，禁止台詞與旁白。"
( cd "$TMP" && dreamina image2video --image ./key.png --prompt="$PROMPT" --duration=5 --video_resolution=720p --model_version=seedance2.0_vip --poll=600 ) > "$TMP/result.json" 2>&1
URL=$(python3 -c "import json,re,sys; t=open('$TMP/result.json').read(); j=json.loads(t[t.index('{'):]); print(j['result_json']['videos'][0]['video_url'])" 2>/dev/null)
CREDIT=$(python3 -c "import json; t=open('$TMP/result.json').read(); print(json.loads(t[t.index('{'):]).get('credit_count',''))" 2>/dev/null)
[ -n "$URL" ] || { echo "$ID: 生成失敗 $(tail -c 300 "$TMP/result.json")"; exit 1; }
curl -sfL -o "$SK/${ID}_raw.mp4" "$URL" || { echo "$ID: 下載失敗"; exit 1; }
ffmpeg -y -loglevel error -ss 0.3 -t 4.2 -i "$SK/${ID}_raw.mp4" -an -vf "scale=840:360:flags=lanczos,fps=30" -c:v libx264 -profile:v main -pix_fmt yuv420p -crf 31 -preset slow -movflags +faststart "game/fx/${ID}.mp4"
ffmpeg -y -loglevel error -ss 0.3 -i "$SK/${ID}_raw.mp4" -frames:v 1 -vf "scale=840:360" -q:v 4 "game/fx/${ID}.jpg"
echo "$ID: OK 積分 ${CREDIT} 大小 $(du -k game/fx/${ID}.mp4 | cut -f1)KB"

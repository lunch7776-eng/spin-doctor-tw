#!/bin/bash
# 播報員語音：macOS 台灣中文 TTS → ffmpeg 街機效果 → game/audio/v_*.mp3
set -euo pipefail
cd "$(dirname "$0")"
VOICE="${VOICE:-Reed (中文（台灣）)}"
OUT=game/audio; TMP=$(mktemp -d); mkdir -p "$OUT"
FX="asetrate=22050*0.9,aresample=44100,atempo=1.15,acompressor=threshold=-18dB:ratio=6:attack=5:release=80,aecho=0.8:0.6:45|90:0.3|0.15,volume=2.2,alimiter=limit=0.95"
gen(){ say -v "$VOICE" -r 215 -o "$TMP/$1.aiff" "$2"; ffmpeg -y -loglevel error -i "$TMP/$1.aiff" -af "$FX" -ac 1 -b:a 64k "$OUT/v_$1.mp3"; }
while IFS='|' read -r key text; do [ -n "$key" ] && gen "$key" "$text"; done <<'LIST'
press|爆料記者會！
deepfake|深偽影片！
trolls|網軍洗版！
oldphoto|舊照出土！
pundit|名嘴通告！
farm|假帳號農場！
sidekick|側翼粉專！
talkshow|政論節目！
street|掃街拜票！
temple|宮廟繞境！
bento|便當發放！
influencer|網紅業配！
poll|灌水民調！
clarify|澄清記者會！
factcheck|檢舉查核！
apology|道歉影片！
blame|甩鍋！
lastnight|選前一夜！
n_cash|普發一萬！
n_bot|指控機器人洗版！
b_qa|必殺技！問A，答BCD！
b_script|必殺技！講稿機，啟動！
b_baoli|必殺技！寶立答B！
b_wei|必殺技！圍講救賴！
b_harvard|必殺技！哈佛英文演講！
b_oldpost|必殺技！挖出十二年前舊文！
b_hen|必殺技！母雞帶小雞！
b_fake|必殺技！人工佯流！
g_tide|必殺大絕招！洋流，來襲！
g_chair|必殺技！國中椅子技！
g_english|必殺技！全英文開講！
g_anytime|必殺技！隨時可辯！
g_wanted|必殺技！被對岸立案調查！
g_bear|必殺技！黑熊特訓！
g_airport|必殺技！松機遷移！
g_haircut|必殺技！立院男神！
sys_combo2|二連擊！
sys_combo3|三連擊！
sys_combo4|四連擊！
sys_combo5|五連擊！
sys_combo6|超級連擊！停不下來！
sys_crit|會心一擊！
sys_fire|全網炎上！
sys_poll|民調出爐！
sys_win|當選！
sys_lose|落選！
sys_swap|換將！
sys_lead|民調領先！
sys_fight|開打！
sys_myturn|輪到你操盤！
sys_opturn|對手出招！
sys_shieldbreak|護盾破裂！
sys_ansB|答B！
sys_ansC|答C！
sys_ansD|答D！
sys_surge|聲量暴衝！
sys_backlash|反感飆升！
sys_count|開票！
sys_vs|首都之戰！
sys_reward|金主加碼！
sys_zero|聲量歸零！
sys_destroy|暗樁被抓包！
sys_flip|領歸領，票照投！
sys_danger|警告！反感快爆了！
LIST
rm -rf "$TMP"
ls "$OUT" | wc -l; du -sh "$OUT"

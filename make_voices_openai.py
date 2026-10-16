#!/usr/bin/env python3
"""播報員語音（有情緒版）：OpenAI gpt-4o-mini-tts → ffmpeg 後製 → game/audio/v_*.mp3
用法：python3 make_voices_openai.py [--voice ash] [--only key1,key2] [--out game/audio] [--prefix v_]
金鑰從環境變數或 ~/.zshrc 讀取，不寫進檔案。"""
import argparse, json, os, re, subprocess, sys, tempfile, urllib.request, concurrent.futures as cf

BASE = ("口音：台灣國語腔調（台灣人說中文的口音，不要大陸腔、不要兒化音）。"
        "角色：熱血格鬥遊戲的現場播報員。")
STYLE = {
  'skill': BASE + "情緒：全力嘶吼到快破音，腎上腺素爆表，像在宣告必殺技，最後一個字拉長。語速快、咬字重。",
  'ult':   BASE + "情緒：用盡全力的終極大絕招嘶吼，前半句蓄力壓低，後半句爆發狂吼並拉長尾音，史詩感。",
  'card':  BASE + "情緒：高亢有力、短促有勁的喊出招式名，像擂台主持人，充滿興奮。",
  'crit':  BASE + "情緒：爆炸性的震撼大喊，像看到驚天一擊，嗓音炸裂。",
  'combo': BASE + "情緒：越來越興奮的連擊播報，熱血沸騰，語尾上揚。",
  'panic': BASE + "情緒：驚慌失措、急促緊張，像大事不妙的警報播報。",
  'smug':  BASE + "情緒：得意又欠揍、帶著嘲諷的輕快語氣，像在耍賤閃過問題。",
  'win':   BASE + "情緒：狂喜歡呼、熱淚盈眶的勝利宣告，聲音高亢。",
  'lose':  BASE + "情緒：悲壯、沉重、帶點戲劇化的失落宣告。",
  'hype':  BASE + "情緒：熱情激昂的大聲宣告，鼓動現場氣氛。",
}
LINES = [l.split('|') for l in """press|爆料記者會！|card
deepfake|深偽影片！|card
trolls|網軍洗版！|card
oldphoto|舊照出土！|card
pundit|名嘴通告！|card
farm|假帳號農場！|card
sidekick|側翼粉專！|card
talkshow|政論節目！|card
street|掃街拜票！|card
temple|宮廟繞境！|card
bento|便當發放！|card
influencer|網紅業配！|card
poll|灌水民調！|card
clarify|澄清記者會！|card
factcheck|檢舉查核！|card
apology|道歉影片！|card
blame|甩鍋！|card
lastnight|選前一夜！|card
n_cash|普發一萬！|card
n_bot|指控機器人洗版！|card
b_qa|必殺技！問A——答BCD！|skill
b_script|必殺技！講稿機——啟動！|skill
b_baoli|必殺技！寶立——答B！|skill
b_wei|必殺技！圍講救賴！|skill
b_harvard|必殺技！哈佛英文演講！|skill
b_oldpost|必殺技！挖出十二年前舊文！|skill
b_hen|必殺技！母雞帶小雞！|skill
b_fake|必殺技！人工佯流！|skill
g_tide|必殺大絕招！洋流——來襲！|ult
g_chair|必殺技！國中——椅子技！|skill
g_english|必殺技！全英文開講！|skill
g_anytime|必殺技！隨時可辯！|skill
g_wanted|必殺技！被對岸立案調查！|skill
g_bear|必殺技！黑熊特訓！|skill
g_airport|必殺技！松機遷移！|skill
g_haircut|必殺技！立院男神！|skill
sys_combo2|二連擊！|combo
sys_combo3|三連擊！|combo
sys_combo4|四連擊！|combo
sys_combo5|五連擊！|combo
sys_combo6|超級連擊！停不下來啦！|combo
sys_crit|會心一擊！|crit
sys_fire|全網炎上啦！|panic
sys_poll|民調出爐！|hype
sys_win|當選！凍蒜！|win
sys_lose|落選了……|lose
sys_swap|換將！|lose
sys_lead|民調領先！|win
sys_fight|首都之戰，開打！|hype
sys_myturn|輪到你操盤！|hype
sys_opturn|對手出招！|hype
sys_shieldbreak|護盾破裂！|crit
sys_ansB|答B！|smug
sys_ansC|答C～|smug
sys_ansD|答D啦！|smug
sys_surge|聲量暴衝！|hype
sys_backlash|反感飆升！|panic
sys_count|開票！|hype
sys_vs|首都之戰！|hype
sys_reward|金主加碼！|hype
sys_zero|聲量歸零！|crit
sys_destroy|暗樁被抓包！|crit
sys_flip|領歸領，票照投！|smug
sys_danger|警告！反感快爆了！|panic
sys_pack|黑箱包——開！|hype
sys_ssr|傳說級！出貨啦！|crit
sys_sr|史詩級！|win
sys_new|新卡入手！|hype
sys_achieve|成就達成！|win""".strip().splitlines()]

def key():
    k = os.environ.get('OPENAI_API_KEY')
    if k: return k
    m = re.search(r'OPENAI_API_KEY=["\']?([^"\'\s]+)', open(os.path.expanduser('~/.zshrc')).read())
    if not m: sys.exit('找不到 OPENAI_API_KEY')
    return m.group(1)

FX = "acompressor=threshold=-20dB:ratio=4:attack=3:release=60,aecho=0.8:0.5:35:0.12,loudnorm=I=-12:TP=-1:LRA=7"

def gen(k, voice, key_, text, style, out):
    body = json.dumps({"model":"gpt-4o-mini-tts","voice":voice,"input":text,"instructions":STYLE[style],"response_format":"mp3"}).encode()
    req = urllib.request.Request("https://api.openai.com/v1/audio/speech", data=body,
        headers={"Authorization":"Bearer "+k,"Content-Type":"application/json"})
    with urllib.request.urlopen(req, timeout=90) as r: raw = r.read()
    with tempfile.NamedTemporaryFile(suffix='.mp3', delete=False) as t: t.write(raw); tp = t.name
    subprocess.run(["ffmpeg","-y","-loglevel","error","-i",tp,"-af",FX,"-ac","1","-ar","44100","-b:a","80k",out], check=True)
    os.unlink(tp); return key_

if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('--voice', default='ash'); ap.add_argument('--only', default='')
    ap.add_argument('--out', default='game/audio'); ap.add_argument('--prefix', default='v_')
    a = ap.parse_args(); os.chdir(os.path.dirname(os.path.abspath(__file__))); os.makedirs(a.out, exist_ok=True)
    only = set(filter(None, a.only.split(','))); k = key()
    todo = [l for l in LINES if not only or l[0] in only]
    with cf.ThreadPoolExecutor(6) as ex:
        futs = [ex.submit(gen, k, a.voice, kk, t, s, os.path.join(a.out, f"{a.prefix}{kk}.mp3")) for kk, t, s in todo]
        for f in cf.as_completed(futs):
            try: f.result()
            except Exception as e: print('FAIL', e)
    print('done', len(todo), 'voice', a.voice)

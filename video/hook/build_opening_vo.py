#!/usr/bin/env python3
"""開頭動畫（opening_v1 15 秒）＋急促旁白＋配樂 → game/fx/hook.mp4
字幕與結尾標題由遊戲網頁疊加（HOOK_CAPS），影片本身不放字。"""
import subprocess, os
os.chdir(os.path.dirname(os.path.abspath(__file__)))
ROOT = '../..'
SRC = f'{ROOT}/video/opening_v1.mp4'
BGM = f'{ROOT}/game/audio/bgm_battle.mp3'
OUT = f'{ROOT}/game/fx/hook.mp4'
POSTER = f'{ROOT}/game/fx/hook.jpg'
SRC_DUR = 15.0
HOLD = 1.2                      # 結尾金拳定格，讓「快！接下委託！」講完
TOTAL = SRC_DUR + HOLD

TEMPO = 1.25
# 對應動畫段落：0 雷雨台北｜1.5 號外｜3 藍登場｜5.5 綠登場｜8 對撞｜10 迷因卡｜12.5 巨手提線｜14 金拳
VO = [('vo/r1_trim.wav', 0.3),    # 委託來了！
      ('vo/r2_trim.wav', 1.6),    # 選舉不是比誰比較好——（號外）
      ('vo/r3_trim.wav', 8.0),    # 是比誰比較會操作！（對撞）
      ('vo/r4_trim.wav', 12.4),   # 今晚，你就是那隻手！（巨手提線）
      ('vo/r5_trim.wav', 14.5)]   # 快！接下委託！（金拳定格）

def run(c): subprocess.run(c, check=True)

# 影像：裁掉左上「AI生成」浮水印 → 960x540 → 結尾定格
run(['ffmpeg', '-y', '-loglevel', 'error', '-t', str(SRC_DUR), '-i', SRC, '-an', '-vf',
     f'crop=768:432:86:48,scale=960:540:flags=lanczos,fps=30,setsar=1,tpad=stop_mode=clone:stop_duration={HOLD}',
     '-c:v', 'libx264', '-crf', '16', '-preset', 'medium', '-pix_fmt', 'yuv420p', 'op_video.mp4'])

# 聲音：原片音效 ＋ 配樂（旁白時自動壓低）＋ 旁白
inp = ['-t', str(SRC_DUR), '-i', SRC, '-ss', '128', '-t', str(TOTAL), '-i', BGM]
af = [f'[0:a]volume=0.9,apad=whole_dur={TOTAL}[orig]',
      f'[1:a]volume=0.45,afade=t=in:st=0:d=0.4,afade=t=out:st={TOTAL-0.7}:d=0.7[bgm]']
vox = []
for i, (f, t) in enumerate(VO):
    inp += ['-i', f]; k = i + 2; d = int(t * 1000)
    af.append(f'[{k}:a]atempo={TEMPO},adelay={d}|{d},apad=whole_dur={TOTAL}[v{k}]'); vox.append(f'[v{k}]')
af.append(''.join(vox) + f'amix=inputs={len(vox)}:normalize=0,volume=1.7,asplit=3[vm][vsc1][vsc2]')
af.append('[bgm][vsc1]sidechaincompress=threshold=0.03:ratio=10:attack=5:release=250[bgmd]')
af.append('[orig][vsc2]sidechaincompress=threshold=0.05:ratio=4:attack=5:release=200[origd]')
af.append(f'[bgmd][origd][vm]amix=inputs=3:normalize=0,alimiter=limit=0.95,loudnorm=I=-14:TP=-1.5:LRA=9,atrim=duration={TOTAL}[aout]')
run(['ffmpeg', '-y', '-loglevel', 'error', *inp, '-filter_complex', ';'.join(af), '-map', '[aout]', '-ar', '44100', 'op_audio.wav'])

run(['ffmpeg', '-y', '-loglevel', 'error', '-i', 'op_video.mp4', '-i', 'op_audio.wav', '-c:v', 'libx264', '-crf', '27',
     '-preset', 'slow', '-profile:v', 'main', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '96k', '-shortest',
     '-movflags', '+faststart', OUT])
run(['ffmpeg', '-y', '-loglevel', 'error', '-ss', '4.4', '-i', OUT, '-frames:v', '1', '-q:v', '5', POSTER])
print('OK', OUT, f'{os.path.getsize(OUT)//1024}KB', 'total', TOTAL)

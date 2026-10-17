#!/usr/bin/env python3
"""開場 Hook 10 秒：從 opening_v1（15 秒開頭動畫）剪精華 ＋ 急促旁白 ＋ 配樂 → game/fx/hook.mp4
字幕與結尾標題由遊戲網頁疊加（HOOK_CAPS），影片本身不放字。"""
import subprocess, os
os.chdir(os.path.dirname(os.path.abspath(__file__)))
ROOT = '../..'
SRC = f'{ROOT}/video/opening_v1.mp4'
BGM = f'{ROOT}/game/audio/bgm_battle.mp3'
OUT = f'{ROOT}/game/fx/hook.mp4'
POSTER = f'{ROOT}/game/fx/hook.jpg'

# (原片起點, 長度)：號外撕開 → 藍登場 → 綠登場 → 對撞 → 迷因卡 → 巨手提線 → 金拳
SEGS = [(1.6, 1.2), (3.4, 1.6), (5.9, 1.6), (8.0, 1.6), (10.2, 0.8), (12.4, 1.8), (14.0, 1.0)]
HOLD = 0.9                       # 結尾定格，讓「快！接下委託！」講完
TOTAL = round(sum(d for _, d in SEGS) + HOLD, 3)

TEMPO = 1.25
VO = [('vo/r2_trim.wav', 0.15),   # 選舉不是比誰比較好——（號外、藍登場）
      ('vo/r3_trim.wav', 2.75),   # 是比誰比較會操作！（綠登場→對撞）
      ('vo/r4_trim.wav', 6.75),   # 今晚，你就是那隻手！（巨手提線）
      ('vo/r5_trim.wav', 8.85)]   # 快！接下委託！（金拳）

def run(c): subprocess.run(c, check=True)

# 影像＋原片音效：逐段裁切後串接（裁掉左上「AI生成」浮水印）
inp, fc, cat = [], [], ''
for i, (ss, du) in enumerate(SEGS):
    inp += ['-ss', str(ss), '-t', str(du), '-i', SRC]
    fc.append(f'[{i}:v]crop=768:432:86:48,scale=960:540:flags=lanczos,fps=30,setsar=1,trim=duration={du},setpts=PTS-STARTPTS[v{i}]')
    fc.append(f'[{i}:a]atrim=duration={du},asetpts=PTS-STARTPTS,afade=t=in:d=0.02,afade=t=out:st={du-0.03}:d=0.03[a{i}]')
    cat += f'[v{i}][a{i}]'
fc.append(cat + f'concat=n={len(SEGS)}:v=1:a=1[vc][ac]')
fc.append(f'[vc]tpad=stop_mode=clone:stop_duration={HOLD}[vout]')
fc.append(f'[ac]apad=whole_dur={TOTAL}[aout]')
run(['ffmpeg', '-y', '-loglevel', 'error', *inp, '-filter_complex', ';'.join(fc), '-map', '[vout]', '-map', '[aout]',
     '-c:v', 'libx264', '-crf', '16', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-c:a', 'pcm_s16le', 'op_cut.mov'])

# 聲音：原片音效 ＋ 配樂（旁白時自動壓低）＋ 旁白
inp = ['-i', 'op_cut.mov', '-ss', '128', '-t', str(TOTAL), '-i', BGM]
af = [f'[0:a]volume=0.9[orig]', f'[1:a]volume=0.5,afade=t=in:st=0:d=0.3,afade=t=out:st={TOTAL-0.5}:d=0.5[bgm]']
vox = []
for i, (f, t) in enumerate(VO):
    inp += ['-i', f]; k = i + 2; d = int(t * 1000)
    af.append(f'[{k}:a]atempo={TEMPO},adelay={d}|{d},apad=whole_dur={TOTAL}[v{k}]'); vox.append(f'[v{k}]')
af.append(''.join(vox) + f'amix=inputs={len(vox)}:normalize=0,volume=1.7,asplit=3[vm][vsc1][vsc2]')
af.append('[bgm][vsc1]sidechaincompress=threshold=0.03:ratio=10:attack=5:release=250[bgmd]')
af.append('[orig][vsc2]sidechaincompress=threshold=0.05:ratio=4:attack=5:release=200[origd]')
af.append(f'[bgmd][origd][vm]amix=inputs=3:normalize=0,alimiter=limit=0.95,loudnorm=I=-14:TP=-1.5:LRA=9,atrim=duration={TOTAL}[aout]')
run(['ffmpeg', '-y', '-loglevel', 'error', *inp, '-filter_complex', ';'.join(af), '-map', '[aout]', '-ar', '44100', 'op_audio.wav'])

run(['ffmpeg', '-y', '-loglevel', 'error', '-i', 'op_cut.mov', '-i', 'op_audio.wav', '-map', '0:v', '-map', '1:a',
     '-c:v', 'libx264', '-crf', '27', '-preset', 'slow', '-profile:v', 'main', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '96k',
     '-shortest', '-movflags', '+faststart', OUT])
run(['ffmpeg', '-y', '-loglevel', 'error', '-ss', '1.8', '-i', OUT, '-frames:v', '1', '-q:v', '5', POSTER])
print('OK', OUT, f'{os.path.getsize(OUT)//1024}KB', 'total', TOTAL)

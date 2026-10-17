#!/usr/bin/env python3
"""開場 Hook 10 秒：新生成 2 鏡（委託書、操盤室）＋ opening_v1 精華 → 旁白＋音效＋配樂 → game/fx/hook.mp4
字幕與標題由遊戲網頁疊加（HOOK_CAPS），影片本身不放字。"""
import subprocess, os
os.chdir(os.path.dirname(os.path.abspath(__file__)))
ROOT = '../..'
OPEN = f'{ROOT}/video/opening_v1.mp4'
SFX = f'{ROOT}/video/trailer/sfx'
BGM = f'{ROOT}/game/audio/bgm_battle.mp3'
OUT = f'{ROOT}/game/fx/hook.mp4'
POSTER = f'{ROOT}/game/fx/hook.jpg'

# (來源, 起點, 長度, 是否裁掉舊片左上浮水印)
SEGS = [('A_raw.mp4', 0.7, 2.3, False),   # 委託書：雙手攤開機密檔案
        ('B_raw.mp4', 1.0, 2.1, False),   # 操盤室：按下紅色按鈕
        (OPEN, 4.15, 0.8, True),          # 藍：講稿鎧甲
        (OPEN, 6.6, 0.8, True),           # 綠：洋流
        (OPEN, 9.0, 1.0, True),           # 雙眼發光對撞
        (OPEN, 12.4, 2.4, True),          # 巨手提線：你就是那隻手
        (OPEN, 14.2, 0.6, True)]          # 金拳煙火（網頁疊標題）
TOTAL = round(sum(s[2] for s in SEGS), 3)

# 旁白（去頭尾靜音後 ×1.1），開始秒數；三句不重疊
VO = [('vo/hook1_trim.wav', 1.3), ('vo/hook2_trim.wav', 4.5), ('vo/hook3_trim.wav', 7.48)]
# 音效：(檔名, 秒, 音量)
CUES = [('rip', 0.05, .8), ('whoosh', 0.1, .6), ('deal', 0.9, .5), ('flip', 1.6, .5),
        ('whoosh', 2.3, .5), ('slam', 2.98, 1.0), ('zap', 3.0, .7), ('surge', 3.08, .7), ('sparkle', 3.5, .5), ('coins', 3.9, .45),
        ('zap', 4.4, .9), ('hit', 4.45, .7), ('surge', 5.2, .8), ('whoosh', 5.2, .6),
        ('crit', 6.0, 1.0), ('boom', 6.02, .9), ('riser', 7.0, .55), ('heart', 8.2, .5),
        ('gong', 9.4, 1.0), ('firework', 9.45, .8)]

def run(cmd): subprocess.run(cmd, check=True)

# 1) 影像
inp, fc, vl = [], [], []
for i, (src, ss, du, crop) in enumerate(SEGS):
    inp += ['-ss', str(ss), '-t', str(du), '-i', src]
    pre = 'crop=768:432:86:48,' if crop else ''
    fc.append(f'[{i}:v]{pre}scale=1280:720:flags=lanczos,fps=30,setsar=1,trim=duration={du},setpts=PTS-STARTPTS[v{i}]')
    vl.append(f'[v{i}]')
fc.append(''.join(vl) + f'concat=n={len(SEGS)}:v=1:a=0[vc]')
# 切點閃白（按按鈕、對撞）
fc.append('[vc]eq=brightness=0:enable=0[vout]')
run(['ffmpeg', '-y', '-loglevel', 'error', *inp, '-filter_complex', ';'.join(fc), '-map', '[vout]',
     '-an', '-c:v', 'libx264', '-crf', '16', '-preset', 'medium', '-pix_fmt', 'yuv420p', 'video_only.mp4'])

# 2) 聲音
ainp = ['-ss', '128', '-t', str(TOTAL), '-i', BGM]
af, k = [], 1
vox = []
for f, t in VO:
    ainp += ['-i', f]; d = int(t * 1000)
    af.append(f'[{k}:a]atempo=1.1,adelay={d}|{d},apad=whole_dur={TOTAL}[vo{k}]'); vox.append(f'[vo{k}]'); k += 1
sfx = []
for name, t, vol in CUES:
    ainp += ['-i', f'{SFX}/{name}.wav']; d = int(t * 1000)
    af.append(f'[{k}:a]volume={vol},adelay={d}|{d},apad=whole_dur={TOTAL}[s{k}]'); sfx.append(f'[s{k}]'); k += 1
af.append(''.join(vox) + f'amix=inputs={len(vox)}:normalize=0,volume=1.6[voxa]')
af.append('[voxa]asplit=2[voxm][voxsc]')
af.append(''.join(sfx) + f'amix=inputs={len(sfx)}:normalize=0,volume=0.8[sfxa]')
af.append(f'[0:a]volume=0.5,afade=t=in:st=0:d=0.4,afade=t=out:st={TOTAL-0.6}:d=0.6[bgm]')
af.append('[bgm][voxsc]sidechaincompress=threshold=0.03:ratio=10:attack=5:release=250[bgmd]')
af.append(f'[bgmd][voxm][sfxa]amix=inputs=3:normalize=0,alimiter=limit=0.95,loudnorm=I=-14:TP=-1.5:LRA=9,atrim=duration={TOTAL}[aout]')
run(['ffmpeg', '-y', '-loglevel', 'error', *ainp, '-filter_complex', ';'.join(af), '-map', '[aout]', '-ar', '44100', 'audio.wav'])

# 3) 合成（手機用：720p、小檔、faststart）
run(['ffmpeg', '-y', '-loglevel', 'error', '-i', 'video_only.mp4', '-i', 'audio.wav', '-c:v', 'libx264', '-crf', '28',
     '-preset', 'slow', '-profile:v', 'main', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '96k', '-shortest',
     '-movflags', '+faststart', OUT])
run(['ffmpeg', '-y', '-loglevel', 'error', '-ss', '0.6', '-i', OUT, '-frames:v', '1', '-q:v', '5', POSTER])
print('OK', OUT, f'{os.path.getsize(OUT)//1024}KB', 'total', TOTAL)

#!/usr/bin/env python3
"""幕後操盤手 20 秒直式預告片合成（ffmpeg）。素材：cap/*.mp4 實機錄影、video/skills/*_raw.mp4 必殺原片、game/audio 語音與配樂。"""
import subprocess, os, json
ROOT='/Users/lunch/知識筆記/幕後操盤手'; T=ROOT+'/video/trailer'; CAP=T+'/cap'; SEG=T+'/seg'; SK=ROOT+'/video/skills'; AUD=ROOT+'/game/audio'
W,H,FPS=1080,1920,30
def ff(args): subprocess.run(['ffmpeg','-y','-loglevel','error']+args,check=True)
ENC=['-an','-r',str(FPS),'-c:v','libx264','-crf','18','-preset','fast','-pix_fmt','yuv420p']
segs=[]
def band(name,clip,ss,dur,color):
    bh=round(W*630/1470/2)*2; y=(H-bh)//2
    vf=(f"[0:v]fps={FPS},split[a][b];[a]scale=-2:{H},crop={W}:{H},boxblur=24:2,eq=brightness=-0.28:saturation=1.3[bg];"
        f"[b]scale={W}:{bh}[fg];[bg][fg]overlay=0:{y},"
        f"drawbox=x=0:y={y-8}:w={W}:h=8:color={color}:t=fill,drawbox=x=0:y={y+bh}:w={W}:h=8:color={color}:t=fill,"
        f"zoompan=z='1.06-0.06*min(1,on/8)':d=1:s={W}x{H}:fps={FPS}")
    out=f'{SEG}/{name}.mp4'; ff(['-ss',str(ss),'-t',str(dur),'-i',clip,'-filter_complex',vf]+ENC+[out]); segs.append((out,dur))
def cap(name,src,ss,dur,speed=1.0,zoom=True,crop=None):
    vf=[]
    if crop: vf.append(crop)
    vf.append(f"scale={W}:{H}")
    if speed!=1.0: vf.append(f"setpts=PTS/{speed}")
    if zoom: vf.append(f"zoompan=z='1.07-0.07*min(1,on/7)':d=1:s={W}x{H}:fps={FPS}")
    out=f'{SEG}/{name}.mp4'; ff(['-ss',str(ss),'-t',str(dur*speed),'-i',src,'-vf',','.join(vf)]+ENC+[out]); segs.append((out,dur))
BLUE='0x3f8cff'; GREEN='0x36d27a'
band('s01_tide',SK+'/g_tide_raw.mp4',0.6,1.6,GREEN)
cap('s02_vs',CAP+'/vs.mp4',0.3,2.0,crop='crop=960:1707:60:30')
for i,(ss,d) in enumerate([(1.2,.7),(2.3,.6),(3.3,.6),(4.6,.7),(9.0,.6),(11.8,.9),(14.0,1.1)]):
    cap(f's03_b{i}',CAP+'/battle.mp4',ss,d)
for i,(clip,ss,d,col) in enumerate([('b_qa',0.9,1.3,BLUE),('g_chair',1.2,0.9,GREEN),('b_script',1.2,0.6,BLUE),('b_fake',1.4,1.2,BLUE)]):
    band(f's04_k{i}',f'{SK}/{clip}_raw.mp4',ss,d,col)
for i,(ss,d) in enumerate([(1.9,.7),(2.6,.6),(6.4,1.0),(8.3,.5)]):
    cap(f's05_g{i}',CAP+'/gacha.mp4',ss,d)
cap('s06_count',CAP+'/count.mp4',0.5,1.9,speed=2.6,zoom=False)
cap('s06_seal',CAP+'/count.mp4',7.6,0.5)
cap('s07_end',CAP+'/end.mp4',0.3,2.0,zoom=False)
# concat + white flashes on every cut
with open(SEG+'/list.txt','w') as f:
    for p,_ in segs: f.write(f"file '{p}'\n")
cuts=[]; t=0
for _,d in segs[:-1]: t+=d; cuts.append(t)
en='+'.join(f"between(t,{c-0.034:.3f},{c+0.05:.3f})" for c in cuts)
ff(['-f','concat','-safe','0','-i',SEG+'/list.txt','-vf',f"drawbox=x=0:y=0:w=iw:h=ih:color=white@0.8:t=fill:enable='{en}'"]+ENC+[T+'/video_only.mp4'])
total=sum(d for _,d in segs)
# ---- audio：配樂＋不重疊的短語音＋對位音效 ----
SFXD=T+'/sfx'; VO=T+'/vo'
import re
def peak(f):
    r=subprocess.run(['ffmpeg','-hide_banner','-i',f,'-af','volumedetect','-f','null','-'],capture_output=True,text=True).stderr
    m=re.search(r'max_volume: ([-0-9.]+) dB',r); return float(m.group(1)) if m else 0.0
os.makedirs(SFXD+'/n',exist_ok=True)
for f in os.listdir(SFXD):
    if f.endswith('.wav'): ff(['-i',f'{SFXD}/{f}','-af',f'volume={-3-peak(f"{SFXD}/{f}"):.2f}dB',f'{SFXD}/n/{f}'])
VOICES=[('t_tide',0.10,1.0),('t_vs',1.85,1.0),('t_crit',6.85,1.2),('t_fire',7.98,1.0),('t_qa',8.88,1.25),('t_chair',10.33,1.0),
        ('t_fake',11.62,1.15),('t_pack',12.95,1.0),('t_ssr',14.15,1.0),('t_win',17.62,1.0),('t_title',18.50,1.0)]
CUES=[(0.0, 'cutin', 0), (0.05, 'boom', -2), (0.1, 'choir', -9), (1.5, 'whoosh', -4), (1.6, 'vs', 0), (1.65, 'slam', -3), (2.6, 'heart', -6), (3.0, 'heart', -1), (3.05, 'whoosh', -1), (3.2, 'riser', -3), (3.5, 'whoosh', 1), (3.6, 'whoosh', 2), (3.75, 'cutin', 0), (3.9, 'zap', 1), (4.0, 'smear', -2), (4.3, 'surge', 1), (4.35, 'gain', 1), (4.6, 'coins', 0), (4.95, 'hit', 2), (5.0, 'combo', -1), (5.12, 'hit', 2), (5.29, 'hit', 2), (5.5, 'smear', -3), (5.65, 'extra', -2), (6.2, 'cutin', -3), (6.25, 'whoosh', -5), (6.8, 'crit', 0), (6.85, 'boom', -2), (7.25, 'boo', -9), (7.7, 'fire', -2), (7.9, 'boo', -7), (8.25, 'extra', -5), (8.8, 'cutin', -2), (8.85, 'boom', -4), (9.25, 'zap', -5), (10.1, 'cutin', -3), (10.4, 'hit', -1), (10.45, 'slam', -3), (11.0, 'zap', -2), (11.05, 'sparkle', -8), (11.05, 'whoosh', -4), (11.6, 'cutin', -3), (11.9, 'smear', -4), (12.3, 'slam', -4), (12.8, 'riser', -4), (12.85, 'heart', -5), (13.2, 'heart', -5), (13.5, 'rip', 0), (13.55, 'boom', -1), (14.0, 'choir', -4), (14.15, 'gong', -3), (14.2, 'sparkle', -6), (14.3, 'cheer', -6), (15.0, 'riser', -2), (15.1, 'flip', 1), (15.2, 'deal', -1), (15.25, 'coins', -1), (15.65, 'tally', -1), (15.9, 'coins', -1), (16.2, 'riser', -1), (16.4, 'tally', -1), (16.6, 'coins', -1), (16.9, 'heart', 1), (17.25, 'heart', 1), (17.6, 'slam', 0), (17.62, 'boom', -1), (17.65, 'fanfare', -3), (17.7, 'cheer', -3), (18.0, 'firework', -5), (18.15, 'gong', -1), (18.3, 'sparkle', -8), (18.6, 'firework', -6), (19.1, 'firework', -7)]
# 檢查語音不重疊
vt=[]
for n,at,tp in VOICES:
    d=float(subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',f'{VO}/{n}_trim.wav'],capture_output=True,text=True).stdout)/tp
    vt.append((at,at+d,n))
for (a1,b1,n1),(a2,b2,n2) in zip(vt,vt[1:]):
    assert b1<=a2+0.001, f'語音重疊：{n1} 到 {b1:.2f}，{n2} 從 {a2:.2f}'
# ---- 字幕：每句旁白都上大字（置中、廣告感），時間＝該句實際播放區間 ----
CAPD=T+'/captions'; SKIP_CAP={'t_title'}   # 結尾卡本身就是「幕後操盤手」大標，不重複疊字
cin=['-i',T+'/video_only.mp4']; cfc=[]; last='[0:v]'; ci=0
for idx,(a0,b0,n) in enumerate(vt):
    if n in SKIP_CAP or not os.path.exists(f'{CAPD}/{n}.png'): continue
    nxt=vt[idx+1][0] if idx+1<len(vt) else total
    st=max(0,a0-0.04); en=min(max(b0+0.12,a0+0.75),nxt-0.02,total)
    cin+=['-loop','1','-t',str(total),'-i',f'{CAPD}/{n}.png']; ci+=1
    cfc.append(f"[{ci}:v]format=rgba,fade=t=in:st={st:.2f}:d=0.08:alpha=1,fade=t=out:st={en-0.1:.2f}:d=0.1:alpha=1[c{ci}]")
    cfc.append(f"{last}[c{ci}]overlay=(W-w)/2:(H-h)/2:enable='between(t,{st:.2f},{en:.2f})'[o{ci}]"); last=f'[o{ci}]'
ff(cin+['-filter_complex',';'.join(cfc),'-map',last]+ENC+[T+'/video_capped.mp4'])
print('captions',ci)
inputs=['-ss','130','-t',str(total),'-i',AUD+'/bgm_battle.mp3']; fc=[]; vl=[]; sl=[]; k=0
for i,(n,at,tp) in enumerate(VOICES):
    inputs+=['-i',f'{VO}/{n}_trim.wav']; k+=1
    fc.append(f"[{k}:a]atempo={tp},volume=1.15,adelay={int(at*1000)}|{int(at*1000)}[v{i}]"); vl.append(f'[v{i}]')
for j,(at,n,g) in enumerate(CUES):
    inputs+=['-i',f'{SFXD}/n/{n}.wav']; k+=1
    fc.append(f"[{k}:a]volume={g}dB,adelay={int(at*1000)}|{int(at*1000)}[s{j}]"); sl.append(f'[s{j}]')
fc.append(''.join(vl)+f"amix=inputs={len(vl)}:normalize=0[vox]")
fc.append(''.join(sl)+f"amix=inputs={len(sl)}:normalize=0,volume=0.55[sfx]")
fc.append("[vox]asplit[voxa][voxsc]")
fc.append(f"[0:a]volume=0.5,afade=t=in:st=0:d=0.3,afade=t=out:st={total-0.8}:d=0.8[bgm]")
fc.append("[bgm][voxsc]sidechaincompress=threshold=0.04:ratio=8:attack=5:release=220[bgmd]")
fc.append("[sfx]asplit[sfxa][sfxsc]")
fc.append("[bgmd][sfxsc]sidechaincompress=threshold=0.1:ratio=2:attack=3:release=150[bgmd2]")
fc.append("[bgmd2][voxa][sfxa]amix=inputs=3:normalize=0,alimiter=limit=0.95,loudnorm=I=-14:TP=-1.5:LRA=9[aout]")
ff(inputs+['-filter_complex',';'.join(fc),'-map','[aout]','-t',str(total),'-ar','48000','-c:a','aac','-b:a','192k',T+'/audio.m4a'])
print('voices',len(VOICES),'sfx cues',len(CUES))
ff(['-i',T+'/video_capped.mp4','-i',T+'/audio.m4a','-map','0:v','-map','1:a','-c:v','copy','-c:a','copy','-shortest','-movflags','+faststart',T+'/幕後操盤手_預告_20s_9x16.mp4'])
print('segments',len(segs),'total',round(total,2),'cuts',len(cuts))

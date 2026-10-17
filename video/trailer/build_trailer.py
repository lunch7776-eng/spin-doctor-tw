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
for i,(clip,ss,col) in enumerate([('b_qa',1.0,BLUE),('g_chair',1.2,GREEN),('b_script',1.0,BLUE),('b_fake',1.5,BLUE)]):
    band(f's04_k{i}',f'{SK}/{clip}_raw.mp4',ss,1.0,col)
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
# ---- audio ----
ff(['-f','lavfi','-i',"aevalsrc='0.9*sin(2*PI*58*t*exp(-2.2*t))*exp(-5*t)':s=44100:d=0.9",T+'/boom.wav'])
ff(['-f','lavfi','-i',"aevalsrc='0.5*sin(2*PI*98*t)*exp(-1.4*t)+0.3*sin(2*PI*235*t)*exp(-1.8*t)+0.2*sin(2*PI*382*t)*exp(-2.4*t)':s=44100:d=2.5",T+'/gong.wav'])
V=lambda n:f'{AUD}/v_{n}.mp3'
voices=[ # (file, trim_start, trim_end, tempo, at, vol)
 (V('g_tide'),0.95,4.0,1.25,0.10,1.0),(V('sys_vs'),0,1.2,1.0,2.55,0.9),
 (V('sys_combo3'),0,1.2,1.1,4.6,0.85),(V('sys_crit'),0,1.4,1.1,6.85,1.0),(V('sys_fire'),0,1.6,1.15,7.75,1.0),
 (V('b_qa'),3.0,4.96,1.35,8.85,1.0),(V('g_chair'),1.43,3.59,1.45,9.8,1.0),(V('b_script'),1.27,2.2,1.1,10.85,1.0),(V('b_fake'),1.78,3.4,1.35,11.8,1.0),
 (V('sys_pack'),0,1.4,1.1,12.85,0.95),(V('sys_ssr'),0,1.9,1.1,14.15,1.0),(V('sys_count'),0,0.9,1.0,15.6,0.8),(V('sys_win'),0,2.8,1.05,17.45,1.0)]
booms=[0.0,1.6,3.6,6.8,7.7,8.8,9.8,10.8,11.8,13.5,14.1,17.5]
inputs=['-ss','130','-t',str(total),'-i',AUD+'/bgm_battle.mp3']
fc=[]; vl=[]
for i,(f,a,b,tp,at,vol) in enumerate(voices):
    inputs+=['-i',f]; k=i+1
    fc.append(f"[{k}:a]atrim={a}:{b},asetpts=PTS-STARTPTS,atempo={tp},volume={vol},afade=t=out:st={max(0,(b-a)/tp-0.12):.2f}:d=0.12,adelay={int(at*1000)}|{int(at*1000)}[v{i}]"); vl.append(f'[v{i}]')
base=len(voices)+1
for j,bt in enumerate(booms):
    inputs+=['-i',T+'/boom.wav']; fc.append(f"[{base+j}:a]volume=0.7,adelay={int(bt*1000)}|{int(bt*1000)}[b{j}]")
inputs+=['-i',T+'/gong.wav']; g=base+len(booms); fc.append(f"[{g}:a]volume=0.9,adelay=18000|18000[gong]")
fc.append(''.join(vl)+f"amix=inputs={len(vl)}:normalize=0[vox]")
fc.append("[vox]asplit[voxa][voxsc]")
fc.append(f"[0:a]volume=0.6,afade=t=in:st=0:d=0.3,afade=t=out:st={total-0.8}:d=0.8[bgm]")
fc.append("[bgm][voxsc]sidechaincompress=threshold=0.05:ratio=6:attack=5:release=250[bgmd]")
fc.append("[bgmd][voxa]"+''.join(f'[b{j}]' for j in range(len(booms)))+f"[gong]amix=inputs={3+len(booms)}:normalize=0,alimiter=limit=0.95,loudnorm=I=-14:TP=-1.5:LRA=9[aout]")
ff(inputs+['-filter_complex',';'.join(fc),'-map','[aout]','-t',str(total),'-ar','48000','-c:a','aac','-b:a','192k',T+'/audio.m4a'])
ff(['-i',T+'/video_only.mp4','-i',T+'/audio.m4a','-map','0:v','-map','1:a','-c:v','copy','-c:a','copy','-shortest','-movflags','+faststart',T+'/幕後操盤手_預告_20s_9x16.mp4'])
print('segments',len(segs),'total',round(total,2),'cuts',len(cuts))

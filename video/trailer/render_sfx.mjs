// 用遊戲本身的 WebAudio 音效引擎離線渲染成 WAV（OfflineAudioContext）
import puppeteer from 'puppeteer-core'; import {spawn} from 'node:child_process'; import fs from 'node:fs';
const GAME='/Users/lunch/知識筆記/幕後操盤手/game', OUT='/Users/lunch/知識筆記/幕後操盤手/video/trailer/sfx';
const srv=spawn('python3',['-m','http.server','8957'],{cwd:GAME,stdio:'ignore'}); await new Promise(r=>setTimeout(r,700));
const b=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:'new'});
const p=await b.newPage(); await p.goto('http://localhost:8957/',{waitUntil:'networkidle0'});
const LIST={whoosh:['SFX.play()',0.7],slam:['SFX.slam()',0.6],boom:['SFX.boom()',1.8],crit:['SFX.crit()',1.2],hit:['SFX.hit(4)',0.5],
 combo:['SFX.combo(4)',0.45],gain:['SFX.gain(6);SFX.rise()',0.7],surge:['SFX.surge()',1.0],cheer:['SFX.cheer(5)',1.3],boo:['SFX.boo(2)',1.0],
 fire:['SFX.fire()',1.4],extra:['SFX.extra()',0.9],zap:['SFX.zap()',0.5],shield:['SFX.shield()',0.6],riser:['SFX.riser(1.2)',1.4],rip:['SFX.rip()',0.55],
 gong:['SFX.gong()',3.4],choir:['SFX.choir([262,330,392,523],2.0,.12)',2.2],sparkle:['SFX.sparkle(10)',1.0],flip:['SFX.flip()',0.35],deal:['SFX.deal(0)',0.25],
 coins:['for(let i=0;i<9;i++){AU.tone(988+i*25,.05,"square",.07,i*.06);AU.tone(1319+i*25,.08,"square",.06,.03+i*.06)}',0.8],
 tally:['for(let i=0;i<32;i++)AU.tone(500+i*9,.04,"square",.05,i*.05)',1.7],fanfare:['SFX.fanfare()',2.4],
 firework:['AU.noise(.6,.25,"lowpass",2000,0,200);AU.tone(90,.3,"sine",.4,0,40);AU.noise(.9,.12,"highpass",5000,.05,1500)',1.0],
 heart:['SFX.heart()',0.5],vs:['SFX.vs()',1.2],event:['SFX.stinger("event")',2.2],smear:['SFX.stinger("smear")',0.5],
 cutin:['AU.tone(70,.5,"sawtooth",.25,0,500);AU.noise(.35,.3,"highpass",900,0,9000);AU.tone(55,.7,"sine",.9,.32,30)',1.1]};
for(const [name,[code,dur]] of Object.entries(LIST)){
  const b64=await p.evaluate(async(code,dur)=>{
    const sr=48000, off=new OfflineAudioContext(2,Math.ceil(sr*dur),sr);
    AU.ctx=off; AU.master=off.createGain(); AU.master.gain.value=.9; AU.master.connect(off.destination);
    AU.sfx=off.createGain(); AU.sfx.gain.value=.85; AU.sfx.connect(AU.master); AU.mus=off.createGain(); AU.mus.connect(AU.master);
    const len=sr*1.5, nb=off.createBuffer(1,len,sr), d=nb.getChannelData(0); for(let i=0;i<len;i++) d[i]=Math.random()*2-1; AU.nbuf=nb;
    AU.rev=off.createConvolver(); const il=sr*1.4, ib=off.createBuffer(2,il,sr); for(let c=0;c<2;c++){ const x=ib.getChannelData(c); for(let i=0;i<il;i++) x[i]=(Math.random()*2-1)*Math.pow(1-i/il,3.2); }
    AU.rev.buffer=ib; AU.revIn=off.createGain(); AU.revIn.gain.value=.5; AU.revIn.connect(AU.rev); AU.rev.connect(AU.master); const send=off.createGain(); send.gain.value=.22; AU.sfx.connect(send); send.connect(AU.revIn);
    (new Function(code))();
    const buf=await off.startRendering(); const L=buf.getChannelData(0), R=buf.getChannelData(1), n=L.length;
    const wav=new DataView(new ArrayBuffer(44+n*4)); const ws=(o,s)=>{for(let i=0;i<s.length;i++)wav.setUint8(o+i,s.charCodeAt(i));};
    ws(0,'RIFF'); wav.setUint32(4,36+n*4,true); ws(8,'WAVEfmt '); wav.setUint32(16,16,true); wav.setUint16(20,1,true); wav.setUint16(22,2,true); wav.setUint32(24,sr,true); wav.setUint32(28,sr*4,true); wav.setUint16(32,4,true); wav.setUint16(34,16,true); ws(36,'data'); wav.setUint32(40,n*4,true);
    for(let i=0;i<n;i++){ wav.setInt16(44+i*4,Math.max(-1,Math.min(1,L[i]))*32767,true); wav.setInt16(46+i*4,Math.max(-1,Math.min(1,R[i]))*32767,true); }
    let s=''; const u=new Uint8Array(wav.buffer); for(let i=0;i<u.length;i+=32768) s+=String.fromCharCode.apply(null,u.subarray(i,i+32768)); return btoa(s);
  },code,dur);
  fs.writeFileSync(`${OUT}/${name}.wav`,Buffer.from(b64,'base64'));
}
await b.close(); srv.kill(); console.log('rendered',Object.keys(LIST).length);

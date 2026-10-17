// 預告片實機錄影：以 1080x1920 錄下遊戲的高潮片段（CDP screencast → ffmpeg）
import puppeteer from 'puppeteer-core';
import {spawn, execFileSync} from 'node:child_process';
import fs from 'node:fs'; import path from 'node:path';
const GAME='/Users/lunch/知識筆記/幕後操盤手/game', OUT='/Users/lunch/知識筆記/幕後操盤手/video/trailer/cap', TR='/Users/lunch/知識筆記/幕後操盤手/video/trailer';
const srv=spawn('python3',['-m','http.server','8955'],{cwd:GAME,stdio:'ignore'});
const srv2=spawn('python3',['-m','http.server','8956'],{cwd:TR,stdio:'ignore'});
await new Promise(r=>setTimeout(r,800));
const browser=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:'new',args:['--autoplay-policy=no-user-gesture-required','--hide-scrollbars']});
const page=await browser.newPage(); await page.setViewport({width:405,height:720,deviceScaleFactor:1080/405});
const cdp=await page.createCDPSession();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function record(name,ms,fn){
  const dir=path.join(OUT,name); fs.rmSync(dir,{recursive:true,force:true}); fs.mkdirSync(dir,{recursive:true});
  const frames=[]; const h=async e=>{ frames.push({t:e.metadata.timestamp,d:e.data}); try{ await cdp.send('Page.screencastFrameAck',{sessionId:e.sessionId}); }catch{} };
  cdp.on('Page.screencastFrame',h);
  await cdp.send('Page.startScreencast',{format:'jpeg',quality:88,maxWidth:1080,maxHeight:1920,everyNthFrame:1});
  const t0=Date.now(); if(fn) fn().catch(e=>console.error(name,e)); while(Date.now()-t0<ms) await sleep(50);
  await cdp.send('Page.stopScreencast'); cdp.off('Page.screencastFrame',h);
  let list=''; frames.forEach((f,i)=>{ const fn_=`f${String(i).padStart(5,'0')}.jpg`; fs.writeFileSync(path.join(dir,fn_),Buffer.from(f.d,'base64'));
    const dur=i<frames.length-1?Math.max(0.001,frames[i+1].t-f.t):0.05; list+=`file '${fn_}'\nduration ${dur.toFixed(4)}\n`; });
  if(frames.length) list+=`file 'f${String(frames.length-1).padStart(5,'0')}.jpg'\n`;
  fs.writeFileSync(path.join(dir,'list.txt'),list);
  execFileSync('ffmpeg',['-y','-loglevel','error','-f','concat','-safe','0','-i','list.txt','-vf','fps=30,scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,format=yuv420p','-c:v','libx264','-crf','18','-preset','fast',`../${name}.mp4`],{cwd:dir});
  console.log(name,'frames',frames.length);
}
const ev=s=>page.evaluate(s); const ONLY=process.argv[2];
await page.goto('http://localhost:8955/',{waitUntil:'networkidle0'}); await sleep(800);
await ev(`LOCAL.tutDone=1; LOCAL.adv=false; LOCAL.fxMode='off'; saveLocal(); try{localStorage.setItem('spin_save',JSON.stringify(Object.assign(SAVE,{freePacks:3})))}catch(e){}`);
await page.reload({waitUntil:'networkidle0'}); await sleep(800);
await ev(`ADV_ON=false; ALL_CARDS.forEach(id=>SAVE.owned[id]=true); save();`);
if(ONLY==='gacha'){
  await ev(`SAVE.pity=6; SAVE.freePacks=2; save(); packScreen();`); await sleep(500);
  await record('gacha',11000,()=>ev(`(async()=>{ openPack(); await sleep(2600); document.getElementById('gPack').click(); await sleep(1500); document.getElementById('gAll').click(); })()`));
  await browser.close(); srv.kill(); srv2.kill(); process.exit(0);
}
// 1. VS
await record('vs',2600,()=>ev(`newRun('blue'); RUN.name='操盤手'; vsScreen();`));
// 2. battle montage
await ev(`document.getElementById('overlay').hidden=true; startBattle();`); await sleep(2600);
await record('battle',15500,()=>ev(`(async()=>{
  const R=Math.random; B.op.buzz=24; B.op.backlash=4; B.me.buzz=9; renderAll();
  B.me.hand=['b_script','trolls','press','street','b_oldpost']; B.me.funds=10; B.me.maxFunds=10; renderAll(); await sleep(400);
  for(let k=0;k<4;k++){ await playCard(B.me,B.op,0,null); await sleep(150); }
  Math.random=()=>0.05; await playCard(B.me,B.op,0,null); Math.random=R; await sleep(500);
  B.op.backlash=8; B.op.buzz=22; renderSides(); B.me.hand=['n_bot','influencer']; renderAll(); await sleep(300);
  await playCard(B.me,B.op,0,null); await sleep(200); await playCard(B.me,B.op,0,null);
})()`));
// 3. gacha
await ev(`killBattle(); show('title'); SAVE.pity=6; SAVE.freePacks=2; save(); packScreen();`); await sleep(500);
await record('gacha',12500,()=>ev(`(async()=>{ openPack(); await sleep(2600); document.getElementById('gPack').click(); await sleep(1500); document.getElementById('gAll').click(); })()`));
// 4. election night
await ev(`document.getElementById('overlay').hidden=true; newRun('blue'); RUN.stage=3; startBattle();`); await sleep(2600);
await record('count',8500,()=>ev(`(async()=>{ B.week=STAGES[RUN.stage].weeks; B.me.votes=62; B.op.votes=58; renderAll(); await electionNight(); })()`));
// 5. endcard
await page.goto('http://localhost:8956/endcard.html',{waitUntil:'networkidle0'}); await sleep(300);
await record('end',2600,()=>page.reload({waitUntil:'networkidle0'}));
await browser.close(); srv.kill(); srv2.kill();

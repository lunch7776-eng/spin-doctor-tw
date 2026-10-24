// 只重錄預告片結尾卡（endcard.html → cap/end.mp4），用法：NODE_PATH=../../qa/node_modules node capture_end.cjs
const puppeteer=require('puppeteer-core'); const {spawn,execFileSync}=require('child_process'); const fs=require('fs'), path=require('path');
const TR=__dirname, OUT=path.join(TR,'cap');
(async()=>{ const srv=spawn('python3',['-m','http.server','8956'],{cwd:TR,stdio:'ignore'}); await new Promise(r=>setTimeout(r,800));
 const browser=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:'new',args:['--hide-scrollbars']});
 const page=await browser.newPage(); await page.setViewport({width:405,height:720,deviceScaleFactor:1080/405}); const cdp=await page.createCDPSession();
 await page.goto('http://localhost:8956/endcard.html',{waitUntil:'networkidle0'}); await new Promise(r=>setTimeout(r,300));
 const dir=path.join(OUT,'end'); fs.rmSync(dir,{recursive:true,force:true}); fs.mkdirSync(dir,{recursive:true});
 const frames=[]; cdp.on('Page.screencastFrame',async e=>{ frames.push({t:e.metadata.timestamp,d:e.data}); try{ await cdp.send('Page.screencastFrameAck',{sessionId:e.sessionId}); }catch{} });
 await cdp.send('Page.startScreencast',{format:'jpeg',quality:88,maxWidth:1080,maxHeight:1920,everyNthFrame:1});
 page.reload({waitUntil:'networkidle0'}); await new Promise(r=>setTimeout(r,2600)); await cdp.send('Page.stopScreencast');
 let list=''; frames.forEach((f,i)=>{ const n=`f${String(i).padStart(5,'0')}.jpg`; fs.writeFileSync(path.join(dir,n),Buffer.from(f.d,'base64')); const d=i<frames.length-1?Math.max(0.001,frames[i+1].t-f.t):0.05; list+=`file '${n}'\nduration ${d.toFixed(4)}\n`; });
 list+=`file 'f${String(frames.length-1).padStart(5,'0')}.jpg'\n`; fs.writeFileSync(path.join(dir,'list.txt'),list);
 execFileSync('ffmpeg',['-y','-loglevel','error','-f','concat','-safe','0','-i','list.txt','-vf','fps=30,scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,format=yuv420p','-c:v','libx264','-crf','16',path.join(OUT,'end.mp4')],{cwd:dir});
 console.log('end frames',frames.length); await browser.close(); srv.kill(); })();

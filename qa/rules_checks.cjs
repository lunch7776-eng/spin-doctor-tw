// Isolated rule checks: evaluate the shipped functions, stub only presentation.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync('game/index.html', 'utf8');
const between = (a, b) => source.slice(source.indexOf(a), source.indexOf(b, source.indexOf(a)));
const noop = () => {};
const el = {classList:{add:noop,remove:noop,toggle:noop},style:{setProperty:noop},animate:()=>({finished:Promise.resolve()}),querySelector:()=>el,getBoundingClientRect:()=>({left:0,top:0,width:1,height:1})};
const context = vm.createContext({console, Math:Object.create(Math),innerWidth:100,innerHeight:100,setTimeout:noop,
  document:{querySelector:()=>el,querySelectorAll:()=>[]},$:()=>el,
  SFX:new Proxy({}, {get:()=>noop}),AU:{tone:noop},VOICE:{play:noop},MUS:{},
  center:()=>({x:0,y:0}),floatAt:noop,edgeFlash:noop,renderSides:noop,renderHand:noop,
  renderAll:noop,comboShow:noop,ticker:noop,banner:noop,updateEndGlow:noop,
  fx:noop,ring:noop,flash:noop,shake:noop,zoomPunch:noop,buzzHaptic:noop,burst:noop,coinsTo:noop,
  sleep:async()=>{},hitstop:async()=>{},extra:async()=>{},fillT:x=>x,
  tweenNum:async()=>{},shuffle:x=>x,playCard:async()=>{throw Error('Unexpected AI card');}});
const extracted = [between('const CARDS={','const CAMPS='),between('const CAMPS={','const NEUTRAL_STARTER='),
  between('function newSide(', 'const dispVotes='), between('function api(', '/* =========================================================\n   FLOW'),
  between('async function unitTicks(', 'async function playCard('),between('async function resolveFires(', 'async function playerPlay('),
  between('async function myPhase(', 'function updateEndGlow('),between('async function opPhase(', 'async function settle('),
  between('async function settle(', 'async function electionNight(')].join('\n');
vm.runInContext('let B, RUN={stage:0,camp:"blue",cand:{color:"blue"}}, STAGES=[{scale:1,bonus:0}]; const dispVotes=s=>s.votes;\n'+extracted,context);
context.assert=assert;
vm.runInContext(`
const unit=(id,life=3)=>({id,life,uid:id});
function setup(){ B={combo:1,week:3,turnOwner:'me',pendingFire:[],me:newSide('me','M','','',[]),op:newSide('op','O','','',[])}; B.me.buzz=20; B.me.backlash=4; B.me.deck=['street']; B.op.buzz=30; B.op.backlash=3; Math.random=()=>.9; return api(B.me,B.op); }
const summary=()=>[B.me.buzz,B.me.backlash,B.me.votes,B.me.shield,B.op.buzz,B.op.backlash,B.op.votes,B.me.hand.length];
const cases={
 press:[21,5,0,0,26,3,0,0],deepfake:[20,6,0,0,22,3,0,0],trolls:[20,5,0,0,27,3,0,0],oldphoto:[20,4,0,0,28,3,0,1],
 street:[22,3,0,0,30,3,0,0],temple:[23,4,2,0,30,3,0,0],bento:[20,6,3,0,30,3,0,0],influencer:[25,4,0,0,30,3,0,0],
 poll:[30,5,0,0,30,3,0,0],clarify:[20,3,0,4,30,3,0,0],factcheck:[20,4,0,0,30,5,0,0],apology:[20,1,0,0,30,3,0,0],
 blame:[20,1,0,0,30,6,0,0],lastnight:[10,4,32,0,30,3,0,0],b_qa:[20,4,0,0,30,3,0,0],b_script:[22,4,0,0,30,3,0,0],
 b_baoli:[24,0,0,0,30,3,0,0],b_wei:[20,3,0,0,26,3,0,0],b_harvard:[25,4,0,0,30,3,0,0],b_oldpost:[20,5,0,0,25,3,0,0],
 b_fake:[20,4,0,0,18,3,0,0],g_chair:[20,4,0,0,24,3,0,0],g_english:[23,4,0,0,30,3,0,0],g_anytime:[20,4,0,0,27,3,0,0],
 g_wanted:[25,2,0,0,30,3,0,0],g_airport:[20,4,0,0,26,4,0,0],g_haircut:[24,4,0,0,30,3,0,0],n_cash:[20,4,4,0,30,3,0,0],n_bot:[20,4,0,0,30,6,0,0]
};
async function run(){
 for(const [id,expect] of Object.entries(cases)){const A=setup(); await CARDS[id].fx(A); assert.deepEqual(summary(),expect,id);}
 const ticks={pundit:[22,30,0,0],farm:[20,29,0,0],talkshow:[22,29,0,0],b_hen:[22,30,1,0],g_tide:[23,30,0,0],g_bear:[21,30,0,2]};
 for(const [id,expect] of Object.entries(ticks)){const A=setup();await CARDS[id].unit.tick(A);assert.deepEqual([B.me.buzz,B.op.buzz,B.me.votes,B.me.shield],expect,id);}
 for(const [id,expect] of Object.entries({deepfake:[15,7,0,0,30,3,0,0],b_harvard:[25,6,0,0,30,3,0,0],g_chair:[18,4,0,0,18,3,0,0],n_cash:[20,4,4,0,30,3,2,0]})){const A=setup();Math.random=()=>0;await CARDS[id].fx(A);assert.deepEqual(summary(),expect,id+' random');}
 let A=setup();B.me.units=[unit('sidekick')];await CARDS.farm.unit.tick(A);assert.equal(B.op.buzz,28);console.log('CONFIRMED sidekick changes farm damage 1 -> 2');
 A=setup();B.me.units=[unit('sidekick')];await CARDS.talkshow.unit.tick(A);assert.equal(B.op.buzz,28);console.log('CONFIRMED sidekick changes talkshow damage 1 -> 2');
 A=setup();B.me.backlash=0;await CARDS.b_baoli.fx(A);assert.equal(B.me.buzz,21);console.log('CONFIRMED b_baoli with 0 backlash still grants +1 buzz');
 A=setup();B.me.buzz=0;await CARDS.poll.fx(A);assert.equal(B.me.buzz,1);console.log('CONFIRMED poll at 0 buzz grants +1');
 A=setup();B.op.dodge=2;B.op.shield=4;await CARDS.trolls.fx(A);assert.equal(B.op.dodge,0);assert.equal(B.op.shield,3);assert.equal(B.op.buzz,30);
 A=setup();B.op.dodge=2;B.op.shield=4;await CARDS.g_anytime.fx(A);assert.equal(B.op.dodge,0);assert.equal(B.op.shield,0);assert.equal(B.op.buzz,27);
 A=setup();B.me.units=[unit('g_tide')];B.combo=3;await A.gain(10);assert.equal(B.me.buzz,38);
 for(let i=0;i<3;i++)await unitTicks(B.me,B.op);assert.equal(B.me.units.length,0);assert.equal(B.me.buzz,47);
 A=setup();B.me.units=[unit('pundit')];for(let i=0;i<3;i++)await unitTicks(B.me,B.op);assert.equal(B.me.units.length,0);assert.equal(B.me.buzz,26);
 A=setup();await CARDS.g_english.fx(A);await opPhase();assert.equal(B.op.funds,3);assert.equal(B.op.fundPenalty,0);await opPhase();assert.equal(B.op.funds,4);
 A=setup();B.me.fundPenalty=1;B.me.atkBuff=2;await myPhase();assert.equal(B.me.funds,4);assert.equal(B.me.fundPenalty,0);assert.equal(B.me.atkBuff,0);
 A=setup();B.me.atkBuff=2;await CARDS.trolls.fx(A);assert.equal(B.op.buzz,21);
 A=setup();B.me.buzz=21;B.me.backlash=9;A.back(1);await resolveFires();assert.equal(B.me.buzz,10);assert.equal(B.me.backlash,5);
 A=setup();B.me.backlash=9;A.back(3);A.back(1);await resolveFires();assert.equal(B.me.buzz,10);assert.equal(B.me.backlash,5);
 A=setup();B.me.buzz=0;B.me.backlash=0;await A.gain(-5);A.back(-3);await A.hit(100);await A.settleNow(2);assert.equal(B.me.buzz,0);assert.equal(B.me.backlash,0);assert.equal(B.me.votes,0);assert.equal(B.op.buzz,0);await settle();assert.equal(B.me.votes,2);
 for(const id of Object.keys(CARDS)){for(const rand of [0,.149,.249,.299,.399,.9]){A=setup();Math.random=()=>rand;if(CARDS[id].fx)await CARDS[id].fx(A);else if(CARDS[id].unit.tick)await CARDS[id].unit.tick(A);await resolveFires();for(const s of [B.me,B.op])for(const key of ['buzz','backlash','votes'])assert.ok(Number.isFinite(s[key])&&s[key]>=0,id+':'+key);}}
 console.log('PASS all '+Object.keys(CARDS).length+' card definitions inspected; 29 fx cases, 6 active ticks, 4 random branches; dodge, shieldbreak, atkBuff, fundPenalty, tide, 3 ticks, fire and finite/nonnegative boundaries');
}
run();
`,context);

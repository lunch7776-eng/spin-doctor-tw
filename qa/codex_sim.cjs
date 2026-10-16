#!/usr/bin/env node
'use strict';
// Run: node qa/codex_sim.cjs > qa/codex_sim_results.json
// Read-only source extraction: original CARDS, PHASES, buildStages, api and
// turn/card/settlement functions execute in a VM. Only presentation is stubbed.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const sourcePath = path.resolve(__dirname, '../game/index.html');
const html = fs.readFileSync(sourcePath, 'utf8');
function section(start, end) {
  const a = html.indexOf(start), b = html.indexOf(end, a);
  assert(a >= 0 && b > a, `Source boundary not found: ${start}`);
  return html.slice(a, b);
}
const extracted = [
  section('const TYPES=', 'const GAIN_HEAD='),
  section('let RUN=null', '/* =========================================================\n   RENDER'),
  section('function api(me,op)', '/* =========================================================\n   FLOW'),
  section('function newRun(camp)', 'async function electionNight()'),
].join('\n');
const noop = () => {};
const element = {
  style: {setProperty: noop}, classList: {add: noop, remove: noop, toggle: noop},
  dataset: {}, offsetWidth: 118, offsetHeight: 168, hidden: false,
  getBoundingClientRect: () => ({left: 0, top: 0, width: 118, height: 168}),
  animate: () => ({finished: Promise.resolve()}), querySelector: () => element,
  querySelectorAll: () => [], appendChild: noop, remove: noop,
};
element.firstElementChild = element;
const math = Object.create(Math);
let rng = 0;
math.random = () => {
  rng = (rng + 0x6D2B79F5) >>> 0;
  let t = rng;
  t = Math.imul(t ^ t >>> 15, t | 1);
  t ^= t + Math.imul(t ^ t >>> 7, t | 61);
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
};
const ctx = {
  Math: math, assert, console,
  document: {querySelector: () => element, querySelectorAll: () => [],
    createElement: () => element, body: element},
  localStorage: {getItem: () => null, setItem: noop},
  innerWidth: 1000, innerHeight: 800,
  setTimeout: noop, setInterval: noop, clearInterval: noop,
  SFX: new Proxy({}, {get: () => noop}), VOICE: {play: noop}, AU: {tone: noop}, MUS: {},
  center: () => ({x: 0, y: 0}), sleep: async () => {}, fin: async () => {},
  extra: async () => {}, cutin: async () => {}, hitstop: async () => {},
  tweenNum: async () => {}, fillT: t => t, cardHTML: () => '',
  TUT_FORCE: false, tutActive: () => false, tutStart: noop, tutEnd: noop,
  seed: n => {rng = n >>> 0;},
};
for (const name of ['renderAll', 'renderSides', 'renderHand', 'renderHud', 'renderFunds',
  'comboShow', 'ticker', 'banner', 'show', 'floatAt', 'burst', 'shake', 'zoomPunch',
  'ring', 'fx', 'edgeFlash', 'buzzHaptic', 'flash', 'coinsTo']) ctx[name] = noop;
vm.createContext(ctx);
vm.runInContext(extracted, ctx, {filename: sourcePath});
const driver = `
LOCAL.tutDone=1;
const sampleN=200;
let playCounts=null, actions=0, checks=0;
const originalPlayCard=playCard;
function verify(){
  for(const s of [B.me,B.op]){
    for(const key of ['buzz','backlash','votes','shield','dodge','atkBuff','fundPenalty','funds','maxFunds']){
      assert(Number.isFinite(s[key]) && s[key]>=0, s.id+'.'+key+'='+s[key]); checks++;
    }
    assert(s.hand.length<=8 && s.units.length<=4);
    assert(s.units.every(u=>u.life>0 && u.life<=CARDS[u.id].unit.life));
  }
}
playCard=async function(s,o,i,el){
  const id=s.hand[i];
  assert(CARDS[id].c<=s.funds,'unaffordable card');
  playCounts[s.id][id]=(playCounts[s.id][id]||0)+1;
  await originalPlayCard(s,o,i,el); actions++; verify();
};
function greedyIndex(s,o){
  let best=-1,bs=.9;
  s.hand.forEach((id,i)=>{
    const c=CARDS[id]; if(c.c>s.funds)return;
    const score=c.ai(s,o)+Math.random()*1.2+c.c*.3;
    assert(Number.isFinite(score),'nonfinite AI score');
    if(score>bs){bs=score;best=i;}
  });return best;
}
async function battle(stageIndex,deck,battleSeed){
  seed(battleSeed); RUN.stage=stageIndex; RUN.deck=deck.slice();
  playCounts={me:{},op:{}};
  await startBattle();
  while(true){
    verify();
    // Same scoring policy as opPhase. Player has no six-card limit in the
    // game; every card costs >=1 and funds <=10, so 11 is only a safety guard.
    for(let guard=0;guard<11;guard++){
      const i=greedyIndex(B.me,B.op); if(i<0)break;
      assert(guard<10,'player exceeds legal budget');
      await playerPlay(i,document.querySelector('#hand'));
      assert(!B.busy,'playerPlay left busy');
    }
    B.busy=true;
    await opPhase();
    const st=STAGES[stageIndex];
    if(B.week%2===0||B.week===st.weeks)await settle();
    verify();
    if(B.week===st.weeks)break;
    B.week++; await myPhase(); assert(!B.busy,'myPhase left busy');
  }
  const meDisplay=dispVotes(B.me),opDisplay=dispVotes(B.op);
  return {win:meDisplay>=opDisplay,tie:meDisplay===opDisplay,
    me:B.me.votes,op:B.op.votes,meDisplay:meDisplay+(meDisplay===opDisplay?1:0),opDisplay,
    cards:JSON.parse(JSON.stringify(playCounts))};
}
function reward(){
  // Same weighted pool / unique first three as rewardScreen. The audit bot
  // chooses by the same ai()+cost bias policy on the final battle state.
  const choices=[...new Set(shuffle([...NEUTRAL_POOL,...RUN.cand.pool]))].slice(0,3);
  let best=choices[0],score=-Infinity;
  for(const id of choices){const c=CARDS[id],v=c.ai(B.me,B.op)+Math.random()*1.2+c.c*.3;
    if(v>score){score=v;best=id;}}
  return best;
}
function topCards(count){return Object.entries(count).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))
  .slice(0,5).map(([id,plays])=>({id,name:CARDS[id].n,plays}));}
async function run(){
  const rows=[]; const campaigns={};
  for(const camp of ['blue','green']){
    newRun(camp);
    const sums=PHASES.map((p,i)=>({camp,stage:i+1,office:p.office,matches:0,wins:0,ties:0,
      me:0,op:0,meDisplay:0,opDisplay:0,cards:{me:{},op:{}},naturalReached:0,naturalWins:0,rewards:{}}));
    let clears=0;
    for(let sample=0;sample<sampleN;sample++){
      let deck=[...NEUTRAL_STARTER,...CAMPS[camp].starter],alive=true;
      for(let i=0;i<PHASES.length;i++){
        const s=sums[i],battleSeed=20261016+(camp==='blue'?0:1000000)+sample*1009+i*7919;
        const r=await battle(i,deck,battleSeed);
        s.matches++; s.wins+=r.win; s.ties+=r.tie;
        for(const k of ['me','op','meDisplay','opDisplay'])s[k]+=r[k];
        for(const who of ['me','op'])for(const [id,n]of Object.entries(r.cards[who]))s.cards[who][id]=(s.cards[who][id]||0)+n;
        if(alive){s.naturalReached++;s.naturalWins+=r.win;alive=r.win;}
        if(i<PHASES.length-1){const id=reward();deck.push(id);s.rewards[id]=(s.rewards[id]||0)+1;}
      }
      if(alive)clears++;
    }
    campaigns[camp]={started:sampleN,clears,clearPct:clears/sampleN*100};
    for(const s of sums){
      rows.push({camp:s.camp,stage:s.stage,office:s.office,matches:s.matches,wins:s.wins,
        winPct:s.wins/s.matches*100,ties:s.ties,
        meanRawVotes:{me:s.me/s.matches,op:s.op/s.matches},
        meanDisplayedVotes:{me:s.meDisplay/s.matches,op:s.opDisplay/s.matches},
        mostPlayed:{me:topCards(s.cards.me),op:topCards(s.cards.op)},
        naturalCampaign:{reached:s.naturalReached,won:s.naturalWins},rewardPicks:s.rewards});
    }
  }
  return {seedBase:20261016,matches:sampleN*2*PHASES.length,cardActions:actions,
    finiteNonnegativeChecks:checks,violations:0,campaigns,rows};
}
globalThis.done=run();
`;
vm.runInContext(driver, ctx, {filename: 'qa/codex_sim.cjs:driver'});
ctx.done.then(result => {
  console.log(JSON.stringify({
    source: 'game/index.html', sha256: crypto.createHash('sha256').update(html).digest('hex'),
    method: 'Original numerical functions in Node VM; DOM/animation/audio/sleep stubbed. Both sides use shipped ai()+U[0,1.2)+0.3*cost. Player plays until no acceptable affordable card; opponent retains its shipped six-card cap. Starting buzz, asymmetrical budgets, decks, crit, combo, units, fire and polls unchanged. Seed is reset per battle; cosmetic RNG is omitted. Ties count as player wins, as electionNight specifies.',
    sampling: '200 trajectories per player camp; each trajectory tests all four stages, adds one greedy-picked reward from the actual random offer pool after each nonfinal stage, including after losses to retain n=200/stage. Stage percentages are controlled per-stage samples, NOT conditional survival win rates. NaturalCampaign and campaigns track only still-alive prefixes. Mean raw votes and displayed votes are both reported.',
    limitations: 'No human/lookahead/optimized exploit policy. No browser, network or real-time concurrency test. Finite samples do not prove absence of dominant strategies.',
    ...result,
  }, null, 2));
}).catch(error => { console.error(error.stack); process.exitCode=1; });

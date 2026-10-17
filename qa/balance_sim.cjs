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
const sourcePath = path.resolve(process.argv[2] || path.join(__dirname, '../game/index.html'));
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
  section('const FIRE=', 'async function electionNight()'),
  section('const ADV={', 'function adviceLines('),
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
  P: [], BGM: {play: noop, rate: noop}, preloadFx: noop, playSkillVideo: async () => false,
  updateAdvice: noop, newsEvent: async () => {}, $: () => element, NEWS: [],
  applyCounterTags: noop, intentCounter: () => '', counterFor: () => ({match: () => false}),
};
for (const name of ['renderAll', 'renderSides', 'renderHand', 'renderHud', 'renderFunds',
  'comboShow', 'ticker', 'banner', 'show', 'floatAt', 'burst', 'shake', 'zoomPunch',
  'ring', 'fx', 'edgeFlash', 'buzzHaptic', 'flash', 'coinsTo']) ctx[name] = noop;
vm.createContext(ctx);
vm.runInContext(extracted, ctx, {filename: sourcePath});
const SIMN = process.env.SIM_N||150; const SEEDB = +(process.env.SIM_SEED||20261100);
const driver = `
LOCAL.tutDone=1;
const sampleN=${+SIMN}; let checks=0;
function greedyIndex(s,o){ let best=-1,bs=.9; s.hand.forEach((id,i)=>{ const c=CARDS[id]; if(c.c>s.funds)return; const sc=c.ai(s,o)+Math.random()*1.2+c.c*.3; if(sc>bs){bs=sc;best=i;} }); return best; }
function advisorIndex(){ const {order}=planAdvice(); if(!order.length) return -1; return B.me.hand.indexOf(order[0]); }
async function battle(stageIndex,deck,battleSeed,policy){
  seed(battleSeed); RUN.stage=stageIndex; RUN.deck=deck.slice(); await startBattle();
  while(true){
    for(let g=0;g<11;g++){ const i=policy==='adv'?advisorIndex():greedyIndex(B.me,B.op); if(i<0)break; await playerPlay(i,document.querySelector('#hand')); }
    B.busy=true; await opPhase(); const st=STAGES[stageIndex];
    if(B.week%2===0||B.week===st.weeks) await settle();
    if(B.week===st.weeks) break; B.week++; await myPhase();
  }
  const m=dispVotes(B.me),o=dispVotes(B.op); return {win:m>=o, me:B.me.votes, op:B.op.votes};
}
function ownedSet(scn,camp){ SAVE.owned={}; ALL_CARDS.forEach(id=>{ if(scn==='starter'?(RARITY[id]==='N'||CAMP_STARTER[camp].includes(id)):true) SAVE.owned[id]=true; }); SAVE.decks={}; }
async function run(){
  const out=[];
  for(const scn of [['starter','greedy'],['full','greedy'],['full','adv']]){
    for(const camp of ['blue','green']){
      ownedSet(scn[0],camp); newRun(camp);
      const rows=PHASES.map((p,i)=>({stage:i+1,office:p.office,n:0,w:0,me:0,op:0})); let clears=0;
      for(let k=0;k<sampleN;k++){ let deck=defaultDeck(camp).slice(), alive=true;
        for(let i=0;i<PHASES.length;i++){ newRun(camp); RUN.deck=deck; const r=await battle(i,deck,${SEEDB}+k*1009+i*7919,scn[1]);
          const row=rows[i]; row.n++; row.w+=r.win; row.me+=r.me; row.op+=r.op; if(alive) alive=r.win; }
        if(alive) clears++; }
      out.push({scenario:scn.join('+'),camp,clearPct:+(clears/sampleN*100).toFixed(1),stages:rows.map(r=>({stage:r.stage,win:+(r.w/r.n*100).toFixed(1),votes:+(r.me/r.n).toFixed(1)+' : '+(r.op/r.n).toFixed(1)}))});
    }
  }
  return out;
}
globalThis.done=run();
`;
vm.runInContext(driver, ctx, {filename: 'qa/codex_sim.cjs:driver'});
ctx.done.then(result => {
  console.log(JSON.stringify({
    source: 'game/index.html', sha256: crypto.createHash('sha256').update(html).digest('hex'), results: result }, null, 1)); return; console.log(JSON.stringify({
    method: 'Original numerical functions in Node VM; DOM/animation/audio/sleep stubbed. Both sides use shipped ai()+U[0,1.2)+0.3*cost. Player plays until no acceptable affordable card; opponent retains its shipped six-card cap. Starting buzz, asymmetrical budgets, decks, crit, combo, units, fire and polls unchanged. Seed is reset per battle; cosmetic RNG is omitted. Ties count as player wins, as electionNight specifies.',
    sampling: '200 trajectories per player camp; each trajectory tests all four stages, adds one greedy-picked reward from the actual random offer pool after each nonfinal stage, including after losses to retain n=200/stage. Stage percentages are controlled per-stage samples, NOT conditional survival win rates. NaturalCampaign and campaigns track only still-alive prefixes. Mean raw votes and displayed votes are both reported.',
    limitations: 'No human/lookahead/optimized exploit policy. No browser, network or real-time concurrency test. Finite samples do not prove absence of dominant strategies.',
    ...result,
  }, null, 2));
}).catch(error => { console.error(error.stack); process.exitCode=1; });

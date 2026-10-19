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
  icon: () => '', fxHTML: () => '', imgTag: () => '', lbTicket: noop,
};
for (const name of ['renderAll', 'renderSides', 'renderHand', 'renderHud', 'renderFunds',
  'comboShow', 'ticker', 'banner', 'show', 'floatAt', 'burst', 'shake', 'zoomPunch',
  'ring', 'fx', 'edgeFlash', 'buzzHaptic', 'flash', 'coinsTo']) ctx[name] = noop;
vm.createContext(ctx);
vm.runInContext(extracted, ctx, {filename: sourcePath});
const SIMN = process.env.SIM_N||150; const SEEDB = +(process.env.SIM_SEED||20261100);
const driver = `
LOCAL.tutDone=1;
startTurnTimer=()=>{}; stopTurnTimer=()=>{};
function greedyIndex(s,o){ let best=-1,bs=.9; s.hand.forEach((id,i)=>{ const c=CARDS[id]; if(c.c>s.funds)return; const sc=c.ai(s,o)+Math.random()*1.2+c.c*.3; if(sc>bs){bs=sc;best=i;} }); return best; }
function advisorIndex(){ const {order}=planAdvice(); if(!order.length) return -1; return B.me.hand.indexOf(order[0]); }
async function quickBattle(camp,day,ace,policy,salt){
  seed(salt); const q=quickSetup(camp,day); const opp=CAMPS[camp==='blue'?'green':'blue'];
  RUN={mode:'quick',quick:{...q,ace},camp,cand:CAMPS[camp],stage:0,deck:[...q.deck,ace],score:0,name:'',won:[],history:[],mods:[q.mod]};
  STAGES=[Object.assign({},QUICK,{name:opp.cand,party:opp.party,img:opp.img,g:opp.g,deck:q.oppDeck})];
  await startBattle();
  while(true){
    for(let g=0;g<11;g++){ const i=policy==='adv'?advisorIndex():greedyIndex(B.me,B.op); if(i<0)break; await playerPlay(i,document.querySelector('#hand')); }
    B.busy=true; await opPhase(); const st=STAGES[0];
    if(B.week===st.weeks) B.stats.behind=B.me.votes<B.op.votes;
    if(B.week%2===0||B.week===st.weeks) await settle();
    if(B.week===st.weeks) break; B.week++; await myPhase();
  }
  const m=dispVotes(B.me),o=dispVotes(B.op); return {win:m>o, m, o, combo:B.stats.maxCombo, fires:B.stats.opFires};
}
async function run(){
  const DAYS=+(${+(process.env.QDAYS||30)}), out={}; const t0=Date.UTC(2026,9,19);
  for(const policy of ['greedy','adv']) for(const camp of ['blue','green']){
    let n=0,w=0,mm=0,oo=0; const byAce={};
    for(let d=0;d<DAYS;d++){ const day=new Date(t0+d*86400e3).toISOString().slice(0,10); const q=quickSetup(camp,day);
      for(const ace of q.aces){ for(let k=0;k<3;k++){ const r=await quickBattle(camp,day,ace,policy,${SEEDB}+d*131+k*7);
        n++; w+=r.win; mm+=r.m; oo+=r.o; const A=byAce[ace]=byAce[ace]||{n:0,w:0}; A.n++; A.w+=r.win; } } }
    out[policy+'_'+camp]={win:+(w/n*100).toFixed(1), n, votes:Math.round(mm/n)+' : '+Math.round(oo/n), ace:Object.fromEntries(Object.entries(byAce).map(([k,v])=>[k,+(v.w/v.n*100).toFixed(0)]))};
  }
  return out;
}
globalThis.done=run();
`;
vm.runInContext(driver, ctx, {filename: 'qa/codex_sim.cjs:driver'});
ctx.done.then(result => {
  console.log(JSON.stringify(result, null, 1)); return; console.log(JSON.stringify({
    method: 'Original numerical functions in Node VM; DOM/animation/audio/sleep stubbed. Both sides use shipped ai()+U[0,1.2)+0.3*cost. Player plays until no acceptable affordable card; opponent retains its shipped six-card cap. Starting buzz, asymmetrical budgets, decks, crit, combo, units, fire and polls unchanged. Seed is reset per battle; cosmetic RNG is omitted. Ties count as player wins, as electionNight specifies.',
    sampling: '200 trajectories per player camp; each trajectory tests all four stages, adds one greedy-picked reward from the actual random offer pool after each nonfinal stage, including after losses to retain n=200/stage. Stage percentages are controlled per-stage samples, NOT conditional survival win rates. NaturalCampaign and campaigns track only still-alive prefixes. Mean raw votes and displayed votes are both reported.',
    limitations: 'No human/lookahead/optimized exploit policy. No browser, network or real-time concurrency test. Finite samples do not prove absence of dominant strategies.',
    ...result,
  }, null, 2));
}).catch(error => { console.error(error.stack); process.exitCode=1; });

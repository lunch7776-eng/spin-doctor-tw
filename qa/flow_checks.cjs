#!/usr/bin/env node
'use strict';

// Reproduction harness, not a browser test. Original flow functions are evaluated
// unchanged; only DOM, sound, animation, and unrelated phases are substituted.
// Assertions deliberately describe the two currently reproducible defects.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const gamePath = path.resolve(__dirname, '../game/index.html');
const source = fs.readFileSync(gamePath, 'utf8');
const noop = () => {};

function install(context, begin, end) {
  const start = source.indexOf(begin);
  assert.notEqual(start, -1, `Missing source marker: ${begin}`);
  const finish = source.indexOf(end, start + begin.length);
  assert.notEqual(finish, -1, `Missing end marker: ${end}`);
  vm.runInContext(source.slice(start, finish), context, {
    filename: gamePath,
    lineOffset: source.slice(0, start).split('\n').length - 1,
  });
}

function makeContext() {
  const nodes = new Map();
  let timers = [];
  let rewardCards;
  let campCards;

  class Element {
    constructor() {
      this.hidden = false;
      this.disabled = false;
      this.value = '';
      this.innerHTML = '';
      this.dataset = {};
      this.style = { setProperty: noop };
      this.classList = { add: noop, remove: noop, toggle: noop };
      this.nodes = new Map();
    }
    querySelector(selector) {
      if (!this.nodes.has(selector)) this.nodes.set(selector, new Element());
      return this.nodes.get(selector);
    }
    querySelectorAll(selector) {
      if (selector === '.choices .card') return rewardCards;
      if (selector === '.camp') return campCards;
      return [];
    }
    animate() { return { finished: Promise.resolve() }; }
    addEventListener() {}
    getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 100 }; }
  }

  const $ = selector => {
    if (!nodes.has(selector)) nodes.set(selector, new Element());
    return nodes.get(selector);
  };
  rewardCards = [0, 1, 2].map(i => Object.assign(new Element(), {
    dataset: { id: `card${i}` },
  }));
  campCards = ['blue', 'green'].map(camp => Object.assign(new Element(), {
    dataset: { camp },
  }));
  const context = {
    console, Promise, Math, $,
    setTimeout(callback, ms) { timers.push({ callback, ms }); },
    SFX: new Proxy({}, { get: () => noop }),
    VOICE: { play: noop }, MUS: {},
    center: () => ({ x: 0, y: 0 }),
    burst: noop, flash: noop, shake: noop, confetti: noop,
    bindTilt: noop, imgTag: () => '', cardHTML: id => `<card>${id}</card>`,
    shuffle: array => array,
    NEUTRAL_POOL: ['card0', 'card1', 'card2'],
    CAMPS: {
      blue: { party: 'blue', cand: 'B', color: 'blue', pool: [] },
      green: { party: 'green', cand: 'G', color: 'green', pool: [] },
    },
    STAGES: [0, 1, 2, 3].map(i => ({
      office: `stage${i}`, weeks: 5, name: 'op', startBuzz: 0, deck: [],
    })),
    RUN: {
      stage: 2, deck: Array(12).fill('starter'),
      cand: { pool: [], party: 'blue', cand: 'B' },
      camp: 'blue', won: [], score: 123,
    },
    B: { week: 5, busy: false, turnOwner: 'me', me: { hand: [] } },
    LOCAL: { best: 0, name: '', tutDone: 1 },
    TUT_FORCE: false,
    saveLocal: noop, renderLB: noop, tweenNum: async () => {},
    newRun: noop, renderAll: noop, draw: noop, myPhase: async () => {},
    tutActive: () => false, tutEnd: noop,
    // endTurn itself runs unchanged. These substitutions represent completion
    // of the final opponent turn, tally, and election animation.
    opPhase: async () => { context.B.turnOwner = 'op'; },
    settle: async () => {}, electionNight: async () => {},
  };
  vm.createContext(context);
  install(context, 'function newSide(', '\nfunction draw(');
  install(context, 'async function startBattle(', '\nasync function myPhase(');
  install(context, 'async function playerPlay(', '\nasync function opPhase(');
  install(context, 'function rewardScreen(', '\n/* =========================================================\n   LEADERBOARD');
  install(context, 'function campScreen(', '\nfunction lbScreen(');
  install(context, 'function show(', '\nfunction toggleMute(');

  return {
    context, $, rewardCards,
    flush(ms) {
      const selected = timers.filter(timer => timer.ms === ms);
      timers = timers.filter(timer => timer.ms !== ms);
      const errors = [];
      for (const timer of selected) {
        try { timer.callback(); } catch (error) { errors.push(error); }
      }
      return errors;
    },
  };
}

function errorDetails(error) {
  if (!error) return null;
  const location = String(error.stack).split('\n')
    .find(line => line.includes('game/index.html:'));
  return { message: error.message, location: location?.trim() || 'unknown' };
}

function state(harness, errors = []) {
  const { context: c, $ } = harness;
  return {
    stage: c.RUN.stage, deck: c.RUN.deck.length,
    busy: c.B.busy, owner: c.B.turnOwner,
    gameVisible: !$('#screen-game').hidden,
    titleVisible: !$('#screen-title').hidden,
    overlayVisible: !$('#overlay').hidden,
    endDisabled: $('#btnEnd').disabled,
    errors: errors.map(errorDetails),
  };
}

async function terminalState(harness) {
  const { context: c, $ } = harness;
  c.show('game');
  await c.endTurn();
  assert.equal(c.B.busy, true);
  assert.equal(c.B.turnOwner, 'op');
  assert.equal($('#btnEnd').disabled, true);
}

async function main() {
  // Critical 1 control: one reward selection advances exactly one stage.
  {
    const h = makeContext();
    await terminalState(h);
    h.context.rewardScreen();
    h.rewardCards[0].onclick();
    const errors = h.flush(450);
    assert.equal(errors.length, 0);
    assert.equal(h.context.RUN.stage, 3);
    assert.equal(h.context.RUN.deck.length, 13);
    assert.match(h.$('#overlay').innerHTML, /第 4 關/);
    console.log('PASS control/reward-single', JSON.stringify(state(h, errors)));
  }

  // Critical 1 reproduction: two live card handlers before the 450 ms timer.
  {
    const h = makeContext();
    await terminalState(h);
    h.context.rewardScreen();
    h.rewardCards[0].onclick();
    h.rewardCards[1].onclick();
    const errors = h.flush(450);
    assert.equal(h.context.RUN.stage, 4);
    assert.equal(h.context.RUN.deck.length, 14);
    assert.equal(errors.length, 1);
    assert.match(errors[0].message, /office/);
    let startError;
    try { await h.context.startBattle(); } catch (error) { startError = error; }
    assert.ok(startError, 'Out-of-range startBattle must reject');
    assert.match(startError.message, /name/);
    assert.equal(h.context.B.busy, true);
    assert.equal(h.context.B.turnOwner, 'op');
    console.log('PASS reproduced/reward-double', JSON.stringify(state(h, [...errors, startError])));
  }

  // Critical 2 control: the explicit Home button exits a completed game.
  {
    const h = makeContext();
    await terminalState(h);
    await h.context.runEnd(false);
    h.$('#btnHome').onclick();
    assert.equal(h.$('#screen-title').hidden, false);
    assert.equal(h.$('#screen-game').hidden, true);
    assert.equal(h.$('#overlay').hidden, true);
    console.log('PASS control/end-home', JSON.stringify(state(h)));
  }

  // Critical 2 reproduction: Again -> Back exposes the terminal game state.
  {
    const h = makeContext();
    await terminalState(h);
    await h.context.runEnd(false);
    h.$('#btnAgain').onclick();
    assert.equal(h.$('#overlay').hidden, false);
    h.$('#btnBack').onclick();
    const before = JSON.stringify(state(h));
    await h.context.endTurn();
    await h.context.playerPlay(0, null);
    assert.equal(JSON.stringify(state(h)), before, 'Both actions must remain blocked');
    assert.equal(h.$('#screen-title').hidden, true);
    assert.equal(h.$('#screen-game').hidden, false);
    assert.equal(h.$('#overlay').hidden, true);
    assert.equal(h.$('#btnEnd').disabled, true);
    assert.equal(h.context.B.busy, true);
    assert.equal(h.context.B.turnOwner, 'op');
    console.log('PASS reproduced/end-again-back', JSON.stringify({
      ...state(h),
      errorLocation: 'game/index.html:1116 -> game/index.html:1172; guards 969,979',
    }));
  }
  console.log('4 checks passed: 2 normal controls and 2 confirmed defect reproductions.');
}

main().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
});

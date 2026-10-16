#!/usr/bin/env node
'use strict';

// Read-only audit of the local artifact. No browser, server, game mutations,
// external reports, network requests, or audio decoding are used here.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const gameDir = path.resolve(__dirname, '../game');
const source = fs.readFileSync(path.join(gameDir, 'index.html'), 'utf8');
const cardStart = source.indexOf('const CARDS=');
const cardEnd = source.indexOf('const CAMPS=', cardStart);
assert(cardStart >= 0 && cardEnd > cardStart, 'Cannot locate CARDS data');
// Evaluate data declarations only; no card effects or game bootstrap execute.
const cards = vm.runInNewContext(source.slice(cardStart, cardEnd) + '\nCARDS', {}, { timeout: 1000 });
const voiceDeclaration = source.match(/const VOICE_SYS=([^;]+);/);
assert(voiceDeclaration, 'Cannot locate VOICE_SYS data');
const voiceSys = vm.runInNewContext(voiceDeclaration[1], {}, { timeout: 1000 });

function assetCheck(directory, expected) {
  const files = fs.readdirSync(path.join(gameDir, directory))
    .filter(name => fs.statSync(path.join(gameDir, directory, name)).isFile())
    .sort();
  const missing = expected.filter(name => !files.includes(name));
  const empty = expected.filter(name => files.includes(name)
    && fs.statSync(path.join(gameDir, directory, name)).size === 0);
  return {
    required: expected.length,
    present: expected.length - missing.length,
    actualFiles: files.length,
    missing,
    empty,
    extra: files.filter(name => !expected.includes(name)),
  };
}

assert(source.includes('fetch(`audio/v_${k}.mp3`)'), 'VOICE filename rule changed');
assert(source.includes("VOICE_SYS.map(k=>'sys_'+k)"), 'VOICE system prefix changed');
assert(source.includes('img/${name}.jpg?v=${IMGV}'), 'Image filename rule changed');
const imageNames = Object.values(cards).map(card => `${card.img}.jpg`);
const audioNames = [...Object.keys(cards), ...voiceSys.map(key => `sys_${key}`)]
  .map(key => `v_${key}.mp3`);
const images = assetCheck('img', imageNames);
const audio = assetCheck('audio', audioNames);
console.log(`CARDS.img: ${images.present}/${images.required}`);
console.log(`VOICE: ${audio.present}/${audio.required} (${Object.keys(cards).length} cards + ${voiceSys.length} system)`);
console.log(JSON.stringify({ images, audio }, null, 2));

// Fail explicitly if the source no longer matches the static geometry below.
// These checks are assumptions guards, not browser layout tests.
const assumptions = [
  ['screen horizontal padding', '.screen{position:absolute;inset:0;padding-inline:16px}'],
  ['mobile dimensions', ':root{--cw:86px;--ch:124px}'],
  ['short viewport dimensions', '@media (max-height:700px){ :root{--cw:96px;--ch:136px}'],
  ['card padding', 'border-radius:14px;padding:5px;'],
  ['hand reserve', 'avail=h.clientWidth-28'],
  ['overlap lower bound', 'Math.max(-cw*.62,Math.min(-6,(avail-n*cw)/(n-1)))'],
  ['fan angle', "el.style.setProperty('--fan',(off*3.5)+'deg')"],
  ['hand limit', 'if(side.hand.length>=8)'],
  ['cost badge position', '.card .cost{position:absolute;left:-6px;top:-6px;'],
  ['mobile cost badge diameter', '.card .cost{width:26px;height:26px;font-size:15px}'],
  ['inner crop and art fraction', 'overflow:hidden;background:#0d1124;display:grid;grid-template-rows:56% auto auto 1fr'],
  ['description size and padding', '.card .ds{font-size:8.5px;padding:1px 3px}'],
  ['description line height', 'font-size:10.5px;line-height:1.3;text-align:center'],
  ['title size', '.card .nm{font-size:11px}'],
  ['title line height', 'padding:3px 2px 0;line-height:1.15;'],
];
for (const [label, fragment] of assumptions) {
  assert(source.includes(fragment), `Static geometry assumption changed: ${label}`);
}

const round = number => Number(number.toFixed(4));
const viewport = { width: 375, height: 667 };
function handGeometry(model, width, height) {
  const count = 8;
  const handWidth = viewport.width - 32;
  const available = handWidth - 28;
  const gap = Math.max(-width * 0.62, Math.min(-6, (available - count * width) / (count - 1)));
  const lineWidth = count * width + (count - 1) * gap;
  const start = (viewport.width - lineWidth) / 2;
  const records = Array.from({ length: count }, (_, index) => {
    const angle = (index - (count - 1) / 2) * 3.5 * Math.PI / 180;
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    const center = start + index * (width + gap) + width / 2;
    const halfExtent = (width * Math.abs(cosine) + height * Math.abs(sine)) / 2;
    // Background is rounded: its painted extent is smaller than its rectangle.
    const radius = 14;
    const roundedHalf = (width / 2 - radius) * Math.abs(cosine)
      + (height / 2 - radius) * Math.abs(sine) + radius;
    // .cost has left/top=-6 and diameter=26, so its center is (7,7).
    const badgeCenter = center + (7 - width / 2) * cosine - (7 - height / 2) * sine;
    return {
      rectangularLeft: center - halfExtent,
      rectangularRight: center + halfExtent,
      roundedLeft: center - roundedHalf,
      roundedRight: center + roundedHalf,
      badgeLeft: badgeCenter - 13,
      badgeRight: badgeCenter + 13,
    };
  });
  const bounds = (left, right) => {
    const min = Math.min(...records.map(record => record[left]));
    const max = Math.max(...records.map(record => record[right]));
    return { left: round(min), right: round(max), span: round(max - min) };
  };
  const rectangle = bounds('rectangularLeft', 'rectangularRight');
  const roundedBackground = bounds('roundedLeft', 'roundedRight');
  const costBadges = bounds('badgeLeft', 'badgeRight');
  const paintedLeft = Math.min(roundedBackground.left, costBadges.left);
  const paintedRight = Math.max(roundedBackground.right, costBadges.right);
  return {
    model,
    cardOuterSize: { width, height },
    assumedHandWidth: handWidth,
    available,
    gap: round(gap),
    unrotatedLineWidth: round(lineWidth),
    outerCardAngleDegrees: 12.25,
    rectangle,
    roundedBackground,
    costBadges,
    backgroundAndBadgeSpan: round(paintedRight - paintedLeft),
    note: 'Static geometry only. Rounded corners mean rectangle overflow alone does not prove visible card-body clipping. Badge calculation excludes shadows. Intrinsic grid sizing and browser box-model behavior are not measured.',
  };
}

console.log('\nCSS STATIC / CSS 靜態：未瀏覽器實測');
console.log(JSON.stringify({
  viewport,
  handCount: 8,
  hasDoctype: /<!doctype\b/i.test(source),
  assumptions: [
    '375×667 activates the later max-height:700px rule: --cw:96px; --ch:136px.',
    'Cards are settled, not hovered, and rotateX/rotateY are zero.',
    'Hand client width is assumed 375 - 2×16 = 343. Intrinsic grid expansion is not simulated.',
    'Both box models are hypotheses. No DOCTYPE is present; do not mistake content-box values for measured browser dimensions.',
    'Reproduction: skip tutorial; play no cards; end two turns; third week reaches the eight-card limit.',
  ],
  models: [
    handGeometry('padding included: 96×136; conservative box hypothesis', 96, 136),
    handGeometry('content-box: 96×136 plus 5px padding on each side', 106, 146),
  ],
}, null, 2));

// Description truncation is deliberately NOT promoted to a confirmed failure.
// Character counts cannot determine browser line breaks or fallback font widths.
const longest = Object.entries(cards).map(([id, card]) => ({
  id,
  description: card.d,
  codePoints: [...card.d].length,
  hanCharacters: [...card.d].filter(character => /\p{Script=Han}/u.test(character)).length,
})).sort((a, b) => b.codePoints - a.codePoints).slice(0, 6);

function descriptionBudget(model, outerWidth, outerHeight) {
  const innerWidth = outerWidth - 10; // .in inset:5px
  const innerHeight = outerHeight - 10;
  const artHeight = innerHeight * 0.56;
  const titleHeight = 11 * 1.15 + 3;
  const descriptionPadding = 2;
  const lineHeight = 8.5 * 1.3;
  return {
    model,
    assumedOuterSize: { width: outerWidth, height: outerHeight },
    innerHeight,
    descriptionTextWidth: innerWidth - 6,
    artHeight: round(artHeight),
    titleHeight: round(titleHeight),
    descriptionLineHeight: round(lineHeight),
    maxTextHeightIfTypeRowWereZero: round(innerHeight - artHeight - titleHeight - descriptionPadding),
    threeDescriptionLinesHeight: round(3 * lineHeight),
    typeRowHeight: 'Unknown: font-size:8px with line-height:normal; actual loaded/fallback font unmeasured.',
  };
}
console.log('\nDESCRIPTION TRUNCATION / 描述截尾：未驗證（不是已確認缺陷）');
console.log(JSON.stringify({
  breakpoint: '375px width with height >700px is needed for --cw:86px; --ch:124px. 375×667 instead uses 96×136.',
  guards: '56% art row and overflow:hidden are present; description line-height is 11.05px.',
  models: [
    descriptionBudget('padding included: 86×124', 86, 124),
    descriptionBudget('content-box: 86×124 plus padding', 96, 134),
  ],
  longest,
  conclusion: '字數／行高不足以單獨證明截尾。缺實際字寬、換行數、normal行高、盒模型和CSS Grid佈局結果。只有在另證描述需三行後，才可把數值比較當作條件式證據；目前僅列未驗證。',
}, null, 2));

if (images.missing.length || images.empty.length || audio.missing.length || audio.empty.length) {
  process.exitCode = 1;
}

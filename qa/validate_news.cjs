// 驗證 game/news.json：格式、長度、數值範圍。失敗時 exit 1。
const fs = require('fs'); const path = require('path');
const j = JSON.parse(fs.readFileSync(path.join(__dirname, '../game/news.json'), 'utf8'));
const types = ['buzz', 'backlash', 'votes', 'shield'], targets = ['blue', 'green', 'both', 'leader', 'trailer'];
const errs = [];
if (!Array.isArray(j.events)) errs.push('events 必須是陣列');
(j.events || []).forEach((e, i) => {
  const p = `events[${i}]`;
  if (typeof e.headline !== 'string' || !e.headline.trim() || [...e.headline].length > 28) errs.push(`${p}.headline 必須是 1–28 字`);
  if (e.sub != null && (typeof e.sub !== 'string' || [...e.sub].length > 36)) errs.push(`${p}.sub 最多 36 字`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date || '')) errs.push(`${p}.date 格式要 YYYY-MM-DD`);
  if (!e.effect || !types.includes(e.effect.type)) errs.push(`${p}.effect.type 必須是 ${types.join('/')}`);
  if (!e.effect || !targets.includes(e.effect.target)) errs.push(`${p}.effect.target 必須是 ${targets.join('/')}`);
  if (!e.effect || !Number.isInteger(e.effect.value) || e.effect.value === 0 || Math.abs(e.effect.value) > 5) errs.push(`${p}.effect.value 必須是 ±1–±5 的整數`);
  if (/[<>]/.test((e.headline || '') + (e.sub || ''))) errs.push(`${p} 不可含 < >`);
  if (/蔣萬安|沈伯洋|國民黨|民進黨/.test((e.headline || '') + (e.sub || ''))) errs.push(`${p} 出現真名或真黨名，請改用諧音（講卍安/審伯羊/藍藍路黨/綠嘻嘻黨）`);
});
if ((j.events || []).length > 30) errs.push('最多保留 30 則');
if (errs.length) { console.error('news.json 驗證失敗：\n- ' + errs.join('\n- ')); process.exit(1); }
console.log(`news.json OK（${j.events.length} 則，更新 ${j.updated}）`);

// 幕後操盤手排行榜 API（Cloudflare Worker + D1）
// POST /start   領開局號碼牌
// POST /submit  交成績（號碼牌一次性＋合理性檢查＋限流）
// GET  /top?scope=all|week&dev=…  排行榜（每台裝置只留最佳）＋陣營大戰
// POST /feedback  玩家回報 bug／建議（限流）
// GET  /feedback?key=…  管理者讀取回報（ADMIN_KEY）
const SCALE = [1873, 3911, 6427, 11213];          // 各關「內部票數 → 顯示票數」倍率（同 game/index.html PHASES）
const MAX_INNER = 260;                             // 每關內部票數上限（模擬平均 25～55，留很大餘裕）
const MIN_SEC_PER_STAGE = 20;                      // 一關至少要打 20 秒
const TICKET_TTL = 6 * 3600 * 1000;
const QUICK_SCALE = 4200, QUICK_MAX_BONUS = 150000, QUICK_MIN_SEC = 40;   // 三分鐘快打（同 game/index.html QUICK）
const taipeiDay = t => new Date(t + 8 * 3600e3).toISOString().slice(0, 10);
const BANNED = ['蔣萬安', '沈伯洋', '賴清德', '柯文哲', '韓國瑜', '侯友宜', '黃國昌', '鄭麗文', '朱立倫', '蕭美琴', '習近平',
  '幹', '靠北', '雞掰', '機掰', '屌', '操你', '肏', '婊', '智障', 'fuck', 'shit'];

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS } });
const bad = (msg, s = 400) => json({ ok: false, error: msg }, s);

async function sha(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].slice(0, 12).map(x => x.toString(16).padStart(2, '0')).join('');
}
function weekStart(now) {              // 台北時間週一 00:00
  const tz = 8 * 3600 * 1000, d = new Date(now + tz);
  const day = (d.getUTCDay() + 6) % 7;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day) - tz;
}
function cleanName(raw) {
  let n = String(raw || '').replace(/[\u0000-\u001f\u007f<>&"'`\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 12);
  const low = n.toLowerCase().replace(/\s/g, '');
  if (!n || BANNED.some(w => low.includes(w.toLowerCase()))) n = '無名操盤手';
  return n;
}

async function start(req, env, ip) {
  const now = Date.now();
  const c = await env.DB.prepare('SELECT COUNT(*) n FROM tickets WHERE ip=? AND ts>?').bind(ip, now - 3600e3).first();
  if (c.n > 60) return bad('太頻繁了，稍後再試', 429);
  const run = crypto.randomUUID();
  let b = {}; try { b = await req.json(); } catch {}
  const dev = /^[a-z0-9-]{8,40}$/i.test(String(b.dev || '')) ? String(b.dev) : '';
  const day = b.mode === 'quick' ? taipeiDay(now) : '';
  let first = 0;
  if (dev && day) { const had = await env.DB.prepare('SELECT COUNT(*) n FROM tickets WHERE dev=? AND day=?').bind(dev, day).first(); first = had.n ? 0 : 1; }
  await env.DB.prepare('INSERT INTO tickets(run,ts,used,ip,dev,day,first) VALUES(?,?,0,?,?,?,?)').bind(run, now, ip, dev, day, first).run();
  // 順手清掉過期號碼牌
  await env.DB.prepare('DELETE FROM tickets WHERE ts<?').bind(now - 3 * 86400e3).run();
  return json({ ok: true, run, first: !!first });
}

async function submit(req, env, ip) {
  let b; try { b = await req.json(); } catch { return bad('格式錯誤'); }
  const now = Date.now();
  const lim = await env.DB.prepare('SELECT COUNT(*) n FROM runs WHERE ip=? AND ts>?').bind(ip, now - 3600e3).first();
  if (lim.n >= 20) return bad('太頻繁了，稍後再試', 429);

  const dev = String(b.dev || '').slice(0, 40);
  if (!/^[a-z0-9-]{8,40}$/i.test(dev)) return bad('裝置編號錯誤');
  if (!['blue', 'green'].includes(b.camp)) return bad('陣營錯誤');
  const h = Array.isArray(b.history) ? b.history : [];
  const quick = b.mode === 'quick';
  if (quick) return submitQuick(b, env, ip, now, dev, h);
  if (h.length < 1 || h.length > 4) return bad('關卡紀錄錯誤');
  let sum = 0;
  for (let i = 0; i < h.length; i++) {
    const me = Number(h[i] && h[i].me), op = Number(h[i] && h[i].op), win = !!(h[i] && h[i].win);
    if (!Number.isInteger(me) || !Number.isInteger(op) || me < 0 || op < 0) return bad('票數錯誤');
    if (me > MAX_INNER * SCALE[i] + SCALE[i] || op > MAX_INNER * SCALE[i] + SCALE[i]) return bad('票數不合理');
    if (win !== (me > op)) return bad('勝負不一致');
    if (i < h.length - 1 && !win) return bad('落敗後不會有下一關');
    sum += me;
  }
  const score = Number(b.score);
  if (!Number.isInteger(score) || score !== sum) return bad('總分不一致');
  const champion = h.length === 4 && h[3].me > h[3].op;
  if (!champion && h[h.length - 1].me > h[h.length - 1].op) return bad('這輪還沒結束');

  // 號碼牌：存在、未使用、沒過期、經過的時間合理
  const t = await env.DB.prepare('SELECT ts,used FROM tickets WHERE run=?').bind(String(b.run || '')).first();
  if (!t) return bad('沒有開局號碼牌');
  if (t.used) return bad('這一輪已經交過成績');
  const dur = Math.round((now - t.ts) / 1000);
  if (now - t.ts > TICKET_TTL) return bad('號碼牌過期');
  if (dur < MIN_SEC_PER_STAGE * h.length) return bad('打得太快，不像真人');
  const u = await env.DB.prepare('UPDATE tickets SET used=1 WHERE run=? AND used=0').bind(b.run).run();
  if (!u.meta.changes) return bad('這一輪已經交過成績');

  const name = cleanName(b.name);
  const office = String(b.office || '').slice(0, 12);
  const prev = await env.DB.prepare("SELECT MAX(score) s FROM runs WHERE dev=? AND mode='campaign'").bind(dev).first();
  await env.DB.prepare('INSERT INTO runs(dev,name,camp,score,stages,champion,office,dur,ip,ts) VALUES(?,?,?,?,?,?,?,?,?,?)')
    .bind(dev, name, b.camp, score, h.length, champion ? 1 : 0, office, dur, ip, now).run();
  // 這台裝置之前的成績也改用新代號
  await env.DB.prepare('UPDATE runs SET name=? WHERE dev=?').bind(name, dev).run();

  const best = Math.max(score, (prev && prev.s) || 0);
  const ranks = {};
  for (const scope of ['all', 'week']) {
    const since = scope === 'week' ? weekStart(now) : 0;
    const myBest = (await env.DB.prepare("SELECT MAX(score) s FROM runs WHERE dev=? AND ts>=? AND mode='campaign'").bind(dev, since).first()).s || 0;
    const r = await env.DB.prepare("SELECT COUNT(*) n FROM (SELECT dev, MAX(score) s FROM runs WHERE ts>=? AND mode='campaign' GROUP BY dev) WHERE s>?").bind(since, myBest).first();
    const tot = await env.DB.prepare("SELECT COUNT(DISTINCT dev) n FROM runs WHERE ts>=? AND mode='campaign'").bind(since).first();
    ranks[scope] = { rank: r.n + 1, total: tot.n, pct: tot.n > 1 ? Math.round((tot.n - r.n - 1) / (tot.n - 1) * 100) : 100 };
  }
  return json({ ok: true, best, newBest: score >= best, ranks, name });
}

async function useTicket(env, run, now, minSec) {
  const t = await env.DB.prepare('SELECT ts,used,first,dev,day FROM tickets WHERE run=?').bind(String(run || '')).first();
  if (!t) return { err: '沒有開局號碼牌' };
  if (t.used) return { err: '這一輪已經交過成績' };
  if (now - t.ts > TICKET_TTL) return { err: '號碼牌過期' };
  const dur = Math.round((now - t.ts) / 1000);
  if (dur < minSec) return { err: '打得太快，不像真人' };
  const u = await env.DB.prepare('UPDATE tickets SET used=1 WHERE run=? AND used=0').bind(run).run();
  if (!u.meta.changes) return { err: '這一輪已經交過成績' };
  return { dur, first: !!t.first, tdev: t.dev, tday: t.day };
}
async function submitQuick(b, env, ip, now, dev, h) {
  const today = taipeiDay(now), yday = taipeiDay(now - 86400e3), day = String(b.day || '');
  if (day !== today && day !== yday) return bad('題目日期不對');
  if (h.length !== 1) return bad('關卡紀錄錯誤');
  const me = Number(h[0].me), op = Number(h[0].op), win = !!h[0].win, bonus = Number(b.bonus);
  if (![me, op, bonus].every(Number.isInteger) || me < 0 || op < 0 || bonus < 0) return bad('票數錯誤');
  if (me > MAX_INNER * QUICK_SCALE || op > MAX_INNER * QUICK_SCALE || bonus > QUICK_MAX_BONUS) return bad('票數不合理');
  if (win !== (me > op)) return bad('勝負不一致');
  if (Number(b.score) !== me + bonus) return bad('總分不一致');
  const tk = await useTicket(env, b.run, now, QUICK_MIN_SEC); if (tk.err) return bad(tk.err);
  const name = cleanName(b.name), office = String(b.office || '').slice(0, 12);
  const had = await env.DB.prepare("SELECT COUNT(*) n FROM runs WHERE dev=? AND mode='quick' AND day=? AND ranked=1").bind(dev, day).first();
  // 只有「這台裝置今天第一張快打號碼牌」打出來的成績才列入排名（中途重打、離開再開都算用掉）
  const legacy = !tk.tdev;   // 舊版用戶端沒送裝置編號：沿用「當天第一筆」規則
  const ranked = (!had.n && (legacy || (tk.first && tk.tdev === dev && tk.tday === day))) ? 1 : 0;
  await env.DB.prepare('INSERT INTO runs(dev,name,camp,score,stages,champion,office,dur,ip,ts,mode,day,ranked,bonus) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .bind(dev, name, b.camp, me + bonus, 1, win ? 1 : 0, office, tk.dur, ip, now, 'quick', day, ranked, bonus).run();
  await env.DB.prepare('UPDATE runs SET name=? WHERE dev=?').bind(name, dev).run();
  const score = me + bonus;
  const r = await env.DB.prepare("SELECT COUNT(*) n FROM runs WHERE mode='quick' AND day=? AND ranked=1 AND score>?").bind(day, score).first();
  const tot = (await env.DB.prepare("SELECT COUNT(*) n FROM runs WHERE mode='quick' AND day=? AND ranked=1").bind(day).first()).n;
  const t = { rank: r.n + 1, total: tot, ranked: !!ranked, pct: tot > 1 ? Math.round((tot - r.n - 1) / (tot - 1) * 100) : 100 };
  return json({ ok: true, best: score, newBest: true, ranks: { today: t }, name });
}
/* 陣營大戰：今日（每台裝置當天第一場才算，拉人比刷分有用）＋近 7 天勝負 */
async function war(env) {
  const now = Date.now(), today = taipeiDay(now), from = taipeiDay(now - 6 * 86400e3);
  const rows = await env.DB.prepare("SELECT day, camp, SUM(score) s, COUNT(*) n FROM runs WHERE mode='quick' AND ranked=1 AND day>=? GROUP BY day, camp").bind(from).all();
  const days = {};
  for (const r of rows.results) { const d = days[r.day] = days[r.day] || { day: r.day, blue: 0, green: 0, blueN: 0, greenN: 0 }; d[r.camp] = r.s; d[r.camp + 'N'] = r.n; }
  const t = days[today] || { day: today, blue: 0, green: 0, blueN: 0, greenN: 0 };
  const past = Object.values(days).filter(d => d.day < today).sort((a, b) => a.day < b.day ? -1 : 1);
  const record = { blue: past.filter(d => d.blue > d.green).length, green: past.filter(d => d.green > d.blue).length };
  return json({ ok: true, today: t, record, past: past.map(d => ({ day: d.day, winner: d.blue === d.green ? 'tie' : d.blue > d.green ? 'blue' : 'green' })) });
}
async function top(url, env) {
  const sp = url.searchParams.get('scope'), dev = String(url.searchParams.get('dev') || '');
  if (sp === 'today') {
    const now = Date.now(), qd = url.searchParams.get('day'), day = (qd === taipeiDay(now) || qd === taipeiDay(now - 86400e3)) ? qd : taipeiDay(now);
    const rows = await env.DB.prepare("SELECT name,camp,score,office,champion,ts,(dev=?) mine FROM runs WHERE mode='quick' AND day=? AND ranked=1 ORDER BY score DESC, ts ASC LIMIT 50").bind(dev, day).all();
    const war = await env.DB.prepare("SELECT camp, SUM(score) s, COUNT(*) n FROM runs WHERE mode='quick' AND day=? AND ranked=1 GROUP BY camp").bind(day).all();
    const players = (await env.DB.prepare("SELECT COUNT(*) n FROM runs WHERE mode='quick' AND day=? AND ranked=1").bind(day).first()).n;
    const w = { blue: 0, green: 0, blueRuns: 0, greenRuns: 0 }; for (const x of war.results) { w[x.camp] = x.s; w[x.camp + 'Runs'] = x.n; }
    return json({ ok: true, scope: 'today', day, players, war: w, rows: rows.results.map(r => ({ ...r, mine: !!r.mine })) });
  }
  const scope = sp === 'week' ? 'week' : 'all';
  const since = scope === 'week' ? weekStart(Date.now()) : 0;
  const rows = await env.DB.prepare(
    `SELECT r.name, r.camp, r.score, r.office, r.champion, r.ts, (r.dev=?) mine
       FROM runs r JOIN (SELECT dev, MAX(score) s FROM runs WHERE ts>=? AND mode='campaign' GROUP BY dev) b ON r.dev=b.dev AND r.score=b.s
      WHERE r.ts>=? AND r.mode='campaign' GROUP BY r.dev ORDER BY r.score DESC LIMIT 50`).bind(dev, since, since).all();
  const war = await env.DB.prepare("SELECT camp, SUM(score) s, COUNT(*) n FROM runs WHERE ts>=? AND mode='campaign' GROUP BY camp").bind(since).all();
  const players = (await env.DB.prepare("SELECT COUNT(DISTINCT dev) n FROM runs WHERE ts>=? AND mode='campaign'").bind(since).first()).n;
  const w = { blue: 0, green: 0, blueRuns: 0, greenRuns: 0 };
  for (const x of war.results) { w[x.camp] = x.s; w[x.camp + 'Runs'] = x.n; }
  return json({ ok: true, scope, since, players, war: w, rows: rows.results.map(r => ({ ...r, mine: !!r.mine })) },
    200);
}

async function feedback(req, env, ip) {
  let b; try { b = await req.json(); } catch { return bad('格式錯誤'); }
  const now = Date.now();
  const lim = await env.DB.prepare('SELECT COUNT(*) n FROM feedback WHERE ip=? AND ts>?').bind(ip, now - 3600e3).first();
  if (lim.n >= 5) return bad('一小時最多回報 5 次，謝謝你的熱心！', 429);
  const kind = ['bug', 'idea', 'other'].includes(b.kind) ? b.kind : 'other';
  const strip = (v, n) => String(v || '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, n);
  const msg = strip(b.msg, 500), contact = strip(b.contact, 60), ctx = strip(typeof b.ctx === 'string' ? b.ctx : JSON.stringify(b.ctx || {}), 600);
  if (msg.length < 2) return bad('內容太短了');
  await env.DB.prepare('INSERT INTO feedback(kind,msg,contact,ctx,ip,ts) VALUES(?,?,?,?,?,?)').bind(kind, msg, contact, ctx, ip, now).run();
  return json({ ok: true });
}
async function listFeedback(url, env) {
  if (!env.ADMIN_KEY || url.searchParams.get('key') !== env.ADMIN_KEY) return bad('沒有權限', 403);
  const rows = await env.DB.prepare('SELECT id,kind,msg,contact,ctx,ts,done FROM feedback ORDER BY id DESC LIMIT 200').all();
  return json({ ok: true, rows: rows.results });
}

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const url = new URL(req.url);
    const ip = await sha((req.headers.get('CF-Connecting-IP') || '0') + (env.SALT || ''));
    try {
      if (req.method === 'POST' && url.pathname === '/start') return await start(req, env, ip);
      if (req.method === 'POST' && url.pathname === '/submit') return await submit(req, env, ip);
      if (req.method === 'GET' && url.pathname === '/top') return await top(url, env);
      if (req.method === 'GET' && url.pathname === '/war') return await war(env);
      if (req.method === 'POST' && url.pathname === '/feedback') return await feedback(req, env, ip);
      if (req.method === 'GET' && url.pathname === '/feedback') return await listFeedback(url, env);
      return json({ ok: true, service: '幕後操盤手排行榜' });
    } catch (e) {
      return bad('伺服器錯誤', 500);
    }
  }
};

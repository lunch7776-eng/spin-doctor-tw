// 幕後操盤手排行榜 API（Cloudflare Worker + D1）
// POST /start   領開局號碼牌
// POST /submit  交成績（號碼牌一次性＋合理性檢查＋限流）
// GET  /top?scope=all|week&dev=…  排行榜（每台裝置只留最佳）＋陣營大戰
const SCALE = [1873, 3911, 6427, 11213];          // 各關「內部票數 → 顯示票數」倍率（同 game/index.html PHASES）
const MAX_INNER = 260;                             // 每關內部票數上限（模擬平均 25～55，留很大餘裕）
const MIN_SEC_PER_STAGE = 20;                      // 一關至少要打 20 秒
const TICKET_TTL = 6 * 3600 * 1000;
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
  await env.DB.prepare('INSERT INTO tickets(run,ts,used,ip) VALUES(?,?,0,?)').bind(run, now, ip).run();
  // 順手清掉過期號碼牌
  await env.DB.prepare('DELETE FROM tickets WHERE ts<?').bind(now - 2 * TICKET_TTL).run();
  return json({ ok: true, run });
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
  const prev = await env.DB.prepare('SELECT MAX(score) s FROM runs WHERE dev=?').bind(dev).first();
  await env.DB.prepare('INSERT INTO runs(dev,name,camp,score,stages,champion,office,dur,ip,ts) VALUES(?,?,?,?,?,?,?,?,?,?)')
    .bind(dev, name, b.camp, score, h.length, champion ? 1 : 0, office, dur, ip, now).run();
  // 這台裝置之前的成績也改用新代號
  await env.DB.prepare('UPDATE runs SET name=? WHERE dev=?').bind(name, dev).run();

  const best = Math.max(score, (prev && prev.s) || 0);
  const ranks = {};
  for (const scope of ['all', 'week']) {
    const since = scope === 'week' ? weekStart(now) : 0;
    const myBest = (await env.DB.prepare('SELECT MAX(score) s FROM runs WHERE dev=? AND ts>=?').bind(dev, since).first()).s || 0;
    const r = await env.DB.prepare('SELECT COUNT(*) n FROM (SELECT dev, MAX(score) s FROM runs WHERE ts>=? GROUP BY dev) WHERE s>?').bind(since, myBest).first();
    const tot = await env.DB.prepare('SELECT COUNT(DISTINCT dev) n FROM runs WHERE ts>=?').bind(since).first();
    ranks[scope] = { rank: r.n + 1, total: tot.n, pct: tot.n > 1 ? Math.round((tot.n - r.n - 1) / (tot.n - 1) * 100) : 100 };
  }
  return json({ ok: true, best, newBest: score >= best, ranks, name });
}

async function top(url, env) {
  const scope = url.searchParams.get('scope') === 'week' ? 'week' : 'all';
  const dev = String(url.searchParams.get('dev') || '');
  const since = scope === 'week' ? weekStart(Date.now()) : 0;
  const rows = await env.DB.prepare(
    `SELECT r.name, r.camp, r.score, r.office, r.champion, r.ts, (r.dev=?) mine
       FROM runs r JOIN (SELECT dev, MAX(score) s FROM runs WHERE ts>=? GROUP BY dev) b ON r.dev=b.dev AND r.score=b.s
      WHERE r.ts>=? GROUP BY r.dev ORDER BY r.score DESC LIMIT 50`).bind(dev, since, since).all();
  const war = await env.DB.prepare('SELECT camp, SUM(score) s, COUNT(*) n FROM runs WHERE ts>=? GROUP BY camp').bind(since).all();
  const players = (await env.DB.prepare('SELECT COUNT(DISTINCT dev) n FROM runs WHERE ts>=?').bind(since).first()).n;
  const w = { blue: 0, green: 0, blueRuns: 0, greenRuns: 0 };
  for (const x of war.results) { w[x.camp] = x.s; w[x.camp + 'Runs'] = x.n; }
  return json({ ok: true, scope, since, players, war: w, rows: rows.results.map(r => ({ ...r, mine: !!r.mine })) },
    200);
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
      return json({ ok: true, service: '幕後操盤手排行榜' });
    } catch (e) {
      return bad('伺服器錯誤', 500);
    }
  }
};

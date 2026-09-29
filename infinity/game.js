'use strict';

// =====================================================
//  無限の次へ — モノクロ合成インクリメンタル
// =====================================================

const SAVE_KEY = 'infinity-merge-v2';
const OLD_SAVE_KEY = 'infinity-merge-v1';
const MAX_TIER = 20;             // 2^20 が「∞」
const OFFLINE_CAP_SEC = 8 * 3600;
const SPACE_CAPS = [16, 20, 24, 30, 36];   // 画面に置ける上限（ごちゃつかせない）
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';

// ---------- ステータス強化 ----------
const UPGRADES = [
  {
    id: 'autoGen', jp: '自動生成', en: 'AUTO SPAWN', max: 25,
    cost: lv => 15 * Math.pow(1.55, lv),
    desc: lv => lv === 0 ? 'OFF → 3.00s' : `${genInterval(lv).toFixed(2)}s → ${genInterval(lv + 1).toFixed(2)}s`,
  },
  {
    id: 'autoMerge', jp: '自動合成', en: 'AUTO MERGE', max: 25,
    cost: lv => 40 * Math.pow(1.6, lv),
    desc: lv => lv === 0 ? 'OFF → 2.50s' : `${mergeInterval(lv).toFixed(2)}s → ${mergeInterval(lv + 1).toFixed(2)}s`,
  },
  {
    id: 'spawnCoin', jp: '生成ボーナス', en: 'SPAWN BONUS', max: 50,
    cost: lv => 10 * Math.pow(1.45, lv),
    desc: lv => `+${fmt(0.1 * lv)} → +${fmt(0.1 * (lv + 1))}`,
  },
  {
    id: 'sellMult', jp: '売却倍率', en: 'SELL RATE', max: 60,
    cost: lv => 25 * Math.pow(1.5, lv),
    desc: lv => `×${(1 + 0.25 * lv).toFixed(2)} → ×${(1 + 0.25 * (lv + 1)).toFixed(2)}`,
  },
  {
    id: 'tapPower', jp: 'タップ強化', en: 'MULTI TAP', max: 4,
    cost: lv => 60 * Math.pow(5, lv),
    desc: lv => `${lv + 1} → ${lv + 2}`,
  },
  {
    id: 'luck', jp: '幸運', en: 'LUCK', max: 10,
    cost: lv => 80 * Math.pow(1.9, lv),
    desc: lv => `${lv * 5}% → ${(lv + 1) * 5}%`,
  },
  {
    id: 'space', jp: '空間拡張', en: 'SPACE', max: SPACE_CAPS.length - 1,
    cost: lv => 150 * Math.pow(12, lv),
    desc: lv => `${SPACE_CAPS[lv]} → ${SPACE_CAPS[Math.min(lv + 1, SPACE_CAPS.length - 1)]} objects`,
  },
  {
    id: 'baseTier', jp: '生成ランク', en: 'BASE RANK', max: 10,
    cost: lv => 400 * Math.pow(7, lv),
    desc: lv => `${pow2(lv)} → ${pow2(lv + 1)}`,
  },
  {
    id: 'autoSell', jp: '自動売却', en: 'AUTO SELL', max: 1,
    cost: () => 300,
    desc: () => '満杯なら最小を売って生成を続ける',
  },
];

// ---------- 状態 ----------
function freshState(keep) {
  const up = {};
  UPGRADES.forEach(u => (up[u.id] = 0));
  return {
    coins: 0,
    objs: [],          // { id, t, x, y }  x,y はフィールド比率 0..1
    nextId: 1,
    up,
    shards: keep ? keep.shards : 0,
    stats: keep ? keep.stats : {
      spawned: 0, merged: 0, sold: 0, earned: 0, maxTier: 0,
      infinities: 0, playTime: 0, taps: 0,
    },
    seenInf: false,
    last: Date.now(),
  };
}

function load() {
  const base = freshState();
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      return { ...base, ...d, up: { ...base.up, ...d.up }, stats: { ...base.stats, ...d.stats } };
    }
    // v1（グリッド版）からの引き継ぎ
    const old = localStorage.getItem(OLD_SAVE_KEY);
    if (old) {
      const d = JSON.parse(old);
      const s = { ...base, coins: d.coins || 0, shards: d.shards || 0, seenInf: !!d.seenInf,
        up: { ...base.up, ...d.up, space: (d.up && d.up.board) || 0 },
        stats: { ...base.stats, ...d.stats } };
      delete s.up.board;
      (d.board || []).filter(t => t >= 0).slice(0, SPACE_CAPS[s.up.space]).forEach(t => {
        s.objs.push({ id: s.nextId++, t, x: 0.1 + Math.random() * 0.8, y: 0.1 + Math.random() * 0.8 });
      });
      return s;
    }
  } catch (e) { /* 破損データは無視 */ }
  return null;
}

let S = load() || freshState();

function save() {
  S.last = Date.now();
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* 保存不可 */ }
}

// ---------- 計算 ----------
const genInterval = lv => Math.max(0.15, 3 * Math.pow(0.86, lv - 1));
const mergeInterval = lv => Math.max(0.1, 2.5 * Math.pow(0.86, lv - 1));
const prestigeMult = () => Math.pow(2, S.shards);
const sellMult = () => (1 + 0.25 * S.up.sellMult) * prestigeMult();
const sellPrice = t => Math.pow(2, t) * sellMult();
const spawnCoin = () => 0.1 * S.up.spawnCoin * prestigeMult();
const cap = () => SPACE_CAPS[S.up.space];
const upCost = u => Math.ceil(u.cost(S.up[u.id]));
const pow2 = t => '2' + String(t).split('').map(c => SUP[c]).join('');

function fmt(n) {
  if (n < 1000) {
    return Number.isInteger(n) ? String(n) : n.toFixed(n < 10 ? 1 : 0).replace(/\.0$/, '');
  }
  const units = ['K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
  const exp = Math.floor(Math.log10(n) / 3);
  if (exp - 1 < units.length) {
    return (n / Math.pow(1000, exp)).toFixed(exp > 0 ? 1 : 0).replace(/\.0$/, '') + units[exp - 1];
  }
  return n.toExponential(2).replace('+', '');
}

function fmtCoins(n) {
  if (n < 1e6) return Math.floor(n * 10) / 10 === Math.floor(n) ? Math.floor(n).toLocaleString('en-US')
    : (Math.floor(n * 10) / 10).toLocaleString('en-US', { minimumFractionDigits: 1 });
  return fmt(n);
}

function fmtTime(sec) {
  sec = Math.floor(sec);
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h ? `${h}時間${m}分` : m ? `${m}分${s}秒` : `${s}秒`;
}

// ---------- 画面参照 ----------
const $ = id => document.getElementById(id);
const els = {
  coins: $('coins'), rate: $('rate'), dim: $('dim'), count: $('count'),
  field: $('field'), fieldHint: $('fieldHint'), rail: $('rail'), railText: $('railText'), railPrice: $('railPrice'),
  upgrades: $('upgrades'), infPath: $('infPath'), infMain: $('infMain'), infSub: $('infSub'), infNote: $('infNote'),
  prestigeBtn: $('prestigeBtn'), stats: $('stats'), dex: $('dex'),
  shopBadge: $('shopBadge'), infBadge: $('infBadge'),
  modal: $('modal'), modalRings: $('modalRings'), modalBody: $('modalBody'), modalButtons: $('modalButtons'), toast: $('toast'),
};

// ---------- 幾何 ----------
function fieldRect() { return els.field.getBoundingClientRect(); }
function scale() { return Math.min(1.25, Math.max(0.8, fieldRect().width / 390)); }
function diameter(t) { return (t >= MAX_TIER ? 120 : 16 + t * 5) * scale(); }
function toPx(o) { const r = fieldRect(); return { x: o.x * r.width, y: o.y * r.height }; }

// 他と重なりにくい空き場所を探す
function findSpot(t, near) {
  const r = fieldRect();
  const d = diameter(t);
  const mx = (d / 2 + 6) / r.width, my = (d / 2 + 6) / r.height;
  let best = null, bestScore = -1;
  for (let i = 0; i < 24; i++) {
    let x, y;
    if (near) {
      x = near.x + (Math.random() - 0.5) * 0.3;
      y = near.y + (Math.random() - 0.5) * 0.2;
    } else {
      x = Math.random(); y = Math.random();
    }
    x = Math.min(1 - mx, Math.max(mx, x));
    y = Math.min(1 - my, Math.max(my, y));
    let minGap = Infinity;
    for (const o of S.objs) {
      const p = toPx(o);
      const gap = Math.hypot(p.x - x * r.width, p.y - y * r.height) - (diameter(o.t) + d) / 2;
      if (gap < minGap) minGap = gap;
    }
    if (minGap > 8) return { x, y };
    if (minGap > bestScore) { bestScore = minGap; best = { x, y }; }
  }
  return best;
}

function clampPos(t, x, y) {
  const r = fieldRect();
  const d = diameter(t);
  const mx = (d / 2) / r.width, my = (d / 2) / r.height;
  return { x: Math.min(1 - mx, Math.max(mx, x)), y: Math.min(1 - my, Math.max(my, y)) };
}

// ---------- ゲーム操作 ----------
const byId = id => S.objs.find(o => o.id === id);
const busy = new Set();   // 合成アニメ中
let selected = null;

function rollTier() {
  let t = S.up.baseTier;
  if (Math.random() < S.up.luck * 0.05) t++;
  return Math.min(t, MAX_TIER - 1);
}

function addCoins(n) {
  S.coins += n;
  S.stats.earned += n;
}

function spawnOne(pos) {
  if (S.objs.length >= cap()) {
    if (!S.up.autoSell || !sellLowest()) return false;
  }
  const t = rollTier();
  const p = pos ? clampPos(t, pos.x, pos.y) : findSpot(t);
  const o = { id: S.nextId++, t, x: p.x, y: p.y };
  S.objs.push(o);
  S.stats.spawned++;
  const coin = spawnCoin();
  addCoins(coin);
  fx.spawn.add(o.id);
  noteTier(t);
  if (coin > 0 && pos) floatAt(o, `+${fmt(coin)}`);
  dirty = true;
  return true;
}

function spawnAt(pos) {
  let made = spawnOne(pos) ? 1 : 0;
  for (let i = 0; i < S.up.tapPower; i++) {
    if (spawnOne(findSpot(S.up.baseTier, pos))) made++;
  }
  return made;
}

// a を b に吸収させて b のランクを上げる
function merge(a, b) {
  if (!a || !b || a === b || a.t !== b.t) return false;
  if (a.t >= MAX_TIER) {
    toast('∞ 同士は、まだ合わさらない');
    return false;
  }
  S.objs = S.objs.filter(o => o !== a);
  b.t++;
  Object.assign(b, clampPos(b.t, b.x, b.y));
  S.stats.merged++;
  fx.pop.add(b.id);
  rippleAt(b, diameter(b.t) * 1.8);
  floatAt(b, `${pow2(b.t - 1)} + ${pow2(b.t - 1)} = ${pow2(b.t)}`, 'formula');
  if (selected === a.id || selected === b.id) selected = null;
  noteTier(b.t);
  dirty = true;
  return true;
}

// a が b へ飛んでいってから合成
function mergeAnimated(a, b) {
  if (busy.has(a.id) || busy.has(b.id)) return;
  busy.add(a.id); busy.add(b.id);
  a.x = b.x; a.y = b.y;
  dirty = true;
  setTimeout(() => {
    busy.delete(a.id); busy.delete(b.id);
    if (byId(a.id) && byId(b.id)) merge(a, b);
  }, 260);
}

function sell(o, silent) {
  if (!o) return 0;
  const price = sellPrice(o.t);
  S.objs = S.objs.filter(x => x !== o);
  addCoins(price);
  S.stats.sold++;
  if (selected === o.id) selected = null;
  dirty = true;
  if (!silent) railFloat(`+${fmt(price)}`);
  return price;
}

function sellLowest() {
  const free = S.objs.filter(o => !busy.has(o.id));
  if (!free.length) return false;
  sell(free.reduce((m, o) => (o.t < m.t ? o : m)), true);
  return true;
}

// 一番低いランクのペアを1組合成
function autoMergeStep() {
  const seen = {};
  let pair = null;
  for (const o of S.objs) {
    if (busy.has(o.id) || o.t >= MAX_TIER || (drag && drag.id === o.id)) continue;
    if (seen[o.t]) {
      if (!pair || o.t < pair[0].t) pair = [o, seen[o.t]];
    } else {
      seen[o.t] = o;
    }
  }
  if (pair) mergeAnimated(pair[0], pair[1]);
}

function noteTier(t) {
  if (t > S.stats.maxTier) S.stats.maxTier = t;
  if (t === MAX_TIER) {
    S.stats.infinities++;
    if (!S.seenInf) {
      S.seenInf = true;
      setTimeout(showInfinityReached, 500);
    }
  }
}

function buy(u) {
  const cost = upCost(u);
  if (S.up[u.id] >= u.max || S.coins < cost) return;
  S.coins -= cost;
  S.up[u.id]++;
  dirty = true;
  renderShop();
  save();
}

const infCount = () => S.objs.filter(o => o.t >= MAX_TIER).length;

function prestige() {
  const gain = infCount();
  if (!gain) return;
  S = freshState({ shards: S.shards + gain, stats: S.stats });
  selected = null;
  busy.clear();
  genAcc = mergeAcc = 0;
  els.field.querySelectorAll('.obj').forEach(e => e.remove());
  nodes.clear();
  dirty = true;
  save();
  renderAll();
  switchPanel('play');
  showModal({
    rings: 'DIM',
    title: `次元 ${String(S.shards + 1).padStart(2, '0')}`,
    text: `すべての収入が ×${fmt(prestigeMult())} になった。<br>無限の、さらに次へ。`,
    buttons: [{ label: 'START', primary: true }],
  });
}

// ---------- 描画 ----------
let dirty = true;
let currentPanel = 'play';
const fx = { pop: new Set(), spawn: new Set() };
const nodes = new Map();   // id -> element

function bodyHTML(t) {
  if (t >= MAX_TIER) return '<div class="body inf"><span class="v">∞</span></div>';
  const d = 16 + t * 5;
  const label = d >= 26 ? `<span class="v" style="font-size:${Math.min(14, 8 + t * 0.4)}px">${fmt(Math.pow(2, t))}</span>` : '';
  return `<div class="body ${t % 2 === 0 ? 'fill' : 'line'}">${t >= 10 ? '<i class="orbit"></i>' : ''}${label}</div>`;
}

function makeNode(o) {
  const el = document.createElement('div');
  el.className = 'obj';
  el.dataset.id = o.id;
  const drift = document.createElement('div');
  drift.className = 'drift';
  drift.style.setProperty('--dur', (4 + Math.random() * 4).toFixed(2) + 's');
  drift.style.setProperty('--delay', (-Math.random() * 6).toFixed(2) + 's');
  drift.style.setProperty('--dx', ((Math.random() - 0.5) * 8).toFixed(1) + 'px');
  drift.style.setProperty('--dy', ((Math.random() - 0.5) * 8).toFixed(1) + 'px');
  el.appendChild(drift);
  els.field.appendChild(el);
  return el;
}

function renderField() {
  const r = fieldRect();
  const alive = new Set();
  for (const o of S.objs) {
    alive.add(o.id);
    let el = nodes.get(o.id);
    const fresh = !el;
    if (fresh) { el = makeNode(o); nodes.set(o.id, el); }
    if (el.dataset.t !== String(o.t)) {
      el.dataset.t = o.t;
      el.firstChild.innerHTML = bodyHTML(o.t);
      const d = diameter(o.t);
      el.style.width = el.style.height = d + 'px';
    }
    if (!(drag && drag.id === o.id && drag.moving)) {
      el.style.left = o.x * r.width + 'px';
      el.style.top = o.y * r.height + 'px';
    }
    el.classList.toggle('selected', selected === o.id);
    if (fx.pop.has(o.id)) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
    else if (fx.spawn.has(o.id)) el.classList.add('spawn');
  }
  for (const [id, el] of nodes) {
    if (!alive.has(id)) { el.remove(); nodes.delete(id); }
  }
  fx.pop.clear();
  fx.spawn.clear();

  els.fieldHint.classList.toggle('hide', S.stats.taps > 3 || S.objs.length > 0);
  const sel = selected && byId(selected);
  if (sel) {
    els.railText.textContent = 'TAP TO SELL';
    els.railPrice.textContent = `+${fmt(sellPrice(sel.t))}`;
    els.rail.classList.add('armed');
  } else {
    els.railText.textContent = '↓ DROP TO SELL';
    els.railPrice.textContent = '';
    els.rail.classList.remove('armed');
  }
}

function renderHeader() {
  els.coins.textContent = fmtCoins(S.coins);
  const rate = S.up.autoGen ? spawnCoin() / genInterval(S.up.autoGen) : 0;
  els.rate.textContent = rate > 0 ? `+${fmt(Math.round(rate * 10) / 10)} / s` : '';
  els.dim.textContent = `DIM ${String(S.shards + 1).padStart(2, '0')}`;
  els.count.textContent = `${S.objs.length} / ${cap()}`;
  const affordable = UPGRADES.some(u => S.up[u.id] < u.max && S.coins >= upCost(u));
  els.shopBadge.classList.toggle('on', affordable);
  els.infBadge.classList.toggle('on', infCount() > 0);
}

function renderShop() {
  els.upgrades.innerHTML = UPGRADES.map((u, i) => {
    const lv = S.up[u.id];
    const maxed = lv >= u.max;
    const cost = upCost(u);
    const n = Math.min(u.max, 20);
    const on = Math.ceil((lv / u.max) * n);
    const ticks = Array.from({ length: n }, (_, k) => `<i class="${k < on ? 'on' : ''}"></i>`).join('');
    return `<div class="up ${!maxed && S.coins < cost ? 'locked' : ''}" data-row="${u.id}">
      <div class="up-no">${String(i + 1).padStart(2, '0')}</div>
      <div>
        <div class="up-jp">${u.jp}</div>
        <div class="up-en">${u.en} · LV ${lv}</div>
        <div class="up-desc"><span>${maxed ? 'MAX' : u.desc(lv)}</span><span class="ticks">${ticks}</span></div>
      </div>
      <button class="pill ${maxed ? 'max' : ''}" data-id="${u.id}" ${maxed || S.coins < cost ? 'disabled' : ''}>${maxed ? 'MAX' : fmt(cost)}</button>
    </div>`;
  }).join('');
}

function refreshShop() {
  els.upgrades.querySelectorAll('.pill').forEach(b => {
    const u = UPGRADES.find(x => x.id === b.dataset.id);
    const maxed = S.up[u.id] >= u.max;
    const can = !maxed && S.coins >= upCost(u);
    b.disabled = !can;
    b.closest('.up').classList.toggle('locked', !maxed && !can);
  });
}

function renderInf() {
  const mt = S.stats.maxTier;
  els.infPath.innerHTML = Array.from({ length: MAX_TIER + 1 }, (_, t) =>
    `<i class="${t <= mt ? 'got' : ''} ${t === MAX_TIER ? 'last' : ''}"></i>`).join('');
  els.infPath.style.setProperty('--prog', (mt / MAX_TIER) * 100 + '%');
  const count = infCount();
  if (count) {
    els.infMain.innerHTML = `フィールドに ∞ が ${count} つある。`;
    els.infSub.innerHTML = `次へ進むと、コイン・オブジェクト・強化はリセット。<br>次元 +${count} ／ 収入 ×${fmt(Math.pow(2, S.shards + count))}`;
    els.infNote.textContent = '';
  } else {
    els.infMain.innerHTML = mt >= MAX_TIER ? '∞ はもう、ここにはない。' : `無限まで、あと ${MAX_TIER - mt} 段階。`;
    els.infSub.innerHTML = S.shards ? `次元 ${String(S.shards + 1).padStart(2, '0')} ／ 収入 ×${fmt(prestigeMult())}` : '無限の次、気にならない？';
    els.infNote.textContent = 'LOCKED — ∞ を作ると解放';
  }
  els.prestigeBtn.disabled = !count;
}

function renderStats() {
  const st = S.stats;
  const rows = [
    ['プレイ時間', fmtTime(st.playTime)],
    ['タップ', fmt(st.taps)],
    ['生成', fmt(st.spawned)],
    ['合成', fmt(st.merged)],
    ['売却', fmt(st.sold)],
    ['累計コイン', fmt(Math.floor(st.earned))],
    ['最高ランク', st.maxTier >= MAX_TIER ? '∞' : pow2(st.maxTier)],
    ['∞ を作った回数', fmt(st.infinities)],
    ['次元', String(S.shards + 1).padStart(2, '0')],
  ];
  els.stats.innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
  els.dex.innerHTML = Array.from({ length: MAX_TIER + 1 }, (_, t) => {
    const known = t <= st.maxTier;
    const s = t >= MAX_TIER ? 34 : Math.min(34, 10 + t * 1.3);
    return `<div class="dex-cell ${known ? '' : 'unknown'}"><div class="mini" style="--s:${s}px">${bodyHTML(t).replace(/font-size:[\d.]+px/, 'font-size:0')}</div>${t >= MAX_TIER ? '∞' : pow2(t)}</div>`;
  }).join('');
}

function renderAll() {
  renderField();
  renderHeader();
  renderShop();
  renderInf();
  renderStats();
}

function switchPanel(name) {
  currentPanel = name;
  document.body.classList.toggle('on-play', name === 'play');
  document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.id === 'panel-' + name));
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.panel === name));
  if (name === 'play') { dirty = true; }
  if (name === 'shop') renderShop();
  if (name === 'inf') renderInf();
  if (name === 'stats') renderStats();
}

// ---------- エフェクト ----------
function rippleAt(o, size) {
  const p = toPx(o);
  const el = document.createElement('div');
  el.className = 'ripple';
  el.style.left = p.x + 'px';
  el.style.top = p.y + 'px';
  el.style.setProperty('--size', size + 'px');
  els.field.appendChild(el);
  setTimeout(() => el.remove(), 700);
}

function floatAt(o, text, cls) {
  const p = toPx(o);
  const el = document.createElement('div');
  el.className = 'float' + (cls ? ' ' + cls : '');
  el.textContent = text;
  el.style.left = p.x + 'px';
  el.style.top = p.y - diameter(o.t) / 2 - 16 + 'px';
  els.field.appendChild(el);
  setTimeout(() => el.remove(), 800);
}

function railFloat(text) {
  floatAt({ x: 0.85, y: 1, t: 0 }, text);
}

let toastTimer;
function toast(msg) {
  els.toast.textContent = msg;
  els.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove('show'), 1600);
}

function showModal({ rings = '', title = '', text = '', buttons }) {
  els.modalRings.textContent = rings;
  els.modalRings.style.fontSize = rings.length > 1 ? '40px' : '';
  els.modalRings.style.letterSpacing = rings.length > 1 ? '0.3em' : '';
  els.modalBody.innerHTML = `<p class="m-title">${title}</p><p class="m-text">${text}</p>`;
  els.modalButtons.innerHTML = '';
  buttons.forEach(b => {
    const btn = document.createElement('button');
    btn.innerHTML = b.label;
    if (!b.primary) btn.className = 'sub';
    btn.onclick = () => { els.modal.hidden = true; b.onClick && b.onClick(); };
    els.modalButtons.appendChild(btn);
  });
  els.modal.hidden = false;
}

function showInfinityReached() {
  showModal({
    rings: '∞',
    title: '無限に到達した。',
    text: '…でも、無限の次って<br>気にならない？',
    buttons: [
      { label: 'BEYOND ∞ &nbsp;→', primary: true, onClick: () => switchPanel('inf') },
      { label: 'まだ続ける' },
    ],
  });
}

// ---------- 入力：どこでもタップ / 自由にドラッグ ----------
let drag = null;

function localPos(e) {
  const r = fieldRect();
  return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
}

function overRail(e) {
  return e.clientY > els.rail.getBoundingClientRect().top + 8;
}

function hitTest(o, px, py) {
  // ドロップ先：同ランクで十分に重なっているもの
  let best = null, bestDist = Infinity;
  for (const other of S.objs) {
    if (other === o || other.t !== o.t || busy.has(other.id)) continue;
    const p = toPx(other);
    const dist = Math.hypot(p.x - px, p.y - py);
    if (dist < diameter(o.t) * 0.9 && dist < bestDist) { best = other; bestDist = dist; }
  }
  return best;
}

els.field.addEventListener('pointerdown', e => {
  const objEl = e.target.closest('.obj');
  const id = objEl ? Number(objEl.dataset.id) : null;
  if (id && busy.has(id)) return;
  drag = { id, x: e.clientX, y: e.clientY, moving: false };
  els.field.setPointerCapture(e.pointerId);
});

els.field.addEventListener('pointermove', e => {
  if (!drag || !drag.id) return;
  const o = byId(drag.id);
  if (!o) { drag = null; return; }
  if (!drag.moving && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 6) {
    drag.moving = true;
    selected = null;
    nodes.get(o.id).classList.add('dragging');
  }
  if (drag.moving) {
    const r = fieldRect();
    const el = nodes.get(o.id);
    el.style.left = e.clientX - r.left + 'px';
    el.style.top = e.clientY - r.top + 'px';
    const hot = overRail(e);
    els.rail.classList.toggle('hot', hot);
    el.classList.toggle('to-sell', hot);
    if (hot) els.railPrice.textContent = `+${fmt(sellPrice(o.t))}`;
  }
});

function endDrag(e, cancelled) {
  if (!drag) return;
  const d = drag;
  drag = null;
  els.rail.classList.remove('hot');
  const o = d.id && byId(d.id);
  if (o) nodes.get(o.id) && nodes.get(o.id).classList.remove('dragging', 'to-sell');

  if (cancelled) { dirty = true; return; }

  if (!d.moving) {
    if (o) tapObj(o);
    else tapEmpty(localPos(e));
  } else if (o) {
    const r = fieldRect();
    const px = e.clientX - r.left, py = e.clientY - r.top;
    const target = hitTest(o, px, py);
    if (overRail(e)) {
      sell(o);
    } else if (target) {
      o.x = target.x; o.y = target.y;
      merge(o, target);
    } else {
      Object.assign(o, clampPos(o.t, px / r.width, py / r.height));
    }
  }
  dirty = true;
  renderField();
  renderHeader();
}

els.field.addEventListener('pointerup', e => endDrag(e, false));
els.field.addEventListener('pointercancel', e => endDrag(e, true));

function tapEmpty(pos) {
  S.stats.taps++;
  if (selected) { selected = null; return; }
  const o = { ...pos, t: 0 };
  rippleAt(o, 60);
  if (!spawnAt(pos)) {
    toast('空間がいっぱい。合成するか売却しよう');
    els.count.classList.remove('full'); void els.count.offsetWidth; els.count.classList.add('full');
  }
}

function tapObj(o) {
  const sel = selected && byId(selected);
  if (!sel) selected = o.id;
  else if (sel === o) selected = null;
  else if (sel.t === o.t) { selected = null; mergeAnimated(sel, o); }
  else selected = o.id;
}

els.rail.addEventListener('click', () => {
  const sel = selected && byId(selected);
  if (sel) {
    sell(sel);
    renderField();
    renderHeader();
  } else {
    toast('オブジェクトをここへドラッグして売却');
  }
});

els.upgrades.addEventListener('click', e => {
  const b = e.target.closest('.pill');
  if (b) buy(UPGRADES.find(u => u.id === b.dataset.id));
});

els.prestigeBtn.addEventListener('click', () => {
  const gain = infCount();
  showModal({
    rings: '∞',
    title: '無限の次へ進む？',
    text: `コイン・オブジェクト・強化はリセット。<br>次元 +${gain} ／ 収入 ×${fmt(Math.pow(2, S.shards + gain))}`,
    buttons: [{ label: 'BEYOND ∞ &nbsp;→', primary: true, onClick: prestige }, { label: 'やめる' }],
  });
});

document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => switchPanel(t.dataset.panel)));

$('resetBtn').addEventListener('click', () => {
  showModal({
    title: 'すべてのデータを消去する？',
    text: '元には戻せません。',
    buttons: [
      {
        label: 'ERASE', primary: true, onClick: () => {
          S = freshState();
          selected = null;
          busy.clear();
          nodes.forEach(el => el.remove());
          nodes.clear();
          save();
          renderAll();
          switchPanel('play');
        },
      },
      { label: 'やめる' },
    ],
  });
});

window.addEventListener('resize', () => {
  nodes.forEach(el => (el.dataset.t = ''));   // サイズを再計算
  dirty = true;
});

// ---------- メインループ ----------
let genAcc = 0, mergeAcc = 0, saveAcc = 0;
let lastTick = performance.now();

function tick() {
  const now = performance.now();
  const dt = Math.min(1, (now - lastTick) / 1000);
  lastTick = now;
  S.stats.playTime += dt;

  if (S.up.autoGen) {
    genAcc += dt;
    const iv = genInterval(S.up.autoGen);
    while (genAcc >= iv) { genAcc -= iv; spawnOne(); }
  }
  if (S.up.autoMerge && !(drag && drag.moving)) {
    mergeAcc += dt;
    const iv = mergeInterval(S.up.autoMerge);
    while (mergeAcc >= iv) { mergeAcc -= iv; autoMergeStep(); }
  }

  if (dirty && currentPanel === 'play') {
    renderField();
    dirty = false;
  }
  renderHeader();
  if (currentPanel === 'shop') refreshShop();

  saveAcc += dt;
  if (saveAcc > 5) { saveAcc = 0; save(); }
}

function offlineReward() {
  const away = Math.min(OFFLINE_CAP_SEC, (Date.now() - (S.last || Date.now())) / 1000);
  if (away < 30 || !S.up.autoGen) return;
  const spawns = away / genInterval(S.up.autoGen);
  const coins = spawns * (spawnCoin() + sellPrice(S.up.baseTier) * 0.5);
  if (coins < 1) return;
  addCoins(coins);
  showModal({
    rings: '',
    title: `+${fmt(Math.floor(coins))} COIN`,
    text: `留守の間（${fmtTime(away)}）も、生成は続いていた。`,
    buttons: [{ label: 'RECEIVE', primary: true }],
  });
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) save();
  else lastTick = performance.now();
});
window.addEventListener('pagehide', save);

offlineReward();
renderAll();
setInterval(tick, 100);

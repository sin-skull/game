'use strict';

// =====================================================
//  無限の次へ — 合成インクリメンタルゲーム
// =====================================================

const SAVE_KEY = 'infinity-merge-v1';
const MAX_TIER = 20;             // 2^20 のアイテムが「無限」
const OFFLINE_CAP_SEC = 8 * 3600;

// アイテム一覧（ランク n の価値は 2^n）
const TIERS = [
  ['🫧', '泡'], ['💧', 'しずく'], ['🌱', '芽'], ['🍀', 'クローバー'], ['🌸', '花'],
  ['🍎', '果実'], ['🐣', 'ひよこ'], ['🐟', 'さかな'], ['🐈', 'ねこ'], ['🦊', 'きつね'],
  ['🐉', 'ドラゴン'], ['🏠', '家'], ['🏰', '城'], ['🗻', '山'], ['🌋', '火山'],
  ['🌍', '惑星'], ['🌙', '月'], ['☀️', '恒星'], ['🌌', '銀河'], ['🕳️', 'ブラックホール'],
  ['♾️', '無限'],
];

// 盤面サイズ（列, 行）— 画面がごちゃごちゃしないよう上限あり
const BOARD_SIZES = [[4, 4], [4, 5], [5, 5], [5, 6], [6, 6]];

// ---------- ステータス強化 ----------
const UPGRADES = [
  {
    id: 'autoGen', icon: '⚙️', name: '自動生成', max: 25,
    cost: lv => 15 * Math.pow(1.55, lv),
    desc: lv => lv === 0 ? '一定時間ごとに自動でアイテムを生成'
      : `${genInterval(lv).toFixed(2)}秒ごと → ${genInterval(lv + 1).toFixed(2)}秒ごと`,
  },
  {
    id: 'autoMerge', icon: '🧲', name: '自動合成', max: 25,
    cost: lv => 40 * Math.pow(1.6, lv),
    desc: lv => lv === 0 ? '同じアイテムを自動で合成'
      : `${mergeInterval(lv).toFixed(2)}秒ごと → ${mergeInterval(lv + 1).toFixed(2)}秒ごと`,
  },
  {
    id: 'spawnCoin', icon: '🪙', name: '生成ボーナス', max: 50,
    cost: lv => 10 * Math.pow(1.45, lv),
    desc: lv => `生成するたびに +${fmt(0.1 * lv)} → +${fmt(0.1 * (lv + 1))} コイン`,
  },
  {
    id: 'sellMult', icon: '💰', name: '売却倍率', max: 60,
    cost: lv => 25 * Math.pow(1.5, lv),
    desc: lv => `売値 ×${(1 + 0.25 * lv).toFixed(2)} → ×${(1 + 0.25 * (lv + 1)).toFixed(2)}`,
  },
  {
    id: 'tapPower', icon: '👆', name: 'タップ強化', max: 4,
    cost: lv => 60 * Math.pow(5, lv),
    desc: lv => `1タップで ${lv + 1}個 → ${lv + 2}個 生成`,
  },
  {
    id: 'luck', icon: '🍀', name: '幸運', max: 10,
    cost: lv => 80 * Math.pow(1.9, lv),
    desc: lv => `ひとつ上のランクで生成される確率 ${lv * 5}% → ${(lv + 1) * 5}%`,
  },
  {
    id: 'board', icon: '🔲', name: '盤面拡張', max: BOARD_SIZES.length - 1,
    cost: lv => 150 * Math.pow(12, lv),
    desc: lv => {
      const [c, r] = BOARD_SIZES[lv];
      const n = BOARD_SIZES[Math.min(lv + 1, BOARD_SIZES.length - 1)];
      return `${c}×${r} → ${n[0]}×${n[1]} マス`;
    },
  },
  {
    id: 'baseTier', icon: '⬆️', name: '生成ランク', max: 10,
    cost: lv => 400 * Math.pow(7, lv),
    desc: lv => `${TIERS[lv][0]}${TIERS[lv][1]} → ${TIERS[lv + 1][0]}${TIERS[lv + 1][1]} から生成`,
  },
  {
    id: 'autoSell', icon: '♻️', name: '自動売却', max: 1,
    cost: () => 300,
    desc: () => '盤面が満杯のとき、一番低いアイテムを自動で売って生成を続ける',
  },
];

// ---------- 状態 ----------
function freshState(keep) {
  const up = {};
  UPGRADES.forEach(u => (up[u.id] = 0));
  return {
    coins: 0,
    board: new Array(16).fill(-1),
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

let S = load() || freshState();

function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    const base = freshState();
    return {
      ...base, ...data,
      up: { ...base.up, ...data.up },
      stats: { ...base.stats, ...data.stats },
    };
  } catch (e) {
    return null;
  }
}

function save() {
  S.last = Date.now();
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* 保存不可の環境 */ }
}

// ---------- 計算 ----------
const genInterval = lv => Math.max(0.15, 3 * Math.pow(0.86, lv - 1));
const mergeInterval = lv => Math.max(0.1, 2.5 * Math.pow(0.86, lv - 1));
const prestigeMult = () => Math.pow(2, S.shards);
const sellMult = () => (1 + 0.25 * S.up.sellMult) * prestigeMult();
const sellPrice = t => Math.pow(2, t) * sellMult();
const spawnCoin = () => 0.1 * S.up.spawnCoin * prestigeMult();
const boardSize = () => BOARD_SIZES[S.up.board];
const cellCount = () => boardSize()[0] * boardSize()[1];
const upCost = u => Math.ceil(u.cost(S.up[u.id]));

function fmt(n) {
  if (n < 1000) {
    return Number.isInteger(n) ? String(n) : n.toFixed(n < 10 ? 1 : 0).replace(/\.0$/, '');
  }
  const units = ['K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
  const exp = Math.floor(Math.log10(n) / 3);
  if (exp - 1 < units.length) {
    return (n / Math.pow(1000, exp)).toFixed(2).replace(/\.?0+$/, '') + units[exp - 1];
  }
  return n.toExponential(2).replace('+', '');
}

function fmtTime(sec) {
  sec = Math.floor(sec);
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h ? `${h}時間${m}分` : m ? `${m}分${s}秒` : `${s}秒`;
}

// ---------- ゲーム操作 ----------
function emptyCells() {
  const out = [];
  for (let i = 0; i < cellCount(); i++) if (S.board[i] < 0) out.push(i);
  return out;
}

function rollTier() {
  let t = S.up.baseTier;
  if (Math.random() < S.up.luck * 0.05) t++;
  return Math.min(t, MAX_TIER - 1);
}

function addCoins(n) {
  S.coins += n;
  S.stats.earned += n;
}

// 生成。成功した数を返す
function spawn(count) {
  let made = 0;
  for (let i = 0; i < count; i++) {
    let empty = emptyCells();
    if (!empty.length && S.up.autoSell) {
      sellLowest();
      empty = emptyCells();
    }
    if (!empty.length) break;
    const idx = empty[Math.floor(Math.random() * empty.length)];
    S.board[idx] = rollTier();
    S.stats.spawned++;
    addCoins(spawnCoin());
    fx.spawn.add(idx);
    noteTier(S.board[idx]);
    made++;
  }
  if (made) dirty = true;
  return made;
}

function merge(from, to) {
  const t = S.board[from];
  if (from === to || t < 0 || S.board[to] !== t) return false;
  if (t >= MAX_TIER) {
    toast('♾️ 同士は…まだ合わさらない。無限の次へ進もう');
    return false;
  }
  S.board[from] = -1;
  S.board[to] = t + 1;
  S.stats.merged++;
  fx.pop.add(to);
  noteTier(t + 1);
  dirty = true;
  return true;
}

function move(from, to) {
  if (S.board[to] >= 0 || S.board[from] < 0) return;
  S.board[to] = S.board[from];
  S.board[from] = -1;
  dirty = true;
}

function sell(idx, silent) {
  const t = S.board[idx];
  if (t < 0) return 0;
  const price = sellPrice(t);
  S.board[idx] = -1;
  addCoins(price);
  S.stats.sold++;
  dirty = true;
  if (!silent) floatText(`+${fmt(price)}`, els.sellZone);
  return price;
}

function sellLowest() {
  let best = -1;
  for (let i = 0; i < cellCount(); i++) {
    if (S.board[i] >= 0 && (best < 0 || S.board[i] < S.board[best])) best = i;
  }
  if (best >= 0) sell(best, true);
}

// 一番低いランクのペアを1組だけ合成
function autoMergeStep() {
  const seen = {};
  let pair = null;
  for (let i = 0; i < cellCount(); i++) {
    const t = S.board[i];
    if (t < 0 || t >= MAX_TIER) continue;
    if (seen[t] !== undefined) {
      if (!pair || t < S.board[pair[1]]) pair = [i, seen[t]];
    } else {
      seen[t] = i;
    }
  }
  if (pair) merge(pair[0], pair[1]);
}

function noteTier(t) {
  if (t > S.stats.maxTier) S.stats.maxTier = t;
  if (t === MAX_TIER) {
    S.stats.infinities++;
    if (!S.seenInf) {
      S.seenInf = true;
      setTimeout(showInfinityReached, 350);
    }
  }
}

function buy(u) {
  const cost = upCost(u);
  if (S.up[u.id] >= u.max || S.coins < cost) return;
  S.coins -= cost;
  S.up[u.id]++;
  if (u.id === 'board') {
    // 列数が変わっても並びが崩れないように行・列で詰め直す
    const [oc] = BOARD_SIZES[S.up.board - 1];
    const [nc, nr] = boardSize();
    const nb = new Array(nc * nr).fill(-1);
    S.board.forEach((t, i) => {
      if (t < 0) return;
      const r = Math.floor(i / oc), c = i % oc;
      nb[r * nc + c] = t;
    });
    S.board = nb;
    selected = -1;
  }
  dirty = true;
  renderShop();
  save();
}

function hasInfinity() {
  return S.board.some(t => t >= MAX_TIER);
}

function prestige() {
  const gain = S.board.filter(t => t >= MAX_TIER).length;
  if (!gain) return;
  const keep = { shards: S.shards + gain, stats: S.stats };
  S = freshState(keep);
  selected = -1;
  genAcc = mergeAcc = 0;
  dirty = true;
  save();
  renderAll();
  switchPanel('play');
  showModal(
    `<div class="big">🌌</div><b>次元 ${S.shards + 1}</b> へ到達した。<br>すべての収入が <b>×${fmt(prestigeMult())}</b> になった。<br><small>無限の、さらに次へ。</small>`,
    [{ label: '始める', primary: true }]
  );
}

// ---------- 画面 ----------
const $ = id => document.getElementById(id);
const els = {
  coins: $('coins'), dim: $('dim'), grid: $('grid'), core: $('core'), coreEmoji: $('coreEmoji'),
  sellZone: $('sellZone'), sellPrice: $('sellPrice'), autos: $('autos'), goal: $('goal'),
  upgrades: $('upgrades'), infPath: $('infPath'), infText: $('infText'),
  prestigeBtn: $('prestigeBtn'), stats: $('stats'), dex: $('dex'),
  shopBadge: $('shopBadge'), infBadge: $('infBadge'),
  modal: $('modal'), modalBody: $('modalBody'), modalButtons: $('modalButtons'), toast: $('toast'),
};

let selected = -1;
let dirty = true;
let currentPanel = 'play';
const fx = { pop: new Set(), spawn: new Set() };

function itemHTML(t) {
  const [e] = TIERS[t];
  const cls = t >= MAX_TIER ? 'item inf' : 'item';
  const label = t >= MAX_TIER ? '∞' : fmt(Math.pow(2, t));
  return `<div class="${cls}" style="--h:${(t * 23 + 260) % 360}"><span class="e">${e}</span><span class="v">${label}</span></div>`;
}

function renderGrid() {
  const [c] = boardSize();
  els.grid.style.gridTemplateColumns = `repeat(${c}, 1fr)`;
  let html = '';
  for (let i = 0; i < cellCount(); i++) {
    const t = S.board[i];
    const cls = ['cell'];
    if (i === selected) cls.push('selected');
    if (fx.pop.has(i)) cls.push('pop');
    else if (fx.spawn.has(i)) cls.push('spawn');
    html += `<div class="${cls.join(' ')}" data-i="${i}">${t >= 0 ? itemHTML(t) : ''}</div>`;
  }
  els.grid.innerHTML = html;
  fx.pop.clear();
  fx.spawn.clear();

  const full = emptyCells().length === 0;
  els.core.classList.toggle('full', full && !S.up.autoSell);
  const base = S.up.baseTier;
  els.coreEmoji.textContent = TIERS[base][0];

  if (selected >= 0 && S.board[selected] >= 0) {
    els.sellPrice.textContent = `+${fmt(sellPrice(S.board[selected]))} 🪙`;
  } else {
    els.sellPrice.textContent = '選択 or ドラッグ';
  }

  const mt = S.stats.maxTier;
  const next = Math.min(mt + 1, MAX_TIER);
  els.goal.innerHTML = mt >= MAX_TIER
    ? '♾️ 無限に到達済み — <b>無限の次へ</b> 進めます'
    : `最高到達 <b>${TIERS[mt][0]} ${TIERS[mt][1]}</b> → 次は <b>${TIERS[next][0]} ？</b>（無限まであと ${MAX_TIER - mt} 段階）`;
}

function renderHeader() {
  els.coins.textContent = fmt(Math.floor(S.coins * 10) / 10);
  els.dim.textContent = S.shards ? `次元 ${S.shards + 1} ・ ×${fmt(prestigeMult())}` : '次元 1';
  const affordable = UPGRADES.some(u => S.up[u.id] < u.max && S.coins >= upCost(u));
  els.shopBadge.classList.toggle('on', affordable);
  els.infBadge.classList.toggle('on', hasInfinity());
}

function renderAutos() {
  const rows = [];
  if (S.up.autoGen) {
    rows.push(`⚙️ 自動生成<div class="bar"><i style="width:${Math.min(100, (genAcc / genInterval(S.up.autoGen)) * 100)}%"></i></div>`);
  }
  if (S.up.autoMerge) {
    rows.push(`🧲 自動合成<div class="bar"><i style="width:${Math.min(100, (mergeAcc / mergeInterval(S.up.autoMerge)) * 100)}%"></i></div>`);
  }
  if (S.up.autoSell) rows.push('♻️ 自動売却 ON');
  els.autos.innerHTML = rows.join('') || '<span>強化で<br>自動化できます</span>';
}

function renderShop() {
  els.upgrades.innerHTML = UPGRADES.map(u => {
    const lv = S.up[u.id];
    const maxed = lv >= u.max;
    const cost = upCost(u);
    return `<div class="up">
      <div class="up-icon">${u.icon}</div>
      <div class="up-main">
        <div class="up-name">${u.name}<small>Lv ${lv}${u.max < 100 ? ' / ' + u.max : ''}</small></div>
        <div class="up-desc">${maxed ? '最大レベル' : u.desc(lv)}</div>
      </div>
      <button class="up-buy" data-id="${u.id}" ${maxed || S.coins < cost ? 'disabled' : ''}>${maxed ? 'MAX' : '🪙 ' + fmt(cost)}</button>
    </div>`;
  }).join('');
}

function refreshShopButtons() {
  els.upgrades.querySelectorAll('.up-buy').forEach(b => {
    const u = UPGRADES.find(x => x.id === b.dataset.id);
    b.disabled = S.up[u.id] >= u.max || S.coins < upCost(u);
  });
}

function renderInf() {
  const mt = S.stats.maxTier;
  els.infPath.innerHTML = TIERS.map((t, i) => `<span class="${i <= mt ? 'got' : ''}">${t[0]}</span>`).join('');
  const count = S.board.filter(t => t >= MAX_TIER).length;
  if (count) {
    els.infText.innerHTML = `盤面に ♾️ が <b>${count}個</b> ある。<br>無限の次へ進むと、盤面・コイン・強化はリセットされ、<br>次元が <b>+${count}</b>、すべての収入が <b>×${fmt(Math.pow(2, S.shards + count))}</b> になる。`;
  } else if (S.shards) {
    els.infText.innerHTML = `現在 <b>次元 ${S.shards + 1}</b>（収入 ×${fmt(prestigeMult())}）。<br>もう一度 ♾️ を作れば、さらに次の次元へ。`;
  } else {
    els.infText.innerHTML = `${TIERS.length}段階目のアイテム <b>♾️ 無限</b> を作ると…？<br>無限の次、気にならない？`;
  }
  els.prestigeBtn.disabled = !count;
}

function renderStats() {
  const st = S.stats;
  const rows = [
    ['プレイ時間', fmtTime(st.playTime)],
    ['タップ回数', fmt(st.taps)],
    ['生成した数', fmt(st.spawned)],
    ['合成した数', fmt(st.merged)],
    ['売却した数', fmt(st.sold)],
    ['累計獲得コイン', fmt(Math.floor(st.earned))],
    ['最高ランク', `${TIERS[st.maxTier][0]} ${TIERS[st.maxTier][1]}`],
    ['♾️ を作った回数', fmt(st.infinities)],
    ['到達次元', String(S.shards + 1)],
  ];
  els.stats.innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
  els.dex.innerHTML = TIERS.map((t, i) => {
    const known = i <= st.maxTier;
    return `<div class="${known ? '' : 'unknown'}"><b>${t[0]}</b>${known ? t[1] : '？？？'}<br>${i >= MAX_TIER ? '∞' : fmt(Math.pow(2, i))}</div>`;
  }).join('');
}

function renderAll() {
  renderGrid();
  renderHeader();
  renderAutos();
  renderShop();
  renderInf();
  renderStats();
}

function switchPanel(name) {
  currentPanel = name;
  document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.id === 'panel-' + name));
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.panel === name));
  if (name === 'shop') renderShop();
  if (name === 'inf') renderInf();
  if (name === 'stats') renderStats();
}

let toastTimer;
function toast(msg) {
  els.toast.textContent = msg;
  els.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove('show'), 1800);
}

function floatText(text, anchor) {
  const r = anchor.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = 'float';
  el.textContent = text;
  el.style.left = r.left + r.width / 2 + 'px';
  el.style.top = r.top + 'px';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 800);
}

function showModal(html, buttons) {
  els.modalBody.innerHTML = html;
  els.modalButtons.innerHTML = '';
  buttons.forEach(b => {
    const btn = document.createElement('button');
    btn.textContent = b.label;
    if (b.primary) btn.className = 'primary';
    btn.onclick = () => { els.modal.hidden = true; b.onClick && b.onClick(); };
    els.modalButtons.appendChild(btn);
  });
  els.modal.hidden = false;
}

function showInfinityReached() {
  showModal(
    '<div class="big">♾️</div><b>無限</b> に到達した。<br>…でも、無限の次って気にならない？',
    [
      { label: 'まだ続ける' },
      { label: '無限の次へ', primary: true, onClick: () => switchPanel('inf') },
    ]
  );
}

// ---------- 入力（タップ & ドラッグ） ----------
let drag = null;

function cellFromPoint(x, y) {
  const el = document.elementFromPoint(x, y);
  if (!el) return null;
  if (el.closest('#sellZone')) return 'sell';
  const cell = el.closest('.cell');
  return cell ? Number(cell.dataset.i) : null;
}

function clearDropMarks() {
  document.querySelectorAll('.drop').forEach(e => e.classList.remove('drop'));
}

els.grid.addEventListener('pointerdown', e => {
  const cell = e.target.closest('.cell');
  if (!cell) return;
  const i = Number(cell.dataset.i);
  drag = { from: i, x: e.clientX, y: e.clientY, moving: false, ghost: null };
});

window.addEventListener('pointermove', e => {
  if (!drag || S.board[drag.from] < 0) return;
  if (!drag.moving && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 8) {
    drag.moving = true;
    selected = -1;
    const cellEl = els.grid.querySelector(`[data-i="${drag.from}"]`);
    cellEl.classList.add('dragging');
    cellEl.classList.remove('selected');
    drag.ghost = document.createElement('div');
    drag.ghost.className = 'ghost';
    drag.ghost.innerHTML = itemHTML(S.board[drag.from]);
    document.body.appendChild(drag.ghost);
  }
  if (drag.moving) {
    drag.ghost.style.left = e.clientX + 'px';
    drag.ghost.style.top = e.clientY + 'px';
    clearDropMarks();
    const target = cellFromPoint(e.clientX, e.clientY);
    if (target === 'sell') els.sellZone.classList.add('drop');
    else if (target !== null && target !== drag.from) {
      els.grid.querySelector(`[data-i="${target}"]`).classList.add('drop');
    }
  }
});

window.addEventListener('pointerup', e => {
  if (!drag) return;
  const d = drag;
  drag = null;
  clearDropMarks();
  if (d.ghost) d.ghost.remove();

  if (!d.moving) {
    tapCell(d.from);
    return;
  }
  const target = cellFromPoint(e.clientX, e.clientY);
  if (target === 'sell') sell(d.from);
  else if (target !== null && target !== d.from && S.board[d.from] >= 0) {
    if (S.board[target] < 0) move(d.from, target);
    else if (S.board[target] === S.board[d.from]) merge(d.from, target);
  }
  dirty = true;
  renderGrid();
});

window.addEventListener('pointercancel', () => {
  if (drag && drag.ghost) drag.ghost.remove();
  drag = null;
  clearDropMarks();
  dirty = true;
});

function tapCell(i) {
  const t = S.board[i];
  if (selected < 0) {
    if (t >= 0) selected = i;
  } else if (i === selected) {
    selected = -1;
  } else if (t < 0) {
    move(selected, i);
    selected = -1;
  } else if (t === S.board[selected]) {
    merge(selected, i);
    selected = -1;
  } else {
    selected = i;
  }
  dirty = true;
  renderGrid();
}

els.core.addEventListener('click', () => {
  S.stats.taps++;
  const made = spawn(1 + S.up.tapPower);
  if (!made) toast('盤面がいっぱい！合成するか売却しよう');
  renderGrid();
  renderHeader();
});

els.sellZone.addEventListener('click', () => {
  if (selected >= 0 && S.board[selected] >= 0) {
    sell(selected);
    selected = -1;
    renderGrid();
    renderHeader();
  } else {
    toast('アイテムを選択するか、ここへドラッグして売却');
  }
});

els.upgrades.addEventListener('click', e => {
  const b = e.target.closest('.up-buy');
  if (!b) return;
  buy(UPGRADES.find(u => u.id === b.dataset.id));
});

els.prestigeBtn.addEventListener('click', () => {
  const gain = S.board.filter(t => t >= MAX_TIER).length;
  showModal(
    `<div class="big">🌌</div>無限の次へ進む？<br><small>コイン・盤面・強化はリセット。<br>次元 +${gain}／収入 ×${fmt(Math.pow(2, S.shards + gain))}</small>`,
    [{ label: 'やめる' }, { label: '進む', primary: true, onClick: prestige }]
  );
});

document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => switchPanel(t.dataset.panel)));

$('resetBtn').addEventListener('click', () => {
  showModal('本当にすべてのデータを消去しますか？<br><small>元に戻せません。</small>', [
    { label: 'やめる' },
    {
      label: '消去', primary: true, onClick: () => {
        S = freshState();
        selected = -1;
        save();
        renderAll();
        switchPanel('play');
      },
    },
  ]);
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
    while (genAcc >= iv) { genAcc -= iv; spawn(1); }
  }
  if (S.up.autoMerge && !drag) {
    mergeAcc += dt;
    const iv = mergeInterval(S.up.autoMerge);
    while (mergeAcc >= iv) { mergeAcc -= iv; autoMergeStep(); }
  }

  // ドラッグ中は盤面を書き換えない
  if (dirty && !drag) {
    renderGrid();
    dirty = false;
  }
  renderHeader();
  renderAutos();
  if (currentPanel === 'shop') refreshShopButtons();

  saveAcc += dt;
  if (saveAcc > 5) { saveAcc = 0; save(); }
}

// オフライン報酬（自動生成があるときのみ）
function offlineReward() {
  const away = Math.min(OFFLINE_CAP_SEC, (Date.now() - (S.last || Date.now())) / 1000);
  if (away < 30 || !S.up.autoGen) return;
  const spawns = away / genInterval(S.up.autoGen);
  const perSpawn = spawnCoin() + sellPrice(S.up.baseTier) * 0.5;
  const coins = spawns * perSpawn;
  if (coins < 1) return;
  addCoins(coins);
  showModal(
    `<div class="big">🌙</div>留守の間（${fmtTime(away)}）に<br><b>🪙 ${fmt(Math.floor(coins))}</b> 稼いでいた！`,
    [{ label: '受け取る', primary: true }]
  );
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) save();
  else lastTick = performance.now();
});
window.addEventListener('pagehide', save);

// 盤面サイズと保存データの整合
if (S.board.length !== cellCount()) {
  const nb = new Array(cellCount()).fill(-1);
  S.board.slice(0, cellCount()).forEach((t, i) => (nb[i] = t));
  S.board = nb;
}

offlineReward();
renderAll();
setInterval(tick, 100);

'use strict';

// =====================================================
//  ガチャ：SP でスキンと背景を集める
//  排出率 COMMON 82% / RARE 15% / LEGEND 3%。30回で LEGEND 確定。
//  毎日1回無料。ダブりはブースト券（2倍速・生成ランク・跳躍）になる
// =====================================================

const Gacha = (() => {
  const COST1 = 100, COST10 = 900, PITY = 30, DAILY_SP = 10, PAGE = 60;
  const RATE_L = 0.03, RATE_R = 0.15, BG_SHARE = 0.15;
  const MAX_BOOST = 3;   // 1周に使える券の数
  const TICKETS = ['x2', 'rank', 'jump'];
  const T = {
    ja: {
      locked: '最初の ∞ を作ると、ガチャが解放されます。',
      lockedSub: '持っているスキンは今も着けられます。',
      sp: 'SP', pity: n => `LEGEND 確定まで あと <b>${n}</b> 回`,
      free: '無料で引く', freeNext: x => `次の無料まで ${x}`,
      one: '1回', ten: '10回', tenSub: 'RARE 以上 1つ確定',
      rates: `COMMON 82% ・ RARE 15% ・ LEGEND 3%<br>そのうち 85% がスキン、15% が背景。${PITY}回 LEGEND が出なければ次は LEGEND 確定。<br>ダブりはブースト券に変わる。SP は COIN では買えず、ランク到達・∞・ステージ勝利・ログインでたまる。`,
      noSp: 'SP が足りません', skin: 'SKIN', bg: 'BG',
      owned: (a, b) => `${a} / ${b} 所持`, more: 'もっと見る', equip: '着ける', using: '使用中',
      isNew: 'NEW', dup: k => `ダブり → ${k}`,
      ticket: { x2: '2倍速券', rank: 'ランク券', jump: '跳躍券' },
      ticketDesc: { x2: '10分間、ゲームが2倍速', rank: 'この周回だけ生成ランク +1', jump: '次の5回の合成が2段階アップ' },
      boost: 'BOOST', boostSub: `ガチャのダブりでもらえる券。1周に${MAX_BOOST}枚まで。週間チャレンジでは使えない。使って得した時間は、公平のため Ω タイムに足される。`,
      used: (u, x) => `この周回 ${u} / ${MAX_BOOST} 枚${x}`, x2Left: x => ` ・ 2倍速 残り ${x}`, jumpLeft: n => ` ・ 跳躍 残り ${n} 回`,
      boostFull: `この周回はもう ${MAX_BOOST} 枚使いました`, boostUsed: k => `${k} を使った`,
      tap: 'TAP', close: 'TAP で閉じる',
    },
    en: {
      locked: 'Make your first ∞ to open the Gacha.',
      lockedSub: 'You can still wear the skins you own.',
      sp: 'SP', pity: n => `LEGEND guaranteed in <b>${n}</b>`,
      free: 'Free pull', freeNext: x => `Next free in ${x}`,
      one: '×1', ten: '×10', tenSub: 'One RARE+ guaranteed',
      rates: `COMMON 82% · RARE 15% · LEGEND 3%<br>85% skins, 15% backgrounds. After ${PITY} pulls without a LEGEND, the next is a LEGEND.<br>Duplicates turn into Boost tickets. SP can’t be bought with coins; earn it from new ranks, ∞, stage wins and daily logins.`,
      noSp: 'Not enough SP', skin: 'SKIN', bg: 'BG',
      owned: (a, b) => `${a} / ${b} owned`, more: 'Show more', equip: 'Wear', using: 'In use',
      isNew: 'NEW', dup: k => `Duplicate → ${k}`,
      ticket: { x2: 'Speed ×2', rank: 'Rank +1', jump: 'Leap' },
      ticketDesc: { x2: 'The game runs ×2 for 10 min', rank: 'Base Rank +1 for this run', jump: 'Next 5 merges climb two ranks' },
      boost: 'BOOST', boostSub: `Tickets from gacha duplicates. Up to ${MAX_BOOST} per run. Not usable in the Weekly Challenge. Time they save is added to your Ω time to keep rankings fair.`,
      used: (u, x) => `This run ${u} / ${MAX_BOOST}${x}`, x2Left: x => ` · ×2 left ${x}`, jumpLeft: n => ` · ${n} leaps left`,
      boostFull: `You’ve used ${MAX_BOOST} tickets this run`, boostUsed: k => `Used ${k}`,
      tap: 'TAP', close: 'TAP to close',
    },
  };
  const t = () => T[OPT.lang] || T.ja;
  const ja = () => OPT.lang === 'ja';

  // ---------- 排出テーブル ----------
  const POOL = {
    skin: { C: Array.from({ length: GEN_COUNT }, (_, i) => genId(i)), R: RARE_SKINS, L: LEGEND_SKINS },
    bg: { C: BG_LIST.filter(b => b.r === 'C').map(b => b.id), R: BG_LIST.filter(b => b.r === 'R').map(b => b.id), L: BG_LIST.filter(b => b.r === 'L').map(b => b.id) },
  };
  const TOTAL = { skin: 1 + GEN_COUNT + RARE_SKINS.length + LEGEND_SKINS.length + 1, bg: BG_LIST.length };
  const pick = a => a[Math.floor(Math.random() * a.length)];

  function rollOne(minR) {
    PROFILE.pity++;
    PROFILE.pulls++;
    const x = Math.random();
    let r = x < RATE_L ? 'L' : x < RATE_L + RATE_R ? 'R' : 'C';
    if (PROFILE.pity >= PITY) r = 'L';
    if (minR === 'R' && r === 'C') r = 'R';
    if (r === 'L') PROFILE.pity = 0;
    const kind = Math.random() < BG_SHARE ? 'bg' : 'skin';
    const id = pick(POOL[kind][r]);
    const list = kind === 'bg' ? PROFILE.bgs : PROFILE.skins;
    const res = { kind, id, r, isNew: !list.includes(id), tickets: [] };
    if (res.isNew) list.push(id);
    else {
      // ダブり：ランダムな券（LEGEND は2枚）
      for (let i = 0; i < (r === 'L' ? 2 : 1); i++) {
        const k = pick(TICKETS);
        PROFILE.tickets[k] = (PROFILE.tickets[k] || 0) + 1;
        res.tickets.push(k);
      }
    }
    return res;
  }

  // ---------- 日付（端末の時計を戻しても増えない） ----------
  const dayNum = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 864e5);
  const freeReady = () => unlocked() && dayNum() > (PROFILE.dailyAt || 0);
  function untilTomorrow() {
    const now = new Date(), next = new Date(now);
    next.setHours(24, 0, 0, 0);
    const s = Math.max(0, Math.floor((next - now) / 1000));
    return `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}`;
  }
  function dailyLogin() {
    const d = dayNum();
    if (d <= (PROFILE.loginAt || 0)) return 0;
    PROFILE.loginAt = d;
    addBP(DAILY_SP);
    saveProfile();
    return DAILY_SP;
  }

  const unlocked = () => !!(PROFILE.everInf || (typeof S !== 'undefined' && S.shards > 0) || PROFILE.maxDim > 1);
  const badge = () => freeReady();

  function pull(n) {
    const l = t();
    const free = n === 0;
    if (!unlocked()) return;
    if (free) {
      if (!freeReady()) return;
      PROFILE.dailyAt = dayNum();
    } else {
      const cost = n === 10 ? COST10 : COST1;
      if (PROFILE.bp < cost) { sfx.deny(); toast(l.noSp); return; }
      PROFILE.bp -= cost;
    }
    const res = [];
    for (let i = 0; i < (free ? 1 : n); i++) res.push(rollOne());
    // 10連は RARE 以上を1つ確定
    if (n === 10 && !res.some(x => x.r !== 'C')) {
      const undo = res.pop();
      if (undo.isNew) { const list = undo.kind === 'bg' ? PROFILE.bgs : PROFILE.skins; list.splice(list.indexOf(undo.id), 1); }
      else undo.tickets.forEach(k => PROFILE.tickets[k]--);
      PROFILE.pity--; PROFILE.pulls--;
      res.push(rollOne('R'));
    }
    saveProfile();
    reveal(res).then(() => { render(); renderHeader(); if (window.Online) Online.syncSoon(); });
  }

  // ---------- 演出 ----------
  function artHTML(r, size) {
    if (r.kind === 'bg') return `<div class="bg-chip bg-${r.id}"></div>`;
    return `<div class="gart ${skinClass(r.id)}" style="width:${size}px;height:${size}px">${skinSVG(r.id, 6, size, 99)}</div>`;
  }
  const sparks = n => Array.from({ length: n }, (_, i) =>
    `<i class="spark" style="--x:${(Math.cos(i * 2.4) * 60).toFixed(0)}px;--y:${(Math.sin(i * 2.4) * 60).toFixed(0)}px;--d:${(i * 0.13).toFixed(2)}s"></i>`).join('');

  function cardHTML(r, i, big) {
    const l = t();
    const name = r.kind === 'bg' ? bgName(r.id, ja()) : skinName(r.id, ja());
    const tix = r.tickets.map(k => l.ticket[k]).join(' / ');
    const tag = r.isNew ? `<em class="g-new">${l.isNew}</em>` : `<em class="g-dup">${big ? l.dup(tix) : '→ ' + tix}</em>`;
    return `<div class="gcard r-${r.r} ${r.kind === 'bg' ? 'is-bg' : ''} ${r.r === 'L' ? 'lg-card lg-' + r.id : ''}" style="--i:${i}">
      ${r.r === 'L' ? `<div class="g-sparks">${sparks(10)}</div>` : ''}
      ${artHTML(r, big ? 96 : 44)}
      <small class="g-rar">${RARITY_NAME[r.r]}${r.kind === 'bg' ? ' · BG' : ''}</small>
      <b class="g-name">${name}</b>${tag}
    </div>`;
  }

  let revealing = false;
  function reveal(res) {
    return new Promise(done => {
      const box = document.getElementById('gfx'), stage = document.getElementById('gfxStage'), hint = document.getElementById('gfxHint');
      const best = res.some(x => x.r === 'L') ? 'L' : res.some(x => x.r === 'R') ? 'R' : 'C';
      const calm = document.body.classList.contains('calm');
      revealing = true;
      box.hidden = false;
      box.className = 'gfx best-' + best;
      hint.textContent = t().tap;
      stage.innerHTML = `<div class="gfx-orb">${Array.from({ length: 16 }, (_, i) => `<i style="--a:${i * 22.5}deg;--d:${(i % 4) * 0.05}s"></i>`).join('')}<b></b></div>`;
      let phase = 0, shownAt = 0;
      const cards = () => {
        phase = 1;
        shownAt = Date.now();
        box.classList.add('open');
        if (best === 'L') { sfx.omega(); vibe([20, 40, 20, 40, 80]); } else if (best === 'R') sfx.win(); else sfx.buy();
        stage.innerHTML = res.length === 1 ? `<div class="gfx-one">${cardHTML(res[0], 0, true)}</div>`
          : `<div class="gfx-grid">${res.map((r, i) => cardHTML(r, i)).join('')}</div>`;
        hint.textContent = t().close;
      };
      const timer = setTimeout(cards, calm ? 60 : best === 'L' ? 1500 : 1000);
      tone(330, 0.5, 0.03, 'sine');
      box.onclick = () => {
        if (phase === 0) { clearTimeout(timer); cards(); return; }
        if (!stage.classList.contains('all') && Date.now() - shownAt < 300 + res.length * 90) { stage.classList.add('all'); return; }
        stage.classList.remove('all');
        box.hidden = true;
        box.onclick = null;
        revealing = false;
        done();
      };
    });
  }

  // ---------- 画面 ----------
  let view = 'skin', shown = PAGE;
  function render() {
    const el = document.getElementById('sub-skin');
    if (!el) return;
    const l = t();
    const open = unlocked();
    const top = open ? `<div class="gacha">
        <div class="gacha-head"><div class="sp-now">${l.sp} <b>${fmt(PROFILE.bp)}</b></div><div class="pity">${l.pity(PITY - PROFILE.pity)}</div></div>
        <button class="gacha-free" data-g="0" ${freeReady() ? '' : 'disabled'}>${freeReady() ? l.free : l.freeNext(untilTomorrow())}</button>
        <div class="gacha-btns">
          <button data-g="1" ${PROFILE.bp < COST1 ? 'disabled' : ''}><b>${l.one}</b><span>${COST1} SP</span></button>
          <button data-g="10" ${PROFILE.bp < COST10 ? 'disabled' : ''}><b>${l.ten}</b><span>${COST10} SP</span><small>${l.tenSub}</small></button>
        </div>
        <p class="gacha-rates">${l.rates}</p>
      </div>` : `<div class="gacha locked"><p>${l.locked}</p><p class="dim">${l.lockedSub}</p></div>`;
    const ids = view === 'skin' ? PROFILE.skins : PROFILE.bgs;
    const rOrder = { S: 0, L: 1, R: 2, C: 3 };
    const rar = id => (view === 'skin' ? skinRarity(id) : bgRarity(id));
    const sorted = [...ids].sort((a, b) => rOrder[rar(a)] - rOrder[rar(b)] || (a < b ? -1 : 1));
    const cur = view === 'skin' ? PROFILE.skin : PROFILE.bg;
    const grid = sorted.slice(0, shown).map(id => {
      const r = rar(id);
      const art = view === 'skin' ? `<div class="gart ${skinClass(id)}">${skinSVG(id, 6, 40, 99)}</div>` : `<div class="bg-chip bg-${id}"></div>`;
      return `<button class="coll r-${r} ${id === cur ? 'on' : ''}" data-equip="${id}">${art}<b>${view === 'skin' ? skinName(id, ja()) : bgName(id, ja())}</b><small>${id === cur ? l.using : RARITY_NAME[r]}</small></button>`;
    }).join('');
    el.innerHTML = `${top}
      <div class="coll-head"><div class="seg"><button data-view="skin" class="${view === 'skin' ? 'on' : ''}">${l.skin}</button><button data-view="bg" class="${view === 'bg' ? 'on' : ''}">${l.bg}</button></div>
        <span>${l.owned(ids.length, TOTAL[view])}</span></div>
      <div class="coll-grid">${grid}</div>
      ${sorted.length > shown ? `<button class="opt-btn coll-more" data-more>${l.more}</button>` : ''}`;
  }

  function applyBg() {
    const f = document.getElementById('field');
    if (!f) return;
    [...f.classList].filter(c => c.startsWith('bg-')).forEach(c => f.classList.remove(c));
    f.classList.add('bg-' + PROFILE.bg);
  }

  document.addEventListener('click', e => {
    const box = e.target.closest('#sub-skin');
    if (!box || revealing) return;
    const g = e.target.closest('[data-g]');
    if (g) { pull(Number(g.dataset.g)); return; }
    const v = e.target.closest('[data-view]');
    if (v) { view = v.dataset.view; shown = PAGE; render(); return; }
    if (e.target.closest('[data-more]')) { shown += PAGE; render(); return; }
    const q = e.target.closest('[data-equip]');
    if (q) {
      const id = q.dataset.equip;
      if (view === 'skin') { if (!PROFILE.skins.includes(id)) return; PROFILE.skin = id; }
      else { if (!PROFILE.bgs.includes(id)) return; PROFILE.bg = id; applyBg(); }
      saveProfile();
      sfx.buy();
      render();
      renderAll();
      if (window.Online) Online.syncSoon();
    }
  });

  // ---------- ブースト券（∞ タブ） ----------
  function renderBoost() {
    const el = document.getElementById('boostWrap');
    if (!el) return;
    const has = TICKETS.some(k => PROFILE.tickets[k] > 0) || S.boost.used > 0;
    if (!has || MODE) { el.innerHTML = ''; return; }
    const l = t();
    const full = S.boost.used >= MAX_BOOST;
    const extra = (S.boost.x2 > 0 ? l.x2Left(fmtTime(Math.ceil(S.boost.x2))) : '') + (S.boost.jump > 0 ? l.jumpLeft(S.boost.jump) : '');
    el.innerHTML = `<h3>${l.boost}</h3><p class="sec-sub">${l.boostSub}</p>
      <div class="boost-row">${TICKETS.map(k => `<button class="boost" data-boost="${k}" ${full || !PROFILE.tickets[k] ? 'disabled' : ''}>
        <b>${l.ticket[k]}</b><small>${l.ticketDesc[k]}</small><span>× ${PROFILE.tickets[k] || 0}</span></button>`).join('')}</div>
      <p class="boost-note">${l.used(S.boost.used, extra)}</p>`;
  }
  function useBoost(k) {
    const l = t();
    if (MODE || !TICKETS.includes(k) || !(PROFILE.tickets[k] > 0)) { sfx.deny(); return; }
    if (S.boost.used >= MAX_BOOST) { sfx.deny(); toast(l.boostFull); return; }
    PROFILE.tickets[k]--;
    S.boost.used++;
    if (k === 'x2') S.boost.x2 += 600;
    if (k === 'rank') S.boost.rank++;
    if (k === 'jump') S.boost.jump += 5;
    saveProfile();
    save();
    sfx.buy();
    toast(l.boostUsed(l.ticket[k]));
    renderInf();
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('#boostWrap [data-boost]');
    if (b) useBoost(b.dataset.boost);
  });

  function onStart() {
    applyBg();
    if (unlocked()) showTip('gacha');
  }

  return { render, badge, onStart, renderBoost, dailyLogin, freeReady, applyBg, unlocked, _roll: rollOne, _pull: pull, COST1, COST10, PITY };
})();

window.Gacha = Gacha;

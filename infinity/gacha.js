'use strict';

// =====================================================
//  ガチャ（GACHA タブ）：SP でスキンと背景を集める
//  排出率 COMMON 82% / RARE 15% / LEGEND 3%。30回で LEGEND 確定。10連は RARE 以上1つ確定
//  今週のピックアップ：LEGEND スキンが出たら 50% でピックアップ。外れたら次の LEGEND スキンは必ずピックアップ
//  毎日1回無料。ダブりはブースト券（2倍速・生成ランク・跳躍）になる
// =====================================================

const Gacha = (() => {
  const COST1 = 100, COST10 = 900, PITY = 30, DAILY_SP = 10, PAGE = 60, LOG_MAX = 50;
  const RATE_L = 0.03, RATE_R = 0.15, BG_SHARE = 0.15, PICK_RATE = 0.5;
  const MAX_BOOST = 3;   // 1周に使える券の数（以前のダブりでもらった券）
  const DUP_SOUL = { C: 2, R: 5, L: 15, S: 15 };   // ダブりは魂に（永遠強化に使える）
  const TICKETS = ['x2', 'rank', 'jump'];
  const RANKS_PREVIEW = [1, 5, 10, 15, 99];   // 99 = ∞
  const T = {
    ja: {
      sub: 'スキンと背景を集める',
      locked: '最初の ∞ を作ると、ガチャが解放されます。',
      lockedSub: 'SP は今のうちから貯まっている。ここに並んでいるのは、手に入るスキンのほんの一部。',
      sp: 'SP', pity: n => `LEGEND 確定まで あと <b>${n}</b> 回`,
      pickTitle: '今週のピックアップ', pickLeft: x => `残り ${x}`,
      pickText: `LEGEND スキンが出たとき ${PICK_RATE * 100}% でこのスキン。外れたら、次の LEGEND スキンは必ずこれ。`,
      pickGuard: '次の LEGEND スキンはピックアップ確定',
      free: '無料で引く', freeNext: x => `次の無料まで ${x}`,
      one: '1回', ten: '10回', tenSub: 'RARE 以上 1つ確定',
      noSp: 'SP が足りません', skin: 'SKIN', bg: 'BG',
      tabs: { coll: '図鑑', rates: '排出率', log: '履歴' },
      all: 'ALL', showMissing: '未所持も表示', more: 'もっと見る', equip: '着ける', using: '使用中', close: '閉じる',
      missing: '未所持', ownedNow: '所持', special: 'Ω クリアでもらえる',
      comp: (a, b) => `${a} / ${b}`,
      isNew: 'NEW', dup: n => `ダブり → 魂 +${n}`, inWeekly: '週間チャレンジ中はガチャを引けない', spDim: (a, b) => `この次元のプレイ SP ${a} / ${b}`,
      ticket: { x2: '2倍速券', rank: 'ランク券', jump: '跳躍券' },
      ticketDesc: { x2: '10分間、ゲームが2倍速', rank: 'この周回だけ生成ランク +1', jump: '次の5回の合成が2段階アップ' },
      ticketsNote: '券は UPGRADE → ∞ ETERNAL で使う',
      rateHead: ['レア度', '確率', '種類', '1種あたり'],
      rateNotes: [
        `スキンと背景の割合は 85% : 15%。`,
        `${PITY}回 LEGEND が出なければ、次は LEGEND 確定（出た時点でカウントはリセット）。`,
        `10連は RARE 以上が必ず1つ入る。`,
        `ダブりは魂になる（COMMON +${DUP_SOUL.C} ／ RARE +${DUP_SOUL.R} ／ LEGEND +${DUP_SOUL.L}）。魂は永遠強化に使える。`,
        `プレイで得る SP（ランク・∞・ステージ・対戦）は1次元あたり 900（10連分）まで。ログインと週間ランキングの報酬は別。`,
        `SP の入手：周回ごとに初めて届いたランク（2⁶以上）+1 ／ ∞ +30 ／ ステージ勝利 ／ オンライン対戦 勝ち+10・負け+2 ／ ログイン +10 ／ 週間ランキング 最大 +500`,
        `SP は COIN では買えず、課金もない。`,
      ],
      logEmpty: 'まだ引いていない', logStats: (n, l) => `合計 ${n} 回 ・ LEGEND ${l} 回`,
      boost: 'BOOST', boostSub: `ガチャのダブりでもらえる券。1周に${MAX_BOOST}枚まで。週間チャレンジでは使えない。使って得した時間は、公平のため Ω タイムに足される。`,
      used: (u, x) => `この周回 ${u} / ${MAX_BOOST} 枚${x}`, x2Left: x => ` ・ 2倍速 残り ${x}`, jumpLeft: n => ` ・ 跳躍 残り ${n} 回`,
      boostFull: `この周回はもう ${MAX_BOOST} 枚使いました`, boostUsed: k => `${k} を使った`,
      tap: 'TAP', tapClose: 'TAP で閉じる', days: (d, h) => (d ? `${d}日 ${h}時間` : `${h}時間`),
    },
    en: {
      sub: 'Collect skins and backgrounds',
      locked: 'Make your first ∞ to open the Gacha.',
      lockedSub: 'Your SP is already piling up. These are just a few of the skins waiting inside.',
      sp: 'SP', pity: n => `LEGEND guaranteed in <b>${n}</b>`,
      pickTitle: 'This week’s pick-up', pickLeft: x => `${x} left`,
      pickText: `When a LEGEND skin drops, it’s this one ${PICK_RATE * 100}% of the time. Miss, and the next LEGEND skin is guaranteed to be it.`,
      pickGuard: 'Next LEGEND skin is the pick-up',
      free: 'Free pull', freeNext: x => `Next free in ${x}`,
      one: '×1', ten: '×10', tenSub: 'One RARE+ guaranteed',
      noSp: 'Not enough SP', skin: 'SKIN', bg: 'BG',
      tabs: { coll: 'Collection', rates: 'Rates', log: 'History' },
      all: 'ALL', showMissing: 'Show missing', more: 'Show more', equip: 'Wear', using: 'In use', close: 'Close',
      missing: 'Not owned', ownedNow: 'Owned', special: 'Reward for clearing Ω',
      comp: (a, b) => `${a} / ${b}`,
      isNew: 'NEW', dup: n => `Duplicate → Souls +${n}`, inWeekly: 'No gacha during the Weekly Challenge', spDim: (a, b) => `SP from play this dimension ${a} / ${b}`,
      ticket: { x2: 'Speed ×2', rank: 'Rank +1', jump: 'Leap' },
      ticketDesc: { x2: 'The game runs ×2 for 10 min', rank: 'Base Rank +1 for this run', jump: 'Next 5 merges climb two ranks' },
      ticketsNote: 'Use tickets in UPGRADE → ∞ ETERNAL',
      rateHead: ['Rarity', 'Chance', 'Items', 'Each'],
      rateNotes: [
        'Skins and backgrounds split 85% : 15%.',
        `After ${PITY} pulls without a LEGEND, the next is a LEGEND (the count resets whenever one drops).`,
        '×10 always includes at least one RARE or better.',
        `Duplicates turn into Souls (COMMON +${DUP_SOUL.C} / RARE +${DUP_SOUL.R} / LEGEND +${DUP_SOUL.L}) for Eternal upgrades.`,
        'SP from play (ranks, ∞, stages, battles) is capped at 900 (one ×10) per dimension. Login and weekly rewards are separate.',
        'Earning SP: each new rank per run (2⁶+) +1 / ∞ +30 / stage wins / online wins +10, losses +2 / daily login +10 / weekly ranking up to +500',
        'SP can’t be bought with coins, and there is no paid currency.',
      ],
      logEmpty: 'No pulls yet', logStats: (n, l) => `${n} pulls · ${l} LEGEND`,
      boost: 'BOOST', boostSub: `Tickets from gacha duplicates. Up to ${MAX_BOOST} per run. Not usable in the Weekly Challenge. Time they save is added to your Ω time to keep rankings fair.`,
      used: (u, x) => `This run ${u} / ${MAX_BOOST}${x}`, x2Left: x => ` · ×2 left ${x}`, jumpLeft: n => ` · ${n} leaps left`,
      boostFull: `You’ve used ${MAX_BOOST} tickets this run`, boostUsed: k => `Used ${k}`,
      tap: 'TAP', tapClose: 'TAP to close', days: (d, h) => (d ? `${d}d ${h}h` : `${h}h`),
    },
  };
  const t = () => T[OPT.lang] || T.ja;
  const ja = () => OPT.lang === 'ja';

  // ---------- 排出テーブル ----------
  const POOL = {
    skin: { C: Array.from({ length: GEN_COUNT }, (_, i) => genId(i)), R: RARE_SKINS, L: LEGEND_SKINS },
    bg: { C: BG_LIST.filter(b => b.r === 'C').map(b => b.id), R: BG_LIST.filter(b => b.r === 'R').map(b => b.id), L: BG_LIST.filter(b => b.r === 'L').map(b => b.id) },
  };
  const ALL_SKINS = { S: ['SUMI'], L: LEGEND_SKINS, R: RARE_SKINS, C: ['CIRCLE', ...POOL.skin.C] };
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const weekKey = () => (window.Weekly ? Weekly.key() : Math.floor((Date.now() + 9 * 3600e3 - 4 * 864e5) / (7 * 864e5)));
  const pickup = () => LEGEND_SKINS[weekKey() % LEGEND_SKINS.length];

  function rollOne(minR) {
    PROFILE.pity++;
    PROFILE.pulls++;
    const x = Math.random();
    let r = x < RATE_L ? 'L' : x < RATE_L + RATE_R ? 'R' : 'C';
    if (PROFILE.pity >= PITY) r = 'L';
    if (minR === 'R' && r === 'C') r = 'R';
    if (r === 'L') { PROFILE.pity = 0; PROFILE.lgCount = (PROFILE.lgCount || 0) + 1; }
    const kind = Math.random() < BG_SHARE ? 'bg' : 'skin';
    let id = pick(POOL[kind][r]);
    // ピックアップ：LEGEND スキンは 50%、外れたら次は確定
    if (kind === 'skin' && r === 'L') {
      const pu = pickup();
      if (PROFILE.pickGuard || Math.random() < PICK_RATE) { id = pu; PROFILE.pickGuard = false; }
      else { id = pick(LEGEND_SKINS.filter(s => s !== pu)); PROFILE.pickGuard = true; }
    }
    const list = kind === 'bg' ? PROFILE.bgs : PROFILE.skins;
    const res = { kind, id, r, isNew: !list.includes(id), tickets: [] };
    if (res.isNew) list.push(id);
    else { res.souls = DUP_SOUL[r]; S.soul += res.souls; }
    PROFILE.gachaLog.unshift({ id, k: kind, r, n: res.isNew ? 1 : 0, at: Date.now() });
    if (PROFILE.gachaLog.length > LOG_MAX) PROFILE.gachaLog.length = LOG_MAX;
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
  function weekLeft() {
    const WEEK = 7 * 864e5, end = (weekKey() + 1) * WEEK + 4 * 864e5 - 9 * 3600e3, s = Math.max(0, end - Date.now());
    return t().days(Math.floor(s / 864e5), Math.floor(s / 3600e3) % 24);
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
    if (!unlocked() || revealing) return;
    if (MODE) { sfx.deny(); toast(l.inWeekly); return; }
    if (free) {
      if (!freeReady()) return;
      PROFILE.dailyAt = dayNum();
    } else {
      const cost = n === 10 ? COST10 : COST1;
      if (PROFILE.bp < cost) { sfx.deny(); toast(l.noSp); return; }
      PROFILE.bp -= cost;
    }
    const res = [];
    const count = free ? 1 : n;
    for (let i = 0; i < count; i++) {
      // 10連の最後の1回は、まだ RARE 以上が無ければ RARE 以上
      const last = n === 10 && i === count - 1 && !res.some(x => x.r !== 'C');
      res.push(rollOne(last ? 'R' : undefined));
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
  const nameOf = (kind, id) => (kind === 'bg' ? bgName(id, ja()) : skinName(id, ja()));

  function cardHTML(r, i, big) {
    const l = t();
    const tag = r.isNew ? `<em class="g-new">${l.isNew}</em>` : `<em class="g-dup">${big ? l.dup(r.souls) : '→ ◇ +' + r.souls}</em>`;
    const pu = r.kind === 'skin' && r.id === pickup() ? ' · PICK UP' : '';
    return `<div class="gcard r-${r.r} ${r.kind === 'bg' ? 'is-bg' : ''} ${r.r === 'L' ? 'lg-card lg-' + r.id : ''}" style="--i:${i}">
      ${r.r === 'L' ? `<div class="g-sparks">${sparks(10)}</div>` : ''}
      ${artHTML(r, big ? 96 : 44)}
      <small class="g-rar">${RARITY_NAME[r.r]}${r.kind === 'bg' ? ' · BG' : ''}${pu}</small>
      <b class="g-name">${nameOf(r.kind, r.id)}</b>${tag}
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
        hint.textContent = t().tapClose;
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
  let tab = 'coll', kindView = 'skin', rarView = 'ALL', showMissing = false, shown = PAGE;
  const owned = (kind, id) => (kind === 'bg' ? PROFILE.bgs : PROFILE.skins).includes(id);
  const rarOf = (kind, id) => (kind === 'bg' ? bgRarity(id) : skinRarity(id));

  function bannerHTML() {
    const l = t(), pu = pickup();
    return `<div class="g-banner lg-${pu}">
      <div class="g-bn-text">
        <small>${l.pickTitle} · ${l.pickLeft(weekLeft())}</small>
        <b>${skinName(pu, ja())}</b>
        <em>LEGEND · ${owned('skin', pu) ? l.ownedNow : l.missing}</em>
        <p>${l.pickText}</p>
        ${PROFILE.pickGuard ? `<p class="g-guard">★ ${l.pickGuard}</p>` : ''}
      </div>
      <div class="g-bn-art legend lg-${pu}" id="gBannerArt">${skinSVG(pu, 99, 96, 99)}</div>
    </div>`;
  }

  function collHTML() {
    const l = t();
    const sum = kindView === 'skin'
      ? ['S', 'L', 'R', 'C'].map(r => [r, ALL_SKINS[r]])
      : ['L', 'R', 'C'].map(r => [r, BG_LIST.filter(b => b.r === r).map(b => b.id)]);
    const summary = `<div class="g-comp">${sum.map(([r, ids]) => {
      const have = ids.filter(id => owned(kindView, id)).length;
      return `<div class="g-comp-row r-${r}"><span>${RARITY_NAME[r]}</span><i><b style="width:${(have / ids.length * 100).toFixed(1)}%"></b></i><em>${l.comp(have, ids.length)}</em></div>`;
    }).join('')}</div>`;
    let ids = sum.filter(([r]) => rarView === 'ALL' || r === rarView).flatMap(([, x]) => x);
    if (!showMissing) ids = ids.filter(id => owned(kindView, id));
    const cur = kindView === 'skin' ? PROFILE.skin : PROFILE.bg;
    const grid = ids.slice(0, shown).map(id => {
      const r = rarOf(kindView, id), has = owned(kindView, id);
      const art = kindView === 'skin' ? `<div class="gart ${has ? skinClass(id) : ''}">${skinSVG(id, 6, 40, 99)}</div>` : `<div class="bg-chip bg-${id}"></div>`;
      return `<button class="coll r-${r} ${id === cur ? 'on' : ''} ${has ? '' : 'miss'}" data-item="${id}">${art}<b>${has ? nameOf(kindView, id) : '???'}</b><small>${id === cur ? l.using : RARITY_NAME[r]}</small></button>`;
    }).join('');
    const chips = ['ALL', 'L', 'R', 'C'].map(r => `<button data-rar="${r}" class="${rarView === r ? 'on' : ''}">${r === 'ALL' ? l.all : RARITY_NAME[r]}</button>`).join('');
    return `<div class="coll-head">
        <div class="seg"><button data-kind="skin" class="${kindView === 'skin' ? 'on' : ''}">${l.skin}</button><button data-kind="bg" class="${kindView === 'bg' ? 'on' : ''}">${l.bg}</button></div>
        <label class="g-miss"><input type="checkbox" data-missing ${showMissing ? 'checked' : ''}> ${l.showMissing}</label>
      </div>
      ${summary}
      <div class="g-chips">${chips}</div>
      <div class="coll-grid">${grid}</div>
      ${ids.length > shown ? `<button class="opt-btn coll-more" data-more>${l.more}</button>` : ''}`;
  }

  function ratesHTML() {
    const l = t();
    const pct = v => (v >= 1 ? v.toFixed(1) : v >= 0.01 ? v.toFixed(3) : v.toFixed(4)) + '%';
    const rows = [['L', RATE_L], ['R', RATE_R], ['C', 1 - RATE_L - RATE_R]].flatMap(([r, p]) => {
      const out = [];
      const sk = POOL.skin[r].length, bg = POOL.bg[r].length;
      out.push(`<tr class="r-${r} head"><td>${RARITY_NAME[r]}</td><td>${pct(p * 100)}</td><td>${sk + bg}</td><td></td></tr>`);
      if (r === 'L') {
        out.push(`<tr><td>└ ${skinName(pickup(), ja())} (PICK UP)</td><td>${pct(p * (1 - BG_SHARE) * PICK_RATE * 100)}</td><td>1</td><td>${pct(p * (1 - BG_SHARE) * PICK_RATE * 100)}</td></tr>`);
        out.push(`<tr><td>└ ${l.skin}</td><td>${pct(p * (1 - BG_SHARE) * (1 - PICK_RATE) * 100)}</td><td>${sk - 1}</td><td>${pct(p * (1 - BG_SHARE) * (1 - PICK_RATE) / (sk - 1) * 100)}</td></tr>`);
      } else {
        out.push(`<tr><td>└ ${l.skin}</td><td>${pct(p * (1 - BG_SHARE) * 100)}</td><td>${sk}</td><td>${pct(p * (1 - BG_SHARE) / sk * 100)}</td></tr>`);
      }
      out.push(`<tr><td>└ ${l.bg}</td><td>${pct(p * BG_SHARE * 100)}</td><td>${bg}</td><td>${pct(p * BG_SHARE / bg * 100)}</td></tr>`);
      return out;
    }).join('');
    return `<table class="g-rates"><thead><tr>${l.rateHead.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>
      <ul class="g-notes">${l.rateNotes.map(x => `<li>${x}</li>`).join('')}</ul>`;
  }

  function logHTML() {
    const l = t(), log = PROFILE.gachaLog || [];
    if (!log.length) return `<p class="dim-text">${l.logEmpty}</p>`;
    const fmtD = at => new Date(at).toLocaleString(ja() ? 'ja-JP' : 'en-US', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    return `<p class="g-logstat">${l.logStats(PROFILE.pulls || 0, PROFILE.lgCount || 0)}</p>
      <div class="g-log">${log.map(e => `<div class="g-log-row r-${e.r}">
        <span class="g-log-art ${e.k === 'skin' ? skinClass(e.id) : ''}">${e.k === 'skin' ? skinSVG(e.id, 6, 24, 99) : `<i class="bg-chip bg-${e.id}"></i>`}</span>
        <span class="g-log-name">${nameOf(e.k, e.id)}${e.n ? ` <em class="g-new">${l.isNew}</em>` : ''}</span>
        <span class="g-log-r">${RARITY_NAME[e.r]}</span><span class="g-log-at">${fmtD(e.at)}</span></div>`).join('')}</div>`;
  }

  function lockedHTML() {
    const l = t();
    const teaser = [...LEGEND_SKINS.slice(0, 3), 'MOON', 'CLOCK', 'G042', 'G333', 'G517', 'G700'];
    return `<div class="gacha locked"><p>${l.locked}</p><p class="dim">${l.lockedSub}</p>
      <div class="g-teaser">${teaser.map(id => `<span class="gart ${skinClass(id)}">${skinSVG(id, 12, 40, 99)}</span>`).join('')}</div>
      <div class="sp-now">${l.sp} <b>${fmt(PROFILE.bp)}</b></div></div>`;
  }

  function render() {
    const el = document.getElementById('gachaRoot');
    if (!el) return;
    const l = t();
    const head = `<h2>GACHA</h2><p class="h-sub">${l.sub}</p>`;
    if (!unlocked()) { el.innerHTML = head + lockedHTML(); return; }
    const room = typeof spRoom === 'function' ? spRoom() : 0;
    const tix = `<span>${l.spDim(fmt(SP_DIM_CAP - room), fmt(SP_DIM_CAP))}</span>` +
      (TICKETS.some(k => PROFILE.tickets[k] > 0) ? TICKETS.map(k => `<span>${l.ticket[k]} <b>${PROFILE.tickets[k] || 0}</b></span>`).join('') : '');
    const left = PITY - PROFILE.pity;
    el.innerHTML = `${head}
      <div class="g-top"><div class="sp-now">${l.sp} <b>${fmt(PROFILE.bp)}</b></div><div class="g-tix" title="${l.ticketsNote}">${tix}</div></div>
      ${bannerHTML()}
      <div class="g-pity"><i><b style="width:${(PROFILE.pity / PITY * 100).toFixed(1)}%"></b></i><span>${l.pity(left)}</span></div>
      <button class="gacha-free" data-g="0" ${freeReady() ? '' : 'disabled'}>${freeReady() ? l.free : l.freeNext(untilTomorrow())}</button>
      <div class="gacha-btns">
        <button data-g="1" ${PROFILE.bp < COST1 ? 'disabled' : ''}><b>${l.one}</b><span>${COST1} SP</span></button>
        <button data-g="10" ${PROFILE.bp < COST10 ? 'disabled' : ''}><b>${l.ten}</b><span>${COST10} SP</span><small>${l.tenSub}</small></button>
      </div>
      <div class="seg wide g-tabs no-swipe">${Object.entries(l.tabs).map(([k, v]) => `<button data-gtab="${k}" class="${tab === k ? 'on' : ''}">${v}</button>`).join('')}</div>
      <div class="g-body">${tab === 'coll' ? collHTML() : tab === 'rates' ? ratesHTML() : logHTML()}</div>`;
  }

  // バナーの絵：ランクを順に見せる（GACHA タブを開いている間だけ）
  let bannerStep = 0;
  setInterval(() => {
    if (typeof currentPanel === 'undefined' || currentPanel !== 'gacha' || sleeping || document.hidden || document.body.classList.contains('calm')) return;
    const art = document.getElementById('gBannerArt');
    if (!art) return;
    bannerStep = (bannerStep + 1) % RANKS_PREVIEW.length;
    art.innerHTML = skinSVG(pickup(), RANKS_PREVIEW[bannerStep], 96, 99);
  }, 1400);

  // 詳細（タップで開く）：いろいろなランクでの見た目・着ける
  function detail(id) {
    const l = t(), kind = kindView, has = owned(kind, id), r = rarOf(kind, id);
    const big = kind === 'skin' ? `<div class="g-detail-art ${has ? skinClass(id) : ''}">${skinSVG(id, 10, 110, 99)}</div>`
      : `<div class="bg-chip big bg-${id}"></div>`;
    const ranks = kind === 'skin' ? `<div class="g-detail-ranks">${RANKS_PREVIEW.map(tt => `<span class="${has ? skinClass(id) : ''}">${skinSVG(id, tt, 40, 99)}<small>${tt >= 99 ? '∞' : pow2(tt)}</small></span>`).join('')}</div>` : '';
    const note = id === 'SUMI' ? `<p class="dim-text small">${l.special}</p>` : '';
    const cur = kind === 'skin' ? PROFILE.skin : PROFILE.bg;
    showModal({
      title: has ? nameOf(kind, id) : '???',
      html: `<div class="g-detail r-${r}"><small class="g-rar">${RARITY_NAME[r]}${kind === 'bg' ? ' · BG' : ''}${id === pickup() ? ' · PICK UP' : ''}</small>${big}${ranks}<p class="g-detail-own">${has ? l.ownedNow : l.missing}</p>${note}</div>`,
      buttons: has && id !== cur ? [{ label: l.equip, primary: true, onClick: () => equip(kind, id) }, { label: l.close }]
        : [{ label: has ? l.using : l.close, primary: true }],
    });
  }
  function equip(kind, id) {
    if (!owned(kind, id)) return;
    if (kind === 'skin') PROFILE.skin = id; else { PROFILE.bg = id; applyBg(); }
    saveProfile();
    sfx.buy();
    renderAll();
    render();
    if (window.Online) Online.syncSoon();
  }

  function applyBg() {
    const f = document.getElementById('field');
    if (!f) return;
    [...f.classList].filter(c => c.startsWith('bg-')).forEach(c => f.classList.remove(c));
    f.classList.add('bg-' + PROFILE.bg);
  }

  document.addEventListener('click', e => {
    if (!e.target.closest('#gachaRoot') || revealing) return;
    const g = e.target.closest('[data-g]');
    if (g) { pull(Number(g.dataset.g)); return; }
    const gt = e.target.closest('[data-gtab]');
    if (gt) { tab = gt.dataset.gtab; render(); return; }
    const k = e.target.closest('[data-kind]');
    if (k) { kindView = k.dataset.kind; rarView = 'ALL'; shown = PAGE; render(); return; }
    const r = e.target.closest('[data-rar]');
    if (r) { rarView = r.dataset.rar; shown = PAGE; render(); return; }
    if (e.target.closest('[data-more]')) { shown += PAGE; render(); return; }
    const it = e.target.closest('[data-item]');
    if (it) detail(it.dataset.item);
  });
  document.addEventListener('change', e => {
    if (e.target.matches('#gachaRoot [data-missing]')) { showMissing = e.target.checked; shown = PAGE; render(); }
  });

  // ---------- ブースト券（UPGRADE → ∞ ETERNAL） ----------
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

  return { render, badge, onStart, renderBoost, dailyLogin, freeReady, applyBg, unlocked, pickup, _roll: rollOne, _pull: pull, COST1, COST10, PITY };
})();

window.Gacha = Gacha;

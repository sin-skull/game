'use strict';

// =====================================================
//  起動画面：アイコン → クレジット → 注意事項 → スロット選択 → 留守の間に
//  どれもタップで飛ばせる。省エネ（画面オフ）もここで扱う。
//  ※ game.js より先に読み込むので、ゲームの関数は実行時にだけ使う
// =====================================================

const Boot = (() => {
  const NOTICE_VER = '1';
  const T = {
    ja: {
      credit: 'A GAME BY',
      noticeTitle: 'NOTICE',
      notice: [
        'このゲームは個人が制作した非公式の作品です。',
        'セーブデータは端末のブラウザに保存されます。ブラウザの履歴やサイトデータを消すと、データも消えます。iPhone の Safari では、7日間ひらかないと消えることがあります。',
        '大切なデータは、ログインしてクラウドに保存するか、MENU → OPTION の「書き出し」で控えておいてください。',
        'ランキングの記録は、不正と判断した場合に削除することがあります。',
        'ガチャで使う SP はゲーム内でのみ手に入り、現金では購入できません。',
        '長時間のプレイは、適度に休憩をとってください。',
        '予告なく内容を変更・終了することがあります。',
      ],
      agree: 'OK',
      slotTitle: 'SELECT SLOT', empty: 'NEW GAME', cont: n => `このままスロット ${n} から始まる（変えるときはタップ）`,
      slotInfo: (d, r, t) => `次元 ${d} ・ ${r} ・ ${t}`,
      lastPlayed: x => `最終プレイ ${x}`,
      awayTitle: 'WHILE YOU WERE AWAY', bonusTitle: 'LOGIN BONUS',
      away: (t, c) => `${t} のあいだに<br><b>+${c} COIN</b>`,
      daily: n => `今日のログインボーナス <b>+${n} SP</b>`,
      freePull: '今日の無料ガチャが引けます（GACHA タブ）',
      tap: 'TAP', wake: 'TAP TO WAKE',
    },
    en: {
      credit: 'A GAME BY',
      noticeTitle: 'NOTICE',
      notice: [
        'This is an unofficial game made by an individual.',
        'Your save lives in this browser. Clearing history or site data deletes it. Safari on iPhone may delete it after 7 days without a visit.',
        'To keep it safe, log in to save to the cloud, or export a code from MENU → OPTION.',
        'Ranking records may be removed if they look fraudulent.',
        'SP for the gacha is earned in the game only and cannot be bought with money.',
        'Please take breaks during long sessions.',
        'The game may change or end without notice.',
      ],
      agree: 'OK',
      slotTitle: 'SELECT SLOT', empty: 'NEW GAME', cont: n => `Starting slot ${n} (tap a slot to change)`,
      slotInfo: (d, r, t) => `Dim ${d} · ${r} · ${t}`,
      lastPlayed: x => `Last played ${x}`,
      awayTitle: 'WHILE YOU WERE AWAY', bonusTitle: 'LOGIN BONUS',
      away: (t, c) => `In ${t}<br><b>+${c} COIN</b>`,
      daily: n => `Daily login bonus <b>+${n} SP</b>`,
      freePull: 'Your free pull is ready (GACHA tab)',
      tap: 'TAP', wake: 'TAP TO WAKE',
    },
  };
  const t = () => T[(typeof OPT !== 'undefined' && OPT.lang) || 'ja'] || T.ja;
  const ICON = `<svg viewBox="0 0 512 512" width="120" height="120" aria-hidden="true">
    <circle cx="176" cy="256" r="100" fill="#fff"/>
    <circle cx="336" cy="256" r="94" fill="none" stroke="#fff" stroke-width="12"/>
    <circle cx="336" cy="256" r="126" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="3" stroke-dasharray="4 12"/></svg>`;

  let root, stage, skipHint, advance = null, needOk = false;

  // 1枚表示して、タップ（または時間）で次へ
  function show(html, { auto = 0, ok = false, cls = '' } = {}) {
    return new Promise(resolve => {
      stage.className = 'boot-stage ' + cls;
      stage.innerHTML = html;
      void stage.offsetWidth;
      stage.classList.add('in');
      needOk = ok;
      skipHint.hidden = ok;
      let timer = null;
      const done = () => {
        if (timer) clearTimeout(timer);
        advance = null;
        stage.classList.remove('in');
        stage.classList.add('out');
        setTimeout(resolve, 260);
      };
      advance = done;
      if (auto) timer = setTimeout(done, auto);
      const okBtn = stage.querySelector('[data-ok]');
      if (okBtn) okBtn.onclick = e => { e.stopPropagation(); done(); };
    });
  }

  function slotHTML() {
    const l = t();
    const cards = [0, 1, 2].map(i => {
      const s = readSlot(i);
      const has = s && (s.stats.spawned || s.shards);
      const skin = has ? skinSVG(PROFILE.skin, Math.min(12, s.stats.maxTier), 44, 99) : '';
      const date = has && s.last ? new Date(s.last).toLocaleDateString(OPT.lang === 'ja' ? 'ja-JP' : 'en-US', { month: 'short', day: 'numeric' }) : '';
      return `<button class="boot-slot ${i === OPT.slot ? 'on' : ''}" data-slot="${i}">
        <span class="bs-no">${String(i + 1).padStart(2, '0')}</span>
        <span class="bs-icon ${has ? skinClass(PROFILE.skin) : ''}">${has ? skin : '<i class="bs-empty"></i>'}</span>
        <span class="bs-body">${has
          ? `<b>${l.slotInfo(dimStr(s), s.clearTime ? 'Ω' : pow2(s.stats.maxTier), fmtTime(s.stats.playTime))}</b><small>${l.lastPlayed(date)}</small>`
          : `<b>${l.empty}</b>`}</span>
      </button>`;
    }).join('');
    return `<div class="boot-title">${l.slotTitle}</div><div class="boot-slots">${cards}</div>`;
  }

  // 前回のスロットで自動的に始める。変えたいときだけカードをタップ
  function pickSlot() {
    return new Promise(resolve => {
      const l = t();
      stage.className = 'boot-stage slots';
      stage.innerHTML = slotHTML() + `<p class="boot-cont">${l.cont(String(OPT.slot + 1).padStart(2, '0'))}</p>`;
      void stage.offsetWidth;
      stage.classList.add('in');
      skipHint.hidden = false;
      needOk = false;
      let timer = null;
      const go = i => {
        if (timer) clearTimeout(timer);
        advance = null;
        if (i !== OPT.slot) {
          OPT.slot = i;
          saveSettings();
          S = readSlot(i) || freshState();
          clearField();
        }
        tone(660, 0.08, 0.04);
        stage.classList.remove('in');
        stage.classList.add('out');
        setTimeout(resolve, 260);
      };
      advance = () => go(OPT.slot);
      timer = setTimeout(() => go(OPT.slot), 2600);
      stage.querySelectorAll('[data-slot]').forEach(b => {
        b.onclick = e => { e.stopPropagation(); go(Number(b.dataset.slot)); };
      });
    });
  }

  async function start() {
    root = document.getElementById('boot');
    stage = document.getElementById('bootStage');
    skipHint = document.getElementById('bootSkip');
    root.hidden = false;
    root.addEventListener('click', () => { if (advance && !needOk) advance(); });
    const quick = !!OPT.bootSeen;
    const l = t();

    await show(`<div class="boot-logo">${ICON}</div>`, { auto: quick ? 900 : 1900, cls: 'logo' });
    await show(`<div class="boot-credit"><small>${l.credit}</small><b>MASU01</b></div>`, { auto: quick ? 800 : 1700, cls: 'credit' });
    const firstNotice = OPT.noticeVer !== NOTICE_VER;
    await show(`<div class="boot-notice"><div class="boot-title">${l.noticeTitle}</div><ul>${l.notice.map(x => `<li>${x}</li>`).join('')}</ul>
      ${firstNotice ? `<button class="boot-ok" data-ok>${l.agree}</button>` : ''}</div>`, { auto: firstNotice ? 0 : 2600, ok: firstNotice, cls: 'notice' });
    OPT.noticeVer = NOTICE_VER;
    OPT.bootSeen = true;
    saveSettings();

    await pickSlot();

    // 留守の間に（放置の稼ぎ・ログインボーナス）
    const g = offlineGain((Date.now() - (S.last || Date.now())) / 1000);
    const sp = window.Gacha ? Gacha.dailyLogin() : 0;
    const free = window.Gacha && Gacha.freeReady();
    if (g || sp) {
      await show(`<div class="boot-away"><div class="boot-title">${g ? l.awayTitle : l.bonusTitle}</div>
        ${g ? `<p>${l.away(fmtTime(g.away), fmt(Math.floor(g.coins)))}</p>` : ''}
        ${sp ? `<p>${l.daily(sp)}</p>` : ''}
        ${free ? `<p class="dim">${l.freePull}</p>` : ''}</div>`, { auto: 0, cls: 'away' });
    }
    root.classList.add('gone');
    setTimeout(() => { root.hidden = true; root.classList.remove('gone'); }, 400);
    startGame();
  }

  // ---------- 省エネ（画面オフ） ----------
  let sleepEl, lastSleepPaint = 0;
  function sleep(on) {
    sleepEl = sleepEl || document.getElementById('sleep');
    sleeping = on;
    sleepEl.hidden = !on;
    document.body.classList.toggle('sleeping', on);
    if (on) { lastSleepPaint = 0; sleepTick(); } else { dirty = true; fieldBox = null; }
  }
  function sleepTick() {
    const now = Date.now();
    if (now - lastSleepPaint < 1000) return;
    lastSleepPaint = now;
    document.getElementById('sleepCoins').textContent = fmtCoins(S.coins);
    document.getElementById('sleepClock').textContent = new Date().toLocaleTimeString(OPT.lang === 'ja' ? 'ja-JP' : 'en-US', { hour: '2-digit', minute: '2-digit' });
  }
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('sleep').addEventListener('click', () => sleep(false));
    document.getElementById('sleepBtn').addEventListener('click', e => { e.stopPropagation(); sleep(true); });
  });

  return { start, sleep, sleepTick };
})();

window.Boot = Boot;

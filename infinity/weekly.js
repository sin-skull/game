'use strict';

// =====================================================
//  週間チャレンジ：毎週月曜 0時（日本時間）に変わる、全員同じ条件のタイムアタック
//  ・スロットとは別の、使い捨ての盤面で遊ぶ（永遠強化・ブースト券・次元の倍率なし）
//  ・記録は bi_ranking の w{週番号} に入る（ルールの変更は不要）
//  ・先週の順位に応じて SP がもらえる
// =====================================================

const Weekly = (() => {
  const WEEK = 7 * 864e5, JST = 9 * 3600e3, MON = 4 * 864e5;   // 1970/1/1 は木曜 → 4日ずらすと月曜はじまり
  const REWARDS = [[1, 500], [3, 300], [10, 150], [50, 60]], JOIN = 20;
  const T = {
    ja: {
      goal: g => `GOAL ${g}`, left: (d, h) => `残り ${d}日 ${h}時間`,
      start: '開始時の強化', noEternal: '永遠強化・次元の倍率なし。乱数も全員同じ。',
      best: x => `自己ベスト ${x}`, noBest: 'まだ記録なし', go: 'CHALLENGE', again: 'RETRY',
      rewards: '報酬（翌週ログイン時）：1位 500 SP ／ 2〜3位 300 ／ 4〜10位 150 ／ 11〜50位 60 ／ 参加 20',
      locked: '次元 2 に進むと、週間チャレンジが解放されます。',
      confirmTitle: '週間チャレンジ', confirmText: g => `${g} を作るまでのタイムを競う。<br>今のスロットはそのまま保存され、終わったら戻る。`,
      quitTitle: 'チャレンジをやめる？', quitText: '記録は残らない。今のスロットに戻る。', quit: 'やめる', cont: '続ける',
      doneTitle: 'FINISH', doneText: (x, nb) => `タイム ${x}${nb ? '<br><b>自己ベスト更新！</b>' : ''}`, doneLogin: '<br>ログインすると、ランキングに載る。',
      reward: (rank, sp) => rank ? `先週の週間チャレンジ：${rank}位<br>SP +${sp}` : `先週の週間チャレンジ：参加賞<br>SP +${sp}`,
      rewardTitle: 'WEEKLY REWARD',
      ups: { autoGen: '自動生成', autoMerge: '自動合成', luck: '幸運', space: '空間', baseTier: '生成ランク', tapPower: 'タップ' },
    },
    en: {
      goal: g => `GOAL ${g}`, left: (d, h) => `${d}d ${h}h left`,
      start: 'Starting upgrades', noEternal: 'No Eternal upgrades or dimension multipliers. Same random numbers for everyone.',
      best: x => `Best ${x}`, noBest: 'No record yet', go: 'CHALLENGE', again: 'RETRY',
      rewards: 'Rewards (next week, on login): 1st 500 SP / 2–3 300 / 4–10 150 / 11–50 60 / joined 20',
      locked: 'Reach dimension 2 to open the Weekly Challenge.',
      confirmTitle: 'Weekly Challenge', confirmText: g => `Race to make ${g}.<br>Your slot is saved as is, and you return to it afterwards.`,
      quitTitle: 'Quit the challenge?', quitText: 'No record is kept. You return to your slot.', quit: 'Quit', cont: 'Keep going',
      doneTitle: 'FINISH', doneText: (x, nb) => `Time ${x}${nb ? '<br><b>New best!</b>' : ''}`, doneLogin: '<br>Log in to appear in the ranking.',
      reward: (rank, sp) => rank ? `Last week’s challenge: #${rank}<br>SP +${sp}` : `Last week’s challenge: joined<br>SP +${sp}`,
      rewardTitle: 'WEEKLY REWARD',
      ups: { autoGen: 'Auto Spawn', autoMerge: 'Auto Merge', luck: 'Luck', space: 'Space', baseTier: 'Base Rank', tapPower: 'Tap' },
    },
  };
  const t = () => T[OPT.lang] || T.ja;

  const key = (now = Date.now()) => Math.floor((now + JST - MON) / WEEK);
  function leftText() {
    const end = (key() + 1) * WEEK + MON - JST, s = Math.max(0, end - Date.now());
    return t().left(Math.floor(s / 864e5), Math.floor(s / 3600e3) % 24);
  }
  function rng(a) {
    return () => {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let x = Math.imul(a ^ (a >>> 15), 1 | a);
      x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }
  // その週のルール（週番号から決まる。全員同じ）
  function rules(k = key()) {
    const r = rng(k * 2654435761);
    const n = (a, b) => a + Math.floor(r() * (b - a + 1));
    return {
      goal: n(12, 14), seed: (k * 40503) >>> 0,
      up: { autoGen: n(6, 12), autoMerge: n(6, 12), luck: n(0, 4), space: n(1, 3), baseTier: n(0, 2), tapPower: n(0, 2) },
    };
  }
  // 週の期間（日本時間の月曜〜日曜）
  function weekRange(k) {
    const d0 = new Date(k * WEEK + MON), d1 = new Date(k * WEEK + MON + 6 * 864e5);
    const f = d => `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
    return `${f(d0)} – ${f(d1)}`;
  }
  const open = () => PROFILE.maxDim > 1 || S.shards > 0;
  const fmtCs = cs => (cs / 100).toFixed(2) + 's';

  // ---------- 挑戦 ----------
  let stash = null, time = 0, cur = null;
  function enter() {
    if (MODE || !open()) return;
    const l = t(), ru = rules();
    showModal({
      title: l.confirmTitle, text: l.confirmText(pow2(ru.goal)),
      buttons: [{ label: l.go, primary: true, onClick: () => begin(ru) }, { label: l.cont === '続ける' ? 'キャンセル' : 'Cancel' }],
    });
  }
  function begin(ru) {
    save();
    stash = S;
    cur = { ...ru, k: key() };
    MODE = 'weekly';
    S = freshState();
    Object.assign(S.up, ru.up, { autoSell: 1 });
    RNG = rng(ru.seed);
    time = 0;
    clearField();
    document.getElementById('wkQuit').hidden = false;
    renderAll();
    switchPanel('play');
    tone(330, 0.2, 0.05, 'triangle');
    tone(660, 0.3, 0.05, 'triangle', 0.2);
  }
  function exit() {
    MODE = null;
    RNG = Math.random;
    if (stash) S = stash;
    stash = null;
    clearField();
    document.getElementById('wkQuit').hidden = true;
    lastTick = performance.now();
    renderAll();
  }
  function tick(dt) { time += dt; }
  function onTier(tier) {
    if (!cur || tier < cur.goal) return;
    const cs = Math.max(1, Math.round(time * 100)), k = cur.k;
    cur = null;
    const best = PROFILE.weekly[k];
    const nb = !best || cs < best;
    if (nb) {
      PROFILE.weekly[k] = cs;
      // 古い週の記録は消す（今週と先週だけ残す）
      Object.keys(PROFILE.weekly).forEach(w => { if (Number(w) < k - 1) delete PROFILE.weekly[w]; });
    }
    exit();
    saveProfile();
    sfx.omega();
    const l = t();
    showModal({
      rings: 'WEEKLY', title: l.doneTitle,
      text: l.doneText(fmtCs(cs), nb) + (window.Online && Online.isLoggedIn() ? '' : l.doneLogin),
      buttons: [{ label: 'OK', primary: true, onClick: () => { switchPanel('vs'); if (window.Online) { Online.syncSoon(); setTimeout(() => Online.reloadRank(), 1800); } } }],
    });
  }
  function quit() {
    const l = t();
    showModal({ title: l.quitTitle, text: l.quitText, buttons: [{ label: l.quit, primary: true, onClick: () => { cur = null; exit(); } }, { label: l.cont }] });
  }
  function headerText() { return cur ? `${pow2(cur.goal)} · ${time.toFixed(2)}s` : ''; }

  // ---------- 先週の報酬 ----------
  let claiming = false;
  async function claimLast() {
    const prev = key() - 1;
    if (claiming || !window.Online || !Online.isLoggedIn() || (PROFILE.weeklyClaimed || 0) >= prev) return;
    if (!PROFILE.weekly[prev]) { PROFILE.weeklyClaimed = prev; saveProfile(); return; }
    claiming = true;
    try {
      // 上位50人の中での順位（自分の記録がまだ送られていなくても、自分のタイムで数える）
      const mine = PROFILE.weekly[prev], list = (await Online.fetchWeek(prev)).filter(r => r.uid !== Online.uid());
      const pos = list.filter(r => r['w' + prev] < mine).length + 1;
      const rank = pos <= 50 ? pos : 0;
      const tier = rank ? REWARDS.find(([n]) => rank <= n) : null;
      const sp = tier ? tier[1] : JOIN;
      PROFILE.weeklyClaimed = prev;
      addBP(sp);
      saveProfile();
      showModal({ rings: 'SP', title: t().rewardTitle, text: t().reward(rank, sp), buttons: [{ label: 'OK', primary: true }] });
    } catch (e) {
      console.warn('weekly', e);
    } finally {
      claiming = false;
    }
  }

  // ---------- 画面（VERSUS → RANKING → WEEKLY） ----------
  function panelHTML() {
    const l = t();
    if (!open()) return `<div class="wk locked-note"><p>${l.locked}</p></div>`;
    const k = key(), ru = rules(k), best = PROFILE.weekly[k];
    const ups = Object.entries(ru.up).filter(([, v]) => v > 0).map(([id, v]) => `${l.ups[id]} ${v}`).join(' · ');
    return `<div class="wk">
      <div class="wk-head"><small>${weekRange(k)}</small><b>${l.goal(pow2(ru.goal))}</b><span>${leftText()}</span></div>
      <p class="wk-rules"><b>${l.start}</b> ${ups}<br>${l.noEternal}</p>
      <div class="wk-best">${best ? l.best(fmtCs(best)) : l.noBest}</div>
      <button class="beyond" data-wk="start">${best ? l.again : l.go} &nbsp;→</button>
      <p class="wk-rewards">${l.rewards}</p>
    </div>`;
  }

  document.addEventListener('click', e => {
    if (e.target.closest('[data-wk="start"]')) enter();
  });
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('wkQuit').addEventListener('click', e => { e.stopPropagation(); quit(); });
  });

  return { key, rules, onTier, tick, headerText, panelHTML, claimLast, enter, quit, active: () => !!cur, _time: () => time };
})();

window.Weekly = Weekly;

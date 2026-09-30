'use strict';

// =====================================================
//  オンライン：Googleログイン・クラウド保存・ランキング・バトル
//  Firebase（Auth + Firestore）を使う。ログインしなくても遊べる。
//
//  Firestore のコレクション
//    bi_users/{uid}    本人だけ読み書き：プロフィールと3スロットのセーブ
//    bi_ranking/{uid}  誰でも読める：ランキング用の成績
//    bi_ghosts/{uid}   ログイン中なら読める：バトル用の「分身」
//    bi_names/{name}   誰でも読める：ユーザー名の重複防止
//    bi_inbox/{id}     分身が防衛したときの報酬（宛先本人だけ読める）
// =====================================================

const Online = (() => {
  const FB_CONFIG = {
    apiKey: 'AIzaSyCvHQ87hMvGGKTFxv7neDrfzEgh3FWCXVg', authDomain: 'song-request-1e77f.firebaseapp.com',
    projectId: 'song-request-1e77f', storageBucket: 'song-request-1e77f.firebasestorage.app',
    messagingSenderId: '179586584785', appId: '1:179586584785:web:61b5830051b4f04338b5f0',
  };
  const FB_VER = '10.12.2';
  const AUTH_FLAG = 'infinity-auth';
  const NAME_RE = /^[A-Za-z0-9_぀-ヿ㐀-鿿ｦ-ﾟ]{2,12}$/;
  const BATTLE_SEC = 60, BATTLE_SPEED = 3;

  const T = {
    ja: {
      guestTitle: 'ゲスト', guestText: 'この端末だけに保存中。ログインするとクラウドに保存され、ランキングとバトルに参加できる。',
      login: 'Google でログイン', logout: 'ログアウト', syncNow: '今すぐ同期', changeName: '名前を変更',
      synced: t => `クラウドに保存済み ${t}`, syncing: '同期中…', syncErr: '同期できなかった。通信を確認してください',
      permErr: 'クラウドの準備中（データベースのルール設定が必要）', noName: '名前が未設定',
      permToast: 'サーバーの設定がまだ終わっていない（管理者の作業待ち）。ゲームはこのまま遊べる',
      nameTitle: 'ユーザー名を決める', nameText: 'ランキングとバトルで表示される名前。2〜12文字（英数字・かな・漢字・_）。',
      nameBad: '使えない名前', nameTaken: 'その名前はもう使われている', nameOk: n => `「${n}」で登録した`, ok: 'OK',
      loggedIn: 'ログインした', loggedOut: 'ログアウトした', cloudLoaded: 'クラウドのデータを読み込んだ',
      errPopupClosed: 'ログインの画面が閉じられた', errPopupBlocked: 'ポップアップがブロックされた。ブラウザの設定で許可してください',
      errDomain: 'このアドレスではログインできない（管理者の設定が必要）', errNetwork: '通信できなかった', errOther: c => `ログインできなかった（${c}）`,
      soul: '魂', record: (w, l) => `${w}勝 ${l}敗`, bet: 'BET', random: 'RANDOM MATCH',
      chance: '勝率の目安', reward: '報酬', replay: '2回目以降', stageGo: 'CHALLENGE', stageAgain: 'REPLAY',
      hintEasy: '今の強化なら勝てそう。', hintEven: '五分五分。運しだい。', hintHard: '今は厳しい。強化してから挑もう（負けても何も失わない）。',
      stageWin: (c, bp, first) => `${first ? 'ステージクリア！ ' : ''}+${c} COIN ／ BP +${bp}`, stageLose: '負けても失うものはない。強化してもう一度。',
      onlineSub: '世界中のプレイヤーの分身と対戦。魂を賭けられる。',
      friendPh: 'フレンドのユーザー名', challenge: 'CHALLENGE',
      needLogin: 'ログインすると、世界中のプレイヤーの分身と対戦できる（MENU → ACCOUNT）。',
      searching: '相手を探している…', notFound: 'そのユーザーは見つからない（まだバトルに参加していないかも）',
      noOpp: 'まだ対戦相手がいない。ステージで遊ぼう', needName: '先にユーザー名を決めよう', self: '自分とは戦えない',
      rule: 'タイムアタック。先に GOAL のランクを作った方の勝ち。お互いのセーブデータの強化で全自動に進み、少しだけ運も絡む（次元の倍率は関係なし）。',
      finish: s => `FINISH ${s}s`, timeUp: 'TIME UP', goal: g => `GOAL ${g}`,
      resTime: (a, b) => `あなた ${a} ／ 相手 ${b}`,
      win: 'WIN', lose: 'LOSE', draw: 'DRAW',
      resWin: (bp, s) => `BP +${bp}${s ? ` ／ 魂 +${s}` : ''}`, resLose: (bp, s) => `BP +${bp}${s ? ` ／ 魂 −${s}` : ''}`, resDraw: '引き分け。賭けた魂は戻った',
      defense: (n, bp) => `留守の間に、分身が ${n} 回防衛した。BP +${bp}`,
      history: 'HISTORY', noHistory: 'まだ戦っていない', close: 'CLOSE',
      cats: { reach: 'REACH', bp: 'BP', clear: 'Ω TIME' }, catHelp: { reach: '到達した一番大きな数（次元をまたいだ指数）', bp: 'バトルで稼いだ BP の合計', clear: 'Ω に到達するまでのプレイ時間' },
      loading: '読み込み中…', empty: 'まだ誰もいない', rankErr: 'ランキングを読み込めない（通信か設定を確認）', you: 'YOU',
      notRanked: 'ログインして名前を決めると、ランキングに載る', refresh: 'REFRESH', dimLabel: d => `次元 ${d}`,
    },
    en: {
      guestTitle: 'Guest', guestText: 'Saved on this device only. Log in to save to the cloud and join rankings and battles.',
      login: 'Log in with Google', logout: 'Log out', syncNow: 'Sync now', changeName: 'Change name',
      synced: t => `Saved to cloud ${t}`, syncing: 'Syncing…', syncErr: 'Could not sync. Check your connection',
      permErr: 'Cloud not ready yet (database rules need to be set)', noName: 'No name yet',
      permToast: 'The server isn\u2019t set up yet (waiting on the admin). You can keep playing',
      nameTitle: 'Choose a username', nameText: 'Shown in rankings and battles. 2–12 characters (letters, digits, kana, kanji, _).',
      nameBad: 'That name can’t be used', nameTaken: 'That name is taken', nameOk: n => `Registered as “${n}”`, ok: 'OK',
      loggedIn: 'Logged in', loggedOut: 'Logged out', cloudLoaded: 'Loaded your cloud data',
      errPopupClosed: 'The login window was closed', errPopupBlocked: 'The popup was blocked. Allow popups for this page',
      errDomain: 'Login isn’t allowed from this address (admin setup needed)', errNetwork: 'Network error', errOther: c => `Could not log in (${c})`,
      soul: 'Souls', record: (w, l) => `${w}W ${l}L`, bet: 'BET', random: 'RANDOM MATCH',
      chance: 'Win chance', reward: 'Reward', replay: 'replay', stageGo: 'CHALLENGE', stageAgain: 'REPLAY',
      hintEasy: 'Your build should win this.', hintEven: 'Even odds. Luck decides.', hintHard: 'Tough for now. Upgrade first (losing costs nothing).',
      stageWin: (c, bp, first) => `${first ? 'Stage clear! ' : ''}+${c} COIN / BP +${bp}`, stageLose: 'Losing costs nothing. Upgrade and try again.',
      onlineSub: 'Battle copies of players around the world. You can bet Souls.',
      friendPh: 'Friend’s username', challenge: 'CHALLENGE',
      needLogin: 'Log in to battle copies of players around the world (MENU → ACCOUNT).',
      searching: 'Looking for an opponent…', notFound: 'User not found (they may not have battled yet)',
      noOpp: 'No opponents yet. Try the stages', needName: 'Choose a username first', self: 'You can’t fight yourself',
      rule: 'Time attack: first to make the GOAL rank wins. Both saves play automatically with their upgrades, plus a little luck (dimension multipliers don\u2019t count).',
      finish: s => `FINISH ${s}s`, timeUp: 'TIME UP', goal: g => `GOAL ${g}`,
      resTime: (a, b) => `You ${a} / Them ${b}`,
      win: 'WIN', lose: 'LOSE', draw: 'DRAW',
      resWin: (bp, s) => `BP +${bp}${s ? ` / Souls +${s}` : ''}`, resLose: (bp, s) => `BP +${bp}${s ? ` / Souls −${s}` : ''}`, resDraw: 'Draw. Your bet was returned',
      defense: (n, bp) => `Your copy defended ${n} time${n > 1 ? 's' : ''} while you were away. BP +${bp}`,
      history: 'HISTORY', noHistory: 'No battles yet', close: 'CLOSE',
      cats: { reach: 'REACH', bp: 'BP', clear: 'Ω TIME' }, catHelp: { reach: 'The largest number ever reached (exponent across dimensions)', bp: 'Total BP earned in battles', clear: 'Play time until reaching Ω' },
      loading: 'Loading…', empty: 'Nobody here yet', rankErr: 'Couldn’t load the ranking (check connection or setup)', you: 'YOU',
      notRanked: 'Log in and choose a name to appear here', refresh: 'REFRESH', dimLabel: d => `Dim ${d}`,
    },
  };
  const t = () => T[OPT.lang] || T.ja;

  let fb = null, fbLoading = null, user = null;
  let status = 'guest', statusAt = 0, dirtyCloud = false, pushTimer = null, syncing = false;
  let rankCat = 'reach', rankData = {}, rankState = {};
  let betValue = 0;

  // ---------- Firebase ----------
  function loadFb() {
    if (fb) return Promise.resolve(fb);
    if (fbLoading) return fbLoading;
    const base = `https://www.gstatic.com/firebasejs/${FB_VER}/`;
    fbLoading = Promise.all([import(base + 'firebase-app.js'), import(base + 'firebase-auth.js'), import(base + 'firebase-firestore.js')])
      .then(([app, auth, fs]) => {
        const a = app.initializeApp(FB_CONFIG, 'beyond-infinity');
        fb = { auth: auth.getAuth(a), db: fs.getFirestore(a), A: auth, F: fs };
        fb.A.getRedirectResult(fb.auth).catch(e => toast(loginErr(e)));
        fb.A.onAuthStateChanged(fb.auth, u => {
          const was = user && user.uid;
          user = u;
          if (u && u.uid !== was) afterLogin(u);
          if (!u) { status = 'guest'; renderAccountOnly(); }
        });
        return fb;
      })
      .catch(e => { fbLoading = null; throw e; });
    return fbLoading;
  }

  function loginErr(e) {
    const c = (e && e.code) || '', l = t();
    if (c.includes('popup-closed') || c.includes('cancelled-popup')) return l.errPopupClosed;
    if (c.includes('popup-blocked')) return l.errPopupBlocked;
    if (c.includes('unauthorized-domain')) return l.errDomain;
    if (c.includes('network')) return l.errNetwork;
    return l.errOther(c || (e && e.message) || '?');
  }

  async function login() {
    let f;
    try { f = await loadFb(); } catch (e) { toast(t().errNetwork); return; }
    const prov = new f.A.GoogleAuthProvider();
    prov.setCustomParameters({ prompt: 'select_account' });
    try {
      await f.A.signInWithPopup(f.auth, prov);
    } catch (e) {
      const c = (e && e.code) || '';
      // ホーム画面アプリなどでポップアップが使えないときはページ移動で
      if (c.includes('popup-blocked') || c.includes('operation-not-supported')) {
        try { await f.A.signInWithRedirect(f.auth, prov); return; } catch (e2) { toast(loginErr(e2)); return; }
      }
      toast(loginErr(e));
    }
  }

  async function logout() {
    await pushAll().catch(() => {});
    try { localStorage.removeItem(AUTH_FLAG); } catch (e) { /* 保存不可 */ }
    if (fb) await fb.A.signOut(fb.auth);
    user = null;
    status = 'guest';
    toast(t().loggedOut);
    renderAll();
  }

  async function afterLogin(u) {
    try { localStorage.setItem(AUTH_FLAG, '1'); } catch (e) { /* 保存不可 */ }
    status = 'syncing';
    renderAccountOnly();
    try {
      const loaded = await pullAndMerge(u);
      await claimInbox();
      await pushAll();
      toast(loaded ? t().cloudLoaded : t().loggedIn);
      if (!PROFILE.name) askName();
    } catch (e) {
      setError(e);
      toast(status === 'perm' ? t().permToast : t().syncErr);
    }
    renderAll();
  }

  function setError(e) {
    status = (e && String(e.code || e.message).includes('permission')) ? 'perm' : 'error';
    console.warn('online', e);
    renderAccountOnly();
  }

  // ---------- クラウド保存 ----------
  const progress = s => (s ? (s.stats.playTime || 0) + (s.shards || 0) * 1e6 : -1);
  const isEmpty = s => !s || (!s.stats.spawned && !s.shards);

  async function pullAndMerge(u) {
    const f = await loadFb();
    const snap = await f.F.getDoc(f.F.doc(f.db, 'bi_users', u.uid));
    if (!snap.exists()) return false;
    const cloud = snap.data();
    let loadedCurrent = false;
    for (let i = 0; i < SLOT_KEYS.length; i++) {
      const raw = cloud.slots && cloud.slots['s' + i];
      if (!raw) continue;
      let c;
      try { c = normalize(JSON.parse(raw)); } catch (e) { continue; }
      const local = i === OPT.slot ? S : readSlot(i);
      // 進み具合（プレイ時間・次元）が大きい方を採用。負けた方はバックアップへ
      const useCloud = isEmpty(local) || (!isEmpty(c) && progress(c) > progress(local));
      if (!useCloud) continue;
      if (local && !isEmpty(local)) { try { localStorage.setItem(BACKUP_KEY, JSON.stringify(local)); } catch (e) { /* 保存不可 */ } }
      try { localStorage.setItem(SLOT_KEYS[i], JSON.stringify(c)); } catch (e) { /* 保存不可 */ }
      if (i === OPT.slot) { S = c; clearField(); loadedCurrent = true; }
    }
    const cp = normalizeProfile(cloud.profile || {});
    const skins = [...new Set([...PROFILE.skins, ...cp.skins])];
    const stage = Math.max(PROFILE.stage || 0, cp.stage || 0);
    if (cp.updated > PROFILE.updated) PROFILE = cp;
    PROFILE.skins = skins;
    PROFILE.stage = stage;
    saveProfile(false);
    return loadedCurrent;
  }

  function slotData(i) { return i === OPT.slot ? S : readSlot(i); }

  function rankingEntry() {
    let score = 0, dim = 1, maxTier = 0, clearTime = 0, reach = 0;
    for (let i = 0; i < SLOT_KEYS.length; i++) {
      const s = slotData(i);
      if (!s) continue;
      reach = Math.max(reach, s.shards * MAX_TIER + s.stats.maxTier);
      const sc = (s.shards + 1) * 100 + s.stats.maxTier;
      if (sc > score) { score = sc; dim = s.shards + 1; maxTier = s.stats.maxTier; }
      if (s.clearTime && (!clearTime || s.clearTime < clearTime)) clearTime = Math.floor(s.clearTime);
    }
    return { name: PROFILE.name, skin: PROFILE.skin, score, dim, maxTier, clearTime, reach, bp: Math.floor(PROFILE.bpTotal), wins: PROFILE.wins, updated: Date.now() };
  }

  function snapshot(s = S) {
    return {
      name: PROFILE.name || 'YOU', skin: PROFILE.skin, dim: s.shards + 1,
      up: { autoGen: s.up.autoGen, autoMerge: s.up.autoMerge, luck: s.up.luck, baseTier: s.up.baseTier, space: s.up.space, tapPower: s.up.tapPower },
      dup: s.skills.dupMerge || 0,
    };
  }

  async function pushAll() {
    if (!user || syncing) return;
    syncing = true;
    try {
      const f = await loadFb();
      const slots = {};
      for (let i = 0; i < SLOT_KEYS.length; i++) {
        const s = slotData(i);
        if (s && !isEmpty(s)) slots['s' + i] = JSON.stringify(s);
      }
      const { history, ...prof } = PROFILE;
      await f.F.setDoc(f.F.doc(f.db, 'bi_users', user.uid), { profile: { ...prof, history: history.slice(0, 10) }, slots, updated: Date.now(), v: VERSION });
      if (PROFILE.name) {
        await f.F.setDoc(f.F.doc(f.db, 'bi_ranking', user.uid), rankingEntry());
        await f.F.setDoc(f.F.doc(f.db, 'bi_ghosts', user.uid), { ...snapshot(), wins: PROFILE.wins, updated: Date.now() });
      }
      dirtyCloud = false;
      status = 'ok';
      statusAt = Date.now();
    } catch (e) {
      setError(e);
    } finally {
      syncing = false;
    }
    renderAccountOnly();
  }

  function markDirty() { dirtyCloud = true; }
  function syncSoon() { clearTimeout(pushTimer); pushTimer = setTimeout(() => pushAll(), 1500); }
  function syncNow() { if (user && dirtyCloud) pushAll(); }
  setInterval(() => { if (user && dirtyCloud) pushAll(); }, 90 * 1000);

  // ---------- ユーザー名 ----------
  function askName() {
    const l = t();
    showModal({
      title: l.nameTitle, text: l.nameText,
      html: `<input id="nameBox" class="m-input" maxlength="12" autocomplete="off" value="${esc(PROFILE.name || '')}">`,
      buttons: [
        {
          label: l.ok, primary: true, keepOpen: true, onClick: async () => {
            const name = $('nameBox').value.trim();
            if (!NAME_RE.test(name)) { toast(l.nameBad); return; }
            try {
              await claimName(name);
              closeModal();
              toast(l.nameOk(name));
              renderAll();
            } catch (e) {
              if (e && e.message === 'taken') toast(l.nameTaken);
              else { setError(e); toast(status === 'perm' ? l.permToast : l.syncErr); }
            }
          },
        },
        { label: OPT.lang === 'ja' ? 'あとで' : 'Later' },
      ],
    });
    setTimeout(() => { const b = $('nameBox'); if (b) b.focus(); }, 100);
  }

  async function claimName(name) {
    const f = await loadFb();
    const key = name.toLowerCase();
    const old = PROFILE.name ? PROFILE.name.toLowerCase() : '';
    await f.F.runTransaction(f.db, async tx => {
      const ref = f.F.doc(f.db, 'bi_names', key);
      const snap = await tx.get(ref);
      if (snap.exists() && snap.data().uid !== user.uid) throw new Error('taken');
      tx.set(ref, { uid: user.uid, name });
      if (old && old !== key) tx.delete(f.F.doc(f.db, 'bi_names', old));
    });
    PROFILE.name = name;
    saveProfile();
    await pushAll();
  }

  // ---------- 防衛報酬 ----------
  async function claimInbox() {
    if (!user) return;
    const f = await loadFb();
    const q = f.F.query(f.F.collection(f.db, 'bi_inbox'), f.F.where('to', '==', user.uid), f.F.limit(50));
    const snaps = await f.F.getDocs(q);
    let n = 0, bp = 0;
    for (const d of snaps.docs) {
      bp += Math.min(10, Number(d.data().bp) || 0);
      n++;
      await f.F.deleteDoc(d.ref).catch(() => {});
    }
    if (n) {
      addBP(bp);
      saveProfile();
      setTimeout(() => toast(t().defense(n, bp)), 1200);
    }
  }

  // ---------- アカウント表示（MENU → ACCOUNT） ----------
  function statusText() {
    const l = t();
    if (status === 'syncing') return l.syncing;
    if (status === 'perm') return l.permErr;
    if (status === 'error') return l.syncErr;
    if (status === 'ok') return l.synced(new Date(statusAt).toLocaleTimeString(OPT.lang === 'ja' ? 'ja-JP' : 'en-US', { hour: '2-digit', minute: '2-digit' }));
    return '';
  }

  function accountHTML() {
    const l = t();
    if (!user) {
      return `<div class="acct">
        <div class="acct-name">${l.guestTitle}</div>
        <p class="acct-text">${l.guestText}</p>
        <button class="gbtn" data-online="login"><span class="g">G</span>${l.login}</button>
      </div>`;
    }
    return `<div class="acct">
      <div class="acct-name">${PROFILE.name ? esc(PROFILE.name) : `<span class="dim-text">${l.noName}</span>`}</div>
      <div class="acct-mail">${esc(user.email || '')}</div>
      <div class="acct-status ${status === 'perm' || status === 'error' ? 'err' : ''}">${statusText()}</div>
      <div class="acct-btns">
        <button class="opt-btn" data-online="name">${l.changeName}</button>
        <button class="opt-btn" data-online="sync">${l.syncNow}</button>
        <button class="opt-btn danger" data-online="logout">${l.logout}</button>
      </div>
    </div>`;
  }

  function renderAccountOnly() {
    if (currentPanel === 'menu') renderAccount();
    if (currentPanel === 'vs') render();
  }

  els.account.addEventListener('click', e => {
    const b = e.target.closest('[data-online]');
    if (!b) return;
    const a = b.dataset.online;
    if (a === 'login') login();
    if (a === 'logout') logout();
    if (a === 'name') askName();
    if (a === 'sync') { status = 'syncing'; renderAccountOnly(); pushAll(); }
  });

  // ---------- ランキング ----------
  async function fetchRank(cat) {
    const f = await loadFb();
    const col = f.F.collection(f.db, 'bi_ranking');
    const q = cat === 'clear' ? f.F.query(col, f.F.where('clearTime', '>', 0), f.F.orderBy('clearTime', 'asc'), f.F.limit(50))
      : f.F.query(col, f.F.orderBy(cat === 'bp' ? 'bp' : 'reach', 'desc'), f.F.limit(50));
    const snaps = await f.F.getDocs(q);
    return snaps.docs.map(d => ({ uid: d.id, ...d.data() }));
  }

  function rankValue(cat, r) {
    if (cat === 'clear') return fmtTime(r.clearTime);
    if (cat === 'bp') return `BP ${fmt(r.bp || 0)}`;
    return `2<sup>${Math.floor(Number.isFinite(r.reach) ? r.reach : ((r.dim || 1) - 1) * MAX_TIER + (r.maxTier || 0))}</sup>`;
  }

  function renderRank() {
    const box = $('sub-rank'), l = t();
    const cats = Object.entries(l.cats).map(([k, v]) => `<button data-cat="${k}" class="${k === rankCat ? 'on' : ''}">${v}</button>`).join('');
    const st = rankState[rankCat];
    let list;
    if (st === 'loading' || st === undefined) list = `<p class="dim-text">${l.loading}</p>`;
    else if (st === 'error') list = `<p class="dim-text">${l.rankErr}</p>`;
    else {
      const rows = rankData[rankCat] || [];
      list = rows.length ? rows.map((r, i) => `<div class="rk ${i < 3 ? 'top top' + (i + 1) : ''} ${user && r.uid === user.uid ? 'me' : ''}">
          <span class="rk-no">${i + 1}</span>
          <span class="rk-skin">${skinSVG(SKIN_LIST.some(s => s.id === r.skin) ? r.skin : 'CIRCLE', 6, i < 3 ? 30 : 22)}</span>
          <span class="rk-name">${esc(r.name || '???')}</span>
          <span class="rk-val">${rankValue(rankCat, r)}</span>
        </div>`).join('') : `<p class="dim-text">${l.empty}</p>`;
    }
    const mine = !user || !PROFILE.name ? `<p class="dim-text small">${l.notRanked}</p>` : '';
    const me = rankingEntry();
    const inList = user && (rankData[rankCat] || []).some(r => r.uid === user.uid);
    const myRow = user && PROFILE.name && st === 'ok' && !inList && (rankCat !== 'clear' || me.clearTime)
      ? `<div class="rk me pinned"><span class="rk-no">—</span><span class="rk-skin">${skinSVG(PROFILE.skin, 6, 22)}</span><span class="rk-name">${esc(PROFILE.name)}</span><span class="rk-val">${rankValue(rankCat, me)}</span></div>` : '';
    box.innerHTML = `<div class="seg wide no-swipe" id="rankCats">${cats}</div><p class="sec-sub rk-help">${l.catHelp[rankCat]}</p>${mine}<div class="rk-list">${list}${myRow}</div>
      <button class="opt-btn wide" data-rank="refresh">${l.refresh}</button>`;
    if (st === undefined) loadRank(rankCat);
  }

  async function loadRank(cat) {
    rankState[cat] = 'loading';
    try {
      if (user && dirtyCloud) await pushAll();
      rankData[cat] = await fetchRank(cat);
      rankState[cat] = 'ok';
    } catch (e) {
      console.warn('rank', e);
      rankState[cat] = 'error';
    }
    if (currentPanel === 'vs') renderRank();
  }

  $('sub-rank').addEventListener('click', e => {
    const c = e.target.closest('[data-cat]');
    if (c) { rankCat = c.dataset.cat; renderRank(); return; }
    if (e.target.closest('[data-rank="refresh"]')) { loadRank(rankCat); renderRank(); }
  });

  // ---------- バトル ----------
  const maxBet = () => Math.max(0, Math.min(Math.floor(S.soul), 50 * (S.shards + 1)));

  function renderBattle() {
    const box = $('sub-battle'), l = t();
    const mb = maxBet();
    betValue = Math.min(betValue, mb);
    const hist = PROFILE.history.slice(0, 6).map(h => `<div class="hist ${h.r}">
        <span>${h.r === 'win' ? 'W' : h.r === 'lose' ? 'L' : 'D'}</span><span class="rk-name">${esc(h.name)}</span><span>${h.time ? `${h.time.toFixed(2)}s ` : ''}${h.bet ? `◇ ${fmt(h.bet)}` : ''}</span>
      </div>`).join('') || `<p class="dim-text">${l.noHistory}</p>`;
    box.innerHTML = `
      <div class="vs-stats">
        <div><small>◇ ${l.soul}</small><b>${fmt(S.soul)}</b></div>
        <div><small>BP</small><b>${fmt(PROFILE.bp)}</b></div>
        <div><small>W / L</small><b>${PROFILE.wins} / ${PROFILE.losses}</b></div>
      </div>
      <p class="sec-sub">${l.rule}</p>
      ${stageHTML()}
      <h3>ONLINE</h3>
      ${user ? `<p class="sec-sub">${l.onlineSub}</p>
      <div class="bet no-swipe">
        <div class="bet-head"><span>${l.bet}</span><b id="betVal">◇ ${fmt(betValue)}</b></div>
        <input type="range" id="betRange" min="0" max="${mb}" step="1" value="${betValue}" ${mb ? '' : 'disabled'}>
      </div>
      <button class="opt-btn wide" data-vs="random">${l.random} &nbsp;→</button>
      <div class="friend no-swipe"><input id="friendBox" class="f-input" maxlength="12" placeholder="${l.friendPh}" autocomplete="off"><button class="opt-btn" data-vs="friend">${l.challenge}</button></div>`
      : `<p class="sec-sub">${l.needLogin}</p>`}
      <h3>${l.history}</h3>
      <div class="hist-list">${hist}</div>`;
  }

  function stageHTML() {
    const l = t(), n = curStage(), opp = stageOpp(n), cleared = stageCleared();
    const first = n > cleared, rw = stageReward(n, first);
    const ch = winChance(snapshot(), opp);
    const dots = Array.from({ length: STAGE_MAX }, (_, i) => `<i class="${i < cleared ? 'on' : ''} ${i + 1 === n ? 'cur' : ''}"></i>`).join('');
    return `<div class="stage">
      <div class="stage-head">
        <button class="stage-nav" data-stage="-1" ${n <= 1 ? 'disabled' : ''}>‹</button>
        <div class="stage-title"><small>STAGE</small><b>${String(n).padStart(2, '0')}</b></div>
        <button class="stage-nav" data-stage="1" ${n >= Math.min(STAGE_MAX, cleared + 1) ? 'disabled' : ''}>›</button>
        <span class="stage-skin">${skinSVG(opp.skin, 6, 34)}</span>
      </div>
      <div class="stage-dots">${dots}</div>
      <div class="stage-info">
        <div><small>${l.chance}</small><b>${ch}%</b></div>
        <div><small>${l.reward}${first ? '' : ' · ' + l.replay}</small><b>${fmt(rw.coins)} <em class="unit">COIN</em></b></div>
      </div>
      <p class="stage-hint">${ch >= 60 ? l.hintEasy : ch >= 35 ? l.hintEven : l.hintHard}</p>
      <button class="beyond" data-vs="stage">${first ? l.stageGo : l.stageAgain} &nbsp;→</button>
    </div>`;
  }

  $('sub-battle').addEventListener('input', e => {
    if (e.target.id === 'betRange') {
      betValue = Number(e.target.value);
      $('betVal').textContent = `◇ ${fmt(betValue)}`;
    }
  });

  $('sub-battle').addEventListener('click', async e => {
    const nav = e.target.closest('[data-stage]');
    if (nav && !nav.disabled) {
      stageSel = Math.min(Math.min(STAGE_MAX, stageCleared() + 1), Math.max(1, curStage() + Number(nav.dataset.stage)));
      renderBattle();
      return;
    }
    const b = e.target.closest('[data-vs]');
    if (!b || b.disabled) return;
    const l = t();
    b.disabled = true;
    try {
      if (b.dataset.vs === 'stage') {
        startBattle(stageOpp(curStage()));
      } else if (b.dataset.vs === 'random') {
        if (!PROFILE.name) { askName(); return; }
        toast(l.searching);
        const opp = await findRandom().catch(() => null);
        if (!opp) { toast(l.noOpp); return; }
        startBattle(opp);
      } else {
        if (!PROFILE.name) { askName(); return; }
        const name = ($('friendBox').value || '').trim();
        if (!name) return;
        const opp = await findFriend(name).catch(() => null);
        if (opp === 'self') { toast(l.self); return; }
        if (!opp) { toast(l.notFound); return; }
        startBattle(opp);
      }
    } finally {
      b.disabled = false;
    }
  });

  async function findRandom() {
    const f = await loadFb();
    if (dirtyCloud) await pushAll();
    const q = f.F.query(f.F.collection(f.db, 'bi_ghosts'), f.F.orderBy('updated', 'desc'), f.F.limit(40));
    const snaps = await f.F.getDocs(q);
    const all = snaps.docs.map(d => ({ uid: d.id, ...d.data() })).filter(g => g.uid !== user.uid && g.up);
    if (!all.length) return null;
    const myDim = S.shards + 1;
    const near = all.filter(g => Math.abs((g.dim || 1) - myDim) <= 2);
    const pool = near.length ? near : all;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  async function findFriend(name) {
    const f = await loadFb();
    const n = await f.F.getDoc(f.F.doc(f.db, 'bi_names', name.toLowerCase()));
    if (!n.exists()) return null;
    const uid = n.data().uid;
    if (uid === user.uid) return 'self';
    const g = await f.F.getDoc(f.F.doc(f.db, 'bi_ghosts', uid));
    return g.exists() ? { uid, ...g.data() } : null;
  }

  // ---- 全自動シミュレーション（同じシードなら同じ結果） ----
  function rng(a) {
    return () => {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let x = Math.imul(a ^ (a >>> 15), 1 | a);
      x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }

  function simInit(p, seed) {
    const up = p.up || {};
    const slow = p.slow || 1;   // ステージ序盤の相手はわざと遅い
    const s = {
      p, up, rand: rng(seed), objs: [], sold: 0, g: 0, m: 0,
      // 手で遊ぶ分（1.4秒・1.2秒に1回）＋自動の分を足した速さ。どのレベルでも強化が効く
      genIv: slow / (1 / 1.4 + (up.autoGen ? 1 / genInterval(up.autoGen) : 0)),
      mergeIv: slow / (1 / 1.2 + (up.autoMerge ? 1 / mergeInterval(up.autoMerge) : 0)),
      cap: SPACE_CAPS[Math.min(up.space || 0, SPACE_CAPS.length - 1)],
    };
    // 運：次の生成・合成までの間隔が毎回 0.55〜1.45 倍でゆらぐ
    s.nextG = s.genIv * (0.3 + s.rand());
    s.nextM = s.mergeIv * (0.3 + s.rand());
    return s;
  }
  const jitter = s => 0.55 + 0.9 * s.rand();

  function simSpawn(s) {
    if (s.objs.length >= s.cap) {
      let lo = 0;
      s.objs.forEach((o, i) => { if (o.t < s.objs[lo].t) lo = i; });
      s.sold += Math.pow(2, s.objs[lo].t);
      s.objs.splice(lo, 1);
    }
    let tier = Math.min(10, s.up.baseTier || 0);
    if (s.rand() < 0.04 + (s.up.luck || 0) * 0.05) tier++;   // 幸運0でも4%はある
    s.objs.push({ t: Math.min(tier, MAX_TIER - 1), x: 0.08 + s.rand() * 0.84, y: 0.12 + s.rand() * 0.76 });
  }

  function simMerge(s) {
    const seen = {};
    let pair = null;
    s.objs.forEach((o, i) => {
      if (o.t >= MAX_TIER) return;
      if (seen[o.t] !== undefined) { if (!pair || o.t < s.objs[pair[0]].t) pair = [i, seen[o.t]]; } else seen[o.t] = i;
    });
    if (!pair) return;
    const b = s.objs[pair[1]];
    b.t++;
    if (b.t < MAX_TIER && s.rand() < (s.p.dup || 0) * 0.04) b.t++;
    s.objs.splice(pair[0], 1);
  }

  function simStep(s, dt) {
    s.g += dt;
    while (s.g >= s.nextG) {
      s.g -= s.nextG;
      s.nextG = s.genIv * jitter(s);
      simSpawn(s);
      if (s.rand() < (s.up.tapPower || 0) * 0.15) simSpawn(s);
    }
    s.m += dt;
    while (s.m >= s.nextM) { s.m -= s.nextM; s.nextM = s.mergeIv * jitter(s); simMerge(s); }
  }

  const simScore = s => s.sold + s.objs.reduce((a, o) => a + Math.pow(2, o.t), 0);
  const goalOf = (a, b) => Math.min(MAX_TIER - 1, Math.max((a.up && a.up.baseTier) || 0, (b.up && b.up.baseTier) || 0) + 5);

  // 最後まで一気に計算（勝率の目安用）。1=勝ち -1=負け 0=引き分け
  function race(pa, pb, seed) {
    const goal = goalOf(pa, pb);
    const a = simInit(pa, seed), b = simInit(pb, seed ^ 0x9e3779b9);
    for (let tm = 0; tm < BATTLE_SEC; tm += 0.05) {
      simStep(a, 0.05); simStep(b, 0.05);
      const A = a.objs.some(o => o.t >= goal), B = b.objs.some(o => o.t >= goal);
      if (A || B) return A && !B ? 1 : B && !A ? -1 : 0;
    }
    const sa = simScore(a), sb = simScore(b);
    return sa > sb ? 1 : sa < sb ? -1 : 0;
  }
  const chanceCache = new Map();
  function winChance(me, opp) {
    const key = JSON.stringify([me.up, me.dup, opp.up, opp.dup, opp.slow]);
    if (chanceCache.has(key)) return chanceCache.get(key);
    let w = 0;
    const N = 40;
    for (let i = 1; i <= N; i++) { const r = race(me, opp, i * 7919); w += r > 0 ? 1 : r === 0 ? 0.5 : 0; }
    const c = Math.round(w / N * 100);
    if (chanceCache.size > 200) chanceCache.clear();
    chanceCache.set(key, c);
    return c;
  }

  // ---- ステージ（オフラインでも遊べる。少しずつ強くなる相手） ----
  const STAGE_MAX = 30;
  const STAGE_SLOW = [2.2, 1.8, 1.5, 1.3, 1.15, 1.05];
  const STAGE_TUNE = { gen: 0.7, merge: 0.6, tierEvery: 7 };
  function stageOpp(n) {
    const k = n - 1;
    return {
      name: `STAGE ${String(n).padStart(2, '0')}`, stage: n, uid: null, dim: 1 + Math.floor(k / 6),
      skin: SKIN_LIST[k % SKIN_LIST.length].id,
      slow: STAGE_SLOW[k] || 1,
      up: {
        autoGen: Math.min(25, Math.round(k * STAGE_TUNE.gen)),
        autoMerge: Math.min(25, Math.round(k * STAGE_TUNE.merge)),
        luck: Math.min(10, Math.floor(k / 3)),
        baseTier: Math.min(10, Math.floor(k / STAGE_TUNE.tierEvery)),
        space: Math.min(4, Math.floor(k / 6)),
        tapPower: Math.min(4, Math.floor(k / 8)),
      },
      dup: Math.min(5, Math.floor(k / 10)),
    };
  }
  const stageCleared = () => PROFILE.stage || 0;
  let stageSel = null;
  const curStage = () => Math.min(STAGE_MAX, Math.max(1, stageSel || stageCleared() + 1));
  // 報酬：ステージの GOAL くらいの価値 × 今の売却倍率。初クリアは満額、2回目以降は3割
  function stageReward(n, first) {
    const o = stageOpp(n);
    const coins = Math.pow(2, Math.min(MAX_TIER - 1, o.up.baseTier + 6)) * (1 + 0.25 * (n - 1)) * sellMult();
    return { coins: Math.floor(first ? coins : coins * 0.3), bp: first ? 5 + n : 1 };
  }

  // ---- 会場 ----
  let battle = null;

  function drawSide(fieldEl, s, skin) {
    const w = fieldEl.clientWidth || 300;
    fieldEl.innerHTML = s.objs.map(o => {
      const d = Math.round((18 + o.t * 3.6) * Math.min(1.2, w / 340));
      return `<i style="left:${(o.x * 100).toFixed(1)}%;top:${(o.y * 100).toFixed(1)}%;width:${d}px;height:${d}px">${skinSVG(skin, o.t, d)}</i>`;
    }).join('');
  }

  function startBattle(opp) {
    if (battle) return;
    const me = snapshot();
    const bet = opp.stage ? 0 : Math.min(betValue, maxBet());
    const seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
    const oppSkin = SKIN_LIST.some(s => s.id === opp.skin) ? opp.skin : 'CIRCLE';
    const goalExp = goalOf(me, opp);
    battle = { opp, me, bet, oppSkin, a: simInit(me, seed), b: simInit(opp, seed ^ 0x9e3779b9), time: 0, last: performance.now(), done: false,
      goalExp, goal: Math.pow(2, goalExp), ta: 0, tb: 0 };
    $('arGoal').textContent = t().goal(pow2(goalExp));
    $('arMeScore').classList.remove('done');
    $('arOppScore').classList.remove('done');
    $('arOppName').textContent = opp.name || '???';
    $('arOppInfo').textContent = `DIM ${String(opp.dim || 1).padStart(2, '0')}`;
    $('arMeName').textContent = me.name;
    $('arMeInfo').textContent = bet ? `BET ◇ ${fmt(bet)}` : `DIM ${String(me.dim).padStart(2, '0')}`;
    els.arena.hidden = false;
    tone(330, 0.2, 0.05, 'triangle');
    tone(660, 0.3, 0.05, 'triangle', 0.2);
    battle.timer = setInterval(battleTick, 50);
  }

  function battleTick(skipAll) {
    if (!battle || battle.done) return;
    const now = performance.now();
    let dt = Math.min(0.2, (now - battle.last) / 1000) * BATTLE_SPEED;
    battle.last = now;
    if (skipAll === true) dt = BATTLE_SEC - battle.time;
    const step = 0.05, bt = battle;
    // どちらかが目標に届いたら、その瞬間に決着（タイムアタック）
    for (let x = 0; x < dt && bt.time < BATTLE_SEC && !bt.ta && !bt.tb; x += step) {
      simStep(bt.a, step);
      simStep(bt.b, step);
      bt.time += step;
      if (bt.a.objs.some(o => o.t >= bt.goalExp)) bt.ta = bt.time;
      if (bt.b.objs.some(o => o.t >= bt.goalExp)) bt.tb = bt.time;
    }
    const sa = simScore(bt.a), sb = simScore(bt.b);
    const tf = v => v.toFixed(2);
    $('arMeScore').textContent = bt.ta ? t().finish(tf(bt.ta)) : fmt(sa);
    $('arOppScore').textContent = bt.tb ? t().finish(tf(bt.tb)) : fmt(sb);
    $('arMeScore').classList.toggle('done', !!bt.ta);
    $('arOppScore').classList.toggle('done', !!bt.tb);
    // 進み具合：一番大きいオブジェクトのランクが GOAL にどれだけ近いか
    const prog = s => { const top = s.objs.reduce((m, o) => Math.max(m, o.t), -1); const base = (s.up.baseTier || 0); return top < base ? 0 : Math.min(100, (top - base + 1) / (bt.goalExp - base + 1) * 100); };
    $('arBarMe').style.width = (bt.ta ? 100 : prog(bt.a)) + '%';
    $('arBarOpp').style.width = (bt.tb ? 100 : prog(bt.b)) + '%';
    $('arTime').textContent = tf(Math.min(bt.time, BATTLE_SEC));
    drawSide($('arMeField'), bt.a, bt.me.skin);
    drawSide($('arOppField'), bt.b, bt.oppSkin);
    if (bt.ta || bt.tb || bt.time >= BATTLE_SEC - 1e-6) finishBattle(sa, sb);
  }

  $('arSkip').addEventListener('click', () => battleTick(true));

  function finishBattle(sa, sb) {
    const bt = battle;
    bt.done = true;
    clearInterval(bt.timer);
    const l = t();
    let r;
    if (bt.ta || bt.tb) {
      const A = bt.ta || Infinity, B = bt.tb || Infinity;
      r = A < B ? 'win' : A > B ? 'lose' : sa > sb ? 'win' : sa < sb ? 'lose' : 'draw';
    } else {
      r = sa > sb ? 'win' : sa < sb ? 'lose' : 'draw';
    }
    let bp = 0, soulDelta = 0, coins = 0, firstClear = false;
    if (bt.opp.stage) {
      // ステージ：勝てばコイン。負けても何も失わない
      if (r === 'win') {
        firstClear = bt.opp.stage > stageCleared();
        const rw = stageReward(bt.opp.stage, firstClear);
        coins = rw.coins; bp = rw.bp;
        addCoins(coins);
        if (firstClear) { PROFILE.stage = bt.opp.stage; stageSel = null; }
        sfx.win(); vibe([20, 30, 60]);
      } else if (r === 'lose') { sfx.lose(); vibe(40); }
    } else {
      if (r === 'win') { bp = 10 + Math.min(20, Math.floor(bt.bet / 5)); soulDelta = Math.floor(bt.bet * 0.9); PROFILE.wins++; sfx.win(); vibe([20, 30, 60]); }
      if (r === 'lose') { bp = 3; soulDelta = -bt.bet; PROFILE.losses++; sfx.lose(); vibe(40); }
    }
    S.soul = Math.max(0, S.soul + soulDelta);
    addBP(bp);
    PROFILE.history.unshift({ name: bt.opp.name || '???', r, bet: bt.bet, time: bt.ta || 0, at: Date.now() });
    PROFILE.history = PROFILE.history.slice(0, 20);
    save();
    saveProfile();
    // 相手の分身が防衛したら、相手に報酬を届ける
    if (r === 'lose' && bt.opp.uid && user && fb) {
      fb.F.addDoc(fb.F.collection(fb.db, 'bi_inbox'), { to: bt.opp.uid, from: PROFILE.name || '???', bp: 5, at: Date.now() }).catch(() => {});
    }
    syncSoon();
    setTimeout(() => {
      els.arena.hidden = true;
      battle = null;
      const tt = v => (v ? v.toFixed(2) + 's' : (bt.ta || bt.tb ? '—' : l.timeUp));
      const head = bt.ta || bt.tb ? l.resTime(tt(bt.ta), tt(bt.tb)) : `${fmt(sa)} — ${fmt(sb)}`;
      const text = bt.opp.stage
        ? `${head}<br>${r === 'win' ? l.stageWin(fmt(coins), bp, firstClear) : r === 'lose' ? l.stageLose : l.resDraw}`
        : r === 'draw' ? `${head}<br>${l.resDraw}` : `${head}<br>${r === 'win' ? l.resWin(bp, fmt(soulDelta)) : l.resLose(bp, bt.bet ? fmt(bt.bet) : 0)}`;
      showModal({
        rings: r === 'win' ? 'WIN' : r === 'lose' ? 'LOSE' : 'DRAW',
        title: `VS ${esc(bt.opp.name || '???')}`,
        text,
        buttons: [{ label: l.close, primary: true, onClick: () => { renderAll(); switchPanel('vs'); } }],
      });
    }, 900);
  }

  // ---------- 表示 ----------
  function render(sub) {
    if (sub === 'rank' || (!sub && $('sub-rank').classList.contains('on'))) renderRank();
    else renderBattle();
  }

  // 前回ログインしていたら、自動でログイン状態を戻す
  try { if (localStorage.getItem(AUTH_FLAG) === '1') loadFb().catch(() => {}); } catch (e) { /* 保存不可 */ }
  render();

  return { markDirty, syncSoon, syncNow, render, accountHTML, isLoggedIn: () => !!user, _sim: { simInit, simStep, simScore } };
})();

window.Online = Online;

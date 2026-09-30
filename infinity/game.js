'use strict';

// =====================================================
//  無限の次へ / Beyond ∞ — モノクロ合成インクリメンタル
// =====================================================

const VERSION = '2.1.0';
const SLOT_KEYS = ['infinity-merge-v2', 'infinity-merge-v2-s1', 'infinity-merge-v2-s2'];
const OLD_SAVE_KEY = 'infinity-merge-v1';
const BACKUP_KEY = 'infinity-merge-backup';
const SETTINGS_KEY = 'infinity-settings';
const PROFILE_KEY = 'infinity-profile';
const MAX_TIER = 20;             // 2^20 が「∞」
const OMEGA_DIM = 10;            // 次元10で ∞ を作ると Ω（ゴール）
const SPACE_CAPS = [16, 20, 24, 30, 36];   // 画面に置ける上限（ごちゃつかせない）
const SIZE_MULT = { S: 0.85, M: 1, L: 1.15 };
const CONFIRM_SELL_TIER = 10;
const PANELS = ['play', 'shop', 'gacha', 'vs', 'menu'];
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';

// ---------- 言語 ----------
const I18N = {
  ja: {
    coinUse: ['COIN の使い道', [
      '強化を買う（このページ）',
      '今回稼いだコインの合計が、転生で「魂」になる。強化に使っても魂は減らない',
      'コインは、オブジェクトを売る・生成ボーナス・ステージで勝つ、で手に入る',
    ]],
    shopSub: 'ステータス強化', menuSub: 'アカウント・スキン・記録・設定', vsSub: 'バトルとランキング',
    rebirthSub: '今の周回を終えて「魂」を得る。∞ を作っていれば次の次元へ。',
    soulSub: '魂で買う永遠強化。転生しても消えない。上限なし。',
    railDrop: '↓ ドロップで売却', railTap: 'タップで売却',
    tapAnywhere: 'どこでもタップ',
    full: '空間がいっぱい。合成するか売却しよう',
    infNoMerge: '∞ 同士は、まだ合わさらない',
    railHelp: 'オブジェクトをここへドラッグして売却',
    sold: v => `${v} で売却`, undo: '取り消す', undone: '売却を取り消した',
    autoSellDesc: '満杯なら最小を売って生成を続ける',
    infHave: n => `フィールドに ∞ が ${n} つある。`,
    infHaveSub: '∞ を増やすほど魂が増える。今転生すれば次の次元へ。',
    infGone: '∞ はもう、ここにはない。',
    infLeft: (n, g) => `この次元の ∞ は ${g}。あと ${n} 段階。`,
    infDim: (d, m) => `次元 ${d} ／ 収入 ×${m}`,
    infCurious: '無限の次、気にならない？',
    infLocked: 'LOCKED — ∞ を作ると解放',
    omegaLeft: (d, g) => `GOAL Ω — 次元 ${g} で ∞ を作る（いま次元 ${d}）`,
    omegaDone: t => `Ω CLEAR — ${t}`,
    stats: ['プレイ時間', 'タップ', '生成', '合成', '売却', '累計コイン', '最高ランク', '∞ を作った回数', '次元', '転生', 'Ω クリアタイム'],
    time: (h, m, s) => (h ? `${h}時間${m}分` : m ? `${m}分${s}秒` : `${s}秒`),
    reachedTitle: '無限に到達した。', reachedText: '…でも、無限の次って<br>気にならない？', keepPlaying: 'まだ続ける',
    beyondTitle: '無限の次へ進む？', beyondText: (n, m, s) => `コイン・オブジェクト・強化はリセット。<br>次元 +${n} ／ 収入 ×${m}${s ? ` ／ 魂 +${s}` : ''}`, cancel: 'やめる',
    dimTitle: d => `次元 ${d}`, dimText: (g, m) => `上限が ${g} まで伸びた。収入 ×${m}。<br>無限の、さらに次へ。`,
    newUpgrade: x => `新しい強化：${x}`, capUp: '強化の上限が伸びた。前より速く登れる。',
    eta: t => `あと約 ${t}`, unlockAt: d => `次元 ${d} で解放`,
    rebirthNext: d => `REBIRTH → DIM ${d}`, rebirthSame: 'REBIRTH', rebirthNextTitle: d => `次元 ${d} へ転生する？`, rebirthSameTitle: '転生する？',
    rebirthHintNext: '∞ を作ったので、転生すると次の次元へ進む。もう少し ∞ を作ってから押すと魂が増える。',
    rebirthHintSame: 'まだ ∞ がないので、転生しても同じ次元でやり直し。',
    rebirthConfirm: (n, k) => `コイン・オブジェクト・強化は 0 に戻る。永遠強化はそのまま。<br>魂 +${n}${k ? '<br>次の次元へ進む' : ''}`,
    rebirthDone: n => `転生した。魂 +${n}`,
    omegaTitle: 'Ω に到達した。', omegaText: (t, pen) => `クリアタイム ${t}。${pen ? `<br><small>（ブースト券の補正 +${pen} を含む）</small>` : ''}<br>無限の次の、そのまた先。<br>ここからは、終わりのない旅。`, omegaReward: 'スキン「墨」を解放した',
    offlineText: t => `留守の間（${t}）も、生成は続いていた。`,
    sellConfirmTitle: '本当に売る？', sellConfirmText: (r, p) => `${r} を ${p} コインで売却します。`, sell: 'SELL',
    resetTitle: 'このスロットのデータを消去する？', resetText: '元には戻せません（ひとつ前のデータに戻すことはできる）。',
    otherTab: '別のタブで起動したので、ここは停止した。', resumeHere: 'ここで再開',
    rebirth: {
      inherit: ['継承転生', '強化をひとつ選んで残す。魂は半分。'],
      clear: ['清算転生', 'すべて 0 に戻る。魂をまるごと得る。'],
      gain: n => `魂 +${n}`, locked: n => `あと ${n} コイン稼ぐと転生できる`,
      how: '魂の量は、この周回で稼いだコインと、どこまで到達したかで決まる。',
      rows: ['次元の基本', '途中でやめる：達成度', '次元', '共鳴', '∞ の数'],
      pickTitle: '残す強化を選ぶ', confirmTitle: '転生する？',
      confirmText: (n, keep) => `コイン・オブジェクト・強化は 0 に戻る${keep ? `（${keep} は残る）` : ''}。<br>次元とスキルはそのまま。魂 +${n}`,
      done: n => `転生した。魂 +${n}`,
    },
    soul: n => `魂 ${n}`,
    tut: [
      'どこでもタップ。オブジェクトが生まれる。<br>2つ作ってみよう。',
      '同じものをドラッグして重ねると合成。<br>1 + 1 = 2。',
      'いらないものは下の線へドラッグ。<br>売却してコインになる。',
      'コインで強化しよう。UPGRADE を開く。<br>（左右スワイプでもタブ移動できる）',
      '好きな強化をひとつ買ってみよう。',
      '合成を重ねて ∞ を目指そう。<br>…そして、無限の次へ。',
    ],
    tutBonus: 'チュートリアルボーナス',
    tips: {
      rebirth: '転生できるようになった。<br>UPGRADE → ∞ ETERNAL の REBIRTH で魂を得よう。∞ を作っていれば次の次元へ進める。',
      soul: '魂で永遠強化を買える。<br>転生しても消えず、上限もない。',
      versus: 'VERSUS：ステージや他のプレイヤーの分身と、全自動のタイムアタックで勝負。<br>勝つと COIN と SP がもらえる。',
      gacha: 'ガチャが解放された。<br>GACHA タブで SP を使ってスキンと背景を集めよう。毎日1回無料。',
      weekly: '週間チャレンジが解放された。<br>VERSUS → RANKING で、全員同じ条件のタイムアタックに挑戦できる。',
    },
    spCapped: 'この次元でプレイから得られる SP は上限（900）に達した。次の次元でまた貯まる',
    whatsNewTitle: 'アップデート v2.1',
    whatsNew: [
      'プレイで得る SP は1次元あたり900（10連分）まで',
      'ガチャのダブりは魂になる（永遠強化に使える）',
      'UPGRADE タブを「NORMAL / ∞ ETERNAL」に。転生と永遠強化はここへ',
      'GACHA タブを新設：今週のピックアップ・図鑑・排出率・履歴',
      '旧データの魂は新しい基準（今の次元までに得られる量）に置き換えた',
      '∞ を作るたびに上限が伸びる。下限は 1 から',
      '強化の上限が次元ごとに大きく伸び、新しい強化も増える（次元5で倍速モード）',
      '永遠強化5種。上限なし',
      '転生はボタン1つ。魂は ∞ の数で増える',
      'ガチャ：毎日1回無料。スキン700種以上と背景',
      'ランキングは「週間」と「超越者」に',
      '起動画面・省エネモード',
    ],
    slot: {
      title: 'SAVE SLOT', empty: 'EMPTY', playing: 'PLAYING', use: 'USE', start: 'NEW',
      info: (d, r, t) => `次元 ${d} ・ ${r} ・ ${t}`, switched: n => `スロット ${n} に切り替えた`,
    },
    skin: {
      equip: 'EQUIP', equipped: 'EQUIPPED', omegaOnly: 'Ω で解放', bp: n => `BP ${n}`,
      unlocked: n => `スキン「${n}」を解放した`, needBp: 'BP が足りない',
    },
    opt: {
      general: 'GENERAL', control: 'CONTROL', data: 'DATA',
      lang: ['言語', ''], sound: ['効果音', ''], vibe: ['振動', '対応端末のみ'],
      size: ['オブジェクトの大きさ', ''], confirm: ['高ランク売却の確認', `${pow2(CONFIRM_SELL_TIER)} 以上を売るとき確認する`],
      tutorial: ['チュートリアル', '操作をもう一度体験する'], play: 'PLAY',
      install: ['ホーム画面に追加', 'アイコンから全画面で遊べる'], installIos: 'Safari の共有ボタン →「ホーム画面に追加」',
      save: ['今すぐセーブ', '自動でも5秒ごとに保存'], saved: 'セーブした',
      export: ['データを書き出す', '機種変更・バックアップ用のコード'], import: ['データを読み込む', '書き出したコードを貼り付け'],
      restore: ['ひとつ前のデータに戻す', '読み込み・消去の直前の状態へ'], restored: 'ひとつ前のデータに戻した', noBackup: 'バックアップがない',
      reset: ['このスロットを消去', ''], on: 'ON', off: 'OFF',
      calm: ['動きを減らす', '揺れ・光・演出をおさえる'], sleep: ['省エネ画面', '画面を暗くして放置する（タップで戻る）'], autoSleep: ['自動で省エネ', '操作がないとき、省エネ画面にする'],
      exportTitle: '書き出しコード', exportText: 'このコードを保存しておけば、別の端末でも続きから遊べる。', copy: 'COPY', copied: 'コピーした', close: '閉じる',
      importTitle: 'データを読み込む', importText: '書き出しコードを貼り付けてください。今のスロットは上書きされます。', load: 'LOAD',
      imported: '読み込んだ', importFail: 'コードが正しくない',
    },
  },
  en: {
    coinUse: ['WHAT COINS ARE FOR', [
      'Buy upgrades (this page)',
      'Coins earned this run turn into Souls when you rebirth. Spending them does not lower your Souls',
      'Get coins by selling objects, from Spawn Bonus, and by winning stages',
    ]],
    shopSub: 'Status upgrades', menuSub: 'Account, skins, records and settings', vsSub: 'Battle & ranking',
    rebirthSub: 'End this run to earn Souls. If you made ∞, you move to the next dimension.',
    soulSub: 'Eternal upgrades bought with Souls. They survive rebirth. No cap.',
    railDrop: '↓ DROP TO SELL', railTap: 'TAP TO SELL',
    tapAnywhere: 'TAP ANYWHERE',
    full: 'No space. Merge or sell something.',
    infNoMerge: '∞ won’t merge… yet',
    railHelp: 'Drag an object here to sell it',
    sold: v => `Sold for ${v}`, undo: 'UNDO', undone: 'Sale undone',
    autoSellDesc: 'When full, sells the smallest to keep spawning',
    infHave: n => `There ${n > 1 ? 'are' : 'is'} ${n} ∞ on the field.`,
    infHaveSub: 'More ∞ means more Souls. Rebirth now to reach the next dimension.',
    infGone: '∞ is no longer here.',
    infLeft: (n, g) => `This dimension\u2019s ∞ is ${g}. ${n} step${n > 1 ? 's' : ''} to go.`,
    infDim: (d, m) => `Dimension ${d} / Income ×${m}`,
    infCurious: 'Aren’t you curious what lies beyond?',
    infLocked: 'LOCKED — make ∞ to unlock',
    omegaLeft: (d, g) => `GOAL Ω — make ∞ in dimension ${g} (now ${d})`,
    omegaDone: t => `Ω CLEAR — ${t}`,
    stats: ['Play time', 'Taps', 'Spawned', 'Merged', 'Sold', 'Total coins', 'Highest rank', '∞ made', 'Dimension', 'Rebirths', 'Ω clear time'],
    time: (h, m, s) => (h ? `${h}h ${m}m` : m ? `${m}m ${s}s` : `${s}s`),
    reachedTitle: 'You reached infinity.', reachedText: '…but aren’t you curious<br>what lies beyond?', keepPlaying: 'Keep playing',
    beyondTitle: 'Go beyond infinity?', beyondText: (n, m, s) => `Coins, objects and upgrades reset.<br>Dimension +${n} / Income ×${m}${s ? ` / Souls +${s}` : ''}`, cancel: 'Cancel',
    dimTitle: d => `Dimension ${d}`, dimText: (g, m) => `The ceiling rose to ${g}. Income ×${m}.<br>Beyond infinity, and further.`,
    newUpgrade: x => `New upgrade: ${x}`, capUp: 'Upgrade caps rose. You will climb faster than before.',
    eta: t => `about ${t} to go`, unlockAt: d => `Unlocks in dimension ${d}`,
    rebirthNext: d => `REBIRTH → DIM ${d}`, rebirthSame: 'REBIRTH', rebirthNextTitle: d => `Rebirth into dimension ${d}?`, rebirthSameTitle: 'Rebirth?',
    rebirthHintNext: 'You made ∞, so rebirth takes you to the next dimension. Make more ∞ first for more Souls.',
    rebirthHintSame: 'No ∞ yet, so rebirth restarts this same dimension.',
    rebirthConfirm: (n, k) => `Coins, objects and upgrades reset. Eternal upgrades stay.<br>Souls +${n}${k ? '<br>You move on to the next dimension' : ''}`,
    rebirthDone: n => `Reborn. Souls +${n}`,
    omegaTitle: 'You reached Ω.', omegaText: (t, pen) => `Clear time ${t}.${pen ? `<br><small>(includes a Boost ticket adjustment of +${pen})</small>` : ''}<br>Beyond the beyond.<br>From here, the journey never ends.`, omegaReward: 'Skin “Sumi” unlocked',
    offlineText: t => `While you were away (${t}), spawning continued.`,
    sellConfirmTitle: 'Sell this?', sellConfirmText: (r, p) => `Sell ${r} for ${p} coins.`, sell: 'SELL',
    resetTitle: 'Erase this slot?', resetText: 'This cannot be undone (you can restore the previous data once).',
    otherTab: 'The game was opened in another tab, so it paused here.', resumeHere: 'Resume here',
    rebirth: {
      inherit: ['Inherit', 'Keep one upgrade. Half the Souls.'],
      clear: ['Liquidate', 'Everything back to 0. All the Souls.'],
      gain: n => `Souls +${n}`, locked: n => `Earn ${n} more coins to rebirth`,
      how: 'Souls depend on the coins earned this run and how far you reached.',
      rows: ['Dimension base', 'Quit early: progress', 'Dimension', 'Resonance', '∞ count'],
      pickTitle: 'Choose an upgrade to keep', confirmTitle: 'Rebirth?',
      confirmText: (n, keep) => `Coins, objects and upgrades reset${keep ? ` (${keep} stays)` : ''}.<br>Dimension and skills stay. Souls +${n}`,
      done: n => `Reborn. Souls +${n}`,
    },
    soul: n => `Souls ${n}`,
    tut: [
      'Tap anywhere. An object appears.<br>Make two of them.',
      'Drag one onto its twin to merge.<br>1 + 1 = 2.',
      'Drag what you don’t need onto the line below<br>to sell it for coins.',
      'Spend coins on upgrades. Open UPGRADE.<br>(You can also swipe sideways.)',
      'Buy any upgrade you like.',
      'Keep merging toward ∞.<br>…and then, beyond.',
    ],
    tutBonus: 'Tutorial bonus',
    tips: {
      rebirth: 'You can rebirth now.<br>Use REBIRTH in UPGRADE → ∞ ETERNAL to earn Souls. With an ∞ you move on to the next dimension.',
      soul: 'Spend Souls on Eternal upgrades.<br>They survive every rebirth and have no cap.',
      versus: 'VERSUS: automatic time attacks against stages and copies of other players.<br>Wins give COIN and SP.',
      gacha: 'The Gacha is open.<br>Spend SP in the GACHA tab to collect skins and backgrounds. One free pull a day.',
      weekly: 'The Weekly Challenge is open.<br>In VERSUS → RANKING, race everyone under the same rules.',
    },
    spCapped: 'You’ve hit this dimension’s SP cap from play (900). It refills in the next dimension',
    whatsNewTitle: 'Update v2.1',
    whatsNew: [
      'SP from play is capped at 900 (one ×10) per dimension',
      'Gacha duplicates now give Souls for Eternal upgrades',
      'UPGRADE now has NORMAL / ∞ ETERNAL. Rebirth and Eternal upgrades live there',
      'New GACHA tab: weekly pick-up, collection, rates and history',
      'Souls from old saves are converted to the new scale (what this dimension would have earned)',
      'Each ∞ raises the ceiling. The floor always starts at 1',
      'Upgrade caps grow each dimension, with new upgrades (Speed Mode at dimension 5)',
      'Five eternal upgrades with no cap',
      'One rebirth button. Souls grow with how many ∞ you made',
      'Gacha: one free pull a day, 700+ skins and backgrounds',
      'Rankings: Weekly and Transcendent',
      'Title screens and a power-saving mode',
    ],
    slot: {
      title: 'SAVE SLOT', empty: 'EMPTY', playing: 'PLAYING', use: 'USE', start: 'NEW',
      info: (d, r, t) => `Dim ${d} · ${r} · ${t}`, switched: n => `Switched to slot ${n}`,
    },
    skin: {
      equip: 'EQUIP', equipped: 'EQUIPPED', omegaOnly: 'Reach Ω', bp: n => `BP ${n}`,
      unlocked: n => `Skin “${n}” unlocked`, needBp: 'Not enough BP',
    },
    opt: {
      general: 'GENERAL', control: 'CONTROL', data: 'DATA',
      lang: ['Language', ''], sound: ['Sound', ''], vibe: ['Vibration', 'Supported devices only'],
      size: ['Object size', ''], confirm: ['Confirm high-rank sales', `Ask before selling ${pow2(CONFIRM_SELL_TIER)} or higher`],
      tutorial: ['Tutorial', 'Try the controls again'], play: 'PLAY',
      install: ['Add to home screen', 'Play full-screen from an icon'], installIos: 'In Safari: Share → “Add to Home Screen”',
      save: ['Save now', 'Also saves every 5 seconds'], saved: 'Saved',
      export: ['Export data', 'A code for backups or moving devices'], import: ['Import data', 'Paste an exported code'],
      restore: ['Restore previous data', 'State right before the last import/erase'], restored: 'Previous data restored', noBackup: 'No backup found',
      reset: ['Erase this slot', ''], on: 'ON', off: 'OFF',
      calm: ['Reduce motion', 'Tone down wobble, glow and effects'], sleep: ['Power save', 'Dim the screen while idling (tap to return)'], autoSleep: ['Auto power save', 'Switch to power save when idle'],
      exportTitle: 'Export code', exportText: 'Keep this code to continue on another device.', copy: 'COPY', copied: 'Copied', close: 'Close',
      importTitle: 'Import data', importText: 'Paste an export code. The current slot will be overwritten.', load: 'LOAD',
      imported: 'Imported', importFail: 'Invalid code',
    },
  },
};

// ---------- 設定（端末ごと） ----------
function loadSettings() {
  const def = {
    lang: /^ja/i.test(navigator.language || '') ? 'ja' : 'en',
    sound: true, vibe: true, size: 'M', confirmSell: true, tutorialDone: false,
    slot: 0, tips: {}, seenVersion: '',
    calm: !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches), autoSleep: 0,
  };
  try {
    const o = { ...def, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') };
    if (!(o.slot >= 0 && o.slot < SLOT_KEYS.length)) o.slot = 0;
    if (!o.tips || typeof o.tips !== 'object') o.tips = {};
    return o;
  } catch (e) { return def; }
}
const OPT = loadSettings();
function saveSettings() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(OPT)); } catch (e) { /* 保存不可 */ } }
const L = () => I18N[OPT.lang] || I18N.ja;

// ---------- プロフィール（アカウント共通：BP・スキン・戦績） ----------
function normalizeProfile(p) {
  const def = { bp: 0, bpTotal: 0, stage: 0, skins: ['CIRCLE'], skin: 'CIRCLE', bgs: ['DOTS'], bg: 'DOTS', tickets: {}, pity: 0, pulls: 0, dailyAt: 0, loginAt: 0, maxDim: 1, everInf: false, weekly: {}, weeklyClaimed: 0, pickGuard: false, gachaLog: [], lgCount: 0, wins: 0, losses: 0, name: '', updated: 0, history: [] };
  p = { ...def, ...(p || {}) };
  if (!Array.isArray(p.skins)) p.skins = ['CIRCLE'];
  p.skins = [...new Set(['CIRCLE', ...p.skins.filter(isSkinId)])];
  if (!p.skins.includes(p.skin)) p.skin = 'CIRCLE';
  if (!Array.isArray(p.bgs)) p.bgs = ['DOTS'];
  p.bgs = [...new Set(['DOTS', ...p.bgs.filter(isBgId)])];
  if (!p.bgs.includes(p.bg)) p.bg = 'DOTS';
  if (!Array.isArray(p.history)) p.history = [];
  if (!Array.isArray(p.gachaLog)) p.gachaLog = [];
  p.gachaLog = p.gachaLog.filter(e => e && (e.k === 'bg' ? isBgId(e.id) : isSkinId(e.id))).slice(0, 50);
  p.pickGuard = !!p.pickGuard;
  if (!p.tickets || typeof p.tickets !== 'object') p.tickets = {};
  ['x2', 'rank', 'jump'].forEach(k => { p.tickets[k] = Math.max(0, Math.floor(p.tickets[k] || 0)); });
  if (!p.weekly || typeof p.weekly !== 'object') p.weekly = {};
  ['bp', 'bpTotal', 'stage', 'wins', 'losses', 'updated', 'pity', 'pulls', 'dailyAt', 'loginAt', 'maxDim', 'weeklyClaimed', 'lgCount'].forEach(k => { if (!Number.isFinite(p[k]) || p[k] < 0) p[k] = 0; });
  p.maxDim = Math.max(1, p.maxDim);
  p.bpTotal = Math.max(p.bpTotal, p.bp);   // 以前のデータは今の BP から
  return p;
}
function loadProfile() {
  try { return normalizeProfile(JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}')); } catch (e) { return normalizeProfile({}); }
}
let PROFILE = loadProfile();
// BP を得る（ランキング用に累計も数える）
function addBP(n) {
  PROFILE.bp += n;
  PROFILE.bpTotal += n;
}

function saveProfile(touch = true) {
  if (touch) PROFILE.updated = Date.now();
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(PROFILE)); } catch (e) { /* 保存不可 */ }
  if (window.Online) Online.markDirty();
}

// ---------- 強化の説明（名前をタップで開く） ----------
const HELP = {
  autoGen: ['何もしなくても、一定時間ごとにオブジェクトが1つ自動で生まれる。レベルを上げるほど間隔が短くなる。アプリを閉じている間の報酬もこれで決まる。',
    'Spawns one object automatically at a fixed interval, even while you do nothing. Higher levels shorten the interval. It also decides your offline earnings.'],
  autoMerge: ['同じランクのペアを自動で見つけて合成する。小さいペアから順番に。レベルを上げるほど速くなる。',
    'Finds matching pairs and merges them for you, smallest first. Higher levels merge faster.'],
  spawnCoin: ['オブジェクトが生まれるたびに（タップでも自動でも）コインがもらえる。自動生成と組み合わせると、放置でも稼げる。',
    'Gives coins every time an object is born, by tap or automatically. Pairs well with Auto Spawn for idle income.'],
  sellMult: ['オブジェクトを売ったときのコインが増える。Lv1 ごとに +25%。',
    'Increases the coins you get when selling. +25% per level.'],
  tapPower: ['画面を1回タップしたときに生まれるオブジェクトの数が増える。',
    'More objects are born from a single tap.'],
  luck: ['オブジェクトが生まれるとき、この確率で「ひとつ上のランク（2倍の価値）」で生まれる。例：5% なら 20回に1回くらい、1 ではなく 2 が出る。',
    'Each new object has this chance to be born one rank higher (double value). At 5%, about 1 in 20 spawns is a 2 instead of a 1.'],
  space: ['フィールドに置けるオブジェクトの上限が増える。高いランクを作るには、途中のランクを置いておく場所が必要になる。',
    'Raises how many objects fit on the field. Building high ranks needs room to hold the ranks in between.'],
  baseTier: ['生まれるオブジェクトの最低ランクが上がる。Lv1 なら 1 ではなく 2 から、Lv3 なら 8 から生まれる。∞ への一番の近道。次元が上がるほど上限が伸びる。',
    'Raises the rank objects are born at. Lv1 starts at 2 instead of 1, Lv3 at 8. The fastest road to ∞. The cap grows with each dimension.'],
  autoSell: ['フィールドが満杯のとき、一番小さいオブジェクトを自動で売って、自動生成を止めない。次元2からは最初から付いている。',
    'When the field is full, sells the smallest object so Auto Spawn never stops. Included for free from dimension 2.'],
  chain: ['合成してできたオブジェクトに同じランクの相手がいれば、この確率ですぐに続けて合成する。連鎖すると一気にランクが上がる。',
    'When a merge creates an object that has a twin on the field, it merges again right away at this chance. Chains climb fast.'],
  multi: ['自動生成のたびに、この確率でもう1つ追加で生まれる。',
    'Each automatic spawn has this chance to spawn one extra object.'],
  speed: ['ゲーム全体の時間が速く進む。自動生成・自動合成・倍速中の放置すべてが速くなる。',
    'Makes the whole game run faster: auto spawn, auto merge, everything.'],
  eRank: ['最初から、生成ランクより上のランクで生まれる。1レベルごとに +1 段。転生しても消えない。上限なし。',
    'Objects are born this many ranks above your Base Rank. +1 per level. Survives rebirth. No cap.'],
  eSpeed: ['自動生成と自動合成が速くなる。1レベルごとに ×1.1。転生しても消えない。上限なし。',
    'Auto Spawn and Auto Merge run faster, ×1.1 per level. Survives rebirth. No cap.'],
  eCoin: ['すべてのコイン収入が増える。1レベルごとに +50%。転生しても消えない。上限なし。',
    'All coin income +50% per level. Survives rebirth. No cap.'],
  eLuck: ['幸運に上乗せして、ひとつ上のランクで生まれる確率が1レベルごとに +3%。転生しても消えない。上限なし（確率は最大95%）。',
    'Adds +3% per level to the chance of being born one rank higher. Survives rebirth. No cap (the chance tops out at 95%).'],
  eSoul: ['転生で得られる魂が1レベルごとに +25%。転生しても消えない。上限なし。',
    'Souls from rebirth +25% per level. Survives rebirth. No cap.'],
};
const helpOpen = new Set();

// ---------- 次元と上限 ----------
// 下限はいつも 1。上限（∞ になるランク）が次元ごとに +2 伸びる
const dimOf = (s = S) => s.shards + 1;
const infTier = (s = S) => MAX_TIER + 2 * (dimOf(s) - 1);
let MODE = null;   // 'weekly' のときは週間チャレンジ中
function INF() { return MODE === 'weekly' ? MAX_TIER : infTier(S); }
const speedMultOf = lv => (lv <= 0 ? 1 : lv === 1 ? 1.5 : lv);

// ---------- ステータス強化 ----------
// max(d)：次元 d での上限。unlock：その次元から出てくる
const UPGRADES = [
  {
    id: 'autoGen', jp: '自動生成', en: 'Auto Spawn', unlock: 1, max: d => 25 + 10 * (d - 1),
    cost: lv => 15 * Math.pow(1.5, lv),
    desc: lv => lv === 0 ? 'OFF → 3.00s' : `${genInterval(lv).toFixed(2)}s → ${genInterval(lv + 1).toFixed(2)}s`,
  },
  {
    id: 'autoMerge', jp: '自動合成', en: 'Auto Merge', unlock: 1, max: d => 25 + 10 * (d - 1),
    cost: lv => 40 * Math.pow(1.55, lv),
    desc: lv => lv === 0 ? 'OFF → 2.50s' : `${mergeInterval(lv).toFixed(2)}s → ${mergeInterval(lv + 1).toFixed(2)}s`,
  },
  {
    id: 'spawnCoin', jp: '生成ボーナス', en: 'Spawn Bonus', unlock: 1, max: d => 50 + 25 * (d - 1),
    cost: lv => 10 * Math.pow(1.45, lv),
    desc: lv => `+${fmt(0.1 * lv)} → +${fmt(0.1 * (lv + 1))}`,
  },
  {
    id: 'sellMult', jp: '売却倍率', en: 'Sell Rate', unlock: 1, max: d => 60 + 30 * (d - 1),
    cost: lv => 25 * Math.pow(1.5, lv),
    desc: lv => `×${(1 + 0.25 * lv).toFixed(2)} → ×${(1 + 0.25 * (lv + 1)).toFixed(2)}`,
  },
  {
    id: 'tapPower', jp: 'タップ強化', en: 'Multi Tap', unlock: 1, max: d => Math.min(12, 4 + (d - 1)),
    cost: lv => 60 * Math.pow(3.5, lv),
    desc: lv => `${lv + 1} → ${lv + 2}`,
  },
  {
    id: 'luck', jp: '幸運', en: 'Luck', unlock: 1, max: d => Math.min(19, 10 + 2 * (d - 1)),
    cost: lv => 80 * Math.pow(1.9, lv),
    desc: lv => `${lv * 5}% → ${(lv + 1) * 5}%`,
  },
  {
    id: 'space', jp: '空間拡張', en: 'Space', unlock: 1, max: () => SPACE_CAPS.length - 1,
    cost: lv => 150 * Math.pow(12, lv),
    desc: lv => `${SPACE_CAPS[lv]} → ${SPACE_CAPS[Math.min(lv + 1, SPACE_CAPS.length - 1)]} objects`,
  },
  {
    id: 'baseTier', jp: '生成ランク', en: 'Base Rank', unlock: 1, max: d => 10 + 2 * (d - 1),   // 上限と同じ +2/次元（∞ との差はいつも10段）
    cost: lv => 400 * Math.pow(3.2, lv),
    desc: lv => `${pow2(lv)} → ${pow2(lv + 1)}`,
  },
  {
    id: 'autoSell', jp: '自動売却', en: 'Auto Sell', unlock: 1, max: () => 1,
    cost: () => 300,
    desc: () => L().autoSellDesc,
  },
  {
    id: 'chain', jp: '連鎖合成', en: 'Chain Merge', unlock: 2, max: () => 10,
    cost: lv => 5e3 * Math.pow(2.2, lv),
    desc: lv => `${lv * 10}% → ${(lv + 1) * 10}%`,
  },
  {
    id: 'multi', jp: 'まとめ生成', en: 'Multi Spawn', unlock: 3, max: () => 10,
    cost: lv => 5e4 * Math.pow(2.3, lv),
    desc: lv => `${lv * 10}% → ${(lv + 1) * 10}%`,
  },
  {
    id: 'speed', jp: '倍速モード', en: 'Speed Mode', unlock: 5, max: d => Math.max(0, 2 + (d - 5)),
    cost: lv => 1e6 * Math.pow(25, lv),
    desc: lv => `×${speedMultOf(lv)} → ×${speedMultOf(lv + 1)}`,
  },
];
const umax = (u, s = S) => u.max(dimOf(s));
const uUnlocked = (u, s = S) => dimOf(s) >= u.unlock;

// ---------- 永遠強化（魂で買う・上限なし） ----------
// 値段は1回買うごとに ×1.5, ×1.55, ×1.6 … と倍率そのものが上がる（なかなか貯まらない）
function eCost(base, lv) { let c = base; for (let i = 0; i < lv; i++) c *= 1.5 + 0.05 * i; return Math.ceil(c); }
const ETERNAL_OPEN = s => s.shards >= 1;   // 永遠強化は、次元を1つ突破してから
const ETERNAL = [
  { id: 'eRank', jp: '永遠の生成ランク', en: 'Eternal Rank', cost: lv => eCost(200, lv),
    desc: lv => ({ ja: `+${lv} → +${lv + 1} 段`, en: `+${lv} → +${lv + 1} ranks` }) },
  { id: 'eSpeed', jp: '永遠の速さ', en: 'Eternal Speed', cost: lv => eCost(80, lv),
    desc: lv => ({ ja: `×${Math.pow(1.1, lv).toFixed(2)} → ×${Math.pow(1.1, lv + 1).toFixed(2)}`, en: `×${Math.pow(1.1, lv).toFixed(2)} → ×${Math.pow(1.1, lv + 1).toFixed(2)}` }) },
  { id: 'eCoin', jp: '永遠の富', en: 'Eternal Wealth', cost: lv => eCost(50, lv),
    desc: lv => ({ ja: `コイン ×${(1 + 0.5 * lv).toFixed(1)} → ×${(1 + 0.5 * (lv + 1)).toFixed(1)}`, en: `Coins ×${(1 + 0.5 * lv).toFixed(1)} → ×${(1 + 0.5 * (lv + 1)).toFixed(1)}` }) },
  { id: 'eLuck', jp: '永遠の幸運', en: 'Eternal Luck', cost: lv => eCost(100, lv),
    desc: lv => ({ ja: `+${lv * 3}% → +${(lv + 1) * 3}%`, en: `+${lv * 3}% → +${(lv + 1) * 3}%` }) },
  { id: 'eSoul', jp: '魂の共鳴', en: 'Soul Resonance', cost: lv => eCost(120, lv),
    desc: lv => ({ ja: `魂 +${lv * 25}% → +${(lv + 1) * 25}%`, en: `Souls +${lv * 25}% → +${(lv + 1) * 25}%` }) },
];

// ---------- 状態（スロットごと） ----------
function freshBoost() { return { x2: 0, rank: 0, jump: 0, used: 0 }; }
function freshState(keep) {
  const up = {};
  UPGRADES.forEach(u => (up[u.id] = 0));
  const eternal = {};
  ETERNAL.forEach(k => (eternal[k.id] = 0));
  const s = {
    coins: 0,
    objs: [],          // { id, t, x, y }  x,y はフィールド比率 0..1
    nextId: 1,
    up,
    shards: 0,
    soul: 0,
    eternal,
    runEarned: 0,
    runMaxTier: 0,
    runRanks: 0,       // この周回で SP をもらった最高ランク
    clearTime: 0,
    boost: freshBoost(),
    spDim: { d: 0, got: 0 },   // この次元でプレイから得た SP
    stats: {
      spawned: 0, merged: 0, sold: 0, earned: 0, maxTier: 0,
      infinities: 0, playTime: 0, taps: 0, bought: 0, rebirths: 0,
      boostPen: 0,   // ブースト券で得した時間（Ω タイムに足してランキングを公平に）
    },
    seenInf: false,
    created: Date.now(),
    last: Date.now(),
  };
  if (keep) {
    Object.assign(s, {
      shards: keep.shards, soul: keep.soul, eternal: { ...eternal, ...keep.eternal },
      stats: keep.stats, clearTime: keep.clearTime, created: keep.created, seenInf: keep.seenInf, spDim: keep.spDim,
    });
  }
  if (dimOf(s) >= 2) s.up.autoSell = 1;   // 次元2からは最初から付いている
  return s;
}

function clamp01(v) { return Number.isFinite(v) ? Math.min(0.97, Math.max(0.03, v)) : 0.5; }

function normalize(d) {
  const base = freshState();
  const s = {
    ...base, ...d,
    up: { ...base.up, ...(d.up || {}) },
    eternal: { ...base.eternal, ...(d.eternal || {}) },
    stats: { ...base.stats, ...(d.stats || {}) },
    boost: { ...freshBoost(), ...(d.boost || {}) },
  };
  ['coins', 'soul', 'shards', 'runEarned', 'runMaxTier', 'runRanks', 'clearTime'].forEach(k => { if (!Number.isFinite(s[k]) || s[k] < 0) s[k] = 0; });
  s.shards = Math.floor(s.shards);
  // 以前の魂スキルは、使った魂を返して永遠強化へ
  // 旧データ（魂スキルがあり永遠強化がない）：魂は桁が違うので、v2 で今の次元までに得られる量に置き換える
  if (d.skills && !d.eternal) {
    let v2 = 0;
    for (let k = 0; k < s.shards; k++) v2 += 40 + 10 * k;
    s.soul = v2;
  }
  delete s.skills;
  if (!s.spDim || typeof s.spDim !== 'object') s.spDim = { d: s.shards, got: 0 };
  if (!Array.isArray(s.objs)) s.objs = [];
  const top = infTier(s);
  s.objs = s.objs.filter(o => o && Number.isFinite(o.t) && o.t >= 0)
    .map(o => ({ id: o.id, t: Math.min(Math.floor(o.t), top), x: clamp01(o.x), y: clamp01(o.y) }));
  if (!Number.isFinite(d.runMaxTier)) s.runMaxTier = s.objs.reduce((m, o) => Math.max(m, o.t), 0);
  s.nextId = Math.max(s.nextId || 1, ...s.objs.map(o => (o.id || 0) + 1), 1);
  s.objs.forEach(o => { if (!o.id) o.id = s.nextId++; });
  UPGRADES.forEach(u => { s.up[u.id] = Math.min(u.max(dimOf(s)), Math.max(0, Math.floor(s.up[u.id] || 0))); });
  if (dimOf(s) >= 2) s.up.autoSell = 1;
  ETERNAL.forEach(k => { s.eternal[k.id] = Math.max(0, Math.floor(s.eternal[k.id] || 0)); });
  delete s.up.board;
  return s;
}

function readSlot(i) {
  try {
    const raw = localStorage.getItem(SLOT_KEYS[i]);
    if (raw) return normalize(JSON.parse(raw));
    if (i === 0) {
      // v1（グリッド版）からの引き継ぎ
      const old = localStorage.getItem(OLD_SAVE_KEY);
      if (old) {
        const d = JSON.parse(old);
        const up = { ...(d.up || {}), space: (d.up && d.up.board) || 0 };
        const s = normalize({ coins: d.coins, shards: d.shards, seenInf: d.seenInf, up, stats: d.stats });
        (d.board || []).filter(t => t >= 0).slice(0, SPACE_CAPS[s.up.space]).forEach(t => {
          s.objs.push({ id: s.nextId++, t, x: 0.1 + Math.random() * 0.8, y: 0.1 + Math.random() * 0.8 });
        });
        return s;
      }
    }
  } catch (e) { /* 破損データは無視 */ }
  return null;
}

let S = readSlot(OPT.slot) || freshState();
let paused = false;   // 別タブで起動したとき
let booting = true;   // 起動画面の間はゲームを進めない

function save() {
  if (paused || MODE) return;   // 週間チャレンジ中はスロットに書かない
  S.last = Date.now();
  try { localStorage.setItem(SLOT_KEYS[OPT.slot], JSON.stringify(S)); } catch (e) { /* 保存不可 */ }
  if (window.Online) Online.markDirty();
}

function backup() {
  if (MODE) return;
  try { localStorage.setItem(BACKUP_KEY, JSON.stringify(S)); } catch (e) { /* 保存不可 */ }
}

// ---------- 計算 ----------
const genInterval = lv => Math.max(0.03, 3 * Math.pow(0.86, lv - 1));
const mergeInterval = lv => Math.max(0.03, 2.5 * Math.pow(0.86, lv - 1));
const E = id => (MODE ? 0 : S.eternal[id] || 0);   // 週間チャレンジでは永遠強化を使わない
const prestigeMult = () => Math.pow(2, S.shards);
const incomeMult = () => prestigeMult() * (1 + 0.5 * E('eCoin'));
const sellMult = () => (1 + 0.25 * S.up.sellMult) * incomeMult();
const sellPrice = t => Math.pow(2, t) * sellMult();
const spawnCoin = () => 0.1 * S.up.spawnCoin * incomeMult();
const cap = () => SPACE_CAPS[S.up.space];
// 通常強化の値段：次元ごとに ×2（収入 ×2 を打ち消す。毎回ランク1からやり直すので、序盤は次元1と同じ手ごたえ）。
// 前の次元の上限までは今まで通りの伸び、それより上の新しいレベルは1段ごとにさらに ×1.5
const DIM_COST = 2, NEW_LV_COST = 1.5;
function upCostAt(u, lv, d) {
  if (u.id === 'autoSell') return u.cost(lv);
  const prev = d - 1 >= u.unlock ? u.max(d - 1) : Infinity;
  return Math.ceil(u.cost(lv) * Math.pow(DIM_COST, d - 1) * Math.pow(NEW_LV_COST, Math.max(0, lv - prev + 1)));
}
const upCost = u => (MODE ? Math.ceil(u.cost(S.up[u.id])) : upCostAt(u, S.up[u.id], dimOf()));
const eternalCost = k => k.cost(S.eternal[k.id]);
// ゲームの進む速さ（倍速モード × 2倍速券）
const gameSpeed = () => speedMultOf(S.up.speed || 0) * (S.boost.x2 > 0 ? 2 : 1);
const autoRate = () => Math.pow(1.1, E('eSpeed'));
function pow2(t) { return '2' + String(t).split('').map(c => SUP[c]).join(''); }
const rankName = t => (t >= INF() ? '∞' : pow2(t));
const dimStr = (s = S) => String(s.shards + 1).padStart(2, '0');
const offlineCapSec = () => 12 * 3600;
const offlineRate = () => 0.6;

// 転生で得られる魂（数値はバランス表から）
//   ∞ を作って転生：(40 + 10×(次元-1)) × ∞の数ボーナス × 共鳴
//   途中でやめる：達成度（上限までの道のり 10%ごとに1）× 2 × 共鳴
//   コインの稼ぎには比例させない（稼ぎ→魂→永遠強化→稼ぎ…の雪だるまを防ぐ）
const REBIRTH_MIN = 1000;   // ∞ を作っていなければ、今回これだけ稼ぐと転生できる
function soulParts() {
  const n = infCount();
  const steps = Math.floor(10 * Math.min(S.runMaxTier, INF()) / INF());   // 達成度 0〜10
  const earn = n > 0 ? 40 + 10 * S.shards : 2 * steps;
  const inf = n > 0 ? 1 + 0.5 * Math.log2(n) : 1;   // ∞1つ×1、2つ×1.5、4つ×2
  const res = 1 + 0.25 * E('eSoul');
  const ok = n > 0 || (S.runEarned >= REBIRTH_MIN && steps > 0);
  return { n, steps, earn, inf, res, total: ok && !MODE ? Math.floor(earn * inf * res) : 0 };
}
const soulBase = () => soulParts().total;
const soulToNext = () => Math.max(0, Math.ceil(REBIRTH_MIN - S.runEarned));

function fmt(n) {
  if (n < 1000) {
    return Number.isInteger(n) ? String(n) : n.toFixed(n < 10 ? 1 : 0).replace(/\.0$/, '');
  }
  const units = ['K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
  const exp = Math.floor(Math.log10(n) / 3);
  if (exp - 1 < units.length) {
    return (n / Math.pow(1000, exp)).toFixed(1).replace(/\.0$/, '') + units[exp - 1];
  }
  return n.toExponential(2).replace('+', '');
}

function fmtCoins(n) {
  if (n >= 1e6) return fmt(n);
  const v = Math.floor(n * 10) / 10;
  return Number.isInteger(v) ? v.toLocaleString('en-US') : v.toLocaleString('en-US', { minimumFractionDigits: 1 });
}

function fmtTime(sec) {
  sec = Math.floor(sec);
  return L().time(Math.floor(sec / 3600), Math.floor((sec % 3600) / 60), sec % 60);
}

function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

// ---------- 画面参照 ----------
const $ = id => document.getElementById(id);
const els = {
  coins: $('coins'), rate: $('rate'), dim: $('dim'), count: $('count'), main: $('main'),
  field: $('field'), fieldHint: $('fieldHint'), rail: $('rail'), railText: $('railText'), railPrice: $('railPrice'),
  upgrades: $('upgrades'), infPath: $('infPath'), infMain: $('infMain'), infSub: $('infSub'), infNote: $('infNote'),
  omegaBar: $('omegaBar'), rebirth: $('rebirth'), skills: $('skills'),
  prestigeBtn: $('prestigeBtn'), stats: $('stats'), dex: $('dex'), options: $('options'),
  account: $('sub-account'), gachaBadge: $('gachaBadge'), segNormalDot: $('segNormalDot'),
  shopBadge: $('shopBadge'), infBadge: $('infBadge'), vsBadge: $('vsBadge'), menuBadge: $('menuBadge'),
  modal: $('modal'), modalRings: $('modalRings'), modalBody: $('modalBody'), modalButtons: $('modalButtons'),
  toast: $('toast'), toastText: $('toastText'), toastAction: $('toastAction'),
  tut: $('tut'), tutStep: $('tutStep'), tutText: $('tutText'), tutSkip: $('tutSkip'), tutNext: $('tutNext'), hand: $('hand'),
  arena: $('arena'),
};

// ---------- 効果音・振動 ----------
let audio = null;
function tone(freq, dur = 0.06, vol = 0.05, type = 'sine', delay = 0) {
  if (!OPT.sound) return;
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
    const t0 = audio.currentTime + delay;
    const o = audio.createOscillator(), g = audio.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(audio.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  } catch (e) { /* 音が出せない環境 */ }
}
const sfx = {
  spawn: () => tone(880, 0.04, 0.025),
  merge: t => tone(220 * Math.pow(2, Math.min(t, 24) / 6), 0.12, 0.06, 'triangle'),
  sell: () => { tone(660, 0.05, 0.04); tone(990, 0.08, 0.04, 'sine', 0.05); },
  inf: () => [0, 4, 7, 12].forEach((s, i) => tone(262 * Math.pow(2, s / 12), 0.9, 0.04, 'sine', i * 0.08)),
  omega: () => [0, 7, 12, 16, 19, 24].forEach((s, i) => tone(196 * Math.pow(2, s / 12), 1.6, 0.035, 'sine', i * 0.12)),
  buy: () => tone(520, 0.08, 0.04, 'square'),
  deny: () => tone(140, 0.1, 0.04, 'square'),
  win: () => [0, 4, 7].forEach((s, i) => tone(440 * Math.pow(2, s / 12), 0.25, 0.05, 'triangle', i * 0.1)),
  lose: () => [7, 3, 0].forEach((s, i) => tone(220 * Math.pow(2, s / 12), 0.3, 0.05, 'triangle', i * 0.12)),
};
function vibe(ms) { if (OPT.vibe && navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) { /* 非対応 */ } } }

// ---------- 幾何 ----------
let fieldBox = null;
function fieldRect() { return fieldBox || (fieldBox = els.field.getBoundingClientRect()); }
function scale() { return Math.min(1.25, Math.max(0.8, fieldRect().width / 390)) * SIZE_MULT[OPT.size]; }
// 大きさは「上限に対してどこまで来たか」で決める（次元が上がっても画面に収まる）
function diameter(t) { const inf = INF(); return (t >= inf ? 136 : 24 + t * 104 / inf) * scale(); }
function toPx(o) { const r = fieldRect(); return { x: o.x * r.width, y: o.y * r.height }; }

function clampPos(t, x, y) {
  const r = fieldRect();
  const d = diameter(t) + 8;
  const mx = Math.min(0.5, (d / 2) / r.width), my = Math.min(0.5, (d / 2) / r.height);
  return { x: Math.min(1 - mx, Math.max(mx, x)), y: Math.min(1 - my, Math.max(my, y)) };
}

// 他と重なりにくい空き場所を探す
function findSpot(t) {
  const r = fieldRect();
  const d = diameter(t);
  const y0 = tut ? 0.35 : 0, yr = tut ? 0.5 : 1;   // チュートリアル中は説明カードに隠れないよう中央寄り
  let best = null, bestGap = -Infinity;
  for (let i = 0; i < 30; i++) {
    const p = clampPos(t, RNG(), y0 + RNG() * yr);
    let minGap = Infinity;
    for (const o of S.objs) {
      const q = toPx(o);
      const gap = Math.hypot(q.x - p.x * r.width, q.y - p.y * r.height) - (diameter(o.t) + d) / 2;
      if (gap < minGap) minGap = gap;
    }
    if (minGap > 10) return p;
    if (minGap > bestGap) { bestGap = minGap; best = p; }
  }
  return best;
}

// 重なった別ランクのオブジェクトから押し出す
function separate(o) {
  const r = fieldRect();
  for (let iter = 0; iter < 10; iter++) {
    let moved = false;
    const p = toPx(o);
    for (const other of S.objs) {
      if (other === o || busy.has(other.id)) continue;
      const q = toPx(other);
      const min = (diameter(o.t) + diameter(other.t)) / 2 + 4;
      let dx = p.x - q.x, dy = p.y - q.y;
      const dist = Math.hypot(dx, dy);
      if (dist >= min) continue;
      if (dist < 0.01) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; }
      const len = Math.hypot(dx, dy);
      p.x += (dx / len) * (min - dist);
      p.y += (dy / len) * (min - dist);
      moved = true;
    }
    Object.assign(o, clampPos(o.t, p.x / r.width, p.y / r.height));
    if (!moved) break;
  }
}

// ---------- ゲーム操作 ----------
const byId = id => S.objs.find(o => o.id === id);
const busy = new Set();   // 合成アニメ中
let selected = null;
let RNG = Math.random;   // 週間チャレンジ中は全員同じ乱数に差し替える

function rollTier() {
  let t = S.up.baseTier + E('eRank') + (MODE ? 0 : S.boost.rank);
  if (RNG() < Math.min(0.95, S.up.luck * 0.05 + E('eLuck') * 0.03)) t++;
  return Math.min(t, INF() - 1);
}

// SP（スキンポイント）を得る
// プレイで得る SP は1次元あたり10連分（900）まで。∞ が量産できるようになっても無限に増えない
// （ログインボーナス・週間ランキングの報酬は対象外。同じ次元で転生してもリセットしない）
const SP_DIM_CAP = 900;
function spRoom() {
  if (!S.spDim || S.spDim.d !== S.shards) S.spDim = { d: S.shards, got: 0 };
  return Math.max(0, SP_DIM_CAP - S.spDim.got);
}
function gainSP(n) {
  if (MODE || !(n > 0)) return 0;
  const room = spRoom();
  const got = Math.min(n, room);
  if (got > 0) { S.spDim.got += got; addBP(got); saveProfile(); }
  if (got < n && room > 0 && got === room) toast(L().spCapped);
  return got;
}
function addSP(n, why) {
  const got = gainSP(n);
  if (got && why) toast(`+${got} SP · ${why}`);
}

function addCoins(n) {
  S.coins += n;
  S.runEarned += n;
  S.stats.earned += n;
}

// 生成位置はランダム（タップした場所ではない）
function spawnOne(showCoin) {
  if (S.objs.length >= cap()) {
    if (!S.up.autoSell || !sellLowest()) return false;
  }
  const t = rollTier();
  const p = findSpot(t);
  const o = { id: S.nextId++, t, x: p.x, y: p.y };
  S.objs.push(o);
  S.stats.spawned++;
  const coin = spawnCoin();
  addCoins(coin);
  fx.spawn.add(o.id);
  noteTier(t);
  if (coin > 0 && showCoin) floatAt(o, `+${fmt(coin)}`);
  dirty = true;
  return true;
}

function spawnByTap() {
  let made = 0;
  for (let i = 0; i <= S.up.tapPower; i++) if (spawnOne(true)) made++;
  if (made) sfx.spawn();
  return made;
}

// a を b に吸収させて b のランクを上げる
function merge(a, b) {
  if (!a || !b || a === b || a.t !== b.t) return false;
  if (a.t >= INF()) {
    toast(L().infNoMerge);
    return false;
  }
  S.objs = S.objs.filter(o => o !== a);
  const from = b.t;
  b.t++;
  if (b.t < INF() && S.boost.jump > 0 && !MODE) { b.t++; S.boost.jump--; S.stats.boostPen = (S.stats.boostPen || 0) + 30; }   // 跳躍券（1回 +30秒の補正）
  Object.assign(b, clampPos(b.t, b.x, b.y));
  S.stats.merged++;
  fx.pop.add(b.id);
  rippleAt(b, diameter(b.t) * 1.8);
  floatAt(b, b.t - from > 1 ? `${pow2(from)} ×4 = ${rankName(b.t)}` : `${pow2(from)} + ${pow2(from)} = ${rankName(b.t)}`, 'formula');
  if (selected === a.id || selected === b.id) selected = null;
  sfx.merge(b.t);
  vibe(b.t >= INF() ? [30, 40, 60] : 8);
  noteTier(b.t);
  dirty = true;
  S.objs.forEach(o => { if (o !== b && !busy.has(o.id)) separate(o); });
  // 連鎖合成：できたものに同じランクの相手がいれば、続けて合成
  if (S.up.chain && b.t < INF() && RNG() < S.up.chain * 0.1) {
    const twin = S.objs.find(o => o !== b && o.t === b.t && !busy.has(o.id) && !(drag && drag.id === o.id));
    if (twin) setTimeout(() => { if (byId(b.id) && byId(twin.id) && b.t === twin.t) mergeAnimated(twin, b); }, 90);
  }
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

let lastSale = null;
function sell(o, manual) {
  if (!o) return 0;
  const price = sellPrice(o.t);
  S.objs = S.objs.filter(x => x !== o);
  addCoins(price);
  S.stats.sold++;
  if (selected === o.id) selected = null;
  dirty = true;
  if (manual) {
    sfx.sell();
    vibe(6);
    floatRail(`+${fmt(price)}`);
    lastSale = { obj: { ...o }, price, at: Date.now() };
    toast(L().sold(fmt(price)), { label: L().undo, fn: undoSale }, 3000);
  }
  return price;
}

function undoSale() {
  if (!lastSale || Date.now() - lastSale.at > 3500) return;
  if (S.objs.length >= cap() || S.coins < lastSale.price) return;
  S.coins -= lastSale.price;
  S.runEarned = Math.max(0, S.runEarned - lastSale.price);
  S.stats.earned -= lastSale.price;
  S.stats.sold--;
  const o = { ...lastSale.obj, id: S.nextId++ };
  S.objs.push(o);
  separate(o);
  fx.spawn.add(o.id);
  lastSale = null;
  dirty = true;
  toast(L().undone);
}

// 売却（高ランクは確認）
function requestSell(o) {
  if (OPT.confirmSell && o.t >= CONFIRM_SELL_TIER) {
    const l = L();
    showModal({
      title: l.sellConfirmTitle,
      text: l.sellConfirmText(rankName(o.t), fmt(sellPrice(o.t))),
      buttons: [
        { label: l.sell, primary: true, onClick: () => { if (byId(o.id)) sell(o, true); refresh(); } },
        { label: l.cancel, onClick: refresh },
      ],
    });
    return;
  }
  sell(o, true);
}

function sellLowest() {
  const free = S.objs.filter(o => !busy.has(o.id) && !(drag && drag.id === o.id));
  if (!free.length) return false;
  sell(free.reduce((m, o) => (o.t < m.t ? o : m)), false);
  return true;
}

// 一番低いランクのペアを1組合成
function autoMergeStep() {
  const seen = {};
  let pair = null;
  for (const o of S.objs) {
    if (busy.has(o.id) || o.t >= INF() || (drag && drag.id === o.id)) continue;
    if (seen[o.t]) {
      if (!pair || o.t < pair[0].t) pair = [o, seen[o.t]];
    } else {
      seen[o.t] = o;
    }
  }
  if (pair) mergeAnimated(pair[0], pair[1]);
}

function noteTier(t) {
  if (MODE === 'weekly') { if (window.Weekly) Weekly.onTier(t); return; }
  if (t > S.stats.maxTier) S.stats.maxTier = t;
  if (t > S.runMaxTier) S.runMaxTier = t;
  // この周回で初めて届いたランク（2⁶以上）ごとに SP +1
  if (t >= 6 && t > S.runRanks && t < INF()) { S.runRanks = t; addSP(1); }
  if (t === INF()) {
    S.stats.infinities++;
    PROFILE.everInf = true;
    addSP(30, '∞');
    if (S.shards + 1 >= OMEGA_DIM && !S.clearTime) {
      S.clearTime = Math.max(1, Math.floor(S.stats.playTime + (S.stats.boostPen || 0)));
      save();
      setTimeout(showOmega, 600);
      return;
    }
    sfx.inf();
    if (!S.seenInf) {
      S.seenInf = true;
      setTimeout(showInfinityReached, 500);
    }
  }
}

function buy(u) {
  const cost = upCost(u);
  if (!uUnlocked(u) || S.up[u.id] >= umax(u) || S.coins < cost) { sfx.deny(); return; }
  S.coins -= cost;
  S.up[u.id]++;
  S.stats.bought++;
  sfx.buy();
  vibe(6);
  dirty = true;
  renderShop();
  save();
}

function buyEternal(k) {
  const cost = eternalCost(k);
  if (!ETERNAL_OPEN(S) || S.soul < cost) { sfx.deny(); return; }
  S.soul -= cost;
  S.eternal[k.id]++;
  sfx.buy();
  vibe(6);
  dirty = true;
  renderInf();
  save();
}

const infCount = () => S.objs.filter(o => o.t >= INF()).length;

function clearField() {
  selected = null;
  busy.clear();
  nodes.forEach(el => el.remove());
  nodes.clear();
  genAcc = mergeAcc = 0;
  dirty = true;
}

function keepFrom(s, extra = {}) {
  return {
    shards: s.shards, soul: s.soul, eternal: s.eternal, stats: s.stats,
    clearTime: s.clearTime, created: s.created, seenInf: s.seenInf, spDim: s.spDim, ...extra,
  };
}

// 転生（ボタンは1つ）：∞ を作っていれば次の次元へ。魂は ∞ の数と到達具合で決まる
function rebirth() {
  const p = soulParts();
  if (p.total < 1 && p.n === 0) return;
  const next = p.n > 0;
  const before = dimOf();
  S.stats.rebirths = (S.stats.rebirths || 0) + 1;
  S = freshState(keepFrom(S, { shards: S.shards + (next ? 1 : 0), soul: S.soul + p.total }));
  PROFILE.maxDim = Math.max(PROFILE.maxDim || 1, dimOf());
  saveProfile();
  clearField();
  save();
  renderAll();
  switchPanel('play');
  sfx.inf();
  const l = L();
  if (next) {
    const fresh = UPGRADES.filter(u => u.unlock === dimOf()).map(u => (OPT.lang === 'ja' ? u.jp : u.en));
    showModal({
      rings: 'DIM',
      title: l.dimTitle(dimStr()),
      text: l.dimText(pow2(INF()), fmt(prestigeMult())) + `<br>${l.soul('+' + fmt(p.total))}` +
        (fresh.length ? `<br><br>${l.newUpgrade(fresh.join(' / '))}` : `<br><br>${l.capUp}`),
      buttons: [{ label: 'START', primary: true }],
    });
  } else {
    toast(l.rebirthDone(fmt(p.total)));
  }
  void before;
  showTip('soul');
  if (window.Online) Online.syncSoon();
}

// ---------- 描画 ----------
let dirty = true;
let currentPanel = 'play';
const fx = { pop: new Set(), spawn: new Set() };
const nodes = new Map();   // id -> element

function bodyHTML(t, skin = PROFILE.skin, d) {
  if (skin && skin !== 'CIRCLE') {
    return `<div class="body sk ${skinClass(skin)}">${skinSVG(skin, t, d || diameter(t), INF())}</div>`;
  }
  if (t >= INF()) return '<div class="body inf"><span class="v">∞</span></div>';
  const fs = Math.min(15, 9 + t * 0.45) * SIZE_MULT[OPT.size];
  const label = `<span class="v" style="font-size:${fs.toFixed(1)}px">${fmt(Math.pow(2, t))}</span>`;
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
    if (!el) { el = makeNode(o); nodes.set(o.id, el); }
    const key = `${o.t}|${PROFILE.skin}`;
    if (el.dataset.k !== key) {
      el.dataset.k = key;
      el.firstChild.innerHTML = bodyHTML(o.t);
      el.style.width = el.style.height = diameter(o.t) + 'px';
    }
    if (!(drag && drag.id === o.id && drag.moving)) {
      el.style.left = o.x * r.width + 'px';
      el.style.top = o.y * r.height + 'px';
    }
    el.classList.toggle('selected', selected === o.id);
    if (fx.pop.has(o.id)) { el.classList.remove('pop', 'spawn'); void el.offsetWidth; el.classList.add('pop'); }
    else if (fx.spawn.has(o.id)) el.classList.add('spawn');
  }
  for (const [id, el] of nodes) {
    if (!alive.has(id)) { el.remove(); nodes.delete(id); }
  }
  fx.pop.clear();
  fx.spawn.clear();

  els.fieldHint.textContent = L().tapAnywhere;
  els.fieldHint.classList.toggle('hide', S.objs.length > 0 || !!tut);
  const sel = selected && byId(selected);
  els.railText.textContent = sel ? L().railTap : L().railDrop;
  els.railPrice.textContent = sel ? `+${fmt(sellPrice(sel.t))}` : '';
  els.rail.classList.toggle('armed', !!sel);
}

function renderHeader() {
  els.coins.textContent = fmtCoins(S.coins);
  if (MODE === 'weekly' && window.Weekly) {
    els.rate.textContent = Weekly.headerText();
    els.dim.textContent = 'WEEKLY';
  } else {
    els.rate.textContent = coinRate > 0.05 ? `+${fmt(Math.round(coinRate * 10) / 10)} / s` : '';
    els.dim.textContent = `DIM ${dimStr()}${S.clearTime ? ' · Ω' : ''}`;
  }
  els.count.textContent = `${S.objs.length} / ${cap()}`;
  const affordable = UPGRADES.some(u => uUnlocked(u) && S.up[u.id] < umax(u) && S.coins >= upCost(u));
  const eAffordable = !MODE && ETERNAL_OPEN(S) && ETERNAL.some(k => S.soul >= eternalCost(k));
  const eHot = !MODE && (infCount() > 0 || eAffordable);
  els.shopBadge.classList.toggle('on', affordable || eHot);
  els.segNormalDot.classList.toggle('on', affordable);
  els.infBadge.classList.toggle('on', eHot);
  els.gachaBadge.classList.toggle('on', !!(window.Gacha && Gacha.badge()));
  if (!MODE && soulBase() >= 1) showTip('rebirth');
}

// 次に買えるまでの目安（待ち時間が見えると、待つことが作戦になる）
function etaText(cost) {
  if (S.coins >= cost || coinRate <= 0.01) return '';
  const sec = (cost - S.coins) / coinRate;
  if (sec > 99 * 3600) return '';
  return L().eta(fmtTime(Math.max(1, sec)));
}

function upgradeRow(i, name, sub, desc, lv, max, costLabel, can, maxed, attr, id, eta = '') {
  const n = Math.min(max === Infinity ? 20 : max, 20);
  const on = max === Infinity ? Math.min(20, lv) : Math.ceil((lv / max) * n);
  const ticks = Array.from({ length: n }, (_, k) => `<i class="${k < on ? 'on' : ''}"></i>`).join('');
  const help = HELP[id] ? HELP[id][OPT.lang === 'ja' ? 0 : 1] : '';
  return `<div class="up ${!maxed && !can ? 'locked' : ''} ${helpOpen.has(id) ? 'open' : ''}">
    <div class="up-no">${String(i + 1).padStart(2, '0')}</div>
    <div class="up-main" data-help="${id}">
      <div class="up-jp">${name}<i class="up-q">?</i></div>
      <div class="up-en">${sub}</div>
      <div class="up-desc"><span>${maxed ? 'MAX' : desc}</span><span class="ticks">${ticks}</span></div>
      <div class="up-eta" data-eta="${id}">${maxed ? '' : eta}</div>
    </div>
    <button class="pill ${maxed ? 'max' : ''}" ${attr} ${maxed || !can ? 'disabled' : ''}>${maxed ? 'MAX' : costLabel}</button>
    <p class="up-help">${help}</p>
  </div>`;
}

// 名前をタップすると説明が開く
function toggleHelp(e) {
  const m = e.target.closest('[data-help]');
  if (!m) return false;
  const id = m.dataset.help;
  if (helpOpen.has(id)) helpOpen.delete(id); else helpOpen.add(id);
  m.closest('.up').classList.toggle('open', helpOpen.has(id));
  return true;
}

function renderShop() {
  const ja = OPT.lang === 'ja';
  const [cTitle, cLines] = L().coinUse;
  const list = UPGRADES.filter(u => uUnlocked(u) && !(u.id === 'autoSell' && dimOf() >= 2));
  const locked = UPGRADES.filter(u => !uUnlocked(u) && !MODE);
  els.upgrades.innerHTML = `<div class="coin-use"><div class="coin-use-t">${cTitle}</div><ol>${cLines.map(x => `<li>${x}</li>`).join('')}</ol></div>` +
    list.map((u, i) => {
      const lv = S.up[u.id], cost = upCost(u), mx = umax(u);
      return upgradeRow(i, ja ? u.jp : u.en, `${ja ? u.en.toUpperCase() + ' · ' : ''}LV ${lv} / ${mx}`, u.desc(lv),
        lv, mx, fmt(cost), S.coins >= cost, lv >= mx, `data-id="${u.id}"`, u.id, etaText(cost));
    }).join('') +
    (locked.length ? `<div class="up-locked">${locked.map(u => `<div><span>${ja ? u.jp : u.en}</span><em>${L().unlockAt(u.unlock)}</em></div>`).join('')}</div>` : '');
}

function refreshShop() {
  els.upgrades.querySelectorAll('.pill[data-id]').forEach(b => {
    const u = UPGRADES.find(x => x.id === b.dataset.id);
    const maxed = S.up[u.id] >= umax(u);
    const cost = upCost(u);
    const can = !maxed && S.coins >= cost;
    b.disabled = !can;
    b.closest('.up').classList.toggle('locked', !maxed && !can);
    const eta = b.closest('.up').querySelector('.up-eta');
    if (eta) eta.textContent = maxed ? '' : etaText(cost);
  });
}

function renderInf() {
  const l = L();
  const inf = INF();
  const mt = Math.min(S.runMaxTier, inf);
  // ∞ までの道のり（段数が多いときは線だけ）
  els.infPath.classList.toggle('bar', inf > 30);
  els.infPath.innerHTML = inf > 30 ? '' : Array.from({ length: inf + 1 }, (_, t) =>
    `<i class="${t <= mt ? 'got' : ''} ${t === inf ? 'last' : ''}"></i>`).join('');
  els.infPath.style.setProperty('--prog', (mt / inf) * 100 + '%');
  const count = infCount();
  const p = soulParts(), r = l.rebirth;
  els.infMain.innerHTML = count ? l.infHave(count) : l.infLeft(inf - mt, pow2(inf));
  els.infSub.innerHTML = count ? l.infHaveSub : (S.shards ? l.infDim(dimStr(), fmt(prestigeMult())) : l.infCurious);

  // 転生（ボタン1つ）：魂の内訳
  const x = v => '×' + v.toFixed(2).replace(/\.?0+$/, '');
  els.rebirth.innerHTML = `
    <div class="soul-now">◇ ${l.soul(fmt(S.soul))}</div>
    <div class="soul-calc">
      ${p.n ? `<div><span>${r.rows[0]} ${dimStr()}</span><b>${fmt(p.earn)}</b></div>
      <div class="hot"><span>${r.rows[4]} ${p.n}</span><b>${x(p.inf)}</b></div>`
      : `<div><span>${r.rows[1]} ${rankName(S.runMaxTier)} · ${p.steps * 10}%</span><b>${p.steps} × 2</b></div>`}
      ${p.res > 1 ? `<div><span>${r.rows[3]}</span><b>${x(p.res)}</b></div>` : ''}
      <div class="sum"><span>=</span><b>◇ ${fmt(p.total)}</b></div>
    </div>`;
  const can = !MODE && (p.total >= 1 || p.n > 0);
  els.prestigeBtn.disabled = !can;
  els.prestigeBtn.innerHTML = p.n > 0 ? l.rebirthNext(String(dimOf() + 1).padStart(2, '0')) : l.rebirthSame;
  els.infNote.textContent = MODE ? '' : !can ? r.locked(fmt(soulToNext())) : p.n > 0 ? l.rebirthHintNext : l.rebirthHintSame;

  // Ω までの道のり
  const dimNow = dimOf();
  els.omegaBar.innerHTML = `<div class="omega-text">${S.clearTime ? l.omegaDone(fmtTime(S.clearTime)) : l.omegaLeft(dimNow, OMEGA_DIM)}</div>
    <div class="omega-steps">${Array.from({ length: OMEGA_DIM }, (_, i) => `<i class="${i < dimNow ? 'on' : ''}"></i>`).join('')}<b class="${S.clearTime ? 'on' : ''}">Ω</b></div>`;

  // ブースト券
  if (window.Gacha) Gacha.renderBoost();

  // 永遠強化（上限なし）
  const ja = OPT.lang === 'ja';
  const eOpen = ETERNAL_OPEN(S);
  els.skills.innerHTML = !eOpen ? `<p class="dim-text">${ja ? '永遠強化は、∞ を作って次元を1つ突破すると解放される。魂は今のうちに貯めておける。' : 'Eternal upgrades open after you break through your first dimension. Souls you earn now are kept.'}</p>` : ETERNAL.map((k, i) => {
    const lv = S.eternal[k.id], cost = eternalCost(k), dsc = k.desc(lv);
    return upgradeRow(i, ja ? k.jp : k.en, `${ja ? k.en.toUpperCase() + ' · ' : ''}LV ${lv}`, ja ? dsc.ja : dsc.en,
      lv, Infinity, `◇ ${fmt(cost)}`, S.soul >= cost, false, `data-skill="${k.id}"`, k.id);
  }).join('');
}

function renderStats() {
  const st = S.stats;
  const vals = [
    fmtTime(st.playTime), fmt(st.taps), fmt(st.spawned), fmt(st.merged), fmt(st.sold),
    fmt(Math.floor(st.earned)), pow2(st.maxTier), fmt(st.infinities), dimStr(), fmt(st.rebirths || 0),
    S.clearTime ? fmtTime(S.clearTime) : '—',
  ];
  els.stats.innerHTML = L().stats.map((k, i) => `<dt>${k}</dt><dd>${vals[i]}</dd>`).join('');
  const inf = INF();
  els.dex.innerHTML = Array.from({ length: inf + 1 }, (_, t) => {
    const known = t <= Math.max(st.maxTier, S.runMaxTier);
    return `<div class="dex-cell ${known ? '' : 'unknown'}"><div class="mini ${skinClass(PROFILE.skin)}">${known ? skinSVG(PROFILE.skin, t, t >= inf ? 34 : Math.min(34, 14 + t * 20 / inf), inf) : '<i class="q"></i>'}</div>${rankName(t)}</div>`;
  }).join('');
}

function slotSummary(i) {
  const s = i === OPT.slot ? S : readSlot(i);
  if (!s || (!s.stats.spawned && !s.shards)) return null;
  return s;
}

function renderAccount() {
  const sl = L().slot;
  const slots = [0, 1, 2].map(i => {
    const s = slotSummary(i);
    const on = i === OPT.slot;
    const info = s ? sl.info(dimStr(s), s.clearTime ? 'Ω' : rankName(s.stats.maxTier), fmtTime(s.stats.playTime)) : sl.empty;
    return `<div class="slot ${on ? 'on' : ''}">
      <div class="slot-no">${String(i + 1).padStart(2, '0')}</div>
      <div class="slot-info">${info}</div>
      <button class="opt-btn" data-slot="${i}" ${on ? 'disabled' : ''}>${on ? sl.playing : s ? sl.use : sl.start}</button>
    </div>`;
  }).join('');
  const online = window.Online ? Online.accountHTML() : '';
  els.account.innerHTML = `${online}<div class="opt-group">${sl.title}</div>${slots}`;
}

// UPGRADE タブの切り替え（通常 / 永遠）
let shopView = 'normal';
function setShopView(v) {
  shopView = v;
  document.querySelectorAll('#shopSeg [data-view]').forEach(b => b.classList.toggle('on', b.dataset.view === v));
  $('shopNormal').hidden = v !== 'normal';
  $('shopEternal').hidden = v !== 'eternal';
  if (v === 'eternal') { renderInf(); if (S.soul > 0) showTip('soul'); } else renderShop();
}
function openEternal() { switchPanel('shop'); setShopView('eternal'); }
$('shopSeg').addEventListener('click', e => { const b = e.target.closest('[data-view]'); if (b) { setShopView(b.dataset.view); sfx.buy(); } });

function segHTML(key, choices) {
  return `<div class="seg">${choices.map(([v, label]) =>
    `<button data-opt="${key}" data-val="${v}" class="${String(OPT[key]) === String(v) ? 'on' : ''}">${label}</button>`).join('')}</div>`;
}

let installPrompt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installPrompt = e; if (currentPanel === 'menu') renderOptions(); });
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

function renderOptions() {
  const o = L().opt;
  const onoff = [[true, o.on], [false, o.off]];
  const row = ([name, desc], control) =>
    `<div class="opt"><div><div class="opt-name">${name}</div>${desc ? `<div class="opt-desc">${desc}</div>` : ''}</div>${control}</div>`;
  const btn = (action, label, cls = '') => `<button class="opt-btn ${cls}" data-action="${action}">${label}</button>`;
  const install = isStandalone() ? '' : row([o.install[0], installPrompt ? o.install[1] : o.installIos], installPrompt ? btn('install', 'INSTALL') : '');
  els.options.innerHTML = `
    <div class="opt-group">${o.general}</div>
    ${row(o.lang, segHTML('lang', [['ja', '日本語'], ['en', 'English']]))}
    ${row(o.sound, segHTML('sound', onoff))}
    ${row(o.vibe, segHTML('vibe', onoff))}
    ${row(o.calm, segHTML('calm', onoff))}
    ${row(o.sleep, btn('sleep', 'SLEEP'))}
    ${row(o.autoSleep, segHTML('autoSleep', [[0, o.off], [60, '1m'], [300, '5m']]))}
    ${install}
    <div class="opt-group">${o.control}</div>
    ${row(o.size, segHTML('size', [['S', 'S'], ['M', 'M'], ['L', 'L']]))}
    ${row(o.confirm, segHTML('confirmSell', onoff))}
    ${row(o.tutorial, btn('tutorial', o.play))}
    <div class="opt-group">${o.data}</div>
    ${row(o.save, btn('save', 'SAVE'))}
    ${row(o.export, btn('export', 'EXPORT'))}
    ${row(o.import, btn('import', 'IMPORT'))}
    ${row(o.restore, btn('restore', 'RESTORE'))}
    ${row(o.reset, btn('reset', 'ERASE', 'danger'))}
    <div class="version">BEYOND ∞ · v${VERSION}</div>`;
}

function renderMenu() {
  renderAccount();
  renderStats();
  renderOptions();
}

function applyLanguage() {
  document.documentElement.lang = OPT.lang;
  document.body.classList.toggle('calm', !!OPT.calm);
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = L()[el.dataset.i18n]; });
}

function renderAll() {
  applyLanguage();
  nodes.forEach(el => (el.dataset.k = ''));
  renderField();
  renderHeader();
  renderShop();
  renderInf();
  renderMenu();
  if (window.Online) Online.render();
  if (window.Gacha && currentPanel === 'gacha') Gacha.render();
}

function refresh() {
  dirty = true;
  renderField();
  renderHeader();
}

function switchPanel(name) {
  if (name === currentPanel) return;
  const dir = PANELS.indexOf(name) > PANELS.indexOf(currentPanel) ? 'from-right' : 'from-left';
  currentPanel = name;
  document.body.classList.toggle('on-play', name === 'play');
  document.querySelectorAll('.panel').forEach(p => {
    const on = p.id === 'panel-' + name;
    p.classList.toggle('active', on);
    p.classList.remove('from-right', 'from-left');
    if (on) { void p.offsetWidth; p.classList.add(dir); }
  });
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.panel === name));
  selected = null;
  if (name === 'play') { fieldBox = null; dirty = true; }
  if (name === 'shop') renderShop();
  if (name === 'shop' && shopView === 'eternal') renderInf();
  if (name === 'gacha' && window.Gacha) Gacha.render();
  if (name === 'menu') renderMenu();
  if (name === 'vs') { if (window.Online) Online.render(); showTip('versus'); }
  tutUpdate(true);
}

function stepPanel(delta) {
  const i = PANELS.indexOf(currentPanel) + delta;
  if (i >= 0 && i < PANELS.length) switchPanel(PANELS[i]);
}

// サブタブ（VERSUS / MENU）
function wireSubnav(navId, onChange) {
  const nav = $(navId);
  nav.addEventListener('click', e => {
    const b = e.target.closest('[data-sub]');
    if (!b) return;
    nav.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    nav.parentElement.querySelectorAll('.subpanel').forEach(s => s.classList.toggle('on', s.id === 'sub-' + b.dataset.sub));
    onChange && onChange(b.dataset.sub);
  });
}
wireSubnav('menuNav', () => renderMenu());
wireSubnav('vsNav', sub => { if (window.Online) Online.render(sub); });

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

function floatRail(text) {
  const r = fieldRect();
  const el = document.createElement('div');
  el.className = 'float';
  el.textContent = text;
  el.style.left = r.width - 48 + 'px';
  el.style.top = r.height - 8 + 'px';
  els.field.appendChild(el);
  setTimeout(() => el.remove(), 800);
}

let toastTimer;
function toast(msg, action, ms = 1800) {
  ms = Math.max(ms, String(msg).length * 70);   // 長い文は長めに表示
  els.toastText.textContent = msg;
  els.toastAction.hidden = !action;
  els.toast.classList.toggle('actionable', !!action);
  els.toastAction.onclick = null;
  if (action) {
    els.toastAction.textContent = action.label;
    els.toastAction.onclick = () => { els.toast.classList.remove('show', 'actionable'); action.fn(); refresh(); };
  }
  els.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove('show', 'actionable'), ms);
}

const modalQueue = [];
function showModal(opts) {
  if (!els.modal.hidden) { modalQueue.push(opts); return; }
  const { rings = '', title = '', text = '', html = '', buttons } = opts;
  endDrag(null, true);
  els.modalRings.textContent = rings;
  els.modalRings.style.fontSize = rings.length > 1 ? '40px' : '';
  els.modalRings.style.letterSpacing = rings.length > 1 ? '0.3em' : '';
  els.modalBody.innerHTML = `<p class="m-title">${title}</p>${text ? `<p class="m-text">${text}</p>` : ''}${html}`;
  els.modal.classList.toggle('form', /<(input|textarea)/.test(html));
  els.modal.scrollTop = 0;
  els.modalButtons.innerHTML = '';
  buttons.forEach(b => {
    const btn = document.createElement('button');
    btn.innerHTML = b.label;
    if (!b.primary) btn.className = 'sub';
    btn.onclick = () => {
      if (b.keepOpen) { b.onClick(); return; }
      closeModal();
      b.onClick && b.onClick();
    };
    els.modalButtons.appendChild(btn);
  });
  els.modal.hidden = false;
}
function closeModal() {
  els.modal.hidden = true;
  if (modalQueue.length) setTimeout(() => showModal(modalQueue.shift()), 120);
}

function showInfinityReached() {
  const l = L();
  showModal({
    rings: '∞',
    title: l.reachedTitle,
    text: l.reachedText,
    buttons: [
      { label: 'BEYOND ∞ &nbsp;→', primary: true, onClick: openEternal },
      { label: l.keepPlaying },
    ],
  });
}

function showOmega() {
  const l = L();
  sfx.omega();
  vibe([40, 60, 40, 60, 120]);
  if (!PROFILE.skins.includes('SUMI')) { PROFILE.skins.push('SUMI'); saveProfile(); }
  showModal({
    rings: 'Ω',
    title: l.omegaTitle,
    text: `${l.omegaText(fmtTime(S.clearTime), S.stats.boostPen >= 1 ? fmtTime(Math.floor(S.stats.boostPen)) : '')}<br><br>${l.omegaReward}`,
    buttons: [{ label: 'CONTINUE', primary: true, onClick: () => { renderAll(); if (window.Online) Online.syncSoon(); } }],
  });
}

// 新機能の説明（一度だけ）
function showTip(id) {
  if (OPT.tips[id] || tut || !els.modal.hidden || !els.tut.hidden) return;
  OPT.tips[id] = true;
  saveSettings();
  els.tut.hidden = false;
  els.tut.classList.add('tip');
  els.tutStep.textContent = 'TIP';
  els.tutText.innerHTML = L().tips[id];
  els.tutSkip.hidden = true;
  els.tutNext.hidden = false;
  els.tutNext.textContent = 'OK';
}

function showWhatsNew() {
  const l = L();
  showModal({
    rings: 'NEW',
    title: l.whatsNewTitle,
    html: `<ul class="m-list">${l.whatsNew.map(x => `<li>${x}</li>`).join('')}</ul>`,
    buttons: [{ label: 'OK', primary: true }],
  });
}

// ---------- 入力：どこでもタップ / 自由にドラッグ / スワイプでタブ ----------
let drag = null;
const SWIPE_MIN = 60;
const EDGE = 20;   // iOS の戻るジェスチャーと競合しないよう端は無視

function overRail(y) {
  return y > els.rail.getBoundingClientRect().top - 6;
}

function findTarget(o, px, py) {
  let best = null, bestDist = Infinity;
  const reach = Math.max(diameter(o.t) * 0.95, 40);
  for (const other of S.objs) {
    if (other === o || other.t !== o.t || busy.has(other.id)) continue;
    const q = toPx(other);
    const dist = Math.hypot(q.x - px, q.y - py);
    if (dist < reach && dist < bestDist) { best = other; bestDist = dist; }
  }
  return best;
}

function markTarget(t) {
  nodes.forEach((el, id) => el.classList.toggle('target', !!t && t.id === id));
}

els.field.addEventListener('pointerdown', e => {
  if (paused || drag) return;   // 2本目の指は無視
  if (e.button > 0) return;
  fieldBox = null;
  const objEl = e.target.closest('.obj');
  const id = objEl ? Number(objEl.dataset.id) : null;
  if (id && busy.has(id)) return;
  const r = fieldRect();
  let ox = 0, oy = 0;
  if (id) {
    const q = toPx(byId(id));
    ox = e.clientX - r.left - q.x;
    oy = e.clientY - r.top - q.y;
  }
  drag = { id, pid: e.pointerId, x: e.clientX, y: e.clientY, ox, oy, moving: false };
  if (id) {
    const o = byId(id);
    drag.from = { x: o.x, y: o.y };
  }
  try { els.field.setPointerCapture(e.pointerId); } catch (err) { /* 非対応 */ }
});

els.field.addEventListener('pointermove', e => {
  if (!drag || e.pointerId !== drag.pid || !drag.id) return;
  const o = byId(drag.id);
  if (!o) { drag = null; return; }
  if (!drag.moving && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 6) {
    drag.moving = true;
    selected = null;
    const el = nodes.get(o.id);
    el.classList.add('dragging');
    el.classList.remove('selected');
  }
  if (drag.moving) {
    const r = fieldRect();
    const el = nodes.get(o.id);
    const px = e.clientX - r.left - drag.ox, py = e.clientY - r.top - drag.oy;
    el.style.left = px + 'px';
    el.style.top = py + 'px';
    const hot = overRail(e.clientY);
    els.rail.classList.toggle('hot', hot);
    el.classList.toggle('to-sell', hot);
    els.railPrice.textContent = hot ? `+${fmt(sellPrice(o.t))}` : '';
    markTarget(hot ? null : findTarget(o, px, py));
  }
});

function endDrag(e, cancelled) {
  if (!drag || (e && e.pointerId !== drag.pid)) return;
  const d = drag;
  drag = null;
  els.rail.classList.remove('hot');
  markTarget(null);
  const o = d.id && byId(d.id);
  if (o && nodes.get(o.id)) nodes.get(o.id).classList.remove('dragging', 'to-sell');

  if (cancelled || !e) { dirty = true; return; }

  const dx = e.clientX - d.x, dy = e.clientY - d.y;
  if (!d.moving && !o) {
    const isSwipe = Math.abs(dx) > SWIPE_MIN && Math.abs(dx) > Math.abs(dy) * 1.8 && d.x > EDGE && d.x < innerWidth - EDGE;
    if (isSwipe) stepPanel(dx < 0 ? 1 : -1);
    else if (Math.hypot(dx, dy) < 12) tapEmpty(e);
  } else if (!d.moving && o) {
    tapObj(o);
  } else if (o) {
    const r = fieldRect();
    const px = e.clientX - r.left - d.ox, py = e.clientY - r.top - d.oy;
    const target = findTarget(o, px, py);
    if (overRail(e.clientY)) {
      Object.assign(o, d.from);   // キャンセル時は元の位置へ
      requestSell(o);
    } else if (target) {
      o.x = target.x; o.y = target.y;
      merge(o, target);
    } else {
      Object.assign(o, clampPos(o.t, px / r.width, py / r.height));
      separate(o);
    }
  }
  refresh();
}

els.field.addEventListener('pointerup', e => endDrag(e, false));
els.field.addEventListener('pointercancel', e => endDrag(e, true));
els.field.addEventListener('lostpointercapture', e => { if (drag && e.pointerId === drag.pid) endDrag(null, true); });

function tapEmpty(e) {
  S.stats.taps++;
  if (selected) { selected = null; return; }
  const r = fieldRect();
  rippleAt({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height, t: 0 }, 60);
  if (!spawnByTap()) {
    sfx.deny();
    toast(L().full);
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
  if (sel) requestSell(sel);
  else toast(L().railHelp);
  refresh();
});

// UPGRADE / ∞ / VERSUS / MENU 画面でのスワイプ
(() => {
  let s = null;
  els.main.addEventListener('pointerdown', e => {
    if (currentPanel === 'play' || e.target.closest('input, textarea, .no-swipe')) return;
    s = { x: e.clientX, y: e.clientY, id: e.pointerId };
  });
  els.main.addEventListener('pointerup', e => {
    if (!s || e.pointerId !== s.id) return;
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    if (Math.abs(dx) > SWIPE_MIN && Math.abs(dx) > Math.abs(dy) * 1.8 && s.x > EDGE && s.x < innerWidth - EDGE) {
      stepPanel(dx < 0 ? 1 : -1);
    }
    s = null;
  });
  els.main.addEventListener('pointercancel', () => { s = null; });
})();

els.upgrades.addEventListener('click', e => {
  if (toggleHelp(e)) return;
  const b = e.target.closest('.pill');
  if (b) buy(UPGRADES.find(u => u.id === b.dataset.id));
});

els.skills.addEventListener('click', e => {
  if (toggleHelp(e)) return;
  const b = e.target.closest('button[data-skill]');
  if (b) buyEternal(ETERNAL.find(k => k.id === b.dataset.skill));
});

// 転生ボタン（1つだけ）
els.prestigeBtn.addEventListener('click', () => {
  const p = soulParts();
  if (MODE || (p.total < 1 && p.n === 0)) return;
  const l = L();
  showModal({
    rings: p.n ? '∞' : '◇',
    title: p.n ? l.rebirthNextTitle(String(dimOf() + 1).padStart(2, '0')) : l.rebirthSameTitle,
    text: l.rebirthConfirm(fmt(p.total), p.n),
    buttons: [{ label: 'REBIRTH &nbsp;→', primary: true, onClick: rebirth }, { label: l.cancel }],
  });
});

document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => switchPanel(t.dataset.panel)));

// ---------- MENU：スロット・スキン・オプション ----------
function switchSlot(i) {
  if (i === OPT.slot) return;
  save();
  OPT.slot = i;
  saveSettings();
  S = readSlot(i) || freshState();
  clearField();
  renderAll();
  toast(L().slot.switched(i + 1));
}

els.account.addEventListener('click', e => {
  const b = e.target.closest('[data-slot]');
  if (b) switchSlot(Number(b.dataset.slot));
});

els.options.addEventListener('click', e => {
  const seg = e.target.closest('[data-opt]');
  if (seg) {
    const key = seg.dataset.opt;
    let v = seg.dataset.val;
    if (v === 'true') v = true; else if (v === 'false') v = false; else if (/^\d+$/.test(v)) v = Number(v);
    OPT[key] = v;
    saveSettings();
    if (key === 'size') S.objs.forEach(o => Object.assign(o, clampPos(o.t, o.x, o.y)));
    if (key === 'sound' && v) tone(660, 0.08, 0.05);
    if (key === 'vibe' && v) vibe(20);
    renderAll();
    return;
  }
  const btn = e.target.closest('[data-action]');
  if (btn) optionAction(btn.dataset.action);
});

function encodeSave() {
  return btoa(unescape(encodeURIComponent(JSON.stringify(S))));
}

function replaceState(next) {
  backup();
  S = normalize(next);
  clearField();
  save();
  renderAll();
}

function optionAction(action) {
  const l = L(), o = l.opt;
  if (action === 'tutorial') { switchPanel('play'); tutStart(); }
  if (action === 'sleep' && window.Boot) Boot.sleep(true);
  if (action === 'install' && installPrompt) {
    installPrompt.prompt();
    installPrompt.userChoice.finally(() => { installPrompt = null; renderOptions(); });
  }
  if (action === 'save') { save(); if (window.Online) Online.syncSoon(); toast(o.saved); }
  if (action === 'export') {
    save();
    showModal({
      title: o.exportTitle, text: o.exportText,
      html: `<textarea id="exportBox" readonly>${encodeSave()}</textarea>`,
      buttons: [
        {
          label: o.copy, primary: true, keepOpen: true, onClick: () => {
            const box = $('exportBox');
            box.select();
            const done = () => toast(o.copied);
            if (navigator.clipboard) navigator.clipboard.writeText(box.value).then(done, () => { document.execCommand('copy'); done(); });
            else { document.execCommand('copy'); done(); }
          },
        },
        { label: o.close },
      ],
    });
  }
  if (action === 'import') {
    showModal({
      title: o.importTitle, text: o.importText,
      html: '<textarea id="importBox" placeholder="…"></textarea>',
      buttons: [
        {
          label: o.load, primary: true, keepOpen: true, onClick: () => {
            try {
              const d = JSON.parse(decodeURIComponent(escape(atob($('importBox').value.trim()))));
              if (!d || typeof d !== 'object' || !d.up) throw new Error('bad');
              closeModal();
              replaceState(d);
              toast(o.imported);
            } catch (err) {
              toast(o.importFail);
            }
          },
        },
        { label: l.cancel },
      ],
    });
  }
  if (action === 'restore') {
    try {
      const raw = localStorage.getItem(BACKUP_KEY);
      if (!raw) { toast(o.noBackup); return; }
      const cur = JSON.stringify(S);
      S = normalize(JSON.parse(raw));
      localStorage.setItem(BACKUP_KEY, cur);   // もう一度押せば元に戻る
      clearField();
      save();
      renderAll();
      toast(o.restored);
    } catch (err) { toast(o.noBackup); }
  }
  if (action === 'reset') {
    showModal({
      title: l.resetTitle, text: l.resetText,
      buttons: [
        { label: 'ERASE', primary: true, onClick: () => { replaceState(freshState()); switchPanel('play'); } },
        { label: l.cancel },
      ],
    });
  }
}

// ---------- 操作体験チュートリアル ----------
// 0:生成 → 1:合成 → 2:売却 → 3:UPGRADEを開く → 4:強化を買う → 5:完了
let tut = null;

function tutStart() {
  tut = { step: 0, base: { ...S.stats }, handKey: '' };
  els.tut.hidden = false;
  els.tut.classList.remove('tip');
  tutUpdate(true);
}

function tutEnd() {
  tut = null;
  OPT.tutorialDone = true;
  saveSettings();
  els.tut.hidden = true;
  els.hand.hidden = true;
  document.querySelectorAll('.pulse').forEach(e => e.classList.remove('pulse'));
  dirty = true;
}

function findPair() {
  const seen = {};
  for (const o of S.objs) {
    if (o.t >= INF() || busy.has(o.id)) continue;
    if (seen[o.t]) return [o, seen[o.t]];
    seen[o.t] = o;
  }
  return null;
}

function setHand(kind, a, b) {
  const key = kind + (a ? `${Math.round(a.x)},${Math.round(a.y)}` : '') + (b ? `${Math.round(b.x)},${Math.round(b.y)}` : '');
  if (tut.handKey === key) return;
  tut.handKey = key;
  if (!kind) { els.hand.hidden = true; return; }
  els.hand.hidden = false;
  els.hand.className = 'hand ' + kind;
  els.hand.style.setProperty('--x1', a.x + 'px');
  els.hand.style.setProperty('--y1', a.y + 'px');
  els.hand.style.setProperty('--x2', (b || a).x + 'px');
  els.hand.style.setProperty('--y2', (b || a).y + 'px');
}

function screenPos(o) {
  const r = fieldRect(), p = toPx(o);
  return { x: r.left + p.x, y: r.top + p.y };
}

function tutUpdate(force) {
  if (!tut) return;
  const st = S.stats, b = tut.base;
  const prev = tut.step;
  if (tut.step === 0 && findPair()) tut.step = 1;
  if (tut.step === 1 && st.merged > b.merged) tut.step = 2;
  if (tut.step === 2 && st.sold > b.sold) tut.step = 3;
  if (tut.step === 3 && currentPanel === 'shop') tut.step = 4;
  if (tut.step === 4 && st.bought > b.bought) tut.step = 5;
  if (tut.step === 2 && S.objs.length === 0) spawnOne(false);
  if (tut.step === 4 && prev !== 4) {
    const cheapest = Math.min(...UPGRADES.filter(u => uUnlocked(u) && S.up[u.id] < umax(u)).map(upCost));
    if (S.coins < cheapest) { addCoins(cheapest - S.coins); toast(`${L().tutBonus} +${fmt(cheapest)}`); }
    renderShop();
  }
  if (prev === tut.step && !force && tut.step !== 1 && tut.step !== 2) return;

  const l = L();
  els.tutStep.textContent = `${Math.min(tut.step + 1, 5)} / 5`;
  els.tutText.innerHTML = l.tut[tut.step];
  els.tutNext.hidden = tut.step !== 5;
  els.tutNext.textContent = 'START';
  els.tutSkip.hidden = tut.step === 5;
  document.querySelectorAll('.pulse').forEach(e => e.classList.remove('pulse'));

  const onPlay = currentPanel === 'play';
  const r = fieldRect();
  const center = { x: r.left + r.width / 2, y: r.top + r.height * 0.62 };
  if (tut.step === 0 && onPlay) {
    setHand('tap', center);
  } else if (tut.step === 1 && onPlay) {
    const pair = findPair();
    if (pair) setHand('move', screenPos(pair[0]), screenPos(pair[1]));
    else setHand('tap', center);
  } else if (tut.step === 2 && onPlay) {
    const o = S.objs.find(x => !busy.has(x.id));
    const rr = els.rail.getBoundingClientRect();
    if (o) setHand('move', screenPos(o), { x: rr.left + rr.width / 2, y: rr.bottom - 10 });
  } else if (tut.step === 3) {
    setHand('');
    document.querySelector('.tab[data-panel="shop"]').classList.add('pulse');
  } else if (tut.step === 4) {
    setHand('');
    if (currentPanel !== 'shop') document.querySelector('.tab[data-panel="shop"]').classList.add('pulse');
    const pill = els.upgrades.querySelector('.pill:not([disabled])');
    if (pill) pill.classList.add('pulse');
  } else {
    setHand('');
  }
}

els.tutSkip.addEventListener('click', tutEnd);
els.tutNext.addEventListener('click', () => {
  if (els.tut.classList.contains('tip')) { els.tut.hidden = true; els.tut.classList.remove('tip'); return; }
  tutEnd();
  switchPanel('play');
});

// ---------- ウェブ特有のトラブル対策 ----------
document.addEventListener('dblclick', e => e.preventDefault(), { passive: false });
document.addEventListener('gesturestart', e => e.preventDefault(), { passive: false });
// 入力欄の中かどうか（テキストノードが来ることもある）
const inEditable = e => { const n = e.target && (e.target.closest ? e.target : e.target.parentElement); return !!(n && n.closest('textarea, input')); };
document.addEventListener('contextmenu', e => { if (!inEditable(e)) e.preventDefault(); });
document.addEventListener('selectstart', e => { if (!inEditable(e)) e.preventDefault(); });
document.addEventListener('touchmove', e => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
// ダブルタップ拡大は CSS の touch-action: manipulation で止めている（連続タップを握りつぶさないため JS では止めない）

window.addEventListener('resize', () => {
  fieldBox = null;
  nodes.forEach(el => (el.dataset.k = ''));
  S.objs.forEach(o => Object.assign(o, clampPos(o.t, o.x, o.y)));
  dirty = true;
});

document.addEventListener('keydown', e => {
  if (inEditable(e)) return;
  if (!els.modal.hidden || !els.arena.hidden) return;
  if ((e.code === 'Space' || e.code === 'Enter') && currentPanel === 'play') {
    e.preventDefault();
    if (!e.repeat) { S.stats.taps++; if (!spawnByTap()) toast(L().full); refresh(); }
  }
  if (e.key >= '1' && e.key <= '5') switchPanel(PANELS[Number(e.key) - 1]);
  if (e.key === 'ArrowRight') stepPanel(1);
  if (e.key === 'ArrowLeft') stepPanel(-1);
});

// 同時に複数タブで開くとセーブが競合するので、古いタブを止める
const TAB_ID = Math.random().toString(36).slice(2);
let channel = null;
try {
  channel = new BroadcastChannel('infinity-merge');
  channel.onmessage = ev => {
    if (ev.data && ev.data.type === 'hello' && ev.data.id !== TAB_ID) {
      save();
      paused = true;
      showModal({
        title: 'PAUSED',
        text: L().otherTab,
        buttons: [{ label: L().resumeHere, primary: true, onClick: resumeHere }],
      });
    }
  };
} catch (e) { /* 非対応ブラウザ */ }
function announce() { if (channel) channel.postMessage({ type: 'hello', id: TAB_ID }); }
function resumeHere() {
  Object.assign(OPT, loadSettings());
  PROFILE = loadProfile();
  S = readSlot(OPT.slot) || S;
  paused = false;
  clearField();
  renderAll();
  announce();
}

// ---------- メインループ ----------
let genAcc = 0, mergeAcc = 0, saveAcc = 0;
let lastTick = performance.now();

let coinRate = 0, rateAcc = 0, rateEarned0 = 0;   // 1秒あたりのコイン（平均）
let sleeping = false;
let lastInput = Date.now();
['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, () => { lastInput = Date.now(); }, true));

function tick() {
  const now = performance.now();
  const dt = Math.min(1, (now - lastTick) / 1000);
  lastTick = now;
  if (paused || booting) return;
  S.stats.playTime += dt;
  if (MODE === 'weekly' && window.Weekly) Weekly.tick(dt);

  // ゲームの速さ（倍速モード・2倍速券）と永遠の速さ
  const gdt = dt * gameSpeed();
  // ブースト補正：速さが m 倍のあいだは、1秒ごとに (1 - 1/m) 秒得している
  if (!MODE && (S.boost.x2 > 0 || S.boost.rank > 0)) {
    const m = (S.boost.x2 > 0 ? 2 : 1) * Math.pow(2, S.boost.rank);
    S.stats.boostPen = (S.stats.boostPen || 0) + dt * (1 - 1 / m);
  }
  if (S.boost.x2 > 0) S.boost.x2 = Math.max(0, S.boost.x2 - dt);
  const rate = autoRate();
  if (S.up.autoGen) {
    genAcc += gdt * rate;
    const iv = genInterval(S.up.autoGen);
    let guard = 0;
    while (genAcc >= iv && guard++ < 60) {
      genAcc -= iv;
      spawnOne(false);
      if (S.up.multi && RNG() < S.up.multi * 0.1) spawnOne(false);   // まとめ生成
    }
    if (guard >= 60) genAcc = 0;
  }
  if (S.up.autoMerge && !(drag && drag.moving)) {
    mergeAcc += gdt * rate;
    const iv = mergeInterval(S.up.autoMerge);
    let guard = 0;
    while (mergeAcc >= iv && guard++ < 60) { mergeAcc -= iv; autoMergeStep(); }
    if (guard >= 60) mergeAcc = 0;
  }

  // 稼ぎの速さ（次の強化までの目安に使う）
  rateAcc += dt;
  if (rateAcc >= 2) {
    const got = Math.max(0, S.stats.earned - rateEarned0) / rateAcc;
    coinRate = coinRate ? coinRate * 0.6 + got * 0.4 : got;
    rateAcc = 0;
    rateEarned0 = S.stats.earned;
  }

  // 操作がなければ自動で省エネ画面
  if (!sleeping && OPT.autoSleep && window.Boot && Date.now() - lastInput > OPT.autoSleep * 1000 && els.modal.hidden && !tut && !(window.Online && els.arena && !els.arena.hidden)) Boot.sleep(true);
  if (sleeping) { if (window.Boot) Boot.sleepTick(); }
  else {
    if (dirty && currentPanel === 'play') {
      renderField();
      dirty = false;
    }
    renderHeader();
    if (currentPanel === 'shop') refreshShop();
    tutUpdate(false);
  }

  saveAcc += dt;
  if (saveAcc > 5) { saveAcc = 0; save(); }
}

// 留守の間の稼ぎ（起動画面・画面復帰で使う）
function offlineGain(away) {
  away = Math.min(offlineCapSec(), away);
  if (away < 30 || !S.up.autoGen || paused || MODE) return null;
  const spawns = away * gameSpeed() * autoRate() / genInterval(S.up.autoGen);
  const coins = spawns * (spawnCoin() + sellPrice(Math.min(INF() - 1, S.up.baseTier + E('eRank'))) * offlineRate());
  if (coins < 1) return null;
  addCoins(coins);
  return { coins, away };
}

function offlineReward(away) {
  const g = offlineGain(away);
  if (!g) return;
  showModal({
    title: `+${fmt(Math.floor(g.coins))} COIN`,
    text: L().offlineText(fmtTime(g.away)),
    buttons: [{ label: 'RECEIVE', primary: true }],
  });
}

// バックグラウンドではタイマーが止まるので、戻ったときに留守分を精算
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    endDrag(null, true);
    hiddenAt = Date.now();
    save();
    if (window.Online) Online.syncNow();
  } else {
    lastTick = performance.now();
    fieldBox = null;
    if (hiddenAt) offlineReward((Date.now() - hiddenAt) / 1000);
    hiddenAt = 0;
  }
});
window.addEventListener('pagehide', save);
window.addEventListener('beforeunload', save);

// ホーム画面アプリ（オフラインでも起動できるように）
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

// ---------- 起動 ----------
announce();
renderAll();
setInterval(tick, 100);
// 起動画面（アイコン → クレジット → 注意事項 → スロット選択 → 留守の間に）のあとで始める
function startGame() {
  booting = false;
  lastTick = performance.now();
  rateEarned0 = S.stats.earned;
  renderAll();
  if (!OPT.tutorialDone && S.stats.spawned === 0) tutStart();
  else if (OPT.seenVersion !== VERSION) showWhatsNew();
  OPT.seenVersion = VERSION;
  saveSettings();
  if (window.Gacha) Gacha.onStart();
}
document.addEventListener('DOMContentLoaded', () => (window.Boot ? Boot.start() : startGame()));

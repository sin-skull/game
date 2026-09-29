'use strict';

// =====================================================
//  無限の次へ / Beyond ∞ — モノクロ合成インクリメンタル
// =====================================================

const VERSION = '1.0.0';
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
const PANELS = ['play', 'shop', 'inf', 'vs', 'menu'];
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';

// ---------- 言語 ----------
const I18N = {
  ja: {
    shopSub: 'ステータス強化', menuSub: 'アカウント・スキン・記録・設定', vsSub: 'バトルとランキング',
    rebirthSub: '今の周回を終えて「魂」を得る。次元とスキルは残る。',
    soulSub: '魂で買う永続スキル。転生しても消えない。',
    railDrop: '↓ ドロップで売却', railTap: 'タップで売却',
    tapAnywhere: 'どこでもタップ',
    full: '空間がいっぱい。合成するか売却しよう',
    infNoMerge: '∞ 同士は、まだ合わさらない',
    railHelp: 'オブジェクトをここへドラッグして売却',
    sold: v => `${v} で売却`, undo: '取り消す', undone: '売却を取り消した',
    autoSellDesc: '満杯なら最小を売って生成を続ける',
    infHave: n => `フィールドに ∞ が ${n} つある。`,
    infHaveSub: (n, m) => `次へ進むと、コイン・オブジェクト・強化はリセット。<br>次元 +${n} ／ 収入 ×${m}`,
    infGone: '∞ はもう、ここにはない。',
    infLeft: n => `無限まで、あと ${n} 段階。`,
    infDim: (d, m) => `次元 ${d} ／ 収入 ×${m}`,
    infCurious: '無限の次、気にならない？',
    infLocked: 'LOCKED — ∞ を作ると解放',
    omegaLeft: (d, g) => `GOAL Ω — 次元 ${g} で ∞ を作る（いま次元 ${d}）`,
    omegaDone: t => `Ω CLEAR — ${t}`,
    stats: ['プレイ時間', 'タップ', '生成', '合成', '売却', '累計コイン', '最高ランク', '∞ を作った回数', '次元', '転生', 'Ω クリアタイム'],
    time: (h, m, s) => (h ? `${h}時間${m}分` : m ? `${m}分${s}秒` : `${s}秒`),
    reachedTitle: '無限に到達した。', reachedText: '…でも、無限の次って<br>気にならない？', keepPlaying: 'まだ続ける',
    beyondTitle: '無限の次へ進む？', beyondText: (n, m, s) => `コイン・オブジェクト・強化はリセット。<br>次元 +${n} ／ 収入 ×${m}${s ? ` ／ 魂 +${s}` : ''}`, cancel: 'やめる',
    dimTitle: d => `次元 ${d}`, dimText: m => `すべての収入が ×${m} になった。<br>無限の、さらに次へ。`,
    omegaTitle: 'Ω に到達した。', omegaText: t => `クリアタイム ${t}。<br>無限の次の、そのまた先。<br>ここからは、終わりのない旅。`, omegaReward: 'スキン「墨」を解放した',
    offlineText: t => `留守の間（${t}）も、生成は続いていた。`,
    sellConfirmTitle: '本当に売る？', sellConfirmText: (r, p) => `${r} を ${p} コインで売却します。`, sell: 'SELL',
    resetTitle: 'このスロットのデータを消去する？', resetText: '元には戻せません（ひとつ前のデータに戻すことはできる）。',
    otherTab: '別のタブで起動したので、ここは停止した。', resumeHere: 'ここで再開',
    rebirth: {
      inherit: ['継承転生', '強化をひとつ選んで残す。魂は少なめ。'],
      clear: ['清算転生', 'すべて 0 に戻る。魂をたんまり得る。'],
      gain: n => `魂 +${n}`, locked: n => `あと ${n} コイン稼ぐと転生できる`,
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
      rebirth: '転生できるようになった。<br>∞ タブで「継承」か「清算」を選んで、魂を得よう。',
      soul: '魂で永続スキルを買える。<br>転生しても消えない。',
      versus: 'VERSUS：相手のセーブデータの「分身」と全自動で戦う。<br>魂を賭けて、勝てば BP でスキンを解放。',
    },
    whatsNewTitle: 'アップデート v1.0',
    whatsNew: [
      'Googleログインとクラウド保存',
      'セーブスロット 3つ',
      'ランキング（次元・Ωタイム・勝利数）',
      'バトル：分身と全自動で対戦、魂を賭ける',
      '転生（継承／清算）と魂の永続スキル',
      'ゴール Ω（次元 10）',
      'スキン 8種',
      'ホーム画面アプリ（アイコン付き）',
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
      exportTitle: '書き出しコード', exportText: 'このコードを保存しておけば、別の端末でも続きから遊べる。', copy: 'COPY', copied: 'コピーした', close: '閉じる',
      importTitle: 'データを読み込む', importText: '書き出しコードを貼り付けてください。今のスロットは上書きされます。', load: 'LOAD',
      imported: '読み込んだ', importFail: 'コードが正しくない',
    },
  },
  en: {
    shopSub: 'Status upgrades', menuSub: 'Account, skins, records and settings', vsSub: 'Battle & ranking',
    rebirthSub: 'End this run to earn Souls. Dimension and skills stay.',
    soulSub: 'Permanent skills bought with Souls. They survive rebirth.',
    railDrop: '↓ DROP TO SELL', railTap: 'TAP TO SELL',
    tapAnywhere: 'TAP ANYWHERE',
    full: 'No space. Merge or sell something.',
    infNoMerge: '∞ won’t merge… yet',
    railHelp: 'Drag an object here to sell it',
    sold: v => `Sold for ${v}`, undo: 'UNDO', undone: 'Sale undone',
    autoSellDesc: 'When full, sells the smallest to keep spawning',
    infHave: n => `There ${n > 1 ? 'are' : 'is'} ${n} ∞ on the field.`,
    infHaveSub: (n, m) => `Going beyond resets coins, objects and upgrades.<br>Dimension +${n} / Income ×${m}`,
    infGone: '∞ is no longer here.',
    infLeft: n => `${n} step${n > 1 ? 's' : ''} to infinity.`,
    infDim: (d, m) => `Dimension ${d} / Income ×${m}`,
    infCurious: 'Aren’t you curious what lies beyond?',
    infLocked: 'LOCKED — make ∞ to unlock',
    omegaLeft: (d, g) => `GOAL Ω — make ∞ in dimension ${g} (now ${d})`,
    omegaDone: t => `Ω CLEAR — ${t}`,
    stats: ['Play time', 'Taps', 'Spawned', 'Merged', 'Sold', 'Total coins', 'Highest rank', '∞ made', 'Dimension', 'Rebirths', 'Ω clear time'],
    time: (h, m, s) => (h ? `${h}h ${m}m` : m ? `${m}m ${s}s` : `${s}s`),
    reachedTitle: 'You reached infinity.', reachedText: '…but aren’t you curious<br>what lies beyond?', keepPlaying: 'Keep playing',
    beyondTitle: 'Go beyond infinity?', beyondText: (n, m, s) => `Coins, objects and upgrades reset.<br>Dimension +${n} / Income ×${m}${s ? ` / Souls +${s}` : ''}`, cancel: 'Cancel',
    dimTitle: d => `Dimension ${d}`, dimText: m => `All income is now ×${m}.<br>Beyond infinity, and further.`,
    omegaTitle: 'You reached Ω.', omegaText: t => `Clear time ${t}.<br>Beyond the beyond.<br>From here, the journey never ends.`, omegaReward: 'Skin “Sumi” unlocked',
    offlineText: t => `While you were away (${t}), spawning continued.`,
    sellConfirmTitle: 'Sell this?', sellConfirmText: (r, p) => `Sell ${r} for ${p} coins.`, sell: 'SELL',
    resetTitle: 'Erase this slot?', resetText: 'This cannot be undone (you can restore the previous data once).',
    otherTab: 'The game was opened in another tab, so it paused here.', resumeHere: 'Resume here',
    rebirth: {
      inherit: ['Inherit', 'Keep one upgrade. Fewer Souls.'],
      clear: ['Liquidate', 'Everything back to 0. Lots of Souls.'],
      gain: n => `Souls +${n}`, locked: n => `Earn ${n} more coins to rebirth`,
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
      rebirth: 'You can rebirth now.<br>Pick Inherit or Liquidate in the ∞ tab to earn Souls.',
      soul: 'Spend Souls on permanent skills.<br>They survive every rebirth.',
      versus: 'VERSUS: an automatic battle against a copy of another player’s save.<br>Bet Souls, win BP, unlock skins.',
    },
    whatsNewTitle: 'Update v1.0',
    whatsNew: [
      'Google login and cloud save',
      'Three save slots',
      'Rankings (dimension, Ω time, wins)',
      'Battles against copies of other saves, with Soul bets',
      'Rebirth (Inherit / Liquidate) and permanent Soul skills',
      'A goal: Ω (dimension 10)',
      'Eight skins',
      'Home-screen app with an icon',
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
  const def = { bp: 0, skins: ['CIRCLE'], skin: 'CIRCLE', wins: 0, losses: 0, name: '', updated: 0, history: [] };
  p = { ...def, ...(p || {}) };
  if (!Array.isArray(p.skins)) p.skins = ['CIRCLE'];
  p.skins = [...new Set(['CIRCLE', ...p.skins.filter(id => SKIN_LIST.some(s => s.id === id))])];
  if (!p.skins.includes(p.skin)) p.skin = 'CIRCLE';
  if (!Array.isArray(p.history)) p.history = [];
  ['bp', 'wins', 'losses', 'updated'].forEach(k => { if (!Number.isFinite(p[k]) || p[k] < 0) p[k] = 0; });
  return p;
}
function loadProfile() {
  try { return normalizeProfile(JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}')); } catch (e) { return normalizeProfile({}); }
}
let PROFILE = loadProfile();
function saveProfile(touch = true) {
  if (touch) PROFILE.updated = Date.now();
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(PROFILE)); } catch (e) { /* 保存不可 */ }
  if (window.Online) Online.markDirty();
}

// ---------- ステータス強化 ----------
const UPGRADES = [
  {
    id: 'autoGen', jp: '自動生成', en: 'Auto Spawn', max: 25,
    cost: lv => 15 * Math.pow(1.55, lv),
    desc: lv => lv === 0 ? 'OFF → 3.00s' : `${genInterval(lv).toFixed(2)}s → ${genInterval(lv + 1).toFixed(2)}s`,
  },
  {
    id: 'autoMerge', jp: '自動合成', en: 'Auto Merge', max: 25,
    cost: lv => 40 * Math.pow(1.6, lv),
    desc: lv => lv === 0 ? 'OFF → 2.50s' : `${mergeInterval(lv).toFixed(2)}s → ${mergeInterval(lv + 1).toFixed(2)}s`,
  },
  {
    id: 'spawnCoin', jp: '生成ボーナス', en: 'Spawn Bonus', max: 50,
    cost: lv => 10 * Math.pow(1.45, lv),
    desc: lv => `+${fmt(0.1 * lv)} → +${fmt(0.1 * (lv + 1))}`,
  },
  {
    id: 'sellMult', jp: '売却倍率', en: 'Sell Rate', max: 60,
    cost: lv => 25 * Math.pow(1.5, lv),
    desc: lv => `×${(1 + 0.25 * lv).toFixed(2)} → ×${(1 + 0.25 * (lv + 1)).toFixed(2)}`,
  },
  {
    id: 'tapPower', jp: 'タップ強化', en: 'Multi Tap', max: 4,
    cost: lv => 60 * Math.pow(5, lv),
    desc: lv => `${lv + 1} → ${lv + 2}`,
  },
  {
    id: 'luck', jp: '幸運', en: 'Luck', max: 10,
    cost: lv => 80 * Math.pow(1.9, lv),
    desc: lv => `${lv * 5}% → ${(lv + 1) * 5}%`,
  },
  {
    id: 'space', jp: '空間拡張', en: 'Space', max: SPACE_CAPS.length - 1,
    cost: lv => 150 * Math.pow(12, lv),
    desc: lv => `${SPACE_CAPS[lv]} → ${SPACE_CAPS[Math.min(lv + 1, SPACE_CAPS.length - 1)]} objects`,
  },
  {
    id: 'baseTier', jp: '生成ランク', en: 'Base Rank', max: 10,
    cost: lv => 400 * Math.pow(7, lv),
    desc: lv => `${pow2(lv)} → ${pow2(lv + 1)}`,
  },
  {
    id: 'autoSell', jp: '自動売却', en: 'Auto Sell', max: 1,
    cost: () => 300,
    desc: () => L().autoSellDesc,
  },
];

// ---------- 魂の永続スキル ----------
const SKILLS = [
  {
    id: 'startAuto', jp: '自動化の記憶', en: 'Automation Memory', max: 5,
    cost: lv => Math.ceil(3 * Math.pow(2, lv)),
    desc: lv => ({ ja: `開始時 自動生成 Lv${lv * 2}・自動合成 Lv${lv} → Lv${(lv + 1) * 2}・Lv${lv + 1}`, en: `Start with Auto Spawn Lv${lv * 2} / Merge Lv${lv} → Lv${(lv + 1) * 2} / Lv${lv + 1}` }),
  },
  {
    id: 'startSpace', jp: '広い宇宙', en: 'Wide Universe', max: 2,
    cost: lv => Math.ceil(10 * Math.pow(4, lv)),
    desc: lv => ({ ja: `開始時の空間 ${SPACE_CAPS[lv]} → ${SPACE_CAPS[lv + 1]}`, en: `Starting space ${SPACE_CAPS[lv]} → ${SPACE_CAPS[lv + 1]}` }),
  },
  {
    id: 'dupMerge', jp: '二重合成', en: 'Double Merge', max: 5,
    cost: lv => Math.ceil(5 * Math.pow(2.2, lv)),
    desc: lv => ({ ja: `合成で2段階上がる確率 ${lv * 4}% → ${(lv + 1) * 4}%`, en: `Chance a merge jumps two ranks ${lv * 4}% → ${(lv + 1) * 4}%` }),
  },
  {
    id: 'golden', jp: '黄金律', en: 'Golden Ratio', max: 10,
    cost: lv => Math.ceil(4 * Math.pow(1.8, lv)),
    desc: lv => ({ ja: `すべてのコイン ×${(1 + 0.5 * lv).toFixed(1)} → ×${(1 + 0.5 * (lv + 1)).toFixed(1)}`, en: `All coins ×${(1 + 0.5 * lv).toFixed(1)} → ×${(1 + 0.5 * (lv + 1)).toFixed(1)}` }),
  },
  {
    id: 'idle', jp: '放置の達人', en: 'Idle Master', max: 5,
    cost: lv => Math.ceil(6 * Math.pow(2, lv)),
    desc: lv => ({ ja: `留守報酬 ${8 + lv * 4}時間・${50 + lv * 10}% → ${12 + lv * 4}時間・${60 + lv * 10}%`, en: `Offline ${8 + lv * 4}h at ${50 + lv * 10}% → ${12 + lv * 4}h at ${60 + lv * 10}%` }),
  },
  {
    id: 'resonance', jp: '魂の共鳴', en: 'Soul Resonance', max: 5,
    cost: lv => Math.ceil(8 * Math.pow(2, lv)),
    desc: lv => ({ ja: `得られる魂 +${lv * 20}% → +${(lv + 1) * 20}%`, en: `Souls earned +${lv * 20}% → +${(lv + 1) * 20}%` }),
  },
];

// ---------- 状態（スロットごと） ----------
function freshState(keep) {
  const up = {};
  UPGRADES.forEach(u => (up[u.id] = 0));
  const skills = {};
  SKILLS.forEach(k => (skills[k.id] = 0));
  const s = {
    coins: 0,
    objs: [],          // { id, t, x, y }  x,y はフィールド比率 0..1
    nextId: 1,
    up,
    shards: 0,
    soul: 0,
    skills,
    runEarned: 0,
    clearTime: 0,
    stats: {
      spawned: 0, merged: 0, sold: 0, earned: 0, maxTier: 0,
      infinities: 0, playTime: 0, taps: 0, bought: 0, rebirths: 0,
    },
    seenInf: false,
    created: Date.now(),
    last: Date.now(),
  };
  if (keep) {
    Object.assign(s, {
      shards: keep.shards, soul: keep.soul, skills: { ...skills, ...keep.skills },
      stats: keep.stats, clearTime: keep.clearTime, created: keep.created, seenInf: keep.seenInf,
    });
  }
  applySkillStarts(s);
  return s;
}

function applySkillStarts(s) {
  const k = s.skills || {};
  s.up.autoGen = Math.max(s.up.autoGen, (k.startAuto || 0) * 2);
  s.up.autoMerge = Math.max(s.up.autoMerge, k.startAuto || 0);
  s.up.space = Math.max(s.up.space, k.startSpace || 0);
}

function clamp01(v) { return Number.isFinite(v) ? Math.min(0.97, Math.max(0.03, v)) : 0.5; }

function normalize(d) {
  const base = freshState();
  const s = {
    ...base, ...d,
    up: { ...base.up, ...(d.up || {}) },
    skills: { ...base.skills, ...(d.skills || {}) },
    stats: { ...base.stats, ...(d.stats || {}) },
  };
  if (!Array.isArray(s.objs)) s.objs = [];
  s.objs = s.objs.filter(o => o && Number.isFinite(o.t) && o.t >= 0 && o.t <= MAX_TIER)
    .map(o => ({ id: o.id, t: o.t, x: clamp01(o.x), y: clamp01(o.y) }));
  ['coins', 'soul', 'shards', 'runEarned', 'clearTime'].forEach(k => { if (!Number.isFinite(s[k]) || s[k] < 0) s[k] = 0; });
  s.nextId = Math.max(s.nextId || 1, ...s.objs.map(o => (o.id || 0) + 1), 1);
  s.objs.forEach(o => { if (!o.id) o.id = s.nextId++; });
  UPGRADES.forEach(u => { s.up[u.id] = Math.min(u.max, Math.max(0, Math.floor(s.up[u.id] || 0))); });
  SKILLS.forEach(k => { s.skills[k.id] = Math.min(k.max, Math.max(0, Math.floor(s.skills[k.id] || 0))); });
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

function save() {
  if (paused) return;
  S.last = Date.now();
  try { localStorage.setItem(SLOT_KEYS[OPT.slot], JSON.stringify(S)); } catch (e) { /* 保存不可 */ }
  if (window.Online) Online.markDirty();
}

function backup() {
  try { localStorage.setItem(BACKUP_KEY, JSON.stringify(S)); } catch (e) { /* 保存不可 */ }
}

// ---------- 計算 ----------
const genInterval = lv => Math.max(0.15, 3 * Math.pow(0.86, lv - 1));
const mergeInterval = lv => Math.max(0.1, 2.5 * Math.pow(0.86, lv - 1));
const prestigeMult = () => Math.pow(2, S.shards);
const goldenMult = () => 1 + 0.5 * (S.skills.golden || 0);
const incomeMult = () => prestigeMult() * goldenMult();
const sellMult = () => (1 + 0.25 * S.up.sellMult) * incomeMult();
const sellPrice = t => Math.pow(2, t) * sellMult();
const spawnCoin = () => 0.1 * S.up.spawnCoin * incomeMult();
const cap = () => SPACE_CAPS[S.up.space];
const upCost = u => Math.ceil(u.cost(S.up[u.id]));
const skillCost = k => k.cost(S.skills[k.id]);
function pow2(t) { return '2' + String(t).split('').map(c => SUP[c]).join(''); }
const rankName = t => (t >= MAX_TIER ? '∞' : pow2(t));
const dimStr = (s = S) => String(s.shards + 1).padStart(2, '0');
const offlineCapSec = () => (8 + 4 * (S.skills.idle || 0)) * 3600;
const offlineRate = () => 0.5 + 0.1 * (S.skills.idle || 0);

// 転生で得られる魂
const soulMult = () => (1 + 0.2 * (S.skills.resonance || 0)) * (1 + 0.1 * S.shards);
function soulBase() {
  return Math.floor(Math.floor(Math.sqrt(S.runEarned / 500)) * soulMult());
}
function soulToNext() {
  // 魂が1以上になるのに必要な今回の稼ぎ
  let need = 500;
  while (Math.floor(Math.floor(Math.sqrt(need / 500)) * soulMult()) < 1) need *= 1.2;
  return Math.max(0, Math.ceil(need - S.runEarned));
}

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
  account: $('sub-account'), skinList: $('sub-skin'),
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
function diameter(t) { return (t >= MAX_TIER ? 136 : 24 + t * 5.2) * scale(); }
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
    const p = clampPos(t, Math.random(), y0 + Math.random() * yr);
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

function rollTier() {
  let t = S.up.baseTier;
  if (Math.random() < S.up.luck * 0.05) t++;
  return Math.min(t, MAX_TIER - 1);
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
  if (a.t >= MAX_TIER) {
    toast(L().infNoMerge);
    return false;
  }
  S.objs = S.objs.filter(o => o !== a);
  const from = b.t;
  b.t++;
  if (b.t < MAX_TIER && Math.random() < (S.skills.dupMerge || 0) * 0.04) b.t++;   // 二重合成
  Object.assign(b, clampPos(b.t, b.x, b.y));
  S.stats.merged++;
  fx.pop.add(b.id);
  rippleAt(b, diameter(b.t) * 1.8);
  floatAt(b, b.t - from > 1 ? `${pow2(from)} ×4 = ${rankName(b.t)}` : `${pow2(from)} + ${pow2(from)} = ${rankName(b.t)}`, 'formula');
  if (selected === a.id || selected === b.id) selected = null;
  sfx.merge(b.t);
  vibe(b.t >= MAX_TIER ? [30, 40, 60] : 8);
  noteTier(b.t);
  dirty = true;
  S.objs.forEach(o => { if (o !== b && !busy.has(o.id)) separate(o); });
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
    if (S.shards + 1 >= OMEGA_DIM && !S.clearTime) {
      S.clearTime = Math.max(1, Math.floor(S.stats.playTime));
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
  if (S.up[u.id] >= u.max || S.coins < cost) { sfx.deny(); return; }
  S.coins -= cost;
  S.up[u.id]++;
  S.stats.bought++;
  sfx.buy();
  vibe(6);
  dirty = true;
  renderShop();
  save();
}

function buySkill(k) {
  const cost = skillCost(k);
  if (S.skills[k.id] >= k.max || S.soul < cost) { sfx.deny(); return; }
  S.soul -= cost;
  S.skills[k.id]++;
  applySkillStarts(S);
  sfx.buy();
  vibe(6);
  dirty = true;
  renderInf();
  save();
}

const infCount = () => S.objs.filter(o => o.t >= MAX_TIER).length;

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
    shards: s.shards, soul: s.soul, skills: s.skills, stats: s.stats,
    clearTime: s.clearTime, created: s.created, seenInf: s.seenInf, ...extra,
  };
}

function prestige() {
  const gain = infCount();
  if (!gain) return;
  const souls = soulBase();
  S = freshState(keepFrom(S, { shards: S.shards + gain, soul: S.soul + souls }));
  clearField();
  save();
  renderAll();
  switchPanel('play');
  const l = L();
  showModal({
    rings: 'DIM',
    title: l.dimTitle(dimStr()),
    text: l.dimText(fmt(prestigeMult())) + (souls ? `<br>${l.soul('+' + fmt(souls))}` : ''),
    buttons: [{ label: 'START', primary: true }],
  });
  if (window.Online) Online.syncSoon();
}

function rebirth(keepId) {
  const base = soulBase();
  if (base < 1) return;
  const gain = keepId ? Math.max(1, Math.floor(base * 0.35)) : base;
  const kept = keepId ? S.up[keepId] : 0;
  S.stats.rebirths = (S.stats.rebirths || 0) + 1;
  S = freshState(keepFrom(S, { soul: S.soul + gain }));
  if (keepId) S.up[keepId] = Math.max(S.up[keepId], kept);
  clearField();
  save();
  renderAll();
  switchPanel('play');
  sfx.inf();
  toast(L().rebirth.done(fmt(gain)));
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
    return `<div class="body sk">${skinSVG(skin, t, d || diameter(t))}</div>`;
  }
  if (t >= MAX_TIER) return '<div class="body inf"><span class="v">∞</span></div>';
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
  const rate = S.up.autoGen ? spawnCoin() / genInterval(S.up.autoGen) : 0;
  els.rate.textContent = rate > 0 ? `+${fmt(Math.round(rate * 10) / 10)} / s` : '';
  els.dim.textContent = `DIM ${dimStr()}${S.clearTime ? ' · Ω' : ''}`;
  els.count.textContent = `${S.objs.length} / ${cap()}`;
  const affordable = UPGRADES.some(u => S.up[u.id] < u.max && S.coins >= upCost(u));
  els.shopBadge.classList.toggle('on', affordable);
  const skillAffordable = SKILLS.some(k => S.skills[k.id] < k.max && S.soul >= skillCost(k));
  els.infBadge.classList.toggle('on', infCount() > 0 || skillAffordable || (soulBase() >= 1 && S.stats.rebirths === 0));
  const skinAffordable = SKIN_LIST.some(s => s.cost > 0 && !PROFILE.skins.includes(s.id) && PROFILE.bp >= s.cost);
  els.menuBadge.classList.toggle('on', skinAffordable);
  if (soulBase() >= 1) showTip('rebirth');
}

function upgradeRow(i, name, sub, desc, lv, max, costLabel, can, maxed, attr) {
  const n = Math.min(max, 20);
  const on = Math.ceil((lv / max) * n);
  const ticks = Array.from({ length: n }, (_, k) => `<i class="${k < on ? 'on' : ''}"></i>`).join('');
  return `<div class="up ${!maxed && !can ? 'locked' : ''}">
    <div class="up-no">${String(i + 1).padStart(2, '0')}</div>
    <div>
      <div class="up-jp">${name}</div>
      <div class="up-en">${sub}</div>
      <div class="up-desc"><span>${maxed ? 'MAX' : desc}</span><span class="ticks">${ticks}</span></div>
    </div>
    <button class="pill ${maxed ? 'max' : ''}" ${attr} ${maxed || !can ? 'disabled' : ''}>${maxed ? 'MAX' : costLabel}</button>
  </div>`;
}

function renderShop() {
  const ja = OPT.lang === 'ja';
  els.upgrades.innerHTML = UPGRADES.map((u, i) => {
    const lv = S.up[u.id], cost = upCost(u);
    return upgradeRow(i, ja ? u.jp : u.en, `${ja ? u.en.toUpperCase() + ' · ' : ''}LV ${lv}`, u.desc(lv),
      lv, u.max, fmt(cost), S.coins >= cost, lv >= u.max, `data-id="${u.id}"`);
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
  const l = L();
  const mt = S.stats.maxTier;
  els.infPath.innerHTML = Array.from({ length: MAX_TIER + 1 }, (_, t) =>
    `<i class="${t <= mt ? 'got' : ''} ${t === MAX_TIER ? 'last' : ''}"></i>`).join('');
  els.infPath.style.setProperty('--prog', (mt / MAX_TIER) * 100 + '%');
  const count = infCount();
  if (count) {
    els.infMain.innerHTML = l.infHave(count);
    els.infSub.innerHTML = l.infHaveSub(count, fmt(Math.pow(2, S.shards + count) * goldenMult()));
    els.infNote.textContent = '';
  } else {
    els.infMain.innerHTML = mt >= MAX_TIER ? l.infGone : l.infLeft(MAX_TIER - mt);
    els.infSub.innerHTML = S.shards ? l.infDim(dimStr(), fmt(prestigeMult())) : l.infCurious;
    els.infNote.textContent = l.infLocked;
  }
  els.prestigeBtn.disabled = !count;

  // Ω までの道のり
  const dimNow = S.shards + 1;
  els.omegaBar.innerHTML = `<div class="omega-text">${S.clearTime ? l.omegaDone(fmtTime(S.clearTime)) : l.omegaLeft(dimNow, OMEGA_DIM)}</div>
    <div class="omega-steps">${Array.from({ length: OMEGA_DIM }, (_, i) => `<i class="${i < dimNow ? 'on' : ''}"></i>`).join('')}<b class="${S.clearTime ? 'on' : ''}">Ω</b></div>`;

  // 転生
  const r = l.rebirth, base = soulBase();
  els.rebirth.innerHTML = `
    <div class="soul-now">◇ ${l.soul(fmt(S.soul))}</div>
    <div class="rb-row">
      <button class="rb" data-rb="inherit" ${base < 1 ? 'disabled' : ''}><b>${r.inherit[0]}</b><small>${r.inherit[1]}</small><em>${r.gain(fmt(base ? Math.max(1, Math.floor(base * 0.35)) : 0))}</em></button>
      <button class="rb" data-rb="clear" ${base < 1 ? 'disabled' : ''}><b>${r.clear[0]}</b><small>${r.clear[1]}</small><em>${r.gain(fmt(base))}</em></button>
    </div>
    ${base < 1 ? `<p class="inf-note">${r.locked(fmt(soulToNext()))}</p>` : ''}`;

  // 魂スキル
  const ja = OPT.lang === 'ja';
  els.skills.innerHTML = SKILLS.map((k, i) => {
    const lv = S.skills[k.id], cost = skillCost(k), dsc = k.desc(lv);
    return upgradeRow(i, ja ? k.jp : k.en, `${ja ? k.en.toUpperCase() + ' · ' : ''}LV ${lv}`, ja ? dsc.ja : dsc.en,
      lv, k.max, `◇ ${fmt(cost)}`, S.soul >= cost, lv >= k.max, `data-skill="${k.id}"`);
  }).join('');
}

function renderStats() {
  const st = S.stats;
  const vals = [
    fmtTime(st.playTime), fmt(st.taps), fmt(st.spawned), fmt(st.merged), fmt(st.sold),
    fmt(Math.floor(st.earned)), rankName(st.maxTier), fmt(st.infinities), dimStr(), fmt(st.rebirths || 0),
    S.clearTime ? fmtTime(S.clearTime) : '—',
  ];
  els.stats.innerHTML = L().stats.map((k, i) => `<dt>${k}</dt><dd>${vals[i]}</dd>`).join('');
  els.dex.innerHTML = Array.from({ length: MAX_TIER + 1 }, (_, t) => {
    const known = t <= st.maxTier;
    return `<div class="dex-cell ${known ? '' : 'unknown'}"><div class="mini">${known ? skinSVG(PROFILE.skin, t, t >= MAX_TIER ? 34 : Math.min(34, 14 + t)) : '<i class="q"></i>'}</div>${rankName(t)}</div>`;
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

function renderSkins() {
  const sk = L().skin, ja = OPT.lang === 'ja';
  els.skinList.innerHTML = `<div class="bp-now">BP ${fmt(PROFILE.bp)}</div><div class="skin-grid">${SKIN_LIST.map(s => {
    const owned = PROFILE.skins.includes(s.id), on = PROFILE.skin === s.id;
    const btn = on ? `<button class="opt-btn" disabled>${sk.equipped}</button>`
      : owned ? `<button class="opt-btn" data-equip="${s.id}">${sk.equip}</button>`
        : s.cost < 0 ? `<button class="opt-btn" disabled>${sk.omegaOnly}</button>`
          : `<button class="pill" data-unlock="${s.id}" ${PROFILE.bp < s.cost ? 'disabled' : ''}>${sk.bp(s.cost)}</button>`;
    const prev = [0, 5, 11, MAX_TIER].map(t => `<span>${skinSVG(s.id, t, t >= MAX_TIER ? 40 : 18 + t * 1.6)}</span>`).join('');
    return `<div class="skin-card ${on ? 'on' : ''} ${owned ? '' : 'lock'}">
      <div class="skin-prev">${prev}</div>
      <div class="skin-name">${s.id}<small>${ja ? s.jp : s.en}</small></div>
      <div class="skin-desc">${SKIN_DESC[s.id][ja ? 0 : 1]}</div>
      ${btn}
    </div>`;
  }).join('')}</div>`;
}

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
  renderSkins();
  renderStats();
  renderOptions();
}

function applyLanguage() {
  document.documentElement.lang = OPT.lang;
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
  if (name === 'inf') { renderInf(); if (S.soul > 0) showTip('soul'); }
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
    nav.parentElement.querySelectorAll('.sub').forEach(s => s.classList.toggle('on', s.id === 'sub-' + b.dataset.sub));
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
      { label: 'BEYOND ∞ &nbsp;→', primary: true, onClick: () => switchPanel('inf') },
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
    text: `${l.omegaText(fmtTime(S.clearTime))}<br><br>${l.omegaReward}`,
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
  const b = e.target.closest('.pill');
  if (b) buy(UPGRADES.find(u => u.id === b.dataset.id));
});

els.skills.addEventListener('click', e => {
  const b = e.target.closest('[data-skill]');
  if (b) buySkill(SKILLS.find(k => k.id === b.dataset.skill));
});

els.rebirth.addEventListener('click', e => {
  const b = e.target.closest('[data-rb]');
  if (!b || b.disabled) return;
  const l = L(), r = l.rebirth, ja = OPT.lang === 'ja';
  const base = soulBase();
  const confirm = keepId => {
    const gain = keepId ? Math.max(1, Math.floor(base * 0.35)) : base;
    const u = keepId && UPGRADES.find(x => x.id === keepId);
    showModal({
      rings: '◇',
      title: r.confirmTitle,
      text: r.confirmText(fmt(gain), u ? `${ja ? u.jp : u.en} Lv${S.up[keepId]}` : ''),
      buttons: [{ label: 'REBIRTH', primary: true, onClick: () => rebirth(keepId) }, { label: l.cancel }],
    });
  };
  if (b.dataset.rb === 'clear') { confirm(null); return; }
  const opts = UPGRADES.filter(u => S.up[u.id] > 0);
  if (!opts.length) { confirm(null); return; }
  showModal({
    title: r.pickTitle,
    html: `<div class="pick">${opts.map(u => `<button data-keep="${u.id}">${ja ? u.jp : u.en}<span>Lv ${S.up[u.id]}</span></button>`).join('')}</div>`,
    buttons: [{ label: l.cancel }],
  });
  els.modalBody.querySelectorAll('[data-keep]').forEach(k => {
    k.onclick = () => { closeModal(); setTimeout(() => confirm(k.dataset.keep), 150); };
  });
});

els.prestigeBtn.addEventListener('click', () => {
  const gain = infCount();
  if (!gain) return;
  const l = L();
  showModal({
    rings: '∞',
    title: l.beyondTitle,
    text: l.beyondText(gain, fmt(Math.pow(2, S.shards + gain) * goldenMult()), soulBase() ? fmt(soulBase()) : 0),
    buttons: [{ label: 'BEYOND ∞ &nbsp;→', primary: true, onClick: prestige }, { label: l.cancel }],
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

els.skinList.addEventListener('click', e => {
  const eq = e.target.closest('[data-equip]');
  if (eq) {
    PROFILE.skin = eq.dataset.equip;
    saveProfile();
    renderAll();
    return;
  }
  const un = e.target.closest('[data-unlock]');
  if (un) {
    const s = SKIN_LIST.find(x => x.id === un.dataset.unlock);
    if (PROFILE.bp < s.cost) { toast(L().skin.needBp); sfx.deny(); return; }
    PROFILE.bp -= s.cost;
    PROFILE.skins.push(s.id);
    PROFILE.skin = s.id;
    saveProfile();
    sfx.win();
    toast(L().skin.unlocked(OPT.lang === 'ja' ? s.jp : s.id));
    renderAll();
  }
});

els.options.addEventListener('click', e => {
  const seg = e.target.closest('[data-opt]');
  if (seg) {
    const key = seg.dataset.opt;
    let v = seg.dataset.val;
    if (v === 'true') v = true; else if (v === 'false') v = false;
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
    if (o.t >= MAX_TIER || busy.has(o.id)) continue;
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
    const cheapest = Math.min(...UPGRADES.filter(u => S.up[u.id] < u.max).map(upCost));
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
document.addEventListener('contextmenu', e => { if (!e.target.closest('textarea, input')) e.preventDefault(); });
document.addEventListener('selectstart', e => { if (!e.target.closest('textarea, input')) e.preventDefault(); });
document.addEventListener('touchmove', e => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
let lastTouchEnd = 0;
document.addEventListener('touchend', e => {
  const now = Date.now();
  if (now - lastTouchEnd < 300 && !e.target.closest('textarea, input, button')) e.preventDefault();
  lastTouchEnd = now;
}, { passive: false });

window.addEventListener('resize', () => {
  fieldBox = null;
  nodes.forEach(el => (el.dataset.k = ''));
  S.objs.forEach(o => Object.assign(o, clampPos(o.t, o.x, o.y)));
  dirty = true;
});

document.addEventListener('keydown', e => {
  if (e.target.closest && e.target.closest('textarea, input')) return;
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

function tick() {
  const now = performance.now();
  const dt = Math.min(1, (now - lastTick) / 1000);
  lastTick = now;
  if (paused) return;
  S.stats.playTime += dt;

  if (S.up.autoGen) {
    genAcc += dt;
    const iv = genInterval(S.up.autoGen);
    while (genAcc >= iv) { genAcc -= iv; spawnOne(false); }
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
  tutUpdate(false);

  saveAcc += dt;
  if (saveAcc > 5) { saveAcc = 0; save(); }
}

function offlineReward(away) {
  away = Math.min(offlineCapSec(), away);
  if (away < 30 || !S.up.autoGen || paused) return;
  const spawns = away / genInterval(S.up.autoGen);
  const coins = spawns * (spawnCoin() + sellPrice(S.up.baseTier) * offlineRate());
  if (coins < 1) return;
  addCoins(coins);
  showModal({
    title: `+${fmt(Math.floor(coins))} COIN`,
    text: L().offlineText(fmtTime(away)),
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
offlineReward((Date.now() - (S.last || Date.now())) / 1000);
if (!OPT.tutorialDone && S.stats.spawned === 0) tutStart();
else if (OPT.seenVersion !== VERSION) showWhatsNew();
OPT.seenVersion = VERSION;
saveSettings();
setInterval(tick, 100);

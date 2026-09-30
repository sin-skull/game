'use strict';

// =====================================================
//  GATE VADER — 撃つか、育てるか。数字のインフレが止まらないゲートシューター
//  v0.4  主人公はワニ。左＝流れてくる魚（撃って食べる）/ 右＝迫ってくるゲートとアイテム。
//        食べ逃すと飢え、飢餓ゲージが尽きたら餓死。何かに当たったら（ハートがなければ）負け。
//        ゲートは撃つほど数値が動き、到達した瞬間に自分の強さ（ダメージ・段数・人数）が確定する。
// =====================================================

const VERSION = '0.14.0';
const W = 360, H = 640;                 // 論理サイズ（縦画面）。画面に合わせて拡縮する
const Q = new URLSearchParams(location.search);
const DEV = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);   // 開発用パラメータは手元でだけ効く
const TS = DEV ? Math.min(60, Math.max(0.1, +Q.get('ts') || 1)) : 1;   // 開発用：時間の倍率
const BOT = DEV && Q.has('bot');                                     // 開発用：自動操縦

// ---------- 進行のペース ----------
// ステージ制：本編は 10 ステージ（6分ほど）。毎ステージ最後にボス、10 の倍数で大ボス。
// 11 から先は ∞ COIN RUSH：速さは上限で止まり、クリアするたびにコインが雪だるま式に増える腕前勝負
const STAGES = 10;
const SPEED_CAP = 2.6;
const STAGE_SEC = (DEV && +Q.get('stage')) || 24;   // 1ステージの道のり（秒）。ボス戦を足して 30〜40 秒
const stageSpeed = n => (n <= STAGES ? 1 + (n - 1) / (STAGES - 1) : Math.min(SPEED_CAP, 2 + 0.06 * (n - STAGES)));   // ステージ10で2倍、その先は上限まで
const stageLen = n => STAGE_SEC * stageSpeed(n);

// ---------- 盤面 ----------
const MID = W / 2;                           // 左半分＝ワニ、右半分＝ゲート
const PY = 560;                               // 自機の高さ（左右には自由に動ける）
const GATE_W = 84, GATE_H = 46, GATE_X = [MID + 6, MID + 6 + GATE_W + 6];
const GATE_GAP = 170;                        // ゲートの間隔（進んだ距離）。1列に1つ
const MOB_VY = 36, GATE_VY = 34, BULLET_V = 900, ROW_H = 14;   // 迫ってくる速さ（暇にならないよう速め）
const METER = 10;                            // 表示用：内部の1を10mとして見せる
const LMAX = 15, CMAX = 8;                   // 段数と人数の上限
const HP_MAX = 3;                              // ハートは1つで始まり、LIFE ゲート・HEAL でだけ増える（最大3）
const FOOD_MAX = 10, FOOD_EAT = 0.5;         // 飢餓ゲージ：1匹逃すと-1、1匹食べると+0.5
const DMG_CAP = 1e250;                       // ダメージの上限（ボスHPなどが数の限界を超えないように）
const PIERCE_MAX = 6;                        // 1発で貫ける数の上限（∞ MODE で無敵にならないように）
// 最初は 1秒に1発・1列・1人。ゲートで 連射・段数・仲間・威力 を増やしていく（序盤つらい → 中盤楽しい → 終盤苦しい）
const ST0 = { dmg: 1, lines: 1, crew: 1, rate: 1, wp: 'normal' };
const RMAX = 12;                             // 連射（1秒あたり）の上限
// 武器：撃ち方が変わる（弾はまっすぐ上に飛ぶのが基本）
const WEAPONS = ['normal', 'spread', 'bounce', 'beam', 'wave'];   // 旅の途中の WEAPON ゲートで切り替わる撃ち方
const WP_NAME = { normal: 'NORMAL', spread: 'SPREAD', bounce: 'BOUNCE', beam: 'BEAM', wave: 'WAVE', shotgun: 'SHOTGUN', homing: 'HOMING', trident: 'TRIDENT' };

// ---------- 設定・セーブ ----------
const SETTINGS_KEY = 'gate-settings';
const SLOT_KEYS = ['gate-slot-0', 'gate-slot-1', 'gate-slot-2'];
function loadOpt() {
  const d = { slot: 0, light: false, sound: true, bootSeen: false, noticeVer: '', lightAsked: false, tutDone: false,
    lang: (navigator.language || '').startsWith('ja') ? 'ja' : 'en' };
  try { return Object.assign(d, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')); } catch (e) { return d; }
}
const OPT = loadOpt();
function saveOpt() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(OPT)); } catch (e) { /* 保存不可 */ } }
function readSlot(i) {
  try {
    const d = JSON.parse(localStorage.getItem(SLOT_KEYS[i]) || 'null');
    if (!d) return null;
    const f = freshSlot();
    const skins = Object.assign(f.skins, d.skins || {});
    for (const k in skins) if (skins[k] === true) skins[k] = 1;   // 旧形式（持っているだけ）→ Lv1
    return { best: +d.best || 0, runs: +d.runs || 0, run: d.run && typeof d.run === 'object' ? d.run : null, coins: +d.coins || 0,
      pearls: d.pearls == null ? f.pearls : +d.pearls, maxStage: +d.maxStage || 0, pity: Object.assign(f.pity, d.pity || {}),
      weapons: Object.assign(f.weapons, d.weapons || {}), weapon: d.weapon || f.weapon, skins, skin: d.skin || f.skin };
  } catch (e) { return null; }
}
// ---------- 装備（武器）とスキン ----------
// 手に入れるのは ガチャ（パール）。強くするのは コイン。どちらもずっと使える
// 武器：撃ち方と、最初の連射・段数・威力が決まる
const WEAPON_DEF = [
  { id: 'pea', r: 'N', pat: 'normal', rate: 1, lines: 1, dmg: 1 },
  { id: 'twin', r: 'N', pat: 'normal', rate: 1, lines: 2, dmg: 1 },
  { id: 'fan', r: 'N', pat: 'spread', rate: 1, lines: 3, dmg: 1 },
  { id: 'rapid', r: 'R', pat: 'normal', rate: 3, lines: 1, dmg: 1 },
  { id: 'bouncer', r: 'R', pat: 'bounce', rate: 2, lines: 2, dmg: 2 },
  { id: 'wave', r: 'R', pat: 'wave', rate: 2, lines: 2, dmg: 2 },
  { id: 'shotgun', r: 'SR', pat: 'shotgun', rate: 2, lines: 5, dmg: 2 },
  { id: 'homing', r: 'SR', pat: 'homing', rate: 2, lines: 2, dmg: 3 },
  { id: 'beam', r: 'SR', pat: 'beam', rate: 2, lines: 3, dmg: 4 },
  { id: 'trident', r: 'SSR', pat: 'trident', rate: 3, lines: 3, dmg: 6 },
  { id: 'jaws', r: 'SSR', pat: 'beam', rate: 4, lines: 4, dmg: 10 },
];
// スキン：見た目（体・影・目の色）と、レベルで伸びる小さな効果（pas × Lv）
const SKIN_DEF = [
  { id: 'green', r: 'N', c: '#39ff88', d: '#1f9d54', e: '#ffe14a', pas: 'food', v: 1 },
  { id: 'olive', r: 'N', c: '#a6d13a', d: '#5f7d1c', e: '#ffffff', pas: 'coin', v: 0.08 },
  { id: 'sky', r: 'N', c: '#4ab3ff', d: '#1f5f9d', e: '#ffe14a', pas: 'eat', v: 0.1 },
  { id: 'pink', r: 'R', c: '#ff7ab8', d: '#a8406f', e: '#ffffff', pas: 'food', v: 2 },
  { id: 'gold', r: 'R', c: '#ffd84a', d: '#a8841c', e: '#ff4d4d', pas: 'coin', v: 0.15 },
  { id: 'snow', r: 'R', c: '#e8f4ff', d: '#8aa0b8', e: '#39a0ff', pas: 'dmg', v: 0.1 },
  { id: 'violet', r: 'SR', c: '#b07aff', d: '#5a3a9d', e: '#ffe14a', pas: 'dmg', v: 0.2 },
  { id: 'crimson', r: 'SR', c: '#ff5a5a', d: '#8d1f1f', e: '#ffe14a', pas: 'rate', v: 0.5 },
  { id: 'shadow', r: 'SSR', c: '#2f3642', d: '#141920', e: '#39ff88', pas: 'coin', v: 0.3 },
  { id: 'neon', r: 'SSR', c: '#00fff0', d: '#008a80', e: '#ff3df0', pas: 'dmg', v: 0.4 },
];
const RARITY = { N: { w: 60, col: '#cfd8d2' }, R: { w: 28, col: '#4ab3ff' }, SR: { w: 10, col: '#b07aff' }, SSR: { w: 2, col: '#ffd84a' } };
// ガチャはパールで引く。パールはステージの初回クリアでもらえる（大ボスは多め）。50回目は SSR 確定（天井）
const GACHA_COST = 50;
const PITY = 50;
const FIRST_CLEAR = { normal: 5, big: 30 };
const DUP_COINS = { N: 60, R: 150, SR: 400, SSR: 1000 };   // もう持っているものが出たらコインに
// 強化：コインでレベルを上げる
const WLV_MAX = 10, SLV_MAX = 5;
const W_UP_BASE = { N: 40, R: 80, SR: 160, SSR: 300 }, S_UP_BASE = { N: 60, R: 120, SR: 240, SSR: 480 };
const wUpCost = (w, lv) => Math.round(W_UP_BASE[w.r] * Math.pow(1.7, lv - 1));
const sUpCost = (k, lv) => Math.round(S_UP_BASE[k.r] * Math.pow(1.8, lv - 1));
const wDmg = (w, lv) => w.dmg * Math.pow(1.35, lv - 1);          // レベルで威力 ×1.35
const wRate = (w, lv) => w.rate + Math.floor((lv - 1) / 3);      // 3レベルごとに連射+1
const skinBonus = (pas) => { const k = skinOf(SLOT.skin); return k.pas === pas ? k.v * (SLOT.skins[k.id] || 1) : 0; };
const freshSlot = () => ({ best: 0, runs: 0, run: null, coins: 0, pearls: GACHA_COST, maxStage: 0, pity: { weapon: 0, skin: 0 },
  weapons: { pea: 1 }, weapon: 'pea', skins: { green: 1 }, skin: 'green' });
const weaponOf = id => WEAPON_DEF.find(w => w.id === id) || WEAPON_DEF[0];
const skinOf = id => SKIN_DEF.find(k => k.id === id) || SKIN_DEF[0];
const coinsFor = (m, bosses) => Math.floor((Math.floor(m * METER / 10) + bosses * 25) * (1 + skinBonus('coin')));   // 10m で1コイン、ボス1体で25（スキンで増える）
let SLOT = readSlot(OPT.slot) || freshSlot();
function writeSlot() { try { localStorage.setItem(SLOT_KEYS[OPT.slot], JSON.stringify(SLOT)); } catch (e) { /* 保存不可 */ } }
function selectSlot(i) { OPT.slot = i; saveOpt(); SLOT = readSlot(i) || freshSlot(); }

// ---------- 文言（タイトルの GATE VADER 以外は 日本語 / English で切り替え） ----------
const I18N = {
  ja: {
    stat: { dmg: '威力', lines: '段数', crew: '仲間', rate: '連射', life: 'ライフ', weapon: '武器' },
    wp: { normal: 'ノーマル', spread: '拡散', bounce: '反射', beam: 'ビーム', wave: 'ウェーブ', shotgun: 'ショットガン', homing: 'ホーミング', trident: '貫通' },
    item: { crew: '仲間', heal: '回復', power: 'パワー' },
    food: 'エサ', gate: 'ゲート', best: 'ベスト', speed: '速さ', menu: 'メニュー',
    boss: 'ボス', bigBoss: '大ボス', bossDown: '撃破！', bigDown: '大ボス撃破！',
    stageClear: n => `ステージ ${n} クリア！`, stageName: n => (n > STAGES ? `∞ ${n}` : `ステージ ${n}/${STAGES}`), hit: '当たった！',
    mods: { normal: '', school: '魚の群れ', current: '急流', golden: '金の魚（食べるとコイン）', minus: '逆流ゲート', rush: 'ゲートラッシュ', dark: '深海' },
    attacks: { plain: '', bubble: '泡を撃つ', charge: '突進', summon: '魚を呼ぶ', ink: '墨を吐く' },
    coinRush: n => `コイン +${n}`,
    lifeUp: 'ライフ+1', crewUp: '仲間+1', hpUp: 'ライフ+1', powerUp: '威力×1.3',
    start: 'スタート', newRun: '新しく始める', cont: 'つづきから', light: '軽量', sound: '音', slot: 'スロット',
    how: '遊び方', lang: 'English', on: 'ON', off: 'OFF',
    pause: '一時停止', resume: '再開', quit: '保存して終了', retry: 'もう一度', title: 'タイトル',
    over: 'ゲームオーバー', starved: '餓死…', newBest: 'ベスト更新！', eaten: n => `${n}匹食べた`,
    menuSub: (b, r) => `ベスト ${b} m ・ ${r} 回`,
    lightToast: '軽量モードにしました（タイトルで切り替えできます）',
    skip: 'スキップ', close: 'とじる',
    coins: 'コイン', back: 'もどる', gacha: 'ガチャ', equip: '装備・強化', gWeapon: '武器', gSkin: 'スキン', pull: '引く',
    gNew: 'NEW!', gDup: n => `もう持っている → ${n} コイン`, pearl: 'パール', up: '強化',
    pity: n => `SSR確定まで あと${n}回`, pearlHow: 'パールは、ステージを初めてクリアするともらえる（大ボスは多め）',
    firstClear: n => `初回クリア！ パール+${n}`, pearlGot: n => `パール +${n}`,
    pas: { food: v => `満腹 +${v}`, coin: v => `コイン +${Math.round(v * 100)}%`, eat: v => `食べて回復 +${Math.round(v * 100)}%`,
      dmg: v => `威力 +${Math.round(v * 100)}%`, rate: v => `連射 +${Math.floor(v)}` },
    earned: n => `+${n} コイン`,
    wname: { pea: '豆鉄砲', twin: 'ツイン', fan: 'ファン', rapid: 'ラピッド', bouncer: 'バウンサー', wave: 'ウェーブ',
      shotgun: 'ショットガン', homing: 'ホーミング', beam: 'ビームキャノン', trident: 'トライデント', jaws: 'ジョーズ' },
    sname: { green: 'みどり', olive: 'オリーブ', sky: 'そら', pink: 'ピンク', gold: 'ゴールド', snow: 'スノー',
      violet: 'バイオレット', crimson: 'クリムゾン', shadow: 'シャドウ', neon: 'ネオン' },
    tut: [
      '画面をドラッグして、ワニを左右に動かそう',
      '左の魚を撃って食べよう。\n逃すと左上の🍖が減り、空になると餓死',
      '右のゲートは、弾1発ごとに数値が1ずつ良くなる。\nマイナスも撃ち続ければプラスに変わる',
      'ゲートは、くぐると効果が決まる。\n欲しいゲートの下へ動いて、くぐろう',
      '点線のアイテムは、壊すと手に入る。\n壊さずにぶつかると負け（ライフは1つ）',
      'ライフ・武器のゲートは、たまにだけ出る。\nできるだけ遠くまで進もう！',
    ],
    help: [
      ['動かす', '画面のどこでもドラッグすると、ワニが左右に動く。弾はまっすぐ上に飛ぶ'],
      ['左：エサ', '魚を撃つと食べられる。逃すと🍖が減り、空になると餓死'],
      ['右：ゲート', '弾1発ごとに数値が1良くなる。くぐると 威力・連射・段数・仲間 が変わる。くぐらなければ何も起きない'],
      ['アイテム', '点線の箱は壊すと手に入る。壊さずにぶつかるとライフ-1（0で負け）。避けてもいい'],
      ['ライフ・武器', 'たまにだけ出るゲート。武器ゲートは撃つと中身が切り替わる'],
      ['ボス', '毎ステージの最後に大きな魚。泡・突進・墨などで攻撃してくる。当たるか、下まで来られたら負け。10の倍数は大ボス'],
      ['ゴール', '10ステージで GAME CLEAR。その先は ∞ COIN RUSH：クリアするたびにコインが雪だるま式に増える'],
      ['コイン・パール', '進んだ距離はコインになり、装備の強化に使う。ステージを初めてクリアするとパールがもらえ、ガチャで武器とスキンが手に入る'],
    ],
  },
  en: {
    stat: { dmg: 'DMG', lines: 'LINE', crew: 'CREW', rate: 'RATE', life: 'LIFE', weapon: 'WEAPON' },
    wp: WP_NAME,
    item: { crew: 'CREW', heal: 'HEAL', power: 'POWER' },
    food: 'FOOD', gate: 'GATE', best: 'BEST', speed: 'SPEED', menu: 'MENU',
    boss: 'BOSS', bigBoss: 'BIG BOSS', bossDown: 'BOSS DOWN', bigDown: 'BIG BOSS DOWN!',
    stageClear: n => `STAGE ${n} CLEAR!`, stageName: n => (n > STAGES ? `∞ ${n}` : `STAGE ${n}/${STAGES}`), hit: 'HIT!',
    mods: { normal: '', school: 'FISH SCHOOL', current: 'FAST CURRENT', golden: 'GOLDEN FISH (coins)', minus: 'BACKFLOW GATES', rush: 'GATE RUSH', dark: 'DEEP SEA' },
    attacks: { plain: '', bubble: 'BUBBLES', charge: 'CHARGE', summon: 'SUMMONS FISH', ink: 'INK' },
    coinRush: n => `+${n} COINS`,
    lifeUp: '+1 LIFE', crewUp: '+1 CREW', hpUp: '+1 LIFE', powerUp: 'DMG ×1.3',
    start: 'START', newRun: 'NEW RUN', cont: 'CONTINUE', light: 'LIGHT', sound: 'SOUND', slot: 'SLOT',
    how: 'HOW TO PLAY', lang: '日本語', on: 'ON', off: 'OFF',
    pause: 'PAUSE', resume: 'RESUME', quit: 'SAVE & EXIT', retry: 'RETRY', title: 'TITLE',
    over: 'GAME OVER', starved: 'STARVED', newBest: 'NEW BEST!', eaten: n => `${n} EATEN`,
    menuSub: (b, r) => `BEST ${b} m  ·  ${r} RUNS`,
    lightToast: 'LIGHT MODE ON — change it on the title screen',
    skip: 'SKIP', close: 'CLOSE',
    coins: 'COINS', back: 'BACK', gacha: 'GACHA', equip: 'GEAR', gWeapon: 'WEAPON', gSkin: 'SKIN', pull: 'PULL',
    gNew: 'NEW!', gDup: n => `Duplicate → ${n} coins`, pearl: 'PEARLS', up: 'UP',
    pity: n => `SSR guaranteed in ${n}`, pearlHow: 'Earn pearls by clearing a stage for the first time (more for big bosses)',
    firstClear: n => `FIRST CLEAR! +${n} PEARLS`, pearlGot: n => `+${n} PEARLS`,
    pas: { food: v => `FULL +${v}`, coin: v => `COINS +${Math.round(v * 100)}%`, eat: v => `EAT +${Math.round(v * 100)}%`,
      dmg: v => `DMG +${Math.round(v * 100)}%`, rate: v => `RATE +${Math.floor(v)}` },
    earned: n => `+${n} COINS`,
    wname: { pea: 'Pea Shooter', twin: 'Twin', fan: 'Fan', rapid: 'Rapid', bouncer: 'Bouncer', wave: 'Wave',
      shotgun: 'Shotgun', homing: 'Homing', beam: 'Beam Cannon', trident: 'Trident', jaws: 'Jaws' },
    sname: { green: 'Green', olive: 'Olive', sky: 'Sky', pink: 'Pink', gold: 'Gold', snow: 'Snow',
      violet: 'Violet', crimson: 'Crimson', shadow: 'Shadow', neon: 'Neon' },
    tut: [
      'Drag anywhere to move the croc left and right',
      'Shoot the fish on the left to eat them.\nMiss them and the meat gauge drops — empty means starving',
      'Each shot improves a gate by 1.\nKeep shooting a negative and it turns positive',
      'A gate takes effect when you pass through it.\nMove under the one you want',
      'Break dashed items to get them.\nRun into an unbroken one and you lose (you have 1 life)',
      'LIFE and WEAPON gates show up only now and then.\nGo as far as you can!',
    ],
    help: [
      ['Move', 'Drag anywhere to move the croc. Shots fly straight up'],
      ['Left: food', 'Shoot fish to eat them. Missed fish drain the meat gauge; empty = starved'],
      ['Right: gates', 'Each shot improves the number by 1. Pass through to change DMG / RATE / LINE / CREW; skip it and nothing happens'],
      ['Items', 'Break dashed boxes to get them. Run into an unbroken one: -1 life (0 = game over). You can dodge'],
      ['Life / weapon', 'Rare gates. Shooting a weapon gate cycles the weapon inside'],
      ['Boss', 'A big fish ends every stage and attacks with bubbles, charges, ink and more. Get hit or let it reach the bottom and you lose'],
      ['Goal', 'Stage 10 = GAME CLEAR. Beyond it is ∞ COIN RUSH: every clear snowballs your coins'],
      ['Coins & pearls', 'Distance becomes coins for upgrading gear. First-time stage clears give pearls for the weapon / skin gacha'],
    ],
  },
};
const L = () => I18N[OPT.lang] || I18N.ja;

// ---------- 数の表記 ----------
function fmt(n) {
  if (!isFinite(n)) return '∞';
  if (n < 1000) return Number.isInteger(n) ? String(n) : n.toFixed(n < 10 ? 1 : 0).replace(/\.0$/, '');
  const units = ['K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
  const exp = Math.floor(Math.log10(n) / 3);
  if (exp - 1 < units.length) return (n / Math.pow(1000, exp)).toFixed(1).replace(/\.0$/, '') + units[exp - 1];
  return n.toExponential(2).replace('+', '');
}

// ---------- ドット絵 ----------
function spr(rows, pal, px) {
  const c = document.createElement('canvas');
  c.width = rows[0].length * px; c.height = rows.length * px;
  const x = c.getContext('2d');
  rows.forEach((r, j) => [...r].forEach((ch, i) => { if (pal[ch]) { x.fillStyle = pal[ch]; x.fillRect(i * px, j * px, px, px); } }));
  return c;
}
// 餌：こちらへ泳いでくる魚（尾が上、頭が下）
const FF = [
  ['.#...#.', '..#.#..', '...#...', '..###..', '.#####.', '.#.#.#.', '..###..'],
  ['#.....#', '.#...#.', '...#...', '..###..', '.#####.', '.#.#.#.', '..###..'],
];
const FCOL = ['#cfe0ff', '#ffb35a', '#ff6a8a'];
const FISH = FCOL.map(col => FF.map(f => spr(f, { '#': col }, 2)));
const GOLD_FISH = FF.map(f => spr(f, { '#': '#ffd84a' }, 2));
const MEAT = spr(['.....ww', '....ww.', '..###..', '.####..', '#####..', '####...', '.##....'], { '#': '#e0664a', w: '#fff' }, 2);
const PLAYER_ROWS = ['.....w.....', '....###....', '...#####...', '...#####...', '..#e###e#..', '.##d###d##.', '###########', '#.#######.#', '#..#####..#', '...##.##...', '..##...##..'];
// ボス：大きな魚（食べごたえのある獲物）
const BOSS_ROWS = ['.##..........##.', '..##........##..', '....##....##....', '......####......', '.....######.....', '...##########...', '..############..', '.##############.', '.###ee####ee###.', '.###eK####Ke###.', '..############..', '....########....'];
const BOSS_MID = spr(BOSS_ROWS, { '#': '#cfe0ff', e: '#fff', K: '#000' }, 7);
const BOSS_BIG = spr(BOSS_ROWS, { '#': '#ff6a5a', e: '#ffe14a', K: '#000' }, 9);
const HELPER_ROWS = ['.....w.....', '....###....', '...#####...', '..#e###e#..', '.##d###d##.', '###########', '#..#####..#', '...##.##...'];
const skinCache = {};
function crocSprites(id) {
  if (!skinCache[id]) {
    const k = skinOf(id), pal = { '#': k.c, d: k.d, e: k.e, w: '#ffffff' };
    skinCache[id] = { player: spr(PLAYER_ROWS, pal, 3), helper: spr(HELPER_ROWS, pal, 2), icon: spr(PLAYER_ROWS, pal, 4) };
  }
  return skinCache[id];
}
const HEART = spr(['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'], { '#': '#ff4d6d' }, 2);
const HEART_OFF = spr(['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'], { '#': '#3a3a3a' }, 2);

// ---------- 音（ごく簡素） ----------
let actx = null;
function tone(freq, dur = 0.06, vol = 0.04, type = 'square') {
  if (!OPT.sound) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, actx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
    o.connect(g); g.connect(actx.destination);
    o.start(); o.stop(actx.currentTime + dur);
  } catch (e) { /* 音が出せない */ }
}
let sfxT = 0;
function sfx(kind) {
  const now = performance.now();
  if ((kind === 'kill' || kind === 'gate') && now - sfxT < 45) return;
  sfxT = now;
  if (kind === 'kill') tone(820 + Math.random() * 160, 0.04, 0.025);
  else if (kind === 'gate') tone(1200, 0.05, 0.02, 'sine');
  else if (kind === 'boss') { tone(180, 0.35, 0.06, 'sawtooth'); tone(90, 0.5, 0.06, 'sawtooth'); }
  else if (kind === 'hurt') tone(120, 0.25, 0.07, 'sawtooth');
  else if (kind === 'count') tone(660, 0.1, 0.05, 'sine');
  else if (kind === 'go') tone(990, 0.2, 0.05, 'sine');
}

// ---------- ゲームの状態 ----------
const $ = id => document.getElementById(id);
const cv = $('cv');
const ctx = cv.getContext('2d');
let state = 'boot';     // boot | menu | play | pause | count | result
let R = null;           // 今回の旅
let kScale = 1;
let autoResume = false;
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function newRun() {
  const r = {
    m: 0, stage: 1, stageM: 0, hp: 1, food: FOOD_MAX, foodMax: FOOD_MAX, nextLife: stageLen(1) * 2.5, t: 0, fire: 0, rowAcc: 0, gateAcc: GATE_GAP - 40, uid: 0, inv: 0,
    st: { ...ST0 }, x: MID, tx: MID, nextWeapon: stageLen(1) * 1.5,
    mobs: [], b: [], objs: [], eb: [], ink: [], mod: 'normal', bonus: 0,
    boss: null, cleared: false, fightKills: 0, kills: 0,
    pops: [], parts: [], popT: 0, bossAcc: 0, bossAccT: 0, hurt: 0, banner: null, over: false, newBest: false,
  };
  R = r;
  const wd = weaponOf(SLOT.weapon), lv = SLOT.weapons[wd.id] || 1;
  r.st.rate = wRate(wd, lv) + Math.floor(skinBonus('rate')); r.st.lines = wd.lines; r.st.dmg = wDmg(wd, lv) * (1 + skinBonus('dmg')); r.st.wp = wd.pat;
  r.foodMax = r.food = FOOD_MAX + Math.floor(skinBonus('food'));
  r.base = { ...r.st };   // 装備の強さは、ステージの上限より下がらない
  return r;
}
function snapshot() {
  if (!R || R.over) return null;
  const { m, stage, stageM, mod, bonus, hp, food, foodMax, base, nextLife, nextWeapon, t, rowAcc, gateAcc, uid, st, x, mobs, objs, boss, cleared, fightKills, kills } = R;
  return JSON.parse(JSON.stringify({ m, stage, stageM, mod, bonus, hp, food, foodMax, base, nextLife, nextWeapon, t, rowAcc, gateAcc, uid, st, x, mobs, objs, boss, cleared, fightKills, kills }));
}
function loadRun(snap) {
  const r = newRun();
  Object.assign(r, snap);
  r.st = Object.assign({ ...ST0 }, snap.st);
  r.x = r.tx = typeof snap.x === 'number' ? snap.x : MID;
  R = r;
  return r;
}
function persist() {
  if (!R) return;
  SLOT.run = snapshot();
  writeSlot();
}

const dpsOf = st => st.dmg * st.lines * st.crew * st.rate;
// 進行バーと表示用のメートル。ボス戦中は、ボスとモブの片付き具合で進む
function clearFrac() {
  const b = R.boss;
  return 0.85 * (1 - b.hp / b.max) + 0.15 * Math.min(1, R.fightKills / 40);
}
const mEff = () => R.m;
// 今のステージの進み具合（道のり 75% + ボス 25%）
const stageFrac = () => (R.boss ? 0.75 + 0.25 * clearFrac() : 0.75 * Math.min(1, R.stageM / stageLen(R.stage)));
const stageP = () => (R.stage - 1) / STAGES;   // 全体の進み具合（ステージ10の手前で約1。∞ では 1 を超える）
// 強さの上限は進み具合で少しずつ開く（序盤つらい → 70% 前後で全開 → 終盤はマイナスゲートと速さで苦しい）
const pOf = () => Math.min(1, R ? (R.stage - 1) / 7 : 0);   // ステージ8で全開
const baseOf = k => (R && R.base ? R.base[k] : 1);
const linesCap = () => Math.max(baseOf('lines'), Math.min(OPT.light ? 9 : LMAX, 2 + Math.floor(pOf() * 18)));
const crewCap = () => Math.max(baseOf('crew'), Math.min(CMAX, 1 + Math.floor(pOf() * 10)));
const rateCap = () => Math.max(baseOf('rate'), Math.min(RMAX, 2 + Math.floor(pOf() * 14)));
const mulCap = () => 1.2 + pOf() * 0.8;   // ×ゲートがどこまで育つか

// ---------- ゲート・アイテム ----------
// 数値ゲート：撃つと数値が動き、自機に届いた瞬間に効果が確定する（良くも悪くも）
// ゲートの数値は「弾1発で1」動く。難しさは初期値で決める（終盤は -100 などの深いマイナスが増える）
function makeGate(slot, safe) {
  const st = R.st, p = stageP(), pc = Math.min(1, p);
  const room = { lines: st.lines < linesCap(), crew: st.crew < crewCap(), rate: st.rate < rateCap() };
  const q = Math.random();
  let stat, type = 'add', v;
  if (q < 0.2 && room.rate) stat = 'rate';
  else if (q < 0.4 && room.lines) stat = 'lines';
  else if (q < 0.5 && room.crew) stat = 'crew';
  else stat = 'dmg';
  const bad = !safe && Math.random() < 0.3 + 0.4 * pc + (p > 1 ? 0.1 : 0) + (mod() === 'minus' ? 0.3 : 0);
  if (stat === 'dmg') {
    const mag = Math.pow(10, p * 5);   // 100% で 十万くらいの桁
    if (pc > 0.12 && Math.random() < 0.06) {
      type = 'mul';
      v = bad ? 0.5 : Math.round((1.1 + Math.random() * (0.1 + pc * 0.5)) * 10) / 10;
    } else v = Math.max(1, Math.round(Math.max(mag, st.dmg * rnd(0.15, 0.4)) * rnd(0.5, 1.5))) * (bad ? -Math.max(1, Math.round(rnd(1, 1 + 4 * pc))) : 1);   // 今の威力に見合う大きさ
  } else {
    v = bad ? -(1 + Math.floor(Math.random() * (2 + pc * 12))) : 1 + Math.floor(Math.random() * (1 + pc * 2));
  }
  return { id: ++R.uid, cls: 'gate', stat, type, v, x: GATE_X[slot], y: -GATE_H, w: GATE_W, h: GATE_H, hit: 0 };
}
function makeLife(slot) {
  return { id: ++R.uid, cls: 'gate', stat: 'life', type: 'add', v: 1, x: GATE_X[slot], y: -GATE_H, w: GATE_W, h: GATE_H, hit: 0 };
}
function makeWeapon(slot) {
  const choices = WEAPONS.filter(w => w !== R.st.wp);
  return { id: ++R.uid, cls: 'gate', stat: 'weapon', type: 'set', v: choices[Math.floor(Math.random() * choices.length)], c: 0, x: GATE_X[slot], y: -GATE_H, w: GATE_W, h: GATE_H, hit: 0 };
}
function makeItem(slot, kind) {
  kind = kind || ['crew', 'power'][Math.floor(Math.random() * 2)];
  const hp = Math.max(8, dpsOf(R.st) * rnd(0.5, 1.0));   // 狙えば1秒ほどで壊せる硬さ
  return { id: ++R.uid, cls: 'item', kind, hp, max: hp, x: GATE_X[slot], y: -GATE_H, w: GATE_W, h: GATE_H, hit: 0 };
}
function spawnGateRow() {
  const early = R.stage <= 2;
  const slot = Math.random() < 0.5 ? 0 : 1;   // 1列に1つだけ（2つ同時には取れない）
  let o;
  if (R.m >= R.nextLife) {
    // ハートを増やす機会は多すぎないように、距離で間隔を空ける
    R.nextLife = R.m + stageLen(R.stage) * rnd(4, 6);   // 4〜6 ステージに1回
    o = Math.random() < 0.5 ? makeLife(slot) : makeItem(slot, 'heal');
  } else if (R.m >= R.nextWeapon) {
    // 武器ゲートもたまにだけ。撃つと中身の武器が切り替わる
    R.nextWeapon = R.m + stageLen(R.stage) * rnd(3, 4);   // 3〜4 ステージに1回
    o = makeWeapon(slot);
  } else if (!early && Math.random() < 0.14) o = makeItem(slot);
  else o = makeGate(slot, early);
  R.objs.push(o);
}
const stepOf = o => Math.round(o.v);   // どのゲートも整数で効く
function isGood(o) { return o.cls === 'item' || o.stat === 'weapon' || (o.type === 'add' ? stepOf(o) >= 0 : o.v >= 1); }
function gateLabel(o) {
  if (o.stat === 'weapon') return L().wp[o.v];
  if (o.type === 'add') { const v = stepOf(o); return (v < 0 ? '-' : '+') + fmt(Math.abs(v)); }
  if (o.v < 1) return '÷' + (1 / Math.max(0.05, o.v)).toFixed(1).replace(/\.0$/, '');
  return '×' + (o.v < 10 ? o.v.toFixed(2).replace(/0$/, '').replace(/\.0$/, '') : fmt(Math.floor(o.v)));
}
const STAT_NAME = { dmg: 'DMG', lines: 'LINE', crew: 'CREW', life: 'LIFE', weapon: 'WEAPON' };
// 撃たれたとき：数値が「良い方向」に動く（マイナスも撃てばプラスに転じる）
function growGate(o, b) {
  if (R.tut) R.tut.grew = (R.tut.grew || 0) + 1;
  if (o.stat === 'life') { o.hit = 0.1; return; }
  if (o.stat === 'weapon') {
    o.c += b.w; o.hit = 0.1;
    if (o.c >= 12) { o.c = 0; o.v = WEAPONS[(WEAPONS.indexOf(o.v) + 1) % WEAPONS.length]; }
    return;
  }
  // 弾1発で1だけ良い方向に動く（見た目の1発が何発ぶんかは w）
  if (o.type === 'mul') o.v = Math.min(Math.max(o.v, mulCap()), Math.round((o.v + 0.01 * b.w) * 100) / 100);
  else if (o.stat === 'dmg') o.v += b.w;
  else o.v = Math.min(Math.max(o.v, 3), o.v + b.w);   // 段数・連射・仲間は1枚で +3 まで
  o.hit = 0.1;
}
function applyGate(o) {
  if (R.tut) R.tut.applied = true;
  const st = R.st; let msg;
  if (o.stat === 'life') {
    R.hp = Math.min(HP_MAX, R.hp + 1);
    pop(R.x, PY - 50, L().lifeUp, true, '#ff8da1'); burst(o.x + o.w / 2, PY, 14, '#ff8da1'); sfx('gate');
    return;
  }
  if (o.stat === 'weapon') {
    st.wp = o.v;
    pop(R.x, PY - 50, L().wp[o.v], true, '#66e6ff'); burst(o.x + o.w / 2, PY, 14, '#66e6ff'); sfx('gate');
    return;
  }
  const before = { ...st };
  if (o.stat === 'dmg') { st.dmg = clamp(o.type === 'add' ? st.dmg + o.v : st.dmg * o.v, 1, DMG_CAP); }
  else if (o.stat === 'lines') st.lines = clamp(st.lines + stepOf(o), 1, linesCap());
  else if (o.stat === 'rate') st.rate = clamp(st.rate + stepOf(o), 1, rateCap());
  else st.crew = clamp(st.crew + stepOf(o), 1, crewCap());
  const good = o.stat === 'dmg' ? st.dmg >= before.dmg : st[o.stat] >= before[o.stat];
  msg = `${L().stat[o.stat]} ${gateLabel(o)}`;
  const stack = R.pops.filter(p => p.big && p.y > PY - 130).length;   // 同時に確定したら縦にずらす
  pop(R.x, PY - 50 - stack * 20, msg, true, good ? '#39ff88' : '#ff5a5a');
  burst(o.x + o.w / 2, PY, 14, good ? '#39ff88' : '#ff5a5a');
  if (!good) { R.hurt = 0.3; sfx('hurt'); } else sfx('gate');
}
function breakItem(o) {
  if (o.kind === 'crew') { R.st.crew = Math.min(crewCap() + 1, CMAX, R.st.crew + 1); pop(o.x + o.w / 2, o.y, L().crewUp, true, '#66e6ff'); }
  else if (o.kind === 'heal') { R.hp = Math.min(HP_MAX, R.hp + 1); pop(o.x + o.w / 2, o.y, L().hpUp, true, '#ff8da1'); }
  else { R.st.dmg = Math.min(DMG_CAP, R.st.dmg * 1.3); pop(o.x + o.w / 2, o.y, L().powerUp, true, '#ffd84a'); }
  burst(o.x + o.w / 2, o.y + o.h / 2, 20, '#66e6ff');
  sfx('gate');
}

// ---------- 魚（餌） ----------
const ZSLOTS = 12, ZX0 = 9, ZDX = 14;
function spawnRow() {
  const p = Math.min(1, stageP());
  const dens = Math.min(0.95, (0.025 + 0.5 * Math.pow(p, 0.8) + (stageP() > 1 ? 0.25 * Math.min(1, stageP() - 1) : 0)) * (mod() === 'school' ? 1.8 : 1));
  const k = p < 0.35 ? 0 : p < 0.7 ? 1 : 2;
  for (let i = 0; i < ZSLOTS; i++) if (Math.random() < dens) R.mobs.push({ x: ZX0 + i * ZDX + rnd(-1, 1), y: -10, k: Math.random() < 0.85 ? k : Math.min(2, k + 1), ph: Math.random() * 6.28, d: 0, gold: mod() === 'golden' && Math.random() < 0.2 ? 1 : 0 });
}
// 弾が当たる場所を素早く引くための格子
const GC = 16, GCOLS = 23, GROWS = 44;
const head = new Int32Array(GCOLS * GROWS);
let nxt = new Int32Array(1024);
const cellOf = (x, y) => clamp(Math.floor(x / GC), 0, GCOLS - 1) + clamp(Math.floor((y + 16) / GC), 0, GROWS - 1) * GCOLS;
function buildGrid() {
  head.fill(-1);
  if (nxt.length < R.mobs.length) nxt = new Int32Array(R.mobs.length * 2);
  for (let i = 0; i < R.mobs.length; i++) {
    const mo = R.mobs[i]; if (mo.d) continue;
    const c = cellOf(mo.x, mo.y); nxt[i] = head[c]; head[c] = i;
  }
}

// ---------- ステージごとの変化（繰り返しの中に、毎回ちがうルール） ----------
// normal：ふつう / school：魚の群れ（多い）/ current：急流（速い）/ golden：金の魚（食べるとコイン）
// minus：逆流（マイナスゲートが多い）/ rush：ゲートラッシュ（ゲートが多い）/ dark：深海（上が見えにくい）
const MODS = ['school', 'current', 'golden', 'minus', 'rush', 'dark'];
function modOf(n) { if (n <= 1) return 'normal'; return MODS[(n * 5 + 3) % MODS.length]; }
const mod = () => (R ? R.mod || 'normal' : 'normal');
function curSpeed() { return Math.min(SPEED_CAP * 1.2, stageSpeed(R.stage) * (mod() === 'current' ? 1.25 : 1)); }
function enterStage(n) {
  R.mod = modOf(n);
  R.banner = { text: L().stageName(n), t: 2.2, sub: L().mods[R.mod] };
}

// ---------- ボス：攻撃してくる ----------
// plain：何もしない / bubble：泡を撃つ / charge：突進 / summon：魚を呼ぶ / ink：墨でゲートを隠す。大ボスは2つ組み合わせ
const BOSS_ATTACKS = ['bubble', 'charge', 'summon', 'ink'];
function bossKinds(k, big) {
  if (k <= 1) return ['plain'];
  const a = BOSS_ATTACKS[(k - 2) % 4];
  return big ? [a, BOSS_ATTACKS[(k + 1) % 4]] : [a];
}
function bossAct(bo, dt, s) {
  const lvl = 1 + Math.max(0, bo.k - 2) * 0.12;   // 先のステージほど激しく
  for (const kind of bo.kinds) {
    bo.cd[kind] = (bo.cd[kind] || 0) - dt;
    if (bo.cd[kind] > 0) continue;
    if (kind === 'bubble') {
      const n = bo.big ? 5 : 3;
      for (let i = 0; i < n; i++) {
        const a = Math.atan2(PY - bo.y, R.x - bo.x) + (i - (n - 1) / 2) * 0.22;
        R.eb.push({ x: bo.x, y: bo.y + 30, vx: Math.cos(a) * 150 * lvl, vy: Math.sin(a) * 150 * lvl, r: 6 });
      }
      bo.cd[kind] = 2.2 / lvl;
    } else if (kind === 'charge') {
      bo.charge = 0.9;   // 0.9秒の予告のあと突進
      bo.cd[kind] = 5.5 / lvl;
    } else if (kind === 'summon') {
      for (let i = 0; i < 8; i++) R.mobs.push({ x: ZX0 + Math.floor(Math.random() * ZSLOTS) * ZDX, y: bo.y + rnd(-10, 20), k: 2, ph: Math.random() * 6.28, d: 0 });
      bo.cd[kind] = 3.5 / lvl;
    } else if (kind === 'ink') {
      R.ink.push({ x: MID + rnd(10, MID - 90), y: rnd(150, 420), r: 70, t: 3.2 });
      bo.cd[kind] = 5 / lvl;
    }
  }
  if (bo.charge > 0) {
    bo.charge -= dt;
    if (bo.charge <= 0) { bo.dash = 0.35; sfx('hurt'); }
  }
  if (bo.dash > 0) { bo.dash -= dt; bo.y += 420 * dt; if (bo.dash <= 0) bo.back = 0.8; }
  else if (bo.back > 0) { bo.back -= dt; bo.y -= 184 * dt; }   // 突進したぶん戻る
}

// ---------- ボス ----------
const bossFightSec = (k, big) => (big ? 16 : 8) * (1 + 0.01 * k + Math.max(0, k - STAGES) * 0.05);
function spawnBoss() {
  const k = R.stage, big = k % 10 === 0;
  // HP は今の火力に合わせる（数字はインフレするが、戦う時間は変わらない）
  const max = Math.max(20, dpsOf(R.st) * 0.35 * bossFightSec(k, big));
  R.boss = { k, big, hp: max, max, x: MID, y: -80, ph: Math.random() * 6, startM: R.m, hit: 0, kinds: bossKinds(k, big), cd: { bubble: 1.5, charge: 3, summon: 1, ink: 2 } };
  R.fightKills = 0;
  R.banner = { text: big ? L().bigBoss : L().boss, t: 2, sub: R.boss.kinds.map(x => L().attacks[x]).join(' ＋ ') };
  sfx('boss');
}
function killBoss() {
  const b = R.boss;
  burst(b.x, b.y, b.big ? 60 : 36, b.big ? '#ff6a5a' : '#cfe0ff');
  R.stage++; R.stageM = 0;
  R.boss = null;
  if (b.k > SLOT.maxStage) {   // 初めてクリアしたステージ：パール
    SLOT.maxStage = b.k;
    const p = b.big ? FIRST_CLEAR.big : FIRST_CLEAR.normal;
    SLOT.pearls += p; R.pearls = (R.pearls || 0) + p; writeSlot();
    pop(W / 2, 330, L().firstClear(p), true, '#ffc6f0');
  }
  sfx('boss');
  if (b.k >= STAGES) {   // 11 から先は、クリアごとにコインが 1.35 倍ずつ増える
    const bonus = Math.round(40 * Math.pow(1.35, b.k - STAGES));
    R.bonus = (R.bonus || 0) + bonus;
    pop(W / 2, 360, L().coinRush(bonus), true, '#ffd84a');
  }
  R.eb = []; R.ink = [];
  if (b.k === STAGES && !R.cleared) { R.cleared = true; R.banner = { text: 'GAME CLEAR!', t: 4, sub: '∞ COIN RUSH' }; R.mod = modOf(R.stage); }
  else enterStage(R.stage);
}
function burst(x, y, n, col) {
  if (OPT.light) return;
  for (let i = 0; i < n && R.parts.length < 160; i++) {
    const a = Math.random() * 6.283, v = rnd(40, 180);
    R.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rnd(0.3, 0.7), col });
  }
}
function pop(x, y, text, big, col) {
  if (R.pops.length > 22) return;
  R.pops.push({ x, y, text, t: big ? 1.1 : 0.8, big, col });
}

// ---------- 発射 ----------
// 見た目の弾数には上限を設け、超えた分は1発の重み（w）に乗せる（スマホが熱くならないように）
function shooterX(si) {   // 0 が自分、1 以降は左右に並ぶ仲間
  if (si === 0) return R.x;
  const i = si - 1;
  return clamp(R.x + (i % 2 ? 1 : -1) * (26 + Math.floor(i / 2) * 20), 8, W - 8);
}
function nearestFood(x) {
  let best = null, bd = 1e9;
  for (const mo of R.mobs) { if (mo.d || mo.y > PY - 40) continue; const d = Math.abs(mo.x - x) + (PY - mo.y) * 0.3; if (d < bd) { bd = d; best = mo; } }
  return best;
}
function volley() {
  const st = R.st, wp = st.wp || 'normal', total = st.lines * st.crew;
  const shooters = Math.min(st.crew, 8);
  if (wp === 'beam') {
    // ビーム：1人1本。段数ぶんの威力をまとめ、たくさん貫く
    for (let si = 0; si < shooters; si++) {
      const w = total / shooters;
      R.b.push({ x: shooterX(si), y: PY - 14, vx: 0, vy: -BULLET_V * 1.3, d: st.dmg * w, w, pr: PIERCE_MAX * 4, beam: 1, bn: 0 });
    }
    return;
  }
  const vis = OPT.light ? 14 : 32;
  const n = Math.min(total, vis), w = total / n, per = Math.ceil(n / shooters);
  const pr = Math.min(PIERCE_MAX, Math.max(1, Math.round(w)) + 1 + Math.floor(Math.log10(Math.max(1, st.dmg))));
  for (let k = 0; k < n; k++) {
    const si = k % shooters, line = Math.floor(k / shooters);
    const u = per > 1 ? line / (per - 1) - 0.5 : 0;   // -0.5〜0.5
    const x = shooterX(si) + u * Math.min(per, 9) * 6;
    let vx = 0, pierce = pr, wave = 0;
    if (wp === 'spread') vx = u * 0.8 * BULLET_V;                 // 扇状に広がる
    else if (wp === 'shotgun') vx = u * 1.3 * BULLET_V;           // もっと広く散らばる
    else if (wp === 'bounce') vx = (line % 2 ? 1 : -1) * 0.45 * BULLET_V;   // 斜めに撃ち、壁で跳ね返る
    else if (wp === 'homing') { const t = nearestFood(x); if (t) vx = clamp((t.x - x) / Math.max(40, PY - t.y), -0.6, 0.6) * BULLET_V; }   // 近くの魚へ
    else if (wp === 'trident') pierce = pr + 3;                   // よく貫く
    else if (wp === 'wave') wave = 1;                             // くねくね進む
    const vy = -Math.sqrt(BULLET_V * BULLET_V - vx * vx);
    R.b.push({ x, x0: x, y: PY - 14, vx, vy, d: st.dmg * w, w, pr: pierce, bn: wp === 'bounce' ? 3 : 0, wave, ph: line * 1.7 + si });
  }
}

// ---------- 1コマ進める ----------
function step(dt) {
  if (!R || R.over) return;
  const st = R.st;
  const s = curSpeed();
  R.t += dt;

  // 進行：ボスが出たらその場で止まり、ボス戦の進み具合でバーが動く
  if (!R.boss) {
    R.m += s * dt; R.stageM += s * dt;
    if (R.stageM >= stageLen(R.stage)) spawnBoss();
  }
  if (BOT) botControl();
  tutTick(dt);
  R.tx = clamp(R.tx, 14, W - 14);
  R.x += (R.tx - R.x) * Math.min(1, dt * 18);

  // 発射
  R.fire += dt * st.rate;
  while (R.fire >= 1) { R.fire -= 1; if (R.b.length < (OPT.light ? 160 : 420)) volley(); }

  buildGrid();

  // 弾
  for (let i = R.b.length - 1; i >= 0; i--) {
    const b = R.b[i];
    if (!b.wave) b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.wave) { b.x0 += b.vx * dt; b.x = b.x0 + Math.sin((PY - b.y) * 0.05 + b.ph) * 16; }   // ウェーブ
    if (b.bn > 0 && (b.x < 2 || b.x > W - 2)) { b.vx = -b.vx; b.x = clamp(b.x, 2, W - 2); b.bn--; }   // 反射
    let dead = b.y < -30 || b.x < -10 || b.x > W + 10;
    // 右：ゲートとアイテム（弾は通り抜けず、ぶつかって数値を動かす）
    if (!dead && b.x > MID - 10) {
      for (const o of R.objs) {
        if (b.x > o.x && b.x < o.x + o.w && b.y > o.y && b.y < o.y + o.h) {
          if (o.cls === 'gate') growGate(o, b);
          else { o.hp -= b.d; o.hit = 0.1; if (o.hp <= 0) { o.dead = true; breakItem(o); } }
          dead = true; break;
        }
      }
    }
    // 左：魚（撃てば食べられる。強い弾は何匹も貫く）
    if (!dead && b.x < MID + 10) {
      const cx = clamp(Math.floor(b.x / GC), 0, GCOLS - 1), cy = clamp(Math.floor((b.y + 16) / GC), 0, GROWS - 1);
      for (let yy = Math.max(0, cy - 1); yy <= Math.min(GROWS - 1, cy + 1) && !dead; yy++) {
        for (let xx = Math.max(0, cx - 1); xx <= Math.min(GCOLS - 1, cx + 1) && !dead; xx++) {
          for (let j = head[xx + yy * GCOLS]; j !== -1; j = nxt[j]) {
            const mo = R.mobs[j];
            if (mo.d || Math.abs(b.x - mo.x) > 8 || Math.abs(b.y - mo.y) > 8) continue;
            mo.d = 1; R.kills++; if (R.boss) R.fightKills++; if (mo.gold) { R.bonus = (R.bonus || 0) + 2; pop(mo.x, mo.y - 10, '+2', false, '#ffd84a'); } R.food = Math.min(R.foodMax, R.food + FOOD_EAT * (1 + skinBonus('eat')));
            if (!OPT.light && R.parts.length < 120 && Math.random() < 0.5) R.parts.push({ x: mo.x, y: mo.y, vx: rnd(-60, 60), vy: rnd(-60, 60), life: 0.35, col: FCOL[mo.k] });
            if (R.popT <= 0) { pop(mo.x, mo.y, fmt(b.d), false, '#fff'); R.popT = 0.09; }
            sfx('kill');
            if (--b.pr <= 0) { dead = true; break; }
          }
        }
      }
    }
    // ボス
    const bo = R.boss;
    if (!dead && bo) {
      const hw = bo.big ? 72 : 56, hh = bo.big ? 50 : 40;
      if (Math.abs(b.x - bo.x) < hw && Math.abs(b.y - bo.y) < hh) { bo.hp -= b.d; R.bossAcc += b.d; bo.hit = 0.08; dead = true; }
    }
    if (dead) { R.b[i] = R.b[R.b.length - 1]; R.b.pop(); }
  }

  // ボスの処理
  const bo = R.boss;
  if (bo) {
    bo.ph += dt; bo.hit = Math.max(0, bo.hit - dt);
    if (bo.y < 150) bo.y += 130 * dt;
    else { bo.y += (bo.big ? 9 : 14) * s * dt; bossAct(bo, dt, s); }
    bo.x = MID + Math.sin(bo.ph * 0.7) * 90;
    R.bossAccT -= dt;
    if (R.bossAccT <= 0 && R.bossAcc > 0) { pop(bo.x + rnd(-30, 30), bo.y + 30, fmt(R.bossAcc), true, '#b8ffd2'); R.bossAcc = 0; R.bossAccT = 0.25; }
    if (bo.hp <= 0) killBoss();
    else if (bo.y > PY - 40) R.hp = 0;
  }

  // ボスの弾（泡）：当たったら負け
  for (let i = R.eb.length - 1; i >= 0; i--) {
    const e = R.eb[i];
    e.x += e.vx * dt; e.y += e.vy * dt;
    if (Math.abs(e.x - R.x) < 12 + e.r * 0.5 && Math.abs(e.y - (PY - 4)) < 14) { R.eb.splice(i, 1); damage(); pop(R.x, PY - 30, L().hit, true, '#ff5a5a'); continue; }
    if (e.y > H || e.x < -20 || e.x > W + 20) R.eb.splice(i, 1);
  }
  for (let i = R.ink.length - 1; i >= 0; i--) { R.ink[i].t -= dt; if (R.ink[i].t <= 0) R.ink.splice(i, 1); }

  // 魚：前進、到達（食べ逃すと飢餓ゲージ-1）
  R.rowAcc += MOB_VY * s * dt * (R.boss ? 0.4 : 1);
  if (R.rowAcc >= ROW_H) { R.rowAcc -= ROW_H; if (R.mobs.length < 900) spawnRow(); }
  let any = false;
  for (const mo of R.mobs) {
    if (mo.d) { any = true; continue; }
    mo.y += MOB_VY * s * dt;
    if (mo.y > PY + 4) { mo.d = 1; any = true; if (!R.tut) R.food -= 1; R.hungry = 0.4; burst(mo.x, PY, 6, '#e0664a'); }
  }
  if (any) R.mobs = R.mobs.filter(mo => !mo.d);

  // ゲート・アイテム：前進。くぐったら確定（ゲートは効果、壊せなかったアイテムにぶつかったらライフ-1）
  R.gateAcc += GATE_VY * s * dt;
  if (R.gateAcc >= GATE_GAP * (mod() === 'rush' ? 0.55 : 1)) { R.gateAcc = 0; spawnGateRow(); }
  for (const o of R.objs) {
    o.hit = Math.max(0, o.hit - dt);
    if (o.dead) continue;
    o.y += GATE_VY * s * dt * (R.tut ? 2.5 : 1);   // チュートリアル中は早めに届く
    if (o.y + o.h >= PY - 6) {
      o.dead = true;
      // 自分がくぐった時だけ効く。避ければ何も起きない
      const inside = R.x > o.x - 10 && R.x < o.x + o.w + 10;
      if (!inside) continue;
      if (o.cls === 'gate') applyGate(o);
      else { damage(); pop(o.x + o.w / 2, PY - 30, L().hit, true, '#ff5a5a'); }
    }
  }
  if (R.objs.some(o => o.dead)) R.objs = R.objs.filter(o => !o.dead);

  // 演出
  R.popT -= dt; R.hurt = Math.max(0, R.hurt - dt); R.inv = Math.max(0, (R.inv || 0) - dt); R.hungry = Math.max(0, (R.hungry || 0) - dt);
  for (let i = R.pops.length - 1; i >= 0; i--) { const p = R.pops[i]; p.t -= dt; p.y -= 34 * dt; if (p.t <= 0) R.pops.splice(i, 1); }
  for (let i = R.parts.length - 1; i >= 0; i--) { const p = R.parts[i]; p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.life <= 0) R.parts.splice(i, 1); }
  if (R.banner) { R.banner.t -= dt; if (R.banner.t <= 0) R.banner = null; }

  if (R.food <= 0) { R.food = 0; R.starved = true; gameOver(); }
  else if (R.hp <= 0) gameOver();
}

// 当たった：ハートが1つ減る（0で負け）。直後は少し無敵
function damage() {
  if (R.inv > 0 || R.tut) return;
  R.hp--; R.inv = 1.5; R.hurt = 0.6;
  sfx('hurt');
}

// 開発用の自動操縦：ワニが詰まってきたら左へ、そうでなければ右のゲートとアイテムを撃つ
function botControl() {
  // 泡が近づいたら避ける
  const e = R.eb.find(e => e.y > PY - 160 && Math.abs(e.x + e.vx * 0.4 - R.x) < 34);
  if (e) { R.tx = R.x + (e.x < R.x ? 60 : -60); return; }
  const near = R.objs.filter(o => !o.dead && o.y + o.h > PY - 90);
  if (near.length) {
    const good = near.find(o => o.cls === 'gate' && isGood(o));
    if (good) { R.tx = good.x + good.w / 2; return; }
    if (near.some(o => R.x > o.x - 12 && R.x < o.x + o.w + 12)) { R.tx = MID / 2; return; }   // 悪いゲート・壊れていないアイテムは避ける
  }
  // 壊さないと当たるアイテムが近づいたら最優先
  const it = R.objs.find(o => o.cls === 'item' && !o.dead && o.y > 260);
  if (it) { R.tx = it.x + it.w / 2; return; }
  let low = 0, sum = 0;
  for (const mo of R.mobs) if (mo.y > 120) { low++; sum += mo.x; }
  if (low > 2) { R.tx = sum / low + Math.sin(R.t * 4) * 40; return; }
  if (R.boss && R.boss.y > 20) { R.tx = R.boss.x; return; }
  let tgt = null;
  for (const o of R.objs) if (!o.dead && o.y > -10 && (!tgt || o.y > tgt.y)) tgt = o;
  if (tgt) R.tx = tgt.x + tgt.w / 2;
  else R.tx = MID / 2 + Math.sin(R.t * 3) * 60;
}

// ---------- チュートリアル ----------
// 初めてのスタート時だけ。1つずつ実際にやってもらって進む。途中は飢えず、当たっても減らない
function tutStart() { R.tut = { i: 0, t: 0, x0: R.x, k0: R.kills }; tutShow(); }
function tutShow() {
  const T = R.tut;
  $('tutText').textContent = L().tut[T.i];
  $('tutStep').textContent = `${T.i + 1} / ${L().tut.length}`;
  $('tut').hidden = false;
}
function tutHide() { $('tut').hidden = true; }
function tutNext() {
  const T = R.tut;
  T.i++; T.t = 0; T.k0 = R.kills; T.grew = 0; T.applied = false;
  if (T.i >= L().tut.length) { tutEnd(); return; }
  if (T.i === 2 && !R.objs.some(o => o.cls === 'gate' && o.y > 40)) {   // すぐ撃てるように、近くにゲートを出す
    const a = makeGate(0, true), b = makeGate(1, true); a.y = b.y = 120; R.objs.push(a, b);
  }
  if (T.i === 4) { const it = makeItem(Math.random() < 0.5 ? 0 : 1, 'crew'); it.y = 110; R.objs.push(it); T.item = it.id; }
  sfx('go');
  tutShow();
}
function tutEnd() { R.tut = null; OPT.tutDone = true; saveOpt(); tutHide(); }
function tutTick(dt) {
  const T = R.tut; if (!T) return;
  T.t += dt;
  if (T.i === 0 && Math.abs(R.x - T.x0) > 60 && T.t > 1.2) tutNext();
  else if (T.i === 1 && R.kills - T.k0 >= 12) tutNext();
  else if (T.i === 2 && T.grew >= 4) tutNext();
  else if (T.i === 3 && T.applied) tutNext();
  else if (T.i === 4 && !R.objs.some(o => o.id === T.item) && T.t > 1) tutNext();
  else if (T.i === 5 && T.t > 5) tutNext();
}

// ---------- 画面の流れ ----------
function show(id, on) { $(id).hidden = !on; }
function toast(msg, ms = 2200) {
  const t = $('toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('on'), ms);
}
// 動かない文言（一時停止・結果・チュートリアル）
function applyStatic() {
  const l = L();
  document.documentElement.lang = OPT.lang;
  $('pauseTitle').textContent = l.pause;
  $('btnResume').textContent = l.resume;
  $('btnQuit').textContent = l.quit;
  $('btnRetry').textContent = l.retry;
  $('btnHome').textContent = l.title;
  $('tutSkip').textContent = l.skip;
  $('helpTitle').textContent = l.how;
  $('btnHelpClose').textContent = l.close;
  $('helpBody').innerHTML = l.help.map(([h, d]) => `<div class="help-row"><b>${h}</b><span>${d}</span></div>`).join('');
}
function showMenu() {
  state = 'menu';
  show('result', false); show('pause', false);
  const l = L();
  $('menuSub').textContent = l.menuSub(fmt(Math.floor(SLOT.best * METER)), SLOT.runs) + `  ·  ${l.coins} ${fmt(SLOT.coins)}  ·  ${l.pearl} ${fmt(SLOT.pearls)}`;
  show('btnContinue', !!SLOT.run);
  $('btnContinue').textContent = SLOT.run ? `${l.cont}  ${fmt(Math.floor(SLOT.run.m * METER))} m` : l.cont;
  $('btnStart').textContent = SLOT.run ? l.newRun : l.start;
  $('btnLight').textContent = `${l.light}: ${OPT.light ? l.on : l.off}`;
  $('btnSound').textContent = `${l.sound}: ${OPT.sound ? l.on : l.off}`;
  $('btnHow').textContent = l.how;
  $('btnGacha').textContent = l.gacha;
  $('btnEquip').textContent = `${l.equip}：${l.wname[SLOT.weapon] || ''}`;
  $('btnLang').textContent = l.lang;
  applyStatic();
  show('menu', true);
}
// ---------- ガチャ（武器 / スキン） ----------
let gachaTab = 'weapon';
function rollRarity() {
  let r = Math.random() * 100;
  for (const k of ['SSR', 'SR', 'R', 'N']) { r -= RARITY[k].w; if (r < 0) return k; }
  return 'N';
}
function pull(kind) {
  if (SLOT.pearls < GACHA_COST) return;
  SLOT.pearls -= GACHA_COST;
  SLOT.pity[kind] = (SLOT.pity[kind] || 0) + 1;
  let rar = rollRarity();
  if (SLOT.pity[kind] >= PITY) rar = 'SSR';   // 天井
  if (rar === 'SSR') SLOT.pity[kind] = 0;
  const pool = (kind === 'weapon' ? WEAPON_DEF : SKIN_DEF).filter(x => x.r === rar);
  const got = pool[Math.floor(Math.random() * pool.length)];
  const l = L(), owned = kind === 'weapon' ? SLOT.weapons : SLOT.skins;
  let note;
  if (!owned[got.id]) { owned[got.id] = 1; note = l.gNew; }
  else { SLOT.coins += DUP_COINS[rar]; note = l.gDup(DUP_COINS[rar]); }
  writeSlot();
  sfx(rar === 'SSR' || rar === 'SR' ? 'boss' : 'gate');
  const name = kind === 'weapon' ? l.wname[got.id] : l.sname[got.id];
  const icon = kind === 'skin' ? `<img class="g-icon" src="${crocSprites(got.id).icon.toDataURL()}" alt="">` : '';
  const el = $('gachaResult');
  el.className = 'g-result r-' + rar;
  el.innerHTML = `${icon}<b style="color:${RARITY[rar].col}">${rar}</b><span>${name}</span><small>${note}</small>`;
  void el.offsetWidth; el.classList.add('pop');
  renderGacha();
}
function openGacha() { state = 'menu'; show('menu', false); $('gachaResult').innerHTML = ''; renderGacha(); show('gacha', true); }
function renderGacha() {
  const l = L(), kind = gachaTab;
  $('gachaTitle').textContent = l.gacha;
  $('gachaCoins').textContent = `${l.pearl} ${fmt(SLOT.pearls)}`;
  $('tabWeapon').textContent = l.gWeapon; $('tabSkin').textContent = l.gSkin;
  $('tabWeapon').classList.toggle('on', kind === 'weapon'); $('tabSkin').classList.toggle('on', kind === 'skin');
  $('btnPull').textContent = `${l.pull}  🦪${GACHA_COST}`;
  $('btnPull').disabled = SLOT.pearls < GACHA_COST;
  $('gachaRates').textContent = `N 60%  ·  R 28%  ·  SR 10%  ·  SSR 2%  ·  ${l.pity(PITY - (SLOT.pity[kind] || 0))}`;
  $('gachaHow').textContent = l.pearlHow;
  const list = kind === 'weapon' ? WEAPON_DEF : SKIN_DEF;
  $('gachaList').innerHTML = list.map(x => {
    const own = kind === 'weapon' ? SLOT.weapons[x.id] : SLOT.skins[x.id];
    const name = own ? (kind === 'weapon' ? l.wname[x.id] : l.sname[x.id]) : '？？？';
    const extra = own ? ` Lv${own}` : '';
    return `<span class="g-chip ${own ? 'own' : ''}" style="border-color:${RARITY[x.r].col}"><i style="color:${RARITY[x.r].col}">${x.r}</i>${name}${extra}</span>`;
  }).join('');
  $('btnGachaBack').textContent = l.back;
}
// ---------- 装備 ----------
function openEquip() { state = 'menu'; show('menu', false); renderEquip(); show('equip', true); }
function renderEquip() {
  const l = L();
  $('equipTitle').textContent = l.equip;
  $('equipCoins').textContent = `${l.coins} ${fmt(SLOT.coins)}`;
  $('equipWHead').textContent = l.gWeapon; $('equipSHead').textContent = l.gSkin;
  $('equipWeapons').innerHTML = WEAPON_DEF.filter(w => SLOT.weapons[w.id]).map(w => {
    const lv = SLOT.weapons[w.id], on = SLOT.weapon === w.id, max = lv >= WLV_MAX, cost = wUpCost(w, lv);
    return `<div class="eq-row ${on ? 'on' : ''}">
      <button class="eq-pick" data-w="${w.id}"><span><span class="eq-name"><i style="color:${RARITY[w.r].col}">${w.r}</i> ${l.wname[w.id]} <small>Lv${lv}</small></span>
      <span class="eq-stat">${l.wp[w.pat]} · ${l.stat.rate}${wRate(w, lv)} · ${l.stat.lines}${w.lines} · ${l.stat.dmg}${fmt(Math.round(wDmg(w, lv) * 10) / 10)}</span></span></button>
      <button class="eq-up" data-wu="${w.id}" ${max || SLOT.coins < cost ? 'disabled' : ''}>${max ? 'MAX' : `${l.up}<small>${fmt(cost)}</small>`}</button></div>`;
  }).join('');
  $('equipSkins').innerHTML = SKIN_DEF.filter(k => SLOT.skins[k.id]).map(k => {
    const lv = SLOT.skins[k.id], on = SLOT.skin === k.id, max = lv >= SLV_MAX, cost = sUpCost(k, lv);
    return `<div class="eq-row ${on ? 'on' : ''}">
      <button class="eq-pick" data-s="${k.id}"><img src="${crocSprites(k.id).icon.toDataURL()}" alt="">
      <span><span class="eq-name"><i style="color:${RARITY[k.r].col}">${k.r}</i> ${l.sname[k.id]} <small>Lv${lv}</small></span>
      <span class="eq-stat">${l.pas[k.pas](k.v * lv)}</span></span></button>
      <button class="eq-up" data-su="${k.id}" ${max || SLOT.coins < cost ? 'disabled' : ''}>${max ? 'MAX' : `${l.up}<small>${fmt(cost)}</small>`}</button></div>`;
  }).join('');
  $('equipWeapons').querySelectorAll('[data-w]').forEach(b => { b.onclick = () => { SLOT.weapon = b.dataset.w; writeSlot(); sfx('gate'); renderEquip(); }; });
  $('equipSkins').querySelectorAll('[data-s]').forEach(b => { b.onclick = () => { SLOT.skin = b.dataset.s; writeSlot(); sfx('gate'); renderEquip(); }; });
  $('equipWeapons').querySelectorAll('[data-wu]').forEach(b => { b.onclick = () => {
    const w = weaponOf(b.dataset.wu), lv = SLOT.weapons[w.id], cost = wUpCost(w, lv);
    if (lv >= WLV_MAX || SLOT.coins < cost) return;
    SLOT.coins -= cost; SLOT.weapons[w.id] = lv + 1; writeSlot(); sfx('boss'); renderEquip(); }; });
  $('equipSkins').querySelectorAll('[data-su]').forEach(b => { b.onclick = () => {
    const k = skinOf(b.dataset.su), lv = SLOT.skins[k.id], cost = sUpCost(k, lv);
    if (lv >= SLV_MAX || SLOT.coins < cost) return;
    SLOT.coins -= cost; SLOT.skins[k.id] = lv + 1; writeSlot(); sfx('boss'); renderEquip(); }; });
  $('btnEquipBack').textContent = l.back;
}
function startRun(resume) {
  show('menu', false); show('result', false); show('pause', false);
  if (resume && SLOT.run) loadRun(SLOT.run); else { newRun(); SLOT.run = null; enterStage(1); if (!OPT.tutDone) tutStart(); }
  lightSamples = 0; lightSum = 0;
  countdown(() => { state = 'play'; });
}
// 戻ってきたときは、3・2・1 から再開する
function countdown(done) {
  state = 'count';
  const el = $('count'); el.hidden = false;
  let n = 3;
  const tick = () => {
    if (state !== 'count') { el.hidden = true; return; }
    if (n === 0) { el.hidden = true; sfx('go'); done(); return; }
    el.innerHTML = `<b>${n}</b>`; sfx('count'); n--;
    setTimeout(tick, 900);
  };
  tick();
}
function pauseGame(auto) {
  if (state !== 'play' && state !== 'count') return;
  const wasCount = state === 'count';
  state = 'pause'; autoResume = !!auto;
  $('count').hidden = true;
  persist();
  tutHide();
  if (!auto) show('pause', true);
  if (wasCount) return;
}
function resumeGame() {
  show('pause', false);
  if (R && R.tut) tutShow();
  countdown(() => { state = 'play'; });
}
function gameOver() {
  const m = mEff();
  R.over = true; state = 'result';
  SLOT.runs++;
  R.newBest = m > SLOT.best;
  if (R.newBest) SLOT.best = m;
  const gain = coinsFor(m, Math.min(R.stage - 1, STAGES)) + Math.round((R.bonus || 0) * (1 + skinBonus('coin')));
  SLOT.coins += gain;
  SLOT.run = null; writeSlot();
  sfx('hurt');
  const l = L();
  tutHide();
  $('resTitle').textContent = R.starved ? l.starved : l.over;
  $('resM').textContent = fmt(Math.floor(m * METER)) + ' m';
  $('resSub').textContent = (R.newBest ? l.newBest + '  ' : `${l.best} ${fmt(Math.floor(SLOT.best * METER))} m  ·  `) + `${R.cleared ? '∞ MODE  ·  ' : ''}${l.eaten(R.kills)}`;
  $('resCoins').textContent = l.earned(gain) + (R.pearls ? `  ·  ${l.pearlGot(R.pearls)}` : '');
  setTimeout(() => { if (state === 'result') show('result', true); }, 700);
}

// ---------- 入力 ----------
let drag = null;
function toLogical(e) {
  const r = cv.getBoundingClientRect();
  return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
}
// 画面の最下端はスマホのホームバー操作と競合して押しにくいので、右上に置く（反応する範囲も広め）
const MENU_RECT = { x: W - 72, y: 4, w: 62, h: 28 };
const inMenu = p => p.x > W - 88 && p.y < 48;
cv.addEventListener('pointerdown', e => {
  const p = toLogical(e);
  if (state === 'play' && inMenu(p)) { pauseGame(false); return; }
  if (state !== 'play' || !R) return;
  cv.setPointerCapture(e.pointerId);
  drag = { px: p.x, x0: R.tx };
});
cv.addEventListener('pointermove', e => {
  if (!drag || state !== 'play' || !R) return;
  R.tx = clamp(drag.x0 + (toLogical(e).x - drag.px) * 1.4, 14, W - 14);   // 指の移動量で動く（指で自機が隠れない）
});
const endDrag = () => { drag = null; };
cv.addEventListener('pointerup', endDrag);
cv.addEventListener('pointercancel', endDrag);
const keys = {};
addEventListener('keydown', e => {
  keys[e.key] = true;
  if ((e.key === 'Escape' || e.key === 'p') && state === 'play') pauseGame(false);
});
addEventListener('keyup', e => { keys[e.key] = false; });

// 画面を離れたら止めて保存。戻ったらカウントダウンから再開する
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (state === 'play' || state === 'count') pauseGame(true); }
  else if (state === 'pause' && autoResume) { autoResume = false; resumeGame(); }
});
addEventListener('pagehide', () => { if (state === 'play' || state === 'pause') persist(); });

$('btnStart').onclick = () => startRun(false);
$('btnGacha').onclick = openGacha;
$('btnEquip').onclick = openEquip;
$('tabWeapon').onclick = () => { gachaTab = 'weapon'; $('gachaResult').innerHTML = ''; renderGacha(); };
$('tabSkin').onclick = () => { gachaTab = 'skin'; $('gachaResult').innerHTML = ''; renderGacha(); };
$('btnPull').onclick = () => pull(gachaTab);
$('btnGachaBack').onclick = () => { show('gacha', false); showMenu(); };
$('btnEquipBack').onclick = () => { show('equip', false); showMenu(); };
$('btnContinue').onclick = () => startRun(true);
$('btnResume').onclick = resumeGame;
$('btnQuit').onclick = () => { persist(); tutHide(); showMenu(); };
$('btnRetry').onclick = () => startRun(false);
$('btnHome').onclick = showMenu;
$('btnLight').onclick = () => { OPT.light = !OPT.light; OPT.lightAsked = true; saveOpt(); resize(); showMenu(); };
$('btnHow').onclick = () => { applyStatic(); show('help', true); };
$('btnHelpClose').onclick = () => show('help', false);
$('btnLang').onclick = () => { OPT.lang = OPT.lang === 'ja' ? 'en' : 'ja'; saveOpt(); showMenu(); };
$('tutSkip').onclick = e => { e.stopPropagation(); if (R && R.tut) tutEnd(); };
$('btnSound').onclick = () => { OPT.sound = !OPT.sound; saveOpt(); showMenu(); };

// ---------- 描画 ----------
function resize() {
  const k = Math.min(innerWidth / W, innerHeight / H);
  const dpr = OPT.light ? 1 : Math.min(2, window.devicePixelRatio || 1);
  cv.style.width = (W * k) + 'px'; cv.style.height = (H * k) + 'px';
  cv.width = Math.round(W * k * dpr); cv.height = Math.round(H * k * dpr);
  kScale = k * dpr;
  ctx.imageSmoothingEnabled = false;
}
addEventListener('resize', resize);

// 海：深い青のグラデーション・立ちのぼる泡・ゆらぐ光
const bubbles = Array.from({ length: 40 }, () => ({ x: Math.random() * W, y: Math.random() * H, r: 0.8 + Math.random() * 2.4, v: 12 + Math.random() * 26, ph: Math.random() * 6.28 }));
let starY = 0, seaBg = null;
function seaGradient() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0a3a5c'); g.addColorStop(0.45, '#062a48'); g.addColorStop(1, '#021426');
  return g;
}
const FONT = '"DotGothic16", "IBM Plex Mono", monospace';
const ITEM_COL = { crew: '#66e6ff', heal: '#ff8da1', power: '#ffd84a' };

function bulletColor(d) {
  const e = Math.log10(Math.max(1, d));
  return e < 1 ? '#ffffff' : e < 3 ? '#b8ffd2' : e < 6 ? '#39ff88' : e < 9 ? '#66e6ff' : '#ffd84a';
}
function text(t, x, y, size, col, align = 'left') {
  ctx.font = `${size}px ${FONT}`; ctx.textAlign = align; ctx.fillStyle = col; ctx.fillText(t, x, y);
}

function render(now) {
  ctx.setTransform(kScale, 0, 0, kScale, 0, 0);
  ctx.imageSmoothingEnabled = false;
  seaBg = seaGradient();
  ctx.fillStyle = seaBg; ctx.fillRect(0, 0, W, H);
  // 水面からの光（ゆっくり揺れる）
  if (!OPT.light) {
    ctx.fillStyle = '#7fd4ff';
    for (let i = 0; i < 4; i++) {
      const x = ((i * 97 + now / 90) % (W + 120)) - 60;
      ctx.globalAlpha = 0.035;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 40, 0); ctx.lineTo(x - 30, H * 0.8); ctx.lineTo(x - 70, H * 0.8); ctx.fill();
    }
  }
  // 泡：下から上へ
  ctx.fillStyle = '#bfe9ff';
  const nb = OPT.light ? 16 : bubbles.length;
  for (let i = 0; i < nb; i++) {
    const b = bubbles[i];
    const y = H - ((H - b.y + starY * b.v / 20) % (H + 10));
    const x = b.x + Math.sin(now / 700 + b.ph) * 3;
    ctx.globalAlpha = 0.18 + b.r * 0.06;
    ctx.fillRect(Math.round(x), Math.round(y), Math.ceil(b.r), Math.ceil(b.r));
  }
  ctx.globalAlpha = 1;
  if (!R) return;
  const glow = !OPT.light;

  // 左右の地面
  ctx.fillStyle = 'rgba(120,220,255,.05)'; ctx.fillRect(0, 0, MID, PY);
  ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(MID, 0, MID, PY);
  // 海底（自機の下）
  ctx.fillStyle = '#0b1c1a'; ctx.fillRect(0, PY + 1, W, H - PY);
  ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 1; ctx.setLineDash([4, 6]);
  ctx.beginPath(); ctx.moveTo(MID, 0); ctx.lineTo(MID, PY); ctx.stroke(); ctx.setLineDash([]);
  ctx.strokeStyle = 'rgba(255,255,255,.15)'; ctx.beginPath(); ctx.moveTo(0, PY + 0.5); ctx.lineTo(W, PY + 0.5); ctx.stroke();

  // ワニ（小さく大量に）
  const fr = Math.floor(now / 380) % 2;
  for (const mo of R.mobs) {
    const im = mo.gold ? GOLD_FISH[(fr + (mo.ph > 3.14 ? 1 : 0)) % 2] : FISH[mo.k][(fr + (mo.ph > 3.14 ? 1 : 0)) % 2];
    ctx.drawImage(im, Math.round(mo.x + Math.sin(now / 500 + mo.ph) * 1.5 - 7), Math.round(mo.y - 6));
  }

  // ゲートとアイテム
  for (const o of R.objs) {
    if (o.y < -o.h || o.dead) continue;
    if (o.cls === 'gate') {
      const good = isGood(o);
      const col = o.stat === 'weapon' ? '#66e6ff' : o.stat === 'life' ? '#ff8da1' : o.type === 'mul' && o.v >= 1 ? '#ffd84a' : good ? '#39ff88' : '#ff5a5a';
      ctx.fillStyle = col; ctx.globalAlpha = 0.1 + o.hit * 2; ctx.fillRect(o.x, o.y, o.w, o.h);
      ctx.globalAlpha = 1;
      if (glow) { ctx.shadowColor = col; ctx.shadowBlur = 6 + o.hit * 40; }
      ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.strokeRect(o.x + 1, o.y + 1, o.w - 2, o.h - 2);
      ctx.shadowBlur = 0;
      text(L().stat[o.stat], o.x + o.w / 2, o.y + 14, 11, col, 'center');
      text(gateLabel(o), o.x + o.w / 2, o.y + 38, o.stat === 'weapon' ? 16 : 22, '#fff', 'center');
    } else {
      const name = L().item[o.kind], col = ITEM_COL[o.kind];
      ctx.fillStyle = col; ctx.globalAlpha = 0.08 + o.hit * 2; ctx.fillRect(o.x, o.y, o.w, o.h);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.strokeRect(o.x + 1, o.y + 1, o.w - 2, o.h - 2); ctx.setLineDash([]);
      text(name, o.x + o.w / 2, o.y + 18, 14, col, 'center');
      ctx.fillStyle = '#222'; ctx.fillRect(o.x + 8, o.y + 26, o.w - 16, 5);
      ctx.fillStyle = col; ctx.fillRect(o.x + 8, o.y + 26, (o.w - 16) * clamp(o.hp / o.max, 0, 1), 5);
      text(fmt(Math.max(0, Math.ceil(o.hp))), o.x + o.w / 2, o.y + 43, 11, '#fff', 'center');
    }
  }

  // ボス
  const bo = R.boss;
  if (bo) {
    const im = bo.big ? BOSS_BIG : BOSS_MID;
    const j = bo.hit > 0 ? 2 : 0;
    ctx.drawImage(im, Math.round(bo.x - im.width / 2 + rnd(-j, j)), Math.round(bo.y - im.height / 2));
    const bw = 120, bx = bo.x - bw / 2, by = bo.y - im.height / 2 - 18;
    ctx.fillStyle = '#222'; ctx.fillRect(bx, by, bw, 7);
    ctx.fillStyle = bo.big ? '#ff6a5a' : '#cfe0ff'; ctx.fillRect(bx, by, bw * Math.max(0, bo.hp / bo.max), 7);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(bx - 0.5, by - 0.5, bw + 1, 8);
    text(fmt(Math.max(0, Math.ceil(bo.hp))), bo.x, by - 5, 12, '#fff', 'center');
  }

  // ボスの弾（泡）と、突進の予告
  for (const e of R.eb) {
    ctx.strokeStyle = '#ffb3d9'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, 6.283); ctx.stroke();
    ctx.fillStyle = 'rgba(255,179,217,.35)'; ctx.fill();
  }
  if (R.boss && R.boss.charge > 0 && Math.floor(R.boss.charge * 10) % 2) {
    ctx.fillStyle = 'rgba(255,80,80,.18)'; ctx.fillRect(R.boss.x - 60, R.boss.y, 120, PY - R.boss.y);
  }
  // 弾
  for (const b of R.b) {
    ctx.fillStyle = bulletColor(b.d);
    if (b.beam) ctx.fillRect(b.x - 2, b.y - 16, 4, 32);
    else ctx.fillRect(b.x - 1.5, b.y - 4, 3, 8);
  }

  // 墨（ゲートを隠す）と深海（上が暗い）
  for (const k of R.ink) {
    ctx.globalAlpha = Math.min(1, k.t) * 0.92; ctx.fillStyle = '#05070c';
    ctx.beginPath(); ctx.arc(k.x, k.y, k.r, 0, 6.283); ctx.arc(k.x + 30, k.y + 20, k.r * 0.7, 0, 6.283); ctx.arc(k.x - 26, k.y + 26, k.r * 0.6, 0, 6.283); ctx.fill();
    ctx.globalAlpha = 1;
  }
  if (mod() === 'dark') {
    const g = ctx.createLinearGradient(0, 84, 0, 380);
    g.addColorStop(0, 'rgba(0,0,0,.92)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 84, W, 300);
  }
  // 自機と仲間
  if (!R.over) {
    const n = Math.min(R.st.crew, 8);
    const cs = crocSprites(SLOT.skin), HELPER = cs.helper, PLAYER = cs.player;
    for (let si = 1; si < n; si++) ctx.drawImage(HELPER, Math.round(shooterX(si) - HELPER.width / 2), PY - 12);
    if (R.hurt > 0 && Math.floor(R.hurt * 20) % 2) ctx.globalAlpha = 0.35;
    ctx.drawImage(PLAYER, Math.round(R.x - PLAYER.width / 2), PY - 16);
    ctx.globalAlpha = 1;
  }

  for (const p of R.parts) { ctx.globalAlpha = Math.min(1, p.life * 2); ctx.fillStyle = p.col; ctx.fillRect(p.x, p.y, 3, 3); }
  ctx.globalAlpha = 1;
  for (const p of R.pops) {
    ctx.globalAlpha = Math.min(1, p.t * 2);
    if (glow && p.big) { ctx.shadowColor = p.col; ctx.shadowBlur = 8; }
    text(p.text, p.x, p.y, p.big ? 18 : 12, p.col, 'center');
    ctx.shadowBlur = 0;
  }
  ctx.globalAlpha = 1;

  drawHUD();
  if (R.banner) {
    const b = R.banner, a = Math.min(1, b.t);
    ctx.globalAlpha = a;
    if (glow) { ctx.shadowColor = '#39ff88'; ctx.shadowBlur = 16; }
    text(b.text, W / 2, 250, 40, '#39ff88', 'center');
    if (b.sub) text(b.sub, W / 2, 284, 22, '#fff', 'center');
    ctx.shadowBlur = 0; ctx.globalAlpha = 1;
  }
}

function drawHUD() {
  const m = mEff();
  // 上の表示が魚と重なって読めなくならないよう、薄く下地を敷く
  ctx.fillStyle = 'rgba(2,16,32,.85)'; ctx.fillRect(0, 0, W, 84);
  const bx = 10, by = 10, bw = 170, bh = 10;
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(bx - 0.5, by - 0.5, bw + 1, bh + 1);
  ctx.fillStyle = R.boss ? (R.boss.big ? '#ff6a5a' : '#ffd84a') : '#39ff88';
  ctx.fillRect(bx, by, bw * stageFrac(), bh);
  ctx.fillStyle = '#000'; ctx.fillRect(bx + bw * 0.75 - 0.5, by, 1, bh);   // ここからボス
  text(L().stageName(R.stage), bx + bw + 8, by + 10, 12, R.stage % 10 === 0 ? '#ff8a7a' : '#fff');
  if (R.mod && R.mod !== 'normal') text(L().mods[R.mod], W - 10, 64, 11, '#ffd84a', 'right');
  text(L().best + ' ' + fmt(Math.floor(Math.max(SLOT.best, m) * METER)) + 'm', W - 10, 50, 11, '#9aa89f', 'right');
  // 飢餓ゲージ（🍖）
  ctx.drawImage(MEAT, 9, 26);
  const low = R.food <= 3;
  const fm = R.foodMax || FOOD_MAX, cw = 150 / fm;
  for (let i = 0; i < fm; i++) {
    const f = clamp(R.food - i, 0, 1);
    ctx.fillStyle = '#2a2a2a'; ctx.fillRect(28 + i * cw, 29, cw - 3, 8);
    if (f > 0) { ctx.fillStyle = low && Math.floor(performance.now() / 200) % 2 ? '#ff4d4d' : '#e0664a'; ctx.fillRect(28 + i * cw, 29, (cw - 3) * f, 8); }
  }
  if (R.hungry > 0) { ctx.strokeStyle = '#ff4d4d'; ctx.strokeRect(26.5, 27.5, fm * cw, 11); }
  text(fmt(Math.floor(m * METER)) + ' m', 10, 62, 18, '#fff');
  text(L().speed + ' ×' + curSpeed().toFixed(2), 10, 77, 11, '#6b7a70');
  text(L().food, MID / 2, 96, 11, 'rgba(170,230,255,.7)', 'center');
  text(L().gate, MID + MID / 2, 96, 11, 'rgba(120,255,170,.6)', 'center');
  // 下段：ハートと今の強さ
  for (let i = 0; i < HP_MAX; i++) if (i < R.hp) ctx.drawImage(HEART, 10 + i * 18, H - 28);
  text(L().stat.dmg + ' ' + fmt(Math.floor(R.st.dmg)), W / 2, H - 22, 16, '#39ff88', 'center');
  text(`${L().stat.rate} ${R.st.rate}  ${L().stat.lines} ${R.st.lines}  ${L().stat.crew} ${R.st.crew}  ${L().wp[R.st.wp] || L().wp.normal}`, W / 2, H - 6, 11, '#9aa89f', 'center');
  ctx.strokeStyle = '#9aa89f'; ctx.lineWidth = 1; ctx.strokeRect(MENU_RECT.x + 0.5, MENU_RECT.y + 0.5, MENU_RECT.w, MENU_RECT.h);
  text(L().menu, MENU_RECT.x + MENU_RECT.w / 2, MENU_RECT.y + 19, 13, '#cfd8d2', 'center');
}

// ---------- メインループ ----------
let last = performance.now(), lightSamples = 0, lightSum = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const raw = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (state === 'play' && R) {
    if (keys.ArrowLeft || keys.a) R.tx -= 320 * raw;
    if (keys.ArrowRight || keys.d) R.tx += 320 * raw;
    R.tx = clamp(R.tx, 14, W - 14);
    let dt = Math.min(0.05, raw) * TS;
    while (dt > 0 && state === 'play') { const d = Math.min(1 / 30, dt); step(d); dt -= d; }
    starY += curSpeed() * 40 * raw * TS % H;
    // 最初の数秒で重そうなら、軽量モードを提案して自動で切り替える
    if (!OPT.lightAsked && !OPT.light && lightSamples < 240) {
      lightSamples++; lightSum += raw;
      if (lightSamples === 240 && lightSum / 240 > 0.027) {
        OPT.light = true; OPT.lightAsked = true; saveOpt(); resize();
        toast(L().lightToast, 3500);
      } else if (lightSamples === 240) { OPT.lightAsked = true; saveOpt(); }
    }
    if (R.t - (R._saved || 0) > 2) { R._saved = R.t; persist(); }
  } else if (state === 'menu' || state === 'pause' || state === 'count' || state === 'result') {
    starY += 12 * raw;
  }
  render(now);
}

window.Game = { OPT, METER, readSlot, selectSlot, saveOpt, fmt, showMenu };
if (DEV) window.__gate = { get R() { return R; }, step, startRun, get state() { return state; }, STAGES, stageLen, stageSpeed, mEff };   // 開発用

resize();
requestAnimationFrame(frame);
Boot.start(false);
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => { /* 登録できなくても動く */ });

'use strict';

// =====================================================
//  GATE VADER — 撃つか、育てるか。数字のインフレが止まらないゲートシューター
//  v0.4  主人公はワニ。左＝流れてくる魚（撃って食べる）/ 右＝迫ってくるゲートとアイテム。
//        食べ逃すと飢え、飢餓ゲージが尽きたら餓死。何かに当たったら（ハートがなければ）負け。
//        ゲートは撃つほど数値が動き、到達した瞬間に自分の強さ（ダメージ・段数・人数）が確定する。
// =====================================================

const VERSION = '0.10.0';
const W = 360, H = 640;                 // 論理サイズ（縦画面）。画面に合わせて拡縮する
const Q = new URLSearchParams(location.search);
const DEV = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);   // 開発用パラメータは手元でだけ効く
const TS = DEV ? Math.min(60, Math.max(0.1, +Q.get('ts') || 1)) : 1;   // 開発用：時間の倍率
const BOT = DEV && Q.has('bot');                                     // 開発用：自動操縦

// ---------- 進行のペース ----------
const CLEAR_SEC = (DEV && +Q.get('clear')) || 3000;   // 100% までの目標秒数（50分）。ここ一つで長さを調整できる
const SEGS = 8;                              // 100% までのボスの数（12.5% ごと）
const FIGHT_SEC = 40;                        // ボス戦1回あたりの想定秒数
const K = 0.6;                               // 100% 到達時の速さ = 1 + K 倍
const G = (CLEAR_SEC - SEGS * FIGHT_SEC) * K / Math.log(1 + K);   // 100% までのメートル
const SEG = G / SEGS;                        // ボス1区間のメートル
const FIGHT_LEN = G / 32;                    // ボス戦の間に進行バーが進む長さ
const speed = m => (m <= G ? 1 + K * m / G : (1 + K) * (1 + 1.8 * (m - G) / G));   // 100% 以降はぐっと加速

// ---------- 盤面 ----------
const MID = W / 2;                           // 左半分＝ワニ、右半分＝ゲート
const PY = 560;                               // 自機の高さ（左右には自由に動ける）
const GATE_W = 84, GATE_H = 46, GATE_X = [MID + 6, MID + 6 + GATE_W + 6];
const GATE_GAP = 170;                        // ゲートの間隔（進んだ距離）。1列に1つ
const MOB_VY = 30, GATE_VY = 30, BULLET_V = 900, ROW_H = 14;   // 迫ってくる速さ（暇にならないよう速め）
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
const WEAPONS = ['normal', 'spread', 'bounce', 'beam'];
const WP_NAME = { normal: 'NORMAL', spread: 'SPREAD', bounce: 'BOUNCE', beam: 'BEAM' };

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
    return { best: +d.best || 0, runs: +d.runs || 0, run: d.run && typeof d.run === 'object' ? d.run : null,
      coins: +d.coins || 0, prep: Object.assign(freshPrep(), d.prep || {}) };
  } catch (e) { return null; }
}
// ---------- 出発準備（転生）：コインで「次の1回ぶん」の強化を買う。旅が終わるとリセット ----------
function freshPrep() { return { rate: 0, lines: 0, crew: 0, dmg: 0, life: 0, food: 0 }; }
const freshSlot = () => ({ best: 0, runs: 0, run: null, coins: 0, prep: freshPrep() });
const SHOP = [
  { id: 'rate', max: 6, cost: l => Math.round(30 * Math.pow(1.8, l)) },
  { id: 'lines', max: 6, cost: l => Math.round(30 * Math.pow(1.8, l)) },
  { id: 'dmg', max: 8, cost: l => Math.round(40 * Math.pow(2, l)) },
  { id: 'crew', max: 3, cost: l => Math.round(80 * Math.pow(2.2, l)) },
  { id: 'food', max: 5, cost: l => Math.round(25 * Math.pow(1.8, l)) },
  { id: 'life', max: 2, cost: l => Math.round(120 * Math.pow(2.5, l)) },
];
const coinsFor = (m, bosses) => Math.floor(m * METER / 10) + bosses * 25;   // 10m で1コイン、ボス1体で25
let SLOT = readSlot(OPT.slot) || freshSlot();
function writeSlot() { try { localStorage.setItem(SLOT_KEYS[OPT.slot], JSON.stringify(SLOT)); } catch (e) { /* 保存不可 */ } }
function selectSlot(i) { OPT.slot = i; saveOpt(); SLOT = readSlot(i) || freshSlot(); }

// ---------- 文言（タイトルの GATE VADER 以外は 日本語 / English で切り替え） ----------
const I18N = {
  ja: {
    stat: { dmg: '威力', lines: '段数', crew: '仲間', rate: '連射', life: 'ライフ', weapon: '武器' },
    wp: { normal: 'ノーマル', spread: '拡散', bounce: '反射', beam: 'ビーム' },
    item: { crew: '仲間', heal: '回復', power: 'パワー' },
    food: 'エサ', gate: 'ゲート', best: 'ベスト', speed: '速さ', menu: 'メニュー',
    boss: 'ボス', bigBoss: '大ボス', bossDown: '撃破！', hit: '当たった！',
    lifeUp: 'ライフ+1', crewUp: '仲間+1', hpUp: 'ライフ+1', powerUp: '威力×1.3',
    start: 'スタート', newRun: '新しく始める', cont: 'つづきから', light: '軽量', sound: '音', slot: 'スロット',
    how: '遊び方', lang: 'English', on: 'ON', off: 'OFF',
    pause: '一時停止', resume: '再開', quit: '保存して終了', retry: 'もう一度', title: 'タイトル',
    over: 'ゲームオーバー', starved: '餓死…', newBest: 'ベスト更新！', eaten: n => `${n}匹食べた`,
    menuSub: (b, r) => `ベスト ${b} m ・ ${r} 回`,
    lightToast: '軽量モードにしました（タイトルで切り替えできます）',
    skip: 'スキップ', close: 'とじる',
    prep: '出発準備', coins: 'コイン', depart: '出発', back: 'もどる', toPrep: '準備へ', maxed: 'MAX',
    prepNote: '買った強化は、次の1回の旅だけ。終わるとリセット',
    earned: n => `+${n} コイン`,
    shop: { rate: ['連射 +1', '1秒あたりの弾が増える'], lines: ['段数 +1', '横に並ぶ弾が増える'], dmg: ['威力 ×2', '1発の威力が2倍'],
      crew: ['仲間 +1', '横で一緒に撃つワニ'], food: ['満腹 +3', '飢餓ゲージの目盛りが増える'], life: ['ライフ +1', '1回当たっても続けられる'] },
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
      ['ボス', '12.5%ごとに大きな魚。下まで来られたら負け'],
      ['ゴール', '100%で GAME CLEAR、そのまま ∞ MODE へ。競うのは進んだメートル'],
    ],
  },
  en: {
    stat: { dmg: 'DMG', lines: 'LINE', crew: 'CREW', rate: 'RATE', life: 'LIFE', weapon: 'WEAPON' },
    wp: WP_NAME,
    item: { crew: 'CREW', heal: 'HEAL', power: 'POWER' },
    food: 'FOOD', gate: 'GATE', best: 'BEST', speed: 'SPEED', menu: 'MENU',
    boss: 'BOSS', bigBoss: 'BIG BOSS', bossDown: 'BOSS DOWN', hit: 'HIT!',
    lifeUp: '+1 LIFE', crewUp: '+1 CREW', hpUp: '+1 LIFE', powerUp: 'DMG ×1.3',
    start: 'START', newRun: 'NEW RUN', cont: 'CONTINUE', light: 'LIGHT', sound: 'SOUND', slot: 'SLOT',
    how: 'HOW TO PLAY', lang: '日本語', on: 'ON', off: 'OFF',
    pause: 'PAUSE', resume: 'RESUME', quit: 'SAVE & EXIT', retry: 'RETRY', title: 'TITLE',
    over: 'GAME OVER', starved: 'STARVED', newBest: 'NEW BEST!', eaten: n => `${n} EATEN`,
    menuSub: (b, r) => `BEST ${b} m  ·  ${r} RUNS`,
    lightToast: 'LIGHT MODE ON — change it on the title screen',
    skip: 'SKIP', close: 'CLOSE',
    prep: 'PREPARE', coins: 'COINS', depart: 'DEPART', back: 'BACK', toPrep: 'PREPARE', maxed: 'MAX',
    prepNote: 'Boosts last for your next run only, then reset',
    earned: n => `+${n} COINS`,
    shop: { rate: ['RATE +1', 'More shots per second'], lines: ['LINE +1', 'More bullets side by side'], dmg: ['DMG ×2', 'Double damage per shot'],
      crew: ['CREW +1', 'A croc that shoots beside you'], food: ['FULL +3', 'A longer hunger gauge'], life: ['LIFE +1', 'Survive one hit'] },
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
      ['Boss', 'A big fish every 12.5%. If it reaches the bottom, you lose'],
      ['Goal', '100% = GAME CLEAR, then ∞ MODE. You compete on meters travelled'],
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
const MEAT = spr(['.....ww', '....ww.', '..###..', '.####..', '#####..', '####...', '.##....'], { '#': '#e0664a', w: '#fff' }, 2);
const PLAYER = spr(['.....w.....', '....###....', '...#####...', '...#####...', '..#e###e#..', '.##d###d##.', '###########', '#.#######.#', '#..#####..#', '...##.##...', '..##...##..'],
  { '#': '#39ff88', d: '#1f9d54', e: '#ffe14a', w: '#ffffff' }, 3);
// ボス：大きな魚（食べごたえのある獲物）
const BOSS_ROWS = ['.##..........##.', '..##........##..', '....##....##....', '......####......', '.....######.....', '...##########...', '..############..', '.##############.', '.###ee####ee###.', '.###eK####Ke###.', '..############..', '....########....'];
const BOSS_MID = spr(BOSS_ROWS, { '#': '#cfe0ff', e: '#fff', K: '#000' }, 7);
const BOSS_BIG = spr(BOSS_ROWS, { '#': '#ff6a5a', e: '#ffe14a', K: '#000' }, 9);
const HELPER = spr(['.....w.....', '....###....', '...#####...', '..#e###e#..', '.##d###d##.', '###########', '#..#####..#', '...##.##...'],
  { '#': '#39ff88', d: '#1f9d54', e: '#ffe14a', w: '#ffffff' }, 2);
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
    m: 0, hp: 1, food: FOOD_MAX, foodMax: FOOD_MAX, nextLife: SEG * 0.5, t: 0, fire: 0, rowAcc: 0, gateAcc: GATE_GAP - 40, uid: 0, inv: 0,
    st: { ...ST0 }, x: MID, tx: MID, nextWeapon: SEG * 0.3,
    mobs: [], b: [], objs: [],
    boss: null, nextBoss: 1, cleared: false, fightKills: 0, kills: 0,
    pops: [], parts: [], popT: 0, bossAcc: 0, bossAccT: 0, hurt: 0, banner: null, over: false, newBest: false,
  };
  R = r;
  const pr = SLOT.prep || freshPrep();
  r.st.rate += pr.rate; r.st.lines += pr.lines; r.st.crew += pr.crew; r.st.dmg *= Math.pow(2, pr.dmg);
  r.hp += pr.life; r.foodMax = r.food = FOOD_MAX + pr.food * 3;
  r.base = { ...r.st };   // 買った強さは、進み具合の上限より下がらない
  return r;
}
function snapshot() {
  if (!R || R.over) return null;
  const { m, hp, food, foodMax, base, nextLife, nextWeapon, t, rowAcc, gateAcc, uid, st, x, mobs, objs, boss, nextBoss, cleared, fightKills, kills } = R;
  return JSON.parse(JSON.stringify({ m, hp, food, foodMax, base, nextLife, nextWeapon, t, rowAcc, gateAcc, uid, st, x, mobs, objs, boss, nextBoss, cleared, fightKills, kills }));
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
const mEff = () => (R.boss ? R.boss.startM + FIGHT_LEN * clearFrac() : R.m);
// 強さの上限は進み具合で少しずつ開く（序盤つらい → 70% 前後で全開 → 終盤はマイナスゲートと速さで苦しい）
const pOf = () => Math.min(1, (R ? R.m : 0) / G);
const baseOf = k => (R && R.base ? R.base[k] : 1);
const linesCap = () => Math.max(baseOf('lines'), Math.min(OPT.light ? 9 : LMAX, 2 + Math.floor(pOf() * 18)));
const crewCap = () => Math.max(baseOf('crew'), Math.min(CMAX, 1 + Math.floor(pOf() * 10)));
const rateCap = () => Math.max(baseOf('rate'), Math.min(RMAX, 2 + Math.floor(pOf() * 14)));
const mulCap = () => 1.2 + pOf() * 0.8;   // ×ゲートがどこまで育つか

// ---------- ゲート・アイテム ----------
// 数値ゲート：撃つと数値が動き、自機に届いた瞬間に効果が確定する（良くも悪くも）
// ゲートの数値は「弾1発で1」動く。難しさは初期値で決める（終盤は -100 などの深いマイナスが増える）
function makeGate(slot, safe) {
  const st = R.st, p = R.m / G, pc = Math.min(1, p);
  const room = { lines: st.lines < linesCap(), crew: st.crew < crewCap(), rate: st.rate < rateCap() };
  const q = Math.random();
  let stat, type = 'add', v;
  if (q < 0.2 && room.rate) stat = 'rate';
  else if (q < 0.4 && room.lines) stat = 'lines';
  else if (q < 0.5 && room.crew) stat = 'crew';
  else stat = 'dmg';
  const bad = !safe && Math.random() < 0.25 + 0.35 * pc + (p > 1 ? 0.1 : 0);
  if (stat === 'dmg') {
    const mag = Math.pow(10, p * 5);   // 100% で 十万くらいの桁
    if (pc > 0.12 && Math.random() < 0.06) {
      type = 'mul';
      v = bad ? 0.5 : Math.round((1.1 + Math.random() * (0.1 + pc * 0.5)) * 10) / 10;
    } else v = Math.max(1, Math.round(mag * rnd(0.5, 1.5))) * (bad ? -Math.max(1, Math.round(rnd(1, 1 + 4 * pc))) : 1);
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
  const p = R.m / G;
  const early = p < 0.03;
  const slot = Math.random() < 0.5 ? 0 : 1;   // 1列に1つだけ（2つ同時には取れない）
  let o;
  if (R.m >= R.nextLife) {
    // ハートを増やす機会は多すぎないように、距離で間隔を空ける
    R.nextLife = R.m + SEG * rnd(0.45, 0.75);
    o = Math.random() < 0.5 ? makeLife(slot) : makeItem(slot, 'heal');
  } else if (R.m >= R.nextWeapon) {
    // 武器ゲートもたまにだけ。撃つと中身の武器が切り替わる
    R.nextWeapon = R.m + SEG * rnd(0.3, 0.5);
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
  const p = Math.min(1, R.m / G);
  const dens = Math.min(0.92, 0.04 + 0.55 * Math.pow(p, 0.8) + (R.m > G ? 0.3 * Math.min(1, (R.m - G) / G) : 0));
  const k = p < 0.35 ? 0 : p < 0.7 ? 1 : 2;
  for (let i = 0; i < ZSLOTS; i++) if (Math.random() < dens) R.mobs.push({ x: ZX0 + i * ZDX + rnd(-1, 1), y: -10, k: Math.random() < 0.85 ? k : Math.min(2, k + 1), ph: Math.random() * 6.28, d: 0 });
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

// ---------- ボス ----------
const bossFightSec = k => 22 * (1 + 0.06 * k + Math.max(0, k - SEGS) * 0.25);
function spawnBoss() {
  const k = R.nextBoss, big = k % 4 === 0;
  // HP は今の火力に合わせる（数字はインフレするが、戦う時間は変わらない）
  const max = Math.max(30, dpsOf(R.st) * 0.35 * bossFightSec(k));
  R.boss = { k, big, hp: max, max, x: MID, y: -80, ph: Math.random() * 6, startM: R.m, hit: 0 };
  R.fightKills = 0;
  R.banner = { text: big ? L().bigBoss : L().boss, t: 2 };
  sfx('boss');
}
function killBoss() {
  const b = R.boss;
  burst(b.x, b.y, b.big ? 60 : 36, b.big ? '#ff6a5a' : '#cfe0ff');
  R.m = b.k * SEG;
  R.nextBoss++;
  R.boss = null;
  sfx('boss');
  if (b.k === SEGS && !R.cleared) { R.cleared = true; R.banner = { text: 'GAME CLEAR!', t: 4, sub: '∞ MODE' }; }
  else R.banner = { text: L().bossDown, t: 1.8 };
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
    let vx = 0;
    if (wp === 'spread') vx = u * 0.8 * BULLET_V;                 // 扇状に広がる
    else if (wp === 'bounce') vx = (line % 2 ? 1 : -1) * 0.45 * BULLET_V;   // 斜めに撃ち、壁で跳ね返る
    const vy = -Math.sqrt(BULLET_V * BULLET_V - vx * vx);
    R.b.push({ x, y: PY - 14, vx, vy, d: st.dmg * w, w, pr, bn: wp === 'bounce' ? 3 : 0 });
  }
}

// ---------- 1コマ進める ----------
function step(dt) {
  if (!R || R.over) return;
  const st = R.st;
  const s = speed(R.boss ? R.boss.startM : R.m);
  R.t += dt;

  // 進行：ボスが出たらその場で止まり、ボス戦の進み具合でバーが動く
  if (!R.boss) {
    R.m += s * dt;
    if (R.m >= R.nextBoss * SEG - FIGHT_LEN) spawnBoss();
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
    b.x += b.vx * dt; b.y += b.vy * dt;
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
            mo.d = 1; R.kills++; if (R.boss) R.fightKills++; R.food = Math.min(R.foodMax, R.food + FOOD_EAT);
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
    if (bo.y < 96) bo.y += 130 * dt; else bo.y += 11 * s * dt;
    bo.x = MID + Math.sin(bo.ph * 0.7) * 90;
    R.bossAccT -= dt;
    if (R.bossAccT <= 0 && R.bossAcc > 0) { pop(bo.x + rnd(-30, 30), bo.y + 30, fmt(R.bossAcc), true, '#b8ffd2'); R.bossAcc = 0; R.bossAccT = 0.25; }
    if (bo.hp <= 0) killBoss();
    else if (bo.y > PY - 40) R.hp = 0;
  }

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
  if (R.gateAcc >= GATE_GAP) { R.gateAcc -= GATE_GAP; spawnGateRow(); }
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
  $('btnRetry').textContent = l.toPrep;
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
  $('menuSub').textContent = l.menuSub(fmt(Math.floor(SLOT.best * METER)), SLOT.runs) + `  ·  ${l.coins} ${fmt(SLOT.coins)}`;
  show('btnContinue', !!SLOT.run);
  $('btnContinue').textContent = SLOT.run ? `${l.cont}  ${fmt(Math.floor(SLOT.run.m * METER))} m` : l.cont;
  $('btnStart').textContent = SLOT.run ? l.newRun : l.start;
  $('btnLight').textContent = `${l.light}: ${OPT.light ? l.on : l.off}`;
  $('btnSound').textContent = `${l.sound}: ${OPT.sound ? l.on : l.off}`;
  $('btnHow').textContent = l.how;
  $('btnLang').textContent = l.lang;
  applyStatic();
  show('menu', true);
}
function openShop() {
  state = 'menu';
  show('menu', false); show('result', false);
  renderShop();
  show('shop', true);
}
function renderShop() {
  const l = L(), pr = SLOT.prep;
  $('shopTitle').textContent = l.prep;
  $('shopCoins').textContent = `${l.coins} ${fmt(SLOT.coins)}`;
  $('shopNote').textContent = l.prepNote;
  $('btnDepart').textContent = l.depart;
  $('btnShopBack').textContent = l.back;
  $('shopList').innerHTML = SHOP.map(it => {
    const lv = pr[it.id], maxed = lv >= it.max, cost = it.cost(lv);
    const [name, desc] = l.shop[it.id];
    return `<button class="shop-row" data-buy="${it.id}" ${maxed || SLOT.coins < cost ? 'disabled' : ''}>
      <span class="sr-name">${name}<small>${desc}</small></span>
      <span class="sr-lv">${'■'.repeat(lv)}${'□'.repeat(it.max - lv)}</span>
      <span class="sr-cost">${maxed ? l.maxed : fmt(cost)}</span></button>`;
  }).join('');
  $('shopList').querySelectorAll('[data-buy]').forEach(b => { b.onclick = () => buy(b.dataset.buy); });
}
function buy(id) {
  const it = SHOP.find(x => x.id === id), lv = SLOT.prep[id], cost = it.cost(lv);
  if (lv >= it.max || SLOT.coins < cost) return;
  SLOT.coins -= cost; SLOT.prep[id]++; writeSlot();
  sfx('gate'); renderShop();
}
function startRun(resume) {
  show('shop', false);
  show('menu', false); show('result', false); show('pause', false);
  if (resume && SLOT.run) loadRun(SLOT.run); else { newRun(); SLOT.run = null; if (!OPT.tutDone) tutStart(); }
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
  const gain = coinsFor(m, R.nextBoss - 1);
  SLOT.coins += gain; SLOT.prep = freshPrep();
  SLOT.run = null; writeSlot();
  sfx('hurt');
  const l = L();
  tutHide();
  $('resTitle').textContent = R.starved ? l.starved : l.over;
  $('resM').textContent = fmt(Math.floor(m * METER)) + ' m';
  $('resSub').textContent = (R.newBest ? l.newBest + '  ' : `${l.best} ${fmt(Math.floor(SLOT.best * METER))} m  ·  `) + `${R.cleared ? '∞ MODE  ·  ' : ''}${l.eaten(R.kills)}`;
  $('resCoins').textContent = l.earned(gain);
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

$('btnStart').onclick = openShop;
$('btnDepart').onclick = () => startRun(false);
$('btnShopBack').onclick = () => { show('shop', false); showMenu(); };
$('btnContinue').onclick = () => startRun(true);
$('btnResume').onclick = resumeGame;
$('btnQuit').onclick = () => { persist(); tutHide(); showMenu(); };
$('btnRetry').onclick = openShop;
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
    const im = FISH[mo.k][(fr + (mo.ph > 3.14 ? 1 : 0)) % 2];
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

  // 弾
  for (const b of R.b) {
    ctx.fillStyle = bulletColor(b.d);
    if (b.beam) ctx.fillRect(b.x - 2, b.y - 16, 4, 32);
    else ctx.fillRect(b.x - 1.5, b.y - 4, 3, 8);
  }

  // 自機と仲間
  if (!R.over) {
    const n = Math.min(R.st.crew, 8);
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
  const m = mEff(), p = m / G;
  // 上の表示が魚と重なって読めなくならないよう、薄く下地を敷く
  ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(0, 0, W, 84);
  const bx = 10, by = 10, bw = 170, bh = 10;
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(bx - 0.5, by - 0.5, bw + 1, bh + 1);
  ctx.fillStyle = R.boss ? (R.boss.big ? '#ff6a5a' : '#ffd84a') : '#39ff88';
  ctx.fillRect(bx, by, bw * Math.min(1, p), bh);
  ctx.fillStyle = '#000';
  for (let i = 1; i < SEGS; i++) ctx.fillRect(bx + bw * i / SEGS - 0.5, by, 1, bh);
  text(R.cleared ? '∞' : Math.min(100, Math.floor(p * 1000) / 10).toFixed(1) + '%', bx + bw + 8, by + 10, 12, '#fff');
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
  text(L().speed + ' ×' + speed(R.boss ? R.boss.startM : R.m).toFixed(2), 10, 77, 11, '#6b7a70');
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
    starY += speed(R.m) * 40 * raw * TS % H;
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
if (DEV) window.__gate = { get R() { return R; }, step, startRun, get state() { return state; }, G, SEG, speed, mEff };   // 開発用

resize();
requestAnimationFrame(frame);
Boot.start(false);
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => { /* 登録できなくても動く */ });

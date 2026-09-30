'use strict';

// =====================================================
//  GATE VADER — 撃つか、育てるか。数字のインフレが止まらないゲートシューター
//  v0.4  主人公はワニ。左＝流れてくる魚（撃って食べる）/ 右＝迫ってくるゲートとアイテム。
//        食べ逃すと飢え、飢餓ゲージが尽きたら餓死。何かに当たったら（ハートがなければ）負け。
//        ゲートは撃つほど数値が動き、到達した瞬間に自分の強さ（ダメージ・段数・人数）が確定する。
// =====================================================

const VERSION = '0.19.0';
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
const LMAX = 15, CMAX = 20;                  // 段数と人数の上限（仲間は 8 人目から後ろにもう1列）
const HP_MAX = 3;                              // ハートは1つで始まり、LIFE ゲート・HEAL でだけ増える（最大3）
const FOOD_MAX = 10, FOOD_EAT = 0.5;         // 飢餓ゲージ：1匹逃すと-1、1匹食べると+0.5
const DMG_CAP = 1e250;                       // ダメージの上限（ボスHPなどが数の限界を超えないように）
const PIERCE_MAX = 6;                        // 1発で貫ける数の上限（∞ MODE で無敵にならないように）
// 最初は 1秒に1発・1列・1人。ゲートで 連射・段数・仲間・威力 を増やしていく（序盤つらい → 中盤楽しい → 終盤苦しい）
const ST0 = { dmg: 1, lines: 1, crew: 1, rate: 1, wp: 'normal', subs: {} };
const RMAX = 12;                             // 連射（1秒あたり）の上限
// 武器：撃ち方が変わる（弾はまっすぐ上に飛ぶのが基本）
// 旅の途中の武器の札：持っている武器はそのままで、その撃ち方が外側に2本加わる（同じ札を重ねると +2 本、3段まで）
const WEAPONS = ['spread', 'bounce', 'wave', 'homing', 'shotgun', 'trident', 'beam'];
const SUB_MAX = 3;
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
      pearls: d.pearls == null ? f.pearls : +d.pearls, free: Object.assign(f.free, d.free || {}), maxStage: +d.maxStage || 0, pity: Object.assign(f.pity, d.pity || {}),
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
  { id: 'bamboo', r: 'N', pat: 'normal', rate: 2, lines: 1, dmg: 1 },
  { id: 'reed', r: 'N', pat: 'wave', rate: 1, lines: 2, dmg: 1 },
  { id: 'kasa', r: 'R', pat: 'spread', rate: 2, lines: 4, dmg: 1 },
  { id: 'oar', r: 'R', pat: 'bounce', rate: 2, lines: 3, dmg: 2 },
  { id: 'net', r: 'R', pat: 'shotgun', rate: 1, lines: 4, dmg: 2 },
  { id: 'kite', r: 'SR', pat: 'homing', rate: 2, lines: 3, dmg: 3 },
  { id: 'drum', r: 'SR', pat: 'wave', rate: 3, lines: 4, dmg: 3 },
  { id: 'anchor', r: 'SR', pat: 'trident', rate: 2, lines: 2, dmg: 5 },
  { id: 'suzuri', r: 'SSR', pat: 'shotgun', rate: 3, lines: 7, dmg: 8 },
  { id: 'aranami', r: 'SSR', pat: 'wave', rate: 4, lines: 5, dmg: 9 },
];
// スキン：見た目（体・影・目の色）と、レベルで伸びる小さな効果（pas × Lv）
// スキン：ワニを描く墨の色（日本の伝統色の名前）。レベルで伸びる小さな効果つき
const SKIN_DEF = [
  { id: 'green', r: 'N', ink: '#1a1714', pas: 'food', v: 1 },      // 墨
  { id: 'olive', r: 'N', ink: '#3d4a2a', pas: 'coin', v: 0.08 },   // 松葉色
  { id: 'sky', r: 'N', ink: '#1f3a5a', pas: 'eat', v: 0.1 },       // 藍色
  { id: 'pink', r: 'R', ink: '#7a2e3c', pas: 'food', v: 2 },       // 臙脂
  { id: 'gold', r: 'R', ink: '#8a6a1a', pas: 'coin', v: 0.15 },    // 金茶
  { id: 'snow', r: 'R', ink: '#6a6a70', pas: 'dmg', v: 0.1 },      // 銀鼠
  { id: 'violet', r: 'SR', ink: '#4a2a5a', pas: 'dmg', v: 0.2 },   // 江戸紫
  { id: 'crimson', r: 'SR', ink: '#c8321e', pas: 'rate', v: 0.5 }, // 朱色
  { id: 'shadow', r: 'SSR', ink: '#0a0806', pas: 'coin', v: 0.3 }, // 漆黒
  { id: 'neon', r: 'SSR', ink: '#3a6a5a', pas: 'dmg', v: 0.4 },    // 青磁色（濃いめ）
  { id: 'tobi', r: 'N', ink: '#6b3a2a', pas: 'coin', v: 0.08 },    // 鳶色
  { id: 'kon', r: 'N', ink: '#223a70', pas: 'food', v: 1 },        // 紺色
  { id: 'moegi', r: 'R', ink: '#006e54', pas: 'eat', v: 0.15 },    // 萌葱色
  { id: 'kuri', r: 'R', ink: '#762f07', pas: 'dmg', v: 0.1 },      // 栗色
  { id: 'ebicha', r: 'R', ink: '#6d3c32', pas: 'coin', v: 0.15 },  // 海老茶
  { id: 'rurikon', r: 'SR', ink: '#19448e', pas: 'eat', v: 0.3 },  // 瑠璃紺
  { id: 'yamabuki', r: 'SR', ink: '#b8862b', pas: 'coin', v: 0.25 }, // 山吹色
  { id: 'kokiake', r: 'SR', ink: '#8a2b2b', pas: 'food', v: 3 },   // 深緋（こきあけ）
  { id: 'kindei', r: 'SSR', ink: '#9a7a2a', pas: 'rate', v: 0.7 }, // 金泥
  { id: 'shinku', r: 'SSR', ink: '#a22041', pas: 'dmg', v: 0.35 }, // 真紅
];
const RARITY = { N: { w: 60, col: '#5a534b' }, R: { w: 28, col: '#1f3a5a' }, SR: { w: 10, col: '#4a2a5a' }, SSR: { w: 2, col: '#c8321e' } };
// ガチャは真珠で引く（1回10、10連100）。各ガチャの最初の1回は無料。
// 真珠は 進んだ距離（600米ごとに1）と、段の初突破（大ボスは多め）でたまる。50回目は SSR 確定（天井）
const GACHA_COST = 10;
const PEARL_PER_M = 600;
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
const freshSlot = () => ({ best: 0, runs: 0, run: null, coins: 0, pearls: 0, free: { weapon: 1, skin: 1 }, maxStage: 0, pity: { weapon: 0, skin: 0 },
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
    stat: { dmg: '威力', lines: '段数', crew: '仲間', rate: '連射', life: '命', weapon: '武器' },
    wp: { normal: '単発', spread: '拡散', bounce: '反射', beam: '一閃', wave: '波打ち', shotgun: '散弾', homing: '追尾', trident: '貫通' },
    item: { crew: '仲間', heal: '回復', power: '威力' },
    food: '餌', gate: '札', best: '最高', speed: '速さ', menu: '中断', meter: '米', hungerMark: '腹', lifeMark: '命',
    appears: n => `${n} 現る`,
    boss: 'ボス', bigBoss: '大ボス', bossDown: '撃破！', bigDown: '大ボス撃破！',
    stageClear: n => `第${n}段 突破`, stageName: n => (n > STAGES ? `続 第${n}段` : `第${n}段／${STAGES}`), hit: '被弾',
    mods: { normal: '', school: '魚の群れ', current: '急流', golden: '朱の魚（食べると銭）', minus: '逆さ札', rush: '札の雨', dark: '夜の海' },
    attacks: { plain: '', bubble: '墨玉を撃つ', charge: '突進', summon: '魚を呼ぶ', ink: '墨を吐く' },
    side: { news: 'お知らせ', road: '道のり', how: '遊び方' }, road: '十段の道のり', contShort: '続きから', fromStart: 'はじめから',
    roadLead: '真珠は 600米進むごとに1つ。さらに各段を初めて突破すると多めにもらえる（第十段の海坊主は特に多い）。', got: '済',
    bn: { nextK: '初突破', next: (n, p) => `第${kan(n)}段を突破で　真珠 +${p}`, up: '強化できる装備があります', free: 'ガチャ 初回1回 無料', rec: n => `海の怪異 絵巻　${n} / 10` },
    rankName: n => (n >= STAGES ? '十段 踏破' : n > 0 ? `第${kan(n)}段 突破` : '見習い'),
    says: n => ['腹がへった…', `次は第${kan(Math.min(n, STAGES))}段だ`, '札は、くぐってこそ', '墨が乾く前に行こう', '海坊主…いつか会う'],
    tapStart: 'タップしてはじめる', plusCoin: '銭は、進んだ距離と突破した段でたまる', plusPearl: '真珠は 600米ごとに1つ ＋ 段の初突破でもらえる。ガチャ1回10、各ガチャの最初の1回は無料',
    news: [['版 0.19.0', 'ガチャに注目の品と絵つきのラインナップ、10連（SR以上1つ確定）、各ガチャの初回無料。武器と墨の色を20種ずつに。真珠は600米ごとに1つ（1回10）。武器の札は、今の武器に撃ち方を外側2本足す形に。仲間は20人まで。'],
      ['版 0.18.0', 'タイトル画面を追加。ホームを作り直し（左右のアイコン、下の角の大きな丸ボタン、バナー）。'],
      ['版 0.17.0', '下のタブ（装備・ガチャ・ホーム・絵巻・設定）。アイコンを一新。'],
      ['版 0.16.0', '墨絵と和紙の見た目に。ボスは海の怪異に。']],
    gTitleW: '武器ガチャ', gTitleS: '墨の色ガチャ', pickup: '注目', owned: '所持', notOwned: '未入手', lineup: 'ラインナップ',
    lineupLead: '出るものと、1つずつの確率。同じものが出たら銭に変わる。', gResult: '結果', pull1: '1回', pull10: '10連', freeOnce: '初回無料', srSure: 'SR以上1つ確定',
    skinNote: 'ワニを描く墨の色が変わる', 
    tabs: { rec: '絵巻', gear: '装備', home: 'ホーム', gacha: 'ガチャ', opt: '設定' },
    go: '出陣', skinTab: '墨の色', equipped: '装備中', collection: '集めたもの',
    nextClear: (n, p) => `次の初突破　第${kan(n)}段　真珠 +${p}`, allClear: '十段 すべて突破',
    yokai: '海の怪異 絵巻', unknown: '？？？', notMet: 'まだ出会っていない',
    recStat: { best: '最高到達', runs: '挑んだ回数', stage: '突破した段' },
    opt: { lang: '言語', sound: '音', light: '軽量モード', how: '遊び方', open: 'ひらく' },
    home: 'ホームへ', version: v => `版 ${v}`,
    bossDesc: ['ふくれて墨玉を撃つ、大きなふぐ', '漂いながら魚の群れを呼び寄せる', '墨を吐いて札を隠す',
      '寺に現れて問答をしかけ、正体は大蟹だったと伝わる妖怪', '長い吻で一直線に突っこんでくる', '墨を吐き、魚も呼ぶ',
      'うねりながら墨玉を撃つ', '西日本の海に伝わる怪魚。尾で船の人をなでるようにさらうという',
      '背に砂が積もり、島と見まちがえられたと伝わる巨大なエイ', '各地の海に伝わる、黒く大きな坊主頭の怪。第十段の主'],
    coinRush: n => `銭 +${n}`, gameClear: '十段 踏破', coinRushSub: '続きは 銭稼ぎの段',
    lifeUp: '命 +1', crewUp: '仲間 +1', hpUp: '命 +1', powerUp: '威力 ×1.3',
    start: 'スタート', newRun: '新しく始める', cont: 'つづきから', light: '軽量', sound: '音', slot: 'スロット',
    how: '遊び方', lang: 'English', on: 'ON', off: 'OFF',
    pause: '一時停止', resume: '再開', quit: '保存して終了', retry: 'もう一度', title: 'タイトル',
    over: 'ゲームオーバー', starved: '餓死…', newBest: 'ベスト更新！', eaten: n => `${n}匹食べた`,
    menuSub: (b, r) => `最高 ${b} 米 ・ ${r} 回`,
    lightToast: '軽量モードにしました（タイトルで切り替えできます）',
    skip: 'スキップ', close: 'とじる',
    coins: '銭', back: 'もどる', gacha: 'ガチャ', equip: '装備・強化', gWeapon: '武器', gSkin: 'スキン', pull: '引く',
    gNew: '新たに入手', gDup: n => `もう持っている → 銭 ${n}`, pearl: '真珠', up: '強化',
    pity: n => `SSR確定まで あと${n}回`, pearlHow: '真珠は 600米ごとに1つ ＋ 段の初突破でもらえる。各ガチャの最初の1回は無料',
    firstClear: n => `初突破　真珠 +${n}`, pearlGot: n => `真珠 +${n}`,
    pas: { food: v => `満腹 +${v}`, coin: v => `銭 +${Math.round(v * 100)}%`, eat: v => `食べて回復 +${Math.round(v * 100)}%`,
      dmg: v => `威力 +${Math.round(v * 100)}%`, rate: v => `連射 +${Math.floor(v)}` },
    earned: n => `銭 +${n}`,
    wname: { pea: '豆鉄砲', twin: '双筆', fan: '扇', rapid: '早打ち', bouncer: '跳ね墨', wave: '波筆',
      shotgun: '散らし墨', homing: '追い墨', beam: '一筆', trident: '三叉銛', jaws: '大顎',
      bamboo: '竹筒', reed: '葦笛', kasa: '番傘', oar: '櫂', net: '投網', kite: '凧', drum: '太鼓', anchor: '錨', suzuri: '大硯', aranami: '荒波' },
    wdesc: { normal: 'まっすぐ撃つ', spread: '扇のように広がる', bounce: '斜めに撃ち、壁で跳ね返る', beam: '1人1本の太い筆。よく貫く', wave: 'くねくね進む',
      shotgun: '広く散らばる', homing: '近くの魚へ曲がる', trident: '何匹も貫く' },
    sname: { green: '墨', olive: '松葉色', sky: '藍色', pink: '臙脂', gold: '金茶', snow: '銀鼠',
      violet: '江戸紫', crimson: '朱色', shadow: '漆黒', neon: '青磁色',
      tobi: '鳶色', kon: '紺色', moegi: '萌葱色', kuri: '栗色', ebicha: '海老茶', rurikon: '瑠璃紺', yamabuki: '山吹色', kokiake: '深緋', kindei: '金泥', shinku: '真紅' },
    tut: [
      '画面をドラッグして、ワニを左右に動かそう',
      '左の魚を撃って食べよう。\n逃すと左上の「腹」が減り、空になると餓死',
      '右の札は、弾1発ごとに数値が1ずつ良くなる。\nマイナスも撃ち続ければプラスに変わる',
      '札は、くぐると効果が決まる。\n欲しい札の下へ動いて、くぐろう',
      '朱の点線の札は、壊すと手に入る。\n壊さずにぶつかると負け（命は1つ）',
      '命・武器の札は、たまにだけ出る。\nできるだけ遠くまで進もう',
    ],
    help: [
      ['動かす', '画面のどこでもドラッグすると、ワニが左右に動く。弾はまっすぐ上に飛ぶ'],
      ['左：餌', '魚を撃つと食べられる。逃すと「腹」が減り、空になると餓死'],
      ['右：札', '弾1発ごとに数値が1良くなる。くぐると 威力・連射・段数・仲間 が変わる。くぐらなければ何も起きない'],
      ['壊せる札', '朱の点線の札は壊すと手に入る。壊さずにぶつかると命 -1（0で負け）。避けてもいい'],
      ['命・武器', 'たまにだけ出る札。武器の札をくぐると、今の武器はそのままで、その撃ち方が外側に2本加わる（重ねると増える）。撃つと中身が切り替わる'],
      ['ボス', '各段の最後に、海の大物や伝承の怪異（蟹坊主・磯撫で・赤えい・海坊主）が現れる。墨玉・突進・墨で攻撃してくる。当たるか、下まで来られたら負け'],
      ['ゴール', '第十段を突破すると終幕。その先は「続き」：突破するたびに銭が雪だるま式に増える'],
      ['銭・真珠', '進んだ距離は銭になり、装備の強化に使う。各段を初めて突破すると真珠がもらえ、ガチャで武器と墨の色が手に入る'],
    ],
  },
  en: {
    stat: { dmg: 'DMG', lines: 'LINE', crew: 'CREW', rate: 'RATE', life: 'LIFE', weapon: 'WEAPON' },
    wp: WP_NAME,
    item: { crew: 'CREW', heal: 'HEAL', power: 'POWER' },
    food: 'FOOD', gate: 'TAGS', best: 'BEST', speed: 'SPEED', menu: 'PAUSE', meter: 'm', hungerMark: 'Belly', lifeMark: 'Life',
    appears: n => `${n} appears!`,
    boss: 'BOSS', bigBoss: 'BIG BOSS', bossDown: 'BOSS DOWN', bigDown: 'BIG BOSS DOWN!',
    stageClear: n => `STAGE ${n} CLEAR!`, stageName: n => (n > STAGES ? `∞ ${n}` : `STAGE ${n}/${STAGES}`), hit: 'HIT!',
    mods: { normal: '', school: 'FISH SCHOOL', current: 'FAST CURRENT', golden: 'RED FISH (coins)', minus: 'REVERSED TAGS', rush: 'TAG RAIN', dark: 'NIGHT SEA' },
    attacks: { plain: '', bubble: 'INK SHOTS', charge: 'CHARGE', summon: 'SUMMONS FISH', ink: 'INK CLOUD' },
    side: { news: 'News', road: 'Road', how: 'How to' }, road: 'ROAD OF 10', contShort: 'CONTINUE', fromStart: 'NEW RUN',
    roadLead: 'You earn 1 pearl per 600 m, plus a bonus for each first-time stage clear (Stage 10, Umibozu, gives the most).', got: 'DONE',
    bn: { nextK: 'FIRST CLEAR', next: (n, p) => `Clear stage ${n}: +${p} pearls`, up: 'Gear ready to upgrade', free: 'First gacha pull is FREE', rec: n => `Scroll of sea yokai  ${n} / 10` },
    rankName: n => (n >= STAGES ? 'All cleared' : n > 0 ? `Stage ${n} cleared` : 'Novice'),
    says: n => ['So hungry…', `Stage ${Math.min(n, STAGES)} next`, 'Tags count only when you pass', "Let's go before the ink dries", 'Umibozu… someday'],
    tapStart: 'TAP TO START', plusCoin: 'Coins come from distance and stages cleared', plusPearl: '1 pearl per 600 m + first-time stage clears. A pull costs 10; the first pull of each gacha is free',
    news: [['v0.19.0', 'Gacha now shows a pick-up with pictures, a full lineup with rates, ×10 pulls (1 SR+ guaranteed) and a free first pull. 21 weapons and 20 inks. 1 pearl per 600 m (a pull costs 10). Weapon gates now add 2 outer shots to your weapon. Crew up to 20.'],
      ['v0.18.0', 'New title screen. Rebuilt home (side icons, big round buttons, banner).'],
      ['v0.17.0', 'Bottom tabs (Gear, Gacha, Home, Scroll, Option). New icon.'],
      ['v0.16.0', 'Sumi-e ink look on washi paper. Bosses are sea yokai.']],
    gTitleW: 'WEAPON GACHA', gTitleS: 'INK GACHA', pickup: 'PICK UP', owned: 'OWNED', notOwned: 'not owned', lineup: 'LINEUP',
    lineupLead: 'Everything you can get, with each rate. Duplicates turn into coins.', gResult: 'RESULT', pull1: '×1', pull10: '×10', freeOnce: 'FREE', srSure: '1 SR+ guaranteed',
    skinNote: 'Changes the ink color of your croc', 
    tabs: { rec: 'SCROLL', gear: 'GEAR', home: 'HOME', gacha: 'GACHA', opt: 'OPTION' },
    go: 'START', skinTab: 'INK', equipped: 'EQUIPPED', collection: 'COLLECTION',
    nextClear: (n, p) => `Next first clear: stage ${n}  ·  +${p} pearls`, allClear: 'All 10 stages cleared',
    yokai: 'SCROLL OF SEA YOKAI', unknown: '???', notMet: 'Not met yet',
    recStat: { best: 'BEST', runs: 'RUNS', stage: 'CLEARED' },
    opt: { lang: 'Language', sound: 'Sound', light: 'Light mode', how: 'How to play', open: 'OPEN' },
    home: 'HOME', version: v => `v${v}`,
    bossDesc: ['A giant puffer that swells and spits ink balls', 'Drifts along and calls schools of fish', 'Spits ink to hide the tags',
      'A yokai said to appear at a temple posing riddles — really a giant crab', 'Charges straight in with its long bill', 'Spits ink and calls fish',
      'Winds about and spits ink balls', 'A sea monster of western Japan, said to sweep people off boats with its tail',
      'A ray so huge that sailors mistook its sandy back for an island', 'A great black sea spirit told of along many coasts. Lord of stage 10'],
    coinRush: n => `+${n} COINS`, gameClear: 'GAME CLEAR!', coinRushSub: 'COIN RUSH continues',
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
    pity: n => `SSR guaranteed in ${n}`, pearlHow: '1 pearl per 600 m + first-time stage clears. The first pull of each gacha is free',
    firstClear: n => `FIRST CLEAR! +${n} PEARLS`, pearlGot: n => `+${n} PEARLS`,
    pas: { food: v => `FULL +${v}`, coin: v => `COINS +${Math.round(v * 100)}%`, eat: v => `EAT +${Math.round(v * 100)}%`,
      dmg: v => `DMG +${Math.round(v * 100)}%`, rate: v => `RATE +${Math.floor(v)}` },
    earned: n => `+${n} COINS`,
    wname: { pea: 'Pea Shooter', twin: 'Twin Brush', fan: 'Folding Fan', rapid: 'Quick Tubes', bouncer: 'Inkstone Bounce', wave: 'Wave Brush',
      shotgun: 'Ink Spray', homing: 'Seeking Ink', beam: 'Single Stroke', trident: 'Trident', jaws: 'Great Jaw',
      bamboo: 'Bamboo Tube', reed: 'Reed Flute', kasa: 'Oil Umbrella', oar: 'Oar', net: 'Cast Net', kite: 'Kite', drum: 'Drum', anchor: 'Anchor', suzuri: 'Great Inkstone', aranami: 'Rough Waves' },
    wdesc: { normal: 'Shoots straight', spread: 'Fans out', bounce: 'Shoots diagonally, bounces off walls', beam: 'One thick stroke per shooter, pierces a lot', wave: 'Wiggles forward',
      shotgun: 'Scatters wide', homing: 'Curves toward nearby fish', trident: 'Pierces many fish' },
    sname: { green: 'Sumi ink', olive: 'Pine needle', sky: 'Indigo', pink: 'Enji red', gold: 'Kincha', snow: 'Silver gray',
      violet: 'Edo purple', crimson: 'Vermilion', shadow: 'Lacquer black', neon: 'Celadon',
      tobi: 'Kite brown', kon: 'Navy', moegi: 'Onion green', kuri: 'Chestnut', ebicha: 'Ebicha maroon', rurikon: 'Lapis navy', yamabuki: 'Yamabuki gold', kokiake: 'Deep scarlet', kindei: 'Gold paint', shinku: 'Crimson' },
    tut: [
      'Drag anywhere to move the croc left and right',
      'Shoot the fish on the left to eat them.\nMiss them and your belly gauge drops — empty means starving',
      'Each shot improves a gate by 1.\nKeep shooting a negative and it turns positive',
      'A gate takes effect when you pass through it.\nMove under the one you want',
      'Break dashed items to get them.\nRun into an unbroken one and you lose (you have 1 life)',
      'LIFE and WEAPON gates show up only now and then.\nGo as far as you can!',
    ],
    help: [
      ['Move', 'Drag anywhere to move the croc. Shots fly straight up'],
      ['Left: food', 'Shoot fish to eat them. Missed fish drain the belly gauge; empty = starved'],
      ['Right: gates', 'Each shot improves the number by 1. Pass through to change DMG / RATE / LINE / CREW; skip it and nothing happens'],
      ['Items', 'Break dashed boxes to get them. Run into an unbroken one: -1 life (0 = game over). You can dodge'],
      ['Life / weapon', 'Rare gates. Pass a weapon gate to add that attack as 2 extra outer shots (your weapon stays; stacks). Shooting it cycles what is inside'],
      ['Boss', 'A big fish ends every stage and attacks with bubbles, charges, ink and more. Get hit or let it reach the bottom and you lose'],
      ['Goal', 'Stage 10 = GAME CLEAR. Beyond it is ∞ COIN RUSH: every clear snowballs your coins'],
      ['Coins & pearls', 'Distance becomes coins for upgrading gear. First-time stage clears give pearls for the weapon / skin gacha'],
    ],
  },
};
const L = () => I18N[OPT.lang] || I18N.ja;

// ---------- 数の表記 ----------
// 日本語の大きな数の単位（4桁ごと）。1e48 の「極」まで
const JA_UNITS = ['万', '億', '兆', '京', '垓', '秭', '穣', '溝', '澗', '正', '載', '極'];
function fmtJa(n) {
  if (n < 1e4) return Number.isInteger(n) ? String(n) : n.toFixed(n < 10 ? 1 : 0).replace(/\.0$/, '');
  const e = Math.floor(Math.log10(n) / 4);
  if (e - 1 < JA_UNITS.length) { const v = n / Math.pow(1e4, e); return (v < 100 ? v.toFixed(1).replace(/\.0$/, '') : Math.floor(v)) + JA_UNITS[e - 1]; }
  return n.toExponential(2).replace('+', '');
}
function fmt(n) {
  if (!isFinite(n)) return '∞';
  if (typeof OPT !== 'undefined' && OPT.lang === 'ja') return fmtJa(n);
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
// ---------- キャラ絵（ink.js の墨絵 SVG）を、一度だけ画像にして使い回す ----------
// 読み込みが終わるまでは古いドット絵で描く
const imgCache = new Map();
function artImg(key, make, w, h) {
  let e = imgCache.get(key);
  if (!e) {
    e = { cv: null };
    imgCache.set(key, e);
    const im = new Image();
    im.onload = () => {
      const c = document.createElement('canvas');
      c.width = Math.ceil(w * 2); c.height = Math.ceil(h * 2);   // 2倍で描いておき、縮めて使う（くっきり）
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      e.cv = c;
    };
    im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(make());
  }
  return e.cv;
}
const lighten = (hex, k = 0.55) => { const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255, f = v => Math.round(v + (255 - v) * k).toString(16).padStart(2, '0'); return '#' + f(r) + f(g) + f(b); };
const skinInk = id => skinOf(id).ink;
const skinIconURL = id => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(Ink.croc(0, 'normal', skinInk(id)));
const HERO_W = 40, HERO_H = 67, HELP_W = 26, HELP_H = 43, FISH_W = 18, FISH_H = 25;
const heroImg = (f, mood, small) => artImg(`croc:${SLOT.skin}:${f}:${mood}:${small ? 1 : 0}`, () => Ink.croc(f, mood, skinInk(SLOT.skin)), small ? HELP_W : HERO_W, small ? HELP_H : HERO_H);
const fishImg = (k, f, gold) => artImg(`fish:${gold ? 'g' : 'n'}:${f}`, () => Ink.fish(f, gold), FISH_W, FISH_H);
const bossSize = big => (big ? 156 : 120);
const bossImg = (art, f, mood, big) => artImg(`boss:${art}:${f}:${mood}:${big ? 1 : 0}`, () => Ink.boss(art, f, mood), bossSize(big), bossSize(big));
const bossName = art => Ink.BOSS_NAME[OPT.lang === 'ja' ? 'ja' : 'en'][art] || '';
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
  r.st.rate = wRate(wd, lv) + Math.floor(skinBonus('rate')); r.st.lines = wd.lines; r.st.dmg = wDmg(wd, lv) * (1 + skinBonus('dmg')); r.st.wp = wd.pat; r.st.subs = {};
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
const crewCap = () => Math.max(baseOf('crew'), Math.min(CMAX, 1 + Math.floor(pOf() * 19)));
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
  const subs = R.st.subs || {}, choices = WEAPONS.filter(w => w !== R.st.wp && (subs[w] || 0) < SUB_MAX);
  if (!choices.length) return makeGate(slot, false);
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
  if (o.stat === 'weapon') return '+' + L().wp[o.v];
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
    if (o.c >= 12) { o.c = 0; const subs = R.st.subs || {}; for (let t = 0; t < WEAPONS.length; t++) { o.v = WEAPONS[(WEAPONS.indexOf(o.v) + 1) % WEAPONS.length]; if (o.v !== R.st.wp && (subs[o.v] || 0) < SUB_MAX) break; } }
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
    st.subs = st.subs || {};
    st.subs[o.v] = Math.min(SUB_MAX, (st.subs[o.v] || 0) + 1);
    pop(R.x, PY - 50, `+${L().wp[o.v]}`, true, '#66e6ff'); burst(o.x + o.w / 2, PY, 14, '#66e6ff'); sfx('gate');
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
  if (!good) { R.hurt = 0.3; sfx('hurt'); } else { sfx('gate'); R.happy = 0.9; }
}
function breakItem(o) {
  R.happy = 1;
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
// 本編は やさしい変化 → きつい変化 の順。11 から先は順番に回す
const MOD_ORDER = ['golden', 'rush', 'school', 'minus', 'current', 'dark', 'school', 'rush', 'current'];
function modOf(n) { if (n <= 1) return 'normal'; return n <= STAGES ? MOD_ORDER[n - 2] : MODS[(n * 5 + 3) % MODS.length]; }
const mod = () => (R ? R.mod || 'normal' : 'normal');
function curSpeed() { return Math.min(SPEED_CAP * 1.2, stageSpeed(R.stage) * (mod() === 'current' ? 1.25 : 1)); }
function enterStage(n) {
  R.mod = modOf(n);
  R.banner = { kind: 'stage', text: L().stageName(n), t: 2.4, sub: L().mods[R.mod] };
}

// ---------- ボス：攻撃してくる ----------
// plain：何もしない / bubble：泡を撃つ / charge：突進 / summon：魚を呼ぶ / ink：墨でゲートを隠す。大ボスは2つ組み合わせ
// ボスは10種類（ink.js）。ステージ n のボスは n 番目。11 から先は順番にまた出て、攻撃が1つ増える
const BOSS_ATTACK = { puffer: ['bubble'], jelly: ['summon'], octo: ['ink'], crab: ['bubble'], marlin: ['charge'],
  squid: ['ink', 'summon'], eel: ['bubble'], shark: ['charge'], manta: ['bubble'], umibozu: ['bubble', 'charge'] };
const EXTRA = ['bubble', 'charge', 'summon', 'ink'];
const bossArtOf = k => (k - 1) % Ink.BOSS_IDS.length;
function bossKinds(k, big) {
  if (k <= 1) return ['plain'];   // 最初のボスは攻撃しない（慣れるため）
  const kinds = [...BOSS_ATTACK[Ink.BOSS_IDS[bossArtOf(k)]]];
  if (k > STAGES) { const x = EXTRA[k % EXTRA.length]; if (!kinds.includes(x)) kinds.push(x); }
  return kinds;
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
      for (let i = 0, n = Math.round(3 * lvl); i < n; i++) R.mobs.push({ x: ZX0 + Math.floor(Math.random() * ZSLOTS) * ZDX, y: bo.y + rnd(-10, 20), k: 2, ph: Math.random() * 6.28, d: 0 });
      bo.cd[kind] = 4 / lvl;
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
  R.boss = { k, big, art: bossArtOf(k), hp: max, max, x: MID, y: -80, ph: Math.random() * 6, startM: R.m, hit: 0, kinds: bossKinds(k, big), cd: { bubble: 1.5, charge: 3, summon: 1, ink: 2 } };
  R.fightKills = 0;
  R.banner = { text: L().appears(bossName(R.boss.art)), t: 2.2, red: true, sub: R.boss.kinds.map(x => L().attacks[x]).filter(Boolean).join('・') };
  sfx('boss');
}
function killBoss() {
  const b = R.boss;
  R.deadBoss = { art: b.art, big: b.big, x: b.x, y: b.y, t: 1.4 };
  R.happy = 1.6;
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
  if (b.k === STAGES && !R.cleared) { R.cleared = true; R.banner = { text: L().gameClear, t: 4, sub: L().coinRushSub }; R.mod = modOf(R.stage); }
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
function shooterX(si) {   // 0 が自分、1〜7 は左右に並ぶ仲間、8 以降は後ろの列（前の列のすき間）
  if (si === 0) return R.x;
  if (si <= 7) { const i = si - 1; return clamp(R.x + (i % 2 ? 1 : -1) * (26 + Math.floor(i / 2) * 20), 8, W - 8); }
  const i = si - 8;
  return clamp(R.x + (i % 2 ? 1 : -1) * (16 + Math.floor(i / 2) * 20), 8, W - 8);
}
const shooterBack = si => si >= 8;
function nearestFood(x) {
  let best = null, bd = 1e9;
  for (const mo of R.mobs) { if (mo.d || mo.y > PY - 40) continue; const d = Math.abs(mo.x - x) + (PY - mo.y) * 0.3; if (d < bd) { bd = d; best = mo; } }
  return best;
}
function volley() {
  const st = R.st, wp = st.wp || 'normal', total = st.lines * st.crew;
  const shooters = Math.min(st.crew, CMAX);
  if (wp === 'beam') {
    // ビーム：1人1本。段数ぶんの威力をまとめ、たくさん貫く
    for (let si = 0; si < shooters; si++) {
      const w = total / shooters;
      R.b.push({ x: shooterX(si), y: PY - 14, vx: 0, vy: -BULLET_V * 1.3, d: st.dmg * w, w, pr: PIERCE_MAX * 4, beam: 1, bn: 0 });
    }
    subVolley(st, 1);
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
  subVolley(st, per);
}
// 武器の札で加わった撃ち方：自分の外側に左右1本ずつ（段ごとに外へ）
function subVolley(st, per) {
  const subs = st.subs || {};
  const w = Math.max(1, st.lines * st.crew / 6), pr = Math.min(PIERCE_MAX, 2 + Math.floor(Math.log10(Math.max(1, st.dmg))));
  let ring = 0;
  for (const pat of WEAPONS) {
    for (let j = 0; j < (subs[pat] || 0); j++, ring++) {
      for (const side of [-1, 1]) {
        const x = clamp(R.x + side * (Math.min(per, 9) * 3 + 12 + ring * 9), 4, W - 4);
        let vx = 0, pierce = pr, wave = 0, bn = 0, beam = 0;
        if (pat === 'spread') vx = side * 0.35 * BULLET_V;
        else if (pat === 'shotgun') vx = side * (0.45 + Math.random() * 0.4) * BULLET_V;
        else if (pat === 'bounce') { vx = side * 0.45 * BULLET_V; bn = 3; }
        else if (pat === 'homing') { const t = nearestFood(x); if (t) vx = clamp((t.x - x) / Math.max(40, PY - t.y), -0.6, 0.6) * BULLET_V; }
        else if (pat === 'trident') pierce = pr + 3;
        else if (pat === 'wave') wave = 1;
        else if (pat === 'beam') { beam = 1; pierce = PIERCE_MAX * 2; }
        const vy = -Math.sqrt(BULLET_V * BULLET_V - vx * vx) * (beam ? 1.3 : 1);
        R.b.push({ x, x0: x, y: PY - 10, vx, vy, d: st.dmg * w, w, pr: pierce, bn, wave, beam, ph: ring * 2.1 + side, sub: 1 });
      }
    }
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
      const hw = bo.big ? 66 : 50, hh = bo.big ? 58 : 46;
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
  R.popT -= dt; R.hurt = Math.max(0, R.hurt - dt); R.happy = Math.max(0, (R.happy || 0) - dt);
  if (R.deadBoss) { R.deadBoss.t -= dt; R.deadBoss.y += 60 * dt; if (R.deadBoss.t <= 0) R.deadBoss = null; } R.inv = Math.max(0, (R.inv || 0) - dt); R.hungry = Math.max(0, (R.hungry || 0) - dt);
  for (let i = R.pops.length - 1; i >= 0; i--) { const p = R.pops[i]; p.t -= dt; p.y -= 34 * dt; if (p.t <= 0) R.pops.splice(i, 1); }
  for (let i = R.parts.length - 1; i >= 0; i--) { const p = R.parts[i]; p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.life <= 0) R.parts.splice(i, 1); }
  if (R.banner) { R.banner.t -= dt; if (R.banner.t <= 0) R.banner = null; }

  if (R.food <= 0) { R.food = 0; R.starved = true; gameOver(); }
  else if (R.hp <= 0) gameOver();
}

// 当たった：ハートが1つ減る（0で負け）。直後は少し無敵
function damage() {
  if (R.inv > 0 || R.tut) return;
  R.happy = 0;
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
  $('btnHome').textContent = l.home;
  $('tutSkip').textContent = l.skip;
  $('helpTitle').textContent = l.how;
  $('btnHelpClose').textContent = l.close;
  $('helpBody').innerHTML = l.help.map(([h, d]) => `<div class="help-row"><b>${h}</b><span>${d}</span></div>`).join('');
}

// ---------- ホーム：下のタブで 記録・装備・ホーム・ガチャ・設定 を切り替える ----------
const TABS = ['gear', 'gacha', 'home', 'rec', 'opt'];
let tab = 'home', gearTab = 'weapon', gachaTab = 'weapon', heroTimer = 0;
const crocURL = (skin, f, mood) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(Ink.croc(f, mood, skinInk(skin)));
const bossURL = i => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(Ink.boss(i, 0, 'normal'));
function showMenu() { showTitle(); }
function showHome(t) {
  state = 'menu';
  show('title', false);
  show('result', false); show('pause', false);
  applyStatic();
  show('home', true);
  setTab(t || tab, 0);
}
function setTab(t, dir) {
  const prev = tab; tab = t;
  const l = L();
  $('hNav').querySelectorAll('button').forEach(b => {
    b.classList.toggle('on', b.dataset.tab === t);
    b.querySelector('span').textContent = l.tabs[b.dataset.tab];
  });
  TABS.forEach(k => {
    const el = $('p-' + k);
    el.classList.toggle('on', k === t);
    el.classList.remove('from-l', 'from-r');
  });
  if (dir == null) dir = TABS.indexOf(t) - TABS.indexOf(prev);
  if (dir) { const el = $('p-' + t); void el.offsetWidth; el.classList.add(dir > 0 ? 'from-r' : 'from-l'); }
  $('hTitle').textContent = t === 'home' ? '' : l.tabs[t];
  $('hProf').hidden = t !== 'home';
  $('home').classList.toggle('at-home', t === 'home');
  $('p-' + t).scrollTop = 0;
  renderTab();
}
function renderTab() {
  $('hCoins').textContent = fmt(SLOT.coins);
  $('hAva').src = crocURL(SLOT.skin, 0, 'normal');
  $('hRank').textContent = OPT.lang === 'ja' ? kan(Math.max(1, cleared())) : Math.max(1, cleared());
  $('hName').textContent = L().rankName(cleared());
  $('hBest').textContent = `${L().best} ${fmt(Math.floor(SLOT.best * METER))}${L().meter}`;
  $('hPearls').textContent = fmt(SLOT.pearls);
  // 印：強化できるものがある／ガチャが引ける
  $('dotGear').hidden = !canUpgrade();
  $('dotGacha').hidden = !canPull();
  clearInterval(heroTimer);
  ({ rec: renderRec, gear: renderEquip, home: renderHomePanel, gacha: renderGacha, opt: renderOpt })[tab]();
}
// ホーム：まん中にワニ、左右に機能のアイコン、下の角に大きな丸ボタン、その間にバナー
const canUpgrade = () => WEAPON_DEF.some(w => SLOT.weapons[w.id] && SLOT.weapons[w.id] < WLV_MAX && SLOT.coins >= wUpCost(w, SLOT.weapons[w.id]))
  || SKIN_DEF.some(k => SLOT.skins[k.id] && SLOT.skins[k.id] < SLV_MAX && SLOT.coins >= sUpCost(k, SLOT.skins[k.id]));
const canPull = () => SLOT.pearls >= GACHA_COST || !!SLOT.free.weapon || !!SLOT.free.skin;
const cleared = () => Math.min(SLOT.maxStage, STAGES);
const nextReward = () => (cleared() >= STAGES ? 0 : cleared() + 1 === STAGES ? FIRST_CLEAR.big : FIRST_CLEAR.normal);
// 波（墨の線を何段か）
function wavesSVG(w, h, rows = 5, op = .35) {
  let d = '';
  for (let r = 0; r < rows; r++) {
    const y = 10 + r * (h - 20) / Math.max(1, rows - 1), off = (r % 2) * 22;
    for (let x = -44 + off; x < w + 44; x += 44) d += `M${x} ${y} q11 -9 22 0 q11 9 22 0 `;
  }
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><path d="${d}" fill="none" stroke="#1a1714" stroke-width="1.6" stroke-linecap="round" opacity="${op}"/></svg>`);
}
const fishURL = (f, gold) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(Ink.fish(f, gold));
const fudaURL = neg => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(Ink.fuda(60, 76, neg));
function sceneHTML(big) {
  // 遠くに海坊主の影、波、泳ぐ魚、流れてくる短冊
  const fish = [[8, 30, 0, 0], [22, 44, 1, 0], [74, 36, 2, 1], [86, 52, 3, 0], [14, 60, 2, 0], [64, 58, 0, 0]].map(([x, y, f, g], i) =>
    `<img class="sc-fish" style="left:${x}%;top:${y}%;animation-delay:${-i * .7}s" src="${fishURL(f, !!g)}" alt="">`).join('');
  const tags = big ? `<div class="sc-tag" style="left:70%;top:31%;--r:6deg"><img src="${fudaURL(false)}" alt=""><b>+1</b></div>
    <div class="sc-tag" style="left:12%;top:34%;--r:-5deg"><img src="${fudaURL(true)}" alt=""><b style="color:#c8321e">−2</b></div>` : '';
  return `<img class="sc-yokai" src="${bossURL(9)}" alt=""><img class="sc-wave a" src="${wavesSVG(360, 90, 4, .28)}" alt="">
    <img class="sc-wave b" src="${wavesSVG(360, 120, 5, .18)}" alt="">${fish}${tags}`;
}
function renderHomePanel() {
  const l = L(), done = cleared();
  $('hmScene').innerHTML = sceneHTML(false);
  // 装備中のワニが歩く。さわると喜んでひとこと
  let f = 0; const img = $('hmCroc');
  img.src = crocURL(SLOT.skin, 0, 'normal');
  heroTimer = setInterval(() => { if (!img.dataset.happy) { f = (f + 1) % 4; img.src = crocURL(SLOT.skin, f, 'normal'); } }, 280);
  $('hmCrocBtn').onclick = () => {
    img.dataset.happy = 1; img.src = crocURL(SLOT.skin, 0, 'happy'); sfx('count');
    const lines = l.says(done + 1);
    const say = $('hmSay'); say.textContent = lines[Math.floor(Math.random() * lines.length)]; say.classList.remove('on'); void say.offsetWidth; say.classList.add('on');
    clearTimeout(img._t); img._t = setTimeout(() => { delete img.dataset.happy; }, 1200);
  };
  const w = weaponOf(SLOT.weapon);
  $('hmGear').innerHTML = `<span><small>${l.gWeapon}</small>${l.wname[w.id]}<em>Lv${SLOT.weapons[w.id]}</em></span><span><small>${l.skinTab}</small>${l.sname[SLOT.skin]}<em>Lv${SLOT.skins[SLOT.skin]}</em></span>`;
  // 上：十段の道のり
  $('hmRoad').innerHTML = `<small>${l.road}</small>` + Array.from({ length: STAGES }, (_, i) => {
    const n = i + 1, cls = n <= done ? 'done' : n === done + 1 ? 'next' : '';
    return `<i class="${cls} ${n === STAGES ? 'big' : ''}">${OPT.lang === 'ja' ? kan(n) : n}</i>`;
  }).join('');
  // 左右のアイコン
  const side = (items) => items.map(([act, ic, label, dot]) => `<button class="side-btn" data-act="${act}"><i>${ic}</i><span>${label}</span>${dot ? '<b class="dot"></b>' : ''}</button>`).join('');
  $('sideL').innerHTML = side([['news', '報', l.side.news, OPT.newsSeen !== VERSION], ['road', '道', l.side.road, false], ['how', '習', l.side.how, false]]);
  $('sideR').innerHTML = side([['gacha', '引', l.tabs.gacha, canPull()], ['skin', '墨', l.skinTab, false], ['rec', '巻', l.tabs.rec, false]]);
  document.querySelectorAll('.side-btn').forEach(b => { b.onclick = () => { sfx('gate'); sideAct(b.dataset.act); }; });
  // 下の角：左＝出陣（続きがあれば「続きから」）、右＝強化
  const st = $('btnStart');
  st.querySelector('b').textContent = SLOT.run ? l.contShort : l.go;
  st.querySelector('small').textContent = SLOT.run ? `${fmt(Math.floor(SLOT.run.m * METER))}${l.meter}` : (OPT.lang === 'ja' ? `第${kan(Math.min(done + 1, STAGES))}段へ` : `to stage ${Math.min(done + 1, STAGES)}`);
  $('btnStartNew').hidden = !SLOT.run; $('btnStartNew').textContent = l.fromStart;
  $('btnUp').querySelector('b').textContent = l.up;
  $('btnUp').querySelector('small').textContent = l.tabs.gear;
  $('dotUp').hidden = !canUpgrade();
  renderBanner();
}
function sideAct(act) {
  const l = L();
  if (act === 'gacha' || act === 'rec') return setTab(act);
  if (act === 'skin') { gearTab = 'skin'; return setTab('gear'); }
  if (act === 'how') { applyStatic(); return show('help', true); }
  if (act === 'news') { OPT.newsSeen = VERSION; saveOpt(); renderTab();
    return openInfo(l.side.news, l.news.map(([v, t]) => `<div class="news"><b>${v}</b><span>${t}</span></div>`).join('')); }
  if (act === 'road') {
    const done = cleared();
    return openInfo(l.side.road, `<p class="info-lead">${l.roadLead}</p>` + Array.from({ length: STAGES }, (_, i) => {
      const n = i + 1, p = n === STAGES ? FIRST_CLEAR.big : FIRST_CLEAR.normal;
      return `<div class="road-row ${n <= done ? 'done' : ''}"><span>${OPT.lang === 'ja' ? `第${kan(n)}段` : `Stage ${n}`}　<small>${SLOT.maxStage >= n ? bossName(n - 1) : l.unknown}</small></span>
        <em><i class="ic-pearl"></i>+${p}</em><b>${n <= done ? l.got : ''}</b></div>`;
    }).join(''));
  }
}
function openInfo(title, html) { $('infoTitle').textContent = title; $('infoBody').innerHTML = html; $('btnInfoClose').textContent = L().close; show('info', true); }
// バナー：いま役に立つお知らせを横にめくる
let bnIdx = 0, bnTimer = 0;
function renderBanner() {
  const l = L(), done = cleared(), slides = [];
  if (done < STAGES) slides.push({ go: 'road', img: bossURL(done), k: l.bn.nextK, t: l.bn.next(done + 1, nextReward()) });
  else slides.push({ go: 'road', img: bossURL(9), k: l.bn.nextK, t: l.allClear });
  if (SLOT.free.weapon || SLOT.free.skin) slides.push({ go: 'gacha', img: weaponURL('jaws'), k: l.tabs.gacha, t: l.bn.free });
  slides.push({ go: 'gacha', img: weaponURL('suzuri'), k: l.tabs.gacha, t: l.pity(PITY - Math.max(SLOT.pity.weapon || 0, SLOT.pity.skin || 0)) });
  if (canUpgrade()) slides.push({ go: 'gear', img: crocURL(SLOT.skin, 1, 'normal'), k: l.tabs.gear, t: l.bn.up });
  slides.push({ go: 'rec', img: bossURL(Math.max(0, done - 1)), k: l.tabs.rec, t: l.bn.rec(done) });
  bnIdx %= slides.length;
  $('bnTrack').innerHTML = slides.map(x => `<button class="bn" data-go="${x.go}"><img src="${x.img}" alt=""><span><small>${x.k}</small>${x.t}</span></button>`).join('');
  $('bnDots').innerHTML = slides.map((_, i) => `<i class="${i === bnIdx ? 'on' : ''}"></i>`).join('');
  const move = () => { $('bnTrack').style.transform = `translateX(${-bnIdx * 100}%)`; $('bnDots').querySelectorAll('i').forEach((d, i) => d.classList.toggle('on', i === bnIdx)); };
  move();
  $('bnTrack').querySelectorAll('.bn').forEach(b => { b.onclick = () => { sfx('gate'); const g = b.dataset.go; g === 'road' ? sideAct('road') : setTab(g); }; });
  clearInterval(bnTimer);
  bnTimer = setInterval(() => { if (tab !== 'home' || $('home').hidden) return clearInterval(bnTimer); bnIdx = (bnIdx + 1) % slides.length; move(); }, 3800);
}

// ---------- タイトル：絵巻の一場面。どこかをタップではじめる ----------
let tsTimer = 0;
function showTitle() {
  state = 'menu';
  applyStatic();
  show('home', false);
  const l = L();
  $('tsScene').innerHTML = sceneHTML(true) + `<img class="ts-croc" id="tsCroc" src="${crocURL(SLOT.skin, 0, 'normal')}" alt="">
    <img class="ts-mate l" src="${crocURL('sky', 1, 'normal')}" alt=""><img class="ts-mate r" src="${crocURL('pink', 3, 'happy')}" alt="">`;
  $('tsVer').textContent = l.version(VERSION);
  $('tsTap').textContent = l.tapStart;
  let f = 0;
  clearInterval(tsTimer); tsTimer = setInterval(() => { f = (f + 1) % 4; const c = $('tsCroc'); if (c) c.src = crocURL(SLOT.skin, f, 'normal'); }, 300);
  show('title', true);
}
function leaveTitle(t) { clearInterval(tsTimer); show('title', false); sfx('go'); showHome(t || 'home'); }
function renderRec() {
  const l = L();
  $('recStats').innerHTML = [[l.recStat.best, `${fmt(Math.floor(SLOT.best * METER))}<small>${l.meter}</small>`],
    [l.recStat.runs, fmt(SLOT.runs)], [l.recStat.stage, `${Math.min(SLOT.maxStage, STAGES)}<small>/${STAGES}</small>`]]
    .map(([k, v]) => `<div><small>${k}</small><b>${v}</b></div>`).join('');
  $('recHead').textContent = l.yokai;
  $('recYokai').innerHTML = Ink.BOSS_IDS.map((id, i) => {
    const met = SLOT.maxStage >= i + 1, atk = (BOSS_ATTACK[id] || []).map(x => l.attacks[x]).join('・');
    return `<div class="yk ${met ? '' : 'lock'} ${i === 9 ? 'big' : ''}"><div class="yk-n">${OPT.lang === 'ja' ? '第' + kan(i + 1) + '段' : 'STAGE ' + (i + 1)}</div>
      <img src="${bossURL(i)}" alt=""><b>${met ? bossName(i) : l.unknown}</b><small>${met ? l.bossDesc[i] : l.notMet}</small>${met && i > 0 ? `<em>${atk}</em>` : ''}</div>`;
  }).join('');
}
function renderOpt() {
  const l = L();
  const seg = (id, a, b, on) => `<div class="seg mini no-swipe" id="${id}"><button class="${on ? 'on' : ''}">${a}</button><button class="${on ? '' : 'on'}">${b}</button></div>`;
  $('optList').innerHTML = `
    <div class="opt-row"><span>${l.opt.lang}</span>${seg('optLang', '日本語', 'English', OPT.lang === 'ja')}</div>
    <div class="opt-row"><span>${l.opt.sound}</span>${seg('optSound', 'ON', 'OFF', OPT.sound)}</div>
    <div class="opt-row"><span>${l.opt.light}</span>${seg('optLight', 'ON', 'OFF', OPT.light)}</div>
    <button class="opt-row link" id="optHow"><span>${l.opt.how}</span><em>${l.opt.open} ›</em></button>`;
  $('optFoot').innerHTML = `GATE VADER　${l.version(VERSION)}<br>A GAME BY MASU01`;
  const bind = (id, fn) => $(id).querySelectorAll('button').forEach((b, i) => { b.onclick = () => { fn(i === 0); saveOpt(); sfx('gate'); showHome('opt'); }; });
  bind('optLang', v => { OPT.lang = v ? 'ja' : 'en'; });
  bind('optSound', v => { OPT.sound = v; });
  bind('optLight', v => { OPT.light = v; OPT.lightAsked = true; resize(); });
  $('optHow').onclick = () => { applyStatic(); show('help', true); };
}

// ---------- ガチャ（武器 / 墨の色） ----------
function rollRarity() {
  let r = Math.random() * 100;
  for (const k of ['SSR', 'SR', 'R', 'N']) { r -= RARITY[k].w; if (r < 0) return k; }
  return 'N';
}
const STARS = { N: 1, R: 2, SR: 3, SSR: 4 };
const wURLc = {};
const weaponURL = id => wURLc[id] || (wURLc[id] = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(Ink.weapon(id)));
const itemPic = (kind, id, mood) => (kind === 'weapon' ? weaponURL(id) : crocURL(id, 0, mood || 'normal'));
const itemName = (kind, id) => (kind === 'weapon' ? L().wname[id] : L().sname[id]);
const itemInfo = (kind, x, lv = 1) => {
  const l = L();
  return kind === 'weapon' ? `${l.wp[x.pat]}：${l.wdesc[x.pat]}<br>${l.stat.rate} ${wRate(x, lv)}　${l.stat.lines} ${x.lines}　${l.stat.dmg} ${fmt(Math.round(wDmg(x, lv) * 10) / 10)}`
    : `${l.pas[x.pas](x.v * lv)}<br>${l.skinNote}`;
};
const itemRate = (kind, x) => RARITY[x.r].w / (kind === 'weapon' ? WEAPON_DEF : SKIN_DEF).filter(y => y.r === x.r).length;
function pullOne(kind, minR) {
  SLOT.pity[kind] = (SLOT.pity[kind] || 0) + 1;
  let rar = rollRarity();
  if (minR === 'SR' && (rar === 'N' || rar === 'R')) rar = 'SR';
  if (SLOT.pity[kind] >= PITY) rar = 'SSR';   // 天井
  if (rar === 'SSR') SLOT.pity[kind] = 0;
  const pool = (kind === 'weapon' ? WEAPON_DEF : SKIN_DEF).filter(x => x.r === rar);
  const got = pool[Math.floor(Math.random() * pool.length)];
  const owned = kind === 'weapon' ? SLOT.weapons : SLOT.skins;
  let isNew = false, dup = 0;
  if (!owned[got.id]) { owned[got.id] = 1; isNew = true; } else { dup = DUP_COINS[rar]; SLOT.coins += dup; }
  return { x: got, rar, isNew, dup };
}
// n=1 または 10。各ガチャの最初の1回は無料。10連は SR 以上が1つ確定
function pull(kind, n = 1) {
  const free = n === 1 && SLOT.free[kind];
  const cost = free ? 0 : GACHA_COST * n;
  if (SLOT.pearls < cost) return;
  SLOT.pearls -= cost; if (free) SLOT.free[kind] = 0;
  const res = [];
  for (let i = 0; i < n; i++) res.push(pullOne(kind, n === 10 && i === 9 && !res.some(r => r.rar === 'SR' || r.rar === 'SSR') ? 'SR' : null));
  writeSlot();
  const top = res.some(r => r.rar === 'SSR' || r.rar === 'SR');
  sfx(top ? 'boss' : 'gate');
  const l = L();
  const card = (r, i) => `<div class="gr-card r-${r.rar}" style="--rc:${RARITY[r.rar].col};--i:${i}"><i>${r.rar}</i><img src="${itemPic(kind, r.x.id, 'happy')}" alt="">
    <b>${itemName(kind, r.x.id)}</b><small>${r.isNew ? l.gNew : l.gDup(r.dup)}</small></div>`;
  openInfo(l.gResult, `<div class="gr-grid n${n}">${res.map(card).join('')}</div>`);
  renderTab();
}
let pickIdx = 0, pickTimer = 0;
function openLineup(kind) {
  const l = L(), list = kind === 'weapon' ? WEAPON_DEF : SKIN_DEF;
  const owned = kind === 'weapon' ? SLOT.weapons : SLOT.skins;
  openInfo(l.lineup, `<p class="info-lead">${l.lineupLead}</p>` + ['SSR', 'SR', 'R', 'N'].map(r => `<div class="lu-head" style="--rc:${RARITY[r].col}">${r}　${'★'.repeat(STARS[r])}<small>${RARITY[r].w}%</small></div>` +
    list.filter(x => x.r === r).map(x => `<div class="lu-row" style="--rc:${RARITY[r].col}"><img src="${itemPic(kind, x.id)}" alt="">
      <span><b>${itemName(kind, x.id)}${owned[x.id] ? `<em>${l.owned}</em>` : ''}</b><small>${itemInfo(kind, x)}</small></span><i>${itemRate(kind, x).toFixed(2)}%</i></div>`).join('')).join(''));
}
function renderSeg(id, cur, fn) {
  const l = L();
  $(id).querySelectorAll('button').forEach(b => {
    b.textContent = b.dataset.k === 'weapon' ? l.gWeapon : l.skinTab;
    b.classList.toggle('on', b.dataset.k === cur);
    b.onclick = () => { fn(b.dataset.k); sfx('gate'); };
  });
}
function renderGacha() {
  const l = L(), kind = gachaTab, list = kind === 'weapon' ? WEAPON_DEF : SKIN_DEF;
  const owned = kind === 'weapon' ? SLOT.weapons : SLOT.skins;
  renderSeg('gachaSeg', kind, k => { gachaTab = k; pickIdx = 0; renderGacha(); });
  $('gachaTitle').textContent = kind === 'weapon' ? l.gTitleW : l.gTitleS;
  // 注目（SSR と SR を順に見せる）：絵・名前・レア度・撃ち方や効果
  const picks = list.filter(x => x.r === 'SSR').concat(list.filter(x => x.r === 'SR'));
  const showPick = () => {
    const x = picks[pickIdx % picks.length];
    $('gachaPick').innerHTML = `<div class="gp-tag">${l.pickup}</div>
      <div class="gp-head" style="--rc:${RARITY[x.r].col}"><i>${x.r}</i><span>${'★'.repeat(STARS[x.r])}</span><b>${itemName(kind, x.id)}</b>${owned[x.id] ? `<em>${l.owned}</em>` : ''}</div>
      <div class="gp-art"><img src="${itemPic(kind, x.id, 'happy')}" alt=""></div>
      <div class="gp-info"><small>${kind === 'weapon' ? l.gWeapon : l.skinTab}</small><span>${itemInfo(kind, x)}</span></div>
      <button class="gp-nav l no-swipe" data-d="-1">‹</button><button class="gp-nav r no-swipe" data-d="1">›</button>
      <div class="gp-dots">${picks.map((_, i) => `<i class="${i === pickIdx % picks.length ? 'on' : ''}"></i>`).join('')}</div>`;
    $('gachaPick').querySelectorAll('.gp-nav').forEach(b => { b.onclick = e => { e.stopPropagation(); pickIdx = (pickIdx + picks.length + +b.dataset.d) % picks.length; showPick(); restart(); }; });
  };
  const restart = () => { clearInterval(pickTimer); pickTimer = setInterval(() => { if (tab !== 'gacha' || $('home').hidden) return clearInterval(pickTimer); pickIdx = (pickIdx + 1) % picks.length; showPick(); }, 3600); };
  showPick(); restart();
  $('btnLineup').textContent = l.lineup;
  $('btnLineup').onclick = () => { sfx('gate'); openLineup(kind); };
  $('gachaPity').innerHTML = `${l.pity(PITY - (SLOT.pity[kind] || 0))}`;
  const free = SLOT.free[kind];
  $('btnPull').innerHTML = free ? `${l.pull1}<span class="free">${l.freeOnce}</span>` : `${l.pull1}<span><i class="ic-pearl"></i>${GACHA_COST}</span>`;
  $('btnPull').disabled = !free && SLOT.pearls < GACHA_COST;
  $('btnPull10').innerHTML = `${l.pull10}<span><i class="ic-pearl"></i>${GACHA_COST * 10}</span><small>${l.srSure}</small>`;
  $('btnPull10').disabled = SLOT.pearls < GACHA_COST * 10;
  $('gachaRates').textContent = `SSR 2%　SR 10%　R 28%　N 60%`;
  $('gachaHow').textContent = l.pearlHow;
  $('gachaListHead').textContent = `${l.collection}　${list.filter(x => owned[x.id]).length} / ${list.length}`;
  $('gachaList').innerHTML = list.map(x => {
    const own = owned[x.id];
    return `<div class="g-tile ${own ? 'own' : ''}" style="--rc:${RARITY[x.r].col}"><i>${x.r}</i><img src="${itemPic(kind, x.id)}" alt=""><span>${itemName(kind, x.id)}</span><small>${own ? `Lv${own}` : l.notOwned}</small></div>`;
  }).join('');
}

// ---------- 装備・強化 ----------
function renderEquip() {
  const l = L(), isW = gearTab === 'weapon';
  renderSeg('gearSeg', gearTab, k => { gearTab = k; renderEquip(); });
  // いま装備しているもの
  const w = weaponOf(SLOT.weapon), wl = SLOT.weapons[w.id], sk = skinOf(SLOT.skin), sl = SLOT.skins[sk.id];
  $('gearNow').innerHTML = `<img class="${isW ? 'wimg' : ''}" src="${isW ? weaponURL(w.id) : crocURL(SLOT.skin, 0, 'normal')}" alt="">
    <div><small>${l.equipped}</small><b>${isW ? l.wname[w.id] : l.sname[sk.id]} <em>Lv${isW ? wl : sl}</em></b>
    <span>${isW ? `${l.wp[w.pat]}：${l.wdesc[w.pat]}<br>${l.stat.rate} ${wRate(w, wl)}　${l.stat.lines} ${w.lines}　${l.stat.dmg} ${fmt(Math.round(wDmg(w, wl) * 10) / 10)}` : l.pas[sk.pas](sk.v * sl)}</span></div>`;
  const rows = isW ? WEAPON_DEF.filter(x => SLOT.weapons[x.id]).map(x => {
    const lv = SLOT.weapons[x.id], max = lv >= WLV_MAX, cost = wUpCost(x, lv);
    return { id: x.id, r: x.r, on: SLOT.weapon === x.id, lv, max, cost, name: l.wname[x.id], pic: `<img class="eq-wimg" src="${weaponURL(x.id)}" alt="">`,
      stat: `${l.stat.rate} ${wRate(x, lv)}　${l.stat.lines} ${x.lines}　${l.stat.dmg} ${fmt(Math.round(wDmg(x, lv) * 10) / 10)}` };
  }) : SKIN_DEF.filter(x => SLOT.skins[x.id]).map(x => {
    const lv = SLOT.skins[x.id], max = lv >= SLV_MAX, cost = sUpCost(x, lv);
    return { id: x.id, r: x.r, on: SLOT.skin === x.id, lv, max, cost, name: l.sname[x.id], pic: `<img src="${crocURL(x.id, 0, 'normal')}" alt="">`, stat: l.pas[x.pas](x.v * lv) };
  });
  $('gearList').innerHTML = rows.map(x => `<div class="eq-row ${x.on ? 'on' : ''}" style="--rc:${RARITY[x.r].col}">
      <button class="eq-pick" data-id="${x.id}">${x.pic}<span><span class="eq-name"><i>${x.r}</i>${x.name}<small>Lv${x.lv}</small></span><span class="eq-stat">${x.stat}</span></span>${x.on ? `<b class="eq-on">${l.equipped}</b>` : ''}</button>
      <button class="eq-up" data-up="${x.id}" ${x.max || SLOT.coins < x.cost ? 'disabled' : ''}>${x.max ? 'MAX' : `${l.up}<small><i class="ic-zeni"></i>${fmt(x.cost)}</small>`}</button></div>`).join('');
  $('gearList').querySelectorAll('[data-id]').forEach(b => { b.onclick = () => {
    if (isW) SLOT.weapon = b.dataset.id; else SLOT.skin = b.dataset.id;
    writeSlot(); sfx('gate'); renderTab(); }; });
  $('gearList').querySelectorAll('[data-up]').forEach(b => { b.onclick = () => {
    const id = b.dataset.up;
    if (isW) { const x = weaponOf(id), lv = SLOT.weapons[id], cost = wUpCost(x, lv); if (lv >= WLV_MAX || SLOT.coins < cost) return; SLOT.coins -= cost; SLOT.weapons[id] = lv + 1; }
    else { const x = skinOf(id), lv = SLOT.skins[id], cost = sUpCost(x, lv); if (lv >= SLV_MAX || SLOT.coins < cost) return; SLOT.coins -= cost; SLOT.skins[id] = lv + 1; }
    writeSlot(); sfx('boss'); renderTab(); }; });
}
function preloadArt() {
  for (let f = 0; f < 4; f++) for (const m of ['normal', 'happy', 'hurt']) { heroImg(f, m, false); heroImg(f, m, true); }
  for (let k = 0; k < 3; k++) for (let f = 0; f < 4; f++) fishImg(k, f, false);
  for (let f = 0; f < 4; f++) fishImg(0, f, true);
  for (let i = 0; i < Ink.BOSS_IDS.length; i++) for (const m of ['normal', 'hurt', 'dead']) for (let f = 0; f < 2; f++) bossImg(i, f, m, i === 9);
  washiImg(); fudaImg(true); fudaImg(false);
}
function startRun(resume) {
  preloadArt();
  clearInterval(heroTimer); clearInterval(tsTimer); show('title', false); show('info', false); show('home', false); show('result', false); show('pause', false); show('help', false);
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
  const pm = Math.floor(m * METER / PEARL_PER_M);   // 進んだ距離の真珠（600米ごとに1）
  SLOT.pearls += pm; R.pearls = (R.pearls || 0) + pm;
  SLOT.run = null; writeSlot();
  sfx('hurt');
  const l = L();
  tutHide();
  $('resTitle').textContent = R.starved ? l.starved : l.over;
  $('resM').innerHTML = `${fmt(Math.floor(m * METER))}<small>${l.meter}</small>`;
  $('resSub').textContent = (R.newBest ? l.newBest + '　' : `${l.best} ${fmt(Math.floor(SLOT.best * METER))}${l.meter}　·　`) + `${R.cleared ? l.gameClear + '　·　' : ''}${l.eaten(R.kills)}`;
  $('resCoins').innerHTML = `<span><i class="ic-zeni"></i>+${fmt(gain)}</span>` + (R.pearls ? `<span><i class="ic-pearl"></i>+${fmt(R.pearls)}</span>` : '');
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

$('btnStart').onclick = () => startRun(!!SLOT.run);
$('btnStartNew').onclick = () => startRun(false);
$('btnUp').onclick = () => { sfx('gate'); gearTab = 'weapon'; setTab('gear'); };
$('btnInfoClose').onclick = () => show('info', false);
$('title').onclick = e => { if (!e.target.closest('#tsMenu')) leaveTitle(); };
$('tsMenu').onclick = () => leaveTitle('opt');
document.querySelectorAll('.plus').forEach(b => { b.onclick = () => { sfx('gate'); toast(b.dataset.plus === 'coin' ? L().plusCoin : L().plusPearl, 3200); }; });
$('btnPull').onclick = () => pull(gachaTab, 1);
$('btnPull10').onclick = () => pull(gachaTab, 10);
$('btnResume').onclick = resumeGame;
$('btnQuit').onclick = () => { persist(); tutHide(); showHome('home'); };
$('btnRetry').onclick = () => startRun(false);
$('btnHome').onclick = () => showHome('home');
$('btnHelpClose').onclick = () => show('help', false);
$('tutSkip').onclick = e => { e.stopPropagation(); if (R && R.tut) tutEnd(); };
$('hNav').querySelectorAll('button').forEach(b => { b.onclick = () => { if (b.dataset.tab !== tab) { sfx('gate'); setTab(b.dataset.tab); } }; });
// 左右スワイプでタブを移る（切り替えボタンの上は除く）
(() => {
  let sx = 0, sy = 0, on = false;
  const P = $('hPanels');
  P.addEventListener('pointerdown', e => { on = !e.target.closest('.no-swipe'); sx = e.clientX; sy = e.clientY; });
  P.addEventListener('pointerup', e => {
    if (!on) return; on = false;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.6) return;
    const i = TABS.indexOf(tab) + (dx < 0 ? 1 : -1);
    if (i >= 0 && i < TABS.length) { sfx('gate'); setTab(TABS[i]); }
  });
  P.addEventListener('pointercancel', () => { on = false; });
})();

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

// 和紙と掛軸：背景の紙は一度だけ描いておく。進んでいる感じは、うすい墨の波で出す
const SUMI = Ink.SUMI, SHU = Ink.SHU, AI = '#1f3a5a', PAPER = Ink.PAPER;
const FONT = '"Yuji Syuku", "Noto Serif JP", serif';
const BRUSH = '"Yuji Boku", "Yuji Syuku", serif';
const washiImg = () => artImg('washi', () => Ink.washi(W, H), W, H);
const fudaImg = neg => artImg('fuda:' + (neg ? 1 : 0), () => Ink.fuda(GATE_W, GATE_H, neg), GATE_W, GATE_H);
let starY = 0;
// 以前のネオン色で渡された色を、墨・朱・藍に読み替える
function inkCol(c) {
  if (!c) return SUMI;
  if (/^#(ff5a5a|ff4d4d|ff4d6d|ff8da1|ff6a5a|e0664a|ffd84a|ffc6f0|b8ffd2|ff7fa2)$/i.test(c)) return SHU;
  if (/^#(66e6ff|39a0ff)$/i.test(c)) return AI;
  return SUMI;
}
// 筆（Yuji Boku）の数字・英字はくずれて読みにくいので、数字や英字を含むときは楷書寄りの書体にする
function text(t, x, y, size, col, align = 'left', brush = false) {
  ctx.font = `${size}px ${brush && !/[0-9A-Za-z]/.test(t) ? BRUSH : FONT}`; ctx.textAlign = align; ctx.fillStyle = col; ctx.fillText(t, x, y);
}
// 縦書き（右の列から左へ）。絵巻の詞書のように
function vtext(lines, xRight, yTop, size, col, gap = 1.25) {
  ctx.font = `${size}px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = col;
  lines.forEach((ln, c) => [...ln].forEach((ch, i) => ctx.fillText(ch, xRight - c * size * gap, yTop + (i + 1) * size * 1.05)));
}
function inkWaves(now) {
  if (OPT.light) return;
  ctx.strokeStyle = SUMI; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    const y = ((i * 83 + starY * 0.9) % (H + 60)) - 30, x0 = (i * 131) % (W - 60);
    ctx.globalAlpha = 0.07;
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.quadraticCurveTo(x0 + 14, y - 8, x0 + 28, y); ctx.quadraticCurveTo(x0 + 42, y + 8, x0 + 56, y); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
function kakejiku() {
  // 上：八双（細い横木）／下：軸木と軸先
  ctx.fillStyle = '#3a2414'; ctx.fillRect(0, 0, W, 4);
  const g = ctx.createLinearGradient(0, H - 10, 0, H); g.addColorStop(0, '#6a4428'); g.addColorStop(.5, '#9a6a40'); g.addColorStop(1, '#3a2414');
  ctx.fillStyle = g; ctx.fillRect(0, H - 10, W, 10);
  ctx.fillStyle = '#2a1a0e'; ctx.fillRect(0, H - 11, 6, 11); ctx.fillRect(W - 6, H - 11, 6, 11);
}

function render(now) {
  ctx.setTransform(kScale, 0, 0, kScale, 0, 0);
  ctx.imageSmoothingEnabled = true;
  const wimg = washiImg();
  if (wimg) ctx.drawImage(wimg, 0, 0, W, H); else { ctx.fillStyle = '#efe7d4'; ctx.fillRect(0, 0, W, H); }
  inkWaves(now);
  if (!R) { kakejiku(); return; }

  // 左右の境：うすい墨の点線
  ctx.fillStyle = 'rgba(26,23,20,.035)'; ctx.fillRect(MID, 0, MID, PY);
  ctx.strokeStyle = 'rgba(26,23,20,.22)'; ctx.lineWidth = 1.5; ctx.setLineDash([8, 8]);
  ctx.beginPath(); ctx.moveTo(MID, 90); ctx.lineTo(MID, PY); ctx.stroke(); ctx.setLineDash([]);
  ctx.strokeStyle = 'rgba(26,23,20,.25)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(8, PY + 16); ctx.quadraticCurveTo(W / 2, PY + 10, W - 8, PY + 16); ctx.stroke();

  // 魚
  for (const mo of R.mobs) {
    const sf = (Math.floor(now / 110 + mo.ph * 2)) % 4;
    const art = fishImg(mo.k, sf, mo.gold);
    const sx = mo.x + Math.sin(now / 420 + mo.ph) * 2;
    if (art) ctx.drawImage(art, Math.round(sx - FISH_W / 2), Math.round(mo.y - FISH_H / 2), FISH_W, FISH_H);
    else { ctx.fillStyle = mo.gold ? SHU : SUMI; ctx.beginPath(); ctx.ellipse(sx, mo.y, 5, 8, 0, 0, 6.283); ctx.fill(); }
  }

  // 札（ゲート）と、壊せる箱
  for (const o of R.objs) {
    if (o.y < -o.h || o.dead) continue;
    const neg = o.cls === 'gate' && !isGood(o);
    const fi = fudaImg(neg || (o.cls === 'item'));
    if (fi) ctx.drawImage(fi, o.x, o.y, o.w, o.h); else { ctx.fillStyle = PAPER; ctx.fillRect(o.x, o.y, o.w, o.h); }
    if (o.hit > 0) { ctx.fillStyle = SUMI; ctx.globalAlpha = Math.min(.25, o.hit * 2); ctx.fillRect(o.x + 3, o.y + 3, o.w - 6, o.h - 6); ctx.globalAlpha = 1; }
    if (o.cls === 'gate') {
      const col = neg ? SHU : o.stat === 'weapon' ? AI : o.stat === 'life' ? SHU : SUMI;
      text(L().stat[o.stat], o.x + o.w / 2, o.y + 15, 12, col, 'center');
      text(gateLabel(o), o.x + o.w / 2, o.y + 38, o.stat === 'weapon' ? 16 : 21, col, 'center', true);
    } else {
      ctx.strokeStyle = SHU; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]); ctx.strokeRect(o.x + 6, o.y + 6, o.w - 12, o.h - 12); ctx.setLineDash([]);
      text(L().item[o.kind], o.x + o.w / 2, o.y + 21, 14, SHU, 'center', true);
      ctx.strokeStyle = SUMI; ctx.lineWidth = 1; ctx.strokeRect(o.x + 12.5, o.y + 27.5, o.w - 25, 5);
      ctx.fillStyle = SHU; ctx.fillRect(o.x + 13, o.y + 28, (o.w - 26) * clamp(o.hp / o.max, 0, 1), 4);
      text(fmt(Math.max(0, Math.ceil(o.hp))), o.x + o.w / 2, o.y + 42, 10, SUMI, 'center');
    }
  }

  // ボス
  const bo = R.boss;
  if (bo) {
    const bsz = bossSize(bo.big), j = bo.hit > 0 ? 2 : 0;
    const bmood = bo.hit > 0 && Math.floor(now / 120) % 2 ? 'hurt' : 'normal';
    const bart = bossImg(bo.art || 0, (bo.charge > 0 || Math.floor(now / 400) % 2) ? 1 : 0, bmood, bo.big);
    if (bart) ctx.drawImage(bart, Math.round(bo.x - bsz / 2 + rnd(-j, j)), Math.round(bo.y - bsz / 2), bsz, bsz);
    const bw = 120, bx = bo.x - bw / 2, by = bo.y - bsz / 2 - 8;
    ctx.strokeStyle = SUMI; ctx.lineWidth = 1.5; ctx.strokeRect(bx - 0.5, by - 0.5, bw + 1, 7);
    ctx.fillStyle = SHU; ctx.fillRect(bx, by, bw * Math.max(0, bo.hp / bo.max), 6);
    text(`${bossName(bo.art)}　${fmt(Math.max(0, Math.ceil(bo.hp)))}`, bo.x, by - 5, 12, SUMI, 'center');
  }
  if (R.deadBoss) {
    const d = R.deadBoss, sz = bossSize(d.big), im = bossImg(d.art, 0, 'dead', d.big);
    if (im) { ctx.save(); ctx.globalAlpha = Math.min(1, d.t); ctx.translate(d.x, d.y); ctx.rotate((1.4 - d.t) * 1.2); ctx.drawImage(im, -sz / 2, -sz / 2, sz, sz); ctx.restore(); }
  }

  // ボスの墨玉と、突進の予告
  for (const e of R.eb) {
    ctx.fillStyle = SUMI; ctx.globalAlpha = .9; ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, 6.283); ctx.fill();
    ctx.globalAlpha = .25; ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 3, 0, 6.283); ctx.fill(); ctx.globalAlpha = 1;
  }
  if (R.boss && R.boss.charge > 0 && Math.floor(R.boss.charge * 10) % 2) {
    ctx.fillStyle = 'rgba(200,50,30,.14)'; ctx.fillRect(R.boss.x - 60, R.boss.y, 120, PY - R.boss.y);
  }
  // 弾：墨のしずく。強い弾は朱
  for (const b of R.b) {
    const strong = b.d >= 1e6;
    ctx.fillStyle = strong ? SHU : SUMI;
    if (b.beam) { ctx.globalAlpha = .75; ctx.fillRect(b.x - 2, b.y - 16, 4, 32); ctx.globalAlpha = 1; }
    else { ctx.beginPath(); ctx.ellipse(b.x, b.y, 2, 4.5, 0, 0, 6.283); ctx.fill(); }
  }
  // 墨（札を隠す）と夜の海（上が暗い）
  for (const k of R.ink) {
    ctx.globalAlpha = Math.min(1, k.t) * 0.9; ctx.fillStyle = SUMI;
    ctx.beginPath(); ctx.arc(k.x, k.y, k.r, 0, 6.283); ctx.arc(k.x + 30, k.y + 20, k.r * 0.7, 0, 6.283); ctx.arc(k.x - 26, k.y + 26, k.r * 0.6, 0, 6.283); ctx.fill();
    ctx.globalAlpha = 1;
  }
  if (mod() === 'dark') {
    const g = ctx.createLinearGradient(0, 84, 0, 380);
    g.addColorStop(0, 'rgba(26,23,20,.9)'); g.addColorStop(1, 'rgba(26,23,20,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 84, W, 300);
  }
  // 自機と仲間
  if (!R.over) {
    const n = Math.min(R.st.crew, CMAX);
    const wf = Math.floor(now / 130) % 4;
    const mood = R.hurt > 0 ? 'hurt' : R.happy > 0 ? 'happy' : 'normal';
    for (const back of [true, false]) for (let si = 1; si < n; si++) {   // 後ろの列から描く
      if (shooterBack(si) !== back) continue;
      const h = heroImg((wf + si) % 4, R.happy > 0 ? 'happy' : 'normal', true), hx = shooterX(si), dy = back ? 9 : 0, k = back ? 0.85 : 1;
      if (h) ctx.drawImage(h, Math.round(hx - HELP_W * k / 2), PY + 12 + dy - HELP_H * k, HELP_W * k, HELP_H * k);
    }
    if (R.hurt > 0 && Math.floor(R.hurt * 20) % 2) ctx.globalAlpha = 0.35;
    const hero = heroImg(wf, mood, false);
    if (hero) ctx.drawImage(hero, Math.round(R.x - HERO_W / 2), PY + 16 - HERO_H, HERO_W, HERO_H);
    ctx.globalAlpha = 1;
  }
  // 墨の飛び散りと、数字
  for (const p of R.parts) { ctx.globalAlpha = Math.min(1, p.life * 2); ctx.fillStyle = inkCol(p.col); ctx.beginPath(); ctx.arc(p.x, p.y, 1.8, 0, 6.283); ctx.fill(); }
  ctx.globalAlpha = 1;
  for (const p of R.pops) {
    ctx.globalAlpha = Math.min(1, p.t * 2);
    text(p.text, p.x, p.y, p.big ? 20 : 12, inkCol(p.col), 'center', p.big);
  }
  ctx.globalAlpha = 1;

  drawHUD();
  if (R.banner) drawBanner(R.banner);
  kakejiku();
}

// 見出し：ステージの始まりは横長の絵巻の札（縦書き・右から左）。ほかは大きな筆文字
// 漢数字（縦書き用）：1〜9999
const KAN = '〇一二三四五六七八九';
function kan(n) {
  if (n < 10) return KAN[n];
  let out = '';
  [[1000, '千'], [100, '百'], [10, '十']].forEach(([u, c]) => { const d = Math.floor(n / u) % 10; if (d) out += (d > 1 ? KAN[d] : '') + c; });
  return out + (n % 10 ? KAN[n % 10] : '');
}
const stageKan = n => (n > STAGES ? `続 第${kan(n)}段` : `第${kan(n)}段`);
function drawBanner(b) {
  ctx.globalAlpha = Math.min(1, b.t);
  if (b.kind === 'stage' && OPT.lang === 'ja') {
    // 絵巻は右から左へ読む：右端に「第〇段」、その左に段の変化（縦書きなので漢数字・括弧は列を分ける）
    const cols = [stageKan(R.stage), ...(b.sub || '').split(/[（）]/).filter(Boolean)];
    const size = 20, gap = 1.6, w = Math.max(120, cols.length * size * gap + 44);
    const h = Math.max(...cols.map(c => [...c].length)) * size * 1.05 + 22, x = W / 2 - w / 2, y = 180;
    ctx.fillStyle = 'rgba(243,234,214,.96)'; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = SUMI; ctx.lineWidth = 2; ctx.strokeRect(x + .5, y + .5, w - 1, h - 1);
    ctx.fillStyle = '#6a4428'; ctx.fillRect(x - 6, y - 3, 6, h + 6); ctx.fillRect(x + w, y - 3, 6, h + 6);   // 両端の軸
    vtext([cols[0]], x + w - 24, y + 6, size, R.stage % 10 === 0 ? SHU : SUMI);
    if (cols.length > 1) vtext(cols.slice(1), x + w - 24 - size * gap, y + 6, size * 0.8, SUMI, gap * 1.25);
  } else {
    text(b.text, W / 2, 250, 36, b.red ? SHU : SUMI, 'center', true);
    if (b.sub) text(b.sub, W / 2, 282, 18, SUMI, 'center');
  }
  ctx.globalAlpha = 1;
}

function drawHUD() {
  const m = mEff();
  // 上の帯：紙を重ねて、下に筆の線
  ctx.fillStyle = 'rgba(239,231,212,.94)'; ctx.fillRect(0, 0, W, 86);
  ctx.strokeStyle = 'rgba(26,23,20,.55)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(6, 86); ctx.quadraticCurveTo(W / 2, 83, W - 6, 86); ctx.stroke();
  text(L().stageName(R.stage), 10, 26, 20, R.stage % 10 === 0 ? SHU : SUMI, 'left', true);
  const bx = 10, by = 33, bw = 150, bh = 7;
  ctx.strokeStyle = SUMI; ctx.lineWidth = 1.2; ctx.strokeRect(bx - .5, by - .5, bw + 1, bh + 1);
  ctx.fillStyle = R.boss ? SHU : SUMI; ctx.globalAlpha = .85; ctx.fillRect(bx, by, bw * stageFrac(), bh); ctx.globalAlpha = 1;
  ctx.fillStyle = SHU; ctx.fillRect(bx + bw * 0.75 - 1, by - 4, 2, bh + 8);   // ここからボス
  // 腹（飢え）
  text(L().hungerMark, 10, 58, 14, SUMI);
  const low = R.food <= 3, fm = R.foodMax || FOOD_MAX, cw = 130 / fm;
  for (let i = 0; i < fm; i++) {
    const f = clamp(R.food - i, 0, 1);
    ctx.strokeStyle = SUMI; ctx.lineWidth = 1; ctx.strokeRect(30 + i * cw + .5, 48.5, cw - 3, 8);
    if (f > 0) { ctx.fillStyle = low && Math.floor(performance.now() / 200) % 2 ? SHU : SUMI; ctx.fillRect(30 + i * cw, 48, (cw - 3) * f, 9); }
  }
  if (R.hungry > 0) { ctx.strokeStyle = SHU; ctx.lineWidth = 1.5; ctx.strokeRect(28.5, 46.5, fm * cw, 12); }
  text(fmt(Math.floor(m * METER)) + ' ' + L().meter, 10, 79, 15, SUMI);
  text(L().speed + ' ×' + curSpeed().toFixed(2), 120, 79, 10, '#6a6258');
  // 右上：中断の札・自己ベスト・このステージの変化
  ctx.fillStyle = PAPER; ctx.fillRect(MENU_RECT.x, MENU_RECT.y, MENU_RECT.w, MENU_RECT.h);
  ctx.strokeStyle = SUMI; ctx.lineWidth = 1.5; ctx.strokeRect(MENU_RECT.x + .5, MENU_RECT.y + .5, MENU_RECT.w, MENU_RECT.h);
  text(L().menu, MENU_RECT.x + MENU_RECT.w / 2, MENU_RECT.y + 19, 14, SUMI, 'center');
  text(L().best + ' ' + fmt(Math.floor(Math.max(SLOT.best, m) * METER)) + L().meter, W - 10, 52, 11, '#6a6258', 'right');
  if (R.mod && R.mod !== 'normal') text(L().mods[R.mod], W - 10, 70, 12, SHU, 'right');
  text(L().food, MID / 2, 102, 12, '#6a6258', 'center');
  text(L().gate, MID + MID / 2, 102, 12, '#6a6258', 'center');
  // 下：命・今の強さ
  text(L().lifeMark, 10, H - 30, 14, SHU);
  for (let i = 0; i < HP_MAX; i++) { ctx.fillStyle = SHU; ctx.globalAlpha = i < R.hp ? 1 : .15; ctx.beginPath(); ctx.arc(32 + i * 13, H - 35, 4.5, 0, 6.283); ctx.fill(); }
  ctx.globalAlpha = 1;
  text(L().stat.dmg + ' ' + fmt(Math.floor(R.st.dmg)), W / 2, H - 30, 18, SUMI, 'center', true);
  text(`${L().stat.rate}${R.st.rate}・${L().stat.lines}${R.st.lines}・${L().stat.crew}${R.st.crew}・${L().wp[R.st.wp] || L().wp.normal}${Object.entries(R.st.subs || {}).map(([k, v]) => `＋${L().wp[k]}${v > 1 ? v : ''}`).join('')}`, W / 2, H - 15, 10, '#4a443d', 'center');
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

window.Game = { OPT, METER, readSlot, selectSlot, saveOpt, fmt, showMenu, showTitle };
if (DEV) window.__gate = { get R() { return R; }, step, startRun, get state() { return state; }, STAGES, stageLen, stageSpeed, mEff };   // 開発用

// 画面（タイトルなど）の背景にも同じ和紙を敷く
document.documentElement.style.setProperty('--washi', `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(Ink.washi(360, 640))}")`);
// 筆文字のフォントが読み込まれてから描く（読み込めなくても明朝で表示される）
if (document.fonts && document.fonts.load) { document.fonts.load('20px "Yuji Syuku"').catch(() => {}); document.fonts.load('20px "Yuji Boku"').catch(() => {}); }
resize();
requestAnimationFrame(frame);
Boot.start(false);
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => { /* 登録できなくても動く */ });

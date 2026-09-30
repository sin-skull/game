'use strict';

// =====================================================
//  GATE VADER — 撃つか、育てるか。数字のインフレが止まらないゲートシューター
//  v0.1 土台：canvas / 弾 / ゲート（＋ × ÷）/ モブ / 中ボス・大ボス / 進行バー /
//             加速 / メートル / 途中離脱 → カウントダウン再開 / 軽量モード
// =====================================================

const VERSION = '0.1.0';
const W = 360, H = 640;                 // 論理サイズ（縦画面）。画面に合わせて拡縮する
const Q = new URLSearchParams(location.search);
const TS = Math.min(60, Math.max(0.1, +Q.get('ts') || 1));   // 開発用：時間の倍率
const BOT = Q.has('bot');                                     // 開発用：自動操縦

// ---------- 進行のペース ----------
const CLEAR_SEC = +Q.get('clear') || 3000;   // 100% までの目標秒数（50分）。ここ一つで長さを調整できる
const SEGS = 8;                              // 100% までのボスの数（12.5% ごと）
const FIGHT_SEC = 40;                        // ボス戦1回あたりの想定秒数
const K = 0.6;                               // 100% 到達時の速さ = 1 + K 倍
const G = (CLEAR_SEC - SEGS * FIGHT_SEC) * K / Math.log(1 + K);   // 100% までのメートル
const SEG = G / SEGS;                        // ボス1区間のメートル
const FIGHT_LEN = G / 32;                    // ボス戦の間に進行バーが進む長さ
const speed = m => (m <= G ? 1 + K * m / G : (1 + K) * (1 + 1.8 * (m - G) / G));   // 100% 以降はぐっと加速

// ---------- 盤面 ----------
const PY = 560;                              // 自機の高さ
const BAND_Y = [440, 350], BAND_H = 44;      // ゲートの帯（手前・奥）
const GATE_X = [10, 188], GATE_W = 162;
const GATE_LIFE = 16;
const ROW_GAP = 52, MOB_VY = 12, BULLET_VY = 720;
const STAT = { lines: 3, rate: 7, dmg: 1 };  // 初期グレード（転生で買う要素は次の段階）

// ---------- 設定・セーブ ----------
const SETTINGS_KEY = 'gate-settings';
const SLOT_KEYS = ['gate-slot-0', 'gate-slot-1', 'gate-slot-2'];
function loadOpt() {
  const d = { slot: 0, light: false, sound: true, bootSeen: false, noticeVer: '', lightAsked: false };
  try { return Object.assign(d, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')); } catch (e) { return d; }
}
const OPT = loadOpt();
function saveOpt() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(OPT)); } catch (e) { /* 保存不可 */ } }
function readSlot(i) {
  try {
    const d = JSON.parse(localStorage.getItem(SLOT_KEYS[i]) || 'null');
    if (!d) return null;
    return { best: +d.best || 0, runs: +d.runs || 0, run: d.run && typeof d.run === 'object' ? d.run : null };
  } catch (e) { return null; }
}
let SLOT = readSlot(OPT.slot) || { best: 0, runs: 0, run: null };
function writeSlot() { try { localStorage.setItem(SLOT_KEYS[OPT.slot], JSON.stringify(SLOT)); } catch (e) { /* 保存不可 */ } }
function selectSlot(i) { OPT.slot = i; saveOpt(); SLOT = readSlot(i) || { best: 0, runs: 0, run: null }; }

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
const MOBS = [
  [['..#.....#..', '...#...#...', '..#######..', '.##.###.##.', '###########', '#.#######.#', '#.#.....#.#', '...##.##...'],
   ['..#.....#..', '#..#...#..#', '#.#######.#', '###.###.###', '###########', '.#########.', '..#.....#..', '.#.......#.'], '#e8e8e8'],
  [['...#####...', '.#########.', '###########', '###..#..###', '###########', '..##...##..', '.##.###.##.', '##.......##'],
   ['...#####...', '.#########.', '###########', '###..#..###', '###########', '...##.##...', '..#.....#..', '...#...#...'], '#9dffc4'],
  [['...##...', '..####..', '.######.', '##.##.##', '########', '..#..#..', '.#.##.#.', '#.#..#.#'],
   ['...##...', '..####..', '.######.', '##.##.##', '########', '.#.##.#.', '#......#', '.#....#.'], '#c8c8c8'],
].map(([a, b, col]) => [spr(a, { '#': col }, 3), spr(b, { '#': col }, 3)]);
const PLAYER = spr(['.....w.....', '....###....', '...#####...', '...#####...', '..#e###e#..', '.##d###d##.', '###########', '#.#######.#', '#..#####..#', '...##.##...', '..##...##..'],
  { '#': '#39ff88', d: '#1f9d54', e: '#ffe14a', w: '#ffffff' }, 3);
const BOSS_ROWS = ['....########....', '..############..', '.##############.', '.#ee########ee#.', '.#eK########Ke#.', '################', '################', '#####.####.#####', '################', '#w#w#w#ww#w#w#w#', '.#.#.#.##.#.#.#.'];
const BOSS_MID = spr(BOSS_ROWS, { '#': '#39ff88', e: '#ffe14a', K: '#000', w: '#fff' }, 7);
const BOSS_BIG = spr(BOSS_ROWS, { '#': '#ff6a5a', e: '#ffe14a', K: '#000', w: '#fff' }, 9);
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

function newRun() {
  const r = {
    m: 0, hp: 3, x: W / 2, tx: W / 2, t: 0, fire: 0, rowAcc: 30, uid: 0,
    mobs: [], b: [], gates: [[], []], gateAge: [0, GATE_LIFE / 2],
    boss: null, nextBoss: 1, cleared: false, fightKills: 0, kills: 0,
    pops: [], parts: [], popT: 0, bossAcc: 0, bossAccT: 0, hurt: 0, banner: null, atk: STAT.dmg, over: false, newBest: false,
  };
  R = r;
  r.gates[0] = makePair(0); r.gates[1] = makePair(1);
  return r;
}
function snapshot() {
  if (!R || R.over) return null;
  const { m, hp, x, t, rowAcc, uid, mobs, gates, gateAge, boss, nextBoss, cleared, fightKills, kills } = R;
  return JSON.parse(JSON.stringify({ m, hp, x, t, rowAcc, uid, mobs, gates, gateAge, boss, nextBoss, cleared, fightKills, kills }));
}
function loadRun(snap) {
  const r = newRun();
  Object.assign(r, snap);
  r.tx = r.x;
  R = r;
  return r;
}
function persist() {
  if (!R) return;
  SLOT.run = snapshot();
  writeSlot();
}

// 進行バーと表示用のメートル。ボス戦中は、ボスとモブの片付き具合で進む
function clearFrac() {
  const b = R.boss;
  return 0.85 * (1 - b.hp / b.max) + 0.15 * Math.min(1, R.fightKills / 40);
}
const mEff = () => (R.boss ? R.boss.startM + FIGHT_LEN * clearFrac() : R.m);

// ---------- ゲート ----------
function makePair(band) {
  const lvl = R.m / 100, p = R.m / G;
  const pick = () => { const r = Math.random(); return r < 0.45 ? '+' : r < 0.75 ? '×' : '÷'; };
  let types;
  if (p < 0.06) types = ['+', '+'];
  else if (p < 0.16) types = ['+', Math.random() < 0.5 ? '+' : '×'];
  else { types = [pick(), pick()]; if (types[0] === '÷' && types[1] === '÷') types[rnd(0, 1) < 0.5 ? 0 : 1] = '+'; }
  if (Math.random() < 0.5) types.reverse();
  return types.map((type, i) => {
    let v;
    if (type === '+') v = Math.max(2, Math.round(2 * Math.pow(1.5, lvl) * rnd(0.85, 1.15)));
    else if (type === '×') v = 2 + Math.floor(lvl / 4) * 0.5;
    else v = 2 + Math.floor(lvl / 6) * 0.5;
    return { uid: ++R.uid, x: GATE_X[i], w: GATE_W, type, v, age: 0, pulse: 0 };
  });
}
function gateLabel(g) {
  if (g.type === '+') return '+' + fmt(Math.floor(g.v));
  const s = g.v < 10 ? g.v.toFixed(1).replace(/\.0$/, '') : fmt(Math.floor(g.v));
  return g.type + s;
}
// 弾がゲートを通る：弾を変化させ、ゲートも育つ（撃つほど育つ）
function passGate(b, g) {
  if (g.type === '+') { b.d += g.v; g.v = g.v * 1.004 + 0.02; }
  else if (g.type === '×') { b.d *= g.v; g.v += 0.004 + g.v * 0.0004; }
  else { b.d = Math.max(1, b.d / g.v); g.v = Math.max(1, g.v - 0.012); }
  g.pulse = 1;
  sfx('gate');
}

// ---------- 敵 ----------
function spawnRow() {
  const p = Math.min(1, R.m / G);
  const n = Math.min(8, 4 + Math.floor(p * 5));
  const slots = [0, 1, 2, 3, 4, 5, 6, 7, 8].sort(() => Math.random() - 0.5).slice(0, n);
  const k = Math.floor(Math.random() * 3);
  for (const sI of slots) R.mobs.push({ x: 28 + sI * 38, y: -16, k, f: Math.random() * 2 });
}
const bossMax = k => 700 * Math.pow(7, k);
function spawnBoss() {
  const k = R.nextBoss, big = k % 4 === 0;
  const max = bossMax(k);
  R.boss = { k, big, hp: max, max, x: W / 2, y: -80, ph: Math.random() * 6, startM: R.m, hit: 0 };
  R.fightKills = 0;
  R.banner = { text: big ? 'BIG BOSS' : 'BOSS', t: 2 };
  sfx('boss');
}
function killBoss() {
  const b = R.boss;
  burst(b.x, b.y, b.big ? 60 : 36, b.big ? '#ff6a5a' : '#39ff88');
  R.m = b.k * SEG;
  R.nextBoss++;
  R.boss = null;
  R.hp = Math.min(3, R.hp + 1);
  sfx('boss');
  if (b.k === SEGS && !R.cleared) { R.cleared = true; R.banner = { text: 'GAME CLEAR!', t: 4, sub: '∞ MODE' }; }
  else R.banner = { text: 'BOSS DOWN', t: 1.8 };
}
function burst(x, y, n, col) {
  if (OPT.light) return;
  for (let i = 0; i < n && R.parts.length < 160; i++) {
    const a = Math.random() * 6.283, v = rnd(40, 180);
    R.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rnd(0.3, 0.7), col });
  }
}
function pop(x, y, text, big) {
  if (R.pops.length > 22) return;
  R.pops.push({ x, y, text, t: 0.8, big });
}

// ---------- 1コマ進める ----------
function step(dt) {
  if (!R || R.over) return;
  const s = speed(R.boss ? R.boss.startM : R.m);
  R.t += dt;

  // 進行：ボスが出たらその場で止まり、ボス戦の進み具合でバーが動く
  if (!R.boss) {
    R.m += s * dt;
    if (R.m >= R.nextBoss * SEG - FIGHT_LEN) spawnBoss();
  }

  // 自機
  if (BOT) botControl();
  R.x += (R.tx - R.x) * Math.min(1, dt * 18);
  R.x = Math.max(18, Math.min(W - 18, R.x));

  // 発射
  R.fire += dt * STAT.rate;
  const cap = OPT.light ? 110 : 240;
  while (R.fire >= 1) {
    R.fire -= 1;
    if (R.b.length >= cap) continue;
    for (let i = 0; i < STAT.lines; i++) R.b.push({ x: R.x + (i - (STAT.lines - 1) / 2) * 11, y: PY - 16, d: STAT.dmg, p0: 0, p1: 0 });
  }

  // 弾
  let maxD = STAT.dmg;
  for (let i = R.b.length - 1; i >= 0; i--) {
    const b = R.b[i];
    b.y -= BULLET_VY * dt;
    let dead = b.y < -12;
    if (!dead) {
      for (let band = 0; band < 2 && !dead; band++) {
        if (b.y <= BAND_Y[band] + BAND_H && b.y > BAND_Y[band]) {
          for (const g of R.gates[band]) {
            if (b.x >= g.x && b.x <= g.x + g.w && b['p' + band] !== g.uid) { b['p' + band] = g.uid; passGate(b, g); break; }
          }
        }
      }
      // モブ：一撃で倒れる（HPなし）
      for (let j = R.mobs.length - 1; j >= 0; j--) {
        const mo = R.mobs[j];
        if (Math.abs(b.x - mo.x) < 15 && Math.abs(b.y - mo.y) < 13) {
          R.mobs.splice(j, 1);
          R.kills++; if (R.boss) R.fightKills++;
          burst(mo.x, mo.y, 6, '#e8e8e8');
          if (R.popT <= 0) { pop(mo.x, mo.y, fmt(b.d), false); R.popT = 0.07; }
          sfx('kill');
          dead = true; break;
        }
      }
      // ボス
      const bo = R.boss;
      if (!dead && bo) {
        const hw = bo.big ? 72 : 56, hh = bo.big ? 50 : 40;
        if (Math.abs(b.x - bo.x) < hw && Math.abs(b.y - bo.y) < hh) {
          bo.hp -= b.d; R.bossAcc += b.d; bo.hit = 0.08;
          dead = true;
        }
      }
    }
    if (b.d > maxD) maxD = b.d;
    if (dead) { R.b[i] = R.b[R.b.length - 1]; R.b.pop(); }
  }
  R.atk += (maxD - R.atk) * Math.min(1, dt * 6);

  // ボスの処理
  const bo = R.boss;
  if (bo) {
    bo.ph += dt;
    bo.hit = Math.max(0, bo.hit - dt);
    if (bo.y < 96) bo.y += 130 * dt;
    else bo.y += 7.5 * s * dt;
    bo.x = W / 2 + Math.sin(bo.ph * 0.7) * 90;
    R.bossAccT -= dt;
    if (R.bossAccT <= 0 && R.bossAcc > 0) { pop(bo.x + rnd(-30, 30), bo.y + 30, fmt(R.bossAcc), true); R.bossAcc = 0; R.bossAccT = 0.25; }
    if (bo.hp <= 0) killBoss();
    else if (bo.y > PY - 40) { R.hp = 0; }
  }

  // モブの前進と、到達
  R.rowAcc += MOB_VY * s * dt * (R.boss ? 0.4 : 1);
  if (R.rowAcc >= ROW_GAP) { R.rowAcc -= ROW_GAP; spawnRow(); }
  for (let j = R.mobs.length - 1; j >= 0; j--) {
    const mo = R.mobs[j];
    mo.y += MOB_VY * s * dt;
    if (mo.y > PY + 6) { R.mobs.splice(j, 1); R.hp--; R.hurt = 0.4; sfx('hurt'); burst(mo.x, PY, 10, '#ff4d6d'); }
  }

  // ゲートの入れ替え
  for (let band = 0; band < 2; band++) {
    R.gateAge[band] += dt;
    for (const g of R.gates[band]) { g.age += dt; g.pulse = Math.max(0, g.pulse - dt * 4); }
    if (R.gateAge[band] >= GATE_LIFE) { R.gateAge[band] = 0; R.gates[band] = makePair(band); }
  }

  // 演出
  R.popT -= dt; R.hurt = Math.max(0, R.hurt - dt);
  for (let i = R.pops.length - 1; i >= 0; i--) { const p = R.pops[i]; p.t -= dt; p.y -= 34 * dt; if (p.t <= 0) R.pops.splice(i, 1); }
  for (let i = R.parts.length - 1; i >= 0; i--) { const p = R.parts[i]; p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.life <= 0) R.parts.splice(i, 1); }
  if (R.banner) { R.banner.t -= dt; if (R.banner.t <= 0) R.banner = null; }

  if (R.hp <= 0) gameOver();
}

// 開発用の自動操縦：モブを優先し、なければ良いゲートの下へ
function botControl() {
  let low = null;
  for (const mo of R.mobs) if (mo.y > 470 && (!low || mo.y > low.y)) low = mo;
  if (low) { R.tx = low.x; return; }
  let bestSide = 0, bestD = -1;
  for (let side = 0; side < 2; side++) {
    let d = STAT.dmg;
    for (let band = 0; band < 2; band++) {
      const g = R.gates[band][side]; if (!g) continue;
      d = g.type === '+' ? d + g.v : g.type === '×' ? d * g.v : Math.max(1, d / g.v);
    }
    if (d > bestD) { bestD = d; bestSide = side; }
  }
  R.tx = bestSide ? 269 : 91;
}

// ---------- 画面の流れ ----------
function show(id, on) { $(id).hidden = !on; }
function toast(msg, ms = 2200) {
  const t = $('toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('on'), ms);
}
function showMenu() {
  state = 'menu';
  show('result', false); show('pause', false);
  $('menuSub').textContent = `BEST ${fmt(Math.floor(SLOT.best))} m  ·  ${SLOT.runs} RUNS  ·  SLOT ${OPT.slot + 1}`;
  show('btnContinue', !!SLOT.run);
  $('btnContinue').textContent = SLOT.run ? `CONTINUE  ${fmt(Math.floor(SLOT.run.m))} m` : 'CONTINUE';
  $('btnStart').textContent = SLOT.run ? 'NEW RUN' : 'START';
  $('btnLight').textContent = 'LIGHT: ' + (OPT.light ? 'ON' : 'OFF');
  $('btnSound').textContent = 'SOUND: ' + (OPT.sound ? 'ON' : 'OFF');
  show('menu', true);
}
function startRun(resume) {
  show('menu', false); show('result', false); show('pause', false);
  if (resume && SLOT.run) loadRun(SLOT.run); else { newRun(); SLOT.run = null; }
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
  if (!auto) show('pause', true);
  if (wasCount) return;
}
function resumeGame() {
  show('pause', false);
  countdown(() => { state = 'play'; });
}
function gameOver() {
  const m = mEff();
  R.over = true; state = 'result';
  SLOT.runs++;
  R.newBest = m > SLOT.best;
  if (R.newBest) SLOT.best = m;
  SLOT.run = null; writeSlot();
  sfx('hurt');
  $('resTitle').textContent = 'GAME OVER';
  $('resM').textContent = fmt(Math.floor(m)) + ' m';
  $('resSub').textContent = (R.newBest ? 'NEW BEST!  ' : `BEST ${fmt(Math.floor(SLOT.best))} m  ·  `) + `${R.cleared ? '∞ MODE  ·  ' : ''}${R.kills} KILLS`;
  setTimeout(() => { if (state === 'result') show('result', true); }, 700);
}

// ---------- 入力 ----------
let drag = null;
function toLogical(e) {
  const r = cv.getBoundingClientRect();
  return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
}
const MENU_RECT = { x: W - 78, y: H - 34, w: 68, h: 26 };
cv.addEventListener('pointerdown', e => {
  const p = toLogical(e);
  if (state === 'play' && p.x > MENU_RECT.x && p.y > MENU_RECT.y) { pauseGame(false); return; }
  if (state !== 'play' || !R) return;
  cv.setPointerCapture(e.pointerId);
  drag = { px: p.x, tx: R.tx };
});
cv.addEventListener('pointermove', e => {
  if (!drag || state !== 'play' || !R) return;
  R.tx = Math.max(18, Math.min(W - 18, drag.tx + (toLogical(e).x - drag.px) * 1.3));
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
$('btnContinue').onclick = () => startRun(true);
$('btnResume').onclick = resumeGame;
$('btnQuit').onclick = () => { persist(); showMenu(); };
$('btnRetry').onclick = () => startRun(false);
$('btnHome').onclick = showMenu;
$('btnSlot').onclick = () => { show('menu', false); $('boot').hidden = false; Boot.start(true); };
$('btnLight').onclick = () => { OPT.light = !OPT.light; OPT.lightAsked = true; saveOpt(); resize(); showMenu(); };
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

const stars = Array.from({ length: 46 }, () => ({ x: Math.random() * W, y: Math.random() * H, z: Math.random() }));
let starY = 0;
const GC = { '+': '#39ff88', '×': '#ffd84a', '÷': '#ff5a5a' };
const FONT = '"DotGothic16", "IBM Plex Mono", monospace';

function bulletColor(d) {
  const e = Math.log10(Math.max(1, d));
  return e < 1 ? '#ffffff' : e < 3 ? '#b8ffd2' : e < 6 ? '#39ff88' : e < 9 ? '#66e6ff' : '#ffd84a';
}
function text(t, x, y, size, col, align = 'left') {
  ctx.font = `${size}px ${FONT}`; ctx.textAlign = align; ctx.fillStyle = col; ctx.fillText(t, x, y);
}

function render(now) {
  ctx.setTransform(kScale, 0, 0, kScale, 0, 0);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  ctx.imageSmoothingEnabled = false;
  const s = R && !R.over ? speed(R.m) : 1;
  // 星
  ctx.fillStyle = '#fff';
  for (const st of stars) {
    const y = (st.y + starY * (0.3 + st.z)) % H;
    ctx.globalAlpha = 0.15 + st.z * 0.35; ctx.fillRect(st.x, y, 1.5, 1.5 + st.z * 3 * Math.min(2.5, s));
  }
  ctx.globalAlpha = 1;
  if (!R) return;

  // ゲート
  const glow = !OPT.light;
  for (let band = 0; band < 2; band++) {
    for (const g of R.gates[band]) {
      const y = BAND_Y[band];
      const a = Math.min(1, g.age / 0.4, (GATE_LIFE - R.gateAge[band]) / 0.6 + 0.0001);
      const col = g.type === '÷' && g.v <= 1 ? '#666' : GC[g.type];
      ctx.globalAlpha = Math.max(0, a) * 0.9;
      ctx.fillStyle = col; ctx.globalAlpha *= 0.08 + g.pulse * 0.22; ctx.fillRect(g.x, y, g.w, BAND_H);
      ctx.globalAlpha = Math.max(0, a);
      if (glow) { ctx.shadowColor = col; ctx.shadowBlur = 8 + g.pulse * 10; }
      ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.strokeRect(g.x + 1, y + 1, g.w - 2, BAND_H - 2);
      text(gateLabel(g), g.x + g.w / 2, y + 30, 24 + g.pulse * 3, '#fff', 'center');
      ctx.shadowBlur = 0;
    }
  }
  ctx.globalAlpha = 1;

  // モブ
  const fr = Math.floor(now / 420) % 2;
  for (const mo of R.mobs) {
    const im = MOBS[mo.k][(fr + Math.floor(mo.f)) % 2];
    ctx.drawImage(im, Math.round(mo.x - im.width / 2), Math.round(mo.y - im.height / 2));
  }

  // ボス
  const bo = R.boss;
  if (bo) {
    const im = bo.big ? BOSS_BIG : BOSS_MID;
    const j = bo.hit > 0 ? 2 : 0;
    ctx.drawImage(im, Math.round(bo.x - im.width / 2 + rnd(-j, j)), Math.round(bo.y - im.height / 2));
    // 頭の上に HP
    const bw = 120, bx = bo.x - bw / 2, by = bo.y - im.height / 2 - 18;
    ctx.fillStyle = '#222'; ctx.fillRect(bx, by, bw, 7);
    ctx.fillStyle = bo.big ? '#ff6a5a' : '#39ff88'; ctx.fillRect(bx, by, bw * Math.max(0, bo.hp / bo.max), 7);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(bx - 0.5, by - 0.5, bw + 1, 8);
    text(fmt(Math.max(0, Math.ceil(bo.hp))), bo.x, by - 5, 12, '#fff', 'center');
  }

  // 弾
  for (const b of R.b) {
    const col = bulletColor(b.d);
    ctx.fillStyle = col;
    ctx.fillRect(b.x - 1.5, b.y - 6, 3, 12);
  }

  // 自機
  if (!R.over) {
    if (R.hurt > 0 && Math.floor(R.hurt * 20) % 2) ctx.globalAlpha = 0.35;
    ctx.drawImage(PLAYER, Math.round(R.x - PLAYER.width / 2), PY - 16);
    ctx.globalAlpha = 1;
  }

  // 破片
  for (const p of R.parts) { ctx.globalAlpha = Math.min(1, p.life * 2); ctx.fillStyle = p.col; ctx.fillRect(p.x, p.y, 3, 3); }
  ctx.globalAlpha = 1;
  // ダメージ数
  for (const p of R.pops) {
    ctx.globalAlpha = Math.min(1, p.t * 2);
    const sz = p.big ? 20 : 13;
    if (glow && p.big) { ctx.shadowColor = '#39ff88'; ctx.shadowBlur = 8; }
    text(p.text, p.x, p.y, sz, p.big ? '#b8ffd2' : '#fff', 'center');
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
  // 進行バー
  const bx = 10, by = 10, bw = 170, bh = 10;
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(bx - 0.5, by - 0.5, bw + 1, bh + 1);
  ctx.fillStyle = R.boss ? (R.boss.big ? '#ff6a5a' : '#ffd84a') : '#39ff88';
  ctx.fillRect(bx, by, bw * Math.min(1, p), bh);
  ctx.fillStyle = '#000';
  for (let i = 1; i < SEGS; i++) ctx.fillRect(bx + bw * i / SEGS - 0.5, by, 1, bh);
  text(R.cleared ? '∞' : Math.min(100, Math.floor(p * 100)) + '%', bx + bw + 8, by + 10, 12, '#fff');
  text('BEST ' + fmt(Math.floor(Math.max(SLOT.best, m))) + 'm', W - 10, by + 10, 12, '#fff', 'right');
  // メートルと速さ
  text(fmt(Math.floor(m)) + ' m', 10, 44, 18, '#fff');
  text('SPEED ×' + speed(R.boss ? R.boss.startM : R.m).toFixed(2), 10, 60, 11, '#6b7a70');
  // 下段
  for (let i = 0; i < 3; i++) ctx.drawImage(i < R.hp ? HEART : HEART_OFF, 10 + i * 18, H - 28);
  text('ATK ' + fmt(Math.floor(R.atk)), W / 2, H - 14, 16, '#39ff88', 'center');
  ctx.strokeStyle = '#6b7a70'; ctx.lineWidth = 1; ctx.strokeRect(MENU_RECT.x + 0.5, MENU_RECT.y + 0.5, MENU_RECT.w, MENU_RECT.h);
  text('MENU', MENU_RECT.x + MENU_RECT.w / 2, MENU_RECT.y + 18, 12, '#9aa89f', 'center');
}

// ---------- メインループ ----------
let last = performance.now(), lightSamples = 0, lightSum = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const raw = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (state === 'play' && R) {
    if (keys.ArrowLeft || keys.a) R.tx -= 380 * raw;
    if (keys.ArrowRight || keys.d) R.tx += 380 * raw;
    R.tx = Math.max(18, Math.min(W - 18, R.tx));
    let dt = Math.min(0.05, raw) * TS;
    while (dt > 0 && state === 'play') { const d = Math.min(1 / 30, dt); step(d); dt -= d; }
    starY += speed(R.m) * 40 * raw * TS % H;
    // 最初の数秒で重そうなら、軽量モードを提案して自動で切り替える
    if (!OPT.lightAsked && !OPT.light && lightSamples < 240) {
      lightSamples++; lightSum += raw;
      if (lightSamples === 240 && lightSum / 240 > 0.027) {
        OPT.light = true; OPT.lightAsked = true; saveOpt(); resize();
        toast('LIGHT MODE ON — you can change it on the title screen', 3500);
      } else if (lightSamples === 240) { OPT.lightAsked = true; saveOpt(); }
    }
    if (R.t - (R._saved || 0) > 2) { R._saved = R.t; persist(); }
  } else if (state === 'menu' || state === 'pause' || state === 'count' || state === 'result') {
    starY += 20 * raw;
  }
  render(now);
}

window.Game = { OPT, readSlot, selectSlot, saveOpt, fmt, showMenu };
window.__gate = { get R() { return R; }, step, startRun, get state() { return state; }, G, SEG, speed, mEff };   // 開発用

resize();
requestAnimationFrame(frame);
Boot.start(false);
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => { /* 登録できなくても動く */ });

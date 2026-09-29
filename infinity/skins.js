'use strict';

// =====================================================
//  スキン：白と黒だけで「形の言語」を変える（見た目のみ）
// =====================================================

const SKIN_INF = 20;
const SKIN_LIST = [
  { id: 'CIRCLE', jp: '円', en: 'Circle', cost: 0 },
  { id: 'POLYGON', jp: '多角形', en: 'Polygon', cost: 30 },
  { id: 'ORBIT', jp: '軌道', en: 'Orbit', cost: 60 },
  { id: 'BINARY', jp: '二進', en: 'Binary', cost: 120 },
  { id: 'PIXEL', jp: '画素', en: 'Pixel', cost: 200 },
  { id: 'ASCII', jp: '記号', en: 'ASCII', cost: 300 },
  { id: 'HALFTONE', jp: '網点', en: 'Halftone', cost: 500 },
  { id: 'SUMI', jp: '墨', en: 'Sumi', cost: -1 },   // Ω クリア報酬
];
const SKIN_DESC = {
  CIRCLE: ['塗り／線の交互。基本形。', 'Filled and outlined, alternating. The original.'],
  POLYGON: ['ランクごとに角が増え、∞で円になる。', 'One more corner per rank. ∞ becomes a circle.'],
  ORBIT: ['ランクの数だけ軌道が重なる。', 'One orbit per rank.'],
  BINARY: ['2ⁿ＝1のあとに0がn個。', '2ⁿ is a 1 followed by n zeros.'],
  PIXEL: ['レトロゲームのドット。', 'Retro game pixels.'],
  ASCII: ['括弧の入れ子で強さを表す。', 'Power shown as nested brackets.'],
  HALFTONE: ['網点の密度＝ランク。', 'Dot density is the rank.'],
  SUMI: ['円相と漢数字。∞は「無」。', 'Ensō and kanji numerals. ∞ is 無.'],
};

const SKIN_KANJI = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九'];
const skinFmt = n => { if (n < 1000) return String(n); const u = ['K', 'M', 'B']; const e = Math.floor(Math.log10(n) / 3); return +(n / 1000 ** e).toFixed(1) + u[e - 1]; };
const GLOW = 'filter="url(#skglow)"';

const SKIN_DRAW = {
  CIRCLE(t, d) {
    const r = d / 2;
    if (t >= SKIN_INF) return `<circle r="${r}" fill="none" stroke="#fff" stroke-width="2" ${GLOW}/><circle r="${r * .8}" fill="none" stroke="#fff" stroke-opacity=".6"/><circle r="${r * .62}" fill="none" stroke="#fff" stroke-opacity=".3"/><text y="${d * .1}" text-anchor="middle" font-size="${d * .3}" font-weight="100" fill="#fff">∞</text>`;
    const even = t % 2 === 0;
    return `${t >= 10 ? `<circle r="${r + 7}" fill="none" stroke="#fff" stroke-opacity=".35" stroke-dasharray="2 4"/>` : ''}
      <circle r="${r - 1}" fill="${even ? '#fff' : 'none'}" stroke="#fff" stroke-width="1.5"/>
      <text y="${d * .08}" text-anchor="middle" font-size="${Math.min(14, 8 + t * .35)}" font-weight="500" fill="${even ? '#000' : '#fff'}">${skinFmt(2 ** t)}</text>`;
  },
  POLYGON(t, d) {
    const r = d / 2 - 1;
    if (t >= SKIN_INF) return `<circle r="${r}" fill="none" stroke="#fff" stroke-width="2" ${GLOW}/><text y="${d * .1}" text-anchor="middle" font-size="${d * .3}" font-weight="100" fill="#fff">∞</text>`;
    const n = t + 3, even = t % 2 === 0;
    const pts = Array.from({ length: n }, (_, k) => { const a = -Math.PI / 2 + k * 2 * Math.PI / n; return `${(r * Math.cos(a)).toFixed(1)},${(r * Math.sin(a)).toFixed(1)}`; }).join(' ');
    return `<polygon points="${pts}" fill="${even ? '#fff' : 'none'}" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/><text y="${d * .12}" text-anchor="middle" font-size="${Math.max(7, Math.min(13, d * .2))}" font-weight="500" fill="${even ? '#000' : '#fff'}">${skinFmt(2 ** t)}</text>`;
  },
  ORBIT(t, d) {
    const n = t >= SKIN_INF ? 14 : Math.min(t, 12);
    let s = `<circle r="${Math.max(2.5, d * .06)}" fill="#fff"/>`;
    for (let k = 1; k <= n; k++) {
      const rr = 3 + (d / 2 - 4) * k / n;
      s += `<circle r="${rr.toFixed(1)}" fill="none" stroke="#fff" stroke-opacity="${(t >= SKIN_INF ? .3 + .05 * k : .3 + .6 * k / n).toFixed(2)}" ${k % 2 && t < SKIN_INF ? 'stroke-dasharray="1 3"' : ''} ${t >= SKIN_INF && k === n ? GLOW : ''}/>`;
    }
    if (t > 12 && t < SKIN_INF) s += `<text x="${d / 2 - 4}" y="${-d / 2 + 8}" font-size="8" fill="#fff" fill-opacity=".6">+${t - 12}</text>`;
    return s;
  },
  BINARY(t, d) {
    const n = t >= SKIN_INF ? 21 : t + 1, r = d / 2 - 3;
    let s = `<circle r="${r}" fill="none" stroke="#fff" stroke-opacity=".15"/>`;
    for (let k = 0; k < n; k++) {
      const a = -Math.PI / 2 + k * 2 * Math.PI / n, x = (r * Math.cos(a)).toFixed(1), y = (r * Math.sin(a)).toFixed(1);
      s += k === 0 || t >= SKIN_INF ? `<circle cx="${x}" cy="${y}" r="2.6" fill="#fff"/>` : `<circle cx="${x}" cy="${y}" r="2" fill="#000" stroke="#fff" stroke-opacity=".7"/>`;
    }
    const lab = t >= SKIN_INF ? '∞' : t <= 4 ? '1' + '0'.repeat(t) : '1·0' + String(t).split('').map(c => '₀₁₂₃₄₅₆₇₈₉'[c]).join('');
    return s + `<text y="${t >= SKIN_INF ? d * .1 : 3}" text-anchor="middle" font-size="${t >= SKIN_INF ? d * .28 : Math.max(7, d * .13)}" font-weight="300" fill="#fff">${lab}</text>`;
  },
  PIXEL(t, d) {
    const cell = Math.max(4, Math.round(d / 9)), n = Math.floor(d / cell), r = n / 2, even = t % 2 === 0 || t >= SKIN_INF;
    const off = -n * cell / 2;
    let s = '';
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const dist = Math.hypot(i + .5 - r, j + .5 - r), inside = dist <= r, edge = inside && dist > r - 1.2;
      if (even ? inside : edge) s += `<rect x="${off + i * cell}" y="${off + j * cell}" width="${cell - 1}" height="${cell - 1}" fill="#fff" fill-opacity="${t >= SKIN_INF && (i + j) % 2 ? .5 : 1}"/>`;
    }
    if (t >= SKIN_INF) s += `<text y="${d * .1}" text-anchor="middle" font-size="${d * .28}" font-weight="500" fill="#000">∞</text>`;
    return s;
  },
  ASCII(t, d) {
    const k = Math.min(t, 3), val = t >= SKIN_INF ? '∞' : skinFmt(2 ** t);
    const str = t >= SKIN_INF ? '{{∞}}' : '['.repeat(k) + val + ']'.repeat(k) + (t > 3 ? '⁺'.repeat(Math.min(t - 3, 3)) : '');
    const fs = Math.max(8, Math.min(16, (d * 1.5) / Math.max(3, str.length)));
    return `<text y="${fs / 3}" text-anchor="middle" font-size="${fs.toFixed(1)}" font-weight="${t % 2 ? 300 : 500}" fill="#fff">${str}</text>` +
      (t >= 10 ? `<line x1="${-d / 3}" x2="${d / 3}" y1="${d / 3}" y2="${d / 3}" stroke="#fff" stroke-opacity=".4"/>` : '');
  },
  HALFTONE(t, d) {
    const gap = t >= SKIN_INF ? 3.2 : Math.max(3.4, d / (2.2 + t * .55)), r = d / 2 - 3, dot = t >= SKIN_INF ? 1.1 : Math.min(1.25, .6 + t * .04);
    let s = `<circle r="${d / 2 - 1}" fill="none" stroke="#fff" stroke-opacity=".6" ${t >= SKIN_INF ? GLOW : ''}/>`;
    for (let x = -r; x <= r; x += gap) for (let y = -r; y <= r; y += gap) if (Math.hypot(x, y) <= r) s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${dot}" fill="#fff"/>`;
    return s;
  },
  SUMI(t, d) {
    const sw = Math.max(2, d * .1), r = d / 2 - sw / 2, a0 = -1.2, a1 = a0 + Math.PI * 2 - .55;
    const p = a => `${(r * Math.cos(a)).toFixed(1)} ${(r * Math.sin(a)).toFixed(1)}`;
    const fs = Math.max(9, Math.min(22, d / 3.2));
    return `<path d="M ${p(a0)} A ${r} ${r} 0 1 1 ${p(a1)}" fill="none" stroke="#fff" stroke-width="${sw}" stroke-linecap="round" ${t >= SKIN_INF ? GLOW : ''}/>
      <text y="${fs / 3}" text-anchor="middle" font-size="${fs}" fill="#fff" style="font-family:'Noto Sans JP',sans-serif">${t >= SKIN_INF ? '無' : SKIN_KANJI[t]}</text>`;
  },
};

const skinCache = new Map();
function skinSVG(skin, t, d) {
  d = Math.round(d);
  const key = `${skin}|${t}|${d}`;
  let s = skinCache.get(key);
  if (!s) {
    const draw = SKIN_DRAW[skin] || SKIN_DRAW.CIRCLE;
    s = `<svg class="sk" viewBox="${-d / 2} ${-d / 2} ${d} ${d}" width="100%" height="100%" overflow="visible">${draw(t, d)}</svg>`;
    if (skinCache.size > 600) skinCache.clear();
    skinCache.set(key, s);
  }
  return s;
}

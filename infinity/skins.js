'use strict';

// =====================================================
//  スキン：白と黒だけで「形の言語」を変える（見た目のみ）
// =====================================================

// ∞ は描画用の目印（次元ごとに上限が変わるので、skinSVG が ∞ かどうかを判定して渡す）
const SKIN_INF = 999;
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

const KANJI_D = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
// 漢数字（0〜99）
function kanjiNum(n) {
  if (n < 10) return KANJI_D[n];
  const tens = Math.floor(n / 10), ones = n % 10;
  return (tens > 1 ? KANJI_D[tens] : '') + '十' + (ones ? KANJI_D[ones] : '');
}
const skinFmt = n => {
  if (n < 1000) return String(n);
  const u = ['K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
  const e = Math.floor(Math.log10(n) / 3);
  return e - 1 < u.length ? +(n / 1000 ** e).toFixed(1) + u[e - 1] : n.toExponential(1).replace('+', '');
};
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
      <text y="${fs / 3}" text-anchor="middle" font-size="${fs}" fill="#fff" style="font-family:'Noto Sans JP',sans-serif">${t >= SKIN_INF ? '無' : kanjiNum(t)}</text>`;
  },
};

// ---------- RARE（手作り）追加分 ----------
Object.assign(SKIN_DRAW, {
  MOON(t, d) {
    const r = d / 2 - 1, ph = t >= SKIN_INF ? 1 : (t % 8) / 8;
    const off = (ph * 2 - 1) * r * 1.1;
    if (t >= SKIN_INF) return `<circle r="${r}" fill="#fff" ${GLOW}/><text y="${d * .1}" text-anchor="middle" font-size="${d * .3}" font-weight="100" fill="#000">∞</text>`;
    return `<circle r="${r}" fill="none" stroke="#fff" stroke-opacity=".4"/>
      <path d="M 0 ${-r} A ${r} ${r} 0 1 1 0 ${r} A ${Math.abs(off).toFixed(1)} ${r} 0 1 ${off > 0 ? 0 : 1} 0 ${-r} Z" fill="#fff"/>
      <text x="${-r * .45}" y="${d * .08}" text-anchor="middle" font-size="${Math.max(7, d * .16)}" font-weight="500" fill="#fff">${skinFmt(2 ** t)}</text>`;
  },
  TARGET(t, d) {
    const n = t >= SKIN_INF ? 6 : Math.min(5, 1 + Math.floor(t / 4)), r = d / 2 - 1;
    let s = '';
    for (let k = n; k >= 1; k--) s += `<circle r="${(r * k / n).toFixed(1)}" fill="${k % 2 ? '#fff' : '#000'}" stroke="#fff" stroke-width="1"/>`;
    s += `<line x1="${-r - 4}" x2="${r + 4}" stroke="#fff" stroke-opacity=".5"/><line y1="${-r - 4}" y2="${r + 4}" stroke="#fff" stroke-opacity=".5"/>`;
    return s + (t >= SKIN_INF ? `<circle r="${r}" fill="none" stroke="#fff" stroke-width="2" ${GLOW}/>` : '');
  },
  CLOCK(t, d) {
    const r = d / 2 - 1, n = t >= SKIN_INF ? 60 : Math.max(1, Math.min(60, t * 3));
    let s = `<circle r="${r}" fill="none" stroke="#fff" stroke-width="1.2"/>`;
    for (let k = 0; k < 60; k++) {
      const a = -Math.PI / 2 + k * Math.PI / 30, on = k < n, l = k % 5 ? .1 : .2;
      s += `<line x1="${(Math.cos(a) * r * (1 - l)).toFixed(1)}" y1="${(Math.sin(a) * r * (1 - l)).toFixed(1)}" x2="${(Math.cos(a) * r).toFixed(1)}" y2="${(Math.sin(a) * r).toFixed(1)}" stroke="#fff" stroke-opacity="${on ? 1 : .15}"/>`;
    }
    const lab = t >= SKIN_INF ? '∞' : skinFmt(2 ** t);
    return s + `<text y="${d * .08}" text-anchor="middle" font-size="${Math.max(7, Math.min(14, d * .2))}" font-weight="300" fill="#fff">${lab}</text>`;
  },
  DICE(t, d) {
    const h = d * .42, n = t >= SKIN_INF ? 9 : (t % 9) + 1;
    const P = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]], 7: [[-1, -1], [1, -1], [-1, 0], [0, 0], [1, 0], [-1, 1], [1, 1]], 8: [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]], 9: [[-1, -1], [0, -1], [1, -1], [-1, 0], [0, 0], [1, 0], [-1, 1], [0, 1], [1, 1]] };
    const even = t % 2 === 0;
    let s = `<rect x="${-h}" y="${-h}" width="${h * 2}" height="${h * 2}" rx="${h * .3}" fill="${even ? '#fff' : 'none'}" stroke="#fff" stroke-width="1.5" ${t >= SKIN_INF ? GLOW : ''}/>`;
    for (const [x, y] of P[n]) s += `<circle cx="${(x * h * .5).toFixed(1)}" cy="${(y * h * .5).toFixed(1)}" r="${Math.max(1.2, h * .12).toFixed(1)}" fill="${even ? '#000' : '#fff'}"/>`;
    return s;
  },
  STAR(t, d) {
    const n = t >= SKIN_INF ? 12 : Math.max(4, Math.min(12, 4 + Math.floor(t / 2))), R = d / 2 - 1, r = R * .45, even = t % 2 === 0;
    const pts = Array.from({ length: n * 2 }, (_, k) => { const a = -Math.PI / 2 + k * Math.PI / n, rr = k % 2 ? r : R; return `${(Math.cos(a) * rr).toFixed(1)},${(Math.sin(a) * rr).toFixed(1)}`; }).join(' ');
    return `<polygon points="${pts}" fill="${even ? '#fff' : 'none'}" stroke="#fff" stroke-width="1.3" stroke-linejoin="round" ${t >= SKIN_INF ? GLOW : ''}/>
      <text y="${d * .08}" text-anchor="middle" font-size="${Math.max(6, d * .14)}" font-weight="500" fill="${even ? '#000' : '#fff'}">${t >= SKIN_INF ? '∞' : skinFmt(2 ** t)}</text>`;
  },
});

// ---------- LEGEND（色つき・オーラ・キラキラ） ----------
const LEGEND_FX = {
  AURORA: { grad: 'lgAurora', text: '#fff' },
  PRISM: { grad: 'lgPrism', text: '#fff' },
  EMBER: { grad: 'lgEmber', text: '#fff' },
  NEON: { grad: 'lgNeon', text: '#001' },
  GOLD: { grad: 'lgGold', text: '#2a1a00' },
  NOVA: { grad: 'lgNova', text: '#fff' },
};
function legendDraw(id) {
  const fx = LEGEND_FX[id];
  return (t, d) => {
    const r = d / 2 - 1, lab = t >= SKIN_INF ? '∞' : skinFmt(2 ** t);
    const fs = t >= SKIN_INF ? d * .32 : Math.max(8, Math.min(15, d * .22));
    let shape;
    if (id === 'PRISM') {
      const pts = Array.from({ length: 6 }, (_, k) => { const a = -Math.PI / 2 + k * Math.PI / 3; return `${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r).toFixed(1)}`; }).join(' ');
      shape = `<polygon points="${pts}" fill="url(#${fx.grad})" stroke="#fff" stroke-opacity=".8" stroke-width="1"/>`;
    } else if (id === 'NOVA') {
      shape = Array.from({ length: 8 }, (_, k) => { const a = k * Math.PI / 4; return `<line x2="${(Math.cos(a) * (r + 6)).toFixed(1)}" y2="${(Math.sin(a) * (r + 6)).toFixed(1)}" stroke="url(#${fx.grad})" stroke-width="1.5"/>`; }).join('') + `<circle r="${r * .82}" fill="url(#${fx.grad})"/>`;
    } else {
      shape = `<circle r="${r}" fill="url(#${fx.grad})"/>`;
    }
    const ring = t >= 10 || t >= SKIN_INF ? `<circle r="${r + 5}" fill="none" stroke="url(#${fx.grad})" stroke-width="1.2" stroke-dasharray="2 3"/>` : '';
    return `${ring}${shape}<text y="${fs / 3}" text-anchor="middle" font-size="${fs.toFixed(1)}" font-weight="${t >= SKIN_INF ? 100 : 500}" fill="${fx.text}">${lab}</text>`;
  };
}
Object.keys(LEGEND_FX).forEach(id => (SKIN_DRAW[id] = legendDraw(id)));

// ---------- COMMON（パーツの組み合わせで自動生成：6×6×5×4＝720種） ----------
const GEN_SHAPES = ['円', '角', '菱', '六角', '星', '円相'], GEN_SHAPES_EN = ['Round', 'Square', 'Diamond', 'Hex', 'Star', 'Enso'];
const GEN_FILLS = ['塗', '線', '網', '層', '二重', '点線'], GEN_FILLS_EN = ['Solid', 'Line', 'Dots', 'Layer', 'Double', 'Dash'];
const GEN_DECOS = ['', '軌道', '目盛', '照準', '括弧'], GEN_DECOS_EN = ['', 'Orbit', 'Ticks', 'Sight', 'Bracket'];
const GEN_LABELS = ['数', '指数', '漢', '無字'], GEN_LABELS_EN = ['Num', 'Exp', 'Kanji', 'Blank'];
const GEN_COUNT = 6 * 6 * 5 * 4;
const genId = n => 'G' + String(n).padStart(3, '0');
function genParts(id) {
  const n = Number(id.slice(1));
  return { shape: n % 6, fill: Math.floor(n / 6) % 6, deco: Math.floor(n / 36) % 5, label: Math.floor(n / 180) % 4 };
}
function genShape(shape, R, attrs) {
  if (shape === 0) return `<circle r="${R.toFixed(1)}" ${attrs}/>`;
  if (shape === 1) return `<rect x="${(-R * .88).toFixed(1)}" y="${(-R * .88).toFixed(1)}" width="${(R * 1.76).toFixed(1)}" height="${(R * 1.76).toFixed(1)}" rx="${(R * .18).toFixed(1)}" ${attrs}/>`;
  const poly = (n, rot, inner) => Array.from({ length: inner ? n * 2 : n }, (_, k) => {
    const a = rot + k * Math.PI * 2 / (inner ? n * 2 : n), rr = inner && k % 2 ? R * inner : R;
    return `${(Math.cos(a) * rr).toFixed(1)},${(Math.sin(a) * rr).toFixed(1)}`;
  }).join(' ');
  if (shape === 2) return `<polygon points="${poly(4, -Math.PI / 2)}" ${attrs}/>`;
  if (shape === 3) return `<polygon points="${poly(6, 0)}" ${attrs}/>`;
  if (shape === 4) return `<polygon points="${poly(5, -Math.PI / 2, .5)}" stroke-linejoin="round" ${attrs}/>`;
  const a0 = -1.1, a1 = a0 + Math.PI * 2 - .6, p = a => `${(R * Math.cos(a)).toFixed(1)} ${(R * Math.sin(a)).toFixed(1)}`;
  return `<path d="M ${p(a0)} A ${R} ${R} 0 1 1 ${p(a1)}" stroke-linecap="round" ${attrs.replace(/fill="[^"]*"/, 'fill="none"')}/>`;
}
function genDraw(id) {
  const g = genParts(id);
  return (t, d) => {
    const inf = t >= SKIN_INF, R = d / 2 - 2;
    const solid = g.fill === 0 ? t % 2 === 0 || inf : g.fill === 1 ? t % 2 === 1 : false;
    const sw = g.shape === 5 ? Math.max(2, d * .09) : 1.5;
    let s = genShape(g.shape, R, `fill="${solid ? '#fff' : 'none'}" stroke="#fff" stroke-width="${sw}" ${g.fill === 5 ? 'stroke-dasharray="3 3"' : ''} ${inf ? GLOW : ''}`);
    if (g.fill === 2) { const gap = Math.max(3.2, d / (3 + (inf ? 12 : t) * .4)), rr = R * (g.shape === 4 ? .4 : .7); for (let x = -rr; x <= rr; x += gap) for (let y = -rr; y <= rr; y += gap) if (Math.hypot(x, y) <= rr) s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r=".8" fill="#fff"/>`; }
    if (g.fill === 3) s += genShape(g.shape, R * .66, 'fill="none" stroke="#fff" stroke-opacity=".7"') + genShape(g.shape, R * .33, 'fill="none" stroke="#fff" stroke-opacity=".4"');
    if (g.fill === 4) s += genShape(g.shape, R * .8, 'fill="none" stroke="#fff" stroke-width="1"');
    if (g.deco === 1 && (t >= 8 || inf)) s += `<circle r="${(R + 6).toFixed(1)}" fill="none" stroke="#fff" stroke-opacity=".35" stroke-dasharray="2 4"/>`;
    if (g.deco === 2) { const n = inf ? 24 : Math.min(24, t + 1); for (let k = 0; k < n; k++) { const a = -Math.PI / 2 + k * Math.PI / 12; s += `<line x1="${(Math.cos(a) * (R + 3)).toFixed(1)}" y1="${(Math.sin(a) * (R + 3)).toFixed(1)}" x2="${(Math.cos(a) * (R + 6)).toFixed(1)}" y2="${(Math.sin(a) * (R + 6)).toFixed(1)}" stroke="#fff" stroke-opacity=".6"/>`; } }
    if (g.deco === 3) s += `<g stroke="#fff" stroke-opacity=".55"><line x1="${-R - 6}" x2="${-R + 3}"/><line x1="${R - 3}" x2="${R + 6}"/><line y1="${-R - 6}" y2="${-R + 3}"/><line y1="${R - 3}" y2="${R + 6}"/></g>`;
    if (g.deco === 4) { const q = R + 5, k = R * .4; s += `<path d="M ${-q + k} ${-q} H ${-q} V ${-q + k} M ${q - k} ${-q} H ${q} V ${-q + k} M ${-q + k} ${q} H ${-q} V ${q - k} M ${q - k} ${q} H ${q} V ${q - k}" fill="none" stroke="#fff" stroke-opacity=".6"/>`; }
    const lab = inf ? '∞' : g.label === 0 ? skinFmt(2 ** t) : g.label === 1 ? '2' + String(t).split('').map(c => '⁰¹²³⁴⁵⁶⁷⁸⁹'[c]).join('') : g.label === 2 ? kanjiNum(t) : '';
    if (lab) {
      const fs = inf ? d * .3 : Math.max(7, Math.min(14, d * (g.label === 2 ? .22 : .2)));
      const fill = solid && g.fill !== 2 ? '#000' : '#fff';
      s += `<text y="${(fs / 3).toFixed(1)}" text-anchor="middle" font-size="${fs.toFixed(1)}" font-weight="${inf ? 100 : 500}" fill="${fill}" ${g.label === 2 && !inf ? `style="font-family:'Noto Sans JP',sans-serif"` : ''}>${lab}</text>`;
    }
    return s;
  };
}

// ---------- ガチャのカタログ ----------
const RARE_SKINS = ['POLYGON', 'ORBIT', 'BINARY', 'PIXEL', 'ASCII', 'HALFTONE', 'MOON', 'TARGET', 'CLOCK', 'DICE', 'STAR'];
const LEGEND_SKINS = Object.keys(LEGEND_FX);
const SKIN_META = {
  CIRCLE: ['円', 'Circle'], POLYGON: ['多角形', 'Polygon'], ORBIT: ['軌道', 'Orbit'], BINARY: ['二進', 'Binary'], PIXEL: ['画素', 'Pixel'],
  ASCII: ['記号', 'ASCII'], HALFTONE: ['網点', 'Halftone'], SUMI: ['墨', 'Sumi'], MOON: ['月相', 'Moon'], TARGET: ['標的', 'Target'],
  CLOCK: ['時計', 'Clock'], DICE: ['賽', 'Dice'], STAR: ['星', 'Star'],
  AURORA: ['極光', 'Aurora'], PRISM: ['分光', 'Prism'], EMBER: ['熾火', 'Ember'], NEON: ['電光', 'Neon'], GOLD: ['黄金', 'Gold'], NOVA: ['新星', 'Nova'],
};
const BG_LIST = [
  { id: 'DOTS', r: 'C', jp: '点', en: 'Dots' }, { id: 'BLANK', r: 'C', jp: '無地', en: 'Blank' }, { id: 'GRID', r: 'C', jp: '方眼', en: 'Grid' },
  { id: 'LINES', r: 'C', jp: '罫線', en: 'Lines' }, { id: 'DIAG', r: 'C', jp: '斜線', en: 'Diagonal' }, { id: 'CROSS', r: 'C', jp: '十字', en: 'Cross' },
  { id: 'CONTOUR', r: 'R', jp: '等高線', en: 'Contour' }, { id: 'STARS', r: 'R', jp: '星空', en: 'Stars' }, { id: 'WAVE', r: 'R', jp: '波', en: 'Wave' },
  { id: 'NOISE', r: 'R', jp: '砂嵐', en: 'Noise' },
  { id: 'AURORA', r: 'L', jp: '極光', en: 'Aurora' }, { id: 'GALAXY', r: 'L', jp: '銀河', en: 'Galaxy' },
];
const RARITY_NAME = { C: 'COMMON', R: 'RARE', L: 'LEGEND', S: 'SPECIAL' };

function skinRarity(id) {
  if (id === 'CIRCLE' || /^G\d{3}$/.test(id)) return 'C';
  if (RARE_SKINS.includes(id)) return 'R';
  if (LEGEND_SKINS.includes(id)) return 'L';
  if (id === 'SUMI') return 'S';
  return null;
}
const isSkinId = id => typeof id === 'string' && (skinRarity(id) !== null) && (!/^G/.test(id) || Number(id.slice(1)) < GEN_COUNT);
const isBgId = id => BG_LIST.some(b => b.id === id);
function skinName(id, ja) {
  if (/^G\d{3}$/.test(id)) {
    const g = genParts(id);
    return ja ? `${GEN_SHAPES[g.shape]}・${GEN_FILLS[g.fill]}${GEN_DECOS[g.deco] ? '・' + GEN_DECOS[g.deco] : ''}・${GEN_LABELS[g.label]}`
      : `${GEN_SHAPES_EN[g.shape]} ${GEN_FILLS_EN[g.fill]}${GEN_DECOS_EN[g.deco] ? ' ' + GEN_DECOS_EN[g.deco] : ''} ${GEN_LABELS_EN[g.label]}`;
  }
  const m = SKIN_META[id];
  return m ? m[ja ? 0 : 1] : id;
}
const bgName = (id, ja) => { const b = BG_LIST.find(x => x.id === id); return b ? (ja ? b.jp : b.en) : id; };
const bgRarity = id => { const b = BG_LIST.find(x => x.id === id); return b ? b.r : 'C'; };
const skinClass = id => (LEGEND_SKINS.includes(id) ? `legend lg-${id}` : '');

const skinCache = new Map();
function skinSVG(skin, t, d, inf = 20) {
  d = Math.round(d);
  const tt = t >= inf ? SKIN_INF : t;
  const key = `${skin}|${tt}|${d}`;
  let s = skinCache.get(key);
  if (!s) {
    let draw = SKIN_DRAW[skin];
    if (!draw && /^G\d{3}$/.test(skin)) draw = SKIN_DRAW[skin] = genDraw(skin);
    draw = draw || SKIN_DRAW.CIRCLE;
    s = `<svg class="sk" viewBox="${-d / 2} ${-d / 2} ${d} ${d}" width="100%" height="100%" overflow="visible">${draw(tt, d)}</svg>`;
    if (skinCache.size > 900) skinCache.clear();
    skinCache.set(key, s);
  }
  return s;
}

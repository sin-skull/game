'use strict';

// =====================================================
//  墨絵のキャラと小物（SVG）。和紙の上に筆で描いた、巻物の中のお話し
//  ・筆のゆらぎ：feTurbulence＋feDisplacementMap で線をふるわせる
//  ・にじみ：うすい墨を少しぼかして重ねる
//  ・色は墨（黒〜灰）と、朱（ハンコの赤）だけ
// =====================================================

const Ink = (() => {
  const SUMI = '#1a1714', USU = '#5a534b', SHU = '#c8321e';
  let seq = 0;
  const id = () => 'k' + (seq++).toString(36) + Math.random().toString(36).slice(2, 5);
  // 筆のゆらぎ（scale が大きいほど荒い）と、にじみ
  const defs = (k, rough = 2.2, seed = 3) => `<defs>
    <filter id="${k}f" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="${seed}" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="${rough}"/></filter>
    <filter id="${k}w" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency="0.08" numOctaves="3" seed="${seed + 7}" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="7" result="d"/><feGaussianBlur in="d" stdDeviation="1.6"/></filter>
    <filter id="${k}d" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.9 0.08" numOctaves="1" seed="${seed + 3}" result="t"/><feColorMatrix in="t" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.2 1.6" result="m"/><feComposite in="SourceGraphic" in2="m" operator="in" result="c"/><feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="${seed}" result="n"/><feDisplacementMap in="c" in2="n" scale="${rough}"/></filter>
  </defs>`;
  const svg = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${body}</svg>`;

  // 墨のグラデーション（濃い縁 → うすい中）。水墨の「ぼかし」
  const sumiGrad = (k, dark = .95, mid = .45, tint = SUMI) => `<linearGradient id="${k}g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${tint}" stop-opacity="${dark}"/><stop offset=".5" stop-color="${tint === SUMI ? USU : tint}" stop-opacity="${mid}"/><stop offset="1" stop-color="${tint}" stop-opacity="${dark}"/></linearGradient>
    <radialGradient id="${k}r" cx="50%" cy="35%" r="65%"><stop offset="0" stop-color="${USU}" stop-opacity=".35"/><stop offset=".7" stop-color="${SUMI}" stop-opacity=".8"/><stop offset="1" stop-color="${SUMI}" stop-opacity="1"/></radialGradient>`;
  const addDefs = (d, extra) => d.replace('</defs>', extra + '</defs>');
  // 墨の飛び散り
  const splat = (k, pts, col = SUMI) => `<g fill="${col}" filter="url(#${k}w)">${pts.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')}</g>`;

  // ---------- 主人公：ワニ（鳥獣戯画ふう。上から見て、画面の上へ歩いていく）----------
  // f = 0..3 歩き。mood = normal / happy / hurt
  // tint：体の墨の色（スキン。藍・臙脂などの伝統色）
  function croc(f = 0, mood = 'normal', tint = SUMI) {
    const k = id(), s = [1, 0, -1, 0][f % 4], sway = s * 8;
    const leg = (x, y, dir, ph) => { const t = ph * 7; return `<path d="M${x} ${y} q${dir * 11} ${-5 + t} ${dir * 19} ${1 + t}" stroke-width="7"/><path d="M${x + dir * 19} ${y + 1 + t} l${dir * 4} -4 m${-dir * 4} 4 l${dir * 6} 1 m${-dir * 6} -1 l${dir * 3} 5" stroke-width="2.4"/>`; };
    const tail = `M60 122 C ${58 + sway * .3} 146, ${62 - sway} 166, ${60 + sway * 1.6} 194`;
    const eye = (x, flip) => mood === 'happy' ? `<path d="M${x - 6} ${56} q6 -8 12 0" stroke="${SUMI}" stroke-width="3.4" fill="none"/>`
      : mood === 'hurt' ? `<path d="M${x - 5 * flip} 50 l${10 * flip} 5 l${-10 * flip} 5" stroke="${SUMI}" stroke-width="3.2" fill="none"/>`
        : `<ellipse cx="${x}" cy="55" rx="7" ry="6" fill="#f3ead6" stroke="${SUMI}" stroke-width="3"/><circle cx="${x + flip}" cy="53.5" r="3" fill="${SUMI}"/>`;
    return svg(120, 200, addDefs(defs(k, 3.2, 5 + f), sumiGrad(k, .95, .45, tint)) + `
  <ellipse cx="60" cy="192" rx="30" ry="5" fill="${USU}" opacity=".2" filter="url(#${k}w)"/>
  <g filter="url(#${k}f)" stroke="${SUMI}" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <path d="${tail}" stroke-width="16"/><path d="${tail}" stroke="#8a8074" stroke-width="9"/>
    ${leg(36, 82 - s * 6, -1, s)}${leg(84, 82 + s * 6, 1, -s)}${leg(38, 118 + s * 6, -1, -s)}${leg(82, 118 - s * 6, 1, s)}
  </g>
  <g filter="url(#${k}w)"><path d="M40 68 C 36 46, 46 32, 60 32 C 74 32, 84 46, 80 68 C 86 88, 84 112, 72 126 C 64 132, 56 132, 48 126 C 36 112, 34 88, 40 68 Z" fill="url(#${k}g)"/>
    <path d="M51 34 C 49 16, 55 5, 60 4 C 65 5, 71 16, 69 34 Z" fill="url(#${k}g)"/></g>
  <g filter="url(#${k}f)" fill="none" stroke="${SUMI}" stroke-linecap="round" stroke-linejoin="round">
    <path d="M40 68 C 36 46, 46 32, 60 32 C 74 32, 84 46, 80 68 C 86 88, 84 112, 72 126 C 64 132, 56 132, 48 126 C 36 112, 34 88, 40 68 Z" stroke-width="4.5"/>
    <path d="M51 34 C 49 16, 55 5, 60 4 C 65 5, 71 16, 69 34" stroke-width="4"/>
    <g stroke="#f3ead6" stroke-width="2.4" opacity=".85">${[[50, 80], [70, 80], [47, 94], [73, 94], [49, 108], [71, 108], [60, 88], [60, 102], [60, 116]].map(([x, y]) => `<path d="M${x - 3.5} ${y} l3.5 -3.5 l3.5 3.5"/>`).join('')}</g>
    <g stroke="#f3ead6" stroke-width="2">${[146, 160, 174].map((y, i) => `<path d="M${57 + sway * (i * .45)} ${y} l3 -4 l3 4"/>`).join('')}</g>
    <path d="M55 12 l1.5 2 M65 12 l-1.5 2" stroke="#f3ead6" stroke-width="2.4"/>
    ${mood === 'happy' ? `<path d="M52 26 q8 8 16 0" stroke="#f3ead6" stroke-width="3"/>` : ''}
  </g>
  <g filter="url(#${k}f)">${eye(47, 1)}${eye(73, -1)}</g>
  ${mood === 'hurt' ? `<path d="M92 40 q7 9 0 14 q-7 -5 0 -14 z" fill="none" stroke="${SUMI}" stroke-width="2" filter="url(#${k}f)"/>` : ''}
  ${mood === 'happy' ? splat(k, [[22, 44, 3], [100, 38, 2.6], [96, 60, 1.6]], SHU) : ''}`);
  }

  // ---------- 魚：上から見て、こちらへ泳いでくる（筆の数画）。gold なら朱 ----------
  function fish(f = 0, gold = false) {
    const k = id(), s = Math.sin((f % 4) / 4 * Math.PI * 2), t = s * 7;
    const col = gold ? SHU : SUMI;
    return svg(48, 66, addDefs(defs(k, 2.2, 11 + f), `<linearGradient id="${k}g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${col}" stop-opacity=".95"/><stop offset=".55" stop-color="${gold ? '#e8704a' : USU}" stop-opacity=".5"/><stop offset="1" stop-color="${col}" stop-opacity=".9"/></linearGradient>`) + `
  <g filter="url(#${k}f)" stroke="${col}" stroke-linecap="round" fill="none">
    <path d="M24 18 Q${17 + t} 10 ${14 + t} 2 M24 18 Q${31 + t} 10 ${34 + t} 2" stroke-width="3.4"/>
    <path d="M14 36 l-10 ${-4 + t * .6} M34 36 l10 ${-4 - t * .6}" stroke-width="3"/>
  </g>
  <path d="M24 16 C 36 24, 36 46, 24 60 C 12 46, 12 24, 24 16 Z" fill="url(#${k}g)" filter="url(#${k}w)"/>
  <path d="M24 16 C 36 24, 36 46, 24 60 C 12 46, 12 24, 24 16 Z" fill="none" stroke="${col}" stroke-width="2.6" filter="url(#${k}f)"/>
  <path d="M18 30 q6 -3 12 0" stroke="#f3ead6" stroke-width="1.6" fill="none" opacity=".7"/>
  <g fill="#f3ead6"><circle cx="19" cy="49" r="2.6"/><circle cx="29" cy="49" r="2.6"/></g><g fill="${SUMI}"><circle cx="19" cy="49.5" r="1.3"/><circle cx="29" cy="49.5" r="1.3"/></g>`);
  }

  // ---------- ボス：大蛸（墨で大きく）。mood = normal / hurt / dead ----------
  function octo(f = 0, mood = 'normal') {
    const k = id(), w = f % 2 ? 7 : -7;
    const arm = (x, dir) => `M${100 + (x - 100) * .45} 116 C ${x + dir * 6 + w} 140, ${x - dir * 16 - w} 162, ${x + dir * 12} 184 q${dir * 9} 7 ${dir * 2} 13`;
    const arms = [30, 56, 82, 118, 144, 170].map((x, i) => arm(x, i < 3 ? -1 : 1));
    const eyes = mood === 'dead' ? `<g stroke="${SUMI}" stroke-width="5" stroke-linecap="round"><path d="M66 80 l16 12 m0 -12 l-16 12 M118 80 l16 12 m0 -12 l-16 12"/></g>`
      : mood === 'hurt' ? `<g stroke="${SUMI}" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M66 78 l16 8 l-16 8 M134 78 l-16 8 l16 8"/></g>`
        : `<g stroke="${SUMI}" stroke-linecap="round"><path d="M58 70 L88 82 M142 70 L112 82" stroke-width="8"/></g><g stroke="${SUMI}" stroke-width="3.5" fill="#f3ead6"><ellipse cx="76" cy="92" rx="11" ry="9"/><ellipse cx="124" cy="92" rx="11" ry="9"/></g><g fill="${SUMI}"><circle cx="78" cy="94" r="5"/><circle cx="122" cy="94" r="5"/></g><g fill="${SHU}"><circle cx="78" cy="94" r="1.6"/><circle cx="122" cy="94" r="1.6"/></g>`;
    return svg(200, 204, addDefs(defs(k, 3.6, 21 + f), sumiGrad(k)) + `
  ${splat(k, [[20, 40, 4], [180, 30, 3], [170, 60, 2], [26, 70, 2.4], [150, 10, 2]])}
  <g filter="url(#${k}f)" stroke="${SUMI}" stroke-linecap="round" fill="none">${arms.map(d => `<path d="${d}" stroke-width="15"/>`).join('')}</g>
  <g filter="url(#${k}w)" stroke="#9a9084" stroke-linecap="round" fill="none" opacity=".95">${arms.map(d => `<path d="${d}" stroke-width="7"/>`).join('')}</g>
  <path d="M40 90 C 30 28, 80 10, 100 12 C 120 10, 170 28, 160 90 C 158 116, 132 124, 100 124 C 68 124, 42 116, 40 90 Z" fill="url(#${k}r)" filter="url(#${k}w)"/>
  <path d="M52 40 C 60 24, 90 16, 110 18" stroke="#f3ead6" stroke-width="5" fill="none" opacity=".45" filter="url(#${k}d)"/>
  <path d="M40 90 C 30 28, 80 10, 100 12 C 120 10, 170 28, 160 90 C 158 116, 132 124, 100 124 C 68 124, 42 116, 40 90 Z" fill="none" stroke="${SUMI}" stroke-width="6" filter="url(#${k}f)"/>
  <g fill="#f3ead6" opacity=".55" filter="url(#${k}f)"><circle cx="74" cy="38" r="6"/><circle cx="128" cy="34" r="4"/><circle cx="140" cy="56" r="3.5"/><circle cx="60" cy="56" r="3"/></g>
  <g filter="url(#${k}f)">${eyes}<path d="M${mood === 'normal' ? '86 112 q14 -9 28 0' : '92 112 q8 -4 16 0'}" stroke="${SUMI}" stroke-width="4.5" fill="none" stroke-linecap="round"/></g>`);
  }

  // ---------- ボス（10体）----------
  // 伝承に出てくる海の怪異（蟹坊主・磯撫で・赤えい・海坊主）と、大きな魚。神仏や信仰の対象は敵にしない
  // どれも正面・こちら向き。f は揺れ、mood = normal / hurt / dead
  const PAPER = '#f3ead6';
  function eyesInk(x1, x2, y, r, mood) {
    if (mood === 'dead') return `<g stroke="${SUMI}" stroke-width="${r * .45}" stroke-linecap="round"><path d="M${x1 - r} ${y - r * .8} l${r * 2} ${r * 1.6} m0 ${-r * 1.6} l${-r * 2} ${r * 1.6} M${x2 - r} ${y - r * .8} l${r * 2} ${r * 1.6} m0 ${-r * 1.6} l${-r * 2} ${r * 1.6}"/></g>`;
    if (mood === 'hurt') return `<g stroke="${SUMI}" stroke-width="${r * .45}" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M${x1 - r} ${y - r * .7} l${r * 1.8} ${r * .7} l${-r * 1.8} ${r * .7} M${x2 + r} ${y - r * .7} l${-r * 1.8} ${r * .7} l${r * 1.8} ${r * .7}"/></g>`;
    return `<g stroke="${SUMI}" stroke-linecap="round"><path d="M${x1 - r * 1.5} ${y - r * 1.6} L${x1 + r * 1.1} ${y - r * .75} M${x2 + r * 1.5} ${y - r * 1.6} L${x2 - r * 1.1} ${y - r * .75}" stroke-width="${r * .7}"/></g>
      <g stroke="${SUMI}" stroke-width="${r * .32}" fill="${PAPER}"><ellipse cx="${x1}" cy="${y}" rx="${r}" ry="${r * .82}"/><ellipse cx="${x2}" cy="${y}" rx="${r}" ry="${r * .82}"/></g>
      <g fill="${SUMI}"><circle cx="${x1 + r * .2}" cy="${y + r * .15}" r="${r * .45}"/><circle cx="${x2 - r * .2}" cy="${y + r * .15}" r="${r * .45}"/></g><g fill="${SHU}"><circle cx="${x1 + r * .2}" cy="${y + r * .15}" r="${r * .14}"/><circle cx="${x2 - r * .2}" cy="${y + r * .15}" r="${r * .14}"/></g>`;
  }
  function mouthInk(x, y, w, mood, teeth = false) {
    if (mood !== 'normal') return `<path d="M${x - w * .5} ${y} q${w * .25} ${-w * .25} ${w * .5} 0 t${w * .5} 0" stroke="${SUMI}" stroke-width="4" fill="none" stroke-linecap="round"/>`;
    const t = teeth ? `<g fill="${PAPER}" stroke="${SUMI}" stroke-width="1.4">${Array.from({ length: 6 }, (_, i) => `<path d="M${x - w + 4 + i * (w * 2 - 8) / 6} ${y + 1} l${(w * 2 - 8) / 12} ${w * .28} l${(w * 2 - 8) / 12} ${-w * .28} z"/>`).join('')}</g>` : '';
    return `<path d="M${x - w} ${y} Q${x} ${y + w * .75} ${x + w} ${y} Q${x} ${y + w * .3} ${x - w} ${y} Z" fill="${SUMI}" stroke="${SUMI}" stroke-width="3" stroke-linejoin="round"/>${t}`;
  }
  // 体：うすい墨のにじみ＋筆の縁
  const bodyInk = (k, d, sw = 5.5, fill = `url(#${k}r)`) => `<path d="${d}" fill="${fill}" filter="url(#${k}w)"/><path d="${d}" fill="none" stroke="${SUMI}" stroke-width="${sw}" stroke-linejoin="round" filter="url(#${k}f)"/>`;
  const strokes = (k, list, w = 5, col = SUMI) => `<g filter="url(#${k}f)" stroke="${col}" stroke-linecap="round" stroke-linejoin="round" fill="none" stroke-width="${w}">${list.map(d => `<path d="${d}"/>`).join('')}</g>`;
  const washStrokes = (k, list, w = 12, col = '#9a9084') => `<g filter="url(#${k}w)" stroke="${col}" stroke-linecap="round" fill="none" stroke-width="${w}">${list.map(d => `<path d="${d}"/>`).join('')}</g>`;

  const BOSSES = [
    { id: 'puffer', ja: '大河豚', en: 'Great Puffer', draw(k, f, m) {
      const p = f % 2 ? 1.04 : 1;
      const sp = Array.from({ length: 16 }, (_, i) => { const a = i / 16 * 6.283, r1 = 60 * p, r2 = 74 * p; return `M${100 + Math.cos(a) * r1} ${104 + Math.sin(a) * r1} L${100 + Math.cos(a) * r2} ${104 + Math.sin(a) * r2}`; });
      return strokes(k, sp, 4) + strokes(k, ['M36 96 l-24 -14 m24 14 l-22 8', 'M164 96 l24 -14 m-24 14 l22 8'], 4) +
        bodyInk(k, `M${100 - 60 * p} 104 a${60 * p} ${60 * p} 0 1 0 ${120 * p} 0 a${60 * p} ${60 * p} 0 1 0 ${-120 * p} 0`) +
        `<path d="M58 130 q42 26 84 0" stroke="${PAPER}" stroke-width="10" fill="none" opacity=".6" filter="url(#${k}w)"/>` + eyesInk(76, 124, 96, 11, m) + mouthInk(100, 126, 12, m);
    } },
    { id: 'jelly', ja: '大水母', en: 'Great Jelly', draw(k, f, m) {
      const w = f % 2 ? 6 : -6;
      const ten = [52, 74, 100, 126, 148].map((x, i) => `M${x} 112 q${w + (i % 2 ? 9 : -9)} 22 0 42 q${-w} 20 ${i % 2 ? 7 : -7} 36`);
      return washStrokes(k, ten, 9, '#b8aea0') + strokes(k, ten, 3) +
        bodyInk(k, 'M34 116 Q34 24 100 24 Q166 24 166 116 Q150 104 134 116 Q118 104 100 116 Q82 104 66 116 Q50 104 34 116 Z', 5, `url(#${k}r)`) +
        eyesInk(78, 122, 76, 11, m) + mouthInk(100, 96, 10, m);
    } },
    { id: 'octo', ja: '大蛸', en: 'Great Octopus', draw(k, f, m) {
      const w = f % 2 ? 7 : -7;
      const arms = [30, 56, 82, 118, 144, 170].map((x, i) => { const d = i < 3 ? -1 : 1; return `M${100 + (x - 100) * .45} 116 C ${x + d * 6 + w} 140, ${x - d * 16 - w} 162, ${x + d * 12} 184 q${d * 9} 7 ${d * 2} 13`; });
      return strokes(k, arms, 15) + washStrokes(k, arms, 7) +
        bodyInk(k, 'M40 90 C 30 28, 80 10, 100 12 C 120 10, 170 28, 160 90 C 158 116, 132 124, 100 124 C 68 124, 42 116, 40 90 Z', 6) +
        `<g fill="${PAPER}" opacity=".5" filter="url(#${k}f)"><circle cx="74" cy="38" r="6"/><circle cx="128" cy="34" r="4"/><circle cx="140" cy="56" r="3.5"/></g>` +
        eyesInk(76, 124, 92, 11, m) + mouthInk(100, 112, 12, m);
    } },
    { id: 'crab', ja: '蟹坊主', en: 'Kani-bozu', draw(k, f, m) {
      const up = f % 2 ? -8 : 0;
      const legs = [0, 1, 2].flatMap(i => [`M${58 - i * 4} ${130 + i * 12} l-30 ${10 + i * 7}`, `M${142 + i * 4} ${130 + i * 12} l30 ${10 + i * 7}`]);
      const claw = (x, s) => `M${x} ${64 + up} q${s * 14} -22 ${s * 34} -10 q${s * 8} 12 ${-s * 8} 20 q${s * 12} 8 ${-s * 6} 22 q${-s * 22} 0 ${-s * 20} -32 z`;
      return strokes(k, legs, 6) + strokes(k, [`M50 112 L34 ${88 + up}`, `M150 112 L166 ${88 + up}`, 'M80 100 L76 58', 'M120 100 L124 58'], 6) +
        bodyInk(k, claw(20, 1), 4.5) + bodyInk(k, claw(180, -1), 4.5) +
        bodyInk(k, 'M30 128 C 30 96, 64 84, 100 84 C 136 84, 170 96, 170 128 C 170 160, 136 172, 100 172 C 64 172, 30 160, 30 128 Z', 6) +
        eyesInk(76, 124, 52, 11, m) + mouthInk(100, 140, 14, m);
    } },
    { id: 'marlin', ja: '梶木', en: 'Great Marlin', draw(k, f, m) {
      return bodyInk(k, 'M100 6 Q128 30 122 62 L78 62 Q72 30 100 6 Z', 4.5) +
        strokes(k, [`M40 100 L10 ${84 + (f % 2 ? 6 : 0)}`, `M160 100 L190 ${84 + (f % 2 ? 6 : 0)}`], 7) +
        bodyInk(k, 'M38 104 C 38 60, 70 48, 100 48 C 130 48, 162 60, 162 104 C 162 142, 132 160, 100 160 C 68 160, 38 142, 38 104 Z', 6) +
        bodyInk(k, 'M92 156 L100 198 L108 156 Z', 4, PAPER) + eyesInk(76, 124, 98, 11, m) + mouthInk(100, 132, 11, m);
    } },
    { id: 'squid', ja: '大烏賊', en: 'Great Squid', draw(k, f, m) {
      const w = f % 2 ? 7 : -7;
      const ten = [62, 78, 94, 106, 122, 138].map((x, i) => `M${x} 140 q${i % 2 ? w : -w} 22 ${i < 3 ? -6 : 6} 46`);
      return strokes(k, ten, 12) + washStrokes(k, ten, 6, '#b8aea0') + bodyInk(k, 'M42 30 L66 18 L62 60 Z', 4) + bodyInk(k, 'M158 30 L134 18 L138 60 Z', 4) +
        bodyInk(k, 'M100 6 Q150 50 150 104 Q150 146 100 148 Q50 146 50 104 Q50 50 100 6 Z', 6) + eyesInk(80, 120, 108, 11, m) + mouthInk(100, 132, 9, m);
    } },
    { id: 'eel', ja: '大鰻', en: 'Great Eel', draw(k, f, m) {
      const c = 'M100 150 C 30 150, 18 60, 90 40 C 150 22, 192 92, 150 122';
      return strokes(k, [c], 36) + washStrokes(k, [c], 26, '#8a8074') + strokes(k, f % 2 ? ['M28 44 l12 10 l-8 4 l12 12', 'M172 40 l-12 10 l8 4 l-12 12'] : [], 3) +
        bodyInk(k, 'M48 128 C 48 94, 74 82, 100 82 C 126 82, 152 94, 152 128 C 152 162, 126 176, 100 176 C 74 176, 48 162, 48 128 Z', 6) +
        eyesInk(80, 120, 124, 10, m) + mouthInk(100, 152, 12, m);
    } },
    { id: 'shark', ja: '磯撫で', en: 'Isonade', draw(k, f, m) {
      const tail = `M150 60 C 180 30, 196 ${f % 2 ? 16 : 28}, 188 4`;
      return strokes(k, [tail], 10) + strokes(k, [`${tail.replace('M150 60', 'M186 10')}`, 'M178 22 l8 -2', 'M184 14 l8 -1'], 2.4) +
        bodyInk(k, 'M100 6 L124 50 L76 50 Z', 4.5) + strokes(k, [`M26 110 L2 ${138 + (f % 2 ? 6 : 0)} L40 128`, `M174 110 L198 ${138 + (f % 2 ? 6 : 0)} L160 128`], 5) +
        bodyInk(k, 'M20 108 C 20 60, 60 42, 100 42 C 140 42, 180 60, 180 108 C 180 150, 140 172, 100 172 C 60 172, 20 150, 20 108 Z', 6) +
        `<path d="M34 124 Q100 184 166 124 Q100 150 34 124 Z" fill="${PAPER}" opacity=".75" filter="url(#${k}w)"/>` +
        eyesInk(68, 132, 92, 10, m) + (m === 'normal' ? mouthInk(100, 130, 34, m, true) : mouthInk(100, 134, 20, m));
    } },
    { id: 'manta', ja: '赤えい', en: 'Akaei', draw(k, f, m) {
      const fl = f % 2 ? -10 : 8;
      return bodyInk(k, `M100 56 Q160 ${56 + fl} 198 ${104 + fl} Q150 118 116 148 L100 196 L84 148 Q50 118 2 ${104 + fl} Q40 ${56 + fl} 100 56 Z`, 5.5, `url(#${k}a)`) +
        strokes(k, ['M80 60 Q72 40 82 30', 'M120 60 Q128 40 118 30'], 7) +
        `<ellipse cx="100" cy="110" rx="42" ry="28" fill="${PAPER}" opacity=".6" filter="url(#${k}w)"/>` + eyesInk(78, 122, 90, 10, m) + mouthInk(100, 118, 15, m);
    } },
    { id: 'umibozu', ja: '海坊主', en: 'Umibozu', draw(k, f, m) {
      const wv = f % 2 ? 6 : 0;
      const waves = [0, 1, 2].map(i => `M${-4 + i * 12} ${168 + i * 12 + wv} q 25 -18 50 0 t 50 0 t 50 0 t 50 0 t 50 0`);
      return `<ellipse cx="100" cy="96" rx="92" ry="92" fill="${SUMI}" opacity=".12" filter="url(#${k}w)"/>` +
        bodyInk(k, 'M22 176 C 14 90, 44 14, 100 12 C 156 14, 186 90, 178 176 Z', 7, `url(#${k}b)`) +
        (m === 'normal' ? `<g filter="url(#${k}f)"><circle cx="72" cy="88" r="17" fill="${PAPER}" stroke="${SUMI}" stroke-width="4"/><circle cx="128" cy="88" r="17" fill="${PAPER}" stroke="${SUMI}" stroke-width="4"/><circle cx="72" cy="92" r="8" fill="${SUMI}"/><circle cx="128" cy="92" r="8" fill="${SUMI}"/><circle cx="72" cy="92" r="2.4" fill="${SHU}"/><circle cx="128" cy="92" r="2.4" fill="${SHU}"/></g>`
          : `<g filter="url(#${k}f)">${eyesInk(72, 128, 90, 14, m).replace(/stroke="#1a1714"/g, `stroke="${PAPER}"`)}</g>`) +
        (m === 'normal' ? `<path d="M76 134 Q100 150 124 134" stroke="${PAPER}" stroke-width="5" fill="none" filter="url(#${k}f)"/>` : `<path d="M84 138 q16 -8 32 0" stroke="${PAPER}" stroke-width="5" fill="none" filter="url(#${k}f)"/>`) +
        washStrokes(k, waves, 10, '#8a8074') + strokes(k, waves, 4);
    } },
  ];
  function boss(i, f = 0, mood = 'normal') {
    const b = BOSSES[((i % BOSSES.length) + BOSSES.length) % BOSSES.length], k = id();
    const extra = sumiGrad(k) + `<radialGradient id="${k}a" cx="50%" cy="40%" r="65%"><stop offset="0" stop-color="${SHU}" stop-opacity=".25"/><stop offset=".75" stop-color="${SHU}" stop-opacity=".6"/><stop offset="1" stop-color="${SUMI}" stop-opacity=".9"/></radialGradient>
      <radialGradient id="${k}b" cx="45%" cy="30%" r="75%"><stop offset="0" stop-color="${USU}" stop-opacity=".8"/><stop offset=".6" stop-color="${SUMI}" stop-opacity=".95"/><stop offset="1" stop-color="${SUMI}"/></radialGradient>`;
    return svg(200, 204, addDefs(defs(k, 3.4, 21 + i * 3 + f), extra) + splat(k, [[18, 40, 4], [182, 30, 3], [170, 62, 2], [26, 72, 2.4]]) + b.draw(k, f, mood));
  }
  const BOSS_IDS = BOSSES.map(b => b.id);
  const BOSS_NAME = { ja: BOSSES.map(b => b.ja), en: BOSSES.map(b => b.en) };

  // ---------- 和紙（背景）：繊維とムラ ----------
  function washi(w, h, seed = 2) {
    const k = id();
    return svg(w, h, `<defs>
    <filter id="${k}p"><feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="4" seed="${seed}"/><feColorMatrix values="0 0 0 0 .93  0 0 0 0 .89  0 0 0 0 .80  0 0 0 -.9 .95"/></filter>
    <filter id="${k}q"><feTurbulence type="fractalNoise" baseFrequency="0.9 0.03" numOctaves="2" seed="${seed + 5}"/><feColorMatrix values="0 0 0 0 .55  0 0 0 0 .48  0 0 0 0 .38  0 0 0 -3 1.4"/></filter>
  </defs><rect width="${w}" height="${h}" fill="#efe7d4"/><rect width="${w}" height="${h}" filter="url(#${k}p)" opacity=".7"/><rect width="${w}" height="${h}" filter="url(#${k}q)" opacity=".16"/>`);
  }

  // ---------- 短冊（ゲート。宗教的なお札ではない）：label は筆文字、neg ならマイナス（朱） ----------
  function fuda(w, h, neg = false) {
    const k = id();
    return svg(w, h, `${defs(k, 1.6, 31)}
  <g filter="url(#${k}w)" opacity=".25" fill="${USU}"><rect x="6" y="8" width="${w - 8}" height="${h - 8}"/></g>
  <rect x="3" y="3" width="${w - 6}" height="${h - 6}" fill="#f6efdf" stroke="${neg ? SHU : SUMI}" stroke-width="2.5" filter="url(#${k}f)"/>
  <rect x="7" y="7" width="${w - 14}" height="${h - 14}" fill="none" stroke="${neg ? SHU : SUMI}" stroke-width="1" opacity=".6" filter="url(#${k}f)"/>`);
  }

  // ---------- 落款（ハンコ）----------
  function hanko(size = 34, text = '鰐') {
    const k = id();
    return svg(size, size, `${defs(k, 1.5, 41)}<rect x="2" y="2" width="${size - 4}" height="${size - 4}" rx="3" fill="${SHU}" filter="url(#${k}f)"/><text x="${size / 2}" y="${size * .7}" text-anchor="middle" font-size="${size * .6}" font-family="'Yuji Boku', serif" fill="#f6efdf">${text}</text>`);
  }

  return { croc, fish, octo, boss, BOSS_IDS, BOSS_NAME, washi, fuda, hanko, SUMI, USU, SHU, PAPER };
})();
if (typeof window !== 'undefined') window.Ink = Ink;
if (typeof module !== 'undefined') module.exports = Ink;

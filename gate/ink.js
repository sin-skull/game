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
  const sumiGrad = (k, dark = .95, mid = .45) => `<linearGradient id="${k}g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${SUMI}" stop-opacity="${dark}"/><stop offset=".5" stop-color="${USU}" stop-opacity="${mid}"/><stop offset="1" stop-color="${SUMI}" stop-opacity="${dark}"/></linearGradient>
    <radialGradient id="${k}r" cx="50%" cy="35%" r="65%"><stop offset="0" stop-color="${USU}" stop-opacity=".35"/><stop offset=".7" stop-color="${SUMI}" stop-opacity=".8"/><stop offset="1" stop-color="${SUMI}" stop-opacity="1"/></radialGradient>`;
  const addDefs = (d, extra) => d.replace('</defs>', extra + '</defs>');
  // 墨の飛び散り
  const splat = (k, pts, col = SUMI) => `<g fill="${col}" filter="url(#${k}w)">${pts.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')}</g>`;

  // ---------- 主人公：ワニ（鳥獣戯画ふう。上から見て、画面の上へ歩いていく）----------
  // f = 0..3 歩き。mood = normal / happy / hurt
  function croc(f = 0, mood = 'normal') {
    const k = id(), s = [1, 0, -1, 0][f % 4], sway = s * 8;
    const leg = (x, y, dir, ph) => { const t = ph * 7; return `<path d="M${x} ${y} q${dir * 11} ${-5 + t} ${dir * 19} ${1 + t}" stroke-width="7"/><path d="M${x + dir * 19} ${y + 1 + t} l${dir * 4} -4 m${-dir * 4} 4 l${dir * 6} 1 m${-dir * 6} -1 l${dir * 3} 5" stroke-width="2.4"/>`; };
    const tail = `M60 122 C ${58 + sway * .3} 146, ${62 - sway} 166, ${60 + sway * 1.6} 194`;
    const eye = (x, flip) => mood === 'happy' ? `<path d="M${x - 6} ${56} q6 -8 12 0" stroke="${SUMI}" stroke-width="3.4" fill="none"/>`
      : mood === 'hurt' ? `<path d="M${x - 5 * flip} 50 l${10 * flip} 5 l${-10 * flip} 5" stroke="${SUMI}" stroke-width="3.2" fill="none"/>`
        : `<ellipse cx="${x}" cy="55" rx="7" ry="6" fill="#f3ead6" stroke="${SUMI}" stroke-width="3"/><circle cx="${x + flip}" cy="53.5" r="3" fill="${SUMI}"/>`;
    return svg(120, 200, addDefs(defs(k, 3.2, 5 + f), sumiGrad(k)) + `
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

  // ---------- 和紙（背景）：繊維とムラ ----------
  function washi(w, h, seed = 2) {
    const k = id();
    return svg(w, h, `<defs>
    <filter id="${k}p"><feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="4" seed="${seed}"/><feColorMatrix values="0 0 0 0 .93  0 0 0 0 .89  0 0 0 0 .80  0 0 0 -.9 .95"/></filter>
    <filter id="${k}q"><feTurbulence type="fractalNoise" baseFrequency="0.9 0.03" numOctaves="2" seed="${seed + 5}"/><feColorMatrix values="0 0 0 0 .55  0 0 0 0 .48  0 0 0 0 .38  0 0 0 -3 1.4"/></filter>
  </defs><rect width="${w}" height="${h}" fill="#efe7d4"/><rect width="${w}" height="${h}" filter="url(#${k}p)" opacity=".7"/><rect width="${w}" height="${h}" filter="url(#${k}q)" opacity=".16"/>`);
  }

  // ---------- お札（ゲート）：label は筆文字、neg ならマイナス（朱） ----------
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

  return { croc, fish, octo, washi, fuda, hanko, SUMI, USU, SHU };
})();
if (typeof window !== 'undefined') window.Ink = Ink;
if (typeof module !== 'undefined') module.exports = Ink;

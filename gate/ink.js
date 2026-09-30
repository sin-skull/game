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


  // ---------- ほかの仲間たち（スキン）：上から見て、画面の上へ進む。120x200、f=0..3、mood=normal/happy/hurt ----------
  // 鳥獣戯画のように、実在の生き物と、伝承の河童。神仏や信仰の対象は使わない
  const PAPERC = '#f3ead6';
  const eyeAt = (x, y, r, mood, flip) => mood === 'happy' ? `<path d="M${x - r} ${y + 1} q${r} ${-r * 1.3} ${r * 2} 0" stroke="${SUMI}" stroke-width="3" fill="none" stroke-linecap="round"/>`
    : mood === 'hurt' ? `<path d="M${x - r * .7 * flip} ${y - r * .8} l${r * 1.4 * flip} ${r * .8} l${-r * 1.4 * flip} ${r * .8}" stroke="${SUMI}" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
      : `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * .85}" fill="${PAPERC}" stroke="${SUMI}" stroke-width="2.6"/><circle cx="${x + flip * r * .15}" cy="${y - r * .2}" r="${r * .45}" fill="${SUMI}"/>`;
  const wash = (k, d, fill) => `<path d="${d}" fill="${fill || `url(#${k}g)`}" filter="url(#${k}w)"/><path d="${d}" fill="none" stroke="${SUMI}" stroke-width="4.2" stroke-linejoin="round" filter="url(#${k}f)"/>`;
  const limb = (x, y, dir, t, len = 18, w = 7) => `<path d="M${x} ${y} q${dir * len * .6} ${-4 + t} ${dir * len} ${1 + t}" stroke-width="${w}"/><path d="M${x + dir * len} ${y + 1 + t} l${dir * 4} -4 m${-dir * 4} 4 l${dir * 5} 1 m${-dir * 5} -1 l${dir * 3} 5" stroke-width="2.2"/>`;
  const G = k => `<g filter="url(#${k}f)" stroke="${SUMI}" stroke-linecap="round" stroke-linejoin="round" fill="none">`;
  const BODY = {
    croc: null,
    turtle: (k, s, mood) => ({ a: { hx: 60, hy: 40, hr: 13, bx: 60, by: 100, bw: 34 }, svg: `
      ${G(k)}${limb(34, 76 - s * 5, -1, s * 6, 20, 9)}${limb(86, 76 + s * 5, 1, -s * 6, 20, 9)}${limb(36, 128 + s * 5, -1, -s * 6, 16, 8)}${limb(84, 128 - s * 5, 1, s * 6, 16, 8)}
        <path d="M60 144 q${s * 5} 10 ${s * 8} 18" stroke-width="7"/></g>
      ${wash(k, 'M60 26 C 70 26, 74 36, 72 46 C 70 54, 50 54, 48 46 C 46 36, 50 26, 60 26 Z')}
      ${wash(k, 'M60 56 C 92 56, 98 90, 94 112 C 90 136, 76 146, 60 146 C 44 146, 30 136, 26 112 C 22 90, 28 56, 60 56 Z')}
      <g stroke="${PAPERC}" stroke-width="2.2" fill="none" opacity=".75" filter="url(#${k}f)"><path d="M60 74 l12 8 v16 l-12 8 l-12 -8 v-16 z M60 74 v-14 M72 82 l14 -6 M72 98 l16 6 M60 106 v16 M48 98 l-16 6 M48 82 l-14 -6"/></g>
      <g filter="url(#${k}f)">${eyeAt(53, 38, 4.5, mood, 1)}${eyeAt(67, 38, 4.5, mood, -1)}</g>` }),
    frog: (k, s, mood) => ({ a: { hx: 60, hy: 56, hr: 24, bx: 60, by: 100, bw: 30 }, svg: `
      ${G(k)}<path d="M36 124 q${-26 - s * 4} ${-6 + s * 6} ${-24 - s * 4} ${22 + s * 6} q2 8 12 4" stroke-width="9"/><path d="M84 124 q${26 - s * 4} ${-6 - s * 6} ${24 - s * 4} ${22 - s * 6} q-2 8 -12 4" stroke-width="9"/>
        ${limb(38, 84 - s * 4, -1, s * 5, 16, 6)}${limb(82, 84 + s * 4, 1, -s * 5, 16, 6)}</g>
      ${wash(k, 'M60 38 C 90 38, 96 78, 90 108 C 84 138, 36 138, 30 108 C 24 78, 30 38, 60 38 Z')}
      <g fill="${PAPERC}" opacity=".55" filter="url(#${k}f)"><circle cx="50" cy="96" r="4"/><circle cx="70" cy="104" r="3"/><circle cx="62" cy="118" r="3.5"/><circle cx="46" cy="114" r="2.4"/></g>
      <path d="M48 70 q12 8 24 0" stroke="${SUMI}" stroke-width="2.6" fill="none" filter="url(#${k}f)"/>
      <g filter="url(#${k}f)"><circle cx="44" cy="44" r="10" fill="url(#${k}g)" stroke="${SUMI}" stroke-width="3"/><circle cx="76" cy="44" r="10" fill="url(#${k}g)" stroke="${SUMI}" stroke-width="3"/>${eyeAt(44, 43, 6, mood, 1)}${eyeAt(76, 43, 6, mood, -1)}</g>` }),
    carp: (k, s, mood) => ({ a: { hx: 60, hy: 38, hr: 16, bx: 60, by: 86, bw: 22 }, svg: `
      ${G(k)}<path d="M44 66 q${-18 - s * 4} 6 ${-22} ${18 + s * 4}" stroke-width="6"/><path d="M76 66 q${18 + s * 4} 6 22 ${18 - s * 4}" stroke-width="6"/></g>
      ${wash(k, `M60 132 C ${52 + s * 6} 150, ${40 + s * 10} 170, ${36 + s * 12} 190 C ${50 + s * 10} 182, ${56 + s * 8} 178, ${60 + s * 8} 172 C ${64 + s * 8} 178, ${70 + s * 10} 182, ${84 + s * 12} 190 C ${80 + s * 10} 170, ${68 + s * 6} 150, 60 132 Z`)}
      ${wash(k, `M60 18 C 82 30, 84 90, ${70 + s * 2} 132 C ${66 + s * 2} 144, ${54 + s * 2} 144, ${50 + s * 2} 132 C 36 90, 38 30, 60 18 Z`)}
      <g stroke="${PAPERC}" stroke-width="2" fill="none" opacity=".7" filter="url(#${k}f)">${[[52, 62], [68, 62], [60, 74], [52, 86], [68, 86], [60, 98], [54, 110], [66, 110]].map(([x, y]) => `<path d="M${x - 5} ${y} q5 6 10 0"/>`).join('')}</g>
      <path d="M56 20 q-6 -8 -10 -6 M64 20 q6 -8 10 -6" stroke="${SUMI}" stroke-width="2" fill="none" filter="url(#${k}f)"/>
      <g filter="url(#${k}f)">${eyeAt(50, 38, 5, mood, 1)}${eyeAt(70, 38, 5, mood, -1)}</g>` }),
    crab: (k, s, mood) => ({ a: { hx: 60, hy: 82, hr: 22, bx: 60, by: 104, bw: 34 }, svg: `
      ${G(k)}${[0, 1, 2, 3].map(i => `<path d="M${30} ${96 + i * 9} q-12 ${-6 + (i % 2 ? s : -s) * 4} -22 ${4 + i * 3}" stroke-width="5"/><path d="M90 ${96 + i * 9} q12 ${-6 + (i % 2 ? -s : s) * 4} 22 ${4 + i * 3}" stroke-width="5"/>`).join('')}
        <path d="M38 84 q-14 -16 -10 -34" stroke-width="7"/><path d="M82 84 q14 -16 10 -34" stroke-width="7"/></g>
      ${wash(k, `M28 50 C 14 40, 18 18, 30 14 C 28 26, 34 30, ${40 + s * 3} 26 C 44 40, 38 52, 28 50 Z`)}
      ${wash(k, `M92 50 C 106 40, 102 18, 90 14 C 92 26, 86 30, ${80 - s * 3} 26 C 76 40, 82 52, 92 50 Z`)}
      ${wash(k, 'M60 72 C 98 68, 104 112, 60 124 C 16 112, 22 68, 60 72 Z')}
      <path d="M44 96 q16 8 32 0" stroke="${PAPERC}" stroke-width="2.2" fill="none" opacity=".7" filter="url(#${k}f)"/>
      <g filter="url(#${k}f)"><path d="M52 74 v-10 M68 74 v-10" stroke="${SUMI}" stroke-width="3"/>${eyeAt(52, 62, 5, mood, 1)}${eyeAt(68, 62, 5, mood, -1)}</g>` }),
    catfish: (k, s, mood) => ({ a: { hx: 60, hy: 44, hr: 24, bx: 60, by: 100, bw: 22 }, svg: `
      ${G(k)}<path d="M42 34 C 20 30, 10 ${48 + s * 8}, ${6 + s * 3} ${70 + s * 8}" stroke-width="2.6"/><path d="M78 34 C 100 30, 110 ${48 - s * 8}, ${114 - s * 3} ${70 - s * 8}" stroke-width="2.6"/>
        <path d="M48 30 q-8 -6 -14 -2 M72 30 q8 -6 14 -2" stroke-width="2"/></g>
      ${wash(k, `M60 22 C 94 22, 96 62, 80 80 C 74 110, ${68 + s * 4} 150, ${60 + s * 10} 186 C ${52 + s * 4} 150, 46 110, 40 80 C 24 62, 26 22, 60 22 Z`)}
      <path d="M46 70 q14 8 28 0" stroke="${PAPERC}" stroke-width="2" fill="none" opacity=".6" filter="url(#${k}f)"/>
      <g filter="url(#${k}f)">${eyeAt(46, 44, 4, mood, 1)}${eyeAt(74, 44, 4, mood, -1)}</g>` }),
    salamander: (k, s, mood) => ({ a: { hx: 60, hy: 40, hr: 22, bx: 60, by: 96, bw: 22 }, svg: `
      ${G(k)}${limb(40, 72 - s * 5, -1, s * 5, 14, 7)}${limb(80, 72 + s * 5, 1, -s * 5, 14, 7)}${limb(42, 118 + s * 5, -1, -s * 5, 14, 7)}${limb(78, 118 - s * 5, 1, s * 5, 14, 7)}
        <path d="M60 130 C ${58 + s * 3} 150, ${62 - s * 8} 170, ${60 + s * 12} 192" stroke-width="14"/></g>
      ${wash(k, 'M60 58 C 84 58, 86 92, 82 112 C 78 132, 42 132, 38 112 C 34 92, 36 58, 60 58 Z')}
      ${wash(k, 'M60 18 C 88 18, 90 58, 60 62 C 30 58, 32 18, 60 18 Z')}
      <g fill="${PAPERC}" opacity=".45" filter="url(#${k}f)"><circle cx="50" cy="84" r="4"/><circle cx="68" cy="94" r="5"/><circle cx="54" cy="108" r="3.5"/><circle cx="70" cy="76" r="3"/><circle cx="46" cy="36" r="3"/><circle cx="74" cy="44" r="2.6"/></g>
      <g filter="url(#${k}f)">${eyeAt(50, 32, 3.6, mood, 1)}${eyeAt(70, 32, 3.6, mood, -1)}</g>` }),
    shark: (k, s, mood) => ({ a: { hx: 60, hy: 30, hr: 14, bx: 60, by: 78, bw: 20 }, svg: `
      ${wash(k, `M44 66 C 30 76, 16 94, ${8 + s * 2} 108 C 26 100, 38 92, 48 84 Z`)}${wash(k, `M76 66 C 90 76, 104 94, ${112 - s * 2} 108 C 94 100, 82 92, 72 84 Z`)}
      ${wash(k, `M${58 + s * 4} 144 C ${48 + s * 8} 160, ${36 + s * 12} 172, ${30 + s * 14} 190 C ${48 + s * 12} 182, ${58 + s * 10} 176, ${62 + s * 10} 170 C ${68 + s * 10} 178, ${78 + s * 12} 184, ${88 + s * 14} 186 C ${76 + s * 10} 172, ${68 + s * 6} 158, ${62 + s * 4} 144 Z`)}
      ${wash(k, `M60 6 C 78 28, 80 92, ${66 + s * 3} 142 C ${63 + s * 3} 152, ${57 + s * 3} 152, ${54 + s * 3} 142 C 40 92, 42 28, 60 6 Z`)}
      <g stroke="${PAPERC}" stroke-width="2" fill="none" opacity=".75" filter="url(#${k}f)"><path d="M48 44 q4 4 0 8 M72 44 q-4 4 0 8 M50 50 q4 4 0 8 M70 50 q-4 4 0 8"/><path d="M60 70 v24" stroke-width="3"/></g>
      <g filter="url(#${k}f)">${eyeAt(50, 28, 4, mood, 1)}${eyeAt(70, 28, 4, mood, -1)}</g>` }),
    kappa: (k, s, mood) => ({ a: { hx: 60, hy: 46, hr: 20, bx: 60, by: 106, bw: 26 }, svg: `
      ${G(k)}<path d="M38 82 q-16 ${8 + s * 8} -20 ${22 + s * 8}" stroke-width="7"/><path d="M82 82 q16 ${8 - s * 8} 20 ${22 - s * 8}" stroke-width="7"/>
        <path d="M18 ${104 + s * 8} l-4 6 m4 -6 l2 7 m-2 -7 l6 4 M102 ${104 - s * 8} l4 6 m-4 -6 l-2 7 m2 -7 l-6 4" stroke-width="2.4"/>
        <path d="M48 134 q-4 ${14 + s * 8} -6 ${28 + s * 8}" stroke-width="8"/><path d="M72 134 q4 ${14 - s * 8} 6 ${28 - s * 8}" stroke-width="8"/></g>
      ${wash(k, 'M60 72 C 88 72, 92 106, 88 124 C 84 142, 36 142, 32 124 C 28 106, 32 72, 60 72 Z')}
      <g stroke="${PAPERC}" stroke-width="2.2" fill="none" opacity=".7" filter="url(#${k}f)"><path d="M60 92 l10 6 v12 l-10 6 l-10 -6 v-12 z M60 92 v-14 M70 98 l14 -6 M70 110 l14 6 M50 110 l-14 6 M50 98 l-14 -6"/></g>
      ${wash(k, 'M60 26 C 82 26, 84 64, 60 66 C 36 64, 38 26, 60 26 Z')}
      <g filter="url(#${k}f)"><path d="M40 44 l4 -5 l4 4 l4 -6 l4 5 l4 -6 l4 5 l4 -6 l4 4 l4 -5 l4 5" stroke="${SUMI}" stroke-width="3" fill="none"/>
        <ellipse cx="60" cy="42" rx="12" ry="9" fill="${PAPERC}" stroke="${SUMI}" stroke-width="2.4"/><path d="M56 22 l4 -8 l4 8" fill="${SUMI}" stroke="${SUMI}" stroke-width="2"/>
        ${eyeAt(51, 58, 4, mood, 1)}${eyeAt(69, 58, 4, mood, -1)}</g>` }),
    rabbit: (k, s, mood) => ({ a: { hx: 60, hy: 52, hr: 16, bx: 60, by: 100, bw: 24 }, svg: `
      ${G(k)}<path d="M44 ${134 + s * 6} q-6 12 -2 ${26 + s * 4}" stroke-width="9"/><path d="M76 ${134 - s * 6} q6 12 2 ${26 - s * 4}" stroke-width="9"/>
        <path d="M42 80 q-12 ${4 + s * 6} -14 ${14 + s * 6}" stroke-width="5"/><path d="M78 80 q12 ${4 - s * 6} 14 ${14 - s * 6}" stroke-width="5"/></g>
      ${wash(k, `M50 40 C 40 26, ${40 + s * 2} 8, ${46 + s * 2} 4 C 54 10, 56 28, 56 40 Z`, PAPERC)}${wash(k, `M70 40 C 80 26, ${80 - s * 2} 8, ${74 - s * 2} 4 C 66 10, 64 28, 64 40 Z`, PAPERC)}
      ${wash(k, 'M60 68 C 88 68, 90 104, 84 122 C 78 140, 42 140, 36 122 C 30 104, 32 68, 60 68 Z', PAPERC)}
      ${wash(k, 'M60 36 C 78 36, 80 66, 60 70 C 40 66, 42 36, 60 36 Z', PAPERC)}
      <path d="M46 20 q4 8 6 16 M74 20 q-4 8 -6 16" stroke="url(#${k}g)" stroke-width="3" fill="none" opacity=".8" filter="url(#${k}f)"/>
      <g filter="url(#${k}w)" fill="url(#${k}g)" opacity=".5"><path d="M44 96 q16 10 32 0 q-4 20 -16 22 q-12 -2 -16 -22z"/></g>
      <circle cx="60" cy="142" r="7" fill="${PAPERC}" stroke="${SUMI}" stroke-width="2.4" filter="url(#${k}f)"/>
      <g filter="url(#${k}f)">${eyeAt(53, 50, 3.6, mood, 1)}${eyeAt(67, 50, 3.6, mood, -1)}</g>` }),
  };
  const CROC_A = { hx: 60, hy: 40, hr: 22, bx: 60, by: 92, bw: 24 };
  // 小物：笠 / 鉢巻 / 蓑 / 風呂敷（旅の荷） / 羽織（家紋は描かない：実在の家の紋と誤解されないように）
  function accSVG(k, acc, a, s) {
    if (acc === 'kasa') { const r = a.hr * 1.75; return `<g filter="url(#${k}f)"><circle cx="${a.hx}" cy="${a.hy}" r="${r}" fill="#e6dcc2" stroke="${SUMI}" stroke-width="3.4"/>
      ${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(i => { const t = i / 12 * Math.PI * 2; return `<path d="M${a.hx} ${a.hy} L${a.hx + Math.cos(t) * r} ${a.hy + Math.sin(t) * r}" stroke="${USU}" stroke-width="1.4"/>`; }).join('')}
      <circle cx="${a.hx}" cy="${a.hy}" r="${r * .62}" fill="none" stroke="${USU}" stroke-width="1.2"/><circle cx="${a.hx}" cy="${a.hy}" r="3.5" fill="${SUMI}"/></g>`; }
    if (acc === 'hachimaki') { const y = a.hy - a.hr * .1, x0 = a.hx - a.hr - 2, x1 = a.hx + a.hr + 2;
      return `<g filter="url(#${k}f)"><path d="M${x0} ${y} Q${a.hx} ${y - 6} ${x1} ${y}" stroke="${SHU}" stroke-width="6" fill="none" stroke-linecap="round"/>
      <path d="M${x1} ${y} q10 ${4 + s * 4} 18 ${2 + s * 8} M${x1} ${y} q8 ${10 - s * 3} 12 ${16 - s * 3}" stroke="${SHU}" stroke-width="4" fill="none" stroke-linecap="round"/></g>`; }
    if (acc === 'mino') { const w = a.bw + 8, y0 = a.by - 30, y1 = a.by + 30;
      return `<g filter="url(#${k}f)"><path d="M${a.bx - w * .7} ${y0} Q${a.bx} ${y0 - 8} ${a.bx + w * .7} ${y0} L${a.bx + w} ${y1} Q${a.bx} ${y1 + 8} ${a.bx - w} ${y1} Z" fill="#b9ab8a" opacity=".92" stroke="${SUMI}" stroke-width="2.6"/>
      ${Array.from({ length: 13 }, (_, i) => { const x = a.bx - w + i * w / 6; return `<path d="M${a.bx + (x - a.bx) * .7} ${y0 + 4} L${x + s * 1.5} ${y1 + 4}" stroke="${USU}" stroke-width="1.6"/>`; }).join('')}
      <path d="M${a.bx - w * .9} ${y0 + 20} Q${a.bx} ${y0 + 14} ${a.bx + w * .9} ${y0 + 20}" stroke="${SUMI}" stroke-width="1.6" fill="none"/></g>`; }
    if (acc === 'furoshiki') { const cy = a.by + 6, r = a.bw * .72;
      return `<g filter="url(#${k}f)"><circle cx="${a.bx}" cy="${cy}" r="${r}" fill="${'#1f3a5a'}" stroke="${SUMI}" stroke-width="3"/>
      <g stroke="${PAPERC}" stroke-width="1.6" fill="none" opacity=".8"><path d="M${a.bx - r * .6} ${cy} q${r * .3} ${-r * .5} ${r * .6} 0 q${r * .3} ${r * .5} ${r * .6} 0 M${a.bx - r * .3} ${cy + r * .45} q${r * .3} ${-r * .3} ${r * .6} 0 M${a.bx - r * .3} ${cy - r * .5} q${r * .3} ${-r * .25} ${r * .6} 0"/></g>
      <path d="M${a.bx - 8} ${cy - r + 2} l-6 -9 l10 4 l4 -9 l4 9 l10 -4 l-6 9" fill="${'#1f3a5a'}" stroke="${SUMI}" stroke-width="2.4"/></g>`; }
    if (acc === 'haori') { const w = a.bw + 10, y0 = a.by - 34, y1 = a.by + 34;
      return `<g filter="url(#${k}f)"><path d="M${a.bx - w} ${y0 + 6} Q${a.bx} ${y0 - 6} ${a.bx + w} ${y0 + 6} L${a.bx + w - 4} ${y1} L${a.bx - w + 4} ${y1} Z" fill="${SUMI}" opacity=".92" stroke="${SUMI}" stroke-width="2.6"/>
      <path d="M${a.bx - w + 3} ${y0 + 8} L${a.bx - w + 6} ${y1 - 2} M${a.bx + w - 3} ${y0 + 8} L${a.bx + w - 6} ${y1 - 2}" stroke="${SHU}" stroke-width="3"/>
      <path d="M${a.bx - 9} ${y0 + 4} q9 10 18 0" stroke="${SHU}" stroke-width="2.6" fill="none"/><circle cx="${a.bx}" cy="${y0 + 9}" r="2.6" fill="${SHU}"/>
      <path d="M${a.bx} ${y0 + 12} v${y1 - y0 - 16}" stroke="${USU}" stroke-width="1.4" opacity=".7"/></g>`; }
    return '';
  }
  // スキンの絵：body（生き物）× acc（小物）× tint（墨の色）
  function critter(body = 'croc', f = 0, mood = 'normal', tint = SUMI, acc = '') {
    if (body === 'croc' || !BODY[body]) {
      const base = croc(f, mood, tint);
      if (!acc) return base;
      const k = id(), s = [1, 0, -1, 0][f % 4];
      return base.replace('</svg>', `${defs(k, 2.4, 51 + f)}${accSVG(k, acc, CROC_A, s)}</svg>`);
    }
    const k = id(), s = [1, 0, -1, 0][f % 4];
    const b = BODY[body](k, s, mood);
    return svg(120, 200, addDefs(defs(k, 3, 7 + f), sumiGrad(k, .95, .45, tint)) + `<ellipse cx="60" cy="192" rx="30" ry="5" fill="${USU}" opacity=".2" filter="url(#${k}w)"/>` + b.svg +
      accSVG(k, acc, b.a, s) +
      (mood === 'hurt' ? `<path d="M96 36 q7 9 0 14 q-7 -5 0 -14 z" fill="none" stroke="${SUMI}" stroke-width="2" filter="url(#${k}f)"/>` : '') +
      (mood === 'happy' ? splat(k, [[20, 40, 3], [100, 34, 2.6], [98, 58, 1.6]], SHU) : ''));
  }
  const BODIES = Object.keys(BODY);

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


  // ---------- 武器（道具）の絵：ガチャ・装備で見せる。墨の道具と、海の道具 ----------
  const WEAPON_ART = {
    pea: (k) => `<g transform="rotate(-35 60 64)"><rect x="22" y="54" width="72" height="18" rx="6" fill="url(#${k}g)" stroke="${SUMI}" stroke-width="3"/>
      <path d="M44 54v18M68 54v18" stroke="${SUMI}" stroke-width="2.4"/><ellipse cx="94" cy="63" rx="4" ry="9" fill="${SUMI}"/></g>
      <g fill="${SUMI}"><circle cx="92" cy="26" r="4.5"/><circle cx="104" cy="14" r="3.5"/><circle cx="80" cy="36" r="2.5" opacity=".6"/></g>`,
    twin: (k) => `${[-1, 1].map(d => `<g transform="rotate(${d * 28} 60 60)"><rect x="56" y="14" width="8" height="62" rx="3" fill="url(#${k}g)" stroke="${SUMI}" stroke-width="2.4"/>
      <path d="M56 76 q4 30 4 30 q0 0 4 -30z" fill="${SUMI}"/><path d="M56 22h8" stroke="${SHU}" stroke-width="3"/></g>`).join('')}`,
    fan: (k) => `<path d="M60 100 L14 44 A72 72 0 0 1 106 44 Z" fill="#efe7d4" stroke="${SUMI}" stroke-width="3"/>
      <path d="M60 100 L14 44 A72 72 0 0 1 106 44 Z" fill="url(#${k}r)" opacity=".35"/>
      ${[0, 1, 2, 3, 4, 5, 6].map(i => { const a = (-129.4 + i * 13.13) * Math.PI / 180; return `<path d="M60 100 L${60 + Math.cos(a) * 72} ${100 + Math.sin(a) * 72}" stroke="${SUMI}" stroke-width="1.6"/>`; }).join('')}
      <path d="M26 58 q16 -10 34 -2 q18 8 34 -4" stroke="${SUMI}" stroke-width="3" fill="none"/><circle cx="60" cy="100" r="4" fill="${SHU}"/>`,
    rapid: (k) => `${[-16, 0, 16].map((d, i) => `<rect x="${52 + d}" y="${24 + i * 4}" width="14" height="70" rx="5" fill="url(#${k}g)" stroke="${SUMI}" stroke-width="2.6"/><path d="M${52 + d} ${50 + i * 4}h14" stroke="${SUMI}" stroke-width="2"/>`).join('')}
      <path d="M36 70 h48" stroke="${SHU}" stroke-width="5"/>`,
    bouncer: (k) => `<rect x="20" y="66" width="80" height="34" rx="10" fill="url(#${k}g)" stroke="${SUMI}" stroke-width="3"/><ellipse cx="60" cy="76" rx="26" ry="6" fill="${SUMI}"/>
      <path d="M40 60 L58 26 L76 50 L96 16" stroke="${SUMI}" stroke-width="2.6" fill="none" stroke-dasharray="5 5"/><circle cx="96" cy="16" r="5" fill="${SUMI}"/>`,
    wave: (k) => `<g transform="rotate(20 60 60)"><rect x="56" y="10" width="9" height="56" rx="3" fill="url(#${k}g)" stroke="${SUMI}" stroke-width="2.4"/><path d="M56 66 q4 24 5 24 q1 0 4 -24z" fill="${SUMI}"/></g>
      <path d="M12 100 q10 -12 20 0 t20 0 t20 0 t20 0 t20 0" stroke="${SUMI}" stroke-width="3.2" fill="none"/>`,
    shotgun: (k) => `<g transform="rotate(-30 50 70)"><path d="M26 60 q0 -18 24 -18 q24 0 24 18 v22 q0 12 -24 12 q-24 0 -24 -12z" fill="url(#${k}g)" stroke="${SUMI}" stroke-width="3"/><ellipse cx="50" cy="44" rx="14" ry="4" fill="${SUMI}"/></g>
      <g fill="${SUMI}">${[[70, 26, 4], [84, 18, 3], [92, 34, 5], [104, 22, 3], [80, 40, 2.5], [100, 48, 3.5], [110, 36, 2]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')}</g>`,
    homing: (k) => `<g transform="rotate(-20 40 80)"><rect x="34" y="50" width="9" height="54" rx="3" fill="url(#${k}g)" stroke="${SUMI}" stroke-width="2.4"/><path d="M34 50 q4 -22 5 -22 q1 0 4 22z" fill="${SUMI}"/></g>
      <path d="M44 30 q30 -24 50 0 q16 22 -8 32 q-18 6 -20 -10 q0 -12 14 -10" stroke="${SUMI}" stroke-width="3" fill="none"/><circle cx="82" cy="42" r="4" fill="${SHU}"/>`,
    beam: (k) => `<rect x="52" y="6" width="16" height="50" rx="4" fill="url(#${k}g)" stroke="${SUMI}" stroke-width="3"/><path d="M50 56 q10 30 10 30 q0 0 10 -30z" fill="${SUMI}"/>
      <path d="M60 86 v30" stroke="${SUMI}" stroke-width="12" stroke-linecap="round" filter="url(#${k}d)"/><path d="M52 16h16" stroke="${SHU}" stroke-width="3"/>`,
    trident: () => `<path d="M60 116 V40" stroke="${SUMI}" stroke-width="6" stroke-linecap="round"/><path d="M34 44 V20 M60 40 V8 M86 44 V20 M34 44 q26 14 52 0" stroke="${SUMI}" stroke-width="5" fill="none" stroke-linecap="round"/>
      <path d="M28 24 l6 -10 l6 10 M54 12 l6 -10 l6 10 M80 24 l6 -10 l6 10" fill="${SUMI}" stroke="${SUMI}" stroke-width="2"/><path d="M52 70h16" stroke="${SHU}" stroke-width="4"/>`,
    jaws: (k) => `<path d="M10 56 Q60 18 110 50 L104 58 Q60 36 16 62 Z" fill="url(#${k}g)" stroke="${SUMI}" stroke-width="3"/>
      <path d="M12 70 Q60 100 110 66 L104 60 Q60 86 18 64 Z" fill="url(#${k}g)" stroke="${SUMI}" stroke-width="3"/>
      <path d="M22 60 l4 8 l4 -8 l4 8 l4 -8 l4 7 l4 -7 l4 7 l4 -7 l4 7 l4 -7 l4 6 l4 -6 l4 6 l4 -6 l4 6 l4 -6 l4 5 l4 -5" stroke="#efe7d4" stroke-width="2" fill="none"/><circle cx="92" cy="44" r="3.5" fill="${SHU}"/>`,
    bamboo: (k) => `<rect x="42" y="8" width="36" height="104" rx="8" fill="url(#${k}g)" stroke="${SUMI}" stroke-width="3"/><path d="M42 40 h36 M42 76 h36" stroke="${SUMI}" stroke-width="3"/>
      <path d="M78 36 q16 -8 24 -24 M78 72 q14 -4 20 -16" stroke="${SUMI}" stroke-width="2.4" fill="none"/>`,
    reed: (k) => `<g transform="rotate(-40 60 60)"><rect x="20" y="54" width="80" height="12" rx="5" fill="url(#${k}g)" stroke="${SUMI}" stroke-width="2.6"/>${[36, 50, 64, 78].map(x => `<circle cx="${x}" cy="60" r="2.4" fill="${SUMI}"/>`).join('')}</g>
      <path d="M70 90 q8 -8 16 0 t16 0 M78 104 q8 -8 16 0" stroke="${SUMI}" stroke-width="2.4" fill="none"/>`,
    kasa: (k) => `<path d="M12 64 Q60 -4 108 64 Q96 56 84 64 Q72 56 60 64 Q48 56 36 64 Q24 56 12 64Z" fill="url(#${k}g)" stroke="${SUMI}" stroke-width="3"/>
      ${[24, 42, 60, 78, 96].map(x => `<path d="M60 18 L${x} 62" stroke="${SUMI}" stroke-width="1.4" opacity=".7"/>`).join('')}<path d="M60 64 V108 q0 8 -8 6" stroke="${SUMI}" stroke-width="4" fill="none"/><circle cx="60" cy="40" r="7" fill="${SHU}" opacity=".85"/>`,
    oar: (k) => `<g transform="rotate(35 60 60)"><rect x="56" y="4" width="8" height="70" rx="3" fill="${SUMI}"/><path d="M50 74 h20 l-2 40 q-8 6 -16 0z" fill="url(#${k}g)" stroke="${SUMI}" stroke-width="3"/></g>
      <path d="M8 104 q10 -8 20 0 t20 0" stroke="${SUMI}" stroke-width="2.4" fill="none"/>`,
    net: () => `<circle cx="60" cy="62" r="46" fill="none" stroke="${SUMI}" stroke-width="3"/>
      ${[-30, -15, 0, 15, 30].map(d => `<path d="M${60 + d} 16 Q${60 + d * 1.6} 62 ${60 + d} 108" stroke="${SUMI}" stroke-width="1.6" fill="none"/><path d="M14 ${62 + d} Q60 ${62 + d * 1.6} 106 ${62 + d}" stroke="${SUMI}" stroke-width="1.6" fill="none"/>`).join('')}
      ${[[20, 90], [34, 104], [86, 104], [100, 90], [60, 110]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4" fill="${SUMI}"/>`).join('')}`,
    kite: (k) => `<rect x="24" y="10" width="60" height="76" fill="#efe7d4" stroke="${SUMI}" stroke-width="3" transform="rotate(-8 54 48)"/><path d="M28 14 L80 82 M80 14 L28 82" stroke="${SUMI}" stroke-width="1.4" transform="rotate(-8 54 48)"/>
      <rect x="44" y="32" width="24" height="24" fill="${SHU}" transform="rotate(-8 54 48)" filter="url(#${k}w)"/><path d="M60 86 q-10 12 4 18 q14 6 2 16" stroke="${SUMI}" stroke-width="2.2" fill="none"/>`,
    drum: (k) => `<ellipse cx="60" cy="30" rx="40" ry="12" fill="#efe7d4" stroke="${SUMI}" stroke-width="3"/><path d="M20 30 q-4 30 0 60 q40 20 80 0 q4 -30 0 -60" fill="url(#${k}g)" stroke="${SUMI}" stroke-width="3"/>
      ${[30, 45, 60, 75, 90].map(x => `<circle cx="${x}" cy="${x === 60 ? 44 : 42}" r="2.2" fill="#efe7d4"/>`).join('')}<path d="M88 12 L112 -4 M96 20 L116 8" stroke="${SUMI}" stroke-width="4" stroke-linecap="round"/>`,
    anchor: () => `<circle cx="60" cy="16" r="8" fill="none" stroke="${SUMI}" stroke-width="4"/><path d="M60 24 V104 M38 40 H82" stroke="${SUMI}" stroke-width="6" stroke-linecap="round"/>
      <path d="M18 76 Q24 108 60 106 Q96 108 102 76" stroke="${SUMI}" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M12 80 l6 -12 l8 10z M108 80 l-6 -12 l-8 10z" fill="${SUMI}"/>`,
    suzuri: (k) => `<rect x="14" y="30" width="92" height="70" rx="12" fill="url(#${k}g)" stroke="${SUMI}" stroke-width="3.4"/><rect x="26" y="40" width="68" height="36" rx="8" fill="#efe7d4" opacity=".35"/>
      <path d="M26 84 q34 16 68 0 v6 q-34 14 -68 0z" fill="${SUMI}"/><rect x="80" y="4" width="14" height="40" rx="3" fill="${SUMI}" transform="rotate(20 87 24)"/><circle cx="40" cy="58" r="5" fill="${SHU}"/>`,
    aranami: (k) => `<path d="M8 108 C16 60 50 30 84 36 C104 40 110 60 96 70 C86 76 76 66 82 58 C88 50 98 58 94 64" stroke="${SUMI}" stroke-width="5" fill="none" stroke-linecap="round"/>
      <path d="M8 108 C16 60 50 30 84 36 C60 44 40 70 36 108Z" fill="url(#${k}g)"/><path d="M40 108 q10 -18 26 -14 q16 4 10 14" stroke="${SUMI}" stroke-width="3" fill="none"/>
      ${[[70, 28], [80, 22], [92, 26], [62, 34]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3" fill="${SUMI}"/>`).join('')}<circle cx="104" cy="20" r="7" fill="${SHU}" opacity=".9"/>`,
  };
  function weapon(wid) {
    const k = id(), draw = WEAPON_ART[wid] || WEAPON_ART.pea;
    return svg(120, 120, addDefs(defs(k, 2.4, 13 + wid.length * 3), sumiGrad(k, .9, .35)) +
      `<circle cx="60" cy="62" r="50" fill="${USU}" opacity=".12" filter="url(#${k}w)"/><g filter="url(#${k}f)" stroke-linejoin="round">${draw(k)}</g>`);
  }

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

  return { croc, critter, BODIES, fish, octo, boss, weapon, WEAPON_IDS: Object.keys(WEAPON_ART), BOSS_IDS, BOSS_NAME, washi, fuda, hanko, SUMI, USU, SHU, PAPER };
})();
if (typeof window !== 'undefined') window.Ink = Ink;
if (typeof module !== 'undefined') module.exports = Ink;

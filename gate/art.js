'use strict';

// =====================================================
//  GATE VADER のキャラ絵（SVG）。Figma のデザインボードとゲームで同じものを使う
//  ・やわらかい立体感：放射グラデーション＋ハイライト＋濃い色の太い輪郭、大きな目
//  ・表情（mood）：normal / happy（喜ぶ）/ hurt（痛がる）/ dead（目を回す）
//  ・ワニは真上寄りのななめ上から見た形（頭と目が見える）。歩きは4コマ
//  ・魚は泳ぐ4コマ（体をくねらせ、尾びれとヒレが動く）
//  ・ボスは10種類（ステージごとに別の魚）
// =====================================================

const Art = (() => {
  const OUT = '#1d3b2a';
  let seq = 0;
  const uid = () => 'a' + (seq++).toString(36) + Math.random().toString(36).slice(2, 5);
  const rg = (id, l, c, d, cx = '42%', cy = '35%', r = '70%') =>
    `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}"><stop offset="0" stop-color="${l}"/><stop offset=".55" stop-color="${c}"/><stop offset="1" stop-color="${d}"/></radialGradient>`;
  const svg = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${body}</svg>`;

  // 目：表情で形が変わる。angry は眉つき
  function eyes(x1, x2, y, r, mood = 'normal', o = {}) {
    const pc = o.pupil || '#2a1a10', sw = Math.max(2, r * 0.22);
    if (mood === 'happy') {
      return [x1, x2].map(x => `<path d="M${x - r * 0.75} ${y + r * 0.2} Q${x} ${y - r * 0.95} ${x + r * 0.75} ${y + r * 0.2}" stroke="${OUT}" stroke-width="${sw * 1.3}" fill="none" stroke-linecap="round"/>`).join('') +
        `<g fill="#ffe14a" stroke="${OUT}" stroke-width="1.2">${[x1 - r * 1.3, x2 + r * 1.3].map(x => `<path d="M${x} ${y - r * 1.2} l${r * .18} ${r * .4} l${r * .42} ${r * .06} l-${r * .32} ${r * .28} l${r * .1} ${r * .42} l-${r * .38} -${r * .22} l-${r * .38} ${r * .22} l${r * .1} -${r * .42} l-${r * .32} -${r * .28} l${r * .42} -${r * .06} z"/>`).join('')}</g>`;
    }
    if (mood === 'hurt') {
      return `<path d="M${x1 - r * .6} ${y - r * .55} L${x1 + r * .5} ${y} L${x1 - r * .6} ${y + r * .55} M${x2 + r * .6} ${y - r * .55} L${x2 - r * .5} ${y} L${x2 + r * .6} ${y + r * .55}" stroke="${OUT}" stroke-width="${sw * 1.3}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` +
        `<path d="M${x2 + r * 1.2} ${y - r * 1.2} q${r * .35} ${r * .6} 0 ${r * .8} q-${r * .35} -${r * .2} 0 -${r * .8} z" fill="#9fdcff" stroke="${OUT}" stroke-width="1.2"/>`;
    }
    if (mood === 'dead') {
      return [x1, x2].map(x => `<g fill="none" stroke="${OUT}" stroke-width="${sw}" stroke-linecap="round"><circle cx="${x}" cy="${y}" r="${r * .85}" fill="#fff"/><path d="M${x} ${y} m-${r * .15} 0 a${r * .15} ${r * .15} 0 1 1 ${r * .3} 0 a${r * .35} ${r * .35} 0 1 1 -${r * .7} 0 a${r * .55} ${r * .55} 0 1 1 ${r * 1.1} 0"/></g>`).join('');
    }
    const brow = o.angry ? `<path d="M${x1 - r * 1.05} ${y - r * 1.2} L${x1 + r * .9} ${y - r * .55} M${x2 + r * 1.05} ${y - r * 1.2} L${x2 - r * .9} ${y - r * .55}" stroke="${OUT}" stroke-width="${sw * 1.6}" stroke-linecap="round"/>` : '';
    return `<g stroke="${OUT}" stroke-width="${sw}"><circle cx="${x1}" cy="${y}" r="${r}" fill="#fff"/><circle cx="${x2}" cy="${y}" r="${r}" fill="#fff"/></g>` +
      `<g fill="${pc}"><ellipse cx="${x1 + r * .12}" cy="${y + r * .12}" rx="${r * .55}" ry="${r * .62}"/><ellipse cx="${x2 - r * .12}" cy="${y + r * .12}" rx="${r * .55}" ry="${r * .62}"/></g>` +
      `<g fill="#fff"><circle cx="${x1 - r * .15}" cy="${y - r * .2}" r="${r * .24}"/><circle cx="${x2 - r * .35}" cy="${y - r * .2}" r="${r * .24}"/><circle cx="${x1 + r * .35}" cy="${y + r * .35}" r="${r * .11}"/><circle cx="${x2 + r * .15}" cy="${y + r * .35}" r="${r * .11}"/></g>` + brow;
  }
  // 口：表情ごと
  function mouth(x, y, w, mood = 'normal', teeth = false) {
    if (mood === 'happy') return `<path d="M${x - w} ${y} Q${x} ${y + w * 1.3} ${x + w} ${y} Z" fill="#8a2a2a" stroke="${OUT}" stroke-width="3" stroke-linejoin="round"/><ellipse cx="${x}" cy="${y + w * .55}" rx="${w * .45}" ry="${w * .22}" fill="#ff8aa0"/>`;
    if (mood === 'hurt') return `<path d="M${x - w} ${y + 4} q${w / 4} -6 ${w / 2} 0 t${w / 2} 0 t${w / 2} 0 t${w / 2} 0" stroke="${OUT}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    if (mood === 'dead') return `<ellipse cx="${x}" cy="${y + 3}" rx="${w * .35}" ry="${w * .3}" fill="#5a1a1a" stroke="${OUT}" stroke-width="3"/><path d="M${x + w * .1} ${y + w * .2} q${w * .2} ${w * .5} ${w * .45} ${w * .1}" fill="#ff8aa0" stroke="${OUT}" stroke-width="2"/>`;
    const t = teeth ? `<g fill="#fff" stroke="${OUT}" stroke-width="1.2">${Array.from({ length: 5 }, (_, i) => `<path d="M${x - w * .8 + i * w * .4} ${y + 1} l${w * .2} ${w * .32} l${w * .2} -${w * .32} z"/>`).join('')}</g>` : '';
    return `<path d="M${x - w} ${y} Q${x} ${y + w * .9} ${x + w} ${y} Q${x} ${y + w * .35} ${x - w} ${y} Z" fill="#3a0a14" stroke="${OUT}" stroke-width="3" stroke-linejoin="round"/>${t}`;
  }

  // ---------- 主人公ワニ ----------
  // f = 0..3 の歩きコマ。skin = { c: 体, d: 影, l: 明るい所, e: 目の色 }
  function croc(f = 0, skin = {}, mood = 'normal') {
    const c = skin.c || '#5fd35a', d = skin.d || '#2f8f3b', l = skin.l || '#b6f59a', ec = skin.e || '#3a2412';
    const happy = mood === 'happy';
    const leg = [7, 0, -7, 0][f % 4];
    const bob = happy ? [-4, -8, -4, -8][f % 4] : [0, -2, 0, -2][f % 4];
    const tw = happy ? [-14, 14, -14, 14][f % 4] : [-9, 0, 9, 0][f % 4];
    const g = uid();
    const T = (x, y) => `${x + tw * ((y - 118) / 50)} ${y}`;
    const armL = happy ? `<ellipse cx="18" cy="${70 + leg}" rx="10" ry="12"/>` : `<ellipse cx="26" cy="${88 + leg}" rx="11" ry="9"/>`;
    const armR = happy ? `<ellipse cx="102" cy="${70 - leg}" rx="10" ry="12"/>` : `<ellipse cx="94" cy="${88 - leg}" rx="11" ry="9"/>`;
    const e = mood === 'normal'
      ? `<g stroke="${OUT}" stroke-width="3"><circle cx="38" cy="60" r="13" fill="url(#${g}e)"/><circle cx="82" cy="60" r="13" fill="url(#${g}e)"/></g>
    <g fill="${ec}"><ellipse cx="39" cy="56" rx="7.5" ry="9"/><ellipse cx="81" cy="56" rx="7.5" ry="9"/></g>
    <g fill="#fff"><circle cx="36" cy="52" r="3.2"/><circle cx="78" cy="52" r="3.2"/><circle cx="42" cy="60" r="1.5"/><circle cx="84" cy="60" r="1.5"/></g>`
      : `<g stroke="${OUT}" stroke-width="3"><circle cx="38" cy="60" r="13" fill="${c}"/><circle cx="82" cy="60" r="13" fill="${c}"/></g>` + eyes(38, 82, 60, 11, mood);
    return svg(120, 176, `<defs>${rg(g + 'b', l, c, d)}${rg(g + 'h', l, c, d, '45%', '40%')}
    <linearGradient id="${g}n" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${l}"/><stop offset="1" stop-color="${c}"/></linearGradient>
    <radialGradient id="${g}e" cx="40%" cy="35%" r="65%"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#dfe9ee"/></radialGradient>
    <linearGradient id="${g}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#63c7ff"/><stop offset="1" stop-color="#2a86d8"/></linearGradient></defs>
  <ellipse cx="60" cy="166" rx="30" ry="7" fill="#000" opacity=".22"/>
  <g transform="translate(0 ${bob})">
    <path d="M46 116 Q${T(48, 146)} ${T(60, 172)} Q${T(72, 146)} 74 116 Z" fill="url(#${g}b)" stroke="${OUT}" stroke-width="3.5" stroke-linejoin="round"/>
    <g fill="${d}" opacity=".6"><path d="M${T(56, 132)} l4 -5 l4 5 z"/><path d="M${T(56.5, 145)} l3.5 -4.5 l3.5 4.5 z"/><path d="M${T(57, 157)} l3 -4 l3 4 z"/></g>
    <g stroke="${OUT}" stroke-width="3" fill="${c}">${armL}${armR}
      <ellipse cx="29" cy="${120 - leg}" rx="11" ry="9"/><ellipse cx="91" cy="${120 + leg}" rx="11" ry="9"/></g>
    <ellipse cx="60" cy="104" rx="31" ry="29" fill="url(#${g}b)" stroke="${OUT}" stroke-width="3.5"/>
    <g fill="${d}" opacity=".55"><ellipse cx="60" cy="98" rx="5" ry="4"/><ellipse cx="60" cy="110" rx="5" ry="4"/><ellipse cx="60" cy="121" rx="4" ry="3"/></g>
    <path d="M36 80 Q60 92 84 80 L86 87 Q60 101 34 87 Z" fill="url(#${g}s)" stroke="${OUT}" stroke-width="2.5"/>
    <path d="M78 88 l12 12 l-10 2 z" fill="url(#${g}s)" stroke="${OUT}" stroke-width="2.5" stroke-linejoin="round"/>
    <ellipse cx="60" cy="62" rx="30" ry="22" fill="url(#${g}h)" stroke="${OUT}" stroke-width="3.5"/>
    <path d="M42 62 C40 30 46 8 60 7 C74 8 80 30 78 62 Z" fill="url(#${g}n)" stroke="${OUT}" stroke-width="3.5" stroke-linejoin="round"/>
    ${happy ? `<path d="M46 40 Q60 58 74 40 Q60 48 46 40 Z" fill="#8a2a2a" stroke="${OUT}" stroke-width="2.5"/>` : ''}
    <path d="M44 56 l3 5 l3 -5 M70 56 l3 5 l3 -5" fill="#fff" stroke="${OUT}" stroke-width="1.5" stroke-linejoin="round"/>
    <g fill="${OUT}"><ellipse cx="54" cy="15" rx="2.4" ry="2"/><ellipse cx="66" cy="15" rx="2.4" ry="2"/></g>
    <ellipse cx="55" cy="26" rx="4" ry="8" fill="#fff" opacity=".45"/>
    ${e}
    <g fill="#ff7fa2" opacity="${mood === 'hurt' ? 0 : .55}"><ellipse cx="27" cy="74" rx="6" ry="3.5"/><ellipse cx="93" cy="74" rx="6" ry="3.5"/></g>
  </g>`);
  }

  // ---------- 餌の魚（頭が下＝こちらへ泳いでくる）。f = 0..3 の泳ぎコマ ----------
  function fish(f = 0, col = FISH_COLORS[0]) {
    const ph = (f % 4) / 4 * Math.PI * 2, s = Math.sin(ph), c = Math.cos(ph);
    const t = s * 9, rot = s * 5, fin = c * 5, g = uid();
    return svg(64, 80, `<defs>${rg(g, col.l, col.c, col.d, '40%', '55%')}</defs>
  <g transform="rotate(${rot.toFixed(1)} 32 48)">
    <path d="M32 26 Q${24 + t * .5} 16 ${18 + t} 3 Q32 ${11 + Math.abs(s) * 2} ${46 + t} 3 Q${40 + t * .5} 16 32 26 Z" fill="${col.d}" stroke="${OUT}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M11 42 L${1 - fin * .4} ${34 + fin} L8 52 Z M53 42 L${63 + fin * .4} ${34 - fin} L56 52 Z" fill="${col.d}" stroke="${OUT}" stroke-width="2.5" stroke-linejoin="round"/>
    <ellipse cx="32" cy="48" rx="21" ry="26" fill="url(#${g})" stroke="${OUT}" stroke-width="3.5"/>
    <path d="M18 38 Q32 34 46 38" stroke="${col.d}" stroke-width="2.5" fill="none" opacity=".55"/>
    <g stroke="${OUT}" stroke-width="2.5"><circle cx="22" cy="56" r="7" fill="#fff"/><circle cx="42" cy="56" r="7" fill="#fff"/></g>
    <g fill="#2a1a10"><circle cx="22.5" cy="58" r="4"/><circle cx="41.5" cy="58" r="4"/></g>
    <g fill="#fff"><circle cx="20.5" cy="56" r="1.6"/><circle cx="39.5" cy="56" r="1.6"/></g>
    <ellipse cx="32" cy="${70 + Math.abs(c)}" rx="${3 + Math.abs(c) * 1.5}" ry="${2 + Math.abs(c)}" fill="${OUT}"/>
    <ellipse cx="25" cy="34" rx="7" ry="4" fill="#fff" opacity=".5"/>
  </g>
  <g fill="#bfe9ff" opacity=".7"><circle cx="${10 + f * 3}" cy="${14 - f * 2}" r="2"/><circle cx="${56 - f * 2}" cy="${20 - f * 3}" r="1.5"/></g>`);
  }

  // ---------- ボス（10種類）。どれも正面・こちら向き。f は待機の揺れ、mood は表情 ----------
  const face = (mood, x1, x2, y, r, my, mw, teeth) => eyes(x1, x2, y, r, mood, { angry: mood === 'normal' }) + mouth((x1 + x2) / 2, my, mw, mood, teeth);
  const BOSSES = [
    // 1 ふぐ：泡（トゲ）を撃つ
    { id: 'puffer', draw(f, mood, g) {
      const p = f % 2 ? 1.04 : 1;
      const sp = Array.from({ length: 14 }, (_, i) => { const a = i / 14 * 6.283, x = 100 + Math.cos(a) * 62 * p, y = 100 + Math.sin(a) * 62 * p, x2 = 100 + Math.cos(a) * 77 * p, y2 = 100 + Math.sin(a) * 77 * p, px = Math.cos(a + 1.57) * 7, py = Math.sin(a + 1.57) * 7; return `<path d="M${x + px} ${y + py} L${x2} ${y2} L${x - px} ${y - py} Z"/>`; }).join('');
      return `<defs>${rg(g, '#fff6c4', '#ffd24a', '#d98a1c')}</defs><g fill="#f3e2a0" stroke="${OUT}" stroke-width="3" stroke-linejoin="round">${sp}</g>
      <circle cx="100" cy="100" r="${64 * p}" fill="url(#${g})" stroke="${OUT}" stroke-width="4"/><ellipse cx="100" cy="130" rx="44" ry="24" fill="#fff8de" opacity=".85"/>
      ${face(mood, 74, 126, 90, 17, 124, 14)}<g fill="#ff8a8a" opacity=".5"><ellipse cx="56" cy="116" rx="9" ry="5"/><ellipse cx="144" cy="116" rx="9" ry="5"/></g><ellipse cx="78" cy="56" rx="16" ry="8" fill="#fff" opacity=".6"/>`;
    } },
    // 2 くらげ：魚を呼ぶ（しびれ）
    { id: 'jelly', draw(f, mood, g) {
      const w = f % 2 ? 6 : -6;
      const ten = [50, 72, 100, 128, 150].map((x, i) => `<path d="M${x} 116 q${w + (i % 2 ? 8 : -8)} 20 0 40 q${-w} 20 ${i % 2 ? 6 : -6} 36" stroke="#ff9fd0" stroke-width="7" fill="none" stroke-linecap="round" opacity=".9"/>`).join('');
      return `<defs>${rg(g, '#fff0fa', '#ffa8dc', '#c85ca8')}</defs><g stroke="${OUT}" stroke-width="10" fill="none" stroke-linecap="round" opacity=".35">${ten.replace(/stroke="#ff9fd0" stroke-width="7"/g, '')}</g>${ten}
      <path d="M36 120 Q36 28 100 28 Q164 28 164 120 Q148 108 132 120 Q116 108 100 120 Q84 108 68 120 Q52 108 36 120 Z" fill="url(#${g})" stroke="${OUT}" stroke-width="4" stroke-linejoin="round" opacity=".95"/>
      <ellipse cx="78" cy="52" rx="20" ry="10" fill="#fff" opacity=".6"/>${face(mood, 76, 124, 78, 15, 100, 12)}`;
    } },
    // 3 たこ：墨を吐く
    { id: 'octo', draw(f, mood, g) {
      const w = f % 2 ? 5 : -5;
      const legs = [30, 58, 86, 114, 142, 170].map((x, i) => `<path d="M${100 + (x - 100) * .6} 130 Q${x + (i < 3 ? -10 : 10) + w} 160 ${x + (i < 3 ? -18 : 18)} 178 q${i < 3 ? -8 : 8} 8 ${i < 3 ? -2 : 2} 14" stroke="${OUT}" stroke-width="20" fill="none" stroke-linecap="round"/><path d="M${100 + (x - 100) * .6} 130 Q${x + (i < 3 ? -10 : 10) + w} 160 ${x + (i < 3 ? -18 : 18)} 178 q${i < 3 ? -8 : 8} 8 ${i < 3 ? -2 : 2} 14" stroke="#b06ae0" stroke-width="13" fill="none" stroke-linecap="round"/>`).join('');
      return `<defs>${rg(g, '#ecd6ff', '#b06ae0', '#6a2aa0')}</defs>${legs}<ellipse cx="100" cy="86" rx="64" ry="62" fill="url(#${g})" stroke="${OUT}" stroke-width="4"/>
      <g fill="#8a4ac8" opacity=".5"><circle cx="70" cy="46" r="7"/><circle cx="128" cy="40" r="5"/><circle cx="140" cy="62" r="4"/></g><ellipse cx="80" cy="44" rx="16" ry="8" fill="#fff" opacity=".5"/>
      ${face(mood, 76, 124, 94, 16, 122, 11)}${mood === 'normal' ? `<ellipse cx="100" cy="124" rx="9" ry="7" fill="#3a0a14" stroke="${OUT}" stroke-width="3"/>` : ''}`;
    } },
    // 4 かに：ハサミで泡を撃つ
    { id: 'crab', draw(f, mood, g) {
      const up = f % 2 ? -8 : 0;
      const claw = (x, s) => `<g transform="translate(${x} ${60 + up}) scale(${s} 1)"><path d="M0 40 Q-4 16 12 0 Q30 -8 34 14 L18 16 Q24 28 10 34 Z" fill="#ff6a4a" stroke="${OUT}" stroke-width="3.5" stroke-linejoin="round"/></g>`;
      return `<defs>${rg(g, '#ffc8b0', '#ff6a4a', '#b8321f')}</defs>
      <g stroke="${OUT}" stroke-width="7" stroke-linecap="round">${[0, 1, 2].map(i => `<path d="M${60 - i * 4} ${128 + i * 12} l-26 ${10 + i * 6}"/><path d="M${140 + i * 4} ${128 + i * 12} l26 ${10 + i * 6}"/>`).join('')}</g>
      <path d="M46 110 L30 ${84 + up} M154 110 L170 ${84 + up}" stroke="${OUT}" stroke-width="8" stroke-linecap="round"/>${claw(12, 1)}${claw(188, -1)}
      <path d="M78 96 L74 56 M122 96 L126 56" stroke="${OUT}" stroke-width="6" stroke-linecap="round"/>
      <ellipse cx="100" cy="128" rx="70" ry="46" fill="url(#${g})" stroke="${OUT}" stroke-width="4"/><ellipse cx="80" cy="104" rx="18" ry="8" fill="#fff" opacity=".5"/>
      ${eyes(74, 126, 50, 15, mood, { angry: mood === 'normal' })}${mouth(100, 136, 16, mood)}`;
    } },
    // 5 かじき：突進（長い角がこちらを向く）
    { id: 'marlin', draw(f, mood, g) {
      return `<defs>${rg(g, '#c8ecff', '#3a8ae0', '#1a3a8a')}</defs>
      <path d="M100 4 Q126 30 120 60 L80 60 Q74 30 100 4 Z" fill="#2a5ab8" stroke="${OUT}" stroke-width="3.5" stroke-linejoin="round"/>
      <path d="M40 100 L10 ${84 + (f % 2 ? 6 : 0)} L36 124 Z M160 100 L190 ${84 + (f % 2 ? 6 : 0)} L164 124 Z" fill="#2a5ab8" stroke="${OUT}" stroke-width="3" stroke-linejoin="round"/>
      <ellipse cx="100" cy="104" rx="62" ry="58" fill="url(#${g})" stroke="${OUT}" stroke-width="4"/><ellipse cx="100" cy="136" rx="40" ry="20" fill="#e8f6ff" opacity=".8"/>
      <path d="M92 150 L100 198 L108 150 Z" fill="#dfe9ee" stroke="${OUT}" stroke-width="3.5" stroke-linejoin="round"/>
      <ellipse cx="80" cy="68" rx="18" ry="8" fill="#fff" opacity=".5"/>${face(mood, 74, 126, 98, 16, 132, 12)}`;
    } },
    // 6 いか：墨＋呼ぶ
    { id: 'squid', draw(f, mood, g) {
      const w = f % 2 ? 7 : -7;
      const ten = [60, 76, 92, 108, 124, 140].map((x, i) => `<path d="M${x} 140 q${(i % 2 ? w : -w)} 22 ${(i < 3 ? -6 : 6)} 44" stroke="${OUT}" stroke-width="14" fill="none" stroke-linecap="round"/><path d="M${x} 140 q${(i % 2 ? w : -w)} 22 ${(i < 3 ? -6 : 6)} 44" stroke="#ffe2cf" stroke-width="8" fill="none" stroke-linecap="round"/>`).join('');
      return `<defs>${rg(g, '#fff4ea', '#ffd0b4', '#d88a6a')}</defs>${ten}
      <path d="M40 30 L66 18 L62 60 Z M160 30 L134 18 L138 60 Z" fill="#ffc2a0" stroke="${OUT}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M100 6 Q150 50 150 104 Q150 146 100 148 Q50 146 50 104 Q50 50 100 6 Z" fill="url(#${g})" stroke="${OUT}" stroke-width="4" stroke-linejoin="round"/>
      <g fill="#e89a7a" opacity=".6"><circle cx="86" cy="50" r="4"/><circle cx="112" cy="62" r="3"/></g><ellipse cx="84" cy="70" rx="12" ry="18" fill="#fff" opacity=".45"/>${face(mood, 78, 122, 108, 16, 134, 10)}`;
    } },
    // 7 でんきうなぎ：しびれ（泡を速く撃つ）
    { id: 'eel', draw(f, mood, g) {
      const z = f % 2 ? `<g fill="#fff36a" stroke="${OUT}" stroke-width="2.5" stroke-linejoin="round"><path d="M28 40 l14 10 l-8 4 l14 12 l-20 -8 l8 -4 z"/><path d="M172 40 l-14 10 l8 4 l-14 12 l20 -8 l-8 -4 z"/></g>` : '';
      return `<defs>${rg(g, '#f4ffc8', '#a8e04a', '#4a8a1a')}</defs>
      <path d="M100 150 C 30 150, 20 60, 90 40 C 150 22, 190 90, 150 120" stroke="${OUT}" stroke-width="38" fill="none" stroke-linecap="round"/>
      <path d="M100 150 C 30 150, 20 60, 90 40 C 150 22, 190 90, 150 120" stroke="#7ab83a" stroke-width="30" fill="none" stroke-linecap="round"/>${z}
      <ellipse cx="100" cy="128" rx="54" ry="48" fill="url(#${g})" stroke="${OUT}" stroke-width="4"/><ellipse cx="84" cy="100" rx="14" ry="7" fill="#fff" opacity=".5"/>${face(mood, 78, 122, 124, 15, 152, 12)}`;
    } },
    // 8 さめ：突進（大きな歯）
    { id: 'shark', draw(f, mood, g) {
      return `<defs>${rg(g, '#dbe8f2', '#7a9ab8', '#3a5070')}</defs>
      <path d="M100 6 L124 50 L76 50 Z" fill="#5a7898" stroke="${OUT}" stroke-width="3.5" stroke-linejoin="round"/>
      <path d="M26 110 L2 ${138 + (f % 2 ? 6 : 0)} L40 128 Z M174 110 L198 ${138 + (f % 2 ? 6 : 0)} L160 128 Z" fill="#5a7898" stroke="${OUT}" stroke-width="3" stroke-linejoin="round"/>
      <ellipse cx="100" cy="108" rx="80" ry="66" fill="url(#${g})" stroke="${OUT}" stroke-width="4"/>
      <path d="M32 124 Q100 186 168 124 Q100 150 32 124 Z" fill="#f4f8fb"/><ellipse cx="74" cy="66" rx="20" ry="9" fill="#fff" opacity=".45"/>
      ${eyes(68, 132, 92, 13, mood, { angry: mood === 'normal' })}${mood === 'normal' ? mouth(100, 130, 34, mood, true) : mouth(100, 134, 20, mood)}`;
    } },
    // 9 まんた：泡を扇状に撃つ
    { id: 'manta', draw(f, mood, g) {
      const flap = f % 2 ? -10 : 8;
      return `<defs>${rg(g, '#8aa8d8', '#2a4a8a', '#101e44')}</defs>
      <path d="M100 56 Q160 ${56 + flap} 198 ${104 + flap} Q150 118 116 148 L100 196 L84 148 Q50 118 2 ${104 + flap} Q40 ${56 + flap} 100 56 Z" fill="url(#${g})" stroke="${OUT}" stroke-width="4" stroke-linejoin="round"/>
      <path d="M80 60 Q72 40 82 30 M120 60 Q128 40 118 30" stroke="${OUT}" stroke-width="9" fill="none" stroke-linecap="round"/><path d="M80 60 Q72 40 82 30 M120 60 Q128 40 118 30" stroke="#3a5aa0" stroke-width="5" fill="none" stroke-linecap="round"/>
      <ellipse cx="100" cy="110" rx="44" ry="30" fill="#e8f0ff" opacity=".9"/><ellipse cx="70" cy="74" rx="18" ry="6" fill="#fff" opacity=".35"/>${face(mood, 76, 124, 88, 13, 118, 16)}`;
    } },
    // 10 ちょうちんあんこう：大ボス（光＋泡＋突進）
    { id: 'angler', draw(f, mood, g) {
      const glow = f % 2 ? 1 : .7;
      return `<defs>${rg(g, '#ff9a8a', '#d8413f', '#7a1a2a')}<radialGradient id="${g}l" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fffbd0"/><stop offset=".5" stop-color="#ffe14a" stop-opacity="${glow}"/><stop offset="1" stop-color="#ffe14a" stop-opacity="0"/></radialGradient></defs>
      <path d="M100 48 Q 110 10, 140 8" stroke="${OUT}" stroke-width="5" fill="none" stroke-linecap="round"/><circle cx="142" cy="8" r="${18 * glow + 6}" fill="url(#${g}l)"/><circle cx="142" cy="8" r="7" fill="#fff6b0" stroke="${OUT}" stroke-width="2.5"/>
      <path d="M18 108 L0 86 L8 130 Z M182 108 L200 86 L192 130 Z" fill="#a62a3a" stroke="${OUT}" stroke-width="3" stroke-linejoin="round"/>
      <ellipse cx="100" cy="112" rx="86" ry="76" fill="url(#${g})" stroke="${OUT}" stroke-width="4.5"/><ellipse cx="72" cy="58" rx="22" ry="10" fill="#fff" opacity=".35"/>
      ${eyes(68, 132, 88, 16, mood, { angry: mood === 'normal' })}${mood === 'normal' ? `<path d="M44 132 Q100 ${f % 2 ? 182 : 172} 156 132 Q100 150 44 132 Z" fill="#3a0a14" stroke="${OUT}" stroke-width="4" stroke-linejoin="round"/><g fill="#fff" stroke="${OUT}" stroke-width="1.5">${[0, 1, 2, 3, 4, 5, 6].map(i => `<path d="M${54 + i * 15} 136 l6 12 l6 -12 z"/>`).join('')}</g>` : mouth(100, 138, 22, mood)}`;
    } },
  ];
  function boss(i, f = 0, mood = 'normal') {
    const b = BOSSES[((i % BOSSES.length) + BOSSES.length) % BOSSES.length], g = uid();
    return svg(200, 200, b.draw(f, mood, g));
  }

  const FISH_COLORS = [
    { c: '#6ec8ff', d: '#2f78c8', l: '#d6f1ff' },
    { c: '#ffae5c', d: '#d8671f', l: '#ffe7c8' },
    { c: '#ff7fae', d: '#c83f78', l: '#ffd8e8' },
  ];
  const GOLD = { c: '#ffd84a', d: '#c98a14', l: '#fff6c0' };
  const BOSS_IDS = BOSSES.map(b => b.id);
  return { croc, fish, boss, FISH_COLORS, GOLD, BOSS_IDS };
})();
if (typeof window !== 'undefined') window.Art = Art;
if (typeof module !== 'undefined') module.exports = Art;

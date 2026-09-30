'use strict';

// =====================================================
//  起動画面：アイコン → クレジット → 注意事項（セーブは1つなのでスロット選択はない）
//  前作（infinity）と同じ流れ。どれもタップで飛ばせる。
//  ※ game.js より先に読み込むので、ゲームの関数は実行時にだけ使う
// =====================================================

const Boot = (() => {
  const NOTICE_VER = '1';
  const TT = {
    ja: {
      credit: 'A GAME BY',
      noticeTitle: 'おしらせ',
      notice: [
        'このゲームは個人が制作した非公式の作品です。',
        'セーブデータは端末のブラウザに保存されます。ブラウザの履歴やサイトデータを消すと、データも消えます。',
        'iPhone の Safari では、7日間ひらかないと消えることがあります。',
        '1回の旅は長め（100% までおよそ1時間）です。いつでも抜けられ、戻るとカウントダウンから再開します。',
        '長時間のプレイは、適度に休憩をとってください。',
        '予告なく内容を変更・終了することがあります。',
      ],
      agree: 'OK',
    },
    en: {
      credit: 'A GAME BY',
      noticeTitle: 'NOTICE',
      notice: [
        'This is an unofficial game made by an individual.',
        'Your save lives in this browser. Clearing history or site data deletes it.',
        'Safari on iPhone may delete it after 7 days without a visit.',
        'A run is long (about an hour to 100%). You can leave any time — the game saves and resumes with a countdown.',
        'Please take breaks during long sessions.',
        'The game may change or end without notice.',
      ],
      agree: 'OK',
    },
  };
  const tx = () => TT[Game.OPT.lang] || TT.ja;
  const ICON = `<svg viewBox="0 0 512 512" width="120" height="120" aria-hidden="true" shape-rendering="crispEdges">
    <rect x="64" y="84" width="384" height="96" fill="none" stroke="#39ff88" stroke-width="12"/>
    <rect x="244" y="196" width="24" height="44" fill="#fff"/>
    <g fill="#39ff88"><rect x="224" y="264" width="64" height="32"/><rect x="192" y="296" width="128" height="32"/>
    <rect x="160" y="328" width="192" height="64"/><rect x="128" y="392" width="256" height="48"/>
    <rect x="160" y="440" width="64" height="32"/><rect x="288" y="440" width="64" height="32"/></g>
    <g fill="#000"><rect x="192" y="328" width="32" height="32"/><rect x="288" y="328" width="32" height="32"/></g>
    <g fill="#ffe14a"><rect x="200" y="336" width="16" height="16"/><rect x="296" y="336" width="16" height="16"/></g></svg>`;

  let root, stage, skipHint, advance = null, needOk = false;

  // 1枚表示して、タップ（または時間）で次へ
  function show(html, { auto = 0, ok = false, cls = '' } = {}) {
    return new Promise(resolve => {
      stage.className = 'boot-stage ' + cls;
      stage.innerHTML = html;
      void stage.offsetWidth;
      stage.classList.add('in');
      needOk = ok;
      skipHint.hidden = ok;
      let timer = null;
      const done = () => {
        if (timer) clearTimeout(timer);
        advance = null;
        stage.classList.remove('in');
        stage.classList.add('out');
        setTimeout(resolve, 260);
      };
      advance = done;
      if (auto) timer = setTimeout(done, auto);
      const okBtn = stage.querySelector('[data-ok]');
      if (okBtn) okBtn.onclick = e => { e.stopPropagation(); done(); };
    });
  }

  async function start(skipIntro) {
    root = document.getElementById('boot');
    stage = document.getElementById('bootStage');
    skipHint = document.getElementById('bootSkip');
    root.hidden = false;
    root.classList.remove('gone');
    if (!root._wired) { root.addEventListener('click', () => { if (advance && !needOk) advance(); }); root._wired = true; }

    if (!skipIntro) {
      const T = tx();
      const quick = !!Game.OPT.bootSeen;
      await show(`<div class="boot-logo">${ICON}</div>`, { auto: quick ? 900 : 1900, cls: 'logo' });
      await show(`<div class="boot-credit"><small>${T.credit}</small><b>MASU01</b></div>`, { auto: quick ? 800 : 1700, cls: 'credit' });
      const firstNotice = Game.OPT.noticeVer !== NOTICE_VER;
      await show(`<div class="boot-notice"><div class="boot-title">${T.noticeTitle}</div><ul>${T.notice.map(x => `<li>${x}</li>`).join('')}</ul>
        ${firstNotice ? `<button class="boot-ok" data-ok>${T.agree}</button>` : ''}</div>`, { auto: firstNotice ? 0 : 2600, ok: firstNotice, cls: 'notice' });
      Game.OPT.noticeVer = NOTICE_VER;
      Game.OPT.bootSeen = true;
      Game.saveOpt();
    }

    root.classList.add('gone');
    setTimeout(() => { root.hidden = true; }, 400);
    Game.showMenu();
  }

  return { start };
})();
window.Boot = Boot;

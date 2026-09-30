'use strict';

// =====================================================
//  起動画面：アイコン → クレジット → 注意事項（セーブは1つなのでスロット選択はない）
//  前作（infinity）と同じ流れ。どれもタップで飛ばせる。
//  ※ game.js より先に読み込むので、ゲームの関数は実行時にだけ使う
// =====================================================

const Boot = (() => {
  const NOTICE_VER = '2';
  const TT = {
    ja: {
      credit: 'A GAME BY',
      noticeTitle: 'おしらせ',
      notice: [
        'このゲームは個人が制作した非公式の作品です。',
        '登場する妖怪は各地の伝承をもとにした創作の姿です。',
        'セーブデータは端末のブラウザに保存されます。ブラウザの履歴やサイトデータを消すと、データも消えます。',
        'iPhone の Safari では、7日間ひらかないと消えることがあります。',
        '本編は全十段（6分ほど）。いつでも抜けられ、戻るとカウントダウンから再開します。',
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
        'The yokai here are creative takes on Japanese folklore.',
        'Your save lives in this browser. Clearing history or site data deletes it.',
        'Safari on iPhone may delete it after 7 days without a visit.',
        'The main run is 10 stages (about 6 minutes). You can leave any time — it resumes with a countdown.',
        'Please take breaks during long sessions.',
        'The game may change or end without notice.',
      ],
      agree: 'OK',
    },
  };
  const tx = () => TT[Game.OPT.lang] || TT.ja;
  // ロゴ：墨で描いたワニと、朱の落款（ink.js は起動時には読み込み済み）
  const ICON = () => `<div style="display:flex;align-items:flex-end;justify-content:center;gap:8px">${Ink.croc(0, 'normal').replace('width="120" height="200"', 'width="84" height="140"')}${Ink.hanko(40, '鰐')}</div>`;

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
      await show(`<div class="boot-logo">${ICON()}</div>`, { auto: quick ? 900 : 1900, cls: 'logo' });
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

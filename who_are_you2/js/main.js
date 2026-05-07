// =========================================================================
// お前は誰だ？ main/search logic - data driven
// =========================================================================
const GAME = window.OMAEWA_DATA || { keywords:{}, articles:{}, hiddenReactions:{} };

const LS_SAVE = "omaewa_save";
const LS_KWLOG = "omaewa_kwlog";
const LS_FLAGS = "omaewa_flags";
const LS_ARTICLES_UNLOCKED = "omaewa_articles_unlocked";
const LS_ARTICLES_OPENED = "omaewa_articles_opened";
const LS_DISCOVERED = "omaewa_discovered_keywords";
const LS_SEARCH_HISTORY = "omaewa_search_history";
const LS_PENDING_KW = "omaewa_pending_kw";
const LS_PENDING_SCENE = "omaewa_pending_scene";
const LS_READ = "omaewa_read_scenes";
const LS_INTRO_ADS_VIEWED = "omaewa_intro_ads_viewed";

const PROGRESS_KEYWORDS = Object.keys(GAME.keywords || {});

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>'"]/g, ch => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;"
  }[ch]));
}
function renderRichText(str){
  const escaped = escapeHtml(str);
  return escaped.replace(/https?:\/\/[^\s<]+/g, url => {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
  });
}
function isMainProgressComplete(){
  const cleared = loadProgress();
  return PROGRESS_KEYWORDS.length > 0 && PROGRESS_KEYWORDS.every(k => cleared.has(k));
}
function isMovieUnlocked(){
  return isMainProgressComplete() || hasFlag("true_end") || hasFlag("debug_complete");
}
function updateMovieButton(){
  const btn = document.getElementById("movie-btn");
  if(!btn) return;
  btn.classList.toggle("is-open", isMovieUnlocked());
}

function loadJSON(key, fallback){ try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch(e){ return fallback; } }
function saveJSON(key, value){ try { localStorage.setItem(key, JSON.stringify(value)); } catch(e){} }
function loadSet(key){ return new Set(loadJSON(key, [])); }
function saveSet(key, set){ saveJSON(key, [...set]); }
function loadSave(){ return loadJSON(LS_SAVE, {}); }
function writeSave(data){ saveJSON(LS_SAVE, { ...loadSave(), ...data }); }

function getIntroAdItems(){
  return [
    {
      id: "virus_reason",
      title: "検索窓が閉じられない",
      subtitle: "システム障害レポート | 2024年",
      body: [
        "現在、検索エンジンを模倣した不明な干渉プログラムの拡散が確認されている。",
        "感染した端末では、検索窓が通常のページから切り離され、単独で残留するケースが報告されている。",
        "この画面は、そうした異常を封じ込めるための隔離領域として機能している。達成率100%が、ここから出るための条件として設定されている。"
      ]
    },
    {
      id: "article_guide",
      title: "このサイトの使い方",
      subtitle: "ガイド | はじめての方へ",
      body: [
        "記事を開くと、検索欄へ入力できる言葉が復元される。",
        "記事・広告・検索欄はすべて、崩壊したWebの断片から再構成されたUIだ。",
        "まず表示されているADをすべて確認することで、最初の記事が読めるようになる。"
      ]
    },
    {
      id: "isolation_notice",
      title: "感染した検索エンジンを隔離中",
      subtitle: "注意事項 | 運営より",
      body: [
        "この画面は、感染端末の検索エンジンを安全に隔離するために表示されている。",
        "外部のブラウザ履歴・個人情報・実際の検索内容は、一切取得しない。",
        "投下された記事を読み、言葉を復元していくことがここでの唯一の手順だ。"
      ]
    }
  ];
}
function loadIntroViewed(){ return loadSet(LS_INTRO_ADS_VIEWED); }
function isIntroComplete(){
  const viewed = loadIntroViewed();
  return getIntroAdItems().every(ad => viewed.has(ad.id));
}
function markIntroAdViewed(id){
  const viewed = loadIntroViewed();
  viewed.add(id);
  saveSet(LS_INTRO_ADS_VIEWED, viewed);
  if(isIntroComplete()){
    unlockArticle("first");
    const response = document.getElementById("response");
    if(response){
      response.textContent = "AD確認完了：最初の記事が復元されました。";
      response.style.backgroundColor = "#eef3ff";
      response.style.color = "#25305d";
    }
  }
  renderIntroAdStatus();
  updateArticleList();
}
function renderIntroAdStatus(){
  const el = document.getElementById("introAdStatus");
  if(!el) return;
  const total = getIntroAdItems().length;
  const count = getIntroAdItems().filter(ad => loadIntroViewed().has(ad.id)).length;
  el.textContent = count >= total ? "AD確認完了 / 初期記事復元済み" : `AD確認 ${count} / ${total}：すべて確認すると初期記事が復元されます`;
}
function openIntroAd(id){
  const item = getIntroAdItems().find(ad => ad.id === id) || getIntroAdItems()[0];
  markIntroAdViewed(item.id);
  openLooseWindow({ id:item.id, title:item.title, subtitle:item.subtitle, body:item.body }, true);
}

function loadFlags(){ return loadSet(LS_FLAGS); }
function addFlag(flag){ if(!flag) return; const s=loadFlags(); s.add(flag); saveSet(LS_FLAGS,s); }
function hasFlag(flag){ return loadFlags().has(flag); }

function loadUnlockedArticles(){
  const s = loadSet(LS_ARTICLES_UNLOCKED);
  const introDone = isIntroComplete() || hasFlag("debug_complete");
  Object.entries(GAME.articles || {}).forEach(([id,a]) => {
    if(a.initial){
      if(introDone) s.add(id);
      else s.delete(id);
    }
  });
  return s;
}
function unlockArticle(id){ if(!id || !GAME.articles[id]) return; const s=loadUnlockedArticles(); s.add(id); saveSet(LS_ARTICLES_UNLOCKED,s); }
function loadOpenedArticles(){ return loadSet(LS_ARTICLES_OPENED); }
function saveOpenedArticles(set){ saveSet(LS_ARTICLES_OPENED,set); }
function loadDiscoveredKeywords(){ return loadSet(LS_DISCOVERED); }
function discoverKeyword(kw){ if(!kw) return; const s=loadDiscoveredKeywords(); s.add(kw); saveSet(LS_DISCOVERED,s); }

function loadProgress(){ return new Set((loadSave().clearedKw || [])); }
function markKeyword(kw){
  const save=loadSave();
  const list=save.clearedKw || [];
  if(!list.includes(kw)) list.push(kw);
  writeSave({ clearedKw:list, lastKw:kw });
  updateProgressBar();
}

function addKwLog(kw,label){
  const log=loadJSON(LS_KWLOG, []);
  const now=new Date();
  const time=`${now.getMonth()+1}/${now.getDate()} ${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
  log.push({kw,label,time});
  saveJSON(LS_KWLOG, log);
}
function loadSearchHistory(){ return loadJSON(LS_SEARCH_HISTORY, []); }
function saveSearchHistory(h){ saveJSON(LS_SEARCH_HISTORY, h); }
function addSearchHistory(word){
  const value=String(word||"").trim();
  if(!value) return;
  let history=loadSearchHistory().filter(v=>v!==value);
  history.unshift(value);
  history=history.slice(0,10);
  saveSearchHistory(history);
  renderSearchHistory();
}
function renderSearchHistory(){
  const box=document.getElementById("searchHistoryList");
  if(!box) return;
  box.innerHTML="";
  loadSearchHistory().forEach(word=>{
    const btn=document.createElement("button");
    btn.type="button";
    btn.className="history-chip";
    btn.textContent=word;
    btn.addEventListener("click",()=>{
      const input=document.getElementById("userInput");
      if(input){ input.value=word; input.focus(); }
    });
    box.appendChild(btn);
  });
}

function updateProgressBar(){
  const cleared=loadProgress();
  const total=PROGRESS_KEYWORDS.length || 1;
  const count=PROGRESS_KEYWORDS.filter(k=>cleared.has(k)).length;
  const pct=Math.round((count/total)*100);
  const fill=document.getElementById("progressFill");
  if(fill){ fill.style.width=`${pct}%`; fill.setAttribute("aria-label",`達成率 ${pct}%`); }
  renderClearAds();
  updateMovieButton();
}

function getSecretCompletion(){
  const cfg = GAME.completion || {};
  const scenes = cfg.sceneTargets || Object.keys(GAME.scenes || {});
  const hidden = cfg.hiddenTargets || Object.keys(GAME.hiddenReactions || {});
  const readScenes = loadSet(LS_READ);
  const flags = loadFlags();
  const total = scenes.length + hidden.length;
  const sceneCount = scenes.filter(id => readScenes.has(id)).length;
  const hiddenCount = hidden.filter(word => flags.has(`hidden:${word}`)).length;
  const count = sceneCount + hiddenCount;
  const pct = total ? Math.round((count / total) * 100) : 0;
  return { pct, count, total, sceneCount, hiddenCount, complete: total > 0 && count >= total };
}
function updateSecretProgress(){
  const stat = getSecretCompletion();
  const section = document.getElementById("secret-progress-section");
  const fill = document.getElementById("secretProgressFill");
  const text = document.getElementById("secretProgressText");
  const cleared = hasFlag("true_end");
  if(section){ section.style.display = cleared ? "block" : "none"; }
  if(fill){ fill.style.width = `${stat.pct}%`; fill.setAttribute("aria-label",`裏達成度 ${stat.pct}%`); }
  if(text){
    text.textContent = stat.complete
      ? "COMPLETE / すべての断片を回収"
      : `${stat.count}/${stat.total} 断片回収`;
  }
}


// =========================================================================
// Tester mode: title x7 -> click progress bar to inspect missing story fragments
// =========================================================================
let testerTitleTapCount = 0;
let testerModeUnlocked = false;

function getSceneTitleForTester(sceneId){
  const scene = (GAME.scenes || {})[sceneId] || {};
  return scene.title || sceneId;
}
function getTesterCollectionStatus(){
  const cfg = GAME.completion || {};
  const sceneTargets = cfg.sceneTargets || Object.keys(GAME.scenes || {});
  const hiddenTargets = cfg.hiddenTargets || Object.keys(GAME.hiddenReactions || {});
  const readScenes = loadSet(LS_READ);
  const flags = loadFlags();
  const missingScenes = sceneTargets
    .filter(id => !readScenes.has(id))
    .map(id => ({ id, title: getSceneTitleForTester(id) }));
  const collectedScenes = sceneTargets
    .filter(id => readScenes.has(id))
    .map(id => ({ id, title: getSceneTitleForTester(id) }));
  const missingHidden = hiddenTargets.filter(word => !flags.has(`hidden:${word}`));
  const collectedHidden = hiddenTargets.filter(word => flags.has(`hidden:${word}`));
  const total = sceneTargets.length + hiddenTargets.length;
  const collected = collectedScenes.length + collectedHidden.length;
  const pct = total ? Math.round((collected / total) * 100) : 0;
  return { sceneTargets, hiddenTargets, missingScenes, collectedScenes, missingHidden, collectedHidden, total, collected, pct };
}
function openTesterMissingWindow(){
  if(!testerModeUnlocked) return;
  const stat = getTesterCollectionStatus();
  const win = openLooseWindow({
    id: "tester_missing_stories",
    title: "TESTER / 未回収チェック",
    subtitle: "DEBUG / COLLECTION STATUS",
    body: ["未回収のストーリー断片を確認します。通常プレイ中は表示されないテスター用タブです。"]
  }, false);
  const missingSceneHtml = stat.missingScenes.length
    ? `<ol class="tester-list">${stat.missingScenes.map(s => `<li><strong>${escapeHtml(s.title)}</strong><code>${escapeHtml(s.id)}</code></li>`).join("")}</ol>`
    : `<p class="tester-ok">ストーリーは全回収済みです。</p>`;
  const missingHiddenHtml = stat.missingHidden.length
    ? `<ol class="tester-list">${stat.missingHidden.map(w => `<li><strong>${escapeHtml(w)}</strong><code>隠し反応</code></li>`).join("")}</ol>`
    : `<p class="tester-ok">隠し反応は全回収済みです。</p>`;
  win.querySelector(".pseudo-site-body").innerHTML = `
    <p class="pseudo-kicker">DEBUG / COLLECTION STATUS</p>
    <h2>未回収チェック</h2>
    <p>裏達成度：${stat.pct}%（${stat.collected}/${stat.total}）</p>
    <h3 class="tester-heading">未回収ストーリー</h3>
    ${missingSceneHtml}
    <h3 class="tester-heading">未回収の隠し反応</h3>
    ${missingHiddenHtml}
    <p class="tester-note">タイトルを7回押した後だけ、達成率バーから開けます。</p>
  `;
}
function setupTesterMode(){
  const title = document.getElementById("game-title");
  const progressSection = document.getElementById("progress-section");
  const progressBar = document.getElementById("progressBar");
  if(title){
    title.style.cursor = "default";
    title.addEventListener("click", () => {
      testerTitleTapCount += 1;
      if(testerTitleTapCount >= 7 && !testerModeUnlocked){
        testerModeUnlocked = true;
        const response = document.getElementById("response");
        if(response){
          response.textContent = "TESTER MODE：達成率バーで未回収ストーリーを確認できます。";
          response.style.backgroundColor = "#10182d";
          response.style.color = "#dbe6ff";
        }
      }
    });
  }
  const handler = (e) => {
    if(!testerModeUnlocked) return;
    e.preventDefault();
    e.stopPropagation();
    openTesterMissingWindow();
  };
  if(progressSection) progressSection.addEventListener("click", handler);
  if(progressBar) progressBar.addEventListener("click", handler);
}

// =========================================================================
// Articles / pseudo windows
// =========================================================================
function getUnlockedArticles(){
  const unlocked=loadUnlockedArticles();
  return Object.entries(GAME.articles || {})
    .filter(([id])=>unlocked.has(id))
    .map(([id,a])=>({ id, ...a }));
}
function updateArticleList(){
  const list=document.getElementById("articleList");
  if(!list) return;
  const articles=getUnlockedArticles();
  list.innerHTML="";
  if(articles.length === 0){
    // 初期状態では検索欄の下に何も表示しない。
    return;
  }
  articles.forEach(article=>{
    const card=document.createElement("button");
    card.className="article-card";
    card.type="button";
    card.innerHTML=`<strong>${escapeHtml(article.title)}</strong>`;
    card.addEventListener("click",()=>openArticleWindow(article.id));
    list.appendChild(card);
  });
}
let articleZ=300;
function openArticleWindow(articleId){
  const article=GAME.articles[articleId];
  if(!article) return;
  const opened=loadOpenedArticles();
  opened.add(articleId); saveOpenedArticles(opened);
  discoverKeyword(article.keyword);
  updateArticleList();

  const existing=document.getElementById(`site-${articleId}`);
  if(existing){ existing.style.display="block"; existing.style.zIndex=String(++articleZ); return; }
  const win=document.createElement("section");
  win.className="pseudo-site-window";
  win.id=`site-${articleId}`;
  win.style.zIndex=String(++articleZ);
  win.style.left=`${40+(articleZ%5)*22}px`;
  win.style.top=`${118+(articleZ%5)*18}px`;
  const paragraphs=(article.body||[]).map(p=>`<p>${renderRichText(p)}</p>`).join("");
  const hasHints = article.hints && article.hints.length > 0;
  const hintBlock = hasHints ? `
    <div class="inline-hint-area">
      <button class="ad-box ad-hint inline-hint-trigger" type="button">
        <span class="ad-pr">HINT</span>
        <strong>この記事のヒントを見る</strong>
        <small>自力で解きたい場合は開かなくて構わない。</small>
      </button>
      <div class="inline-hint-body" style="display:none;"></div>
    </div>` : "";
  win.innerHTML=`
    <div class="pseudo-titlebar">
      <div class="pseudo-tab-title">${escapeHtml(article.title)}</div>
      <button class="pseudo-close" type="button" aria-label="閉じる">×</button>
    </div>
    <article class="pseudo-site-body">
      <p class="pseudo-kicker">${escapeHtml(article.subtitle || "ARTICLE")}</p>
      <h2>${escapeHtml(article.title)}</h2>
      ${paragraphs}
      ${hintBlock}
    </article>`;
  document.body.appendChild(win);
  win.querySelector(".pseudo-close").addEventListener("click",()=>{ win.style.display="none"; });
  makeWindowDraggable(win, win.querySelector(".pseudo-titlebar"));
  if(hasHints) setupInlineHint(win, article);
}
function setupInlineHint(win, article){
  const hints = article.hints || [];
  let current = -1; // -1 = 未開封
  const trigger = win.querySelector(".inline-hint-trigger");
  const body = win.querySelector(".inline-hint-body");
  trigger.addEventListener("click", ()=>{
    trigger.style.display = "none";
    current = 0;
    renderInlineHint();
  });
  function renderInlineHint(){
    const isLast = current >= hints.length - 1;
    body.style.display = "block";
    body.innerHTML = `
      <div class="hint-step">
        <p class="pseudo-kicker" style="margin-bottom:6px;">HINT ${current+1} / ${hints.length}</p>
        <p>${escapeHtml(hints[current])}</p>
      </div>
      <div class="hint-actions">
        ${!isLast
          ? `<button type="button" class="hint-btn primary">次のヒントを見る</button>`
          : `<p class="hint-end-note">これ以上のヒントはない。</p>`
        }
      </div>`;
    if(!isLast){
      body.querySelector(".hint-btn.primary").addEventListener("click",()=>{ current++; renderInlineHint(); });
    }
  }
}
function makeWindowDraggable(win, handle){
  let dragging=false,startX=0,startY=0,baseX=0,baseY=0;
  handle.addEventListener("pointerdown",e=>{
    if(e.target.closest("button")) return;
    dragging=true; win.style.zIndex=String(++articleZ);
    startX=e.clientX; startY=e.clientY; baseX=win.offsetLeft; baseY=win.offsetTop;
    handle.setPointerCapture(e.pointerId);
  });
  handle.addEventListener("pointermove",e=>{
    if(!dragging) return;
    win.style.left=`${Math.max(8,Math.min(window.innerWidth-80,baseX+e.clientX-startX))}px`;
    win.style.top=`${Math.max(8,Math.min(window.innerHeight-60,baseY+e.clientY-startY))}px`;
  });
  const stop=e=>{ if(!dragging) return; dragging=false; try{handle.releasePointerCapture(e.pointerId);}catch(_){} };
  handle.addEventListener("pointerup",stop); handle.addEventListener("pointercancel",stop);
}
function openLooseWindow(data, reuse=true){
  const existing=document.getElementById(`site-${data.id}`);
  if(existing && reuse){ existing.style.display="block"; existing.style.zIndex=String(++articleZ); return existing; }
  const win=document.createElement("section");
  win.className="pseudo-site-window";
  win.id=`site-${data.id}_${Date.now()}`;
  win.style.zIndex=String(++articleZ);
  win.style.left=`${72+(articleZ%5)*18}px`;
  win.style.top=`${96+(articleZ%5)*16}px`;
  const paragraphs=(data.body||[]).map(p=>`<p>${renderRichText(p)}</p>`).join("");
  win.innerHTML=`<div class="pseudo-titlebar"><div class="pseudo-tab-title">${escapeHtml(data.title)}</div><button class="pseudo-close" type="button">×</button></div><article class="pseudo-site-body"><p class="pseudo-kicker">${escapeHtml(data.subtitle||"NOTICE")}</p><h2>${escapeHtml(data.title)}</h2>${paragraphs}</article>`;
  document.body.appendChild(win);
  win.querySelector(".pseudo-close").addEventListener("click",()=>win.style.display="none");
  makeWindowDraggable(win, win.querySelector(".pseudo-titlebar"));
  return win;
}

function openVoiceMemoWindow(){
  const memos = [
    {
      id: "PLAYER_013",
      time: "00:02:18 / 接続直後",
      text: "待って。検索しただけなのに戻れない。タブを閉じても、同じサイトに戻される。右の広告だけは普通に読めるのが逆に怖い。"
    },
    {
      id: "PLAYER_021",
      time: "00:07:44 / 記事確認後",
      text: "記事を開くと検索できる言葉が増える。これはニュースサイトじゃない。誰かが、ここから出る手順を記事に混ぜてる。"
    },
    {
      id: "PLAYER_034",
      time: "00:19:03 / 達成率観測",
      text: "達成率が上がった。たぶん100%が出口。問題は、何を達成すればいいのかが記事の中にしか書かれていないこと。"
    },
    {
      id: "PLAYER_058",
      time: "01:11:29 / 感染拡大ログ",
      text: "他のサイトはUIが崩れて読めない。ここだけが崩れていない。避難所なのか、罠なのか、まだ判断できない。"
    }
  ];
  const win = openLooseWindow({
    id: "voice_memo_player_reactions",
    title: "ボイスメモ / PLAYER反応ログ",
    subtitle: "VOICE MEMO / INFECTED PLAYERS",
    body: ["このサイトに飛ばされたPLAYERの反応ログです。音声データは破損しているため、復元された文字起こしのみ表示します。"]
  }, true);
  win.querySelector(".pseudo-site-body").innerHTML = `
    <p class="pseudo-kicker">VOICE MEMO / INFECTED PLAYERS</p>
    <h2>PLAYER反応ログ</h2>
    <p>このサイトに飛ばされたPLAYERの反応です。音声データは破損しているため、復元された文字起こしのみ表示します。</p>
    ${memos.map(m => `
      <section class="voice-log">
        <strong>${escapeHtml(m.id)}</strong>
        <em>${escapeHtml(m.time)}</em>
        <p>${escapeHtml(m.text)}</p>
      </section>
    `).join("")}
  `;
}

function getClearAdItems(){
  return [
    {
      id: "clear_global_spread",
      title: "世界規模のUI崩壊について",
      subtitle: "緊急報告 | クリア後に解除された記録",
      lead: "達成率100%後に追加された報告",
      small: "このウイルスは、すでに世界中のWebサイトへ広がっている。",
      body: [
        "確認されたプログラムは、検索結果・広告枠・ボタン配置を書き換え、多くのWebサイトの見た目だけを静かに壊している。",
        "ページそのものが消えたのではない。表示の順番、押せる場所、戻る導線だけが、じわじわと差し替えられていった。",
        "その中で、この避難サイトだけは崩壊を免れ、記事・広告・検索欄の形を保ち続けていた。"
      ]
    },
    {
      id: "clear_shelter_reason",
      title: "このサイトだけが崩れなかった理由",
      subtitle: "解説 | 避難サイトの正体",
      lead: "避難サイトの正体",
      small: "ここは感染端末を隔離するために残された退避領域だ。",
      body: [
        "このサイトは、感染した検索窓を封じ込めるために構成された仮想の隔離空間だ。",
        "飛ばされたのではなく、崩壊したWebの外に一時的に退避させられていた。",
        "達成率100%は、その退避処理が完了したことを意味している。"
      ]
    },
    {
      id: "clear_movie_notice",
      title: "復元された記憶データについて",
      subtitle: "お知らせ | TRUE ROUTE MOVIE 解放",
      lead: "映画化モード予告",
      small: "回収された記憶は、一本の映像として再構成できる。",
      body: [
        "断片化していた記事・検索語・ストーリーは、達成率100%によってひとつの流れに戻った。",
        "TRUE ROUTE MOVIEでは、最初にこの避難サイトへ接続された導入を再生し、正規ルートの物語を選択肢なしでつないでいく。",
        "最後に、このウイルスと避難サイトの記録を重ねて、物語全体を閉じる。"
      ]
    }
  ];
}
function openClearAd(id){
  const item = getClearAdItems().find(ad => ad.id === id);
  if(!item) return;
  openLooseWindow({ id:item.id, title:item.title, subtitle:item.subtitle, body:item.body }, true);
}
function renderClearAds(){
  const area = document.getElementById("clearAdArea");
  if(!area) return;
  const unlocked = isMainProgressComplete() || hasFlag("true_end") || hasFlag("debug_complete");
  if(!unlocked){
    area.classList.remove("is-open");
    area.innerHTML = "";
    return;
  }
  area.classList.add("is-open");
  area.innerHTML = getClearAdItems().map(ad => `
    <button class="ad-box ad-clear" type="button" data-clear-ad="${escapeHtml(ad.id)}">
      <span class="ad-pr">CLEAR AD</span>
      <strong>${escapeHtml(ad.lead)}</strong>
      <small>${escapeHtml(ad.small)}</small>
    </button>
  `).join("");
  area.querySelectorAll("[data-clear-ad]").forEach(btn => {
    btn.addEventListener("click", () => openClearAd(btn.getAttribute("data-clear-ad")));
  });
}

function openVirusReason(){ openIntroAd("virus_reason"); }
function openArticleGuide(){ openIntroAd("article_guide"); }


// =========================================================================
// TRUE ROUTE MOVIE from 12.html
// =========================================================================
// 映画版は「全回収」ではなく、正規ルートだけを一本化して再生する。
// BAD END / 分岐選択肢 / チャプター表示は入れない。
let movieLines = [];
let movieIndex = 0;
let movieAutoTimer = null;
let movieAutoTimeout = null;
let movieReturnTimeout = null;
let movieCurrentImage = "";
function calcMovieAutoDuration(text){
  // 初見で読み切れる速度寄り：1文字あたり約0.22秒 + 最低3.5秒、最大14秒
  const len = String(text || "").replace(/\s/g, "").length;
  return Math.min(14000, Math.max(3500, len * 220));
}


function getMovieImagePath(image){
  if(!image) return "";
  const raw = String(image);
  if(raw.startsWith("png/") || raw.startsWith("./") || raw.startsWith("http")) return raw;
  return `png/${raw}`;
}
function shouldSkipMovieLine(text){
  const t = String(text || "").trim();
  if(!t) return true;
  if(/^【.*選んだ場合/.test(t)) return true;
  if(/^※/.test(t)) return true;
  if(t.includes("紹介記事からアクセス")) return true;
  if(t.includes("検索欄に入力してください")) return true;
  if(t.includes("どちらか一個ね")) return true;
  if(t === "「え〜。まぁ分かった。じゃあ…") return true;
  return false;
}
function pushMovieLine(out, text, image=""){
  const clean = String(text || "").replace(/ソトカンガゴトサイ/g, "").trim();
  if(!clean) return;
  out.push({ text: clean, image: image || "" });
}
function addMovieScene(out, sceneId, options={}){
  const scene = (GAME.scenes || {})[sceneId];
  if(!scene) return;
  const lines = scene.lines || [];
  const skipLast = Number(options.skipLast || 0);
  lines.forEach((line, index) => {
    if(skipLast && index >= lines.length - skipLast) return;
    const text = line && line.text ? line.text : "";
    if(shouldSkipMovieLine(text)) return;
    pushMovieLine(out, text, line.image || "");
  });
}
function buildTrueRouteMovieLines(){
  const out = [];

  pushMovieLine(out, "検索しようとした瞬間、画面のUIが崩れた。\n戻るボタンは反応せず、閉じたはずのタブは同じ避難サイトへ戻される。", "");
  pushMovieLine(out, "世界中でWebサイトの表示崩壊が起きている。\nこのサイトだけが、記事、広告、検索欄を保ったまま残っていた。", "");
  pushMovieLine(out, "画面に残された条件はひとつ。\n達成率を100%にすれば、このサイトから抜け出せる。", "");

  addMovieScene(out, "start");
  addMovieScene(out, "love");
  addMovieScene(out, "sion");
  addMovieScene(out, "jitsuie");
  pushMovieLine(out, "俺は、まず父さんに話を聞きに行くことにした。", "");
  addMovieScene(out, "father");
  pushMovieLine(out, "それでも、ゲームの意味を確かめるには弟の話が必要だった。\n俺は、弟が帰るまで待つことにした。", "");
  addMovieScene(out, "kioku", { skipLast: 3 });
  pushMovieLine(out, "俺は、弟の右手を見た。", "");
  addMovieScene(out, "migite");
  addMovieScene(out, "nagashichijimi");
  addMovieScene(out, "go_true_ending");

  pushMovieLine(out, "達成率100%。\n退避処理は完了した。", "");
  pushMovieLine(out, "このウイルスは、すでに世界中のWebサイトへ広がっていた。\n検索結果、広告枠、ボタン配置。多くのUIが崩れていた。", "");
  pushMovieLine(out, "ここは感染端末を隔離するために残された退避領域だった。\nPLAYERは閉じ込められていたのではなく、崩壊したWebから一時的に退避させられていた。", "");
  pushMovieLine(out, "復元された記憶は、一本の映像として再構成された。\nこれで、このサイトの役割は終わる。", "");

  return out;
}
function renderMovieLine(){
  const overlay = document.getElementById("movie-overlay");
  const visual = document.getElementById("movie-visual");
  const title = document.getElementById("movie-title");
  const text = document.getElementById("movie-text");
  const count = document.getElementById("movie-count");
  if(!overlay || !visual || !title || !text || !count) return;
  const item = movieLines[movieIndex];
  if(!item){ closeTrueRouteMovie(); return; }
  title.textContent = "復元された記憶データ";
  text.textContent = item.text || "";
  count.textContent = `${movieIndex + 1} / ${movieLines.length}`;
  if(item.image) movieCurrentImage = getMovieImagePath(item.image);
  if(movieCurrentImage){
    visual.classList.remove("no-image");
    visual.innerHTML = `<img src="${escapeHtml(movieCurrentImage)}" alt="">`;
  } else {
    visual.classList.add("no-image");
    visual.innerHTML = "";
  }
}
function openTrueRouteMovie(){
  if(!isMovieUnlocked()){
    const response = document.getElementById("response");
    if(response){
      response.textContent = "TRUE ROUTE MOVIEは、達成率100%後に解放されます。";
      response.style.backgroundColor = "#10182d";
      response.style.color = "#dbe6ff";
    }
    return;
  }
  // 12.html内の旧オーバーレイではなく、special.htmlの映画プレイヤーUIで再生する。
  // file:// 直開きでも iframe を使わないため、同一ファイル読み込みエラーを避けられる。
  try {
    localStorage.setItem("omaewa_true_route_movie", "1");
    localStorage.removeItem(LS_PENDING_KW);
    localStorage.removeItem(LS_PENDING_SCENE);
  } catch(e) {}
  window.location.href = "special.html";
}
function closeTrueRouteMovie(){
  stopMovieAuto();
  if(movieReturnTimeout){ clearTimeout(movieReturnTimeout); movieReturnTimeout = null; }
  const overlay = document.getElementById("movie-overlay");
  if(overlay){
    overlay.classList.remove("is-open");
    overlay.setAttribute("aria-hidden", "true");
  }
}
function nextMovieLine(){
  if(!movieLines.length) return;
  if(movieIndex >= movieLines.length - 1){
    stopMovieAuto();
    const text = document.getElementById("movie-text");
    if(text && !text.textContent.includes("--- END ---")) text.textContent += "\n\n--- END ---";
    if(movieReturnTimeout) clearTimeout(movieReturnTimeout);
    movieReturnTimeout = setTimeout(closeTrueRouteMovie, 6000);
    return;
  }
  movieIndex += 1;
  renderMovieLine();
}
function stopMovieAuto(){
  if(movieAutoTimer){ movieAutoTimer = null; }
  if(movieAutoTimeout){ clearTimeout(movieAutoTimeout); movieAutoTimeout = null; }
  const btn = document.getElementById("movie-auto-btn");
  if(btn) btn.textContent = "AUTO";
}
function toggleMovieAuto(){
  if(movieAutoTimer || movieAutoTimeout){ stopMovieAuto(); return; }
  movieAutoTimer = true;
  const btn = document.getElementById("movie-auto-btn");
  if(btn) btn.textContent = "STOP";
  const step = () => {
    if(movieIndex >= movieLines.length - 1){
      stopMovieAuto();
      if(movieReturnTimeout) clearTimeout(movieReturnTimeout);
      movieReturnTimeout = setTimeout(closeTrueRouteMovie, 6000);
      return;
    }
    nextMovieLine();
    movieAutoTimeout = setTimeout(step, calcMovieAutoDuration(movieLines[movieIndex]?.text || ""));
  };
  movieAutoTimeout = setTimeout(step, calcMovieAutoDuration(movieLines[movieIndex]?.text || ""));
}

// =========================================================================
// Search / routing
// =========================================================================
function normalizeInput(v){ return String(v||"").trim(); }
function findKeyword(input){
  const raw=normalizeInput(input);
  if(GAME.keywords[raw]) return raw;
  const lower=raw.toLowerCase();
  if(GAME.keywords[lower]) return lower;
  return null;
}
function goToStory(keyword){
  try {
    localStorage.setItem(LS_PENDING_KW, keyword || "");
    const scene = GAME.keywords[keyword]?.scene || "start";
    localStorage.setItem(LS_PENDING_SCENE, scene);
  } catch(e) {}
  window.location.href="special.html";
}
function checkAnswer(){
  const inputEl=document.getElementById("userInput");
  const responseEl=document.getElementById("response");
  const raw=normalizeInput(inputEl.value);
  if(!raw) return;
  addSearchHistory(raw);

  if(GAME.hiddenReactions && Object.prototype.hasOwnProperty.call(GAME.hiddenReactions, raw)){
    addFlag(`hidden:${raw}`);
    responseEl.textContent=GAME.hiddenReactions[raw];
    responseEl.style.backgroundColor="#fff";
    responseEl.style.color="#222842";
    updateSecretProgress();
    return;
  }

  const key=findKeyword(raw);
  if(!key){
    responseEl.textContent="そんな名前は知らん！";
    responseEl.style.backgroundColor="#f0f0f0";
    responseEl.style.color="#333";
    return;
  }
  const discovered=loadDiscoveredKeywords();
  if(!discovered.has(key)){
    responseEl.textContent="その言葉は、まだ記事で確認されていません。";
    responseEl.style.backgroundColor="#2c2330";
    responseEl.style.color="#e6cce6";
    return;
  }
  const kw=GAME.keywords[key];
  responseEl.textContent=kw.label || `「${key}」`;
  responseEl.style.backgroundColor="#2c2c3e";
  responseEl.style.color="#c8bedd";
  addKwLog(key, responseEl.textContent);
  markKeyword(key);
  discoverKeyword(key);
  if(kw.unlockFlag) addFlag(kw.unlockFlag);
  setTimeout(()=>goToStory(key), 700);
}

function continueGame(){
  const save=loadSave();
  const last=save.lastKw;
  if(last && GAME.keywords[last]) goToStory(last);
  else goToStory("お前は誰だ？");
}
function resetGame(){
  if(!confirm("最初からはじめますか？\nセーブデータが削除されます。")) return;
  [LS_SAVE,LS_KWLOG,LS_FLAGS,LS_ARTICLES_UNLOCKED,LS_ARTICLES_OPENED,LS_DISCOVERED,LS_SEARCH_HISTORY,LS_PENDING_KW,LS_PENDING_SCENE,LS_READ,LS_INTRO_ADS_VIEWED].forEach(k=>localStorage.removeItem(k));
  location.reload();
}


function goTitle(){
  if(window.OmaewaBGM && typeof window.OmaewaBGM.armAutoplay==='function') window.OmaewaBGM.armAutoplay();
  setTimeout(()=>{ location.href = './title.html'; }, 60);
}
function confirmGoTitle(){
  return confirm('タイトル画面に戻りますか？\n進行状況はオートセーブされています。');
}

// legacy stubs for old buttons if any
function showEndroll(){}
function closeEndroll(){}

// API used by special.html through localStorage only, kept visible for debugging.
window.omaewaUnlockArticle = unlockArticle;
window.omaewaAddFlag = addFlag;



// =========================================================================
// Developer complete button: invisible left-edge button sets all collection to 100%
// =========================================================================
function completeAllAchievementsForDebug(){
  const allKeywords = Object.keys(GAME.keywords || {});
  const allArticles = Object.keys(GAME.articles || {});
  const allScenes = Object.keys(GAME.scenes || {});
  const hiddenWords = Object.keys(GAME.hiddenReactions || {});
  const sceneTargets = (GAME.completion && GAME.completion.sceneTargets) || allScenes;
  const hiddenTargets = (GAME.completion && GAME.completion.hiddenTargets) || hiddenWords;

  saveJSON(LS_ARTICLES_UNLOCKED, allArticles);
  saveJSON(LS_ARTICLES_OPENED, allArticles);
  saveJSON(LS_INTRO_ADS_VIEWED, getIntroAdItems().map(ad => ad.id));

  const discovered = new Set(allKeywords);
  Object.values(GAME.articles || {}).forEach(article => { if(article && article.keyword) discovered.add(article.keyword); });
  saveSet(LS_DISCOVERED, discovered);

  const flags = loadFlags();
  allKeywords.forEach(keyword => {
    const kw = GAME.keywords[keyword];
    if(kw && kw.unlockFlag) flags.add(kw.unlockFlag);
  });
  hiddenTargets.forEach(word => flags.add(`hidden:${word}`));
  flags.add("true_end");
  flags.add("debug_complete");
  saveSet(LS_FLAGS, flags);

  const readScenes = new Set([...allScenes, ...sceneTargets]);
  saveSet(LS_READ, readScenes);

  writeSave({ clearedKw: allKeywords, lastKw: allKeywords[allKeywords.length - 1] || "", debugComplete: true });

  updateProgressBar();
  updateSecretProgress();
  updateArticleList();

  const continueBtn = document.getElementById("continue-btn");
  if(continueBtn) continueBtn.style.display = "inline-block";

  const response = document.getElementById("response");
  if(response){
    response.textContent = "DEBUG COMPLETE：達成率と裏達成度を100%にしました。";
    response.style.backgroundColor = "#10182d";
    response.style.color = "#dbe6ff";
  }
}
function setupDevCompleteButton(){
  const btn = document.getElementById("dev-complete-button");
  if(!btn) return;
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    completeAllAchievementsForDebug();
  });
}

// =========================================================================
// init
// =========================================================================
document.addEventListener("DOMContentLoaded",()=>{
  updateProgressBar();
  updateSecretProgress();
  renderSearchHistory();
  // 初期記事はADをすべて確認するまで表示しない
  const ua=loadUnlockedArticles(); saveSet(LS_ARTICLES_UNLOCKED, ua);
  renderIntroAdStatus();
  updateArticleList();
  renderClearAds();
  updateMovieButton();
  const continueBtn=document.getElementById("continue-btn");
  if(continueBtn){
    const save=loadSave();
    continueBtn.style.display=(save.clearedKw && save.clearedKw.length>0)?"inline-block":"none";
  }
  const inputEl=document.getElementById("userInput");
  if(inputEl){ inputEl.addEventListener("keydown",e=>{ if(e.key==="Enter") checkAnswer(); }); }
  setupTesterMode();
  setupDevCompleteButton();
});

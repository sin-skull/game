const GAME = window.OMAEWA_DATA || { scenes:{}, keywords:{}, endroll:{lines:[],images:[]} };
const LS_FLAGS="omaewa_flags";
const LS_ARTICLES_UNLOCKED="omaewa_articles_unlocked";
const LS_READ="omaewa_read_scenes";
const LS_PENDING_KW="omaewa_pending_kw";
const LS_PENDING_SCENE="omaewa_pending_scene";
const LS_TRUE_ROUTE_MOVIE="omaewa_true_route_movie";
const LS_MOVIE_RETURN_TITLE="omaewa_movie_return_title";
const LS_SPECIAL_PLAY_MODE="omaewa_special_play_mode";

function loadJSON(k,f){try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(f));}catch(e){return f;}}
function saveJSON(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
function loadSet(k){return new Set(loadJSON(k,[]));}
function saveSet(k,s){saveJSON(k,[...s]);}
function addFlag(f){if(!f)return;const s=loadSet(LS_FLAGS);s.add(f);saveSet(LS_FLAGS,s)}
function hasFlag(f){return loadSet(LS_FLAGS).has(f)}
function unlockArticle(id){if(!id)return;const s=loadSet(LS_ARTICLES_UNLOCKED);s.add(id);saveSet(LS_ARTICLES_UNLOCKED,s)}
function markRead(id){const s=loadSet(LS_READ);s.add(id);saveSet(LS_READ,s)}
function isRead(id){return loadSet(LS_READ).has(id)}
function getSecretCompletion(){
  const cfg=GAME.completion||{};
  const scenes=cfg.sceneTargets||Object.keys(GAME.scenes||{});
  const hidden=cfg.hiddenTargets||Object.keys(GAME.hiddenReactions||{});
  const read=loadSet(LS_READ);
  const flags=loadSet(LS_FLAGS);
  const total=scenes.length+hidden.length;
  const count=scenes.filter(id=>read.has(id)).length+hidden.filter(w=>flags.has(`hidden:${w}`)).length;
  const pct=total?Math.round((count/total)*100):0;
  return {count,total,pct,complete:total>0&&count>=total};
}
function imgUrl(img){if(!img)return"";return img.includes('/')?img:`png/${img}`}
function voiceUrl(sceneId,lineIndex){return `voice/${sceneId}_${String(lineIndex).padStart(2,'0')}.mp3`;}
function calcAutoDuration(text){
  // 初見で読み切れる速度寄り：1文字あたり約0.22秒 + 最低3.5秒、最大14秒
  const len=(text||'').replace(/\s/g,'').length;
  return Math.min(14000,Math.max(3500,len*220));
}

const storyEl=document.getElementById('story');
const choicesEl=document.getElementById('choices');
const indicator=document.getElementById('scene-indicator');
const playerUI=document.getElementById('player-ui');
const playPauseBtn=document.getElementById('play-pause-btn');
const progressBar=document.getElementById('progress-bar');

let currentSceneId=null,currentScene=null,index=0;
let isChoices=false,returnMode=false,nextSceneAfterEnd=null,endrollMode=false,completeMode=false;
let activeLayer='a';
let currentAudio=null;
let isPaused=false;
let autoTimer=null,autoStart=0,autoDuration=0;
let uiHideTimer=null;
let playMode=localStorage.getItem(LS_SPECIAL_PLAY_MODE)||'click';

// ---- プレイヤーUI表示制御 ----
function showPlayerUI(pin=false){
  clearTimeout(uiHideTimer);
  playerUI.classList.add('visible');
  if(!pin){
    uiHideTimer=setTimeout(()=>{if(!isPaused)playerUI.classList.remove('visible');},3000);
  }
}
function isUiTarget(e){
  return e.target.closest('button') || e.target.closest('#player-ui') || e.target.closest('#play-mode-overlay') || e.target.closest('#t-menu-overlay');
}
// special.html はクリックでも進行可能。クリック再生モードでは、画面クリックで次の文へ進む。
document.addEventListener('click',e=>{
  if(isUiTarget(e))return;
  if(endrollMode){ showCompletionResult(); return; }
  if(isChoices)return;
  if(completeMode){ goMain(); return; }
  if(playMode==='click'){
    showNext();
  } else {
    if(playerUI.classList.contains('visible')){
      clearTimeout(uiHideTimer);
      playerUI.classList.remove('visible');
    } else {
      showPlayerUI();
    }
  }
});

// ---- 再生・停止 ----
function setPaused(v){
  isPaused=v;
  playPauseBtn.textContent=isPaused?'▶':'⏸';
  if(isPaused){
    clearTimeout(autoTimer);
    if(currentAudio)currentAudio.pause();
    showPlayerUI(true);
  } else {
    if(currentAudio){
      currentAudio.play().catch(()=>{});
    } else {
      const elapsed=Date.now()-autoStart;
      const remaining=Math.max(300,autoDuration-elapsed);
      scheduleAuto(remaining);
    }
    showPlayerUI();
  }
}
const skipBtn=document.getElementById('skip-btn');
const menuSkipBtn=document.getElementById('menu-skip-btn');
function canSkipCurrentScene(){
  return !!(currentScene && !returnMode && !isChoices && !endrollMode && !completeMode && (currentScene.lines||[]).length>1);
}
function skipCurrentScene(){
  if(!canSkipCurrentScene())return;
  stopAudio();
  const lines=currentScene.lines||[];
  const lastImg=[...lines].reverse().find(l=>l.image)?.image;
  if(lastImg)setBgImage(lastImg);
  if(lines.length){
    showText(lines[lines.length-1].text,()=>{
      index=lines.length;updateProgress();finishScene();
    });
  } else finishScene();
  updateMenuSkipBtn();
}
function skipCurrentSceneFromMenu(){
  if(window.closeTMenu) window.closeTMenu();
  skipCurrentScene();
}
function updateMenuSkipBtn(){
  if(menuSkipBtn) menuSkipBtn.hidden=!canSkipCurrentScene();
}
if(skipBtn){
  skipBtn.addEventListener('click',e=>{e.stopPropagation();skipCurrentScene();});
}
function updateSkipBtn(id){
  const visible=isRead(id)&&((GAME.scenes[id]?.lines||[]).length>1);
  if(skipBtn) skipBtn.style.display=visible?'block':'none';
  updateMenuSkipBtn();
}
window.skipCurrentSceneFromMenu=skipCurrentSceneFromMenu;

playPauseBtn.addEventListener('click',e=>{e.stopPropagation();setPaused(!isPaused);});


// ---- 再生方法選択（Spaceキーで表示） ----
const playModeOverlay=document.getElementById('play-mode-overlay');
const modeClickBtn=document.getElementById('mode-click-btn');
const modeAutoBtn=document.getElementById('mode-auto-btn');
const modeCloseBtn=document.getElementById('mode-close-btn');
function updatePlayModeHint(){
  const hint=document.getElementById('esc-hint');
  if(!hint)return;
  const backText='Tキーでメニュー';
  hint.textContent=(playMode==='click')
    ? `クリックで進む / Spaceで再生方法 / ${backText}`
    : `自動再生中 / Spaceで再生方法 / ${backText}`;
}
function openPlayModeOverlay(){
  playModeOverlay.classList.add('open');
  playModeOverlay.setAttribute('aria-hidden','false');
  showPlayerUI(true);
}
function closePlayModeOverlay(){
  playModeOverlay.classList.remove('open');
  playModeOverlay.setAttribute('aria-hidden','true');
  if(!isPaused)showPlayerUI();
}
function setPlayMode(mode){
  playMode=mode==='auto'?'auto':'click';
  localStorage.setItem(LS_SPECIAL_PLAY_MODE,playMode);
  updatePlayModeHint();
  closePlayModeOverlay();
  if(playMode==='auto' && !isPaused && !currentAudio && currentScene && !isChoices && !returnMode && !endrollMode && !completeMode){
    scheduleAuto(800);
  } else if(playMode==='click') {
    clearTimeout(autoTimer);
  }
}
modeClickBtn.addEventListener('click',e=>{e.stopPropagation();setPlayMode('click');});
modeAutoBtn.addEventListener('click',e=>{e.stopPropagation();setPlayMode('auto');});
modeCloseBtn.addEventListener('click',e=>{e.stopPropagation();closePlayModeOverlay();});
playModeOverlay.addEventListener('click',e=>{if(e.target===playModeOverlay)closePlayModeOverlay();});




// ---- Spaceキー：再生方法パネル ----
document.addEventListener('keydown',e=>{
  const tag=(e.target&&e.target.tagName||'').toLowerCase();
  if(tag==='input'||tag==='textarea'||(e.target&&e.target.isContentEditable))return;
  if(e.code==='Space' || e.key===' '){e.preventDefault();openPlayModeOverlay();}
});

// ---- プログレスバー ----
function updateProgress(){
  if(!currentScene)return;
  const total=(currentScene.lines||[]).length;
  if(!total){progressBar.style.width='0%';return;}
  progressBar.style.width=Math.min(100,Math.round((index/total)*100))+'%';
}

// ---- オートタイマー ----
function scheduleAuto(ms){
  clearTimeout(autoTimer);
  if(playMode==='click' && !returnMode && !endrollMode && !completeMode) return;
  autoStart=Date.now();
  autoDuration=ms;
  autoTimer=setTimeout(()=>{if(!isPaused)showNext();},ms);
}

// ---- 音声 ----
function stopAudio(){
  clearTimeout(autoTimer);
  if(currentAudio){currentAudio.pause();currentAudio.src='';currentAudio=null;}
}
function playVoice(sceneId,lineIndex,text){
  stopAudio();
  if(isPaused)return;
  const audio=new Audio(voiceUrl(sceneId,lineIndex));
  currentAudio=audio;
  let done=false;
  function onEnd(){
    if(done)return;done=true;currentAudio=null;
    if(playMode==='auto'&&!isPaused)showNext();
  }
  audio.addEventListener('ended',onEnd);
  audio.addEventListener('error',()=>{currentAudio=null;scheduleAuto(calcAutoDuration(text));});
  audio.play().catch(()=>{currentAudio=null;scheduleAuto(calcAutoDuration(text));});
}

// ---- 背景 ----
function setBgImage(img){
  if(!img)return;
  const curr=document.getElementById(activeLayer==='a'?'bg-a':'bg-b');
  const next=document.getElementById(activeLayer==='a'?'bg-b':'bg-a');
  next.style.backgroundImage=`url('${imgUrl(img)}')`;
  next.style.opacity='1';curr.style.opacity='0';activeLayer=activeLayer==='a'?'b':'a';
}

// ---- テキスト表示 ----
function showText(t,cb){
  const text = String(t || '');
  // v18: 字幕ボックスを毎行フェードで再表示しない。
  // テキストがある間は同じ固定ボックスに本文だけ差し替える。
  storyEl.classList.remove('fade-out');
  storyEl.textContent = text;
  storyEl.classList.toggle('has-text', text.trim().length > 0);
  cb && cb();
}

function applyLineBgm(line){
  if(!line || !Object.prototype.hasOwnProperty.call(line,'bgm')) return;
  if(window.OmaewaBGM && typeof window.OmaewaBGM.cue === 'function'){
    window.OmaewaBGM.cue(line.bgm);
  }
}


// ---- TRUE ROUTE MOVIE：special.html と同じ再生UIで正規ルートを一本化 ----
function shouldSkipMovieLine(text){
  const t=String(text||'').trim();
  if(!t)return true;
  if(/^【.*選んだ場合/.test(t))return true;
  if(/^※/.test(t))return true;
  if(t.includes('紹介記事からアクセス'))return true;
  if(t.includes('検索欄に入力してください'))return true;
  if(t.includes('どちらか一個ね'))return true;
  if(t==='「え〜。まぁ分かった。じゃあ…')return true;
  return false;
}
function cleanMovieText(text){return String(text||'').replace(/ソトカンガゴトサイ/g,'').trim();}
function pushMovieLine(out,text,image='',bgm=''){
  const clean=cleanMovieText(text);
  if(!clean)return;
  const item={text:clean,image:image||''};
  if(bgm)item.bgm=bgm;
  out.push(item);
}
function addMovieScene(out,sceneId,options={}){
  const scene=(GAME.scenes||{})[sceneId];
  if(!scene)return;
  const lines=scene.lines||[];
  const skipLast=Number(options.skipLast||0);
  lines.forEach((line,i)=>{
    if(skipLast&&i>=lines.length-skipLast)return;
    const text=line&&line.text?line.text:'';
    if(shouldSkipMovieLine(text))return;
    out.push({text:cleanMovieText(text),image:line.image||'',bgm:line.bgm||''});
  });
}
function buildTrueRouteMovieScene(){
  const out=[];
  pushMovieLine(out,'検索しようとした瞬間、画面のUIが崩れた。\n戻るボタンは反応せず、閉じたはずのタブは同じ避難サイトへ戻される。');
  pushMovieLine(out,'世界中でWebサイトの表示崩壊が起きている。\nこのサイトだけが、記事、広告、検索欄を保ったまま残っていた。');
  pushMovieLine(out,'画面に残された条件はひとつ。\n達成率を100%にすれば、このサイトから抜け出せる。');

  addMovieScene(out,'start');
  pushMovieLine(out,'「父さん。大好きだよ。」');
  addMovieScene(out,'love');

  addMovieScene(out,'chara_select');
  pushMovieLine(out,'「シオンっと…。」');
  addMovieScene(out,'sion');

  addMovieScene(out,'jitsuie');
  pushMovieLine(out,'俺は、まず父さんに話を聞きに行くことにした。');
  addMovieScene(out,'father');
  pushMovieLine(out,'父さんの部屋を出ると、廊下はまだ静かだった。\n時計を見ると、ちょうど弟が帰ってくる時間に差し掛かっていた。\nもう少し待ってみようと思い、俺は1階へ下りた。');

  addMovieScene(out,'kioku');
  pushMovieLine(out,'俺は、弟の右手を見た。');
  addMovieScene(out,'migite');
  addMovieScene(out,'nagashichijimi');

  addMovieScene(out,'game01');
  pushMovieLine(out,'「悪い今日は遠慮しておくわ。」');
  addMovieScene(out,'kaeru');
  pushMovieLine(out,'俺は、弟のもとへ行くことにした。');
  addMovieScene(out,'go_true_ending');

  pushMovieLine(out,'達成率100%。\n退避処理は完了した。');
  pushMovieLine(out,'このウイルスは、すでに世界中のWebサイトへ広がっていた。\n検索結果、広告枠、ボタン配置。多くのUIが崩れていた。');
  pushMovieLine(out,'ここは感染端末を隔離するために残された退避領域だった。\nPLAYERは閉じ込められていたのではなく、崩壊したWebから一時的に退避させられていた。');
  pushMovieLine(out,'復元された記憶は、一本の映像として再構成された。\nこれで、このサイトの役割は終わる。');

  return {id:'__true_route_movie__',title:'TRUE ROUTE MOVIE',lines:out,onEnd:{returnMain:true},choices:[]};
}
function loadTrueRouteMovie(){
  stopAudio();
  currentSceneId='__true_route_movie__';
  currentScene=buildTrueRouteMovieScene();
  index=0;
  isChoices=false;returnMode=false;nextSceneAfterEnd=null;endrollMode=false;completeMode=false;
  choicesEl.innerHTML='';indicator.textContent='TRUE ROUTE MOVIE';
  storyEl.classList.remove('has-choices','return-mode');
  if(skipBtn) skipBtn.style.display=currentScene.lines.length>1?'block':'none';
  updateMenuSkipBtn();
  const first=currentScene.lines[0]||{text:''};
  applyLineBgm(first);
  if(first.image)setBgImage(first.image);
  showText(first.text,()=>{index=1;updateProgress();scheduleAuto(calcAutoDuration(first.text));});
}

function getInitialScene(){
  const pending=localStorage.getItem(LS_PENDING_SCENE)||'';
  const kw=localStorage.getItem(LS_PENDING_KW)||'';
  localStorage.removeItem(LS_PENDING_SCENE);localStorage.removeItem(LS_PENDING_KW);
  if(pending&&GAME.scenes[pending])return pending;
  if(kw&&GAME.keywords[kw]&&GAME.scenes[GAME.keywords[kw].scene])return GAME.keywords[kw].scene;
  return 'start';
}

function loadScene(id){
  stopAudio();
  const sc=GAME.scenes[id];if(!sc){storyEl.textContent='シーンが見つかりません: '+id;return;}
  currentSceneId=id;currentScene=sc;index=0;
  isChoices=false;returnMode=false;nextSceneAfterEnd=null;endrollMode=false;completeMode=false;
  choicesEl.innerHTML='';indicator.textContent='';
  storyEl.classList.remove('has-choices','return-mode');
  const firstLine=sc.lines?.[0]||{};
  applyLineBgm(firstLine);
  if(firstLine.image)setBgImage(firstLine.image);
  markRead(id);
  updateSkipBtn(id);
  const firstText=firstLine.text||'';
  showText(firstText,()=>{index=1;updateProgress();playVoice(id,1,firstText);});
}

function showNext(){
  if(isPaused)return;
  if(completeMode){goMain();return;}
  if(endrollMode){showCompletionResult();return;}
  if(returnMode){
    if(nextSceneAfterEnd){loadScene(nextSceneAfterEnd);return;}
    goMain();return;
  }
  if(isChoices||!currentScene)return;
  const lines=currentScene.lines||[];
  if(index<lines.length){
    const line=lines[index];
    applyLineBgm(line);
    if(line.image)setBgImage(line.image);
    const i=index;index++;updateProgress();
    showText(line.text,()=>{playVoice(currentSceneId,i+1,line.text);});
    return;
  }
  finishScene();
}

function finishScene(){
  const onEnd=currentScene.onEnd||{};
  if(onEnd.unlockFlag)addFlag(onEnd.unlockFlag);
  if(onEnd.unlockArticle)unlockArticle(onEnd.unlockArticle);
  if(onEnd.showEndroll){showEndroll();return;}
  if(onEnd.showChoices||(currentScene.choices&&currentScene.choices.length)){
    showChoices(currentScene.choices||[]);return;
  }
  if(onEnd.nextScene){
    nextSceneAfterEnd=onEnd.nextScene;returnMode=true;
    storyEl.classList.add('return-mode');
    showText('── 続く ──',()=>scheduleAuto(6000));return;
  }
  returnMode=true;storyEl.classList.add('return-mode');
  showText('── 了 ──',()=>scheduleAuto(6000));
}

function showChoices(choices){
  isChoices=true;updateMenuSkipBtn();storyEl.classList.add('has-choices');choicesEl.innerHTML='';
  showPlayerUI(true);
  choices.forEach(c=>{
    const b=document.createElement('button');
    const locked=c.requiresFlag&&!hasFlag(c.requiresFlag);
    b.textContent=locked?`${c.label}　🔒`:c.label;
    if(locked){b.className='locked';b.title=`${c.requiresFlag} が必要です`;}
    else b.addEventListener('click',e=>{e.stopPropagation();isChoices=false;loadScene(c.next);});
    choicesEl.appendChild(b);
  });
}

function showEndroll(){
  updateMenuSkipBtn();
  addFlag('true_end');
  const el=document.getElementById('endroll');
  const linesEl=document.getElementById('roll-lines');
  linesEl.innerHTML='';
  (GAME.endroll.lines||[]).forEach(t=>{const p=document.createElement('p');p.textContent=t||'\u00a0';linesEl.appendChild(p);});
  el.classList.add('open');endrollMode=true;
  const imgs=(GAME.endroll.images||[]).filter(Boolean);let i=0;const imgEl=document.getElementById('roll-img');
  function set(){if(!imgs.length)return;imgEl.src=imgUrl(imgs[i%imgs.length]);i++;}
  set();clearInterval(window.__omaewaRollTimer);window.__omaewaRollTimer=setInterval(set,2200);
  setTimeout(()=>{if(endrollMode&&!isPaused)showCompletionResult();},34000);
}

function showCompletionResult(){
  updateMenuSkipBtn();
  document.getElementById('endroll').classList.remove('open');
  endrollMode=false;completeMode=true;
  clearInterval(window.__omaewaRollTimer);
  const stat=getSecretCompletion();
  const wasSecretComplete=hasFlag('secret_complete');
  if(stat.complete)addFlag('secret_complete');
  const heading=document.getElementById('complete-heading');
  if(heading) heading.textContent=stat.complete?'SECRET COMPLETE':'RESULT';
  document.getElementById('complete-score').innerHTML=
    `達成度：100%<br>裏達成度：${stat.pct}%（${stat.count}/${stat.total}）`;
  document.getElementById('complete-special').textContent=stat.complete
    ?(wasSecretComplete?'すべての記憶は、すでにつながっています。':'裏クリアおめでとう。すべての記憶がつながりました。')
    :(GAME.completion?.specialMessages?.incomplete||'まだ見ていない断片があります。');
  const unlocks=document.getElementById('complete-unlocks');
  if(unlocks){
    const rows=[
      ['タイトル背景','クリア後専用背景に変化します。rogo.png がある場合はそれを使用します。'],
      ['TRUE ROUTE MOVIE','タイトル画面から再生できます。'],
      ['MUSIC PLAYER','タイトル画面に追加されます。'],
      ['CLEAR AD','検索欄側にクリア後広告が追加されます。'],
      ['裏達成度','検索欄側で確認できます。未発見の答えは表示しません。']
    ];
    if(stat.complete){
      rows.push(['SECRET COMPLETE','裏クリア表示が解放されます。']);
      rows.push(['隠し断片','弟 / 父さん / 母さん / 幼馴染 の全確認が完了しました。']);
    }
    unlocks.innerHTML='<h3>変化したこと</h3>'+rows.map(r=>`<div class="unlock-row"><strong>${r[0]}</strong><span>${r[1]}</span></div>`).join('');
  }
  const secret=document.getElementById('complete-secret');
  if(secret){
    secret.innerHTML=stat.complete
      ?'<h3>秘密にしていたこと</h3><p>未確認の隠しワード名は伏せていました。裏クリア後だけ、全断片がつながったことを明示します。</p>'
      :'<h3>秘密にしておくこと</h3><p>残りの隠しワード名、隠し反応の場所、裏達成度の内訳は表示しません。自分で探す余地を残します。</p>';
  }
  document.getElementById('complete-panel').classList.add('open');
  showPlayerUI(true);
  const note=document.getElementById('complete-note');
  if(note) note.textContent='クリックすると戻ります。右上の☰ボタン、またはTキーでメニューを開けます。';
}

function shouldReturnTitle(){
  return localStorage.getItem(LS_MOVIE_RETURN_TITLE)==='1';
}
function clearTitleReturnFlag(){
  localStorage.removeItem(LS_MOVIE_RETURN_TITLE);
}
function goTitle(){
  stopAudio();
  clearTitleReturnFlag();
  if(window.OmaewaBGM && typeof window.OmaewaBGM.armAutoplay==='function') window.OmaewaBGM.armAutoplay();
  setTimeout(()=>{ location.href='./title.html'; }, 60);
}

function goMain(){
  stopAudio();
  if(shouldReturnTitle()){
    clearTitleReturnFlag();
    if(window.OmaewaBGM && typeof window.OmaewaBGM.armAutoplay==='function') window.OmaewaBGM.armAutoplay();
    setTimeout(()=>{ location.href='./title.html'; }, 60);
    return;
  }
  try{if(document.referrer&&/12\.html(?:$|[?#])/.test(document.referrer)){history.back();return;}}catch(e){}
  const target=new URL('./12.html',window.location.href).href;
  if(window.OmaewaBGM && typeof window.OmaewaBGM.armAutoplay==='function') window.OmaewaBGM.armAutoplay();
  if(window.location.href!==target)setTimeout(()=>{ window.location.replace(target); }, 60);
}

window.addEventListener('load',()=>{
  showPlayerUI();
  updatePlayModeHint();
  const escHint=document.getElementById('esc-hint');
  const completeNote=document.getElementById('complete-note');
  if(shouldReturnTitle()){
    if(completeNote) completeNote.textContent='Tキーでメニューを開きます。';
  }
  updatePlayModeHint();
  if(localStorage.getItem(LS_TRUE_ROUTE_MOVIE)==='1'){
    localStorage.removeItem(LS_TRUE_ROUTE_MOVIE);
    loadTrueRouteMovie();
  } else {
    loadScene(getInitialScene());
  }
});
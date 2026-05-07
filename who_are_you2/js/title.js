const SAVE_KEYS=["omaewa_save","omaewa_kwlog","omaewa_flags","omaewa_articles_unlocked","omaewa_articles_opened","omaewa_discovered_keywords","omaewa_search_history","omaewa_pending_kw","omaewa_pending_scene","omaewa_read_scenes","omaewa_intro_ads_viewed","omaewa_true_route_movie","omaewa_movie_return_title"];
const tutorialPages=[
  {title:'このゲームの進め方',text:'ここは普通の検索サイトではありません。記事やADに残された言葉を見つけ、検索欄に入力して物語を復元していくゲームです。',hint:'読む → 気になる言葉を見つける → 検索欄に入力する。この流れだけ覚えれば始められます。'},
  {title:'まず最初にすること',text:'本編が始まったら、右側に表示されるADを3つ確認してください。すべて確認すると、最初の記事が復元されます。',hint:'最初の目的：ADを3つ確認して、最初の記事を開く。'},
  {title:'戻り方',text:'本編中にTキーを押すと、検索欄・タイトル・音量を切り替えるメニューが開きます。通知ではなく、操作用のメニューです。',hint:'ESCキーは使いません。フルスクリーン解除とぶつかるためです。'}
];

const musicTracks=[
  {title:'お前は誰だ？ タイトル',src:'audio/お前は誰だタイトル.mp3'},
  {title:'お前は誰だ？ 検索',src:'audio/お前は誰だ検索.mp3'},
  {title:'シーン１',src:'audio/シーン１.mp3'},
  {title:'バトル１',src:'audio/バトル1.mp3'},
  {title:'感動１',src:'audio/感動1.mp3'},
  {title:'二度目の桜',src:'audio/二度目の桜 シーン.mp3'},
  {title:'深海',src:'audio/深海.mp3'}
];
let currentMusicSrc='';
function renderMusicList(){
  const list=document.getElementById('musicList');
  if(!list)return;
  list.innerHTML='';
  musicTracks.forEach(track=>{
    const row=document.createElement('div');
    row.className='music-row';
    const name=document.createElement('div');
    name.className='music-name';
    name.textContent=track.title;
    const play=document.createElement('button');
    play.type='button';
    play.textContent='再生';
    play.addEventListener('click',()=>{
      currentMusicSrc=track.src;
      if(window.OmaewaBGM&&typeof window.OmaewaBGM.play==='function') window.OmaewaBGM.play(track.src);
    });
    const stop=document.createElement('button');
    stop.type='button';
    stop.textContent='停止';
    stop.addEventListener('click',()=>{ if(window.OmaewaBGM&&typeof window.OmaewaBGM.stop==='function') window.OmaewaBGM.stop(); });
    const save=document.createElement('a');
    save.textContent='保存';
    save.href=track.src;
    save.download=track.src.split('/').pop();
    save.className='music-save';
    row.append(name,play,stop,save);
    list.appendChild(row);
  });
}
function maybeOpenClearInfo(){
  if(isClear() && localStorage.getItem('omaewa_clear_info_seen')!=='1'){
    localStorage.setItem('omaewa_clear_info_seen','1');
    setTimeout(()=>openModal('clearInfoModal'),450);
  }
}

let tutorialIndex=0;
function loadJSON(key,fallback){try{return JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback));}catch(e){return fallback;}}
function hasSave(){const save=loadJSON('omaewa_save',{});return !!(save && Array.isArray(save.clearedKw) && save.clearedKw.length>0);}
function hasFlag(flag){return new Set(loadJSON('omaewa_flags',[])).has(flag);}
function isClear(){return hasFlag('true_end') || hasFlag('debug_complete');}
function fileUrl(path){
  // CSSファイル側ではなく、title.html がある階層を基準に絶対URL化する。
  return new URL(path, window.location.href).href;
}
function cssUrl(path){
  return `url("${fileUrl(path)}")`;
}
function preload(src){
  return new Promise((resolve,reject)=>{
    const img=new Image();
    img.onload=()=>resolve(src);
    img.onerror=reject;
    img.src=fileUrl(src);
  });
}
async function setTitleBackground(){
  const root=document.documentElement;
  // PC / wide layout backgrounds
  root.style.setProperty('--title-bg',cssUrl('logo.png'));

  // Smartphone portrait backgrounds. These are used only by CSS media queries.
  try{await preload('mobile-logo.png');root.style.setProperty('--mobile-title-bg',cssUrl('mobile-logo.png'));}catch(e){root.style.setProperty('--mobile-title-bg',cssUrl('logo.png'));}

  if(!isClear()) return;
  document.body.classList.add('is-clear');

  // Clear-after background for smartphone portrait.
  try{await preload('mobile-rogo.png');root.style.setProperty('--mobile-clear-bg',cssUrl('mobile-rogo.png'));}catch(e){
    try{await preload('png/rogo.png');root.style.setProperty('--mobile-clear-bg',cssUrl('png/rogo.png'));}catch(e2){
      try{await preload('rogo.png');root.style.setProperty('--mobile-clear-bg',cssUrl('rogo.png'));}catch(e3){root.style.setProperty('--mobile-clear-bg',cssUrl('mobile-logo.png'));}
    }
  }

  // Clear-after background for PC / wide layout.
  try{await preload('png/rogo.png');root.style.setProperty('--title-bg',cssUrl('png/rogo.png'));return;}catch(e){}
  try{await preload('rogo.png');root.style.setProperty('--title-bg',cssUrl('rogo.png'));return;}catch(e){}
  root.style.setProperty('--title-bg',cssUrl('logo.png'));
}
function openModal(id){const m=document.getElementById(id);m.classList.add('open');m.setAttribute('aria-hidden','false');}
function closeModal(id){const m=document.getElementById(id);m.classList.remove('open');m.setAttribute('aria-hidden','true');}
function requestStartNew(){
  if(hasSave() && !confirm('最初からはじめますか？\n現在のセーブデータは削除されます。')) return;
  tutorialIndex=0;
  renderTutorial();
  openModal('tutorialModal');
}
function navigateWithAudio(url){
  if(window.OmaewaBGM && typeof window.OmaewaBGM.armAutoplay==='function') window.OmaewaBGM.armAutoplay();
  setTimeout(()=>{ location.href=url; }, 60);
}
function finishTutorialAndStart(){
  SAVE_KEYS.forEach(k=>localStorage.removeItem(k));
  navigateWithAudio('./12.html');
}
function renderTutorial(){
  const p=tutorialPages[tutorialIndex];
  document.getElementById('tutorialStep').textContent=String(tutorialIndex+1).padStart(2,'0')+' / '+String(tutorialPages.length).padStart(2,'0');
  document.getElementById('tutorialTitle').textContent=p.title;
  document.getElementById('tutorialText').innerHTML=p.text.replace('記事やAD','<span class="tutorial-em">記事やAD</span>').replace('Tキー','<span class="tutorial-em">Tキー</span>');
  document.getElementById('tutorialHint').textContent=p.hint;
  document.getElementById('tutorialBackBtn').textContent=tutorialIndex===0?'やめる':'戻る';
  document.getElementById('tutorialNextBtn').textContent=tutorialIndex===tutorialPages.length-1?'ゲーム開始':'次へ';
}
function continueGame(){navigateWithAudio('./12.html');}
function openTrueMovie(){localStorage.setItem('omaewa_true_route_movie','1');localStorage.setItem('omaewa_movie_return_title','1');navigateWithAudio('./special.html');}
document.addEventListener('DOMContentLoaded',()=>{
  setTitleBackground();
  const cont=document.getElementById('continueBtn');
  cont.disabled=!hasSave();
  document.getElementById('startBtn').addEventListener('click',requestStartNew);
  cont.addEventListener('click',()=>{if(!cont.disabled)continueGame();});
  document.getElementById('trueMovieBtn').addEventListener('click',openTrueMovie);
  const musicBtn=document.getElementById('musicBtn');
  if(musicBtn) musicBtn.addEventListener('click',()=>{renderMusicList();openModal('musicModal');});
  document.getElementById('helpBtn').addEventListener('click',()=>openModal('helpModal'));
  document.getElementById('volumeBtn').addEventListener('click',()=>openModal('volumeModal'));
  document.getElementById('closeHelpBtn').addEventListener('click',()=>closeModal('helpModal'));
  document.getElementById('closeVolumeBtn').addEventListener('click',()=>closeModal('volumeModal'));
  const closeMusic=document.getElementById('closeMusicBtn');
  if(closeMusic) closeMusic.addEventListener('click',()=>closeModal('musicModal'));
  const closeClear=document.getElementById('closeClearInfoBtn');
  if(closeClear) closeClear.addEventListener('click',()=>closeModal('clearInfoModal'));
  ['helpModal','volumeModal','musicModal','clearInfoModal'].forEach(id=>{const el=document.getElementById(id); if(el) el.addEventListener('click',e=>{if(e.target.id===id)closeModal(id);});});
  document.getElementById('tutorialBackBtn').addEventListener('click',()=>{if(tutorialIndex===0){closeModal('tutorialModal');return;} tutorialIndex--;renderTutorial();});
  document.getElementById('tutorialNextBtn').addEventListener('click',()=>{if(tutorialIndex>=tutorialPages.length-1){finishTutorialAndStart();return;} tutorialIndex++;renderTutorial();});
  maybeOpenClearInfo();
});
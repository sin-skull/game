// =========================================================================
// OMAEWA BGM controller
// - Supports mp3 / wav / m4a.
// - Recommended placement: ./audio/*.mp3
// - Backward compatible placement: ./wav/*.wav or ./wav/*.m4a
// - Per-page default track is read from body[data-bgm]
// - Volume/mute are saved in localStorage.
// =========================================================================
(function(){
  const LS_VOL = 'omaewa_bgm_volume';
  const LS_MUTED = 'omaewa_bgm_muted';
  const LS_ENABLED = 'omaewa_bgm_enabled';
  const SS_UNLOCK = 'omaewa_audio_unlocked';
  const DEFAULT_VOL = 0.55;
  const AUDIO_DIRS = ['audio/', 'wav/'];
  const EXT_PRIORITY = ['mp3', 'wav', 'm4a', 'aac', 'ogg'];
  let audio = null;
  let currentKey = '';
  let currentSrc = '';
  let fallbackBound = false;
  let playToken = 0;

  function getVolume(){ const v=parseFloat(localStorage.getItem(LS_VOL)); return Number.isFinite(v) ? Math.max(0,Math.min(1,v)) : DEFAULT_VOL; }
  function isMuted(){ return localStorage.getItem(LS_MUTED)==='1'; }
  function isEnabled(){ return localStorage.getItem(LS_ENABLED)!=='0'; }
  function markUnlocked(){ try{ sessionStorage.setItem(SS_UNLOCK,'1'); localStorage.setItem(SS_UNLOCK,'1'); }catch(e){} }
  function apply(){ if(!audio) return; audio.volume=getVolume(); audio.muted=isMuted() || !isEnabled(); }
  function ensure(){ if(audio) return audio; audio=new Audio(); audio.loop=true; audio.preload='auto'; audio.playsInline=true; apply(); return audio; }

  function unique(list){ return [...new Set(list.filter(Boolean))]; }
  function splitPath(raw){
    const clean = String(raw || '').trim().replace(/^\.\//,'');
    const q = clean.split(/[?#]/)[0];
    const slash = q.lastIndexOf('/');
    const dir = slash >= 0 ? q.slice(0, slash + 1) : '';
    const file = slash >= 0 ? q.slice(slash + 1) : q;
    const dot = file.lastIndexOf('.');
    const base = dot > 0 ? file.slice(0, dot) : file;
    const ext = dot > 0 ? file.slice(dot + 1).toLowerCase() : '';
    return {clean, dir, file, base, ext};
  }
  function candidatesFor(raw){
    const p = splitPath(raw);
    if(!p.base) return [];
    const dirs = unique([p.dir, ...AUDIO_DIRS]);
    const exts = unique(['mp3', p.ext, ...EXT_PRIORITY]);
    const list = [];
    dirs.forEach(dir => exts.forEach(ext => { if(ext) list.push(`${dir}${p.base}.${ext}`); }));
    // Keep the exact raw path as a fallback as well, for unusual custom paths.
    list.push(p.clean);
    return unique(list);
  }
  function preferredMp3(raw){
    const p = splitPath(raw);
    if(!p.base) return '';
    return `audio/${p.base}.mp3`;
  }

  function bindFallback(src){
    if(fallbackBound) return;
    fallbackBound=true;
    const kick=()=>{
      fallbackBound=false;
      markUnlocked();
      play(src || currentKey || currentSrc);
      window.removeEventListener('pointerdown',kick);
      window.removeEventListener('keydown',kick);
    };
    window.addEventListener('pointerdown',kick,{once:true});
    window.addEventListener('keydown',kick,{once:true});
  }

  function playCandidate(raw, candidates, index, token){
    if(token !== playToken) return Promise.resolve(false);
    const src = candidates[index];
    if(!src) { updateUI(); return Promise.resolve(false); }
    const a=ensure();
    currentKey=raw;
    currentSrc=src;
    a.src=src;
    apply();
    if(!isEnabled()) { updateUI(); return Promise.resolve(false); }

    return new Promise(resolve=>{
      let settled=false;
      const cleanup=()=>{ a.removeEventListener('error',onError); };
      const tryNext=()=>{
        cleanup();
        if(index + 1 < candidates.length) resolve(playCandidate(raw, candidates, index + 1, token));
        else { updateUI(); resolve(false); }
      };
      const onError=()=>{
        if(settled) return;
        settled=true;
        tryNext();
      };
      a.addEventListener('error',onError,{once:true});
      const p=a.play();
      if(p && typeof p.then==='function'){
        p.then(()=>{
          if(settled) return;
          settled=true;
          cleanup();
          markUnlocked();
          updateUI();
          resolve(true);
        }).catch(err=>{
          if(settled) return;
          settled=true;
          cleanup();
          // Browser autoplay block: wait for the next user gesture, but keep the same track key.
          if(err && err.name === 'NotAllowedError'){
            bindFallback(raw);
            updateUI();
            resolve(false);
            return;
          }
          // Missing/unsupported file: try the next extension/path.
          tryNext();
        });
      } else {
        settled=true;
        cleanup();
        markUnlocked();
        updateUI();
        resolve(true);
      }
    });
  }

  function play(src){
    if(!src) return Promise.resolve(false);
    const raw=String(src).trim();
    if(!raw) return Promise.resolve(false);
    playToken += 1;
    const token = playToken;
    return playCandidate(raw, candidatesFor(raw), 0, token);
  }
  function tryPlayNow(src){
    if(!src) return;
    currentKey=String(src).trim();
    currentSrc=candidatesFor(currentKey)[0] || currentKey;
    ensure();
    updateUI();
    play(currentKey);
  }
  function armAutoplay(){ markUnlocked(); if(currentKey || currentSrc) play(currentKey || currentSrc); }
  function stop(){ playToken += 1; if(audio){ audio.pause(); audio.currentTime=0; } currentKey=''; currentSrc=''; updateUI(); }
  function setVolume(v){ localStorage.setItem(LS_VOL,String(Math.max(0,Math.min(1,Number(v))))); apply(); updateUI(); if(currentKey) play(currentKey); }
  function setMuted(flag){ localStorage.setItem(LS_MUTED,flag?'1':'0'); apply(); updateUI(); if(!flag && currentKey) play(currentKey); }
  function setEnabled(flag){ localStorage.setItem(LS_ENABLED,flag?'1':'0'); apply(); if(flag && currentKey) play(currentKey); else if(audio) audio.pause(); updateUI(); }

  function buildUI(){
    const mount=document.getElementById('bgm-mount');
    if(!mount || document.getElementById('bgm-panel')) return;
    const css=document.createElement('style');
    css.textContent=`
      #bgm-panel{width:100%;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.045);color:#fff;padding:14px;border-radius:12px;font-family:'Noto Serif JP',system-ui,serif;margin-top:8px}
      #bgm-panel h2{font-size:14px;letter-spacing:.14em;margin:0 0 12px;border-bottom:1px solid rgba(255,255,255,.14);padding-bottom:10px}
      #bgm-panel label{display:block;font-size:12px;color:rgba(255,255,255,.82);margin:11px 0 7px;letter-spacing:.08em}
      #bgm-panel input[type=range]{width:100%}
      .bgm-row{display:flex;gap:8px;margin-top:12px}.bgm-row button{flex:1;border:1px solid rgba(255,255,255,.24);background:rgba(255,255,255,.08);color:#fff;padding:8px;border-radius:8px;cursor:pointer;font-family:inherit}.bgm-row button:hover{background:rgba(255,255,255,.15)}
      #bgm-track-label{font-size:11px;color:rgba(255,255,255,.62);line-height:1.5;margin-top:10px;word-break:break-all}`;
    document.head.appendChild(css);
    mount.innerHTML=`<section id="bgm-panel"><h2>音楽設定</h2><label for="bgm-volume">BGM音量</label><input id="bgm-volume" type="range" min="0" max="100" step="1"><div class="bgm-row"><button id="bgm-toggle" type="button">BGM ON</button><button id="bgm-mute" type="button">ミュート</button></div><div id="bgm-track-label"></div></section>`;
    mount.querySelector('#bgm-volume').addEventListener('input',e=>setVolume(Number(e.target.value)/100));
    mount.querySelector('#bgm-toggle').addEventListener('click',()=>setEnabled(!isEnabled()));
    mount.querySelector('#bgm-mute').addEventListener('click',()=>setMuted(!isMuted()));
    updateUI();
  }
  function updateUI(){
    const slider=document.getElementById('bgm-volume'); if(slider) slider.value=Math.round(getVolume()*100);
    const toggle=document.getElementById('bgm-toggle'); if(toggle) toggle.textContent=isEnabled()?'BGM ON':'BGM OFF';
    const mute=document.getElementById('bgm-mute'); if(mute) mute.textContent=isMuted()?'ミュート解除':'ミュート';
    const label=document.getElementById('bgm-track-label'); if(label) label.textContent=currentSrc ? `再生対象：${decodeURIComponent(currentSrc)}` : '再生対象：未設定';
  }
  function init(){
    buildUI();
    const src=document.body && document.body.dataset ? document.body.dataset.bgm : '';
    if(src) tryPlayNow(src);
  }
  function cue(value){
    if(value === undefined || value === null || value === '') return;
    const raw = String(value).trim();
    if(!raw) return;
    if(raw === 'stop' || raw === 'STOP' || raw === '無音'){
      stop();
      return;
    }
    play(raw);
  }
  window.OmaewaBGM={init,play,tryPlayNow,armAutoplay,stop,cue,setVolume,setMuted,setEnabled,candidatesFor,preferredMp3};
  document.addEventListener('DOMContentLoaded',init);
})();

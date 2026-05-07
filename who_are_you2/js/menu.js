// 共通メニュー。右端の三本線ボタンとTキーで、12.html と special.html から共有。
(function(){
  function overlay(){ return document.getElementById('t-menu-overlay'); }
  function syncButton(opened){ const btn=document.getElementById('hamburger-menu-btn'); if(btn) btn.setAttribute('aria-expanded', opened ? 'true' : 'false'); document.body.classList.toggle('menu-open', !!opened); }
  function open(){ const el=overlay(); if(!el) return; el.classList.add('open'); el.setAttribute('aria-hidden','false'); syncButton(true); }
  function close(){ const el=overlay(); if(!el) return; el.classList.remove('open'); el.setAttribute('aria-hidden','true'); syncButton(false); }
  function toggle(){ const el=overlay(); if(!el) return; el.classList.contains('open') ? close() : open(); }
  function shouldIgnoreKey(e){
    const tag=(e.target&&e.target.tagName||'').toLowerCase();
    return tag==='input'||tag==='textarea'||(e.target&&e.target.isContentEditable);
  }
  function focusSearch(){
    close();
    const input=document.getElementById('userInput');
    if(input){ input.focus(); input.scrollIntoView({block:'center',behavior:'smooth'}); }
  }
  function goTitle(){
    if(window.stopAudio) window.stopAudio();
    if(window.clearTitleReturnFlag) window.clearTitleReturnFlag();
    if(window.OmaewaBGM && typeof window.OmaewaBGM.armAutoplay==='function') window.OmaewaBGM.armAutoplay();
    setTimeout(()=>{ location.href='./title.html'; },60);
  }
  window.openTMenu=open;
  window.closeTMenu=close;
  window.toggleTMenu=toggle;
  window.tMenuFocusSearch=focusSearch;
  // 既存のgoTitleがないページのみ共通実装を使う。special側は独自goTitleを優先。
  window.goTitle = window.goTitle || goTitle;
  document.addEventListener('keydown',e=>{
    if(shouldIgnoreKey(e)) return;
    if(String(e.key).toLowerCase()==='t'){
      e.preventDefault();
      toggle();
    }
  });
  document.addEventListener('click',e=>{ const el=overlay(); if(el && e.target===el) close(); });
})();

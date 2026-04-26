const SCENE={ alley:'0.png', intro:'1.png', normal:'2.png', portrait:'3.png', atari:'4atari.png', sikatanai:'5sikatanai.png', ending:'6en.png' };
const STORAGE_KEY = 'BAR_HYOKAI_SAVE';
const ACHIEVE_KEY = 'BAR_HYOKAI_ACHIEVEMENTS';
const ENDING_CARDS = [
  {id:'allA', title:'全A', text:'結果より過程。AいしAいされたようだ。', image:'7A.png', unlocked: s => s.turnLabels && s.turnLabels.length && s.turnLabels.every(x=>'A'===x)},
  {id:'allB', title:'全B', text:'結果より過程。BBッときたようだ。', image:'8B.png', unlocked: s => s.turnLabels && s.turnLabels.length && s.turnLabels.every(x=>'B'===x)},
  {id:'allC', title:'全C', text:'結果より過程。これ以外はCらないようだ。', image:'9C.png', unlocked: s => s.turnLabels && s.turnLabels.length && s.turnLabels.every(x=>'C'===x)},
  {id:'score10', title:'10問正解', text:'記憶を取り戻した。そしてこの場を見ていたい。', image:'10.png', unlocked: s => s.score===10},
  {id:'score6to9', title:'6〜9問正解', text:'うやむやな時間。たまには面白いこともあるもんだ。', image:'11.png', unlocked: s => s.score>=6 && s.score<=9},
  {id:'score0to5', title:'0〜5問正解', text:'とほほ…高いお金を払ってその場所を後にした。', image:'12.png', unlocked: s => s.score>=0 && s.score<=5}
];
Object.values(SCENE).forEach(src=>{ const im=new Image(); im.src=src; });
const $=id=>document.getElementById(id);

function ensureGameDefaults(){
  if(!Array.isArray(G.queue)) G.queue = [];
  if(!Array.isArray(G.qRes)) G.qRes = [];
  if(!Array.isArray(G.tRes)) G.tRes = [];
  if(!Array.isArray(G.turnLabels)) G.turnLabels = [];
  if(!Array.isArray(G.log)) G.log = [];
  if(!Array.isArray(G.unlockedCards)) G.unlockedCards = [];
  if(!Array.isArray(G.seenCards)) G.seenCards = [];
  if(typeof G.choiceLocked !== 'boolean') G.choiceLocked = false;
  if(!('current' in G)) G.current = null;
}

function readAchievements(){
  try{
    const raw = localStorage.getItem(ACHIEVE_KEY);
    if(!raw) return {unlockedCards:[], seenCards:[]};
    const data = JSON.parse(raw);
    return {
      unlockedCards:Array.isArray(data.unlockedCards) ? data.unlockedCards : [],
      seenCards:Array.isArray(data.seenCards) ? data.seenCards : []
    };
  }catch(e){
    return {unlockedCards:[], seenCards:[]};
  }
}

function applyAchievements(){
  ensureGameDefaults();
  const a = readAchievements();
  G.unlockedCards = Array.from(new Set([...(G.unlockedCards||[]), ...a.unlockedCards]));
  G.seenCards = Array.from(new Set([...(G.seenCards||[]), ...a.seenCards]));
}

function saveAchievements(){
  ensureGameDefaults();
  localStorage.setItem(ACHIEVE_KEY, JSON.stringify({
    unlockedCards:Array.from(new Set(G.unlockedCards || [])),
    seenCards:Array.from(new Set(G.seenCards || [])),
    savedAt:new Date().toISOString()
  }));
}

function resetCurrentRun(){
  G.mode='game';
  G.qi=0;
  G.ti=0;
  G.cTurns=0;
  G.tRes=[];
  G.score=0;
  G.qRes=[];
  G.turnLabels=[];
  G.queue=[];
  G.current=null;
  G.choiceLocked=false;
}

function mergeQuestionData(){
  // q1.js 側に分離した第6問以降の完全版がある場合、intro.js側の仮データを置き換える。
  // これをしないと第6問のturnsが1個しかない版を読んで、6問目2/5で止まる。
  try{
    if(typeof QS !== 'undefined' && typeof QS_2 !== 'undefined' && Array.isArray(QS) && Array.isArray(QS_2)){
      QS_2.forEach(patch=>{
        const idx = QS.findIndex(q => Number(q.id) === Number(patch.id));
        if(idx >= 0) QS[idx] = patch;
        else QS.push(patch);
      });
      QS.sort((a,b)=>Number(a.id)-Number(b.id));
    }

    if(typeof PLAYER_TURN_THOUGHTS !== 'undefined' && typeof PLAYER_TURN_THOUGHTS_2 !== 'undefined'){
      Object.keys(PLAYER_TURN_THOUGHTS_2).forEach(k=>{
        PLAYER_TURN_THOUGHTS[k] = PLAYER_TURN_THOUGHTS_2[k];
      });
    }

    if(typeof PLAYER_FINAL_THOUGHTS !== 'undefined' && typeof PLAYER_FINAL_THOUGHTS_2 !== 'undefined'){
      Object.keys(PLAYER_FINAL_THOUGHTS_2).forEach(k=>{
        PLAYER_FINAL_THOUGHTS[k] = PLAYER_FINAL_THOUGHTS_2[k];
      });
    }
  }catch(e){
    console.error('mergeQuestionData failed', e);
  }
}

function validateQuestionData(){
  if(typeof QS === 'undefined' || !Array.isArray(QS)) return;
  const bad = QS.filter(q => !q.turns || q.turns.length < 5).map(q => `${q.id}:${q.title}(${q.turns ? q.turns.length : 0})`);
  if(bad.length){
    console.warn('turns不足の問題があります:', bad.join(', '));
  }
}


function setBg(name){const img=$('bg');const src=SCENE[name]||SCENE.normal;if(img.getAttribute('src')===src)return;img.classList.add('fade');setTimeout(()=>{img.onload=()=>img.classList.remove('fade');img.src=src;setTimeout(()=>img.classList.remove('fade'),420)},80)}
function flash(){const f=$('flash');f.classList.remove('on');void f.offsetWidth;f.classList.add('on')}
function stripQ(s){return String(s).replace(/^[ABC]．/,'')}
function splitText(s){
  s = String(s || '').trim();
  if(!s) return [];

  const out = [];
  let buf = '';

  for(const ch of s.replace(/\s+/g, ' ')){
    buf += ch;

    const endMark = /[。！？!?]/.test(ch);
    const quoteEnd = (ch === '」' || ch === '』');

    if(endMark || quoteEnd){
      const t = buf.trim();
      if(t) out.push(t);
      buf = '';
    }
  }

  if(buf.trim()) out.push(buf.trim());

  const merged = [];
  out.forEach(t=>{
    if((t === '」' || t === '』') && merged.length){
      merged[merged.length - 1] += t;
    }else{
      merged.push(t);
    }
  });

  return merged.length ? merged : [s];
}

function chunkTwoSentences(text){
  const sentences = splitText(text);
  const chunks = [];

  for(let i = 0; i < sentences.length; i += 2){
    const a = sentences[i] || '';
    const b = sentences[i + 1] || '';
    chunks.push(b ? `${a}\n${b}` : a);
  }

  return chunks.length ? chunks : [String(text || '')];
}

function setLine(speaker,text,system='クリックで進む',logText=null){
  $('speaker').textContent = speaker || '語り';
  $('speaker').classList.toggle('player', (speaker || '語り') === 'PLAYER');
  $('text').textContent = text || '';
  $('systemLine').textContent = system || '';
  $('nextMark').style.display = 'block';

  const logged = logText === null ? text : logText;
  if(logged) G.log.push({speaker:speaker || '語り', text:logged});
}

function playPages(pages,onDone){
  const expanded = [];

  pages.forEach(p=>{
    const chunks = chunkTwoSentences(p.text || '');
    chunks.forEach((text,i)=>{
      expanded.push({
        ...p,
        text,
        bg: i === 0 ? p.bg : null
      });
    });
  });

  G.queue = expanded;
  G.current = {onDone};
  nextPage();
}

function nextPage(){
  if(G.queue.length){
    const p = G.queue.shift();
    if(p.bg) setBg(p.bg);
    setLine(p.speaker || '語り', p.text, p.system, p.text);
    return;
  }

  const done = G.current && G.current.onDone;
  G.current = null;
  if(done) done();
}

function advance(){ if(G.choiceLocked) return; if($('modal').style.display==='flex') return; nextPage(); }
document.addEventListener('keydown',e=>{ if(e.key===' '||e.key==='Enter'){e.preventDefault();advance()} if(e.key==='Escape') closeModal(); });

function playerTurnThought(ok){
  const qid = QS[G.qi].id;
  const list = PLAYER_TURN_THOUGHTS[qid] || [];
  const row = list[G.ti] || {};
  return ok ? (row.ok || "今の答えで、少しだけ輪郭が見えた。") : (row.ng || "違う。けれど、この違和感も手がかりになる。");
}

function playerFinalThought(ok){
  const qid = QS[G.qi].id;
  const row = PLAYER_FINAL_THOUGHTS[qid] || {};
  return ok ? (row.ok || "これで一つ、言葉になった。") : (row.ng || "外した。だが、まだ何かは残っている。");
}

function pushPlayerLine(text, bg=null){
  G.queue.unshift({
    speaker:"PLAYER",
    text,
    bg,
    system:"クリックで進む"
  });
}

function setChoices(items,cb,final=false){
  const p=$('choicePanel'); p.className=final?'final':''; p.innerHTML=''; p.style.display=final?'grid':'flex'; G.choiceLocked=true;
  items.forEach((it,i)=>{ const b=document.createElement('button'); b.className='choice'; b.innerHTML=`<span class="label">${it.label}</span><span>${it.text}</span>`; b.onclick=()=>{ if(!G.choiceLocked)return; G.choiceLocked=false; p.querySelectorAll('button').forEach(x=>x.classList.add('disabled')); cb(i,it); }; p.appendChild(b); });
}
function clearChoices(){const p=$('choicePanel');p.style.display='none';p.className='';p.innerHTML='';G.choiceLocked=false}
function updateHud(){$('qNow').textContent=Math.min(G.qi+1,10);$('scoreNow').textContent=G.score;$('scoreChip').style.display=G.mode==='game'||G.mode==='end'?'block':'none'}

function getSaveState(){
  ensureGameDefaults();
  return {
    mode:G.mode,
    qi:G.qi,
    ti:G.ti,
    cTurns:G.cTurns,
    tRes:G.tRes,
    score:G.score,
    qRes:G.qRes,
    turnLabels:G.turnLabels,
    log:G.log,
    savedAt:new Date().toISOString()
  };
}

function hasSavedGame(){
  return Boolean(localStorage.getItem(STORAGE_KEY));
}

function saveGame(manual=true){
  try{
    ensureGameDefaults();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(getSaveState()));
    saveAchievements();
    if(manual) openModal('message','セーブしました。');
  }catch(e){
    console.error(e);
    openModal('message','セーブに失敗しました。');
  }
}

function resumeLoadedGame(){
  $('titleLayer').style.display='none';
  clearChoices();
  updateHud();

  if(G.mode === 'game'){
    setBg('normal');
    if(G.ti >= 5){
      showFinal();
    }else{
      setLine('SYSTEM',`ロードしました。第${G.qi+1}問・質問${G.ti+1}/5から再開します。`,'クリックで再開');
      playPages([],()=>showTurn());
    }
    return;
  }

  if(G.mode === 'end'){
    showEnding();
    return;
  }

  startIntro();
}

function loadGame(){
  mergeQuestionData();
  validateQuestionData();
  const raw = localStorage.getItem(STORAGE_KEY);
  if(!raw){
    openModal('message','セーブデータが見つかりません。');
    return;
  }

  try{
    const data = JSON.parse(raw);
    G.mode = data.mode || 'title';
    G.qi = Number.isInteger(data.qi) ? data.qi : 0;
    G.ti = Number.isInteger(data.ti) ? data.ti : 0;
    G.cTurns = Number.isInteger(data.cTurns) ? data.cTurns : 0;
    G.tRes = Array.isArray(data.tRes) ? data.tRes : [];
    G.score = Number.isInteger(data.score) ? data.score : 0;
    G.qRes = Array.isArray(data.qRes) ? data.qRes : [];
    G.turnLabels = Array.isArray(data.turnLabels) ? data.turnLabels : [];
    G.log = Array.isArray(data.log) ? data.log : [];
    G.queue = [];
    G.current = null;
    G.choiceLocked = false;
    applyAchievements();
    resumeLoadedGame();
    openModal('message','ロードしました。');
  }catch(e){
    console.error(e);
    openModal('message','セーブデータの読み込みに失敗しました。');
  }
}

function getRunEndingCardId(){
  ensureGameDefaults();
  const letters = G.turnLabels || [];
  const allA = letters.length > 0 && letters.every(x => x === 'A');
  const allB = letters.length > 0 && letters.every(x => x === 'B');
  const allC = letters.length > 0 && letters.every(x => x === 'C');

  if(allA) return 'allA';
  if(allB) return 'allB';
  if(allC) return 'allC';
  if(G.score === 10) return 'score10';
  if(G.score >= 6) return 'score6to9';
  return 'score0to5';
}

function getCardById(id){
  return ENDING_CARDS.find(c => c.id === id);
}

function unlockEndingCard(id){
  ensureGameDefaults();
  if(!id) return null;
  if(!G.unlockedCards.includes(id)) G.unlockedCards.push(id);
  saveAchievements();
  return id;
}

function buildCardTile(card){
  applyAchievements();
  const unlocked = G.unlockedCards.includes(card.id);
  const seen = G.seenCards.includes(card.id);
  const cls = unlocked ? (seen ? '' : ' unseen') : ' locked';
  const image = unlocked ? `<img src="${card.image}" alt="${esc(card.title)}">` : '<div class="cardLocked">?</div>';
  const text = unlocked && seen ? esc(card.text) : '????????????????';
  return `<button class="cardItem${cls}" type="button" onclick="openCardFromGallery('${card.id}')">
    ${image}
    <div class="cardLabel">
      <strong>${unlocked && seen ? esc(card.title) : '未確認'}</strong>
      <span>${text}</span>
    </div>
  </button>`;
}

function openCardFromGallery(id){
  applyAchievements();
  const card = getCardById(id);
  if(!card) return;

  if(!G.unlockedCards.includes(id)){
    openModal('message','このカードはまだ開放されていません。');
    return;
  }

  if(!G.seenCards.includes(id)){
    G.seenCards.push(id);
    saveAchievements();
  }

  const m=$('modal'), title=$('modalTitle'), body=$('modalBody');
  m.style.display='flex';
  title.textContent='エンディングカード';
  body.innerHTML = `
    <div class="cardDetail">
      <img src="${card.image}" alt="${esc(card.title)}">
      <div class="cardMeta">
        <h2>${esc(card.title)}</h2>
        <p>${esc(card.text)}</p>
        <p class="cardHint">このカードは開放済みです。</p>
      </div>
    </div>
  `;
}

function showRunEndingCard(id){
  unlockEndingCard(id);
  openCardFromGallery(id);
}

function renderCardGallery(){
  applyAchievements();
  const body = $('modalBody');
  body.innerHTML = `
    <p>開放済みカード：${G.unlockedCards.length}/${ENDING_CARDS.length}</p>
    <div class="cardGrid">${ENDING_CARDS.map(buildCardTile).join('')}</div>
  `;
}
function startIntro(){
  $('titleLayer').style.display='none'; G.mode='intro'; G.log=[]; setBg('alley');
  playPages([
    {speaker:'語り',text:'仕事帰りの路地裏。いつも通り過ぎていた場所に、今夜はなぜか見慣れない看板が出ていた。',bg:'alley'},
    {speaker:'看板',text:'「お悩みもお酒も、氷を入れて……」'},
    {speaker:'語り',text:'扉の奥から、氷がグラスに触れる音がした。'},
    {speaker:'語り',text:'あなたは、ほんの一杯だけのつもりで、その店へ足を踏み入れる。',bg:'intro'},
    {speaker:'語り',text:'カウンターの奥でマスターがグラスを磨いていた。隅の席には、常連らしき人影がある。'},
    {speaker:'語り',text:'あなたに気づくと、その常連は小さく会釈し、静かに席を立った。'},
    {speaker:'マスター',text:'「解けない問いを抱えた方にだけ、この店は開かれます」'},
    {speaker:'マスター',text:'「十問、いかがですか。氷が溶けるまでに、お答えください」'},
    {speaker:'マスター',text:'「六問以上でお代は結構。六問未満なら……二倍いただきます」'}
  ],()=>startGame());
}
function startGame(){
  mergeQuestionData();
  validateQuestionData();
  applyAchievements();
  resetCurrentRun();
  updateHud();
  startQuestion();
}
function narrativePages(q){ const pages=[]; q.narrative.forEach((l,i)=>splitText(l,54).forEach(t=>pages.push({speaker:i===0?'マスター':'マスター',text:t,bg:'normal'}))); return pages; }
function currentQuestionText(){ const q=QS[G.qi]; return q?`第${q.id}問　${q.title}\n${q.narrative.join('\n')}`:'まだ問題はありません。'; }
function startQuestion(){ clearChoices(); setBg('normal'); updateHud(); const q=QS[G.qi]; G.ti=0;G.cTurns=0;G.tRes=[];G.questionSnapshot=currentQuestionText(); playPages(narrativePages(q),()=>showTurn()); }
function showTurn(){
  clearChoices(); setBg('normal'); const q=QS[G.qi], t=q.turns && q.turns[G.ti];
  if(!t){
    console.warn('turn data missing', q && q.id, G.ti);
    showFinal();
    return;
  }
  setLine('マスター',`質問 ${G.ti+1}/5。${t.q}`,'選択肢を選んでください');
  setChoices(t.ch.map((x,i)=>({label:['A','B','C'][i],text:stripQ(x)})),(idx)=>pickTurn(idx));
}
function pickTurn(idx){
  const q=QS[G.qi], t=q.turns[G.ti];
  const ok=idx===t.ok;

  G.turnLabels = G.turnLabels || [];
  G.turnLabels.push(['A','B','C'][idx]);

  if(ok) G.cTurns++;
  G.tRes.push(ok);

  setBg(ok?'atari':'sikatanai');
  flash();
  clearChoices();

  const thought = playerTurnThought(ok);

  playPages([
    {speaker:'マスター', text:t.resp[idx], system:'クリックでPLAYERの推察へ'},
    {speaker:'PLAYER', text:thought, system: G.ti<4?'クリックで次の質問へ':'クリックで最終回答へ'}
  ],()=>{
    G.ti++;
    if(G.ti>=5) showFinal();
    else showTurn();
  });
}
function showFinal(){
  clearChoices(); setBg('normal'); const q=QS[G.qi]; const num=Math.max(1,6-G.cTurns); let idxs=[q.correct];
  const wrong=q.finals.map((_,i)=>i).filter(i=>i!==q.correct);
  for(let i=wrong.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[wrong[i],wrong[j]]=[wrong[j],wrong[i]];}
  idxs=idxs.concat(wrong.slice(0,num-1)); for(let i=idxs.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[idxs[i],idxs[j]]=[idxs[j],idxs[i]];}
  setLine('マスター',`最終回答です。質問の正解は ${G.cTurns}/5。答えは ${num}択まで絞られました。`,'答えを選んでください');
  setChoices(idxs.map((ri,i)=>({label:String(i+1),text:q.finals[ri],ri})),(idx,it)=>pickFinal(it.ri),true);
}
function pickFinal(ri){
  const q=QS[G.qi];
  const ok=ri===q.correct;

  if(ok) G.score++;
  G.qRes.push(ok);

  setBg(ok?'atari':'sikatanai');
  flash();
  clearChoices();
  updateHud();

  const result = ok ? '― 正解 ―' : '― 不正解 ―';
  const thought = playerFinalThought(ok);

  playPages([
    {speaker:'判定', text:`${result}\n答え：${q.finals[q.correct]}`},
    {speaker:'マスター', text:ok?q.smsg:q.fmsg, system:'クリックでPLAYERの推察へ'},
    {speaker:'PLAYER', text:thought, system:G.qi<9?'クリックで次の問へ':'クリックで結末へ'}
  ],()=>{
    if(G.qi<9){
      G.qi++;
      startQuestion();
    }else{
      showEnding();
    }
  });
}
function showEnding(){
  ensureGameDefaults();
  G.mode='end';
  updateHud();
  clearChoices();
  setBg('ending');

  const cardId = getRunEndingCardId();
  unlockEndingCard(cardId);
  const card = getCardById(cardId);
  const win = G.score >= 6;

  const extra = [];
  if(cardId==='score10') extra.push('記憶は戻り、今夜の店はただの通過点ではなくなった。あなたはもう帰れる。けれど、しばらくこのカウンターを見ていたいと思った。');
  if(cardId==='score6to9') extra.push('答えの輪郭は見えたが、細部にはまだ霧が残る。うやむやな時間も、たまには悪くない。');
  if(cardId==='score0to5') extra.push('迷いは残り、帰り道はいつもより重かった。財布も、心も、少し軽くなっていない。');
  if(cardId==='allA') extra.push('選択はすべて「A」。結果よりも過程を選んだあなたに、マスターはなぜか少しだけ感心していた。');
  if(cardId==='allB') extra.push('選択はすべて「B」。その一直線さに、氷が小さく鳴った。BBッときた、というやつかもしれない。');
  if(cardId==='allC') extra.push('選択はすべて「C」。分かったような、分からないような夜だった。これ以外はCらない。');

  const pages=win?[
    {speaker:'マスター',text:`見事な解き筋でした。正解は ${G.score}/10。`},
    {speaker:'マスター',text:'あなたは、忘れていたものに名前を与えました。'},
    {speaker:'マスター',text:'悩みは、解決しましたね。'},
    ...extra.map(text=>({speaker:'語り',text})),
    {speaker:'語り',text:'マスターは笑いながら店の奥へ消えた。カウンターには、静けさだけが残る。'},
    {speaker:'語り',text:'その時、入り口の鈴が小さく鳴った。',bg:'intro'},
    {speaker:'？？？',text:'「……マスター。私、どうしても思い出せないんです」'},
    {speaker:'？？？',text:'「あの日、車を運転していた彼が、どうなったのか」'},
    {speaker:'？？？',text:'「パズルを、出してください。私があの日に帰るためのパズルを」'},
    {speaker:'幕',text:'BAR 氷解 ― 十問の夜'}
  ]:[
    {speaker:'マスター',text:`お時間です。正解は ${G.score}/10。氷が溶けてしまいました。`},
    {speaker:'マスター',text:'お代は二倍いただきます。ですが、今夜あなたは何かを掴んだはずです。'},
    ...extra.map(text=>({speaker:'語り',text})),
    {speaker:'マスター',text:'……悩みは、解決しましたね。'},
    {speaker:'幕',text:'BAR 氷解 ― 十問の夜'}
  ];

  playPages(pages,()=>{
    setLine('SYSTEM',`${card ? card.title : 'エンディング'} を開放しました。`,'カードを表示します');
    showRunEndingCard(cardId);
  });
}
function openModal(type){
  ensureGameDefaults();
  const m=$('modal'), title=$('modalTitle'), body=$('modalBody'); m.style.display='flex';
  if(type==='question'){ title.textContent='問題文'; const q=QS[G.qi]; body.innerHTML=q?`<p style="color:var(--gold2);letter-spacing:.1em">第${q.id}問　${q.title}</p>`+q.narrative.map(x=>`<p>${esc(x)}</p>`).join(''):'<p>まだ問題はありません。</p>'; }
  if(type==='log'){ title.textContent='LOG'; body.innerHTML=G.log.length?G.log.slice(-80).map(l=>`<div class="logItem"><div class="logSp">${esc(l.speaker)}</div><div class="logTx">${esc(l.text)}</div></div>`).join(''):'<p>まだログはありません。</p>'; }
  if(type==='menu'){
    title.textContent='MENU';
    const now = G.mode==='game' ? '第' + (G.qi+1) + '問' : G.mode;
    body.innerHTML='<p>画像名：0.png / 1.png / 2.png / 3.png / 4atari.png / 5sikatanai.png / 6en.png</p><p>現在：'+esc(now)+'</p><p>正解数：'+G.score+'/10</p><p style="margin-top:18px"><button class="primary" onclick="saveGame()">セーブ</button> <button class="primary" onclick="loadGame()"'+(hasSavedGame()?'':' disabled')+'>ロード</button> <button class="primary" onclick="openModal(\'cards\')">カードを見る</button></p><p style="margin-top:12px"><button class="primary" onclick="location.reload()">タイトルへ戻る</button></p>';
  }
  if(type==='cards'){
    applyAchievements();
    title.textContent='エンディングカード';
    renderCardGallery();
  }
  if(type==='message'){
    title.textContent='通知';
    body.innerHTML=`<p>${esc(arguments[1]||'')}</p>`;
  }
}
function closeModal(){$('modal').style.display='none'}
function esc(s){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
ensureGameDefaults();mergeQuestionData();validateQuestionData();applyAchievements();setBg('alley');updateHud();setLine('語り','仕事帰りの路地裏。今夜だけ、見慣れない看板が出ていた。','「はじめる」を押してください');

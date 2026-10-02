'use strict';

// Native Firebase transactions own authentication; this module manages safe local choices.
if (window.NativeGame && window.GateSave) window.GameCloud = (() => {
  const Save=GateSave, INTERVAL=300000, LINK='gate-cloud-link', BACKUP='gate-cloud-previous';
  let uid='', epoch=0, remote=null, ready=false, dirty=true, revision=0;
  let reading=null, writing=null, timer=null, lastRead=0, lastWrite=0, retryAt=0, failures=0, uncertain=null;
  let message='', preview=null, deletionPaused=false;
  const views=new Set();
  const text=(ja,en)=>Save.japanese()?ja:en;
  const current=(owner,token)=>!deletionPaused && owner===uid && token===epoch;
  const stored=key=>{try{return JSON.parse(localStorage.getItem(key)||'null');}catch(_){return null;}};
  function link(){return stored(LINK);}
  function saveLink(value){try{localStorage.setItem(LINK,JSON.stringify({uid,revision:value}));}catch(_){/* A fresh login will require review if linkage cannot be saved. */}}
  function pauseLink(){localStorage.setItem(LINK,JSON.stringify({uid,revision:remote?.revision||0,paused:true}));}
  function errorMessage(error){
    const messages={
      'review-required':text('クラウドと端末の進行を比べ、保存する方を選んでください。','Compare the two saves and choose which progress to keep.'),
      'read-required':text('先にクラウドの状態を確認してください。','Check the cloud save first.'),
      'google-login-required':text('Googleでログインするとオンライン保存が使えます。','Log in with Google to save online.'),
      'finish-run-first':text('出陣を終えるかホームに戻ってから復元してください。','Finish the run or return home before restoring.'),
      'cloud-conflict':text('別の端末で更新されています。再確認してから選んでください。','Another device updated the save. Check again before choosing.'),
      'sync-wait':text('次の保存まで少しお待ちください。進行は端末に残ります。','Wait before saving again. Progress stays on this device.'),
      'permission_denied':text('オンライン保存を利用できません。端末では引き続き遊べます。','Online saving is unavailable. You can continue playing locally.'),
      'invalid-save':text('保存データを確認できないため、復元しませんでした。','The save could not be validated and was not restored.'),
      'unsupported-save':text('この版で扱えない装備が含まれています。復元しませんでした。','The save includes equipment this version cannot handle. It was not restored.'),
      'save-limit':text('オンライン保存の容量上限に達しています。端末の進行は保持します。','The online save limit was reached. Local progress is preserved.'),
      'account-changed':text('アカウントが切り替わったため処理を中止しました。','The account changed; the operation was stopped.'),
    };
    return messages[error.message] || text('通信結果を確認できません。再送する前にクラウドを確認します。','The result could not be confirmed. Check the cloud before resending.');
  }
  function update(){
    for(const section of views){
      if(!section.isConnected){views.delete(section);continue;}
      section.querySelector('[data-cloud-status]').textContent=message || text('端末に保存中。','Saved on this device.');
      const detail=section.querySelector('[data-cloud-preview]');
      detail.textContent=preview?text('復元する内容：','Restore preview: ')+Save.summary(JSON.parse(preview)):remote?.found?text('クラウド：','Cloud: ')+Save.summary(JSON.parse(remote.payload)):'';
      const busy=deletionPaused||!!reading||!!writing;
      section.querySelector('[data-cloud-read]').disabled=!uid||busy;
      section.querySelector('[data-cloud-save]').disabled=!uid||busy||!remote;
      section.querySelector('[data-cloud-preview-button]').disabled=!uid||busy||!remote?.found;
      section.querySelector('[data-cloud-restore]').hidden=!preview;
      section.querySelector('[data-cloud-restore]').disabled=busy;
      const backup=stored(BACKUP);
      section.querySelector('[data-cloud-backup]').disabled=!uid||busy||backup?.uid!==uid;
    }
  }
  function schedule(){
    clearTimeout(timer);
    if(!uid||deletionPaused)return;
    const wait=Math.max(1500,retryAt-Date.now(),ready?lastWrite+INTERVAL-Date.now():lastRead+INTERVAL-Date.now());
    timer=setTimeout(()=>{(ready?save(false):fetchRemote(false)).catch(()=>{});},wait);
  }
  function markDirty(){dirty=true;revision++;schedule();}
  function backoff(error){failures++;retryAt=Date.now()+Math.min(1800000,INTERVAL*2**Math.min(failures-1,3));message=errorMessage(error);schedule();}
  async function connect(owner){
    owner=owner||'';
    if(owner===uid)return;
    uid=owner;epoch++;deletionPaused=false;clearTimeout(timer);remote=null;preview=null;ready=false;reading=null;writing=null;uncertain=null;
    lastRead=lastWrite=retryAt=failures=0;dirty=true;
    message=uid?text('クラウドの進行を確認中…','Checking cloud progress…'):text('オンライン保存はGoogleログイン後に使えます。','Log in with Google to save online.');update();
    if(uid)await fetchRemote(false).catch(()=>{});
  }
  async function fetchRemote(force=false){
    if(deletionPaused)throw Error('account-deletion-in-progress');
    if(!uid)throw Error('google-login-required');
    if(reading)return reading.promise;
    if(Date.now()<retryAt || (lastRead && Date.now()-lastRead<(force?60000:INTERVAL)))throw Error('sync-wait');
    const owner=uid, token=epoch, operation={promise:null};reading=operation;lastRead=Date.now();
    operation.promise=(async()=>{
      try{
        const result=await NativeGame.request('cloudRead',{uid:owner});
        if(!current(owner,token))return;
        if(typeof result.found!=='boolean')throw Error('invalid-save');
        if(result.found){
          if(result.schema!==1 || !Number.isInteger(result.revision) || result.revision<1 || result.revision>1e9 || typeof result.payload!=='string' || result.payload.length>GateProgress.MAX_LENGTH)throw Error('invalid-save');
          remote={found:true,revision:result.revision,payload:JSON.stringify(Save.normalize(JSON.parse(result.payload)))};
        } else remote={found:false,revision:0,payload:null};
        const local=Save.export(), previous=link();
        const confirmed=uncertain && remote.found && remote.revision===uncertain.expectedRevision+1 && remote.payload===uncertain.payload;
        if(confirmed){saveLink(remote.revision);uncertain=null;}
        ready=remote.found ? remote.payload===local || confirmed || previous?.uid===uid && !previous.paused && previous.revision===remote.revision : !previous || previous.uid===uid && !previous.paused;
        failures=retryAt=0;
        if(remote.found&&remote.payload===local){dirty=false;saveLink(remote.revision);}
        message=ready?text('クラウドを確認しました。変更は自動で同期します。','Cloud checked. Changes will sync automatically.'):errorMessage(Error('review-required'));
        if(ready&&dirty)schedule();
      }catch(error){if(current(owner,token)){ready=false;backoff(error);}throw error;}
      finally{if(reading===operation)reading=null;update();}
      return remote;
    })();
    update();return operation.promise;
  }
  async function save(force=false,chooseLocal=false){
    if(deletionPaused)throw Error('account-deletion-in-progress');
    if(!uid)throw Error('google-login-required');
    if(writing)return writing.promise;
    if(!remote)throw Error('read-required');
    if(!ready&&!chooseLocal)throw Error('review-required');
    if(Date.now()<retryAt || lastWrite && Date.now()-lastWrite<(force?20000:INTERVAL)){schedule();throw Error('sync-wait');}
    const payload=Save.export(), owner=uid, token=epoch, localRevision=revision, expectedRevision=remote.revision;
    if(remote.found&&remote.payload===payload){ready=true;dirty=false;saveLink(remote.revision);message=text('クラウドと端末の進行は同じです。','Cloud and local progress match.');update();return;}
    // Before any overwrite, preserve the old cloud progress in a recoverable local backup.
    if(remote.found)localStorage.setItem(BACKUP,JSON.stringify({uid:owner,payload:remote.payload,revision:remote.revision}));
    const operation={promise:null};writing=operation;lastWrite=Date.now();message=text('クラウドへ保存中…','Saving to cloud…');update();
    operation.promise=(async()=>{
      try{
        const result=await NativeGame.request('cloudWrite',{uid:owner,payload,version:Save.version,expectedRevision});
        if(!current(owner,token))return;
        if(result.revision!==expectedRevision+1)throw Error('invalid-save');
        remote={found:true,revision:result.revision,payload};saveLink(result.revision);ready=true;uncertain=null;failures=retryAt=0;
        dirty=revision!==localRevision;message=dirty?text('保存済み。新しい進行は次の同期へ。','Saved. New progress awaits the next sync.'):text('クラウドへの保存を確認しました。','Cloud save confirmed.');
      }catch(error){
        if(current(owner,token)){
          uncertain={payload,expectedRevision};ready=false;remote=null;lastRead=0;backoff(error);
        }
        throw error;
      }finally{if(writing===operation)writing=null;if(current(owner,token)&&dirty)schedule();update();}
    })();
    return operation.promise;
  }
  function previewRemote(){if(!remote?.found)throw Error('read-required');preview=remote.payload;update();}
  function previewBackup(){const data=stored(BACKUP);if(!uid||data?.uid!==uid||typeof data.payload!=='string')throw Error('read-required');preview=JSON.stringify(Save.normalize(JSON.parse(data.payload)));update();}
  async function restorePreview(){
    if(deletionPaused)throw Error('account-deletion-in-progress');
    if(!preview)throw Error('read-required');
    const owner=uid, token=epoch, payload=preview;
    const status=await NativeGame.request('status');
    if(!current(owner,token)||status.uid!==owner)throw Error('account-changed');
    // Record the deliberate local-only choice before applying a backup.
    const matchesRemote=!!remote?.found && remote.payload===payload;
    if(!matchesRemote)pauseLink();
    Save.restore(payload);preview=null;uncertain=null;
    // A restored backup is a local choice; do not silently overwrite the newer cloud copy.
    ready=!!remote?.found&&remote.payload===Save.export();
    if(ready){saveLink(remote.revision);dirty=false;message=text('クラウドの進行を復元しました。','Cloud progress restored.');}else message=errorMessage(Error('review-required'));
    update();
  }
  function mount(pane){
    const section=document.createElement('section');section.className='android-cloud';
    const heading=document.createElement('h2');heading.textContent=text('オンライン保存','Online save');section.appendChild(heading);
    const explanation=document.createElement('p');explanation.textContent=text('通貨・装備・突破記録・贈り物を同期します。出陣途中の状態はこの端末だけに残ります。異なる進行が見つかったら、自動で上書きせず選んでもらいます。','Sync currency, equipment, records and gifts. Mid-run state stays on this device. Conflicting progress requires your choice.');section.appendChild(explanation);
    for(const attribute of ['data-cloud-status','data-cloud-preview']){const p=document.createElement('p');p.setAttribute(attribute,'');p.setAttribute('role','status');section.appendChild(p);}
    const buttons=[['data-cloud-read',text('クラウドを再確認','Check cloud again'),()=>fetchRemote(true)],['data-cloud-save',text('この端末の進行でクラウドを更新','Update cloud with this progress'),()=>save(true,true)],['data-cloud-preview-button',text('クラウドの進行を復元前に確認','Preview cloud progress'),previewRemote],['data-cloud-restore',text('確認した進行をこの端末に復元','Restore preview on this device'),restorePreview],['data-cloud-backup',text('更新前のクラウド進行を確認','Preview the previous cloud save'),previewBackup]];
    for(const [attribute,label,action]of buttons){const button=document.createElement('button');button.type='button';button.setAttribute(attribute,'');button.textContent=label;button.onclick=async()=>{button.disabled=true;try{await action();}catch(error){message=errorMessage(error);}finally{update();}};section.appendChild(button);}
    pane.insertBefore(section,pane.querySelector('#android-close'));views.add(section);update();
  }
  function pauseForDeletion(){
    deletionPaused=true;epoch++;clearTimeout(timer);timer=null;reading=writing=null;ready=false;preview=null;
    message=text('アカウント削除のためオンライン保存を停止しています。端末の進行は残ります。','Online saves are paused for account deletion. Local progress is kept.');update();
  }
  function resumeAfterDeletionCancelled(){
    deletionPaused=false;epoch++;lastRead=retryAt=0;remote=null;ready=false;
    if(uid)fetchRemote(false).catch(()=>{});update();
  }
  async function clearAfterDeletion(owner){
    const ownedLink=stored(LINK)?.uid===owner;
    if(ownedLink)localStorage.removeItem(LINK);
    if(stored(BACKUP)?.uid===owner)localStorage.removeItem(BACKUP);
    if(ownedLink)localStorage.removeItem('gate-before-cloud-restore');
    await connect('');
  }
  NativeGame.request('status').then(data=>connect(data.uid)).catch(()=>{});
  return {connect,markDirty,mount,fetchRemote,save,previewRemote,previewBackup,restorePreview,pauseForDeletion,resumeAfterDeletionCancelled,clearAfterDeletion,updateView:update};
})();

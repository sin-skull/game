import {firebaseConfig,accountLifecycleEnabled} from './runtime-config.mjs';
import {createDeletionController} from './controller.mjs';
const el=id=>document.getElementById(id);
const login=el('login'),logout=el('logout'),remove=el('delete'),confirm=el('confirm'),result=el('result');
const errors={'auth/popup-closed-by-user':'Googleの確認画面が閉じられました。','auth/popup-blocked':'このページのGoogle確認用ポップアップを許可してから操作してください。','auth/user-mismatch':'ログイン中と同じGoogleアカウントを選んでください。','account-changed':'アカウントが変わったため処理を中止しました。','fresh-google-auth-required':'同じGoogleアカウントをもう一度確認してください。','account-deletion-setup-pending':'削除の接続は準備中です。','deletion-confirmation-required':'削除対象を確認してチェックしてください。'};
let controller;
function render(state){
  el('identity').textContent=state.uid?'ログイン済み：'+(state.name||'Googleアカウント'):'未ログイン';
  login.hidden=!!state.uid;logout.hidden=!state.uid;
  login.disabled=logout.disabled=state.busy||!state.enabled;
  confirm.disabled=state.busy||!state.uid||!state.enabled;
  remove.disabled=state.busy||!state.uid||!state.enabled||!confirm.checked;
  if(state.notice)result.textContent=state.notice;
}
confirm.onchange=()=>{if(controller)render(controller.state());};
async function run(action){try{await action();}catch(error){result.textContent=errors[error.code]||errors[error.message]||controller?.state().notice||'処理を確認できません。通信を確認してから操作してください。';}}
if(!accountLifecycleEnabled){
  el('availability').textContent='Android版は公開準備中です。アカウント削除の本番接続も準備中のため、このページからのログイン・削除はまだ実行できません。';confirm.disabled=true;
}else{
  try{
    const base='https://www.gstatic.com/firebasejs/12.3.0/';
    const [App,Auth,F]=await Promise.all(['firebase-app.js','firebase-auth.js','firebase-firestore.js'].map(name=>import(base+name)));
    const app=App.initializeApp(firebaseConfig,'game-account-deletion-web');
    const auth=Auth.initializeAuth(app,{persistence:Auth.inMemoryPersistence,popupRedirectResolver:Auth.browserPopupRedirectResolver});
    controller=createDeletionController({auth,db:F.getFirestore(app),sdk:{...F,...Auth},enabled:true,onChange:render});
    el('availability').textContent='ゲームで使ったGoogleアカウントで本人確認をして、削除できます。';render(controller.state());
    login.onclick=()=>run(()=>controller.login());
    logout.onclick=()=>run(()=>controller.logout());
    remove.onclick=()=>run(()=>controller.remove({confirmed:confirm.checked}));
  }catch(_){el('availability').textContent='本人確認の接続を開始できませんでした。通信を確認してページを開き直してください。';}
}

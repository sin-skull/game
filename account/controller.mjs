import {deleteGameAccount} from '../android/app/src/main/assets/account-delete-core.mjs';

// This page's memory-only Auth is independent from every game session.
// Signing in here never registers or reactivates a game lifecycle record.
export function createDeletionController({auth,db,sdk,enabled,core=deleteGameAccount,onChange=()=>{}}) {
  let generation=0,busy=false,identity=null,notice='',terminalSignOut=false;
  const session=()=>({uid:identity?.uid||'',generation});
  const state=()=>({uid:identity?.uid||'',name:identity?.displayName||'',busy,notice,enabled});
  const publish=()=>onChange(state());
  const provider=()=>{const p=new sdk.GoogleAuthProvider();p.setCustomParameters({prompt:'select_account'});return p;};
  function changed(user){
    if(busy&&terminalSignOut&&user===null)return;
    if(user!==identity){identity=user;generation++;}
    publish();
  }
  const unsubscribe=sdk.onAuthStateChanged(auth,changed);
  function guard(user,expected){if(identity!==user||auth.currentUser!==user||generation!==expected)throw Error('account-changed');}
  async function login(){
    if(busy)throw Error('operation-in-progress');
    if(!enabled)throw Error('account-deletion-setup-pending');
    busy=true;notice='Googleでログインしてください。';publish();
    try{
      const result=await sdk.signInWithPopup(auth,provider());
      if(auth.currentUser?.uid!==result.user.uid)throw Error('account-changed');
      changed(auth.currentUser);notice='本人確認ができました。削除対象を確認してください。';
    }finally{busy=false;publish();}
  }
  async function logout(){
    if(busy)throw Error('operation-in-progress');
    busy=true;publish();
    try{await sdk.signOut(auth);changed(null);notice='ログアウトしました。';}finally{busy=false;publish();}
  }
  async function remove({confirmed=false}={}){
    if(!enabled)throw Error('account-deletion-setup-pending');
    if(!confirmed)throw Error('deletion-confirmation-required');
    if(busy)throw Error('operation-in-progress');
    if(!identity||auth.currentUser!==identity)throw Error('google-login-required');
    const user=identity,expected=generation;busy=true;notice='同じGoogleアカウントを確認してください。';publish();
    let coreStarted=false;
    try{
      // reauthenticateWithPopup rejects a different Google identity without
      // replacing the signed-in Firebase user.
      await sdk.reauthenticateWithPopup(user,provider());guard(user,expected);
      coreStarted=true;
      const deletionSdk={...sdk,
        async deleteUser(target){guard(user,expected);if(target!==user)throw Error('account-changed');terminalSignOut=true;return sdk.deleteUser(target);},
        async signOut(target){guard(user,expected);if(target!==auth)throw Error('account-changed');terminalSignOut=true;return sdk.signOut(target);}
      };
      const result=await core({auth,db,sdk:deletionSdk,expectedUid:user.uid,expectedGeneration:expected,
        session:()=>{const current=session();const same=auth.currentUser===user||(terminalSignOut&&auth.currentUser===null);return {uid:same?current.uid:'',generation:current.generation};},
        onProgress:stage=>{const messages={'blocking-cloud-writes':'オンライン保存を停止しています…','deleting-tester-membership':'テスター登録を削除しています…','deleting-game-records':'両ゲームのクラウドデータを削除しています…','verifying-server-deletion':'サーバーで削除結果を確認しています…','retaining-unrelated-service-identity':'別サービスの利用情報を残してログアウトしています…','deleting-authentication-identity':'ゲームの認証情報を削除しています…'};notice=messages[stage]||'削除を確認しています…';publish();}
      });
      notice='「無限の次へ」と「GATE VADER」のクラウドデータとテスター登録の削除を確認しました。'+(result.sharedServiceIdentityRetained?'別サービスで使う共通認証は残しています。':'ゲームの認証情報も削除しました。')+'各端末のゲーム進行は、このページからは削除しません。';
      terminalSignOut=false;changed(null);return result;
    }catch(error){
      if(coreStarted)notice='削除の完了を確認できません。オンライン保存は停止している場合があります。このページで同じアカウントを確認して再開してください。';
      else notice='本人確認を完了できませんでした。ゲームのデータ削除には進んでいません。';
      throw error;
    }finally{terminalSignOut=false;if(auth.currentUser!==identity)changed(auth.currentUser);busy=false;publish();}
  }
  return {state,login,logout,remove,close:unsubscribe};
}

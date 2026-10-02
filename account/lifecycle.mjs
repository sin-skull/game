// Only call from an acknowledged explicit Google sign-in, never cached startup.
export async function registerFreshGameAccount({sdk,db,user,session,expectedGeneration}) {
  const uid=user?.uid;
  async function guard(){const current=await session();if(!uid||current.uid!==uid||current.generation!==expectedGeneration||!Number.isSafeInteger(expectedGeneration))throw Error('account-changed');}
  await guard();
  const credentials=await user.getIdTokenResult(true);await guard();
  const authenticatedAt=Number(credentials.claims.auth_time),now=Date.now()/1000;
  if(credentials.claims.firebase?.sign_in_provider!=='google.com'||!Number.isFinite(authenticatedAt)||now-authenticatedAt>300||authenticatedAt>now+60)throw Error('fresh-google-auth-required');
  const ref=sdk.doc(db,'masu_game_accounts',uid);
  await sdk.runTransaction(db,async tx=>{
    await guard();const existing=await tx.get(ref);await guard();
    if(existing.exists()&&(existing.data().schema!==1||!existing.data().createdAt))throw Error('invalid-account-lifecycle');
    tx.set(ref,{schema:1,active:true,createdAt:existing.exists()?existing.data().createdAt:sdk.serverTimestamp(),updatedAt:sdk.serverTimestamp()});
  });
  await guard();
}

// Shared by the Android account menu and the standalone deletion page.
// SDK functions are injected; credentials stay in the caller's in-memory Auth instance.
const CAMPAIGN = 'android-beta-v1';
const ROOTS = ['bi_users', 'bi_ranking', 'bi_ghosts', 'masu_gate_saves'];

export async function deleteGameAccount({sdk, db, auth, expectedUid, expectedGeneration, session, onProgress = () => {}, maxPages = 20, pageSize = 50}) {
  const user = auth.currentUser;
  const captured = await session();
  if (!expectedUid || user?.uid !== expectedUid || captured.uid !== expectedUid || !Number.isSafeInteger(expectedGeneration) || captured.generation !== expectedGeneration) throw Error('account-changed');
  if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 20 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 50) throw Error('invalid-deletion-limit');
  const uid = expectedUid;
  async function externalGuard() {
    const now = await session();
    if (now.uid !== uid || now.generation !== captured.generation) throw Error('account-changed');
  }
  async function guard() {
    await externalGuard();
    if (auth.currentUser !== user || user.uid !== uid) throw Error('account-changed');
  }
  async function step(operation) { await guard(); const result = await operation(); await guard(); return result; }
  function progress(stage) { try { onProgress(stage); } catch (_) {} }
  const credentials = await step(() => user.getIdTokenResult(true));
  const authenticatedAt = Number(credentials.claims.auth_time), now = Date.now() / 1000;
  if (credentials.claims.firebase?.sign_in_provider !== 'google.com' || !Number.isFinite(authenticatedAt) || now - authenticatedAt > 300 || authenticatedAt > now + 60) throw Error('fresh-google-auth-required');
  const life = sdk.doc(db, 'masu_game_accounts', uid);
  const root = sdk.doc(db, 'android_beta', CAMPAIGN);
  const member = sdk.doc(root, 'members', uid);
  const roots = ROOTS.map(name => sdk.doc(db, name, uid));
  let redeemedCode = null;

  progress('blocking-cloud-writes');
  await step(() => sdk.runTransaction(db, async tx => {
    await guard(); const existing = await tx.get(life); await guard();
    if (existing.exists() && existing.data().schema !== 1) throw Error('invalid-account-lifecycle');
    tx.set(life, {schema: 1, active: false, createdAt: existing.exists() ? existing.data().createdAt : sdk.serverTimestamp(), updatedAt: sdk.serverTimestamp()});
  }));

  progress('deleting-tester-membership');
  await step(() => sdk.runTransaction(db, async tx => {
    await guard();
    const [membership, campaign] = await Promise.all([tx.get(member), tx.get(root)]); await guard();
    let invitation = null, codeRef = null;
    if (membership.exists()) {
      const hash = membership.data().codeHash;
      if (!/^[a-f0-9]{64}$/.test(hash)) throw Error('invalid-membership');
      codeRef = sdk.doc(root, 'codes', hash);
      invitation = await tx.get(codeRef); await guard();
    }
    // All transaction reads precede writes. Counters and capacities never change.
    if (campaign.exists() && campaign.data().lastUid === uid) tx.update(root, {lastUid: sdk.deleteField(), updatedAt: sdk.serverTimestamp()});
    if (invitation?.exists() && invitation.data().lastUid === uid) tx.update(codeRef, {lastUid: sdk.deleteField(), updatedAt: sdk.serverTimestamp()});
    if (membership.exists()) tx.delete(member);
    return codeRef;
  })).then(ref => { redeemedCode = ref; });

  progress('deleting-game-records');
  await step(() => { const batch = sdk.writeBatch(db); roots.forEach(ref => batch.delete(ref)); return batch.commit(); });
  function ownedQuery(name, field, count = pageSize) {
    return sdk.query(sdk.collection(db, name), sdk.where(field, '==', uid), sdk.limit(count));
  }
  async function eraseOwned(name, field) {
    for (let page = 0; page < maxPages; page++) {
      const snapshot = await step(() => sdk.getDocsFromServer(ownedQuery(name, field)));
      if (snapshot.empty) return;
      await step(() => {
        const batch = sdk.writeBatch(db);
        for (const item of snapshot.docs) {
          if (item.data()[field] !== uid) throw Error('unexpected-record-owner');
          batch.delete(item.ref);
        }
        return batch.commit();
      });
    }
    if (!(await step(() => sdk.getDocsFromServer(ownedQuery(name, field, 1)))).empty) throw Error('deletion-incomplete-resume-required');
  }
  await eraseOwned('bi_names', 'uid');
  await eraseOwned('bi_inbox', 'to');

  progress('verifying-server-deletion');
  const remaining = await step(() => Promise.all([...roots, member, root, ...(redeemedCode ? [redeemedCode] : [])].map(ref => sdk.getDocFromServer(ref))));
  if (remaining.slice(0, roots.length + 1).some(snapshot => snapshot.exists()) || remaining.slice(roots.length + 1).some(snapshot => snapshot.exists() && snapshot.data().lastUid === uid)) throw Error('deletion-incomplete-resume-required');
  for (const [name, field] of [['bi_names', 'uid'], ['bi_inbox', 'to']]) {
    if (!(await step(() => sdk.getDocsFromServer(ownedQuery(name, field, 1)))).empty) throw Error('deletion-incomplete-resume-required');
  }
  // This project also serves an unrelated app. Never erase that app's identity.
  const unrelated = await step(() => sdk.getDocFromServer(sdk.doc(db, 'users', uid)));
  const retainIdentity = unrelated.exists();
  await step(() => sdk.runTransaction(db, async tx => {
    await guard();
    const records = await Promise.all([life, ...roots, member].map(ref => tx.get(ref))); await guard();
    if (!records[0].exists() || records[0].data().active !== false || records.slice(1).some(snapshot => snapshot.exists())) throw Error('deletion-incomplete-resume-required');
    tx.delete(life);
  }));
  if ((await step(() => sdk.getDocFromServer(life))).exists()) throw Error('deletion-incomplete-resume-required');

  progress(retainIdentity ? 'retaining-unrelated-service-identity' : 'deleting-authentication-identity');
  await guard();
  // deleteUser/signOut intentionally clear this temporary Auth session, so the
  // normal post-await Auth-object check does not apply to this final operation.
  if (retainIdentity) await sdk.signOut(auth); else await sdk.deleteUser(user);
  await externalGuard();
  if (auth.currentUser !== null) throw Error('authentication-deletion-unconfirmed');
  return {cloudDeleted: true, authenticationDeleted: !retainIdentity, sharedServiceIdentityRetained: retainIdentity, localProgressDeleted: false};
}

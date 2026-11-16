// Reuse the existing UID when linking. Failed credential probes never replace the active session.
export function createAccountTransfer(api){
 const {auth,ensureUser,profileFor,linkWithCredential,credential,signIn,probe,storage,apiKey,fetcher=fetch}=api;
 function credentials(email,password){const e=String(email||'').trim();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))throw Error('メールアドレスを確認してください。');if(String(password||'').length<12)throw Error('パスワードは12文字以上にしてください。');return{email:e,password};}
 async function link(email,password){
  const c=credentials(email,password),user=await ensureUser(),uid=user.uid;
  if(user.providerData?.some(p=>p.providerId==='password'))throw Error('このデータはメール連携済みです。別の端末では「メールで再開」を使ってください。');
  try{await linkWithCredential(user,credential(c.email,c.password));}
  catch(error){
   if(error?.code!=='auth/operation-not-allowed'||!/verify the new email before changing email/i.test(error.message||''))throw error;
   const idToken=await user.getIdToken();if(!idToken)throw Error('認証情報を取得できませんでした。ブラウザデータを削除せず再試行してください。');
   const response=await fetcher('https://identitytoolkit.googleapis.com/v1/accounts:signUp?key='+encodeURIComponent(apiKey),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken,email:c.email,password:c.password,returnSecureToken:true}),cache:'no-store',credentials:'omit'});
   const data=await response.json();if(!response.ok)throw Error('メール連携を完了できませんでした。既に使っているメールか、認証設定を確認してください。');
   if(data.localId!==uid)throw Error('UIDが一致しないため停止しました。ブラウザデータを削除しないでください。');
   const signed=await signIn(c.email,c.password);if(signed.uid!==uid)throw Error('UIDの確認に失敗しました。');
  }
  if(auth.currentUser?.uid!==uid)throw Error('UIDの確認に失敗しました。');
  return{uid,profile:await profileFor(uid)};
 }
 async function login(email,password,approveSwitch){
  const c=credentials(email,password),candidate=await probe(c.email,c.password);
  if(!candidate?.uid)throw Error('メール認証を確認できませんでした。');
  if(auth.currentUser?.uid&&auth.currentUser.uid!==candidate.uid&&!await approveSwitch())return null;
  const before={deck:storage.getItem('tcg_deck_local_v20260202_30'),title:storage.getItem('tcg_deck_title_v20260204'),exSupport:storage.getItem('tcg_ex_support_v20260202_30')};
  storage.setItem('tcg_local_before_account_switch_v122',JSON.stringify(before));
  const user=await signIn(c.email,c.password);if(user.uid!==candidate.uid)throw Error('UIDの確認に失敗しました。');
  const profile=await profileFor(user.uid);
  storage.setItem('tcg_pending_cloud_deck_v20260822',JSON.stringify({deck:profile.deck||{},title:profile.deckTitle||'',exSupport:profile.exSupport||'',desiredField:profile.desiredField||'grass'}));
  storage.removeItem('tcg_active_match_v122');
  return{uid:user.uid,profile};
 }
 return{link,login};
}

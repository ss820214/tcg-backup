// Firestore is authoritative: never queue a move against a cached/offline board.
export function createBattleConnection({refresh,onFresh=()=>{},onBlocked=()=>{},doc=document,win=window}) {
 let ready=false,refreshing=null,disposed=false;
 const banner=doc.createElement('div');banner.id='battleConnection';banner.setAttribute('role','status');banner.setAttribute('aria-live','polite');
 banner.style.cssText='position:sticky;top:0;z-index:20000;padding:10px 12px;background:#26384a;color:#f0f7ff;font:700 13px/1.5 system-ui;display:flex;gap:10px;align-items:center;justify-content:center;flex-wrap:wrap';
 const label=doc.createElement('span'),retry=doc.createElement('button');retry.type='button';retry.textContent='接続を確認';retry.style.cssText='min-height:36px;border:1px solid #8fbfcf;border-radius:8px;background:#183341;color:white;padding:6px 12px';
 banner.append(label,retry);doc.body.prepend(banner);
 function block(text){ready=false;banner.hidden=false;banner.style.display='flex';label.textContent=text;onBlocked();}
 function accept(){if(disposed||win.navigator.onLine===false||doc.hidden)return;ready=true;banner.hidden=true;banner.style.display='none';onFresh();}
 function observe(snapshot){
  if(!snapshot.exists()){block('対戦データを待っています。');return;}
  if(snapshot.metadata?.fromCache){block('通信を確認中…盤面が同期されるまで操作を待ってね。');return;}
  accept();
 }
 async function reconnect(){
  if(disposed||doc.hidden)return;
  if(win.navigator.onLine===false){block('オフラインです。接続後に同じ対戦を再開できます。');return;}
  if(refreshing)return refreshing;
  block('対戦を再同期しています…');retry.disabled=true;
  refreshing=Promise.resolve().then(refresh).then(snapshot=>{observe(snapshot);return snapshot;}).catch(()=>block('再接続できませんでした。通信を確認して「接続を確認」を押してください。')).finally(()=>{refreshing=null;retry.disabled=false;});
  return refreshing;
 }
 function guard(event){if(!ready&&event.target?.closest?.('#app,#mobileBattleNav')){event.preventDefault();event.stopImmediatePropagation();}}
 const offline=()=>block('オフラインです。接続後に同じ対戦を再開できます。');
 const visibility=()=>{if(doc.hidden)block('画面に戻ったら対戦を同期します。');else void reconnect();};
 win.addEventListener('offline',offline);win.addEventListener('online',reconnect);doc.addEventListener('visibilitychange',visibility);doc.addEventListener('click',guard,true);doc.addEventListener('pointerdown',guard,true);retry.addEventListener('click',reconnect);
 block('対戦データを同期しています…');
 return {canAct:()=>ready,observe,reconnect,fail:error=>block(String(error?.message||'通信エラー：再接続してください')),dispose(){disposed=true;win.removeEventListener('offline',offline);win.removeEventListener('online',reconnect);doc.removeEventListener('visibilitychange',visibility);doc.removeEventListener('click',guard,true);doc.removeEventListener('pointerdown',guard,true);banner.remove();}};
}

(() => {
  "use strict";
  const tiers = ["S", "A", "B", "C", "D", "pool"];
  const labels = { S:"S", A:"A", B:"B", C:"C", D:"D", pool:"未配置" };
  function grouped() {
    return tiers.map(tier => {
      const root = tier === "pool" ? document.getElementById("deckPool") : document.querySelector('.tier-dropzone[data-tier="'+tier+'"]');
      const names = [...(root?.querySelectorAll(".deck-chip") || [])].map(el => el.querySelector(".chip-name")?.textContent?.trim()).filter(Boolean);
      return { tier, names };
    });
  }
  function download(data, name, type) {
    const blob = new Blob([data], {type});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href=url; a.download=name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 1500);
  }
  function notify(message) {
    let el=document.getElementById("tierConvenienceMessage");
    if (!el) { el=document.createElement("div"); el.id="tierConvenienceMessage"; el.setAttribute("role","status"); document.getElementById("tierConvenienceTools")?.append(el); }
    el.textContent=message;
  }
  function install() {
    const toolbar=document.querySelector(".tier-toolbar");
    if (!toolbar || document.getElementById("tierConvenienceTools")) return;
    const tools=document.createElement("div");
    tools.id="tierConvenienceTools";
    tools.innerHTML='<div class="tierConvenienceButtons"><button type="button" data-tier-copy>一覧をコピー</button><button type="button" data-tier-csv>CSV保存</button><button type="button" data-tier-top>上へ戻る ↑</button></div><div class="tierConvenienceJumps" aria-label="ランクに移動"><span>ジャンプ:</span></div>';
    const jump=tools.querySelector(".tierConvenienceJumps");
    for (const tier of tiers) {
      const b=document.createElement("button"); b.type="button"; b.textContent=labels[tier];
      b.addEventListener("click",()=>{
        const node=tier==="pool"? document.querySelector(".pool-section") : document.querySelector('.tier-row[data-tier="'+tier+'"]');
        node?.scrollIntoView({behavior:"smooth",block:"start"});
      });
      jump.appendChild(b);
    }
    tools.querySelector("[data-tier-copy]").addEventListener("click",async()=>{
      const text=grouped().map(({tier,names})=>labels[tier]+": "+(names.length?names.join(" / "):"なし")).join("\n");
      try { await navigator.clipboard.writeText(text); notify("ティア一覧をコピーしました"); }
      catch { notify("コピーできませんでした。ブラウザの権限をご確認ください"); }
    });
    tools.querySelector("[data-tier-csv]").addEventListener("click",()=>{
      const q=x=>'"'+String(x).replace(/"/g,'""')+'"';
      const rows=[["ティア","順番","デッキ名"]];
      grouped().forEach(({tier,names})=>names.forEach((name,i)=>rows.push([labels[tier],String(i+1),name])));
      download("\uFEFF"+rows.map(row=>row.map(q).join(",")).join("\r\n"),"0bato-tier-"+new Date().toISOString().slice(0,10)+".csv","text/csv;charset=utf-8");
      notify("CSVを保存しました");
    });
    tools.querySelector("[data-tier-top]").addEventListener("click",()=>window.scrollTo({top:0,behavior:"smooth"}));
    toolbar.insertAdjacentElement("afterend",tools);
    const style=document.createElement("style");
    style.textContent=`#tierConvenienceTools{display:grid;gap:8px;margin:12px 0 18px;padding:12px;border:1px solid rgba(255,255,255,.15);border-radius:14px;background:rgba(13,20,33,.78);min-width:0}#tierConvenienceTools .tierConvenienceButtons,#tierConvenienceTools .tierConvenienceJumps{display:flex;flex-wrap:wrap;align-items:center;gap:7px}#tierConvenienceTools button{min-height:37px;padding:7px 12px;border-radius:9px;border:1px solid rgba(125,211,252,.3);background:rgba(125,211,252,.09);color:#eefaff;font-weight:750;cursor:pointer}#tierConvenienceTools .tierConvenienceJumps span{font-size:12px;color:#b9c9d6}#tierConvenienceTools .tierConvenienceJumps button{min-height:32px;min-width:36px;padding:5px 8px}#tierConvenienceMessage{font-size:12px;color:#93e8b6} .tier-row,.pool-section{scroll-margin-top:80px}@media(max-width:600px){#tierConvenienceTools{padding:9px}#tierConvenienceTools .tierConvenienceButtons button{flex:1 1 auto;font-size:12px;padding:7px 8px}}`;
    document.head.append(style);
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",install,{once:true}); else install();
})();
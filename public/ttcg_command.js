// public/ttcg_command.js
(() => {
  "use strict";
  const path = location.pathname.split("/").pop() || "index.html";
  const t = (s) => s.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  const base = [
    { id:"home", label:t("\\u521d\\u671f\\u753b\\u9762"), sub:t("\\u30e2\\u30fc\\u30c9\\u9078\\u629e\\u306b\\u623b\\u308b"), href:"./index.html" },
    { id:"deck", label:t("\\u30c7\\u30c3\\u30ad\\u7de8\\u6210"), sub:t("30\\u679a\\u306e\\u30c7\\u30c3\\u30ad\\u3092\\u7d44\\u3080"), href:"./deck.html" },
    { id:"profile", label:t("\\u30e6\\u30fc\\u30b6\\u30fc / YOU\\u80b2\\u6210"), sub:t("\\u6240\\u6301\\u30ab\\u30fc\\u30c9\\u3068\\u80b2\\u6210\\u3092\\u898b\\u308b"), href:"./profile.html" },
    { id:"gacha", label:t("\\u30ac\\u30c1\\u30e3"), sub:t("\\u30ab\\u30fc\\u30c9\\u3092\\u5897\\u3084\\u3059"), href:"./gacha.html" },
    { id:"arcade", label:t("\\u30a2\\u30fc\\u30b1\\u30fc\\u30c9"), sub:t("\\u30bd\\u30ed\\u3067\\u5831\\u916c\\u3092\\u72d9\\u3046"), href:"./arcade.html" },
    { id:"creator", label:t("\\u30ab\\u30fc\\u30c9\\u5de5\\u623f"), sub:t("\\u30ab\\u30fc\\u30c9\\u3068\\u6280\\u3092\\u4f5c\\u308b"), href:"./creator.html" },
    { id:"rule", label:t("\\u30eb\\u30fc\\u30eb / \\u8f9e\\u66f8"), sub:t("\\u5c5e\\u6027\\u30fb\\u72b6\\u614b\\u7570\\u5e38\\u3092\\u78ba\\u8a8d"), href:"./rule.html" },
    { id:"tutorial", label:t("\\u30c1\\u30e5\\u30fc\\u30c8\\u30ea\\u30a2\\u30eb"), sub:t("\\u57fa\\u672c\\u64cd\\u4f5c\\u3092\\u78ba\\u8a8d"), href:"./tutorial.html" }
  ];
  const page = {
    "game.html": [
      { id:"game-log", label:t("\\u30ed\\u30b0\\u3078"), sub:t("\\u6226\\u95d8\\u30ed\\u30b0\\u3092\\u898b\\u308b"), action:() => jumpTo("log") },
      { id:"game-hand", label:t("\\u624b\\u672d\\u3078"), sub:t("\\u624b\\u672d\\u30a8\\u30ea\\u30a2\\u3092\\u898b\\u308b"), action:() => jumpTo("hand") }
    ],
    "deck.html": [
      { id:"deck-cards", label:t("\\u30ab\\u30fc\\u30c9\\u4e00\\u89a7\\u3078"), sub:t("\\u5019\\u88dc\\u30ab\\u30fc\\u30c9\\u3092\\u898b\\u308b"), action:() => jumpTo("cardList") },
      { id:"deck-list", label:t("\\u5165\\u308c\\u305f\\u30ab\\u30fc\\u30c9\\u3078"), sub:t("\\u73fe\\u5728\\u306e\\u30c7\\u30c3\\u30ad\\u3092\\u898b\\u308b"), action:() => jumpTo("deckList") },
      { id:"deck-room", label:t("\\u958b\\u59cb\\u30d1\\u30cd\\u30eb"), sub:t("\\u30eb\\u30fc\\u30e0\\u64cd\\u4f5c\\u3092\\u958b\\u304f"), action:() => document.getElementById("roomDrawerToggle")?.click() }
    ]
  };
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (m) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
  const all = () => [...(page[path] || []), ...base];
  const showFab = () => {
    const params = new URLSearchParams(location.search);
    return params.get("cmd") === "1" || localStorage.getItem("tcgCommandFab") === "1";
  };
  function jumpTo(id){const el=document.getElementById(id); if(!el) return; el.scrollIntoView({behavior:"smooth",block:"center"}); el.classList.remove("cmdPulse"); void el.offsetWidth; el.classList.add("cmdPulse");}
  function injectCss(){
    if(document.getElementById("ttcgCommandCss")) return;
    const s=document.createElement("style"); s.id="ttcgCommandCss";
    s.textContent = [
      ".cmdFab{position:fixed;left:18px;top:74px;z-index:9050;display:flex;align-items:center;gap:7px;height:36px;padding:0 11px;border-radius:999px;border:1px solid rgba(160,220,255,.28);background:linear-gradient(135deg,rgba(17,30,42,.82),rgba(9,13,18,.86));color:#fff;font-weight:900;letter-spacing:.04em;box-shadow:0 10px 24px rgba(0,0,0,.34),0 0 18px rgba(100,205,255,.1);cursor:pointer;opacity:.82;transition:opacity .18s ease, transform .18s ease}",
      ".cmdFab:hover,.cmdFab:focus-visible{opacity:1;transform:translateY(-1px)}",
      ".cmdFab kbd{font:inherit;font-size:11px;padding:3px 7px;border-radius:999px;background:rgba(255,255,255,.11);border:1px solid rgba(255,255,255,.16)}",
      ".cmdBackdrop{position:fixed;inset:0;z-index:9100;display:none;background:rgba(0,0,0,.48);backdrop-filter:blur(8px)}.cmdBackdrop.open{display:grid;place-items:start center;padding-top:min(10vh,80px)}",
      ".cmdPanel{width:min(680px,calc(100vw - 28px));max-height:min(720px,calc(100vh - 50px));overflow:hidden;border:1px solid rgba(130,220,255,.26);border-radius:20px;color:#fff;background:linear-gradient(145deg,rgba(20,31,42,.97),rgba(10,12,18,.96));box-shadow:0 30px 80px rgba(0,0,0,.62)}",
      ".cmdTop{padding:14px;border-bottom:1px solid rgba(255,255,255,.1);display:grid;gap:10px}.cmdTitle{display:flex;align-items:center;justify-content:space-between;gap:10px}.cmdTitle b{font-size:18px}.cmdClose{border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.08);color:#fff;border-radius:999px;width:36px;height:36px;font-weight:900;cursor:pointer}",
      ".cmdSearch{width:100%;height:46px;border-radius:14px;border:1px solid rgba(130,220,255,.22);background:rgba(0,0,0,.22);color:#fff;padding:0 14px;font-size:16px;outline:none}.cmdResults{max-height:calc(100vh - 170px);overflow:auto;padding:10px;display:grid;gap:8px}",
      ".cmdItem{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;text-align:left;width:100%;border:1px solid rgba(255,255,255,.1);border-radius:14px;background:rgba(255,255,255,.045);color:#fff;padding:12px;cursor:pointer}.cmdItem:hover,.cmdItem.active{border-color:rgba(125,225,255,.58);background:rgba(90,170,220,.16);box-shadow:0 0 18px rgba(90,190,255,.1)}.cmdItem b{display:block;font-size:14px}.cmdItem small{display:block;margin-top:4px;color:rgba(255,255,255,.58);line-height:1.4}",
      ".cmdPulse{animation:cmdPulse 1.2s ease both}@keyframes cmdPulse{35%{box-shadow:0 0 0 5px rgba(120,220,255,.18),0 0 28px rgba(120,220,255,.28)}}@media(max-width:760px){.cmdFab{left:10px;top:58px;height:34px;padding:0 9px;font-size:12px}.cmdFab kbd{display:none}.cmdBackdrop.open{padding-top:10px}.cmdPanel{border-radius:16px}}"
    ].join("\n");
    document.head.appendChild(s);
  }
  function render(q=""){
    const r=document.getElementById("cmdResults"); if(!r) return;
    const query=q.trim().toLowerCase();
    const list=all().filter(c=>!query || (c.label+" "+c.sub).toLowerCase().includes(query));
    r.innerHTML = list.map((c,i)=>`<button class="cmdItem ${i===0?"active":""}" type="button" data-id="${esc(c.id)}"><span><b>${esc(c.label)}</b><small>${esc(c.sub)}</small></span><span>&gt;</span></button>`).join("") || `<div class="cmdItem"><span><b>${esc(t("\\u898b\\u3064\\u304b\\u308a\\u307e\\u305b\\u3093"))}</b></span></div>`;
  }
  function open(){document.getElementById("cmdBackdrop")?.classList.add("open"); const i=document.getElementById("cmdSearch"); if(i){i.value=""; render(); setTimeout(()=>i.focus(),0);}}
  function close(){document.getElementById("cmdBackdrop")?.classList.remove("open");}
  function exec(id){const c=all().find(x=>x.id===id); if(!c) return; if(c.action){c.action(); close(); return;} if(c.href) location.href=c.href;}
  function boot(){
    if(document.getElementById("cmdBackdrop")) return;
    injectCss();
    const back=document.createElement("div"); back.id="cmdBackdrop"; back.className="cmdBackdrop"; back.innerHTML=`<section class="cmdPanel" role="dialog" aria-modal="true"><div class="cmdTop"><div class="cmdTitle"><b>TTCG Command</b><button class="cmdClose" type="button">x</button></div><input id="cmdSearch" class="cmdSearch" type="search" placeholder="deck / gacha / rule"></div><div id="cmdResults" class="cmdResults"></div></section>`;
    document.body.append(back);
    if(showFab()){
      const fab=document.createElement("button"); fab.id="cmdFab"; fab.className="cmdFab"; fab.type="button"; fab.innerHTML=`<kbd>Ctrl K</kbd><span>CMD</span>`;
      document.body.append(fab);
      fab.addEventListener("click",open);
    }
    back.querySelector(".cmdClose")?.addEventListener("click",close);
    back.addEventListener("click",e=>{if(e.target===back) close(); const b=e.target.closest(".cmdItem[data-id]"); if(b) exec(b.dataset.id);});
    back.querySelector("#cmdSearch")?.addEventListener("input",e=>render(e.target.value));
    document.addEventListener("keydown",e=>{const typing=/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName||""); if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){e.preventDefault();open();} else if(e.key==="/"&&!typing){e.preventDefault();open();} else if(e.key==="Escape") close();});
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",boot,{once:true}); else boot();
})();

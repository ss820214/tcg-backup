// public/player_journey.js
// Cross-screen guidance and readability layer. It avoids touching game state.
(() => {
  "use strict";

  const VERSION = "20260801_journey1";
  const LS_OPEN = "tcgJourneyOpen";
  const LS_SEEN = "tcgJourneySeen";
  const LS_DONE = "tcgJourneyDone";
  const LS_MINI = "tcgJourneyMini";

  const path = location.pathname.split("/").pop() || "index.html";
  const is = (name) => path === name || (name === "index.html" && path === "");
  if (path === "deck.html") return;

  const ROUTES = {
    home: "./index.html",
    deck: "./index.html#deck",
    profile: "./profile.html",
    gacha: "./gacha.html",
    arcade: "./arcade.html",
    creator: "./creator.html",
    rule: "./rule.html",
    tutorial: "./tutorial.html",
  };

  const pageMeta = (() => {
    if (path === "game.html") return { key: "battle", title: "バトル", goal: "盤面を見て、行動できるユニットから順に処理。" };
    if (path === "gacha.html") return { key: "gacha", title: "ガチャ", goal: "欲しいテーマを選び、所持カードを増やす。" };
    if (path === "profile.html") return { key: "profile", title: "ユーザー", goal: "YOUカード育成、所持カード、戦績を確認。" };
    if (path === "creator.html") return { key: "creator", title: "カード工房", goal: "カード・技・テーマを安全に追加。" };
    if (path === "match_intro.html") return { key: "match", title: "対戦準備", goal: "マップとREADYを確認して戦場へ。" };
    if (path === "rule.html") return { key: "rule", title: "ルール", goal: "迷ったルールを検索して確認。" };
    if (path === "arcade.html") return { key: "arcade", title: "アーケード", goal: "短期戦で報酬と成長ポイントを稼ぐ。" };
    if (path === "victory.html") return { key: "victory", title: "結果", goal: "報酬を確認して次の育成へ。" };
    return { key: "home", title: "初期画面", goal: "デッキ、育成、対戦への入口。" };
  })();

  const steps = [
    { id: "deck30", label: "30枚デッキを作る", href: ROUTES.deck, hint: "カード一覧から採用して、枚数表示を30/30へ。" },
    { id: "solo", label: "ソロで動きを確認", href: ROUTES.deck, hint: "開始からソロを選んで、移動・射程・進化を見る。" },
    { id: "profile", label: "YOUカードを育成", href: ROUTES.profile, hint: "Growth PtでHP/SP/技/特殊を伸ばす。" },
    { id: "gacha", label: "カードを増やす", href: ROUTES.gacha, hint: "闇鍋・時織・童話など、テーマを選んで引く。" },
    { id: "rules", label: "属性と状態を読む", href: ROUTES.rule, hint: "属性の強弱、状態異常、勝利条件を確認。" },
  ];

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[m]);
  }

  function readDone() {
    try {
      return JSON.parse(localStorage.getItem(LS_DONE) || "{}") || {};
    } catch {
      return {};
    }
  }

  function writeDone(done) {
    localStorage.setItem(LS_DONE, JSON.stringify(done || {}));
  }

  function injectCss() {
    if (document.getElementById("playerJourneyCss")) return;
    const style = document.createElement("style");
    style.id = "playerJourneyCss";
    style.textContent = `
      :root{
        --journey-bg:rgba(9,14,18,.86);
        --journey-panel:linear-gradient(145deg, rgba(21,33,45,.94), rgba(12,15,20,.92));
        --journey-line:rgba(130,210,255,.24);
        --journey-good:#78f2b8;
        --journey-warn:#f4d56d;
        --journey-blue:#70c6ff;
        --journey-purple:#c59aff;
      }
      .journeyFab{
        position:fixed; right:18px; bottom:18px; z-index:9000;
        display:flex; align-items:center; gap:8px;
        min-height:44px; padding:9px 14px; border-radius:999px;
        border:1px solid rgba(130,210,255,.35);
        color:#fff; background:linear-gradient(135deg, rgba(27,49,68,.9), rgba(10,18,25,.92));
        box-shadow:0 12px 30px rgba(0,0,0,.4), 0 0 22px rgba(90,190,255,.18);
        font-weight:800; letter-spacing:.02em; cursor:pointer;
      }
      .journeyFab .dot{width:9px;height:9px;border-radius:50%;background:var(--journey-good);box-shadow:0 0 14px var(--journey-good);}
      .journeyFab:hover{border-color:rgba(160,235,255,.72); transform:translateY(-1px);}
      .journeyPanel{
        position:fixed; right:18px; bottom:74px; z-index:9000;
        width:min(390px, calc(100vw - 28px)); max-height:min(680px, calc(100vh - 100px)); overflow:auto;
        border:1px solid var(--journey-line); border-radius:18px;
        background:var(--journey-panel); color:#fff;
        box-shadow:0 24px 60px rgba(0,0,0,.52), inset 0 1px 0 rgba(255,255,255,.08);
        padding:16px; display:none;
      }
      .journeyPanel.open{display:block; animation:journeyIn .18s ease-out;}
      @keyframes journeyIn{from{opacity:0;transform:translateY(12px) scale(.98)}to{opacity:1;transform:none}}
      .journeyHead{display:flex;align-items:start;justify-content:space-between;gap:12px;margin-bottom:12px;}
      .journeyHead b{font-size:18px;}
      .journeyHead small{display:block;color:rgba(255,255,255,.68);margin-top:4px;line-height:1.5;}
      .journeyClose,.journeyMini{
        border:1px solid rgba(255,255,255,.2); border-radius:999px; background:rgba(255,255,255,.08);
        color:#fff; min-width:34px; height:34px; cursor:pointer; font-weight:900;
      }
      .journeyHero{
        border:1px solid rgba(169,255,94,.3); border-radius:14px; padding:12px;
        background:radial-gradient(circle at 12% 15%, rgba(172,255,94,.18), transparent 40%), rgba(255,255,255,.045);
        margin-bottom:12px;
      }
      .journeyHero .tag{display:inline-flex;padding:3px 9px;border:1px solid rgba(169,255,94,.45);border-radius:999px;color:#caff72;font-size:12px;font-weight:900;margin-bottom:8px;}
      .journeyHero h3{margin:0 0 6px;font-size:18px;}
      .journeyHero p{margin:0;color:rgba(255,255,255,.76);line-height:1.6;font-size:13px;}
      .journeyList{display:grid;gap:8px;margin:12px 0;}
      .journeyStep{
        display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;
        padding:10px;border:1px solid rgba(255,255,255,.11);border-radius:12px;background:rgba(255,255,255,.04);
      }
      .journeyStep.done{border-color:rgba(120,242,184,.34);background:rgba(120,242,184,.08);}
      .journeyStep .check{
        width:24px;height:24px;border-radius:50%;display:grid;place-items:center;
        border:1px solid rgba(255,255,255,.25);font-size:13px;color:rgba(255,255,255,.7);
      }
      .journeyStep.done .check{background:rgba(120,242,184,.2);border-color:rgba(120,242,184,.65);color:#b7ffd9;}
      .journeyStep b{font-size:13px;}
      .journeyStep span{display:block;margin-top:3px;color:rgba(255,255,255,.62);font-size:12px;line-height:1.45;}
      .journeyStep a,.journeyBtn{
        color:#fff;text-decoration:none;border:1px solid rgba(112,198,255,.36);border-radius:999px;
        padding:6px 10px;background:rgba(50,120,170,.18);font-weight:800;font-size:12px;white-space:nowrap;
      }
      .journeyCards{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px;}
      .journeyCard{
        border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:10px;background:rgba(255,255,255,.04);
      }
      .journeyCard b{display:block;font-size:12px;margin-bottom:5px;color:#dff6ff;}
      .journeyCard span{font-size:12px;color:rgba(255,255,255,.66);line-height:1.45;}
      .journeyStrip{
        display:flex;align-items:center;gap:10px;flex-wrap:wrap;
        border:1px solid rgba(120,242,184,.22);border-radius:14px;padding:10px 12px;
        background:linear-gradient(90deg, rgba(20,50,44,.55), rgba(22,34,46,.42));
        color:#fff;margin:10px 0;
      }
      .journeyStrip b{font-size:13px;}
      .journeyStrip span{color:rgba(255,255,255,.68);font-size:12px;}
      .journeyPill{
        display:inline-flex;align-items:center;gap:6px;border:1px solid rgba(255,255,255,.14);border-radius:999px;
        padding:5px 9px;background:rgba(0,0,0,.18);font-size:12px;color:#fff;
      }
      .journeyPill.good{border-color:rgba(120,242,184,.45);box-shadow:0 0 14px rgba(120,242,184,.12);}
      .battleToastRail{
        position:fixed; left:50%; top:76px; transform:translateX(-50%); z-index:8500;
        display:grid; gap:8px; width:min(560px, calc(100vw - 28px)); pointer-events:none;
      }
      .battleToast{
        border:1px solid rgba(112,198,255,.33);border-radius:14px;padding:10px 14px;
        background:linear-gradient(135deg, rgba(12,23,32,.9), rgba(18,20,28,.84));
        box-shadow:0 16px 36px rgba(0,0,0,.42),0 0 22px rgba(112,198,255,.14);
        animation:battleToastIn 2.8s ease both; color:#fff; font-weight:800;
      }
      .battleToast small{display:block;color:rgba(255,255,255,.66);font-weight:600;margin-top:3px;}
      .battleToast.attack{border-color:rgba(255,100,120,.55);box-shadow:0 0 24px rgba(255,80,100,.18);}
      .battleToast.heal{border-color:rgba(120,242,184,.55);box-shadow:0 0 24px rgba(120,242,184,.18);}
      .battleToast.move{border-color:rgba(112,198,255,.55);}
      @keyframes battleToastIn{0%{opacity:0;transform:translateY(-12px) scale(.98)}10%,78%{opacity:1;transform:none}100%{opacity:0;transform:translateY(-8px)}}
      body.journeyMini .journeyFab{opacity:.62}
      body.journeyMini .journeyFab .label{display:none}
      @media(max-width:720px){
        .journeyFab{right:10px;bottom:10px;min-height:40px;padding:8px 11px;font-size:12px}
        .journeyPanel{right:10px;bottom:58px;padding:12px;border-radius:15px}
        .journeyCards{grid-template-columns:1fr}
        .battleToastRail{top:58px}
        .journeyStrip{font-size:12px;padding:8px 10px}
      }
    `;
    document.head.appendChild(style);
  }

  function makePanel() {
    if (document.getElementById("journeyFab")) return;
    const done = readDone();
    const fab = document.createElement("button");
    fab.id = "journeyFab";
    fab.className = "journeyFab";
    fab.type = "button";
    fab.innerHTML = `<span class="dot"></span><span class="label">次の一手</span>`;

    const panel = document.createElement("aside");
    panel.id = "journeyPanel";
    panel.className = "journeyPanel";
    panel.innerHTML = `
      <div class="journeyHead">
        <div>
          <b>TTCG ナビ</b>
          <small>${esc(pageMeta.title)} / ${esc(pageMeta.goal)}</small>
        </div>
        <div>
          <button class="journeyMini" type="button" title="小さく表示">・</button>
          <button class="journeyClose" type="button" title="閉じる">×</button>
        </div>
      </div>
      <div class="journeyHero">
        <span class="tag">脳死でカードゲーム、してませんか。</span>
        <h3>運だけで終わらせない、盤面で勝つカードゲーム。</h3>
        <p>カードを引くだけでなく、配置・射程・属性・育成で勝ち筋を作る。迷ったら下の順で触ると全体像がつかめます。</p>
      </div>
      <div class="journeyList">
        ${steps.map((s, i) => `
          <div class="journeyStep ${done[s.id] ? "done" : ""}" data-journey-step="${esc(s.id)}">
            <button class="check" type="button" title="完了切替">${done[s.id] ? "✓" : i + 1}</button>
            <div><b>${esc(s.label)}</b><span>${esc(s.hint)}</span></div>
            <a href="${esc(s.href)}">開く</a>
          </div>
        `).join("")}
      </div>
      <div class="journeyCards">
        <div class="journeyCard"><b>バトル中</b><span>ログを短く要約して、攻撃・回復・移動の見落としを減らします。</span></div>
        <div class="journeyCard"><b>デッキ構築</b><span>30枚、役割、属性、平均コストを意識して勝ち筋を作ります。</span></div>
        <div class="journeyCard"><b>育成</b><span>YOUカードは毎日少しずつ伸ばす長期目標です。</span></div>
        <div class="journeyCard"><b>工房</b><span>カード追加はテーマ・シリーズを決めると後で整理しやすいです。</span></div>
      </div>
    `;

    document.body.append(fab, panel);

    const setOpen = (open) => {
      panel.classList.toggle("open", open);
      localStorage.setItem(LS_OPEN, open ? "1" : "0");
      if (open) localStorage.setItem(LS_SEEN, VERSION);
    };

    fab.addEventListener("click", () => setOpen(!panel.classList.contains("open")));
    panel.querySelector(".journeyClose")?.addEventListener("click", () => setOpen(false));
    panel.querySelector(".journeyMini")?.addEventListener("click", () => {
      document.body.classList.toggle("journeyMini");
      localStorage.setItem(LS_MINI, document.body.classList.contains("journeyMini") ? "1" : "0");
    });
    panel.addEventListener("click", (ev) => {
      const check = ev.target.closest(".check");
      if (!check) return;
      const step = check.closest("[data-journey-step]")?.dataset?.journeyStep;
      if (!step) return;
      const d = readDone();
      d[step] = !d[step];
      writeDone(d);
      const row = check.closest(".journeyStep");
      row.classList.toggle("done", d[step]);
      check.textContent = d[step] ? "✓" : String(steps.findIndex((x) => x.id === step) + 1);
    });

    if (localStorage.getItem(LS_MINI) === "1") document.body.classList.add("journeyMini");
    const autoOpen = !localStorage.getItem(LS_SEEN) && ["home", "deck", "battle"].includes(pageMeta.key);
    setOpen(localStorage.getItem(LS_OPEN) === "1" || autoOpen);
  }

  function addStrip(target, html, pos = "afterbegin") {
    if (!target || target.querySelector?.(".journeyStrip")) return;
    const wrap = document.createElement("div");
    wrap.className = "journeyStrip";
    wrap.innerHTML = html;
    target.insertAdjacentElement(pos, wrap);
    return wrap;
  }

  function enhanceDeck() {
    const panel = document.querySelector("#deckList")?.closest(".panel") || document.querySelector("#deckList") || document.querySelector("main");
    const countEl = document.getElementById("deckCount");
    const strip = addStrip(panel, `
      <b>構築ガイド</b>
      <span>30枚で保存・対戦OK。偏りは強みだけど、役割不足は警戒。</span>
      <span class="journeyPill" data-journey-deck-count>枚数 ${esc(countEl?.textContent || "0")}/30</span>
      <a class="journeyBtn" href="./rule.html">初心者はこちら</a>
    `);
    if (!strip || !countEl) return;
    const pill = strip.querySelector("[data-journey-deck-count]");
    const sync = () => {
      const n = String(countEl.textContent || "0").trim();
      if (pill) {
        pill.textContent = `枚数 ${n}/30`;
        pill.classList.toggle("good", n === "30");
      }
    };
    new MutationObserver(sync).observe(countEl, { childList: true, characterData: true, subtree: true });
    sync();
  }

  function enhanceHome() {
    const host = document.querySelector(".deckStartLeft") || document.querySelector("#deckStart") || document.querySelector("main") || document.body;
    addStrip(host, `
      <b>今日の流れ</b>
      <span class="journeyPill">1 デッキ確認</span>
      <span class="journeyPill">2 ソロ練習</span>
      <span class="journeyPill">3 報酬と育成</span>
      <a class="journeyBtn" href="./rule.html">TTCGを読む</a>
    `);
  }

  function enhanceProfile() {
    const you = document.querySelector(".youBox") || document.getElementById("youCardBox")?.parentElement;
    addStrip(you, `
      <b>YOU育成方針</b>
      <span class="journeyPill">HPは耐久</span>
      <span class="journeyPill">SPは技の粘り</span>
      <span class="journeyPill">技ガチャは役割追加</span>
      <span>迷ったらHP/SPを10刻みで整えてから技を増やす。</span>
    `);
  }

  function enhanceGacha() {
    const host = document.querySelector("main") || document.body;
    addStrip(host, `
      <b>ガチャ方針</b>
      <span class="journeyPill">闇鍋: 全カード</span>
      <span class="journeyPill">時織: テーマ狙い</span>
      <span class="journeyPill">童話: キャラ狙い</span>
      <span>10連はGrowth Ptも貯まるので、YOU育成にもつながる。</span>
    `);
  }

  function enhanceCreator() {
    const host = document.querySelector("main") || document.body;
    addStrip(host, `
      <b>カード作成チェック</b>
      <span class="journeyPill">シリーズ</span>
      <span class="journeyPill">属性</span>
      <span class="journeyPill">技テンプレ</span>
      <span class="journeyPill">ガチャ/初期分類</span>
      <span>技は共通テンプレ化すると後から調整しやすい。</span>
    `);
  }

  function enhanceRule() {
    const host = document.querySelector(".hero") || document.querySelector("main") || document.body;
    addStrip(host, `
      <b>読む順番</b>
      <span class="journeyPill">勝利条件</span>
      <span class="journeyPill">マナ</span>
      <span class="journeyPill">射程</span>
      <span class="journeyPill">状態異常</span>
      <span>分からない単語は下の検索から。</span>
    `, "afterend");
  }

  function enhanceMatch() {
    const host = document.querySelector("main") || document.body;
    addStrip(host, `
      <b>対戦準備</b>
      <span class="journeyPill">マップ確認</span>
      <span class="journeyPill">30枚確認</span>
      <span class="journeyPill">READY</span>
      <span>不利なマップならデッキの移動力と射程を見直す。</span>
    `);
  }

  function classifyLog(line) {
    if (/回復|heal|HP\+|SP\+|💚/.test(line)) return "heal";
    if (/移動|move|swap|ノックバック|入れ替え/.test(line)) return "move";
    if (/召喚|進化/.test(line)) return "move";
    if (/ダメージ|攻撃|ROLL|失敗|成功|撃破|破壊|HP-|SP-|💔|💙/.test(line)) return "attack";
    return "";
  }

  function summarizeLog(line) {
    const s = String(line || "").replace(/\s+/g, " ").trim();
    if (!s) return null;
    if (s.length <= 80) return s;
    return s.slice(0, 78) + "…";
  }

  function enhanceBattle() {
    const host = document.getElementById("leftPane") || document.body;
    addStrip(host, `
      <b>操作ガイド</b>
      <span class="journeyPill">ユニット選択</span>
      <span class="journeyPill">技選択</span>
      <span class="journeyPill">対象マス</span>
      <span>迷ったら右側の詳細とログを開く。</span>
    `);

    const rail = document.createElement("div");
    rail.className = "battleToastRail";
    document.body.appendChild(rail);

    const log = document.getElementById("log");
    if (!log) return;
    let last = "";
    const pushToast = (line) => {
      const text = summarizeLog(line);
      if (!text || text === last) return;
      last = text;
      const toast = document.createElement("div");
      toast.className = `battleToast ${classifyLog(text)}`;
      toast.innerHTML = `${esc(text)}<small>戦況ログ</small>`;
      rail.appendChild(toast);
      setTimeout(() => toast.remove(), 2900);
      while (rail.children.length > 3) rail.firstElementChild?.remove();
    };
    const readLatest = () => {
      const lines = String(log.textContent || "").split(/\n+/).map((x) => x.trim()).filter(Boolean);
      if (lines.length) pushToast(lines[lines.length - 1]);
    };
    new MutationObserver(readLatest).observe(log, { childList: true, characterData: true, subtree: true });
  }

  function bootEnhancements() {
    if (is("index.html")) enhanceHome();
    if (path === "deck.html" || path === "index.html" || path === "") enhanceDeck();
    if (path === "game.html") enhanceBattle();
    if (path === "profile.html") enhanceProfile();
    if (path === "gacha.html") enhanceGacha();
    if (path === "creator.html") enhanceCreator();
    if (path === "rule.html") enhanceRule();
    if (path === "match_intro.html") enhanceMatch();
  }

  function boot() {
    injectCss();
    makePanel();
    bootEnhancements();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();

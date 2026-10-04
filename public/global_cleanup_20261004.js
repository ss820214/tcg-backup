(() => {
  "use strict";

  const VERSION = "20261004_cleanup1";
  const STYLE_ID = "tcgGlobalCleanup20261004Style";
  let scheduled = false;

  const $ = (id) => document.getElementById(id);
  const page = (location.pathname.split("/").pop() || "index.html").toLowerCase();

  function setText(el, value) {
    if (el && el.textContent !== value) el.textContent = value;
  }

  function setPlaceholder(el, value) {
    if (el && el.getAttribute("placeholder") !== value) el.setAttribute("placeholder", value);
  }

  function injectStyle() {
    if ($(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      /* The old home concept/about card is intentionally retired. */
      .deckStartConcept { display:none !important; }

      /* Deck block headings: always read from the left edge. */
      .libraryPanel > .hd,
      #deckPanel > .hd,
      .panelHdText,
      .deckSaveDockHead,
      .deckSaveDockHeadMain,
      .deckInfoDockHead,
      .deckInfoDockHeadMain,
      .libraryPanel .listHead,
      #deckPanel .listHead {
        text-align:left !important;
      }
      .panelHdText,
      .deckSaveDockHeadMain,
      .deckInfoDockHeadMain {
        justify-items:start !important;
        align-items:start !important;
      }
      .panelHdText > b,
      .panelHdText > span,
      .deckSaveDockHeadMain > b,
      .deckSaveDockHeadMain > span,
      .deckInfoDockHeadMain > b,
      .deckInfoDockHeadMain > span {
        text-align:left !important;
        margin-left:0 !important;
        margin-right:auto !important;
      }

      /* Slightly larger interlocking route gears. */
      .tcgGearA {
        width:clamp(180px,46vmin,390px) !important;
      }
      .tcgGearB {
        width:clamp(162px,41vmin,345px) !important;
      }
    `;
    document.head.appendChild(style);
  }

  function removeOldConcept() {
    document.querySelectorAll(".deckStartConcept").forEach((el) => el.remove());
  }

  function normalizeDeckHeadings() {
    const library = document.querySelector(".libraryPanel");
    const deck = $("deckPanel");
    if (!library || !deck) return;

    const libraryHead = library.querySelector(":scope > .hd .panelHdText");
    setText(libraryHead?.querySelector("b"), "カード一覧・検索");
    setText(libraryHead?.querySelector(".small, span"), "カードを探してデッキへ追加");

    const deckHead = deck.querySelector(":scope > .hd .panelHdText");
    setText(deckHead?.querySelector("b"), "編集中デッキ");
    setText(deckHead?.querySelector(".small, span"), "採用カード・枚数・保存を管理");

    const libraryListHead = library.querySelector(".listHead > b");
    setText(libraryListHead, "検索・絞り込み");

    setText($("deckSaveDock")?.querySelector(".deckSaveDockHeadMain > b"), "デッキ保存");
    setText($("deckSaveDock")?.querySelector(".deckSaveDockHeadMain > span"), "名前を付けて保存・呼び出し");
    setText($("deckInfoDock")?.querySelector(".deckInfoDockHeadMain > b"), "採用カード一覧");
    setText($("deckInfoDock")?.querySelector(".deckInfoDockHeadMain > span"), "30枚になるように調整");
    setText($("deckInfoDock")?.querySelector(".listHead > b"), "デッキ内カード");
  }

  function normalizeProfile() {
    if (page !== "profile.html") return;
    document.title = "0BATo - ユーザー";

    setText(document.querySelector("header h1"), "ユーザー情報");
    setText(document.querySelector("header .sub"), "所持カード、ジェム、対戦履歴");
    setText($("btnDeck"), "デッキ");
    setText($("btnGacha"), "ガチャ");
    setText($("btnReload"), "更新");
    setText($("btnCopyUid"), "UIDコピー");

    const panels = [...document.querySelectorAll("main.grid > section.panel")];
    setText(panels[0]?.querySelector(":scope > h2"), "プロフィール");
    setText(panels[1]?.querySelector(":scope > h2"), "YOUカード育成");

    const statLabels = ["UID", "ジェム", "Growth Pt", "所持種類", "所持合計枚数", "対戦数", "勝利", "敗北"];
    document.querySelectorAll(".stats .stat .label").forEach((el, index) => {
      if (statLabels[index]) setText(el, statLabels[index]);
    });

    setText($("btnYouSkill1"), "技1ガチャ");
    setText($("btnYouSkill2"), "技2ガチャ");
    setText($("btnYouSkill3"), "技3ガチャ");
    setText($("btnYouAbility"), "特殊ガチャ");

    const search = $("search");
    if (search) {
      setPlaceholder(search, "カード名 / ID / レアリティ");
      const toolbar = search.closest(".toolbar");
      const heading = toolbar?.querySelector("h2");
      if (heading) {
        if (heading.contains(search)) toolbar.insertBefore(search, heading.nextSibling);
        setText(heading, "所持カード");
      }
    }

    const history = $("history");
    setText(history?.closest("section.panel")?.querySelector(":scope > h2"), "最近の対戦履歴");

    const admin = $("adminPanel");
    setText(admin?.querySelector(":scope > h2"), "管理者メニュー");
    setPlaceholder($("adminTargetUid"), "UID / プレイヤー名");
    setPlaceholder($("adminGemAmount"), "ジェム数");
    setPlaceholder($("adminPityAmount"), "強化Pt数");
    setPlaceholder($("adminCardId"), "カードID");
    setPlaceholder($("adminReason"), "理由 / memo");
    setText($("btnGrantGems"), "ジェム配布");
    setText($("btnGrantPity"), "強化Pt配布");
    setText($("btnGrantCard"), "指定カード配布");
  }

  function normalizeGacha() {
    if (page !== "gacha.html") return;
    document.title = "0BATo - ガチャ";
    setText(document.querySelector(".brand h1"), "ガチャ");
    setText(document.querySelector(".brand .sub"), "テーマ別バナーとレア演出");
    setText(document.querySelector(".grid > .panel:first-child > h2"), "ガチャ選択");

    const stamp = $("bannerStamp");
    if (stamp && /[遒邇繝繧縺窶]/.test(stamp.textContent || "")) setText(stamp, "SSR 3%");
    const mini = $("miniInfo");
    if (mini && /窶/.test(mini.textContent || "")) setText(mini, "準備中…");
    const big = $("revealBig");
    if (big && /窶/.test(big.textContent || "")) setText(big, "…");
    const sub = $("revealSub");
    if (sub && /窶/.test(sub.textContent || "")) setText(sub, "…");
    const status = $("statusTag");
    if (status && /[繝繧縺窶遒邇]/.test(status.textContent || "")) setText(status, "状態: -");
  }

  function apply() {
    injectStyle();
    removeOldConcept();
    normalizeDeckHeadings();
    normalizeProfile();
    normalizeGacha();
    document.documentElement.dataset.uiCleanup = VERSION;
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      apply();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", apply, { once: true });
  } else {
    apply();
  }

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener("pageshow", (event) => {
    apply();
    // The deck/home is highly visual and was occasionally restored from an old BFCache snapshot.
    // On a genuine back-forward cache restore, refresh once so the current assets win.
    if (event.persisted && (page === "index.html" || page === "deck.html" || page === "")) {
      location.reload();
    }
  });

  window.TCG_UI_CLEANUP = { version: VERSION, refresh: apply };
  console.log("[global_cleanup] ready", VERSION);
})();

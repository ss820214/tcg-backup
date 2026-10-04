(() => {
  "use strict";

  const VERSION = "20261004_cleanup2";
  const STYLE_ID = "tcgGlobalCleanup20261004Style";
  const UTF8 = new TextDecoder("utf-8", { fatal: true });
  let scheduled = false;
  let sjisReverse = null;

  const $ = (id) => document.getElementById(id);
  const page = (location.pathname.split("/").pop() || "index.html").toLowerCase();

  function setText(el, value) {
    if (el && el.textContent !== value) el.textContent = value;
  }

  function setPlaceholder(el, value) {
    if (el && el.getAttribute("placeholder") !== value) el.setAttribute("placeholder", value);
  }

  function mojibakeScore(value) {
    const text = String(value || "");
    const hits = text.match(/[繧繝縺蜿謇螟荳譁驟遒邇窶莠逕蟇蜊闔髣驪螻謗蛯]/g);
    return (hits?.length || 0) + ((text.match(/�/g) || []).length * 4);
  }

  function getSjisReverseMap() {
    if (sjisReverse) return sjisReverse;
    const map = new Map();
    let decoder;
    try {
      decoder = new TextDecoder("shift_jis");
    } catch {
      sjisReverse = map;
      return map;
    }

    const add = (bytes) => {
      const decoded = decoder.decode(Uint8Array.from(bytes));
      if (!decoded || decoded.includes("�")) return;
      if (!map.has(decoded)) map.set(decoded, bytes);
    };

    for (let b = 0x00; b <= 0x7f; b += 1) add([b]);
    for (let b = 0xa1; b <= 0xdf; b += 1) add([b]);
    const leads = [];
    for (let b = 0x81; b <= 0x9f; b += 1) leads.push(b);
    for (let b = 0xe0; b <= 0xfc; b += 1) leads.push(b);
    for (const lead of leads) {
      for (let trail = 0x40; trail <= 0xfc; trail += 1) {
        if (trail === 0x7f) continue;
        add([lead, trail]);
      }
    }
    sjisReverse = map;
    return map;
  }

  function reverseShiftJisBytes(value) {
    const map = getSjisReverseMap();
    if (!map.size) return null;
    const bytes = [];
    for (const ch of String(value || "")) {
      const code = ch.codePointAt(0);
      if (code <= 0x7f) {
        bytes.push(code);
        continue;
      }
      const part = map.get(ch);
      if (!part) return null;
      bytes.push(...part);
    }
    return bytes;
  }

  function cleanRecoveredMarkup(value) {
    return String(value || "")
      .replace(/\/(?:h[1-6]|div|span|label|option|button|b|p|section|header|small)>/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  function recoverMojibake(value) {
    const original = String(value || "");
    const before = mojibakeScore(original);
    if (before < 2) return original;
    try {
      const bytes = reverseShiftJisBytes(original);
      if (!bytes) return original;
      const decoded = cleanRecoveredMarkup(UTF8.decode(Uint8Array.from(bytes)));
      if (!decoded) return original;
      const after = mojibakeScore(decoded);
      if (after <= Math.max(0, before - 2)) return decoded;
    } catch {
      // Mixed encodings are left untouched; page-specific fixes below handle key labels.
    }
    return original;
  }

  function repairMojibakeInDocument() {
    const root = document.body;
    if (!root) return;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (parent.closest("script,style,noscript,textarea,pre,code")) return NodeFilter.FILTER_REJECT;
        return mojibakeScore(node.nodeValue) >= 2
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT;
      },
    });

    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      const next = recoverMojibake(node.nodeValue);
      if (next !== node.nodeValue) node.nodeValue = next;
    }

    const attrs = ["placeholder", "title", "aria-label"];
    document.querySelectorAll("[placeholder],[title],[aria-label]").forEach((el) => {
      for (const name of attrs) {
        const value = el.getAttribute(name);
        if (!value || mojibakeScore(value) < 2) continue;
        const next = recoverMojibake(value);
        if (next !== value) el.setAttribute(name, next);
      }
    });

    if (mojibakeScore(document.title) >= 2) {
      document.title = recoverMojibake(document.title);
    }
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
    if (stamp && mojibakeScore(stamp.textContent) >= 2) setText(stamp, "SSR 3%");
    const mini = $("miniInfo");
    if (mini && /窶/.test(mini.textContent || "")) setText(mini, "準備中…");
    const big = $("revealBig");
    if (big && /窶/.test(big.textContent || "")) setText(big, "…");
    const sub = $("revealSub");
    if (sub && /窶/.test(sub.textContent || "")) setText(sub, "…");
    const status = $("statusTag");
    if (status && mojibakeScore(status.textContent) >= 2) setText(status, "状態: -");
  }

  function normalizeArcade() {
    if (page !== "arcade.html") return;
    document.title = "0BATo - アーケード";
    setText(document.querySelector("header h1"), "アーケードモード");
    setText(document.querySelector("header .sub"), "30枚デッキから部隊を選び、5ラウンド突破を目指す短期戦");
    setText($("btnDeck"), "デッキへ");
    setText($("btnProfile"), "ユーザー");

    const setup = document.querySelector(".panel.setup");
    setText(setup?.querySelector(":scope > h2"), "ラン設定");
    const rewards = { easy: 120, normal: 200, hard: 350 };
    document.querySelectorAll("#difficulty [data-diff]").forEach((btn) => {
      const diff = btn.dataset.diff;
      const status = btn.querySelector(".status");
      if (status && rewards[diff]) setText(status, `報酬 ${rewards[diff]}`);
    });
    setText($("btnStart"), "ラン開始");
    setText($("btnNext"), "次のラウンド");

    const panels = [...document.querySelectorAll("main.grid > section.panel")];
    const battle = panels[1];
    setText(battle?.querySelector(":scope > h2"), "戦場");
    const teamHeads = battle ? [...battle.querySelectorAll(".teams h2")] : [];
    setText(teamHeads[0], "自軍");
    setText(teamHeads[1], "敵軍");
    setText(document.querySelector('label[for="actorSelect"]'), "自軍");
    setText(document.querySelector('label[for="actionSelect"]'), "技");
    setText(document.querySelector('label[for="targetSelect"]'), "対象");
    setText($("btnRoll"), "ダイスロール");
    setText(panels[2]?.querySelector(":scope > h2"), "ログ");
  }

  function normalizeCreator() {
    if (page !== "creator.html") return;
    document.title = "0BATo - カード工房";
    setText(document.querySelector("header h1"), "カード工房");
    setText(document.querySelector("header .sub"), "テーマ・技・カードを作成してゲームへ反映");
    setText($("btnSyncNow"), "同期");
    setText($("btnDeck"), "デッキへ");
    setText($("btnProfile"), "ユーザー");
    setText($("tabTheme"), "テーマ");
    setText($("tabCard"), "カード");
    setText($("tabSkill"), "技");
  }

  function apply() {
    injectStyle();
    repairMojibakeInDocument();
    removeOldConcept();
    normalizeDeckHeadings();
    normalizeProfile();
    normalizeGacha();
    normalizeArcade();
    normalizeCreator();
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
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });

  window.addEventListener("pageshow", (event) => {
    apply();
    // The deck/home is highly visual and was occasionally restored from an old BFCache snapshot.
    // On a genuine back-forward cache restore, refresh once so the current assets win.
    if (event.persisted && (page === "index.html" || page === "deck.html" || page === "")) {
      location.reload();
    }
  });

  window.TCG_UI_CLEANUP = {
    version: VERSION,
    refresh: apply,
    recoverText: recoverMojibake,
  };
  console.log("[global_cleanup] ready", VERSION);
})();

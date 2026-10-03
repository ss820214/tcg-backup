(() => {
  "use strict";

  const VERSION = "20260801_screen_nav_mobile1";
  const page = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  const $ = (id) => document.getElementById(id);

  const PAGE_INFO = {
    "index.html": { title: "初期画面", documentTitle: "0BATo - 初期画面" },
    "deck.html": { title: "デッキ編成", documentTitle: "0BATo - デッキ編成" },
    "battle.html": { title: "対戦待機", documentTitle: "0BATo - 対戦待機" },
    "game.html": { title: "バトル", documentTitle: "0BATo - バトル" },
    "gacha.html": { title: "ガチャ", documentTitle: "0BATo - ガチャ" },
    "profile.html": { title: "ユーザー", documentTitle: "0BATo - ユーザー" },
    "creator.html": { title: "カード工房", documentTitle: "0BATo - カード工房" },
    "card_editor.html": { title: "カード編集", documentTitle: "0BATo - カード編集" },
    "arcade.html": { title: "アーケード", documentTitle: "0BATo - アーケード" },
    "rule.html": { title: "ルール", documentTitle: "0BATo - ルール" },
    "tutorial.html": { title: "チュートリアル", documentTitle: "0BATo - チュートリアル" },
    "tier.html": { title: "ティア表", documentTitle: "0BATo - ティア表" },
    "victory.html": { title: "リザルト", documentTitle: "0BATo - リザルト" },
    "match_intro.html": { title: "開始演出", documentTitle: "0BATo - 開始演出" },
  };

  const isHome = page === "" || page === "index.html";

  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    } else {
      fn();
    }
  }

  function injectCss() {
    if ($("tcgUiPolishCss")) return;
    const style = document.createElement("style");
    style.id = "tcgUiPolishCss";
    style.textContent = `
      :root {
        --tcg-blue: #67b7ff;
        --tcg-cyan: #6ee8ff;
        --tcg-green: #6ff0ac;
        --tcg-gold: #ffd86b;
        --tcg-red: #ff6680;
        --tcg-panel: rgba(11, 17, 27, .76);
        --tcg-line: rgba(255,255,255,.13);
      }

      body.tcg-ui-polish {
        text-rendering: optimizeLegibility;
      }

      body.has-tcg-route-strip {
        padding-top: 58px;
      }

      .tcg-route-strip {
        position: fixed;
        inset: 0 0 auto 0;
        z-index: 2147482000;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        min-height: 58px;
        padding: 9px 18px;
        border-bottom: 1px solid rgba(111, 240, 172, .18);
        background:
          radial-gradient(circle at 18% 0%, rgba(103,183,255,.18), transparent 32%),
          linear-gradient(90deg, rgba(10,15,24,.96), rgba(13,28,24,.95));
        box-shadow: 0 12px 34px rgba(0,0,0,.32);
        backdrop-filter: blur(14px);
      }

      .tcg-route-title {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
        color: rgba(255,255,255,.94);
        font-weight: 900;
        letter-spacing: 0;
      }

      .tcg-route-title::before {
        content: "";
        width: 9px;
        height: 26px;
        border-radius: 999px;
        background: linear-gradient(180deg, var(--tcg-cyan), var(--tcg-green));
        box-shadow: 0 0 18px rgba(111,240,172,.55);
      }

      .tcg-route-sub {
        color: rgba(255,255,255,.58);
        font-size: 12px;
        font-weight: 600;
      }

      .tcg-route-actions {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 8px;
        flex-wrap: wrap;
      }

      .tcg-route-btn,
      .tcg-polish-chip {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 7px;
        min-height: 34px;
        padding: 7px 12px;
        border: 1px solid rgba(255,255,255,.14);
        border-radius: 999px;
        background: linear-gradient(180deg, rgba(255,255,255,.10), rgba(255,255,255,.035));
        color: rgba(255,255,255,.92);
        font: inherit;
        font-size: 12px;
        font-weight: 900;
        white-space: nowrap;
        cursor: pointer;
        box-shadow: inset 0 1px 0 rgba(255,255,255,.08);
      }

      .tcg-route-btn:hover,
      .tcg-polish-chip.good {
        border-color: rgba(111,240,172,.45);
        background: linear-gradient(180deg, rgba(111,240,172,.18), rgba(111,240,172,.055));
      }

      .tcg-route-btn.primary {
        border-color: rgba(103,183,255,.45);
        background: linear-gradient(180deg, rgba(103,183,255,.22), rgba(103,183,255,.08));
      }

      .tcg-polish-chip.warn {
        border-color: rgba(255,216,107,.48);
        background: linear-gradient(180deg, rgba(255,216,107,.16), rgba(255,216,107,.045));
      }

      .tcg-polish-chip.bad {
        border-color: rgba(255,102,128,.48);
        background: linear-gradient(180deg, rgba(255,102,128,.15), rgba(255,102,128,.045));
      }

      /* Battle readability */
      body.tcg-battle-polish #dice {
        border: 1px solid rgba(255,255,255,.12);
        border-radius: 12px;
        background:
          linear-gradient(135deg, rgba(103,183,255,.12), rgba(111,240,172,.06)),
          rgba(0,0,0,.32);
        box-shadow: inset 0 1px 0 rgba(255,255,255,.08);
        padding: 10px 12px;
        white-space: pre-wrap;
        line-height: 1.35;
      }

      body.tcg-battle-polish #actionPicker {
        border-color: rgba(103,183,255,.22) !important;
        box-shadow: 0 0 0 1px rgba(103,183,255,.08), inset 0 1px 0 rgba(255,255,255,.05);
      }

      body.tcg-battle-polish .tcgBattleGuide {
        margin: 8px 0;
        padding: 10px 12px;
        border: 1px solid rgba(103,183,255,.2);
        border-radius: 12px;
        background:
          radial-gradient(circle at 10% 0%, rgba(103,183,255,.17), transparent 36%),
          rgba(0,0,0,.22);
        color: rgba(255,255,255,.84);
        font-size: 12px;
        line-height: 1.5;
      }

      /* Deck builder: keep the deck side legible instead of busy */
      body.tcg-deck-polish #deckPanel,
      body.tcg-deck-polish #deckMainPanel {
        box-shadow: 0 0 0 1px rgba(111,240,172,.10), 0 18px 54px rgba(0,0,0,.28);
      }

      body.tcg-deck-polish #deckList .cardRow,
      body.tcg-deck-polish #deckList > div {
        scroll-margin: 90px;
      }

      body.tcg-deck-polish #deckPanel .deckSectionHeader,
      body.tcg-deck-polish #deckMainPanel .hd {
        position: sticky;
        top: 0;
        z-index: 8;
        backdrop-filter: blur(14px);
      }

      /* Gacha reveal and result summary */
      .gachaSummary {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        margin: 12px 0;
        padding: 10px;
        border: 1px solid rgba(255,255,255,.12);
        border-radius: 14px;
        background:
          linear-gradient(135deg, rgba(103,183,255,.10), rgba(255,216,107,.06)),
          rgba(0,0,0,.22);
      }

      .gachaSummary .gachaSummaryTitle {
        font-weight: 900;
        margin-right: 2px;
      }

      .gachaSummary .rar-ur { color: #ff6b7a; }
      .gachaSummary .rar-ssr { color: #ffd86b; }
      .gachaSummary .rar-sr { color: #74ffb6; }
      .gachaSummary .rar-r { color: #7cc6ff; }

      .overlay.on:not(.revealed) .gachaSpinCard {
        animation:
          tcgCardFallIn .72s cubic-bezier(.18,.92,.18,1) both,
          tcgCardSpin var(--spin-speed, 900ms) linear infinite,
          tcgCardAura 1.1s ease-in-out infinite;
        animation-delay: var(--spin-delay, 0ms), calc(var(--spin-delay, 0ms) + 160ms), calc(var(--spin-delay, 0ms) + 160ms);
      }

      .overlay.on:not(.revealed) .gachaSpinCard.r { --aura: rgba(77,166,255,.78); }
      .overlay.on:not(.revealed) .gachaSpinCard.sr { --aura: rgba(90,255,170,.78); }
      .overlay.on:not(.revealed) .gachaSpinCard.ssr { --aura: rgba(255,216,107,.88); }
      .overlay.on:not(.revealed) .gachaSpinCard.ur { --aura: rgba(255,80,112,.9); }

      @keyframes tcgCardFallIn {
        from { opacity: 0; transform: translateY(-90px) rotateX(65deg) scale(.82); }
        to { opacity: 1; transform: translateY(0) rotateX(0deg) scale(1); }
      }

      @keyframes tcgCardSpin {
        0% { transform: rotateY(0deg) rotateZ(-1deg); }
        50% { transform: rotateY(180deg) rotateZ(1deg); }
        100% { transform: rotateY(360deg) rotateZ(-1deg); }
      }

      @keyframes tcgCardAura {
        0%, 100% { box-shadow: 0 0 12px var(--aura), 0 0 34px rgba(255,255,255,.06); filter: brightness(1); }
        50% { box-shadow: 0 0 26px var(--aura), 0 0 62px var(--aura); filter: brightness(1.23); }
      }

      /* Creator safety */
      .creatorGuard {
        margin: 10px 0 0;
        padding: 10px 12px;
        border: 1px solid rgba(255,255,255,.13);
        border-radius: 12px;
        background: rgba(0,0,0,.24);
        color: rgba(255,255,255,.82);
        font-size: 12px;
        line-height: 1.55;
        white-space: pre-wrap;
      }
      .creatorGuard.good { border-color: rgba(111,240,172,.32); color: rgba(185,255,215,.95); }
      .creatorGuard.warn { border-color: rgba(255,216,107,.34); color: rgba(255,235,165,.95); }
      .creatorGuard.bad { border-color: rgba(255,102,128,.36); color: rgba(255,165,180,.96); }
      .creatorInvalid {
        outline: 2px solid rgba(255,102,128,.55) !important;
        outline-offset: 2px;
      }

      @media (max-width: 820px) {
        body.has-tcg-route-strip {
          padding-top: 52px;
        }

        .tcg-route-strip {
          min-height: 52px;
          padding: 7px 10px;
          gap: 8px;
        }

        .tcg-route-sub {
          display: none;
        }

        .tcg-route-btn {
          min-height: 31px;
          padding: 6px 9px;
          font-size: 11px;
        }

        body.tcg-deck-polish .wrap {
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) !important;
          gap: 10px !important;
        }

        body.tcg-deck-polish .libraryPanel,
        body.tcg-deck-polish #deckPanel,
        body.tcg-deck-polish #deckMainPanel {
          min-height: auto !important;
          max-height: none !important;
          position: relative !important;
          top: auto !important;
        }

        body.tcg-deck-polish #cardList.list {
          max-height: 45vh !important;
          overflow: auto !important;
        }

        body.tcg-deck-polish #deckList.list {
          max-height: 48vh !important;
          overflow: auto !important;
        }

        body.tcg-deck-polish #cardList .cardRow,
        body.tcg-deck-polish #deckList .cardRow {
          min-height: 56px !important;
          padding: 8px 10px !important;
        }

        body.tcg-deck-polish #cardList .cardRow .name,
        body.tcg-deck-polish #deckList .cardRow .name {
          font-size: 12px !important;
          line-height: 1.25 !important;
        }

        body.tcg-battle-polish .tcgBattleGuide,
        body.tcg-battle-polish #dice {
          font-size: 11px;
          padding: 8px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function routeUrl(file) {
    const url = new URL(file, location.href);
    const here = new URLSearchParams(location.search);
    ["player", "room", "field"].forEach((key) => {
      const value = here.get(key);
      if (value && !url.searchParams.has(key)) url.searchParams.set(key, value);
    });
    return url.href;
  }

  function go(file) {
    location.href = routeUrl(file);
  }

  function ensureRouteStrip() {
    if (isHome || page === "game.html" || $("tcgRouteStrip")) return;
    const info = PAGE_INFO[page] || { title: "0BATo", documentTitle: "0BATo" };
    const strip = document.createElement("div");
    strip.id = "tcgRouteStrip";
    strip.className = "tcg-route-strip";
    strip.innerHTML = `
      <div class="tcg-route-title">
        <span>${info.title}</span>
        <span class="tcg-route-sub">0BATo navigation</span>
      </div>
      <div class="tcg-route-actions">
        <button class="tcg-route-btn primary" type="button" data-route="./index.html">初期画面</button>
        <button class="tcg-route-btn" type="button" data-route="./index.html#deck">デッキ</button>
        <button class="tcg-route-btn" type="button" data-route="./profile.html">ユーザー</button>
        <button class="tcg-route-btn" type="button" data-route="./gacha.html">ガチャ</button>
        <button class="tcg-route-btn" type="button" data-route="./creator.html">工房</button>
      </div>
    `;
    strip.addEventListener("click", (ev) => {
      const btn = ev.target.closest("[data-route]");
      if (!btn) return;
      go(btn.dataset.route);
    });
    document.body.prepend(strip);
    document.body.classList.add("has-tcg-route-strip");
  }

  function normalizeTitle() {
    const info = PAGE_INFO[page];
    if (info?.documentTitle) document.title = info.documentTitle;
  }

  function text(el, value) {
    if (el) el.textContent = value;
  }

  function labelFor(id, value) {
    const el = $(id);
    if (!el) return;
    const parent = el.closest("label") || el.parentElement;
    const label = parent?.querySelector(":scope > label") || parent?.previousElementSibling;
    if (label && /^(LABEL|DIV|SPAN)$/i.test(label.tagName)) label.textContent = value;
  }

  function normalizeNum(id, fallback = 0) {
    const n = Number(($(id)?.value || "").trim());
    return Number.isFinite(n) ? n : fallback;
  }

  function normalizeProfile() {
    const header = document.querySelector("h1");
    text(header, "ユーザー情報");
    const sub = document.querySelector(".sub");
    if (sub) sub.textContent = "所持カード、ジェム、対戦履歴";
    text($("btnDeck"), "デッキ");
    text($("btnGacha"), "ガチャ");
    text($("btnReload"), "更新");
    text($("btnCopyUid"), "UIDコピー");
    text($("btnGrantGems"), "ジェム配布");
    text($("btnGrantPity"), "強化Pt配布");
    text($("btnGrantCard"), "指定カード配布");
    const adminTitle = $("adminPanel")?.querySelector("h2");
    if (adminTitle) adminTitle.textContent = "管理者メニュー";
    if ($("adminTargetUid")) $("adminTargetUid").placeholder = "UID / プレイヤー名";
    if ($("adminGemAmount")) $("adminGemAmount").placeholder = "ジェム数";
    if ($("adminPityAmount")) $("adminPityAmount").placeholder = "強化Pt数";
    if ($("adminCardId")) $("adminCardId").placeholder = "カードID";
    if ($("adminReason")) $("adminReason").placeholder = "理由 memo";
  }

  function normalizeCreator() {
    const h1 = document.querySelector("h1");
    text(h1, "カード工房");
    const sub = document.querySelector(".sub");
    if (sub) sub.textContent = "管理者用。テーマを決めて、技テンプレからカードを作る。";
    text($("tabTheme"), "テーマ");
    text($("tabCard"), "カード");
    text($("tabSkill"), "技");
    text($("btnSyncNow"), "同期");
    text($("btnDeck"), "デッキへ");
    text($("btnProfile"), "ユーザー");
    text($("btnAutoCardId"), "ID自動");
    text($("btnBalanceCard"), "診断");
    text($("btnNewCard"), "新規");
    text($("btnDuplicateCard"), "複製");
    text($("btnSaveCard"), "カード保存");
    text($("btnAutoSkillId"), "ID自動");
    text($("btnNewSkill"), "新規");
    text($("btnSaveSkill"), "技保存");
    text($("btnDeleteSkill"), "技削除");
    text($("btnCopySkillCsv"), "CSVコピー");

    const labels = {
      cardId: "カードID",
      cardName: "カード名",
      cardKind: "種別",
      rarity: "レア度",
      attr: "属性",
      cost: "コスト",
      hp: "HP",
      sp: "SP",
      theme: "テーマ",
      seriesPreset: "追加先シリーズ",
      series: "シリーズ表示",
      desc: "説明",
      actionSearch: "技テンプレ選択（キャラ用）",
      extraJson: "追加JSON（任意）",
      skillId: "技ID",
      skillName: "技名",
      skillCost: "コスト",
      skillRate: "成功率",
      skillRange: "射程",
      skillStatus: "追加状態",
      skillStatusValue: "状態値 / ターン",
      skillDraw: "ドロー",
      skillHandEffect: "手札効果",
      skillHandTarget: "手札効果の対象",
      skillHandCount: "手札効果の枚数",
      skillBoardEffect: "盤面効果",
      skillKnockback: "ノックバック距離",
      skillTags: "タグ",
      skillExtraJson: "追加JSON（任意）",
    };
    Object.entries(labels).forEach(([id, label]) => labelFor(id, label));

    const skillHead = document.querySelector("#skillPanel aside .hd b");
    if (skillHead) skillHead.textContent = "技リスト / JSON";
    enhanceCreatorGuard();
  }

  function creatorIssues(mode) {
    const issues = [];
    const warnings = [];
    if (mode === "skill") {
      const id = ($("skillId")?.value || "").trim();
      const name = ($("skillName")?.value || "").trim();
      const range = ($("skillRange")?.value || "").trim();
      const rate = normalizeNum("skillRate", 0);
      const cost = normalizeNum("skillCost", -1);
      const hp = normalizeNum("skillHpDelta", 0);
      const sp = normalizeNum("skillSpDelta", 0);
      const draw = normalizeNum("skillDraw", 0);
      const status = ($("skillStatus")?.value || "").trim();
      const hand = ($("skillHandEffect")?.value || "").trim();
      const extra = ($("skillExtraJson")?.value || "").trim();
      if (!id) issues.push("技IDが空です。");
      if (!name) issues.push("技名が空です。");
      if (!range) issues.push("射程が空です。");
      if (cost < 0 || cost > 12) issues.push("技コストは0〜12にしてください。");
      if (rate <= 0 || rate > 100) issues.push("成功率は1〜100にしてください。");
      if (!hp && !sp && !draw && !status && !hand && !extra) {
        warnings.push("効果が空に見えます。HP/SP変化、ドロー、状態、手札効果などを確認してください。");
      }
    } else {
      const id = ($("cardId")?.value || "").trim();
      const name = ($("cardName")?.value || "").trim();
      const kind = ($("cardKind")?.value || "unit").trim();
      const cost = normalizeNum("cost", -1);
      const hp = normalizeNum("hp", 0);
      const sp = normalizeNum("sp", 0);
      const series = ($("series")?.value || "").trim();
      if (!id) issues.push("カードIDが空です。");
      if (!name) issues.push("カード名が空です。");
      if (cost < 0 || cost > 12) issues.push("コストは0〜12にしてください。");
      if (!series) warnings.push("追加先シリーズが空です。初期カード、時織カード、ガチャカードなどを入れると後で探しやすいです。");
      if (kind === "unit") {
        if (hp <= 0 || sp <= 0) issues.push("ユニットはHP/SPを1以上にしてください。");
        if (hp % 10 !== 0 || sp % 10 !== 0) warnings.push("このゲームはステータス10刻み推奨です。");
      }
      if (kind === "support" && (hp || sp)) {
        warnings.push("サポートはHP/SPを表示に使わないため、効果欄を確認してください。");
      }
    }
    return { issues, warnings };
  }

  function ensureGuard(id, beforeId) {
    let guard = $(id);
    if (guard) return guard;
    guard = document.createElement("div");
    guard.id = id;
    guard.className = "creatorGuard";
    $(beforeId)?.parentNode?.insertBefore(guard, $(beforeId));
    return guard;
  }

  function enhanceCreatorGuard() {
    const cardGuard = ensureGuard("cardSaveGuard", "cardMsg");
    const skillGuard = ensureGuard("skillSaveGuard", "skillMsg");

    const paint = (mode) => {
      const { issues, warnings } = creatorIssues(mode);
      const guard = mode === "skill" ? skillGuard : cardGuard;
      if (!guard) return;
      guard.className = "creatorGuard " + (issues.length ? "bad" : warnings.length ? "warn" : "good");
      guard.textContent = issues.length
        ? "保存前チェック\n" + issues.concat(warnings).join("\n")
        : warnings.length
          ? "確認ポイント\n" + warnings.join("\n")
          : "保存前チェック OK";
    };

    const markInvalid = (mode) => {
      document.querySelectorAll(".creatorInvalid").forEach((el) => el.classList.remove("creatorInvalid"));
      const { issues } = creatorIssues(mode);
      if (!issues.length) return false;
      const ids = mode === "skill"
        ? ["skillId", "skillName", "skillRange", "skillCost", "skillRate"]
        : ["cardId", "cardName", "cost", "hp", "sp"];
      ids.forEach((id) => $(id)?.classList.add("creatorInvalid"));
      return true;
    };

    $("btnSaveCard")?.addEventListener("click", (ev) => {
      if (!markInvalid("card")) return;
      ev.preventDefault();
      ev.stopImmediatePropagation();
      paint("card");
    }, true);

    $("btnSaveSkill")?.addEventListener("click", (ev) => {
      if (!markInvalid("skill")) return;
      ev.preventDefault();
      ev.stopImmediatePropagation();
      paint("skill");
    }, true);

    document.addEventListener("input", (ev) => {
      if (!(ev.target instanceof HTMLElement)) return;
      if (ev.target.id?.startsWith("skill")) paint("skill");
      if (["cardId", "cardName", "cardKind", "cost", "hp", "sp", "series"].includes(ev.target.id)) paint("card");
    });
    document.addEventListener("change", () => {
      paint("card");
      paint("skill");
    });
    paint("card");
    paint("skill");
  }

  function normalizeGacha() {
    const h1 = document.querySelector("h1");
    text(h1, "ガチャ");
    const sub = document.querySelector(".brand .sub");
    if (sub) sub.textContent = "テーマ別バナーとレア演出";
    text($("btnBack"), "← 戻る");
    text($("btnClear"), "表示クリア");
    text($("btnRevealSkip"), "演出スキップ");
    text($("btnUnitBanner"), "排出対象");
    text($("btnSupportBanner"), "サポートは闇鍋限定");
    enhanceGachaSummary();
  }

  function enhanceGachaSummary() {
    const grid = $("resultGrid");
    if (!grid) return;

    let summary = $("gachaSummary");
    if (!summary) {
      summary = document.createElement("div");
      summary.id = "gachaSummary";
      summary.className = "gachaSummary";
      summary.setAttribute("aria-live", "polite");
      grid.parentNode?.insertBefore(summary, grid);
    }

    const render = () => {
      const cards = [...grid.querySelectorAll(".card, .reward, .resultCard")];
      if (!cards.length) {
        summary.innerHTML = `
          <span class="gachaSummaryTitle">結果</span>
          <span class="tcg-polish-chip">ガチャ後にここへ内訳を表示</span>
        `;
        return;
      }
      const counts = { UR: 0, SSR: 0, SR: 0, R: 0, NEW: 0 };
      for (const card of cards) {
        const raw = (card.querySelector(".rar, .rarity, [data-rarity]")?.textContent || card.dataset.rarity || "R").trim().toUpperCase();
        const rar = raw.includes("UR") ? "UR" : raw.includes("SSR") ? "SSR" : raw.includes("SR") ? "SR" : "R";
        counts[rar] += 1;
        if (card.textContent.includes("NEW") || card.querySelector(".new")) counts.NEW += 1;
      }
      summary.innerHTML = `
        <span class="gachaSummaryTitle">結果</span>
        <span class="tcg-polish-chip rar-ur">UR ${counts.UR}</span>
        <span class="tcg-polish-chip rar-ssr">SSR ${counts.SSR}</span>
        <span class="tcg-polish-chip rar-sr">SR ${counts.SR}</span>
        <span class="tcg-polish-chip rar-r">R ${counts.R}</span>
        <span class="tcg-polish-chip ${counts.NEW ? "good" : ""}">NEW ${counts.NEW}</span>
      `;
    };
    new MutationObserver(render).observe(grid, { childList: true, subtree: true });
    render();
  }

  function normalizeBattle() {
    document.body.classList.add("tcg-battle-polish");
    const action = $("actionPicker");
    if (action && !$("tcgBattleGuide")) {
      const guide = document.createElement("div");
      guide.id = "tcgBattleGuide";
      guide.className = "tcgBattleGuide";
      guide.textContent = "操作ガイド: ユニットを選ぶ → 技を選ぶ → 対象マスを選ぶ。迷ったら詳細とログを閉じて盤面を広く使えます。";
      action.parentNode?.insertBefore(guide, action);
    }
  }

  function normalizeDeck() {
    document.body.classList.add("tcg-deck-polish");
    text($("btnSettings"), "ルーム");
    text($("btnSolo"), "ソロ開始");
    text($("btnSave"), "保存");
    text($("btnClearDeck"), "全消し");
    const version = $("deckVersionPill") || $("versionLabel");
    if (version && version.textContent.includes("v202607")) version.textContent = "v20260801 nav/mobile";
  }

  function normalizeLobby() {
    text($("readyBtn"), "準備完了");
    text($("pingBtn"), "打ち返す！");
    text($("pingResetBtn"), "リセット");
  }

  ready(() => {
    injectCss();
    document.body.classList.add("tcg-ui-polish", `tcg-page-${page.replace(/[^a-z0-9]/g, "-")}`, VERSION);
    normalizeTitle();
    ensureRouteStrip();

    if (page === "profile.html") normalizeProfile();
    if (page === "creator.html" || page === "card_editor.html") normalizeCreator();
    if (page === "gacha.html") normalizeGacha();
    if (page === "game.html") normalizeBattle();
    if (page === "battle.html") normalizeLobby();
    if (page === "index.html" || page === "deck.html" || page === "") normalizeDeck();
  });
})();

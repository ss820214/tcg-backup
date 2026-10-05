(() => {
  "use strict";
  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyBAJV-VyGb9Wujnlmcihuqrh3Z9ejiH87c",
    authDomain: "tcg-0bato.firebaseapp.com",
    projectId: "tcg-0bato",
  };
  const COLLECTIONS = [
    ["cards", "unit"],
    ["support_cards", "support"],
    ["supports", "support"],
    ["supportCards", "support"],
    ["ex_support_cards", "support"],
    ["ex_supports", "support"],
    ["exSupportCards", "support"],
    ["ex_support", "support"],
  ];
  let defsPromise = null;
  let textHelpers = null;

  function putMap(out, source, sourceKind = "") {
    if (!source) return;
    const add = (key, d) => {
      if (!d || typeof d !== "object") return;
      const id = String(d.id || d.cardId || key || "").trim();
      if (!id) return;
      out[id] = sourceKind && !d.__deckSourceKind ? { ...d, __deckSourceKind: sourceKind } : d;
    };
    if (Array.isArray(source)) source.forEach((d) => add("", d));
    else if (typeof source === "object") Object.entries(source).forEach(([key, d]) => add(key, d));
  }

  async function loadDefs() {
    if (defsPromise) return defsPromise;
    defsPromise = (async () => {
      try {
        const [appMod, fsMod, fairyMod, jewelMod, starterMod, actionMod, supportMod] = await Promise.all([
          import("https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js"),
          import("https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js"),
          import("./fairy_tale_cards.js?v=20260726_fairy_rate_down1"),
          import("./jewel_cards.js?v=20260828_jewel_art1"),
          import("./starter_support_cards.js?v=20260706_starter_support_all1"),
          import("./action_text.js?v=20260827_jewel1"),
          import("./support_text.js?v=20260827_jewel1"),
        ]);
        textHelpers = { actionMod, supportMod };
        const app = appMod.getApps().length ? appMod.getApps()[0] : appMod.initializeApp(FIREBASE_CONFIG);
        const db = fsMod.getFirestore(app);
        const out = {};
        putMap(out, starterMod.STARTER_SUPPORT_CARD_MAP, "support");
        putMap(out, fairyMod.FAIRY_TALE_CARDS);
        putMap(out, jewelMod.JEWEL_CARDS);
        const remote = await Promise.all(COLLECTIONS.map(async ([name, sourceKind]) => {
          try {
            const snap = await fsMod.getDocs(fsMod.collection(db, name));
            const map = {};
            snap.forEach((doc) => {
              const d = doc.data() || {};
              const id = String(d.id || doc.id || "").trim();
              if (id) map[id] = { ...d, __deckSourceKind: sourceKind };
            });
            return map;
          } catch {
            return {};
          }
        }));
        remote.forEach((m) => Object.assign(out, m));
        return out;
      } catch (err) {
        console.warn("[deck skills] card definitions could not be loaded", err);
        return {};
      }
    })();
    return defsPromise;
  }

  function kindText(def) {
    return [def?.__deckSourceKind, def?.kind, def?.type, def?.cardType, def?.category]
      .filter(Boolean).map((v) => String(v).toLowerCase()).join(" ");
  }

  function isSupport(def) {
    const k = kindText(def);
    if (/support|サポート|ex_support/.test(k)) return true;
    if (/unit|character|char|キャラ/.test(k)) return false;
    return !Array.isArray(def?.actions) && def?.effect != null;
  }

  function cleanSimpleText(value) {
    return String(value || "")
      .replace(/[\uFE0E\uFE0F]/g, "")
      .replace(/[🎯🛡️💥💨👟😌🦴🩸🙈🦨📌💢🔗⏭️↩️🔒🃏🧠🟣✨❤️💙💚🩵🔷➡]/gu, "")
      .replace(/\s+/g, " ")
      .replace(/\s*\/\s*/g, " / ")
      .trim();
  }

  function actionParts(action) {
    try { return textHelpers?.actionMod?.actionDetailPartsJa?.(action) || {}; }
    catch { return {}; }
  }

  function arrowRange(action) {
    try {
      return cleanSimpleText(textHelpers?.actionMod?.rangeToArrowJa?.(action?.range || ""));
    } catch {
      return "";
    }
  }

  function actionEffectSummary(action, parts) {
    const out = [];
    if (Number(parts?.hpDmg) > 0) out.push(`HPダメージ${parts.hpDmg}`);
    if (Number(parts?.spDmg) > 0) out.push(`SPダメージ${parts.spDmg}`);
    if (Number(parts?.hpHeal) > 0) out.push(`HP回復${parts.hpHeal}`);
    if (Number(parts?.spHeal) > 0) out.push(`SP回復${parts.spHeal}`);
    const extra = cleanSimpleText(parts?.effectText || "");
    if (extra && !out.includes(extra)) out.push(extra);
    if (!out.length) {
      try {
        const fallback = cleanSimpleText(textHelpers?.actionMod?.actionEffectTextJa?.(action));
        if (fallback) out.push(fallback);
      } catch {}
    }
    return [...new Set(out.filter(Boolean))].join(" / ");
  }

  function actionLine(action, index) {
    if (!action) return "";
    const parts = actionParts(action);
    const rawCost = parts?.cost ?? action.cost ?? 0;
    const cost = Number.isFinite(Number(rawCost)) ? Number(rawCost) : rawCost;
    const name = String(parts?.name || action.name || action.label || action.actionName || "").trim() || "名称なし";
    const range = arrowRange(action);
    const effect = actionEffectSummary(action, parts);
    return `行動${index + 1}: 【${cost}】${name}${range ? ` ${range}` : ""}${effect ? ` ${effect}` : ""}`;
  }

  function supportEffectLine(def) {
    let text = "";
    try { text = cleanSimpleText(textHelpers?.supportMod?.supportEffectTextJa?.(def?.effect)); }
    catch {}
    if (!text) text = cleanSimpleText(def?.effectText || def?.description || def?.text || def?.desc || "");
    if (!text && Array.isArray(def?.actions) && def.actions[0]) {
      const parts = actionParts(def.actions[0]);
      text = actionEffectSummary(def.actions[0], parts) || cleanSimpleText(parts?.name || def.actions[0]?.name || "");
    }
    return text ? `効果: ${text}` : "効果: なし";
  }

  function statText(def) {
    const out = [];
    if (def?.hp !== undefined && def?.hp !== null && def?.hp !== "") out.push(`HP:${def.hp}`);
    if (def?.sp !== undefined && def?.sp !== null && def?.sp !== "") out.push(`SP:${def.sp}`);
    return out.join(" ");
  }

  function titleOf(row) {
    return row.querySelector(":scope > .name, .cardHead > div:first-child > b, :scope > div:first-child > .name");
  }

  function cleanTypeSuffix(title) {
    if (!title) return;
    [...title.childNodes].forEach((node) => {
      if (node.nodeType !== Node.TEXT_NODE) return;
      node.textContent = String(node.textContent || "").replace(/\s+(?:UNIT|Unit|unit|ユニット|キャラ|サポート|サポ)\s*$/g, "");
    });
  }

  function setStats(row, def, support) {
    const title = titleOf(row);
    if (!title) return;
    cleanTypeSuffix(title);
    let el = title.querySelector(".mobileInlineStats");
    const next = support ? "" : statText(def);
    if (!next) {
      el?.remove();
      return;
    }
    if (!el) {
      el = document.createElement("span");
      el.className = "mobileInlineStats";
      title.appendChild(el);
    }
    if (el.textContent !== next) el.textContent = next;
  }

  function setLines(row, lines) {
    let box = row.querySelector(".mobileSkillLines");
    if (!box) {
      box = document.createElement("div");
      box.className = "mobileSkillLines";
      const title = titleOf(row);
      (title?.parentElement || row.firstElementChild || row).appendChild(box);
    }
    box.dataset.skillSource = "carddef";
    const normalized = lines.filter(Boolean).slice(0, 2);
    const key = normalized.join("\n");
    if (box.dataset.renderKey === key) return;
    box.dataset.renderKey = key;
    box.replaceChildren(...normalized.map((line) => {
      const div = document.createElement("div");
      div.className = "mobileSkillLine";
      div.textContent = line;
      return div;
    }));
  }

  function applyRow(row, defs) {
    const id = String(row?.dataset?.cardId || "").trim();
    if (!id) return;
    const def = defs[id];
    if (!def) return;
    const support = isSupport(def);
    setStats(row, def, support);
    if (support) {
      setLines(row, [supportEffectLine(def)]);
      return;
    }
    const actions = Array.isArray(def?.actions) ? def.actions.filter(Boolean).slice(0, 2) : [];
    setLines(row, actions.length ? actions.map((a, i) => actionLine(a, i)) : ["行動1: なし"]);
  }

  async function applyAll() {
    const defs = await loadDefs();
    document.querySelectorAll("#cardList .cardRow,#deckList .cardRow").forEach((row) => applyRow(row, defs));
  }

  function boot() {
    const start = () => applyAll();
    if ("requestIdleCallback" in window) window.requestIdleCallback(start, { timeout: 500 });
    else setTimeout(start, 0);
    const observer = new MutationObserver((records) => {
      const needed = records.some((record) => [...record.addedNodes].some((node) => node instanceof Element && (node.matches?.(".cardRow") || node.querySelector?.(".cardRow"))));
      if (needed) requestAnimationFrame(() => applyAll());
    });
    [document.getElementById("cardList"), document.getElementById("deckList")].filter(Boolean)
      .forEach((el) => observer.observe(el, { childList:true, subtree:true }));
    window.addEventListener("pageshow", () => requestAnimationFrame(() => applyAll()));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once:true });
  else boot();
})();

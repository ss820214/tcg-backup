(() => {
  "use strict";
  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyBAJV-VyGb9Wujnlmcihuqrh3Z9ejiH87c",
    authDomain: "tcg-0bato.firebaseapp.com",
    projectId: "tcg-0bato",
  };
  const COLLECTIONS = [
    "cards",
    "support_cards",
    "supports",
    "supportCards",
    "ex_support_cards",
    "ex_supports",
    "exSupportCards",
    "ex_support",
  ];
  let defsPromise = null;
  let textHelpers = null;

  function putMap(out, source) {
    if (!source) return;
    if (Array.isArray(source)) {
      source.forEach((d) => {
        const id = String(d?.id || d?.cardId || "").trim();
        if (id) out[id] = d;
      });
      return;
    }
    if (typeof source === "object") {
      Object.entries(source).forEach(([key, d]) => {
        if (!d || typeof d !== "object") return;
        const id = String(d.id || d.cardId || key || "").trim();
        if (id) out[id] = d;
      });
    }
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
        putMap(out, starterMod.STARTER_SUPPORT_CARD_MAP);
        putMap(out, fairyMod.FAIRY_TALE_CARDS);
        putMap(out, jewelMod.JEWEL_CARDS);

        const remote = await Promise.all(COLLECTIONS.map(async (name) => {
          try {
            const snap = await fsMod.getDocs(fsMod.collection(db, name));
            const map = {};
            snap.forEach((doc) => {
              const d = doc.data() || {};
              const id = String(d.id || doc.id || "").trim();
              if (id) map[id] = d;
            });
            return map;
          } catch {
            return {};
          }
        }));
        remote.forEach((m) => Object.assign(out, m));
        return out;
      } catch (err) {
        console.warn("[deck skills6] card definitions could not be loaded", err);
        return {};
      }
    })();
    return defsPromise;
  }

  function actionLabel(action) {
    if (!action) return "";
    let name = "";
    try {
      const parts = textHelpers?.actionMod?.actionDetailPartsJa?.(action);
      name = String(parts?.name || action.name || action.label || action.actionName || action.id || "").trim();
    } catch {
      name = String(action.name || action.label || action.actionName || action.id || "").trim();
    }
    return name ? `技: ${name}` : "技";
  }

  function skillText(def) {
    const acts = Array.isArray(def?.actions) ? def.actions.filter(Boolean).slice(0, 2) : [];
    if (acts.length) return acts.map(actionLabel).filter(Boolean).join(" / ");
    if (def?.effect) {
      try {
        const text = textHelpers?.supportMod?.supportEffectTextJa?.(def.effect);
        if (text) return `効果: ${text}`;
      } catch {}
    }
    return "技・効果なし";
  }

  function applyRow(row, defs) {
    const id = String(row?.dataset?.cardId || "").trim();
    if (!id) return;
    const def = defs[id];
    if (!def) return;
    const box = row.querySelector(".mobileSkillLines");
    if (!box) return;
    box.textContent = skillText(def);
    box.dataset.skillSource = "carddef";
  }

  async function applyAll() {
    const defs = await loadDefs();
    document.querySelectorAll("#cardList .cardRow,#deckList .cardRow").forEach((row) => applyRow(row, defs));
  }

  function boot() {
    const start = () => applyAll();
    if ("requestIdleCallback" in window) window.requestIdleCallback(start, { timeout: 900 });
    else setTimeout(start, 0);

    const observer = new MutationObserver((records) => {
      if (!records.some((r) => r.type === "childList" && r.addedNodes.length)) return;
      requestAnimationFrame(() => applyAll());
    });
    [document.getElementById("cardList"), document.getElementById("deckList")]
      .filter(Boolean)
      .forEach((el) => observer.observe(el, { childList:true, subtree:true }));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once:true });
  else boot();
})();

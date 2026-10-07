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

  const STATUS_SPRITE_URL = "./assets/status_marks/status_icons_sprite_20261007.webp?v=20261007_icons1";
  const STATUS_VISUALS = [
    { keys:["命中増加","hitUp","aim"], sprite:0, label:"命中増加" },
    { keys:["命中DOWN","jinx"], sprite:1, label:"命中DOWN" },
    { keys:["装甲","アーマー","armor"], sprite:2, label:"アーマー" },
    { keys:["攻撃増加","パワーUP","powerUp","power"], sprite:3, label:"パワーUP" },
    { keys:["回避","evade"], sprite:4, label:"回避" },
    { keys:["疲労回復","recoverFatigue","fatigue"], sprite:5, label:"疲労回復" },
    { keys:["パニック","panic"], sprite:6, label:"パニック" },
    { keys:["骨折","fracture"], sprite:7, label:"骨折" },
    { keys:["出血","bleed"], sprite:8, label:"出血" },
    { keys:["毒","poison"], sprite:9, label:"毒" },
    { keys:["盲目","blind"], sprite:10, label:"盲目" },
    { keys:["におい","匂い","smell"], sprite:11, label:"におい" },
    { keys:["失魂","lostSoul"], sprite:12, label:"失魂" },
    { keys:["封印","seal"], sprite:13, label:"封印" },
    { keys:["激怒","rage"], sprite:14, label:"激怒" },
    { keys:["洗脳","brainwash"], sprite:15, label:"洗脳" },
    { keys:["ヘドロ","sludge"], sprite:16, label:"ヘドロ" },
    { keys:["カウンター","counter"], sprite:17, label:"カウンター" },
    { keys:["タイマン","taiman"], sprite:18, label:"タイマン" },
    { keys:["ノックバック","knockback"], sprite:19, label:"ノックバック" },
    { keys:["貫通","pierce"], glyph:"📌", label:"貫通" },
    { keys:["範囲","aoe"], glyph:"💢", label:"範囲" },
    { keys:["コンボ","combo"], glyph:"🔗", label:"コンボ" },
    { keys:["追撃","followUp"], glyph:"⏭", label:"追撃" },
  ];

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
      .replace(/[\uFE0E]/g, "")
      .replace(/[🎯🛡️💥💨👟😌🦴🩸🙈🦨📌💢🔗⏭️↩️🔒🃏🧠🟣✨🔷➡]/gu, "")
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
      return cleanSimpleText(textHelpers?.actionMod?.rangeToArrowJa?.(action?.range || ""))
        .replace(/\s*\+\s*/g, " ")
        .trim();
    } catch {
      return "";
    }
  }

  function compactVitals(text) {
    return String(text || "")
      .replace(/❤(?!️)/g, "❤️")
      .replace(/💚/g, "❤️")
      .replace(/🩵/g, "💙")
      .replace(/HP\s*ダメージ\s*([+-]?\d+)/gi, "❤️-$1")
      .replace(/SP\s*ダメージ\s*([+-]?\d+)/gi, "💙-$1")
      .replace(/HP\s*(?:回復|ヒール)\s*([+-]?\d+)/gi, "❤️+$1")
      .replace(/SP\s*(?:回復|ヒール)\s*([+-]?\d+)/gi, "💙+$1")
      .replace(/\bHP\s*[:：]?\s*([+-]\d+)/gi, "❤️$1")
      .replace(/\bSP\s*[:：]?\s*([+-]\d+)/gi, "💙$1")
      .replace(/❤️--/g, "❤️-")
      .replace(/💙--/g, "💙-")
      .replace(/❤️-\+/g, "❤️-")
      .replace(/💙-\+/g, "💙-")
      .replace(/❤️\+-/g, "❤️-")
      .replace(/💙\+-/g, "💙-")
      .replace(/❤️\+\+/g, "❤️+")
      .replace(/💙\+\+/g, "💙+")
      .replace(/\s+/g, " ")
      .trim();
  }

  function visualMatches(text) {
    const src = String(text || "");
    const matches = [];
    STATUS_VISUALS.forEach((meta) => {
      meta.keys.forEach((key) => {
        let from = 0;
        while (from < src.length) {
          const at = src.toLowerCase().indexOf(String(key).toLowerCase(), from);
          if (at < 0) break;
          matches.push({ start:at, end:at + String(key).length, meta });
          from = at + String(key).length;
        }
      });
    });
    matches.sort((a,b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
    const picked = [];
    let cursor = -1;
    matches.forEach((m) => {
      if (m.start < cursor) return;
      picked.push(m);
      cursor = m.end;
    });
    return picked;
  }

  function appendStatusVisual(host, meta) {
    const span = document.createElement("span");
    span.className = "deckStatusVisual";
    span.title = meta.label;
    span.setAttribute("aria-label", meta.label);
    if (Number.isInteger(meta.sprite)) {
      const col = meta.sprite % 5;
      const row = Math.floor(meta.sprite / 5);
      span.classList.add("deckStatusSprite");
      span.style.backgroundImage = `url("${STATUS_SPRITE_URL}")`;
      span.style.backgroundSize = "80px 64px";
      span.style.backgroundPosition = `${-col * 16}px ${-row * 16}px`;
      span.style.backgroundRepeat = "no-repeat";
    } else {
      span.classList.add("deckStatusGlyph");
      span.textContent = meta.glyph || "•";
    }
    host.appendChild(span);
  }

  function renderRichText(host, text) {
    const src = compactVitals(text);
    const matches = visualMatches(src);
    if (!matches.length) {
      host.appendChild(document.createTextNode(src));
      return;
    }
    let pos = 0;
    matches.forEach((m) => {
      if (m.start > pos) host.appendChild(document.createTextNode(src.slice(pos, m.start)));
      appendStatusVisual(host, m.meta);
      pos = m.end;
    });
    if (pos < src.length) host.appendChild(document.createTextNode(src.slice(pos)));
  }

  function actionEffectSummary(action, parts) {
    const out = [];
    if (Number(parts?.hpDmg) > 0) out.push(`❤️-${parts.hpDmg}`);
    if (Number(parts?.spDmg) > 0) out.push(`💙-${parts.spDmg}`);
    if (Number(parts?.hpHeal) > 0) out.push(`❤️+${parts.hpHeal}`);
    if (Number(parts?.spHeal) > 0) out.push(`💙+${parts.spHeal}`);
    const extra = compactVitals(cleanSimpleText(parts?.effectText || ""));
    if (extra && !out.includes(extra)) out.push(extra);
    if (!out.length) {
      try {
        const fallback = compactVitals(cleanSimpleText(textHelpers?.actionMod?.actionEffectTextJa?.(action)));
        if (fallback) out.push(fallback);
      } catch {}
    }
    return [...new Set(out.filter(Boolean))].join(" ");
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
    try { text = compactVitals(cleanSimpleText(textHelpers?.supportMod?.supportEffectTextJa?.(def?.effect))); }
    catch {}
    if (!text) text = compactVitals(cleanSimpleText(def?.effectText || def?.description || def?.text || def?.desc || ""));
    if (!text && Array.isArray(def?.actions) && def.actions[0]) {
      const parts = actionParts(def.actions[0]);
      text = actionEffectSummary(def.actions[0], parts) || cleanSimpleText(parts?.name || def.actions[0]?.name || "");
    }
    return text ? `効果: ${text}` : "効果: なし";
  }

  function statText(def) {
    const out = [];
    if (def?.hp !== undefined && def?.hp !== null && def?.hp !== "") out.push(`❤️${def.hp}`);
    if (def?.sp !== undefined && def?.sp !== null && def?.sp !== "") out.push(`💙${def.sp}`);
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
      renderRichText(div, line);
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

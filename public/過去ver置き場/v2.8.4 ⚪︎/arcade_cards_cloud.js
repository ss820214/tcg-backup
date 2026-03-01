// public/arcade_cards_cloud.js
// v20260212_arcade_cards_cloud
//
// Firestore の "cards" コレクションからカード定義をロードして返す。
// game.jsの loadCards() / normalizeAllCardDefs() と同等の役割。

import { collection, getDocs } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

export async function loadCardsFromCloud(db) {
  const snap = await getDocs(collection(db, "cards"));
  const m = {};
  snap.forEach((d) => (m[d.id] = d.data()));
  normalizeAllCardDefs(m);
  return m;
}

function normalizeActionsForDef(def) {
  const actsRaw = def?.actions;
  if (!Array.isArray(actsRaw)) return;

  const keyOf = (a) =>
    [
      String(a?.name ?? ""),
      String(a?.cost ?? ""),
      String(a?.range ?? ""),
      String(a?.dmg ?? a?.damage ?? ""),
      String(a?.heal ?? ""),
      String(a?.hpDelta ?? ""),
      String(a?.spDelta ?? ""),
      String(a?.dmgType ?? a?.damageType ?? ""),
      String(a?.rate ?? a?.successRate ?? a?.hitRate ?? a?.prob ?? a?.p ?? ""),
    ].join("|");

  const seen = new Set();
  const out = [];
  for (const a of actsRaw) {
    const k = keyOf(a);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(a);
  }
  def.actions = out;
}

function normalizeAllCardDefs(cardDefs) {
  for (const id of Object.keys(cardDefs || {})) {
    const d = cardDefs[id];
    if (!d || typeof d !== "object") continue;
    normalizeActionsForDef(d);
  }
}

export function cardName(cardDefs, cardId) {
  return cardDefs?.[cardId]?.name || cardId;
}

export function isSupportCardDef(def) {
  // game.js では isSupportCard(def) を support_core.js から import してるが
  // arcade側は「kind === 'support'」でも動くように吸う
  const k = String(def?.kind ?? def?.type2 ?? def?.cardKind ?? "").toLowerCase();
  if (k === "support") return true;
  const name = String(def?.kind ?? "").toLowerCase();
  if (name === "support") return true;
  // cards定義が support_core 仕様なら kind='support' のはず
  return false;
}
// public/solo_debug.js
// v20260214
// Soloモード用のデバッグパネル（game.jsから動的importされる）

import {
  onSnapshot,
  doc,
  runTransaction,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

function el(tag, attrs = {}, children = []) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === "style" && v && typeof v === "object") Object.assign(e.style, v);
    else if (k.startsWith("on") && typeof v === "function")
      e.addEventListener(k.slice(2), v);
    else if (v != null) e.setAttribute(k, String(v));
  }
  for (const c of children) {
    if (c == null) continue;
    if (typeof c === "string") e.appendChild(document.createTextNode(c));
    else e.appendChild(c);
  }
  return e;
}

function ensurePanel() {
  let wrap = document.getElementById("soloDebugPanel");
  if (wrap) return wrap;

  wrap = el("div", {
    id: "soloDebugPanel",
    style: {
      position: "fixed",
      right: "10px",
      bottom: "10px",
      width: "360px",
      maxHeight: "52vh",
      overflow: "auto",
      zIndex: 99999,
      background: "rgba(10,10,10,.92)",
      color: "#fff",
      border: "1px solid rgba(255,255,255,.16)",
      borderRadius: "12px",
      padding: "10px",
      fontFamily:
        "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
      fontSize: "12px",
      boxShadow: "0 10px 40px rgba(0,0,0,.45)",
    },
  });

  const header = el(
    "div",
    { style: { display: "flex", gap: "8px", alignItems: "center" } },
    [
      el("div", { style: { fontWeight: "900", letterSpacing: ".02em" } }, [
        "🧪 SOLO DEBUG",
      ]),
      el(
        "div",
        { style: { opacity: ".75", marginLeft: "auto", fontSize: "11px" } },
        ["(solo only)"],
      ),
    ],
  );

  const btnRow = el(
    "div",
    { style: { display: "flex", gap: "6px", margin: "8px 0" } },
    [],
  );

  const consoleRow = el(
    "div",
    {
      style: {
        display: "flex",
        gap: "6px",
        margin: "6px 0 8px",
        flexWrap: "wrap",
      },
    },
    [],
  );

  const statusLine = el(
    "div",
    {
      id: "soloDebugStatus",
      style: {
        opacity: ".8",
        fontSize: "11px",
        margin: "0 0 8px",
        whiteSpace: "pre-wrap",
      },
    },
    [""],
  );

  const btn = (label, onClick) =>
    el(
      "button",
      {
        style: {
          padding: "6px 8px",
          borderRadius: "10px",
          border: "1px solid rgba(255,255,255,.18)",
          background: "rgba(255,255,255,.08)",
          color: "#fff",
          cursor: "pointer",
          fontSize: "12px",
        },
        onclick: onClick,
        type: "button",
      },
      [label],
    );

  const content = el("pre", {
    id: "soloDebugText",
    style: {
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
      margin: "0",
      padding: "8px",
      borderRadius: "10px",
      background: "rgba(255,255,255,.06)",
      border: "1px solid rgba(255,255,255,.12)",
    },
  });

  // 表示ON/OFF
  let visible = true;
  const toggleBtn = btn("表示切替", () => {
    visible = !visible;
    content.style.display = visible ? "block" : "none";
  });

  // JSONコピー
  const copyBtn = btn("JSONコピー", async () => {
    try {
      const t = content.textContent || "";
      await navigator.clipboard.writeText(t);
    } catch {}
  });

  // close（removeせず非表示にする。game.js側の状態も同期）
const closeBtn = btn("閉じる", () => {
  // ✅ removeしない。非表示にするだけ。
  wrap.style.display = "none";

  // ✅ game.js側の状態も同期（あれば）
  try {
    window.__soloConsoleVisible = false;
  } catch {}
});

  btnRow.appendChild(toggleBtn);
  btnRow.appendChild(copyBtn);
  btnRow.appendChild(closeBtn);

  wrap.appendChild(header);
  wrap.appendChild(btnRow);
  wrap.appendChild(consoleRow);
  wrap.appendChild(statusLine);
  wrap.appendChild(content);

  document.body.appendChild(wrap);
  return wrap;
}

// =====================
// Solo debug console helpers
// =====================
function setStatus(msg) {
  const el = document.getElementById("soloDebugStatus");
  if (!el) return;
  el.textContent = String(msg ?? "");
}

function oppSeat(seat) {
  const s = String(seat || "").toUpperCase();
  return s === "A" ? "B" : s === "B" ? "A" : null;
}

async function txState(stateRef, mutator) {
  if (!stateRef) return;
  try {
    await runTransaction(stateRef.firestore, async (tx) => {
      const snap = await tx.get(stateRef);
      if (!snap.exists()) return;
      const st = snap.data() || {};
      const next = mutator(st) || st;
      tx.set(stateRef, next, { merge: true });
    });
  } catch (e) {
    setStatus(`❌ tx failed: ${String(e?.message ?? e)}`);
  }
}

function clampInt(n, lo, hi) {
  const v = Math.trunc(Number(n ?? 0));
  if (!Number.isFinite(v)) return lo;
  return Math.max(lo, Math.min(hi, v));
}

function ensureDeckHandShape(st) {
  st.decks =
    st.decks && typeof st.decks === "object" ? st.decks : { A: [], B: [] };
  st.hands =
    st.hands && typeof st.hands === "object" ? st.hands : { A: [], B: [] };

  for (const s of ["A", "B"]) {
    if (!Array.isArray(st.decks[s])) st.decks[s] = [];
    if (!Array.isArray(st.hands[s])) st.hands[s] = [];
  }
}

function drawN(st, who, n) {
  ensureDeckHandShape(st);
  const w = String(who || "").toUpperCase();
  if (w !== "A" && w !== "B") return 0;

  const cnt = clampInt(n, 0, 20);
  let drew = 0;

  for (let i = 0; i < cnt; i++) {
    if (!st.decks[w].length) break;
    st.hands[w].push(st.decks[w].pop());
    drew++;
  }
  return drew;
}

function ensureManaShape(st) {
  st.mana = st.mana && typeof st.mana === "object" ? st.mana : {};
  for (const s of ["A", "B"]) {
    st.mana[s] = st.mana[s] && typeof st.mana[s] === "object" ? st.mana[s] : {};
    st.mana[s].cur = clampInt(st.mana[s].cur, 0, 999);
    st.mana[s].max = clampInt(st.mana[s].max, 0, 999);
  }
  return st.mana;
}

function bumpMana(st, who, deltaCur = 0, deltaMax = 0) {
  ensureManaShape(st);
  const w = String(who || "").toUpperCase();
  if (w !== "A" && w !== "B") return;

  const MAX_CAP = 99; // debug用のゆるい上限
  const cur = clampInt(st.mana[w].cur, 0, 999);
  const max = clampInt(st.mana[w].max, 0, 999);
  const nextMax = clampInt(max + Math.trunc(deltaMax), 0, MAX_CAP);
  const nextCur = clampInt(cur + Math.trunc(deltaCur), 0, nextMax);

  st.mana[w].max = nextMax;
  st.mana[w].cur = nextCur;
}

function swapMatchSeatsInMatchDoc(matchRef, setStatusFn = setStatus) {
  // matchRef が無いケースは無視
  if (!matchRef) {
    setStatusFn("⚠️ matchRef が無いので seat入替は不可");
    return;
  }
  // matchドキュメントの seatA/seatB を入れ替える（デバッグ用途）
  return runTransaction(matchRef.firestore, async (tx) => {
    const ms = await tx.get(matchRef);
    if (!ms.exists()) return;
    const m = ms.data() || {};
    const a = m.seatA ?? null;
    const b = m.seatB ?? null;
    tx.set(matchRef, { seatA: b, seatB: a }, { merge: true });
  });
}
function pick(st, seat) {
  const mana = st?.mana?.[seat] || null;
  const handN = Array.isArray(st?.hands?.[seat]) ? st.hands[seat].length : 0;
  const deckN = Array.isArray(st?.decks?.[seat]) ? st.decks[seat].length : 0;
  const units = Array.isArray(st?.units) ? st.units : [];
  const myUnits = units.filter(
    (u) => u && u.owner === seat && Number(u.hp) > 0,
  );
  const enUnits = units.filter(
    (u) => u && u.owner !== seat && Number(u.hp) > 0,
  );

  return {
    room: st?.roomId ?? null,
    turn: st?.turn,
    turnSeq: st?.turnSeq,
    winner: st?.winner ?? null,
    seat,
    mana,
    hand: handN,
    deck: deckN,
    units: { my: myUnits.length, enemy: enUnits.length, all: units.length },
    lastRoll: st?.lastRoll ?? null,
    lastSupportRoll: st?.lastSupportRoll ?? null,
    lastHit: st?.lastHit ?? null,
    kills: st?.kills ?? null,
    infil: st?.infil ?? null,
    fieldId: st?.fieldId ?? st?.field?.id ?? null,
    field: st?.field ?? null,
  };
}

export function initSoloDebug({
  db,
  roomId,
  playerId,
  seat,
  stateRef,
  matchRef,
  playerRef,
  cardDefsRef,
  render,
}) {
  // 二重起動ガード
  if (window.__soloDebugInitialized) return;
  window.__soloDebugInitialized = true;

  ensurePanel();
  const pre = document.getElementById("soloDebugText");
  if (!pre) return;

  // console buttons
  const panel = document.getElementById("soloDebugPanel");
  const consoleRow = panel?.querySelector("div[style*='flex-wrap']");

  const mkBtn = (label, onClick) =>
    el(
      "button",
      {
        style: {
          padding: "6px 8px",
          borderRadius: "10px",
          border: "1px solid rgba(255,255,255,.18)",
          background: "rgba(255,255,255,.10)",
          color: "#fff",
          cursor: "pointer",
          fontSize: "12px",
        },
        onclick: onClick,
        type: "button",
      },
      [label],
    );

  if (consoleRow) {
    // ドロー（+2）
    consoleRow.appendChild(
      mkBtn("🃏 Aドロー+2", async () => {
        setStatus("…Aドロー+2");
        await txState(stateRef, (st) => {
          const drew = drawN(st, "A", 2);
          // ログがあるなら一応残す（無ければ無視）
          if (Array.isArray(st.log)) st.log.push(`[SOLO] A drew ${drew}/2`);
          return st;
        });
        setStatus("✅ Aドローしました（2枚）");
      }),
    );

    consoleRow.appendChild(
      mkBtn("🃏 Bドロー+2", async () => {
        setStatus("…Bドロー+2");
        await txState(stateRef, (st) => {
          const drew = drawN(st, "B", 2);
          if (Array.isArray(st.log)) st.log.push(`[SOLO] B drew ${drew}/2`);
          return st;
        });
        setStatus("✅ Bドローしました（2枚）");
      }),
    );
    // Turn切替（A/B）: state.turn を強制変更
    consoleRow.appendChild(
      mkBtn("🔁 Turn切替", async () => {
        setStatus("…turn切替中");
        await txState(stateRef, (st) => {
          const t = String(st?.turn || "A").toUpperCase();
          const next = t === "A" ? "B" : "A";
          st.turn = next;
          st.turnSeq = clampInt(st.turnSeq ?? 1, 0, 999999) + 1;
          return st;
        });
        setStatus("✅ turnを切替しました");
      }),
    );

    // マナ操作（+2）
    consoleRow.appendChild(
      mkBtn("✨ Aマナ+2", async () => {
        setStatus("…Aマナ+2");
        await txState(stateRef, (st) => {
          bumpMana(st, "A", 2, 2);
          return st;
        });
        setStatus("✅ Aマナを増やしました");
      }),
    );
    consoleRow.appendChild(
      mkBtn("✨ Bマナ+2", async () => {
        setStatus("…Bマナ+2");
        await txState(stateRef, (st) => {
          bumpMana(st, "B", 2, 2);
          return st;
        });
        setStatus("✅ Bマナを増やしました");
      }),
    );

    // マナ全回復（cur=max）
    consoleRow.appendChild(
      mkBtn("🔋 A全回復", async () => {
        setStatus("…Aマナ全回復");
        await txState(stateRef, (st) => {
          ensureManaShape(st);
          st.mana.A.cur = clampInt(st.mana.A.max, 0, 999);
          return st;
        });
        setStatus("✅ Aマナ全回復");
      }),
    );
    consoleRow.appendChild(
      mkBtn("🔋 B全回復", async () => {
        setStatus("…Bマナ全回復");
        await txState(stateRef, (st) => {
          ensureManaShape(st);
          st.mana.B.cur = clampInt(st.mana.B.max, 0, 999);
          return st;
        });
        setStatus("✅ Bマナ全回復");
      }),
    );

    // シート入れ替え（matchの seatA/seatB をswap）
    consoleRow.appendChild(
      mkBtn("🪑 seat入替", async () => {
        setStatus("…seat入替中");
        try {
          await swapMatchSeatsInMatchDoc(matchRef);
          setStatus("✅ match.seatA/seatB を入替しました");
        } catch (e) {
          setStatus(`❌ seat入替失敗: ${String(e?.message ?? e)}`);
        }
      }),
    );

    // 疲労リセット（両陣営）
    consoleRow.appendChild(
      mkBtn("🧼 疲労リセット", async () => {
        setStatus("…疲労リセット");
        await txState(stateRef, (st) => {
          st.units = Array.isArray(st.units) ? st.units : [];
          for (const u of st.units) {
            if (!u) continue;
            u.fatigue = false;
          }
          return st;
        });
        setStatus("✅ 全ユニットの疲労を解除");
      }),
    );
  }

  // state監視
  const unsub = onSnapshot(
    stateRef,
    (snap) => {
      if (!snap.exists()) return;
      const st = snap.data() || {};
      const other = oppSeat(seat) || seat;
      const out = {
        meta: {
          roomId,
          playerId,
          seat,
          at: new Date().toISOString(),
        },
        summary: pick(st, seat),
        otherSummary: pick(st, other),
      };
      pre.textContent = JSON.stringify(out, null, 2);
    },
    (err) => {
      pre.textContent = String(err?.message ?? err);
    },
  );

  // 画面離脱で解除
  window.addEventListener(
    "beforeunload",
    () => {
      try {
        unsub();
      } catch {}
    },
    { once: true },
  );
}

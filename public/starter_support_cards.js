// public/starter_support_cards.js
// v20260706_starter_support_fallback1
// Local fallback definitions for starter support cards.

const support = (id, name, cost, effect, rarity = "R", note = "") => ({
  id,
  name,
  kind: "support",
  type: "support",
  rarity,
  cost,
  effect,
  series: "初期",
  source: "starter_support_fallback",
  note,
});

export const STARTER_SUPPORT_CARDS = [
  support("s001", "しこり咲き", 3, { type: "draw", rate: 80, n: 1 }),
  support("s002", "救急処置", 1, { type: "heal", rate: 70, hp: 10, sp: 0 }),
  support("s003", "集中", 1, { type: "modRate", rate: 75, delta: 10 }),
  support("s004", "こ一のエロ画像", 2, { type: "modRate", rate: 80, delta: -15 }),
  support("s005", "火炎瓶", 2, { type: "dmg", rate: 40, hp: 20, sp: 0 }),
  support("s006", "配属通知書", 2, { type: "dmg", rate: 40, hp: 0, sp: 10 }),
  support("s007", "強化剤", 1, { type: "powerUp", rate: 60, delta: 10 }),
  support("s008", "解毒薬", 1, { type: "cleanse", rate: 70 }),
  support("s009", "強制脱出装置", 8, { type: "bounce", rate: 80 }),
  support("s010", "部署移動", 5, { type: "swapPos", rate: 65, maxDist: 3 }),
  support("s011", "島流し", 2, { type: "moveTo", rate: 50, maxDist: 2 }),
  support("s012", "インバータメテオ", 4, { type: "dmg", rate: 70, hp: 20, sp: 0 }),

  support("S101", "迅速反応", 2, {
    type: "addStatus",
    rate: 75,
    status: "evade",
    v: 1,
    turns: 2,
    cond: { attr: "雷" },
  }),
  support("S102", "寝取られ本", 3, {
    table: [
      { min: 1, max: 35, label: "スワッピング", effect: { type: "swapPos", maxDist: 2 } },
      { min: 36, max: 70, label: "脳破壊", effect: { type: "lostSoul", v: 1, turns: 2 } },
      { min: 71, max: 100, label: "失敗", effect: null },
    ],
  }),
  support("S103", "運命の電話", 2, {
    table: [
      { min: 1, max: 20, label: "大成功", effect: { type: "draw", n: 3 } },
      { min: 21, max: 50, label: "成功", effect: { type: "heal", hp: 20, sp: 10 } },
      { min: 51, max: 80, label: "不発", effect: null },
      { min: 81, max: 100, label: "失敗", effect: null },
    ],
  }),
  support("S104", "属性増幅", 1, {
    type: "powerUp",
    rate: 75,
    delta: 10,
    cond: { attrIn: ["火", "水", "雷", "光", "闇"] },
  }),
  support("S105", "消火器プッパ", 2, {
    type: "dmg",
    rate: 70,
    hp: 20,
    sp: 0,
    cond: { attr: "火" },
    drawback: { selfHp: 10 },
  }),
  support("S106", "やるんだな!今ここで!", 2, {
    type: "draw",
    rate: 60,
    n: 2,
    drawback: { discard: 1 },
  }),
  support("S107", "徹底テンション", 1, {
    type: "modRate",
    rate: 100,
    delta: 10,
    drawback: { selfSp: 10 },
  }),
  support("S108", "禁断の強化剤", 2, {
    type: "powerUp",
    rate: 80,
    delta: 20,
    cond: { hpPct: { max: 50 } },
    drawback: { selfHp: 10 },
  }),
  support("S109", "安全確認ヨシ", 1, {
    type: "grantEvade",
    rate: 100,
    v: 1,
    turns: 1,
    drawback: { discard: 1 },
  }),
  support("S110", "応急パッチ", 1, {
    type: "cleanse",
    rate: 80,
    cond: { status: { hasAny: ["bleed", "poison", "blind"] } },
  }),
  support("S111", "応急処置キット", 1, {
    type: "heal",
    rate: 85,
    hp: 8,
    sp: 8,
  }),
  support("S112", "メンテナンス窓", 1, {
    type: "heal",
    rate: 90,
    hp: 10,
    sp: 0,
    cond: { status: { lacksAny: ["bleed"] } },
  }),
  support("S113", "前線指揮", 3, {
    type: "powerUp",
    rate: 80,
    delta: 15,
  }),
  support("S114", "マナ抽出", 2, {
    type: "manaUp",
    rate: 80,
    delta: 2,
    kind: "cur",
    targetSeat: "SELF",
    drawback: { selfHp: 10 },
  }),
  support("S115", "戦場医療", 3, {
    type: "heal",
    rate: 85,
    hp: 20,
    sp: 0,
  }),
  support("S116", "ガンダち処理", 2, {
    type: "powerUp",
    rate: 90,
    delta: 20,
    cond: { hp: { max: 10 } },
  }),
  support("S117", "雷鳴の援護", 2, {
    type: "dmg",
    rate: 70,
    hp: 10,
    sp: 5,
    cond: { attr: "雷" },
  }),
  support("S118", "撤退支援", 2, {
    type: "shiftGroup",
    rate: 75,
    mode: "retreat",
    dist: 1,
  }),
];

export const STARTER_SUPPORT_CARD_MAP = Object.fromEntries(
  STARTER_SUPPORT_CARDS.map((card) => [card.id, card]),
);

export function starterSupportFallback(cardId) {
  const id = String(cardId || "").trim();
  if (!id) return null;
  if (STARTER_SUPPORT_CARD_MAP[id]) return STARTER_SUPPORT_CARD_MAP[id];
  if (!/^S\d+$/i.test(id)) return null;
  return support(id, `${id} サポート`, 1, { type: "draw", rate: 100, n: 1 }, "R", "自動補完");
}

export function ensureStarterSupportDefs(defs, ids = []) {
  const out = defs && typeof defs === "object" ? defs : {};
  const allIds = new Set([
    ...STARTER_SUPPORT_CARDS.map((card) => card.id),
    ...ids.map((id) => String(id || "").trim()).filter(Boolean),
  ]);
  for (const id of allIds) {
    if (out[id]) continue;
    const fallback = starterSupportFallback(id);
    if (fallback) out[id] = { ...fallback };
  }
  return out;
}

// public/jewel_cards.js
// v20260828_jewel_pool1
// 宝石テーマは「候補40枚」から30枚を選ぶためのカードプールです。

const SERIES = "宝石";
const PACK = "jewel_pool_20260828";

function skill(name, cost, range, rate, hpDelta, spDelta, extra = {}) {
  return {
    name,
    cost,
    range,
    rate,
    hpDelta,
    spDelta,
    ...extra,
  };
}

function unit(id, name, attr, cost, hp, sp, actions, extra = {}) {
  return {
    id,
    name,
    kind: "unit",
    type: attr,
    attr,
    cost,
    hp,
    sp,
    rarity: extra.rarity || "R",
    series: SERIES,
    pack: PACK,
    source: SERIES,
    theme: SERIES,
    desc: extra.desc || `${attr}属性の宝石ユニット。`,
    actions,
    tags: [SERIES, attr, ...(extra.tags || [])].join("+"),
  };
}

function support(id, name, cost, effect, extra = {}) {
  return {
    id,
    name,
    kind: "support",
    type: "support",
    attr: "support",
    cost,
    hp: 0,
    sp: 0,
    rarity: extra.rarity || "R",
    series: SERIES,
    pack: PACK,
    source: SERIES,
    theme: SERIES,
    desc: extra.desc || "宝石デッキ用サポート。",
    effect,
    tags: [SERIES, "support", ...(extra.tags || [])].join("+"),
  };
}

export const JEWEL_CARD_LIST = [
  unit("gem_fire_ruby_vanguard", "紅玉の先鋒", "火", 2, 30, 10, [
    skill("ルビースラッシュ", 1, "front1", 70, -10, 0),
    skill("赤熱突撃", 2, "front1+side1", 55, -20, 0),
  ], { desc: "小回りのきく火力役。前列から押し込む。" }),
  unit("gem_fire_garnet_duelist", "柘榴石の決闘者", "火", 4, 50, 20, [
    skill("一閃", 1, "front1", 65, -20, 0),
    skill("紅蓮コンボ", 3, "front2", 45, -30, 0),
  ], { rarity: "SR", desc: "火属性の中量アタッカー。突破力が高い。" }),

  unit("gem_water_sapphire_guard", "蒼玉の守護者", "水", 3, 50, 30, [
    skill("水盾", 1, "self", 90, 10, 0),
    skill("静かな反撃", 2, "front1", 60, -10, -10),
  ], { desc: "粘り強い守り。回復とSP削りを両立する。" }),
  unit("gem_water_aquamarine_mender", "藍玉の癒し手", "水", 2, 30, 30, [
    skill("澄んだ治癒", 1, "self", 85, 10, 10),
    skill("潮の針", 2, "front2", 60, -10, -10),
  ], { desc: "手軽な回復役。序盤の支えになる。" }),

  unit("gem_thunder_topaz_binder", "黄玉の束縛師", "雷", 3, 40, 30, [
    skill("電鎖", 1, "front1", 65, 0, -20),
    skill("雷鳴バインド", 2, "front2", 55, -10, -20),
  ], { desc: "SP圧で相手の選択肢を削る。" }),
  unit("gem_thunder_citrine_runner", "黄水晶の疾走者", "雷", 2, 30, 20, [
    skill("加速打ち", 1, "front1", 70, -10, 0),
    skill("電光ステップ", 1, "self", 80, 0, 10),
  ], { desc: "展開力と軽さが強みの雷ユニット。" }),

  unit("gem_grass_emerald_druid", "翠玉の森導師", "草", 3, 40, 40, [
    skill("新芽の祈り", 1, "self", 85, 10, 10),
    skill("蔦の拘束", 2, "front1", 60, -10, -10),
  ], { desc: "回復と安定感で盤面を支える。" }),
  unit("gem_grass_jade_keeper", "翡翠の番人", "草", 5, 70, 30, [
    skill("翡翠の守り", 2, "self", 85, 20, 0),
    skill("根張りの一撃", 2, "front1", 60, -20, 0),
  ], { rarity: "SR", desc: "高耐久で前線を守る大型ユニット。" }),

  unit("gem_wind_peridot_scout", "橄欖石の斥候", "風", 2, 30, 20, [
    skill("風切り", 1, "front1", 70, -10, 0),
    skill("軽業移動", 1, "self", 80, 0, 10),
  ], { desc: "軽く動ける斥候。奇襲と配置替えが得意。" }),
  unit("gem_wind_moonstone_rogue", "月長石の怪盗", "風", 4, 40, 40, [
    skill("月影ステップ", 1, "self", 85, 0, 10),
    skill("横風カット", 2, "side1", 60, -20, 0),
  ], { rarity: "SR", desc: "横方向の射程で盤面を崩す。" }),

  unit("gem_steel_hematite_golem", "赤鉄鉱ゴーレム", "鋼", 4, 70, 20, [
    skill("硬質パンチ", 1, "front1", 65, -20, 0),
    skill("装甲展開", 2, "self", 85, 10, 10),
  ], { desc: "高HPの壁。前線を固める。" }),
  unit("gem_steel_magnetite_knight", "磁鉄鉱の騎士", "鋼", 5, 80, 20, [
    skill("磁力槍", 2, "front2", 60, -20, -10),
    skill("引力防御", 2, "self", 80, 20, 0),
  ], { rarity: "SR", desc: "鋼の大型安定役。突破されにくい。" }),

  unit("gem_light_diamond_prism", "金剛石の調律師", "光", 3, 40, 40, [
    skill("プリズム刻印", 2, "front2", 75, -10, 0, {
      changeAttr: "光",
      effects: [{ type: "changeAttr", attr: "光" }],
    }),
    skill("白光の導き", 2, "self", 85, 10, 10),
  ], { rarity: "SR", desc: "対象を光属性に変える技を持つ調律役。" }),
  unit("gem_light_opal_alchemist", "蛋白石の錬金師", "光", 4, 50, 40, [
    skill("虹彩リライト", 3, "front1+side1", 65, 0, -10, {
      changeAttr: "幻",
      effects: [{ type: "changeAttr", attr: "幻" }],
    }),
    skill("オパールヒール", 2, "self", 80, 20, 0),
  ], { rarity: "SR", desc: "属性を書き換え、弱点や進化筋を作る。" }),

  unit("gem_dark_onyx_assassin", "黒縞瑪瑙の暗殺者", "闇", 3, 40, 20, [
    skill("影針", 1, "front1", 65, -10, -10),
    skill("深闇の一撃", 3, "front1", 45, -30, 0),
  ], { desc: "低命中高リターン寄りの闇アタッカー。" }),
  unit("gem_dark_obsidian_witch", "黒曜石の魔女", "闇", 4, 50, 30, [
    skill("呪紋", 2, "front2", 55, -10, -20),
    skill("闇鏡", 2, "self", 80, 10, 10),
  ], { desc: "SPを削りながら盤面を弱らせる。" }),

  unit("gem_illusion_amethyst_oracle", "紫水晶の占星師", "幻", 2, 30, 30, [
    skill("星読み", 1, "self", 90, 0, 10),
    skill("幻惑光", 2, "front2", 55, -10, -10),
  ], { desc: "安定補助と幻の撹乱を担当。" }),
  unit("gem_illusion_labradorite_mage", "曹灰長石の幻術師", "幻", 5, 60, 40, [
    skill("ラブラドレセンス", 2, "front1+side1", 55, -20, -10),
    skill("幻層反射", 3, "self", 80, 20, 10),
  ], { rarity: "SSR", desc: "幻属性の大型。守りの振れ幅が大きい。" }),

  support("gem_sup_prism_lens", "プリズムレンズ", 2, {
    type: "changeAttr",
    rate: 85,
    attr: "光",
    target: "unit",
  }, { desc: "対象ユニットを光属性に変更する。" }),
  support("gem_sup_shadow_refraction", "黒曜リフレクター", 2, {
    type: "changeAttr",
    rate: 85,
    attr: "闇",
    target: "unit",
  }, { desc: "対象ユニットを闇属性に変更する。" }),
  support("gem_sup_lapidary_polish", "宝石研磨", 1, {
    type: "heal",
    rate: 80,
    hp: 10,
    sp: 0,
  }, { desc: "小回復。前線の欠けを整える。" }),
  support("gem_sup_crystal_survey", "水晶探索", 2, {
    type: "draw",
    rate: 75,
    n: 2,
  }, { desc: "手札を増やして宝石の組み合わせを探す。" }),
  support("gem_sup_geode_barrier", "晶洞バリア", 2, {
    type: "grantEvade",
    rate: 70,
    delta: 10,
    turns: 1,
  }, { desc: "対象に一時的な回避補助を付与する。" }),
];

export const JEWEL_CARDS = Object.freeze(
  Object.fromEntries(JEWEL_CARD_LIST.map((card) => [card.id, Object.freeze({ ...card })])),
);

export const JEWEL_CANDIDATE_POOL = Object.freeze({
  gem_fire_ruby_vanguard: 2,
  gem_fire_garnet_duelist: 2,
  gem_water_sapphire_guard: 2,
  gem_water_aquamarine_mender: 2,
  gem_thunder_topaz_binder: 2,
  gem_thunder_citrine_runner: 2,
  gem_grass_emerald_druid: 2,
  gem_grass_jade_keeper: 1,
  gem_wind_peridot_scout: 2,
  gem_wind_moonstone_rogue: 1,
  gem_steel_hematite_golem: 2,
  gem_steel_magnetite_knight: 1,
  gem_light_diamond_prism: 2,
  gem_light_opal_alchemist: 2,
  gem_dark_onyx_assassin: 2,
  gem_dark_obsidian_witch: 1,
  gem_illusion_amethyst_oracle: 1,
  gem_illusion_labradorite_mage: 1,
  gem_sup_prism_lens: 2,
  gem_sup_shadow_refraction: 2,
  gem_sup_lapidary_polish: 2,
  gem_sup_crystal_survey: 2,
  gem_sup_geode_barrier: 2,
});

export const JEWEL_RECOMMENDED_DECK_30 = Object.freeze({
  gem_fire_ruby_vanguard: 2,
  gem_fire_garnet_duelist: 1,
  gem_water_sapphire_guard: 2,
  gem_water_aquamarine_mender: 1,
  gem_thunder_topaz_binder: 1,
  gem_thunder_citrine_runner: 1,
  gem_grass_emerald_druid: 2,
  gem_grass_jade_keeper: 1,
  gem_wind_peridot_scout: 1,
  gem_wind_moonstone_rogue: 1,
  gem_steel_hematite_golem: 1,
  gem_steel_magnetite_knight: 1,
  gem_light_diamond_prism: 2,
  gem_light_opal_alchemist: 2,
  gem_dark_onyx_assassin: 1,
  gem_dark_obsidian_witch: 1,
  gem_illusion_amethyst_oracle: 1,
  gem_sup_prism_lens: 2,
  gem_sup_shadow_refraction: 2,
  gem_sup_lapidary_polish: 1,
  gem_sup_crystal_survey: 2,
  gem_sup_geode_barrier: 1,
});

export const JEWEL_CANDIDATE_POOL_INFO = Object.freeze({
  title: "宝石候補40",
  size: 40,
  unitCount: 30,
  supportCount: 10,
  attrs: ["火", "水", "雷", "草", "風", "鋼", "光", "闇", "幻"],
  note: "40枚の候補プールです。この中から30枚を選んでデッキにします。",
});

// 旧名互換。外部から参照している画面を壊さないため残します。
export const JEWEL_TRIAL_DECK = JEWEL_CANDIDATE_POOL;
export const JEWEL_TRIAL_DECK_INFO = JEWEL_CANDIDATE_POOL_INFO;

if (typeof window !== "undefined") {
  window.JEWEL_CARDS = JEWEL_CARDS;
  window.JEWEL_CARD_LIST = JEWEL_CARD_LIST;
  window.JEWEL_CANDIDATE_POOL = JEWEL_CANDIDATE_POOL;
  window.JEWEL_CANDIDATE_POOL_INFO = JEWEL_CANDIDATE_POOL_INFO;
  window.JEWEL_RECOMMENDED_DECK_30 = JEWEL_RECOMMENDED_DECK_30;
  window.JEWEL_TRIAL_DECK = JEWEL_TRIAL_DECK;
  window.JEWEL_TRIAL_DECK_INFO = JEWEL_TRIAL_DECK_INFO;
}

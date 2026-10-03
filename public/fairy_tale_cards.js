// public/fairy_tale_cards.js
// v20260726_fairy_rate_down1
// Public-domain fairy-tale inspired character cards.

const pack = "fairy_tale_20260630";
const FT_POWER_SCALE = 0.6;
const FT_SP_DAMAGE_VALUE = 2;
const FT_RATE_PENALTY = 15;

function scale10(n) {
  const v = Number(n || 0);
  if (!v) return 0;
  const sign = v < 0 ? -1 : 1;
  return sign * Math.max(10, Math.round((Math.abs(v) * FT_POWER_SCALE) / 10) * 10);
}

function scaleSpDelta(n) {
  const v = Number(n || 0);
  if (!v) return 0;
  if (v > 0) return scale10(v);

  const scaledDamage = Math.abs(v) * FT_POWER_SCALE / FT_SP_DAMAGE_VALUE;
  return -Math.max(10, Math.round(scaledDamage / 10) * 10);
}

function scaleExtra(extra) {
  const next = { ...extra };
  if (typeof next.draw === "number" && next.draw > 1) {
    next.draw = Math.max(1, Math.round(next.draw * FT_POWER_SCALE));
  }
  return next;
}

function act(name, cost, range, rate, hpDelta, spDelta = 0, extra = {}) {
  return {
    name,
    cost,
    range,
    rate: Math.max(0, Number(rate || 0) - FT_RATE_PENALTY),
    hpDelta: scale10(hpDelta),
    spDelta: scaleSpDelta(spDelta),
    ...scaleExtra(extra),
  };
}

function card(id, name, type, cost, hp, sp, rarity, actions, desc) {
  return {
    id,
    kind: "unit",
    name,
    type,
    attr: type,
    cost,
    hp: scale10(hp),
    sp: scale10(sp),
    rarity,
    pack,
    source: "童話",
    desc,
    hidden: false,
    actions,
  };
}

export const FAIRY_TALE_CARD_LIST = [
  // 火: 火力と安定感。SPは控えめ。
  card("ft_fire_redhood", "赤ずきんの炎狩り", "火", 2, 30, 10, "R", [
    act("狼狩りの一閃", 1, "front1", 80, -20),
    act("赤い火花", 2, "rf1+lf1", 55, -30),
  ], "森を駆ける赤ずきん。近距離火力で押し切る。"),
  card("ft_fire_match_girl", "マッチ売りの灯火", "火", 1, 20, 20, "R", [
    act("小さな灯り", 1, "front1", 75, -10, 0, { draw: 1 }),
    act("最後の火", 3, "front1", 45, -40),
  ], "儚い炎で手札をつなぐ低コストアタッカー。"),
  card("ft_fire_ginger_knight", "お菓子の暖炉騎士", "火", 3, 40, 20, "R", [
    act("砂糖焦がし", 2, "front1", 75, -30),
    act("焼きたてシールド", 1, "self", 90, 10, 0),
  ], "甘い鎧で粘りながら焼く。"),
  card("ft_fire_dragon_beanstalk", "豆の木の火竜", "火", 6, 60, 20, "SR", [
    act("火竜の息", 3, "front2", 65, -40),
    act("雲上の火球", 4, "front3", 45, -50),
  ], "豆の木の上から火球を落とす大型。"),
  card("ft_fire_salamander_piper", "笛吹きサラマンダー", "火", 4, 40, 30, "SR", [
    act("火笛の行進", 2, "front1+side1", 70, -20, 0, { addStatus: "smell" }),
    act("踊る火柱", 3, "front2", 55, -40),
  ], "状態異常を絡める火の支援アタッカー。"),
  card("ft_fire_cinder_heir", "灰かぶりの火種姫", "火", 5, 50, 20, "SR", [
    act("硝子の火花", 2, "rf1+lf1", 75, -30),
    act("十二時の逆火", 4, "front1", 40, -60, 0, { tags: "followUp" }),
  ], "一撃の爆発力を持つ火属性の姫。"),
  card("ft_fire_phoenix_tailor", "仕立て屋フェニックス", "火", 7, 70, 20, "SSR", [
    act("七羽の一刺し", 3, "front1+rf1+lf1", 70, -40),
    act("不死鳥の裁断", 5, "front2", 50, -70),
  ], "火属性の切り札。高コスト高火力。"),

  // 水: 耐久、SP攻撃、妨害。
  card("ft_water_mermaid", "人魚姫の泡歌", "水", 2, 40, 30, "R", [
    act("泡の旋律", 1, "front1", 75, 0, -10),
    act("潮の抱擁", 2, "self", 90, 20, 10),
  ], "SPを削りながら自分を整える。"),
  card("ft_water_snow_queen", "雪の女王の鏡片", "水", 5, 60, 40, "SR", [
    act("凍る視線", 2, "front2", 65, -10, -20, { addStatus: "blind" }),
    act("氷の宮殿", 3, "self", 90, 30, 10),
  ], "耐久と妨害を両立する水の女王。"),
  card("ft_water_frog_prince", "蛙王子の雨冠", "水", 3, 50, 20, "R", [
    act("跳ねる水剣", 1, "front1+side1", 75, -20),
    act("王冠の雫", 2, "front1", 80, 10, 10),
  ], "回復を添えた扱いやすい中量級。"),
  card("ft_water_bluebeard", "青ひげの水牢番", "水", 4, 60, 20, "R", [
    act("水牢の鍵", 2, "front1", 65, -10, -20),
    act("沈む部屋", 3, "side1", 55, -20, -20),
  ], "敵のSPを沈める堅い妨害役。"),
  card("ft_water_swan_lake", "白鳥湖の姫騎士", "水", 4, 50, 40, "SR", [
    act("湖面斬り", 2, "front1+rf1", 70, -20, -10),
    act("羽衣の回復", 2, "self", 85, 20, 20),
  ], "攻守の水準が高い水属性の万能役。"),
  card("ft_water_moon_turtle", "月亀の潮守り", "水", 6, 80, 30, "SR", [
    act("満潮ガード", 2, "self", 95, 30, 0),
    act("月波", 3, "front2", 65, -20, -30),
  ], "重いがかなり硬い防衛役。"),
  card("ft_water_leviathan_book", "海底本のリヴァイアサン", "水", 7, 80, 50, "SSR", [
    act("深海の一文", 3, "front3", 70, -20, -30),
    act("物語を沈める波", 5, "front2+side1", 50, -40, -40),
  ], "水の大型。HPとSPを同時に削る。"),

  // 雷: 安定感と展開、ドロー。
  card("ft_thunder_puss_boots", "長靴猫の雷ステップ", "雷", 2, 30, 20, "R", [
    act("雷ステップ", 1, "front1+side1", 85, -10, 0, { draw: 1 }),
    act("長靴キック", 2, "front1", 70, -20),
  ], "軽快に殴って手札を回す。"),
  card("ft_thunder_tin_soldier", "すずの兵隊の電令", "雷", 3, 40, 20, "R", [
    act("電令射撃", 1, "front2", 75, -10),
    act("隊列点火", 2, "front1", 70, -20, 0, { draw: 1 }),
  ], "射程とドローを持つ安定枠。"),
  card("ft_thunder_jack_bean", "豆の木ジャックの落雷", "雷", 4, 40, 30, "SR", [
    act("豆の木スパーク", 2, "front2", 75, -20, 0, { draw: 1 }),
    act("巨人落とし", 3, "front1", 60, -40),
  ], "雷らしい展開力と火力。"),
  card("ft_thunder_hare_clock", "時計うさぎの雷針", "雷", 1, 20, 20, "R", [
    act("時針ショック", 1, "front1", 80, -10),
    act("急ぎ足", 1, "self", 90, 0, 10, { draw: 1 }),
  ], "序盤から動ける軽量キャラ。"),
  card("ft_thunder_goose_golden", "金のがちょうの静電気", "雷", 3, 30, 40, "R", [
    act("くっつき放電", 2, "side1", 70, -20, 0, { addStatus: "silence" }),
    act("金羽ドロー", 1, "self", 90, 0, 0, { draw: 2 }),
  ], "手札補充と妨害を担当。"),
  card("ft_thunder_sleeping_needle", "眠り姫の雷紡ぎ", "雷", 5, 50, 30, "SR", [
    act("紡錘ショック", 2, "front2", 80, -20),
    act("百年の目覚め", 3, "self", 90, 20, 10, { draw: 1 }),
  ], "安定して盤面を維持する中重量。"),
  card("ft_thunder_storm_giant", "雲上巨人の雷太鼓", "雷", 7, 70, 40, "SSR", [
    act("雷太鼓", 3, "front3", 75, -30, 0, { draw: 1 }),
    act("空割り", 5, "front2", 55, -60),
  ], "雷の切り札。重いが手札も戻せる。"),

  // 草: 回復、安定、低火力。
  card("ft_grass_briar_rose", "いばら姫の治癒庭", "草", 2, 40, 30, "R", [
    act("いばらの手当て", 1, "front1", 85, 20, 0),
    act("棘の返礼", 2, "front1", 65, -10),
  ], "回復を中心に戦う草の基本形。"),
  card("ft_grass_three_bears", "三びき熊の森番", "草", 3, 60, 20, "R", [
    act("森の抱擁", 1, "self", 90, 20, 0),
    act("熊のひと押し", 2, "front1", 65, -20),
  ], "硬めで粘る守備役。"),
  card("ft_grass_rapunzel", "塔のラプンツェル", "草", 4, 50, 40, "SR", [
    act("癒しの長髪", 2, "front2", 80, 20, 10),
    act("塔上の蔦", 2, "front2", 60, -10, 0, { addStatus: "fracture" }),
  ], "遠めの回復と妨害を持つ草の要。"),
  card("ft_grass_hansel_gretel", "森迷いの兄妹", "草", 3, 40, 30, "R", [
    act("パンくずルート", 1, "self", 90, 10, 10, { draw: 1 }),
    act("お菓子罠", 2, "side1", 65, -10, 0, { addStatus: "smell" }),
  ], "手札と回復を少しずつ稼ぐ。"),
  card("ft_grass_little_elder", "親指姫の花冠", "草", 1, 20, 30, "R", [
    act("花粉の祈り", 1, "front1", 80, 10, 10),
    act("小さな棘", 1, "front1", 65, -10),
  ], "低コストの回復補助。"),
  card("ft_grass_green_knight", "緑の騎士の再生枝", "草", 6, 70, 30, "SR", [
    act("再生枝", 2, "self", 90, 30, 10),
    act("緑刃", 3, "front1+side1", 65, -30),
  ], "草では珍しく攻撃もできる大型。"),
  card("ft_grass_world_tree_fairy", "世界樹の妖精王", "草", 7, 80, 50, "SSR", [
    act("大樹の祝福", 3, "front2+side1", 85, 30, 20),
    act("根の封印", 4, "front2", 60, -20, 0, { addStatus: "silence" }),
  ], "回復と封印をまとめる草の切り札。"),

  // 風: 射程、回避、軽さ。耐久と火力は控えめ。
  card("ft_wind_peter_pan", "空飛ぶ少年ピーター", "風", 2, 30, 30, "R", [
    act("空中突き", 1, "front2", 75, -10),
    act("影の回避", 1, "self", 80, 0, 10, { tags: "evade" }),
  ], "軽快に遠くへ届く風の基本。"),
  card("ft_wind_tinker_bell", "鈴の妖精ティンク", "風", 1, 10, 40, "R", [
    act("妖精粉", 1, "front2", 75, 0, 10, { draw: 1 }),
    act("きらめき針", 1, "front2", 60, -10),
  ], "低耐久だが手札とSPを支える。"),
  card("ft_wind_flying_carpet", "空飛ぶ絨毯の王子", "風", 3, 40, 30, "R", [
    act("滑空斬り", 2, "front3", 65, -20),
    act("風よけ", 1, "self", 85, 0, 10, { tags: "evade" }),
  ], "射程3を持つ扱いやすい風。"),
  card("ft_wind_nightingale", "夜鳴き鳥の風歌", "風", 3, 30, 40, "SR", [
    act("風歌", 1, "front3", 80, 10, 10),
    act("音の刃", 2, "front3", 65, -20),
  ], "回復と遠距離攻撃のバランス型。"),
  card("ft_wind_wild_swans", "野の白鳥隊", "風", 4, 40, 40, "R", [
    act("白翼連携", 2, "front2+rf1+lf1", 65, -20),
    act("羽ばたき", 1, "self", 90, 0, 10),
  ], "広い射程で小回りが利く。"),
  card("ft_wind_glass_mountain", "ガラス山の風騎士", "風", 5, 50, 30, "SR", [
    act("山風の槍", 2, "front4", 55, -30),
    act("滑落誘導", 2, "front2", 60, -10, 0, { tags: "knockback" }),
  ], "風らしい長射程と位置ずらし。"),
  card("ft_wind_pegasus_messenger", "天馬の伝令姫", "風", 6, 50, 50, "SSR", [
    act("天馬疾走", 2, "front4", 75, -20, 0, { draw: 1 }),
    act("星風の一撃", 4, "front3", 55, -50),
  ], "高射程と展開を両立する風の切り札。"),

  // 鋼: 耐久最高、展開と火力は控えめ。
  card("ft_steel_tin_heart", "ブリキ心臓の守護者", "鋼", 3, 70, 10, "R", [
    act("ブリキ拳", 1, "front1", 70, -20),
    act("心臓ガード", 1, "self", 90, 20, 0, { tags: "armor" }),
  ], "耐久で前線を支える。"),
  card("ft_steel_iron_hans", "鉄のハンス", "鋼", 5, 80, 20, "SR", [
    act("鉄腕", 2, "front1", 70, -30),
    act("鎖の守り", 2, "self", 90, 30, 0),
  ], "鋼らしい重く硬い中核。"),
  card("ft_steel_clockwork_duck", "時計仕掛けのアヒル兵", "鋼", 2, 50, 10, "R", [
    act("ぜんまい突撃", 1, "front1", 75, -10),
    act("歯車補修", 1, "self", 85, 10, 0),
  ], "低コストの硬い壁。"),
  card("ft_steel_nutcracker", "くるみ割り将軍", "鋼", 4, 70, 20, "R", [
    act("くるみ割り", 2, "front1", 75, -30),
    act("軍靴前進", 1, "front1", 85, -10, 0, { tags: "knockback" }),
  ], "近距離で圧をかける鋼。"),
  card("ft_steel_castle_gate", "眠れる城門騎士", "鋼", 6, 90, 10, "SR", [
    act("城門防衛", 2, "self", 95, 40, 0),
    act("門扉打ち", 3, "front1", 65, -30, 0, { tags: "knockback" }),
  ], "ひたすら硬い守備要員。"),
  card("ft_steel_silver_shoes", "銀の靴の旅人", "鋼", 3, 50, 20, "R", [
    act("銀靴キック", 1, "front1+side1", 70, -20),
    act("靴磨き", 1, "self", 90, 10, 10),
  ], "鋼にしては少し器用な軽量。"),
  card("ft_steel_colossus_castle", "鋼城の巨人王", "鋼", 7, 100, 20, "SSR", [
    act("巨城拳", 3, "front1", 75, -40),
    act("動く城壁", 4, "self", 95, 50, 0, { tags: "armor" }),
  ], "耐久特化の超大型。"),

  // 光: 安定、命中、回復少し。火力控えめ。
  card("ft_light_cinderella", "硝子靴のシンデレラ", "光", 3, 40, 30, "R", [
    act("硝子ステップ", 1, "front1+side1", 90, -10),
    act("午前零時の祈り", 2, "self", 90, 20, 10),
  ], "命中が高く安定する光の基本。"),
  card("ft_light_snow_white", "白雪姫の林檎光", "光", 2, 30, 30, "R", [
    act("七色の祈り", 1, "front1", 90, 10, 10),
    act("林檎の閃き", 2, "front1", 75, -20),
  ], "回復と攻撃が素直。"),
  card("ft_light_holy_mirror", "魔法鏡の聖判", "光", 4, 40, 40, "SR", [
    act("真実の光", 2, "front2", 85, -20, 0, { addStatus: "blind" }),
    act("鏡面反射", 2, "self", 85, 20, 10),
  ], "高命中の妨害と自衛を持つ。"),
  card("ft_light_star_child", "星の銀貨の子", "光", 1, 20, 20, "R", [
    act("銀貨の光", 1, "front1", 85, 10, 0, { draw: 1 }),
    act("小星", 1, "front2", 70, -10),
  ], "低コストで手札を支える。"),
  card("ft_light_prince_swan", "白鳥王子の光羽", "光", 5, 50, 40, "SR", [
    act("光羽斬り", 2, "front2", 85, -20),
    act("誓いの羽衣", 3, "front1", 90, 20, 20),
  ], "安定した中重量の光。"),
  card("ft_light_aladdin_lamp", "ランプの光王子", "光", 6, 60, 50, "SR", [
    act("願いの灯", 2, "front2", 90, 20, 20, { draw: 1 }),
    act("光の三願", 4, "front2", 70, -40),
  ], "回復と手札で長く戦う。"),
  card("ft_light_saint_storyteller", "聖なる語り部", "光", 7, 70, 50, "SSR", [
    act("物語の祝福", 3, "front2+side1", 90, 30, 20),
    act("白紙の裁き", 4, "front2", 75, -40, 0, { addStatus: "silence" }),
  ], "安定と回復を極めた光の切り札。"),

  // 闇: 高火力、逆転、低安定。
  card("ft_dark_big_bad_wolf", "大きな悪い狼", "闇", 3, 40, 20, "R", [
    act("吹き飛ばす息", 2, "front1", 60, -30, 0, { tags: "knockback" }),
    act("丸のみ", 3, "front1", 35, -50),
  ], "当たれば強い闇の近接。"),
  card("ft_dark_witch_candy", "お菓子の家の魔女", "闇", 4, 40, 40, "SR", [
    act("甘い毒", 2, "side1", 60, -10, -10, { addStatus: "poison" }),
    act("かまどの影", 3, "front1", 45, -40),
  ], "状態異常と火力を持つ魔女。"),
  card("ft_dark_black_swan", "黒鳥の呪舞", "闇", 4, 40, 30, "R", [
    act("呪舞", 2, "front1+side1", 55, -20, -10, { addStatus: "jinx" }),
    act("黒羽裂き", 2, "front1", 65, -30),
  ], "命中不安定だが圧がある。"),
  card("ft_dark_shadow_piper", "影笛の誘拐者", "闇", 2, 30, 30, "R", [
    act("影笛", 1, "front2", 60, 0, -10, { addStatus: "silence" }),
    act("暗い路地", 2, "side1", 50, -30),
  ], "軽い妨害役。"),
  card("ft_dark_queen_apple", "毒林檎の女王", "闇", 5, 50, 40, "SR", [
    act("毒林檎", 2, "front1", 60, -20, -10, { addStatus: "poison" }),
    act("嫉妬の刃", 4, "front1", 40, -60),
  ], "高火力と毒で逆転を狙う。"),
  card("ft_dark_sleep_curse", "百年呪いの紡ぎ手", "闇", 6, 60, 40, "SR", [
    act("眠りの針", 3, "front2", 55, -20, -20, { addStatus: "silence" }),
    act("呪糸乱舞", 4, "front1+rf1+lf1", 40, -50),
  ], "強力だが命中不安の妨害大型。"),
  card("ft_dark_dragon_mirror", "鏡界の黒竜", "闇", 7, 70, 40, "SSR", [
    act("黒鏡ブレス", 4, "front2", 55, -60, -10),
    act("反転の咆哮", 5, "front1+side1", 35, -80),
  ], "闇の超火力。外すリスクも大きい。"),

  // 幻: 展開、幻惑、状態異常。
  card("ft_illusion_alice", "迷いのアリス", "幻", 2, 30, 40, "R", [
    act("迷子の一歩", 1, "front2", 80, -10, 0, { draw: 1 }),
    act("小さな扉", 2, "side1", 65, 0, -20),
  ], "手札とSP妨害の幻。"),
  card("ft_illusion_cheshire", "チェシャ猫のにやり", "幻", 3, 30, 40, "R", [
    act("消える爪", 1, "front1+side1", 75, -10, 0, { tags: "evade" }),
    act("にやり笑い", 2, "front2", 60, 0, -20, { addStatus: "blind" }),
  ], "回避と幻惑で嫌がらせ。"),
  card("ft_illusion_mad_hatter", "帽子屋の時間茶会", "幻", 4, 40, 50, "SR", [
    act("時間のお茶", 2, "self", 90, 10, 20, { draw: 1 }),
    act("逆さ時計", 3, "front2", 60, -20, -20),
  ], "SPと手札を増やす幻の中核。"),
  card("ft_illusion_little_muk", "小さなムックの幻足", "幻", 1, 20, 30, "R", [
    act("幻足", 1, "front2", 80, -10),
    act("すり抜け", 1, "self", 85, 0, 10, { tags: "evade" }),
  ], "低コストで使いやすい。"),
  card("ft_illusion_bremen", "ブレーメン幻奏隊", "幻", 5, 50, 40, "SR", [
    act("幻奏", 2, "front2+side1", 65, -10, -20, { addStatus: "smell" }),
    act("四重奏ドロー", 2, "self", 90, 0, 10, { draw: 2 }),
  ], "妨害と手札補充のセット。"),
  card("ft_illusion_moon_rabbit", "月うさぎの夢餅", "幻", 4, 40, 50, "R", [
    act("夢餅", 2, "front1", 75, 10, 10),
    act("月面幻惑", 2, "front2", 60, -10, -20, { addStatus: "jinx" }),
  ], "回復しながら相手を鈍らせる。"),
  card("ft_illusion_dream_king", "夢渡りの童話王", "幻", 7, 70, 60, "SSR", [
    act("夢渡り", 3, "front3", 75, -20, -20, { draw: 1 }),
    act("終わらない物語", 5, "front2+side1", 50, -40, -40, { addStatus: "blind" }),
  ], "展開と妨害を兼ねる幻の切り札。"),
];

export const FAIRY_TALE_CARDS = Object.fromEntries(
  FAIRY_TALE_CARD_LIST.map((c) => [c.id, c]),
);

export const FAIRY_TALE_ATTRS = ["火", "水", "雷", "草", "風", "鋼", "光", "闇", "幻"];
export const FAIRY_TALE_CARD_COUNT = FAIRY_TALE_CARD_LIST.length;

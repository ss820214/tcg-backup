"use strict";

/**
 * OTNP16タイプ診断
 * v20260429_1
 *
 * あとでタイプ名を差し替える場合は、下の RESULTS を編集すればOK。
 */

const QUESTIONS = [
  {
    text: "就社初日から威圧感を与えていきたい",
    axis: "OD",
    yes: "O",
    no: "D",
    badge: "攻め方"
  },
  {
    text: "残っている業務も、じわじわ片づけるより一気に決めたい。",
    axis: "OD",
    yes: "O",
    no: "D",
    badge: "攻め方"
  },
  {
    text: "多少リスクがあっても、早く業務を終わらせれる働き方をする。",
    axis: "TS",
    yes: "S",
    no: "T",
    badge: "作戦"
  },
  {
    text: "テクノではきちんと役割を与えられたい",
    axis: "NE",
    yes: "N",
    no: "E",
    badge: "盤面"
  },
  {
    text: "ピンチになってから本気を出したい。出させてほしい。",
    axis: "PR",
    yes: "R",
    no: "P",
    badge: "勝負勘"
  },
  {
    text: "行動を読むのが好き。読んでも意味わからん動きをされても許せる",
    axis: "TS",
    yes: "T",
    no: "S",
    badge: "作戦"
  },
  {
    text: "圧倒的なエース存在が欲しい。この人についていきたいとか。",
    axis: "NE",
    yes: "E",
    no: "N",
    badge: "盤面"
  },
  {
    text: "とにかく相手を困惑させたい。",
    axis: "OD",
    yes: "O",
    no: "D",
    badge: "攻め方"
  },
  {
    text: "相手に「どっちを選んでも嫌だな」と思わせる状況や質問をするのが好き。",
    axis: "PR",
    yes: "P",
    no: "R",
    badge: "勝負勘"
  },
  {
    text: "ハイリスクハイリターンな業務をしたい。インバータを回転させたい。",
    axis: "TS",
    yes: "S",
    no: "T",
    badge: "作戦"
  },
  {
    text: "業務をパーツパーツに分けて考えるのが好き。",
    axis: "OD",
    yes: "D",
    no: "O",
    badge: "攻め方"
  },
  {
    text: "体調悪化したときに空を飛びたい。",
    axis: "NE",
    yes: "E",
    no: "N",
    badge: "盤面"
  },
  {
    text: "勤務地はかちっときめたい。全国転勤とか笑わせてくる。",
    axis: "TS",
    yes: "T",
    no: "S",
    badge: "作戦"
  },
  {
    text: "どうやって業務を乗り切れるか考えるのが好き",
    axis: "OD",
    yes: "D",
    no: "O",
    badge: "攻め方"
  },
  {
    text: "眼鏡をかけている。",
    axis: "PR",
    yes: "P",
    no: "R",
    badge: "勝負勘"
  },
  {
    text: "いろんな工場のおじさんをみて強さを考えたい",
    axis: "NE",
    yes: "N",
    no: "E",
    badge: "盤面"
  },
  {
    text: "戦略を考えるのが好き。どんな動きができるかなって",
    axis: "TS",
    yes: "T",
    no: "S",
    badge: "作戦"
  },
  {
    text: "ハード部門に配属されてもなんとかしてやるといった逆境魂がある。",
    axis: "PR",
    yes: "R",
    no: "P",
    badge: "勝負勘"
  },
  {
    text: "徹底的に勝ちたい",
    axis: "OD",
    yes: "O",
    no: "D",
    badge: "攻め方"
  },
  {
    text: "リーダーは一人で十分。",
    axis: "NE",
    yes: "E",
    no: "N",
    badge: "盤面"
  },
  {
    text: "就活をしたらかならず違う分野も見るようにしている。",
    axis: "TS",
    yes: "T",
    no: "S",
    badge: "作戦"
  },
  {
    text: "臨んだ答えが返ってこなくても顔に出ない。",
    axis: "PR",
    yes: "R",
    no: "P",
    badge: "勝負勘"
  },
  {
    text: "序盤からテンポを取れないと不安になる。",
    axis: "PR",
    yes: "P",
    no: "R",
    badge: "勝負勘"
  },
  {
    text: "回復、耐久、妨害という単語が大ちゅき",
    axis: "OD",
    yes: "D",
    no: "O",
    badge: "攻め方"
  },
  {
    text: "理屈よりロマン。そもそも理屈すら日本語で説明してくれないけど。",
    axis: "TS",
    yes: "S",
    no: "T",
    badge: "作戦"
  }
];

/**
 * スコア仕様
 *
 * O / D
 * score.OD >= 0 なら O、マイナスなら D
 *
 * T / S
 * score.TS >= 0 なら T、マイナスなら S
 *
 * N / E
 * score.NE >= 0 なら N、マイナスなら E
 *
 * P / R
 * score.PR >= 0 なら P、マイナスなら R
 */
const AXIS_SCORE = {
  OD: {
    O: 1,
    D: -1
  },
  TS: {
    T: 1,
    S: -1
  },
  NE: {
    N: 1,
    E: -1
  },
  PR: {
    P: 1,
    R: -1
  }
};

/**
 * 仮の16タイプ。
 * あとでユーザーが考えた正式名称にここを差し替える。
 */
const RESULTS = {
  "O-T-N-P": {
    name: "先攻圧殺コマンダー",
    desc: "あなたは序盤から盤面を支配し、相手に選択肢を与えないタイプ。キャラ同士の連携で圧をかけ、勝ち筋を計画的に作るのが得意です。",
    attrs: ["火", "雷", "風"],
    deck: "低〜中コストを多めにして、序盤から移動・攻撃・侵入の選択肢を増やす構成がおすすめ。安定感とテンポを両立できるデッキが向いています。",
    weak: "超耐久型、回復ループ型、序盤を受け流してくる逆転デッキ。"
  },
  "O-T-N-R": {
    name: "逆転設計アタッカー",
    desc: "攻める意思は強いけど、ただ突っ込むだけではなく、最後の逆転筋まで用意するタイプ。勝ち切るための保険をしっかり持ちます。",
    attrs: ["火", "光", "風"],
    deck: "攻撃役と補助役を分けつつ、ピンチ時に強いEXや回復札を少し入れると強いです。攻めながら保険を残す構成が合います。",
    weak: "序盤から極端に荒らしてくる速攻型。計画を崩されると苦しくなりやすいです。"
  },
  "O-T-E-P": {
    name: "エース突撃リーダー",
    desc: "主役キャラを決め、そのキャラを中心に一直線で勝ちに行くタイプ。強い1体を活かすための配置やタイミングを大事にします。",
    attrs: ["火", "雷", "鋼"],
    deck: "エースを守るカード、エースを前に出すカード、エースの火力を伸ばすカードをセットで組むのがおすすめです。",
    weak: "エースを状態異常で止めてくる相手や、複数方向から攻めてくる展開型。"
  },
  "O-T-E-R": {
    name: "不屈の主役型",
    desc: "エースキャラで攻めつつ、ピンチからの巻き返しも狙えるタイプ。追い込まれるほど燃える主人公気質です。",
    attrs: ["火", "光", "闇"],
    deck: "高HP・高SPの主役キャラを中心に、回復やEXを絡めて粘りながら押し返す構成が向いています。",
    weak: "エースを無視して侵入勝ちを狙う相手や、継続的にSPを削ってくる相手。"
  },
  "O-S-N-P": {
    name: "面制圧バーサーカー",
    desc: "考える前に盤面を燃やすタイプ。複数キャラで相手を囲み、勢いと火力で一気に押し切るのが好きです。",
    attrs: ["火", "雷", "風"],
    deck: "命中や安定性よりも、攻撃回数・射程・突破力を重視。多少雑でも勝ち筋が太いデッキが合います。",
    weak: "受け性能が高い相手、回復で火力をずらしてくる相手。"
  },
  "O-S-N-R": {
    name: "大逆転クラッシャー",
    desc: "攻める、荒らす、でも最後にもう一段ひっくり返す。勢いと逆転力を両方持った派手好きタイプです。",
    attrs: ["火", "闇", "雷"],
    deck: "高火力技、ランダム性のある大技、ピンチ時に強いカードを混ぜると面白いです。安定より爆発力重視。",
    weak: "堅実に処理してくるコントロール型。大技を外した時のリカバリーが課題です。"
  },
  "O-S-E-P": {
    name: "脳筋エースブレイカー",
    desc: "強いキャラで殴る。それが一番わかりやすい。あなたは主役級のエースで相手を粉砕したいタイプです。",
    attrs: ["火", "雷", "鋼"],
    deck: "高火力キャラ、高コスト技、火力強化を中心にした一点突破型がおすすめ。勝つ時はめちゃくちゃ気持ちいいです。",
    weak: "回避、妨害、足止め、SP削り。エースが止まると一気に苦しくなります。"
  },
  "O-S-E-R": {
    name: "ラストバトル主人公",
    desc: "最初から最後まで主役は自分。追い込まれてもエースの一撃で全部ひっくり返したいタイプです。",
    attrs: ["火", "光", "闇"],
    deck: "エースキャラにリソースを集め、ピンチ時のEXや大技で勝つ構成がおすすめ。ロマン火力との相性が抜群です。",
    weak: "小回りの利く速攻型、複数キャラで包囲してくる相手。"
  },
  "D-T-N-P": {
    name: "盤面ロック管理人",
    desc: "相手の選択肢を減らしながら、堅実に勝ちへ近づくタイプ。派手さよりも、相手が嫌がる動きを積み重ねるのが得意です。",
    attrs: ["水", "草", "鋼"],
    deck: "妨害、耐久、回復、配置制限を組み合わせる構成がおすすめ。相手の攻め筋を潰すカードを多めに入れると強いです。",
    weak: "一撃突破型や、妨害を無視してくる高火力エース。"
  },
  "D-T-N-R": {
    name: "粘着逆転コントローラー",
    desc: "耐えて、削って、最後にひっくり返すタイプ。相手からすると一番めんどくさいタイプかもしれません。",
    attrs: ["水", "草", "闇"],
    deck: "回復、耐久、状態異常、ピンチ時の逆転札を入れた長期戦デッキが向いています。勝ち方は地味でも強いです。",
    weak: "序盤から侵入勝ちを狙う高速デッキ。準備前に押し込まれると危険です。"
  },
  "D-T-E-P": {
    name: "要塞エース番長",
    desc: "守りの厚いエースを中心に、相手の攻撃を受け止めながら圧を返すタイプ。硬い、しぶとい、でも前に出る。",
    attrs: ["水", "鋼", "光"],
    deck: "高耐久エースに回復や防御補助を合わせる構成がおすすめ。エースを倒されにくくするカードを重視しましょう。",
    weak: "広範囲攻撃や、エース以外を狙って勝ち筋を作る相手。"
  },
  "D-T-E-R": {
    name: "不沈ラストボス型",
    desc: "倒したと思ったらまだ立っているタイプ。耐久と逆転力を重ね、終盤に真価を発揮します。",
    attrs: ["水", "鋼", "闇"],
    deck: "HP・SPが高いキャラ、回復、ダメージ軽減、ピンチ時の大技を組み合わせるのがおすすめです。",
    weak: "無視して侵入してくる相手や、継続的な状態異常で動きを止めてくる相手。"
  },
  "D-S-N-P": {
    name: "嫌がらせ展開職人",
    desc: "守りつつも、相手に圧をかける嫌らしいタイプ。複数キャラで妨害しながら、じわじわ勝ち筋を作ります。",
    attrs: ["草", "水", "風"],
    deck: "状態異常、射程、回復、低コスト展開を混ぜたデッキが合います。相手のストレス値を上げましょう。",
    weak: "妨害される前に火力で突破してくる相手。"
  },
  "D-S-N-R": {
    name: "泥試合リバーサー",
    desc: "きれいな勝ち方より、グチャグチャにして最後に勝つタイプ。試合が長引くほど味が出ます。",
    attrs: ["草", "闇", "水"],
    deck: "回復、妨害、ランダム性のある逆転札を入れて、相手の計算を狂わせる構成がおすすめです。",
    weak: "序盤で盤面を完成させる高速展開型。泥試合に持ち込めないと苦しいです。"
  },
  "D-S-E-P": {
    name: "耐久ゴリ押しエース",
    desc: "守るけど、結局は強い1体で押すタイプ。硬いエースが前に出て、相手に圧をかけ続けます。",
    attrs: ["水", "鋼", "火"],
    deck: "耐久力のあるエースに、火力技と防御補助を両方持たせるのがおすすめ。守りながら殴れる構成が合います。",
    weak: "SP攻撃、行動制限、遠距離から削ってくる相手。"
  },
  "D-S-E-R": {
    name: "不死身の大事故枠",
    desc: "倒れそうで倒れない。しかも最後に謎の大技で全部持っていくタイプ。安定よりもドラマを求めるデッキ性格です。",
    attrs: ["闇", "水", "光"],
    deck: "高耐久エース、ピンチ時強化、ロマン火力、回復を詰め込んだラスボス構成がおすすめです。",
    weak: "堅実にSPや行動を削ってくる相手。派手な逆転前に処理されると厳しいです。"
  }
};

const state = {
  index: 0,
  answers: [],
  score: {
    OD: 0,
    TS: 0,
    NE: 0,
    PR: 0
  }
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const startScreen = $("#startScreen");
const questionScreen = $("#questionScreen");
const resultScreen = $("#resultScreen");

const startBtn = $("#startBtn");
const backBtn = $("#backBtn");
const retryBtn = $("#retryBtn");
const shareBtn = $("#shareBtn");

const questionCount = $("#questionCount");
const questionNumber = $("#questionNumber");
const questionText = $("#questionText");
const axisBadge = $("#axisBadge");
const progressBar = $("#progressBar");

const meterOD = $("#meterOD");
const meterTS = $("#meterTS");
const meterNE = $("#meterNE");
const meterPR = $("#meterPR");

const resultCode = $("#resultCode");
const resultName = $("#resultName");
const resultDesc = $("#resultDesc");
const resultAttrs = $("#resultAttrs");
const resultDeck = $("#resultDeck");
const resultWeak = $("#resultWeak");

function showScreen(screen) {
  [startScreen, questionScreen, resultScreen].forEach((el) => {
    el.classList.remove("active");
  });

  screen.classList.add("active");
}

function resetState() {
  state.index = 0;
  state.answers = [];
  state.score = {
    OD: 0,
    TS: 0,
    NE: 0,
    PR: 0
  };
}

function startDiagnosis() {
  resetState();
  showScreen(questionScreen);
  renderQuestion();
  renderMeters();
}

function renderQuestion() {
  const q = QUESTIONS[state.index];
  const current = state.index + 1;
  const total = QUESTIONS.length;
  const progress = ((state.index) / total) * 100;

  questionCount.textContent = String(current);
  questionNumber.textContent = `QUESTION ${String(current).padStart(2, "0")}`;
  questionText.textContent = q.text;
  axisBadge.textContent = q.badge;
  progressBar.style.width = `${progress}%`;

  const card = $(".question-card");
  card.classList.remove("pop");
  void card.offsetWidth;
  card.classList.add("pop");
}

function renderMeters() {
  meterOD.textContent = String(state.score.OD);
  meterTS.textContent = String(state.score.TS);
  meterNE.textContent = String(state.score.NE);
  meterPR.textContent = String(state.score.PR);
}

function answerQuestion(answerType) {
  const q = QUESTIONS[state.index];

  let delta = 0;
  let chosenLetter = null;

  if (answerType === "yes") {
    chosenLetter = q.yes;
  } else if (answerType === "no") {
    chosenLetter = q.no;
  }

  if (chosenLetter) {
    delta = AXIS_SCORE[q.axis][chosenLetter] || 0;
  }

  state.answers[state.index] = {
    answerType,
    axis: q.axis,
    delta
  };

  recalcScore();

  if (state.index >= QUESTIONS.length - 1) {
    showResult();
    return;
  }

  state.index += 1;
  renderQuestion();
  renderMeters();
}

function recalcScore() {
  state.score = {
    OD: 0,
    TS: 0,
    NE: 0,
    PR: 0
  };

  state.answers.forEach((answer) => {
    if (!answer) return;
    state.score[answer.axis] += answer.delta;
  });
}

function goBack() {
  if (state.index <= 0) {
    showScreen(startScreen);
    return;
  }

  state.answers[state.index - 1] = null;
  state.index -= 1;
  recalcScore();
  renderQuestion();
  renderMeters();
}

function buildTypeCode() {
  const first = state.score.OD >= 0 ? "O" : "D";
  const second = state.score.TS >= 0 ? "T" : "S";
  const third = state.score.NE >= 0 ? "N" : "E";
  const fourth = state.score.PR >= 0 ? "P" : "R";

  return `${first}-${second}-${third}-${fourth}`;
}

function showResult() {
  progressBar.style.width = "100%";

  const code = buildTypeCode();
  const result = RESULTS[code] || createFallbackResult(code);

  resultCode.textContent = code;
  resultName.textContent = result.name;
  resultDesc.textContent = result.desc;
  resultDeck.textContent = result.deck;
  resultWeak.textContent = result.weak;

  resultAttrs.innerHTML = "";
  result.attrs.forEach((attr) => {
    const span = document.createElement("span");
    span.className = "tag";
    span.textContent = attr;
    resultAttrs.appendChild(span);
  });

  showScreen(resultScreen);
}

function createFallbackResult(code) {
  return {
    name: "未知のデッキ生命体",
    desc: `あなたは ${code} 型。まだ正式名称が設定されていない、謎多きデッキタイプです。`,
    attrs: ["？？？"],
    deck: "正式なタイプ名と説明を設定してください。",
    weak: "まだ不明です。"
  };
}

async function copyResult() {
  const text = [
    "【OTNP16タイプ診断】",
    `結果：${resultCode.textContent}`,
    `タイプ：${resultName.textContent}`,
    "",
    resultDesc.textContent
  ].join("\n");

  try {
    await navigator.clipboard.writeText(text);
    shareBtn.textContent = "コピーした！";
    setTimeout(() => {
      shareBtn.textContent = "結果をコピー";
    }, 1300);
  } catch (error) {
    shareBtn.textContent = "コピー失敗";
    setTimeout(() => {
      shareBtn.textContent = "結果をコピー";
    }, 1300);
  }
}

startBtn.addEventListener("click", startDiagnosis);
backBtn.addEventListener("click", goBack);
retryBtn.addEventListener("click", startDiagnosis);
shareBtn.addEventListener("click", copyResult);

$$(".answer-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const answer = btn.dataset.answer;
    answerQuestion(answer);
  });
});
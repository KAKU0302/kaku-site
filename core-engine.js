/**
 * core-engine.js
 * QUESTION（行動・心理質問）から CORE6 を算出するエンジン【仮実装】
 *
 * 確定仕様: CORE6 は6軸・0〜100のスコアで表現され、TYPE判定の入力になる（設計書 6章・8章）。
 * 仮実装: 30問の二択質問から算出する具体的なロジック・質問文言そのものは今後調整可能。
 *
 * 6軸から2つを選ぶ組み合わせ(6C2 = 15パターン)を2周ぶん（シーン違いで2問ずつ）用意し、
 * 各軸はちょうど10問に登場する（1問正解=1点、10点満点 → ×10 して0〜100にスケーリング）。
 * QUESTIONだけで判定を終えず、この後のBIRTH・STATEと掛け合わせて総合的にKAKUを算出する設計のため、
 * 質問数自体を過度に増やしすぎず、多角的な視点との組み合わせで精度を担保している（詳細はABOUTページに記載）。
 */

const CORE6_AXES = [
  { id: "vision", nameEn: "VISION", nameJp: "構想力" },
  { id: "logic", nameEn: "LOGIC", nameJp: "解析力" },
  { id: "drive", nameEn: "DRIVE", nameJp: "突破力" },
  { id: "influence", nameEn: "INFLUENCE", nameJp: "影響力" },
  { id: "bond", nameEn: "BOND", nameJp: "共鳴力" },
  { id: "stability", nameEn: "STABILITY", nameJp: "安定力" },
];

// 30問 = 6軸から2つを選ぶ組み合わせ(6C2=15パターン)を2周。各軸はちょうど10問に登場する。
const QUESTIONS = [
  {
    id: "q1",
    prompt: "新しいプロジェクトを任されたら、あなたはまず何をする？",
    optionA: { axis: "vision", text: "まだ誰も考えていない可能性を思い描く" },
    optionB: { axis: "logic", text: "現状を整理し、筋道を立てて分析する" },
  },
  {
    id: "q2",
    prompt: "興味のあることを見つけたとき、あなたは？",
    optionA: { axis: "vision", text: "頭の中で理想の形をじっくり思い描く" },
    optionB: { axis: "drive", text: "とにかくすぐに行動して試してみる" },
  },
  {
    id: "q3",
    prompt: "自分のアイデアを、あなたはどう活かしたい？",
    optionA: { axis: "vision", text: "一人でじっくり形にしていきたい" },
    optionB: { axis: "influence", text: "人に話して共感や協力を得たい" },
  },
  {
    id: "q4",
    prompt: "将来について考えるとき、大事にしたいのは？",
    optionA: { axis: "vision", text: "自分がどうなりたいか、理想像を描くこと" },
    optionB: { axis: "bond", text: "大切な人たちとどう関わっていたいかを考えること" },
  },
  {
    id: "q5",
    prompt: "計画を立てるとき、あなたは？",
    optionA: { axis: "vision", text: "まだ形のない可能性にワクワクする" },
    optionB: { axis: "stability", text: "現実的に実行できる手順を固めたい" },
  },
  {
    id: "q6",
    prompt: "問題が起きたとき、あなたは？",
    optionA: { axis: "logic", text: "原因を分析してから動きたい" },
    optionB: { axis: "drive", text: "考えるより先に手を動かして試したい" },
  },
  {
    id: "q7",
    prompt: "意見が対立したとき、あなたは？",
    optionA: { axis: "logic", text: "データや事実で筋道立てて説明する" },
    optionB: { axis: "influence", text: "熱意や言葉で相手の気持ちに訴える" },
  },
  {
    id: "q8",
    prompt: "誰かに相談されたとき、あなたは？",
    optionA: { axis: "logic", text: "問題を整理して解決策を一緒に考える" },
    optionB: { axis: "bond", text: "まず気持ちに寄り添い共感する" },
  },
  {
    id: "q9",
    prompt: "作業を進めるとき、あなたは？",
    optionA: { axis: "logic", text: "効率的な最適解を見つけたい" },
    optionB: { axis: "stability", text: "決まった手順を丁寧に守りたい" },
  },
  {
    id: "q10",
    prompt: "やる気が出るのは、どんなとき？",
    optionA: { axis: "drive", text: "困難な壁を突破できたとき" },
    optionB: { axis: "influence", text: "自分の言葉で人が動いたとき" },
  },
  {
    id: "q11",
    prompt: "仲間と一緒に何かに取り組むとき、あなたは？",
    optionA: { axis: "drive", text: "誰よりも早く成果を出したい" },
    optionB: { axis: "bond", text: "仲間との関係を大切にしながら進めたい" },
  },
  {
    id: "q12",
    prompt: "目標に向かうとき、あなたは？",
    optionA: { axis: "drive", text: "一気に突き進みたい" },
    optionB: { axis: "stability", text: "無理せず着実なペースを保ちたい" },
  },
  {
    id: "q13",
    prompt: "人と関わるとき、大事にしたいのは？",
    optionA: { axis: "influence", text: "自分の考えを伝えて影響を与えること" },
    optionB: { axis: "bond", text: "相手の気持ちに寄り添い、信頼関係を築くこと" },
  },
  {
    id: "q14",
    prompt: "評価されたいのは、どんなところ？",
    optionA: { axis: "influence", text: "人を動かし、場を盛り上げる力" },
    optionB: { axis: "stability", text: "変わらず信頼できる、安定した仕事ぶり" },
  },
  {
    id: "q15",
    prompt: "大切にしたい安心感とは？",
    optionA: { axis: "bond", text: "気持ちが通じ合う人間関係がある安心感" },
    optionB: { axis: "stability", text: "変化が少なく、見通しが立つ安心感" },
  },
  {
    id: "q16",
    prompt: "休日に何かを学ぶとしたら？",
    optionA: { axis: "vision", text: "まだ誰も答えを出していないテーマに惹かれる" },
    optionB: { axis: "logic", text: "体系立てて学べる分野を選びたい" },
  },
  {
    id: "q17",
    prompt: "5年後の理想を聞かれたら？",
    optionA: { axis: "vision", text: "具体的な理想像をイメージするのが好き" },
    optionB: { axis: "drive", text: "考えるよりまず動いて、道を切り拓いていたい" },
  },
  {
    id: "q18",
    prompt: "自分のアイデアが認められたとき、うれしいのは？",
    optionA: { axis: "vision", text: "頭の中にあった構想が形になったこと" },
    optionB: { axis: "influence", text: "そのアイデアに人が共感し、動いてくれたこと" },
  },
  {
    id: "q19",
    prompt: "休みの日、心が満たされるのは？",
    optionA: { axis: "vision", text: "新しい可能性についてじっくり考える時間" },
    optionB: { axis: "bond", text: "大切な人と過ごす時間" },
  },
  {
    id: "q20",
    prompt: "5年後の自分を考えるとき？",
    optionA: { axis: "vision", text: "今とは全く違う可能性にワクワクする" },
    optionB: { axis: "stability", text: "今の積み重ねの延長線上にいたい" },
  },
  {
    id: "q21",
    prompt: "何か新しいことを始めるとき、あなたは？",
    optionA: { axis: "logic", text: "まず情報を集めて理解してから動きたい" },
    optionB: { axis: "drive", text: "考えるより先にやってみたい" },
  },
  {
    id: "q22",
    prompt: "自分の考えを人に伝えるとき、あなたは？",
    optionA: { axis: "logic", text: "根拠やデータを示して納得してもらいたい" },
    optionB: { axis: "influence", text: "情熱や言葉の力で心を動かしたい" },
  },
  {
    id: "q23",
    prompt: "友人が悩んでいるとき、あなたは？",
    optionA: { axis: "logic", text: "一緒に原因を整理して、解決策を考えたい" },
    optionB: { axis: "bond", text: "まず話を聞いて、寄り添ってあげたい" },
  },
  {
    id: "q24",
    prompt: "仕事を任されたとき、あなたは？",
    optionA: { axis: "logic", text: "もっと良いやり方がないか工夫したい" },
    optionB: { axis: "stability", text: "決められた手順を確実にこなしたい" },
  },
  {
    id: "q25",
    prompt: "チームで成果を出したいとき、あなたは？",
    optionA: { axis: "drive", text: "誰よりも早く行動して結果を出したい" },
    optionB: { axis: "influence", text: "みんなを鼓舞して巻き込みたい" },
  },
  {
    id: "q26",
    prompt: "困難な状況に直面したとき、あなたは？",
    optionA: { axis: "drive", text: "とにかく突破口を見つけて前に進みたい" },
    optionB: { axis: "bond", text: "仲間と支え合いながら乗り越えたい" },
  },
  {
    id: "q27",
    prompt: "スケジュールを立てるとき、あなたは？",
    optionA: { axis: "drive", text: "多少無理してでも一気に終わらせたい" },
    optionB: { axis: "stability", text: "無理のないペースで着実に進めたい" },
  },
  {
    id: "q28",
    prompt: "人から相談を受けたとき、あなたは？",
    optionA: { axis: "influence", text: "自分の考えをはっきり伝えてあげたい" },
    optionB: { axis: "bond", text: "相手の気持ちにそっと寄り添いたい" },
  },
  {
    id: "q29",
    prompt: "自分が誇りに思うのは？",
    optionA: { axis: "influence", text: "周りを巻き込み、場を動かせること" },
    optionB: { axis: "stability", text: "どんな時も変わらず信頼されること" },
  },
  {
    id: "q30",
    prompt: "居心地の良さを感じるのは？",
    optionA: { axis: "bond", text: "気持ちが通じ合う相手といるとき" },
    optionB: { axis: "stability", text: "予定通り、安定した日常を送れているとき" },
  },
];

/**
 * answers: { q1: "A"|"B", q2: "A"|"B", ... } 形式
 * 戻り値: {
 *   scores: { vision: 0-100, logic: 0-100, ... },
 *   ranking: [{axis, score}, ...] スコア降順,
 *   topAxis: 最高スコアの軸id,
 *   secondAxis: 2番目の軸id
 * }
 */
function computeCore6(answers) {
  const raw = {};
  CORE6_AXES.forEach((a) => (raw[a.id] = 0));

  QUESTIONS.forEach((q) => {
    const choice = answers[q.id];
    if (choice === "A") raw[q.optionA.axis] += 1;
    else if (choice === "B") raw[q.optionB.axis] += 1;
  });

  const scores = {};
  Object.keys(raw).forEach((axis) => {
    scores[axis] = raw[axis] * 10; // 0-10点 → 0-100
  });

  const ranking = Object.keys(scores)
    .map((axis) => ({ axis, score: scores[axis] }))
    .sort((a, b) => b.score - a.score);

  return {
    scores,
    ranking,
    topAxis: ranking[0].axis,
    secondAxis: ranking[1].axis,
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { CORE6_AXES, QUESTIONS, computeCore6 };
}

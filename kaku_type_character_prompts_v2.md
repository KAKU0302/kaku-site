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
    optionA: { axis: "logic", text: "体系立てて学べる分野を選びたい" },
    optionB: { axis: "vision", text: "まだ誰も答えを出していないテーマに惹かれる" },
  },
  {
    id: "q17",
    prompt: "5年後の理想を聞かれたら？",
    optionA: { axis: "drive", text: "考えるよりまず動いて、道を切り拓いていたい" },
    optionB: { axis: "vision", text: "具体的な理想像をイメージするのが好き" },
  },
  {
    id: "q18",
    prompt: "自分のアイデアが認められたとき、うれしいのは？",
    optionA: { axis: "influence", text: "そのアイデアに人が共感し、動いてくれたこと" },
    optionB: { axis: "vision", text: "頭の中にあった構想が形になったこと" },
  },
  {
    id: "q19",
    prompt: "休みの日、心が満たされるのは？",
    optionA: { axis: "bond", text: "大切な人と過ごす時間" },
    optionB: { axis: "vision", text: "新しい可能性についてじっくり考える時間" },
  },
  {
    id: "q20",
    prompt: "5年後の自分を考えるとき？",
    optionA: { axis: "stability", text: "今の積み重ねの延長線上にいたい" },
    optionB: { axis: "vision", text: "今とは全く違う可能性にワクワクする" },
  },
  {
    id: "q21",
    prompt: "何か新しいことを始めるとき、あなたは？",
    optionA: { axis: "drive", text: "考えるより先にやってみたい" },
    optionB: { axis: "logic", text: "まず情報を集めて理解してから動きたい" },
  },
  {
    id: "q22",
    prompt: "自分の考えを人に伝えるとき、あなたは？",
    optionA: { axis: "influence", text: "情熱や言葉の力で心を動かしたい" },
    optionB: { axis: "logic", text: "根拠やデータを示して納得してもらいたい" },
  },
  {
    id: "q23",
    prompt: "友人が悩んでいるとき、あなたは？",
    optionA: { axis: "bond", text: "まず話を聞いて、寄り添ってあげたい" },
    optionB: { axis: "logic", text: "一緒に原因を整理して、解決策を考えたい" },
  },
  {
    id: "q24",
    prompt: "仕事を任されたとき、あなたは？",
    optionA: { axis: "stability", text: "決められた手順を確実にこなしたい" },
    optionB: { axis: "logic", text: "もっと良いやり方がないか工夫したい" },
  },
  {
    id: "q25",
    prompt: "チームで成果を出したいとき、あなたは？",
    optionA: { axis: "influence", text: "みんなを鼓舞して巻き込みたい" },
    optionB: { axis: "drive", text: "誰よりも早く行動して結果を出したい" },
  },
  {
    id: "q26",
    prompt: "困難な状況に直面したとき、あなたは？",
    optionA: { axis: "bond", text: "仲間と支え合いながら乗り越えたい" },
    optionB: { axis: "drive", text: "とにかく突破口を見つけて前に進みたい" },
  },
  {
    id: "q27",
    prompt: "スケジュールを立てるとき、あなたは？",
    optionA: { axis: "stability", text: "無理のないペースで着実に進めたい" },
    optionB: { axis: "drive", text: "多少無理してでも一気に終わらせたい" },
  },
  {
    id: "q28",
    prompt: "人から相談を受けたとき、あなたは？",
    optionA: { axis: "bond", text: "相手の気持ちにそっと寄り添いたい" },
    optionB: { axis: "influence", text: "自分の考えをはっきり伝えてあげたい" },
  },
  {
    id: "q29",
    prompt: "自分が誇りに思うのは？",
    optionA: { axis: "stability", text: "どんな時も変わらず信頼されること" },
    optionB: { axis: "influence", text: "周りを巻き込み、場を動かせること" },
  },
  {
    id: "q30",
    prompt: "居心地の良さを感じるのは？",
    optionA: { axis: "stability", text: "予定通り、安定した日常を送れているとき" },
    optionB: { axis: "bond", text: "気持ちが通じ合う相手といるとき" },
  },
];

// 文字列から決定的な32bit整数を作る簡易ハッシュ（FNV-1a）。
// 同点タイブレークの最終手段として、「回答内容＋軸id」から一意な値を作るのに使う。
// 乱数(Math.random)ではないので、同じ回答なら何度計算しても必ず同じ値になる。
function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

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

  // 軸ペアごとの直接対決の勝敗数（同点タイブレークに使用）。
  // 30問は6軸の全ペア(6C2=15通り)を2問ずつ比較する構成になっているため、
  // 総合点が同点でも「その2軸を直接比べた質問でどちらを多く選んだか」で優劣を決められる。
  const headToHead = {};
  CORE6_AXES.forEach((a) => {
    headToHead[a.id] = {};
    CORE6_AXES.forEach((b) => {
      headToHead[a.id][b.id] = 0;
    });
  });

  QUESTIONS.forEach((q) => {
    const choice = answers[q.id];
    if (choice === "A") {
      raw[q.optionA.axis] += 1;
      headToHead[q.optionA.axis][q.optionB.axis] += 1;
    } else if (choice === "B") {
      raw[q.optionB.axis] += 1;
      headToHead[q.optionB.axis][q.optionA.axis] += 1;
    }
  });

  const scores = {};
  Object.keys(raw).forEach((axis) => {
    scores[axis] = raw[axis] * 10; // 0-10点 → 0-100
  });

  // 直接対決（2問）の勝敗も1-1で決着がつかないケースが多いため、それでも同点が残る場合は
  // 最後に「回答内容＋軸id」から作った決定的な値（乱数ではない）で優劣をつける。
  // これにより、CORE6_AXESの配列順（vision→logic→…）に固定で偏る（同点なら毎回visionが
  // 主軸になり、「ARCHITECTばかり出る」といった結果につながる）ことを防いでいる。
  const answerKey = QUESTIONS.map((q) => answers[q.id] || "-").join("");
  const ranking = Object.keys(scores)
    .map((axis) => ({ axis, score: scores[axis] }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const h2h = headToHead[b.axis][a.axis] - headToHead[a.axis][b.axis];
      if (h2h !== 0) return h2h;
      return hashString(b.axis + "|" + answerKey) - hashString(a.axis + "|" + answerKey);
    });

  return {
    scores,
    ranking,
    topAxis: ranking[0].axis,
    secondAxis: ranking[1].axis,
  };
}

/**
 * CORE6の各軸を「高い（70以上）／平均的（40〜69）／控えめ（40未満）」の3段階に分け、
 * スコアの数値だけでは伝わらない意味を言葉で補うための解説文【仮実装】。
 * PERSONAL BOOKなど、無料診断より踏み込んだ解説が必要な場面で使用する。
 */
const CORE6_TIER_COMMENTARY = {
  vision: {
    high: "VISIONの数値が高いあなたは、まだ見えていない可能性を思い描く力が際立っています。ゼロから発想する場面で強みを発揮できるはずです。",
    mid: "VISIONは平均的な水準です。必要な場面ではアイデアを描けますが、それを主軸にするタイプではなさそうです。",
    low: "VISIONの数値は控えめです。抽象的な可能性より、目の前の現実的な選択肢を重視するタイプと言えます。",
  },
  logic: {
    high: "LOGICが高いあなたは、物事を筋道立てて理解し、根拠をもって判断する力に長けています。",
    mid: "LOGICは平均的です。必要に応じて分析はできますが、それだけで動くタイプではなさそうです。",
    low: "LOGICの数値は控えめです。分析よりも感覚や勢いを大切にするタイプと言えます。",
  },
  drive: {
    high: "DRIVEが高いあなたは、迷うより先に動き出す行動力が武器です。困難な状況ほど力を発揮します。",
    mid: "DRIVEは平均的です。状況次第で行動力を発揮しますが、常に前のめりというわけではなさそうです。",
    low: "DRIVEの数値は控えめです。勢いで動くより、慎重に見極めてから動くタイプと言えます。",
  },
  influence: {
    high: "INFLUENCEが高いあなたは、言葉や熱量で周囲を動かす力に長けています。",
    mid: "INFLUENCEは平均的です。必要な場面では発信できますが、常に前に出るタイプではなさそうです。",
    low: "INFLUENCEの数値は控えめです。人を動かすより、静かに実力で語るタイプと言えます。",
  },
  bond: {
    high: "BONDが高いあなたは、人の気持ちに寄り添い、関係性の中で力を発揮するタイプです。",
    mid: "BONDは平均的です。関係性を大切にはしますが、それだけに頼らないバランス感覚があります。",
    low: "BONDの数値は控えめです。関係性より、成果や役割そのものに重きを置くタイプと言えます。",
  },
  stability: {
    high: "STABILITYが高いあなたは、着実に積み重ね、変化の中でも安定を保つ力があります。",
    mid: "STABILITYは平均的です。安定も大事にしつつ、状況に応じて変化も受け入れられます。",
    low: "STABILITYの数値は控えめです。安定よりも変化やスピード感を求めるタイプと言えます。",
  },
};

function getAxisCommentary(axisId, score) {
  const tiers = CORE6_TIER_COMMENTARY[axisId];
  if (!tiers) return "";
  if (score >= 70) return tiers.high;
  if (score >= 40) return tiers.mid;
  return tiers.low;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { CORE6_AXES, QUESTIONS, computeCore6, CORE6_TIER_COMMENTARY, getAxisCommentary };
}

/**
 * gap-engine.js
 * KAKU GAP（QUESTION と BIRTH と STATE のズレを解析する）エンジン【仮実装】
 *
 * 確定仕様（設計書 7章）:
 *  - KAKU GAPは「本来の資質(BIRTH)」と「今よく使っている力(QUESTION)」のズレを見るものであり、
 *    能力の優劣ではなく、今の環境がその資質を発揮させやすいかどうかを語るものである。
 *  - 医療・心理的な診断ではないことを明示する。
 *
 * 仮実装: BIRTHとQUESTIONの最有力軸が一致するかどうか、かつSTATEの状態を組み合わせて
 * メッセージを動的に生成するテンプレートロジック。将来的にはより多面的な比較ロジックに拡張可能。
 */

// 表記は「日本語（英語）」の順（英語部分は本文中では薄いグレーで表示するため、
// 呼び出し側のCSS（.axis-en）が効くよう<span>で囲んでいる）。
// 力の名前は app.js の AXIS_POWER_NAMES と揃えている（サイト全体で軸の呼び方を統一するため）。
const CORE6_LABELS = {
  vision: '未来を描く力<span class="axis-en">（VISION）</span>',
  logic: '構造を見抜く力<span class="axis-en">（LOGIC）</span>',
  drive: '壁を破る力<span class="axis-en">（DRIVE）</span>',
  influence: '人を動かす力<span class="axis-en">（INFLUENCE）</span>',
  bond: '心を通わせる力<span class="axis-en">（BOND）</span>',
  stability: '積み上げる力<span class="axis-en">（STABILITY）</span>',
};

const GOOD_STATES = ["FLOW", "STABLE"];
const HARD_STATES = ["OVERLOAD", "STAGNATION", "SEARCHING"];

// 「本来のあなた」「今のあなた」を1文で語るための、軸ごとの動詞句。
// KAKU GAPの体験（本来の資質→今の状態→GAPの数値→なぜ）の文章を組み立てる際に使う。
const AXIS_VERB_PHRASES = {
  vision: "まだ見えていない可能性を思い描く",
  logic: "物事を筋道立てて理解する",
  drive: "迷わず動き出す",
  influence: "人を巻き込み、動かす",
  bond: "人の気持ちに寄り添う",
  stability: "着実に積み上げ、支える",
};

/**
 * KAKU GAPの数値化ロジック【仮実装】。ランダム生成はせず、以下2つの実測値から
 * 決定的に算出する（同じ入力なら常に同じ結果になる）。将来、重み付けや算出式は
 * 診断ロジックとして調整可能な構造にしてある。
 *
 *  1) 軸のズレ：QUESTIONで一番使っている力(questionTopAxis)のスコアと、
 *     本来の資質であるBIRTH軸(birthAxis)のスコアの差。一致していれば必ず0になる
 *     （topAxisは定義上つねに最大スコアのため）。
 *  2) 状態のズレ：STATE（今の状態）の平均点(1〜5)が低いほど、本来の資質を
 *     発揮できていない度合いが強いとみなし、平均3を基準に加点する。
 */
function computeGapScore(core6Scores, questionTopAxis, birthAxis, stateAverage) {
  const axisDiff = Math.max(0, (core6Scores[questionTopAxis] || 0) - (core6Scores[birthAxis] || 0));
  const stateDiff = Math.max(0, 3 - (Number(stateAverage) || 3)) * 20;
  const raw = axisDiff * 0.55 + stateDiff;
  // 0点・100点に張り付かせない（「完全に一致」「完全にズレている」という断定を避けるため）。
  return Math.max(4, Math.min(96, Math.round(raw)));
}

function getGapTier(score) {
  if (score < 35) return { key: "small", label: "GAPは小さめ" };
  if (score < 65) return { key: "medium", label: "GAPが見られます" };
  return { key: "large", label: "GAPが大きく出ています" };
}

/**
 * questionTopAxis: QUESTIONで最もスコアが高かった軸 id
 * birthAxis: BIRTHの軸 id
 * stateKey: STATEの分類 key（FLOW/STABLE/SEARCHING/STAGNATION/OVERLOAD）
 * core6Scores: computeCore6() の scores（{vision:0-100, ...}）｜GAPスコア算出に使用
 * stateAverage: computeState() の average（1〜5）｜GAPスコア算出に使用
 *
 * 戻り値: {
 *   matched, headline, message,
 *   score, tier,           … KAKU GAPの数値化（0〜96）と3段階の判定
 *   beforeText, afterText  … 「本来のあなた」「今のあなた」を語る1文ずつ
 * }
 */
function computeGap(questionTopAxis, birthAxis, stateKey, core6Scores, stateAverage) {
  const matched = questionTopAxis === birthAxis;
  const questionLabel = CORE6_LABELS[questionTopAxis];
  const birthLabel = CORE6_LABELS[birthAxis];
  const isGoodState = GOOD_STATES.includes(stateKey);

  const score = core6Scores ? computeGapScore(core6Scores, questionTopAxis, birthAxis, stateAverage) : null;
  const tier = score !== null ? getGapTier(score) : null;

  const beforeText = `本来のあなたは、${AXIS_VERB_PHRASES[birthAxis]}ことに力を発揮するタイプです。`;
  const afterText = matched
    ? `今のあなたも、その${questionLabel}をそのまま活かせています。`
    : `しかし今のあなたは、${AXIS_VERB_PHRASES[questionTopAxis]}ことに、日々のエネルギーを使っています。`;

  if (matched) {
    const headline = "GAPは小さめ｜資質と行動が一致しています";
    let message =
      `生まれ持った資質は${birthLabel}、今いちばんよく使っている力も${questionLabel}で、両者が一致しています。` +
      `素の自分をそのまま発揮できている状態と言えます。`;
    if (isGoodState) {
      message += " 今の環境は、その資質を活かしやすい環境になっているようです。";
    } else {
      message +=
        " ただし今の状態は万全とは言えないようなので、資質そのものより、休息や環境の負荷を見直すことがヒントになるかもしれません。";
    }
    return { matched, headline, message, score, tier, beforeText, afterText };
  }

  const headline = "GAPが見られます｜資質と行動にズレがあります";
  let message =
    `生まれ持った資質は${birthLabel}ですが、今いちばんよく使っている力は${questionLabel}で、両者にズレがあります。` +
    `これは能力が足りないという意味ではなく、今の環境が本来の資質を発揮しにくい状況になっている可能性を示しています。`;
  if (isGoodState) {
    message +=
      " 今の状態自体は悪くなさそうなので、今のやり方に無理に合わせようとしすぎていないか、一度振り返ってみると良いかもしれません。";
  } else {
    message +=
      " 今の状態も揺らいでいるようなので、本来の資質を活かせる関わり方・環境に少しずつ寄せていくことが、状態の回復にもつながりそうです。";
  }
  return { matched, headline, message, score, tier, beforeText, afterText };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { CORE6_LABELS, AXIS_VERB_PHRASES, computeGapScore, getGapTier, computeGap };
}

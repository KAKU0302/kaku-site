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
const CORE6_LABELS = {
  vision: '構想力<span class="axis-en">（VISION）</span>',
  logic: '解析力<span class="axis-en">（LOGIC）</span>',
  drive: '突破力<span class="axis-en">（DRIVE）</span>',
  influence: '影響力<span class="axis-en">（INFLUENCE）</span>',
  bond: '共鳴力<span class="axis-en">（BOND）</span>',
  stability: '安定力<span class="axis-en">（STABILITY）</span>',
};

const GOOD_STATES = ["FLOW", "STABLE"];
const HARD_STATES = ["OVERLOAD", "STAGNATION", "SEARCHING"];

/**
 * questionTopAxis: QUESTIONで最もスコアが高かった軸 id
 * birthAxis: BIRTHの軸 id
 * stateKey: STATEの分類 key（FLOW/STABLE/SEARCHING/STAGNATION/OVERLOAD）
 *
 * 戻り値: { matched: boolean, headline, message }
 */
function computeGap(questionTopAxis, birthAxis, stateKey) {
  const matched = questionTopAxis === birthAxis;
  const questionLabel = CORE6_LABELS[questionTopAxis];
  const birthLabel = CORE6_LABELS[birthAxis];
  const isGoodState = GOOD_STATES.includes(stateKey);

  if (matched) {
    const headline = "GAPは小さめ｜資質と行動が一致しています";
    let message =
      `生まれ持った資質は${birthLabel}、今いちばんよく使っている力も${questionLabel}で、両者が一致しています。` +
      `素の自分をそのまま発揮できている状態と言えます。`;
    if (isGoodState) {
      message += " 今の環境は、その資質を活かしやすい環境になっているようです。";
    } else {
      message +=
        " ただし今の状態（STATE）は万全とは言えないようなので、資質そのものより、休息や環境の負荷を見直すことがヒントになるかもしれません。";
    }
    return { matched, headline, message };
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
      " 今の状態（STATE）も揺らいでいるようなので、本来の資質を活かせる関わり方・環境に少しずつ寄せていくことが、状態の回復にもつながりそうです。";
  }
  return { matched, headline, message };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { CORE6_LABELS, computeGap };
}

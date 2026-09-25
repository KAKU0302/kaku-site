/**
 * state-engine.js
 * 「今の状態（STATE）」を診断するエンジン【仮実装】
 *
 * 確定仕様: STATEは以下5つの状態のいずれかに分類される（設計書 5章）。
 *   FLOW｜充実・STABLE｜安定・SEARCHING｜探索・STAGNATION｜停滞・OVERLOAD｜過負荷
 * STATEはあくまで「今の環境・状況」を映すものであり、性格診断ではない。
 *
 * 仮実装: 6項目のリッカート尺度（1〜5）と、シンプルなルールベースの分類ロジック。
 * 将来的により精緻な質問・分類ロジックに差し替え可能な構造にしている。
 */

const STATE_QUESTIONS = [
  { id: "s1", key: "meaning", prompt: "今の環境で、自分の意味や意義を感じている" },
  { id: "s2", key: "capability", prompt: "自分の能力を十分に発揮できていると感じる" },
  { id: "s3", key: "challenge", prompt: "新しいことに挑戦したい気持ちが強い" },
  { id: "s4", key: "relationship", prompt: "周囲の人間関係に満足している" },
  { id: "s5", key: "rest", prompt: "十分な休息が取れている" },
  { id: "s6", key: "hope", prompt: "将来に対して期待を持てている" },
];

const STATE_DEFINITIONS = {
  FLOW: {
    key: "FLOW",
    label: "FLOW｜充実",
    description:
      "今のあなたは、自分の力を発揮しながら前向きに進めている状態です。意味・能力・関係性のバランスが取れており、今の環境がうまく噛み合っています。",
  },
  STABLE: {
    key: "STABLE",
    label: "STABLE｜安定",
    description:
      "今のあなたは、大きな波はないものの落ち着いて過ごせている状態です。急激な変化は少ないぶん、次の一歩を自分から仕掛けることで、さらに状態を上げていけます。",
  },
  SEARCHING: {
    key: "SEARCHING",
    label: "SEARCHING｜探索",
    description:
      "今のあなたは、新しい挑戦を求めながらも、今の環境に意味を見出しきれていない状態です。今の場所に留まるか、新しい環境を探すか、模索している時期と言えます。",
  },
  STAGNATION: {
    key: "STAGNATION",
    label: "STAGNATION｜停滞",
    description:
      "今のあなたは、意味・能力発揮・関係性のいずれもが十分に満たされていない状態です。今の環境が、本来の力を発揮しにくい状況になっている可能性があります。",
  },
  OVERLOAD: {
    key: "OVERLOAD",
    label: "OVERLOAD｜過負荷",
    description:
      "今のあなたは、一定の手応えを感じながらも、休息が不足している状態です。頑張れているからこそ、意識的に負荷を調整するタイミングかもしれません。",
  },
};

/**
 * answers: { s1: 1-5, s2: 1-5, ..., s6: 1-5 }
 * 戻り値: { key, label, description, average }
 *
 * 仮実装ロジック（優先順位つきルールベース）:
 *  1) 休息が低い(<=2) かつ 全体平均がそこそこ以上(>=2.5) → OVERLOAD（頑張れてはいるが休めていない）
 *  2) 全体平均が高い(>=4) → FLOW
 *  3) 挑戦したい気持ちが高い(>=4) かつ 意味を感じる度合いが低い(<=2.5) → SEARCHING
 *  4) 全体平均が低い(<=2.5) → STAGNATION
 *  5) それ以外 → STABLE
 */
function computeState(answers) {
  const values = STATE_QUESTIONS.map((q) => Number(answers[q.id]) || 0);
  const sum = values.reduce((a, b) => a + b, 0);
  const average = sum / STATE_QUESTIONS.length;

  const byKey = {};
  STATE_QUESTIONS.forEach((q) => (byKey[q.key] = Number(answers[q.id]) || 0));

  let stateKey;
  if (byKey.rest <= 2 && average >= 2.5) {
    stateKey = "OVERLOAD";
  } else if (average >= 4) {
    stateKey = "FLOW";
  } else if (byKey.challenge >= 4 && byKey.meaning <= 2.5) {
    stateKey = "SEARCHING";
  } else if (average <= 2.5) {
    stateKey = "STAGNATION";
  } else {
    stateKey = "STABLE";
  }

  const def = STATE_DEFINITIONS[stateKey];
  return {
    key: def.key,
    label: def.label,
    description: def.description,
    average,
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { STATE_QUESTIONS, STATE_DEFINITIONS, computeState };
}

/**
 * birth-engine.js
 * 生年月日から「生まれ持った傾向（BIRTH KAKU）」を導き出すエンジン【仮実装】
 *
 * 確定仕様: BIRTHは「QUESTION（今の行動パターン）」とは独立した、生まれ持った資質の物語であり、
 * CORE6のスコアに数値として直接加算・混入させてはいけない（設計書 5章・7章）。
 * あくまでKAKU GAP（本来の資質 と 今の行動パターン のズレ）を語るための、別軸の情報として扱う。
 *
 * 仮実装: 旧サイトで使用していた算命学（十大主星）ベースの複雑な計算を、
 * 生年月日から6軸のいずれかへ決定的にマッピングする簡易ロジックに置き換えている。
 * 将来的により精緻な計算式（四柱推命・算命学など）に差し替えることを想定した設計とする。
 */

const BIRTH_AXIS_ORDER = ["vision", "logic", "drive", "influence", "bond", "stability"];

const BIRTH_DESCRIPTIONS = {
  vision: {
    title: "構想型",
    description:
      "生まれ持った傾向として、まだ形になっていない可能性を思い描く力を強く持っています。" +
      "目の前のことよりも「この先どうなりたいか」「何が実現できるか」という問いに、自然と意識が向かうタイプです。",
  },
  logic: {
    title: "解析型",
    description:
      "生まれ持った傾向として、物事を筋道立てて理解しようとする力を強く持っています。" +
      "感覚よりも、根拠や構造を確かめながら納得したいという姿勢が、幼い頃から自然と身についているタイプです。",
  },
  drive: {
    title: "突破型",
    description:
      "生まれ持った傾向として、迷うより先に動いてみる力を強く持っています。" +
      "困難な状況ほど力が湧いてくる、行動そのものにエネルギーを感じるタイプです。",
  },
  influence: {
    title: "影響型",
    description:
      "生まれ持った傾向として、自分の言葉や熱量で周囲を動かす力を強く持っています。" +
      "一人で完結するより、人に伝え、巻き込みながら物事を進めたいという性質が根っこにあるタイプです。",
  },
  bond: {
    title: "共鳴型",
    description:
      "生まれ持った傾向として、人の気持ちに寄り添い、関係性の中で力を発揮する力を強く持っています。" +
      "成果そのものよりも、誰とどう関わったかを大切にする性質が根っこにあるタイプです。",
  },
  stability: {
    title: "安定型",
    description:
      "生まれ持った傾向として、着実に積み重ね、変化の中でも安定を保つ力を強く持っています。" +
      "一気に変えるより、確かな手順を踏みながら前に進みたいという性質が根っこにあるタイプです。",
  },
};

/**
 * dateStr: "YYYY-MM-DD" 形式の文字列
 * 戻り値: { axis, title, description }
 *
 * 仮実装ロジック: (年 + 月×31 + 日) % 6 で6軸のいずれかに決定的にマッピングする。
 * 同じ生年月日なら常に同じ結果になる（＝再現性のある「生まれ持った資質」として扱える）。
 */
function computeBirth(dateStr) {
  const parsed = new Date(dateStr);
  const year = parsed.getFullYear();
  const month = parsed.getMonth() + 1;
  const day = parsed.getDate();

  const index = Math.abs(year + month * 31 + day) % BIRTH_AXIS_ORDER.length;
  const axis = BIRTH_AXIS_ORDER[index];
  const info = BIRTH_DESCRIPTIONS[axis];

  return {
    axis,
    title: info.title,
    description: info.description,
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { BIRTH_AXIS_ORDER, BIRTH_DESCRIPTIONS, computeBirth };
}

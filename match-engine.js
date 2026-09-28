/**
 * match-engine.js
 * KAKU MATCH（2人のKAKUを重ね合わせる）機能の【プレビュー用】簡易ロジック
 *
 * 確定仕様: KAKU MATCHの実際の決済・本番ロジックは設計書12章により将来拡張扱いであり、
 * このMVPには含まれない。PERSONAL BOOKの第4章として統合し、購入前サンプルとして提供する。
 *
 * 仮実装: 「恋愛」「結婚」「仕事」という3つの軸それぞれで、CORE6の6軸をどれだけ重視するかの
 * 重み付けを変え、2人のCORE6スコアの近さ（軸ごとの差の小ささ）から0〜100の相性スコアを算出する。
 * 診断済みの自分自身は実際のQUESTIONスコア（session.core6.scores）を使い、
 * サンプルとして選ぶ「お相手」は診断データがないため、そのタイプの主軸・副軸から
 * 推定した代表的なCORE6プロフィールを使う。実際の有料版では、お相手にも診断してもらい、
 * 実データ同士で算出する想定。
 */

const MATCH_AXIS_ORDER = ["vision", "logic", "drive", "influence", "bond", "stability"];

// カテゴリごとに、CORE6のどの軸を重視するかの重み（合計1.0になるよう設計）
const CATEGORY_WEIGHTS = {
  romance: { vision: 0.10, logic: 0.05, drive: 0.15, influence: 0.25, bond: 0.35, stability: 0.10 },
  marriage: { vision: 0.05, logic: 0.10, drive: 0.05, influence: 0.10, bond: 0.30, stability: 0.40 },
  work: { vision: 0.20, logic: 0.25, drive: 0.20, influence: 0.10, bond: 0.05, stability: 0.20 },
};

const CATEGORY_META = {
  romance: { key: "romance", label: "恋愛" },
  marriage: { key: "marriage", label: "結婚" },
  work: { key: "work", label: "仕事" },
};

const CATEGORY_COMMENTARY = {
  romance: {
    high: "感情的な波長が近く、自然体で愛情表現ができる相性です。深く分かり合える関係を築きやすいでしょう。",
    mid: "適度な距離感を保てる相性です。お互いのペースを尊重すれば、心地よい関係が続きます。",
    low: "感情表現のスタイルは大きく違いますが、それは自分にない感覚を相手が補ってくれる、ということでもあります。違いを弱点ではなく、2人の幅として見てみましょう。",
  },
  marriage: {
    high: "生活のペースや価値観が近く、長く一緒にいても摩擦が少ない、安定した相性です。",
    mid: "基本的な価値観は合いますが、生活スタイルの細部はすり合わせが必要になりそうです。",
    low: "生活リズムや安定性への考え方は違いますが、片方が持っていない視点をもう片方が持っている、バランス型の組み合わせとも言えます。役割分担のルールを早めに決めておくと安心です。",
  },
  work: {
    high: "得意分野が補い合い、一緒に仕事をすると高い成果を出しやすい相性です。",
    mid: "重なる部分と異なる部分がバランス良くある、無難に協働できる相性です。",
    low: "仕事の進め方は違いますが、同じやり方をする2人よりも、見えている景色が広くなる組み合わせです。役割をはっきり分けることで、お互いの強みを活かせます。",
  },
};

/**
 * TYPE_MATRIX（type-engine.jsで定義、ブラウザではグローバル）から、
 * 指定タイプの「代表的な主軸・副軸」を逆引きする。
 */
function getCanonicalAxes(typeId) {
  for (const a1 of MATCH_AXIS_ORDER) {
    for (const a2 of MATCH_AXIS_ORDER) {
      if (TYPE_MATRIX[a1] && TYPE_MATRIX[a1][a2] === typeId) {
        return { primary: a1, secondary: a2 };
      }
    }
  }
  return null;
}

/**
 * 診断データのない相手タイプ用に、主軸・副軸から代表的なCORE6プロフィールを推定する。
 */
function buildAxisProfile(typeId) {
  const profile = {};
  MATCH_AXIS_ORDER.forEach((axis) => (profile[axis] = 35));
  const axes = getCanonicalAxes(typeId);
  if (axes) {
    profile[axes.primary] = 85;
    profile[axes.secondary] = Math.max(profile[axes.secondary], 65);
  }
  return profile;
}

function getTier(score) {
  if (score >= 70) return "high";
  if (score >= 40) return "mid";
  return "low";
}

function computeCategoryScore(category, scoresA, scoresB) {
  const weights = CATEGORY_WEIGHTS[category];
  let total = 0;
  MATCH_AXIS_ORDER.forEach((axis) => {
    const similarity = 100 - Math.abs((scoresA[axis] || 0) - (scoresB[axis] || 0));
    total += weights[axis] * similarity;
  });
  return Math.round(total);
}

/**
 * そのカテゴリのスコアに一番効いている軸（重み×近さが最大）と、
 * 一番違いが大きい軸（重み×近さが最小）を返す。
 * 「なぜこの点数なのか」を一言で説明するために使う。
 */
function getAxisContributions(category, scoresA, scoresB) {
  const weights = CATEGORY_WEIGHTS[category];
  let best = null;
  let worst = null;
  MATCH_AXIS_ORDER.forEach((axis) => {
    const similarity = 100 - Math.abs((scoresA[axis] || 0) - (scoresB[axis] || 0));
    const weighted = weights[axis] * similarity;
    if (!best || weighted > best.weighted) best = { axis, weighted, similarity };
    if (!worst || weighted < worst.weighted) worst = { axis, weighted, similarity };
  });
  return { best, worst };
}

/**
 * scoresA: 診断済みの自分自身のCORE6スコア（session.core6.scores）
 * typeB: お相手として選んだ KAKU_TYPES の値
 * 戻り値: { categories: [{key,label,score,commentary}], typeBProfile }
 */
function generateMatchInsight(scoresA, typeB) {
  const scoresB = buildAxisProfile(typeB.id);

  const categories = Object.keys(CATEGORY_META).map((key) => {
    const score = computeCategoryScore(key, scoresA, scoresB);
    const tier = getTier(score);
    const contributions = getAxisContributions(key, scoresA, scoresB);
    return {
      key,
      label: CATEGORY_META[key].label,
      score,
      commentary: CATEGORY_COMMENTARY[key][tier],
      reasonAxis: contributions.best.axis,
      differenceAxis: contributions.worst.axis,
    };
  });

  return { categories, typeBProfile: scoresB };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { generateMatchInsight, computeCategoryScore, getAxisContributions, buildAxisProfile, getCanonicalAxes, CATEGORY_WEIGHTS };
}

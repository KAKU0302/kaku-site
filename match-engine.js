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
    low: "感情表現のスタイルが大きく異なる相性です。すれ違いを感じたときほど、言葉で気持ちを伝え合うことが鍵になります。",
  },
  marriage: {
    high: "生活のペースや価値観が近く、長く一緒にいても摩擦が少ない、安定した相性です。",
    mid: "基本的な価値観は合いますが、生活スタイルの細部はすり合わせが必要になりそうです。",
    low: "生活リズムや安定性への考え方に差がある相性です。役割分担のルールを早めに決めておくと安心です。",
  },
  work: {
    high: "得意分野が補い合い、一緒に仕事をすると高い成果を出しやすい相性です。",
    mid: "重なる部分と異なる部分がバランス良くある、無難に協働できる相性です。",
    low: "仕事の進め方が大きく異なる相性です。役割をはっきり分けることで、お互いの強みを活かせます。",
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
 * scoresA: 診断済みの自分自身のCORE6スコア（session.core6.scores）
 * typeB: お相手として選んだ KAKU_TYPES の値
 * 戻り値: { categories: [{key,label,score,commentary}], typeBProfile }
 */
function generateMatchInsight(scoresA, typeB) {
  const scoresB = buildAxisProfile(typeB.id);

  const categories = Object.keys(CATEGORY_META).map((key) => {
    const score = computeCategoryScore(key, scoresA, scoresB);
    const tier = getTier(score);
    return {
      key,
      label: CATEGORY_META[key].label,
      score,
      commentary: CATEGORY_COMMENTARY[key][tier],
    };
  });

  return { categories, typeBProfile: scoresB };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { generateMatchInsight, computeCategoryScore, buildAxisProfile, getCanonicalAxes, CATEGORY_WEIGHTS };
}

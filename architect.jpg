/**
 * context-engine.js
 * PERSONAL BOOK限定の追加入力「CONTEXT（今の状況）」を扱うエンジン【仮実装】
 *
 * 位置づけ: QUESTION（行動）× BIRTH（生まれ持った資質）× STATE（今の状態）という
 * 3つの軸に対し、CONTEXTは「今の仕事・役割」「大事にしたい価値観」「気になっている人間関係」という、
 * 既存の3軸とは重ならない切り口を、PERSONAL BOOKを見る前に選択式で答えてもらうことで追加する。
 * KAKUタイプ・CORE6の判定には一切影響を与えない（確定仕様と同じ考え方で、あくまで解説を
 * 今の状況によりフィットさせるための補助情報として扱う）。
 *
 * 仮実装: 自由記述・AIによる文章生成は行わず、選択式の回答をテンプレート文に当てはめる
 * ロジックのみで構成している（サーバー・外部APIを使わずに実装するため）。
 */

const CONTEXT_QUESTIONS = [
  {
    key: "role",
    prompt: "今の仕事・役割について、一番近いものは？",
    options: [
      { value: "management", label: "マネジメント・部下やチームを率いる立場" },
      { value: "specialist", label: "現場の実務を一人で・専門性で進める立場" },
      { value: "builder_role", label: "新しいプロジェクトや事業を立ち上げる立場" },
      { value: "support", label: "サポート・調整役として周りを支える立場" },
      { value: "other_focus", label: "今は仕事以外（学生・休職・転職活動中など）が中心" },
    ],
  },
  {
    key: "value",
    prompt: "これからの人生で、一番大事にしたいものは？",
    options: [
      { value: "growth", label: "成長・挑戦し続けること" },
      { value: "stability", label: "安心・安定した基盤があること" },
      { value: "connection", label: "大切な人との関係・つながり" },
      { value: "freedom", label: "自由・自分のペースで生きること" },
      { value: "contribution", label: "誰かの役に立っている実感" },
    ],
  },
  {
    key: "relationship",
    prompt: "今、人間関係で一番気になっているのは？",
    options: [
      { value: "work", label: "職場の人間関係（上司・部下・同僚）" },
      { value: "partner", label: "パートナー・恋愛関係" },
      { value: "family", label: "家族との関係" },
      { value: "friends", label: "友人関係・孤独感" },
      { value: "none", label: "特に気になっていることはない" },
    ],
  },
];

const CONTEXT_ROLE_TEMPLATES = {
  management:
    "マネジメントという立場にいる今のあなたにとって、「{weapon}」は、自分ひとりの成果ではなく、チーム全体の動き方に影響します。特に「なぜそれをやるのか」を短く共有するひと言が、この力の効果を何倍にもします。",
  specialist:
    "専門性で進める立場にいる今のあなたにとって、「{weapon}」は、あなた個人の評価に直結する武器です。誰かに合わせて薄めるより、その力を思い切り発揮できる仕事の任され方を、自分から取りに行く方が結果につながります。",
  builder_role:
    "新しい何かを立ち上げる立場にいる今のあなたにとって、「{weapon}」は、ゼロから形にする局面でこそ真価を発揮します。ただし、立ち上げた後の運用まで一人で抱えないことが、この力を長く使い続けるコツです。",
  support:
    "周りを支える立場にいる今のあなたにとって、「{weapon}」は、目立たない形で発揮されていることが多いはずです。それは弱さではなく、周囲が気づいていないだけの、確かな貢献です。",
  other_focus:
    "今は仕事以外を軸にしている状況だからこそ、「{weapon}」を意識的に使う機会が減っているかもしれません。小さな場面でいいので、この力を使えたことを、自分の中で思い出しておいてください。",
};

const CONTEXT_VALUE_TEMPLATES = {
  growth:
    "これからの人生で「成長・挑戦」を大事にしたいあなたにとって、今の{stateLabel}という状態は、次の挑戦のタイミングを見極めるための、大事な材料になります。",
  stability:
    "「安心・安定」を大事にしたいあなたにとって、生まれ持った{birthLabel}を土台にしながら進むことが、一番無理のないペースです。",
  connection:
    "「大切な人とのつながり」を大事にしたいあなたにとって、心を通わせる力の今の数値（{bondScore}）が、関係づくりにどう出ているかは、見返す価値があります。",
  freedom:
    "「自由・自分のペース」を大事にしたいあなたにとって、今の環境がどれだけ裁量を許してくれているかが、満足度を大きく左右します。",
  contribution:
    "「誰かの役に立っている実感」を大事にしたいあなたにとって、組織で輝く役割として見えている「{teamRole}」という役割を、日々の中で意識的に自覚することが力になります。",
};

const CONTEXT_RELATIONSHIP_TEMPLATES = {
  work:
    "今、職場の人間関係が気になっているとのことですが、あなたは「{relationStyle}」という関係の築き方をするタイプです。この特徴を相手に一言説明しておくだけで、誤解の多くは防げます。",
  partner:
    "今、パートナー・恋愛関係が気になっているとのことですが、あなたは「{relationStyle}」という関係の築き方をするタイプです。相性の良し悪しより、この築き方を相手に理解してもらえているかどうかが鍵になります。",
  family:
    "今、家族との関係が気になっているとのことですが、あなたは「{relationStyle}」という関係の築き方をするタイプです。家族には「そういう性格だから」で片付けられがちですが、あらためて言葉にして伝える価値があります。",
  friends:
    "今、友人関係や孤独感が気になっているとのことですが、あなたは「{relationStyle}」という関係の築き方をするタイプです。無理に合わせるより、この築き方が合う相手と過ごす時間を増やす方が、満たされやすいはずです。",
  none:
    "今、人間関係で特に気になっていることはないとのことです。あなたは「{relationStyle}」という関係の築き方をするタイプなので、この状態を保てている今の環境は、あなたに合っている可能性が高いです。",
};

function fillTemplate(template, values) {
  return template.replace(/\{(\w+)\}/g, (_, key) => (values[key] !== undefined ? values[key] : ""));
}

/**
 * context: { role, value, relationship }（CONTEXT_QUESTIONSのvalueキー）
 * type: KAKU_TYPESの該当タイプ
 * extra: { stateLabel, birthLabel, bondScore } など、テンプレートの穴埋めに使う追加データ
 * 戻り値: { roleText, valueText, relationshipText }
 */
function generateContextInsight(context, type, extra) {
  const values = {
    weapon: type.weapon,
    relationStyle: type.relationStyle,
    teamRole: type.teamRole,
    stateLabel: extra.stateLabel,
    birthLabel: extra.birthLabel,
    bondScore: extra.bondScore,
  };
  const roleText = fillTemplate(CONTEXT_ROLE_TEMPLATES[context.role] || "", values);
  const valueText = fillTemplate(CONTEXT_VALUE_TEMPLATES[context.value] || "", values);
  const relationshipText = fillTemplate(CONTEXT_RELATIONSHIP_TEMPLATES[context.relationship] || "", values);
  return { roleText, valueText, relationshipText };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    CONTEXT_QUESTIONS,
    CONTEXT_ROLE_TEMPLATES,
    CONTEXT_VALUE_TEMPLATES,
    CONTEXT_RELATIONSHIP_TEMPLATES,
    generateContextInsight,
  };
}

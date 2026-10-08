/**
 * core36/data.js
 * CORE36（36問・6軸）の設問、軸の定義、12TYPEの判定プロフィール、設定値。
 *
 * scoring_version 0.2.0-draft（暫定版）
 *  - 設問文はKAKUが新しく書いたものです。信頼性・妥当性の検証は済んでいません。
 *  - 軸の定義は、心理学の概念（開放性、合理的思考と経験的思考、行動志向、外向性の主張性、
 *    協調性・共感、誠実性の秩序など）を「着想の参考」にしていますが、尺度としての検証は
 *    していません。両極の組み立てと場面の分け方は KAKU 独自の仮説です。
 *  - 設問文・プロフィール・しきい値は、実利用者のパイロットで見直す前提のため、
 *    エンジン（engine.js）に埋め込まず、このファイルに集約しています。
 *
 * このファイルは既存の旧30問・16タイプのコードとは独立しており、
 * グローバル名は KAKU_CORE36_DATA ひとつだけです（旧コードの const 名と衝突しません）。
 */
(function (root) {
  "use strict";

  var VERSION = "0.2.0-draft";

  // 軸。poleA / poleB は両極の名前。優劣はなく、Aは軸名の側（名前が指す側）です。
  var AXES = [
    { id: "vision",    code: "V", nameEn: "VISION",    nameJp: "構想力",     poleA: "構想",   poleB: "現場",
      measures: "考え始める起点（先に全体像や可能性を描くか、目の前の事実や実例から組み立てるか）" },
    { id: "logic",     code: "L", nameEn: "LOGIC",     nameJp: "解析力",     poleA: "分析",   poleB: "感覚",
      measures: "判断の拠りどころ（明示的な根拠と筋道か、経験・手応え・しっくり感か）" },
    { id: "drive",     code: "D", nameEn: "DRIVE",     nameJp: "突破力",     poleA: "即動",   poleB: "見極め",
      measures: "動き出しのタイミング（まず動いて試すか、見極めて整えてから動くか）" },
    { id: "influence", code: "I", nameEn: "INFLUENCE", nameJp: "影響力",     poleA: "発信",   poleB: "支え",
      measures: "場での立ち位置（自分から語り場を動かすか、聞き役・裏方として場を支えるか）" },
    { id: "bond",      code: "B", nameEn: "BOND",      nameJp: "共鳴力",     poleA: "共鳴",   poleB: "自律",
      measures: "関わるときの軸（相手の気持ちや関係に寄り添うか、自分の考えと距離感を保ち相手に委ねるか）" },
    { id: "steady",    code: "S", nameEn: "STEADY",    nameJp: "積み上げ力", poleA: "積み上げ", poleB: "柔軟",
      measures: "進め方の型（手順や習慣で着実に進めるか、状況に応じて組み替えるか）" }
  ];

  // 場面。仕事・学び（work）と日常（life）を各軸3問ずつ。
  var SCENES = { work: "仕事・学び", life: "日常" };

  // 設問。aSide は「A極（軸名の側）の文が左右どちらにあるか」。画面には出さない。
  // 各軸6問：work 3問（left, right, left）、life 3問（right, left, right）→ 左右は3対3。
  var ITEMS = [
    { id: "C01", axis: "vision",    scene: "work", aSide: "left",  left: "先に「どうなったら理想か」の全体像を描いてから動き出したい", right: "まず目の前の事実や過去の実例を集め、そこから組み立てたい" },
    { id: "C02", axis: "logic",     scene: "work", aSide: "left",  left: "大事な判断の前には、数字や根拠を並べて整理したい", right: "大事な判断の前には、経験からくる勘や、全体を見たときのしっくり感を重視したい" },
    { id: "C03", axis: "drive",     scene: "work", aSide: "left",  left: "新しい依頼は、まず手をつけて、動きながら調整したい", right: "新しい依頼は、進め方を見極めてから着手したい" },
    { id: "C04", axis: "influence", scene: "work", aSide: "left",  left: "意見が割れたとき、自分から方向性を言葉にして示す", right: "意見が割れたとき、各自の意見が出揃うのを待って整理に回る" },
    { id: "C05", axis: "bond",      scene: "work", aSide: "left",  left: "同僚が落ち込んでいるときは、まず気持ちに寄り添って話を聞く", right: "同僚が落ち込んでいるときは、深入りせず、本人が話したくなるまで見守る" },
    { id: "C06", axis: "steady",    scene: "work", aSide: "left",  left: "仕事の進め方は、決めた手順や計画どおりに進めたい", right: "仕事の進め方は、状況に合わせて都度組み替えたい" },

    { id: "C07", axis: "vision",    scene: "work", aSide: "right", left: "会議で自分が出しがちなのは、現状の確認や実例にもとづく話だ", right: "会議で自分が出しがちなのは、まだ形のない可能性や先の話だ" },
    { id: "C08", axis: "logic",     scene: "work", aSide: "right", left: "判断に迷ったときは、ピンとくる方を信じて決める", right: "判断に迷ったときは、選択肢を比べ、理由を言葉にして決める" },
    { id: "C09", axis: "drive",     scene: "work", aSide: "right", left: "失敗しそうなときは、備えを整えてから進めたい", right: "失敗しそうなときも、小さく試して、ダメなら直したい" },
    { id: "C10", axis: "influence", scene: "work", aSide: "right", left: "会議では、聞き役や補足役として全体を支えることが多い", right: "会議では、率先して発言し議論を引っ張ることが多い" },
    { id: "C11", axis: "bond",      scene: "work", aSide: "right", left: "意見が対立したときは、自分の考えを軸に結論を出し、相手との違いは違いとして受け止める", right: "意見が対立したときは、相手の立場や気持ちを汲んだ着地点を探す" },
    { id: "C12", axis: "steady",    scene: "work", aSide: "right", left: "予定が急に変わったら、新しい状況に合わせてやり方を変える", right: "予定が急に変わったら、元の計画に戻せるよう整え直す" },

    { id: "C13", axis: "vision",    scene: "work", aSide: "left",  left: "課題に向き合うとき、「そもそも何のためか」から考え直したい", right: "課題に向き合うとき、「今のやり方のどこを直すか」から考えたい" },
    { id: "C14", axis: "logic",     scene: "work", aSide: "left",  left: "うまくいかなかったとき、原因を一つずつ切り分けて考える", right: "うまくいかなかったとき、全体の流れを感じ取って勘どころを探る" },
    { id: "C15", axis: "drive",     scene: "work", aSide: "left",  left: "停滞した場面では、自分から最初の一手を打つ", right: "停滞した場面では、動きそうな兆しを見極めてから動く" },
    { id: "C16", axis: "influence", scene: "work", aSide: "left",  left: "チームをまとめたいとき、自分の考えや熱意を前面に出して伝える", right: "チームをまとめたいとき、前には出ず、一人ひとりの話を聞いて調整する" },
    { id: "C17", axis: "bond",      scene: "work", aSide: "left",  left: "仕事で何かを決めるとき、関わる人の気持ちや事情を判断の中心に置く", right: "仕事で何かを決めるとき、関わる人の気持ちや事情は考慮しつつも、判断の中心は自分の考えに置く" },
    { id: "C18", axis: "steady",    scene: "work", aSide: "left",  left: "長く続く業務では、毎日の型を作って積み重ねたい", right: "長く続く業務では、その時々で大事なことに集中を切り替えたい" },

    { id: "C19", axis: "vision",    scene: "life", aSide: "right", left: "休日の過ごし方を考えるとき、まず「できること・行ける場所」を挙げる", right: "休日の過ごし方を考えるとき、まず「どんな時間にしたいか」のイメージを描く" },
    { id: "C20", axis: "logic",     scene: "life", aSide: "right", left: "買い物では、使ったときの感じや、自分のしっくり感で選ぶことが多い", right: "買い物では、価格や仕様を比べて、根拠をもって選ぶことが多い" },
    { id: "C21", axis: "drive",     scene: "life", aSide: "right", left: "気になる習い事は、納得できるまで始めずに待つ", right: "気になる習い事は、とりあえず体験に行ってみる" },
    { id: "C22", axis: "influence", scene: "life", aSide: "right", left: "友人の集まりでは、聞き役に回ることが多い", right: "友人の集まりでは、話題を出す側に回ることが多い" },
    { id: "C23", axis: "bond",      scene: "life", aSide: "right", left: "友人とは、会う頻度も距離感も自分のペースで付き合いたい", right: "友人とは、連絡をまめに取り、近況を分かち合いたい" },
    { id: "C24", axis: "steady",    scene: "life", aSide: "right", left: "休日は、その日の気分で動くのが心地いい", right: "休日は、だいたい決まったリズムで過ごすのが心地いい" },

    { id: "C25", axis: "vision",    scene: "life", aSide: "left",  left: "将来のことは、数年先の理想の姿から思い描く", right: "将来のことは、今月・来月の現実的な見通しから考える" },
    { id: "C26", axis: "logic",     scene: "life", aSide: "left",  left: "根拠が示されて、初めて納得できる", right: "根拠がはっきりしなくても、しっくりくれば納得できる" },
    { id: "C27", axis: "drive",     scene: "life", aSide: "left",  left: "やりたいことが浮かんだら、その日のうちに最初の一歩を踏み出す", right: "やりたいことが浮かんでも、少し置いて気持ちが変わらないか確かめる" },
    { id: "C28", axis: "influence", scene: "life", aSide: "left",  left: "好きなものは、周りに積極的に勧めたい", right: "好きなものは、聞かれたときに答える程度でいい" },
    { id: "C29", axis: "bond",      scene: "life", aSide: "left",  left: "相手の望みが自分と違うとき、気持ちを察して合わせる余地を探す", right: "相手の望みが自分と違うとき、違いは違いとして受け止め、無理には合わせない" },
    { id: "C30", axis: "steady",    scene: "life", aSide: "left",  left: "決めた日課は、欠かさず続けたい", right: "日課は、合わなくなったら変えていい" },

    { id: "C31", axis: "vision",    scene: "life", aSide: "right", left: "趣味や暮らしで工夫するとき、実際にできたことやうまくいった例から広げる", right: "趣味や暮らしで工夫するとき、「こうなったらいい」という姿から逆算して考える" },
    { id: "C32", axis: "logic",     scene: "life", aSide: "right", left: "新しい情報は、自分の経験に照らして腑に落ちるかどうかで受け止める", right: "新しい情報は、出典やデータを確認してから受け止める" },
    { id: "C33", axis: "drive",     scene: "life", aSide: "right", left: "大きな決断は、十分に見極められるまで待ちたい", right: "大きな決断は、多少見切り発車でも早く動きたい" },
    { id: "C34", axis: "influence", scene: "life", aSide: "right", left: "仲間内の活動では、裏方として支える役が落ち着く", right: "仲間内の活動では、まとめ役として前に立つ役が落ち着く" },
    { id: "C35", axis: "bond",      scene: "life", aSide: "right", left: "人の悩みを聞くときは、深入りせず、本人が決めることを尊重したい", right: "人の悩みを聞くときは、気持ちに寄り添い、一緒に感じたい" },
    { id: "C36", axis: "steady",    scene: "life", aSide: "right", left: "物の置き場は、状況に合わせて使いやすく変える", right: "物の置き場は、定位置を決めてそこへ戻す" }
  ];

  // 回答の5段階（r = 1〜5）。画面に出す文言。
  var CHOICES = [
    { value: 1, label: "左に近い" },
    { value: 2, label: "やや左" },
    { value: 3, label: "どちらとも" },
    { value: 4, label: "やや右" },
    { value: 5, label: "右に近い" }
  ];

  // 12TYPEの判定プロフィール。
  //  core: 決める軸（重み1）。pole は "A" または "B"（その軸のどちら寄りがこのタイプの特徴か）。
  //  support: 補助の軸（重み0.5）。
  //  weakSupport: 補助の軸の根拠が弱い（タイプの説明文から読み取れる程度）ことを示す注記。
  // タイプ名・キャラクター・画像・色は types-data.js（既存）をそのまま使い、ここでは扱いません。
  // 旧4タイプ（mediator / builder / adventurer / finisher）はプロフィールを持たず、新版では出力しません。
  var PROFILES = {
    architect:  { core: [["vision", "A"], ["logic", "A"]],       support: [["drive", "B"]] },
    pioneer:    { core: [["vision", "A"], ["drive", "A"]],       support: [["steady", "B"]], weakSupport: true },
    commander:  { core: [["influence", "A"], ["vision", "A"]],   support: [["bond", "B"]],   weakSupport: true },
    creator:    { core: [["vision", "A"], ["logic", "B"]],       support: [["steady", "B"]] },
    strategist: { core: [["logic", "A"], ["drive", "A"]],        support: [["bond", "B"]] },
    challenger: { core: [["drive", "A"], ["influence", "A"]],    support: [["bond", "B"]],   weakSupport: true },
    influencer: { core: [["influence", "A"], ["bond", "A"]],     support: [["logic", "B"]],  weakSupport: true },
    connector:  { core: [["bond", "A"], ["steady", "B"]],        support: [["influence", "B"]] },
    navigator:  { core: [["bond", "A"], ["logic", "A"]],         support: [["influence", "A"]], weakSupport: true },
    guardian:   { core: [["bond", "A"], ["steady", "A"]],        support: [["drive", "B"]] },
    executor:   { core: [["steady", "A"], ["drive", "A"]],       support: [["vision", "B"]] },
    specialist: { core: [["logic", "A"], ["steady", "A"]],       support: [["influence", "B"]] }
  };

  // 完全な同点のときの最後の決め手（固定順）。順序そのものに意味はなく、versionで管理する。
  var TIE_BREAK_ORDER = ["architect", "pioneer", "commander", "creator", "strategist", "challenger",
                         "influencer", "connector", "navigator", "guardian", "executor", "specialist"];

  // 設定値（しきい値など）。すべて暫定値。変更したら scoring_version を上げる。
  var CONFIG = {
    leanMean: 0.5,            // 軸の平均がこの絶対値以上で「寄り」（6問の合計で±3）
    sceneMean: 1.0,           // 場面差：両場面の平均が逆符号で、それぞれこの絶対値以上
    sceneMinValid: 2,         // 場面差を見るのに必要な、場面ごとの有効回答数
    targetOffset: 25,         // プロフィールの目標位置（50 ± 25）
    supportWeight: 0.5,       // 補助の軸の重み
    marginDelta: 3,           // 1位と2位の距離の差がこれ未満なら、2番目に近いタイプを補足する
    weakFitDistance: 25,      // 1位との距離がこれ以上なら「近さは弱め」（＝全軸が中立の人と同じ距離）
    minValidPerAxis: 5,       // 1軸あたりの最低有効回答数（6問中）
    noBasisTieCount: 4,       // 完全な同点がこの数以上なら、無理に分類しない
    straightLineCount: 34,    // 36問中これ以上が同じ回答なら「回答パターンに偏りあり」の印
    minDurationSec: 120       // 回答時間がこれ未満なら「回答が速い」の印（判定には使わない）
  };

  root.KAKU_CORE36_DATA = {
    VERSION: VERSION,
    AXES: AXES, SCENES: SCENES, ITEMS: ITEMS, CHOICES: CHOICES,
    PROFILES: PROFILES, TIE_BREAK_ORDER: TIE_BREAK_ORDER, CONFIG: CONFIG
  };
  if (typeof module !== "undefined" && module.exports) module.exports = root.KAKU_CORE36_DATA;
})(typeof globalThis !== "undefined" ? globalThis : this);

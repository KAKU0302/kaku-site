/**
 * kaku-lab/core36-data.js
 * CORE36（36問・6軸）の設問、軸の定義、12TYPEの判定プロフィール、設定値。
 *
 * scoring_version 0.3.0-draft（暫定版。0.2.0から「設問の文」だけを平易に書き直した。軸・場面・A極の位置・しきい値・タイプ判定表は同じ）
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

  var VERSION = "0.3.0-draft";

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
    { id: "C01", axis: "vision", scene: "work", aSide: "left", left: "仕事を始める前に、「完成したらどうなっているか」を先に思い描く", right: "仕事を始める前に、「今わかっていること」や過去の例を先に集める" },
    { id: "C02", axis: "logic", scene: "work", aSide: "left", left: "大事なことを決めるときは、理由や数字を並べて考える", right: "大事なことを決めるときは、経験からくる「こっちだ」という感覚を大事にする" },
    { id: "C03", axis: "drive", scene: "work", aSide: "left", left: "新しい仕事を頼まれたら、とりあえず手をつけて、進めながら直す", right: "新しい仕事を頼まれたら、進め方を考えてから手をつける" },
    { id: "C04", axis: "influence", scene: "work", aSide: "left", left: "意見がぶつかったとき、自分から「こうしよう」と言い出す", right: "意見がぶつかったとき、みんなの意見が出るのを待って、整理する" },
    { id: "C05", axis: "bond", scene: "work", aSide: "left", left: "同僚が落ち込んでいたら、声をかけて、まず話を聞く", right: "同僚が落ち込んでいたら、そっとしておいて、相手が話すのを待つ" },
    { id: "C06", axis: "steady", scene: "work", aSide: "left", left: "仕事は、決めた手順や計画どおりに進めたい", right: "仕事は、状況を見ながら、やり方をその都度変えたい" },
    { id: "C07", axis: "vision", scene: "work", aSide: "right", left: "会議で自分が話しがちなのは、今の状況や、これまでの実例のこと", right: "会議で自分が話しがちなのは、まだ決まっていない、これからの可能性のこと" },
    { id: "C08", axis: "logic", scene: "work", aSide: "right", left: "迷ったときは、ピンときた方を選ぶ", right: "迷ったときは、選択肢を比べて、理由を言葉にして選ぶ" },
    { id: "C09", axis: "drive", scene: "work", aSide: "right", left: "うまくいかなそうなときは、準備をしっかりしてから進める", right: "うまくいかなそうなときも、まず小さく試して、ダメなら直す" },
    { id: "C10", axis: "influence", scene: "work", aSide: "right", left: "会議では、聞き役やフォロー役に回ることが多い", right: "会議では、自分から発言して、議論を引っぱることが多い" },
    { id: "C11", axis: "bond", scene: "work", aSide: "right", left: "意見が対立したら、自分の考えをはっきり言う。相手と違っていても仕方ないと思う", right: "意見が対立したら、相手の立場や気持ちも考えて、落としどころを探す" },
    { id: "C12", axis: "steady", scene: "work", aSide: "right", left: "予定が急に変わったら、新しい状況に合わせてやり方を変える", right: "予定が急に変わったら、できるだけ元の計画に近づけて立て直す" },
    { id: "C13", axis: "vision", scene: "work", aSide: "left", left: "課題があると、まず「そもそも何のためか」を考え直したくなる", right: "課題があると、まず「今のやり方のどこを直せばいいか」を考える" },
    { id: "C14", axis: "logic", scene: "work", aSide: "left", left: "うまくいかなかったとき、原因を一つずつ分けて考える", right: "うまくいかなかったとき、全体の流れを見て、ここがまずかったと感じ取る" },
    { id: "C15", axis: "drive", scene: "work", aSide: "left", left: "仕事が止まっているとき、自分から最初の一手を打つ", right: "仕事が止まっているとき、動き出すきっかけを待ってから動く" },
    { id: "C16", axis: "influence", scene: "work", aSide: "left", left: "チームをまとめたいとき、自分の考えや思いを前に出して伝える", right: "チームをまとめたいとき、一人ひとりの話を聞いて調整する" },
    { id: "C17", axis: "bond", scene: "work", aSide: "left", left: "仕事で何かを決めるとき、関わる人の気持ちや事情をいちばん大事にする", right: "仕事で何かを決めるとき、人の事情は考えつつも、最後は自分の考えで決める" },
    { id: "C18", axis: "steady", scene: "work", aSide: "left", left: "長く続く仕事は、毎日のやり方を決めて、コツコツ積み重ねたい", right: "長く続く仕事は、その時々で大事なことを見直して、やり方を変えたい" },
    { id: "C19", axis: "vision", scene: "life", aSide: "right", left: "休日の予定を考えるとき、まず「行ける場所・できること」を挙げる", right: "休日の予定を考えるとき、まず「どんな一日にしたいか」を思い描く" },
    { id: "C20", axis: "logic", scene: "life", aSide: "right", left: "買い物では、使ったときの感じや、自分の「これだ」で選ぶことが多い", right: "買い物では、値段や性能を比べて、理由をつけて選ぶことが多い" },
    { id: "C21", axis: "drive", scene: "life", aSide: "right", left: "気になる習い事があっても、納得できるまで始めない", right: "気になる習い事があれば、とりあえず体験に行ってみる" },
    { id: "C22", axis: "influence", scene: "life", aSide: "right", left: "友だちの集まりでは、聞き役に回ることが多い", right: "友だちの集まりでは、話題を出す側になることが多い" },
    { id: "C23", axis: "bond", scene: "life", aSide: "right", left: "友だちとは、会う回数も連絡の頻度も、自分のペースで付き合いたい", right: "友だちとは、こまめに連絡して、近況を分かち合いたい" },
    { id: "C24", axis: "steady", scene: "life", aSide: "right", left: "休日は、その日の気分で動くのが心地いい", right: "休日は、だいたい決まったリズムで過ごすのが心地いい" },
    { id: "C25", axis: "vision", scene: "life", aSide: "left", left: "将来のことは、数年先の「こうなりたい」から考える", right: "将来のことは、今月・来月の現実的な見通しから考える" },
    { id: "C26", axis: "logic", scene: "life", aSide: "left", left: "理由をきちんと示してもらえて、初めて納得できる", right: "理由がはっきりしなくても、しっくりくれば納得できる" },
    { id: "C27", axis: "drive", scene: "life", aSide: "left", left: "やりたいことが浮かんだら、その日のうちに最初の一歩を踏み出す", right: "やりたいことが浮かんでも、少し置いて、気持ちが変わらないか確かめる" },
    { id: "C28", axis: "influence", scene: "life", aSide: "left", left: "好きなものは、周りの人に自分から勧めたい", right: "好きなものは、聞かれたら答えるくらいでいい" },
    { id: "C29", axis: "bond", scene: "life", aSide: "left", left: "相手の望みが自分と違うとき、相手の気持ちを考えて、合わせられないか探す", right: "相手の望みが自分と違うとき、違いは違いとして受け止め、無理には合わせない" },
    { id: "C30", axis: "steady", scene: "life", aSide: "left", left: "決めた日課は、欠かさず続けたい", right: "日課は、合わなくなったら変えていい" },
    { id: "C31", axis: "vision", scene: "life", aSide: "right", left: "趣味や暮らしを工夫するとき、実際にうまくいった例から広げる", right: "趣味や暮らしを工夫するとき、「こうなったらいいな」から逆算する" },
    { id: "C32", axis: "logic", scene: "life", aSide: "right", left: "新しい情報は、自分の経験に照らして「確かに」と思えるかで受け止める", right: "新しい情報は、出どころやデータを確かめてから受け止める" },
    { id: "C33", axis: "drive", scene: "life", aSide: "right", left: "大きな決断は、十分に見きわめられるまで待ちたい", right: "大きな決断は、多少見切り発車でも、早く動きたい" },
    { id: "C34", axis: "influence", scene: "life", aSide: "right", left: "仲間うちの活動では、裏方として支える役が落ち着く", right: "仲間うちの活動では、まとめ役として前に立つ役が落ち着く" },
    { id: "C35", axis: "bond", scene: "life", aSide: "right", left: "人の悩みを聞くときは、深入りせず、本人が決めることを尊重する", right: "人の悩みを聞くときは、気持ちに寄り添って、一緒に悩む" },
    { id: "C36", axis: "steady", scene: "life", aSide: "right", left: "物の置き場は、使いやすいように、そのつど変える", right: "物の置き場は、定位置を決めて、そこに戻す" }
  ];

  // 回答の5段階（r = 1〜5）。画面に出す文言。
  var CHOICES = [
    { value: 1, label: "上がぴったり" },
    { value: 2, label: "どちらかといえば上" },
    { value: 3, label: "どちらともいえない" },
    { value: 4, label: "どちらかといえば下" },
    { value: 5, label: "下がぴったり" }
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

/**
 * kaku-lab/core36-data.js
 * CORE36（36問・6軸）の設問、軸の定義、12TYPEの判定プロフィール、設定値。
 *
 * scoring_version 0.5.1-draft（暫定版。0.4.0のA/B比較方式から「1つの文＋あてはまり度5段階」方式へ変更。36問の文は新しく書き直し）
 *  - 回答 r=1「全くあてはまらない」〜5「かなりあてはまる」。各設問の keyed が "A" なら A極＝r−3、"B"（逆転項目）なら A極＝3−r。
 *  - 各軸に A極の文3問・B極の文3問を置き、両極を測る。旧A/B比較の文は LEGACY_AB_ITEMS に履歴として保存（採点には使わない）。
 *  - 新方式の得点は旧A/B方式の得点と同じ意味とは限りません。同じ人が答えても結果が一致する保証はありません。
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

  var VERSION = "0.5.1-draft";

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

  // 設問（0.5.0〜）：1つの文に「どのくらいあてはまるか」を5段階で答える。
  //  keyed は、その文が「A極（軸名の側）」と「B極」のどちらの行動・考え方を述べているか。画面には出さない。
  //  各軸6問：A極の文3問・B極の文3問（逆向きの文を入れて、「はい」と答えがちな癖の影響を相殺する）。
  //  場面は仕事・学び3問／日常3問。A極の文は、仕事で2問＋日常で1問、またはその逆（軸ごとに交互）。
  //  旧A/B比較の文を片側だけ残したものではなく、両極それぞれについて新しく書いた文です。
  var ITEMS = [
    { id: "C01", axis: "vision", scene: "work", keyed: "A", text: "仕事は、完成した姿を思い描くところから始めたい" },
    { id: "C02", axis: "logic", scene: "work", keyed: "B", text: "大事な判断では、経験からくる「こっちだ」という感覚を信じる" },
    { id: "C03", axis: "drive", scene: "work", keyed: "A", text: "新しい仕事は、考えるより先に手をつけてみる" },
    { id: "C04", axis: "influence", scene: "work", keyed: "B", text: "意見が割れたときは、みんなの考えを聞いて整理する側にまわる" },
    { id: "C05", axis: "bond", scene: "work", keyed: "A", text: "同僚が落ち込んでいたら、声をかけて話を聞きたい" },
    { id: "C06", axis: "steady", scene: "work", keyed: "B", text: "仕事のやり方は、状況を見てその都度変えたい" },
    { id: "C07", axis: "vision", scene: "work", keyed: "B", text: "新しい仕事は、まず今ある事実や実例を集めてから進める" },
    { id: "C08", axis: "logic", scene: "work", keyed: "A", text: "決めるときは、理由を言葉にして整理したい" },
    { id: "C09", axis: "drive", scene: "work", keyed: "B", text: "動き出す前に、進め方や見通しを整えておきたい" },
    { id: "C10", axis: "influence", scene: "work", keyed: "A", text: "会議では、自分から発言して流れをつくることが多い" },
    { id: "C11", axis: "bond", scene: "work", keyed: "B", text: "意見が違うときは、相手に合わせず自分の考えをはっきり伝える" },
    { id: "C12", axis: "steady", scene: "work", keyed: "A", text: "仕事は、決めた手順や計画どおりに進めたい" },
    { id: "C13", axis: "vision", scene: "work", keyed: "A", text: "目の前の課題より、「そもそも何のためか」が気になる" },
    { id: "C14", axis: "logic", scene: "work", keyed: "B", text: "うまくいかない原因は、全体の流れから感じ取ることが多い" },
    { id: "C15", axis: "drive", scene: "work", keyed: "A", text: "仕事が止まっていたら、自分から最初の一手を打つ" },
    { id: "C16", axis: "influence", scene: "work", keyed: "B", text: "チームでは、前に立つより周りを支える役のほうが落ち着く" },
    { id: "C17", axis: "bond", scene: "work", keyed: "A", text: "仕事で何かを決めるときも、関わる人の気持ちを大切にしたい" },
    { id: "C18", axis: "steady", scene: "work", keyed: "B", text: "長く続く仕事でも、やり方はときどき組み替えたい" },
    { id: "C19", axis: "vision", scene: "life", keyed: "B", text: "休日の予定は、行ける場所を調べるところから立てる" },
    { id: "C20", axis: "logic", scene: "life", keyed: "A", text: "買い物では、値段や性能を比べてから決める" },
    { id: "C21", axis: "drive", scene: "life", keyed: "B", text: "気になる習い事があっても、じっくり調べて納得してから始める" },
    { id: "C22", axis: "influence", scene: "life", keyed: "A", text: "友だちの集まりでは、話題を出す側になることが多い" },
    { id: "C23", axis: "bond", scene: "life", keyed: "B", text: "友だちとの連絡は、自分のペースでゆるやかなくらいがいい" },
    { id: "C24", axis: "steady", scene: "life", keyed: "A", text: "休日は、だいたい決まったリズムで過ごすと落ち着く" },
    { id: "C25", axis: "vision", scene: "life", keyed: "A", text: "将来のことは、「こうなりたい」という姿から考える" },
    { id: "C26", axis: "logic", scene: "life", keyed: "B", text: "理由をうまく説明できなくても、しっくりくれば決められる" },
    { id: "C27", axis: "drive", scene: "life", keyed: "A", text: "やりたいことが浮かんだら、その日のうちに動き出す" },
    { id: "C28", axis: "influence", scene: "life", keyed: "B", text: "好きなものができても、聞かれるまで自分からは勧めない" },
    { id: "C29", axis: "bond", scene: "life", keyed: "A", text: "相手の望みが自分と違うときは、合わせる方法を探す" },
    { id: "C30", axis: "steady", scene: "life", keyed: "B", text: "始めた習慣でも、合わなくなったら気軽に変える" },
    { id: "C31", axis: "vision", scene: "life", keyed: "B", text: "暮らしの工夫は、うまくいっている人のやり方を真似して試す" },
    { id: "C32", axis: "logic", scene: "life", keyed: "A", text: "新しい情報は、出どころや根拠を確かめてから受け入れる" },
    { id: "C33", axis: "drive", scene: "life", keyed: "B", text: "大きな決断は、十分に見きわめられるまで待ちたい" },
    { id: "C34", axis: "influence", scene: "life", keyed: "A", text: "仲間うちの活動では、まとめ役を引き受けることが多い" },
    { id: "C35", axis: "bond", scene: "life", keyed: "B", text: "人の悩みには、深入りせず本人の決断を尊重する" },
    { id: "C36", axis: "steady", scene: "life", keyed: "A", text: "物は定位置を決めて、いつもそこに戻す" }
  ];

  // 回答の5段階（r = 1〜5）。画面に出す文言（固定）。r はそのまま「あてはまり度」。
  // A極に換算するときは keyed を見る：keyed "A" → r−3、keyed "B" → 3−r（逆転項目）。
  var CHOICES = [
    { value: 1, label: "全くあてはまらない",   adv: "全く",       tail: "あてはまらない", strength: 2 },
    { value: 2, label: "あまりあてはまらない", adv: "あまり",     tail: "あてはまらない", strength: 1 },
    { value: 3, label: "どちらともいえない",   adv: "どちらとも", tail: "いえない",       strength: 0 },
    { value: 4, label: "少しあてはまる",       adv: "少し",       tail: "あてはまる",     strength: 1 },
    { value: 5, label: "かなりあてはまる",     adv: "かなり",     tail: "あてはまる",     strength: 2 }
  ];

  // 旧A/B比較方式（0.4.0-draft）の36問。採点には使いません（履歴として残すだけ。definition_hashにも含めません）。
  var LEGACY_AB_ITEMS = [
    { id: "C01", axis: "vision", scene: "work", aSide: "left", q: "仕事を始めるとき、あなたは？", left: "まず完成した姿を思い描く", right: "まず情報や過去の例を集める" },
    { id: "C02", axis: "logic", scene: "work", aSide: "left", q: "大事なことを決めるとき、頼るのは？", left: "理由や数字を並べて考える", right: "「こっちだ」という経験からの感覚" },
    { id: "C03", axis: "drive", scene: "work", aSide: "left", q: "新しい仕事を頼まれたら？", left: "とりあえず手をつけて、進めながら直す", right: "進め方を考えてから手をつける" },
    { id: "C04", axis: "influence", scene: "work", aSide: "left", q: "意見がぶつかったとき、あなたは？", left: "自分から「こうしよう」と言い出す", right: "みんなの意見を待って、整理する" },
    { id: "C05", axis: "bond", scene: "work", aSide: "left", q: "同僚が落ち込んでいたら？", left: "声をかけて、まず話を聞く", right: "そっとしておいて、話すのを待つ" },
    { id: "C06", axis: "steady", scene: "work", aSide: "left", q: "仕事の進め方は？", left: "決めた手順や計画どおりに進めたい", right: "状況を見て、やり方をその都度変えたい" },
    { id: "C07", axis: "vision", scene: "work", aSide: "right", q: "会議で、つい話しがちなのは？", left: "今の状況や、これまでの実例", right: "まだ決まっていない、これからの可能性" },
    { id: "C08", axis: "logic", scene: "work", aSide: "right", q: "迷ったときは？", left: "ピンときた方を選ぶ", right: "比べて、理由を言葉にして選ぶ" },
    { id: "C09", axis: "drive", scene: "work", aSide: "right", q: "うまくいかなそうなときは？", left: "準備をしっかりしてから進める", right: "まず小さく試して、ダメなら直す" },
    { id: "C10", axis: "influence", scene: "work", aSide: "right", q: "会議でのあなたは？", left: "聞き役やフォロー役が多い", right: "自分から発言して、引っぱることが多い" },
    { id: "C11", axis: "bond", scene: "work", aSide: "right", q: "意見が対立したら？", left: "違っても、自分の考えをはっきり言う", right: "相手の気持ちも考えて、落としどころを探す" },
    { id: "C12", axis: "steady", scene: "work", aSide: "right", q: "予定が急に変わったら？", left: "新しい状況に合わせて、やり方を変える", right: "できるだけ元の計画に近づけて立て直す" },
    { id: "C13", axis: "vision", scene: "work", aSide: "left", q: "課題にぶつかったら、まず？", left: "「そもそも何のためか」を考え直す", right: "「今のやり方のどこを直すか」を考える" },
    { id: "C14", axis: "logic", scene: "work", aSide: "left", q: "うまくいかなかったとき、あなたは？", left: "原因を一つずつ分けて考える", right: "全体の流れから「ここだ」と感じ取る" },
    { id: "C15", axis: "drive", scene: "work", aSide: "left", q: "仕事が止まっているとき、あなたは？", left: "自分から最初の一手を打つ", right: "動き出すきっかけを待つ" },
    { id: "C16", axis: "influence", scene: "work", aSide: "left", q: "チームをまとめたいとき？", left: "自分の考えや思いを前に出して伝える", right: "一人ひとりの話を聞いて調整する" },
    { id: "C17", axis: "bond", scene: "work", aSide: "left", q: "仕事で何かを決めるとき？", left: "関わる人の気持ちや事情をいちばん大事にする", right: "事情は考えつつ、最後は自分の考えで決める" },
    { id: "C18", axis: "steady", scene: "work", aSide: "left", q: "長く続く仕事は？", left: "やり方を決めて、コツコツ積み重ねたい", right: "その時々で、やり方を見直したい" },
    { id: "C19", axis: "vision", scene: "life", aSide: "right", q: "休日の予定を考えるとき、まず？", left: "行ける場所・できることを挙げる", right: "どんな一日にしたいかを思い描く" },
    { id: "C20", axis: "logic", scene: "life", aSide: "right", q: "買い物で、決め手になるのは？", left: "使った感じや、自分の「これだ」", right: "値段や性能を比べた理由" },
    { id: "C21", axis: "drive", scene: "life", aSide: "right", q: "気になる習い事があったら？", left: "納得できるまで始めない", right: "とりあえず体験に行ってみる" },
    { id: "C22", axis: "influence", scene: "life", aSide: "right", q: "友だちの集まりでは？", left: "聞き役に回ることが多い", right: "話題を出す側になることが多い" },
    { id: "C23", axis: "bond", scene: "life", aSide: "right", q: "友だちとの付き合い方は？", left: "会う回数も連絡も、自分のペースで", right: "こまめに連絡して、近況を分かち合う" },
    { id: "C24", axis: "steady", scene: "life", aSide: "right", q: "休日の過ごし方は？", left: "その日の気分で動くのが心地いい", right: "だいたい決まったリズムが心地いい" },
    { id: "C25", axis: "vision", scene: "life", aSide: "left", q: "将来のことは、どこから考える？", left: "数年先の「こうなりたい」から", right: "今月・来月の現実的な見通しから" },
    { id: "C26", axis: "logic", scene: "life", aSide: "left", q: "納得できるのは、どんなとき？", left: "理由をきちんと示してもらえたとき", right: "理由は曖昧でも、しっくりきたとき" },
    { id: "C27", axis: "drive", scene: "life", aSide: "left", q: "やりたいことが浮かんだら？", left: "その日のうちに最初の一歩を踏み出す", right: "少し置いて、気持ちが変わらないか確かめる" },
    { id: "C28", axis: "influence", scene: "life", aSide: "left", q: "好きなものができたら？", left: "周りの人に自分から勧めたい", right: "聞かれたら答えるくらいでいい" },
    { id: "C29", axis: "bond", scene: "life", aSide: "left", q: "相手の望みが自分と違うとき？", left: "相手の気持ちを考えて、合わせられないか探す", right: "違いは違いとして受け止め、無理には合わせない" },
    { id: "C30", axis: "steady", scene: "life", aSide: "left", q: "決めた日課は？", left: "欠かさず続けたい", right: "合わなくなったら変えていい" },
    { id: "C31", axis: "vision", scene: "life", aSide: "right", q: "趣味や暮らしを工夫するとき？", left: "うまくいった実例から広げる", right: "「こうなったらいいな」から逆算する" },
    { id: "C32", axis: "logic", scene: "life", aSide: "right", q: "新しい情報を受け止めるとき？", left: "自分の経験に照らして「確かに」と思えるか", right: "出どころやデータを確かめてから" },
    { id: "C33", axis: "drive", scene: "life", aSide: "right", q: "大きな決断をするときは？", left: "十分に見きわめられるまで待ちたい", right: "多少見切り発車でも、早く動きたい" },
    { id: "C34", axis: "influence", scene: "life", aSide: "right", q: "仲間うちの活動では？", left: "裏方として支える役が落ち着く", right: "まとめ役として前に立つ役が落ち着く" },
    { id: "C35", axis: "bond", scene: "life", aSide: "right", q: "人の悩みを聞くときは？", left: "深入りせず、本人が決めることを尊重する", right: "気持ちに寄り添って、一緒に悩む" },
    { id: "C36", axis: "steady", scene: "life", aSide: "right", q: "物の置き場所は？", left: "使いやすいように、そのつど変える", right: "定位置を決めて、そこに戻す" }
  ];

  // 設問文の変更履歴
  var CHANGELOG = [
    { version: "0.5.1-draft", note: "分かりにくいという指摘を受け、5問（C19・C21・C26・C30・C31）の文だけを言い換え。軸・場面・向き（keyed）・採点・判定表は変更なし。" },
    { version: "0.5.0-draft", note: "回答方式を「A/B比較＋5択」から「1つの文に、あてはまり度を5段階で答える方式」へ変更。36問の文を新しく書き直し（各軸：A極の文3問・B極の文3問の逆転項目つき）。軸・場面・A極の位置・しきい値・タイプ判定表は変更なし。旧A/B比較の文は LEGACY_AB_ITEMS に履歴として保存。0.4.0以前の回答とは意味が違うため、同じ結果になるとは限りません。" },
    { version: "0.4.0-draft", note: "画面の見せ方を変更：質問1行＋A・B各1文（短く）＋共通5択。意味・軸・A極の位置・採点は変更なし。旧文は各設問の prev に保存" },
    { version: "0.3.0-draft", note: "36問の文を平易に書き直し（0.2.0から）" }
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
    AXES: AXES, SCENES: SCENES, ITEMS: ITEMS, CHOICES: CHOICES, CHANGELOG: CHANGELOG,
    LEGACY_AB_ITEMS: LEGACY_AB_ITEMS, PROFILES: PROFILES, TIE_BREAK_ORDER: TIE_BREAK_ORDER, CONFIG: CONFIG
  };
  if (typeof module !== "undefined" && module.exports) module.exports = root.KAKU_CORE36_DATA;
})(typeof globalThis !== "undefined" ? globalThis : this);

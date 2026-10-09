/**
 * kaku-lab/lab-logic.js
 * KAKU 体験版（検証用）の「画面に依存しない」部分：価値観14領域、STATE6項目、12TYPEの出し方、KAKU GAP。
 * 画面（DOM）のコードは lab-app.js にあり、ここには通信するコードも保存のコードもありません。
 *
 * すべて暫定版です（value-0.1.0-draft / state-0.1.0-draft / type-0.4.0-draft / followup-0.1.0-draft）。
 * 実際の利用者での検証はしていません。
 */
(function (root) {
  "use strict";

  var DATA = root.KAKU_CORE36_DATA || (typeof require !== "undefined" ? require("./core36-data.js") : null);
  var ENGINE = root.KAKU_CORE36 || (typeof require !== "undefined" ? require("./core36-engine.js") : null);

  var VERSIONS = {
    core: DATA.VERSION,
    followup: "followup-0.3.0-draft",
    type: "type-0.4.0-draft",
    value: "value-0.1.0-draft",
    state: "state-0.1.0-draft",
    gap: "gap-0.1.0-draft",
    book: "book-0.3.0-draft"
  };

  // ------------------------------------------------------------------
  // 価値観 14領域（領域は固定。名前は指定どおり。desc・unmet・tip はKAKUの仮の文面）
  // ------------------------------------------------------------------
  var DOMAINS = [
    { id: "GROWTH", name: "成長", desc: "できることが増える。昨日より成長している",
      unmet: "成長している実感が持てていない", tip: "ここ1か月で「前よりできるようになったこと」を1つ書き出してみる" },
    { id: "FREEDOM", name: "自由", desc: "自分で決められる。時間や場所に縛られない",
      unmet: "自分で決められている感覚が弱い", tip: "今週、誰にも合わせず自分だけで決める時間を30分つくる" },
    { id: "CHALLENGE", name: "新しさ・変化", desc: "新しいことに挑む。変化がある毎日",
      unmet: "新しいことに挑めていない", tip: "いつもと違うことを、小さく1つだけ試してみる" },
    { id: "FAMILY", name: "家族・特に近い人", desc: "家族や、特に近い人と過ごす時間と絆",
      unmet: "家族や特に近い人との時間が足りていない", tip: "近い人と、予定のない10分を先に決めておく" },
    { id: "RELATION", name: "人とのつながり", desc: "友人・仲間・職場など、人とのつながり",
      unmet: "人とのつながりが足りないと感じている", tip: "ご無沙汰している人に、一言だけメッセージを送ってみる" },
    { id: "SECURITY", name: "安定", desc: "先が見通せる。生活や仕事が落ち着いている",
      unmet: "先が見通せず、落ち着かない", tip: "不安なことを3つ書き出して、「いまできる備え」を1つだけ決める" },
    { id: "HEALTH", name: "健康・心身の余裕", desc: "体も心も元気で、余裕がある",
      unmet: "体や心の余裕が足りていない", tip: "睡眠・食事・休憩のうち1つだけ、今週整えてみる" },
    { id: "WEALTH", name: "経済的な豊かさ", desc: "お金に困らず、使いたいところに使える",
      unmet: "経済的な豊かさが足りないと感じている", tip: "お金の不安を、ぼんやりではなく数字で1つだけ確認してみる" },
    { id: "ACHIEVEMENT", name: "達成", desc: "目標をやりとげる。結果を出す",
      unmet: "やりとげた・結果を出した実感が持てていない", tip: "小さな目標を1つ決めて、今週中に終わらせてみる" },
    { id: "RECOGNITION", name: "認められること", desc: "頑張りや存在を、周りから認めてもらえる",
      unmet: "頑張りや存在を認められている実感が弱い", tip: "自分が頑張ったことを、信頼できる人に1つ話してみる" },
    { id: "CREATION", name: "創ること", desc: "何かを生み出す。形にする",
      unmet: "何かを形にする時間が取れていない", tip: "10分だけ、形にしたいものに手を動かしてみる" },
    { id: "CONTRIBUTION", name: "貢献", desc: "誰かの役に立つ。社会に貢献する",
      unmet: "誰かの役に立っている実感が弱い", tip: "身近な誰かに、小さな手助けを1つしてみる" },
    { id: "ENJOY", name: "楽しむこと", desc: "楽しい、面白い時間を過ごす",
      unmet: "楽しむ時間が足りていない", tip: "予定の中に、ただ楽しいだけの1時間を入れてみる" },
    { id: "MEANING", name: "意味・信念", desc: "自分の信念を貫く。意味のあることをする",
      unmet: "意味や信念に沿って動けている実感が弱い", tip: "いま自分が信じていることを、一文で書いてみる" }
  ];
  var DOMAIN_BY_ID = {};
  DOMAINS.forEach(function (d, i) { d.order = i; DOMAIN_BY_ID[d.id] = d; });

  var FULFIL_LABELS = [
    "まったく満たされていない", "あまり満たされていない", "どちらともいえない", "まあ満たされている", "とても満たされている"
  ];

  var PAST_PERIOD_OPTIONS = [1, 3, 5, 10]; // 年前。「その他」は1〜40の数字入力

  // ------------------------------------------------------------------
  // STATE 6項目（ここ1週間）。質問の順は OVERALL が最初。
  // ------------------------------------------------------------------
  var STATE_ITEMS = [
    { id: "OVERALL", q: "ここ1週間を、仕事・人間関係・体調などをひっくるめて振り返ると、調子はどうでしたか？",
      lo: "とても悪かった", hi: "とても良かった", short: "全体の調子", validating: false },
    { id: "ENERGY", q: "ここ1週間、体と気力のエネルギーは、どのくらいありましたか？",
      lo: "ほとんどなかった", hi: "とてもあった", short: "エネルギー", validating: false },
    { id: "MOOD", q: "ここ1週間、気分は全体としてどうでしたか？",
      lo: "沈みがちだった", hi: "明るく前向きだった", short: "気分", validating: false },
    { id: "CALM", q: "ここ1週間、気持ちは落ち着いていましたか？",
      lo: "焦り・不安・イライラが多かった", hi: "穏やかで落ち着いていた", short: "落ち着き", validating: false },
    { id: "TRACTION", q: "ここ1週間、やろうとしていたことは、前に進んでいる感じがしましたか？",
      lo: "止まっている感じだった", hi: "しっかり進んでいる感じだった", short: "進んでいる実感", validating: true },
    { id: "INITIATE", q: "ここ1週間、「自分からやってみよう」と思って、実際に動き出すことができましたか？",
      lo: "ほとんどなかった", hi: "何度もあった", short: "自分から動けた", validating: true }
  ];
  var STATE_BY_ID = {};
  STATE_ITEMS.forEach(function (s) { STATE_BY_ID[s.id] = s; });

  // 5段階のボタン文言（両端は項目ごと、中間は共通の言い方）
  function stateChoices(item) {
    return [item.lo, "やや" + midLo(item), "どちらともいえない", "やや" + midHi(item), item.hi];
  }
  var MID_LO = { OVERALL: "悪かった", ENERGY: "なかった", MOOD: "沈みがちだった", CALM: "焦りやイライラが多かった",
                 TRACTION: "止まっている感じだった", INITIATE: "なかった" };
  var MID_HI = { OVERALL: "良かった", ENERGY: "あった", MOOD: "前向きだった", CALM: "落ち着いていた",
                 TRACTION: "進んでいる感じだった", INITIATE: "あった" };
  function midLo(item) { return MID_LO[item.id]; }
  function midHi(item) { return MID_HI[item.id]; }

  function stateWord(v) {
    if (v >= 4) return { key: "good", text: "良い状態" };
    if (v === 3) return { key: "mid", text: "ふつう" };
    return { key: "low", text: "いまは少し低め" };
  }

  // ------------------------------------------------------------------
  // 12TYPE 追加質問の候補バンク（軸ごとに3問。36問と同じ「文＋あてはまり度」の形で、A極の文・B極の文を両方入れる。真ん中のない4段階で答える）
  // ------------------------------------------------------------------
  var FOLLOWUP_BANK = [
    ["F01", "vision", "A", "旅行は、「どんな旅にしたいか」から考え始める"],
    ["F02", "vision", "B", "新しいことは、基本の事例やお手本から入ると安心する"],
    ["F03", "vision", "A", "アイデアを出すときは、できるかどうかを考える前に自由に広げる"],
    ["F04", "logic", "B", "人の意見は、理屈だけでなく経験や雰囲気も含めて判断する"],
    ["F05", "logic", "A", "相談されたら、状況を整理して筋道を立てて答える"],
    ["F06", "logic", "B", "迷ったときは、理由を並べるより直感を信じたほうが後悔しない"],
    ["F07", "drive", "A", "初めての場所は、調べる前にまず歩いてみる"],
    ["F08", "drive", "B", "新しい道具は、説明書を読んでから使いたい"],
    ["F09", "drive", "A", "チャンスが来たら、迷っても乗ってみる"],
    ["F10", "influence", "B", "初対面の人が多い場では、話しかけられるのを待つことが多い"],
    ["F11", "influence", "A", "自分の考えは、聞かれる前に伝えたい"],
    ["F12", "influence", "B", "グループでは、目立たなくても支える役が好きだ"],
    ["F13", "bond", "A", "友人が失敗したら、まず「大変だったね」と気持ちを受け止める"],
    ["F14", "bond", "B", "頼まれごとは、自分の予定を優先して、無理なら断る"],
    ["F15", "bond", "A", "相手の表情や声の調子の変化に、すぐ気づく"],
    ["F16", "steady", "B", "朝の支度の順番は、その日の気分や予定で変わる"],
    ["F17", "steady", "A", "計画は、細かいところまで決めておきたい"],
    ["F18", "steady", "B", "始めたことが合わなくなったら、やめて別のことをする"]
  ].map(function (r) {
    return { id: r[0], axis: r[1], scene: "life", keyed: r[2], text: r[3], followup: true };
  });
  var FOLLOWUP_BY_ID = {};
  FOLLOWUP_BANK.forEach(function (f) { FOLLOWUP_BY_ID[f.id] = f; });
  var FOLLOWUP_CHOICES = [
    { value: 1, label: "全くあてはまらない",   adv: "全く",   tail: "あてはまらない", strength: 2 },
    { value: 2, label: "あまりあてはまらない", adv: "あまり", tail: "あてはまらない", strength: 1 },
    { value: 4, label: "少しあてはまる",       adv: "少し",   tail: "あてはまる",     strength: 1 },
    { value: 5, label: "かなりあてはまる",     adv: "かなり", tail: "あてはまる",     strength: 2 }
  ];
  var AXIS_ORDER = ["vision", "logic", "drive", "influence", "bond", "steady"];

  // ------------------------------------------------------------------
  // 12TYPE の出し方（type-0.4.0-draft）
  //  ① 明確  ：根拠あり・近さ弱めでない・1位と2位の距離の差が3以上 → 1つ表示
  //  ② 僅差  ：根拠あり・近さ弱めでない・差が3未満 → 既存の同点ルールで1つ表示（2番目は出さない。内部には記録）
  //  ③ 根拠が弱い：根拠なし / 近さ弱め → 追加質問（3〜6問）。それでも近さが弱めなら、いちばん近いタイプを「参考」として1つ表示（note=weak）。
  //     寄りのある軸が1つもない／完全な同点が4つ以上のときだけ「保留」
  // 表示するタイプは常に1つ（または保留）。
  // ------------------------------------------------------------------
  function stageOf(type) {
    if (!type || type.status === "incomplete") return 0;
    if (type.status === "no_basis" || type.status === "weak") return 3;
    if (type.margin !== null && type.margin < DATA.CONFIG.marginDelta - 1e-9) return 2;
    return 1;
  }

  function followupTargets(base) {
    var rows = AXIS_ORDER.map(function (id, i) {
      var a = base.axes[id];
      return { id: id, order: i, lean: !!(a && a.lean), abs: a && a.status === "ok" ? Math.abs(a.mean) : 99 };
    }).filter(function (r) { return !r.lean; });
    rows.sort(function (a, b) { return (a.abs - b.abs) || (a.order - b.order); });
    return rows.slice(0, 2).map(function (r) { return r.id; });
  }

  function followupItemsFor(targets) {
    var out = [];
    targets.forEach(function (ax) {
      FOLLOWUP_BANK.forEach(function (f) { if (f.axis === ax) out.push(f.id); });
    });
    return out;
  }

  function scoreWithFollowup(answers, followupAnswers) {
    var data = { ITEMS: DATA.ITEMS.concat(FOLLOWUP_BANK.map(function (f) {
      return { id: f.id, axis: f.axis, scene: f.scene, keyed: f.keyed, text: f.text };
    })) };
    var merged = {};
    Object.keys(answers).forEach(function (k) { merged[k] = answers[k]; });
    Object.keys(followupAnswers || {}).forEach(function (k) { merged[k] = followupAnswers[k]; });
    return ENGINE.score(merged, { data: data });
  }

  /**
   * 36問（と、あれば追加質問）への回答から、画面に出すタイプの決定をまとめて返す。
   * @returns {object} { complete, base, stage, needFollowup, followupIds, shown, note, internal }
   */
  function decideType(answers, followup) {
    followup = followup || { asked: [], answers: {} };
    var base = ENGINE.score(answers);
    var out = {
      complete: base.status === "complete", base: base, baseStage: 0, finalStage: 0,
      needFollowup: false, followupIds: [], targets: [],
      shown: null, held: false, note: null, final: base,
      internal: null
    };
    if (!out.complete) return out;
    out.baseStage = stageOf(base.type);
    var t = base.type;
    out.internal = {
      stage: out.baseStage, margin: t.margin === Infinity ? null : t.margin, distance: t.distance,
      nearTie: out.baseStage === 2 ? [t.primary, t.second] : [], tieResolvedBy: t.tieResolvedBy
    };

    if (out.baseStage === 1 || out.baseStage === 2) {
      out.shown = t.primary; out.finalStage = out.baseStage;
      return out;
    }
    // ③ 根拠が弱い
    var targets = followupTargets(base);
    out.targets = targets;
    var asked = followup.asked || [];
    if (!asked.length) {
      if (targets.length) {
        out.needFollowup = true;
        out.followupIds = followupItemsFor(targets);
        return out; // 追加質問の回答待ち。まだタイプは出さない
      }
      // 追加質問の対象になる軸がない：根拠が薄いことを添えて、近いタイプを1つ表示。根拠なしなら保留。
      if (t.primary) { out.shown = t.primary; out.note = "weak"; out.finalStage = 3; }
      else { out.held = true; out.finalStage = 3; }
      return out;
    }
    // 追加質問の回答あり：対象軸だけ9問で再計算（タイプの判定にだけ使う）
    var ext = scoreWithFollowup(answers, followup.answers);
    out.final = ext;
    var et = ext.type;
    var stage2 = stageOf(et);
    out.finalStage = stage2;
    out.internal.afterFollowup = { stage: stage2, margin: et.margin === Infinity ? null : et.margin, distance: et.distance,
                                   nearTie: stage2 === 2 ? [et.primary, et.second] : [] };
    if (stage2 === 1 || stage2 === 2) { out.shown = et.primary; return out; }
    // 追加質問の後でも根拠が弱い（近さが弱め）：いちばん近い代表タイプを「参考」として1つ表示する（type-0.4.0）
    if (et.primary) { out.shown = et.primary; out.note = "weak"; return out; }
    out.held = true; // 寄りのある軸が1つもない／完全な同点が4つ以上：参考にできる根拠もないので保留
    return out;
  }

  // ------------------------------------------------------------------
  // KAKU GAP（1つの点数にまとめない）
  // ------------------------------------------------------------------
  function fulfilBucket(v) { return v <= 2 ? "low" : (v === 3 ? "mid" : "high"); }

  // ① 価値観のズレ：いま特に大切な3つと、その充足度
  function gapFulfilment(cur) {
    if (!cur || !cur.important || cur.important.length !== 3) return null;
    var rows = cur.important.map(function (id) {
      var v = cur.fulfil ? cur.fulfil[id] : null;
      return { id: id, name: DOMAIN_BY_ID[id].name, isTop: id === cur.top, fulfil: v, bucket: v ? fulfilBucket(v) : null, order: DOMAIN_BY_ID[id].order };
    });
    rows.sort(function (a, b) {
      if (a.isTop !== b.isTop) return a.isTop ? -1 : 1;
      return ((a.fulfil || 9) - (b.fulfil || 9)) || (a.order - b.order);
    });
    var allHigh = rows.every(function (r) { return r.bucket === "high"; });
    return { rows: rows, allHigh: allHigh, anyLow: rows.some(function (r) { return r.bucket === "low"; }) };
  }

  // ② 価値観の変化：過去の3つと現在の3つを同じ領域IDで比べる
  function gapChange(past, cur) {
    if (!past || past.skipped || !past.important || past.important.length !== 3 || !cur || cur.important.length !== 3) return null;
    var pi = past.important, ci = cur.important;
    var kept = ci.filter(function (id) { return pi.indexOf(id) >= 0; });
    var added = ci.filter(function (id) { return pi.indexOf(id) < 0; }).map(function (id) {
      return { id: id, big: (past.less || []).indexOf(id) >= 0 };
    });
    var dropped = pi.filter(function (id) { return ci.indexOf(id) < 0; }).map(function (id) {
      return { id: id, big: (cur.less || []).indexOf(id) >= 0 };
    });
    added.sort(function (a, b) { return (b.big - a.big) || (DOMAIN_BY_ID[a.id].order - DOMAIN_BY_ID[b.id].order); });
    dropped.sort(function (a, b) { return (b.big - a.big) || (DOMAIN_BY_ID[a.id].order - DOMAIN_BY_ID[b.id].order); });
    return {
      years: past.period ? past.period.yearsAgo : 3,
      kept: kept, added: added, dropped: dropped,
      allSame: kept.length === 3,
      top: { past: past.top, cur: cur.top, same: past.top === cur.top }
    };
  }

  // ------------------------------------------------------------------
  // 保存・書き出しのデータ（名前・メール・生年月日は持たない）
  // ------------------------------------------------------------------
  function buildExport(S, R) {
    var d = {
      schema: "kaku-lab-export/1",
      exportedAt: new Date().toISOString(),
      versions: VERSIONS,
      core36: { answers: S.answers || {}, seconds: S.seconds || {}, discomfort: S.discomfort || {}, answerScale: "1=全くあてはまらない,2=あまりあてはまらない,3=どちらともいえない,4=少しあてはまる,5=かなりあてはまる（採点は設問ごとの keyed：A=A極の文は r−3、B=B極の文（逆転）は 3−r）", textChangelog: DATA.CHANGELOG || [] },
      typeFollowup: { asked: (S.followup && S.followup.asked) || [], answers: (S.followup && S.followup.answers) || {} },
      pastValues: S.past ? {
        period: S.past.period || { yearsAgo: 3, changedByUser: false },
        important: S.past.important || [], top: S.past.top || null, lessImportant: S.past.less || [],
        skipped: !!S.past.skipped, basis: "recall"
      } : null,
      currentValues: S.cur ? {
        important: S.cur.important || [], top: S.cur.top || null, lessImportant: S.cur.less || [],
        fulfillment: S.cur.fulfil || {}, fulfillmentWindow: "last_month"
      } : null,
      state: S.state ? Object.assign({ window: "last_7_days" }, S.state) : null,
      result: null
    };
    if (R && R.type) {
      d.result = {
        type: {
          stage: R.type.finalStage === 1 ? "clear" : R.type.finalStage === 2 ? "nearTie" : (R.type.held ? "held" : "weakNote"),
          shown: R.type.shown, internal: R.type.internal
        }
      };
    }
    return d;
  }

  var API = {
    VERSIONS: VERSIONS, DOMAINS: DOMAINS, DOMAIN_BY_ID: DOMAIN_BY_ID, FULFIL_LABELS: FULFIL_LABELS,
    PAST_PERIOD_OPTIONS: PAST_PERIOD_OPTIONS,
    STATE_ITEMS: STATE_ITEMS, STATE_BY_ID: STATE_BY_ID, stateChoices: stateChoices, stateWord: stateWord,
    FOLLOWUP_BANK: FOLLOWUP_BANK, FOLLOWUP_BY_ID: FOLLOWUP_BY_ID, FOLLOWUP_CHOICES: FOLLOWUP_CHOICES, AXIS_ORDER: AXIS_ORDER,
    stageOf: stageOf, followupTargets: followupTargets, followupItemsFor: followupItemsFor,
    scoreWithFollowup: scoreWithFollowup, decideType: decideType,
    fulfilBucket: fulfilBucket, gapFulfilment: gapFulfilment, gapChange: gapChange,
    buildExport: buildExport,
    CORE: DATA, ENGINE: ENGINE
  };
  root.KAKU_LAB_LOGIC = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : this);

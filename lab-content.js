/**
 * kaku-lab/lab-content.js
 * 回答（S）から、結果画面の人物像・価値観の変化・GAP・今の状態、そして PERSONAL BOOK（5章）の中身を作る。
 * 画面（DOM）には触れません。通信もしません。
 *
 * 方針
 *  - 人物像と BOOK の文は「回答で寄りが出た軸」の文だけを使う。寄りが出ていない軸について特徴を作らない。
 *  - 12TYPEは1つだけ（または保留）。2番目のタイプは、どこにも出さない。
 *  - 総合スコアは作らない。GAPは「今大切なもの×満たされ具合」と「過去と現在の大切なものの違い」を言葉で出す。
 *  - 文は book-0.3.0-draft。採点・文章の正確性は未検証。
 */
(function (root) {
  "use strict";

  var L = root.KAKU_LAB_LOGIC || (typeof require !== "undefined" ? require("./lab-logic.js") : null);
  var P = root.KAKU_LAB_POLES || (typeof require !== "undefined" ? require("./lab-poles.js") : null);

  // 12TYPEの表示情報。既存の types-data.js（KAKU_TYPES）があればそれを使い、なければ最小限の控えを使う。
  var FALLBACK_TYPES = {
    architect: ["設計者", "ARCHITECT", "#4A5BB5", "architect.jpg"], pioneer: ["開拓者", "PIONEER", "#3B6FCF", "pioneer.jpg"],
    commander: ["指揮官", "COMMANDER", "#B8231B", "commander.jpg"], creator: ["創造者", "CREATOR", "#8458BF", "creator.jpg"],
    strategist: ["戦略家", "STRATEGIST", "#2B3590", "strategist.jpg"], challenger: ["挑戦者", "CHALLENGER", "#E0522E", "challenger.jpg"],
    influencer: ["伝道者", "INFLUENCER", "#DD4A60", "influencer.jpg"], connector: ["連結者", "CONNECTOR", "#1FA37F", "connector.jpg"],
    navigator: ["案内者", "NAVIGATOR", "#0B6B58", "navigator.jpg"], guardian: ["守護者", "GUARDIAN", "#2F7D4F", "guardian.jpg"],
    executor: ["遂行者", "EXECUTOR", "#9A2B1E", "executor.jpg"], specialist: ["探究者", "SPECIALIST", "#6E9B2F", "specialist.jpg"]
  };
  function typeMeta(id) {
    if (!id) return null;
    var T = root.KAKU_TYPES_FOR_LAB || (typeof KAKU_TYPES !== "undefined" ? KAKU_TYPES : null);
    var t = T && T[id];
    var f = FALLBACK_TYPES[id];
    if (!t && !f) return null;
    return {
      id: id,
      nameJp: t ? t.nameJp : f[0], nameEn: t ? t.nameEn : f[1],
      color: t ? t.color : f[2], image: t ? t.image : f[3],
      catchcopy: t && t.catchcopy ? t.catchcopy : "", praise: t && t.praise ? t.praise : "",
      weapon: t && t.weapon || "", blindSpot: t && t.blindSpot || "", teamRole: t && t.teamRole || "",
      relationStyle: t && t.relationStyle || "", awaken: t && t.awaken || null, shutdown: t && t.shutdown || null
    };
  }

  var AXIS_BY_ID = {};
  L.CORE.AXES.forEach(function (a) { AXIS_BY_ID[a.id] = a; });

  function dom(id) { return L.DOMAIN_BY_ID[id]; }
  function q(id) { return "「" + dom(id).name + "」"; }
  function joinNames(ids) { return ids.map(q).join("・"); }
  function compact(a) { return a.filter(function (x) { return x; }); }

  // ------------------------------------------------------------------
  // 軸の読み分け：寄り（a/b）／どちらにも寄らない／場面で違う
  // ------------------------------------------------------------------
  function readAxes(core) {
    var leans = [], balanced = [], sceneDiff = [];
    L.AXIS_ORDER.forEach(function (id, order) {
      var a = core.axes[id];
      if (!a || a.status !== "ok") return;
      var rec = { axis: id, order: order, mean: a.mean, abs: Math.abs(a.mean), position: a.position, info: a };
      var k = a.reading.kind;
      if (k === "a" || k === "b") {
        rec.pole = k === "a" ? "A" : "B";
        rec.poleName = k === "a" ? AXIS_BY_ID[id].poleA : AXIS_BY_ID[id].poleB;
        rec.strong = rec.abs >= 1.2;
        rec.p = P.POLES[id][rec.pole];
        rec.c = P.CHARM[id][rec.pole];
        leans.push(rec);
      } else if (k === "scene_diff") {
        rec.work = a.sceneMeans.work; rec.life = a.sceneMeans.life;
        rec.workPole = rec.work > 0 ? AXIS_BY_ID[id].poleA : AXIS_BY_ID[id].poleB;
        rec.lifePole = rec.life > 0 ? AXIS_BY_ID[id].poleA : AXIS_BY_ID[id].poleB;
        sceneDiff.push(rec);
      } else {
        rec.bal = P.BALANCED[id];
        rec.bc = P.BALANCED_CHARM[id];
        balanced.push(rec);
      }
    });
    leans.sort(function (x, y) { return (y.abs - x.abs) || (x.order - y.order); });
    return { leans: leans, balanced: balanced, sceneDiff: sceneDiff };
  }

  // ------------------------------------------------------------------
  // 人物像（結果画面の最初）
  // ------------------------------------------------------------------
  // 回答の言い換えではなく、「どんな人か」の解釈と、その魅力（褒め）を書く。
  //  tm : 代表タイプを自信を持って出せるときだけ渡す（weak・保留では null）
  function buildPortrait(ax, tm) {
    var leans = ax.leans, bals = ax.balanced;
    var out = { sentences: [], how: [], scenes: [], mixed: [], title: "", epithet: "", charms: [], twists: [], fans: [], typePraise: "", wide: "", closing: "", noLean: !leans.length };

    // 魅力カード：寄りの強い順に最大3つ。足りなければ「どちらにも寄らない」軸の魅力で補う
    leans.slice(0, 3).forEach(function (l) {
      out.charms.push({ axis: l.axis, axisName: AXIS_BY_ID[l.axis].nameJp, title: l.c.title, you: l.c.you, text: l.c.text, fan: l.c.fan, kind: "lean", c: l.c });
    });
    for (var i = 0; i < bals.length && out.charms.length < 3; i++) {
      var b = bals[i];
      out.charms.push({ axis: b.axis, axisName: AXIS_BY_ID[b.axis].nameJp, title: b.bc.title, you: b.bc.you, text: b.bc.text, fan: b.bc.fan, kind: "balanced", c: b.bc });
    }

    // 一言（見出し）と、その言い換え
    var cs = out.charms;
    if (cs.length >= 2) out.title = cs[0].title + " × " + cs[1].title;
    else if (cs.length === 1) out.title = cs[0].title;
    if (cs.length >= 2) out.epithet = "あなたは、" + cs[0].c.ept + "、" + cs[1].c.epe + "です。";
    else if (cs.length === 1) out.epithet = "あなたは、" + cs[0].c.epe + "です。";

    // 代表タイプが確かなときは、そのタイプの称賛文を添える。確かでないときは「型に収まらない幅」として書く
    if (tm && tm.praise) out.typePraise = tm.praise;
    else out.wide = "ひとつの型にきれいに収まらないのは、あなたの幅の広さの表れです。";

    // 場面で違う軸：二つの顔
    ax.sceneDiff.forEach(function (s) {
      out.twists.push({
        axisName: AXIS_BY_ID[s.axis].nameJp, work: s.workPole, life: s.lifePole,
        text: "「" + AXIS_BY_ID[s.axis].nameJp + "」では、仕事は「" + s.workPole + "」寄り、日常は「" + s.lifePole + "」寄り。場面ごとに自分を切り替えられるのは、状況を読める人にしかできないことです。"
      });
    });

    out.fans = cs.map(function (c) { return c.fan; });
    if (cs.length) out.closing = "自分の答えに、ちゃんと向き合えたあなたは、それだけで素敵です。ここに書いたのは、あなたの魅力の入口です。読み返して、「あ、これ自分だ」と思えるところを、ひとつ見つけてください。";

    // 互換用（本文の文）
    if (out.epithet) out.sentences.push(out.epithet);
    if (out.typePraise) out.sentences.push(out.typePraise); else if (out.wide) out.sentences.push(out.wide);
    return out;
  }

  // ------------------------------------------------------------------
  // 武器・罠・役割・向き合い方・覚醒・力を失う環境（以前の無料診断結果と同じ6枠）
  //  代表タイプが確かなときは、そのタイプの文。近さが弱い・保留のときは、寄りの強い軸の文から作る
  // ------------------------------------------------------------------
  function buildCards(ax, tm, weak) {
    var cards = null;
    if (tm && !weak && tm.weapon) {
      cards = [
        { key: "weapon", title: "あなたの武器", en: "WEAPON", text: tm.weapon },
        { key: "blind", title: "あなたが陥りやすい罠", en: "BLIND SPOT", text: tm.blindSpot },
        { key: "role", title: "組織で輝く役割", en: "TEAM ROLE", text: tm.teamRole },
        { key: "rel", title: "人との向き合い方", en: "RELATION STYLE", text: tm.relationStyle },
        { key: "awaken", title: "あなたが覚醒する条件", en: "AWAKEN", kw: tm.awaken ? tm.awaken.keywords : [], text: tm.awaken ? tm.awaken.sentence : "" },
        { key: "shut", title: "力を失いやすい環境", en: "SHUTDOWN", kw: tm.shutdown ? tm.shutdown.keywords : [], text: tm.shutdown ? tm.shutdown.sentence : "" }
      ];
    } else if (ax.leans.length) {
      var p = ax.leans[0].p;
      cards = [
        { key: "weapon", title: "あなたの武器", en: "WEAPON", text: p.power[0] + "。" + p.power[1] },
        { key: "blind", title: "あなたが陥りやすい罠", en: "BLIND SPOT", text: p.backfire },
        { key: "role", title: "組織で輝く役割", en: "TEAM ROLE", text: p.work },
        { key: "rel", title: "人との向き合い方", en: "RELATION STYLE", text: p.others },
        { key: "awaken", title: "あなたが覚醒する条件", en: "AWAKEN", kw: [], text: p.good },
        { key: "shut", title: "力を失いやすい環境", en: "SHUTDOWN", kw: [], text: p.bad }
      ];
    }
    return cards;
  }

  // KAKU GAP の点数（0〜100）：大切な3つの「満たされ」の低さ。0に近いほどズレが小さい
  function gapScore(g) {
    if (!g) return null;
    var rows = g.rows.filter(function (r) { return r.fulfil; });
    if (!rows.length) return null;
    var sum = 0; rows.forEach(function (r) { sum += (5 - r.fulfil) / 4 * 100; });
    var score = Math.round(sum / rows.length);
    var tier = score < 25 ? { key: "s", label: "GAPは小さめ" } : score < 50 ? { key: "m", label: "少しズレがあります" } : score < 75 ? { key: "l", label: "ズレがやや大きめ" } : { key: "xl", label: "ズレが大きめ" };
    return { score: score, tier: tier };
  }

  // ------------------------------------------------------------------
  // 価値観の変化・GAP の文
  // ------------------------------------------------------------------
  function describeChange(ch) {
    if (!ch) return null;
    var y = ch.years + "年前";
    var lines = [];
    // 見出しになる一文（いちばん大切なもの）を最初に
    lines.push({ kind: "top", text: ch.top.same
      ? y + "も今も、いちばん大切にしているのは" + q(ch.top.cur) + "。時間がたっても変わらない、あなたの芯と言えそうです。"
      : y + "は" + q(ch.top.past) + "を何より大切にしてきたあなたが、今いちばん大切にしているのは" + q(ch.top.cur) + "。いろいろな経験を重ねてきたからこその、自然な動きかもしれません。" });
    if (ch.allSame) {
      lines.push({ kind: "same", text: "大切な3つ（" + joinNames(ch.kept) + "）は、" + y + "と今で同じ。ぶれずに、自分の軸を持ち続けています。" });
    } else {
      if (ch.kept.length) lines.push({ kind: "kept", text: y + "も今も、" + joinNames(ch.kept) + "を大切にしています。変わらない土台です。" });
      ch.added.forEach(function (a) {
        lines.push({ kind: a.big ? "big" : "added",
          text: a.big ? y + "は「あまり大切ではない」と選んでいた" + q(a.id) + "が、今は大切な3つに。大きな変化で、気持ちが大きく動いたことがうかがえます。"
                      : q(a.id) + "が、新しく大切な3つに加わりました。いまのあなたが、大事にしたいと感じはじめたものです。" });
      });
      ch.dropped.forEach(function (d) {
        lines.push({ kind: d.big ? "big" : "dropped",
          text: d.big ? y + "に大切にしていた" + q(d.id) + "は、今は「あまり大切ではない」側に。大きな変化で、気持ちの置きどころが大きく変わったようです。"
                      : y + "に大切にしていた" + q(d.id) + "は、今回は3つの外に。十分に向き合ってきたからこそ、次のことに目が向いたのかもしれません。" });
      });
    }
    return lines;
  }

  function describeFulfil(g1) {
    if (!g1) return null;
    var rows = g1.rows.map(function (r) {
      var d = dom(r.id);
      var text = r.bucket === "low" ? "大切なのに、いまは満たされていないと感じている。" + d.unmet + "。"
               : r.bucket === "mid" ? "大切で、どちらともいえないところ。"
               : "大切で、いま満たされている。";
      return { id: r.id, name: d.name, isTop: r.isTop, bucket: r.bucket, fulfil: r.fulfil, text: text };
    });
    return { rows: rows, allHigh: g1.allHigh, lead: g1.allHigh ? "大切にしていることは、いまおおむね満たされています。" : null };
  }

  // ------------------------------------------------------------------
  // 今の状態
  // ------------------------------------------------------------------
  function describeState(st) {
    if (!st) return null;
    var rows = L.STATE_ITEMS.map(function (it) {
      var v = st[it.id];
      var w = v ? L.stateWord(v) : null;
      return { id: it.id, name: it.short, value: v || null, word: w ? w.text : null, key: w ? w.key : null, validating: it.validating };
    });
    var lows = ["ENERGY", "MOOD", "CALM"].filter(function (id) { return st[id] && st[id] <= 2; });
    var highs = ["ENERGY", "MOOD", "CALM"].every(function (id) { return st[id] >= 4; });
    var summary = lows.length
      ? "いまは、" + lows.map(function (id) { return "「" + L.STATE_BY_ID[id].short + "」"; }).join("・") + "が少し低めです。"
      : highs ? "いまは、エネルギー・気分・落ち着きのどれも良い状態です。" : "いまは、ふつうの範囲の状態です。";
    return { rows: rows, summary: summary, lows: lows, highs: highs };
  }

  // ------------------------------------------------------------------
  // 全体の結果
  // ------------------------------------------------------------------
  function buildResult(S) {
    var answers = S.answers || {};
    var type = L.decideType(answers, S.followup);
    var core = type.base; // CORE6の表示は36問の結果のまま
    var ax = type.complete ? readAxes(core) : { leans: [], balanced: [], sceneDiff: [] };
    var cur = S.cur && S.cur.important && S.cur.important.length === 3 ? S.cur : null;
    var g1 = cur && cur.fulfil && Object.keys(cur.fulfil).length >= 14 ? L.gapFulfilment(cur) : null;
    var g2 = cur ? L.gapChange(S.past, cur) : null;
    var R = {
      versions: L.VERSIONS, type: type, core: core, ax: ax,
      shownType: type.shown ? typeMeta(type.shown) : null,
      portrait: buildPortrait(ax, type.shown && type.note !== "weak" ? typeMeta(type.shown) : null),
      cards: buildCards(ax, type.shown ? typeMeta(type.shown) : null, type.note === "weak"),
      cur: cur, gapFulfil: describeFulfil(g1), gapFulfilRaw: g1, gapScore: gapScore(g1),
      change: describeChange(g2), changeRaw: g2,
      state: describeState(S.state && Object.keys(S.state).length ? S.state : null),
      pastSkipped: !!(S.past && S.past.skipped)
    };
    R.book = buildBook(R);
    return R;
  }

  // ------------------------------------------------------------------
  // PERSONAL BOOK（5章）
  // ------------------------------------------------------------------
  var CHAPTERS = [
    { n: 1, title: "あなたという人" },
    { n: 2, title: "あなたの武器" },
    { n: 3, title: "力が出るとき・出ないとき" },
    { n: 4, title: "人との関わり方" },
    { n: 5, title: "あなたの取扱説明書" }
  ];

  function buildBook(R) {
    var leans = R.ax.leans, bal = R.ax.balanced;
    var top = leans.slice(0, 3);
    var pages = [];
    function add(ch, title, lead, blocks) {
      pages.push({ chapter: ch, title: title, lead: lead, blocks: compact(blocks) });
    }
    function p(text) { return text ? { t: "p", text: text } : null; }
    function h(text) { return text ? { t: "h", text: text } : null; }
    function kv(k, v) { return v ? { t: "kv", k: k, v: v } : null; }

    var curTop = R.cur ? R.cur.top : null;
    var topDom = curTop ? dom(curTop) : null;

    // ---- 第1章 あなたという人 ----
    if (top.length) {
      add(1, "あなたは、こういう人", top[0].p.hook, [
        p(top[0].p.how),
        top[1] ? p(top[1].p.how) : null,
        top[2] ? p("もう一つ、" + AXIS_BY_ID[top[2].axis].nameJp + "の面では、" + top[2].p.end + "という傾向も出ています。") : null
      ]);
      add(1, "それは、実際の場面ではこう出る", "では、それは毎日のどんな場面に出ているのでしょうか。", [
        h("仕事の中で"), p(top[0].p.work),
        h("休日や暮らしの中で"), p((top[1] || top[0]).p.life)
      ]);
    } else {
      add(1, "あなたは、こういう人", "あなたの答えは、どれか一つの方向に強く寄るものではありませんでした。", [
        p("寄りが出なかったということは、特徴がない、という意味ではありません。場面に合わせて、動き方を変えている可能性があります。"),
        bal[0] ? p(bal[0].bal.line) : null,
        bal[1] ? p(bal[1].bal.line) : null,
        p("設問に迷う場面が多かった場合も、この形になります。ここに書けるのは、答えから読み取れる範囲までです。")
      ]);
    }
    // 価値観のページ
    if (topDom) {
      var fl = R.gapFulfilRaw ? R.gapFulfilRaw.rows.filter(function (r) { return r.id === curTop; })[0] : null;
      var blocks = [
        p("いまのあなたが、いちばん大切にしているのは" + q(curTop) + "。「" + topDom.desc + "」という価値観です。"),
        fl && fl.bucket === "low" ? p("ただ、回答では、ここが「いまは満たされていない」側でした。" + topDom.unmet + "。ここが、いまのあなたのいちばんの引っかかりかもしれません。")
          : fl && fl.bucket === "high" ? p("そして、回答ではここが「いま満たされている」側でした。大切にしていることに、手が届いている状態です。") : null
      ];
      if (R.changeRaw) {
        var ch = R.changeRaw, y = ch.years + "年前";
        blocks.push(ch.top.same ? p(y + "のあなたも、いちばん大切にしていたのは" + q(ch.top.cur) + "でした。ここは、変わらないあなたの核かもしれません。")
          : p(y + "は" + q(ch.top.past) + "がいちばんでしたが、いまは" + q(ch.top.cur) + "に変わっています。この変化は、あなたの記憶による振り返りです。"));
      }
      add(1, "何のために動くのか", "ここまでは「どう動くか」の話でした。次は、「何のために動くか」です。", blocks);
    }

    // ---- 第2章 あなたの武器 ----
    if (top.length) {
      top.forEach(function (l, i) {
        add(2, "武器" + (i + 1) + "：" + l.p.power[0], l.p.power[1], [
          p(l.strong ? "この傾向は、回答にはっきり出ていました。" : "この傾向は、回答に表れていました。（強さは中くらいです）"),
          p("あなたが「" + l.poleName + "」寄りなのは、" + AXIS_BY_ID[l.axis].nameJp + "の6問の回答から読み取れたことです。")
        ]);
      });
    } else {
      bal.slice(0, 2).forEach(function (b, i) {
        add(2, "武器" + (i + 1) + "：" + b.bal.power[0], b.bal.power[1], [p(b.bal.line)]);
      });
    }

    // ---- 第3章 力が出るとき・出ないとき ----
    if (top.length) {
      add(3, "力が出る日と、出ない日", "同じあなたでも、力が出る日と出ない日があります。分かれ目は、ここです。", [
        h("力が出るとき"), p(top[0].p.good), top[1] ? p(top[1].p.good) : null,
        h("力が出にくいとき"), p(top[0].p.bad), top[1] ? p(top[1].p.bad) : null
      ]);
      add(3, "強みが裏目に出るとき", "強みは、使い方を間違えると、そのまま弱みになります。", [
        p(top[0].p.backfire), top[1] ? p(top[1].p.backfire) : null,
        p("ここに書いたことは、「そうなりやすい傾向」です。当てはまらないと感じたら、それも大切な情報です。")
      ]);
    }
    // 状態のページ
    var st = R.state;
    if (st) {
      var stateBlocks = [];
      if (st.lows.length) {
        stateBlocks.push(p(st.summary + "この時期は、ここまで書いた「力が出るとき」の状態に、なりにくいかもしれません。"));
        stateBlocks.push(p("強みを無理に発揮しようとするより、まず回復を優先して大丈夫です。"));
      } else if (st.highs) {
        stateBlocks.push(p(st.summary + "新しいことに力を使うには、よい時期かもしれません。"));
      } else {
        stateBlocks.push(p(st.summary));
      }
      if (R.gapFulfilRaw && R.gapFulfilRaw.anyLow) {
        var lowRows = R.gapFulfilRaw.rows.filter(function (r) { return r.bucket === "low"; });
        stateBlocks.push(p("また、大切にしている" + joinNames(lowRows.map(function (r) { return r.id; })) + "が満たされていないという回答でした。調子の波には、こうした背景も関わっているかもしれません。"));
      }
      stateBlocks.push(p("この状態は、日によって変わります。今回の1週間の様子であって、あなたの性格ではありません。"));
      add(3, "いまのコンディション", "そして、いまのあなたのコンディションの話です。", stateBlocks);
    }

    // ---- 第4章 人との関わり方 ----
    if (top.length) {
      add(4, "周りから見えているあなた", "自分で思っている自分と、周りから見えているあなたは、少し違うかもしれません。", [
        p(top[0].p.others), top[1] ? p(top[1].p.others) : null, top[2] ? p(top[2].p.others) : null
      ]);
      add(4, "周りに伝えておくといいこと", "あなたと気持ちよく付き合ってもらうために、周りに伝えておくといいことがあります。", [
        { t: "li", items: compact([top[0].p.tellMe, top[1] && top[1].p.tellMe, top[2] && top[2].p.tellMe]) }
      ]);
    } else {
      add(4, "人との関わり方", "寄りが出なかったぶん、あなたの関わり方は、相手や場面によって変わりそうです。", [
        p("この章は、回答から言えることが少ないため、短くしています。ふだんの関わり方で「いつも同じ」と感じるところと「相手によって変わる」と感じるところを、自分で書き出してみてください。")
      ]);
    }

    // ---- 第5章 あなたの取扱説明書 ----
    var manual = compact([
      top[0] && kv("得意なこと", top[0].p.power[0] + (top[1] ? "／" + top[1].p.power[0] : "")),
      top[0] && kv("力が出る条件", top[0].p.good),
      top[0] && kv("苦手な状況", top[0].p.bad),
      topDom && kv("響きやすいテーマ", q(curTop) + "（" + topDom.desc + "）"),
      st && kv("いまの注意点", st.lows.length ? "いまは余裕が低め。予定を詰めすぎない。" : "特になし（今回の1週間の様子）。")
    ]);
    if (manual.length) {
      add(5, "あなた専用の取扱説明書", "ここからは、あなた専用の取扱説明書です。", manual);
    }
    var steps = compact([
      top[0] && top[0].p.step,
      R.gapFulfilRaw && R.gapFulfilRaw.anyLow ? dom(R.gapFulfilRaw.rows.filter(function (r) { return r.bucket === "low"; })[0].id).tip : null,
      st && st.lows.length ? "今週は、予定を1つだけ減らして、何もしない時間をつくる。" : null
    ]);
    if (steps.length) {
      add(5, "今日からの小さな一歩", "読んで終わりにしないために、小さな一歩を用意しました。", [{ t: "li", items: steps }]);
    }
    add(5, "最後に", "ここまで読んでくださって、ありがとうございました。", [
      p("ここに書いたのは、あなたが答えた範囲から読み取れたことだけです。答えていないことや、あなたの人生の背景までは、分かりません。"),
      p("当たっているところは、ぜひ自分の言葉に直して使ってください。外れていると感じるところは、外れていると思ってかまいません。その違和感が、あなた自身を知る手がかりになります。"),
      p("この体験版の採点と文章は、まだ実際の利用者で検証していません。感じたことを、そのまま教えてください。")
    ]);

    // ページ番号と「次は」の見出し
    pages.forEach(function (pg, i) {
      pg.index = i;
      pg.next = pages[i + 1] ? pages[i + 1].title : null;
    });
    return { chapters: CHAPTERS, pages: pages };
  }

  var API = {
    typeMeta: typeMeta, buildCards: buildCards, gapScore: gapScore, readAxes: readAxes, buildPortrait: buildPortrait, buildResult: buildResult,
    describeChange: describeChange, describeFulfil: describeFulfil, describeState: describeState,
    CHAPTERS: CHAPTERS
  };
  root.KAKU_LAB_CONTENT = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : this);

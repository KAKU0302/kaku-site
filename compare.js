/**
 * core36/compare.js
 * 同じ人の2回の回答（前回と今回）を比べる。CORE6（軸の位置と読み）と、12TYPE（代表タイプ）の変化を出す。
 *
 * 見方（暫定。信頼性の検証は済んでいない）
 *  - 軸の位置の差：6.25未満＝ほぼ同じ／18.75未満＝少し違う／それ以上＝はっきり違う（1段階の読み≒12.5に対する目安）
 *  - タイプ：「同じ」「前回のタイプが今回の表示（代表＋補足）に入っている」「入っていない」
 *  - 設問ごとの差：2段階以上ちがう設問を、見直しの手がかりとして挙げる（誤答という意味ではない）
 *  - どちらが「正しい」とは言わない。回答は日や気分、設問への迷い方で変わりうる。
 */
(function (root) {
  "use strict";

  var T_SAME = 6.25, T_SMALL = 18.75;
  var DATA = root.KAKU_CORE36_DATA || (typeof require !== "undefined" ? require("./data.js") : null);

  function stepLabel(abs) { return abs < T_SAME ? "same" : abs < T_SMALL ? "small" : "large"; }
  var STEP_JP = { same: "ほぼ同じ", small: "少し違う", large: "はっきり違う" };

  function shown(type) {
    if (!type || !type.primary) return [];
    var s = [type.primary];
    if ((type.showSecond || type.fit === "weak") && type.second) s.push(type.second);
    return s;
  }

  function compare(prev, curr, opts) {
    opts = opts || {};
    var typeName = opts.typeName || function (id) { return id; };
    var out = { ok: false, reason: null, axes: [], type: null, items: null, summary: [] };
    if (!prev || !curr || prev.status !== "complete" || curr.status !== "complete") { out.reason = "incomplete"; return out; }
    if (prev.scoring_version !== curr.scoring_version) out.versionMismatch = [prev.scoring_version, curr.scoring_version];

    var changedKinds = 0, large = 0;
    DATA.AXES.forEach(function (ax) {
      var a = prev.axes[ax.id], b = curr.axes[ax.id], d = b.position - a.position, step = stepLabel(Math.abs(d));
      var row = { id: ax.id, nameJp: ax.nameJp, nameEn: ax.nameEn, prevPos: a.position, currPos: b.position, delta: Math.round(d * 100) / 100,
                  step: step, stepJp: STEP_JP[step], prevKind: a.reading.kind, currKind: b.reading.kind,
                  prevLabel: a.reading.label, currLabel: b.reading.label, kindChanged: a.reading.kind !== b.reading.kind };
      // 向きが逆転したか（どちらも「寄り」で、a↔b の入れ替わり）
      row.flipped = (a.reading.kind === "a" && b.reading.kind === "b") || (a.reading.kind === "b" && b.reading.kind === "a");
      if (row.kindChanged) changedKinds++;
      if (step === "large") large++;
      out.axes.push(row);
    });

    var ps = shown(prev.type), cs = shown(curr.type), pp = prev.type && prev.type.primary, cp = curr.type && curr.type.primary;
    var kind;
    if (!pp && !cp) kind = "both_none";
    else if (!pp || !cp) kind = "one_none";
    else if (pp === cp) kind = "same";
    else if (cs.indexOf(pp) >= 0 || ps.indexOf(cp) >= 0) kind = "in_shown";
    else kind = "changed";
    out.type = { prevPrimary: pp, currPrimary: cp, prevShown: ps, currShown: cs, kind: kind,
                 prevName: pp ? typeName(pp) : null, currName: cp ? typeName(cp) : null,
                 prevInCurrentShown: !!pp && cs.indexOf(pp) >= 0, currInPreviousShown: !!cp && ps.indexOf(cp) >= 0 };

    // 設問ごとの差
    var ids = DATA.ITEMS.map(function (i) { return i.id; }), diffs = [], sum = 0, n = 0;
    ids.forEach(function (id) {
      var x = prev.answers[id], y = curr.answers[id];
      if (typeof x !== "number" || typeof y !== "number") return;
      var dd = Math.abs(x - y); sum += dd; n++;
      if (dd >= 2) diffs.push({ id: id, prev: x, curr: y, diff: dd });
    });
    out.items = { compared: n, meanAbsDiff: n ? Math.round(sum / n * 100) / 100 : null, bigChanges: diffs,
                  sameAnswer: ids.filter(function (id) { return prev.answers[id] === curr.answers[id]; }).length };

    // 文章（断定しない）
    var s = out.summary;
    s.push("6つの軸のうち、位置が「ほぼ同じ」だったのは " + out.axes.filter(function (r) { return r.step === "same"; }).length + " 軸、「少し違う」が " +
           out.axes.filter(function (r) { return r.step === "small"; }).length + " 軸、「はっきり違う」が " + large + " 軸でした。");
    var flips = out.axes.filter(function (r) { return r.flipped; });
    if (flips.length) s.push("寄る向きが入れ替わった軸：" + flips.map(function (r) { return r.nameJp; }).join("・") + "。迷いやすい設問があった可能性があります。");
    else if (changedKinds) s.push("読みの種類（寄り／どちらにも寄らない／場面による違い）が変わった軸：" + out.axes.filter(function (r) { return r.kindChanged; }).map(function (r) { return r.nameJp; }).join("・") + "。");
    else s.push("読みの種類は、6つの軸すべてで前回と同じでした。");
    if (kind === "same") s.push("代表タイプは前回と同じ「" + out.type.currName + "」でした。");
    else if (kind === "in_shown") s.push("代表タイプは「" + out.type.prevName + "」から「" + out.type.currName + "」に変わりましたが、前回または今回の表示（代表・補足）の範囲には含まれていました。軸の読みの違いが小さいと、代表タイプは入れ替わりやすくなります。");
    else if (kind === "changed") s.push("代表タイプは「" + out.type.prevName + "」から「" + out.type.currName + "」に変わり、表示された範囲にも重なりませんでした。どの軸が変わったかを、上の表で見比べてみてください。");
    else if (kind === "one_none") s.push("どちらか一方の回答では、代表タイプに分類されませんでした。");
    else s.push("2回とも、特定の代表タイプに分類されませんでした。");
    if (out.items.bigChanges.length) s.push("2段階以上ちがった設問は " + out.items.bigChanges.length + " 問でした（" + out.items.bigChanges.map(function (d) { return d.id; }).join("・") + "）。");
    s.push("回答は、日や気分、設問への迷い方で変わることがあります。どちらが正しいという比較ではありません。");
    out.ok = true;
    return out;
  }

  var API = { compare: compare, THRESHOLDS: { same: T_SAME, small: T_SMALL }, STEP_JP: STEP_JP };
  root.KAKU_COMPARE = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : this);

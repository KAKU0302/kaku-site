/**
 * core36/book/book-engine.js
 * CORE36の結果（KAKU_CORE36.score の戻り値）から、PERSONAL BOOK（試作）の5カテゴリを組み立てる。
 *
 * 原則（テストで確認）
 *  - 材料は 6軸の回答（位置・読みの種類）だけ。VALUE・STATE・継続記録は使わない。
 *  - カテゴリ2〜5は、12TYPEの判定結果（代表タイプ）に依存しない。僅差でタイプが入れ替わっても、
 *    2〜5の内容は一字一句変わらない。タイプが関わるのはカテゴリ1の「代表タイプ」ページだけ。
 *  - 同じ回答なら同じ内容（乱数・時刻を使わない）。
 *  - 文章は book-data.js に置く。ここは「どの文章を、どの順で、どの根拠で選ぶか」だけを持つ。
 *
 * 選択ルール（content_version に対応）
 *  - 寄りのある軸 = 読みが a / b の軸（場面による違いが出た軸は、全体の向きが定まらないので除く）。
 *  - 並び順 = |平均| の大きい順。同じなら軸の固定順（構想・解析・突破・影響・共鳴・積み上げ）。
 *  - c2 武器：寄りのある軸の上位3つ（0本なら weaponNone）。
 *  - c3 場面：上位2軸 × {力が出やすい場面, 噛み合いにくい場面}（0本なら fitNone）。KAKU仮説と明示。
 *  - c4 関わり方：影響・共鳴・解析の3軸を、読みの種類（a/b/balanced/scene_diff）ごとの文章で。
 *  - c5 取扱説明書：上位3軸から「条件」「気づいておくと楽な場面」「試すこと」。
 */
(function (root) {
  "use strict";

  var B = root.KAKU_BOOK_DATA;
  if (!B && typeof require !== "undefined") B = require("./book-data.js");

  var INTERACT_AXES = ["influence", "bond", "logic"];

  function fill(str, map) {
    return String(str).replace(/\{(\w+)\}/g, function (m, k) {
      if (!(k in map)) throw new Error("book-engine: 置換されないプレースホルダ {" + k + "}");
      return map[k];
    });
  }
  function fill4(obj, map) {
    return { h: fill(obj.h, map), d: fill(obj.d, map), e: fill(obj.e, map), t: fill(obj.t, map) };
  }
  function level(absMean) {
    if (absMean >= 1.5) return "強く";
    if (absMean >= 1.0) return "はっきり";
    return "やや";
  }

  /**
   * @param result  KAKU_CORE36.score() の結果
   * @param opts    { axes: [...](省略時は result から), typeName: function(id)→表示名, reasonText: string }
   * @return { ok, contentVersion, scoringVersion, lean: [...], cats: [...] }  ok=false のときは cats は空
   */
  function compose(result, opts) {
    opts = opts || {};
    var AXES = opts.axes || (root.KAKU_CORE36_DATA && root.KAKU_CORE36_DATA.AXES) ||
      (typeof require !== "undefined" ? require("../data.js").AXES : []);
    var out = { ok: false, contentVersion: B.CONTENT_VERSION, scoringVersion: result && result.scoring_version, lean: [], cats: [] };
    if (!result || result.status !== "complete") { out.reason = "incomplete"; return out; }

    var ax = {}, ord = {}; AXES.forEach(function (a, i) { ax[a.id] = a; ord[a.id] = i; });
    function poleKey(id) { var k = result.axes[id].reading.kind; return k === "a" ? "A" : k === "b" ? "B" : null; }
    function poleName(id, key) { return key === "A" ? ax[id].poleA : ax[id].poleB; }
    function axisLabel(id) { return ax[id].nameJp + "（" + ax[id].nameEn + "）"; }

    // 寄りのある軸（場面による違いが出た軸は除く）を、|平均|の大きい順に並べる
    var lean = AXES.filter(function (a) { return poleKey(a.id) !== null; }).map(function (a) {
      var k = poleKey(a.id);
      return { id: a.id, pole: k, poleName: poleName(a.id, k), absMean: Math.abs(result.axes[a.id].mean), order: ord[a.id] };
    });
    lean.sort(function (x, y) {
      var dx = Math.round(y.absMean * 1e6) - Math.round(x.absMean * 1e6);
      return dx || (x.order - y.order);
    });
    out.lean = lean.map(function (l) { return { id: l.id, pole: l.pole, poleName: l.poleName, absMean: l.absMean }; });
    var top = lean.slice(0, 3);

    function basisOf(id) {
      var r = result.axes[id];
      var items = (root.KAKU_CORE36_DATA || (typeof require !== "undefined" ? require("../data.js") : { ITEMS: [] })).ITEMS
        .filter(function (it) { return it.axis === id; }).map(function (it) { return it.id; });
      return { axis: id, nameJp: ax[id].nameJp, nameEn: ax[id].nameEn, poleA: ax[id].poleA, poleB: ax[id].poleB,
               position: r.position, kind: r.reading.kind, label: r.reading.label, items: items };
    }
    function page(cat, id, title, four, basisIds, extra) {
      var p = { id: id, cat: cat, title: title, h: four.h, d: four.d, e: four.e, t: four.t,
                basis: (basisIds || []).map(basisOf), hypothesis: false };
      if (extra) Object.keys(extra).forEach(function (k) { p[k] = extra[k]; });
      return p;
    }
    var cats = {};
    B.CATEGORIES.forEach(function (c) { cats[c.id] = { id: c.id, no: c.no, title: c.title, sub: c.sub, intro: c.intro, locked: c.locked.slice(), pages: [] }; });

    // ---------- 1. あなたという人 ----------
    var S = B.SPECIAL, c1 = cats.c1.pages;
    if (top.length === 0) c1.push(page("c1", "c1-overview", "全体像", S.overviewNone, []));
    else if (top.length === 1) c1.push(page("c1", "c1-overview", "全体像", fill4(S.overviewOne, { p1: top[0].poleName, axis1: ax[top[0].id].nameJp }), [top[0].id]));
    else c1.push(page("c1", "c1-overview", "全体像", fill4(S.overviewMany, {
      p1: top[0].poleName, p2: top[1].poleName, n: String(lean.length),
      axis1: ax[top[0].id].nameJp, axis2: ax[top[1].id].nameJp,
      lv1: level(top[0].absMean), lv2: level(top[1].absMean)
    }), [top[0].id, top[1].id]));

    var mapAxes = AXES.map(function (a) {
      var r = result.axes[a.id], k = r.reading.kind, line;
      if (k === "a") line = B.POLE[a.id].A.line; else if (k === "b") line = B.POLE[a.id].B.line;
      else if (k === "scene_diff") line = B.LINE_SCENE; else line = B.LINE_BALANCED;
      var b = basisOf(a.id); b.line = line; b.lean = poleKey(a.id) !== null;
      return b;
    });
    var mapPage = page("c1", "c1-map", "6つの軸の地図", S.map, []);
    mapPage.axes = mapAxes; mapPage.kindOfPage = "map";
    c1.push(mapPage);

    var t = result.type, tp;
    if (t && t.primary) {
      var name = opts.typeName ? opts.typeName(t.primary) : t.primary;
      var reason = opts.reasonText != null ? opts.reasonText : (root.KAKU_CORE36 && root.KAKU_CORE36.describeReason ? root.KAKU_CORE36.describeReason(result, name) : "");
      tp = page("c1", "c1-type", "いちばん近い代表タイプ", fill4(S.type, { name: name, reason: reason }), []);
      tp.typeId = t.primary; tp.secondId = t.showSecond || t.fit === "weak" ? t.second : null; tp.fit = t.fit;
    } else {
      tp = page("c1", "c1-type", "代表タイプについて", S.typeNone, []);
      tp.typeId = null;
    }
    tp.kindOfPage = "type";
    c1.push(tp);

    var sceneAxes = AXES.filter(function (a) { return result.axes[a.id].reading.kind === "scene_diff"; });
    if (!sceneAxes.length) c1.push(page("c1", "c1-scene", "場面による違い", S.sceneNone, []));
    else {
      var list = sceneAxes.map(function (a) {
        var sm = result.axes[a.id].sceneMeans;
        return "・" + a.nameJp + "：仕事・学びでは「" + (sm.work > 0 ? a.poleA : a.poleB) + "」寄り、日常では「" + (sm.life > 0 ? a.poleA : a.poleB) + "」寄り";
      }).join("\n");
      c1.push(page("c1", "c1-scene", "場面による違い",
        fill4(S.sceneSome, { names: sceneAxes.map(function (a) { return a.nameJp; }).join("・"), list: list }), sceneAxes.map(function (a) { return a.id; })));
    }

    // ---------- 2. あなたの武器 ----------
    if (!top.length) cats.c2.pages.push(page("c2", "c2-none", "今回の読み", S.weaponNone, []));
    top.forEach(function (l) {
      cats.c2.pages.push(page("c2", "c2-" + l.id, ax[l.id].nameJp + "：" + l.poleName + "寄り", B.POLE[l.id][l.pole].weapon, [l.id]));
    });

    // ---------- 3. 力が出るとき・出ないとき（KAKU仮説） ----------
    if (!top.length) cats.c3.pages.push(page("c3", "c3-none", "今回の読み", S.fitNone, []));
    top.slice(0, 2).forEach(function (l) {
      var g = page("c3", "c3-" + l.id + "-good", "力が出やすいかもしれない場面（" + ax[l.id].nameJp + "）", B.POLE[l.id][l.pole].good, [l.id], { sub: "good" });
      var h = page("c3", "c3-" + l.id + "-hard", "噛み合いにくいかもしれない場面（" + ax[l.id].nameJp + "）", B.POLE[l.id][l.pole].hard, [l.id], { sub: "hard" });
      g.hypothesis = true; h.hypothesis = true;
      cats.c3.pages.push(g, h);
    });

    // ---------- 4. 人との関わり方 ----------
    INTERACT_AXES.forEach(function (id) {
      var r = result.axes[id], k = r.reading.kind, src = B.INTERACT[id], four;
      if (k === "a") four = src.A; else if (k === "b") four = src.B;
      else if (k === "scene_diff") {
        four = fill4(src.scene_diff, { w: r.sceneMeans.work > 0 ? ax[id].poleA : ax[id].poleB, l: r.sceneMeans.life > 0 ? ax[id].poleA : ax[id].poleB });
      } else four = src.balanced;
      cats.c4.pages.push(page("c4", "c4-" + id, src.title + "（" + ax[id].nameJp + "）", four, [id]));
    });

    // ---------- 5. あなたの取扱説明書 ----------
    var tries = top.map(function (l) { return { id: "try-" + l.id, text: B.POLE[l.id][l.pole].weapon.t, axis: l.id }; });
    S.manualTryFallback.forEach(function (txt, i) { if (tries.length < 3) tries.push({ id: "try-fb" + i, text: txt, axis: null }); });
    if (!top.length) {
      cats.c5.pages.push(page("c5", "c5-none", "今回の読み", S.manualNone, []));
    } else {
      var lines = function (key) { return top.map(function (l) { return "・" + B.POLE[l.id][l.pole][key].h; }).join("\n"); };
      var f = top[0], FP = B.POLE[f.id][f.pole];
      var cond = page("c5", "c5-cond", "力を出しやすい条件", fill4(S.manualCond, { list: lines("good"), e: FP.good.e, t: FP.good.t }), top.map(function (l) { return l.id; }));
      cond.hypothesis = true;
      var care = page("c5", "c5-care", "気づいておくと楽な場面", fill4(S.manualCare, { list: lines("hard"), e: FP.hard.e, t: FP.hard.t }), top.map(function (l) { return l.id; }));
      care.hypothesis = true;
      cats.c5.pages.push(cond, care);
    }
    var tryPage = page("c5", "c5-try", "試してみること", S.manualTry, top.map(function (l) { return l.id; }), { tries: tries, kindOfPage: "try" });
    cats.c5.pages.push(tryPage);

    out.cats = B.CATEGORIES.map(function (c) { return cats[c.id]; });
    out.ok = true;
    return out;
  }

  // 全ページの文字列を平らにして返す（テスト・語句チェック用）
  function allStrings(book) {
    var s = [];
    book.cats.forEach(function (c) {
      s.push(c.title, c.sub, c.intro); c.locked.forEach(function (x) { s.push(x); });
      c.pages.forEach(function (p) {
        s.push(p.title, p.h, p.d, p.e, p.t);
        (p.tries || []).forEach(function (x) { s.push(x.text); });
        (p.axes || []).forEach(function (a) { s.push(a.line); });
      });
    });
    return s;
  }
  function pageIds(book) {
    var ids = []; book.cats.forEach(function (c) { c.pages.forEach(function (p) { ids.push(p.id); }); }); return ids;
  }

  var API = { compose: compose, allStrings: allStrings, pageIds: pageIds, CONTENT_VERSION: B.CONTENT_VERSION };
  root.KAKU_BOOK = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : this);

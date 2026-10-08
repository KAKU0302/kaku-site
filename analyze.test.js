"use strict";
// パイロット分析ツールの動作確認（仮想データで）。実行: node --test core36/tests/
const test = require("node:test");
const assert = require("node:assert/strict");
const { analyze, format } = require("../tools/analyze-pilot.js");
const { make } = require("../tools/make-synthetic-pilot.js");

test("分析ツール: 仮想データ（100人×2回）で、全項目が計算され、数値が妥当な範囲に入る", () => {
  const data = make(100, 1.0, 1);
  const o = analyze(data, { minDays: 10 });
  assert.equal(o.synthetic, true); assert.equal(o.n_runs, 200); assert.equal(o.n_first, 100);
  o.axes.forEach(a => { assert.ok(a.alpha > 0.3 && a.alpha < 0.95, a.id + " α=" + a.alpha); });
  Object.values(o.axisCorr).forEach(v => assert.ok(Math.abs(v) < 0.45, "仮想データでは軸間は独立に作っている: " + v));
  assert.equal(o.retest.usable, 100); assert.equal(o.retest.tooClose, 0);
  o.retest.axes.forEach(a => { assert.ok(a.positionCorr > 0.5, a.id + " 再回答の相関=" + a.positionCorr); });
  assert.ok(o.retest.type.primarySame >= 0 && o.retest.type.primarySame <= 100);
  assert.ok(o.retest.type.inShown12 >= o.retest.type.primarySame, "表示した1〜2タイプに入る割合は、代表タイプの一致率以上");
  assert.equal(o.items.length, 36); assert.ok(o.survey.n === 100);
  const text = format(o);
  assert.match(text, /仮想データです/); assert.match(text, /暫定の開発目標/); assert.match(text, /【重点】/);
});

test("分析ツール: 再回答が近すぎる組（10日未満）は除外し、人数が少ないときは参考値と明記する", () => {
  const data = make(10, 1.0, 2);
  data.runs.forEach(r => { if (r.sessionKind === "retest") r.finishedAt = new Date(new Date(r.startedAt).getTime() - 14 * 864e5 + 3 * 864e5).toISOString(); });
  const o = analyze(data, { minDays: 10 });
  assert.equal(o.retest.usable, 0); assert.equal(o.retest.pairs, 10); assert.equal(o.retest.tooClose, 10);
  assert.match(format(o), /30人未満/);
});

test("分析ツール: 空のデータでも落ちない", () => {
  const o = analyze({ runs: [] }); assert.equal(o.n_runs, 0); assert.ok(format(o).length > 0);
});

test("分析ツール: 逆向きに混入した設問（回答の向きが反転した設問）を、軸全体との相関の低下として検出できる", () => {
  const data = make(80, 1.0, 3);
  data.runs.forEach(r => { r.answers.C05 = 6 - r.answers.C05; });   // C05 だけ意図的に向きを壊す
  const o = analyze(data), c05 = o.items.find(i => i.id === "C05"), c35 = o.items.find(i => i.id === "C35");
  assert.ok(c05.itemRest < 0, "壊した設問は相関が負になる: " + c05.itemRest);
  assert.ok(c35.itemRest > 0.3, "壊していない設問は正常: " + c35.itemRest);
  assert.match(format(o), /C05 .*【BOND重点】/);
});

test("分析ツール: 2つの軸に共通の要因が混ざっている場合（LOGICとBOND）、軸間の相関で『要確認』が出る", () => {
  const data = make(100, 1.0, 4);
  // LOGICの回答にBONDの傾向を50%混ぜる（概念の混入を模擬）
  const D = require("../data.js");
  data.runs.forEach(r => D.ITEMS.filter(i => i.axis === "logic").forEach(it => {
    const b = D.ITEMS.filter(x => x.axis === "bond" && x.scene === it.scene)[0];
    const ab = b.aSide === "left" ? 3 - r.answers[b.id] : r.answers[b.id] - 3;
    const al = it.aSide === "left" ? 3 - r.answers[it.id] : r.answers[it.id] - 3;
    const a = Math.max(-2, Math.min(2, Math.round(0.4 * al + 0.9 * ab)));
    r.answers[it.id] = it.aSide === "left" ? 3 - a : 3 + a;
  }));
  const o = analyze(data);
  assert.ok(Math.abs(o.axisCorr["logic-bond"]) >= 0.5, "混入を検出: r=" + o.axisCorr["logic-bond"]);
  assert.match(format(o), /logic-bond.*要確認.*【重点】/);
});

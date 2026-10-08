"use strict";
// CORE36 / 12TYPE 判定エンジンの自動テスト（scoring_version 0.2.0-draft）
// 実行: node --test core36/tests/
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path"), vm = require("vm"), crypto = require("crypto");

const root = path.join(__dirname, "..", "..");
const E = require("../engine.js");
const D = E.DATA;

// ---------- 補助 ----------
function allSame(r) { const o = {}; D.ITEMS.forEach(i => o[i.id] = r); return o; }
// 「各軸の a 値（-2〜+2）」を指定して回答を作る。axisA: {axisId: a} 全6問に同じ値。
function respByAxis(axisA, sceneA) {
  const o = {};
  D.ITEMS.forEach(it => {
    let a = axisA[it.axis] || 0;
    if (sceneA && sceneA[it.axis]) a = sceneA[it.axis][it.scene];
    o[it.id] = it.aSide === "left" ? 3 - a : 3 + a;
  });
  return o;
}
function idealOf(typeId) {
  const p = D.PROFILES[typeId], want = {};
  p.core.concat(p.support || []).forEach(([a, pole]) => want[a] = pole === "A" ? 1 : -1);
  return respByAxis(want);
}
function loadTypes() {
  const ctx = {}; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root, "types-data.js"), "utf8"), ctx);
  vm.runInContext("globalThis.__T = KAKU_TYPES", ctx);
  return ctx.__T;
}
// 再現できる乱数
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function gauss(rnd) { let u = 0, v = 0; while (u === 0) u = rnd(); v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

// ---------- 1. データの整合 ----------
test("設問データ: 36問・各軸6問・場面3対3・左右3対3・IDが一意", () => {
  assert.equal(D.ITEMS.length, 36);
  assert.equal(new Set(D.ITEMS.map(i => i.id)).size, 36);
  D.AXES.forEach(ax => {
    const its = D.ITEMS.filter(i => i.axis === ax.id);
    assert.equal(its.length, 6, ax.id);
    assert.equal(its.filter(i => i.scene === "work").length, 3, ax.id + " work");
    assert.equal(its.filter(i => i.scene === "life").length, 3, ax.id + " life");
    assert.equal(its.filter(i => i.aSide === "left").length, 3, ax.id + " 左右");
  });
  D.ITEMS.forEach(i => { assert.ok(i.left && i.right && i.left !== i.right, i.id); assert.ok(["left", "right"].includes(i.aSide)); });
});

test("12TYPE: 旧4タイプを含まず、既存のtypes-dataの12タイプ（category付き）と一致する", () => {
  const T = loadTypes();
  const legacy = ["mediator", "builder", "adventurer", "finisher"];
  const ids = Object.keys(D.PROFILES);
  assert.equal(ids.length, 12);
  legacy.forEach(l => assert.ok(!ids.includes(l), l));
  ids.forEach(id => { assert.ok(T[id], id + " が既存データにある"); assert.ok(T[id].category, id + " category"); assert.ok(!T[id].legacy, id); assert.ok(T[id].image, id + " image"); });
  const current = Object.keys(T).filter(k => T[k].category && !T[k].legacy).sort();
  assert.deepEqual(ids.slice().sort(), current);
  assert.deepEqual(D.TIE_BREAK_ORDER.slice().sort(), ids.slice().sort());
});

test("プロフィール: 決める軸は2つ・補助は1つ・全12タイプで決める軸の組が重複しない", () => {
  const keys = new Set();
  Object.entries(D.PROFILES).forEach(([id, p]) => {
    assert.equal(p.core.length, 2, id); assert.equal((p.support || []).length, 1, id);
    const axes = p.core.concat(p.support).map(c => c[0]);
    assert.equal(new Set(axes).size, 3, id + " 同じ軸を二重に使わない");
    keys.add(p.core.map(c => c.join("")).sort().join("|"));
  });
  assert.equal(keys.size, 12);
});

test("定義の指紋: 設問・プロフィール・しきい値を変えたら VERSION を上げる（fixtures/definition-hash.json を更新）", () => {
  const fx = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "definition-hash.json"), "utf8"));
  assert.equal(E.VERSION, "0.2.0-draft");
  assert.equal(fx[E.VERSION], E.definitionHash(), "定義が変わっています。意図した変更なら VERSION を上げ、指紋を記録してください");
});

// ---------- 2. 採点 ----------
test("採点: a値の変換（左がA極の問と右がA極の問で同じ向きになる）", () => {
  const left = D.ITEMS.find(i => i.aSide === "left"), right = D.ITEMS.find(i => i.aSide === "right");
  assert.deepEqual([1, 2, 3, 4, 5].map(r => E.aValue(left, r)), [2, 1, 0, -1, -2]);
  assert.deepEqual([1, 2, 3, 4, 5].map(r => E.aValue(right, r)), [-2, -1, 0, 1, 2]);
});

test("採点: 軸の位置 = 50 + 25×平均。全問A極なら100、全問B極なら0、全問『どちらとも』なら50", () => {
  const a = E.score(respByAxis({ vision: 2, logic: -2, drive: 0, influence: 1, bond: -1, steady: 0 }));
  assert.equal(a.axes.vision.position, 100); assert.equal(a.axes.logic.position, 0);
  assert.equal(a.axes.drive.position, 50); assert.equal(a.axes.influence.position, 75); assert.equal(a.axes.bond.position, 25);
});

test("採点: 左右の入れ替え対称性（A極の文を左右反転し、回答も反転させても同じ点数）", () => {
  const rnd = mulberry32(7);
  const resp = {}; D.ITEMS.forEach(i => resp[i.id] = 1 + Math.floor(rnd() * 5));
  const flippedItems = D.ITEMS.map(i => Object.assign({}, i, { left: i.right, right: i.left, aSide: i.aSide === "left" ? "right" : "left" }));
  const flippedResp = {}; Object.keys(resp).forEach(k => flippedResp[k] = 6 - resp[k]);
  const r1 = E.score(resp), r2 = E.score(flippedResp, { data: { ITEMS: flippedItems } });
  D.AXES.forEach(ax => assert.equal(r1.axes[ax.id].position, r2.axes[ax.id].position, ax.id));
  assert.equal(r1.type.primary, r2.type.primary);
});

test("軸の読み: 6問の合計±3で『寄り』、±2では『どちらにも寄らない』", () => {
  // vision軸の6問: 3問が+1、3問が0 → 合計+3 → 平均0.5 → A寄り
  function withSum(sumTargets) {
    const o = allSame(3); const its = D.ITEMS.filter(i => i.axis === "vision");
    its.forEach((it, k) => { const a = sumTargets[k]; o[it.id] = it.aSide === "left" ? 3 - a : 3 + a; });
    return E.score(o).axes.vision.reading.kind;
  }
  // 場面差が出ないよう、work/lifeの符号が逆にならない並びにする
  assert.equal(withSum([1, 0, 0, 1, 0, 1]), "a");        // 合計+3
  assert.equal(withSum([1, 0, 0, 1, 0, 0]), "balanced"); // 合計+2
  assert.equal(withSum([-1, 0, 0, -1, 0, -1]), "b");     // 合計-3
  assert.equal(withSum([-1, 0, 0, -1, 0, 0]), "balanced");
});

test("場面差: 両場面が逆符号で各|平均|≥1.0のときだけ『場面による違い』。0.67では出ない", () => {
  const its = D.ITEMS.filter(i => i.axis === "logic");
  function mk(workA, lifeA) {
    const o = allSame(3);
    its.forEach(it => { const a = (it.scene === "work" ? workA : lifeA)[its.filter(x => x.scene === it.scene).indexOf(it)]; o[it.id] = it.aSide === "left" ? 3 - a : 3 + a; });
    return E.score(o).axes.logic;
  }
  const yes = mk([1, 1, 1], [-1, -1, -1]);
  assert.equal(yes.reading.kind, "scene_diff");
  assert.match(yes.reading.label, /今回の回答では、場面によって違いが見られた/);
  assert.doesNotMatch(yes.reading.label, /切り替える/);
  assert.equal(mk([1, 1, 0], [-1, -1, -1]).reading.kind, "balanced"); // 仕事の平均0.67 → 場面差なし。全体の平均も0.5未満
  assert.notEqual(mk([1, 1, 0], [-1, -1, 0]).reading.kind, "scene_diff");
  assert.equal(mk([2, 2, 2], [-1, -1, -1]).reading.kind, "scene_diff");
});

// ---------- 3. 12TYPE判定 ----------
test("判定: 12タイプそれぞれの理想プロフィールを入れると、そのタイプが距離0で1位になる", () => {
  Object.keys(D.PROFILES).forEach(id => {
    const r = E.score(idealOf(id));
    assert.equal(r.type.primary, id); assert.ok(r.type.distance < 1e-9, id);
    assert.equal(r.type.tieGroup.length, 1, id + " 同点なし");
    assert.ok(r.type.margin > 10, id + " 次点との差が十分ある: " + r.type.margin);
    assert.equal(r.type.showSecond, false);
  });
});

test("判定: 旧4タイプは新版では出力されない（全ランキングにも含まれない）", () => {
  const rnd = mulberry32(99);
  for (let n = 0; n < 500; n++) {
    const resp = {}; D.ITEMS.forEach(i => resp[i.id] = 1 + Math.floor(rnd() * 5));
    const r = E.score(resp);
    r.type.ranking.forEach(t => assert.ok(!["mediator", "builder", "adventurer", "finisher"].includes(t)));
  }
});

test("判定: 全問『どちらとも』は無理に分類しない（根拠なし）", () => {
  const r = E.score(allSame(3));
  assert.equal(r.status, "complete"); assert.equal(r.type.status, "no_basis"); assert.equal(r.type.primary, null);
  assert.equal(r.type.noBasisReason, "no_lean_axis"); assert.equal(r.leanCount, 0);
  D.AXES.forEach(ax => assert.equal(r.axes[ax.id].position, 50));
});

test("判定: 全問『左に近い』『右に近い』でも、左右が釣り合っているため中立になり、偏りの印が付く", () => {
  [1, 5].forEach(v => {
    const r = E.score(allSame(v));
    D.AXES.forEach(ax => assert.equal(r.axes[ax.id].position, 50, ax.id));
    assert.equal(r.type.status, "no_basis"); assert.equal(r.flags.straightLine, true);
  });
});

test("判定: 寄る軸が1つだけの有効回答は、最も近いタイプを『近さ弱め』で表示する（同点が4タイプ以上なら分類しない）", () => {
  // 1軸だけを極端にした純粋なケースは、多くのタイプが同点になるため分類しない
  const pure = E.score(respByAxis({ vision: 2 }));
  assert.equal(pure.leanCount, 1); assert.equal(pure.type.status, "no_basis"); assert.match(pure.type.noBasisReason, /^tie_/);
  // 他の軸に「寄り」未満のわずかな差があるケースは、近さ弱めで最も近いタイプを出す
  const rnd = mulberry32(11); let found = 0;
  for (let n = 0; n < 4000 && found < 20; n++) {
    const resp = {}; D.ITEMS.forEach(i => resp[i.id] = 1 + Math.floor(rnd() * 5));
    const r = E.score(resp);
    if (r.leanCount === 1 && r.type.primary) {
      found++;
      assert.equal(r.type.status, "weak"); assert.equal(r.type.fit, "weak"); assert.ok(r.explanation.second, "弱いときは次点の説明も出す");
    }
  }
  assert.ok(found > 0, "寄る軸が1つで分類されるケースが見つかる");
});

test("判定: 僅差（1位と2位の距離の差が3未満）では2番目に近いタイプを補足、差が大きければ補足しない", () => {
  // 設計者(構想+分析, 見極め)と創造者(構想+感覚)の中間付近を探す: 乱数で margin の両側が出ることを確認
  const rnd = mulberry32(5); let near = 0, far = 0;
  for (let n = 0; n < 2000; n++) {
    const resp = {}; D.ITEMS.forEach(i => resp[i.id] = 1 + Math.floor(rnd() * 5));
    const r = E.score(resp); if (!r.type.primary) continue;
    assert.equal(r.type.showSecond, r.type.margin < 3 - 1e-9);
    r.type.showSecond ? near++ : far++;
  }
  assert.ok(near > 0 && far > 0);
});

test("同点: 決める軸だけの距離が小さい方が先、それも同じなら固定順（設定した順序）", () => {
  const prof = {
    x: { core: [["vision", "A"], ["logic", "A"]], support: [["drive", "B"]] },
    y: { core: [["vision", "A"], ["drive", "A"]], support: [] }
  };
  const resp = respByAxis({ vision: 1, logic: 1 });   // 構想=75, 分析=75, 他は50
  // supportWeight=2 のとき x と y の総合距離がちょうど等しくなる（√312.5）
  const data = { PROFILES: prof, TIE_BREAK_ORDER: ["y", "x"], CONFIG: { supportWeight: 2 } };
  const r = E.score(resp, { data });
  assert.deepEqual(r.type.tieGroup.sort(), ["x", "y"]);
  assert.equal(r.type.primary, "x");                       // 固定順では y が先でも、核距離で x が勝つ
  assert.equal(r.type.tieResolvedBy, "core_distance");
  assert.equal(r.type.second, "y"); assert.equal(r.type.showSecond, true);
  // 完全に同じ定義の2つ → 固定順
  const prof2 = { z1: { core: [["vision", "A"], ["logic", "A"]], support: [] }, z2: { core: [["vision", "A"], ["logic", "A"]], support: [] } };
  const r2 = E.score(resp, { data: { PROFILES: prof2, TIE_BREAK_ORDER: ["z2", "z1"] } });
  assert.equal(r2.type.primary, "z2"); assert.equal(r2.type.tieResolvedBy, "fixed_order");
});

test("同点: 4タイプ以上が完全に同点なら、無理に分類しない", () => {
  const same = { core: [["vision", "A"], ["logic", "A"]], support: [] };
  const prof = { a: same, b: same, c: same, d: same, e: { core: [["drive", "A"], ["steady", "A"]], support: [] } };
  const r = E.score(respByAxis({ vision: 1, logic: 1 }), { data: { PROFILES: prof, TIE_BREAK_ORDER: ["a", "b", "c", "d", "e"] } });
  assert.equal(r.type.status, "no_basis"); assert.equal(r.type.noBasisReason, "tie_4"); assert.equal(r.type.primary, null);
});

test("同点: 3タイプまでの同点は分類し、補足タイプも出す", () => {
  const same = { core: [["vision", "A"], ["logic", "A"]], support: [] };
  const r = E.score(respByAxis({ vision: 1, logic: 1 }), { data: { PROFILES: { a: same, b: same, c: same }, TIE_BREAK_ORDER: ["c", "b", "a"] } });
  assert.equal(r.type.primary, "c"); assert.equal(r.type.second, "b"); assert.equal(r.type.showSecond, true);
});

// ---------- 4. 無効・未回答 ----------
test("無効回答: 0・6・2.5・文字列・null・NaN・真偽値は無効。未知のIDは無視。重複は最後を採用", () => {
  const base = allSame(4);
  const bad = Object.assign({}, base, { C01: 0, C02: 6, C03: 2.5, C04: "3", C05: null, C06: NaN, C07: true, ZZ: 3 });
  const r = E.score(bad);
  assert.deepEqual(r.input.invalid.sort(), ["C01", "C02", "C03", "C04", "C05", "C06", "C07"]);
  assert.deepEqual(r.input.ignored, ["ZZ"]);
  const arr = E.normalizeResponses([{ id: "C01", value: 1 }, { id: "C01", value: 5 }]);
  assert.equal(arr.valid.C01, 5);
});

test("未回答: 1軸で1問の欠けは計算できる（5問で平均）。同じ軸で2問以上欠けると未完了でタイプを出さない", () => {
  const base = idealOf("architect");
  const one = Object.assign({}, base); delete one.C01;
  const r1 = E.score(one);
  assert.equal(r1.status, "complete"); assert.equal(r1.axes.vision.validCount, 5); assert.equal(r1.type.primary, "architect");
  const two = Object.assign({}, base); delete two.C01; delete two.C07;
  const r2 = E.score(two);
  assert.equal(r2.status, "incomplete"); assert.deepEqual(r2.input.insufficientAxes, ["vision"]);
  assert.equal(r2.type.primary, null); assert.equal(r2.type.status, "incomplete");
  assert.equal(E.score({}).status, "incomplete"); assert.equal(E.score(null).status, "incomplete"); assert.equal(E.score(undefined).status, "incomplete");
});

test("品質フラグ: 回答時間が120秒未満なら印（判定には使わない）", () => {
  const r1 = E.score(idealOf("guardian"), { durationSec: 60 }), r2 = E.score(idealOf("guardian"), { durationSec: 400 });
  assert.equal(r1.flags.fast, true); assert.equal(r2.flags.fast, false);
  assert.equal(r1.type.primary, r2.type.primary);
});

// ---------- 5. 再現性・独立性 ----------
test("再現性: 同じ回答は何度計算しても、キーの順序を変えても同じ結果", () => {
  const rnd = mulberry32(2026);
  for (let n = 0; n < 200; n++) {
    const resp = {}; D.ITEMS.forEach(i => resp[i.id] = 1 + Math.floor(rnd() * 5));
    const shuffled = {}; Object.keys(resp).reverse().forEach(k => shuffled[k] = resp[k]);
    const a = JSON.stringify(E.score(resp)), b = JSON.stringify(E.score(resp)), c = JSON.stringify(E.score(shuffled));
    assert.equal(a, b);
    assert.equal(JSON.parse(a).type.primary, JSON.parse(c).type.primary);
    assert.deepEqual(JSON.parse(a).axes, JSON.parse(c).axes);
  }
});

test("構造: 6軸の結果は、12TYPEの判定表に依存しない（判定表を差し替えても軸の部分は同じ）", () => {
  const rnd = mulberry32(31);
  const other = { x1: { core: [["bond", "B"], ["drive", "B"]], support: [["vision", "A"]] }, x2: { core: [["steady", "B"], ["logic", "B"]], support: [] } };
  for (let n = 0; n < 100; n++) {
    const resp = {}; D.ITEMS.forEach(i => resp[i.id] = 1 + Math.floor(rnd() * 5));
    const r1 = E.score(resp), r2 = E.score(resp, { data: { PROFILES: other, TIE_BREAK_ORDER: ["x1", "x2"] } });
    assert.deepEqual(r1.axes, r2.axes);
  }
});

test("構造: 代表タイプが僅差で入れ替わっても、軸の読みは回答1つ分しか動かない（軸の内容は急変しない）", () => {
  const rnd = mulberry32(77); let flips = 0;
  for (let n = 0; n < 1500; n++) {
    const resp = {}; D.ITEMS.forEach(i => resp[i.id] = 1 + Math.floor(rnd() * 5));
    const r = E.score(resp); if (!r.type.primary) continue;
    const it = D.ITEMS[Math.floor(rnd() * 36)];
    const alt = Object.assign({}, resp, { [it.id]: Math.min(5, Math.max(1, resp[it.id] + (rnd() < .5 ? -1 : 1))) });
    const r2 = E.score(alt); if (!r2.type.primary) continue;
    if (r2.type.primary !== r.type.primary) {
      flips++;
      // タイプが変わっても、動いた軸以外の位置は完全に同じで、動いた軸も 25/6 点以内
      D.AXES.forEach(ax => {
        const d = Math.abs(r.axes[ax.id].position - r2.axes[ax.id].position);
        if (ax.id === it.axis) assert.ok(d <= 25 / 6 + 1e-9); else assert.equal(d, 0);
      });
    }
  }
  assert.ok(flips > 0, "入れ替わるケースが検証できている");
});

// ---------- 6. 保存・判定理由 ----------
test("保存サイズ: スナップショットは、決済metadataの上限（450字×45＝20,250字）に余裕で収まる", () => {
  const rnd = mulberry32(1);
  let max = 0;
  for (let n = 0; n < 300; n++) {
    const resp = {}; D.ITEMS.forEach(i => resp[i.id] = 1 + Math.floor(rnd() * 5));
    const s = JSON.stringify(E.toSnapshot(E.score(resp)));
    max = Math.max(max, s.length);
  }
  assert.ok(max < 2000, "最大 " + max + " 文字");
  console.log("  スナップショットの最大サイズ:", max, "文字（上限 20,250）");
});

test("判定理由: 断定を避けた表現で、根拠の軸が示される", () => {
  const r = E.score(idealOf("connector"));
  const txt = E.describeReason(r, "連結者");
  assert.match(txt, /あなたの回答では/); assert.match(txt, /いちばん近い/);
  assert.doesNotMatch(txt, /あなたは.*型です|必ず|優れ|劣/);
  assert.equal(r.explanation.primary.length, 3);
  assert.deepEqual(r.explanation.primary.filter(e => e.role === "core").map(e => e.match), ["match", "match"]);
});

// ---------- 7. 旧版・既存機能の保護 ----------
test("既存ファイル（旧30問・16タイプ・決済・メール・共有・画像）が変更されていない", () => {
  const hashes = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "protected-hashes.json"), "utf8"));
  Object.entries(hashes).forEach(([f, h]) => {
    const now = crypto.createHash("sha256").update(fs.readFileSync(path.join(root, f))).digest("hex");
    assert.equal(now, h, f + " が変更されています");
  });
});

test("旧エンジン: 固定入力に対する旧30問・16タイプの出力が基準と同じ", () => {
  const ctx = {}; vm.createContext(ctx);
  ["types-data.js", "core-engine.js", "type-engine.js"].forEach(f => vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), ctx));
  // 新エンジンを同じ空間に読み込んでも、旧エンジンの結果は変わらない
  ["core36/data.js", "core36/engine.js"].forEach(f => vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), ctx));
  vm.runInContext("globalThis.__e={computeCore6,determineType}", ctx);
  const golden = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "legacy-golden.json"), "utf8"));
  golden.forEach(g => {
    const c = ctx.__e.computeCore6(g.ans);
    assert.equal(JSON.stringify(c.scores), JSON.stringify(g.scores)); assert.equal(c.topAxis, g.topAxis); assert.equal(c.secondAxis, g.secondAxis);
    assert.equal(ctx.__e.determineType(c.topAxis, c.secondAxis), g.typeId);
  });
  assert.ok(typeof ctx.KAKU_CORE36.score === "function");
});

test("グローバル名: 新しいコードが追加するグローバルは KAKU_CORE36 / KAKU_CORE36_DATA だけ（旧コードのconst名と衝突しない）", () => {
  const ctx = {}; vm.createContext(ctx);
  const before = new Set(Array.from(vm.runInContext("Object.getOwnPropertyNames(globalThis)", ctx)));
  ["core36/data.js", "core36/engine.js"].forEach(f => vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), ctx));
  const after = Array.from(vm.runInContext("Object.getOwnPropertyNames(globalThis)", ctx)).filter(k => !before.has(k)).sort();
  assert.deepEqual(after, ["KAKU_CORE36", "KAKU_CORE36_DATA"]);
  // 旧コード側にこの2つの名前が既にないこと
  ["app.js", "core-engine.js", "type-engine.js", "types-data.js", "match-engine.js", "state-engine.js", "gap-engine.js", "birth-engine.js", "context-engine.js", "index.html"]
    .forEach(f => assert.ok(!/KAKU_CORE36/.test(fs.readFileSync(path.join(root, f), "utf8")), f));
});

test("テスト用画面は既存の index.html から読み込まれていない（公開版の画面に影響しない）", () => {
  assert.ok(!/core36/.test(fs.readFileSync(path.join(root, "index.html"), "utf8")));
});

// ---------- 8. 仮想データでの分布確認（実データではない） ----------
test("仮想データ（4,000人、軸のばらつき0.9・回答のゆらぎ1.0）での分布の健全性", () => {
  const rnd = mulberry32(20261008), N = 4000;
  const counts = {}; Object.keys(D.PROFILES).forEach(t => counts[t] = 0);
  let noBasis = 0, weak = 0, tie = 0, two = 0, same = 0, inShown = 0, valid = 0;
  const gen = theta => { const r = {}; D.AXES.forEach(ax => { /* 場面のずれ */ });
    const off = {}; D.AXES.forEach(ax => off[ax.id] = gauss(rnd) * 0.5);
    D.ITEMS.forEach(it => { const a = Math.max(-2, Math.min(2, Math.round(theta[it.axis] + gauss(rnd) + off[it.axis] * (it.scene === "work" ? 1 : -1))));
      r[it.id] = it.aSide === "left" ? 3 - a : 3 + a; });
    return r; };
  for (let n = 0; n < N; n++) {
    const theta = {}; D.AXES.forEach(ax => theta[ax.id] = gauss(rnd) * 0.9);
    const r1 = E.score(gen(theta)), r2 = E.score(gen(theta));
    if (!r1.type.primary) { noBasis++; continue; }
    valid++; counts[r1.type.primary]++;
    if (r1.type.status === "weak") weak++;
    if (r1.type.tieGroup.length > 1) tie++;
    if (r1.type.showSecond) two++;
    if (r2.type.primary) { if (r2.type.primary === r1.type.primary) same++; if (r2.type.primary === r1.type.primary || (r1.type.showSecond && r2.type.primary === r1.type.second)) inShown++; }
  }
  const shares = Object.values(counts).map(c => c / valid * 100);
  console.log("  タイプ別の割合（%）:", Object.entries(counts).map(([t, c]) => t + " " + (c / valid * 100).toFixed(1)).join(", "));
  console.log("  タイプなし " + (noBasis / N * 100).toFixed(2) + "% / 近さ弱め " + (weak / valid * 100).toFixed(1) + "% / 同点 " + (tie / valid * 100).toFixed(1) +
              "% / 2タイプ表示 " + (two / valid * 100).toFixed(1) + "%");
  console.log("  【仮想データ上の指標】同じ人の再回答で代表タイプが一致 " + (same / valid * 100).toFixed(1) + "% / 再回答のタイプが表示した1〜2タイプに入る " + (inShown / valid * 100).toFixed(1) + "%（実際の再テスト信頼性ではない）");
  // 目標値ではなく、設計の欠陥を見つけるための健全性の範囲
  assert.ok(Math.min(...shares) > 3, "出現しないタイプがある: " + Math.min(...shares));
  assert.ok(Math.max(...shares) < 15, "特定のタイプに偏りすぎ: " + Math.max(...shares));
  assert.ok(noBasis / N < 0.02); assert.ok(tie / valid < 0.10);
});

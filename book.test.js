"use strict";
// PERSONAL BOOK（試作）の組み立てと、再回答の比較のテスト。実行: node --test core36/tests/
const test = require("node:test");
const assert = require("node:assert/strict");
const E = require("../engine.js");
const D = E.DATA;
const BD = require("../book/book-data.js");
const BK = require("../book/book-engine.js");
const { compare } = require("../compare.js");

function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
// 軸ごとの「A極寄りの度合い（-2〜+2）」から回答を作る。場面別に指定したいときは {work, life}。
function answersFor(spec) {
  const ans = {};
  D.ITEMS.forEach(it => {
    const s = spec[it.axis]; let a = 0;
    if (typeof s === "number") a = s; else if (s) a = s[it.scene];
    ans[it.id] = it.aSide === "left" ? 3 - a : 3 + a;
  });
  return ans;
}
function randomAnswers(rnd) {
  const th = {}; D.AXES.forEach(a => th[a.id] = (rnd() - .5) * 3.2);
  const ans = {};
  D.ITEMS.forEach(it => { const a = Math.max(-2, Math.min(2, Math.round(th[it.axis] + (rnd() - .5) * 2.2))); ans[it.id] = it.aSide === "left" ? 3 - a : 3 + a; });
  return ans;
}
const typeName = id => (global.__names && global.__names[id]) || id;
const book = (res, o) => BK.compose(res, Object.assign({ typeName }, o || {}));
const json = x => JSON.stringify(x);

test("文章データ: 12の極×(武器・力が出る・噛み合いにくい)が4層（h/d/e/t）そろっている", () => {
  D.AXES.forEach(ax => ["A", "B"].forEach(p => {
    const o = BD.POLE[ax.id][p]; assert.ok(o.line, ax.id + p + " line");
    ["weapon", "good", "hard"].forEach(k => ["h", "d", "e", "t"].forEach(f => assert.ok(o[k] && typeof o[k][f] === "string" && o[k][f].length > 10, ax.id + p + k + f)));
  }));
  ["influence", "bond", "logic"].forEach(id => ["A", "B", "balanced", "scene_diff"].forEach(k => ["h", "d", "e", "t"].forEach(f => assert.ok(BD.INTERACT[id][k][f].length > 10, id + k + f))));
  assert.equal(BD.CATEGORIES.length, 5);
  assert.deepEqual(BD.CATEGORIES.map(c => c.title), ["あなたという人", "あなたの武器", "力が出るとき・出ないとき", "人との関わり方", "あなたの取扱説明書"]);
});

test("文章データ: 見出しが『たとえば』を持つため、本文側は『たとえば』で始めない。能力の優劣・断定・VALUE/STATEの推測を含む語がない", () => {
  const strs = [];
  (function walk(o, path) {
    if (typeof o === "string") strs.push([path, o]);
    else if (Array.isArray(o)) o.forEach((v, i) => walk(v, path + "[" + i + "]"));
    else if (o && typeof o === "object") Object.keys(o).forEach(k => walk(o[k], path + "." + k));
  })(BD, "BD");
  assert.ok(strs.length > 250);
  strs.forEach(([p, s]) => {
    if (/\.e$/.test(p)) assert.ok(!/^たとえば/.test(s), p + " が『たとえば』で始まっている");
    const negated = /(意味はありません|意味ではありません)/.test(s);   // 「優れている・劣っているという意味はありません」のような否定文は許す
    ["優れ", "劣", "才能", "天才", "向いている", "必ず", "絶対", "間違いなく", "生まれつき", "診断", "科学的", "証明"].forEach(w => assert.ok(negated || s.indexOf(w) < 0, p + " に『" + w + "』: " + s));
    ["切り替える", "切り替わる", "使い分ける性格"].forEach(w => assert.ok(s.indexOf(w) < 0, p + " に『" + w + "』"));
    ["MBTI", "mediator", "builder", "adventurer", "finisher", "調停者", "建設者", "冒険者", "完遂者"].forEach(w => assert.ok(s.indexOf(w) < 0, p + " に旧タイプ・他社用語『" + w + "』"));
  });
});

test("組み立て: ランダムな3000人分で、5カテゴリ・全ページ4層・未置換の{}なし・ID一意・枚数ルールを満たす", () => {
  const rnd = mulberry32(20261008);
  for (let i = 0; i < 3000; i++) {
    const res = E.score(randomAnswers(rnd)), b = book(res);
    assert.equal(b.ok, true);
    assert.equal(b.cats.length, 5);
    const ids = BK.pageIds(b); assert.equal(new Set(ids).size, ids.length, "ページIDが重複");
    BK.allStrings(b).forEach(s => { assert.ok(typeof s === "string" && s.length > 0); assert.ok(!/\{\w+\}/.test(s), "未置換: " + s); });
    b.cats.forEach(c => c.pages.forEach(p => ["h", "d", "e", "t"].forEach(f => assert.ok(p[f] && p[f].length > 5, p.id + f))));
    const n = b.lean.length, [c1, c2, c3, c4, c5] = b.cats;
    assert.equal(c2.pages.length, n === 0 ? 1 : Math.min(3, n));
    assert.equal(c3.pages.length, n === 0 ? 1 : 2 * Math.min(2, n));
    assert.equal(c4.pages.length, 3);
    assert.equal(c5.pages.length, n === 0 ? 2 : 3);
    assert.equal(c1.pages.length, 4);
    c3.pages.forEach(p => assert.equal(p.hypothesis, p.id !== "c3-none", p.id + " のKAKU仮説の表示"));
    // 並び順：|平均|の大きい順
    for (let k = 1; k < b.lean.length; k++) assert.ok(b.lean[k - 1].absMean >= b.lean[k].absMean - 1e-9);
    // 寄りのある軸は「場面による違い」が出ていない軸だけ
    b.lean.forEach(l => assert.ok(["a", "b"].includes(res.axes[l.id].reading.kind)));
  }
});

test("独立性: 代表タイプが変わっても（僅差で入れ替わっても）、カテゴリ2〜5の内容は一字一句変わらない", () => {
  const rnd = mulberry32(777);
  for (let i = 0; i < 300; i++) {
    const res = E.score(randomAnswers(rnd)), b1 = book(res);
    const res2 = JSON.parse(json(res)); // 別のタイプが代表になったと仮定
    if (res2.type.primary) { res2.type.primary = res2.type.second || "guardian"; res2.type.second = "creator"; res2.type.fit = "ok"; }
    else { res2.type.primary = "navigator"; res2.type.second = "guardian"; res2.type.fit = "ok"; }
    const b2 = book(res2);
    for (let c = 1; c < 5; c++) assert.equal(json(b1.cats[c]), json(b2.cats[c]), "カテゴリ" + (c + 1) + "がタイプに依存している");
    assert.equal(json(b1.cats[0].pages.filter(p => p.id !== "c1-type")), json(b2.cats[0].pages.filter(p => p.id !== "c1-type")));
  }
});

test("独立性: 12TYPEの判定表（プロフィール）を差し替えても、ブックの内容（c1の代表タイプ以外）は変わらない", () => {
  const rnd = mulberry32(31337), alt = JSON.parse(json(D.PROFILES));
  const ids = Object.keys(alt), rot = ids.map((_, i) => alt[ids[(i + 5) % ids.length]]);
  ids.forEach((id, i) => alt[id] = rot[i]);
  for (let i = 0; i < 200; i++) {
    const ans = randomAnswers(rnd), r1 = E.score(ans), r2 = E.score(ans, { data: { PROFILES: alt } });
    const b1 = book(r1), b2 = book(r2);
    for (let c = 1; c < 5; c++) assert.equal(json(b1.cats[c]), json(b2.cats[c]));
    assert.equal(json(b1.cats[0].pages.filter(p => p.id !== "c1-type")), json(b2.cats[0].pages.filter(p => p.id !== "c1-type")));
  }
});

test("再現性: 同じ回答なら、何度組み立てても同じ内容", () => {
  const ans = randomAnswers(mulberry32(5)), a = book(E.score(ans)), b = book(E.score(ans));
  assert.equal(json(a), json(b));
});

test("全体が『どちらとも』（3）の回答: 軸は寄らず、タイプは分類せず、各章に『読み取れない』旨の文章が出て、推測で補わない", () => {
  const res = E.score(answersFor({})), b = book(res);
  assert.equal(res.type.status, "no_basis");
  assert.equal(b.lean.length, 0);
  assert.equal(b.cats[0].pages[0].h, BD.SPECIAL.overviewNone.h);
  assert.equal(b.cats[0].pages.find(p => p.id === "c1-type").h, BD.SPECIAL.typeNone.h);
  assert.equal(b.cats[1].pages[0].h, BD.SPECIAL.weaponNone.h);
  assert.equal(b.cats[2].pages[0].h, BD.SPECIAL.fitNone.h);
  assert.equal(b.cats[4].pages[0].h, BD.SPECIAL.manualNone.h);
  assert.equal(b.cats[3].pages.every(p => /特定の側に寄らない/.test(p.h)), true);
  const tries = b.cats[4].pages.find(p => p.id === "c5-try").tries;
  assert.equal(tries.length, 3); tries.forEach(t => assert.equal(t.axis, null));
});

test("寄りが1軸だけの回答: 全体像は1軸の文章になり、武器・場面・説明書はその軸だけで組み立つ（近さ弱めのタイプでも本は成立）", () => {
  const res = E.score(answersFor({ drive: 2 })), b = book(res);
  assert.equal(b.lean.length, 1); assert.equal(b.lean[0].id, "drive");
  assert.match(b.cats[0].pages[0].h, /^「即動」寄り/);
  assert.equal(b.cats[1].pages.length, 1); assert.equal(b.cats[1].pages[0].basis[0].axis, "drive");
  assert.equal(b.cats[2].pages.length, 2);
  assert.equal(b.cats[2].pages[0].hypothesis, true);
  const tries = b.cats[4].pages.find(p => p.id === "c5-try").tries;
  assert.equal(tries[0].axis, "drive"); assert.equal(tries.length, 3);
});

test("場面による違い: 仕事＋2／日常−2の影響力は、寄りの軸には数えず、c1とc4に『今回の回答では場面によって違いが見られた』形で出る", () => {
  const res = E.score(answersFor({ influence: { work: 2, life: -2 }, vision: 2, logic: 1 })), b = book(res);
  assert.equal(res.axes.influence.reading.kind, "scene_diff");
  assert.ok(!b.lean.some(l => l.id === "influence"));
  const sc = b.cats[0].pages.find(p => p.id === "c1-scene");
  assert.match(sc.h, /影響力/); assert.match(sc.d, /仕事・学びでは「発信」寄り、日常では「支え」寄り/);
  const c4 = b.cats[3].pages.find(p => p.id === "c4-influence");
  assert.match(c4.d, /仕事・学びでは「発信」寄り、日常では「支え」寄り/);
  assert.match(c4.h, /場面による違い/);
  assert.ok(!/切り替/.test(JSON.stringify(b)));
  const map = b.cats[0].pages.find(p => p.id === "c1-map").axes.find(a => a.axis === "influence");
  assert.equal(map.line, BD.LINE_SCENE);
});

test("寄りの強さの順: 同じ強さなら軸の固定順（構想→解析→突破→影響→共鳴→積み上げ）", () => {
  const res = E.score(answersFor({ steady: 2, vision: 2, bond: -2 })), b = book(res);
  assert.deepEqual(b.lean.map(l => l.id), ["vision", "bond", "steady"]);
  const res2 = E.score(answersFor({ steady: 2, vision: 1, bond: -2 })), b2 = book(res2);
  assert.deepEqual(b2.lean.map(l => l.id), ["bond", "steady", "vision"]);
});

test("極に応じた文章: A極寄りとB極寄りで武器の文章が違い、どちらも『能力が高い／低い』の表現を使わない", () => {
  const a = book(E.score(answersFor({ logic: 2 }))).cats[1].pages[0], c = book(E.score(answersFor({ logic: -2 }))).cats[1].pages[0];
  assert.notEqual(a.h, c.h); assert.equal(a.h, BD.POLE.logic.A.weapon.h); assert.equal(c.h, BD.POLE.logic.B.weapon.h);
});

test("根拠: 軸に基づくページは、軸の位置・読み・根拠の設問ID（各6問）を持つ", () => {
  const b = book(E.score(answersFor({ vision: 2, logic: -2, bond: 1 })));
  b.cats.forEach(c => c.pages.filter(p => /^c[2-4]-/.test(p.id) && p.id !== "c2-none").forEach(p => {
    assert.ok(p.basis.length >= 1, p.id);
    p.basis.forEach(x => { assert.equal(x.items.length, 6); assert.ok(typeof x.position === "number"); assert.ok(x.label); });
  }));
});

test("取扱説明書: 条件・気づきはKAKU仮説と明示でき、『試してみること』は選べる3件（軸に基づく分＋補いの分）", () => {
  const b = book(E.score(answersFor({ vision: 2, logic: 2 })));
  const cond = b.cats[4].pages.find(p => p.id === "c5-cond"), care = b.cats[4].pages.find(p => p.id === "c5-care"), t = b.cats[4].pages.find(p => p.id === "c5-try");
  assert.equal(cond.hypothesis, true); assert.equal(care.hypothesis, true);
  assert.equal(t.tries.length, 3); assert.equal(t.tries.filter(x => x.axis).length, 2);
  assert.equal(new Set(t.tries.map(x => x.id)).size, 3);
});

test("未完了の回答や空の結果では、ブックを作らない（ok=false）", () => {
  const part = {}; D.ITEMS.slice(0, 20).forEach(it => part[it.id] = 3);
  assert.equal(book(E.score(part)).ok, false);
  assert.equal(BK.compose(null).ok, false);
});

test("旧4タイプの名前が、ブックのどのページにも出ない", () => {
  const rnd = mulberry32(99);
  for (let i = 0; i < 500; i++) {
    const s = JSON.stringify(book(E.score(randomAnswers(rnd))));
    ["mediator", "builder", "adventurer", "finisher"].forEach(w => assert.ok(s.indexOf(w) < 0, w));
  }
});

// ---------- 再回答の比較 ----------
test("比較: 同じ回答どうしは、全軸『ほぼ同じ』・タイプも同じ", () => {
  const ans = answersFor({ vision: 2, logic: 1, bond: -1 }), r = E.score(ans), c = compare(r, E.score(ans), { typeName });
  assert.equal(c.ok, true);
  assert.ok(c.axes.every(a => a.step === "same" && !a.kindChanged && !a.flipped));
  assert.equal(c.type.kind, "same"); assert.equal(c.items.bigChanges.length, 0); assert.equal(c.items.sameAnswer, 36);
  assert.ok(c.summary.some(s => /前回と同じ/.test(s)));
});

test("比較: 1軸を反転させると、その軸だけ『はっきり違う』・向きの入れ替わりとして検出され、他の軸は変わらない", () => {
  const a = E.score(answersFor({ vision: 2, logic: 2, bond: 1 })), b = E.score(answersFor({ vision: -2, logic: 2, bond: 1 }));
  const c = compare(a, b, { typeName });
  const v = c.axes.find(x => x.id === "vision");
  assert.equal(v.step, "large"); assert.equal(v.flipped, true); assert.equal(v.kindChanged, true);
  c.axes.filter(x => x.id !== "vision").forEach(x => assert.equal(x.step, "same"));
  assert.ok(c.items.bigChanges.length === 6 && c.items.bigChanges.every(d => d.diff === 4));
  assert.ok(c.summary.some(s => /入れ替わった軸：構想力/.test(s)));
});

test("比較: タイプの変化は『同じ／表示範囲に含まれる／含まれない／どちらかなし』に分類される。比較の向きを入れ替えても整合する", () => {
  const rnd = mulberry32(2026), kinds = {};
  for (let i = 0; i < 1500; i++) {
    const a = E.score(randomAnswers(rnd)), b = E.score(randomAnswers(rnd)), c = compare(a, b, { typeName }), d = compare(b, a, { typeName });
    kinds[c.type.kind] = (kinds[c.type.kind] || 0) + 1;
    assert.ok(["same", "in_shown", "changed", "one_none", "both_none"].includes(c.type.kind));
    assert.equal(c.type.kind, d.type.kind, "比較の向きで分類が変わる");
    if (c.type.kind === "same") assert.equal(c.type.prevPrimary, c.type.currPrimary);
    if (c.type.kind === "changed") { assert.ok(!c.type.prevInCurrentShown && !c.type.currInPreviousShown); }
  }
  assert.ok(kinds.same > 0 && kinds.changed > 0, JSON.stringify(kinds));
});

test("比較: 未完了の回答、バージョン違いの回答の扱い", () => {
  const ok = E.score(answersFor({ vision: 2 })), part = {}; D.ITEMS.slice(0, 10).forEach(it => part[it.id] = 3);
  assert.equal(compare(ok, E.score(part)).ok, false);
  const old = JSON.parse(json(ok)); old.scoring_version = "0.1.0";
  assert.deepEqual(compare(old, ok).versionMismatch, ["0.1.0", ok.scoring_version]);
});

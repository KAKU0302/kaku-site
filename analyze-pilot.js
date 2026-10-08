#!/usr/bin/env node
/**
 * core36/tools/analyze-pilot.js
 * パイロット（テスト用診断画面で書き出したJSON）の分析ツール。
 *
 * 使い方:  node core36/tools/analyze-pilot.js 書き出したファイル.json [--min-days 10]
 *
 * 出すもの（実利用者のデータが入った場合に見る項目）:
 *   - 各軸の回答の一貫性（クロンバックのα、各設問と軸全体の相関、軸間の相関）
 *   - 設問の分布（回答の片寄り）と「分かりにくい」印の数
 *   - 2週間後などの再回答での、CORE6（軸の位置・読み）と12TYPEの一致
 *   - アンケート（設問の理解しやすさ、納得感、判定理由の理解、軸の読みの実感）
 *
 * 注意:
 *   - 参加者が少ないうちの数値は参考値です。α・相関・一致率を「検証済みの基準」として扱いません。
 *   - 「表示した1〜2タイプに再回答のタイプが入る割合60%以上」は暫定の開発目標であり、
 *     科学的に検証された基準ではありません。
 *   - 回答は engine.js で再計算します（保存された結果ではなく回答を正とする）。
 */
"use strict";
const fs = require("fs"), path = require("path");
const E = require("../engine.js");
const D = E.DATA;

// ---------- 統計の補助 ----------
const mean = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
const sd = a => { if (a.length < 2) return null; const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)); };
const median = a => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y), h = s.length >> 1; return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; };
function pearson(x, y) {
  const n = x.length; if (n < 3) return null;
  const mx = mean(x), my = mean(y); let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : null;
}
function cronbach(rows) {   // rows: 人×設問の配列
  const k = rows[0] ? rows[0].length : 0; if (rows.length < 3 || k < 2) return null;
  const itemVar = []; for (let j = 0; j < k; j++) itemVar.push(sd(rows.map(r => r[j])) ** 2);
  const tot = sd(rows.map(r => r.reduce((s, x) => s + x, 0))) ** 2;
  return tot > 0 ? (k / (k - 1)) * (1 - itemVar.reduce((s, x) => s + x, 0) / tot) : null;
}
const pct = (n, d) => d ? Math.round(n / d * 1000) / 10 : null;
const fx = (v, n = 2) => v == null ? "-" : v.toFixed(n);

// ---------- 分析本体 ----------
function analyze(data, opts) {
  opts = opts || {};
  const minDays = opts.minDays == null ? 10 : opts.minDays;
  const runs = (data.runs || []).filter(r => r && r.answers).map(r => {
    const res = E.score(r.answers, { durationSec: r.durationSec });
    return Object.assign({}, r, { res });
  });
  const out = { n_runs: runs.length, synthetic: runs.some(r => r.synthetic), scoring_versions: Array.from(new Set(runs.map(r => r.scoring_version))) };
  const complete = runs.filter(r => r.res.status === "complete");
  const first = complete.filter(r => r.sessionKind !== "retest");
  out.n_complete = complete.length; out.n_first = first.length;
  out.duration_median_sec = median(complete.map(r => r.durationSec).filter(x => typeof x === "number"));
  out.flag_fast = pct(complete.filter(r => r.res.flags.fast).length, complete.length);
  out.flag_straight = pct(complete.filter(r => r.res.flags.straightLine).length, complete.length);
  out.type_status = {}; complete.forEach(r => out.type_status[r.res.type.status] = (out.type_status[r.res.type.status] || 0) + 1);

  // 設問ごと
  const aOf = (r, it) => E.aValue(it, r.answers[it.id]);
  out.items = D.ITEMS.map(it => {
    const ownRuns = first.filter(r => it.id in r.answers);
    const a = ownRuns.map(r => aOf(r, it)), raw = ownRuns.map(r => r.answers[it.id]);
    const others = D.ITEMS.filter(x => x.axis === it.axis && x.id !== it.id);
    const rest = ownRuns.map(r => mean(others.filter(x => x.id in r.answers).map(x => aOf(r, x))));
    const freq = {}; raw.forEach(v => freq[v] = (freq[v] || 0) + 1);
    const modal = raw.length ? Math.max.apply(null, Object.values(freq)) / raw.length : null;
    const unclear = runs.filter(r => (r.unclearItems || []).includes(it.id)).length;
    return { id: it.id, axis: it.axis, scene: it.scene, n: a.length, meanA: mean(a), sd: sd(a), modalShare: modal, itemRest: pearson(a, rest), unclear: unclear, unclearPct: pct(unclear, runs.length) };
  });
  // 軸ごと
  out.axes = D.AXES.map(ax => {
    const its = D.ITEMS.filter(i => i.axis === ax.id);
    const rows = first.filter(r => its.every(i => i.id in r.answers)).map(r => its.map(i => aOf(r, i)));
    const kinds = {}; first.forEach(r => { const k = r.res.axes[ax.id].reading.kind; kinds[k] = (kinds[k] || 0) + 1; });
    const pos = first.map(r => r.res.axes[ax.id].position);
    const wk = first.map(r => r.res.axes[ax.id].sceneMeans.work), lf = first.map(r => r.res.axes[ax.id].sceneMeans.life);
    return { id: ax.id, alpha: cronbach(rows), mean: mean(pos), sd: sd(pos), readings: kinds, workLifeCorr: pearson(wk.filter(x => x != null), lf.filter(x => x != null)) };
  });
  // 軸間の相関
  out.axisCorr = {};
  D.AXES.forEach((a, i) => D.AXES.forEach((b, j) => {
    if (j <= i) return;
    out.axisCorr[a.id + "-" + b.id] = pearson(first.map(r => r.res.axes[a.id].position), first.map(r => r.res.axes[b.id].position));
  }));

  // 再回答（同じ参加コードの初回と再回答の組）
  const byCode = {}; complete.forEach(r => { if (r.pilotCode) (byCode[r.pilotCode] = byCode[r.pilotCode] || []).push(r); });
  const pairs = [];
  Object.keys(byCode).forEach(c => {
    const g = byCode[c].slice().sort((x, y) => String(x.finishedAt).localeCompare(String(y.finishedAt)));
    const f = g.find(r => r.sessionKind !== "retest"), t = g.filter(r => r.sessionKind === "retest").pop();
    if (f && t) pairs.push({ code: c, first: f, retest: t, days: (new Date(t.finishedAt) - new Date(f.finishedAt)) / 86400000 });
  });
  const okPairs = pairs.filter(p => p.days >= minDays);
  out.retest = { pairs: pairs.length, usable: okPairs.length, tooClose: pairs.length - okPairs.length, minDays: minDays, daysMedian: median(pairs.map(p => p.days)) };
  out.retest.axes = D.AXES.map(ax => {
    const p1 = okPairs.map(p => p.first.res.axes[ax.id]), p2 = okPairs.map(p => p.retest.res.axes[ax.id]);
    return {
      id: ax.id, positionCorr: pearson(p1.map(a => a.position), p2.map(a => a.position)),
      readingSame: pct(okPairs.filter((p, i) => p1[i].reading.kind === p2[i].reading.kind).length, okPairs.length),
      leanSignSame: pct(okPairs.filter((p, i) => Math.sign(p1[i].mean) === Math.sign(p2[i].mean)).length, okPairs.length),
      sceneDiffRepeat: (() => { const f = okPairs.filter((p, i) => p1[i].reading.kind === "scene_diff"); return f.length ? pct(f.filter(p => p.retest.res.axes[ax.id].reading.kind === "scene_diff").length, f.length) : null; })()
    };
  });
  const withType = okPairs.filter(p => p.first.res.type.primary && p.retest.res.type.primary);
  out.retest.type = {
    n: withType.length,
    primarySame: pct(withType.filter(p => p.first.res.type.primary === p.retest.res.type.primary).length, withType.length),
    inShown12: pct(withType.filter(p => p.retest.res.type.primary === p.first.res.type.primary || (p.first.res.type.showSecond && p.retest.res.type.primary === p.first.res.type.second)).length, withType.length),
    devTargetNote: "表示した1〜2タイプに再回答のタイプが入る割合60%以上は、暫定の開発目標（検証済みの科学的基準ではない）"
  };

  // アンケート
  const sv = runs.filter(r => r.survey);
  out.survey = { n: sv.length };
  ["understand", "convince", "reason", "axes"].forEach(k => { const v = sv.map(r => r.survey[k]).filter(x => x != null); out.survey[k] = { n: v.length, mean: mean(v) }; });
  out.survey.axisFit = {}; D.AXES.forEach(ax => { const v = sv.map(r => r.survey.axisFit && r.survey.axisFit[ax.id]).filter(x => x != null); out.survey.axisFit[ax.id] = { n: v.length, mean: mean(v) }; });
  out.survey.free = sv.map(r => r.survey.free).filter(Boolean);
  return out;
}

function format(o) {
  const L = [], axName = Object.fromEntries(D.AXES.map(a => [a.id, a.nameJp]));
  L.push("=== KAKU CORE36 パイロット分析（scoring_version: " + o.scoring_versions.join(", ") + "）===");
  if (o.synthetic) L.push("※ 仮想データです（実利用者のデータではありません）。分析ツールの動作確認用です。");
  L.push("回答数 " + o.n_runs + "（完了 " + o.n_complete + "、初回 " + o.n_first + "）／回答時間の中央値 " + fx(o.duration_median_sec, 0) + "秒／『回答が速い』印 " + fx(o.flag_fast, 1) + "%／偏りの印 " + fx(o.flag_straight, 1) + "%");
  L.push("タイプ判定の状態: " + Object.entries(o.type_status).map(([k, v]) => k + " " + v).join(", "));
  if (o.n_first < 30) L.push("※ 初回の人数が30人未満のため、以下の数値は参考値です。");
  L.push("", "--- 軸ごとの一貫性（初回のみ）---");
  o.axes.forEach(a => L.push(axName[a.id].padEnd(6, "　") + " α=" + fx(a.alpha) + "  位置の平均=" + fx(a.mean, 1) + " (sd " + fx(a.sd, 1) + ")  読み: " + Object.entries(a.readings).map(([k, v]) => k + " " + v).join(", ") + "  仕事×日常の相関=" + fx(a.workLifeCorr)));
  L.push("（αは設問が同じ方向に動いているかの目安。値の良し悪しの基準は決めていません。軸ごとの比較として見てください）");
  L.push("", "--- 軸間の相関（|r|≥0.5 は、測っている概念が混ざっていないか要確認）---");
  Object.entries(o.axisCorr).forEach(([k, v]) => { const flag = v != null && Math.abs(v) >= 0.5 ? "  ← 要確認" : ""; const mark = k === "logic-bond" ? "  【重点】" : ""; L.push(k.padEnd(18) + fx(v) + flag + mark); });
  L.push("", "--- 設問（軸全体との相関が低い・片寄りが大きい・分かりにくい印が多いものを抽出）---");
  const weak = o.items.filter(i => (i.itemRest != null && i.itemRest < 0.2) || (i.modalShare != null && i.modalShare > 0.7) || (i.unclearPct != null && i.unclearPct >= 10));
  if (!weak.length) L.push("（該当なし）");
  weak.forEach(i => L.push(i.id + " " + axName[i.axis] + " 軸との相関=" + fx(i.itemRest) + " 最頻回答の割合=" + fx(i.modalShare == null ? null : i.modalShare * 100, 0) + "% 分かりにくい印=" + i.unclear + "件" + (["C05", "C35", "C11", "C17", "C29"].includes(i.id) ? "  【BOND重点】" : "")));
  const bond = o.items.filter(i => i.axis === "bond").map(i => i.id + ":" + fx(i.itemRest)).join("  ");
  L.push("BONDの各設問と軸全体の相関: " + bond);
  L.push("", "--- 再回答（同じ参加コード）---");
  L.push("組 " + o.retest.pairs + "（" + o.retest.minDays + "日以上あいた組 " + o.retest.usable + "、近すぎて除外 " + o.retest.tooClose + "）／日数の中央値 " + fx(o.retest.daysMedian, 1));
  o.retest.axes.forEach(a => L.push(axName[a.id].padEnd(6, "　") + " 位置の相関=" + fx(a.positionCorr) + "  読みが同じ=" + fx(a.readingSame, 0) + "%  寄る向きが同じ=" + fx(a.leanSignSame, 0) + "%  場面差が再現=" + fx(a.sceneDiffRepeat, 0) + "%"));
  const t = o.retest.type;
  L.push("12TYPE（n=" + t.n + "）: 代表タイプが同じ " + fx(t.primarySame, 1) + "% ／ 表示した1〜2タイプに入る " + fx(t.inShown12, 1) + "%");
  L.push("  " + t.devTargetNote);
  L.push("", "--- アンケート（1〜5）---");
  const s = o.survey;
  L.push("n=" + s.n + "  質問の分かりやすさ " + fx(s.understand.mean) + " / 結果への納得感 " + fx(s.convince.mean) + " / 判定理由の理解 " + fx(s.reason.mean) + " / 軸の読み全体の実感 " + fx(s.axes.mean));
  L.push("軸ごとの実感: " + D.AXES.map(a => axName[a.id] + " " + fx(s.axisFit[a.id].mean)).join(" / "));
  L.push("自由記述 " + s.free.length + "件" + (s.free.length ? "：\n  ・" + s.free.slice(0, 20).join("\n  ・") : ""));
  L.push("", "※ PERSONAL BOOKの内容が本人の実感と合うかは、書籍の文章ができた段階で、同じ形式のアンケートを追加して確認します。");
  return L.join("\n");
}

module.exports = { analyze, format };

if (require.main === module) {
  const args = process.argv.slice(2), file = args.find(a => !a.startsWith("--"));
  if (!file) { console.error("使い方: node core36/tools/analyze-pilot.js 書き出したファイル.json [--min-days 10]"); process.exit(1); }
  const i = args.indexOf("--min-days"), minDays = i >= 0 ? Number(args[i + 1]) : 10;
  console.log(format(analyze(JSON.parse(fs.readFileSync(path.resolve(file), "utf8")), { minDays })));
}

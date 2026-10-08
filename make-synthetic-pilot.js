#!/usr/bin/env node
/**
 * core36/tools/make-synthetic-pilot.js
 * 分析ツールの動作確認用に、仮想のパイロットデータ（JSON）を作る。実利用者のデータではない。
 * 使い方: node core36/tools/make-synthetic-pilot.js 出力.json [人数=60] [回答のゆらぎ=1.0]
 */
"use strict";
const fs = require("fs");
const E = require("../engine.js"); const D = E.DATA;

function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function make(n, noise, seed) {
  const rnd = mulberry32(seed || 424242), g = () => { let u = 0; while (u === 0) u = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd()); };
  const runs = [], base = new Date("2026-11-01T10:00:00Z").getTime();
  for (let p = 0; p < n; p++) {
    const theta = {}; D.AXES.forEach(ax => theta[ax.id] = g() * 0.9);
    const sceneOff = {}; D.AXES.forEach(ax => sceneOff[ax.id] = g() * 0.5);
    [["first", 0], ["retest", 14 + Math.floor(rnd() * 4)]].forEach(([kind, day]) => {
      const answers = {};
      D.ITEMS.forEach(it => {
        const a = Math.max(-2, Math.min(2, Math.round(theta[it.axis] + g() * noise + sceneOff[it.axis] * (it.scene === "work" ? 1 : -1))));
        answers[it.id] = it.aSide === "left" ? 3 - a : 3 + a;
      });
      const res = E.score(answers);
      runs.push({
        synthetic: true, runId: "syn-" + p + "-" + kind, pilotCode: "S" + String(p + 1).padStart(2, "0"), sessionKind: kind,
        startedAt: new Date(base + day * 864e5).toISOString(), finishedAt: new Date(base + day * 864e5 + 450000).toISOString(),
        durationSec: Math.round(380 + g() * 80), scoring_version: res.scoring_version, answers,
        unclearItems: rnd() < 0.08 ? [D.ITEMS[Math.floor(rnd() * 36)].id] : [],
        summary: { primary: res.type.primary }, saved: true,
        survey: kind === "first" ? { understand: 3 + Math.round(rnd() * 2), convince: 3 + Math.round(rnd() * 2), reason: 2 + Math.round(rnd() * 3), axes: 3 + Math.round(rnd() * 2),
          axisFit: Object.fromEntries(D.AXES.map(ax => [ax.id, 2 + Math.round(rnd() * 3)])), free: rnd() < .1 ? "（仮想）サンプル" : "" } : null
      });
    });
  }
  return { exported_at: "synthetic", scoring_version: D.VERSION, runs };
}
module.exports = { make };
if (require.main === module) {
  const [, , file, n, noise] = process.argv;
  if (!file) { console.error("使い方: node core36/tools/make-synthetic-pilot.js 出力.json [人数] [ゆらぎ]"); process.exit(1); }
  fs.writeFileSync(file, JSON.stringify(make(Number(n) || 60, noise ? Number(noise) : 1.0), null, 1)); console.log("書き出しました:", file);
}

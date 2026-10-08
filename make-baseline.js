// 既存（旧30問・16タイプ・決済・メール・共有）ファイルが変更されていないことを確認するための基準を作る。
// 実行: node core36/tools/make-baseline.js   （既存ファイルを意図して変更した場合のみ、TOMの承認のうえで再実行）
const fs = require("fs"), path = require("path"), crypto = require("crypto"), vm = require("vm");
const root = path.join(__dirname, "..", "..");
const PROTECTED = ["index.html","app.js","style.css","types-data.js","core-engine.js","type-engine.js","state-engine.js","gap-engine.js","birth-engine.js","match-engine.js","context-engine.js","api/create-checkout-session.js","api/stripe-webhook.js","package.json"]
  .concat(fs.readdirSync(root).filter(f => /\.jpg$/.test(f)));
const hashes = {};
for (const f of PROTECTED) hashes[f] = crypto.createHash("sha256").update(fs.readFileSync(path.join(root, f))).digest("hex");

// 旧エンジンの出力（固定入力→固定出力）を記録
const ctx = {}; vm.createContext(ctx);
for (const f of ["types-data.js","core-engine.js","type-engine.js"]) vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), ctx, { filename: f });
vm.runInContext("globalThis.__e={QUESTIONS,computeCore6,determineType}", ctx);
const { QUESTIONS, computeCore6, determineType } = ctx.__e;
let seed = 12345; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
const golden = [];
for (let i = 0; i < 40; i++) {
  const ans = {}; QUESTIONS.forEach(q => ans[q.id] = rnd() < 0.5 ? "A" : "B");
  const c = computeCore6(ans);
  golden.push({ ans, scores: c.scores, topAxis: c.topAxis, secondAxis: c.secondAxis, typeId: determineType(c.topAxis, c.secondAxis) });
}
fs.writeFileSync(path.join(__dirname, "..", "tests", "fixtures", "protected-hashes.json"), JSON.stringify(hashes, null, 1));
fs.writeFileSync(path.join(__dirname, "..", "tests", "fixtures", "legacy-golden.json"), JSON.stringify(golden));
console.log("hashes:", Object.keys(hashes).length, "files; legacy golden cases:", golden.length, "; legacy question count:", QUESTIONS.length);

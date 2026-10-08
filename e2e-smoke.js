// ブラウザでの動作確認（テスト用診断画面と、既存の公開画面）。
// 実行: node core36/tests/e2e-smoke.js   （Playwright と Chromium が必要。簡易サーバーを自動で起動）
const http = require("http"), fs = require("fs"), path = require("path");
let chromium; try { chromium = require("playwright").chromium; } catch (e) { chromium = require("/home/claude/.npm-global/lib/node_modules/playwright").chromium; }
const root = path.join(__dirname, "..", "..");
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".jpg": "image/jpeg", ".json": "application/json", ".png": "image/png" };
const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(req.url.split("?")[0]).replace(/\/$/, "/index.html"));
  if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end("nf"); }
  res.writeHead(200, { "content-type": mime[path.extname(p)] || "application/octet-stream" }); fs.createReadStream(p).pipe(res);
});
const out = path.join(process.env.SHOT_DIR || __dirname, "shots"); fs.mkdirSync(out, { recursive: true });
let fails = 0; const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fails++; };

(async () => {
  await new Promise(r => server.listen(0, r)); const base = "http://localhost:" + server.address().port;
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await ctx.newPage(); const errors = [];
  page.on("pageerror", e => errors.push("pageerror: " + e.message)); page.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text()); });
  page.on("requestfailed", r => errors.push("requestfailed: " + r.url()));

  // ---- 1. 通常の回答（architect の理想に近い回答をキーボードで）----
  await page.goto(base + "/core36/test.html");
  ok(await page.locator("h1").innerText() === "KAKU CORE36 テスト診断", "開始画面が表示される");
  await page.fill("#pc", "E2E01"); await page.click("#start");
  await page.screenshot({ path: path.join(out, "question.png") });
  const D = require("../data.js");
  const want = { vision: 1, logic: 1, drive: -1 };
  for (let i = 0; i < 36; i++) {
    const it = D.ITEMS[i];
    const counter = await page.locator(".c36-soft").first().innerText().catch(() => "");
    const a = want[it.axis] || 0, r = it.aSide === "left" ? 3 - a : 3 + a;
    if (i === 3) { await page.check("#unclear"); }                    // 「分かりにくい」印
    if (i === 5) { await page.click("#back"); await page.waitForTimeout(50); await page.keyboard.press("2"); await page.waitForTimeout(260); } // 戻る→答え直す
    await page.keyboard.press(String(r)); await page.waitForTimeout(260);
    if (i === 17) { await page.waitForTimeout(50); ok(await page.locator(".c36-note").count() > 0, "18問目の後に『日常の場面』の案内が出る"); }
  }
  await page.waitForSelector("text=テスト結果");
  ok(await page.locator(".c36-axis").count() === 6, "結果に6軸が表示される");
  const typeName = await page.locator(".c36-type__jp").first().innerText();
  ok(typeName === "設計者", "代表タイプが設計者（" + typeName + "）");
  const loaded = await page.evaluate(() => { const i = document.querySelector(".c36-type img"); return i && i.complete && i.naturalWidth > 0; });
  ok(loaded, "既存の設計者キャラクター画像が表示される（画像は変更なし）");
  const box = await page.locator(".c36-type img").first().boundingBox();
  ok(Math.abs(box.height / box.width - 1.5) < 0.02, "キャラクター画像は切り抜かず元の比率（2:3）で表示される: " + (box.height / box.width).toFixed(2));
  ok((await page.locator("body").innerText()).includes("いちばん近い"), "判定理由が『いちばん近い』という表現で示される");
  await page.screenshot({ path: path.join(out, "result-top.png"), fullPage: false });
  await page.screenshot({ path: path.join(out, "result-full.png"), fullPage: true });
  // アンケートに回答して保存
  for (const n of ["understand", "convince", "reason", "axes"]) await page.check(`input[name=sv_${n}][value="4"]`);
  for (const ax of D.AXES) await page.check(`input[name=ax_${ax.id}][value="3"]`);
  await page.fill("#sv_free", "テスト入力"); await page.click("#save"); await page.waitForSelector("text=この端末の保存データ（1件）");
  const runs = await page.evaluate(() => JSON.parse(localStorage.getItem("kaku_core36_pilot_runs_v1")));
  ok(runs.length === 1 && Object.keys(runs[0].answers).length === 36, "36問の回答が保存される");
  ok(runs[0].scoring_version === "0.2.0-draft" && runs[0].pilotCode === "E2E01" && runs[0].unclearItems.includes("C04"), "バージョン・参加コード・『分かりにくい』印が保存される");
  ok(runs[0].survey && runs[0].survey.convince === 4 && runs[0].survey.axisFit.vision === 3, "アンケートが保存される");
  ok(runs[0].answers.C05 === 2, "6問目で『前へ』を押して答え直した5問目の回答（2）が反映される: C05=" + runs[0].answers.C05);
  ok(!/name|email|birth/i.test(JSON.stringify(Object.keys(runs[0]))), "氏名・メール・生年月日のフィールドを持たない");

  // ---- 2. 全問『どちらとも』→ 無理に分類しない ----
  await page.fill("#pc", "E2E02"); await page.click("#start");
  for (let i = 0; i < 36; i++) { await page.keyboard.press("3"); await page.waitForTimeout(250); }
  await page.waitForSelector("text=テスト結果");
  ok((await page.locator("body").innerText()).includes("特定のタイプに近いとは言えませんでした"), "全問『どちらとも』ではタイプを無理に出さない");
  ok(await page.locator(".c36-type").count() === 0, "その場合、タイプのカードは出ない");
  await page.screenshot({ path: path.join(out, "result-nobasis.png"), fullPage: true });
  await page.click("#skip");

  // ---- 3. 途中離脱→再開 ----
  await page.fill("#pc", "E2E03"); await page.click("#start");
  for (let i = 0; i < 7; i++) { await page.keyboard.press("4"); await page.waitForTimeout(250); }
  await page.goto(base + "/core36/test.html");
  ok(await page.locator("#resume").count() === 1, "途中の回答が下書きとして残り、続きから再開できる");
  await page.click("#resume"); ok((await page.locator(".c36-soft").filter({ hasText: "/ 36" }).first().innerText()).trim() === "8 / 36", "8問目から再開する");

  // ---- 4. 2タイプ表示の確認：僅差になる回答を探して表示確認 ----
  const E = require("../engine.js");
  let found = null, seed = 3;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  for (let n = 0; n < 5000 && !found; n++) { const resp = {}; D.ITEMS.forEach(i => resp[i.id] = 1 + Math.floor(rnd() * 5)); const r = E.score(resp); if (r.type.showSecond && r.type.fit === "ok") found = { resp, r }; }
  await page.goto(base + "/core36/test.html"); await page.evaluate(() => localStorage.removeItem("kaku_core36_pilot_draft_v1"));
  await page.reload(); await page.fill("#pc", "E2E04"); await page.click("#start");
  for (let i = 0; i < 36; i++) { await page.keyboard.press(String(found.resp[D.ITEMS[i].id])); await page.waitForTimeout(250); }
  await page.waitForSelector("text=テスト結果");
  const names = await page.locator(".c36-type__jp").allInnerTexts(); 
  ok(names.length === 2, "僅差のときは代表タイプに加えて2番目に近いタイプが表示される: " + names.join(" / "));
  await page.screenshot({ path: path.join(out, "result-two.png"), fullPage: true });

  // ---- 5. 公開版の画面が変わっていないこと ----
  const pub = await ctx.newPage(); const perr = [];
  pub.on("pageerror", e => perr.push(e.message));
  await pub.goto(base + "/index.html"); await pub.waitForTimeout(600);
  ok(perr.length === 0, "公開版 index.html にJavaScriptエラーがない" + (perr.length ? ": " + perr[0] : ""));
  ok((await pub.content()).includes("core-engine.js") && !(await pub.content()).includes("core36"), "公開版は旧30問のエンジンを読み込み、core36を読み込まない");

  ok(errors.length === 0, "テスト用画面にコンソールエラー・読み込み失敗がない" + (errors.length ? ": " + errors.slice(0, 3).join(" | ") : ""));
  await browser.close(); server.close(); console.log(fails ? `\n${fails} 件失敗` : "\nすべて成功"); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); server.close(); process.exit(1); });

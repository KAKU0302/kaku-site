// プレビュー（試作）のブラウザ確認：スマホ幅（375×812）で、同意→36問→結果→BOOK5章→感想→書き出し→再回答の比較まで通す。
// 実行: node core36/tools/build-preview.js && node core36/tests/e2e-preview.js
const http = require("http"), fs = require("fs"), path = require("path");
let chromium; try { chromium = require("playwright").chromium; } catch (e) { chromium = require("/home/claude/.npm-global/lib/node_modules/playwright").chromium; }
const dist = path.join(__dirname, "..", "preview", "dist");
const D = require("../data.js");
const out = path.join(process.env.SHOT_DIR || __dirname, "shots-preview"); fs.mkdirSync(out, { recursive: true });
let fails = 0; const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fails++; };

const server = http.createServer((req, res) => {
  const f = path.join(dist, req.url.split("?")[0] === "/" ? "preview.html" : req.url.split("?")[0]);
  if (!f.startsWith(dist) || !fs.existsSync(f)) { res.writeHead(404); return res.end("nf"); }
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); fs.createReadStream(f).pipe(res);
});
function ansVal(it, spec) { const s = spec[it.axis]; let a = 0; if (typeof s === "number") a = s; else if (s) a = s[it.scene]; return it.aSide === "left" ? 3 - a : 3 + a; }

async function answerAll(page, spec, hook) {
  for (let i = 0; i < 36; i++) {
    const it = D.ITEMS[i];
    await page.waitForSelector(".k-scale");
    if (hook) await hook(i, it);
    await page.keyboard.press(String(ansVal(it, spec)));
    await page.waitForTimeout(290);
  }
}
async function noOverflow(page, label) {
  const w = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  ok(w[0] <= w[1], label + "：横スクロールが出ない（" + w[0] + " ≤ " + w[1] + "）");
}

(async () => {
  await new Promise(r => server.listen(0, r)); const base = "http://localhost:" + server.address().port + "/";
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, acceptDownloads: true, hasTouch: true, isMobile: true });
  const page = await ctx.newPage(); const errors = [], requests = [];
  page.on("pageerror", e => errors.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text()); });
  page.on("request", r => { if (!/^(data:|blob:|about:)/.test(r.url())) requests.push(r.method() + " " + r.url()); });
  const shot = n => page.screenshot({ path: path.join(out, n + ".png") });

  // ===== 1. ホーム・同意 =====
  await page.goto(base);
  ok((await page.locator("h1").first().innerText()).includes("KAKU"), "ホームが表示される");
  ok(/検証は、まだ完了していません/.test(await page.locator(".k-note").first().innerText()), "ホームに『診断精度の検証は未完了』の明記がある");
  await noOverflow(page, "ホーム"); await shot("01-home");
  await page.fill("#pc", "E2E-TOM");
  await page.click('[data-act="start"][data-kind="first"]');
  ok(await page.locator('[data-act="consent-ok"]').isDisabled(), "同意の画面：『理解した』にチェックするまで進めない");
  ok(/外部に送信しません/.test(await page.locator("main").innerText()), "同意の画面に『外部に送信しない』の明記がある");
  await noOverflow(page, "同意"); await shot("02-consent");
  await page.check('[data-bind="c-understood"]'); await page.check('[data-bind="c-save"]');
  ok(!(await page.locator('[data-act="consent-ok"]').isDisabled()), "チェックすると進める");
  await page.click('[data-act="consent-ok"]');

  // ===== 2. 36問 =====
  await page.waitForSelector(".k-scale");
  ok(/1 \/ 36/.test(await page.locator(".k-q-head").innerText()), "1問目が表示される");
  await noOverflow(page, "質問"); await shot("03-question");
  const box = await page.locator('.k-scale button[data-v="1"]').boundingBox();
  ok(box.width >= 44 && box.height >= 44, "選択肢のタップ領域が44px以上（" + Math.round(box.width) + "×" + Math.round(box.height) + "）");
  const spec = { vision: 2, logic: 1, drive: -1, influence: { work: 1, life: -2 }, bond: 0, steady: 1 };
  await answerAll(page, spec, async (i, it) => {
    if (i === 3) {   // 違和感の記録
      await page.click('[data-act="disc-toggle"]'); await page.check('[data-bind="disc-reason"][data-r="unclear"]');
      await page.fill('[data-bind="disc-note"]', "言い回しが少し難しい"); await shot("04-discomfort");
      await page.click('[data-act="disc-toggle"]');
    }
    if (i === 5) { await page.click('[data-act="qback"]'); await page.waitForTimeout(60); await page.keyboard.press("2"); await page.waitForTimeout(290); }   // 戻って答え直す
  });

  // ===== 3. 結果 =====
  await page.waitForSelector(".k-typehero");
  ok(await page.locator(".k-axis").count() === 6, "結果に6つの軸が表示される");
  const img = page.locator(".k-typehero img.k-timg");
  const dims = await img.evaluate(i => ({ w: i.naturalWidth, h: i.naturalHeight, bw: i.getBoundingClientRect().width, bh: i.getBoundingClientRect().height, fit: getComputedStyle(i).objectFit }));
  ok(dims.w === 800 && dims.h === 1200, "既存のキャラクター画像（800×1200）がそのまま表示される");
  ok(Math.abs(dims.bh / dims.bw - 1.5) < 0.02 && dims.fit === "contain", "画像は切り抜かず2:3で表示（" + (dims.bh / dims.bw).toFixed(2) + "）");
  const resText = await page.locator("main").innerText();
  ok(/あなたの回答では、/.test(resText) && /WHY THIS TYPE/.test(resText), "代表タイプの判定理由が表示される");
  ok(/場面によって違いが見られた/.test(resText) && !/切り替/.test(resText), "場面による違いが『今回の回答では…』の表現で出て、『切り替える』を使わない");
  ok(!/希少|レア|rarity/i.test(resText), "希少度（rarity）を表示していない");
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor); ok(bg === "rgb(10, 13, 28)", "背景色が本のダーク基調（" + bg + "）");
  await noOverflow(page, "結果"); await shot("05-result");
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await shot("06-result-bottom");

  // ===== 4. PERSONAL BOOK =====
  await page.click('[data-act="open-book"]');
  ok(await page.locator(".k-cat").count() === 5, "BOOKに5つの章が並ぶ");
  const titles = await page.locator(".k-cat .tt").allInnerTexts();
  ok(JSON.stringify(titles) === JSON.stringify(["あなたという人", "あなたの武器", "力が出るとき・出ないとき", "人との関わり方", "あなたの取扱説明書"]), "5章の名前が仕様どおり");
  await noOverflow(page, "BOOK目次"); await shot("07-book-home");
  const pagesPerCat = [];
  for (let c = 0; c < 5; c++) {
    await page.locator(".k-cat").nth(c).click();
    await page.waitForSelector(".k-pagelink");
    const n = await page.locator(".k-pagelink").count(); pagesPerCat.push(n);
    if (c === 0) { await shot("08-cat1"); }
    await page.locator(".k-pagelink").first().click();
    for (let i = 0; i < n; i++) {
      await page.waitForSelector(".k-first");
      const labels = await page.locator(".k-layer .lb").allInnerTexts();
      ok(["最初の一文", "詳細", "たとえば", "活かし方 ・ 試してみる"].every(l => labels.includes(l)), `第${c + 1}章 p${i + 1}：4層（最初の一文・詳細・たとえば・活かし方）がそろう`);
      await noOverflow(page, `第${c + 1}章 p${i + 1}`);
      if (c === 0 && i === 0) await shot("09-page");
      if (c === 1 && i === 0) { await page.click('[data-act="react"][data-v="partly"]'); await page.fill('[data-bind="react-note"]', "少し違う気がする"); await page.locator('[data-bind="react-note"]').blur(); await shot("10-react"); }
      if (c === 4 && i === n - 1) {
        await page.click('[data-act="try"]'); await page.fill("#memo", "月曜に試した"); await page.locator("#memo").blur(); await shot("11-try");
      }
      if (c === 0 && i === 2) await shot("12-type-page");
      if (i < n - 1) await page.click(".k-pager .primary");
    }
    await page.click(".k-pager .primary");          // 章の一覧へ
    await page.waitForSelector(".k-pagelink");
    await page.click(".k-pager .k-btn:first-child"); // 目次へ
  }
  ok(JSON.stringify(pagesPerCat.length) === "5" && pagesPerCat.every(n => n >= 1), "5章すべてを開いて最後まで読めた（ページ数 " + pagesPerCat.join(",") + "）");
  const bookText = await page.locator("main").innerText();
  ok(/読了/.test(bookText), "読んだ章に『読了』が付く");
  const st = await page.evaluate(() => window.__kakuPreview.store);
  const run1 = st.runs[0];
  ok(Object.keys(run1.book.reads).length === pagesPerCat.reduce((a, b) => a + b, 0), "読んだページが記録される（" + Object.keys(run1.book.reads).length + "）");
  ok(Object.values(run1.book.reactions)[0].v === "partly" && /少し違う/.test(Object.values(run1.book.reactions)[0].comment), "ページごとの『実感に合うか』が記録される");
  ok(run1.book.tries.chosen.length === 1 && run1.book.tries.memo === "月曜に試した", "取扱説明書の『試すこと』とメモが記録される");

  // ===== 5. 感想 =====
  await page.click('[data-act="open-feedback"]');
  await page.click('[data-act="lik"][data-k="understand"][data-v="4"]'); await page.click('[data-act="lik"][data-k="axisFit.vision"][data-v="5"]');
  await page.click('[data-act="lik"][data-k="bookCat.c2"][data-v="3"]'); await page.click('[data-act="seg"][data-v="ok"]');
  await page.fill("#fb-free", "スマホで読みやすかった"); await page.locator("#fb-free").blur();
  ok(/違和感を記録した設問/.test(await page.locator("main").innerText()) && /C04/.test(await page.locator("main").innerText()), "回答中に記録した違和感の設問（C04）が感想画面に出る");
  await noOverflow(page, "感想"); await shot("13-feedback");
  await page.click('[data-act="fb-save"]');
  const sv = (await page.evaluate(() => window.__kakuPreview.store)).runs[0].survey;
  ok(sv.understand === 4 && sv.axisFit.vision === 5 && sv.bookCat.c2 === 3 && sv.burden === "ok" && sv.free === "スマホで読みやすかった" && sv.savedAt, "感想（満足度・軸ごと・章ごと・自由記述）が保存される");

  // ===== 6. 保存の確認（リロード後も残る）・書き出し =====
  await page.reload();
  await page.click('[data-act="go"][data-view="history"]');
  ok(await page.locator(".k-card .k-between").count() === 1, "リロード後も、同意して保存した記録が残っている");
  const keys = await page.evaluate(() => Object.keys(localStorage)); ok(JSON.stringify(keys) === JSON.stringify(["kaku_core36_preview_store_v1"]), "保存キーは1つだけ: " + keys.join(","));
  await page.click('[data-act="go"][data-view="data"]'); await noOverflow(page, "データの扱い"); await shot("14-data");
  ok(/外部への送信[\s\S]*しません/.test(await page.locator("main").innerText()), "『データの扱い』に保存・書き出し・外部送信しない旨が明記されている");
  await page.click('[data-act="go"][data-view="export"]');
  const [dl] = await Promise.all([page.waitForEvent("download"), page.click('[data-act="export-save"]')]);
  const exp = JSON.parse(fs.readFileSync(await dl.path(), "utf8"));
  ok(exp.schema === "kaku-core36-export/1" && exp.app.scoring_version === D.VERSION && /^[0-9a-f]{8}$/.test(exp.app.definition_hash), "書き出しに scoring_version と definition_hash が入る（" + exp.app.scoring_version + " / " + exp.app.definition_hash + "）");
  const r0 = exp.runs[0];
  ok(Object.keys(r0.answers).length === 36 && Object.keys(r0.itemTimesMs).length === 36 && r0.discomfort.C04 && r0.survey.understand === 4 && r0.book_content_version && r0.summary.axes.vision, "書き出しに、36問の回答・設問ごとの時間・違和感・感想・BOOK版・軸の要約が入る");
  ok(r0.pilotCode === "E2E-TOM" && !/@|mail|birth|生年月日/i.test(JSON.stringify(Object.assign({}, exp, { notice: "" }))), "参加コード以外の個人情報（メール・生年月日など）を含まない");
  const analyze = require("../tools/analyze-pilot.js").analyze; const an = analyze(exp); ok(an.n_runs === 1 && an.n_complete === 1, "書き出しは analyze-pilot.js でそのまま読み込める");
  const dp = path.join(out, "export.json"); fs.copyFileSync(await dl.path(), dp);

  // ===== 7. 再回答 → 比較 =====
  await page.click('[data-act="go"][data-view="home"]');
  await page.click('[data-act="start"][data-kind="retest"]');
  const spec2 = Object.assign({}, spec, { vision: -2 });   // 構想力を逆向きに
  await answerAll(page, spec2);
  await page.waitForSelector(".k-typehero");
  ok(await page.locator('[data-act="compare"]').count() === 1, "再回答の結果に『前回の回答と比べる』が出る");
  await page.click('[data-act="compare"]');
  await page.waitForSelector(".k-cmp-legend");
  const cmpText = await page.locator("main").innerText();
  ok(/入れ替わった軸：構想力/.test(cmpText) && /はっきり違う/.test(cmpText), "比較に、構想力の向きの入れ替わりと『はっきり違う』が出る");
  ok(/代表タイプ/.test(cmpText) && await page.locator(".k-axis").count() === 6, "比較にCORE6（6軸）と代表タイプの変化が出る");
  await noOverflow(page, "比較"); await shot("15-compare");

  // ===== 8. 分類しない結果（すべて『どちらとも』）とQA画面 =====
  await page.click('[data-act="go"][data-view="home"]');
  await page.click('[data-act="start"][data-kind="first"]');
  await answerAll(page, {});
  await page.waitForSelector(".k-typehero.none");
  ok(/特定のタイプには分類しませんでした/.test(await page.locator("main").innerText()), "すべて『どちらとも』では分類せず、理由を説明する");
  await shot("16-no-type");
  await page.click('[data-act="open-book"]');
  await page.locator(".k-cat").nth(1).click(); await page.locator(".k-pagelink").first().click();
  ok(/武器として取り出せる傾向は限られていました/.test(await page.locator("main").innerText()), "寄りの無い回答でもBOOKが成立し、推測で補わない");
  await page.click('[data-act="go"][data-view="data"]'); await page.click('[data-act="go"][data-view="qa"]');
  const qaText = await page.locator("main").innerText();
  ok(/自動チェック（\d+ \/ \d+ 通過）/.test(qaText) && !/不一致/.test(qaText), "採点と判定の確認：自動チェックがすべて通過");
  ok(/僅差で2タイプ表示/.test(qaText) && /同点（固定順/.test(qaText) && /分類しない/.test(qaText), "判定サンプルに、僅差・同点・分類しないが出る");
  await noOverflow(page, "確認画面"); await shot("17-qa");

  // ===== 9. 削除 =====
  await page.click('[data-act="go"][data-view="data"]'); await page.click('[data-act="wipe"]');
  ok(await page.locator('[data-act="wipe-yes"]').count() === 1, "削除の前に、画面内で確認が出る");
  await page.click('[data-act="wipe-yes"]');
  ok((await page.evaluate(() => Object.keys(localStorage))).length === 0, "削除すると保存領域が空になる");

  // ===== 10. 保存に同意しない場合は、何も保存しない =====
  const ctx2 = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
  const p2 = await ctx2.newPage(); p2.on("request", r => { if (!/^(data:|blob:|about:)/.test(r.url())) requests.push("[ctx2] " + r.method() + " " + r.url()); });
  await p2.goto(base); await p2.click('[data-act="start"][data-kind="first"]'); await p2.check('[data-bind="c-understood"]'); await p2.click('[data-act="consent-ok"]');
  await answerAll(p2, spec);
  await p2.waitForSelector(".k-typehero");
  ok((await p2.evaluate(() => Object.keys(localStorage))).length === 0, "保存に同意しない場合、localStorageに何も書かない");
  ok(/保存を選んでいないため/.test(await p2.locator("main").innerText()), "保存しない旨が結果画面に表示される");
  await ctx2.close();

  // ===== 11. 通信 =====
  const external = requests.filter(r => !r.includes("localhost"));
  const docs = requests.filter(r => r.includes("localhost")).filter(r => !/GET http:\/\/localhost:\d+\/(favicon\.ico)?$/.test(r));
  ok(external.length === 0, "外部への通信が0件（" + external.length + "）");
  ok(docs.length === 0 || docs.every(r => /^GET /.test(r)), "ローカルサーバーへのリクエストはGETのみ・送信なし: " + JSON.stringify(docs.slice(0, 3)));
  ok(errors.length === 0, "ブラウザのエラーが0件" + (errors.length ? "：" + errors.join(" | ") : ""));

  await browser.close(); server.close();
  console.log(fails ? `\nFAILED: ${fails}` : "\nALL PASS");
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });

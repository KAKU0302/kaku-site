/**
 * core36/preview/app.js
 * KAKU CORE36 プレビュー（試作）— 同意 → 36問 → CORE6と12TYPE → PERSONAL BOOK（5章）→ 感想 → 再回答の比較。
 *
 * データの扱い（画面の「データの扱い」にも同じ内容を表示している）
 *  - この画面は、回答・結果・感想を【どこにも送信しない】。通信を行うコードを持たない（テストで確認）。
 *  - 保存は、利用者が同意したときだけ、このブラウザの localStorage（キー: kaku_core36_preview_store_v1）へ。
 *  - 書き出し（JSON）は、利用者が「書き出す」を押したときだけ。ファイル保存の確認が出る。保存できない環境では画面に表示してコピーできる。
 *  - 氏名・メール・生年月日は取らない。参加コードは任意の文字列。
 *  - 公開版（30問・16タイプ）、購入履歴、決済、メール、共有には触れない。
 */
(function () {
  "use strict";

  var E = window.KAKU_CORE36, D = E.DATA, BK = window.KAKU_BOOK, BD = window.KAKU_BOOK_DATA, CMP = window.KAKU_COMPARE;
  var TYPES = window.KAKU_PREVIEW_TYPES || {}, IMG = window.KAKU_PREVIEW_IMG || {}, BUILD = window.KAKU_PREVIEW_BUILD || { id: "dev" };
  var STORE_KEY = "kaku_core36_preview_store_v1", STORE_SCHEMA = "kaku-core36-preview-store/1", CONSENT_VERSION = "consent-1";
  var DWELL_CAP_MS = 120000;
  var app = document.getElementById("app");

  var ITEM = {}; D.ITEMS.forEach(function (it) { ITEM[it.id] = it; });
  var AX = {}; D.AXES.forEach(function (a) { AX[a.id] = a; });
  var DISC_REASONS = [
    ["unclear", "意味が分かりにくい"], ["neither", "どちらの文も当てはまらない"], ["both", "どちらの文も当てはまる"],
    ["scene", "場面によって答えが変わる"], ["wording", "言い回しに引っかかる"], ["other", "その他（メモに書く）"]
  ];

  // ================= 便利関数 =================
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function uid() { return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7); }
  function nowIso() { return new Date().toISOString(); }
  function fmtDate(iso) { return iso ? iso.slice(0, 16).replace("T", " ") : ""; }
  function typeName(id) { return TYPES[id] ? TYPES[id].nameJp : (id || ""); }
  function toast(msg) {
    var t = document.createElement("div"); t.className = "k-toast"; t.setAttribute("role", "status"); t.textContent = msg; document.body.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 2400);
  }
  function setPath(obj, path, val) { var p = path.split("."), o = obj; for (var i = 0; i < p.length - 1; i++) { if (!o[p[i]] || typeof o[p[i]] !== "object") o[p[i]] = {}; o = o[p[i]]; } o[p[p.length - 1]] = val; }
  function getPath(obj, path) { var p = path.split("."), o = obj; for (var i = 0; i < p.length; i++) { if (o == null) return undefined; o = o[p[i]]; } return o; }
  function level(absMean) { return absMean >= 1.5 ? "強く" : absMean >= 1.0 ? "はっきり" : "やや"; }

  // ================= 保存（同意したときだけ localStorage） =================
  var store = { schema: STORE_SCHEMA, consent: null, pilotCode: "", runs: [], draft: null };
  function persistOK() { return !!(store.consent && store.consent.save === true); }
  function loadStore() {
    try {
      var s = window.localStorage.getItem(STORE_KEY);
      if (s) { var o = JSON.parse(s); if (o && o.schema === STORE_SCHEMA && Array.isArray(o.runs)) store = o; }
    } catch (e) { /* 保存領域が使えない環境でも画面は動く */ }
  }
  function saveStore() {
    if (!persistOK()) return false;
    try { window.localStorage.setItem(STORE_KEY, JSON.stringify(store)); return true; } catch (e) { return false; }
  }
  function wipeStore() { try { window.localStorage.removeItem(STORE_KEY); } catch (e) { /* 何もしない */ } }

  // ================= 計算のキャッシュ =================
  var cacheRes = {}, cacheBook = {};
  function resultOf(run) { if (!cacheRes[run.runId]) cacheRes[run.runId] = E.score(run.answers, { durationSec: run.durationSec }); return cacheRes[run.runId]; }
  function bookOf(run) { if (!cacheBook[run.runId]) cacheBook[run.runId] = BK.compose(resultOf(run), { typeName: typeName }); return cacheBook[run.runId]; }
  function runById(id) { for (var i = 0; i < store.runs.length; i++) if (store.runs[i].runId === id) return store.runs[i]; return null; }
  function latestRun() { return store.runs.length ? store.runs[store.runs.length - 1] : null; }

  // ================= 画面遷移 =================
  var ui = { view: "home", p: {} };
  var q = null;   // 回答中のセッション
  function go(view, p) { ui.view = view; ui.p = p || {}; render(); window.scrollTo(0, 0); }
  function rerender() { var y = window.scrollY; render(); window.scrollTo(0, y); }

  function topbar() {
    if (ui.view === "q") return '<header class="k-top"><span class="k-logo">KAKU<small>CORE36</small></span><nav><button type="button" data-act="pause">中断して戻る</button></nav></header>';
    return '<header class="k-top"><span class="k-logo">KAKU<small>CORE36 試作</small></span><nav aria-label="メニュー">' +
      '<button type="button" data-act="go" data-view="home">ホーム</button>' +
      '<button type="button" data-act="go" data-view="history">記録</button>' +
      '<button type="button" data-act="go" data-view="data">データ</button></nav></header>';
  }

  function render() {
    var fn = VIEWS[ui.view] || VIEWS.home;
    app.innerHTML = topbar() + '<main id="main">' + fn(ui.p) + "</main>";
    Array.prototype.forEach.call(app.querySelectorAll("img[data-t]"), function (im) { im.src = IMG[im.getAttribute("data-t")] || ""; });
  }

  // ================= 部品 =================
  function typeMini(id, label) {
    var T = TYPES[id]; if (!T) return "";
    return '<div class="k-typemini"><img class="k-timg" data-t="' + esc(id) + '" alt="' + esc(T.nameEn + " " + T.nameJp) + '" style="border:3px solid ' + esc(T.color) + '" />' +
      "<div>" + (label ? '<div class="k-tag dim" style="margin-bottom:6px">' + esc(label) + "</div>" : "") +
      '<div class="en">' + esc(T.nameEn) + '</div><div class="jp">' + esc(T.nameJp) + '</div><div class="cc">' + esc(T.catchcopy) + "</div></div></div>";
  }
  function coverStyle(res) {
    var t = res.type;
    if (t && t.primary && TYPES[t.primary]) return "background:linear-gradient(160deg," + TYPES[t.primary].color + " 0%,#14161f 78%)";
    return "background:linear-gradient(160deg,#1b2148 0%,#14161f 78%)";
  }
  function readingText(info) {
    var k = info.reading.kind;
    if (k === "a" || k === "b") return info.reading.label + "（" + level(Math.abs(info.mean)) + "）";
    if (k === "balanced") return "どちらにも寄らない";
    return "場面によって違いが見られた";
  }
  function sceneLine(ax, info) {
    var w = info.sceneMeans.work, l = info.sceneMeans.life;
    return "仕事・学び：" + (w > 0 ? ax.poleA : ax.poleB) + "寄り　／　日常：" + (l > 0 ? ax.poleA : ax.poleB) + "寄り";
  }
  function axisRow(ax, info, opts) {
    opts = opts || {};
    if (info.status !== "ok") return '<div class="k-axis"><b>' + esc(ax.nameJp) + "</b>：回答が足りないため算出できません</div>";
    var k = info.reading.kind, cls = k === "scene_diff" ? "rd scene" : k === "balanced" ? "rd dim" : "rd";
    return '<div class="k-axis"><div class="hd"><span class="nm">' + esc(ax.nameJp) + "<small>" + esc(ax.nameEn) + '</small></span><span class="' + cls + '">' + esc(readingText(info)) + "</span></div>" +
      '<div class="k-bar' + (k === "balanced" ? " dim" : "") + '"><i style="left:' + info.position.toFixed(1) + '%"></i></div>' +
      '<div class="k-poles"><span>← ' + esc(ax.poleB) + "</span><span>" + esc(ax.poleA) + " →</span></div>" +
      (k === "scene_diff" ? '<div class="sc">' + esc(sceneLine(ax, info)) + "<br>各場面3問の回答にもとづく、今回の回答上の違いです。性質とは断定せず、見直しのきっかけとして見てください。</div>" : "") +
      (opts.line ? '<div class="ln">' + esc(opts.line) + "</div>" : "") + "</div>";
  }
  function likert(key, label, value, ends) {
    var h = '<div class="k-lik"><div class="q">' + esc(label) + '</div><div class="opts" role="group" aria-label="' + esc(label) + '">';
    for (var v = 1; v <= 5; v++) h += '<button type="button" data-act="lik" data-k="' + esc(key) + '" data-v="' + v + '" class="' + (value === v ? "on" : "") + '" aria-pressed="' + (value === v) + '">' + v + "</button>";
    return h + '</div><div class="ends"><span>' + esc(ends ? ends[0] : "当てはまらない") + "</span><span>" + esc(ends ? ends[1] : "とても当てはまる") + "</span></div></div>";
  }

  // ================= 画面 =================
  var VIEWS = {};

  // ---------- ホーム ----------
  VIEWS.home = function () {
    var runs = store.runs, last = latestRun();
    var dn = store.draft && store.draft.answers ? Object.keys(store.draft.answers).length : 0;
    return '<section class="k-hero"><div class="k-mark" aria-hidden="true">核</div><h1>KAKU ～核～</h1>' +
      "<p>CORE36 プレビュー（試作）<br>36問に答えて、6つの傾向と、いちばん近い代表タイプ、あなたのPERSONAL BOOKを確かめます。</p></section>" +
      '<div class="k-steps" aria-hidden="true"><div><b>1</b>同意</div><div><b>2</b>36問</div><div><b>3</b>結果</div><div><b>4</b>BOOK</div><div><b>5</b>感想</div></div>' +
      '<div class="k-note"><b>試作版です。</b>実際の利用者による診断精度の検証は、まだ完了していません。設問・判定・BOOKの文章はすべて暫定で、結果は「今回の回答から読み取った仮の読み」です。能力の高さや優劣を示すものではありません。</div>' +
      '<div class="k-card"><label for="pc" style="font-weight:700;font-size:14px">参加コード（任意）</label>' +
      '<p class="k-soft" style="margin:4px 0 8px">再回答を結びつけるための目印です。氏名やメールは入力しないでください。</p>' +
      '<input class="k-input" id="pc" type="text" maxlength="24" placeholder="例：TOM" autocomplete="off" data-bind="pc" value="' + esc(store.pilotCode) + '" />' +
      '<div class="k-stack" style="margin-top:16px">' +
      '<button class="k-btn primary block" type="button" data-act="start" data-kind="first">回答を始める（36問・約8分）</button>' +
      (dn ? '<button class="k-btn block" type="button" data-act="resume">途中から続ける（' + dn + " / 36）</button>" : "") +
      (last ? '<button class="k-btn block" type="button" data-act="start" data-kind="retest">もう一度答えて、前回と比べる</button>' : "") +
      (last ? '<button class="k-btn block" type="button" data-act="open-result" data-id="' + esc(last.runId) + '">最新の結果とBOOKを見る</button>' : "") +
      "</div></div>" +
      '<p class="k-soft" style="text-align:center;margin-top:18px">保存済みの記録 ' + runs.length + ' 件　・　<button class="k-btn ghost" type="button" data-act="go" data-view="data" style="min-height:40px;padding:6px 10px">データの扱い</button></p>' +
      '<p class="k-soft" style="text-align:center;margin-top:6px;font-size:11px">scoring_version ' + esc(D.VERSION) + "　BOOK " + esc(BK.CONTENT_VERSION) + "　build " + esc(BUILD.id) + "</p>";
  };

  // ---------- 同意 ----------
  VIEWS.consent = function (p) {
    var c = store.consent || {};
    return '<p class="k-chapter">BEFORE YOU START</p><h1 class="k-title">はじめる前に</h1>' +
      '<p class="k-sub">短い説明です。回答の前に、必ずお読みください。</p>' +
      '<div class="k-card"><ol class="k-list" style="padding-left:1.4em;color:var(--text)">' +
      "<li><b>これは試作です。</b>診断精度の検証は、まだ完了していません。結果は仮の読みです。</li>" +
      "<li><b>回答は外部に送信しません。</b>回答・結果・感想は、この画面の中だけで処理します。KAKUのサーバーにも、公開版のサイトにも、第三者にも送りません。</li>" +
      "<li><b>保存するかどうかは、あなたが選べます。</b>保存を選ぶと、このブラウザの保存領域にだけ残ります。選ばないと、画面を閉じたときに消えます。</li>" +
      "<li><b>書き出しは、あなたが押したときだけ。</b>「データ」の画面から、JSONファイルとして保存できます。</li>" +
      "<li>氏名・メール・生年月日は入力不要です。</li></ol></div>" +
      '<label class="k-check"><input type="checkbox" data-bind="c-understood"' + (p.understood || c.understood ? " checked" : "") + ' /><span>上の内容を理解しました（必須）</span></label>' +
      '<label class="k-check"><input type="checkbox" data-bind="c-save"' + (p.save != null ? (p.save ? " checked" : "") : (c.save ? " checked" : "")) + ' /><span>回答・結果・感想を、このブラウザに保存する（任意）<br><span class="k-soft">保存しない場合、画面を閉じると消えます。再回答の比較は、保存したときだけ次回以降も使えます。</span></span></label>' +
      '<div class="k-stack" style="margin-top:18px"><button class="k-btn primary block" type="button" data-act="consent-ok"' + (p.understood || c.understood ? "" : " disabled") + ">同意して進む</button>" +
      '<button class="k-btn ghost block" type="button" data-act="go" data-view="home">戻る</button></div>';
  };

  // ---------- 質問 ----------
  VIEWS.q = function () {
    var i = q.index, it = D.ITEMS[i], cur = q.answers[it.id], d = q.disc[it.id];
    if (!q.enteredAt) q.enteredAt = Date.now();
    var scale = D.CHOICES.map(function (c) {
      return '<button type="button" data-act="ans" data-v="' + c.value + '" class="' + (cur === c.value ? "on" : "") + '" aria-pressed="' + (cur === c.value) + '"><i></i><span>' + esc(c.label) + "</span></button>";
    }).join("");
    var flagged = d && (d.reasons.length || d.note);
    var panel = "";
    if (q.discOpen) {
      panel = '<div class="k-card plain k-disc"><p class="k-soft" style="margin-bottom:6px">この設問で引っかかった点を、分かる範囲で教えてください（任意）。</p>' +
        DISC_REASONS.map(function (r) {
          return '<label class="k-check" style="padding:6px 0"><input type="checkbox" data-bind="disc-reason" data-r="' + r[0] + '"' + (d && d.reasons.indexOf(r[0]) >= 0 ? " checked" : "") + " /><span>" + esc(r[1]) + "</span></label>";
        }).join("") +
        '<textarea class="k-textarea" data-bind="disc-note" maxlength="300" placeholder="メモ（任意・300字まで）" style="min-height:64px;margin-top:6px">' + esc(d ? d.note : "") + "</textarea></div>";
    }
    return '<div class="k-q-head"><span class="k-tag">' + esc(D.SCENES[it.scene]) + 'の場面で</span><span class="k-soft k-mono">' + (i + 1) + " / 36</span></div>" +
      '<div class="k-prog" role="progressbar" aria-valuemin="0" aria-valuemax="36" aria-valuenow="' + i + '"><i style="width:' + (i / 36 * 100) + '%"></i></div>' +
      (i === 0 ? '<div class="k-note info">最初の18問は「仕事・学び」、後半の18問は「日常」の場面についての質問です。正解や良し悪しはありません。迷ったら、近いほうを選んでください。</div>' : "") +
      (i === 18 ? '<div class="k-note info">ここからは「日常」の場面についての質問です。</div>' : "") +
      '<p class="k-q-ask">どちらが、自分に近いですか？</p>' +
      '<div class="k-pair"><div class="k-stmt"><b>左</b>' + esc(it.left) + '</div><div class="k-stmt right"><b>右</b>' + esc(it.right) + "</div></div>" +
      '<div class="k-scale" role="group" aria-label="5段階で選ぶ">' + scale + "</div>" +
      '<div class="k-qnav"><button class="k-btn ghost" type="button" data-act="qback"' + (i === 0 ? " disabled" : "") + '>← 前へ</button>' +
      '<button class="k-disc-btn' + (flagged ? " on" : "") + '" type="button" data-act="disc-toggle" aria-expanded="' + !!q.discOpen + '">' + (flagged ? "違和感を記録済み" : "この設問に違和感がある") + "</button>" +
      '<button class="k-btn ghost" type="button" data-act="qnext"' + (cur ? "" : " disabled") + ">" + (i === 35 ? "終える" : "次へ →") + "</button></div>" + panel +
      '<p class="k-soft" style="font-size:11.5px;margin-top:14px">キーボードの 1〜5 でも選べます（1＝左に近い、5＝右に近い）。選ぶと自動で次へ進みます。</p>';
  };

  function qLeave() {
    if (!q || !q.enteredAt) return;
    var id = D.ITEMS[q.index].id, ms = Math.min(Date.now() - q.enteredAt, DWELL_CAP_MS);
    q.times[id] = (q.times[id] || 0) + ms; q.activeMs += ms; q.enteredAt = null;
  }
  function saveDraft() {
    store.draft = { pilotCode: q.pilotCode, kind: q.kind, parentRunId: q.parentRunId, index: q.index, answers: q.answers, disc: q.disc, times: q.times, activeMs: q.activeMs, startedAt: q.startedAt };
    saveStore();
  }
  function startSession(kind) {
    var par = kind === "retest" && latestRun() ? latestRun().runId : null;
    q = { kind: par ? "retest" : "first", parentRunId: par, index: 0, answers: {}, disc: {}, times: {}, activeMs: 0, startedAt: nowIso(), enteredAt: null, pilotCode: store.pilotCode, discOpen: false };
    store.draft = null; saveStore(); go("q");
  }
  function qAnswer(v) {
    var it = D.ITEMS[q.index], i = q.index;
    qLeave(); q.answers[it.id] = v; saveDraft();
    Array.prototype.forEach.call(app.querySelectorAll(".k-scale button"), function (b) { var on = Number(b.getAttribute("data-v")) === v; b.className = on ? "on" : ""; b.setAttribute("aria-pressed", on); });
    var nx = app.querySelector('[data-act="qnext"]'); if (nx) nx.disabled = false;
    if (!q.discOpen) setTimeout(function () { if (q && ui.view === "q" && q.index === i && !q.discOpen) qNext(); }, 240);
  }
  function qNext() {
    var it = D.ITEMS[q.index]; if (!q.answers[it.id]) return;
    qLeave();
    if (q.index >= 35) return finishSession();
    q.index++; q.discOpen = false; saveDraft(); render(); window.scrollTo(0, 0);
  }
  function qBack() { qLeave(); q.index = Math.max(0, q.index - 1); q.discOpen = false; saveDraft(); render(); window.scrollTo(0, 0); }

  function finishSession() {
    var durationSec = Math.round(q.activeMs / 1000);
    var res = E.score(q.answers, { durationSec: durationSec }), t = res.type, axes = {};
    D.AXES.forEach(function (a) { axes[a.id] = { position: res.axes[a.id].position, mean: res.axes[a.id].mean, kind: res.axes[a.id].reading.kind }; });
    var disc = {}; Object.keys(q.disc).forEach(function (id) { var d = q.disc[id]; if (d.reasons.length || d.note) disc[id] = { reasons: d.reasons.slice(), note: d.note }; });
    var run = {
      runId: uid(), pilotCode: q.pilotCode, sessionKind: q.kind, parentRunId: q.parentRunId,
      startedAt: q.startedAt, finishedAt: nowIso(), durationSec: durationSec,
      scoring_version: res.scoring_version, definition_hash: E.definitionHash(), book_content_version: BK.CONTENT_VERSION, build: BUILD.id,
      answers: res.answers, itemTimesMs: q.times, discomfort: disc, unclearItems: Object.keys(disc).sort(),
      flags: res.flags,
      summary: { primary: t.primary, second: t.second, showSecond: !!t.showSecond, typeStatus: t.status, fit: t.fit || null, primaryName: t.primary ? typeName(t.primary) : null,
                 margin: t.margin == null || t.margin === Infinity ? null : Math.round(t.margin * 1000) / 1000, leanCount: res.leanCount, axes: axes },
      survey: null, book: { reads: {}, reactions: {}, tries: { chosen: [], memo: "" } }, savedLocally: persistOK()
    };
    store.runs.push(run); store.draft = null; cacheRes[run.runId] = res; q = null; saveStore();
    go("result", { id: run.runId });
  }

  // ---------- 結果 ----------
  function fitTable(expl) {
    return '<div class="k-scroll-x"><table class="k-tbl k-fit"><thead><tr><th>軸</th><th>タイプの特徴</th><th>あなたの回答</th><th></th></tr></thead><tbody>' +
      expl.map(function (e) {
        var mark = e.match === "match" ? '<span class="m-match">◎ 合う</span>' : e.match === "neutral" ? '<span class="m-neutral">○ 中立</span>' : '<span class="m-opposite">△ ずれ</span>';
        return "<tr><td>" + esc(e.axisNameJp) + (e.role === "support" ? '<br><span class="k-soft" style="font-size:10.5px">補助</span>' : "") + "</td><td>" + esc(e.expectedLabel) + "寄り</td><td>" + esc(e.readingLabel) + "</td><td>" + mark + "</td></tr>";
      }).join("") + "</tbody></table></div>";
  }
  VIEWS.result = function (p) {
    var run = runById(p.id); if (!run) return '<p>記録が見つかりません。</p><button class="k-btn" data-act="go" data-view="home">ホームへ</button>';
    var r = resultOf(run), t = r.type, h = "";
    var status = t.status;
    h += '<p class="k-chapter">YOUR RESULT</p><h1 class="k-title">あなたの結果</h1><p class="k-sub">今回の回答から読み取った傾向です。能力の高さや優劣を示すものではありません。</p>';

    if (t.primary) {
      var T = TYPES[t.primary];
      h += '<div class="k-typehero" style="' + coverStyle(r) + '"><div class="lbl">' + (t.fit === "weak" ? "いちばん近い代表タイプ（近さは弱め）" : "いちばん近い代表タイプ") + "</div>" +
        '<img class="k-timg" data-t="' + esc(t.primary) + '" alt="' + esc(T.nameEn + " " + T.nameJp) + '" />' +
        '<div class="en">' + esc(T.nameEn) + '</div><div class="jp">' + esc(T.nameJp) + '</div><div class="cc">' + esc(T.catchcopy) + '</div><div class="rule"></div></div>';
      h += '<div class="k-card"><div class="k-chapter" style="margin-bottom:8px">WHY THIS TYPE</div><p>' + esc(E.describeReason(r, T.nameJp)) + "</p>" +
        (t.fit === "weak" ? '<p class="k-soft">近さは弱めです。タイプよりも、下の6つの軸の読みを中心に見てください。</p>' : "") +
        '<details class="k-det"><summary>判定の根拠を表で見る</summary><div>' + fitTable(r.explanation.primary) +
        '<p style="margin-top:8px">「決める軸」2つと「補助の軸」1つが、タイプごとに決まっています。◎は回答がその側に寄っている、○は中立、△は反対側に寄っている、という意味です。</p></div></details></div>';
      if ((t.showSecond || t.fit === "weak") && t.second) {
        h += '<div class="k-card"><p class="k-soft" style="margin-bottom:10px">' + (t.showSecond ? "1位と2位の近さの差が小さい（僅差）ため、2番目に近いタイプも補足として表示します。回答が少し違えば、こちらが代表になることもあります。" : "近さが弱めのため、次に近いタイプも表示します。") + "</p>" +
          typeMini(t.second, t.showSecond ? "2番目に近い（僅差）" : "次に近いタイプ") +
          (r.explanation.second ? '<details class="k-det"><summary>このタイプの根拠を表で見る</summary><div>' + fitTable(r.explanation.second) + "</div></details>" : "") + "</div>";
      }
    } else {
      h += '<div class="k-typehero none"><div class="lbl">いちばん近い代表タイプ</div><div class="mark" aria-hidden="true">核</div><div class="jp" style="font-size:20px">特定のタイプには分類しませんでした</div><div class="cc">無理に分類せず、6つの軸の読みを中心にお見せします</div><div class="rule"></div></div>';
      h += '<div class="k-card"><div class="k-chapter" style="margin-bottom:8px">WHY NO TYPE</div><p>' +
        (t.noBasisReason && t.noBasisReason.indexOf("tie") === 0 ? "複数のタイプが同じ近さで並んだため、1つに決められませんでした。" : "どの軸も特定の側へはっきり寄らなかったため、特定のタイプに近いとは言えませんでした。") +
        "</p><p class=\"k-soft\">これは「結果が出なかった」という意味ではありません。迷った設問が多かった場合や、場面によって使い分けている場合にも起こります。6つの軸の読みは、下にそのまま表示しています。</p></div>";
    }
    h += '<div class="k-note info">KAKUの自己理解の中心は、タイプではなく<b>6つの軸の読み</b>です。代表タイプは「いちばん近い入口」で、回答が少し違えば入れ替わることがあります。</div>';
    if (r.flags.fast) h += '<div class="k-note">回答時間がとても短かったため、設問が十分に読み込まれていない可能性があります。</div>';
    if (r.flags.straightLine) h += '<div class="k-note">同じ選択肢が多く続いていました。結果は参考程度に見てください。</div>';

    h += '<h2 class="k-h2">6つの軸（CORE6）</h2><p class="k-soft">バーの中央が中立です。どちらの側にも、優れている・劣っているという意味はありません。</p>';
    h += D.AXES.map(function (a) { return axisRow(a, r.axes[a.id]); }).join("");

    var rank = (t.ranking || []).slice(0, 5).map(function (id) { return typeName(id) + " " + (t.distances[id] != null ? t.distances[id].toFixed(1) : ""); }).join("\n");
    h += '<details class="k-det"><summary>判定の詳細（検証用）</summary><div><div class="k-pre">' + esc(
      "scoring_version: " + r.scoring_version + "\ndefinition_hash: " + E.definitionHash() + "\nstatus: " + r.status + " / type.status: " + t.status +
      (t.noBasisReason ? " (" + t.noBasisReason + ")" : "") + "\n寄りのある軸の数: " + r.leanCount + "\n回答時間: " + run.durationSec + "秒" +
      "\n近さの順位（距離が小さいほど近い）:\n" + rank + "\n1位と2位の差: " + (t.margin == null || t.margin === Infinity ? "-" : t.margin.toFixed(2)) + "（3未満なら僅差として2番目も表示）" +
      "\n同点: " + ((t.tieGroup || []).length > 1 ? t.tieGroup.map(typeName).join("・") + "（" + (t.tieResolvedBy === "core_distance" ? "決める軸だけの距離で決定" : "固定順で決定") + "）" : "なし") +
      "\n軸の平均 -2〜+2（A極寄りが＋）/ 場面別:\n" + D.AXES.map(function (a) { var x = r.axes[a.id]; return "  " + a.id + ": " + x.mean.toFixed(2) + " / 仕事 " + (x.sceneMeans.work == null ? "-" : x.sceneMeans.work.toFixed(2)) + " 日常 " + (x.sceneMeans.life == null ? "-" : x.sceneMeans.life.toFixed(2)); }).join("\n")) + "</div></div></details>";

    h += '<div class="k-stack" style="margin-top:22px">';
    if (run.parentRunId && runById(run.parentRunId)) h += '<button class="k-btn primary block" type="button" data-act="compare" data-a="' + esc(run.parentRunId) + '" data-b="' + esc(run.runId) + '">前回の回答と比べる</button>';
    h += '<button class="k-btn cta block" type="button" data-act="open-book" data-id="' + esc(run.runId) + '">PERSONAL BOOK を開く</button>' +
      '<button class="k-btn block" type="button" data-act="open-feedback" data-id="' + esc(run.runId) + '">感想を残す</button>' +
      '<button class="k-btn ghost block" type="button" data-act="start" data-kind="retest">もう一度答えて、比べる</button></div>';
    if (!persistOK()) h += '<div class="k-note info" style="margin-top:16px">保存を選んでいないため、この記録は画面を閉じると消えます。残したい場合は「データ」から書き出してください。</div>';
    return h;
  };

  // ---------- PERSONAL BOOK ----------
  function bookRun(p) { return runById(p.id); }
  function readCount(run, cat) { return cat.pages.filter(function (pg) { return run.book.reads[pg.id]; }).length; }

  VIEWS.book = function (p) {
    var run = bookRun(p); if (!run) return VIEWS.result(p);
    var r = resultOf(run), b = bookOf(run), t = r.type, T = t.primary ? TYPES[t.primary] : null;
    var total = 0, read = 0; b.cats.forEach(function (c) { total += c.pages.length; read += readCount(run, c); });
    var h = '<div class="k-cover" style="' + coverStyle(r) + '"><div class="lbl">PERSONAL BOOK ・ 試作</div>' +
      (T ? '<img class="k-timg" data-t="' + esc(t.primary) + '" alt="' + esc(T.nameEn + " " + T.nameJp) + '" />' : '<div style="font-family:var(--serif);font-size:56px;color:var(--gold);line-height:1;margin:0 0 14px;text-shadow:0 0 24px rgba(217,179,108,.4)" aria-hidden="true">核</div>') +
      '<div class="ttl">あなたの<br>PERSONAL BOOK</div><div class="sub">' + (T ? esc(T.nameEn + "　" + T.nameJp) + "　・　" : "") + "6つの軸の回答から</div><div class=\"rule\"></div></div>";
    h += '<div class="k-note info">この本は、CORE36の<b>回答（6つの軸）</b>から読み取れることだけで作っています。大切にしていること（VALUE）や日々の記録（STATE）が必要な内容は、推測で補わず、書かないようにしています。タイプの定型文も使っていません。</div>';
    h += '<p class="k-soft" style="text-align:right">読んだページ ' + read + " / " + total + "</p>";
    h += b.cats.map(function (c) {
      var n = readCount(run, c), done = n === c.pages.length;
      return '<button type="button" class="k-cat" data-act="open-cat" data-id="' + esc(run.runId) + '" data-cat="' + c.id + '"><span class="no">' + c.no + '</span><span><div class="tt">' + esc(c.title) + '</div><div class="ss">' + esc(c.sub) + '</div></span><span class="pg' + (done ? " done" : "") + '">' + (done ? "読了" : n + " / " + c.pages.length) + "</span></button>";
    }).join("");
    h += '<div class="k-stack" style="margin-top:22px"><button class="k-btn primary block" type="button" data-act="open-feedback" data-id="' + esc(run.runId) + '">感想を残す（最後に）</button>' +
      '<button class="k-btn block" type="button" data-act="open-result" data-id="' + esc(run.runId) + '">結果（6軸とタイプ）に戻る</button></div>';
    return h;
  };

  function catOf(run, id) { var b = bookOf(run); for (var i = 0; i < b.cats.length; i++) if (b.cats[i].id === id) return b.cats[i]; return null; }

  VIEWS.cat = function (p) {
    var run = bookRun(p), c = run && catOf(run, p.cat); if (!c) return VIEWS.home();
    var h = '<p class="k-chapter">CHAPTER ' + c.no + '</p><h1 class="k-title">' + esc(c.title) + '</h1><p class="k-sub">' + esc(c.sub) + "</p>" +
      '<div class="k-card plain" style="margin-top:14px"><p>' + esc(c.intro) + "</p></div>";
    if (c.id === "c3") h += '<div class="k-note"><b>この章はKAKU独自の仮説です。</b>「そうなる」と決まっているわけではなく、読んで実感に合うかどうかを確かめるための内容です。</div>';
    c.locked.forEach(function (l) { h += '<div class="k-locked"><b>この試作ではまだ読めないこと</b>' + esc(l) + "</div>"; });
    h += c.pages.map(function (pg, i) {
      return '<button type="button" class="k-pagelink" data-act="open-page" data-id="' + esc(run.runId) + '" data-cat="' + c.id + '" data-i="' + i + '"><span class="n">' + (i + 1) + '</span><span><div class="t">' + esc(pg.title) + '</div><div class="h">' + esc(pg.h) + '</div></span><span class="rd">' + (run.book.reads[pg.id] ? "✓" : "") + "</span></button>";
    }).join("");
    var idx = BD.CATEGORIES.map(function (x) { return x.id; }).indexOf(c.id), nx = BD.CATEGORIES[idx + 1];
    h += '<div class="k-pager"><button class="k-btn" type="button" data-act="open-book" data-id="' + esc(run.runId) + '">目次へ</button>' +
      (nx ? '<button class="k-btn primary" type="button" data-act="open-cat" data-id="' + esc(run.runId) + '" data-cat="' + nx.id + '">第' + nx.no + "章へ</button>" : '<button class="k-btn primary" type="button" data-act="open-feedback" data-id="' + esc(run.runId) + '">感想を残す</button>') + "</div>";
    return h;
  };

  var REACT = [["fit", "しっくりくる"], ["partly", "少し違う"], ["no", "違う"], ["unsure", "判断できない"]];

  VIEWS.page = function (p) {
    var run = bookRun(p), c = run && catOf(run, p.cat); if (!c || !c.pages[p.i]) return VIEWS.home();
    var pg = c.pages[p.i], r = resultOf(run);
    if (!run.book.reads[pg.id]) { run.book.reads[pg.id] = nowIso(); saveStore(); }
    var h = '<p class="k-chapter">CHAPTER ' + c.no + ' ・ ' + esc(c.title) + '</p>' +
      '<div class="k-row" style="margin-bottom:8px">' + (pg.hypothesis ? '<span class="k-tag gold">KAKU仮説</span>' : "") +
      pg.basis.map(function (b) { return '<span class="k-tag">' + esc(b.nameJp + "：" + (b.kind === "a" ? b.poleA + "寄り" : b.kind === "b" ? b.poleB + "寄り" : b.kind === "scene_diff" ? "場面による違い" : "寄らない")) + "</span>"; }).join("") + "</div>" +
      '<h1 class="k-title" style="font-size:20px">' + esc(pg.title) + "</h1>";
    h += '<div class="k-layer"><div class="lb">最初の一文</div><div class="k-first">' + esc(pg.h) + "</div></div>";

    if (pg.kindOfPage === "map") {
      h += '<div class="k-layer"><div class="lb">6つの軸</div>' + pg.axes.map(function (a) { return axisRow(AX[a.axis], r.axes[a.axis], { line: a.line }); }).join("") + "</div>";
    }
    h += '<div class="k-layer"><div class="lb">詳細</div><p>' + esc(pg.d) + "</p></div>";
    if (pg.id === "c1-type" && pg.typeId) {
      h += '<div class="k-card plain">' + typeMini(pg.typeId, "いちばん近い代表タイプ") + (pg.secondId ? '<div style="height:12px"></div>' + typeMini(pg.secondId, "次に近いタイプ") : "") +
        '<button class="k-btn block" type="button" data-act="open-result" data-id="' + esc(run.runId) + '" style="margin-top:14px">判定の理由を見る</button></div>';
    }
    h += '<div class="k-layer"><div class="lb">たとえば</div><p>' + esc(pg.e) + "</p></div>";
    h += '<div class="k-layer try"><div class="lb">活かし方 ・ 試してみる</div><p>' + esc(pg.t) + "</p></div>";

    if (pg.kindOfPage === "try") {
      var tr = run.book.tries;
      h += '<div class="k-layer"><div class="lb">今週試すこと（選んでください）</div>' + pg.tries.map(function (x) {
        var on = tr.chosen.indexOf(x.id) >= 0;
        return '<button type="button" class="k-try' + (on ? " on" : "") + '" data-act="try" data-tid="' + esc(x.id) + '" aria-pressed="' + on + '"><span class="bx"></span><span>' + esc(x.text) + "</span></button>";
      }).join("") + '<label for="memo" style="display:block;margin:14px 0 6px;font-size:13px;font-weight:700">試してみて気づいたこと（メモ）</label>' +
        '<textarea class="k-textarea" id="memo" data-bind="memo" maxlength="600" placeholder="合わなかった点も、大切な情報です。">' + esc(tr.memo) + "</textarea>" +
        '<p class="k-soft" style="margin-top:4px">' + (persistOK() ? "このメモは、この端末のブラウザにだけ保存されます。" : "保存を選んでいないため、画面を閉じると消えます。") + "</p></div>";
    }

    h += '<details class="k-det"><summary>この内容の根拠</summary><div>';
    if (pg.basis.length) {
      h += pg.basis.map(function (b) {
        return "<p><b>" + esc(b.nameJp) + "（" + esc(b.nameEn) + "）</b>：" + esc(b.label) + "　位置 " + b.position.toFixed(1) + " / 100<br>根拠になった設問：" +
          b.items.map(function (id) { return '<span class="it">' + id + "</span>"; }).join("") + "</p>";
      }).join("");
    } else h += "<p>特定の軸に基づかない、共通の案内文です。</p>";
    h += '<p style="margin-top:8px">この文章は、6つの軸の回答の読み（どちらの側に、どのくらい寄ったか）から選んでいます。12TYPEの定型文は使っていません。' +
      (pg.hypothesis ? "「力が出る／噛み合いにくい」は、KAKUの仮説です。" : "") + '<br><span class="k-mono" style="font-size:10.5px">' + esc(pg.id + " ・ " + BK.CONTENT_VERSION) + "</span></p></div></details>";

    var rx = run.book.reactions[pg.id] || {};
    h += '<div class="k-react"><div class="q">この内容は、実感に合っていますか？</div><div class="opts" role="group" aria-label="実感に合っているか">' +
      REACT.map(function (o) { return '<button type="button" class="k-chip-btn' + (rx.v === o[0] ? " on" : "") + '" data-act="react" data-pid="' + esc(pg.id) + '" data-v="' + o[0] + '" aria-pressed="' + (rx.v === o[0]) + '">' + o[1] + "</button>"; }).join("") + "</div>" +
      (rx.v ? '<textarea class="k-textarea" data-bind="react-note" data-pid="' + esc(pg.id) + '" maxlength="400" placeholder="' + (rx.v === "fit" ? "感じたこと（任意）" : "どこが、どう違いましたか？（任意）") + '" style="margin-top:10px">' + esc(rx.comment || "") + "</textarea>" : "") + "</div>";

    h += '<div class="k-dots" aria-hidden="true">' + c.pages.map(function (x, i) { return '<i class="' + (i === p.i ? "on" : run.book.reads[x.id] ? "read" : "") + '"></i>'; }).join("") + "</div>";
    var last = p.i >= c.pages.length - 1;
    h += '<div class="k-pager">' +
      (p.i > 0 ? '<button class="k-btn" type="button" data-act="open-page" data-id="' + esc(run.runId) + '" data-cat="' + c.id + '" data-i="' + (p.i - 1) + '">← 前のページ</button>' : '<button class="k-btn" type="button" data-act="open-cat" data-id="' + esc(run.runId) + '" data-cat="' + c.id + '">章の一覧へ</button>') +
      (!last ? '<button class="k-btn primary" type="button" data-act="open-page" data-id="' + esc(run.runId) + '" data-cat="' + c.id + '" data-i="' + (p.i + 1) + '">次のページ →</button>' : '<button class="k-btn primary" type="button" data-act="open-cat" data-id="' + esc(run.runId) + '" data-cat="' + c.id + '">章の一覧へ</button>') + "</div>";
    return h;
  };

  // ---------- 感想 ----------
  VIEWS.feedback = function (p) {
    var run = runById(p.id); if (!run) return VIEWS.home();
    var s = run.survey || {}, r = resultOf(run), b = bookOf(run);
    var h = '<p class="k-chapter">FEEDBACK</p><h1 class="k-title">感想を教えてください</h1><p class="k-sub">この試作を良くするための記録です。すべて任意で、入力した内容はこの端末の外には送られません。</p>';
    h += '<h2 class="k-h2">診断について</h2>' + likert("understand", "設問の意味は分かりやすかった", s.understand) + likert("convince", "結果に納得できた", s.convince) +
      likert("reason", "代表タイプが選ばれた理由（判定理由）が理解できた", s.reason) + likert("axes", "6つの軸の読み全体が、自分の実感に合っていた", s.axes);
    h += '<h2 class="k-h2">6つの軸ごとに</h2><p class="k-soft">それぞれの読みは、自分の実感に合っていましたか。</p>' +
      D.AXES.map(function (a) { return likert("axisFit." + a.id, a.nameJp + "：" + readingText(r.axes[a.id]), s.axisFit && s.axisFit[a.id]); }).join("");
    h += '<h2 class="k-h2">PERSONAL BOOK について</h2>' + likert("bookSelf", "自分のことが書かれている、と感じた", s.bookSelf) + likert("bookRead", "スマートフォンで読みやすかった", s.bookRead);
    h += '<div class="k-lik"><div class="q">章ごとに、役に立ちそうでしたか</div></div>' + b.cats.map(function (c) { return likert("bookCat." + c.id, "第" + c.no + "章　" + c.title, s.bookCat && s.bookCat[c.id], ["役に立たない", "役に立つ"]); }).join("");
    var rxs = Object.keys(run.book.reactions).length;
    h += '<p class="k-soft">ページごとの「実感に合っているか」は ' + rxs + " ページ分、記録されています。</p>";
    h += '<div class="k-lik"><div class="q">回答の負担はどうでしたか</div><div class="k-seg" role="group" aria-label="回答の負担">' +
      [["short", "短い"], ["ok", "ちょうどよい"], ["long", "長い"]].map(function (o) { return '<button type="button" class="k-chip-btn' + (s.burden === o[0] ? " on" : "") + '" data-act="seg" data-k="burden" data-v="' + o[0] + '" aria-pressed="' + (s.burden === o[0]) + '">' + o[1] + "</button>"; }).join("") + "</div></div>";
    var dk = Object.keys(run.discomfort || {});
    h += '<h2 class="k-h2">違和感を記録した設問</h2>' + (dk.length ? '<div class="k-card plain"><ul class="k-list" style="margin:0">' + dk.sort().map(function (id) {
      var d = run.discomfort[id], reasons = d.reasons.map(function (x) { var f = DISC_REASONS.filter(function (y) { return y[0] === x; })[0]; return f ? f[1] : x; });
      return "<li><b>" + id + "</b>（" + esc(AX[ITEM[id].axis].nameJp) + "）" + esc(reasons.join("・")) + (d.note ? "　メモ：" + esc(d.note) : "") + "</li>";
    }).join("") + "</ul></div>" : '<p class="k-soft">回答中に記録した設問はありません。</p>');
    h += '<h2 class="k-h2">自由記述</h2><label for="fb-book" class="k-soft" style="display:block;margin-bottom:4px">BOOKの文章で、実感と違った点・良かった点</label><textarea class="k-textarea" id="fb-book" data-bind="fb" data-k="freeBook" maxlength="1000">' + esc(s.freeBook || "") + "</textarea>" +
      '<label for="fb-free" class="k-soft" style="display:block;margin:12px 0 4px">そのほか（分かりにくかった点、スマホで困った点など）</label><textarea class="k-textarea" id="fb-free" data-bind="fb" data-k="free" maxlength="1000">' + esc(s.free || "") + "</textarea>";
    h += '<div class="k-note info" style="margin-top:18px">ここで答えた内容は、診断精度の検証そのものではありません。実際の利用者による診断精度の検証は、まだ完了していません。</div>';
    h += '<div class="k-stack" style="margin-top:14px"><button class="k-btn primary block" type="button" data-act="fb-save" data-id="' + esc(run.runId) + '">感想を保存する</button>' +
      (s.savedAt ? '<p class="k-soft" style="text-align:center">保存しました（' + esc(fmtDate(s.savedAt)) + "）</p>" : "") +
      '<button class="k-btn block" type="button" data-act="open-book" data-id="' + esc(run.runId) + '">BOOKに戻る</button>' +
      '<button class="k-btn block" type="button" data-act="go" data-view="export">回答データを書き出す</button>' +
      '<button class="k-btn ghost block" type="button" data-act="start" data-kind="retest">もう一度答えて、比べる</button></div>';
    return h;
  };

  // ---------- 再回答の比較 ----------
  VIEWS.compare = function (p) {
    var a = runById(p.a), b = runById(p.b);
    var opts = store.runs.slice().reverse().map(function (r) { return [r.runId, fmtDate(r.finishedAt) + "　" + (r.sessionKind === "retest" ? "再回答" : "初回") + "　" + (r.summary.primaryName || "タイプなし")]; });
    var h = '<p class="k-chapter">RE-ANSWER</p><h1 class="k-title">前回との比較</h1><p class="k-sub">同じ人の2回の回答を並べて、6つの軸と代表タイプの変化を見ます。どちらが正しいという比較ではありません。</p>';
    if (store.runs.length < 2 || !a || !b) {
      return h + '<div class="k-card"><p>比べるには、2回分の記録が必要です。</p><button class="k-btn primary block" style="margin-top:12px" type="button" data-act="start" data-kind="retest">もう一度答える</button></div>';
    }
    var ra = resultOf(a), rb = resultOf(b), c = CMP.compare(ra, rb, { typeName: typeName });
    h += '<div class="k-card plain"><div class="k-soft">前回：' + esc(fmtDate(a.finishedAt)) + '　／　今回：' + esc(fmtDate(b.finishedAt)) + "</div>" +
      (a.finishedAt && b.finishedAt && Math.abs(new Date(b.finishedAt) - new Date(a.finishedAt)) < 864e5 * 10 ? '<p class="k-soft" style="margin-top:6px">間隔が10日未満です。前回の回答を覚えている影響が出やすいため、安定性の目安にはしないでください。</p>' : "") + "</div>";
    h += '<div class="k-card">' + c.summary.map(function (s) { return "<p>" + esc(s) + "</p>"; }).join("") + "</div>";
    if (c.versionMismatch) h += '<div class="k-note">採点バージョンが違います（' + esc(c.versionMismatch.join(" / ")) + "）。設問や判定が変わっているため、比較は参考程度に見てください。</div>";
    h += '<h2 class="k-h2">6つの軸</h2><div class="k-cmp-legend"><span><i class="p"></i>前回</span><span><i class="c"></i>今回</span></div>';
    h += c.axes.map(function (x) {
      var ax = AX[x.id];
      return '<div class="k-axis"><div class="hd"><span class="nm">' + esc(ax.nameJp) + "<small>" + esc(ax.nameEn) + '</small></span><span class="k-step ' + x.step + '">' + esc(x.stepJp) + "</span></div>" +
        '<div class="k-bar"><i class="prev" style="left:' + x.prevPos.toFixed(1) + '%"></i><i style="left:' + x.currPos.toFixed(1) + '%"></i></div>' +
        '<div class="k-poles"><span>← ' + esc(ax.poleB) + "</span><span>" + esc(ax.poleA) + " →</span></div>" +
        '<div class="sc">前回：' + esc(readingTextFromKind(ra.axes[x.id])) + "　→　今回：" + esc(readingTextFromKind(rb.axes[x.id])) + "（位置の差 " + (x.delta > 0 ? "+" : "") + x.delta.toFixed(1) + "）</div></div>";
    }).join("");
    h += '<h2 class="k-h2">代表タイプ</h2><div class="k-card">' +
      (c.type.prevPrimary ? typeMini(c.type.prevPrimary, "前回") : '<p class="k-soft">前回：分類なし</p>') + '<div style="height:12px"></div>' +
      (c.type.currPrimary ? typeMini(c.type.currPrimary, "今回") : '<p class="k-soft">今回：分類なし</p>') +
      '<p class="k-soft" style="margin-top:12px">' + esc({ same: "代表タイプは同じでした。", in_shown: "代表タイプは変わりましたが、表示された範囲（代表・補足）には含まれていました。", changed: "代表タイプが変わり、表示された範囲にも重なりませんでした。", one_none: "どちらか一方は、分類されませんでした。", both_none: "2回とも、分類されませんでした。" }[c.type.kind]) + "</p></div>";
    if (c.items.bigChanges.length) {
      h += '<h2 class="k-h2">2段階以上ちがった設問（' + c.items.bigChanges.length + "問）</h2><p class=\"k-soft\">見直しの手がかりです。誤答という意味ではありません。</p>" + c.items.bigChanges.map(function (d) {
        var it = ITEM[d.id];
        return '<details class="k-det"><summary><b>' + d.id + "</b>　" + esc(AX[it.axis].nameJp) + "　前回 " + d.prev + " → 今回 " + d.curr + "</summary><div><p>左：" + esc(it.left) + "</p><p>右：" + esc(it.right) + '</p><p class="k-soft">1＝左に近い　3＝どちらとも　5＝右に近い</p></div></details>';
      }).join("");
    }
    h += '<h2 class="k-h2">別の組み合わせで比べる</h2><div class="k-card plain"><label class="k-soft" for="ca">前</label><select class="k-sel" id="ca" data-bind="cmp-a">' +
      opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (o[0] === a.runId ? " selected" : "") + ">" + esc(o[1]) + "</option>"; }).join("") +
      '</select><label class="k-soft" for="cb" style="display:block;margin-top:10px">後</label><select class="k-sel" id="cb" data-bind="cmp-b">' +
      opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (o[0] === b.runId ? " selected" : "") + ">" + esc(o[1]) + "</option>"; }).join("") +
      '</select><button class="k-btn block" type="button" data-act="cmp-go" style="margin-top:12px">この組み合わせで比べる</button></div>';
    h += '<div class="k-stack" style="margin-top:18px"><button class="k-btn block" type="button" data-act="open-result" data-id="' + esc(b.runId) + '">今回の結果へ</button></div>';
    return h;
  };
  function readingTextFromKind(info) { return readingText(info); }

  // ---------- 記録 ----------
  VIEWS.history = function () {
    var h = '<p class="k-chapter">HISTORY</p><h1 class="k-title">この端末の記録</h1><p class="k-sub">' + (persistOK() ? "保存に同意いただいた記録です。" : "保存を選んでいないため、画面を閉じると消えます。") + "</p>";
    if (!store.runs.length) return h + '<div class="k-card"><p>まだ記録がありません。</p></div>';
    h += store.runs.slice().reverse().map(function (r) {
      var res = resultOf(r), s = r.survey && r.survey.savedAt ? "感想済み" : "感想なし";
      return '<div class="k-card"><div class="k-between"><b>' + esc(fmtDate(r.finishedAt)) + '</b><span class="k-tag ' + (r.sessionKind === "retest" ? "gold" : "") + '">' + (r.sessionKind === "retest" ? "再回答" : "初回") + "</span></div>" +
        '<p class="k-soft" style="margin:6px 0">' + esc(r.pilotCode ? "コード " + r.pilotCode + "　" : "") + "代表タイプ：" + esc(r.summary.primaryName || "分類なし") + "　" + s + "　scoring " + esc(r.scoring_version) + "</p>" +
        '<div class="k-row"><button class="k-btn" type="button" data-act="open-result" data-id="' + esc(r.runId) + '">結果</button><button class="k-btn" type="button" data-act="open-book" data-id="' + esc(r.runId) + '">BOOK</button>' +
        (r.parentRunId && runById(r.parentRunId) ? '<button class="k-btn" type="button" data-act="compare" data-a="' + esc(r.parentRunId) + '" data-b="' + esc(r.runId) + '">前回と比較</button>' : "") + "</div></div>";
    }).join("");
    return h;
  };

  // ---------- データの扱い ----------
  VIEWS.data = function (p) {
    var c = store.consent || {};
    var h = '<p class="k-chapter">DATA</p><h1 class="k-title">データの扱い</h1><p class="k-sub">この試作が、回答データをどう扱うかの取り決めです。</p>';
    h += '<div class="k-card"><div class="k-chapter" style="margin-bottom:6px">外部への送信</div><p><b>しません。</b>この画面は、回答・結果・感想を、ネットワークへ送るコードを持っていません。KAKUのサーバー、公開版のサイト、決済、メール、共有機能、第三者のサービスのいずれにも接続しません。</p></div>';
    h += '<div class="k-card"><div class="k-chapter" style="margin-bottom:6px">保存（開発用）</div><ul class="k-list" style="color:var(--text)">' +
      "<li><b>保存先：</b>このブラウザの localStorage（キー <span class=\"k-mono\" style=\"font-size:11px\">" + STORE_KEY + "</span>）。この試作のページ専用で、公開版のサイトとは別の領域です。</li>" +
      "<li><b>保存するとき：</b>同意の画面で「保存する」を選んだときだけ。選ばなければ、メモリ上だけで処理し、画面を閉じると消えます。</li>" +
      "<li><b>保存する内容：</b>同意の記録、参加コード（任意）、36問への回答と回答時間（設問ごと）、違和感の記録、結果の要約、BOOKの各ページの反応・メモ、感想、採点バージョン。</li>" +
      "<li><b>保存しない内容：</b>氏名、メール、生年月日、位置情報、端末の識別子。</li></ul></div>";
    h += '<div class="k-card"><div class="k-chapter" style="margin-bottom:6px">書き出し（開発用）</div><ul class="k-list" style="color:var(--text)">' +
      "<li><b>いつ：</b>「回答データを書き出す」を押したときだけ。自動では行いません。</li>" +
      "<li><b>形式：</b>JSON（<span class=\"k-mono\" style=\"font-size:11px\">kaku-core36-export/1</span>）。回答、<span class=\"k-mono\" style=\"font-size:11px\">scoring_version</span>、<span class=\"k-mono\" style=\"font-size:11px\">definition_hash</span>、BOOKの文章バージョン、設問ごとの回答時間と違和感、結果の要約、感想、再回答の比較結果を含みます。</li>" +
      "<li><b>方法：</b>ファイル保存の確認が出ます。保存できない環境では、画面に表示してコピーできます。</li></ul></div>";
    h += '<div class="k-card"><div class="k-chapter" style="margin-bottom:6px">保存の設定</div>' +
      '<label class="k-check"><input type="checkbox" data-bind="save-toggle"' + (c.save ? " checked" : "") + ' /><span>回答・結果・感想を、このブラウザに保存する' + (c.understood ? "" : "<br><span class=\"k-soft\">（回答を始めるときの同意の画面でも選べます）</span>") + "</span></label>" +
      '<div class="k-stack" style="margin-top:8px"><button class="k-btn block" type="button" data-act="go" data-view="export">回答データを書き出す</button>' +
      (p.confirmWipe ? '<div class="k-note"><b>保存してある記録を、すべて削除します。</b>元に戻せません。<div class="k-row" style="margin-top:10px"><button class="k-btn" type="button" data-act="wipe-yes" style="border-color:#F2B4C9;color:#F2B4C9">削除する</button><button class="k-btn ghost" type="button" data-act="wipe-no">やめる</button></div></div>'
        : '<button class="k-btn ghost block" type="button" data-act="wipe">この端末の記録をすべて削除</button>') + "</div></div>";
    h += '<div class="k-card"><div class="k-chapter" style="margin-bottom:6px">この試作について</div><p>診断精度の検証（実際の利用者による、再回答の一致や納得感の確認）は、まだ完了していません。設問・採点・12TYPEの判定・BOOKの文章は、すべて暫定です。</p>' +
      '<p class="k-soft">scoring_version ' + esc(D.VERSION) + "　definition_hash " + esc(E.definitionHash()) + "　BOOK " + esc(BK.CONTENT_VERSION) + "　build " + esc(BUILD.id) + "</p></div>";
    h += '<button class="k-btn block" type="button" data-act="go" data-view="qa">設問と採点の向き・判定の動作を確認する（検証用）</button>';
    return h;
  };

  // ---------- 書き出し ----------
  function buildExport() {
    var comps = [];
    store.runs.forEach(function (r) {
      var par = r.parentRunId && runById(r.parentRunId); if (!par) return;
      var c = CMP.compare(resultOf(par), resultOf(r), { typeName: typeName });
      if (c.ok) comps.push({ prevRunId: par.runId, currRunId: r.runId, axes: c.axes.map(function (x) { return { id: x.id, prevPos: x.prevPos, currPos: x.currPos, delta: x.delta, step: x.step, prevKind: x.prevKind, currKind: x.currKind }; }),
        type: { kind: c.type.kind, prevPrimary: c.type.prevPrimary, currPrimary: c.type.currPrimary, prevShown: c.type.prevShown, currShown: c.type.currShown },
        items: { meanAbsDiff: c.items.meanAbsDiff, bigChanges: c.items.bigChanges }, versionMismatch: c.versionMismatch || null });
    });
    return {
      schema: "kaku-core36-export/1", exported_at: nowIso(),
      app: { name: "KAKU CORE36 preview", build: BUILD.id, scoring_version: D.VERSION, definition_hash: E.definitionHash(), book_content_version: BK.CONTENT_VERSION },
      notice: "開発・検証用の書き出しです。実利用者による診断精度の検証は未完了です。氏名・メール・生年月日は含みません。",
      consent: store.consent, runs: store.runs, comparisons: comps
    };
  }
  VIEWS.export = function () {
    var text = JSON.stringify(buildExport(), null, 1);
    var h = '<p class="k-chapter">EXPORT</p><h1 class="k-title">回答データの書き出し</h1><p class="k-sub">押したときだけ、あなたの操作で書き出します。自動では送信されません。</p>' +
      '<div class="k-card"><p>' + store.runs.length + " 件の記録を、JSONファイルとして書き出します。</p>" +
      '<div class="k-stack" style="margin-top:12px"><button class="k-btn primary block" type="button" data-act="export-save"' + (store.runs.length ? "" : " disabled") + '>ファイルとして保存</button>' +
      '<button class="k-btn block" type="button" data-act="export-copy"' + (store.runs.length ? "" : " disabled") + ">クリップボードにコピー</button></div></div>" +
      '<details class="k-det"><summary>書き出す内容を確認する（' + Math.round(text.length / 1024) + ' KB）</summary><div><textarea class="k-textarea" id="exp" readonly style="min-height:220px;font-family:var(--mono);font-size:11px">' + esc(text) + "</textarea></div></details>" +
      '<p class="k-soft">解析ツール（core36/tools/analyze-pilot.js）にそのまま渡せる形式です。</p>';
    return h;
  };
  function exportFilename() { return "kaku-core36-" + nowIso().slice(0, 10) + ".json"; }
  function exportSave() {
    var text = JSON.stringify(buildExport(), null, 1), name = exportFilename();
    function fallback() {
      try {
        var blob = new Blob([text], { type: "application/json" }), a = document.createElement("a");
        a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
        toast("書き出しました");
      } catch (e) { toast("保存できませんでした。下の内容をコピーしてください"); var d = app.querySelector("details.k-det"); if (d) d.open = true; }
    }
    if (window.claude && typeof window.claude.use === "function") {
      window.claude.use("downloads").then(function (dl) {
        if (!dl) return fallback();
        dl.save({ filename: name, data: text }).then(function () { toast("保存しました"); }).catch(function (e) {
          if (e && e.code === "declined") toast("保存をキャンセルしました");
          else { toast("この環境ではファイル保存できません。コピーをお使いください"); var d = app.querySelector("details.k-det"); if (d) d.open = true; }
        });
      }).catch(fallback);
    } else fallback();
  }
  function exportCopy() {
    var text = JSON.stringify(buildExport(), null, 1);
    function sel() { var ta = document.getElementById("exp"); var d = app.querySelector("details.k-det"); if (d) d.open = true; if (ta) { ta.focus(); ta.select(); } toast("全選択しました。コピーしてください"); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { toast("コピーしました"); }).catch(sel); else sel();
  }

  // ---------- 検証用：設問と採点の向き／判定の動作 ----------
  function ansFor(spec) {
    var a = {}; D.ITEMS.forEach(function (it) { var s = spec[it.axis], v = 0; if (typeof s === "number") v = s; else if (s) v = s[it.scene]; a[it.id] = it.aSide === "left" ? 3 - v : 3 + v; }); return a;
  }
  function allAnswer(v) { var a = {}; D.ITEMS.forEach(function (it) { a[it.id] = v; }); return a; }
  function runChecks() {
    var out = [];
    function chk(name, ok, detail) { out.push({ name: name, ok: !!ok, detail: detail || "" }); }
    D.AXES.forEach(function (a) {
      var its = D.ITEMS.filter(function (i) { return i.axis === a.id; });
      chk(a.nameJp + "：6問、A極の文が左3・右3、仕事3・日常3", its.length === 6 && its.filter(function (i) { return i.aSide === "left"; }).length === 3 && its.filter(function (i) { return i.scene === "work"; }).length === 3 &&
        its.filter(function (i) { return i.scene === "work" && i.aSide === "left"; }).length >= 1, its.map(function (i) { return i.id + (i.aSide === "left" ? "左" : "右"); }).join(" "));
    });
    D.AXES.forEach(function (a) {
      var spec = {}; spec[a.id] = 2; var rA = E.score(ansFor(spec)), spec2 = {}; spec2[a.id] = -2; var rB = E.score(ansFor(spec2));
      var others = D.AXES.filter(function (x) { return x.id !== a.id; }).every(function (x) { return rA.axes[x.id].position === 50 && rB.axes[x.id].position === 50; });
      chk(a.nameJp + "：A極（" + a.poleA + "）の文を選ぶと100、B極（" + a.poleB + "）で0、他の軸は動かない", rA.axes[a.id].position === 100 && rB.axes[a.id].position === 0 && rA.axes[a.id].reading.kind === "a" && rB.axes[a.id].reading.kind === "b" && others,
        "A→" + rA.axes[a.id].position + " B→" + rB.axes[a.id].position);
    });
    var neutral = E.score(allAnswer(3));
    chk("全問『どちらとも』なら、全軸50・寄りなし・分類しない", D.AXES.every(function (a) { return neutral.axes[a.id].position === 50 && neutral.axes[a.id].reading.kind === "balanced"; }) && neutral.type.status === "no_basis", "type.status=" + neutral.type.status);
    var rev = E.score(ansFor({ vision: 2 })), rev2 = E.score((function () { var a = ansFor({ vision: 2 }); D.ITEMS.forEach(function (it) { if (it.axis === "vision") a[it.id] = 6 - a[it.id]; }); return a; })());
    chk("5段階を反転すると、軸の位置も反転する（100 ↔ 0）", rev.axes.vision.position === 100 && rev2.axes.vision.position === 0);
    var cnt = {}; D.ITEMS.forEach(function (it) { cnt[it.id] = 1; });
    chk("設問は36問、IDは重複しない", D.ITEMS.length === 36 && Object.keys(cnt).length === 36);
    chk("旧4タイプ（mediator/builder/adventurer/finisher）を出力しない", ["mediator", "builder", "adventurer", "finisher"].every(function (x) { return !D.PROFILES[x]; }));
    return out;
  }
  var SAMPLES = [
    ["すべて『どちらとも』", allAnswer(3)],
    ["1つの軸だけ強く寄る（突破力）", ansFor({ drive: 2 })],
    ["僅差になる例（1位と2位の差が小さい）", ansFor({ vision: -2, logic: -2, drive: -2, influence: -1 })],
    ["同点が起きる例（固定順で決定）", ansFor({ vision: -2, logic: -2, drive: -2, influence: -2, bond: -2, steady: -2 })],
    ["場面で逆向きになる例（影響力）", ansFor({ influence: { work: 2, life: -2 }, vision: 2, logic: 1 })],
    ["すべて同じ選択肢（5）", allAnswer(5)]
  ];
  VIEWS.qa = function () {
    var checks = runChecks(), pass = checks.filter(function (c) { return c.ok; }).length;
    var h = '<p class="k-chapter">QUALITY</p><h1 class="k-title">採点と判定の確認</h1><p class="k-sub">検証用の画面です。設問と採点の向きが一致しているか、同点・僅差・分類しない場合をどう扱うかを、画面上で確かめます。</p>';
    h += '<h2 class="k-h2">自動チェック（' + pass + " / " + checks.length + ' 通過）</h2><div class="k-card">' + checks.map(function (c) {
      return '<p style="font-size:13px"><span class="' + (c.ok ? "m-match" : "m-opposite") + '">' + (c.ok ? "通過" : "不一致") + "</span>　" + esc(c.name) + (c.detail ? '<br><span class="k-soft k-mono" style="font-size:10.5px">' + esc(c.detail) + "</span>" : "") + "</p>";
    }).join("") + "</div>";
    h += '<h2 class="k-h2">判定の動作サンプル</h2><p class="k-soft">あらかじめ決めた回答パターンを、現在の判定に通した結果です（記録には残りません）。</p><div class="k-card"><div class="k-scroll-x"><table class="k-tbl"><thead><tr><th>パターン</th><th>代表</th><th>状態</th><th>2番目</th></tr></thead><tbody>' +
      SAMPLES.map(function (s) {
        var r = E.score(s[1], { durationSec: 600 }), t = r.type, parts = [];
        if (t.status === "no_basis") parts.push("分類しない" + (t.noBasisReason && t.noBasisReason.indexOf("tie_") === 0 ? "（" + t.noBasisReason.slice(4) + "タイプが同じ近さ）" : "（寄りなし）"));
        else {
          if (t.tieResolvedBy) parts.push("同点（" + (t.tieResolvedBy === "core_distance" ? "決める軸の距離で決定" : "固定順で決定") + "）");
          if (t.fit === "weak") parts.push("近さ弱め");
          if (t.showSecond) parts.push("僅差で2タイプ表示");
          if (!parts.length) parts.push("通常");
        }
        var st = parts.join("・");
        return "<tr><td>" + esc(s[0]) + "</td><td>" + esc(t.primary ? typeName(t.primary) : "—") + "</td><td>" + esc(st + (r.flags.straightLine ? "・同一回答注意" : "")) + "</td><td>" + esc(t.showSecond || t.fit === "weak" ? typeName(t.second) : "—") + "</td></tr>";
      }).join("") + "</tbody></table></div></div>";
    h += '<h2 class="k-h2">設問と採点の向き</h2><p class="k-soft">「A極の文」の側を選ぶほど、その軸のA極寄り（位置が100に近づく）になります。</p><div class="k-card"><div class="k-scroll-x"><table class="k-tbl"><thead><tr><th>ID</th><th>軸</th><th>場面</th><th>A極</th></tr></thead><tbody>' +
      D.ITEMS.map(function (it) {
        var ax = AX[it.axis];
        return "<tr><td class=\"k-mono\">" + it.id + "</td><td>" + esc(ax.nameJp) + "</td><td>" + esc(D.SCENES[it.scene]) + "</td><td>" + esc(ax.poleA) + "＝" + (it.aSide === "left" ? "左" : "右") + "</td></tr>";
      }).join("") + "</tbody></table></div></div>";
    var disc = {}; store.runs.forEach(function (r) { Object.keys(r.discomfort || {}).forEach(function (id) { disc[id] = (disc[id] || 0) + 1; }); });
    h += '<h2 class="k-h2">違和感の記録（この端末・' + store.runs.length + "回分）</h2>" + (Object.keys(disc).length ? '<div class="k-card"><p>' + Object.keys(disc).sort().map(function (id) { return "<b>" + id + "</b>（" + disc[id] + "回）"; }).join("　") + "</p></div>" : '<p class="k-soft">まだありません。</p>');
    return h + '<button class="k-btn block" type="button" data-act="go" data-view="data" style="margin-top:16px">データの扱いへ戻る</button>';
  };

  // ================= イベント =================
  var ACTS = {
    go: function (el) { go(el.getAttribute("data-view")); },
    pause: function () { qLeave(); if (q) saveDraft(); q = null; go("home"); },
    start: function (el) {
      var kind = el.getAttribute("data-kind");
      var pc = document.getElementById("pc"); if (pc) store.pilotCode = pc.value.trim();
      if (!store.consent || !store.consent.understood) return go("consent", { next: kind });
      startSession(kind);
    },
    "consent-ok": function () {
      var u = app.querySelector('[data-bind="c-understood"]').checked, s = app.querySelector('[data-bind="c-save"]').checked;
      if (!u) return;
      store.consent = { understood: true, save: s, at: nowIso(), version: CONSENT_VERSION };
      if (s) saveStore(); else wipeStore();
      startSession((ui.p && ui.p.next) || "first");
    },
    resume: function () {
      var d = store.draft; if (!d) return;
      q = { kind: d.kind, parentRunId: d.parentRunId, index: Math.min(35, Math.max(0, d.index || 0)), answers: d.answers || {}, disc: d.disc || {}, times: d.times || {}, activeMs: d.activeMs || 0, startedAt: d.startedAt, enteredAt: null, pilotCode: d.pilotCode || "", discOpen: false };
      var next = D.ITEMS.findIndex(function (it) { return !(it.id in q.answers); }); if (next >= 0) q.index = next;
      go("q");
    },
    ans: function (el) { qAnswer(Number(el.getAttribute("data-v"))); },
    qnext: function () { qNext(); }, qback: function () { qBack(); },
    "disc-toggle": function () { q.discOpen = !q.discOpen; rerender(); },
    "open-result": function (el) { go("result", { id: el.getAttribute("data-id") }); },
    "open-book": function (el) { go("book", { id: el.getAttribute("data-id") }); },
    "open-cat": function (el) { go("cat", { id: el.getAttribute("data-id"), cat: el.getAttribute("data-cat") }); },
    "open-page": function (el) { go("page", { id: el.getAttribute("data-id"), cat: el.getAttribute("data-cat"), i: Number(el.getAttribute("data-i")) }); },
    "open-feedback": function (el) { go("feedback", { id: el.getAttribute("data-id") }); },
    react: function (el) {
      var run = runById(ui.p.id), pid = el.getAttribute("data-pid"), v = el.getAttribute("data-v");
      var cur = run.book.reactions[pid] || {}; run.book.reactions[pid] = { v: v, comment: cur.comment || "", at: nowIso() }; saveStore(); rerender();
    },
    try: function (el) {
      var run = runById(ui.p.id), tr = run.book.tries, id = el.getAttribute("data-tid"), i = tr.chosen.indexOf(id);
      if (i >= 0) tr.chosen.splice(i, 1); else tr.chosen.push(id); saveStore(); rerender();
    },
    lik: function (el) {
      var run = runById(ui.p.id); run.survey = run.survey || {}; var k = el.getAttribute("data-k"), v = Number(el.getAttribute("data-v"));
      setPath(run.survey, k, getPath(run.survey, k) === v ? null : v); saveStore(); rerender();
    },
    seg: function (el) { var run = runById(ui.p.id); run.survey = run.survey || {}; run.survey[el.getAttribute("data-k")] = el.getAttribute("data-v"); saveStore(); rerender(); },
    "fb-save": function () {
      var run = runById(ui.p.id); run.survey = run.survey || {}; run.survey.savedAt = nowIso(); saveStore();
      toast(persistOK() ? "感想を保存しました（この端末の中だけ）" : "感想を記録しました（保存を選んでいないため、画面を閉じると消えます）"); rerender();
    },
    compare: function (el) { go("compare", { a: el.getAttribute("data-a"), b: el.getAttribute("data-b") }); },
    "cmp-go": function () { go("compare", { a: document.getElementById("ca").value, b: document.getElementById("cb").value }); },
    "export-save": function () { exportSave(); }, "export-copy": function () { exportCopy(); },
    wipe: function () { go("data", { confirmWipe: true }); }, "wipe-no": function () { go("data"); },
    "wipe-yes": function () {
      store.runs = []; store.draft = null; store.consent = null; store.pilotCode = ""; cacheRes = {}; cacheBook = {}; wipeStore(); q = null; toast("削除しました"); go("home");
    }
  };
  var BINDS = {
    pc: function (el) { store.pilotCode = el.value.trim(); },
    "c-understood": function (el) { var b = app.querySelector('[data-act="consent-ok"]'); if (b) b.disabled = !el.checked; },
    "disc-reason": function (el) {
      var id = D.ITEMS[q.index].id, d = q.disc[id] || (q.disc[id] = { reasons: [], note: "" }), r = el.getAttribute("data-r"), i = d.reasons.indexOf(r);
      if (el.checked && i < 0) d.reasons.push(r); if (!el.checked && i >= 0) d.reasons.splice(i, 1);
      if (!d.reasons.length && !d.note) delete q.disc[id]; saveDraft();
    },
    "disc-note": function (el) {
      var id = D.ITEMS[q.index].id, d = q.disc[id] || (q.disc[id] = { reasons: [], note: "" }); d.note = el.value;
      if (!d.reasons.length && !d.note) delete q.disc[id]; saveDraft();
    },
    memo: function (el) { var run = runById(ui.p.id); run.book.tries.memo = el.value; },
    "react-note": function (el) { var run = runById(ui.p.id), pid = el.getAttribute("data-pid"); if (run.book.reactions[pid]) run.book.reactions[pid].comment = el.value; },
    fb: function (el) { var run = runById(ui.p.id); run.survey = run.survey || {}; run.survey[el.getAttribute("data-k")] = el.value; },
    "save-toggle": function (el) {
      store.consent = store.consent || { understood: true, at: nowIso(), version: CONSENT_VERSION }; store.consent.save = el.checked;
      if (el.checked) { saveStore(); toast("この端末に保存します"); } else { wipeStore(); toast("保存を止めました（保存済みの分は削除しました）"); }
    },
    "cmp-a": function () { }, "cmp-b": function () { }
  };
  app.addEventListener("click", function (ev) {
    var el = ev.target.closest ? ev.target.closest("[data-act]") : null; if (!el || !app.contains(el) || el.disabled) return;
    var fn = ACTS[el.getAttribute("data-act")]; if (fn) fn(el, ev);
  });
  function onField(ev) {
    var el = ev.target; if (!el || !el.getAttribute) return; var b = el.getAttribute("data-bind"); if (b && BINDS[b]) BINDS[b](el);
  }
  app.addEventListener("input", onField);
  app.addEventListener("change", function (ev) {
    onField(ev);
    var el = ev.target, b = el && el.getAttribute && el.getAttribute("data-bind");
    if (b === "memo" || b === "react-note" || b === "fb") saveStore();   // 文字入力は、入力が確定したときに保存
    if (b === "c-understood" || b === "c-save") { ui.p.understood = app.querySelector('[data-bind="c-understood"]').checked; ui.p.save = app.querySelector('[data-bind="c-save"]').checked; }
  });
  document.addEventListener("keydown", function (ev) {
    if (ui.view !== "q" || !q || !/^[1-5]$/.test(ev.key)) return;
    if (ev.target && /TEXTAREA|SELECT/.test(ev.target.tagName)) return;
    if (ev.target && ev.target.tagName === "INPUT" && ev.target.type !== "checkbox") return;
    qAnswer(Number(ev.key));
  });
  window.addEventListener("pagehide", function () { if (q) { qLeave(); saveDraft(); } });

  // 画面から状態を確認するための、読み取り専用の窓口（テスト用）
  window.__kakuPreview = { get view() { return ui.view; }, get store() { return store; } };

  loadStore();
  render();
})();

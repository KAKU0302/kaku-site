/**
 * kaku-lab/lab-app.js
 * KAKU 体験版（検証用）の画面。STEP1（核・過去の価値観）→ STEP2（現在の価値観）→ STEP3（今の状態）
 * → RESULT → PERSONAL BOOK。
 *
 * データの扱い
 *  ・回答はこのブラウザの中だけで扱います。このファイルに、外部へ送る処理はありません。
 *  ・「保存して始める」を選んだときだけ、このブラウザ（localStorage）に保存します。「データの扱い」画面から削除できます。
 *  ・書き出し（JSON）は、本人がボタンを押したときだけ、この端末に保存されます。
 */
(function () {
  "use strict";

  var L = window.KAKU_LAB_LOGIC, C = window.KAKU_LAB_CONTENT;
  var ITEMS = L.CORE.ITEMS, CHOICES = L.CORE.CHOICES, DOMAINS = L.DOMAINS, DBY = L.DOMAIN_BY_ID;
  var KEY = "kakulab.v1";
  var root = document.getElementById("app");

  // ---------------------------------------------------------------- 状態
  function fresh() {
    return {
      v: 1, consent: null, view: "intro", pos: 0,
      answers: {}, seconds: {}, discomfort: {},
      followup: { asked: [], answers: {} },
      past: { period: { yearsAgo: 3, changedByUser: false }, important: [], top: null, less: [], skipped: false },
      cur: { important: [], top: null, less: [], fulfil: {} },
      state: {}, survey: {}, bookPage: -1, prevView: "intro"
    };
  }
  var S = fresh();
  var ui = { periodOpen: false, flash: "", t0: Date.now(), confirmReset: false, busy: false, copied: false };

  function storageGet() { try { return window.localStorage.getItem(KEY); } catch (e) { return null; } }
  function storageSet(v) { try { window.localStorage.setItem(KEY, v); return true; } catch (e) { return false; } }
  function storageDel() { try { window.localStorage.removeItem(KEY); } catch (e) { /* 何もしない */ } }
  function persist() { if (S.consent === true) storageSet(JSON.stringify(S)); }
  function loadSaved() {
    var raw = storageGet();
    if (!raw) return null;
    try { var o = JSON.parse(raw); return o && o.v === 1 && o.consent === true ? o : null; } catch (e) { return null; }
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function qn(id) { return "「" + DBY[id].name + "」"; }

  // ---------------------------------------------------------------- 画面の並び（状態から毎回つくる）
  function allCoreAnswered() { return ITEMS.every(function (it) { return S.answers[it.id]; }); }

  function syncFollowup() {
    if (!allCoreAnswered()) { S.followup = { asked: [], answers: {} }; return; }
    var dec = L.decideType(S.answers, { asked: [], answers: {} });
    var want = dec.needFollowup ? dec.followupIds : [];
    var cur = S.followup.asked || [];
    if (want.join() !== cur.join()) {
      var keep = {};
      want.forEach(function (id) { if (S.followup.answers[id]) keep[id] = S.followup.answers[id]; });
      S.followup = { asked: want, answers: keep };
    }
  }

  function screens() {
    var s = [{ k: "s1intro" }];
    ITEMS.forEach(function (it) { s.push({ k: "q", id: it.id }); });
    if (S.followup.asked && S.followup.asked.length) {
      s.push({ k: "fintro" });
      S.followup.asked.forEach(function (id) { s.push({ k: "f", id: id }); });
    }
    s.push({ k: "pPeriod" });
    if (!S.past.skipped) { s.push({ k: "pPick" }, { k: "pTop" }, { k: "pLess" }, { k: "pConfirm" }); }
    s.push({ k: "s2intro" }, { k: "cPick" }, { k: "cTop" }, { k: "cLess" }, { k: "cConfirm" });
    DOMAINS.forEach(function (d) { s.push({ k: "fu", id: d.id }); });
    s.push({ k: "s3intro" });
    L.STATE_ITEMS.forEach(function (it) { s.push({ k: "st", id: it.id }); });
    return s;
  }
  function stepOf(k) {
    if (k === "s1intro" || k === "q" || k === "fintro" || k === "f" || /^p/.test(k)) return 1;
    if (k === "s2intro" || k === "cPick" || k === "cTop" || k === "cLess" || k === "cConfirm" || k === "fu") return 2;
    return 3;
  }

  // ---------------------------------------------------------------- 描画の入口
  function render() {
    syncFollowup();
    ui.confirmReset = ui.confirmReset && S.view === "result";
    var html;
    if (S.view === "intro") html = viewIntro();
    else if (S.view === "flow") html = viewFlow();
    else if (S.view === "result") html = viewResult();
    else if (S.view === "book") html = viewBook();
    else if (S.view === "data") html = viewData();
    else html = viewIntro();
    root.innerHTML = html;
    ui.t0 = Date.now();
    window.scrollTo(0, 0);
  }

  function topBar(progress) {
    var h = '<div class="k-top"><div class="k-top-row"><div class="k-logo">KAKU <span style="font-weight:500">～核～</span><small>体験版・未検証</small></div>' +
      '<button class="k-link" data-act="data">データの扱い</button></div>';
    if (progress) {
      h += '<div class="k-progress"><div class="k-progress-label"><span>' + progress.label + '</span><span>' + progress.right + '</span></div>' +
        '<div class="k-bar"><i style="width:' + progress.pct + '%"></i></div></div>';
    }
    return h + "</div>";
  }

  // ---------------------------------------------------------------- はじめに
  function viewIntro() {
    var saved = loadSaved();
    var h = topBar(null) + '<div class="k-view">';
    h += '<p class="k-kicker">KAKU 体験版（検証用）</p>';
    h += '<h1 class="k-title">あなたについて、3つのステップで答えます</h1>';
    h += '<p class="k-sub">答え終わると、あなたの人物像と、あなたのための小さな本（PERSONAL BOOK）が出ます。</p>';
    h += '<div class="k-card"><div class="k-stack">' +
      '<p><b>STEP1　核と過去の価値観</b><br><span class="k-soft">ふだんのあなたの動き方を36問で。そのあと、昔の自分が大切にしていたことを振り返ります。</span></p>' +
      '<p><b>STEP2　現在の価値観</b><br><span class="k-soft">いま大切にしていること、そして、それがどのくらい満たされているか。</span></p>' +
      '<p><b>STEP3　今の状態</b><br><span class="k-soft">ここ1週間のコンディションを6問で。</span></p>' +
      '<p class="k-soft">→ 結果（人物像・12TYPE・価値観の変化・KAKU GAP・今の状態）→ PERSONAL BOOK</p></div></div>';
    h += '<div class="k-card plain"><p><b>所要時間の目安：約10〜12分</b></p>' +
      '<p class="k-soft">読むのがゆっくりな方は15分ほどかかります。この時間は設問の文字数からの見積もりで、実測ではありません。いつでも戻って答えを直せます。</p></div>';
    h += '<div class="k-note"><b>これは試作版です。</b>採点のしくみも文章も、まだ実際の利用者で確かめていません。結果は「今回の回答から読み取れる範囲」の目安として、気軽に読んでください。</div>';
    h += '<div class="k-card plain"><p><b>データの扱い</b></p><ul class="k-list k-soft">' +
      '<li>回答は、このブラウザの中だけで処理します。外部のサーバーには送りません。</li>' +
      '<li>名前・メールアドレス・生年月日は聞きません。</li>' +
      '<li>「保存して始める」を選ぶと、途中で閉じても続きから再開できるよう、この端末のブラウザに保存します。いつでも削除できます。</li>' +
      '<li>「保存しないで始める」を選ぶと、何も保存しません。ページを閉じると、回答は消えます。</li></ul></div>';
    if (saved) {
      h += '<div class="k-card"><p><b>前回の続きがあります</b></p><div class="k-stack" style="margin-top:10px">' +
        '<button class="k-btn primary block" data-act="resume">続きから再開する</button>' +
        '<button class="k-btn block" data-act="discard">保存したデータを消して、最初から</button></div></div>';
    }
    h += '<div class="k-stack k-foot">' +
      '<button class="k-btn primary block" data-act="start" data-consent="1">保存して始める（途中で再開できます）</button>' +
      '<button class="k-btn block" data-act="start" data-consent="0">保存しないで始める</button></div>';
    return h + "</div>";
  }

  // ---------------------------------------------------------------- 設問フロー
  function viewFlow() {
    var list = screens();
    if (S.pos < 0) S.pos = 0;
    if (S.pos >= list.length) { S.view = "result"; persist(); return viewResult(); }
    var sc = list[S.pos];
    var step = stepOf(sc.k);
    var stepNames = { 1: "核と過去の価値観", 2: "現在の価値観", 3: "今の状態" };
    var pct = Math.round(S.pos / list.length * 100);
    var right = "";
    var qi;
    if (sc.k === "q") { qi = ITEMS.map(function (i) { return i.id; }).indexOf(sc.id) + 1; right = qi + " / 36"; }
    else if (sc.k === "f") { qi = S.followup.asked.indexOf(sc.id) + 1; right = "追加 " + qi + " / " + S.followup.asked.length; }
    else if (sc.k === "fu") { qi = DOMAINS.map(function (d) { return d.id; }).indexOf(sc.id) + 1; right = "満たされ具合 " + qi + " / 14"; }
    else if (sc.k === "st") { qi = L.STATE_ITEMS.map(function (d) { return d.id; }).indexOf(sc.id) + 1; right = qi + " / 6"; }
    var h = topBar({ label: "<b>STEP " + step + " / 3</b>　" + stepNames[step], right: right, pct: pct });
    h += '<div class="k-view">';
    var body = ({
      s1intro: tplS1Intro, q: tplCore, fintro: tplFIntro, f: tplFollow, pPeriod: tplPeriod, pPick: tplPastPick, pTop: tplPastTop,
      pLess: tplPastLess, pConfirm: tplPastConfirm, s2intro: tplS2Intro, cPick: tplCurPick, cTop: tplCurTop, cLess: tplCurLess,
      cConfirm: tplCurConfirm, fu: tplFulfil, s3intro: tplS3Intro, st: tplState
    })[sc.k](sc);
    return h + body + "</div>";
  }

  function backBtn() { return '<div class="k-back"><button class="k-btn ghost" data-act="back">← 戻る</button></div>'; }
  function nextBtn(enabled, label) {
    return '<div class="k-sticky"><button class="k-btn primary block" data-act="next"' + (enabled ? "" : " disabled") + ">" + (label || "次へ") + "</button></div>";
  }

  function tplS1Intro() {
    return '<p class="k-kicker">STEP 1</p><h1 class="k-title">核と過去の価値観</h1>' +
      '<p class="k-sub">ここでは、仕事や日常で、あなたがふだんどう考え、どう動くかを聞きます。正解はありません。深く考えず、近い方を選んでください。</p>' +
      '<div class="k-card plain"><p class="k-soft">2枚の文のうち、ふだんのあなたに近い方を、5つのボタンから選びます。1つ選ぶと次へ進みます。</p>' +
      '<p class="k-soft">そのあと、昔の自分が大切にしていたことを振り返ります。</p></div>' +
      '<div class="k-note info">ここでいう「核」は、あなたが答えたふだんの傾向のことです。生まれつきの性質を測るものではありません。</div>' +
      '<div class="k-stack k-foot"><button class="k-btn primary block" data-act="next">STEP 1 をはじめる（約6〜8分）</button></div>' + backBtn();
  }

  function tplCore(sc) {
    var it = ITEMS.filter(function (x) { return x.id === sc.id; })[0];
    var v = S.answers[it.id];
    var h = '<h1 class="k-q">ふだんのあなたに近いのは、どちらですか？</h1>';
    h += '<div class="k-pair"><div class="k-side' + (v && v < 3 ? " lit" : "") + '" data-label="上">' + esc(it.left) + "</div>" +
      '<div class="k-side' + (v && v > 3 ? " lit" : "") + '" data-label="下">' + esc(it.right) + "</div></div>";
    h += '<div class="k-choices">' + CHOICES.map(function (c) {
      return '<button class="k-choice' + (v === c.value ? " on" : "") + '" data-act="core" data-v="' + c.value + '">' + esc(c.label) + "</button>";
    }).join("") + "</div>" + backBtn();
    return h;
  }

  function tplFIntro() {
    return '<p class="k-kicker">もう少しだけ</p><h1 class="k-title">あと ' + S.followup.asked.length + ' 問、教えてください</h1>' +
      '<p class="k-sub">ここまでの答えでは、あなたに近いタイプを一つに絞る手がかりが、少し足りませんでした。似た質問を、別の場面で聞きます。</p>' +
      '<div class="k-note info">この追加質問で、判定が正確になったとは言えません。タイプを決めるときの材料が増えるだけです。</div>' +
      '<div class="k-stack k-foot"><button class="k-btn primary block" data-act="next">答える</button></div>' + backBtn();
  }

  function tplFollow(sc) {
    var f = L.FOLLOWUP_BY_ID[sc.id];
    var v = S.followup.answers[f.id];
    var h = '<h1 class="k-q">ふだんのあなたに近いのは、どちらですか？</h1>';
    h += '<div class="k-pair"><div class="k-side' + (v && v < 3 ? " lit" : "") + '" data-label="上">' + esc(f.left) + "</div>" +
      '<div class="k-side' + (v && v > 3 ? " lit" : "") + '" data-label="下">' + esc(f.right) + "</div></div>";
    h += '<div class="k-choices">' + L.FOLLOWUP_CHOICES.map(function (c) {
      return '<button class="k-choice' + (v === c.value ? " on" : "") + '" data-act="follow" data-v="' + c.value + '">' + esc(c.label) + "</button>";
    }).join("") + "</div>" + backBtn();
    return h;
  }

  // ---- 過去の価値観
  function yearsLabel() { return S.past.period.yearsAgo + "年前"; }

  function tplPeriod() {
    var y = S.past.period.yearsAgo;
    var h = '<p class="k-kicker">STEP 1　過去の価値観</p>';
    h += '<h1 class="k-title">' + y + '年前のあなたは、何を大切にしていましたか？</h1>';
    h += '<p class="k-sub">今の価値観はいったん横に置いて、当時の自分が大切にしていたものを思い出してください。</p>';
    h += '<div class="k-note info">これは、あなたの記憶による振り返りです。当時のあなたを測定した結果ではありません。</div>';
    h += '<div class="k-stack k-foot"><button class="k-btn primary block" data-act="periodOk">' + y + '年前で進む</button></div>';
    h += '<p style="margin-top:14px"><button class="k-link" data-act="periodToggle">' + y + '年前を思い出しにくい・当てはまらない場合</button></p>';
    if (ui.periodOpen) {
      h += '<div class="k-card plain"><p class="k-soft">思い出しやすい時期を選んでください。</p><div class="k-period">';
      L.PAST_PERIOD_OPTIONS.forEach(function (n) {
        h += '<button class="k-choice' + (y === n ? " on" : "") + '" data-act="period" data-n="' + n + '">' + n + '年前</button>';
      });
      h += '</div><p class="k-soft" style="margin-top:12px">その他（1〜40年前）</p>' +
        '<div class="k-row" style="margin-top:6px"><input class="k-input" id="periodOther" type="number" inputmode="numeric" min="1" max="40" placeholder="数字を入力" style="flex:1;min-width:0">' +
        '<button class="k-btn" data-act="periodOther">決定</button></div>' +
        '<div style="margin-top:14px"><button class="k-btn block" data-act="skipPast">思い出せないので、この質問はスキップ</button></div></div>';
    }
    return h + backBtn();
  }

  function pickGrid(pool, selected, max, mode) {
    return '<div class="k-dgrid">' + pool.map(function (d) {
      var on = selected.indexOf(d.id) >= 0;
      return '<button class="k-dcard' + (on ? " on" : "") + '" data-act="' + mode + '" data-id="' + d.id + '" aria-pressed="' + on + '"><b>' + esc(d.name) + "</b><span>" + esc(d.desc) + "</span></button>";
    }).join("") + "</div>";
  }
  function counter(n, max) { return '<p class="k-count">選んだ数　' + n + " / " + max + (ui.flash ? '　<span style="color:var(--warn-text)">' + esc(ui.flash) + "</span>" : "") + "</p>"; }

  function tplPastPick() {
    var p = S.past;
    return '<p class="k-kicker">STEP 1　過去の価値観 ①</p><h1 class="k-q">' + yearsLabel() + 'に、特に大切にしていたことを、3つ選んでください</h1>' +
      '<p class="k-sub">今の価値観はいったん横に置いて、当時を思い出して選びます。順位はつけません。</p>' + counter(p.important.length, 3) +
      pickGrid(DOMAINS, p.important, 3, "pPickToggle") + nextBtn(p.important.length === 3) + backBtn();
  }
  function tplPastTop() {
    var p = S.past;
    var pool = p.important.map(function (id) { return DBY[id]; });
    return '<p class="k-kicker">STEP 1　過去の価値観 ②</p><h1 class="k-q">その3つのうち、いちばん大切だったものを1つ選んでください</h1>' +
      pickGrid(pool, p.top ? [p.top] : [], 1, "pTopSet") + nextBtn(!!p.top) + backBtn();
  }
  function tplPastLess() {
    var p = S.past;
    var pool = DOMAINS.filter(function (d) { return p.important.indexOf(d.id) < 0; });
    return '<p class="k-kicker">STEP 1　過去の価値観 ③</p><h1 class="k-q">' + yearsLabel() + 'に、あまり大切ではなかったことを、3つ選んでください</h1>' +
      '<p class="k-sub">選ばなかったものが「大切ではない」という意味ではありません。</p>' + counter(p.less.length, 3) +
      pickGrid(pool, p.less, 3, "pLessToggle") + nextBtn(p.less.length === 3) + backBtn();
  }
  function chips(ids, cls) { return '<div class="k-sum">' + ids.map(function (id) { return '<span class="k-chip ' + (cls || "") + '">' + esc(DBY[id].name) + "</span>"; }).join("") + "</div>"; }
  function summaryCard(v) {
    return '<div class="k-card"><p class="k-soft">大切にしていた3つ</p>' + chips(v.important.filter(function (id) { return id !== v.top; }), "") +
      '<p class="k-soft" style="margin-top:10px">いちばん大切</p>' + chips([v.top], "top") +
      '<p class="k-soft" style="margin-top:10px">あまり大切ではなかった3つ</p>' + chips(v.less, "less") + "</div>";
  }
  function tplPastConfirm() {
    return '<p class="k-kicker">STEP 1　過去の価値観</p><h1 class="k-q">' + yearsLabel() + 'のあなたは、こうでした</h1>' + summaryCard(S.past) +
      '<div class="k-note info">これはあなたの記憶による振り返りです。当時を測定した結果ではありません。</div>' +
      '<div class="k-stack k-foot"><button class="k-btn primary block" data-act="next">この内容で、次へ</button>' +
      '<button class="k-btn block" data-act="editPast">選び直す</button></div>' + backBtn();
  }

  // ---- STEP2
  function tplS2Intro() {
    return '<p class="k-kicker">STEP 2</p><h1 class="k-title">現在の価値観</h1>' +
      '<p class="k-sub">今のあなたが大切にしていることと、それが今どのくらい満たされているかを聞きます。「大切」と「満たされている」は、別のものとして答えてください。</p>' +
      '<div class="k-card plain"><p class="k-soft">① 大切にしていることを選ぶ（3つ → いちばん → あまり大切でない3つ）</p><p class="k-soft">② 14のことがらが、ここ1か月でどのくらい満たされているかを答える</p></div>' +
      '<div class="k-stack k-foot"><button class="k-btn primary block" data-act="next">STEP 2 をはじめる（約2〜3分）</button></div>' + backBtn();
  }
  function tplCurPick() {
    var c = S.cur;
    return '<p class="k-kicker">STEP 2　大切なこと ①</p><h1 class="k-q">今のあなたが、特に大切にしていることを、3つ選んでください</h1>' +
      '<p class="k-sub">順位はつけません。直感で選んでください。</p>' + counter(c.important.length, 3) +
      pickGrid(DOMAINS, c.important, 3, "cPickToggle") + nextBtn(c.important.length === 3) + backBtn();
  }
  function tplCurTop() {
    var c = S.cur;
    var pool = c.important.map(function (id) { return DBY[id]; });
    return '<p class="k-kicker">STEP 2　大切なこと ②</p><h1 class="k-q">その3つのうち、いちばん大切なものを1つ選んでください</h1>' +
      pickGrid(pool, c.top ? [c.top] : [], 1, "cTopSet") + nextBtn(!!c.top) + backBtn();
  }
  function tplCurLess() {
    var c = S.cur;
    var pool = DOMAINS.filter(function (d) { return c.important.indexOf(d.id) < 0; });
    return '<p class="k-kicker">STEP 2　大切なこと ③</p><h1 class="k-q">今、あまり大切ではないことを、3つ選んでください</h1>' +
      '<p class="k-sub">選ばなかったものが「大切ではない」という意味ではありません。</p>' + counter(c.less.length, 3) +
      pickGrid(pool, c.less, 3, "cLessToggle") + nextBtn(c.less.length === 3) + backBtn();
  }
  function tplCurConfirm() {
    return '<p class="k-kicker">STEP 2　大切なこと</p><h1 class="k-q">今のあなたは、こうです</h1>' + summaryCard(S.cur) +
      '<div class="k-stack k-foot"><button class="k-btn primary block" data-act="next">この内容で、次へ（満たされ具合を答える）</button>' +
      '<button class="k-btn block" data-act="editCur">選び直す</button></div>' + backBtn();
  }
  function tplFulfil(sc) {
    var d = DBY[sc.id], v = S.cur.fulfil[d.id];
    var h = '<p class="k-kicker">STEP 2　満たされ具合</p><h1 class="k-q">いま、' + qn(d.id) + 'は、どのくらい満たされていますか？</h1>';
    h += '<p class="k-sub">' + esc(d.desc) + '<br>ここ1か月くらいの、あなたの実感で答えてください。</p>';
    h += '<div class="k-choices" style="margin-top:14px">' + L.FULFIL_LABELS.map(function (lb, i) {
      return '<button class="k-choice' + (v === i + 1 ? " on" : "") + '" data-act="fulfil" data-v="' + (i + 1) + '">' + esc(lb) + "</button>";
    }).join("") + "</div>" + backBtn();
    return h;
  }

  // ---- STEP3
  function tplS3Intro() {
    return '<p class="k-kicker">STEP 3</p><h1 class="k-title">今の状態</h1>' +
      '<p class="k-sub">ここ1週間の、あなたのコンディションを聞きます。日によって変わるものなので、性格とは別のものです。</p>' +
      '<div class="k-card plain"><p class="k-soft">6問。「ふだんのやり方」ではなく、「最近の様子」で答えてください。</p></div>' +
      '<div class="k-stack k-foot"><button class="k-btn primary block" data-act="next">STEP 3 をはじめる（約1分）</button></div>' + backBtn();
  }
  function tplState(sc) {
    var it = L.STATE_BY_ID[sc.id], v = S.state[it.id], ch = L.stateChoices(it);
    var h = '<p class="k-kicker">STEP 3　ここ1週間</p><h1 class="k-q">' + esc(it.q) + "</h1>";
    h += '<div class="k-choices" style="margin-top:14px">' + ch.map(function (lb, i) {
      return '<button class="k-choice' + (v === i + 1 ? " on" : "") + '" data-act="state" data-v="' + (i + 1) + '">' + esc(lb) + "</button>";
    }).join("") + "</div>" + backBtn();
    return h;
  }

  // ---------------------------------------------------------------- 結果
  var CATS = { creative: "創造型", momentum: "推進型", synergy: "共創型" };
  function viewResult() {
    var R = C.buildResult(S);
    var h = topBar(null) + '<div class="k-view">';
    h += '<p class="k-kicker">RESULT　あなたの人物像</p>';

    // 1) 人物像 + 大きなキャラクター
    var tm = R.shownType;
    h += '<div class="k-hero">';
    if (tm) {
      h += '<div class="k-hero-img" style="--tc:' + esc(tm.color) + '"><img src="/' + esc(tm.image) + '" alt="' + esc(tm.nameJp) + '" width="400" height="600" /></div>' +
        '<div class="k-typename">' + esc(tm.nameJp) + "<small>" + esc(tm.nameEn) + '</small></div><div class="k-typecap">あなたに最も近い代表タイプ</div>';
    } else {
      h += '<div class="k-core-mark" aria-hidden="true">核</div><div class="k-typename">タイプは保留</div>' +
        '<div class="k-typecap">今回の回答からは、一つの代表タイプには絞りきれませんでした。</div>';
    }
    h += "</div>";
    h += '<div class="k-portrait">' + R.portrait.sentences.map(function (s) { return '<p class="lead">' + esc(s) + "</p>"; }).join("");
    R.portrait.how.forEach(function (t) { h += '<p style="margin-top:14px">' + esc(t) + "</p>"; });
    R.portrait.scenes.forEach(function (sc) { h += '<div class="k-scene"><b>' + esc(sc.label) + "</b><p>" + esc(sc.text) + "</p></div>"; });
    if (R.portrait.mixed.length) {
      h += '<p class="k-soft" style="margin-top:14px">' + R.portrait.mixed.map(esc).join("<br>") + "</p>";
    }
    h += "</div>";
    h += '<div class="k-note info">この人物像は、あなたが答えた36問のうち、はっきり寄りが出た軸だけから書いています。12TYPEは入口にすぎません。文章の正確性は、まだ検証していません。</div>';
    if (R.type.note === "weak" && tm) {
      h += '<div class="k-note">タイプとの近さは弱めです。いちばん近い代表タイプとして、参考程度に見てください。</div>';
    }

    h += '<div class="k-stack k-foot"><button class="k-btn primary block" data-act="openBook">PERSONAL BOOK を開く（5章）</button></div>';

    // 2) KAKU GAP
    h += '<h2 class="k-h2">KAKU GAP　価値観のズレと変化</h2>';
    h += '<p class="k-soft">総合点は出しません。「大切なこと」と「満たされ具合」の関係、そして過去から今への変化を、言葉でそのまま示します。</p>';
    h += '<h3 class="k-h3">① 大切にしていることと、満たされ具合</h3>';
    if (R.gapFulfil) {
      if (R.gapFulfil.lead) h += '<p style="margin:6px 0">' + esc(R.gapFulfil.lead) + "</p>";
      h += '<div class="k-card"><div class="k-rows">' + R.gapFulfil.rows.map(function (r) {
        return '<div class="k-rowitem"><div class="nm">' + (r.isTop ? '<span class="k-star">★</span>' : "") + esc(r.name) +
          '</div><div class="tx"><span class="k-st ' + r.bucket + '">' + { low: "満たされていない", mid: "どちらとも", high: "満たされている" }[r.bucket] + "</span><br>" + esc(r.text) + "</div></div>";
      }).join("") + '</div></div><p class="k-faint">★ ＝ いちばん大切にしていること。「ここ1か月くらい」の実感です。</p>';
    } else {
      h += '<p class="k-soft">まだ回答がそろっていません。</p>';
    }
    h += '<h3 class="k-h3">② 過去から今への、価値観の変化</h3>';
    if (R.change) {
      h += '<div class="k-card">' + R.change.map(function (l) { return '<div class="k-line ' + (l.kind === "big" ? "big" : "") + '">' + esc(l.text) + "</div>"; }).join("") + "</div>" +
        '<p class="k-faint">これはあなたの記憶による振り返りです。「大切でなくなった」という意味ではなく、「3つの枠に入らなかった」ということです。</p>';
    } else if (R.pastSkipped) {
      h += '<p class="k-soft">過去の質問をスキップしたため、変化は表示しません。</p>';
    } else {
      h += '<p class="k-soft">まだ回答がそろっていません。</p>';
    }
    h += '<details class="k-det"><summary>まだ測れていないこと</summary><div class="in"><p>「生まれ持った傾向（CORE6）を、いま活かせているか」のズレは、まだ測れていません。この体験版では判定していません。</p></div></details>';

    // 3) 今の状態
    h += '<h2 class="k-h2">今の状態　ここ1週間</h2>';
    if (R.state) {
      h += '<div class="k-card"><p>' + esc(R.state.summary) + '</p><div class="k-rows" style="margin-top:12px">' + R.state.rows.map(function (r) {
        return '<div class="k-rowitem"><div class="nm">' + esc(r.name) + '</div><div class="tx">' + (r.word ? '<span class="k-st ' + r.key + '">' + esc(r.word) + "</span>" : "—") +
          (r.validating ? ' <span class="k-tag gold">検証中</span>' : "") + "</div></div>";
      }).join("") + "</div></div>" +
        '<p class="k-faint">この状態は日によって変わります。性格とは別のものです。「検証中」の2項目は、設問の妥当性をこれから確かめる段階で、人物像には使っていません。</p>';
    } else {
      h += '<p class="k-soft">まだ回答がそろっていません。</p>';
    }

    // 4) 詳細（折りたたみ）
    h += '<h2 class="k-h2">詳しい中身</h2>';
    h += detailCore(R) + detailType(R);

    // 5) メモ・操作
    h += '<h2 class="k-h2">体験したご感想</h2><p class="k-soft">気になったところを書いておくと、書き出したデータに含まれます。この画面から外には送られません。</p>' +
      '<textarea class="k-input" id="surveyNote" placeholder="分かりにくかった設問、しっくりこなかった文章など">' + esc(S.survey.note || "") + "</textarea>";
    h += '<div class="k-stack k-foot"><button class="k-btn primary block" data-act="openBook">PERSONAL BOOK を開く</button>' +
      '<button class="k-btn block" data-act="data">回答データを書き出す・削除する</button>' +
      '<button class="k-btn ghost block" data-act="reset">' + (ui.confirmReset ? "本当に消して、最初からやり直す（もう一度押す）" : "最初からやり直す") + "</button></div>";
    h += '<div class="k-note" style="margin-top:22px"><b>未検証の試作版です。</b>採点（' + esc(L.VERSIONS.core) + "）と文章（" + esc(L.VERSIONS.book) + "）は、実際の利用者で確かめていません。診断・医療・採用の判断には使わないでください。</div>";
    return h + "</div>";
  }

  function detailCore(R) {
    var h = '<details class="k-det"><summary>CORE6の中身（数字・理由・設問ID）</summary><div class="in">' +
      '<p class="k-soft">6つの軸ごとに、6問の回答から位置を出しています（50が中央、左右に25ずつ）。</p>';
    L.CORE.AXES.forEach(function (ax) {
      var a = R.core.axes[ax.id];
      if (!a || a.status !== "ok") return;
      var ids = ITEMS.filter(function (it) { return it.axis === ax.id; }).map(function (it) {
        var r = S.answers[it.id];
        return it.id + ":" + (r ? (L.ENGINE.aValue(it, r) > 0 ? "+" : "") + L.ENGINE.aValue(it, r) : "–");
      }).join("　");
      h += '<div class="k-ax"><div class="k-between"><b>' + esc(ax.nameJp) + "（" + esc(ax.nameEn) + ')</b><span class="k-soft">' + esc(a.reading.label.length > 22 ? "場面で違い" : a.reading.label) + "</span></div>" +
        '<div class="k-axbar"><i style="left:' + Math.max(0, Math.min(100, a.position)).toFixed(1) + '%"></i></div>' +
        '<div class="k-axends"><span>' + esc(ax.poleB) + "</span><span>位置 " + a.position.toFixed(1) + "</span><span>" + esc(ax.poleA) + "</span></div>" +
        '<p class="k-mono" style="margin-top:4px">' + esc(ids) + "（+は" + esc(ax.poleA) + "側、−は" + esc(ax.poleB) + "側）</p></div>";
    });
    return h + "</div></details>";
  }

  function detailType(R) {
    var T = R.type, st = T.finalStage;
    var label = { 1: "① 明確：近さの差がはっきりしていました。", 2: "② 僅差で選ばれました。1位と2位の差が小さいため、あらかじめ決めた同点ルールで1つに決めています。", 3: "③ 根拠が弱い判定でした。" }[st] || "";
    var h = '<details class="k-det"><summary>12TYPEの判定について</summary><div class="in">';
    h += "<p>" + esc(label) + "</p>";
    if (T.internal && T.internal.afterFollowup) h += "<p>追加質問（" + S.followup.asked.length + "問）に答えたあと、対象の軸だけ9問で再計算しています。</p>";
    if (T.held) h += "<p>追加質問のあとでも根拠が弱かったため、タイプは保留にしています。「判定不能」ではなく、人物像はCORE6・価値観・状態から書いています。</p>";
    if (T.note === "weak") h += "<p>近さは弱めです（追加質問の対象になる軸がありませんでした）。</p>";
    h += '<p class="k-faint">表示するタイプは常に1つだけです。判定のしくみ：' + esc(L.VERSIONS.type) + "／追加質問：" + esc(L.VERSIONS.followup) + "。分類の基準は暫定で、実際の利用者では検証していません。</p>";
    return h + "</div></details>";
  }

  // ---------------------------------------------------------------- PERSONAL BOOK
  function viewBook() {
    var R = C.buildResult(S);
    var pages = R.book.pages, n = pages.length;
    var i = S.bookPage;
    var h = topBar(null) + '<div class="k-view">';
    if (i < 0) {
      var tm = R.shownType;
      h += '<div class="k-cover"><p class="k-kicker" style="margin:0">PERSONAL BOOK</p>';
      h += tm ? '<div class="k-hero-img" style="--tc:' + esc(tm.color) + ';width:min(48vw,190px)"><img src="/' + esc(tm.image) + '" alt="' + esc(tm.nameJp) + '" /></div>' : '<div class="k-core-mark" style="font-size:48px">核</div>';
      h += '<div class="ttl">あなたのための、小さな本</div><p class="for">全5章・' + n + 'ページ　／　体験版（book-0.3.0-draft）</p></div>';
      h += '<div class="k-card plain"><p><b>この本について</b></p><p class="k-soft">あなたの36問・価値観・ここ1週間の状態の答えから、読み取れたことだけを書いています。答えていないことは、書いていません。外れているところは、外れていると思って読んでください。</p></div>';
      h += '<div class="k-stack k-foot"><button class="k-btn primary block" data-act="bookGo" data-i="0">1ページ目をひらく</button>' +
        '<button class="k-btn ghost block" data-act="toResult">← 結果に戻る</button></div>';
      return h + "</div>";
    }
    var pg = pages[i];
    h += '<div class="k-chaps">' + R.book.chapters.map(function (c) {
      var first = pages.filter(function (p) { return p.chapter === c.n; })[0];
      return first ? '<button class="k-chap' + (pg.chapter === c.n ? " on" : "") + '" data-act="bookGo" data-i="' + first.index + '">第' + c.n + "章　" + esc(c.title) + "</button>" : "";
    }).join("") + "</div>";
    h += '<div class="k-page"><div class="chno">第' + pg.chapter + '章　' + esc(R.book.chapters[pg.chapter - 1].title) + '</div><h1 class="pt">' + esc(pg.title) + "</h1>";
    h += '<p class="pl">' + esc(pg.lead) + '</p><div class="bd">' + pg.blocks.map(blockHtml).join("") + "</div></div>";
    h += '<div class="k-pager"><button class="k-btn" data-act="bookGo" data-i="' + (i - 1) + '">← 前へ</button><span class="pn">' + (i + 1) + " / " + n + "</span>" +
      (i < n - 1 ? '<button class="k-btn primary" data-act="bookGo" data-i="' + (i + 1) + '">次へ →</button>' : '<button class="k-btn primary" data-act="toResult">結果に戻る</button>') + "</div>";
    if (pg.next) h += '<p class="k-next">次のページ：' + esc(pg.next) + "</p>";
    else h += '<p class="k-next">おしまい。感想を、結果画面のメモに書いてください。</p>';
    return h + "</div>";
  }
  function blockHtml(b) {
    if (b.t === "p") return "<p>" + esc(b.text) + "</p>";
    if (b.t === "h") return "<h3>" + esc(b.text) + "</h3>";
    if (b.t === "li") return "<ul>" + b.items.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>";
    if (b.t === "kv") return '<div class="k-kv"><b>' + esc(b.k) + "</b><span>" + esc(b.v) + "</span></div>";
    return "";
  }

  // ---------------------------------------------------------------- データの扱い
  function viewData() {
    var saved = !!storageGet();
    var h = topBar(null) + '<div class="k-view"><p class="k-kicker">データの扱い</p><h1 class="k-title">あなたの回答データについて</h1>';
    h += '<div class="k-card"><p><b>保存</b></p><p class="k-soft">' + (S.consent === true
      ? "「保存して始める」を選んだため、回答をこの端末のブラウザ（localStorage）に保存しています。"
      : "保存していません。ページを閉じると、回答は消えます。") + "</p>" +
      (saved ? '<p class="k-soft">いま、この端末に保存されたデータがあります。</p>' : "") + "</div>";
    h += '<div class="k-card"><p><b>通信</b></p><p class="k-soft">回答は外部のサーバーに送りません。このページには、データを外へ送るコードを入れていません。決済・メール・購入履歴の仕組みとも、つながっていません。</p></div>';
    h += '<div class="k-card"><p><b>公開範囲</b></p><p class="k-soft">このページは検証用で、トップページからのリンクはありません。URLを知っている人は誰でも開けますが、あなたの回答は、他の人には見えません。</p></div>';
    h += '<div class="k-card"><p><b>書き出し</b></p><p class="k-soft">下のボタンを押したときだけ、回答をJSONファイルとして、この端末に保存できます（名前・メール・生年月日は含みません）。</p>' +
      '<div class="k-stack" style="margin-top:10px"><button class="k-btn primary block" data-act="export">JSONファイルとして保存する</button>' +
      '<button class="k-btn block" data-act="copyJson">' + (ui.copied ? "コピーしました" : "JSONをコピーする") + "</button></div></div>";
    h += '<div class="k-card"><p><b>削除</b></p><div class="k-stack" style="margin-top:10px"><button class="k-btn block" data-act="deleteSaved">この端末に保存したデータを削除する</button></div></div>';
    h += '<div class="k-stack k-foot"><button class="k-btn block" data-act="dataBack">← もどる</button></div>';
    return h + "</div>";
  }

  // ---------------------------------------------------------------- 操作
  function go(delta) {
    S.pos += delta;
    if (S.pos < 0) { S.view = "intro"; S.pos = 0; }
    persist(); render();
  }
  function advanceSoon() {
    if (ui.busy) return;
    ui.busy = true;
    setTimeout(function () { ui.busy = false; S.pos += 1; persist(); render(); }, 170);
  }
  function currentScreen() { return screens()[S.pos]; }

  function toggle(list, id, max) {
    var i = list.indexOf(id);
    if (i >= 0) { list.splice(i, 1); ui.flash = ""; return true; }
    if (list.length >= max) { ui.flash = max + "つまでです。外すには、選んだものをもう一度タップ"; return false; }
    list.push(id); ui.flash = ""; return true;
  }
  function cleanPast() {
    var p = S.past;
    if (p.top && p.important.indexOf(p.top) < 0) p.top = null;
    p.less = p.less.filter(function (id) { return p.important.indexOf(id) < 0; });
  }
  function cleanCur() {
    var c = S.cur;
    if (c.top && c.important.indexOf(c.top) < 0) c.top = null;
    c.less = c.less.filter(function (id) { return c.important.indexOf(id) < 0; });
  }
  function jumpTo(kind) {
    var list = screens();
    for (var i = 0; i < list.length; i++) if (list[i].k === kind) { S.pos = i; return; }
  }

  function exportJson() {
    var R = C.buildResult(S);
    return JSON.stringify(L.buildExport(S, R), null, 2);
  }

  function onClick(e) {
    var el = e.target.closest("[data-act]");
    if (!el || !root.contains(el)) return;
    var act = el.getAttribute("data-act"), v = parseInt(el.getAttribute("data-v"), 10), id = el.getAttribute("data-id");
    var sc;
    switch (act) {
      case "start":
        S = fresh(); S.consent = el.getAttribute("data-consent") === "1";
        if (!S.consent) storageDel();
        S.view = "flow"; S.pos = 0; persist(); render(); break;
      case "resume": var sv = loadSaved(); if (sv) { S = sv; persist(); } render(); break;
      case "discard": storageDel(); S = fresh(); render(); break;
      case "back": go(-1); break;
      case "next": S.pos += 1; ui.flash = ""; persist(); render(); break;
      case "core":
        sc = currentScreen();
        S.seconds[sc.id] = Math.min(120, Math.round((Date.now() - ui.t0) / 100) / 10);
        S.answers[sc.id] = v; syncFollowup(); persist();
        if (!ui.busy) { var card = root.querySelectorAll(".k-choice"); for (var i = 0; i < card.length; i++) card[i].classList.toggle("on", card[i] === el); }
        advanceSoon(); break;
      case "follow": sc = currentScreen(); S.followup.answers[sc.id] = v; persist(); advanceSoon(); break;
      case "periodToggle": ui.periodOpen = !ui.periodOpen; render(); break;
      case "periodOk": S.past.skipped = false; S.past.period.changedByUser = S.past.period.yearsAgo !== 3; ui.periodOpen = false; S.pos += 1; persist(); render(); break;
      case "period":
        S.past.period.yearsAgo = parseInt(el.getAttribute("data-n"), 10); S.past.period.changedByUser = S.past.period.yearsAgo !== 3; S.past.skipped = false; render(); break;
      case "periodOther":
        var inp = document.getElementById("periodOther"), n = inp ? parseInt(inp.value, 10) : NaN;
        if (n >= 1 && n <= 40) { S.past.period.yearsAgo = n; S.past.period.changedByUser = n !== 3; S.past.skipped = false; render(); }
        else { ui.flash = "1〜40の数字を入れてください"; if (inp) inp.setAttribute("placeholder", ui.flash); }
        break;
      case "skipPast":
        S.past.skipped = true; S.past.important = []; S.past.top = null; S.past.less = [];
        ui.periodOpen = false; persist(); jumpTo("s2intro"); render(); break;
      case "pPickToggle": toggle(S.past.important, id, 3); cleanPast(); persist(); render(); break;
      case "pTopSet": S.past.top = id; persist(); advanceSoon(); break;
      case "pLessToggle": toggle(S.past.less, id, 3); persist(); render(); break;
      case "editPast": jumpTo("pPick"); render(); break;
      case "cPickToggle": toggle(S.cur.important, id, 3); cleanCur(); persist(); render(); break;
      case "cTopSet": S.cur.top = id; persist(); advanceSoon(); break;
      case "cLessToggle": toggle(S.cur.less, id, 3); persist(); render(); break;
      case "editCur": jumpTo("cPick"); render(); break;
      case "fulfil": sc = currentScreen(); S.cur.fulfil[sc.id] = v; persist(); advanceSoon(); break;
      case "state":
        sc = currentScreen(); S.state[sc.id] = v; persist();
        if (L.STATE_ITEMS[L.STATE_ITEMS.length - 1].id === sc.id) { ui.busy = true; setTimeout(function () { ui.busy = false; S.view = "result"; S.pos = 0; persist(); render(); }, 170); }
        else advanceSoon();
        break;
      case "openBook": S.view = "book"; S.bookPage = -1; persist(); render(); break;
      case "bookGo": var bi = parseInt(el.getAttribute("data-i"), 10); S.bookPage = bi < 0 ? -1 : bi; persist(); render(); break;
      case "toResult": S.view = "result"; persist(); render(); break;
      case "data": S.prevView = S.view === "data" ? S.prevView : S.view; S.view = "data"; render(); break;
      case "dataBack": S.view = S.prevView || "intro"; render(); break;
      case "export":
        try {
          var blob = new Blob([exportJson()], { type: "application/json" });
          var a = document.createElement("a");
          a.href = URL.createObjectURL(blob); a.download = "kaku-lab-" + new Date().toISOString().slice(0, 10) + ".json";
          document.body.appendChild(a); a.click(); document.body.removeChild(a);
          setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
        } catch (err) { /* 保存できない環境では何もしない（コピーを案内） */ }
        break;
      case "copyJson":
        try {
          var txt = exportJson();
          if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(function () { ui.copied = true; render(); }, function () { /* 何もしない */ });
        } catch (err2) { /* 何もしない */ }
        break;
      case "deleteSaved": storageDel(); S.consent = false; ui.copied = false; render(); break;
      case "reset":
        if (!ui.confirmReset) { ui.confirmReset = true; render(); break; }
        storageDel(); S = fresh(); ui.confirmReset = false; render(); break;
      default: break;
    }
  }
  root.addEventListener("click", onClick);
  root.addEventListener("input", function (e) {
    if (e.target && e.target.id === "surveyNote") { S.survey.note = e.target.value.slice(0, 2000); persist(); }
  });

  // 試験用の読み取り口（画面の動きを自動テストするため。外部へは何も送りません）
  window.KAKU_LAB_APP = { getState: function () { return S; }, setState: function (s) { S = s; render(); }, render: render, screens: screens };

  render();
})();

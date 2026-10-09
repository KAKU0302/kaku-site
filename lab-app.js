/**
 * kaku-lab/lab-app.js
 * 新KAKU診断の画面（トップページの「診断開始」から開く）。STEP1（核・過去の価値観）→ STEP2（現在の価値観）→ STEP3（今の状態）
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
  var root = document.getElementById("kaku-lab-root");
  if (!root) return;

  // ---------------------------------------------------------------- 状態
  function fresh() {
    return {
      v: 1, scale: "agree5", consent: null, view: "intro", pos: 0,
      answers: {}, seconds: {}, discomfort: {},
      followup: { asked: [], answers: {} },
      past: { period: { yearsAgo: 3, changedByUser: false }, important: [], top: null, less: [], skipped: false },
      cur: { important: [], top: null, less: [], fulfil: {} },
      state: {}, survey: {}, bookPage: -1, prevView: "intro"
    };
  }
  var S = fresh();
  var ui = { dir: 1, prevPct: 0, parked: null, periodOpen: false, flash: "", t0: Date.now(), confirmReset: false, busy: false, copied: false };

  function storageGet() { try { return window.localStorage.getItem(KEY); } catch (e) { return null; } }
  function storageSet(v) { try { window.localStorage.setItem(KEY, v); return true; } catch (e) { return false; } }
  function storageDel() { try { window.localStorage.removeItem(KEY); } catch (e) { /* 何もしない */ } }
  function persist() { if (S.consent === true) storageSet(JSON.stringify(S)); }
  function loadSaved() {
    var raw = storageGet();
    if (!raw) return null;
    try { var o = JSON.parse(raw); return o && o.v === 1 && o.scale === "agree5" && o.consent === true ? o : null; } catch (e) { return null; }
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
    var focus = S.view === "flow";
    document.body.classList.toggle("kaku-focus", focus);
    measureHeader();
    // 進捗バーは、前の位置からなめらかに伸ばす
    var bar = root.querySelector(".k-bar i[data-pct]");
    if (bar) {
      var to = bar.getAttribute("data-pct");
      ui.prevPct = parseFloat(to);
      window.requestAnimationFrame(function () { window.requestAnimationFrame(function () { bar.style.width = to + "%"; }); });
    }
    ui.dir = 1;
    window.scrollTo(0, 0);
  }

  // 設問以外の画面の上部（サイトのヘッダーの下に出る、現在地と「データの扱い」）
  function topBar(label) {
    return '<div class="k-top k-top--page"><div class="k-top-row"><span class="k-crumb">' + esc(label || "KAKU 診断") + '</span>' +
      '<button class="k-link" data-act="data">データの扱い・検証について</button></div></div>';
  }
  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  // 設問画面の上部：ロゴ／STEP／進捗バー／何問目か
  function flowBar(step, stepName, counter, pct) {
    return '<div class="k-top k-top--flow"><div class="k-top-row">' +
      '<button class="k-logo k-logo-btn" data-act="toTop" aria-label="トップページへ">KAKU <span>～核～</span></button>' +
      '<span class="k-stepchip">STEP <b>' + step + '</b> / 3</span>' +
      '<button class="k-info" data-act="data" aria-label="データの扱い・検証について">i</button></div>' +
      '<div class="k-bar"><i style="width:' + ui.prevPct + '%" data-pct="' + pct + '"></i></div>' +
      '<div class="k-qcount"><span>' + esc(stepName) + '</span><span>' + (counter || "") + "</span></div></div>";
  }

  // ---------------------------------------------------------------- はじめに
  function viewIntro() {
    var saved = loadSaved();
    var h = topBar("診断") + '<div class="k-view k-intro">';
    h += '<div class="k-introhead"><p class="k-kicker">KAKU 診断</p>' +
      '<h1 class="k-title k-title--xl">あなたの核を、<br>解き明かす。</h1>' +
      '<p class="k-sub">3つのステップに答えると、あなたの人物像と、あなただけの本が出ます。</p></div>';
    h += '<ol class="k-steps">' +
      '<li><span class="no">01</span><span class="tx"><b>核と、過去の価値観</b><i>ふだんの動き方 36問</i></span></li>' +
      '<li><span class="no">02</span><span class="tx"><b>いまの価値観</b><i>大切なことと、満たされ具合</i></span></li>' +
      '<li><span class="no">03</span><span class="tx"><b>今の状態</b><i>ここ1週間のコンディション 6問</i></span></li></ol>';
    h += '<p class="k-meta">所要時間の目安　約10〜12分　／　正解はありません</p>';
    if (ui.parked) {
      h += '<div class="k-card"><p><b>さきほどの続きがあります</b></p><p class="k-soft">このページを閉じるまで、この端末のブラウザの中に残っています。</p><div class="k-stack" style="margin-top:8px">' +
        '<button class="k-btn primary block" data-act="resumeMem">続きに戻る</button></div></div>';
    } else if (saved) {
      h += '<div class="k-card"><p><b>前回の続きがあります</b></p><div class="k-stack" style="margin-top:8px">' +
        '<button class="k-btn primary block" data-act="resume">続きから再開する</button>' +
        '<button class="k-btn block" data-act="discard">保存したデータを消して、最初から</button></div></div>';
    }
    h += '<div class="k-stack k-foot">' +
      '<button class="k-btn primary block k-btn--lg" data-act="start" data-consent="1">保存して始める</button>' +
      '<button class="k-btn block" data-act="start" data-consent="0">保存しないで始める</button></div>';
    h += '<p class="k-fine">回答は、あなたのブラウザの外には送りません。「保存して始める」は、途中で閉じても続きから再開できるよう、この端末にだけ保存します（いつでも削除できます）。</p>';
    h += '<details class="k-det"><summary>くわしく（データの扱い・検証の状況）</summary><div class="in"><ul class="k-list k-soft">' +
      '<li>名前・メールアドレス・生年月日は聞きません。</li>' +
      '<li>「保存しないで始める」を選ぶと、何も保存しません。ページを閉じると、回答は消えます。</li>' +
      '<li>採点のしくみも文章も、まだ実際の利用者で確かめていない暫定版です。結果は「今回の回答から読み取れる範囲」の目安として、気軽に読んでください。</li>' +
      '<li>所要時間は設問の文字数からの見積もりで、実測ではありません。いつでも戻って答えを直せます。</li></ul></div></details>';
    h += '<p style="margin-top:16px;text-align:center"><button class="k-link" data-act="toTop">← トップページへ戻る</button></p>';
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
    if (sc.k === "q") { qi = ITEMS.map(function (i) { return i.id; }).indexOf(sc.id) + 1; right = "<b>" + pad2(qi) + "</b> / 36"; }
    else if (sc.k === "f") { qi = S.followup.asked.indexOf(sc.id) + 1; right = "追加 <b>" + pad2(qi) + "</b> / " + pad2(S.followup.asked.length); }
    else if (sc.k === "fu") { qi = DOMAINS.map(function (d) { return d.id; }).indexOf(sc.id) + 1; right = "満たされ具合 <b>" + pad2(qi) + "</b> / 14"; }
    else if (sc.k === "st") { qi = L.STATE_ITEMS.map(function (d) { return d.id; }).indexOf(sc.id) + 1; right = "<b>" + pad2(qi) + "</b> / 06"; }
    var h = flowBar(step, stepNames[step], right, pct);
    ui.nextPct = pct;
    h += '<div class="k-view' + (ui.dir < 0 ? " back" : "") + '">';
    var body = ({
      s1intro: tplS1Intro, q: tplCore, fintro: tplFIntro, f: tplFollow, pPeriod: tplPeriod, pPick: tplPastPick, pTop: tplPastTop,
      pLess: tplPastLess, pConfirm: tplPastConfirm, s2intro: tplS2Intro, cPick: tplCurPick, cTop: tplCurTop, cLess: tplCurLess,
      cConfirm: tplCurConfirm, fu: tplFulfil, s3intro: tplS3Intro, st: tplState
    })[sc.k](sc);
    return h + body + "</div>";
  }

  function backBtn(label) { return '<div class="k-back"><button class="k-btn ghost" data-act="back">← ' + (label || "戻る") + "</button></div>"; }
  function nextBtn(enabled, label) {
    return '<div class="k-sticky"><button class="k-btn primary block" data-act="next"' + (enabled ? "" : " disabled") + ">" + (label || "次へ") + "</button></div>";
  }

  function tplS1Intro() {
    return '<p class="k-kicker">STEP 1</p><h1 class="k-title">核と過去の価値観</h1>' +
      '<p class="k-sub">ここでは、仕事や日常で、あなたがふだんどう考え、どう動くかを聞きます。正解はありません。深く考えず、直感で選んでください。</p>' +
      '<div class="k-card plain"><p class="k-soft">1つの文が出ます。ふだんのあなたに、どのくらいあてはまるかを、横に並んだ5つのボタン（1〜5）から選んでください。1つ選ぶと、すぐ次へ進みます。間違えたら「戻る」で直せます。</p>' +
      '<p class="k-soft">そのあと、昔の自分が大切にしていたことを振り返ります。</p></div>' +
      '<div class="k-note info">ここでいう「核」は、あなたが答えたふだんの傾向のことです。生まれつきの性質を測るものではありません。</div>' +
      '<div class="k-stack k-foot"><button class="k-btn primary block" data-act="next">STEP 1 をはじめる（約6〜8分）</button></div>' + backBtn();
  }

  // 1つの文 ＋ 横並びの5段階（36問も追加質問も同じ形）。回答値 r は 1=全くあてはまらない … 5=かなりあてはまる
  //  下の注釈は「全く／あまり／どちらとも／少し／かなり」を各ボタンの下に、「あてはまらない／いえない／あてはまる」を同じ語の列にまたがって出す。
  function likertBlock(item, choices, act, v) {
    var sel = null;
    choices.forEach(function (c) { if (c.value === v) sel = c; });
    var h = '<p class="k-qlead">どのくらい、あてはまりますか？</p>';
    h += '<h1 class="k-q2" id="kstmt">' + esc(item.text) + "</h1>";
    h += '<p class="k-lkread' + (sel ? " set" : "") + '" aria-live="polite">' + (sel ? esc(sel.label) : "いちばん近いものを、1つタップ") + "</p>";
    h += '<div class="k-lk" role="group" aria-labelledby="kstmt" style="--n:' + choices.length + '">' + choices.map(function (c) {
      return '<button type="button" class="k-lkb st' + c.strength + (v === c.value ? " on" : "") + '" data-act="' + act + '" data-v="' + c.value +
        '" aria-pressed="' + (v === c.value) + '" aria-label="' + esc(c.label) + '">' + c.value + "</button>";
    }).join("") + "</div>";
    // 注釈：1行目＝副詞（各列）、2行目＝同じ語が続く列をまとめて1つ
    h += '<div class="k-lkcap" aria-hidden="true" style="--n:' + choices.length + '">' + choices.map(function (c) {
      return '<span class="adv' + (v === c.value ? " hit" : "") + '" data-v="' + c.value + '">' + esc(c.adv) + "</span>";
    }).join("");
    var i = 0;
    while (i < choices.length) {
      var j = i, vals = [];
      while (j < choices.length && choices[j].tail === choices[i].tail) { vals.push(choices[j].value); j++; }
      h += '<span class="tl' + (vals.indexOf(v) >= 0 ? " hit" : "") + '" data-vs="' + vals.join(",") + '" style="grid-column:span ' + (j - i) + '">' + esc(choices[i].tail) + "</span>";
      i = j;
    }
    return h + "</div>";
  }
  function tplCore(sc) {
    var it = ITEMS.filter(function (x) { return x.id === sc.id; })[0];
    return likertBlock(it, CHOICES, "core", S.answers[it.id]) + backBtn("前の質問に戻る");
  }

  function tplFIntro() {
    return '<p class="k-kicker">もう少しだけ</p><h1 class="k-title">あと ' + S.followup.asked.length + ' 問、教えてください</h1>' +
      '<p class="k-sub">ここまでの答えでは、あなたに近いタイプを一つに絞る手がかりが、少し足りませんでした。似た質問を、別の場面で聞きます。</p>' +
      '<div class="k-note info">この追加質問で、判定が正確になったとは言えません。タイプを決めるときの材料が増えるだけです。</div>' +
      '<div class="k-stack k-foot"><button class="k-btn primary block" data-act="next">答える</button></div>' + backBtn();
  }

  function tplFollow(sc) {
    var f = L.FOLLOWUP_BY_ID[sc.id];
    return likertBlock(f, L.FOLLOWUP_CHOICES, "follow", S.followup.answers[f.id]) +
      '<p class="k-faint" style="text-align:center;margin-top:8px">この追加質問は「どちらともいえない」がなく、4つから近いものを選びます。</p>' + backBtn("前の質問に戻る");
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
    var h = topBar("RESULT") + '<div class="k-view k-result">';
    h += '<p class="k-kicker k-kicker--c">YOUR KAKU</p>';

    // 1) 人物像 + 大きなキャラクター
    var tm = R.shownType;
    h += '<div class="k-hero">';
    if (tm) {
      h += '<div class="k-hero-img" style="--tc:' + esc(tm.color) + '"><img src="/' + esc(tm.image) + '" alt="' + esc(tm.nameJp) + '" width="400" height="600" /></div>' +
        '<div class="k-typename">' + esc(tm.nameJp) + "<small>" + esc(tm.nameEn) + '</small></div><div class="k-typecap">あなたに最も近い代表タイプ</div><div class="k-orn" aria-hidden="true"><i></i><b>◆</b><i></i></div>';
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
    h += unconnectedNote();
    h += '<div class="k-stack k-foot"><button class="k-btn primary block" data-act="openBook">PERSONAL BOOK を開く</button>' +
      '<button class="k-btn block" data-act="data">回答データを書き出す・削除する</button>' +
      '<button class="k-btn ghost block" data-act="reset">' + (ui.confirmReset ? "本当に消して、最初からやり直す（もう一度押す）" : "最初からやり直す") + "</button></div>";
    h += '<div class="k-note" style="margin-top:22px"><b>未検証の試作版です。</b>採点（' + esc(L.VERSIONS.core) + "）と文章（" + esc(L.VERSIONS.book) + "）は、実際の利用者で確かめていません。診断・医療・採用の判断には使わないでください。</div>";
    return h + "</div>";
  }

  // 新しい診断に、まだつながっていない既存機能の案内（つながっているように見せない）
  function unconnectedNote() {
    return '<div class="k-card plain"><p><b>この結果とつながっていない機能（未接続）</b></p><ul class="k-list k-soft">' +
      '<li>「履歴」画面：この新しい結果は、まだ履歴に保存されません。</li>' +
      '<li>有料の詳しいPERSONAL BOOK（17ページ版）、KAKU MATCH、KAKU TEAM：この新しい診断の結果からは、まだ購入・利用できません。</li>' +
      '<li>購入済みの方：メールで届いたリンクから、これまでどおり開けます（変更していません）。</li></ul>' +
      '<p class="k-faint" style="margin-top:8px"><button class="k-link" data-act="openOldPaid">これまでの診断で購入手続きに進む（従来版）</button></p></div>';
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
        '<p class="k-mono" style="margin-top:4px">' + esc(ids) + "（+は" + esc(ax.poleA) + "側、−は" + esc(ax.poleB) + "側。逆転項目は向きを反転して数えています）</p></div>";
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
    var h = topBar("PERSONAL BOOK") + '<div class="k-view k-bookview">';
    if (i < 0) {
      var tm = R.shownType;
      h += '<div class="k-cover"><div class="k-cover-in"><p class="k-cover-kicker">PERSONAL BOOK</p><div class="k-orn" aria-hidden="true"><i></i><b>◆</b><i></i></div>';
      h += tm ? '<div class="k-hero-img k-cover-img" style="--tc:' + esc(tm.color) + '"><img src="/' + esc(tm.image) + '" alt="' + esc(tm.nameJp) + '" /></div>' : '<div class="k-core-mark" style="font-size:48px">核</div>';
      h += '<div class="ttl">あなたのための、<br>小さな本</div><p class="for">全5章・' + n + 'ページ</p><p class="cmark">KAKU ～核～</p></div></div>';
      h += '<div class="k-card plain"><p><b>この本について</b></p><p class="k-soft">あなたの36問・価値観・ここ1週間の状態の答えから、読み取れたことだけを書いています。答えていないことは、書いていません。外れているところは、外れていると思って読んでください。</p><p class="k-faint" style="margin-top:8px">文章は暫定版（' + esc(L.VERSIONS.book) + '）で、実際の利用者では未検証です。</p></div>';
      h += '<div class="k-stack k-foot"><button class="k-btn primary block" data-act="bookGo" data-i="0">1ページ目をひらく</button>' +
        '<button class="k-btn ghost block" data-act="toResult">← 結果に戻る</button></div>';
      return h + "</div>";
    }
    var pg = pages[i];
    h += '<div class="k-chaps">' + R.book.chapters.map(function (c) {
      var first = pages.filter(function (p) { return p.chapter === c.n; })[0];
      return first ? '<button class="k-chap' + (pg.chapter === c.n ? " on" : "") + '" data-act="bookGo" data-i="' + first.index + '">第' + c.n + "章　" + esc(c.title) + "</button>" : "";
    }).join("") + "</div>";
    h += '<div class="k-page"><div class="chno"><span class="n">' + pad2(pg.chapter) + '</span><span class="t">第' + pg.chapter + '章　' + esc(R.book.chapters[pg.chapter - 1].title) + '</span></div><h1 class="pt">' + esc(pg.title) + "</h1>";
    h += '<p class="pl">' + esc(pg.lead) + '</p><div class="bd">' + pg.blocks.map(blockHtml).join("") + '</div><div class="pfoot"><span>KAKU ～核～</span><span>' + (i + 1) + ' / ' + n + "</span></div></div>";
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
    var h = topBar("データの扱い") + '<div class="k-view"><p class="k-kicker">データの扱い</p><h1 class="k-title">あなたの回答データについて</h1>';
    h += '<div class="k-card"><p><b>保存</b></p><p class="k-soft">' + (S.consent === true
      ? "「保存して始める」を選んだため、回答をこの端末のブラウザ（localStorage）に保存しています。"
      : "保存していません。ページを閉じると、回答は消えます。") + "</p>" +
      (saved ? '<p class="k-soft">いま、この端末に保存されたデータがあります。</p>' : "") + "</div>";
    h += '<div class="k-card"><p><b>通信</b></p><p class="k-soft">回答は外部のサーバーに送りません。このページには、データを外へ送るコードを入れていません。決済・メール・購入履歴の仕組みとも、まだつながっていません。</p></div>';
    h += '<div class="k-card"><p><b>この診断について（検証の状況）</b></p><ul class="k-list k-soft">' +
      '<li>採点のしくみ（' + esc(L.VERSIONS.core) + '）・12TYPEの判定（' + esc(L.VERSIONS.type) + '）・文章（' + esc(L.VERSIONS.book) + '）は、まだ実際の利用者で確かめていない暫定版です。</li>' +
      '<li>設問の文は、読みやすさのために書き直しています（変更の履歴は、書き出したデータに入ります）。分かりやすさも未検証です。</li>' +
      '<li>結果は「今回の回答から読み取れる範囲」の目安です。診断・医療・採用の判断には使わないでください。</li></ul></div>';
    h += '<div class="k-card"><p><b>書き出し</b></p><p class="k-soft">下のボタンを押したときだけ、回答をJSONファイルとして、この端末に保存できます（名前・メール・生年月日は含みません）。</p>' +
      '<div class="k-stack" style="margin-top:10px"><button class="k-btn primary block" data-act="export">JSONファイルとして保存する</button>' +
      '<button class="k-btn block" data-act="copyJson">' + (ui.copied ? "コピーしました" : "JSONをコピーする") + "</button></div></div>";
    h += '<div class="k-card"><p><b>削除</b></p><div class="k-stack" style="margin-top:10px"><button class="k-btn block" data-act="deleteSaved">この端末に保存したデータを削除する</button></div></div>';
    h += '<div class="k-stack k-foot"><button class="k-btn block" data-act="dataBack">← もどる</button></div>';
    return h + "</div>";
  }

  // ---------------------------------------------------------------- 操作
  function go(delta) {
    if (ui.busy) return;
    ui.dir = delta < 0 ? -1 : 1;
    S.pos += delta;
    if (S.pos < 0) { S.view = "intro"; S.pos = 0; }
    persist(); render();
  }
  // 選んだ瞬間の反応：選んだボタンと注釈、「選んだ答え」の表示を変える
  function markPicked(el, v) {
    var all = root.querySelectorAll(".k-lkb"), i, label = el.getAttribute("aria-label") || "";
    for (i = 0; i < all.length; i++) { all[i].classList.toggle("on", all[i] === el); all[i].setAttribute("aria-pressed", all[i] === el ? "true" : "false"); }
    var advs = root.querySelectorAll(".k-lkcap .adv");
    for (i = 0; i < advs.length; i++) advs[i].classList.toggle("hit", parseInt(advs[i].getAttribute("data-v"), 10) === v);
    var tls = root.querySelectorAll(".k-lkcap .tl");
    for (i = 0; i < tls.length; i++) tls[i].classList.toggle("hit", ("," + tls[i].getAttribute("data-vs") + ",").indexOf("," + v + ",") >= 0);
    var rd = root.querySelector(".k-lkread");
    if (rd) { rd.textContent = label; rd.classList.add("set"); }
  }
  function advanceSoon() {
    if (ui.busy) return;
    ui.busy = true;
    setTimeout(function () { ui.busy = false; ui.dir = 1; S.pos += 1; persist(); render(); }, 260);
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
        S = fresh(); ui.parked = null; S.consent = el.getAttribute("data-consent") === "1";
        if (!S.consent) storageDel();
        S.view = "flow"; S.pos = 0; persist(); render(); break;
      case "openOldPaid": if (window.KAKU_SITE) window.KAKU_SITE.showView("basic"); break;
      case "toTop": if (window.KAKU_SITE) window.KAKU_SITE.showView("top"); break;
      case "resumeMem": if (ui.parked) { S.view = ui.parked; ui.parked = null; render(); } break;
      case "resume": var sv = loadSaved(); if (sv) { S = sv; persist(); } render(); break;
      case "discard": storageDel(); S = fresh(); render(); break;
      case "back": go(-1); break;
      case "next": ui.dir = 1; S.pos += 1; ui.flash = ""; persist(); render(); break;
      case "core":
        sc = currentScreen();
        S.seconds[sc.id] = Math.min(120, Math.round((Date.now() - ui.t0) / 100) / 10);
        S.answers[sc.id] = v; syncFollowup(); persist();
        markPicked(el, v); advanceSoon(); break;
      case "follow": sc = currentScreen(); S.followup.answers[sc.id] = v; persist(); markPicked(el, v); advanceSoon(); break;
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
  // トップページの「診断開始」から呼ばれる。途中まで進めた内容が（このページを開いている間）残っていれば、続きに戻れるようにする
  function open() {
    measureHeader();
    var hasProgress = S.view !== "intro" && S.view !== "data" && (Object.keys(S.answers).length > 0 || S.view === "result" || S.view === "book");
    if (hasProgress) { ui.parked = S.view; S.view = "intro"; }
    else if (S.view === "data") { S.view = S.prevView || "intro"; }
    render();
  }
  function measureHeader() {
    var hd = document.querySelector(".site-header"), v = document.getElementById("view-lab");
    if (hd && v) v.style.setProperty("--kaku-header-h", hd.offsetHeight + "px");
  }
  window.addEventListener("resize", measureHeader);
  window.KAKU_LAB_APP = { open: open, getState: function () { return S; }, setState: function (s) { S = s; render(); }, render: render, screens: screens };

  render();
})();

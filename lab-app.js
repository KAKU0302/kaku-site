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
      state: {}, bookPage: -1, prevView: "intro"
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
    if (!sameAnswers()) saveToHistory(R);
    var h = topBar("RESULT") + '<div class="k-view k-result">';
    h += '<p class="k-kicker k-kicker--c">YOUR KAKU</p>';

    var same = sameAnswers();
    if (same) {
      // 36問のほとんどが同じ答え：傾向を読み取れない。「場面で使い分けている」などの人物像は出さない
      h += '<div class="k-hero"><div class="k-core-mark" aria-hidden="true">核</div><div class="k-typename">傾向を読み取れませんでした</div>' +
        '<div class="k-typecap">36問のうち ' + same.n + ' 問が、同じ答え（' + esc(same.label) + '）でした。</div></div>' +
        '<div class="k-portrait"><p class="lead">同じ答えが続くと、6つの軸の傾向が打ち消し合って、どれにも寄らない結果になります。</p>' +
        '<p style="margin-top:14px">この診断には、同じ軸について逆向きの文も入っています。たとえば「先に完成形を描く」と「まず事実を集める」の両方に「あてはまる」と答えると、傾向は中央に戻ります。</p>' +
        '<p style="margin-top:14px">直感で、「これは自分っぽい／これは違う」を選び分けて、もう一度答えてみてください。</p></div>' +
        '<div class="k-stack k-foot"><button class="k-btn primary block" data-act="redoCore">36問をもう一度答える</button></div>';
    } else {
    // 1) 人物像 + 大きなキャラクター
    var tm = R.shownType;
    h += '<div class="k-hero">';
    if (tm) {
      h += '<div class="k-hero-img" style="--tc:' + esc(tm.color) + '"><img src="/' + esc(tm.image) + '" alt="' + esc(tm.nameJp) + '" width="400" height="600" /></div>' +
        '<div class="k-typename">' + esc(tm.nameJp) + "<small>" + esc(tm.nameEn) + '</small></div><div class="k-typecap">' + (R.type.note === "weak" ? "いちばん近い代表タイプ（参考）" : "あなたに最も近い代表タイプ") + '</div><div class="k-orn" aria-hidden="true"><i></i><b>◆</b><i></i></div>';
    } else {
      h += '<div class="k-core-mark" aria-hidden="true">核</div><div class="k-typename">タイプは保留</div>' +
        '<div class="k-typecap">どの軸にも、はっきり寄る傾向が見られなかったため、参考にできるタイプも出せませんでした。</div>';
    }
    h += "</div>";
    h += portraitHtml(R);

    // 1.5) CORE6 → 6枠（武器・罠…）
    h += core6Section(R);
    h += cardsSection(R);
    }

    // 2) KAKU GAP（ズレと変化）
    h += gapSection(R);

    // 4) PERSONAL BOOK（無料で分かる範囲の、いちばん下）
    h += same ? "" : bookBanner(R);

    // 5) 操作
    h += '<div class="k-stack k-foot k-endops"><button class="k-btn ghost block" data-act="data">回答データを書き出す・削除する</button>' +
      '<button class="k-btn ghost block" data-act="reset">' + (ui.confirmReset ? "本当に消して、最初からやり直す（もう一度押す）" : "最初からやり直す") + "</button></div>";
    return h + "</div>";
  }

  // ---------------------------------------------------------------- 履歴への保存（結果が出たとき）
  //  「保存して始める」を選んだときだけ、この端末のブラウザの履歴（KAKU_HISTORY）に残す。
  function saveToHistory(R) {
    try {
      if (S.consent !== true || !window.KAKU_HISTORY) return;
      if (!S.rid) { S.rid = "lab-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8); S.ridAt = new Date().toISOString(); persist(); }
      var snap = JSON.parse(JSON.stringify({ v: 1, scale: S.scale, answers: S.answers, seconds: S.seconds, discomfort: S.discomfort, followup: S.followup, past: S.past, cur: S.cur, state: S.state }));
      var entry = {
        id: S.rid, kind: "lab", savedAt: S.ridAt || new Date().toISOString(),
        typeId: R.shownType ? R.shownType.id : null, weak: !!(R.type && R.type.note === "weak"),
        title: R.portrait && R.portrait.title ? R.portrait.title : "", labState: snap
      };
      var sig = JSON.stringify(entry);
      if (ui.histSig === sig) return;
      ui.histSig = sig;
      window.KAKU_HISTORY.upsert(entry);
    } catch (e) { /* 履歴に保存できない環境では何もしない */ }
  }

  // 人物像：回答から見える人物の解釈と、その魅力（褒め）。読み返す・人に見せる前提の読み物
  function portraitHtml(R) {
    var P = R.portrait, tm = R.shownType, h = "";
    if (!P.title) {
      return '<div class="k-portrait"><p class="lead">今回の回答からは、人物像を読み取れませんでした。</p></div>';
    }
    h += '<section class="k-pt">';
    h += '<p class="k-pt-kick">あなたを一言でいうと</p>';
    h += '<h2 class="k-pt-title">' + P.title.split(" × ").map(function (t) { return '<span class="k-pt-t">' + esc(t) + "</span>"; }).join('<span class="k-pt-x" aria-hidden="true"> × </span>') + "</h2>";
    h += '<p class="k-pt-epi">' + esc(P.epithet) + "</p>";
    if (P.typePraise) h += '<p class="k-pt-praise">' + esc(P.typePraise) + "</p>";
    else if (P.wide) h += '<p class="k-pt-praise">' + esc(P.wide) + "</p>";

    h += '<h3 class="k-pt-h">回答から見えた、あなたの魅力</h3><div class="k-pt-cards">';
    P.charms.forEach(function (c, i) {
      h += '<article class="k-pt-card"><div class="k-pt-hd"><span class="k-pt-no" aria-hidden="true">' + (i + 1) + '</span><h4>' + esc(c.title) + '</h4></div><p class="you">' + esc(c.you) + "</p><p>" + esc(c.text) + "</p></article>";
    });
    h += "</div>";

    if (P.twists.length) {
      h += '<h3 class="k-pt-h">意外な一面</h3>';
      P.twists.forEach(function (t) { h += '<p class="k-pt-twist">' + esc(t.text) + "</p>"; });
    }

    if (P.fans.length) {
      h += '<h3 class="k-pt-h">周りは、こう感じているかもしれません</h3><ul class="k-pt-fans">';
      P.fans.forEach(function (f) { h += "<li>「" + esc(f) + "」</li>"; });
      h += "</ul>";
    }

    if (P.closing) h += '<p class="k-pt-close">' + esc(P.closing) + "</p>";
    h += '<div class="k-pt-share"><button class="k-btn ghost block" data-act="copyShare">' + (ui.shared ? "コピーしました。好きな場所に貼ってください" : "この結果をコピーして、誰かに見せる") + "</button></div>";
    h += '<p class="k-pt-note">回答から読み取れた傾向を、前向きな言葉で書いた読み物です。診断や判定ではなく、自分を見つめるきっかけとして読んでください。</p>';
    h += "</section>";
    return h;
  }

  // 共有用の文面（タイプ名は、人物像本文ではなくここで足す）
  function shareText(R) {
    var P = R.portrait, tm = R.shownType, weak = R.type && R.type.note === "weak";
    var t = tm && !weak ? "私のKAKUは「" + tm.nameJp + "」。" : "KAKUで自分を見つめてみました。";
    t += P.title ? "「" + P.title + "」でした。" : "";
    if (P.fans.length) t += "\n周りからは、「" + P.fans[0] + "」と思われているかも。";
    t += "\n#KAKU核診断";
    try { t += "\n" + location.origin + "/"; } catch (e) { /* 取得できない環境では付けない */ }
    return t;
  }

  // CORE6：レーダー＋6つの軸（以前の無料診断結果と同じ並び）
  function radarSvg(R) {
    var W = 340, H = 344, cx = W / 2, cy = 172, maxR = 135, n = L.AXIS_ORDER.length;
    function pt(i, v) { var ang = Math.PI * 2 * i / n - Math.PI / 2, r = v / 100 * maxR; return [cx + r * Math.cos(ang), cy + r * Math.sin(ang)]; }
    var g = "";
    [0.33, 0.66, 1].forEach(function (f) { g += '<polygon points="' + L.AXIS_ORDER.map(function (_, i) { return pt(i, 100 * f).join(","); }).join(" ") + '" class="rg"/>'; });
    var lines = "", labels = "", vals = [];
    L.AXIS_ORDER.forEach(function (id, i) {
      var a = R.core.axes[id], st = a && a.status === "ok" ? Math.min(100, Math.round(Math.sqrt(Math.min(1, Math.abs(a.mean) / 1.25)) * 100)) : 0;
      var e = pt(i, 100), lp = pt(i, 111);
      lines += '<line x1="' + cx + '" y1="' + cy + '" x2="' + e[0].toFixed(1) + '" y2="' + e[1].toFixed(1) + '" class="rg"/>';
      labels += '<text x="' + lp[0].toFixed(1) + '" y="' + lp[1].toFixed(1) + '" class="rl" text-anchor="middle" dominant-baseline="middle">' + esc(AXIS_NAME[id]) + "</text>";
      vals.push(pt(i, Math.max(st, 12)).map(function (x) { return x.toFixed(1); }).join(","));
    });
    return '<svg class="k-radar" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="CORE6レーダーチャート">' + g + lines +
      '<polygon points="' + vals.join(" ") + '" class="rd"/>' + labels + "</svg>";
  }
  var AXIS_NAME = {};
  L.CORE.AXES.forEach(function (ax) { AXIS_NAME[ax.id] = ax.nameJp; });

  function core6Section(R) {
    var h = '<h2 class="k-h2"><span>あなたを構成する6つの力 <span class="k-en">CORE6</span></span></h2>' +
      '<p class="k-soft k-small">レーダーは、6つの軸それぞれで「どちらかの傾向がどれだけはっきり出たか」を表します（外側ほどはっきり）。どちら寄りだったかは、下のバーで見られます。</p>' +
      '<div class="k-radarwrap">' + radarSvg(R) + "</div><div class=\"k-core6g\">";
    L.CORE.AXES.forEach(function (ax) {
      var a = R.core.axes[ax.id];
      if (!a || a.status !== "ok") return;
      var label = a.reading.label;
      if (a.reading.kind === "scene_diff") label = "場面で違う";
      var pos = Math.max(0, Math.min(100, a.position)), lo = Math.min(50, pos), wd = Math.abs(pos - 50);
      h += '<div class="k-c6"><div class="k-c6h"><b>' + esc(ax.nameJp) + '</b><span>（' + esc(label) + "）</span></div>" +
        '<div class="k-dv" role="img" aria-label="' + esc(ax.nameJp + "：" + label) + '"><i style="left:' + lo.toFixed(1) + "%;width:" + wd.toFixed(1) + '%"></i></div>' +
        '<div class="k-c6e"><span>' + esc(ax.poleB) + "</span><span>" + esc(ax.poleA) + "</span></div></div>";
    });
    return h + "</div>";
  }

  // 武器・罠・役割・向き合い方・覚醒・力を失う環境
  function cardsSection(R) {
    if (!R.cards) return "";
    return R.cards.map(function (c) {
      return '<div class="k-card k-rb"><h3>' + esc(c.title) + '<span class="k-en">' + esc(c.en) + "</span></h3><p>" +
        (c.kw && c.kw.length ? "<b>" + c.kw.map(esc).join(" × ") + "</b><br>" : "") + esc(c.text) + "</p></div>";
    }).join("");
  }

  // 36問のうち同じ答えが30問以上なら、その答えの情報を返す（そうでなければ null）
  function sameAnswers() {
    var cnt = {}, best = 0, bv = 0;
    ITEMS.forEach(function (it) { var v = S.answers[it.id]; if (v) { cnt[v] = (cnt[v] || 0) + 1; if (cnt[v] > best) { best = cnt[v]; bv = v; } } });
    if (best < 30) return null;
    var lab = ""; CHOICES.forEach(function (c) { if (c.value === bv) lab = c.label; });
    return { n: best, value: bv, label: lab };
  }

  // ---------------------------------------------------------------- KAKU GAP（ズレと変化）
  var GAP_WORD = { low: "ズレが大きい", mid: "少しズレている", high: "ほぼ満たされている" };

  function gapSection(R) {
    var D = L.DOMAIN_BY_ID, g1 = R.gapFulfilRaw, gs = R.gapScore, cur = R.cur;
    var h = '<h2 class="k-h2"><span>本来の自分と、今の自分の「ズレ」 <span class="k-en">KAKU GAP</span></span></h2>' +
      '<p class="k-soft k-small">「最近なんだか、しっくりこない」と感じるとき、実は、自分が大切にしていることと、いまの毎日がズレているだけかもしれません。優劣を測るものでも、医療的な診断でもありません。</p>';

    if (g1 && gs && cur) {
      var rows = g1.rows.filter(function (r) { return r.fulfil; }).sort(function (a, b) { return (a.fulfil - b.fulfil) || (b.isTop - a.isTop); });
      var first = rows[0];
      var names = cur.important.map(function (id) { return "「" + D[id].name + "」"; }).join("");
      var lows = rows.filter(function (r) { return r.bucket === "low"; });
      var after = lows.length ? "しかし今は、" + lows.map(function (r) { return "「" + r.name + "」"; }).join("") + "が、あまり満たされていません。" :
        first && first.bucket === "mid" ? "いまは、「" + first.name + "」が「どちらともいえない」状態です。" : "いまは、大切にしていることが、おおむね満たされています。";
      h += '<div class="k-gh"><div class="k-ghc"><div class="k-ghb"><p class="tag">大切にしているあなた</p><p>あなたが大切にしているのは、' + esc(names) + "です。</p></div>" +
        '<div class="k-gha" aria-hidden="true">→</div>' +
        '<div class="k-ghb"><p class="tag now">いまのあなた</p><p>' + esc(after) + "</p></div></div>" +
        '<div class="k-ghs"><div class="num ' + gs.tier.key + '">' + gs.score + '</div><div class="bd"><p class="tier">KAKU GAP｜' + esc(gs.tier.label) + "</p>" +
        '<div class="mt"><i class="' + gs.tier.key + '" style="width:' + Math.max(gs.score, 3) + '%"></i></div>' +
        '<p class="cap">0に近いほど「大切にしていることが、いまの毎日で満たされている」、100に近いほど「大切にしていることと、いまの毎日にズレがある」ことを表します。</p></div></div>';
      if (first && first.bucket === "low") {
        h += '<p class="k-ghm"><b>ズレが見られます。</b><br>「' + esc(first.name) + "」について、" + esc(D[first.id].unmet) + "。これは、あなたの力が足りないという意味ではなく、いまの毎日が、あなたの大切なものを満たしにくい形になっている、ということかもしれません。<br>" +
          '<span class="k-ghs1"><b>最初の一歩</b>' + esc(D[first.id].tip) + "</span></p>";
      } else if (first && first.bucket === "mid") {
        h += '<p class="k-ghm"><b>大きなズレはありません。</b><br>大切な3つの中で、「' + esc(first.name) + "」だけは、もう少し満たしたい気持ちがあるのかもしれません。</p>";
      } else {
        h += '<p class="k-ghm"><b>ズレの少ない、いい状態です。</b><br>大切にしていることを、毎日の中で活かせています。この状態を支えているものに、目を向けてみてください。</p>';
      }
      h += "</div>";
      h += '<details class="k-det"><summary>3つの内訳を見る</summary><div class="in"><div class="k-gaprows">' + rows.map(function (r) {
        var pct = r.fulfil * 20;
        return '<div class="k-gaprow ' + r.bucket + '"><div class="k-gaphd"><b>' + (r.isTop ? '<span class="k-star">★</span>' : "") + esc(r.name) + '</b><span class="k-gapchip ' + r.bucket + '">' + GAP_WORD[r.bucket] + "</span></div>" +
          '<div class="k-gb"><span class="lbl">大切さ</span><span class="bar"><i class="imp" style="width:100%"></i></span><span class="val">選んだ</span></div>' +
          '<div class="k-gb"><span class="lbl">満たされ</span><span class="bar"><i class="ful" style="width:' + pct + '%"></i>' + (r.fulfil < 5 ? '<i class="gap" style="left:' + pct + "%;width:" + (100 - pct) + '%"></i>' : "") + '</span><span class="val">' + r.fulfil + " / 5</span></div></div>";
      }).join("") + '</div><p class="k-faint">★ ＝ いちばん大切にしていること。「満たされ」は、ここ1か月くらいの実感（5段階）です。</p></div></details>';

      // 大切にしているあなた／今のあなた（以前の「生まれ持った／今のあなた」と同じ位置）
      h += '<div class="k-card k-rb"><h3>大切にしているあなた｜' + esc(cur.important.map(function (id) { return D[id].name; }).join("・")) + "</h3><p>" +
        cur.important.map(function (id) { return "「" + esc(D[id].name) + "」＝" + esc(D[id].desc) + "。"; }).join("") + "</p></div>";
    } else {
      h += '<p class="k-soft">まだ回答がそろっていません。</p>';
    }

    // 今のあなた（STATE）
    if (R.state) {
      var ov = R.state.rows.filter(function (r) { return r.id === "OVERALL"; })[0];
      h += '<div class="k-card k-rb"><h3>今のあなた｜' + esc(ov && ov.word ? ov.word : "ここ1週間") + "</h3><p>" + esc(R.state.summary) + "　この状態は日によって変わります。性格とは別のものです。</p>" +
        '<details class="k-det"><summary>6項目の内訳を見る</summary><div class="in"><div class="k-rows">' + R.state.rows.map(function (r) {
          return '<div class="k-rowitem"><div class="nm">' + esc(r.name) + '</div><div class="tx">' + (r.word ? '<span class="k-st ' + r.key + '">' + esc(r.word) + "</span>" : "—") + "</div></div>";
        }).join("") + "</div></div></details></div>";
    }

    // 過去から今への、大切なことの変化
    h += '<h3 class="k-h3">過去から今への、大切なことの変化</h3>';
    var ch = R.changeRaw;
    if (ch && R.change) {
      var D2 = L.DOMAIN_BY_ID, dsort = function (ids) { return ids.slice().sort(function (a, b) { return (b === ch.top.past) - (a === ch.top.past) || D2[a].order - D2[b].order; }); };
      var pastIds = ch.kept.concat(ch.dropped.map(function (d) { return d.id; })), curIds = R.cur.important.slice();
      var newMap = {}; ch.added.forEach(function (a) { newMap[a.id] = true; });
      var goneMap = {}; ch.dropped.forEach(function (d) { goneMap[d.id] = true; });
      var chip = function (id, kind, isTop) {
        var tag = kind === "kept" ? "変わらず" : kind === "new" ? "NEW" : "いまは3つの外";
        return '<div class="k-chip6 ' + kind + '"><span class="nm">' + (isTop ? '<span class="k-star">★</span>' : "") + esc(D2[id].name) + '</span><span class="tg">' + tag + "</span></div>";
      };
      h += '<div class="k-gaphero shift"><p class="k-gaplead">' + esc(R.change[0].text) + '</p></div>';
      h += '<div class="k-shift"><div class="col"><p class="hd">' + ch.years + '年前の<br>大切な3つ</p>' +
        dsort(pastIds).map(function (id) { return chip(id, goneMap[id] ? "gone" : "kept", id === ch.top.past); }).join("") + '</div>' +
        '<div class="arr" aria-hidden="true">→</div><div class="col"><p class="hd">いまの<br>大切な3つ</p>' +
        curIds.sort(function (a, b) { return (b === ch.top.cur) - (a === ch.top.cur) || D2[a].order - D2[b].order; }).map(function (id) { return chip(id, newMap[id] ? "new" : "kept", id === ch.top.cur); }).join("") + "</div></div>";
      var rest = R.change.slice(1);
      if (rest.length) {
        h += '<details class="k-det"><summary>ひとつずつ読む</summary><div class="in">' + rest.map(function (l) { return '<div class="k-line ' + (l.kind === "big" ? "big" : "") + '">' + esc(l.text) + "</div>"; }).join("") + "</div></details>";
      }
      h += '<p class="k-faint">これはあなたの記憶による振り返りです。「大切でなくなった」という意味ではなく、「3つの枠に入らなかった」ということです。</p>';
    } else if (R.pastSkipped) {
      h += '<p class="k-soft">過去の質問をスキップしたため、変化は表示しません。</p>';
    } else {
      h += '<p class="k-soft">まだ回答がそろっていません。</p>';
    }
    return h;
  }

  // ---------------------------------------------------------------- PERSONAL BOOKへの案内（無料の範囲のいちばん下）
  function bookBanner(R) {
    var pages = R.book.pages.length;
    var low = R.gapFulfilRaw && R.gapFulfilRaw.rows.filter(function (r) { return r.bucket === "low"; })[0];
    var hooks = [
      ["01", "あなたという人", "なぜ、あなたはそう動くのか"],
      ["02", "あなたの武器", "強みの正体と、使いどころ"],
      ["03", "力が出るとき・出ないとき", "調子の分かれ目と、強みが裏目に出る瞬間"],
      ["04", "人との関わり方", "周りから見えているあなたと、伝えておくといいこと"],
      ["05", "あなたの取扱説明書", "今日からできる、小さな一歩"]
    ];
    var h = '<section class="k-bookban" aria-label="PERSONAL BOOK"><p class="k-bbkick">PERSONAL BOOK</p>' +
      '<div class="k-orn" aria-hidden="true"><i></i><b>◆</b><i></i></div>' +
      '<h2 class="k-bbtitle">ここまでは、<br>まだ「入り口」です。</h2>' +
      '<p class="k-bbsub">あなた専用の「自分の攻略本」</p>' +
      '<p class="k-bbtext">「なぜ自分は、こう動くのか」「どんな日に力が出て、どんな日に止まるのか」「周りに、どう伝えれば楽になるのか」。<br>あなたの回答から書き起こした、全5章・' + pages + 'ページの1冊です。</p>' +
      '<ol class="k-bbchaps">' + hooks.map(function (c) { return '<li><span class="no">' + c[0] + '</span><span class="tx"><b>' + c[1] + "</b><small>" + c[2] + "</small></span></li>"; }).join("") + "</ol>";
    if (low) h += '<p class="k-bbhook">とくに、いま満たされていない「' + esc(low.name) + '」について、今日からできる一歩まで書いています。</p>';
    h += '<button class="k-btn primary block k-bbbtn" data-act="openBook">PERSONAL BOOK を開く　→</button></section>';
    return h;
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
      h += '<div class="ttl">あなたのための、<br>小さな本</div><p class="for">全' + n + '章</p><p class="cmark">KAKU ～核～</p></div></div>';
      h += '<div class="k-card plain"><p><b>この本について</b></p><p class="k-soft">この本は、あなたの36問・価値観・ここ1週間の状態の答えから書いた、あなただけの一冊です。うれしくなったところは、何度でも読み返してください。</p><p class="k-soft" style="margin-top:8px">答えていないことは、書いていません。しっくりこないところは、そのまま「違うな」と思って読んでかまいません。</p></div>';
      h += '<div class="k-stack k-foot"><button class="k-btn primary block" data-act="bookGo" data-i="0">第1章をひらく</button>' +
        '<button class="k-btn ghost block" data-act="toResult">← 結果に戻る</button></div>';
      return h + "</div>";
    }
    var pg = pages[i], KAN = ["", "I", "II", "III", "IV", "V"];
    h += '<div class="k-bkt" role="tablist">' + pages.map(function (p) {
      return '<button class="k-bkt-b' + (p.index === i ? " on" : "") + '" role="tab" aria-selected="' + (p.index === i) + '" data-act="bookGo" data-i="' + p.index + '"><small>第' + p.chapter + "章</small></button>";
    }).join("") + "</div>";
    h += '<article class="k-page paper"><i class="k-ribbon" aria-hidden="true"></i>' +
      '<div class="k-run"><span>KAKU ～核～　PERSONAL BOOK</span><span>第' + pg.chapter + '章</span></div>' +
      '<header class="k-chop"><p class="cw">CHAPTER ' + pg.chapter + '</p><div class="cn" aria-hidden="true">' + KAN[pg.chapter] + '</div><h1 class="pt">' + esc(pg.title) + '</h1>' +
      '<div class="k-orn2" aria-hidden="true"><i></i><b>◆</b><i></i></div><p class="pl">' + esc(pg.lead) + "</p></header>" +
      '<div class="bd">' + pg.sections.map(function (sec, si) {
        return '<section class="k-sec"><h2 class="sh"><span class="sn">' + pad2(si + 1) + '</span>' + esc(sec.title) + '</h2><p class="sl">' + esc(sec.lead) + "</p>" + sec.blocks.map(blockHtml).join("") + "</section>";
      }).join("") + "</div>" +
      '<footer class="pfoot"><span>— ' + (i + 1) + " —</span></footer></article>";
    h += '<div class="k-pager"><button class="k-btn" data-act="bookGo" data-i="' + (i - 1) + '">← 前の章</button><span class="pn">' + (i + 1) + " / " + n + "</span>" +
      (i < n - 1 ? '<button class="k-btn primary" data-act="bookGo" data-i="' + (i + 1) + '">次の章 →</button>' : '<button class="k-btn primary" data-act="toResult">結果に戻る</button>') + "</div>";
    if (pg.next) h += '<p class="k-next">次の章：' + esc(pg.next) + "</p>";
    else h += '<p class="k-next">おしまい。</p>';
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
      case "bookGo": var bi = parseInt(el.getAttribute("data-i"), 10); S.bookPage = bi < 0 ? -1 : bi; persist(); render(); try { window.scrollTo(0, 0); } catch (e5) { /* 何もしない */ } break;
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
      case "copyShare":
        try {
          var Rs = C.buildResult(S), st = shareText(Rs);
          if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(st).then(function () { ui.shared = true; render(); }, function () { /* 何もしない */ });
        } catch (err3) { /* 何もしない */ }
        break;
      case "deleteSaved": storageDel(); S.consent = false; ui.copied = false; render(); break;
      case "redoCore":
        S.answers = {}; S.followup = { asked: [], answers: {} }; S.view = "flow"; S.pos = 1; ui.dir = 1; persist(); render(); break;
      case "reset":
        if (!ui.confirmReset) { ui.confirmReset = true; render(); break; }
        storageDel(); S = fresh(); ui.confirmReset = false; render(); break;
      default: break;
    }
  }
  root.addEventListener("click", onClick);

  // 試験用の読み取り口（画面の動きを自動テストするため。外部へは何も送りません）
  // トップページの「診断開始」から呼ばれる。途中まで進めた内容が（このページを開いている間）残っていれば、続きに戻れるようにする
  // 履歴から、当時の結果をそのまま開く
  function showResult(entry) {
    var base = fresh(), st = entry && entry.labState;
    if (!st) return;
    S = Object.assign(base, st, { consent: true, view: "result", pos: 0, bookPage: -1, prevView: "intro", rid: entry.id, ridAt: entry.savedAt });
    ui.parked = null; ui.histSig = null; persist(); render();
    try { window.scrollTo(0, 0); } catch (e) { /* 何もしない */ }
  }
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
  window.KAKU_LAB_APP = { showResult: showResult, open: open, getState: function () { return S; }, setState: function (s) { S = s; render(); }, render: render, screens: screens };

  render();
})();

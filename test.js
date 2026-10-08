/**
 * core36/test.js
 * CORE36 テスト用診断画面（開発・パイロット用）。
 *  - 回答・結果・アンケートは、この端末のブラウザ（localStorage）にだけ保存します。サーバーへは送信しません。
 *  - 氏名・メール・生年月日は取りません。再回答の紐づけには「参加コード」（任意の文字列）を使います。
 *  - 旧30問・16タイプの診断、決済、メール送信、共有機能には触れません。
 */
(function () {
  "use strict";

  var E = window.KAKU_CORE36, D = E.DATA;
  var TYPES = (typeof KAKU_TYPES !== "undefined") ? KAKU_TYPES : {};
  var RUNS_KEY = "kaku_core36_pilot_runs_v1", DRAFT_KEY = "kaku_core36_pilot_draft_v1";
  var DWELL_CAP_MS = 120000;
  var app = document.getElementById("app");

  // ---- 保存（localStorageが使えない環境でも画面は動く）----
  function loadJSON(key, fallback) { try { var s = window.localStorage.getItem(key); return s ? JSON.parse(s) : fallback; } catch (e) { return fallback; } }
  function saveJSON(key, val) { try { window.localStorage.setItem(key, JSON.stringify(val)); return true; } catch (e) { return false; } }
  function removeKey(key) { try { window.localStorage.removeItem(key); } catch (e) { /* 何もしない */ } }

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function el(html) { var t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstChild; }

  var state = { pilotCode: "", sessionKind: "first", answers: {}, unclear: {}, index: 0, activeMs: 0, startedAt: null, enteredAt: null, order: D.ITEMS.map(function (i) { return i.id; }) };

  function dev() {
    return '<div class="c36-dev"><b>開発用のテスト画面です。</b>公開版の診断ではありません。結果の文面・設問・判定は暫定版（scoring_version ' + esc(D.VERSION) + '）で、検証は済んでいません。</div>';
  }

  // ================= 開始画面 =================
  function viewIntro() {
    var runs = loadJSON(RUNS_KEY, []), draft = loadJSON(DRAFT_KEY, null);
    var rows = runs.slice().reverse().slice(0, 8).map(function (r) {
      return "<tr><td>" + esc(r.pilotCode || "（コードなし）") + "</td><td>" + esc(r.sessionKind === "retest" ? "再回答" : "初回") + "</td><td>" +
        esc((r.finishedAt || "").slice(0, 16).replace("T", " ")) + "</td><td>" + esc(r.summary && r.summary.primaryName ? r.summary.primaryName : "（タイプなし）") + "</td></tr>";
    }).join("");
    app.innerHTML = dev() +
      "<h1>KAKU CORE36 テスト診断</h1>" +
      '<p class="c36-soft">36問・約7〜8分。左右2つの文のうち、自分にあてはまるほうを5段階で選びます。正解や良し悪しはありません。「仕事・学び」と「日常」の2つの場面について聞きます。</p>' +
      '<div class="c36-note">回答・結果・アンケートは、この端末のブラウザ内にだけ保存されます（送信されません）。氏名・メール・生年月日は入力不要です。</div>' +
      '<div class="c36-card"><label for="pc"><b>参加コード</b>（任意。2週間後の再回答を紐づけるために、同じコードを使ってください）</label>' +
      '<input type="text" id="pc" maxlength="24" placeholder="例：P01" value="' + esc(state.pilotCode) + '" autocomplete="off" />' +
      '<p style="margin-top:12px"><label class="c36-radio"><input type="radio" name="sk" value="first" ' + (state.sessionKind === "first" ? "checked" : "") + ' /> 初回</label>' +
      '<label class="c36-radio"><input type="radio" name="sk" value="retest" ' + (state.sessionKind === "retest" ? "checked" : "") + ' /> 再回答（2週間後など）</label></p>' +
      '<button class="btn btn--primary" id="start" type="button">回答を始める</button>' +
      (draft && draft.answers && Object.keys(draft.answers).length ? ' <button class="btn btn--text" id="resume" type="button">途中から続ける（' + Object.keys(draft.answers).length + '/36）</button>' : "") + "</div>" +
      '<h2>この端末の保存データ（' + runs.length + '件）</h2>' +
      (runs.length ? '<table><thead><tr><th>参加コード</th><th>種別</th><th>回答日時</th><th>代表タイプ</th></tr></thead><tbody>' + rows + "</tbody></table>" : '<p class="c36-soft">まだありません。</p>') +
      '<div class="c36-row" style="margin-top:12px"><button class="btn" id="export" type="button"' + (runs.length ? "" : " disabled") + '>JSONを書き出す</button>' +
      '<button class="btn btn--text" id="wipe" type="button"' + (runs.length ? "" : " disabled") + '>保存データを削除</button><span id="wipemsg"></span></div>';

    document.getElementById("start").onclick = function () {
      state.pilotCode = document.getElementById("pc").value.trim();
      state.sessionKind = (document.querySelector("input[name=sk]:checked") || {}).value || "first";
      state.answers = {}; state.unclear = {}; state.index = 0; state.activeMs = 0; state.startedAt = new Date().toISOString();
      removeKey(DRAFT_KEY); viewQuestion();
    };
    var rs = document.getElementById("resume");
    if (rs) rs.onclick = function () {
      var d = loadJSON(DRAFT_KEY, null); if (!d) return;
      state.pilotCode = d.pilotCode || ""; state.sessionKind = d.sessionKind || "first"; state.answers = d.answers || {}; state.unclear = d.unclear || {};
      state.activeMs = d.activeMs || 0; state.startedAt = d.startedAt || new Date().toISOString();
      var next = state.order.findIndex(function (id) { return !(id in state.answers); }); state.index = next < 0 ? 35 : next; viewQuestion();
    };
    document.getElementById("export").onclick = exportAll;
    var wipe = document.getElementById("wipe");
    wipe.onclick = function () {
      var msg = document.getElementById("wipemsg");
      msg.innerHTML = ' 本当に削除しますか？ <button class="btn" id="wipe-yes" type="button">削除する</button> <button class="btn btn--text" id="wipe-no" type="button">やめる</button>';
      document.getElementById("wipe-yes").onclick = function () { removeKey(RUNS_KEY); removeKey(DRAFT_KEY); viewIntro(); };
      document.getElementById("wipe-no").onclick = function () { msg.innerHTML = ""; };
    };
  }

  function exportAll() {
    var runs = loadJSON(RUNS_KEY, []);
    var blob = new Blob([JSON.stringify({ exported_at: new Date().toISOString(), scoring_version: D.VERSION, runs: runs }, null, 1)], { type: "application/json" });
    var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "kaku-core36-pilot-" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  // ================= 質問画面 =================
  function itemOf(i) { var id = state.order[i]; return D.ITEMS.filter(function (x) { return x.id === id; })[0]; }

  function leaveQuestion() { if (state.enteredAt) { state.activeMs += Math.min(Date.now() - state.enteredAt, DWELL_CAP_MS); state.enteredAt = null; } }

  function saveDraft() {
    saveJSON(DRAFT_KEY, { pilotCode: state.pilotCode, sessionKind: state.sessionKind, answers: state.answers, unclear: state.unclear, activeMs: state.activeMs, startedAt: state.startedAt });
  }

  function viewQuestion() {
    var i = state.index, it = itemOf(i), cur = state.answers[it.id];
    state.enteredAt = Date.now();
    var sceneChange = i === 18;
    var scale = D.CHOICES.map(function (c) {
      return '<button type="button" data-v="' + c.value + '" class="' + (cur === c.value ? "on" : "") + '" aria-pressed="' + (cur === c.value) + '"><i></i><span>' + esc(c.label) + "</span></button>";
    }).join("");
    app.innerHTML = dev() +
      '<div class="c36-row" style="justify-content:space-between"><span class="c36-chip">' + esc(D.SCENES[it.scene]) + "の場面で</span><span class=\"c36-soft\">" + (i + 1) + " / 36</span></div>" +
      '<div class="c36-progress"><i style="width:' + (i / 36 * 100) + '%"></i></div>' +
      (sceneChange ? '<div class="c36-note">ここからは「日常」の場面についての質問です。</div>' : "") +
      '<p class="c36-soft" style="margin-top:14px">どちらが自分に近いですか？</p>' +
      '<div class="c36-stmt"><b>左</b>' + esc(it.left) + "</div>" +
      '<div class="c36-stmt"><b>右</b>' + esc(it.right) + "</div>" +
      '<div class="c36-scale" role="group" aria-label="5段階">' + scale + "</div>" +
      '<div class="c36-nav"><button class="btn btn--text" id="back" type="button"' + (i === 0 ? " disabled" : "") + '>← 前へ</button>' +
      '<label><input type="checkbox" id="unclear" ' + (state.unclear[it.id] ? "checked" : "") + " /> この質問は分かりにくい</label></div>" +
      '<p class="c36-soft" style="font-size:12px;margin-top:10px">キーボードの 1〜5 でも選べます（1=左に近い、5=右に近い）。</p>';

    Array.prototype.forEach.call(app.querySelectorAll(".c36-scale button"), function (b) { b.onclick = function () { answer(it, Number(b.getAttribute("data-v"))); }; });
    document.getElementById("back").onclick = function () { leaveQuestion(); state.index = Math.max(0, i - 1); saveDraft(); viewQuestion(); };
    document.getElementById("unclear").onchange = function (ev) { if (ev.target.checked) state.unclear[it.id] = true; else delete state.unclear[it.id]; saveDraft(); };
  }

  function answer(it, v) {
    leaveQuestion(); state.answers[it.id] = v; saveDraft();
    Array.prototype.forEach.call(app.querySelectorAll(".c36-scale button"), function (b) { var on = Number(b.getAttribute("data-v")) === v; b.className = on ? "on" : ""; b.setAttribute("aria-pressed", on); });
    setTimeout(function () {
      if (state.index >= 35) { finish(); } else { state.index++; viewQuestion(); }
    }, 220);
  }

  document.addEventListener("keydown", function (ev) {
    if (!/^[1-5]$/.test(ev.key) || !document.querySelector(".c36-scale")) return;
    if (ev.target && /INPUT|TEXTAREA/.test(ev.target.tagName) && ev.target.type !== "checkbox") return;
    answer(itemOf(state.index), Number(ev.key));
  });

  // ================= 結果 =================
  var current = null;   // { result, run }

  function finish() {
    var durationSec = Math.round(state.activeMs / 1000);
    var result = E.score(state.answers, { durationSec: durationSec });
    var t = result.type, name = t.primary && TYPES[t.primary] ? TYPES[t.primary].nameJp : null;
    current = {
      result: result,
      run: {
        runId: Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7),
        pilotCode: state.pilotCode, sessionKind: state.sessionKind,
        startedAt: state.startedAt, finishedAt: new Date().toISOString(), durationSec: durationSec,
        scoring_version: result.scoring_version, definition_hash: E.definitionHash(),
        answers: result.answers, unclearItems: Object.keys(state.unclear).sort(),
        snapshot: E.toSnapshot(result),
        summary: { primary: t.primary, second: t.second, showSecond: !!t.showSecond, typeStatus: t.status, primaryName: name, margin: t.margin, leanCount: result.leanCount },
        survey: null, saved: false
      }
    };
    removeKey(DRAFT_KEY);
    viewResult();
  }

  function axisBlock(ax, info) {
    if (info.status !== "ok") return '<div class="c36-axis"><b>' + esc(ax.nameJp) + "</b>：回答が足りないため算出できません</div>";
    var dim = info.reading.kind === "balanced" ? " dim" : "";
    var scene = "";
    if (info.reading.kind === "scene_diff") {
      scene = '<div class="c36-axis__scene">各場面3問の回答にもとづく、今回の回答上の違いです。性質とは断定せず、見直しのきっかけとして見てください。</div>';
    }
    var label = info.reading.kind === "scene_diff" ? "場面によって違いが見られた" : info.reading.label;
    var detail = info.reading.kind === "scene_diff" ? '<div class="c36-axis__scene">' + esc(info.reading.label.replace(/^今回の回答では、場面によって違いが見られた/, "")) + "</div>" : "";
    return '<div class="c36-axis"><div class="c36-axis__head"><span><span class="c36-axis__name">' + esc(ax.nameJp) + '</span><span class="c36-axis__en">' + esc(ax.nameEn) + "</span></span>" +
      '<span class="c36-axis__read">' + esc(label) + "</span></div>" +
      '<div class="c36-bar' + dim + '"><i style="left:' + info.position.toFixed(1) + '%"></i></div>' +
      '<div class="c36-poles"><span>← ' + esc(ax.poleB) + "</span><span>" + esc(ax.poleA) + " →</span></div>" + detail + scene + "</div>";
  }

  function typeBlock(id, small) {
    var T = TYPES[id]; if (!T) return "<p>" + esc(id) + "</p>";
    return '<div class="c36-type' + (small ? " second" : "") + '"><img src="../' + esc(T.image) + '" alt="' + esc(T.nameEn + " " + T.nameJp) + '" style="border:3px solid ' + esc(T.color || "#ccc") + '" />' +
      '<div><div class="c36-type__en">' + esc(T.nameEn) + '</div><div class="c36-type__jp">' + esc(T.nameJp) + '</div><div class="c36-type__cc">' + esc(T.catchcopy) + "</div></div></div>";
  }

  function viewResult() {
    var r = current.result, t = r.type, html = dev() + "<h1>テスト結果</h1>";
    html += '<p class="c36-soft">この結果は、今回の回答から読み取った傾向です。能力の高さや優劣を示すものではありません。</p>';

    // 1) 自己理解の中心：6つの軸
    html += "<h2>あなたの回答の傾向（6つの軸）</h2>" + D.AXES.map(function (ax) { return axisBlock(ax, r.axes[ax.id]); }).join("");

    // 2) 入口としての12TYPE
    html += "<h2>いちばん近い代表タイプ</h2>";
    if (t.status === "no_basis" || t.status === "incomplete") {
      html += '<div class="c36-card"><p><b>今回の回答からは、特定のタイプに近いとは言えませんでした。</b></p>' +
        '<p class="c36-soft">どの軸も「どちらにも寄らない」に近かったか、複数のタイプが同じ近さで並んだため、無理に分類していません。上の6つの軸の読みが、今回の結果の中心です。</p></div>';
    } else {
      var name = TYPES[t.primary] ? TYPES[t.primary].nameJp : t.primary;
      html += '<div class="c36-card">' + typeBlock(t.primary, false) + '<p style="margin-top:12px">' + esc(E.describeReason(r, name)) + "</p>" +
        (t.fit === "weak" ? '<p class="c36-soft">近さは弱めです。上の6つの軸の読みを中心に見てください。</p>' : "") + "</div>";
      if (t.showSecond || t.fit === "weak") {
        html += '<p class="c36-soft">' + (t.showSecond ? "2番目に近いタイプとの差が小さいため、補足として表示します。" : "近さが弱めのため、次に近いタイプも表示します。") + "</p>" +
          '<div class="c36-card">' + typeBlock(t.second, true) + "</div>";
      }
    }
    if (r.flags.fast) html += '<div class="c36-note">回答時間がとても短かったため、回答が十分に読み込まれていない可能性があります。</div>';
    if (r.flags.straightLine) html += '<div class="c36-note">同じ選択肢が多く続いていました。結果は参考程度に見てください。</div>';

    // 3) 開発用の詳細
    var rank = (t.ranking || []).slice(0, 5).map(function (id) { return id + " " + t.distances[id]; }).join(" / ");
    html += "<details><summary>判定の詳細（開発用）</summary><pre>" + esc(
      "scoring_version: " + r.scoring_version + "\ndefinition_hash: " + E.definitionHash() + "\nstatus: " + r.status + " / type.status: " + t.status +
      "\n寄りのある軸: " + r.leanCount + " / 回答時間(秒): " + current.run.durationSec +
      "\n距離の上位5: " + rank + "\n1位と2位の差: " + (t.margin == null ? "-" : t.margin.toFixed(2)) +
      "\n同点: " + (t.tieGroup || []).join(",") + (t.tieResolvedBy ? "（" + t.tieResolvedBy + "で決定）" : "") +
      "\n軸の平均(-2〜+2) / 場面別:\n" + D.AXES.map(function (ax) { var a = r.axes[ax.id]; return "  " + ax.id + ": " + a.mean.toFixed(2) + " / 仕事 " + (a.sceneMeans.work == null ? "-" : a.sceneMeans.work.toFixed(2)) + " 日常 " + (a.sceneMeans.life == null ? "-" : a.sceneMeans.life.toFixed(2)); }).join("\n")) + "</pre></details>";

    // 4) アンケート
    html += "<h2>感想を教えてください</h2>" + surveyHtml() +
      '<div class="c36-row" style="margin-top:16px"><button class="btn btn--primary" id="save" type="button">保存して終了</button>' +
      '<button class="btn btn--text" id="skip" type="button">保存せずに戻る</button></div><p id="savemsg" class="c36-soft"></p>';
    app.innerHTML = html;

    document.getElementById("save").onclick = function () {
      current.run.survey = readSurvey(); current.run.saved = true;
      var runs = loadJSON(RUNS_KEY, []); runs.push(current.run);
      var ok = saveJSON(RUNS_KEY, runs);
      document.getElementById("savemsg").textContent = ok ? "保存しました。" : "このブラウザでは保存できませんでした（プライベートモードなど）。";
      if (ok) setTimeout(viewIntro, 700);
    };
    document.getElementById("skip").onclick = viewIntro;
  }

  var SURVEY_Q = [
    ["understand", "質問の意味は分かりやすかった"],
    ["convince", "結果に納得できた"],
    ["reason", "代表タイプが選ばれた理由が理解できた"],
    ["axes", "6つの軸の読み全体が、自分の実感に合っていた"]
  ];
  function radios(name) {
    return '<div class="c36-row">' + [1, 2, 3, 4, 5].map(function (v) { return '<label><input type="radio" name="' + name + '" value="' + v + '" />' + v + "</label>"; }).join("") + "</div>";
  }
  function surveyHtml() {
    var h = '<p class="c36-soft">1＝まったく当てはまらない 〜 5＝とても当てはまる</p>';
    SURVEY_Q.forEach(function (q) { h += '<div class="c36-q"><div>' + esc(q[1]) + "</div>" + radios("sv_" + q[0]) + "</div>"; });
    h += '<div class="c36-q"><div><b>それぞれの軸の読みは、自分の実感に合っていますか？</b></div>';
    D.AXES.forEach(function (ax) { h += '<div style="margin-top:8px">' + esc(ax.nameJp) + "（" + esc(current.result.axes[ax.id].reading.kind === "scene_diff" ? "場面によって違い" : current.result.axes[ax.id].reading.label) + "）" + radios("ax_" + ax.id) + "</div>"; });
    h += "</div>";
    h += '<div class="c36-q"><div>分かりにくかった点・違和感があった点（自由記述）</div><textarea id="sv_free" rows="3"></textarea></div>';
    return h;
  }
  function readSurvey() {
    var s = {};
    function val(name) { var c = document.querySelector("input[name=" + name + "]:checked"); return c ? Number(c.value) : null; }
    SURVEY_Q.forEach(function (q) { s[q[0]] = val("sv_" + q[0]); });
    s.axisFit = {}; D.AXES.forEach(function (ax) { s.axisFit[ax.id] = val("ax_" + ax.id); });
    s.free = (document.getElementById("sv_free").value || "").slice(0, 1000);
    return s;
  }

  viewIntro();
})();

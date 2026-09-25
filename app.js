/**
 * app.js
 * 「KAKU ～核～」 画面遷移・診断フロー制御【仮実装】
 *
 * サイトマップ / ユーザー導線（設計書 3章・4章）に沿って、以下の順で画面を切り替える:
 * TOP → KAKUについて / 基本情報入力 → QUESTION診断 → STATE診断 → 解析演出 → 無料診断結果
 * → (PERSONAL BOOK / KAKU MATCH / KAKU TEAM 紹介 / 料金ページ はナビゲーションからいつでも遷移可)
 *
 * PERSONAL BOOK・KAKU MATCH・KAKU TEAM の実際の決済・レポート生成は
 * 設計書12章により「今回実装せず将来拡張するもの」に分類されているため、
 * このMVPでは紹介ページ＋非活性の「Coming soon」ボタンのみを実装する。
 */

(function () {
  "use strict";

  // ---------------------------------------------------------------------
  // 診断セッション状態
  // ---------------------------------------------------------------------
  const session = {
    name: "",
    birthdate: "",
    questionAnswers: {},   // { q1: "A"|"B", ... }
    stateAnswers: {},      // { s1: 1-5, ... }
    questionIndex: 0,
    core6: null,
    birth: null,
    state: null,
    typeId: null,
    gap: null,
  };

  // ---------------------------------------------------------------------
  // 画面遷移
  // ---------------------------------------------------------------------
  const VIEW_IDS = [
    "top", "about", "basic", "question", "state", "analyzing",
    "result", "personal-book", "kaku-match", "kaku-team", "pricing",
  ];

  function showView(id) {
    VIEW_IDS.forEach((v) => {
      const el = document.getElementById("view-" + v);
      if (el) el.hidden = v !== id;
    });
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  }

  document.addEventListener("click", (e) => {
    const navEl = e.target.closest("[data-nav]");
    if (navEl) {
      e.preventDefault();
      showView(navEl.getAttribute("data-nav"));
      return;
    }
    const actionEl = e.target.closest("[data-action]");
    if (actionEl && actionEl.getAttribute("data-action") === "start-diagnosis") {
      e.preventDefault();
      resetDiagnosis();
      showView("basic");
    }
  });

  function resetDiagnosis() {
    session.name = "";
    session.birthdate = "";
    session.questionAnswers = {};
    session.stateAnswers = {};
    session.questionIndex = 0;
    session.core6 = null;
    session.birth = null;
    session.state = null;
    session.typeId = null;
    session.gap = null;
  }

  // ---------------------------------------------------------------------
  // ABOUTページ: CORE6一覧
  // ---------------------------------------------------------------------
  function renderAboutCore6() {
    const grid = document.getElementById("about-core6-grid");
    if (!grid) return;
    grid.innerHTML = CORE6_AXES.map(
      (a) => `
      <div class="core6-grid__item">
        <div class="core6-grid__label">${a.nameEn}｜${a.nameJp}</div>
      </div>`
    ).join("");
  }

  // ---------------------------------------------------------------------
  // STEP1: 基本情報
  // ---------------------------------------------------------------------
  const formBasic = document.getElementById("form-basic");
  formBasic.addEventListener("submit", (e) => {
    e.preventDefault();
    session.name = document.getElementById("input-name").value.trim();
    session.birthdate = document.getElementById("input-birthdate").value;
    session.questionIndex = 0;
    session.questionAnswers = {};
    showView("question");
    renderQuestion();
  });

  // ---------------------------------------------------------------------
  // STEP2: QUESTION診断
  // ---------------------------------------------------------------------
  function renderQuestion() {
    const total = QUESTIONS.length;
    const idx = session.questionIndex;
    const progressEl = document.getElementById("question-progress");
    progressEl.style.width = Math.round((idx / total) * 100) + "%";

    const q = QUESTIONS[idx];
    const card = document.getElementById("question-card");
    card.innerHTML = `
      <div class="question-card">
        <p class="step-indicator">Q${idx + 1} / ${total}</p>
        <p class="question-card__prompt">${q.prompt}</p>
        <button type="button" class="question-card__option" data-choice="A">${q.optionA.text}</button>
        <button type="button" class="question-card__option" data-choice="B">${q.optionB.text}</button>
      </div>
    `;
    card.querySelectorAll("[data-choice]").forEach((btn) => {
      btn.addEventListener("click", () => {
        session.questionAnswers[q.id] = btn.getAttribute("data-choice");
        if (session.questionIndex < total - 1) {
          session.questionIndex += 1;
          renderQuestion();
        } else {
          document.getElementById("question-progress").style.width = "100%";
          showView("state");
          renderStateForm();
        }
      });
    });
  }

  // ---------------------------------------------------------------------
  // STEP3: STATE診断
  // ---------------------------------------------------------------------
  function renderStateForm() {
    session.stateAnswers = {};
    const form = document.getElementById("form-state");
    form.innerHTML =
      STATE_QUESTIONS.map(
        (q) => `
      <div class="likert-item" data-qid="${q.id}">
        <p class="likert-item__prompt">${q.prompt}</p>
        <div class="likert-scale">
          ${[1, 2, 3, 4, 5]
            .map(
              (v) =>
                `<button type="button" data-value="${v}">${v}</button>`
            )
            .join("")}
        </div>
      </div>`
      ).join("") +
      `<p class="form-note">1＝まったく当てはまらない　5＝とても当てはまる</p>
       <button type="button" class="btn btn--primary" id="btn-state-submit" disabled>診断結果を見る</button>`;

    form.querySelectorAll(".likert-item").forEach((item) => {
      const qid = item.getAttribute("data-qid");
      item.querySelectorAll("button[data-value]").forEach((btn) => {
        btn.addEventListener("click", () => {
          session.stateAnswers[qid] = Number(btn.getAttribute("data-value"));
          item.querySelectorAll("button[data-value]").forEach((b) =>
            b.classList.toggle("is-selected", b === btn)
          );
          checkStateComplete();
        });
      });
    });

    document.getElementById("btn-state-submit").addEventListener("click", () => {
      runAnalysis();
    });
  }

  function checkStateComplete() {
    const allAnswered = STATE_QUESTIONS.every(
      (q) => session.stateAnswers[q.id] !== undefined
    );
    document.getElementById("btn-state-submit").disabled = !allAnswered;
  }

  // ---------------------------------------------------------------------
  // 解析演出 → 結果算出
  // ---------------------------------------------------------------------
  function runAnalysis() {
    showView("analyzing");
    const messages = [
      "QUESTIONを解析しています…",
      "BIRTHの傾向と重ね合わせています…",
      "STATEとのGAPを確認しています…",
      "KAKU TYPEを確定しています…",
    ];
    const textEl = document.getElementById("analyzing-text");
    let step = 0;
    textEl.textContent = messages[0];
    const timer = setInterval(() => {
      step += 1;
      if (step < messages.length) {
        textEl.textContent = messages[step];
      } else {
        clearInterval(timer);
        computeResult();
        showView("result");
        renderResult();
      }
    }, 700);
  }

  function computeResult() {
    session.core6 = computeCore6(session.questionAnswers);
    session.birth = computeBirth(session.birthdate);
    session.state = computeState(session.stateAnswers);
    session.typeId = determineType(session.core6.topAxis, session.core6.secondAxis);
    session.gap = computeGap(session.core6.topAxis, session.birth.axis, session.state.key);
  }

  // ---------------------------------------------------------------------
  // CORE6 レーダーチャート（外部ライブラリなし・インラインSVG）
  // ---------------------------------------------------------------------
  function buildRadarSVG(scores) {
    const size = 260;
    const center = size / 2;
    const maxR = 95;
    const axes = CORE6_AXES.map((a) => a.id);
    const n = axes.length;

    function pointFor(index, value) {
      const angle = (Math.PI * 2 * index) / n - Math.PI / 2;
      const r = (value / 100) * maxR;
      return [center + r * Math.cos(angle), center + r * Math.sin(angle)];
    }

    // グリッド（同心の6角形を3段階）
    let gridPolys = "";
    [0.33, 0.66, 1].forEach((frac) => {
      const pts = axes
        .map((_, i) => pointFor(i, 100 * frac).join(","))
        .join(" ");
      gridPolys += `<polygon points="${pts}" fill="none" stroke="#E4E4E0" stroke-width="1" />`;
    });

    // 軸線 + ラベル
    let axisLines = "";
    let labels = "";
    axes.forEach((axisId, i) => {
      const [x, y] = pointFor(i, 100);
      axisLines += `<line x1="${center}" y1="${center}" x2="${x}" y2="${y}" stroke="#E4E4E0" stroke-width="1" />`;
      const labelPoint = pointFor(i, 118);
      const axisMeta = CORE6_AXES[i];
      labels += `<text x="${labelPoint[0]}" y="${labelPoint[1]}" font-size="10" fill="#5B5E68" text-anchor="middle" dominant-baseline="middle">${axisMeta.nameJp}</text>`;
    });

    // データポリゴン
    const dataPts = axes
      .map((axisId, i) => pointFor(i, scores[axisId]).join(","))
      .join(" ");

    return `
      <svg viewBox="0 0 ${size} ${size}" width="260" height="260" role="img" aria-label="CORE6レーダーチャート">
        ${gridPolys}
        ${axisLines}
        <polygon points="${dataPts}" fill="#2C2F6B" fill-opacity="0.18" stroke="#2C2F6B" stroke-width="2" />
        ${labels}
      </svg>
    `;
  }

  // ---------------------------------------------------------------------
  // 結果ページ描画
  // ---------------------------------------------------------------------
  function renderResult() {
    const type = KAKU_TYPES[session.typeId];
    const core6 = session.core6;
    const birth = session.birth;
    const state = session.state;
    const gap = session.gap;

    const container = document.getElementById("result-container");
    container.innerHTML = `
      <p class="step-indicator">無料診断結果</p>
      <h2 class="section-title">${session.name ? session.name + "さんの" : "あなたの"}KAKUは…</h2>

      <div class="kaku-card" id="kaku-card-share">
        <img class="kaku-card__image" src="${type.image}" alt="${type.nameEn} ${type.nameJp}" />
        <div class="kaku-card__body">
          <p class="kaku-card__type-en">${type.nameEn}</p>
          <p class="kaku-card__type-jp">${type.nameJp}</p>
          <p class="kaku-card__catchcopy">${type.catchcopy}</p>
        </div>
      </div>

      <h3 class="subsection-title">CORE 6｜あなたを構成する6つの力</h3>
      <div class="radar-wrap">${buildRadarSVG(core6.scores)}</div>
      <div class="core6-grid">
        ${CORE6_AXES.map(
          (a) => `
          <div class="core6-grid__item">
            <div class="core6-grid__label">${a.nameEn}｜${a.nameJp}（${core6.scores[a.id]}）</div>
            <div class="core6-grid__bar"><div class="core6-grid__bar-fill" style="width:${core6.scores[a.id]}%"></div></div>
          </div>`
        ).join("")}
      </div>

      <div class="result-block">
        <h3>WEAPON｜あなたの武器</h3>
        <p>${type.weapon}</p>
      </div>
      <div class="result-block">
        <h3>BLIND SPOT｜あなたの盲点</h3>
        <p>${type.blindSpot}</p>
      </div>
      <div class="result-block">
        <h3>TEAM ROLE｜チームでの役割</h3>
        <p>${type.teamRole}</p>
      </div>
      <div class="result-block">
        <h3>RELATION STYLE｜関係の築き方</h3>
        <p>${type.relationStyle}</p>
      </div>
      <div class="result-block">
        <h3>AWAKEN｜あなたを表す3つの言葉</h3>
        <p><strong>${type.awaken.keywords.join(" × ")}</strong><br />${type.awaken.sentence}</p>
      </div>

      <h3 class="subsection-title">BIRTH｜生まれ持った資質</h3>
      <div class="result-block">
        <h3>${birth.title}</h3>
        <p>${birth.description}</p>
      </div>

      <h3 class="subsection-title">STATE｜今のあなたの状態</h3>
      <div class="result-block">
        <h3>${state.label}</h3>
        <p>${state.description}</p>
      </div>

      <h3 class="subsection-title">KAKU GAP｜資質と行動のズレ</h3>
      <div class="result-block">
        <h3>${gap.headline}</h3>
        <p>${gap.message}</p>
      </div>

      <div class="share-row">
        <button class="btn btn--primary" id="btn-share">結果をシェアする</button>
        <button class="btn" data-nav="personal-book">PERSONAL BOOKを見る</button>
        <button class="btn btn--text" data-action="start-diagnosis">もう一度診断する</button>
      </div>
    `;

    const shareBtn = document.getElementById("btn-share");
    shareBtn.addEventListener("click", () => {
      const shareText = `私のKAKUは「${type.nameEn}（${type.nameJp}）」でした。\n${type.catchcopy}\n\n#KAKU核診断`;
      if (navigator.share) {
        navigator.share({ text: shareText, url: location.href }).catch(() => {});
      } else {
        const url =
          "https://twitter.com/intent/tweet?text=" + encodeURIComponent(shareText);
        window.open(url, "_blank", "noopener");
      }
    });
  }

  // ---------------------------------------------------------------------
  // 初期化
  // ---------------------------------------------------------------------
  renderAboutCore6();
  showView("top");
})();

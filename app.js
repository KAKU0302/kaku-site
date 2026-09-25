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
      "16タイプの中から、あなたのKAKUを絞り込んでいます…",
      "まもなく結果が見えてきます…",
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

      <div class="kaku-card kaku-card--reveal" id="kaku-card-share">
        <div class="kaku-card__rarity">出現率 ${type.rarity}｜16タイプ中</div>
        <img class="kaku-card__image" src="${type.image}" alt="${type.nameEn} ${type.nameJp}" />
        <div class="kaku-card__body">
          <p class="kaku-card__type-en">${type.nameEn}</p>
          <p class="kaku-card__type-jp">${type.nameJp}</p>
          <p class="kaku-card__praise">${type.praise}</p>
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
        <button class="btn btn--primary" id="btn-save-image">シェア画像を保存する</button>
        <button class="btn" id="btn-share-x">Xでシェア</button>
        <button class="btn" data-nav="personal-book">PERSONAL BOOKを見る</button>
        <button class="btn btn--text" data-action="start-diagnosis">もう一度診断する</button>
      </div>
      <p class="form-note" id="share-image-status" aria-live="polite"></p>
    `;

    document.getElementById("btn-share-x").addEventListener("click", () => {
      const shareText = `私のKAKUは「${type.nameEn}（${type.nameJp}）」でした。\n${type.catchcopy}\n\n#KAKU核診断`;
      const url = "https://twitter.com/intent/tweet?text=" + encodeURIComponent(shareText);
      window.open(url, "_blank", "noopener");
    });

    document.getElementById("btn-save-image").addEventListener("click", async () => {
      const statusEl = document.getElementById("share-image-status");
      const btn = document.getElementById("btn-save-image");
      btn.disabled = true;
      statusEl.textContent = "画像を作成しています…";
      try {
        const canvas = await buildShareCardCanvas(type);
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
        const fileName = `kaku-${type.id}.png`;
        const file = new File([blob], fileName, { type: "image/png" });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: "KAKU診断結果",
            text: `私のKAKUは「${type.nameEn}（${type.nameJp}）」でした。 #KAKU核診断`,
          });
          statusEl.textContent = "";
        } else {
          const objectUrl = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = objectUrl;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(objectUrl);
          statusEl.textContent = "画像を保存しました。SNSに投稿してシェアしてください。";
        }
      } catch (err) {
        statusEl.textContent = "画像の作成に失敗しました。時間をおいて再度お試しください。";
      } finally {
        btn.disabled = false;
      }
    });
  }

  // ---------------------------------------------------------------------
  // SNSシェア用カード画像を canvas で組み立てる
  // ---------------------------------------------------------------------
  function wrapCanvasText(ctx, text, centerX, startY, maxWidth, lineHeight) {
    let line = "";
    const lines = [];
    for (const ch of text) {
      const testLine = line + ch;
      if (ctx.measureText(testLine).width > maxWidth && line !== "") {
        lines.push(line);
        line = ch;
      } else {
        line = testLine;
      }
    }
    if (line) lines.push(line);
    lines.forEach((l, i) => ctx.fillText(l, centerX, startY + i * lineHeight));
    return lines.length * lineHeight;
  }

  function buildShareCardCanvas(type) {
    return new Promise((resolve, reject) => {
      const W = 900;
      const H = 1200;
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d");

      // 背景（タイプカラーを薄くにじませたグラデーション）
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, type.color + "22");
      grad.addColorStop(1, "#FAFAF8");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // ブランドロゴ
      ctx.fillStyle = "#1C1D21";
      ctx.font = "bold 28px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("KAKU ～核～", 48, 72);

      // 出現率バッジ
      ctx.textAlign = "right";
      ctx.font = "bold 18px sans-serif";
      ctx.fillStyle = type.color;
      ctx.fillText(`出現率 ${type.rarity}`, W - 48, 72);

      const img = new Image();
      img.onload = () => {
        try {
          // キャラクター画像（アスペクト比を保って中央配置）
          const boxW = W - 160;
          const boxH = 520;
          const boxX = 80;
          const boxY = 120;
          const scale = Math.min(boxW / img.width, boxH / img.height);
          const drawW = img.width * scale;
          const drawH = img.height * scale;
          const drawX = boxX + (boxW - drawW) / 2;
          const drawY = boxY + (boxH - drawH) / 2;

          // 白い角丸カード（画像の背景）
          ctx.fillStyle = "#FFFFFF";
          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(boxX, boxY, boxW, boxH, 24);
          } else {
            ctx.rect(boxX, boxY, boxW, boxH);
          }
          ctx.fill();

          ctx.drawImage(img, drawX, drawY, drawW, drawH);

          let y = boxY + boxH + 64;
          ctx.textAlign = "center";

          ctx.fillStyle = "#5B5E68";
          ctx.font = "bold 20px sans-serif";
          ctx.fillText(type.nameEn, W / 2, y);
          y += 44;

          ctx.fillStyle = "#1C1D21";
          ctx.font = "bold 44px sans-serif";
          ctx.fillText(type.nameJp, W / 2, y);
          y += 56;

          ctx.fillStyle = type.color;
          ctx.font = "bold 26px sans-serif";
          y += wrapCanvasText(ctx, type.praise, W / 2, y, W - 160, 36);
          y += 12;

          ctx.fillStyle = "#5B5E68";
          ctx.font = "20px sans-serif";
          wrapCanvasText(ctx, type.catchcopy, W / 2, y, W - 200, 30);

          // フッター
          ctx.strokeStyle = "#E4E4E0";
          ctx.beginPath();
          ctx.moveTo(80, H - 100);
          ctx.lineTo(W - 80, H - 100);
          ctx.stroke();

          ctx.fillStyle = "#5B5E68";
          ctx.font = "18px sans-serif";
          ctx.fillText("QUESTION × BIRTH × STATE = YOUR KAKU　#KAKU核診断", W / 2, H - 60);

          resolve(canvas);
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = reject;
      img.src = type.image;
    });
  }

  // ---------------------------------------------------------------------
  // 初期化
  // ---------------------------------------------------------------------
  renderAboutCore6();
  showView("top");
})();

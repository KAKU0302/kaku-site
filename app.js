/**
 * app.js
 * 「KAKU ～核～」 画面遷移・診断フロー制御【仮実装】
 *
 * サイトマップ / ユーザー導線（設計書 3章・4章）に沿って、以下の順で画面を切り替える:
 * TOP → KAKUについて / タイプ一覧 / 基本情報入力 → QUESTION診断 → STATE診断 → 解析演出 → 無料診断結果
 * → (PERSONAL BOOK / KAKU MATCH / KAKU TEAM 紹介 / 料金ページ はナビゲーションからいつでも遷移可)
 *
 * KAKU MATCH（相性）は、以前はPERSONAL BOOKの「第4章」として統合していたが、
 * PERSONAL BOOK単体で価値が完結する内容に育ったため、¥980の独立サービス（view-kaku-match）として
 * 切り出している。恋愛・結婚・仕事のカテゴリごとに、スコア・「なぜこの数字？」・「気をつけたいポイント」を
 * 詳しく見せる仕様。
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
    context: null,   // PERSONAL BOOK限定の追加入力 { role, value, relationship }
  };

  // ---------------------------------------------------------------------
  // PERSONAL BOOK: 承認・肯定を軸にしたコピー生成用データ
  // ---------------------------------------------------------------------
  // 各軸を「隠れた才能」として言い換えるための短い言葉（副軸の解禁演出などで使用）
  const AXIS_GIFT_PHRASES = {
    vision: "まだ見えていない可能性を思い描く力",
    logic: "物事を筋道立てて理解する力",
    drive: "迷わず動き出す力",
    influence: "人を巻き込み、動かす力",
    bond: "人の気持ちに寄り添う力",
    stability: "着実に積み上げ、支える力",
  };

  // 第2章のアクションプランを「抽象的な提案」で終わらせず、その場で決めきれる具体的な
  // 一手に落とし込むための、軸ごとの実行イメージ。診断を受ける人は自分で決めるのが苦手な
  // ことが多い、という前提に立ち、曖昧な「〜してみましょう」ではなく、今日・今週単位で
  // 実行できる具体的な行動を1つ断言する形にしている。
  // すべて「〜してください」で終わる命令形にしておき、呼び出し側では
  // 末尾に句点を足すだけで自然な1文になるようにしている。
  const AXIS_CONCRETE_MOVE = {
    vision: "会議や1on1の最初に「もし制約が一切なかったら」を1分だけ話してみてください",
    logic: "次の判断を下す前に、根拠を3行だけ書き出してから結論を口にしてください",
    drive: "今日中に、先延ばしにしていたタスクを1つ選び、着手ではなく完了まで終わらせてください",
    influence: "次のミーティングで、自分の意見を一番最初に発言してください",
    bond: "今週中に、身近な1人に感謝や承認の言葉を直接伝えてください",
    stability: "重要な決定の前に「これだけは変えない」を1つ決めてから進めてください",
  };

  // PERSONAL BOOK 第2章｜WORK（向いている仕事・役割・働き方）を、一番の力（topAxis）から導くための
  // 軸ごとの解説。無料診断の言い換えで終わらせず、「現実でどう使うか」まで落とし込むために新設した。
  const WORK_BY_AXIS = {
    vision: "構想力が一番の力のあなたは、ゼロから企画を立てる仕事、新規事業やまだ答えのない課題に取り組む仕事で力を発揮します。決められた手順をなぞる仕事より、「何をやるか」から自分で考えられる裁量のある環境の方が向いています。",
    logic: "解析力が一番の力のあなたは、データ分析や業務改善など、筋道を立てて考える仕事に向いています。感覚や勢いだけで判断が求められる環境よりも、根拠を積み上げて進められる仕事の方が力を発揮しやすいタイプです。",
    drive: "突破力が一番の力のあなたは、新規開拓や立ち上げフェーズのプロジェクトなど、動きながら結果を出す仕事に向いています。慎重な合意形成に時間をかける環境より、スピード感のある現場の方が力を発揮します。",
    influence: "影響力が一番の力のあなたは、営業や広報、人を巻き込むリーダー的な役割に向いています。黙々と一人で完結する仕事より、人と関わりながら進める仕事の方が力を発揮しやすいタイプです。",
    bond: "共鳴力が一番の力のあなたは、人事やカスタマーサクセスなど、人の気持ちに寄り添う仕事に向いています。効率だけを追う環境より、関係性を大切にできる仕事の方が力を発揮します。",
    stability: "安定力が一番の力のあなたは、オペレーションや品質管理など、積み重ねと正確さが求められる仕事に向いています。変化の激しい環境より、地に足のついた仕事の方が力を発揮しやすいタイプです。",
  };

  // PERSONAL BOOK 第2章｜CAREER（会社員・管理職・専門職・起業などの適性傾向）。
  // 断定的な優劣ではなく「相性が良い傾向」として提示する。
  const CAREER_BY_AXIS = {
    vision: "会社員であれば新規事業・企画部門、専門職なら研究職やクリエイターとしての適性が高く、独立するなら「まだない市場」を作るタイプの起業と相性が良い傾向があります。",
    logic: "会社員であれば分析・戦略部門でのキャリアに、専門職ならコンサルタントのように専門知識を軸にした働き方に適性があります。独立する場合も、専門性で勝負するスタイルと相性が良い傾向があります。",
    drive: "会社員であれば変化の多い部署やベンチャー気質の環境で、管理職なら現場を動かすタイプのリーダーとして力を発揮します。独立・起業への適性も高い傾向があるタイプです。",
    influence: "会社員であれば対外折衝の多い部署や広報・営業部門で、管理職なら人を巻き込むタイプのリーダーとして力を発揮します。独立する場合は、発信力を活かした働き方と相性が良い傾向があります。",
    bond: "会社員であれば人と深く関わる部署（人事・カスタマーサポート等）で、管理職ならメンバーに寄り添うタイプのリーダーとして力を発揮します。独立する場合は、信頼関係を土台にした働き方と相性が良い傾向があります。",
    stability: "会社員として長期的に専門性を積み上げるキャリアに適性があり、管理職なら仕組みを整えるタイプのリーダーとして力を発揮します。独立する場合は、着実な積み重ねが評価される業種と相性が良い傾向があります。",
  };

  // PERSONAL BOOK 第4章｜LIFE STRATEGY（人生で何を優先すると満足しやすいか）。
  const LIFE_STRATEGY_BY_AXIS = {
    vision: "人生では、「まだ誰もやっていないことに挑戦できているか」が満足度を大きく左右します。安定よりも、可能性を追い続けられる環境を優先すると満たされやすいタイプです。",
    logic: "人生では、「納得して選んだかどうか」が満足度を左右します。周囲に流されて決めた選択より、自分の頭で筋道を立てて選んだ道の方が、後悔が少なくなります。",
    drive: "人生では、「自分で動いて手に入れた実感があるか」が満足度を左右します。与えられるのを待つより、自分から動いて掴みにいく生き方の方が満たされやすいタイプです。",
    influence: "人生では、「自分の言葉や存在が誰かに影響を与えられているか」が満足度を左右します。一人で完結する生き方より、人と関わり発信し続ける生き方の方が満たされやすいタイプです。",
    bond: "人生では、「大切な人とどれだけ深く関われているか」が満足度を左右します。成果や地位より、信頼できる関係性を優先する生き方の方が満たされやすいタイプです。",
    stability: "人生では、「積み上げてきたものが揺らがずにあるか」が満足度を左右します。刺激の多さより、着実に積み重ねられる環境を優先する生き方の方が満たされやすいタイプです。",
  };

  // STATEごとに「まず気持ちを受け止める」ための書き出し文
  const STATE_OPENING_LINES = {
    FLOW: "今のあなたは、これ以上ないくらい波に乗れている状態です。ここまで積み上げてきたものが、きちんと形になり始めています。",
    STABLE: "浮き沈みに振り回されず、自分のペースを保てている。それができている人は、実はそう多くありません。",
    SEARCHING: "まだ答えが見えていないとしても、それは立ち止まっているのではなく、探し続けているということです。今のあなたに必要なのは焦りではなく、時間です。",
    STAGNATION: "今、思うように前へ進めていないと感じているとしたら、それはあなたの力が足りないからではありません。今の環境が、あなたの資質を発揮しにくい形になっているだけです。",
    OVERLOAD: "ここまで頑張ってこられたのは、決して当たり前のことではありません。踏ん張り続けてきたこと自体が、すでにあなたの強さの証明です。",
  };

  // ---------------------------------------------------------------------
  // 画面遷移
  // ---------------------------------------------------------------------
  const VIEW_IDS = [
    "top", "about", "types", "basic", "question", "state", "analyzing",
    "result", "personal-book", "kaku-match", "kaku-team", "pricing",
  ];

  function showView(id) {
    VIEW_IDS.forEach((v) => {
      const el = document.getElementById("view-" + v);
      if (el) el.hidden = v !== id;
    });
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
    if (id === "personal-book") initPersonalBookView();
    if (id === "kaku-match") initKakuMatchView();
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
  // タイプ一覧ページ: 全16 KAKU TYPE
  // ---------------------------------------------------------------------
  function renderTypesGallery() {
    const grid = document.getElementById("types-grid");
    if (!grid) return;

    grid.innerHTML = Object.values(KAKU_TYPES)
      .map(
        (type) => `
        <div class="type-card" data-type-id="${type.id}">
          <button type="button" class="type-card__summary">
            <img src="${type.image}" alt="${type.nameEn} ${type.nameJp}" class="type-card__image" loading="lazy" />
            <p class="type-card__poster-tag" style="background:${type.color}">${type.catchcopy}</p>
            <div class="type-card__body">
              <p class="type-card__type-en">${type.nameEn}</p>
              <p class="type-card__type-jp">${type.nameJp}</p>
              <p class="type-card__rarity">出現率 ${type.rarity}</p>
            </div>
            <span class="type-card__toggle" aria-hidden="true">＋</span>
          </button>
          <div class="type-card__detail" hidden>
            <p class="result-block__mini-title">WEAPON｜強み</p>
            <p>${type.weapon}</p>
            <p class="result-block__mini-title">BLIND SPOT｜盲点</p>
            <p>${type.blindSpot}</p>
            <p class="result-block__mini-title">TEAM ROLE｜チームでの役割</p>
            <p>${type.teamRole}</p>
            <p class="result-block__mini-title">RELATION STYLE｜関係の築き方</p>
            <p>${type.relationStyle}</p>
            <p class="result-block__mini-title">AWAKEN｜3つの言葉</p>
            <p><strong>${type.awaken.keywords.join(" × ")}</strong><br />${type.awaken.sentence}</p>
          </div>
        </div>`
      )
      .join("");

    grid.querySelectorAll(".type-card__summary").forEach((btn) => {
      btn.addEventListener("click", () => {
        const card = btn.closest(".type-card");
        const detail = card.querySelector(".type-card__detail");
        const toggle = card.querySelector(".type-card__toggle");
        const isOpen = !detail.hidden;
        detail.hidden = isOpen;
        toggle.textContent = isOpen ? "＋" : "－";
        card.classList.toggle("type-card--open", !isOpen);
      });
    });
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
    session.gap = computeGap(
      session.core6.topAxis,
      session.birth.axis,
      session.state.key,
      session.core6.scores,
      session.state.average
    );
  }

  // ---------------------------------------------------------------------
  // CORE6 レーダーチャート（外部ライブラリなし・インラインSVG）
  // ---------------------------------------------------------------------
  function buildRadarSVG(scores, theme) {
    const size = 320;
    const center = size / 2;
    const maxR = 118;
    const axes = CORE6_AXES.map((a) => a.id);
    const n = axes.length;
    const isDark = theme === "dark";
    const palette = isDark
      ? { grid: "rgba(255,255,255,0.16)", label: "rgba(233,236,245,0.72)", fill: "#5EC8F2", fillOpacity: "0.22", stroke: "#5EC8F2" }
      : { grid: "#E4E4E0", label: "#5B5E68", fill: "#2C2F6B", fillOpacity: "0.18", stroke: "#2C2F6B" };

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
      gridPolys += `<polygon points="${pts}" fill="none" stroke="${palette.grid}" stroke-width="1" />`;
    });

    // 軸線 + ラベル
    let axisLines = "";
    let labels = "";
    axes.forEach((axisId, i) => {
      const [x, y] = pointFor(i, 100);
      axisLines += `<line x1="${center}" y1="${center}" x2="${x}" y2="${y}" stroke="${palette.grid}" stroke-width="1" />`;
      const labelPoint = pointFor(i, 122);
      const axisMeta = CORE6_AXES[i];
      labels += `<text x="${labelPoint[0]}" y="${labelPoint[1]}" font-size="12" font-weight="700" fill="${palette.label}" text-anchor="middle" dominant-baseline="middle">${axisMeta.nameJp}</text>`;
    });

    // データポリゴン
    const dataPts = axes
      .map((axisId, i) => pointFor(i, scores[axisId]).join(","))
      .join(" ");

    return `
      <svg class="radar-svg" viewBox="0 0 ${size} ${size}" role="img" aria-label="CORE6レーダーチャート">
        ${gridPolys}
        ${axisLines}
        <polygon class="radar-fill-anim" points="${dataPts}" fill="${palette.fill}" fill-opacity="${palette.fillOpacity}" stroke="${palette.stroke}" stroke-width="2.5" style="transform-origin:${center}px ${center}px;" />
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
        <p class="kaku-card__poster-tag" style="background:${type.color}">${type.catchcopy}</p>
        <div class="kaku-card__body">
          <p class="kaku-card__type-en">${type.nameEn}</p>
          <p class="kaku-card__type-jp">${type.nameJp}</p>
          <p class="kaku-card__praise">${type.praise}</p>
        </div>
      </div>

      <h3 class="subsection-title">CORE 6｜あなたを構成する6つの力</h3>
      <p class="form-note">6つの軸はそれぞれ0〜100点。数字が大きいほど、今の行動パターン（QUESTION）でその力を強く使っていることを表します。</p>
      <div class="radar-wrap">${buildRadarSVG(core6.scores)}</div>
      <div class="core6-grid">
        ${CORE6_AXES.map(
          (a) => `
          <div class="core6-grid__item">
            <div class="core6-grid__label">${a.nameEn}｜${a.nameJp}（${core6.scores[a.id]}点）</div>
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
        <h3>AWAKEN｜力を発揮しやすい条件</h3>
        <p><strong>${type.awaken.keywords.join(" × ")}</strong><br />${type.awaken.sentence}</p>
      </div>
      <div class="result-block">
        <h3>SHUTDOWN｜力が出にくくなる条件</h3>
        <p><strong>${type.shutdown.keywords.join(" × ")}</strong><br />${type.shutdown.sentence}</p>
      </div>

      <h3 class="subsection-title" id="kaku-gap-title">KAKU GAP｜本来のあなたと、今のあなたのズレ</h3>
      <p class="form-note">
        KAKUだけの見方です。「生まれ持った資質（BIRTH）」と「今いちばん使っている力（QUESTION）」を比べることで、
        今の力の発揮しやすさが見えてきます。能力の優劣を測るものでも、医療的な診断でもありません。
      </p>
      <div class="gap-hero">
        <p class="gap-hero__eyebrow">KAKU GAP</p>
        <div class="gap-hero__compare">
          <div class="gap-hero__before">
            <p class="gap-hero__tag">本来のあなた｜BIRTH</p>
            <p>${gap.beforeText}</p>
          </div>
          <div class="gap-hero__arrow" aria-hidden="true">→</div>
          <div class="gap-hero__after">
            <p class="gap-hero__tag">今のあなた｜QUESTION × STATE</p>
            <p>${gap.afterText}</p>
          </div>
        </div>
        <div class="gap-hero__score">
          <div class="gap-hero__score-number gap-hero__score-number--${gap.tier.key}">${gap.score}</div>
          <div class="gap-hero__score-body">
            <p class="gap-hero__score-tier">KAKU GAP｜${gap.tier.label}</p>
            <div class="gap-hero__meter"><div class="gap-hero__meter-fill gap-hero__meter-fill--${gap.tier.key}" style="width:${gap.score}%"></div></div>
            <p class="gap-hero__score-caption">0に近いほど「本来の資質をそのまま活かせている」、100に近いほど「本来の資質と、今使っている力にズレがある」ことを表します。</p>
          </div>
        </div>
        <p class="gap-hero__message"><strong>${gap.headline}。</strong><br />${gap.message}</p>
      </div>

      <div class="result-block">
        <h3>BIRTH｜${birth.title}（生まれ持った資質）</h3>
        <p>${birth.description}</p>
      </div>
      <div class="result-block">
        <h3>STATE｜${state.label}（今のあなたの状態）</h3>
        <p>${state.description}</p>
      </div>

      <div class="upsell-banner">
        <div class="upsell-banner__formula" aria-hidden="true">
          <span class="upsell-banner__chip">QUESTION</span>
          <span class="upsell-banner__times">×</span>
          <span class="upsell-banner__chip">BIRTH</span>
          <span class="upsell-banner__times">×</span>
          <span class="upsell-banner__chip">STATE</span>
        </div>
        <h3 class="upsell-banner__title">あなただけのPERSONAL BOOKで<br />自己理解をより深める。</h3>
        <p class="upsell-banner__text">
          行動パターンだけを見る診断とは違い、KAKUは今の行動（QUESTION）から導いた「${type.nameJp}」に、
          生まれ持った資質（BIRTH）と今の状態（STATE）を掛け合わせて分析します。だからこそ、
          "本来のあなた"と"今使っている力"のズレ、そして今のあなたに合った次の一歩まで見えてくる。
          PERSONAL BOOKでは、その3つを統合した分析に加えて、強みの活かし方・気づきにくい盲点、
          そして恋愛・結婚・仕事における相性まで、あなた専用の1冊にまとめました。
        </p>
        <button class="btn btn--cta" data-nav="personal-book">より詳細を見たい方はこちら →</button>
      </div>

      <div class="share-row">
        <button class="btn btn--primary" id="btn-save-image">シェア画像を保存する</button>
        <button class="btn" id="btn-share-x">Xでシェア</button>
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
        const canvas = await buildShareCardCanvas(type, session);
        await shareOrDownloadCanvas(
          canvas,
          `kaku-${type.id}.png`,
          "KAKU診断結果",
          `私のKAKUは「${type.nameEn}（${type.nameJp}）」でした。 #KAKU核診断`,
          statusEl
        );
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

  // canvasを画像化して、Web Share APIが使える環境ではシェアシートを、
  // 使えない環境ではダウンロードを実行する共通処理（結果ページ／PERSONAL BOOK共通）。
  async function shareOrDownloadCanvas(canvas, fileName, shareTitle, shareText, statusEl) {
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    const file = new File([blob], fileName, { type: "image/png" });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: shareTitle, text: shareText });
      if (statusEl) statusEl.textContent = "";
    } else {
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
      if (statusEl) statusEl.textContent = "画像を保存しました。SNSに投稿してシェアしてください。";
    }
  }

  // PERSONAL BOOKの「表紙」だけを見せるシェア画像（中身の解説文は含めない・プライバシー配慮）
  function buildBookCoverShareCanvas(type, session) {
    return new Promise((resolve, reject) => {
      const W = 900;
      const H = 1200;
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d");

      const grad = ctx.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, type.color);
      grad.addColorStop(1, "#14161f");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // 上部の「PERSONAL BOOK」ロゴ演出：グロー付きバッジ＋レタースペーシングで
      // ワクワク感のある“特別な1冊”感を強調する（単なるプレーンテキストにしない）。
      ctx.textAlign = "left";
      const labelChars = "PERSONAL BOOK".split("");
      const labelLetterSpacing = 7;
      ctx.font = "800 38px sans-serif";
      let labelWidth = 0;
      labelChars.forEach((ch) => {
        labelWidth += ctx.measureText(ch).width + labelLetterSpacing;
      });
      labelWidth -= labelLetterSpacing;

      const badgeW = labelWidth + 80;
      const badgeH = 78;
      const badgeX = W / 2 - badgeW / 2;
      const badgeY = 60;
      ctx.save();
      ctx.shadowColor = "rgba(94, 200, 242, 0.9)";
      ctx.shadowBlur = 36;
      ctx.fillStyle = "rgba(94, 200, 242, 0.14)";
      ctx.strokeStyle = "rgba(94, 200, 242, 0.95)";
      ctx.lineWidth = 2;
      if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 999);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();

      ctx.save();
      ctx.font = "800 38px sans-serif";
      ctx.fillStyle = "#FFFFFF";
      ctx.shadowColor = "rgba(94, 200, 242, 0.95)";
      ctx.shadowBlur = 18;
      let labelX = W / 2 - labelWidth / 2;
      const labelBaselineY = badgeY + badgeH / 2 + 13;
      labelChars.forEach((ch) => {
        ctx.fillText(ch, labelX, labelBaselineY);
        labelX += ctx.measureText(ch).width + labelLetterSpacing;
      });
      ctx.restore();

      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.font = "13px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("― あなただけの、たった1冊 ―", W / 2, badgeY + badgeH + 30);

      const img = new Image();
      img.onload = () => {
        try {
          const boxW = 420;
          const boxH = 610;
          const boxX = (W - boxW) / 2;
          const boxY = 210;
          const scale = Math.min(boxW / img.width, boxH / img.height);
          const drawW = img.width * scale;
          const drawH = img.height * scale;
          const drawX = boxX + (boxW - drawW) / 2;
          const drawY = boxY + (boxH - drawH) / 2;

          ctx.save();
          ctx.shadowColor = "rgba(0,0,0,0.4)";
          ctx.shadowBlur = 30;
          ctx.fillStyle = "#000";
          if (ctx.roundRect) {
            ctx.beginPath();
            ctx.roundRect(boxX, boxY, boxW, boxH, 16);
            ctx.fill();
          }
          ctx.restore();

          ctx.drawImage(img, drawX, drawY, drawW, drawH);

          let y = boxY + boxH + 66;
          ctx.textAlign = "center";
          ctx.fillStyle = "#fff";
          ctx.font = "bold 33px sans-serif";
          const name = session && session.name ? session.name + "さんの" : "私の";
          y += wrapCanvasText(ctx, `${name}PERSONAL BOOKが完成しました`, W / 2, y, W - 140, 42);
          y += 14;

          ctx.fillStyle = "rgba(255,255,255,0.72)";
          ctx.font = "19px sans-serif";
          ctx.fillText(`${type.nameJp}｜出現率 ${type.rarity}`, W / 2, y);

          ctx.strokeStyle = "rgba(255,255,255,0.3)";
          ctx.beginPath();
          ctx.moveTo(80, H - 90);
          ctx.lineTo(W - 80, H - 90);
          ctx.stroke();

          ctx.fillStyle = "rgba(255,255,255,0.7)";
          ctx.font = "18px sans-serif";
          ctx.fillText("行動 × 資質 × 状態 ＝ あなたの核　#KAKU核診断", W / 2, H - 55);

          resolve(canvas);
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = reject;
      img.src = type.image;
    });
  }

  function buildShareCardCanvas(type, session) {
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
          y += wrapCanvasText(ctx, type.catchcopy, W / 2, y, W - 200, 30);
          y += 34;

          // CORE6簡易表示（6軸の値を小さなバーで並べ、プロフィールらしさを出す）
          const core6ForCard = (session && session.core6 && session.core6.scores) || null;
          if (core6ForCard) {
            const barAreaW = W - 200;
            const barX0 = 100;
            const barH = 6;
            const gapY = 26;
            ctx.textAlign = "left";
            CORE6_AXES.forEach((a, i) => {
              const rowY = y + i * gapY;
              ctx.fillStyle = "#5B5E68";
              ctx.font = "12px sans-serif";
              ctx.fillText(a.nameJp, barX0, rowY - 4);
              ctx.fillStyle = "#E4E4E0";
              if (ctx.roundRect) {
                ctx.beginPath();
                ctx.roundRect(barX0 + 70, rowY - barH, barAreaW - 70, barH, 3);
                ctx.fill();
              }
              const val = core6ForCard[a.id] || 0;
              ctx.fillStyle = type.color;
              if (ctx.roundRect) {
                ctx.beginPath();
                ctx.roundRect(barX0 + 70, rowY - barH, (barAreaW - 70) * (val / 100), barH, 3);
                ctx.fill();
              }
            });
            y += CORE6_AXES.length * gapY + 10;
          }

          // フッター
          ctx.strokeStyle = "#E4E4E0";
          ctx.beginPath();
          ctx.moveTo(80, H - 100);
          ctx.lineTo(W - 80, H - 100);
          ctx.stroke();

          ctx.fillStyle = "#5B5E68";
          ctx.font = "18px sans-serif";
          ctx.fillText("行動 × 資質 × 状態 ＝ あなたの核　#KAKU核診断", W / 2, H - 60);

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
  // PERSONAL BOOK プレビュー（購入前サンプル・仮実装）
  // ---------------------------------------------------------------------
  function renderPersonalBookPreview() {
      const target = document.getElementById("personal-book-preview");
      if (!session.typeId) return;
      const type = KAKU_TYPES[session.typeId];
      const scores = session.core6.scores;
      const birth = session.birth;
      const state = session.state;
      const gap = session.gap;
      const birthLabel = CORE6_LABELS[birth.axis];
      const questionLabel = CORE6_LABELS[session.core6.topAxis];
      const isGoodState = GOOD_STATES.includes(state.key);

      // 第2章｜CORE6全軸解説の再設計：
      // 上位2軸（主軸・副軸）はすでに第1章で物語として展開済みのため、ここでは数値の再確認に留め、
      // 汎用的な三段階コメントを重複させない。残り4軸は個別に4段落を並べず、1つの文章に統合することで、
      // 「スコアを日本語に変換しただけ」の退屈な羅列にならないようにしている。
      const topAxisId = session.core6.topAxis;
      const secondAxisId = session.core6.secondAxis;
      const primaryAxisIds = [topAxisId, secondAxisId];

      const primaryAxesHtml = CORE6_AXES.filter((a) => primaryAxisIds.includes(a.id))
        .map((a) => {
          const score = scores[a.id];
          const badges = [];
          if (a.id === birth.axis) {
            badges.push('<span class="axis-badge axis-badge--birth">BIRTH｜生まれ持った資質</span>');
          }
          if (a.id === topAxisId) {
            badges.push('<span class="axis-badge axis-badge--question">QUESTION｜今よく使っている力</span>');
          }
          return `
          <div class="book-axis-row">
            <div class="book-axis-row__label">
              <span>${a.nameEn}｜${a.nameJp}</span>
              <span>${score}点</span>
            </div>
            <div class="core6-grid__bar"><div class="core6-grid__bar-fill" style="width:${score}%"></div></div>
            ${badges.length ? `<div class="axis-badge-row">${badges.join("")}</div>` : ""}
          </div>`;
        })
        .join("");

      const otherAxes = CORE6_AXES.filter((a) => !primaryAxisIds.includes(a.id));
      const otherAxesHtml = otherAxes
        .map((a) => {
          const score = scores[a.id];
          return `
          <div class="book-axis-row book-axis-row--compact">
            <div class="book-axis-row__label">
              <span>${a.nameEn}｜${a.nameJp}</span>
              <span>${score}点</span>
            </div>
            <div class="core6-grid__bar"><div class="core6-grid__bar-fill" style="width:${score}%"></div></div>
          </div>`;
        })
        .join("");

      const sortedOtherAxes = otherAxes.slice().sort((x, y) => scores[y.id] - scores[x.id]);
      const helperAxis = sortedOtherAxes[0];
      const quietAxis = sortedOtherAxes[sortedOtherAxes.length - 1];
      const primaryLabelForAxes = CORE6_LABELS[topAxisId];
      const otherAxesInsight =
        scores[helperAxis.id] === scores[quietAxis.id]
          ? `残り4つの軸は、特にどれかが突出することなく、まんべんなく備わっています。これは、状況に応じてどの力も一定水準で使える、地に足のついたバランス感覚があるということです。だからこそ、${primaryLabelForAxes}という一番の力を、迷いなく前面に出せているのだと思います。`
          : `残り4つの軸の中では、<strong>${helperAxis.nameJp}</strong>（${scores[helperAxis.id]}点）が一歩リードしていて、${AXIS_GIFT_PHRASES[helperAxis.id]}という形で、あなたの${primaryLabelForAxes}をそっと支えています。逆に<strong>${quietAxis.nameJp}</strong>（${scores[quietAxis.id]}点）は控えめですが、これは弱点ではなく、${primaryLabelForAxes}に力を集中させるために自然と手放している部分だと捉えると納得できるはずです。`;

      // BIRTH（生まれ持った資質）× QUESTION（今の行動）× STATE（今の状態）の統合分析。
      // GAPが一致しているか／今の状態が良好か、の2軸4パターンで行動プランを出し分ける。
      // ここは「〜かもしれません」「〜してみましょう」で終わらせず、今日・今週単位で
      // 実行できる具体的な一手を断言する（診断結果を読んでも自分で決められない、を防ぐため）。
      const topMove = AXIS_CONCRETE_MOVE[session.core6.topAxis];
      const birthMove = AXIS_CONCRETE_MOVE[birth.axis];
      let integratedActions;
      if (gap.matched && isGoodState) {
        integratedActions = [
          `生まれ持った資質と今の行動が一致していて、これがあなたの土台です。変える必要はありません。今週は、${topMove}。`,
          `${state.label}の状態を保つために、新しいやり方は試さず、今のルーティンを最低3週間はそのまま続けてください。`,
          `${birthLabel}が発揮できた場面を、今日中に1つだけメモに残してください。次に迷ったときの判断材料になります。`,
        ];
      } else if (gap.matched && !isGoodState) {
        integratedActions = [
          `資質と行動は一致していますが、今の状態（${state.label}）は本来の力を発揮しにくい状態です。今週は新しいことを始めず、休息の予定を1つ先にカレンダーへ入れてください。`,
          `${birthLabel}を無理に発揮し続けると消耗します。今週、${birthLabel}を使う場面を意図的に1つ減らしてください。`,
          `3日後、状態に変化があったかを振り返ってください。変わっていなければ、負荷の原因を「役割」「環境」「人間関係」のどれか1つに絞って書き出してください。`,
        ];
      } else if (!gap.matched && isGoodState) {
        integratedActions = [
          `本来の${birthLabel}とは違う${questionLabel}を、今の環境ではうまく使えています。今のやり方を変える必要はありません。`,
          `ただし${birthLabel}を使う機会がないままだと、いずれ物足りなさにつながります。今週中に、${birthLabel}を使う場面を自分から1つ作ってください。`,
          `具体的には、今週のどこかで${birthMove}。`,
        ];
      } else {
        integratedActions = [
          `本来の${birthLabel}から離れた${questionLabel}を、${state.label}のまま使い続けています。今週はまず、${questionLabel}を使う場面を1つ減らしてください。`,
          `今の環境や役割が${birthLabel}を発揮しにくい構造になっていないか、今日中に原因を「役割」「人間関係」「業務量」のどれか1つに絞って書き出してください。`,
          `小さくて構いません。今週、${birthMove}。それが、状態の回復につながります。`,
        ];
      }
      const integratedActionsHtml = integratedActions
        .map((text, i) => `<p><strong>アクション${i + 1}：</strong>${text}</p>`)
        .join("");

      // 第1章用: 副軸を「もう一つの隠れた才能」として開示する演出
      const secondAxisGift = AXIS_GIFT_PHRASES[session.core6.secondAxis];
      const primaryGift = AXIS_GIFT_PHRASES[session.core6.topAxis];
      const openingLine = STATE_OPENING_LINES[state.key] || "";

      // CONTEXT（購入前に答えてもらった3つの追加質問）を反映した、この人だけの補足解説
      const contextInsight = session.context
        ? generateContextInsight(session.context, type, {
            stateLabel: state.label,
            birthLabel: birthLabel,
            bondScore: scores.bond,
          })
        : null;

      const coverTitle = session.name ? `${session.name}さんのPERSONAL BOOK` : "あなたのPERSONAL BOOK";

      target.innerHTML = `
        <div class="book-preview">
          <p class="form-note">※ ここから先は購入前の内容サンプルです。実際の購入版では、全16タイプぶんの書き下ろし解説がさらに続きます。</p>

          <div class="book-cover" style="background: linear-gradient(160deg, ${type.color} 0%, #14161f 100%);">
            <p class="book-cover__label">PERSONAL BOOK｜SAMPLE</p>
            <img src="${type.image}" alt="${type.nameJp}" class="book-cover__image" />
            <p class="book-cover__title">${coverTitle}</p>
            <div class="book-cover__rule"></div>
          </div>

          <div class="book-share-row share-row no-print">
            <button class="btn" id="btn-book-pdf">📄 PDFとして保存する</button>
            <button class="btn" id="btn-book-cover-share">表紙画像を保存する</button>
            <button class="btn btn--text" id="btn-book-share-x">Xでシェア</button>
          </div>
          <p class="form-note no-print" id="book-share-status" aria-live="polite"></p>

          <div class="opening-letter">
            <p class="opening-letter__to">${session.name ? session.name + "さんへ" : "あなたへ"}</p>
            <p>${openingLine}</p>
            <p>
              これは、16タイプ中<strong>${type.rarity}</strong>という少数派である「${type.nameJp}」のあなたのために
              書かれたページです。同じ${type.nameJp}であっても、あなたと全く同じ資質・行動・状態の組み合わせを
              持つ人は、そう多くはいません。
            </p>
          </div>

          <div class="book-tabs no-print" role="tablist">
            <button type="button" class="book-tab is-active" data-tab="1">第1章</button>
            <button type="button" class="book-tab" data-tab="2">第2章</button>
            <button type="button" class="book-tab" data-tab="3">第3章</button>
            <button type="button" class="book-tab" data-tab="4">第4章</button>
            <button type="button" class="book-tab" data-tab="5">第5章</button>
          </div>

          <div class="result-block book-tabpanel" data-tabpanel="1">
            <p class="book-chapter">第1章</p>
            <h3>あなたのKAKU（核）の全体像</h3>
            <p>${type.personalBookInsight}</p>
            <p>
              そしてもう一つ。「${type.blindSpot}」——これは弱点ではなく、「${type.weapon}」という、あなたの
              一番の武器が生んでいる影のようなものです。強い光には、必ず影ができます。この影を消そうとするより、
              光の方を自覚して使う方が、あなたはずっと生きやすくなります。
            </p>
            <p class="result-block__mini-title">もう一つの隠れた才能</p>
            <p>
              QUESTIONの回答から見ると、あなたの一番の力は<strong>${primaryGift}</strong>ですが、
              実はその次に、<strong>${secondAxisGift}</strong>という2つ目の力も強く持っています。
              ${type.nameJp}は本来この2つの力が掛け合わさって初めて成立するタイプなので、同じ${type.nameJp}の
              中でも、この2つ目の力の強さは人によって違います。あなたの場合はこれが強く出ている、という点が、
              数ある${type.nameJp}の中でもあなたを特徴づけている部分です。
            </p>
            ${
              contextInsight
                ? `
            <p class="result-block__mini-title">たとえば、今のあなたなら</p>
            <p>${contextInsight.roleText}</p>
            <p>${contextInsight.valueText}</p>
            <p>${contextInsight.relationshipText}</p>`
                : ""
            }
          </div>

          <div class="result-block book-tabpanel" data-tabpanel="2" hidden>
            <p class="book-chapter">第2章</p>
            <h3>核をどう活かすか｜WORK・CAREER</h3>
            <p class="result-block__mini-title">WORK｜向いている仕事・役割・働き方</p>
            <p>${WORK_BY_AXIS[topAxisId]}</p>
            <p class="result-block__mini-title">CAREER｜会社員・管理職・専門職・起業の適性傾向</p>
            <p>${CAREER_BY_AXIS[topAxisId]}</p>
            <p class="result-block__mini-title">AWAKEN｜具体的にどんな環境で能力が最大化するか</p>
            <p><strong>${type.awaken.keywords.join(" × ")}</strong>――${type.awaken.sentence}
              こういった条件が揃う環境ほど、あなたの${primaryGift}が最大化します。</p>
            <p class="result-block__mini-title">SHUTDOWN｜どんな環境で能力が落ちるか</p>
            <p><strong>${type.shutdown.keywords.join(" × ")}</strong>――${type.shutdown.sentence}
              こうした環境が続いているなら、能力が足りないのではなく、環境とのミスマッチを疑ってみてください。</p>
          </div>

          <div class="result-block book-tabpanel" data-tabpanel="3" hidden>
            <p class="book-chapter">第3章</p>
            <h3>人との関わり方と、伸びしろ｜RELATION・GROWTH</h3>
            <p class="result-block__mini-title">RELATION｜人間関係での特徴</p>
            <p>${type.relationStyle}</p>
            <p class="result-block__mini-title">GROWTH｜伸ばすべき力</p>
            <p>
              残り4軸の中で一歩リードしている<strong>${helperAxis.nameJp}</strong>（${scores[helperAxis.id]}点）を意識的に
              使う場面を増やすと、一番の力である${primaryGift}をさらに支える土台になります。まずはここを伸ばすのが、
              一番コストパフォーマンスの良い成長のしかたです。
            </p>
            <p class="result-block__mini-title">GROWTH｜無理に直さなくていい弱点</p>
            <p>
              「${type.blindSpot}」は、直すべき欠点ではありません。${type.weapon}という武器の裏側にある特性なので、
              なくそうとするより、「今それが出ているな」と気づけるようになることの方が、ずっと現実的で効果的です。
            </p>
          </div>

          <div class="result-block book-tabpanel" data-tabpanel="4" hidden>
            <p class="book-chapter">第4章</p>
            <h3>CORE6 全軸解説｜BIRTH × QUESTION × STATE 統合分析</h3>
            <p class="form-note">
              ここからは、CORE6の6つの軸それぞれの実際の数値を見ていきます。数値はすべて0〜100点で、
              大きいほどその力を強く使っている（BIRTHの場合は生まれ持っている）ことを表します。
            </p>
            <div class="radar-wrap">${buildRadarSVG(scores, "dark")}</div>
            <p class="result-block__mini-title">主軸2つの実際の数値</p>
            ${primaryAxesHtml}
            <p>
              この2つが、第1章で触れたあなたの一番の力（${CORE6_LABELS[topAxisId]}）と、
              もう一つの隠れた才能（${CORE6_LABELS[secondAxisId]}）です。
            </p>
            <p class="result-block__mini-title">残り4つの軸のバランス</p>
            ${otherAxesHtml}
            <p>${otherAxesInsight}</p>
            <p class="result-block__mini-title">統合分析｜生まれ持った資質と、今の行動・状態の関係</p>
            <p>
              生まれ持った資質は<strong>${birthLabel}</strong>ですが、今いちばんよく使っている力は
              <strong>${questionLabel}</strong>です。${gap.matched ? "この2つは一致しており、素の自分をそのまま発揮できていると言えます。" : "この2つにはズレがあり、今の環境が本来の資質を発揮しにくい状況になっている可能性があります。"}
              さらに、今の状態は<strong>${state.label}</strong>です。この「資質」「行動」「状態」の3つを掛け合わせると、
              今のあなたに合った次の一歩が見えてきます。
            </p>
            ${integratedActionsHtml}
            <p class="result-block__mini-title">LIFE STRATEGY｜人生で何を優先すると満足しやすいか</p>
            <p>${LIFE_STRATEGY_BY_AXIS[topAxisId]}</p>
          </div>

          <div class="result-block book-tabpanel" data-tabpanel="5" hidden>
            <p class="book-chapter">第5章</p>
            <h3>KAKU（核）を活かす3ステップ｜ACTION</h3>
            <p>
              まず伝えておきたいのは、あなたはすでに「${type.weapon}」を持っている、ということです。
              ここから先は、それを失くしたり直したりするための話ではなく、すでにあるものを、
              もっと周りに気づいてもらうための3ステップです。
            </p>
            <ol class="book-steps">
              <li class="book-step">
                <span class="book-step__num">1</span>
                <div class="book-step__body">
                  <p class="book-step__when">今週</p>
                  <p>${type.personalBookAction}</p>
                </div>
              </li>
              <li class="book-step">
                <span class="book-step__num">2</span>
                <div class="book-step__body">
                  <p class="book-step__when">1か月後</p>
                  <p>「${type.weapon}」が発揮できた場面を、3つ書き出してみましょう。書き出すことで、それが偶然ではなく、あなたの再現性のある力だと自分自身で確認できます。</p>
                </div>
              </li>
              <li class="book-step">
                <span class="book-step__num">3</span>
                <div class="book-step__body">
                  <p class="book-step__when">3か月後</p>
                  <p>「${type.blindSpot}」が出そうになった瞬間に、一呼吸だけ置いてみましょう。なくす必要はありません。気づけるようになるだけで、周囲の受け取り方は大きく変わります。</p>
                </div>
              </li>
            </ol>
          </div>

          <div class="result-block book-match-promo no-print">
            <p class="book-chapter">KAKU MATCH</p>
            <h3>気になる相手との相性は、別サービスでもっと詳しく</h3>
            <p>
              恋愛・結婚・仕事、それぞれの相性をより詳しく見られる「KAKU MATCH」を、PERSONAL BOOKとは
              独立したサービスとしてご用意しています。
            </p>
            <button class="btn no-print" data-nav="kaku-match">KAKU MATCHを見る →</button>
          </div>

          <div class="closing-note">
            <p>
              この1冊は、${type.nameJp}であるあなたを型にはめたり、否定したりするためのものではありません。
              すでにあなたの中にある${primaryGift}や${secondAxisGift}に、あなた自身が気づき、
              もっと自分を大切に扱えるようになるためのものです。
            </p>
            <p class="closing-note__sign">— KAKU ～核～</p>
          </div>
        </div>
      `;

      document.getElementById("btn-book-pdf").addEventListener("click", () => {
        window.print();
      });

      document.getElementById("btn-book-share-x").addEventListener("click", () => {
        const shareText = `私だけの「PERSONAL BOOK」（${type.nameJp}）ができました。\n#KAKU核診断`;
        const url = "https://twitter.com/intent/tweet?text=" + encodeURIComponent(shareText);
        window.open(url, "_blank", "noopener");
      });

      document.getElementById("btn-book-cover-share").addEventListener("click", async () => {
        const statusEl = document.getElementById("book-share-status");
        const btn = document.getElementById("btn-book-cover-share");
        btn.disabled = true;
        statusEl.textContent = "表紙画像を作成しています…";
        try {
          const canvas = await buildBookCoverShareCanvas(type, session);
          await shareOrDownloadCanvas(canvas, `personal-book-${type.id}.png`, "PERSONAL BOOK", `私だけの「PERSONAL BOOK」（${type.nameJp}）ができました。 #KAKU核診断`, statusEl);
        } catch (err) {
          statusEl.textContent = "画像の作成に失敗しました。時間をおいて再度お試しください。";
        } finally {
          btn.disabled = false;
        }
      });

      const bookTabButtons = target.querySelectorAll(".book-tab");
      const bookTabPanels = target.querySelectorAll(".book-tabpanel");
      bookTabButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
          const key = btn.getAttribute("data-tab");
          bookTabButtons.forEach((b) => b.classList.toggle("is-active", b === btn));
          bookTabPanels.forEach((p) => {
            p.hidden = p.getAttribute("data-tabpanel") !== key;
          });
          target.closest(".container").scrollIntoView({ behavior: "smooth", block: "start" });
        });
      });
  }

  function initPersonalBookView() {
    const introEl = document.getElementById("context-intro");
    const previewTarget = document.getElementById("personal-book-preview");
    if (previewTarget) previewTarget.innerHTML = "";
    if (!introEl) return;

    if (!session.typeId) {
      introEl.hidden = false;
      introEl.innerHTML = `
        <p class="context-intro__title">深掘り診断｜3つだけ質問させてください</p>
        <p class="body-text">プレビューを見るには、先に無料診断でKAKUタイプを診断してください。</p>
        <button class="btn btn--primary" data-action="start-diagnosis">無料で診断をはじめる</button>
      `;
      return;
    }

    introEl.hidden = false;
    introEl.innerHTML = `
      <p class="context-intro__title">深掘り診断｜3つだけ質問させてください</p>
      <p class="body-text">
        今の仕事・役割、大事にしたい価値観、気になっている人間関係を教えてください。
        この3つを踏まえて、あなたの状況によりフィットしたプレビューを作成します（選択式・30秒程度です）。
      </p>
      <div id="context-form"></div>
      <button class="btn" id="btn-preview-personal-book" disabled>この内容でプレビューを見る</button>
    `;

    const formEl = document.getElementById("context-form");
    const submitBtn = document.getElementById("btn-preview-personal-book");
    const answers = {};

    formEl.innerHTML = CONTEXT_QUESTIONS.map(
      (q) => `
      <div class="context-item" data-key="${q.key}">
        <p class="context-item__prompt">${q.prompt}</p>
        <div class="context-item__options">
          ${q.options
            .map(
              (opt) =>
                `<button type="button" class="context-option" data-key="${q.key}" data-value="${opt.value}">${opt.label}</button>`
            )
            .join("")}
        </div>
      </div>`
    ).join("");

    formEl.querySelectorAll(".context-option").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.getAttribute("data-key");
        const value = btn.getAttribute("data-value");
        answers[key] = value;
        formEl
          .querySelectorAll(`.context-option[data-key="${key}"]`)
          .forEach((b) => b.classList.toggle("is-selected", b === btn));
        submitBtn.disabled = Object.keys(answers).length < CONTEXT_QUESTIONS.length;
      });
    });

    submitBtn.addEventListener("click", () => {
      session.context = Object.assign({}, answers);
      introEl.hidden = true;
      renderPersonalBookPreview();
    });
  }

  // ---------------------------------------------------------------------
  // KAKU MATCH（独立サービス）｜以前はPERSONAL BOOK第4章だったが、
  // 「PERSONAL BOOKだけでも価値が完結するように」という方針で別サービスとして切り出した。
  // 恋愛・結婚・仕事それぞれについて、「なぜこの数字？」に加えて「気をつけたいポイント」まで見せる。
  // ---------------------------------------------------------------------
  function initKakuMatchView() {
    const introEl = document.getElementById("kaku-match-intro");
    const previewTarget = document.getElementById("kaku-match-standalone-preview");
    if (previewTarget) previewTarget.innerHTML = "";
    if (!introEl) return;

    if (!session.typeId) {
      introEl.hidden = false;
      introEl.innerHTML = `
        <p class="context-intro__title">先に無料診断を受けてください</p>
        <p class="body-text">KAKU MATCHを試すには、先に無料診断であなたのKAKUタイプを診断してください。</p>
        <button class="btn btn--primary" data-action="start-diagnosis">無料で診断をはじめる</button>
      `;
      return;
    }

    const partnerOptions = Object.values(KAKU_TYPES)
      .map((t) => `<option value="${t.id}">${t.nameEn}｜${t.nameJp}</option>`)
      .join("");

    introEl.hidden = false;
    introEl.innerHTML = `
      <p class="context-intro__title">お相手のKAKUタイプを選んでください</p>
      <p class="body-text">
        本来はお相手にもQUESTION・BIRTH・STATEを診断してもらい、2人分のデータから算出します。
        サンプルでは「お相手のタイプ」を選ぶだけの簡易版を試せます。
      </p>
      <label class="form-field" style="max-width:320px;">
        <span>お相手のKAKUタイプ（サンプル選択）</span>
        <select id="match-partner-select">${partnerOptions}</select>
      </label>
      <button class="btn btn--primary" id="btn-preview-match">この相性を見る</button>
    `;

    document.getElementById("btn-preview-match").addEventListener("click", () => {
      const partnerId = document.getElementById("match-partner-select").value;
      renderKakuMatchStandalone(partnerId);
    });
  }

  function renderKakuMatchStandalone(partnerId) {
    const target = document.getElementById("kaku-match-standalone-preview");
    if (!target || !session.typeId) return;
    const type = KAKU_TYPES[session.typeId];
    const typeB = KAKU_TYPES[partnerId] || KAKU_TYPES[Object.keys(KAKU_TYPES)[0]];
    const insight = generateMatchInsight(session.core6.scores, typeB);

    const categoryRows = insight.categories
      .map((c) => {
        const reasonLabel = CORE6_LABELS[c.reasonAxis];
        const reasonText =
          c.score >= 70
            ? `2人とも${reasonLabel}が近く、この相性の良さの核になっています。`
            : `${reasonLabel}の噛み合い方が、このスコアに一番効いています。`;
        return `
          <div class="match-category">
            <div class="match-category__head">
              <span class="match-category__label">${c.label}</span>
              <span class="match-category__score">${c.score}<span class="match-category__score-unit">%</span></span>
            </div>
            <div class="match-category__bar"><div class="match-category__bar-fill match-category__bar-fill--${c.key}" style="width:${c.score}%"></div></div>
            <p class="match-category__comment">${c.commentary}</p>
            <p class="match-category__reason">なぜこの数字？｜${reasonText}</p>
            ${c.advice ? `<p class="match-category__advice">気をつけたいポイント｜${c.advice}</p>` : ""}
          </div>`;
      })
      .join("");

    target.innerHTML = `
      <div class="book-preview match-standalone-preview">
        <div class="result-block match-result">
          <h3>${type.nameJp} × ${typeB.nameJp} の相性</h3>
          <p class="form-note">恋愛・結婚・仕事の3つのカテゴリで、それぞれ相性の傾向を詳しく見ていきます。</p>
          ${categoryRows}
        </div>
      </div>
    `;
  }

  // ---------------------------------------------------------------------
  // 初期化
  // ---------------------------------------------------------------------
  renderAboutCore6();
  renderTypesGallery();
  showView("top");
})();

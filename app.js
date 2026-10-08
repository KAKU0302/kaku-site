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

  // PERSONAL BOOK購入後にメールで届く復元リンク（?book=...）から開かれた場合はtrueになる。
  // このフラグが立っている間は、PERSONAL BOOK画面で深掘り質問（CONTEXT）を再度聞かず、
  // 購入時点の内容をそのまま表示する。
  let openedFromBookLink = false;

  // Stripe Checkout決済完了直後の戻り先（?purchased=1）から開かれた場合にtrueになる。
  // ブラウザが全画面リロードされる（＝それまでのsession中身は消えている）ため、
  // 診断結果を再表示するのではなく、「メールが届くのを待ってください」という案内だけを出す。
  let justPurchased = false;

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
    vision: "「未来を描く力」が一番の力のあなたは、ゼロから企画を立てる仕事、新規事業やまだ答えのない課題に取り組む仕事で力を発揮します。決められた手順をなぞる仕事より、「何をやるか」から自分で考えられる裁量のある環境の方が向いています。",
    logic: "「構造を見抜く力」が一番の力のあなたは、データ分析や業務改善など、筋道を立てて考える仕事に向いています。感覚や勢いだけで判断が求められる環境よりも、根拠を積み上げて進められる仕事の方が力を発揮しやすいタイプです。",
    drive: "「壁を破る力」が一番の力のあなたは、新規開拓や立ち上げフェーズのプロジェクトなど、動きながら結果を出す仕事に向いています。慎重な合意形成に時間をかける環境より、スピード感のある現場の方が力を発揮します。",
    influence: "「人を動かす力」が一番の力のあなたは、営業や広報、人を巻き込むリーダー的な役割に向いています。黙々と一人で完結する仕事より、人と関わりながら進める仕事の方が力を発揮しやすいタイプです。",
    bond: "「心を通わせる力」が一番の力のあなたは、人事やカスタマーサクセスなど、人の気持ちに寄り添う仕事に向いています。効率だけを追う環境より、関係性を大切にできる仕事の方が力を発揮します。",
    stability: "「積み上げる力」が一番の力のあなたは、オペレーションや品質管理など、積み重ねと正確さが求められる仕事に向いています。変化の激しい環境より、地に足のついた仕事の方が力を発揮しやすいタイプです。",
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

  // CORE6の6軸を、英語の軸名ではなく日本語の「力の名前」として見せるための短い呼び名。
  // 「日本語を主役、英語は補助ラベル」という方針に沿って、結果画面・PERSONAL BOOKの数値表示で使用する。
  const AXIS_POWER_NAMES = {
    vision: "未来を描く力",
    logic: "構造を見抜く力",
    drive: "壁を破る力",
    influence: "人を動かす力",
    bond: "心を通わせる力",
    stability: "積み上げる力",
  };

  // 上記の「力の名前」1つずつに添える、一言の説明（PERSONAL BOOK第2章で使用）。
  const AXIS_POWER_DESC = {
    vision: "まだ答えがないところから、「こうしたらいい」を考える力。",
    logic: "表面的な問題より、「なぜそうなっているのか」を考える力。",
    drive: "迷うより先に動き、壁を突破していく力。",
    influence: "自分が納得した未来なら、その意味を周囲にも伝えられる力。",
    bond: "相手の気持ちを汲み取り、深いところでつながる力。",
    stability: "積み重ねを大切にし、崩れない土台をつくる力。",
  };

  // PERSONAL BOOK 第6章「あなたの取扱説明書」｜調子がいい時のサイン・危険信号・戻るために必要なこと。
  // 一番の力（topAxis）を軸に、3つずつの短いサインとして提示する。
  const AXIS_GOOD_SIGNS = {
    vision: ["新しいアイデアが次々出てくる", "人に話したくなる", "時間を忘れて考え込む"],
    logic: ["筋道を立てて話せる", "根拠を持って判断できる", "「腑に落ちた」と感じる瞬間が増える"],
    drive: ["すぐに動きたくなる", "困難な状況にワクワクする", "結果が出るのが早い"],
    influence: ["人前で話すのが楽しい", "周囲が自然と動いてくれる", "言葉に力がこもる"],
    bond: ["人との会話が自然と増える", "相手の気持ちがよく分かる", "信頼されていると感じる"],
    stability: ["淡々とやるべきことをこなせる", "変化があっても動じない", "積み重ねに手応えを感じる"],
  };
  const AXIS_DANGER_SIGNS = {
    vision: ["同じ作業の繰り返しに苛立つ", "「意味がない」と感じ始める", "上の空になることが増える"],
    logic: ["納得できないまま流されることが増える", "考えることを放棄したくなる", "理由のない指示に苛立つ"],
    drive: ["待たされることに苛立つ", "やる気はあるのに動けない", "小さな失敗を引きずる"],
    influence: ["発信しても反応がないと感じる", "一人で黙っているのがつらくなる", "本音を飲み込むことが増える"],
    bond: ["人との距離を置きたくなる", "気を遣いすぎて疲れる", "孤独を感じやすくなる"],
    stability: ["急な変化に苛立つ", "落ち着かない気持ちが続く", "小さなことが気になり始める"],
  };
  const AXIS_RECOVERY = {
    vision: ["新しい問いを立ててみる", "制約を一度外して考えてみる", "誰かに構想を話してみる"],
    logic: ["一度立ち止まって根拠を整理する", "「なぜ」を自分に問い直す", "小さくてもいいので検証してみる"],
    drive: ["今すぐ動ける小さな一歩を見つける", "締め切りを自分で決める", "体を動かして勢いをつける"],
    influence: ["誰か一人にでも本音を話す", "小さな場で発信してみる", "反応をもらえる場に身を置く"],
    bond: ["信頼できる相手に気持ちを話す", "小さな感謝を伝えてみる", "一人の時間を意識的に取る"],
    stability: ["いつものルーティンに戻す", "変えなくていいものを1つ決める", "予定を整理して見通しを立てる"],
  };

  // PERSONAL BOOK 第8章「人と、どう付き合うか」｜描写（relationStyle）に続けて、
  // 「だからどうすればいいか」まで踏み込む、一番の力（topAxis）ごとの実践アドバイス。
  const RELATION_ADVICE_BY_AXIS = {
    vision: "人間関係で意識したいのは、「思いついた可能性を全部話す前に、まず結論を一言添えること。」相手が置いていかれずに済みます。",
    logic: "人間関係で意識したいのは、「結論より先に、考えた過程を共有すること。」あなたにとっては当然の筋道も、相手には見えていないことがあります。",
    drive: "人間関係で意識したいのは、「動き出す前に、一言だけ相手に共有すること。」勢いに置いていかれる人が減ります。",
    influence: "人間関係で意識したいのは、「話す量と同じだけ、相手の話を聞く時間を作ること。」熱量に圧倒される人がいることを忘れないでください。",
    bond: "人間関係で意識したいのは、「気を遣いすぎず、自分の本音も伝えること。」あなたが黙って合わせていることに、相手は案外気づいていません。",
    stability: "人間関係で意識したいのは、「変化を提案されたときに、即座に拒まず一度受け止めること。」安定を守ることと、頑なになることは違います。",
  };

  // STATE診断の各項目を、PERSONAL BOOK第5章（KAKU GAP）で「なぜそう判断したのか」を
  // 具体的に示すための日本語ラベル。数値そのものは見せず、低いものだけを言葉で示す。
  const STATE_ITEM_LABELS = {
    meaning: "やっていることへの意味",
    capability: "自分の能力を発揮できている感覚",
    challenge: "挑戦している感覚",
    relationship: "人間関係の満足度",
    rest: "休息が取れている感覚",
    hope: "将来への期待",
    growth: "成長している実感",
    autonomy: "自分で決められる感覚",
    recognition: "周囲から認められている感覚",
    margin: "心の余裕",
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
    "result", "personal-book", "kaku-match", "kaku-team", "pricing", "history",
  ];

  function showView(id) {
    VIEW_IDS.forEach((v) => {
      const el = document.getElementById("view-" + v);
      if (el) el.hidden = v !== id;
    });
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
    if (id === "personal-book") initPersonalBookView();
    if (id === "kaku-match") initKakuMatchView();
    if (id === "history") renderHistoryList();
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
    session.context = null;
    openedFromBookLink = false;
  }

  // ---------------------------------------------------------------------
  // 結果スナップショット：現在のsessionから「診断結果として確定した内容」だけを切り出す。
  // 履歴（localStorage保存）と、PERSONAL BOOK購入者にメールで送る復元リンクの、
  // 両方で同じ形のデータを使い回すための共通処理。後からロジック（core-engine.js等）を
  // 修正しても、すでに見せた・お金をいただいた結果の内容が変わってしまわないよう、
  // 再計算はせず「当時実際に出た結果」をそのまま保存・復元する。
  // ---------------------------------------------------------------------
  function buildResultSnapshot() {
    return {
      id: Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8),
      savedAt: new Date().toISOString(),
      name: session.name,
      birthdate: session.birthdate,
      questionAnswers: Object.assign({}, session.questionAnswers),
      stateAnswers: Object.assign({}, session.stateAnswers),
      context: session.context ? Object.assign({}, session.context) : null,
      core6: session.core6,
      birth: session.birth,
      state: session.state,
      typeId: session.typeId,
      gap: session.gap,
    };
  }

  function applySnapshotToSession(entry) {
    session.name = entry.name;
    session.birthdate = entry.birthdate;
    session.questionAnswers = Object.assign({}, entry.questionAnswers);
    session.stateAnswers = Object.assign({}, entry.stateAnswers);
    session.context = entry.context ? Object.assign({}, entry.context) : null;
    session.core6 = entry.core6;
    session.birth = entry.birth;
    session.state = entry.state;
    session.typeId = entry.typeId;
    session.gap = entry.gap;
  }

  // ---------------------------------------------------------------------
  // 履歴：診断結果をこのブラウザ（localStorage）に保存し、後から見返せるようにする。
  // このサイトはサーバーを持たない静的サイトのため、保存範囲は「この端末のこのブラウザ」に限られる。
  // ブラウザのデータを削除した場合や、別の端末・別のブラウザで開いた場合は復元できない前提。
  // ---------------------------------------------------------------------
  const HISTORY_STORAGE_KEY = "kaku_result_history_v1";
  const HISTORY_MAX_ENTRIES = 30;

  function loadHistory() {
    try {
      const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      return [];
    }
  }

  function saveHistoryList(list) {
    try {
      window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(list));
      return true;
    } catch (err) {
      // プライベートブラウジング等でlocalStorageが使えない環境でも、診断自体は続行できるようにする
      return false;
    }
  }

  // 診断結果が出た直後に呼び、現在のsessionの内容を履歴の先頭に追加する。
  function saveCurrentResultToHistory() {
    if (!session.typeId || !session.core6) return;
    const entry = buildResultSnapshot();
    const list = loadHistory();
    list.unshift(entry);
    saveHistoryList(list.slice(0, HISTORY_MAX_ENTRIES));
  }

  function formatHistoryDate(isoString) {
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return "";
      return (
        d.getFullYear() + "年" + (d.getMonth() + 1) + "月" + d.getDate() + "日 " +
        String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0")
      );
    } catch (err) {
      return "";
    }
  }

  // 履歴の1件を、通常の無料診断結果と同じ画面でそのまま見返せるようにする。
  function restoreFromHistoryEntry(entryId) {
    const entry = loadHistory().find((e) => e.id === entryId);
    if (!entry) return;
    applySnapshotToSession(entry);
    showView("result");
    renderResult();
  }

  function deleteHistoryEntry(entryId) {
    const list = loadHistory().filter((e) => e.id !== entryId);
    saveHistoryList(list);
    renderHistoryList();
  }

  function renderHistoryList() {
    const listEl = document.getElementById("history-list");
    if (!listEl) return;
    const history = loadHistory();

    if (history.length === 0) {
      listEl.innerHTML = `
        <div class="history-empty">
          <p class="body-text">まだ保存された診断結果がありません。診断を受けると、ここに結果が残るようになります。</p>
          <button class="btn btn--primary" data-action="start-diagnosis">3分で自分のKAKUを知る</button>
        </div>
      `;
      return;
    }

    listEl.innerHTML = `
      <div class="history-list">
        ${history
          .map((entry) => {
            const type = KAKU_TYPES[entry.typeId];
            if (!type) return "";
            return `
            <div class="history-item" data-entry-id="${entry.id}">
              <img class="history-item__image" src="${type.image}" alt="${type.nameEn} ${type.nameJp}" loading="lazy" />
              <div class="history-item__body">
                <p class="history-item__date">${formatHistoryDate(entry.savedAt)}</p>
                <p class="history-item__type">${type.nameEn}｜${type.nameJp}</p>
                ${entry.name ? `<p class="history-item__name">${entry.name}さんの結果</p>` : ""}
              </div>
              <div class="history-item__actions">
                <button type="button" class="btn btn--text" data-history-action="view">結果を見る</button>
                <button type="button" class="btn btn--text history-item__delete" data-history-action="delete">削除</button>
              </div>
            </div>`;
          })
          .join("")}
      </div>
      <p class="form-note">
        <button type="button" class="btn btn--text" id="btn-history-clear-all">履歴をすべて削除する</button>
      </p>
    `;

    listEl.querySelectorAll(".history-item").forEach((itemEl) => {
      const entryId = itemEl.getAttribute("data-entry-id");
      itemEl.querySelectorAll("[data-history-action]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const action = btn.getAttribute("data-history-action");
          if (action === "view") {
            restoreFromHistoryEntry(entryId);
          } else if (action === "delete") {
            if (window.confirm("この診断結果を履歴から削除しますか？")) {
              deleteHistoryEntry(entryId);
            }
          }
        });
      });
    });

    const clearAllBtn = document.getElementById("btn-history-clear-all");
    if (clearAllBtn) {
      clearAllBtn.addEventListener("click", () => {
        if (window.confirm("保存されているすべての診断結果を削除しますか？この操作は取り消せません。")) {
          saveHistoryList([]);
          renderHistoryList();
        }
      });
    }
  }

  // ---------------------------------------------------------------------
  // TOPページ: 12 KAKU TYPE ショーケース（3つの大分類ごとに見せる）
  //
  // 2026-09時点の重要な注記：ここで表示するのは「新体系で残る12タイプ」だけで、
  // 旧16タイプのうちmediator/builder/adventurer/finisherの4タイプは表示しない。
  // ただし診断ロジック（type-engine.js）自体はまだ12タイプ向けに再設計されておらず、
  // 実際に無料診断を受けると、今もこの4タイプのいずれかが結果として出ることがある
  // （その場合も結果ページ・PERSONAL BOOKは従来どおり正しく表示される）。
  // 表示と実際のロジックにズレがあるのは意図的な経過措置で、診断ロジックを
  // 12タイプ向けに再設計するタイミングで解消する（README参照）。
  //
  // キャラクター画像は今後12タイプ分の新規制作に差し替える前提のため、ここでは
  // 既存の16タイプ用画像をそのまま仮利用している（差し替えはtypes-data.jsのimage
  // フィールドを変更するだけで済む構造）。
  // ---------------------------------------------------------------------
  function buildTypeShowcaseSwatchHtml(type) {
    return `
      <a href="#" class="type-showcase__swatch" data-nav="types" data-type-id="${type.id}">
        <span class="type-showcase__swatch-photo">
          <img src="${type.image}" alt="${type.nameEn}｜${type.nameJp}" loading="lazy" />
        </span>
        <p class="type-showcase__swatch-code">${type.color}</p>
        <p class="type-showcase__swatch-name">${type.nameJp}</p>
      </a>`;
  }

  function buildTypeShowcaseSlideHtml(cat) {
    const swatchesHtml = cat.typeIds.map((id) => buildTypeShowcaseSwatchHtml(KAKU_TYPES[id])).join("");
    return `
      <div class="type-showcase__slide" data-category="${cat.id}">
        <div class="type-showcase__slide-card" style="--cat-color:${cat.color};">
          <div class="type-showcase__slide-bar">
            <span class="type-showcase__slide-bar-label">${cat.nameEn}</span>
            <p class="type-showcase__slide-bar-text">${cat.tagline}</p>
          </div>
          <div class="type-showcase__slide-visual">
            <p class="type-showcase__slide-watermark" aria-hidden="true">${cat.nameJp}</p>
          </div>
          <div class="type-showcase__slide-swatches">${swatchesHtml}</div>
        </div>
      </div>`;
  }

  function renderTypeShowcase() {
    const track = document.getElementById("type-showcase-track");
    if (!track) return;
    track.innerHTML = KAKU_TYPE_CATEGORY_ORDER.map((catId) => buildTypeShowcaseSlideHtml(KAKU_TYPE_CATEGORIES[catId])).join("");
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
        <div class="core6-grid__label">${AXIS_POWER_NAMES[a.id]}<span class="axis-en">（${a.nameEn}）</span></div>
      </div>`
    ).join("");
  }

  // ---------------------------------------------------------------------
  // タイプ一覧ページ: 12 KAKU TYPE（3つの大分類ごとにグループ表示）
  //
  // 2026-09時点の注記：ここでは新体系で残る12タイプのみを、3つの大分類
  // （創造型／推進型／共創型）ごとにグループ化して表示する。mediator/builder/
  // adventurer/finisherの旧4タイプは一覧には表示しないが、データ自体は
  // types-data.js側でtypeShowcase/renderTypeShowcaseと同じ理由で温存されて
  // おり、実際の診断結果・PERSONAL BOOKでは引き続き正しく表示される。
  // ---------------------------------------------------------------------
  function buildTypeCardHtml(type) {
    return `
      <div class="type-card" data-type-id="${type.id}" style="--type-color:${type.color};">
        <button type="button" class="type-card__summary">
          <img src="${type.image}" alt="${type.nameEn} ${type.nameJp}" class="type-card__image" loading="lazy" />
          <p class="type-card__poster-tag">${type.catchcopy}</p>
          <div class="type-card__body">
            <p class="type-card__type-en">${type.nameEn}</p>
            <p class="type-card__type-jp">${type.nameJp}</p>
            <p class="type-card__rarity">出現率 ${type.rarity}</p>
          </div>
          <span class="type-card__toggle" aria-hidden="true">＋</span>
        </button>
        <div class="type-card__detail" hidden>
          <p class="result-block__mini-title">あなたの武器</p>
          <p>${type.weapon}</p>
          <p class="result-block__mini-title">陥りやすい罠</p>
          <p>${type.blindSpot}</p>
          <p class="result-block__mini-title">組織で輝く役割</p>
          <p>${type.teamRole}</p>
          <p class="result-block__mini-title">人との向き合い方</p>
          <p>${type.relationStyle}</p>
          <p class="result-block__mini-title">覚醒する条件</p>
          <p><strong>${type.awaken.keywords.join(" × ")}</strong><br />${type.awaken.sentence}</p>
        </div>
      </div>`;
  }

  function renderTypesGallery() {
    const grid = document.getElementById("types-grid");
    if (!grid) return;

    grid.innerHTML = KAKU_TYPE_CATEGORY_ORDER.map((catId) => {
      const cat = KAKU_TYPE_CATEGORIES[catId];
      const cardsHtml = cat.typeIds.map((id) => buildTypeCardHtml(KAKU_TYPES[id])).join("");
      return `
        <div class="types-grid__category" data-category="${cat.id}" style="--cat-color:${cat.color}; --cat-color-soft:${cat.colorSoft};">
          <div class="types-grid__category-head">
            <p class="types-grid__category-name">${cat.nameJp}<span class="label-en">（${cat.nameEn}）</span></p>
            <p class="types-grid__category-desc">${cat.description}</p>
          </div>
          <div class="types-grid__category-cards">${cardsHtml}</div>
        </div>`;
    }).join("");

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
      "普段のあなたを読み解いています…",
      "生まれ持った資質と重ね合わせています…",
      "今の状態とのズレを確認しています…",
      "数あるKAKU TYPEの中から、あなたのKAKUを絞り込んでいます…",
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
        saveCurrentResultToHistory();
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
        <div class="kaku-card__rarity">出現率 ${type.rarity}</div>
        <img class="kaku-card__image" src="${type.image}" alt="${type.nameEn} ${type.nameJp}" />
        <p class="kaku-card__poster-tag" style="background:${type.color}">${type.catchcopy}</p>
        <div class="kaku-card__body">
          <p class="kaku-card__type-en">${type.nameEn}</p>
          <p class="kaku-card__type-jp">${type.nameJp}</p>
          <p class="kaku-card__praise">${type.praise}</p>
        </div>
      </div>

      <h3 class="subsection-title">あなたを構成する6つの力<span class="label-en">CORE6</span></h3>
      <p class="form-note">6つの軸はそれぞれ0〜100点。数字が大きいほど、普段の行動でその力を強く使っていることを表します。</p>
      <div class="radar-wrap">${buildRadarSVG(core6.scores)}</div>
      <div class="core6-grid">
        ${CORE6_AXES.map(
          (a) => `
          <div class="core6-grid__item">
            <div class="core6-grid__label">${AXIS_POWER_NAMES[a.id]}<span class="axis-en">（${a.nameEn}）</span>（${core6.scores[a.id]}点）</div>
            <div class="core6-grid__bar"><div class="core6-grid__bar-fill" style="width:${core6.scores[a.id]}%"></div></div>
          </div>`
        ).join("")}
      </div>

      <div class="result-block">
        <h3>あなたの武器<span class="label-en">WEAPON</span></h3>
        <p>${type.weapon}</p>
      </div>
      <div class="result-block">
        <h3>あなたが陥りやすい罠<span class="label-en">BLIND SPOT</span></h3>
        <p>${type.blindSpot}</p>
      </div>
      <div class="result-block">
        <h3>組織で輝く役割<span class="label-en">TEAM ROLE</span></h3>
        <p>${type.teamRole}</p>
      </div>
      <div class="result-block">
        <h3>人との向き合い方<span class="label-en">RELATION STYLE</span></h3>
        <p>${type.relationStyle}</p>
      </div>
      <div class="result-block">
        <h3>あなたが覚醒する条件<span class="label-en">AWAKEN</span></h3>
        <p><strong>${type.awaken.keywords.join(" × ")}</strong><br />${type.awaken.sentence}</p>
      </div>
      <div class="result-block">
        <h3>力を失いやすい環境<span class="label-en">SHUTDOWN</span></h3>
        <p><strong>${type.shutdown.keywords.join(" × ")}</strong><br />${type.shutdown.sentence}</p>
      </div>

      <h3 class="subsection-title" id="kaku-gap-title">本来の自分と、今の自分の「ズレ」</h3>
      <p class="form-note">
        「能力が落ちた？」と感じたとき、実は本来のあなたと、今置かれている環境がズレているだけかもしれません。
        優劣を測るものでも、医療的な診断でもありません。
      </p>
      <div class="gap-hero">
        <div class="gap-hero__compare">
          <div class="gap-hero__before">
            <p class="gap-hero__tag">本来のあなた</p>
            <p>${gap.beforeText}</p>
          </div>
          <div class="gap-hero__arrow" aria-hidden="true">→</div>
          <div class="gap-hero__after">
            <p class="gap-hero__tag">今のあなた</p>
            <p>${gap.afterText}</p>
          </div>
        </div>
        <div class="gap-hero__score">
          <div class="gap-hero__score-number gap-hero__score-number--${gap.tier.key}">${gap.score}</div>
          <div class="gap-hero__score-body">
            <p class="gap-hero__score-tier">KAKU GAP｜${gap.tier.label}</p>
            <div class="gap-hero__meter"><div class="gap-hero__meter-fill gap-hero__meter-fill--${gap.tier.key}" style="width:${gap.score}%"></div></div>
            <p class="gap-hero__score-caption">0に近いほど「本来のあなたのまま活かせている」、100に近いほど「本来のあなたと、今の環境にズレがある」ことを表します。</p>
          </div>
        </div>
        <p class="gap-hero__message"><strong>${gap.headline}。</strong><br />${gap.message}</p>
      </div>

      <div class="result-block">
        <h3>生まれ持ったあなた｜${birth.title}</h3>
        <p>${birth.description}</p>
      </div>
      <div class="result-block">
        <h3>今のあなた｜${state.label}</h3>
        <p>${state.description}</p>
      </div>

      <div class="upsell-banner">
        <div class="upsell-banner__formula" aria-hidden="true">
          <span class="upsell-banner__chip">普段のあなた</span>
          <span class="upsell-banner__times">×</span>
          <span class="upsell-banner__chip">生まれ持ったあなた</span>
          <span class="upsell-banner__times">×</span>
          <span class="upsell-banner__chip">今のあなた</span>
        </div>
        <h3 class="upsell-banner__title">PERSONAL BOOKは、<br />あなた専用の「自分の攻略本」。</h3>
        <p class="upsell-banner__text">
          ここまでの結果は、まだ入り口です。「${type.nameJp}」であるあなたが、なぜ今のように感じるのか、
          どんな環境で輝き、どんな環境で止まるのか、そして人や仕事とどう向き合えばいいのか。
          PERSONAL BOOKでは、それを"あなた専用"の物語として、行動につながるところまで掘り下げます。
        </p>
        <button class="btn btn--cta" data-nav="personal-book">より詳細を見たい方はこちら →</button>
      </div>

      <div class="share-row">
        <button class="btn btn--primary" id="btn-save-image">シェア画像を保存する</button>
        <button class="btn" id="btn-share-x">Xでシェア</button>
        <button class="btn btn--text" data-action="start-diagnosis">もう一度診断する</button>
      </div>
      <p class="form-note" id="share-image-status" aria-live="polite"></p>
      <p class="form-note">この結果は、このブラウザに自動で保存されました。後から見返したい場合は、上部メニューの「履歴」からいつでも確認できます。</p>
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

  // PERSONAL BOOKの「PDFとして保存する」をワンクリックのPDFダウンロードにする処理。
  // html2canvas + jsPDF（index.htmlでCDNから読み込み）が使える場合は、
  //   1) 章タブを全部展開してno-printを隠す（.pdf-export-mode）
  //   2) #personal-book-preview を撮影
  //   3) A4サイズにスライスしてjsPDFに流し込み、ダウンロード
  //   4) 画面の表示状態（開いていたタブ・非表示要素）を元に戻す
  // という流れでPDFファイルを直接生成する。ライブラリが読み込めていない場合（オフライン等）は、
  // ブラウザの印刷機能（window.print、送信先で「PDFに保存」を選べる）にフォールバックする。
  async function exportBookAsPdf(previewEl, fileName, statusEl, btn) {
    if (!window.html2canvas || !window.jspdf || !window.jspdf.jsPDF) {
      statusEl.textContent = "PDF生成の準備ができていないため、印刷画面を開きます（送信先で「PDFに保存」を選んでください）。";
      window.print();
      return;
    }

    const tabButtons = previewEl.querySelectorAll(".book-tab");
    const tabPanels = previewEl.querySelectorAll(".book-tabpanel");
    const previouslyActiveTab = previewEl.querySelector(".book-tab.is-active");
    const previousHiddenState = Array.from(tabPanels).map((p) => p.hidden);

    btn.disabled = true;
    statusEl.textContent = "PDFを作成しています…（章の数によっては少し時間がかかります）";
    previewEl.classList.add("pdf-export-mode");

    try {
      // 少し待って、レイアウトの再計算（全章展開）を確実にブラウザに反映させてから撮影する
      await new Promise((resolve) => setTimeout(resolve, 50));

      const canvas = await window.html2canvas(previewEl, {
        scale: Math.min(2, window.devicePixelRatio || 1.5),
        useCORS: true,
        backgroundColor: "#0A0D1C",
      });

      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidthMm = pdf.internal.pageSize.getWidth();
      const pageHeightMm = pdf.internal.pageSize.getHeight();
      const pxPerMm = canvas.width / pageWidthMm;
      const pageHeightPx = Math.floor(pageHeightMm * pxPerMm);

      let renderedPx = 0;
      let isFirstPage = true;
      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = canvas.width;
      const pageCtx = pageCanvas.getContext("2d");

      while (renderedPx < canvas.height) {
        const sliceHeightPx = Math.min(pageHeightPx, canvas.height - renderedPx);
        pageCanvas.height = sliceHeightPx;
        pageCtx.clearRect(0, 0, pageCanvas.width, pageCanvas.height);
        pageCtx.drawImage(
          canvas,
          0, renderedPx, canvas.width, sliceHeightPx,
          0, 0, canvas.width, sliceHeightPx
        );
        const imgData = pageCanvas.toDataURL("image/jpeg", 0.92);
        if (!isFirstPage) pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, 0, pageWidthMm, sliceHeightPx / pxPerMm);
        renderedPx += sliceHeightPx;
        isFirstPage = false;
      }

      pdf.save(fileName);
      statusEl.textContent = "PDFを保存しました。";
    } catch (err) {
      statusEl.textContent = "PDFの作成に失敗したため、印刷画面を開きます（送信先で「PDFに保存」を選んでください）。";
      window.print();
    } finally {
      previewEl.classList.remove("pdf-export-mode");
      tabPanels.forEach((p, i) => (p.hidden = previousHiddenState[i]));
      tabButtons.forEach((b) => b.classList.toggle("is-active", b === previouslyActiveTab));
      btn.disabled = false;
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
  // PERSONAL BOOK 購入：Stripe Checkoutを開き、決済完了後はサーバー側（/api/stripe-webhook）
  // からご購入者のメールアドレス宛に、このPERSONAL BOOKを開き直せるリンクを送信する。
  // このサイト自体は静的サイトのままだが、決済とメール送信のためだけにVercelの
  // サーバーレス関数（/api配下）を追加している（詳細はREADME参照）。
  // ---------------------------------------------------------------------
  async function startPersonalBookCheckout(btn, statusEl) {
    if (!session.typeId) return;
    btn.disabled = true;
    if (statusEl) statusEl.textContent = "決済ページを準備しています…";
    try {
      const snapshot = buildResultSnapshot();
      const res = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshot }),
      });
      let data = null;
      try {
        data = await res.json();
      } catch (parseErr) {
        data = null;
      }
      if (!res.ok || !data || !data.url) {
        throw new Error((data && data.error) || "決済ページの作成に失敗しました。");
      }
      window.location.href = data.url;
    } catch (err) {
      if (statusEl) {
        statusEl.textContent =
          "決済ページを開けませんでした。時間をおいて再度お試しいただくか、しばらくしてからやり直してください。";
      }
      btn.disabled = false;
    }
  }

  // ---------------------------------------------------------------------
  // PERSONAL BOOK 本編描画
  // ※ 購入前でも実際の完成版と同じ内容をそのまま表示する仕様（2026-09時点の方針）。
  //   中身の確認が済み、購入者限定に切り替える方針が決まったら、このあたりの表示ロジックを見直す。
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
            badges.push('<span class="axis-badge axis-badge--birth">生まれ持った資質</span>');
          }
          if (a.id === topAxisId) {
            badges.push('<span class="axis-badge axis-badge--question">今よく使っている力</span>');
          }
          return `
          <div class="book-axis-row">
            <div class="book-axis-row__label">
              <span>${AXIS_POWER_NAMES[a.id]}<span class="axis-en">（${a.nameEn}）</span></span>
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
              <span>${AXIS_POWER_NAMES[a.id]}<span class="axis-en">（${a.nameEn}）</span></span>
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

      // 第2章用: CORE6のうち特に高い3つの力（英語の軸名ではなく「力の名前」で見せる）
      const top3Axes = session.core6.ranking.slice(0, 3);

      // 第5章（KAKU GAP）用: 「なぜそう判断したのか」を、STATEの実際の回答から具体的に示す。
      // 数値そのものは見せず、特に低かった項目だけを言葉にする（点数を見せるよりも伝わるため）。
      const stateEntries = state.byKey
        ? Object.keys(state.byKey).map((k) => ({ key: k, val: state.byKey[k] }))
        : [];
      stateEntries.sort((a, b) => a.val - b.val);
      const lowestStateLabels = stateEntries
        .slice(0, 3)
        .filter((e) => e.val <= 3)
        .map((e) => STATE_ITEM_LABELS[e.key])
        .filter(Boolean);

      let gapNarrative;
      if (!gap.matched) {
        gapNarrative = `現在のあなたは、本来持っている「${AXIS_POWER_NAMES[birth.axis]}」を、十分に使えていない可能性があります。`;
      } else if (!isGoodState) {
        gapNarrative = `本来の「${AXIS_POWER_NAMES[birth.axis]}」をそのまま使えているにもかかわらず、今の状態は万全とは言えないようです。`;
      } else {
        gapNarrative = `現在のあなたは、本来の「${AXIS_POWER_NAMES[birth.axis]}」を、そのまま活かせているようです。`;
      }

      const gapWhyHtml =
        !isGoodState && lowestStateLabels.length
          ? `<p>特に現在の回答では、「${lowestStateLabels.join("」「")}」が、本来あなたが求める状態より低くなっています。</p>`
          : "";

      let gapClosing;
      if (!gap.matched) {
        gapClosing = "だから最近、「できないわけじゃない。でも、やりたいと思えない。」という感覚がありませんか？";
      } else if (!isGoodState) {
        gapClosing = "だから最近、「悪くないはずなのに、なぜか力が出ない。」と感じていませんか？";
      } else {
        gapClosing = "今のあなたは、素のままの力を発揮できています。まずはこの調子を大切にしてください。";
      }

      // 第9章用: 「減らす／取り戻す／試す」の3ステップ行動プラン。
      // 第4章（統合分析）の integratedActions と同じ4パターン（GAP一致×状態良好）のロジックを使い、
      // 診断ロジックそのものは変えずに、行動を「減らす・取り戻す・試す」という一貫した型に言い換える。
      let actionPlan;
      if (gap.matched && isGoodState) {
        actionPlan = {
          reduce: `特に減らすべきものはありません。ただし、${birthLabel}を使わずに済ませている場面があれば、それを見直してください。`,
          restore: `今の${state.label}な状態そのものが、あなたが本来取り戻すべきものです。今のルーティンを、最低3週間はそのまま保ってください。`,
          try: `${topMove}`,
        };
      } else if (gap.matched && !isGoodState) {
        actionPlan = {
          reduce: `${birthLabel}を使う場面を、今週意図的に1つ減らしてください。資質と行動が一致しているからこそ、頑張りすぎてしまいます。`,
          restore: `十分な休息の予定を、今日中にカレンダーへ1つ入れてください。今のあなたが取り戻すべきなのは、新しい力ではなく余白です。`,
          try: `3日後、状態に変化があったかを振り返ってください。変わっていなければ、原因を「役割」「環境」「人間関係」のどれか1つに絞って書き出してみましょう。`,
        };
      } else if (!gap.matched && isGoodState) {
        actionPlan = {
          reduce: `特にありません。今のやり方でうまくいっているので、無理に変える必要はありません。`,
          restore: `本来の${birthLabel}を使う場面が、今は減っています。今週中に、${birthLabel}を使う場面を自分から1つ作って、取り戻してください。`,
          try: `${birthMove}`,
        };
      } else {
        actionPlan = {
          reduce: `${questionLabel}を使う場面を、今週1つだけ減らしてください。減らすだけで、余力が生まれます。`,
          restore: `本来の${birthLabel}を発揮しにくくしている原因を、「役割」「人間関係」「業務量」のどれか1つに絞って書き出し、そこから${birthLabel}を取り戻す一歩を考えてください。`,
          try: `${birthMove}`,
        };
      }

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
          ${
            openedFromBookLink
              ? `<p class="form-note">この内容は、ご購入いただいたあなた専用のPERSONAL BOOKです。このページをブックマークしておくと、いつでも見返せます。</p>`
              : `<p class="form-note">これが、あなたのPERSONAL BOOKです。¥980のお支払いで、この内容をメールでも受け取れるようになります（ブラウザの履歴を消しても、別の端末からでも見返せます）。</p>`
          }

          <div class="book-cover" style="background: linear-gradient(160deg, ${type.color} 0%, #14161f 100%);">
            <p class="book-cover__label">PERSONAL BOOK</p>
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

          ${
            openedFromBookLink
              ? ""
              : `
          <div class="book-purchase-cta no-print" id="book-purchase-cta">
            <p class="book-purchase-cta__title">¥980で購入して、メールで受け取る</p>
            <p class="book-purchase-cta__desc">
              お支払い後、ご登録いただいたメールアドレス宛に、このPERSONAL BOOKを開けるリンクをお送りします。
              メールが届けば、ブラウザの履歴を消してしまっても、別の端末からでも、いつでも見返すことができます。
            </p>
            <button class="btn btn--primary" id="btn-book-purchase">¥980で購入する</button>
            <p class="form-note" id="book-purchase-status" aria-live="polite"></p>
          </div>
          `
          }

          <div class="opening-letter">
            <p class="opening-letter__to">${session.name ? session.name + "さんへ" : "あなたへ"}</p>
            <p>${openingLine}</p>
            <p>
              これは、出現率<strong>${type.rarity}</strong>という少数派である「${type.nameJp}」のあなたのために
              書かれたページです。同じ${type.nameJp}であっても、あなたと全く同じ資質・行動・状態の組み合わせを
              持つ人は、そう多くはいません。
            </p>
          </div>

          <div class="book-tabs no-print" role="tablist">
            <button type="button" class="book-tab is-active" data-tab="1">1</button>
            <button type="button" class="book-tab" data-tab="2">2</button>
            <button type="button" class="book-tab" data-tab="3">3</button>
            <button type="button" class="book-tab" data-tab="4">4</button>
            <button type="button" class="book-tab" data-tab="5">5</button>
            <button type="button" class="book-tab" data-tab="6">6</button>
            <button type="button" class="book-tab" data-tab="7">7</button>
            <button type="button" class="book-tab" data-tab="8">8</button>
            <button type="button" class="book-tab" data-tab="9">9</button>
          </div>

          <div class="result-block book-tabpanel" data-tabpanel="1">
            <p class="book-chapter">第1章</p>
            <h3>あなたは、何者なのか。</h3>
            <p>${type.personalBookInsight}</p>
            <p>
              そしてもう一つ。「${type.blindSpot}」——これは弱点ではなく、「${type.weapon}」という、あなたの
              一番の武器が生んでいる影のようなものです。強い光には、必ず影ができます。この影を消そうとするより、
              光の方を自覚して使う方が、あなたはずっと生きやすくなります。
            </p>
            <p class="result-block__mini-title">もう一つの隠れた才能</p>
            <p>
              普段の行動の傾向から見ると、あなたの一番の力は<strong>${primaryGift}</strong>ですが、
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
            <h3>なぜ、あなたはそうなるのか。</h3>
            <p>
              あなたという人間は、6つの力の組み合わせでできています。中でも特に強く出ているのが、次の3つです。
            </p>
            <div class="book-power-list">
              ${top3Axes
                .map(
                  (r, i) => `
              <div class="book-power-item">
                <div class="book-power-item__head">
                  <span class="book-power-item__rank">${i + 1}</span>
                  <span class="book-power-item__name">${AXIS_POWER_NAMES[r.axis]}</span>
                  <span class="book-power-item__score">${r.score}</span>
                </div>
                <p class="book-power-item__desc">${AXIS_POWER_DESC[r.axis]}</p>
              </div>`
                )
                .join("")}
            </div>
            <div class="radar-wrap">${buildRadarSVG(scores, "dark")}</div>
            <p class="result-block__mini-title">主軸2つの実際の数値</p>
            ${primaryAxesHtml}
            <p class="result-block__mini-title">残り4つの軸のバランス</p>
            ${otherAxesHtml}
            <p>${otherAxesInsight}</p>
          </div>

          <div class="result-block book-tabpanel" data-tabpanel="3" hidden>
            <p class="book-chapter">第3章</p>
            <h3>あなたが輝くとき。</h3>
            <p>
              思い出してみてください。「${type.awaken.keywords.join("」「")}」——こうした条件が揃っていたとき、
              あなたは驚くほど自然に力を発揮できていたはずです。${type.awaken.sentence}
            </p>
            <p>
              それは運や気合いの問題ではなく、あなたという人間が、そういう環境でこそ最大化するようにできている、
              ということです。もし今、そのどれかが欠けているなら、能力の問題ではなく環境の問題だと考えてみてください。
            </p>
          </div>

          <div class="result-block book-tabpanel" data-tabpanel="4" hidden>
            <p class="book-chapter">第4章</p>
            <h3>あなたが止まるとき。</h3>
            <p>
              反対に、「${type.shutdown.keywords.join("」「")}」——こうした状況が続くと、あなたは急に力を失います。
              ${type.shutdown.sentence}
            </p>
            <p>
              これは弱さではなく、あなたの一番の力（${primaryGift}）が、そういう環境では機能しにくいというだけの
              ことです。もし最近しんどさを感じているなら、まずこの条件に当てはまっていないか、振り返ってみてください。
            </p>
          </div>

          <div class="result-block book-tabpanel" data-tabpanel="5" hidden>
            <p class="book-chapter">第5章</p>
            <h3>なぜ、今のあなたはこうなのか。</h3>
            <p>
              ここまでで見てきたのは、生まれ持ったあなたと、普段のあなたです。ここからは、今のあなたを見ていきます。
            </p>
            <div class="gap-hero">
              <div class="gap-hero__compare">
                <div class="gap-hero__before">
                  <p class="gap-hero__tag">本来のあなた</p>
                  <p>${gap.beforeText}</p>
                </div>
                <div class="gap-hero__arrow" aria-hidden="true">→</div>
                <div class="gap-hero__after">
                  <p class="gap-hero__tag">今のあなた</p>
                  <p>${gap.afterText}</p>
                </div>
              </div>
              <div class="gap-hero__score">
                <div class="gap-hero__score-number gap-hero__score-number--${gap.tier.key}">${gap.score}</div>
                <div class="gap-hero__score-body">
                  <p class="gap-hero__score-tier">KAKU GAP｜${gap.tier.label}</p>
                  <div class="gap-hero__meter"><div class="gap-hero__meter-fill gap-hero__meter-fill--${gap.tier.key}" style="width:${gap.score}%"></div></div>
                </div>
              </div>
            </div>
            <p>${gapNarrative}</p>
            ${gapWhyHtml}
            <p class="book-gap-closing"><strong>${gapClosing}</strong></p>
            <details class="book-accordion">
              <summary>この分析について、詳しく見る</summary>
              <p>
                KAKU GAPは、「生まれ持った資質（${AXIS_POWER_NAMES[birth.axis]}）」と「普段よく使っている力
                （${AXIS_POWER_NAMES[topAxisId]}）」の差、そして「今の状態」に関する回答を組み合わせて算出しています。
                占いのような当てずっぽうではなく、あなた自身が答えた内容から機械的に導いた数値です。
              </p>
            </details>
          </div>

          <div class="result-block book-tabpanel" data-tabpanel="6" hidden>
            <p class="book-chapter">第6章</p>
            <h3>あなたの取扱説明書。</h3>
            <div class="manual-grid">
              <div class="manual-card">
                <p class="manual-card__title">私を動かすもの</p>
                <p>${type.weapon}</p>
              </div>
              <div class="manual-card manual-card--warn">
                <p class="manual-card__title">私を止めるもの</p>
                <p>${type.shutdown.sentence}</p>
              </div>
              <div class="manual-card">
                <p class="manual-card__title">私に任せてほしいこと</p>
                <p>${type.teamRole}</p>
              </div>
              <div class="manual-card">
                <p class="manual-card__title">私に求めすぎないでほしいこと</p>
                <p>${quietAxis.nameJp}を無理に求めないでください。それは、${primaryGift}を存分に発揮するために、あなたが自然と手放している部分です。</p>
              </div>
              <div class="manual-card">
                <p class="manual-card__title">調子がいい時のサイン</p>
                <p class="book-condition-list">${AXIS_GOOD_SIGNS[topAxisId].join(" / ")}</p>
              </div>
              <div class="manual-card manual-card--warn">
                <p class="manual-card__title">危険信号</p>
                <p class="book-condition-list book-condition-list--shutdown">${AXIS_DANGER_SIGNS[topAxisId].join(" / ")}</p>
              </div>
              <div class="manual-card">
                <p class="manual-card__title">戻るために必要なこと</p>
                <p class="book-condition-list">${AXIS_RECOVERY[topAxisId].join(" / ")}</p>
              </div>
            </div>
          </div>

          <div class="result-block book-tabpanel" data-tabpanel="7" hidden>
            <p class="book-chapter">第7章</p>
            <h3>仕事で、どう活かすか。</h3>
            <p class="result-block__mini-title">力を発揮しやすい仕事</p>
            <p>${WORK_BY_AXIS[topAxisId]}</p>
            <p class="result-block__mini-title">力を失いやすい仕事</p>
            <p>「${type.shutdown.keywords.join("」「")}」が常態化している仕事は、あなたの${primaryGift}を発揮しにくくします。能力が足りないのではなく、環境とのミスマッチを疑ってみてください。</p>
            <p class="result-block__mini-title">リーダーになった場合</p>
            <p>${CAREER_BY_AXIS[topAxisId]}</p>
          </div>

          <div class="result-block book-tabpanel" data-tabpanel="8" hidden>
            <p class="book-chapter">第8章</p>
            <h3>人と、どう付き合うか。</h3>
            <p>${type.relationStyle}</p>
            <p>${RELATION_ADVICE_BY_AXIS[topAxisId]}</p>
          </div>

          <div class="result-block book-tabpanel" data-tabpanel="9" hidden>
            <p class="book-chapter">第9章</p>
            <h3>これから、どうするか。</h3>
            <p>今のあなたが、まず変えるべき3つ。</p>
            <ol class="book-steps">
              <li class="book-step">
                <span class="book-step__num">01</span>
                <div class="book-step__body">
                  <p class="book-step__when">減らす</p>
                  <p>${actionPlan.reduce}</p>
                </div>
              </li>
              <li class="book-step">
                <span class="book-step__num">02</span>
                <div class="book-step__body">
                  <p class="book-step__when">取り戻す</p>
                  <p>${actionPlan.restore}</p>
                </div>
              </li>
              <li class="book-step">
                <span class="book-step__num">03</span>
                <div class="book-step__body">
                  <p class="book-step__when">試す</p>
                  <p>${actionPlan.try}</p>
                </div>
              </li>
            </ol>
            <p class="book-final-message">
              あなたに足りないものを探し続ける必要はありません。大切なのは、「自分の核が活きる選択」を
              増やしていくこと。これが、今のあなたのKAKUです。
            </p>
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
        const btn = document.getElementById("btn-book-pdf");
        const statusEl = document.getElementById("book-share-status");
        const previewEl = target.querySelector(".book-preview");
        exportBookAsPdf(previewEl, `KAKU_PERSONAL_BOOK_${type.nameEn}.pdf`, statusEl, btn);
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

      const purchaseBtn = document.getElementById("btn-book-purchase");
      if (purchaseBtn) {
        purchaseBtn.addEventListener("click", () => {
          startPersonalBookCheckout(purchaseBtn, document.getElementById("book-purchase-status"));
        });
      }

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

    // Stripe Checkout決済直後の戻り先。ページがリロードされ診断結果はメモリ上に残っていないため、
    // 結果を出し直そうとはせず、「メールが届くのを待ってください」という案内だけを表示する。
    if (justPurchased) {
      justPurchased = false;
      introEl.hidden = false;
      introEl.innerHTML = `
        <p class="context-intro__title">ご購入ありがとうございます</p>
        <p class="body-text">
          ご登録いただいたメールアドレス宛に、PERSONAL BOOKを開けるリンクをお送りしています。
          数分以内に届きますので、少しお待ちください。見当たらない場合は、迷惑メールフォルダもご確認ください。
        </p>
        <button class="btn" data-nav="top">TOPへ戻る</button>
      `;
      return;
    }

    if (!session.typeId) {
      introEl.hidden = false;
      introEl.innerHTML = `
        <p class="context-intro__title">深掘り診断｜3つだけ質問させてください</p>
        <p class="body-text">PERSONAL BOOKを見るには、先に無料診断でKAKUタイプを診断してください。</p>
        <button class="btn btn--primary" data-action="start-diagnosis">3分で自分のKAKUを知る</button>
      `;
      return;
    }

    // メールで届いたPERSONAL BOOKのリンクから開いた場合は、購入時点の内容が
    // すでにsessionに復元されているので、深掘り質問を再度聞かずそのまま表示する。
    if (openedFromBookLink && session.context) {
      introEl.hidden = true;
      renderPersonalBookPreview();
      return;
    }

    introEl.hidden = false;
    introEl.innerHTML = `
      <p class="context-intro__title">深掘り診断｜3つだけ質問させてください</p>
      <p class="body-text">
        今の仕事・役割、大事にしたい価値観、気になっている人間関係を教えてください。
        この3つを踏まえて、あなたの状況によりフィットした内容でPERSONAL BOOKを作成します（選択式・30秒程度です）。
      </p>
      <div id="context-form"></div>
      <button class="btn" id="btn-preview-personal-book" disabled>この内容でPERSONAL BOOKを見る</button>
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
        <button class="btn btn--primary" data-action="start-diagnosis">3分で自分のKAKUを知る</button>
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
  // ページ読み込み時のURLパラメータ処理：
  // ・?book=... … PERSONAL BOOK購入後にメールで届くリンク。中身は購入時点の結果スナップショット
  //   （buildResultSnapshotと同じ形）をJSON化したもの。サーバー側にデータを保存していないため、
  //   復元に必要な情報はすべてこのリンクの中に入っている。
  // ・?purchased=1 … Stripe Checkout決済完了後の戻り先。まだメールが届く前のタイミングなので、
  //   その場でsessionに残っている内容をそのままPERSONAL BOOK画面に表示し、案内メッセージを出す。
  // ---------------------------------------------------------------------
  function handleIncomingUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const bookParam = params.get("book");
    const purchased = params.get("purchased");

    if (bookParam) {
      try {
        const snapshot = JSON.parse(bookParam);
        if (snapshot && snapshot.typeId) {
          applySnapshotToSession(snapshot);
          openedFromBookLink = true;
          window.history.replaceState({}, "", window.location.pathname);
          showView("personal-book");
          return true;
        }
      } catch (err) {
        // リンクが壊れている場合は、下の通常のTOP画面表示にフォールバックする
      }
    }

    if (purchased) {
      justPurchased = true;
      window.history.replaceState({}, "", window.location.pathname);
      showView("personal-book");
      return true;
    }

    // Stripe Checkoutを「戻る」でキャンセルした場合の戻り先（?view=personal-book）。
    // ページはリロードされ診断結果は失われているため、通常のTOP画面ではなく、せめて
    // PERSONAL BOOKの紹介画面に戻す（そこから改めて無料診断を受け直せる）。
    const viewParam = params.get("view");
    if (viewParam && VIEW_IDS.includes(viewParam)) {
      window.history.replaceState({}, "", window.location.pathname);
      showView(viewParam);
      return true;
    }

    return false;
  }

  // ---------------------------------------------------------------------
  // 初期化
  // ---------------------------------------------------------------------
  renderTypeShowcase();
  renderAboutCore6();
  renderTypesGallery();
  if (!handleIncomingUrlParams()) {
    showView("top");
  }
})();

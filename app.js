// KAKU front-end logic: date selects, MBTI quiz, diagnosis, result render, checkout.

(function populateDateSelects() {
  const yearSel = document.getElementById("birth-year");
  const monthSel = document.getElementById("birth-month");
  const daySel = document.getElementById("birth-day");
  const thisYear = new Date().getFullYear();

  const yearOpt = document.createElement("option");
  yearOpt.textContent = "年"; yearOpt.value = ""; yearSel.appendChild(yearOpt);
  for (let y = thisYear; y >= thisYear - 100; y--) {
    const o = document.createElement("option");
    o.value = y; o.textContent = y + "年";
    yearSel.appendChild(o);
  }
  const monthOpt = document.createElement("option");
  monthOpt.textContent = "月"; monthOpt.value = ""; monthSel.appendChild(monthOpt);
  for (let m = 1; m <= 12; m++) {
    const o = document.createElement("option");
    o.value = m; o.textContent = m + "月";
    monthSel.appendChild(o);
  }
  const dayOpt = document.createElement("option");
  dayOpt.textContent = "日"; dayOpt.value = ""; daySel.appendChild(dayOpt);
  for (let d = 1; d <= 31; d++) {
    const o = document.createElement("option");
    o.value = d; o.textContent = d + "日";
    daySel.appendChild(o);
  }
})();

// --- Quick 16-type quiz (used when the visitor doesn't know their MBTI type) ---
const QUIZ_QUESTIONS = [
  { text: "週末の過ごし方は？", options: [["友人と集まって過ごす", "E"], ["一人でゆっくり過ごす", "I"]] },
  { text: "初対面の人が多い場に行くと？", options: [["自然と話しかけられる", "E"], ["少し疲れる", "I"]] },
  { text: "物事を考えるとき？", options: [["具体的な事実を重視する", "S"], ["可能性や意味を重視する", "N"]] },
  { text: "新しいアイデアを聞いたとき？", options: [["実現できるかをまず考える", "S"], ["面白ければワクワクする", "N"]] },
  { text: "判断に迷ったとき？", options: [["論理や合理性で決める", "T"], ["気持ちや人間関係を優先する", "F"]] },
  { text: "誰かに指摘するとき？", options: [["率直に事実を伝える", "T"], ["相手の気持ちを考えて言い方を選ぶ", "F"]] },
  { text: "予定の立て方は？", options: [["事前にしっかり計画する", "J"], ["その場の流れに任せる", "P"]] },
  { text: "締め切りに対して？", options: [["早めに終わらせたい", "J"], ["ギリギリで力を発揮する", "P"]] },
];

const quizAnswers = new Array(QUIZ_QUESTIONS.length).fill(null);

document.getElementById("show-quiz").addEventListener("click", (e) => {
  e.preventDefault();
  const quizEl = document.getElementById("quiz");
  document.getElementById("mbti-select").closest(".field").querySelector("select").value = "";
  quizEl.hidden = false;
  quizEl.innerHTML = "";
  QUIZ_QUESTIONS.forEach((q, qi) => {
    const wrap = document.createElement("div");
    wrap.className = "quiz-q";
    const p = document.createElement("p");
    p.textContent = (qi + 1) + ". " + q.text;
    wrap.appendChild(p);
    q.options.forEach(([label, letter]) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "opt";
      btn.textContent = label;
      btn.addEventListener("click", () => {
        quizAnswers[qi] = letter;
        wrap.querySelectorAll(".opt").forEach(b => b.classList.remove("selected"));
        btn.classList.add("selected");
      });
      wrap.appendChild(btn);
    });
    quizEl.appendChild(wrap);
  });
  e.target.style.display = "none";
});

function resolveMbti() {
  const selected = document.getElementById("mbti-select").value;
  if (selected) return selected;
  if (quizAnswers.every(a => a !== null)) return quizToMbti(quizAnswers);
  return null;
}

document.getElementById("diagnose-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const y = parseInt(document.getElementById("birth-year").value, 10);
  const m = parseInt(document.getElementById("birth-month").value, 10);
  const d = parseInt(document.getElementById("birth-day").value, 10);
  const mbti = resolveMbti();

  if (!y || !m || !d) { alert("生年月日を入力してください"); return; }
  if (!mbti) { alert("MBTIタイプを選択するか、質問に全て答えてください"); return; }

  const r = diagnose(y, m, d, mbti);
  renderResult(r);
});

function renderResult(r) {
  const name = getTypeName(r.starIndex, r.group);
  const desc = getFreeDescription(r.starIndex, r.group);

  document.getElementById("result-group-tag").textContent = GROUPS[r.group].label;
  document.getElementById("result-star-tag").textContent = STARS[r.starIndex].name;
  document.getElementById("result-name").textContent = name;
  document.getElementById("result-desc").textContent = STARS[r.starIndex].trait + "\n\n" + desc;

  window.__kakuResult = r; // stashed for the checkout call

  document.getElementById("result").hidden = false;
  document.getElementById("result").scrollIntoView({ behavior: "smooth" });
}

document.getElementById("share-x").addEventListener("click", () => {
  const name = document.getElementById("result-name").textContent;
  const text = `私のKAKUタイプは「${name}」でした。あなたは？\n#KAKU診断`;
  const url = "https://twitter.com/intent/tweet?text=" + encodeURIComponent(text);
  window.open(url, "_blank", "noopener");
});

document.getElementById("buy-report").addEventListener("click", async () => {
  const r = window.__kakuResult;
  if (!r) return;
  const btn = document.getElementById("buy-report");
  btn.disabled = true;
  btn.textContent = "処理中...";
  try {
    const res = await fetch("/api/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ starIndex: r.starIndex, group: r.group }),
    });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      throw new Error(data.error || "checkout session creation failed");
    }
  } catch (err) {
    alert("決済の準備でエラーが発生しました。しばらくしてからもう一度お試しください。");
    console.error(err);
    btn.disabled = false;
    btn.textContent = "見る";
  }
});

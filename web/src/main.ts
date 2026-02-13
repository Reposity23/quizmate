import "./styles.css";
import { Difficulty, generateQuiz, QuizType } from "./api";
import { renderDebug } from "./debug";
import { renderSingleQuestion, highlightCodeBlocks } from "./renderQuiz";
import { scoreQuiz } from "./scoring";
import { formatDuration } from "./timer";

const app = document.querySelector<HTMLDivElement>("#app")!;
let files: File[] = [];
let quiz: any = null;
let answers: Record<string, any> = {};
let startedAt = 0;
let currentIndex = 0;
let debugPayload: any = {};
let raw = "";
let details = "";
let loading = false;
let loadingPhase: "uploading" | "generating" = "uploading";
let progress = 0;
let perQuestionTimer = 0;
let questionDeadline = 0;
let timerHandle: number | undefined;
let feedback: "correct" | "incorrect" | "neutral" = "neutral";
let resultHtml = "";

const avatars = ["morph-a", "morph-b", "morph-c", "morph-d", "morph-e"];

function addFiles(incoming: File[]) {
  const next = [...files, ...incoming];
  if (next.length > 10) return alert("Maximum 10 files allowed.");
  const tooLarge = next.find((f) => f.size > 20 * 1024 * 1024);
  if (tooLarge) return alert(`${tooLarge.name} exceeds 20MB.`);
  files = next;
  render();
}

function getCurrentQuestion() {
  return quiz?.questions?.[currentIndex];
}

function startQuestionTimer() {
  if (!perQuestionTimer || !quiz) return;
  questionDeadline = Date.now() + perQuestionTimer * 1000;
  if (timerHandle) window.clearInterval(timerHandle);
  timerHandle = window.setInterval(() => {
    if (Date.now() >= questionDeadline) {
      if (currentIndex < quiz.questions.length - 1) {
        currentIndex += 1;
        feedback = "neutral";
        startQuestionTimer();
        render();
      } else {
        window.clearInterval(timerHandle);
      }
    } else {
      const chip = document.getElementById("timerChip");
      if (chip) chip.textContent = `${Math.ceil((questionDeadline - Date.now()) / 1000)}s`;
    }
  }, 250);
}

function render() {
  const overlay = loading
    ? `<div class="loading-overlay"><div class="loader-card"><div class="spinner"></div><h3>${loadingPhase === "uploading" ? "Uploading files..." : "Generating your quiz..."}</h3><div class="progress"><span style="width:${loadingPhase === "uploading" ? progress : 100}%"></span></div><p>${loadingPhase === "uploading" ? `${progress}%` : "Analyzing source pack, validating JSON, preparing exam..."}</p></div></div>`
    : "";

  app.innerHTML = `${overlay}<main><h1>QuizForge Prototype</h1>${quiz ? quizView() : setupView()}</main>`;
  bindSetup();
  bindQuiz();
  highlightCodeBlocks(app);
}

function setupView() {
  return `<section class="card panel"><h2>Upload Learning Files</h2><div id="dropZone" class="drop-zone">Drop files here</div><input id="fileInput" type="file" multiple />
  <ul class="file-list">${files.map((f) => `<li><b>${f.name}</b><span>${(f.size / 1024 / 1024).toFixed(2)} MB</span></li>`).join("")}</ul>
  <p class="muted">${files.length} / 10 files selected <button id="clearFiles" type="button">Clear</button></p></section>
  ${files.length ? optionsView() : ""}${renderDebug(debugPayload, raw, details)}`;
}

function optionsView() {
  return `<section class="card panel"><h2>Quiz Setup</h2>
    <label>Quiz type<select id="quizType"><option value="mcq">Multiple Choice</option><option value="fill_blank">Fill in the Blank</option><option value="identification">Identification</option><option value="matching">Matching</option><option value="mixed">Mixed</option></select></label>
    <div class="count-row">${[5, 10, 20, 30, 50, 100].map((n) => `<button class="chip-btn" type="button" data-count="${n}">${n}</button>`).join("")}</div>
    <label>Custom count<input id="customCount" type="number" min="1" max="100" value="10"/></label>
    <label>Difficulty<select id="difficulty"><option value="">Optional</option><option value="easy">easy</option><option value="medium">medium</option><option value="hard">hard</option></select></label>
    <label>Timer per question<select id="perQuestionTimer"><option value="0">No timer</option><option value="15">15 sec</option><option value="30">30 sec</option><option value="45">45 sec</option><option value="60">60 sec</option><option value="90">90 sec</option></select></label>
    <button id="generateBtn" class="primary">Generate Quiz</button>
  </section>`;
}

function quizView() {
  const q = getCurrentQuestion();
  const avatarClass = avatars[currentIndex % avatars.length];
  const timer = perQuestionTimer ? `<span id="timerChip" class="timer-chip">${Math.max(0, Math.ceil((questionDeadline - Date.now()) / 1000))}s</span>` : "";
  return `<section class="card quiz-shell ${feedback}">
    <div class="quiz-top"><h2>${quiz.quiz_title}</h2><div class="meta"><span>${quiz.source_summary}</span>${timer}</div></div>
    <div class="scene"><div class="avatar ${avatarClass} ${feedback}"></div><div id="questionRoot" class="question-stage">${renderSingleQuestion(q, answers, currentIndex + 1, quiz.questions.length)}</div></div>
    <div class="nav-row"><button id="prevQ" ${currentIndex === 0 ? "disabled" : ""}>Previous</button><button id="checkAnswer">Check</button><button id="nextQ" ${currentIndex >= quiz.questions.length - 1 ? "disabled" : ""}>Next</button></div>
    <div class="actions"><button id="submitQuiz" class="primary">Submit Quiz</button><button id="resetAnswers">Reset Answers</button><button id="backSetup">Back to Setup</button></div>
  </section>
  <section id="result">${resultHtml}</section>${renderDebug(debugPayload, raw, details)}`;
}

function bindSetup() {
  const drop = document.getElementById("dropZone");
  drop?.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("drag-over"); });
  drop?.addEventListener("dragleave", () => drop.classList.remove("drag-over"));
  drop?.addEventListener("drop", (e) => { e.preventDefault(); drop.classList.remove("drag-over"); addFiles(Array.from(e.dataTransfer?.files || [])); });
  (document.getElementById("fileInput") as HTMLInputElement | null)?.addEventListener("change", (e) => addFiles(Array.from((e.target as HTMLInputElement).files || [])));
  document.getElementById("clearFiles")?.addEventListener("click", () => { files = []; render(); });
  document.querySelectorAll("[data-count]").forEach((btn) => btn.addEventListener("click", () => { (document.getElementById("customCount") as HTMLInputElement).value = (btn as HTMLElement).getAttribute("data-count") || "10"; }));

  document.getElementById("generateBtn")?.addEventListener("click", async () => {
    loading = true; loadingPhase = "uploading"; progress = 0; render();
    perQuestionTimer = Number((document.getElementById("perQuestionTimer") as HTMLSelectElement).value || 0);
    try {
      const result = await generateQuiz({
        files,
        quizType: (document.getElementById("quizType") as HTMLSelectElement).value as QuizType,
        questionCount: Number((document.getElementById("customCount") as HTMLInputElement).value || 10),
        difficulty: (document.getElementById("difficulty") as HTMLSelectElement).value as Difficulty,
        onProgress: (p, phase) => { progress = p; loadingPhase = phase; render(); }
      });

      debugPayload = result.debug || {}; raw = result.raw || ""; details = result.details || "";
      if (!result.ok) throw new Error(result.error || "Generation failed");
      quiz = result.quiz; answers = {}; startedAt = Date.now(); currentIndex = 0; feedback = "neutral"; resultHtml = "";
      startQuestionTimer();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      loading = false;
      render();
    }
  });
}

function evaluateCurrent() {
  const q = getCurrentQuestion();
  if (!q) return;
  if (q.type === "mcq") feedback = Number(answers[q.id]) === q.answer_index ? "correct" : "incorrect";
  else if (q.type === "matching") {
    const ok = q.pairs.every((p: any, i: number) => (answers[q.id]?.[i] || "").trim().toLowerCase() === p.right.trim().toLowerCase());
    feedback = ok ? "correct" : "incorrect";
  } else {
    const user = String(answers[q.id] || "").trim().toLowerCase();
    feedback = q.answers.some((a: string) => a.trim().toLowerCase() === user) ? "correct" : "incorrect";
  }
}

function bindQuiz() {
  if (!quiz) return;
  app.querySelectorAll("input[type='radio']").forEach((el) => el.addEventListener("change", (e) => { const t = e.target as HTMLInputElement; answers[t.dataset.qid!] = Number(t.value); }));
  app.querySelectorAll("input[type='text']").forEach((el) => el.addEventListener("input", (e) => { const t = e.target as HTMLInputElement; answers[t.dataset.qid!] = t.value; }));
  app.querySelectorAll("select[data-qid]").forEach((el) => el.addEventListener("change", (e) => { const t = e.target as HTMLSelectElement; const qid=t.dataset.qid!; const idx=Number(t.dataset.pair!); answers[qid]=answers[qid]||{}; answers[qid][idx]=t.value; }));
  document.getElementById("checkAnswer")?.addEventListener("click", () => { evaluateCurrent(); render(); });
  document.getElementById("prevQ")?.addEventListener("click", () => { currentIndex = Math.max(0, currentIndex - 1); feedback = "neutral"; startQuestionTimer(); render(); });
  document.getElementById("nextQ")?.addEventListener("click", () => { currentIndex = Math.min(quiz.questions.length - 1, currentIndex + 1); feedback = "neutral"; startQuestionTimer(); render(); });
  document.getElementById("resetAnswers")?.addEventListener("click", () => { answers = {}; feedback = "neutral"; resultHtml = ""; render(); });
  document.getElementById("backSetup")?.addEventListener("click", () => { quiz = null; answers = {}; feedback = "neutral"; resultHtml = ""; if (timerHandle) window.clearInterval(timerHandle); render(); });
  document.getElementById("submitQuiz")?.addEventListener("click", () => {
    const score = scoreQuiz(quiz, answers);
    const confetti = `<div class="trophy-wrap"><div class="trophy">🏆</div><div class="drum">🥁</div><div class="clap-row">${avatars.map((a)=>`<div class='avatar tiny ${a} clap'></div>`).join("")}</div></div>`;
    resultHtml = `<section class='card result-card'>${confetti}<h3>Great effort!</h3><p>Score <b>${score.earned}</b> / ${score.possible}</p><p>Percentage <b>${score.percent.toFixed(2)}%</b></p><p>Time taken <b>${formatDuration(Date.now()-startedAt)}</b></p><details><summary>Per-question correctness</summary><pre>${JSON.stringify(score.perQuestion, null, 2)}</pre></details><details><summary>Show Answers</summary><pre>${JSON.stringify(quiz.questions, null, 2)}</pre></details><details><summary>Show Explanations</summary>${quiz.questions.map((q:any,i:number)=>`<p><b>Q${i+1}:</b> ${q.explanation}</p>`).join("")}</details></section>`;
    render();
  });
}

render();

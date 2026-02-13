import "./styles.css";
import { Difficulty, generateQuiz, QuizType } from "./api";
import { renderDebug } from "./debug";
import { renderQuiz, highlightCodeBlocks } from "./renderQuiz";
import { scoreQuiz } from "./scoring";
import { formatDuration } from "./timer";

const app = document.querySelector<HTMLDivElement>("#app")!;
let files: File[] = [];
let quiz: any = null;
let answers: Record<string, any> = {};
let startedAt = 0;
let debugPayload: any = {};
let raw = "";
let details = "";

function addFiles(incoming: File[]) {
  const next = [...files, ...incoming];
  if (next.length > 10) return alert("Maximum 10 files allowed.");
  const tooLarge = next.find((f) => f.size > 20 * 1024 * 1024);
  if (tooLarge) return alert(`${tooLarge.name} exceeds 20MB.`);
  files = next;
  render();
}

function render() {
  app.innerHTML = `<main><h1>QuizForge Prototype</h1>${quiz ? quizView() : setupView()}</main>`;
  bindSetup();
  bindQuiz();
  highlightCodeBlocks(app);
}

function setupView() {
  return `<section class="card"><h2>1) Upload files</h2><div id="dropZone" class="drop-zone">Drag & drop files here</div><input id="fileInput" type="file" multiple /><ul>${files.map((f) => `<li>${f.name} (${(f.size / 1024 / 1024).toFixed(2)} MB)</li>`).join("")}</ul><p>Total: ${files.length} file(s) <button id="clearFiles" type="button">Clear</button></p></section>${files.length ? optionsView() : ""}${renderDebug(debugPayload, raw, details)}`;
}

function optionsView() {
  return `<section class="card"><h2>2) Quiz options</h2><label>Quiz type <select id="quizType"><option value="mcq">Multiple Choice</option><option value="fill_blank">Fill in the Blank</option><option value="identification">Identification</option><option value="matching">Matching</option><option value="mixed">Mixed</option></select></label><div>${[5, 10, 20, 30, 50, 100].map((n) => `<button type="button" data-count="${n}">${n}</button>`).join("")}</div><label>Custom count (max 100) <input id="customCount" type="number" min="1" max="100" value="10"/></label><label>Difficulty <select id="difficulty"><option value="">Optional</option><option value="easy">easy</option><option value="medium">medium</option><option value="hard">hard</option></select></label><button id="generateBtn">Generate Quiz</button></section>`;
}

function quizView() {
  return `<section class="card"><h2>${quiz.quiz_title}</h2><p>${quiz.source_summary}</p><div>${renderQuiz(quiz, answers)}</div><div class="actions"><button id="submitQuiz">Submit Quiz</button><button id="resetAnswers">Reset Answers</button><button id="backSetup">Back to Setup</button></div></section><section id="result"></section>${renderDebug(debugPayload, raw, details)}`;
}

function bindSetup() {
  const drop = document.getElementById("dropZone");
  drop?.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("drag-over"); });
  drop?.addEventListener("dragleave", () => drop.classList.remove("drag-over"));
  drop?.addEventListener("drop", (e) => { e.preventDefault(); drop.classList.remove("drag-over"); addFiles(Array.from(e.dataTransfer?.files || [])); });
  const input = document.getElementById("fileInput") as HTMLInputElement | null;
  input?.addEventListener("change", () => addFiles(Array.from(input.files || [])));
  document.getElementById("clearFiles")?.addEventListener("click", () => { files = []; render(); });
  document.querySelectorAll("[data-count]").forEach((btn) => btn.addEventListener("click", () => { (document.getElementById("customCount") as HTMLInputElement).value = (btn as HTMLElement).getAttribute("data-count") || "10"; }));
  document.getElementById("generateBtn")?.addEventListener("click", async () => {
    const btn = document.getElementById("generateBtn") as HTMLButtonElement;
    btn.disabled = true; btn.textContent = "Generating...";
    const result = await generateQuiz({ files, quizType: (document.getElementById("quizType") as HTMLSelectElement).value as QuizType, questionCount: Number((document.getElementById("customCount") as HTMLInputElement).value || 10), difficulty: (document.getElementById("difficulty") as HTMLSelectElement).value as Difficulty });
    debugPayload = result.debug || {}; raw = result.raw || ""; details = result.details || "";
    if (!result.ok) { alert(result.error || "Generation failed"); btn.disabled = false; btn.textContent = "Generate Quiz"; render(); return; }
    quiz = result.quiz; answers = {}; startedAt = Date.now(); render();
  });
}

function bindQuiz() {
  if (!quiz) return;
  app.querySelectorAll("input[type='radio']").forEach((el) => el.addEventListener("change", (e) => { const t = e.target as HTMLInputElement; answers[t.dataset.qid!] = Number(t.value); }));
  app.querySelectorAll("input[type='text']").forEach((el) => el.addEventListener("input", (e) => { const t = e.target as HTMLInputElement; answers[t.dataset.qid!] = t.value; }));
  app.querySelectorAll("select[data-qid]").forEach((el) => el.addEventListener("change", (e) => { const t = e.target as HTMLSelectElement; const qid=t.dataset.qid!; const idx=Number(t.dataset.pair!); answers[qid]=answers[qid]||{}; answers[qid][idx]=t.value; }));
  document.getElementById("resetAnswers")?.addEventListener("click", () => { answers = {}; render(); });
  document.getElementById("backSetup")?.addEventListener("click", () => { quiz = null; answers = {}; render(); });
  document.getElementById("submitQuiz")?.addEventListener("click", () => {
    const score = scoreQuiz(quiz, answers);
    document.getElementById("result")!.innerHTML = `<section class='card'><p>Score ${score.earned} / ${score.possible}</p><p>Percentage ${score.percent.toFixed(2)}%</p><p>Time taken ${formatDuration(Date.now()-startedAt)}</p><details><summary>Per-question correctness</summary><pre>${JSON.stringify(score.perQuestion, null, 2)}</pre></details><details><summary>Show Answers</summary><pre>${JSON.stringify(quiz.questions, null, 2)}</pre></details><details><summary>Show Explanations</summary>${quiz.questions.map((q:any,i:number)=>`<p><b>Q${i+1}:</b> ${q.explanation}</p>`).join("")}</details></section>`;
  });
}

render();

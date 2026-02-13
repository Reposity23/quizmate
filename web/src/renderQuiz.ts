import Prism from "prismjs";
import "prismjs/themes/prism-tomorrow.css";
import { renderRichText } from "./latex";

export function renderSingleQuestion(question: any, answers: Record<string, any>, questionNumber: number, total: number) {
  const stem = `<header class="question-header"><span class="q-pill">Question ${questionNumber} / ${total}</span><h2>${renderRichText(question.prompt || "Match the pairs")}</h2></header>`;

  if (question.type === "mcq") {
    return `${stem}<div class="choice-grid">${question.choices
      .map(
        (c: string, i: number) => `<label class="choice-card ${Number(answers[question.id]) === i ? "selected" : ""}">
      <input type="radio" name="${question.id}" data-qid="${question.id}" value="${i}" ${Number(answers[question.id]) === i ? "checked" : ""}/>
      <span>${renderRichText(c)}</span>
    </label>`
      )
      .join("")}</div>`;
  }

  if (question.type === "matching") {
    const rights = [...question.pairs.map((p: any) => p.right)].sort(() => Math.random() - 0.5);
    return `${stem}<div class="matching-wrap">${question.pairs
      .map(
        (p: any, i: number) => `<div class="match-row"><span class="left">${renderRichText(p.left)}</span><select data-qid="${question.id}" data-pair="${i}">
      <option value="">Choose pair</option>
      ${rights.map((r: string) => `<option ${answers[question.id]?.[i] === r ? "selected" : ""}>${r}</option>`).join("")}
    </select></div>`
      )
      .join("")}</div>`;
  }

  return `${stem}<div class="input-wrap"><input class="answer-input" type="text" data-qid="${question.id}" value="${answers[question.id] || ""}" placeholder="Type your answer"/></div>`;
}

export function highlightCodeBlocks(root: HTMLElement) {
  root.querySelectorAll("pre code").forEach((el) => Prism.highlightElement(el as HTMLElement));
}

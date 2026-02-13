export type QuizType = "mcq" | "fill_blank" | "identification" | "matching" | "mixed";
export type Difficulty = "easy" | "medium" | "hard" | "";

export async function generateQuiz(params: {
  files: File[];
  quizType: QuizType;
  questionCount: number;
  difficulty?: Difficulty;
  onProgress?: (percent: number, phase: "uploading" | "generating") => void;
}) {
  const form = new FormData();
  params.files.forEach((f) => form.append("files", f));
  form.append("quizType", params.quizType);
  form.append("questionCount", String(params.questionCount));
  if (params.difficulty) form.append("difficulty", params.difficulty);

  return new Promise<any>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/generate-quiz");

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      const percent = Math.round((event.loaded / event.total) * 100);
      params.onProgress?.(percent, "uploading");
    };

    xhr.onreadystatechange = () => {
      if (xhr.readyState === XMLHttpRequest.HEADERS_RECEIVED) {
        params.onProgress?.(100, "generating");
      }
    };

    xhr.onload = () => {
      try {
        resolve(JSON.parse(xhr.responseText));
      } catch {
        reject(new Error("Invalid server response"));
      }
    };

    xhr.onerror = () => reject(new Error("Network error"));
    xhr.send(form);
  });
}

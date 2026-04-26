"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Spinner } from "@/components/ui/Spinner";
import { Skeleton } from "@/components/ui/Skeleton";

type MCQ = { q: string; options: string[] };
type ShortQ = { q: string };
type QuizPayload = {
  topicId: string;
  difficulty: "practice" | "master";
  mcqs: MCQ[];
  shortQs: ShortQ[];
};

type MCQResult = {
  correct: boolean;
  expected: number;
  given: number;
  correctIndex: number;
  explanation: string;
};
type ShortResult = { score: number; feedback: string; modelAnswer: string };

type SubmitResponse = {
  percent: number;
  passed: boolean;
  mastered: boolean;
  threshold: number;
  mcqResults: MCQResult[];
  shortResults: ShortResult[];
};

export default function QuizRunner({
  topicId,
  stage,
}: {
  topicId: string;
  stage: "practice" | "master";
}) {
  const [quiz, setQuiz] = useState<QuizPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [mcqAnswers, setMcqAnswers] = useState<number[]>([]);
  const [shortAnswers, setShortAnswers] = useState<string[]>([]);
  const [result, setResult] = useState<SubmitResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/learning?topicId=${topicId}&kind=quiz:${stage}`)
      .then((r) => r.json())
      .then((j) => {
        setQuiz(j.quiz);
        setMcqAnswers(new Array(j.quiz.mcqs.length).fill(-1));
        setShortAnswers(new Array(j.quiz.shortQs.length).fill(""));
      })
      .finally(() => setLoading(false));
  }, [topicId, stage]);

  async function submit() {
    setSubmitting(true);
    try {
      const r = await fetch("/api/quiz/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicId, stage, mcqAnswers, shortAnswers }),
      });
      const j = (await r.json()) as SubmitResponse;
      setResult(j);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !quiz)
    return (
      <div className="space-y-4" role="status" aria-live="polite">
        <p className="inline-flex items-center gap-2 text-sm text-slate-500">
          <Spinner size="sm" />
          Loading quiz…
        </p>
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-slate-200 bg-white p-4"
          >
            <Skeleton className="h-4 w-3/4" />
            <div className="mt-3 space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          </div>
        ))}
      </div>
    );

  const allAnswered =
    mcqAnswers.every((a) => a >= 0) && shortAnswers.every((s) => s.trim().length > 0);

  return (
    <div className="space-y-6">
      {quiz.mcqs.map((m, i) => {
        const res = result?.mcqResults[i];
        return (
          <fieldset
            key={i}
            className={`rounded-xl border p-4 ${
              res
                ? res.correct
                  ? "border-emerald-300 bg-emerald-50"
                  : "border-rose-300 bg-rose-50"
                : "border-slate-200 bg-white"
            }`}
          >
            <legend className="text-sm font-semibold text-slate-800">
              Q{i + 1}. {m.q}
            </legend>
            <div className="mt-3 space-y-2">
              {m.options.map((opt, j) => {
                const chosen = mcqAnswers[i] === j;
                const isCorrect = res && res.correctIndex === j;
                return (
                  <label
                    key={j}
                    className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2 text-sm ${
                      isCorrect
                        ? "border-emerald-500 bg-emerald-100"
                        : chosen
                          ? "border-brand bg-brand-50"
                          : "border-slate-200 bg-white"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`mcq-${i}`}
                      disabled={!!result}
                      checked={chosen}
                      onChange={() => {
                        const next = [...mcqAnswers];
                        next[i] = j;
                        setMcqAnswers(next);
                      }}
                    />
                    <span>{opt}</span>
                  </label>
                );
              })}
            </div>
            {res && (
              <p className="mt-2 text-xs text-slate-700">
                <span className="font-semibold">ବ୍ୟାଖ୍ୟା:</span> {res.explanation}
              </p>
            )}
          </fieldset>
        );
      })}

      {quiz.shortQs.map((s, i) => {
        const res = result?.shortResults[i];
        return (
          <div
            key={i}
            className={`rounded-xl border p-4 ${
              res
                ? res.score >= 3
                  ? "border-emerald-300 bg-emerald-50"
                  : "border-amber-300 bg-amber-50"
                : "border-slate-200 bg-white"
            }`}
          >
            <label className="block text-sm font-semibold text-slate-800">
              SA{i + 1}. {s.q}
            </label>
            <textarea
              className="mt-2 w-full rounded-lg border border-slate-300 p-2 text-sm"
              rows={3}
              disabled={!!result}
              value={shortAnswers[i] ?? ""}
              onChange={(e) => {
                const next = [...shortAnswers];
                next[i] = e.target.value;
                setShortAnswers(next);
              }}
            />
            {res && (
              <div className="mt-2 text-xs text-slate-700">
                <p>
                  <span className="font-semibold">ସ୍କୋର:</span> {res.score}/5 · {res.feedback}
                </p>
                <p className="mt-1">
                  <span className="font-semibold">ନମୁନା ଉତ୍ତର:</span> {res.modelAnswer}
                </p>
              </div>
            )}
          </div>
        );
      })}

      {!result && (
        <button
          onClick={submit}
          disabled={!allAnswered || submitting}
          className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-brand-700 disabled:opacity-50"
        >
          {submitting && <Spinner size="sm" className="[&>span:first-child]:border-white/30 [&>span:first-child]:border-t-white" />}
          {submitting ? "Grading…" : "ଦେଖ / Submit"}
        </button>
      )}

      {result && (
        <div
          className={`rounded-xl border p-5 ${
            result.passed
              ? "border-emerald-400 bg-emerald-50"
              : "border-amber-400 bg-amber-50"
          }`}
        >
          <h3 className="text-lg font-bold">
            ଫଳାଫଳ: {result.percent}% {result.passed ? "✓" : ""}
          </h3>
          <p className="text-sm text-slate-700">
            {stage === "master"
              ? result.mastered
                ? "ଏହି ଟପିକ୍ ତୁମେ ମାଷ୍ଟର୍ କରିଛ!"
                : `ମାଷ୍ଟର୍ ପାଇଁ ${result.threshold}% ଦରକାର।`
              : result.passed
                ? "ଅଭ୍ୟାସ ସମାପ୍ତ। ଏବେ Master ସ୍ତରକୁ ଯାଅ।"
                : "ଆଉ ଥରେ ପଢ଼ି ଚେଷ୍ଟା କର।"}
          </p>
          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            <Link href={`/topic/${topicId}`} className="text-brand hover:underline">
              ← Topic overview
            </Link>
            {result.passed && stage === "practice" && (
              <Link
                href={`/topic/${topicId}/master`}
                className="rounded-lg bg-brand px-4 py-2 font-semibold text-white hover:bg-brand-700"
              >
                Master Challenge →
              </Link>
            )}
            <button
              onClick={() => {
                setResult(null);
                setMcqAnswers(new Array(quiz.mcqs.length).fill(-1));
                setShortAnswers(new Array(quiz.shortQs.length).fill(""));
              }}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-700 hover:bg-slate-50"
            >
              ପୁଣି ଚେଷ୍ଟା କର
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

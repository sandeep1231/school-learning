"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Spinner } from "@/components/ui/Spinner";
import { Skeleton } from "@/components/ui/Skeleton";
import MarkdownBody from "@/components/markdown/MarkdownBody";

type Difficulty = "easy" | "medium" | "hard";

type ClientMcq = {
  id: string;
  kind: "mcq";
  difficulty: Difficulty;
  questionMd: string;
  options: string[];
  citationPage: number | null;
};
type ClientFreeText = {
  id: string;
  kind: "short" | "long";
  difficulty: Difficulty;
  questionMd: string;
  citationPage: number | null;
};
type ClientItem = ClientMcq | ClientFreeText;

type Answer =
  | { itemId: string; kind: "mcq"; choiceIndex: number }
  | { itemId: string; kind: "short" | "long"; text: string };

type ItemResult = {
  itemId: string;
  kind: "mcq" | "short" | "long";
  fraction: number;
  correct: boolean;
  correctIndex?: number;
  matchedKeywords?: string[];
  modelAnswer?: string;
  explanationMd?: string | null;
  rubricBreakdown?: Array<{
    criterion: string;
    weight: number;
    matched: string[];
    score: number;
  }>;
};

type SubmitResponse = {
  percent: number;
  passed: boolean;
  threshold: number;
  persisted: boolean;
  results: ItemResult[];
};

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

export default function PracticeSession({
  topicSlug,
  topicHubHref,
  nextStageHref,
}: {
  topicSlug: string;
  topicHubHref: string;
  nextStageHref: string | null;
}) {
  const [items, setItems] = useState<ClientItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | Difficulty>("all");
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [result, setResult] = useState<SubmitResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [flagged, setFlagged] = useState<Record<string, string>>({});
  const [startedAt] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/practice/items?topic=${encodeURIComponent(topicSlug)}`)
      .then((r) => r.json())
      .then((j: { items: ClientItem[] }) => {
        if (cancelled) return;
        setItems(j.items ?? []);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [topicSlug]);

  const visible =
    items === null
      ? []
      : filter === "all"
        ? items
        : items.filter((i) => i.difficulty === filter);

  const allAnswered =
    visible.length > 0 &&
    visible.every((i) => {
      const a = answers[i.id];
      if (!a) return false;
      if (i.kind === "mcq") return a.kind === "mcq" && a.choiceIndex >= 0;
      return a.kind !== "mcq" && a.text.trim().length > 0;
    });

  async function submit() {
    setSubmitting(true);
    try {
      const payload = visible
        .map((i) => answers[i.id])
        .filter((a): a is Answer => Boolean(a));
      const r = await fetch("/api/practice/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          topicSlug,
          answers: payload,
          timeMsByItem: Object.fromEntries(
            visible.map((i) => [i.id, Math.max(0, Date.now() - startedAt)]),
          ),
        }),
      });
      const j = (await r.json()) as SubmitResponse;
      setResult(j);
    } finally {
      setSubmitting(false);
    }
  }

  async function flagItem(itemId: string, reason: string) {
    setFlagged((f) => ({ ...f, [itemId]: reason }));
    try {
      await fetch("/api/practice/flag", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ itemId, reason }),
      });
    } catch {
      // Silent failure — flag is a best-effort signal.
    }
  }

  if (loading || items === null) {
    return (
      <div className="space-y-4" role="status" aria-live="polite">
        <p className="inline-flex items-center gap-2 text-sm text-slate-500">
          <Spinner size="sm" />
          Loading practice…
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
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        <p className="font-semibold">Practice bank is empty for this topic.</p>
        <p className="mt-1 text-amber-800">
          Run <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs">npm run content:practice -- --topic {topicSlug}</code>{" "}
          to generate items.
        </p>
        <Link
          href={topicHubHref}
          className="mt-3 inline-block text-brand hover:underline"
        >
          ← Back to topic
        </Link>
      </div>
    );
  }

  const resultById = new Map(
    (result?.results ?? []).map((r) => [r.itemId, r]),
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-slate-500">Difficulty:</span>
        {(["all", "easy", "medium", "hard"] as const).map((d) => (
          <button
            key={d}
            type="button"
            disabled={!!result}
            onClick={() => setFilter(d)}
            className={`rounded-full border px-3 py-1 ${
              filter === d
                ? "border-brand bg-brand text-white"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {d === "all" ? "All" : DIFFICULTY_LABEL[d]}
          </button>
        ))}
        <span className="ml-auto text-slate-500">
          {visible.length} question{visible.length === 1 ? "" : "s"}
        </span>
      </div>

      {visible.map((item, idx) => {
        const res = resultById.get(item.id);
        const answered = answers[item.id];
        const borderTone = res
          ? res.correct
            ? "border-emerald-300 bg-emerald-50"
            : res.fraction >= 0.5
              ? "border-amber-300 bg-amber-50"
              : "border-rose-300 bg-rose-50"
          : "border-slate-200 bg-white";

        return (
          <fieldset
            key={item.id}
            className={`rounded-xl border p-4 ${borderTone}`}
          >
            <legend className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <span className="inline-flex items-baseline gap-1">
                <span>Q{idx + 1}.</span>
                <MarkdownBody inline>{item.questionMd}</MarkdownBody>
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-600">
                {DIFFICULTY_LABEL[item.difficulty]}
              </span>
              {item.citationPage != null && (
                <span className="text-[10px] text-slate-500">
                  · page {item.citationPage}
                </span>
              )}
            </legend>

            {item.kind === "mcq" ? (
              <div className="mt-3 space-y-2">
                {item.options.map((opt, j) => {
                  const chosen =
                    answered?.kind === "mcq" && answered.choiceIndex === j;
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
                        name={`mcq-${item.id}`}
                        disabled={!!result}
                        checked={!!chosen}
                        onChange={() =>
                          setAnswers((a) => ({
                            ...a,
                            [item.id]: {
                              itemId: item.id,
                              kind: "mcq",
                              choiceIndex: j,
                            },
                          }))
                        }
                      />
                      <MarkdownBody inline>{opt}</MarkdownBody>
                    </label>
                  );
                })}
              </div>
            ) : (
              <textarea
                className="mt-3 w-full rounded-lg border border-slate-300 p-2 text-sm"
                rows={item.kind === "long" ? 5 : 3}
                disabled={!!result}
                value={
                  answered?.kind !== "mcq" ? (answered?.text ?? "") : ""
                }
                placeholder={
                  item.kind === "long"
                    ? "Write a complete answer (4–8 sentences)…"
                    : "Short answer (1–3 sentences)…"
                }
                onChange={(e) =>
                  setAnswers((a) => ({
                    ...a,
                    [item.id]: {
                      itemId: item.id,
                      kind: item.kind,
                      text: e.target.value,
                    },
                  }))
                }
              />
            )}

            {res && (
              <div className="mt-3 space-y-1 text-xs text-slate-700">
                {res.kind === "mcq" ? (
                  <p className="flex flex-wrap items-baseline gap-1">
                    <span className="font-semibold">ବ୍ୟାଖ୍ୟା:</span>{" "}
                    {res.explanationMd ? (
                      <MarkdownBody inline>{res.explanationMd}</MarkdownBody>
                    ) : (
                      <span>—</span>
                    )}
                  </p>
                ) : (
                  <>
                    <p>
                      <span className="font-semibold">ସ୍କୋର:</span>{" "}
                      {Math.round(res.fraction * 100)}% ·{" "}
                      {res.matchedKeywords && res.matchedKeywords.length > 0
                        ? `matched: ${res.matchedKeywords.join(", ")}`
                        : "no keywords matched"}
                    </p>
                    {res.rubricBreakdown && res.rubricBreakdown.length > 0 && (
                      <ul className="mt-1 space-y-0.5 rounded-md bg-slate-50 p-2 text-[11px] text-slate-700">
                        {res.rubricBreakdown.map((c) => (
                          <li
                            key={c.criterion}
                            className="flex items-baseline justify-between gap-2"
                          >
                            <span>
                              <span className="font-semibold">
                                {c.criterion}
                              </span>{" "}
                              <span className="text-slate-500">
                                (weight {c.weight})
                              </span>
                            </span>
                            <span className="tabular-nums">
                              {Math.round(c.score * 100)}%
                              {c.matched.length > 0 && (
                                <span className="ml-1 text-slate-500">
                                  · {c.matched.join(", ")}
                                </span>
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {res.modelAnswer && (
                      <p>
                        <span className="font-semibold">ନମୁନା ଉତ୍ତର:</span>{" "}
                        {res.modelAnswer}
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            <div className="mt-3 text-right">
              {flagged[item.id] ? (
                <span className="text-[11px] text-slate-500">
                  Reported — thank you.
                </span>
              ) : (
                <button
                  type="button"
                  className="text-[11px] text-slate-500 hover:text-rose-600"
                  onClick={() => {
                    const reason = window.prompt(
                      "Report this question (wrong answer, bad grammar, off-syllabus, etc.)",
                    );
                    if (reason && reason.trim().length > 0) {
                      flagItem(item.id, reason.trim());
                    }
                  }}
                >
                  Report
                </button>
              )}
            </div>
          </fieldset>
        );
      })}

      {!result && (
        <button
          onClick={submit}
          disabled={!allAnswered || submitting}
          className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-brand-700 disabled:opacity-50"
        >
          {submitting && <Spinner size="sm" />}
          {submitting ? "Grading…" : "ଦେଖ / Submit"}
        </button>
      )}

      {result && (
        <div
          role="status"
          aria-live="polite"
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
            {result.passed
              ? "ଅଭ୍ୟାସ ସମାପ୍ତ। ଏବେ Master ସ୍ତରକୁ ଯାଅ।"
              : `${result.threshold}% ଦରକାର। ଆଉ ଥରେ ଚେଷ୍ଟା କର।`}
          </p>
          {!result.persisted && (
            <p className="mt-1 text-xs text-slate-500">
              Guest mode — sign in to save your progress.
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            <Link href={topicHubHref} className="text-brand hover:underline">
              ← Topic overview
            </Link>
            {result.passed && nextStageHref && (
              <Link
                href={nextStageHref}
                className="rounded-lg bg-brand px-4 py-2 font-semibold text-white hover:bg-brand-700"
              >
                Master Challenge →
              </Link>
            )}
            <button
              onClick={() => {
                setResult(null);
                setAnswers({});
              }}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-700 hover:bg-slate-50"
            >
              Try again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

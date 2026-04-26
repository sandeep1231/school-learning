"use client";

import Link from "next/link";
import type { Stage, TopicProgress } from "@/lib/progress";

const stageLabels: Record<Stage, { en: string; or: string }> = {
  learn: { en: "Learn", or: "ଶିଖ" },
  ask: { en: "Ask Tutor", or: "ପ୍ରଶ୍ନ କର" },
  practice: { en: "Practice", or: "ଅଭ୍ୟାସ" },
  master: { en: "Master", or: "ମାଷ୍ଟର୍" },
};

export function ProgressRing({ progress }: { progress: TopicProgress }) {
  const stages: Stage[] = ["learn", "practice", "master"];
  const done = stages.filter(
    (s) => progress[s].status === "completed" || progress[s].status === "mastered",
  ).length;
  const pct = Math.round((done / stages.length) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-10 w-10">
        <svg viewBox="0 0 36 36" className="h-10 w-10">
          <path
            className="stroke-slate-200"
            strokeWidth="3"
            fill="none"
            d="M18 2 a 16 16 0 1 1 0 32 a 16 16 0 1 1 0 -32"
          />
          <path
            className="stroke-brand"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${pct}, 100`}
            d="M18 2 a 16 16 0 1 1 0 32 a 16 16 0 1 1 0 -32"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-brand-900">
          {pct}%
        </div>
      </div>
      <div className="text-xs text-slate-600">
        {done}/{stages.length} stages
      </div>
    </div>
  );
}

export function StageBadge({
  stage,
  state,
}: {
  stage: Stage;
  state: TopicProgress[Stage];
}) {
  const label = stageLabels[stage];
  const cls =
    state.status === "mastered"
      ? "bg-emerald-600 text-white"
      : state.status === "completed"
        ? "bg-brand text-white"
        : state.status === "available"
          ? "bg-brand-50 text-brand-900 border border-brand"
          : "bg-slate-100 text-slate-400";
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-medium ${cls}`}>
      {label.en}
      {state.score != null && state.status !== "locked"
        ? ` · ${state.score}%`
        : ""}
    </span>
  );
}

export function TopicCard({
  topicId,
  subjectCode,
  title,
  chapter,
  progress,
}: {
  topicId: string;
  subjectCode: string;
  title: { en: string; or: string };
  chapter: string;
  progress: TopicProgress;
}) {
  const stages: Stage[] = ["learn", "practice", "master"];
  return (
    <Link
      href={`/topic/${topicId}`}
      className="block rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="mb-1 text-xs uppercase tracking-wide text-brand">
            {subjectCode} · {chapter}
          </div>
          <h3 className="text-lg font-semibold text-slate-900">{title.or}</h3>
          <p className="text-sm text-slate-500">{title.en}</p>
        </div>
        <ProgressRing progress={progress} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {stages.map((s) => (
          <StageBadge key={s} stage={s} state={progress[s]} />
        ))}
      </div>
    </Link>
  );
}

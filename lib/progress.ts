// In-memory progress store for demo mode. Lives for the server process
// lifetime only. In production this is replaced by the `topic_progress`
// table from migration 0004 via Supabase.

export type Stage = "learn" | "ask" | "practice" | "master";

export type StageState = {
  status: "locked" | "available" | "completed" | "mastered";
  score?: number;
  attempts: number;
  updatedAt: string;
};

export type TopicProgress = Record<Stage, StageState>;

const store: Map<string, TopicProgress> = new Map();

function key(studentId: string, topicId: string) {
  return `${studentId}::${topicId}`;
}

function emptyProgress(): TopicProgress {
  return {
    learn: { status: "available", attempts: 0, updatedAt: new Date().toISOString() },
    ask: { status: "available", attempts: 0, updatedAt: new Date().toISOString() },
    practice: { status: "locked", attempts: 0, updatedAt: new Date().toISOString() },
    master: { status: "locked", attempts: 0, updatedAt: new Date().toISOString() },
  };
}

export function getProgress(studentId: string, topicId: string): TopicProgress {
  const k = key(studentId, topicId);
  const existing = store.get(k);
  if (existing) return existing;
  const fresh = emptyProgress();
  store.set(k, fresh);
  return fresh;
}

export function markStage(
  studentId: string,
  topicId: string,
  stage: Stage,
  patch: Partial<StageState>,
): TopicProgress {
  const progress = getProgress(studentId, topicId);
  progress[stage] = {
    ...progress[stage],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  // Unlock subsequent stages when prior stage completes.
  if (stage === "learn" && (patch.status === "completed" || patch.status === "mastered")) {
    if (progress.practice.status === "locked") progress.practice.status = "available";
  }
  if (stage === "practice" && (patch.status === "completed" || patch.status === "mastered")) {
    if (progress.master.status === "locked") progress.master.status = "available";
  }
  store.set(key(studentId, topicId), progress);
  return progress;
}

export function nextStage(progress: TopicProgress): Stage {
  if (progress.learn.status !== "completed" && progress.learn.status !== "mastered")
    return "learn";
  if (progress.practice.status !== "completed" && progress.practice.status !== "mastered")
    return "practice";
  if (progress.master.status !== "mastered") return "master";
  return "master";
}

export function progressPercent(progress: TopicProgress): number {
  const stages: Stage[] = ["learn", "practice", "master"];
  const done = stages.filter(
    (s) => progress[s].status === "completed" || progress[s].status === "mastered",
  ).length;
  return Math.round((done / stages.length) * 100);
}

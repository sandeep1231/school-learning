"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function CompleteLessonButton({ topicId }: { topicId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function onClick() {
    setLoading(true);
    try {
      await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicId, stage: "learn", status: "completed" }),
      });
      setDone(true);
      router.push(`/topic/${topicId}/practice`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={onClick}
      disabled={loading || done}
      className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow hover:bg-brand-700 disabled:opacity-60"
    >
      {done ? "ସମାପ୍ତ ✓" : loading ? "..." : "ପଢ଼ିସାରିଲି — Practice କର"}
    </button>
  );
}

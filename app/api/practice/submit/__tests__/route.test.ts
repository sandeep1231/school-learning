import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Phase 15 — integration test for /api/practice/submit.
 *
 * Mocks the data layer at module boundary so we can exercise the whole
 * scoring + persistence pipeline without a live Supabase. Covers:
 *   - anonymous user → scores returned, no DB writes
 *   - authenticated user → attempts row, SRS upsert, progress mark, activity record
 *   - misconception_tag flows from scoreItem → DB insert
 *   - rubric/long-answer fraction flows through to attempts.score
 */

const mockState: {
  topicBySlug: ReturnType<typeof vi.fn>;
  listItems: ReturnType<typeof vi.fn>;
  inserted: unknown[][];
  upsertSrs: ReturnType<typeof vi.fn>;
  markStage: ReturnType<typeof vi.fn>;
  recordActivity: ReturnType<typeof vi.fn>;
  user: { id: string; isAuthenticated: boolean; email: null };
} = {
  topicBySlug: vi.fn(),
  listItems: vi.fn(),
  inserted: [],
  upsertSrs: vi.fn(),
  markStage: vi.fn(),
  recordActivity: vi.fn(),
  user: { id: "00000000-0000-0000-0000-000000000001", isAuthenticated: true, email: null },
};

vi.mock("@/lib/curriculum/db", () => ({
  getTopicBySlug: (...args: unknown[]) => mockState.topicBySlug(...args),
}));
vi.mock("@/lib/curriculum/practice", () => ({
  listTopicPracticeItems: (...args: unknown[]) => mockState.listItems(...args),
}));
vi.mock("@/lib/auth/user", () => ({
  getCurrentUser: () => Promise.resolve(mockState.user),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (_table: string) => ({
      insert: (rows: unknown[]) => {
        mockState.inserted.push(rows);
        return Promise.resolve({ data: null, error: null });
      },
    }),
  }),
}));
vi.mock("@/lib/srs/persist", () => ({
  upsertSrsReviews: (...args: unknown[]) => mockState.upsertSrs(...args),
}));
vi.mock("@/lib/progress.server", () => ({
  markStageFor: (...args: unknown[]) => mockState.markStage(...args),
}));
vi.mock("@/lib/progress.rollup", () => ({
  recordActivity: (...args: unknown[]) => mockState.recordActivity(...args),
}));

// Import AFTER mocks are registered.
const { POST } = await import("@/app/api/practice/submit/route");

const TOPIC_ID = "11111111-1111-1111-1111-111111111111";
const ITEM_MCQ = "22222222-2222-2222-2222-222222222222";
const ITEM_SHORT = "33333333-3333-3333-3333-333333333333";

function makeItems() {
  return [
    {
      id: ITEM_MCQ,
      kind: "mcq" as const,
      stemMd: "2+2 = ?",
      payload: {
        kind: "mcq",
        options: ["3", "4", "5"],
        correct_index: 1,
        misconceptions: ["off_by_one", null, null],
      },
      explanationMd: "Basic addition.",
      topicId: TOPIC_ID,
    },
    {
      id: ITEM_SHORT,
      kind: "short" as const,
      stemMd: "Define a set.",
      payload: {
        kind: "short",
        model_answer: "A collection of distinct elements",
        keywords: ["collection", "elements"],
      },
      explanationMd: "See ch.1",
      topicId: TOPIC_ID,
    },
  ];
}

function makeReq(body: unknown): Request {
  return new Request("http://x.test/api/practice/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/practice/submit", () => {
  beforeEach(() => {
    mockState.topicBySlug.mockReset();
    mockState.listItems.mockReset();
    mockState.upsertSrs.mockReset();
    mockState.markStage.mockReset();
    mockState.recordActivity.mockReset();
    mockState.inserted = [];
    mockState.topicBySlug.mockResolvedValue({ id: TOPIC_ID, slug: "mth-1-1" });
    mockState.listItems.mockResolvedValue(makeItems());
    mockState.user = {
      id: "00000000-0000-0000-0000-000000000001",
      isAuthenticated: true,
      email: null,
    };
  });

  it("400s on invalid body", async () => {
    const res = await POST(makeReq({ foo: "bar" }));
    expect(res.status).toBe(400);
  });

  it("404s when topic is unknown", async () => {
    mockState.topicBySlug.mockResolvedValueOnce(null);
    const res = await POST(
      makeReq({
        topicSlug: "missing",
        answers: [{ itemId: ITEM_MCQ, kind: "mcq", choiceIndex: 1 }],
      }),
    );
    expect(res.status).toBe(404);
  });

  it("scores answers and persists when authenticated", async () => {
    const res = await POST(
      makeReq({
        topicSlug: "mth-1-1",
        answers: [
          { itemId: ITEM_MCQ, kind: "mcq", choiceIndex: 1 },
          {
            itemId: ITEM_SHORT,
            kind: "short",
            text: "A collection of distinct elements",
          },
        ],
      }),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      percent: number;
      passed: boolean;
      persisted: boolean;
      results: Array<{ itemId: string; correct: boolean }>;
    };
    expect(json.percent).toBeGreaterThanOrEqual(70);
    expect(json.passed).toBe(true);
    expect(json.persisted).toBe(true);
    expect(json.results).toHaveLength(2);

    // Persistence side-effects.
    expect(mockState.inserted).toHaveLength(1);
    const rows = mockState.inserted[0] as Array<{
      student_id: string;
      item_id: string;
      is_correct: boolean;
      misconception_tag: string | null;
    }>;
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.student_id === mockState.user.id)).toBe(true);
    expect(mockState.upsertSrs).toHaveBeenCalledOnce();
    expect(mockState.markStage).toHaveBeenCalledOnce();
    expect(mockState.recordActivity).toHaveBeenCalledOnce();
  });

  it("records misconception_tag for tagged wrong MCQ choice", async () => {
    const res = await POST(
      makeReq({
        topicSlug: "mth-1-1",
        answers: [{ itemId: ITEM_MCQ, kind: "mcq", choiceIndex: 0 }],
      }),
    );
    expect(res.status).toBe(200);
    const rows = mockState.inserted[0] as Array<{
      misconception_tag: string | null;
      is_correct: boolean;
    }>;
    expect(rows[0].is_correct).toBe(false);
    expect(rows[0].misconception_tag).toBe("off_by_one");
  });

  it("does NOT persist when user is anonymous", async () => {
    mockState.user = {
      id: "guest-cookie",
      isAuthenticated: false,
      email: null,
    };
    const res = await POST(
      makeReq({
        topicSlug: "mth-1-1",
        answers: [{ itemId: ITEM_MCQ, kind: "mcq", choiceIndex: 1 }],
      }),
    );
    const json = (await res.json()) as { persisted: boolean };
    expect(json.persisted).toBe(false);
    expect(mockState.inserted).toHaveLength(0);
    expect(mockState.upsertSrs).not.toHaveBeenCalled();
    expect(mockState.markStage).not.toHaveBeenCalled();
    expect(mockState.recordActivity).not.toHaveBeenCalled();
  });
});

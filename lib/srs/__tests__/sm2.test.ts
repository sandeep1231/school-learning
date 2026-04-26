import { describe, it, expect } from "vitest";
import { reviewCard, fractionToQ, INITIAL_SRS } from "../sm2";

const FIXED_NOW = new Date("2025-01-01T00:00:00Z");

describe("fractionToQ", () => {
  it("maps perfect to 5 and zero to 0", () => {
    expect(fractionToQ(1)).toBe(5);
    expect(fractionToQ(0)).toBe(0);
  });

  it("honours the boundaries", () => {
    expect(fractionToQ(0.95)).toBe(5);
    expect(fractionToQ(0.94)).toBe(4);
    expect(fractionToQ(0.8)).toBe(4);
    expect(fractionToQ(0.6)).toBe(3);
    expect(fractionToQ(0.59)).toBe(2);
    expect(fractionToQ(0.4)).toBe(2);
    expect(fractionToQ(0.2)).toBe(1);
    expect(fractionToQ(0.19)).toBe(0);
  });

  it("clamps out-of-range inputs", () => {
    expect(fractionToQ(2)).toBe(5);
    expect(fractionToQ(-1)).toBe(0);
    expect(fractionToQ(Number.NaN)).toBe(0);
  });
});

describe("reviewCard — first three successful reviews", () => {
  it("rep 1 → interval 1 day, ease bumps slightly on q=5", () => {
    const r1 = reviewCard(INITIAL_SRS, 5, FIXED_NOW);
    expect(r1.reps).toBe(1);
    expect(r1.intervalDays).toBe(1);
    expect(r1.ease).toBeGreaterThan(2.5);
    expect(r1.dueAt).toBe("2025-01-02T00:00:00.000Z");
  });

  it("rep 2 → interval 6 days", () => {
    const r1 = reviewCard(INITIAL_SRS, 5, FIXED_NOW);
    const r2 = reviewCard(r1, 5, FIXED_NOW);
    expect(r2.reps).toBe(2);
    expect(r2.intervalDays).toBe(6);
  });

  it("rep 3 → interval = prev_interval * new_ease", () => {
    const r1 = reviewCard(INITIAL_SRS, 5, FIXED_NOW);
    const r2 = reviewCard(r1, 5, FIXED_NOW);
    const r3 = reviewCard(r2, 5, FIXED_NOW);
    expect(r3.reps).toBe(3);
    // SM-2 uses the NEW ease (after applying q=5) multiplied by the
    // prior interval (6 days from rep 2).
    expect(r3.intervalDays).toBe(Math.round(6 * r3.ease));
  });
});

describe("reviewCard — lapses", () => {
  it("q<3 resets reps, bumps lapses and schedules 1-day relearn", () => {
    const r1 = reviewCard(INITIAL_SRS, 5, FIXED_NOW);
    const lapsed = reviewCard(r1, 1, FIXED_NOW);
    expect(lapsed.reps).toBe(0);
    expect(lapsed.lapses).toBe(1);
    expect(lapsed.intervalDays).toBe(1);
  });

  it("ease floors at 1.3 after repeated lapses", () => {
    let s = INITIAL_SRS;
    for (let i = 0; i < 30; i++) s = reviewCard(s, 0, FIXED_NOW);
    expect(s.ease).toBeGreaterThanOrEqual(1.3);
    expect(s.ease).toBeLessThanOrEqual(1.31);
  });
});

describe("reviewCard — input validation", () => {
  it("throws on invalid q", () => {
    expect(() => reviewCard(INITIAL_SRS, 6, FIXED_NOW)).toThrow();
    expect(() => reviewCard(INITIAL_SRS, -1, FIXED_NOW)).toThrow();
    expect(() => reviewCard(INITIAL_SRS, Number.NaN, FIXED_NOW)).toThrow();
  });
});

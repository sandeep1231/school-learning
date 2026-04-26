/**
 * SuperMemo-2 (SM-2) spaced-repetition scheduler.
 *
 * Reference: https://super-memory.com/english/ol/sm2.htm
 *
 * Inputs:
 *   - current card state (ease, interval_days, reps, lapses)
 *   - recall quality `q` in 0..5:
 *       5 = perfect       4 = correct with hesitation   3 = correct with difficulty
 *       2 = wrong but remembered on hint
 *       1 = wrong (familiar)   0 = blackout
 *
 * We map a practice-attempt score fraction to q with `fractionToQ`:
 *   frac >= 0.95 -> 5
 *   frac >= 0.80 -> 4
 *   frac >= 0.60 -> 3
 *   frac >= 0.40 -> 2
 *   frac >= 0.20 -> 1
 *   else         -> 0
 */

export interface SrsState {
  /** SuperMemo ease factor. Starts at 2.5, floor 1.3. */
  ease: number;
  /** Days until next review. */
  intervalDays: number;
  /** Consecutive successful reviews (q >= 3). Reset to 0 on lapse. */
  reps: number;
  /** Running tally of lapses (q < 3). */
  lapses: number;
}

export interface SrsReviewResult extends SrsState {
  /** ISO timestamp of next due review, based on `now + intervalDays`. */
  dueAt: string;
}

export const INITIAL_SRS: SrsState = {
  ease: 2.5,
  intervalDays: 0,
  reps: 0,
  lapses: 0,
};

/** Map a score fraction (0-1) to SM-2 quality (0-5). */
export function fractionToQ(frac: number): number {
  if (!Number.isFinite(frac)) return 0;
  const f = Math.max(0, Math.min(1, frac));
  if (f >= 0.95) return 5;
  if (f >= 0.8) return 4;
  if (f >= 0.6) return 3;
  if (f >= 0.4) return 2;
  if (f >= 0.2) return 1;
  return 0;
}

/**
 * Apply one SM-2 review. `now` defaults to current time; pass fixed value in tests.
 */
export function reviewCard(
  prev: SrsState,
  q: number,
  now: Date = new Date(),
): SrsReviewResult {
  if (!Number.isFinite(q) || q < 0 || q > 5)
    throw new Error(`q out of range 0..5: ${q}`);

  const passed = q >= 3;
  let ease = prev.ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  if (ease < 1.3) ease = 1.3;

  let reps = passed ? prev.reps + 1 : 0;
  let lapses = passed ? prev.lapses : prev.lapses + 1;
  let intervalDays: number;

  if (!passed) {
    // Lapse: relearn with 1-day interval.
    intervalDays = 1;
  } else if (reps === 1) {
    intervalDays = 1;
  } else if (reps === 2) {
    intervalDays = 6;
  } else {
    intervalDays = Math.round(prev.intervalDays * ease);
    if (intervalDays < 1) intervalDays = 1;
  }

  const due = new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000);
  return {
    ease: +ease.toFixed(4),
    intervalDays,
    reps,
    lapses,
    dueAt: due.toISOString(),
  };
}

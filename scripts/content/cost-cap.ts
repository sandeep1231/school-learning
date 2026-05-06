/**
 * Shared cost-cap helper for content generators.
 *
 * Tracks the number of Gemini calls and total tokens across a single run.
 * Generators call `recordCall(res)` after each `model.generateContent(...)`
 * and check `isOverCap()` between topics to break out cleanly.
 *
 * CLI flags (parsed via parseCapArgs):
 *   --max-calls N      hard stop after N model calls (any outcome)
 *   --max-tokens N     hard stop once cumulative totalTokenCount >= N
 */
export type CostCapArgs = {
  maxCalls: number | null;
  maxTokens: number | null;
};

export function parseCapArgs(argv: string[]): CostCapArgs {
  let maxCalls: number | null = null;
  let maxTokens: number | null = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--max-calls") maxCalls = Number(argv[++i]);
    else if (a.startsWith("--max-calls=")) maxCalls = Number(a.slice("--max-calls=".length));
    else if (a === "--max-tokens") maxTokens = Number(argv[++i]);
    else if (a.startsWith("--max-tokens=")) maxTokens = Number(a.slice("--max-tokens=".length));
  }
  if (maxCalls !== null && (!Number.isFinite(maxCalls) || maxCalls <= 0)) maxCalls = null;
  if (maxTokens !== null && (!Number.isFinite(maxTokens) || maxTokens <= 0)) maxTokens = null;
  return { maxCalls, maxTokens };
}

export class CostCap {
  calls = 0;
  inputTokens = 0;
  outputTokens = 0;
  totalTokens = 0;
  reason: string | null = null;
  constructor(private readonly cfg: CostCapArgs) {}

  /** Record a Gemini response. Pass the raw `res` from `model.generateContent`. */
  record(res: any): void {
    this.calls += 1;
    const meta = res?.response?.usageMetadata;
    if (meta) {
      this.inputTokens += Number(meta.promptTokenCount ?? 0);
      this.outputTokens += Number(meta.candidatesTokenCount ?? 0);
      this.totalTokens += Number(
        meta.totalTokenCount ?? (Number(meta.promptTokenCount ?? 0) + Number(meta.candidatesTokenCount ?? 0)),
      );
    }
    if (this.cfg.maxCalls !== null && this.calls >= this.cfg.maxCalls) {
      this.reason = `--max-calls ${this.cfg.maxCalls} reached`;
    } else if (this.cfg.maxTokens !== null && this.totalTokens >= this.cfg.maxTokens) {
      this.reason = `--max-tokens ${this.cfg.maxTokens} reached (used ${this.totalTokens})`;
    }
  }

  isOverCap(): boolean {
    return this.reason !== null;
  }

  summary(): string {
    return `calls=${this.calls} tokens=${this.totalTokens} (in=${this.inputTokens} out=${this.outputTokens})`;
  }
}

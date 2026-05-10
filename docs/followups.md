# Follow-ups (deferred from the launch sprint)

Things found during the pre-launch pass that are real but not blocking
v1. Pick up after launch + feedback.

## Content pipeline

- **Computer textbooks (`Computer_Sikshya.pdf`) aren't recognized** by
  the ingest script's filename → subject classifier. C6 + C7 CMP
  show 0 topic-tagged chunks for this reason. Fix: extend the classifier
  in `scripts/ingest/ingest-class.ts` to recognize the
  `Computer_Sikshya*.pdf` pattern as `CMP`.
- **C9 FLO/GSC/SLE/TLH have 0 topic-tagged chunks** despite lessons
  existing. The chunks were ingested at chapter level but `topic_id`
  was never populated. Fix: a one-shot SQL backfill that joins
  chunks → chapters → topics (via order_index or text matching) and
  populates `chunks.topic_id`. The `retrieveWithFallback` already widens
  to chapter scope so chat works today; this just lets us re-claim
  precise topic-level retrieval.
- **Lessons with malformed mermaid** in `body_md`: render path now
  gracefully degrades to "Diagram couldn't be rendered — show source",
  but the source data is still wrong. A targeted regen with a stricter
  generator prompt that says "if you produce a diagram, validate
  syntax" would clean these up.

## Auth + payments (deferred per stakeholder decision)

- Resume work on:
  - Family-invite flow (parent → student linking)
  - Free trial mechanic + plan gating
  - Parental consent gate for minors (DPDP)
  - Wire Resend for real parent emails
- All currently scaffolded but bypassed; guests have full access.

## Performance

- **KaTeX still ships statically** in every Markdown render. ~150 KB
  per page that has no math. Fix: lazy-import the rehype-katex +
  remark-math plugins inside `MarkdownBody` only when the content
  contains `$`. Estimated effort 2-3 hr.
- **Daily summary cron is sequential**. Will trip past ~1k active
  students. Fix: chunk by 10-20 with `Promise.all`.

## Code health

- **Static `lib/curriculum/bse-class9.ts`** still coexists with the
  DB-backed curriculum, which is the underlying cause of every
  static-vs-DB UUID resolution bug we've hit. Migrate Class 9 entirely
  into the DB (already mostly there per the audit) and delete the
  static module. ~1 day, but eliminates a whole class of bugs.
- **`unused` import for `getTopicBySlug`** in topic-hub page — kept as
  a fallback after the bypass-cache resolver was added. Tidy or remove
  whenever that codepath is revisited.

## QA + testing

- Critical-path Playwright tests aren't written yet. The Playwright
  config exists but there are no tests in `e2e/` or equivalent. Should
  cover: signup, today, topic-hub, learn, practice (submit), master,
  chat (send + receive), snap (upload + answer).
- Mobile UI walkthrough on real Indian-market hardware. See
  `docs/mobile-qa.md`.

## Operational

- Render's free tier crons may not be sufficient at scale; budget for
  paid cron service if we cross ~1k MAU.
- No status page yet. Once we have paying users, set up Statuspage or
  Better Uptime so outages don't generate support volume.

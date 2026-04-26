# Sikhya Sathi — BSE Odisha Class 9 AI Tutor

A multilingual (English / Odia / Hindi) web PWA where a RAG-grounded Google Gemini agent acts as a daily home-tutor for BSE Odisha Class 9 students, with role-specific dashboards for Students, Parents, and Teachers.

> **Status:** Phase 0–2 scaffold. The RAG pipeline, chat UI, and daily summary cron are wired end-to-end; ingestion (PDF parsing + OCR) and the full quiz runner are stubs pending content work.

## Stack

- **Next.js 15** (App Router, TypeScript, RSC, Server Actions)
- **Tailwind CSS** + shadcn-style primitives
- **Supabase** — Postgres + pgvector + Auth (phone OTP) + Storage + Row Level Security
- **Google Gemini** — `gemini-2.5-flash` for chat, `text-embedding-004` for embeddings
- **Upstash Redis** — rate limits & caching
- **next-intl** — EN / Odia / Hindi
- **Vercel** — hosting + cron
- **Vitest** + Playwright (e2e placeholder)

## Project layout

```
app/                       Next.js App Router
  api/chat/route.ts        Streaming RAG chat endpoint (SSE)
  api/cron/daily-summary/  Parent-note cron (20:00 IST)
  today/                   Student "Today's class" page
  chat/[topicId]/          Topic-scoped tutor chat
  quiz/[topicId]/          Practice runner (stub)
  parent/                  Parent dashboard
  teacher/                 Teacher dashboard (stub)
  auth/sign-in/            Phone OTP sign-in
components/chat/           ChatBox streaming UI
lib/
  ai/gemini.ts             Gemini client + safety settings + embeddings
  ai/prompts.ts            Tutor + parent-summary prompts (EN/OR/HI)
  ai/rag.ts                Hybrid pgvector + FTS retrieval with RRF
  supabase/                server / client / admin wrappers
  ratelimit.ts             Upstash sliding-window limiter
i18n/                      Locale config + EN/OR/HI message catalogues
supabase/
  migrations/0001_init.sql      schema
  migrations/0002_rls.sql       RLS policies
  migrations/0003_rag_functions.sql  match_chunks_vector / match_chunks_fts
  seed.sql                 BSE Odisha subjects + sample chapters/topics
scripts/ingest/
  bse-syllabus.ts          Downloader for official BSE Odisha PDFs
  chunk-embed.ts           Chunks + embeds documents into pgvector
```

## Getting started

1. Install deps
   ```bash
   pnpm install    # or npm install / yarn
   ```

2. Copy env and fill in keys
   ```bash
   cp .env.example .env.local
   ```

3. Create a Supabase project and run the migrations
   ```bash
   supabase link --project-ref <ref>
   supabase db push
   psql "$DATABASE_URL" -f supabase/seed.sql
   ```

4. Run the dev server
   ```bash
   pnpm dev
   ```

5. Sign in at `/auth/sign-in` (phone OTP via Supabase; configure MSG91 in Supabase auth settings), then visit `/today`.

## Content ingestion (Phase 0.3)

```bash
pnpm ingest:syllabus      # downloads BSE PDFs into data/raw/
pnpm ingest:embed         # chunks + embeds documents -> pgvector
```

The ingestion scripts are skeletons — they successfully pull the official BSE Odisha Class IX syllabus PDF and textbook list, but the PDF text-extraction + Gemini-assisted curriculum normalisation steps are marked `TODO` and need:

- `unpdf` or `pdf-parse` for text PDFs
- Google Cloud Vision OCR for Odia-script scanned pages
- A human-review admin UI before publishing curriculum rows

## RAG design

- Chunks are stored in `chunks` (800-token, 120 overlap) with an HNSW index on `vector(768)` and a GIN index on the generated `tsvector`.
- Retrieval (`lib/ai/rag.ts`) runs both semantic and FTS queries via SQL RPCs (`match_chunks_vector`, `match_chunks_fts`), scoped to the current topic and its chapter-neighbours, then fuses results using weighted reciprocal-rank fusion.
- The tutor system prompt (`lib/ai/prompts.ts`) enforces: language routing, citation discipline, topic scope, refusal of off-syllabus/unsafe queries, and explicit defence against prompt-injection in retrieved context.

## Security

- All user tables protected by Row Level Security. Policies model student-owns / parent-reads-linked-children / admin-everything. Curriculum + KB tables are read-only to authenticated users; writes go through the service role.
- Service-role key only used server-side (`lib/supabase/admin.ts`).
- Chat rate-limited per user (Upstash, 30 msgs/hr).
- Parental-consent flag (`profiles.consent_at`) required at student onboarding for DPDP Act 2023 minor-data handling.
- Max Gemini safety settings; user input validated with zod.

## Scripts

| command                   | purpose                                     |
|---------------------------|---------------------------------------------|
| `pnpm dev`                | local dev server                            |
| `pnpm build` / `start`    | production build / serve                    |
| `pnpm typecheck`          | `tsc --noEmit`                              |
| `pnpm test`               | Vitest unit tests                           |
| `pnpm e2e`                | Playwright (stub)                           |
| `pnpm ingest:syllabus`    | pull BSE PDFs                               |
| `pnpm ingest:embed`       | chunk + embed into pgvector                 |
| `pnpm db:push`            | apply Supabase migrations                   |

## Deploy → Render

The app ships to Render as a single Node Web Service plus a Render Cron Job
that hits `/api/cron/daily-summary` at 20:00 IST. Supabase, Gemini, Resend,
Upstash, Sentry, and PostHog all stay external.

1. Push this repo to GitHub.
2. In the Render dashboard → **Blueprints → New Blueprint Instance** → pick the
   repo. Render reads [render.yaml](render.yaml) and provisions:
   - `sikhya-sathi` (Web, Node, Singapore, Starter)
   - `sikhya-daily-summary` (Cron, Singapore, Starter, schedule `30 14 * * *`)
3. Fill in the env vars marked `sync: false` in `render.yaml` from the Render
   UI. The required runtime set is:
   - Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
     `SUPABASE_SERVICE_ROLE_KEY`
   - Gemini: `GOOGLE_GENERATIVE_AI_API_KEY`
   - App: `NEXT_PUBLIC_APP_URL` (the Render URL or custom domain), `ADMIN_EMAILS`
   - Billing: `UPI_VPA`, `UPI_PAYEE_NAME`
   - Mail: `RESEND_API_KEY`, `MAIL_FROM`
   - Rate limiting: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
   - Optional: `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, PostHog keys
4. `CRON_SECRET` is auto-generated by Render (`generateValue: true`) and shared
   from the web service into the cron job via `fromService`.
5. The cron job is a tiny Alpine container ([ops/cron/Dockerfile](ops/cron/Dockerfile)
   + [ops/cron/run.sh](ops/cron/run.sh)) that just `curl`s the existing HTTPS
   endpoint, so cron logic stays in the Next.js route.
6. Health check path: `/api/health`.
7. After first deploy, update the Supabase Auth → URL Configuration to add the
   Render URL (or custom domain) to the allowed redirect list.

## Roadmap

- [x] Schema + RLS + RAG SQL
- [x] Gemini chat + streaming UI + citations
- [x] Phone OTP auth + role-based middleware
- [x] Parent daily-summary cron + outbox
- [ ] PDF parsing + OCR + Gemini curriculum normalisation
- [ ] Quiz generator + runner UI
- [ ] Email + WhatsApp outbox worker (Resend + Gupshup)
- [ ] Admin curriculum-review UI
- [ ] PostHog + Sentry wire-up
- [ ] k6 load test + HNSW tuning
- [ ] Razorpay stub for future monetisation

## Out of scope (v2)

Voice tutor, live-tutor video, homework photo OCR grading, Android native, B2B school tenancy.

# Production deploy checklist (Render)

A pragmatic launch checklist. Work through it top-to-bottom — each step
either succeeds or fails fast.

## 1. Environment variables

Put these in **Render → Environment** for the web service. None of the
keys live in the repo.

### Mandatory

| Var | Where it comes from | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project → Settings → API | Public — also set the same value as `SUPABASE_URL` if any internal scripts reference that name. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → `anon` | Public, RLS-enforced. |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → `service_role` | **Server-only.** Never expose. Bypasses RLS. |
| `GEMINI_API_KEY` | https://aistudio.google.com/ → API keys | Free tier OK to start; budget for paid once you have ~100 paying users. |
| `CRON_SECRET` | Generate a 32+ char random string | Authenticates cron POSTs. Set the same value in Render Cron headers. |

### Optional / feature-gated

| Var | Default if missing | What it unlocks |
|---|---|---|
| `NEXT_PUBLIC_POSTHOG_KEY` | analytics off | Funnel + retention dashboards. |
| `NEXT_PUBLIC_POSTHOG_HOST` | `https://eu.i.posthog.com` | Override only if self-hosting. |
| `SENTRY_DSN` | Sentry off | Production error capture. |
| `RESEND_API_KEY` | Email goes to log-only | Real parent emails. |
| `NOTIFICATIONS_EMAIL_FROM` | `Sikhya Sathi <noreply@sikhyasathi.in>` | Override for verified domain. |
| `WHATSAPP_WEBHOOK_URL` + `WHATSAPP_API_KEY` | WhatsApp goes to log-only | Real WhatsApp parent notifications via Wati / Gupshup / any provider. |
| `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` | rate-limiter is no-op (dev only) | Real per-user chat rate-limiting. **Set this for production** to protect Gemini quota. |

## 2. Render service config

Web service (Next.js):

- **Build command:** `npm install && npm run build`
- **Start command:** `npm start`
- **Health check path:** `/api/health`
- **Region:** Singapore (closest to Indian users among Render's options)
- **Plan:** Starter ($7/mo) is enough at <500 MAU. Upgrade when you see
  CPU saturation in the metrics.
- **Auto-deploy:** branch `main`, build on push.

## 3. Cron jobs (Render Cron)

Two cron services, both authenticated via `Authorization: Bearer $CRON_SECRET`.

### Daily summary

- **Schedule:** `0 14 * * *` (UTC; that's 19:30 IST — adjust for DST if needed)
- **Command:**
  ```
  curl -fsS -X POST https://<your-domain>/api/cron/daily-summary \
    -H "Authorization: Bearer $CRON_SECRET"
  ```
- Generates parent notes via Gemini and queues to `notifications_outbox`.

### Notification dispatch

- **Schedule:** `15 14 * * *` (UTC; 15 minutes after the summary cron)
- **Command:**
  ```
  curl -fsS -X POST https://<your-domain>/api/cron/dispatch-notifications \
    -H "Authorization: Bearer $CRON_SECRET"
  ```
- Drains `notifications_outbox`. Falls back to log-only if no provider env
  vars are set.

## 4. Supabase

- **Tier:** Free tier hits ceilings fast (500 MB DB, 2 GB egress/month).
  Plan to upgrade to Pro ($25/mo) before you hit ~500 active users.
- **Region:** verify `ap-south-1` (Mumbai). 100-250 ms RTT vs us/eu
  matters on Indian mobile.
- **Migrations:** apply via `supabase db push` from a workstation, OR
  paste them into the SQL editor manually. The repo's `supabase/migrations/`
  is the source of truth.
- **Auth provider:** Phone OTP via the chosen SMS gateway (MSG91 is
  cheapest for India).
- **RLS:** enabled on every user-data table; verified by `0002_rls.sql`.

## 5. Sentry

- Create a Next.js project at sentry.io.
- Copy the DSN into `SENTRY_DSN`.
- Already wired conditionally in `next.config.mjs` — when the DSN is set,
  the Sentry webpack plugin runs at build time. If you don't set it, the
  build skips Sentry entirely.
- After deploy, throw a deliberate test error and verify it lands in
  Sentry within ~30 seconds.

## 6. PostHog

- Sign up at posthog.com (or self-host).
- Copy the project key into `NEXT_PUBLIC_POSTHOG_KEY`.
- Already gated behind `sikhya:consent` event (DPDP); the consent banner
  fires the event when the user accepts.
- Pre-built dashboard: build a funnel in PostHog with these events in order:
  `$pageview` (path: `/today`) → `topic_opened` → `learn_viewed` →
  `practice_started` → `practice_submitted`. Add a "passed=true" filter
  on the last step to see how many actually complete.
- Useful retention cohort: "first session = topic_opened" → check D1, D7,
  D30 retention.

## 7. Custom domain + HTTPS

- Render → Settings → Custom Domain → add the apex + www.
- Add DNS records as instructed by Render.
- HTTPS auto-provisions via Let's Encrypt.
- Set `NEXT_PUBLIC_SITE_URL` to the production URL.

## 8. Smoke tests after deploy

In order — bail if any fails:

1. `curl https://<domain>/api/health` returns 200.
2. Open `/` in a real browser → hero loads, no console errors.
3. Open `/today` as a guest (incognito) → DB-backed dashboard renders for
   default class.
4. Switch class via the header dropdown → loader spins, page rerenders
   with new class content.
5. Open any topic → all 4 stage cards render correctly (Learn + Ask
   active, Practice + Master active for any seeded topic).
6. Open `/learn` → lesson body renders with citations.
7. Open `/practice` → MCQs load, submit one, see grade.
8. Open `/chat/<topicId>` → send a message, see streaming response.
9. Open `/ask/photo` → upload a sample homework photo → see extracted
   question + answer.
10. Open `/contact` → submit a test message → verify it lands in
    `content_feedback` with `surface='other'`.

## 9. Day-1 monitoring

Watch for the first 24-48 hours:

- **Sentry**: any error spike, especially around auth, payments,
  Supabase queries.
- **Render logs**: cron success messages (`event: cron.daily_summary` and
  `event: cron.dispatch_notifications`). Each should fire once per day.
- **Supabase metrics**: egress (free tier 2 GB/month), connection count,
  slow queries.
- **Gemini API console**: rate-limit hits, cost trajectory.
- **PostHog**: signup → first-practice funnel conversion. Anything below
  20% suggests a UX blocker.

## 10. Rollback plan

If something goes catastrophically wrong:

- Render → Manual Deploy → pick previous successful commit → "Rollback".
- Supabase migrations are forward-only; if a migration broke prod, write
  a compensating migration rather than rolling back.
- Cron services can be paused via Render's UI without affecting the web
  service.

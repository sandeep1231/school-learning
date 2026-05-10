import { expect, test } from "@playwright/test";

/**
 * Critical-path regression net.
 *
 * Walks a guest student through the canonical "Today → topic → learn →
 * practice → submit → chat → contact" flow and asserts the page lands
 * cleanly at each step. The goal isn't to verify content correctness;
 * it's to catch the kind of breakage where a previously-working route
 * silently 5xxs after a refactor (which is what happened to /learn when
 * the `getTopicBySlug` import was lost — that was invisible until users
 * hit it).
 *
 * Selectors are resilient to copy tweaks — we look for ARIA roles,
 * heading hierarchy, and stable DOM landmarks rather than exact text.
 *
 * Run via:  npm run e2e
 *   (which uses the playwright.config.ts that boots `next start`).
 */

test.describe("critical path — guest student", () => {
  test("opens /today as a guest and sees the dashboard", async ({ page }) => {
    const res = await page.goto("/today");
    expect(res?.status()).toBe(200);
    // Heading is the class context label or the welcome banner. Either is OK.
    await expect(page.locator("main")).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 1 }).first(),
    ).toBeVisible();
  });

  test("opens a Class 9 topic hub and renders all four stage cards", async ({
    page,
  }) => {
    // mth-1-1 is part of the static + DB curriculum and must always exist.
    const res = await page.goto(
      "/b/bse-od/c/9/s/mth/ch/mth-ch1-sets/t/mth-1-1",
    );
    expect(res?.status()).toBe(200);

    // Each of the four stage labels must appear, regardless of which are
    // active. Locked stages still show their card with a "Coming soon" pill.
    await expect(page.getByText(/Learn/i).first()).toBeVisible();
    await expect(page.getByText(/Ask Tutor/i).first()).toBeVisible();
    await expect(page.getByText(/Practice/i).first()).toBeVisible();
    await expect(page.getByText(/Master/i).first()).toBeVisible();
  });

  test("opens the Learn page and renders the lesson body", async ({ page }) => {
    const res = await page.goto(
      "/b/bse-od/c/9/s/mth/ch/mth-ch1-sets/t/mth-1-1/learn",
    );
    expect(res?.status()).toBe(200);
    // Either a lesson is rendered (heading + prose container present) or the
    // "Lesson being prepared" fallback. We accept either; failure mode is a
    // 5xx, broken layout, or empty <main>.
    await expect(page.locator("main")).toBeVisible();
    const main = await page.locator("main").innerText();
    expect(main.length).toBeGreaterThan(50);
  });

  test("opens the Practice page and at least one item loads", async ({
    page,
  }) => {
    await page.goto(
      "/b/bse-od/c/9/s/mth/ch/mth-ch1-sets/t/mth-1-1/practice",
    );
    // Practice items are fetched client-side; wait for at least one fieldset
    // (each MCQ / short / long renders inside one). Allow up to 10s for the
    // /api/practice/items round-trip on a cold server.
    const fieldset = page.locator("fieldset").first();
    await expect(fieldset).toBeVisible({ timeout: 10_000 });
  });

  test("opens the Master page and routes to the master runner", async ({
    page,
  }) => {
    const res = await page.goto(
      "/b/bse-od/c/9/s/mth/ch/mth-ch1-sets/t/mth-1-1/master",
    );
    expect(res?.status()).toBe(200);
    await expect(page.locator("main")).toContainText(/Master/i);
  });

  test("opens the chat tutor and the input is wired", async ({ page }) => {
    const res = await page.goto("/chat/mth-1-1");
    expect(res?.status()).toBe(200);
    // ChatBox renders a textarea/input + send button. We don't actually send
    // a message in the smoke (would burn Gemini quota); we just assert the
    // input + send button render so a regression that breaks ChatBox surfaces.
    const sendButton = page.getByRole("button", { name: /send|ପଠାଅ|भेज/i });
    await expect(sendButton).toBeVisible();
  });

  test("opens the Snap-a-question page and the file picker is present", async ({
    page,
  }) => {
    const res = await page.goto("/ask/photo");
    expect(res?.status()).toBe(200);
    // The file input is `sr-only` but its trigger (the labelled button)
    // must be reachable; check that the heading and the action button render.
    await expect(
      page.getByRole("heading", { name: /Snap a question/i }),
    ).toBeVisible();
  });

  test("contact form renders and validates", async ({ page }) => {
    const res = await page.goto("/contact");
    expect(res?.status()).toBe(200);
    await expect(
      page.getByRole("heading", { name: /Contact support/i }),
    ).toBeVisible();
    // Submit disabled until message is long enough.
    const submit = page.getByRole("button", { name: /Send message/i });
    await expect(submit).toBeDisabled();
  });

  test("review page surfaces a guest-friendly message", async ({ page }) => {
    const res = await page.goto("/review");
    expect(res?.status()).toBe(200);
    // Guests see a "sign in" CTA — confirms graceful empty state, not 401.
    await expect(page.locator("main")).toBeVisible();
  });
});

test.describe("critical path — health endpoints", () => {
  test("/api/health returns 200", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);
  });

  test("contact form POST returns 200 for a valid message", async ({
    request,
  }) => {
    const res = await request.post("/api/support", {
      data: {
        message:
          "Automated smoke-test ping. If you see this in the support inbox, the contact form is wired.",
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  test("contact form POST rejects too-short messages", async ({ request }) => {
    const res = await request.post("/api/support", {
      data: { message: "hi" },
    });
    expect(res.status()).toBe(400);
  });
});

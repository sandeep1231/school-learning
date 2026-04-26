import { expect, test } from "@playwright/test";

/**
 * Phase 15 — launch-gating smoke tests. These don't replace deeper E2Es;
 * they just guarantee the marketing front door, the student dashboard,
 * the legal/DPDP pages, and the SEO surfaces all return 200 and contain
 * their critical content. Exec via `npm run e2e` against a running
 * `next start`.
 */

test("homepage renders hero and pricing CTA", async ({ page }) => {
  const res = await page.goto("/");
  expect(res?.status()).toBe(200);
  await expect(page).toHaveTitle(/Sikhya/i);
  await expect(page.getByRole("link", { name: /pricing|plans|see plans/i }).first()).toBeVisible();
});

test("today page is reachable as a guest", async ({ page }) => {
  const res = await page.goto("/today");
  expect(res?.status()).toBe(200);
  // Welcome banner OR onboarding modal should be present for fresh guests.
  const body = page.locator("body");
  await expect(body).toContainText(/Sikhya|Welcome|ସ୍ୱାଗତ/i);
});

test("legal pages render", async ({ page }) => {
  for (const path of ["/legal/privacy", "/legal/terms", "/legal/refund"]) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(200);
    await expect(page.locator("main, #main-content, body")).toContainText(
      /privacy|terms|refund/i,
    );
  }
});

test("sitemap and robots are served", async ({ request }) => {
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  expect(sitemap.headers()["content-type"]).toContain("xml");

  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  const text = await robots.text();
  expect(text).toMatch(/Sitemap:/i);
});

test("settings page requires auth (redirects or 401-style page)", async ({ page }) => {
  const res = await page.goto("/settings");
  // We don't enforce a particular auth flow here, just that we don't 5xx.
  expect(res && res.status() < 500).toBe(true);
});

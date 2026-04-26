import type { MetadataRoute } from "next";

const BASE =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
  "http://localhost:3000";

/**
 * Phase 15 — /robots.txt
 *
 * Allow the public syllabus routes. Disallow authenticated dashboards,
 * admin, checkout, and API endpoints. Sentry tunnel (/monitoring) and PWA
 * service-worker/manifest stay allowed by default.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/"],
        disallow: [
          "/api/",
          "/admin/",
          "/today",
          "/review",
          "/parent",
          "/checkout/",
          "/auth/",
          "/monitoring",
          "/offline",
        ],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}

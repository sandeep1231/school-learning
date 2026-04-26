import type { MetadataRoute } from "next";
import { CURRICULUM, RAG_ONLY_SUBJECTS } from "@/lib/curriculum/bse-class9";

/**
 * Phase 15 — /sitemap.xml
 *
 * Generated from the static BSE Class 9 curriculum so search engines can
 * discover every subject, chapter, topic, and practice page even before a
 * crawler is signed in. Dynamic auth-gated paths (/today, /review, /admin)
 * are deliberately omitted.
 */
const BASE =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
  "http://localhost:3000";

const BOARD = "bse-od";
const CLASS = "9";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [];

  // Root + key public pages.
  for (const path of [
    "/",
    "/pricing",
    "/offline",
    "/legal/privacy",
    "/legal/terms",
    "/legal/refund",
  ]) {
    entries.push({
      url: `${BASE}${path}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: path === "/" ? 1.0 : 0.7,
    });
  }

  // Subjects with full curriculum (MTH, SSC).
  for (const subject of CURRICULUM) {
    const code = subject.code.toLowerCase();
    entries.push({
      url: `${BASE}/b/${BOARD}/c/${CLASS}/s/${code}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    });
    for (const ch of subject.chapters) {
      for (const t of ch.topics) {
        const base = `${BASE}/b/${BOARD}/c/${CLASS}/s/${code}/ch/${ch.slug}/t/${t.id}`;
        for (const stage of ["", "/learn", "/practice"] as const) {
          entries.push({
            url: `${base}${stage}`,
            lastModified: now,
            changeFrequency: "weekly",
            priority: stage === "" ? 0.8 : 0.7,
          });
        }
      }
    }
  }

  // Chapter-only subjects (GSC/FLO/SLE/TLH) — only subject hub is listed,
  // topics are not yet materialised in the static curriculum.
  for (const subject of RAG_ONLY_SUBJECTS) {
    const code = subject.code.toLowerCase();
    entries.push({
      url: `${BASE}/b/${BOARD}/c/${CLASS}/s/${code}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    });
  }

  return entries;
}

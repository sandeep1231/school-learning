export const AUDIENCE_COOKIE = "sikhya_audience";

export type AudienceVariant = "textbook" | "simpler" | "parent" | "exam";

export function readAudience(raw: string | undefined): AudienceVariant {
  return raw === "simpler" || raw === "parent" || raw === "exam"
    ? raw
    : "textbook";
}

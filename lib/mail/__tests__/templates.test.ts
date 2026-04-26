import { describe, it, expect } from "vitest";
import { planActivationReceipt } from "../templates";
import { esc } from "../mailer";

describe("mail templates", () => {
  it("escapes user-controlled fields", () => {
    const r = planActivationReceipt({
      fullName: "<script>alert(1)</script>",
      planTitle: "A & B \"C\"",
      amountInr: 199,
      utr: "X<>Y",
      referenceId: "ref",
      grantedUntilISO: "2026-12-31T00:00:00Z",
      appUrl: "https://example.com",
    });
    expect(r.html).not.toContain("<script>alert(1)</script>");
    expect(r.html).toContain("&lt;script&gt;");
    expect(r.html).toContain("&amp;");
    expect(r.html).toContain("X&lt;&gt;Y");
  });

  it("greets anonymously when no name", () => {
    const r = planActivationReceipt({
      fullName: null,
      planTitle: "Plan",
      amountInr: 100,
      utr: "U",
      referenceId: "R",
      grantedUntilISO: "2026-12-31T00:00:00Z",
      appUrl: "https://x.test",
    });
    expect(r.text.startsWith("Hi,")).toBe(true);
  });

  it("formats currency in INR", () => {
    const r = planActivationReceipt({
      fullName: "Asha",
      planTitle: "Annual",
      amountInr: 1234,
      utr: "U",
      referenceId: "R",
      grantedUntilISO: "2026-06-15T00:00:00Z",
      appUrl: "https://x.test",
    });
    expect(r.text).toContain("₹1,234");
  });
});

describe("esc", () => {
  it("escapes the five HTML metacharacters", () => {
    expect(esc("<a href=\"x\">&'b</a>")).toBe(
      "&lt;a href=&quot;x&quot;&gt;&amp;&#39;b&lt;/a&gt;",
    );
  });
});

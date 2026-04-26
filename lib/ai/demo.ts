// Stub responses used when Supabase or Gemini isn't configured.
// Lets the demo UI show streaming chat + citations without external services.

const CANNED: Record<string, { reply: string; citations: Array<{ documentTitle: string; page: number; sourceUrl: string }> }> = {
  "demo-polynomials": {
    reply:
      "A **polynomial in one variable** is an algebraic expression of the form\n" +
      "p(x) = aₙxⁿ + aₙ₋₁xⁿ⁻¹ + … + a₁x + a₀, where the coefficients aᵢ are real numbers and n is a non-negative integer [[1]].\n\n" +
      "Key terms:\n" +
      "• **Degree** — the highest power of x with a non-zero coefficient. e.g. 4x³ − 2x + 7 has degree 3 [[1]].\n" +
      "• **Monomial / binomial / trinomial** — polynomials with 1, 2, or 3 terms respectively [[2]].\n" +
      "• **Zero of a polynomial** — a value k such that p(k) = 0 [[2]].\n\n" +
      "Try it: find the degree of 5x⁴ − 3x² + x − 9. (Answer: 4.)\n\n" +
      "_Demo mode — this is a canned reply. Configure Gemini in `.env.local` for real AI tutoring._",
  citations: [
      { documentTitle: "NCERT Mathematics IX, Ch. 2 Polynomials", page: 28, sourceUrl: "https://ncert.nic.in/textbook/pdf/iemh102.pdf" },
      { documentTitle: "BSE Odisha Class IX Math (Odia)", page: 31, sourceUrl: "https://bseodisha.ac.in/CL-IX-Text-Book.html" },
    ],
  },
  "demo-coordinate": {
    reply:
      "The **Cartesian system** lets us locate any point in a plane using two perpendicular number lines [[1]]:\n" +
      "• The horizontal line is the **x-axis**, the vertical is the **y-axis**.\n" +
      "• Their meeting point is the **origin** (0, 0).\n" +
      "• A point is written as an ordered pair (x, y), where x is the horizontal distance and y the vertical.\n\n" +
      "The plane is divided into four **quadrants** [[2]]:\n" +
      "  I  (+, +)   II (−, +)\n" +
      "  III (−, −)   IV (+, −)\n\n" +
      "Quick check: in which quadrant is the point (−3, 5)? (Answer: II.)\n\n" +
      "_Demo mode — canned reply._",
    citations: [
      { documentTitle: "NCERT Mathematics IX, Ch. 3 Coordinate Geometry", page: 49, sourceUrl: "https://ncert.nic.in/textbook/pdf/iemh103.pdf" },
      { documentTitle: "BSE Odisha Class IX Math", page: 54, sourceUrl: "https://bseodisha.ac.in/CL-IX-Text-Book.html" },
    ],
  },
};

const FALLBACK = {
  reply:
    "Great question! In demo mode I can only show pre-written answers for the sample topics on the **Today** page.\n\n" +
    "To get real AI-tutored answers grounded in the BSE Odisha Class 9 textbooks, add your Supabase + Gemini keys to `.env.local` and restart the dev server.",
  citations: [
    { documentTitle: "BSE Odisha Syllabus Class IX (2025–26)", page: 1, sourceUrl: "https://bseodisha.ac.in/" },
  ],
};

export function streamDemoReply({
  topicId,
  question,
}: {
  topicId: string;
  question: string;
}): ReadableStream {
  const data = CANNED[topicId] ?? FALLBACK;
  const intro = question
    ? `You asked: _${question.slice(0, 120)}_\n\n`
    : "";
  const fullText = intro + data.reply;

  // Tokenise so the UI shows the streaming effect.
  const tokens = fullText.match(/.{1,8}/gs) ?? [fullText];
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      try {
        for (const text of tokens) {
          send({ type: "delta", text });
          await new Promise((r) => setTimeout(r, 25));
        }
        send({ type: "citations", citations: data.citations });
        send({ type: "done" });
      } finally {
        controller.close();
      }
    },
  });
}

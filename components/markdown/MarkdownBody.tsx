"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

/**
 * Unified markdown renderer for Sikhya Sathi.
 *
 * Supports:
 *  - GFM-ish Markdown (headings, lists, bold, links)
 *  - Inline math: `$...$`
 *  - Display math: `$$...$$`
 *  - Mermaid diagrams via ```mermaid fenced code blocks
 *
 * KaTeX CSS is imported once in `app/layout.tsx`.
 *
 * Kept as small as possible — heavy libs (KaTeX, Mermaid) are loaded here
 * and not anywhere else, so importing from server components is safe: this
 * file is a client component and will be lazily hydrated.
 */

type Props = {
  children: string;
  className?: string;
  /** When true, block elements (headings, lists, tables) are allowed.
   * When false, only inline elements render — useful for MCQ stems /
   * option labels where block flow would break layout. */
  inline?: boolean;
};

// Mermaid 11 is configured exactly once per session; subsequent component
// mounts must NOT re-run initialize because that re-registers diagram modules
// and churns memory. Stash the init promise globally.
let mermaidInitPromise: Promise<typeof import("mermaid").default> | null = null;
async function loadMermaid() {
  if (!mermaidInitPromise) {
    mermaidInitPromise = (async () => {
      const mermaid = (await import("mermaid")).default;
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: "default",
        fontFamily: "inherit",
        // Mermaid 11 default: on a syntax error it renders an error SVG (the
        // "💣 Syntax error in text" bomb art). That looks broken inline in a
        // lesson. With suppressErrorRendering=true Mermaid throws instead, so
        // our try/catch shows the friendly fallback below.
        suppressErrorRendering: true,
      });
      return mermaid;
    })();
  }
  return mermaidInitPromise;
}

// Some malformed payloads (e.g. extra prose before the diagram type) slip
// past mermaid.parse() in older bundles and render as the bomb SVG anyway.
// As a paranoia belt, sniff the rendered SVG for known error markers and
// treat that as a render failure.
function svgLooksLikeError(svg: string): boolean {
  if (!svg) return false;
  return (
    svg.includes("aria-roledescription=\"error\"") ||
    /Syntax\s+error\s+in\s+text/i.test(svg) ||
    svg.includes("error-icon")
  );
}

function MermaidBlock({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mermaid = await loadMermaid();
        // parse() is fast, throws on bad syntax. Cheaper than render and
        // produces a clean error stack instead of half-rendered SVG.
        await mermaid.parse(code.trim());
        const id = `mmd-${Math.random().toString(36).slice(2, 9)}`;
        const { svg } = await mermaid.render(id, code.trim());
        if (cancelled) return;
        if (svgLooksLikeError(svg)) {
          setFailed(true);
          return;
        }
        if (ref.current) ref.current.innerHTML = svg;
      } catch {
        // Any parse / render failure → fall through to the friendly UI below.
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (failed) {
    return (
      <details className="my-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
        <summary className="cursor-pointer select-none">
          Diagram couldn&apos;t be rendered — show source
        </summary>
        <pre className="mt-2 overflow-x-auto rounded bg-white p-2 text-[11px] text-slate-700">
          {code}
        </pre>
      </details>
    );
  }
  return <div ref={ref} className="my-3 overflow-x-auto" aria-label="diagram" />;
}

export default function MarkdownBody({ children, className, inline = false }: Props) {
  const content = (
    <ReactMarkdown
      remarkPlugins={[remarkMath]}
      rehypePlugins={[[rehypeKatex, { strict: "ignore", output: "htmlAndMathml" }]]}
      components={{
        code({ className: cc, children, ...rest }) {
          const match = /language-(\w+)/.exec(cc ?? "");
          const lang = match?.[1];
          if (lang === "mermaid") {
            return <MermaidBlock code={String(children ?? "")} />;
          }
          return (
            <code className={cc} {...rest}>
              {children}
            </code>
          );
        },
      }}
    >
      {children}
    </ReactMarkdown>
  );

  if (inline) {
    return <span className={className}>{content}</span>;
  }
  return <div className={className}>{content}</div>;
}

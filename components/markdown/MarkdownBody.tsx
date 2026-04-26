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

function MermaidBlock({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "default",
          fontFamily: "inherit",
        });
        const id = `mmd-${Math.random().toString(36).slice(2, 9)}`;
        const { svg } = await mermaid.render(id, code.trim());
        if (!cancelled && ref.current) ref.current.innerHTML = svg;
      } catch (e) {
        if (!cancelled) setErr((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (err) {
    return (
      <pre className="overflow-x-auto rounded-lg border border-rose-200 bg-rose-50 p-2 text-xs text-rose-900">
        Mermaid render error: {err}
        {"\n"}
        {code}
      </pre>
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

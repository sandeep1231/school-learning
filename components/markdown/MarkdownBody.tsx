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
        // suppressErrorRendering is intentionally OFF (the default). With it
        // ON, Mermaid throws on minor parse issues that it could otherwise
        // render with a partial diagram or a graceful inline error node —
        // and every LLM-generated block in lessons would fall through to
        // our "couldn't render" fallback. Letting Mermaid render normally
        // and detecting the bomb-SVG via `svgLooksLikeError` post-render is
        // the right balance: real diagrams display, malformed ones surface
        // with a readable source instead of mermaid's bomb art.
      });
      return mermaid;
    })();
  }
  return mermaidInitPromise;
}

// Lightly normalise common LLM-generated mermaid quirks so more blocks
// actually render. We DO NOT try to fix every kind of malformed input —
// these rewrites are conservative, only target patterns we've observed,
// and never silently change semantics:
//
//   - `$tex$` inside node labels  → strip the $-delimited TeX (mermaid
//     can't render KaTeX inside labels; the lesson body has the math
//     spelled out elsewhere).
//   - `A --> B: label`            → `A -- "label" --> B`  (colon-edge-
//     label is markdown-style and not valid mermaid; rewrite to the
//     supported edge-label form).
function preprocessMermaid(code: string): string {
  return code
    .replace(/\$([^$]+)\$/g, "$1")
    .replace(
      /([A-Za-z_][\w]*)\s*-->\s*([A-Za-z_][\w]*)\s*:\s*([^\n]+)/g,
      (_m, a, b, label) =>
        `${a} -- "${String(label).trim().replace(/"/g, "'")}" --> ${b}`,
    );
}

// Some malformed payloads slip through Mermaid's parser and render as a
// bomb SVG ("💣 Syntax error in text"). We sniff the rendered SVG for
// known error markers and treat that as a render failure so the friendly
// fallback below shows instead of mermaid's bomb art.
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
        const id = `mmd-${Math.random().toString(36).slice(2, 9)}`;
        const cleaned = preprocessMermaid(code.trim());
        const { svg } = await mermaid.render(id, cleaned);
        if (cancelled) return;
        if (svgLooksLikeError(svg)) {
          setFailed(true);
          return;
        }
        if (ref.current) ref.current.innerHTML = svg;
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (failed) {
    // Auto-show the source so students can at least read the diagram
    // description in text form. Collapsed details was technically more
    // compact but most users never expanded it, so the diagram intent
    // was effectively lost.
    return (
      <figure className="my-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <figcaption className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Diagram (text view)
        </figcaption>
        <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded bg-white p-2 text-[11px] leading-relaxed text-slate-700">
          {code}
        </pre>
      </figure>
    );
  }
  return <div ref={ref} className="my-3 overflow-x-auto" aria-label="diagram" />;
}

// LLM-generated lesson bodies sometimes embed image markdown with
// placeholder URLs (`example.com/foo.png`, `placeholder/...`) that 404 in
// the browser. Rather than show a broken-image icon inline, render a
// muted "image not available" caption that uses the alt text — students
// still see what the image was supposed to depict.
const PLACEHOLDER_HOSTS = ["example.com", "example.org", "placeholder", "placehold.it"];
function imageHasPlaceholderUrl(src: string | undefined): boolean {
  if (!src) return true;
  try {
    const u = new URL(src, "http://localhost");
    return PLACEHOLDER_HOSTS.some((h) => u.hostname.includes(h));
  } catch {
    return false;
  }
}

function SafeImage({
  src,
  alt,
  ...rest
}: React.ImgHTMLAttributes<HTMLImageElement>) {
  if (imageHasPlaceholderUrl(src as string | undefined)) {
    return (
      <span className="my-2 inline-flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600">
        <span aria-hidden="true">🖼</span>
        <span>{alt || "Image not available"}</span>
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt ?? ""} loading="lazy" {...rest} />;
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
        // Replace LLM-hallucinated image URLs (example.com etc.) with a
        // captioned "image not available" placeholder so students see the
        // alt text instead of a broken-image icon.
        img({ src, alt, ...rest }) {
          return <SafeImage src={src} alt={alt} {...rest} />;
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

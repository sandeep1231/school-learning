"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Spinner, TypingDots } from "@/components/ui/Spinner";

type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Array<{ documentTitle: string; page?: number | null; sourceUrl?: string | null }>;
};

export default function ChatBox({
  topicId,
  topicTitle,
  endpoint = "/api/chat",
  payloadKey = "topicId",
  payloadValue,
  extraPayload,
  suggestions = [],
}: {
  topicId: string;
  topicTitle: string;
  endpoint?: string;
  payloadKey?: string;
  payloadValue?: string;
  /** Extra top-level fields merged into each request body (e.g. chapterHint). */
  extraPayload?: Record<string, unknown>;
  /** Quick-start prompts displayed when the chat is empty. */
  suggestions?: string[];
}) {
  const t = useTranslations("chat");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || isStreaming) return;
    const userMsg: Msg = { id: crypto.randomUUID(), role: "user", content: text };
    const assistantId = crypto.randomUUID();
    setMessages((m) => [...m, userMsg, { id: assistantId, role: "assistant", content: "" }]);
    setInput("");
    setIsStreaming(true);

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          [payloadKey]: payloadValue ?? topicId,
          ...(extraPayload ?? {}),
          messages: [...messages, userMsg].map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      if (!res.ok || !res.body) throw new Error(`Chat failed: ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let citations: Msg["citations"] = [];

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload) continue;
          try {
            const evt = JSON.parse(payload);
            if (evt.type === "delta") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: m.content + evt.text } : m,
                ),
              );
            } else if (evt.type === "citations") {
              citations = evt.citations;
            } else if (evt.type === "done") {
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, citations } : m)),
              );
            }
          } catch {
            /* ignore */
          }
        }
      }
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: "Sorry, something went wrong. Please try again." }
            : m,
        ),
      );
    } finally {
      setIsStreaming(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-slate-200 bg-white">
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">{t("disclaimer")}</p>
            {suggestions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setInput(s);
                    }}
                    className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700 hover:border-brand hover:bg-brand-50 hover:text-brand"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {messages.map((m, idx) => {
          const isLastAssistant =
            m.role === "assistant" && idx === messages.length - 1;
          const showTyping = isLastAssistant && isStreaming && !m.content;
          return (
          <div
            key={m.id}
            className={
              m.role === "user"
                ? "ml-auto max-w-[80%] rounded-2xl rounded-br-sm bg-brand px-4 py-2 text-white"
                : "mr-auto max-w-[85%] rounded-2xl rounded-bl-sm bg-slate-100 px-4 py-2 text-slate-900"
            }
          >
            {showTyping ? (
              <TypingDots />
            ) : (
              <p className="whitespace-pre-wrap text-sm">{m.content || "…"}</p>
            )}
            {m.citations && m.citations.length > 0 && (
              <ul className="mt-2 space-y-1 border-t border-slate-300/40 pt-2 text-xs text-slate-600">
                {m.citations.map((c, i) => (
                  <li key={i}>
                    [{i + 1}]{" "}
                    {c.sourceUrl ? (
                      <a
                        href={c.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="underline"
                      >
                        {c.documentTitle}
                        {c.page ? ` · p.${c.page}` : ""}
                      </a>
                    ) : (
                      <>
                        {c.documentTitle}
                        {c.page ? ` · p.${c.page}` : ""}
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          );
        })}
      </div>

      <form
        className="flex gap-2 border-t border-slate-200 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("placeholder")}
          aria-label={`Ask about ${topicTitle}`}
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
          disabled={isStreaming}
        />
        <button
          type="submit"
          disabled={isStreaming || !input.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {isStreaming && <Spinner size="sm" className="[&>span:first-child]:border-white/30 [&>span:first-child]:border-t-white" />}
          {t("send")}
        </button>
      </form>
    </div>
  );
}

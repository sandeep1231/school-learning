"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Spinner } from "@/components/ui/Spinner";
import MarkdownBody from "@/components/markdown/MarkdownBody";

type Citation = { n: number; title: string; page: number | null };
type SuccessResponse = {
  ok: true;
  extractedQuestion: string;
  language: "en" | "or" | "hi";
  subjectHint: string | null;
  answer: string;
  citations: Citation[];
};
type FailureResponse = {
  ok: false;
  error: string;
  message?: string;
};
type Response = SuccessResponse | FailureResponse;

const MAX_BYTES = 5 * 1024 * 1024;

export default function SnapClient({ contextLabel }: { contextLabel: string }) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Response | null>(null);
  const [error, setError] = useState<string | null>(null);

  function pickFile(f: File | null) {
    setError(null);
    setResult(null);
    if (!f) {
      setFile(null);
      setPreviewUrl(null);
      return;
    }
    if (f.size > MAX_BYTES) {
      setError(
        `Image is ${(f.size / 1024 / 1024).toFixed(1)} MB — max 5 MB. Try a smaller photo.`,
      );
      return;
    }
    setFile(f);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(f));
  }

  async function submit() {
    if (!file) return;
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const r = await fetch("/api/chat/photo", { method: "POST", body: fd });
      const j = (await r.json()) as Response;
      if (r.status === 429) {
        setError("Too many photo questions in the last hour. Try again soon.");
        return;
      }
      if (!r.ok && (j as FailureResponse).error) {
        setError(
          (j as FailureResponse).message ??
            `Couldn't process that image (${(j as FailureResponse).error}).`,
        );
        return;
      }
      setResult(j);
      if (j.ok === false) {
        setError(j.message ?? "No question found in that photo.");
      }
    } catch (e) {
      setError(`Network error: ${(e as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setResult(null);
    setError(null);
    setFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <main className="container mx-auto max-w-2xl px-4 py-6">
      <header className="mb-4">
        <h1 className="text-2xl font-bold text-brand-900">
          ଫଟୋ ସହ ପ୍ରଶ୍ନ କର · Snap a question
        </h1>
        <p className="text-sm text-slate-600">
          Take a photo of any homework question — Sikhya Sathi will explain
          it in your language with citations from the textbook.
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Asking as <strong>{contextLabel}</strong>
        </p>
      </header>

      {!result?.ok && (
        <section className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <label
            htmlFor="snap-image"
            className="mb-2 block text-sm font-semibold text-slate-800"
          >
            Choose or take a photo
          </label>
          <input
            id="snap-image"
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            disabled={submitting}
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-brand file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-brand-700"
          />
          <p className="mt-1 text-xs text-slate-500">
            JPEG, PNG, or WebP. Up to 5 MB. Mobile cameras open the rear lens.
          </p>

          {previewUrl && (
            <div className="mt-3">
              <img
                src={previewUrl}
                alt="Selected"
                className="max-h-72 rounded-lg border border-slate-200 object-contain"
              />
            </div>
          )}

          {error && (
            <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
              {error}
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={submit}
              disabled={!file || submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-brand-700 disabled:opacity-50"
            >
              {submitting && <Spinner size="sm" />}
              {submitting ? "Reading the photo…" : "ସମାଧାନ କର · Solve this"}
            </button>
            {file && !submitting && (
              <button
                type="button"
                onClick={reset}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Choose a different photo
              </button>
            )}
          </div>
        </section>
      )}

      {result?.ok && (
        <section className="space-y-4">
          <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-brand">
              Question detected
            </h2>
            <p className="whitespace-pre-wrap text-sm text-slate-700">
              {result.extractedQuestion}
            </p>
          </article>

          <article className="rounded-xl border border-brand bg-brand-50/30 p-5 shadow-sm">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand">
              Tutor's answer
            </h2>
            <div className="prose prose-slate max-w-none prose-p:leading-relaxed prose-p:text-slate-900">
              <MarkdownBody>{result.answer}</MarkdownBody>
            </div>
          </article>

          {result.citations.length > 0 && (
            <article className="rounded-lg border-l-4 border-brand bg-brand-50 p-4 text-sm">
              <h3 className="mb-1 font-semibold text-brand-900">
                ସୂତ୍ର · Sources
              </h3>
              <ul className="list-disc space-y-1 pl-5 text-slate-700">
                {result.citations.map((c) => (
                  <li key={c.n}>
                    [[{c.n}]] {c.title}
                    {c.page != null ? ` · p.${c.page}` : ""}
                  </li>
                ))}
              </ul>
            </article>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={reset}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow hover:bg-brand-700"
            >
              Ask another question
            </button>
            <Link
              href="/today"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              ← Back to today
            </Link>
          </div>
        </section>
      )}
    </main>
  );
}

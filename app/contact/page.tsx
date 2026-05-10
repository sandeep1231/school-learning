import ContactForm from "./ContactForm";

export const dynamic = "force-dynamic";

export default function ContactPage() {
  return (
    <main className="container mx-auto max-w-xl px-4 py-10">
      <h1 className="text-3xl font-bold text-brand-900">Contact support</h1>
      <p className="mt-2 text-sm text-slate-600">
        Stuck signing in? Tutor giving wrong answers? Anything else? Drop us a
        note. Your message goes straight to our inbox and we usually reply
        within a working day.
      </p>
      <p className="mt-2 text-xs text-slate-500">
        Or email us directly at{" "}
        <a
          href="mailto:support@sikhyasathi.in"
          className="text-brand underline"
        >
          support@sikhyasathi.in
        </a>
        .
      </p>
      <div className="mt-6">
        <ContactForm />
      </div>
    </main>
  );
}

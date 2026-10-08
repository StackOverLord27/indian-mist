"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { CheckCircle2, Loader2 } from "lucide-react";
import { CONTACT_TOPICS } from "@/lib/contact-topics";

const fieldClass =
  "w-full rounded-md border border-olive/25 bg-cornsilk px-4 py-3 font-montserrat text-sm text-forest outline-none transition placeholder:text-forest/60 focus:border-olive focus:ring-2 focus:ring-olive/20 disabled:opacity-60";
const labelClass =
  "mb-2 block font-montserrat text-xs font-medium uppercase tracking-wider text-forest/80";

export function ContactForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    setIsLoading(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.message || "Could not send your message.");
        return;
      }
      form.reset();
      setIsSent(true);
      toast.success("Message sent. We'll be in touch soon.");
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isSent) {
    return (
      <div className="flex min-h-96 flex-col items-center justify-center text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-warm-mist text-olive-leaf">
          <CheckCircle2 className="size-7" aria-hidden="true" />
        </div>
        <h3 className="mt-6 font-merriweather text-2xl font-light text-forest">
          Thank you, message received.
        </h3>
        <p className="mt-3 max-w-sm font-montserrat text-sm font-light leading-6 text-muted-text">
          We&rsquo;ll get back to you at the email you provided as soon as we can.
        </p>
        <button
          type="button"
          onClick={() => setIsSent(false)}
          className="mt-8 inline-flex h-11 items-center justify-center rounded-full border border-olive-leaf/45 px-6 font-montserrat text-xs font-medium uppercase tracking-wide text-olive-leaf transition-colors hover:bg-olive-leaf hover:text-cornsilk"
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="contact-name" className={labelClass}>Full name</label>
          <input id="contact-name" name="name" type="text" required minLength={2} maxLength={80} autoComplete="name" disabled={isLoading} placeholder="Your name" className={fieldClass} />
        </div>
        <div>
          <label htmlFor="contact-email" className={labelClass}>Email</label>
          <input id="contact-email" name="email" type="email" required maxLength={120} autoComplete="email" disabled={isLoading} placeholder="you@example.com" className={fieldClass} />
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="contact-phone" className={labelClass}>
            Phone <span className="normal-case tracking-normal text-forest/60">(optional)</span>
          </label>
          <input id="contact-phone" name="phone" type="tel" maxLength={20} autoComplete="tel" disabled={isLoading} placeholder="+91" className={fieldClass} />
        </div>
        <div>
          <label htmlFor="contact-topic" className={labelClass}>Topic</label>
          <select id="contact-topic" name="topic" required disabled={isLoading} defaultValue={CONTACT_TOPICS[0]} className={fieldClass}>
            {CONTACT_TOPICS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="contact-message" className={labelClass}>Message</label>
        <textarea id="contact-message" name="message" required minLength={10} maxLength={2000} rows={6} disabled={isLoading} placeholder="Tell us how we can help. Include your order number if it's about an order." className={`${fieldClass} resize-y`} />
      </div>

      <div className="hidden" aria-hidden="true">
        <label htmlFor="contact-website">Website</label>
        <input id="contact-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="inline-flex h-12 w-full items-center justify-center rounded-full bg-olive-leaf px-8 font-montserrat text-xs font-semibold uppercase tracking-widest text-cornsilk transition-colors hover:bg-black-forest disabled:opacity-70 sm:w-auto"
      >
        {isLoading ? <Loader2 className="size-4 animate-spin" /> : "Send message"}
      </button>
    </form>
  );
}

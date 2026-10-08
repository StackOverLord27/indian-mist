"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Loader2 } from "lucide-react";

export function NewsletterBar() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsLoading(true);
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.message || "Failed to subscribe. Please try again.");
      } else {
        toast.success(data.message || "Subscribed successfully!");
        setEmail("");
      }
    } catch (error) {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="bg-sunlit-clay px-6 py-13 md:px-12">
      <div className="mx-auto max-w-screen-2xl flex flex-col justify-between gap-8 lg:flex-row lg:items-center">
        <div className="flex-1">
          <h2 className="font-serif text-2xl font-normal text-black-forest">
            Notes from the forest
          </h2>
          <p className="mt-2 max-w-xl font-sans text-xs font-light leading-5 text-black-forest/85">
            New gear, seasonal drops, field notes, and a little proof that
            slower shopping can still feel exciting.
          </p>
        </div>

        <form 
          onSubmit={handleSubmit}
          className="flex w-full max-w-md flex-col gap-3 sm:flex-row sm:gap-0 sm:items-center sm:rounded-full sm:bg-cornsilk sm:p-1.5 sm:shadow-sm sm:ring-1 sm:ring-black-forest/10 sm:focus-within:ring-2 sm:focus-within:ring-olive-leaf sm:transition-all"
        >
          <label className="sr-only" htmlFor="newsletter-email">
            Email address
          </label>
          <input
            id="newsletter-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading}
            placeholder="Email address"
            className="flex-1 rounded-full bg-cornsilk px-5 py-3.5 font-sans text-sm text-black-forest outline-none placeholder:text-black-forest/65 ring-1 ring-black-forest/10 sm:rounded-none sm:bg-transparent sm:py-2 sm:ring-0 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading}
            className="flex items-center justify-center rounded-full bg-black-forest px-8 py-3.5 sm:py-2.5 font-sans text-xs font-semibold uppercase tracking-widest text-cornsilk transition-colors hover:bg-olive-leaf disabled:bg-black-forest/70"
          >
            {isLoading ? <Loader2 className="size-4 animate-spin" /> : "Subscribe"}
          </button>
        </form>
      </div>
    </section>
  );
}

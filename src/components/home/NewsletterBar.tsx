export function NewsletterBar() {
  return (
    <section className="bg-sunlit-clay px-6 py-13 md:px-12">
      <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-center">
        <div>
          <h2 className="font-serif text-2xl font-normal text-black-forest">
            Notes from the forest
          </h2>
          <p className="mt-2 max-w-xl font-sans text-xs font-light leading-5 text-black-forest/75">
            New gear, seasonal drops, field notes, and a little proof that
            slower shopping can still feel exciting.
          </p>
        </div>

        <form className="flex w-full max-w-md" action="#">
          <label className="sr-only" htmlFor="newsletter-email">
            Email address
          </label>
          <input
            id="newsletter-email"
            type="email"
            placeholder="Email address"
            className="min-w-0 flex-1 rounded-l-full rounded-r-none border border-black-forest/20 bg-warm-mist/85 px-5 font-sans text-sm text-black-forest outline-none placeholder:text-black-forest/55"
          />
          <button
            type="submit"
            className="rounded-l-none rounded-r-full bg-black-forest px-6 font-sans text-xs font-medium uppercase tracking-wide text-cornsilk transition-opacity hover:opacity-90"
          >
            Subscribe
          </button>
        </form>
      </div>
    </section>
  );
}

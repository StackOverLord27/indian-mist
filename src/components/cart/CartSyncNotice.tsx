import type { useCartSync } from "@/lib/use-cart-sync";

/** Tells the shopper when the check of their bag against the shop did not complete, with a Retry. */
export function CartSyncNotice({ sync }: { sync: ReturnType<typeof useCartSync> }) {
  if (sync.state.status === "checking") {
    return (
      <p role="status" className="mb-4 animate-pulse font-montserrat text-xs text-muted-text">
        Checking your bag…
      </p>
    );
  }
  if (sync.state.status !== "failed") return null;
  return (
    <div role="alert" data-testid="cart-sync-failed" className="mb-4 flex flex-wrap items-center gap-3 border-l-2 border-sunlit-clay bg-sunlit-clay/10 p-3">
      <p className="font-montserrat text-xs text-black-forest">
        We couldn&apos;t check your bag against the shop just now, so prices and stock shown may be out of date. {sync.failureText}
      </p>
      <button
        type="button"
        onClick={sync.retry}
        className="border border-olive-leaf px-3 py-1 font-montserrat text-xs font-semibold uppercase tracking-widest text-olive-leaf hover:bg-olive-leaf hover:text-cornsilk"
      >
        Retry
      </button>
    </div>
  );
}

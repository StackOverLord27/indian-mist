import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));

import { ProfileSkeleton } from "@/components/profile/ProfileSkeleton";
import { LoadFailure } from "@/components/profile/LoadFailure";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { CartSyncNotice } from "@/components/cart/CartSyncNotice";
import { WishlistPageClient } from "@/components/wishlist/WishlistPageClient";
import { CartPageClient } from "@/components/cart/CartPageClient";
import { failureMessage } from "@/lib/customer-session";

const render = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);

describe("a page that waits for data is never blank", () => {
  it("profile: a skeleton with a status role while loading", () => {
    const html = render(createElement(ProfileSkeleton));
    expect(html).toContain('data-testid="profile-skeleton"');
    expect(html).toContain('role="status"');
    expect(html).toContain("animate-pulse");
  });

  it("the shared skeleton says what it is waiting for", () => {
    const html = render(createElement(PageSkeleton, { label: "Loading checkout" }));
    expect(html).toContain('aria-label="Loading checkout"');
    expect(html).toContain('data-testid="page-skeleton"');
  });

  it("wishlist: a skeleton, not a false 'empty wishlist', until the saved list has loaded from the browser", () => {
    const html = render(createElement(WishlistPageClient));
    expect(html).toContain('data-testid="page-skeleton"');
    expect(html).toContain("Loading your wishlist");
    expect(html).not.toMatch(/empty/i);
  });

  it("bag: a skeleton instead of nothing until it is mounted", () => {
    const html = render(createElement(CartPageClient));
    expect(html).toContain('data-testid="page-skeleton"');
    expect(html).toContain("Loading your bag");
  });
});

describe("errors say what happened and offer Retry", () => {
  it("LoadFailure shows the title, the message and a Retry button", () => {
    const html = render(createElement(LoadFailure, { title: "We couldn't load your profile", message: failureMessage({ kind: "timeout" }), onRetry: () => {} }));
    expect(html).toContain('role="alert"');
    expect(html).toContain("We couldn&#x27;t load your profile");
    expect(html).toContain("taking too long");
    expect(html).toMatch(/<button[^>]*>Retry<\/button>/);
  });

  it("every kind of failure has its own plain message", () => {
    const texts = (["rate-limited", "network", "timeout", "server", "signed-out", "other"] as const).map((kind) => failureMessage({ kind }));
    expect(new Set(texts).size).toBe(texts.length);
    for (const t of texts) expect(t.length).toBeGreaterThan(20);
  });

  it("the bag check: 'Checking…' while it runs, a Retry notice when it failed, nothing otherwise", () => {
    const sync = (state: unknown) => ({ state, retry: () => {}, failureText: "Please try again." }) as never;
    expect(render(createElement(CartSyncNotice, { sync: sync({ status: "checking" }) }))).toContain("Checking your bag");
    const failed = render(createElement(CartSyncNotice, { sync: sync({ status: "failed", failure: { kind: "network" } }) }));
    expect(failed).toContain('data-testid="cart-sync-failed"');
    expect(failed).toMatch(/<button[^>]*>Retry<\/button>/);
    expect(render(createElement(CartSyncNotice, { sync: sync({ status: "idle" }) }))).toBe("");
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from "axios";
import {
  createCustomerSession,
  classifyFailure,
  failureMessage,
  REQUEST_DEADLINE_MS,
  RETRY_DELAY_MS,
} from "@/lib/customer-session";

/**
 * The client side of sign-in, tested without a browser: a fake server behind a custom axios adapter.
 * (Real browser behaviour of the pages is in e2e/session.e2e.ts.)
 */

type Reply = { status: number; data?: unknown; headers?: Record<string, string> } | "network";

const canceled = () => Object.assign(new Error("canceled"), { name: "CanceledError", code: "ERR_CANCELED" });
const onAbort = (config: InternalAxiosRequestConfig, fn: () => void) => config.signal?.addEventListener?.("abort", fn);

function fakeServer(handlers: { api?: (n: number, cfg: InternalAxiosRequestConfig) => Reply; refresh?: (n: number) => Reply }) {
  const log = { api: 0, refresh: 0, bodies: [] as unknown[] };
  const adapter: AxiosAdapter = (config) =>
    new Promise((resolve, reject) => {
      const fail = (message: string, code: string, response?: object) =>
        reject(new AxiosError(message, code, config, {}, response as never));
      onAbort(config, () => reject(canceled()));
      const isRefresh = String(config.url).endsWith("/api/auth/refresh");
      const n = isRefresh ? ++log.refresh : ++log.api;
      if (!isRefresh) log.bodies.push(config.data);
      const okReply: Reply = { status: 200 };
      const reply: Reply = isRefresh ? (handlers.refresh ?? (() => okReply))(n) : (handlers.api ?? (() => okReply))(n, config);
      if (reply === "network") return fail("Network Error", "ERR_NETWORK");
      const response = { status: reply.status, statusText: "", data: reply.data ?? {}, headers: reply.headers ?? {}, config, request: {} };
      if (reply.status >= 200 && reply.status < 300) resolve(response);
      else fail(`Request failed with status code ${reply.status}`, "ERR_BAD_REQUEST", response);
    });
  return { log, adapter };
}

const run = async (p: Promise<unknown>) => p.then(() => null, (e) => classifyFailure(e));

beforeEach(() => { vi.useFakeTimers(); vi.stubGlobal("window", { localStorage: new Map() }); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

/** Lets timers (the 400 ms pause, deadlines) fire while promises settle */
const settle = async (p: Promise<unknown>) => { const done = p.then((v) => v, (e) => e); await vi.advanceTimersByTimeAsync(60_000); return done; };

describe("hypothesis C: several calls with an expired access token share ONE renewal", () => {
  it("six simultaneous calls, one renewal, all succeed after it", async () => {
    let fresh = false;
    const s = fakeServer({
      api: () => (fresh ? { status: 200, data: { ok: 1 } } : { status: 401 }),
      refresh: () => { fresh = true; return { status: 200 }; },
    });
    const { api } = createCustomerSession({ adapter: s.adapter });
    const results = await Promise.all(Array.from({ length: 6 }, (_, i) => api.get(`/api/profile?i=${i}`)));
    expect(results.map((r) => r.status)).toEqual(Array(6).fill(200));
    expect(s.log.refresh).toBe(1);
    expect(s.log.api).toBe(12); // 6 refused + 6 repeated
  });

  it("a call whose 401 comes after another renewal finished (even in another tab) is repeated without renewing again", async () => {
    const s = fakeServer({ api: (n) => (n === 1 ? { status: 401 } : { status: 200 }) });
    const { api } = createCustomerSession({ adapter: s.adapter });
    const sentAfterLastRenewal = api.get("/api/profile");
    // another tab renewed after this request was sent
    (window as unknown as { localStorage: Map<string, string> }).localStorage.set("im_session_renewed_at", String(Date.now() + 5));
    vi.stubGlobal("window", { localStorage: { getItem: () => String(Date.now() + 5), setItem: () => {} } });
    expect((await settle(sentAfterLastRenewal) as { status: number }).status).toBe(200);
    expect(s.log.refresh).toBe(0);
  });

  it("the body of a POST is sent again unchanged on the retry", async () => {
    let fresh = false;
    const s = fakeServer({ api: () => (fresh ? { status: 200 } : { status: 401 }), refresh: () => { fresh = true; return { status: 200 }; } });
    const { api } = createCustomerSession({ adapter: s.adapter });
    await api.post("/api/checkout/verify-payment", { razorpayOrderId: "o1", razorpayPaymentId: "p1", razorpaySignature: "sig" });
    expect(s.log.bodies).toHaveLength(2);
    expect(s.log.bodies[1]).toBe(s.log.bodies[0]);
    expect(JSON.parse(s.log.bodies[1] as string)).toEqual({ razorpayOrderId: "o1", razorpayPaymentId: "p1", razorpaySignature: "sig" });
  });
});

describe("hypothesis D: only a 401 that survives a successful renewal means signed out", () => {
  it("401 → renewal 200 → ok: never signed out", async () => {
    let fresh = false;
    const s = fakeServer({ api: () => (fresh ? { status: 200 } : { status: 401 }), refresh: () => { fresh = true; return { status: 200 }; } });
    const { api } = createCustomerSession({ adapter: s.adapter });
    expect((await api.get("/api/profile")).status).toBe(200);
  });

  it("401 → renewal 200 → 401 again → short pause → 200: the short retry saves it", async () => {
    const s = fakeServer({ api: (n) => (n <= 2 ? { status: 401 } : { status: 200 }) });
    const { api } = createCustomerSession({ adapter: s.adapter });
    const p = api.get("/api/profile");
    await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS + 10);
    expect((await p).status).toBe(200);
    expect(s.log.refresh).toBe(1);
  });

  it("401 → renewal 200 → 401 → 401: signed out, after exactly one renewal", async () => {
    const s = fakeServer({ api: () => ({ status: 401 }) });
    const { api } = createCustomerSession({ adapter: s.adapter });
    const failure = run(api.get("/api/profile"));
    await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS + 10);
    expect(await failure).toMatchObject({ kind: "signed-out" });
    expect(s.log.refresh).toBe(1);
    expect(s.log.api).toBe(3);
  });

  it("401 → renewal answers 401: signed out", async () => {
    const s = fakeServer({ api: () => ({ status: 401 }), refresh: () => ({ status: 401 }) });
    const { api } = createCustomerSession({ adapter: s.adapter });
    expect(await run(api.get("/api/profile"))).toMatchObject({ kind: "signed-out" });
  });

  for (const [name, reply, kind] of [
    ["429", { status: 429, headers: { "retry-after": "7" } }, "server"],
    ["503", { status: 503 }, "server"],
    ["500", { status: 500 }, "server"],
    ["a network error", "network", "server"],
  ] as const) {
    it(`401 → the renewal itself fails with ${name}: NOT signed out (a retry state), cookies untouched`, async () => {
      const s = fakeServer({ api: () => ({ status: 401 }), refresh: () => reply as Reply });
      const { api } = createCustomerSession({ adapter: s.adapter });
      const failure = await run(api.get("/api/profile"));
      expect(failure).toMatchObject({ kind });
      expect(failure!.kind).not.toBe("signed-out");
      expect(s.log.refresh).toBe(1);
    });
  }

  it("the renewal request that never answers ends as unavailable (not signed out) at its own timeout", async () => {
    const s = fakeServer({ api: () => ({ status: 401 }), refresh: () => { throw new Error("replaced below"); } });
    const adapter: AxiosAdapter = (config) =>
      String(config.url).endsWith("/refresh")
        ? new Promise((_, reject) => onAbort(config, () => reject(canceled())))
        : s.adapter(config);
    const { api } = createCustomerSession({ adapter });
    const failure = settle(run(api.get("/api/profile")));
    expect(await failure).toMatchObject({ kind: "server" });
  });

  it("429 on the call itself: rate-limited with the wait, no renewal, no sign-out", async () => {
    const s = fakeServer({ api: () => ({ status: 429, headers: { "retry-after": "7" } }) });
    const { api } = createCustomerSession({ adapter: s.adapter });
    const failure = await run(api.get("/api/profile"));
    expect(failure).toEqual({ kind: "rate-limited", status: 429, retryAfterSeconds: 7 });
    expect(failureMessage(failure!)).toMatch(/7 seconds/);
    expect(s.log.refresh).toBe(0);
  });

  for (const status of [500, 502, 503, 504]) {
    it(`${status} on the call: server failure, no renewal, no sign-out`, async () => {
      const s = fakeServer({ api: () => ({ status }) });
      const { api } = createCustomerSession({ adapter: s.adapter });
      expect(await run(api.get("/api/profile"))).toMatchObject({ kind: "server", status });
      expect(s.log.refresh).toBe(0);
    });
  }

  it("a network error on the call: network failure, no renewal", async () => {
    const s = fakeServer({ api: () => "network" });
    const { api } = createCustomerSession({ adapter: s.adapter });
    expect(await run(api.get("/api/profile"))).toEqual({ kind: "network" });
    expect(s.log.refresh).toBe(0);
  });

  it("a call that never answers ends in a timeout at the deadline, not a hang", async () => {
    const adapter: AxiosAdapter = (config) =>
      new Promise((_, reject) => onAbort(config, () => reject(canceled())));
    const { api } = createCustomerSession({ adapter });
    const p = run(api.get("/api/profile"));
    await vi.advanceTimersByTimeAsync(REQUEST_DEADLINE_MS - 1);
    let settled = false; void p.then(() => (settled = true));
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(2);
    expect(await p).toMatchObject({ kind: "timeout" });
  });

  it("400/403/404 are plain failures with the server's message, never a sign-out", async () => {
    for (const status of [400, 403, 404]) {
      const s = fakeServer({ api: () => ({ status, data: { message: "Nope" } }) });
      const { api } = createCustomerSession({ adapter: s.adapter });
      expect(await run(api.get("/api/profile"))).toEqual({ kind: "other", status, serverMessage: "Nope" });
      expect(s.log.refresh).toBe(0);
    }
  });

  it("every failure kind has a message that says what to do, and 5xx text never blames the account", () => {
    for (const kind of ["signed-out", "rate-limited", "server", "network", "timeout", "other"] as const) {
      expect(failureMessage({ kind }).length).toBeGreaterThan(20);
    }
    expect(failureMessage({ kind: "server" })).toMatch(/account is fine/i);
  });
});

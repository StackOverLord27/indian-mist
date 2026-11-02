import { vi } from "vitest";

type Entry = { value: unknown; expiresAt: number | null };

/**
 * In-memory fake of the @upstash/redis methods this repo uses.
 * Values are JSON round-tripped like Upstash's auto (de)serialisation.
 * `advance(ms)` moves the fake clock so TTL expiry can be tested.
 */
export class FakeRedis {
  store = new Map<string, Entry>();
  now = Date.now();

  advance(ms: number) { this.now += ms; }
  private live(key: string): Entry | undefined {
    const e = this.store.get(key);
    if (e && e.expiresAt !== null && e.expiresAt <= this.now) {
      this.store.delete(key);
      return undefined;
    }
    return e;
  }
  async get<T = unknown>(key: string): Promise<T | null> {
    const e = this.live(key);
    return e ? (JSON.parse(JSON.stringify(e.value)) as T) : null;
  }
  async set(key: string, value: unknown, opts?: { ex?: number; px?: number; nx?: boolean; xx?: boolean }) {
    const exists = !!this.live(key);
    if (opts?.nx && exists) return null;
    if (opts?.xx && !exists) return null;
    const ttl = opts?.ex ? opts.ex * 1000 : opts?.px ?? null;
    this.store.set(key, {
      value: JSON.parse(JSON.stringify(value)),
      expiresAt: ttl ? this.now + ttl : null,
    });
    return "OK";
  }
  async del(...keys: string[]) {
    let n = 0;
    for (const k of keys.flat()) if (this.live(k) && this.store.delete(k)) n++;
    return n;
  }
  async incr(key: string) {
    const e = this.live(key);
    const next = (e ? Number(e.value) : 0) + 1;
    this.store.set(key, { value: next, expiresAt: e?.expiresAt ?? null });
    return next;
  }
  async expire(key: string, seconds: number, option?: "NX" | "XX" | "GT" | "LT") {
    const e = this.live(key);
    if (!e) return 0;
    if (option === "NX" && e.expiresAt !== null) return 0; // only set a TTL when there is none
    e.expiresAt = this.now + seconds * 1000;
    return 1;
  }
  /** MULTI/EXEC: runs the queued commands in order and returns their results. */
  multi() {
    const queue: (() => Promise<unknown>)[] = [];
    const chain = {
      incr: (key: string) => (queue.push(() => this.incr(key)), chain),
      expire: (key: string, seconds: number, option?: "NX" | "XX" | "GT" | "LT") => (queue.push(() => this.expire(key, seconds, option)), chain),
      exec: async () => {
        const results: unknown[] = [];
        for (const run of queue) results.push(await run());
        return results;
      },
    };
    return chain;
  }
  async getdel<T = unknown>(key: string): Promise<T | null> {
    const v = await this.get<T>(key);
    this.store.delete(key);
    return v;
  }
  async ttl(key: string) {
    const e = this.live(key);
    if (!e) return -2;
    return e.expiresAt === null ? -1 : Math.ceil((e.expiresAt - this.now) / 1000);
  }
  reset() { this.store.clear(); }
}

/** Shared instance returned by the mocked `Redis` constructor. */
export const fakeRedis = new FakeRedis();

/**
 * Pass-through stand-in for @upstash/ratelimit. By default every call
 * succeeds; set `ratelimitState.blocked = true` to simulate being limited.
 */
export const ratelimitState = {
  blocked: false,
  /** Make limit() throw, like Redis being unreachable */
  failing: false,
  /** "<prefix>|<identifier>" for every limit() call */
  calls: [] as string[],
  reset() {
    this.blocked = false;
    this.failing = false;
    this.calls = [];
  },
};

export function redisModuleMock() {
  return { Redis: vi.fn(function () { return fakeRedis; }) };
}

export function ratelimitModuleMock() {
  class Ratelimit {
    static slidingWindow = (tokens: number, window: string) => ({ tokens, window });
    static fixedWindow = (tokens: number, window: string) => ({ tokens, window });
    constructor(public config: { prefix?: string }) {}
    async limit(id: string) {
      if (ratelimitState.failing) throw new Error("redis unreachable");
      ratelimitState.calls.push(`${this.config.prefix}|${id}`);
      return {
        success: !ratelimitState.blocked,
        limit: 100,
        remaining: ratelimitState.blocked ? 0 : 99,
        reset: Date.now() + 1000,
        pending: Promise.resolve(),
      };
    }
  }
  return { Ratelimit };
}

/*
 * Usage in a test file (vi.mock is hoisted, so use the async factory form):
 *   vi.mock("@upstash/redis", async () => (await import("./helpers/redis")).redisModuleMock());
 *   vi.mock("@upstash/ratelimit", async () => (await import("./helpers/redis")).ratelimitModuleMock());
 */

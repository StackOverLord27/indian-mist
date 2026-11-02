import { afterAll, describe, expect, it } from "vitest";
import { Redis } from "@upstash/redis";
import { FakeRedis } from "../helpers/redis";

// Contract test: same operations on real Upstash and on FakeRedis must agree.
// Keys are namespaced `im_test:<rand>:` and removed afterwards.
const ns = `im_test:${Math.random().toString(36).slice(2, 10)}:`;
const real = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN! });
const used = new Set<string>();
const k = (n: string) => { used.add(ns + n); return ns + n; };
afterAll(async () => { if (used.size) await real.del(...used); });

async function scenario(r: Pick<FakeRedis, "get" | "set" | "del" | "incr" | "expire" | "getdel" | "ttl" | "multi">) {
  const out: unknown[] = [];
  out.push(await r.set(k("a"), { otp: "123456", n: 1 }, { ex: 60 }));
  out.push(await r.get(k("a")));
  out.push(await r.get(k("missing")));
  out.push(await r.incr(k("c")), await r.incr(k("c")));
  out.push(await r.expire(k("c"), 30), await r.expire(k("missing"), 30));
  out.push((await r.ttl(k("c"))) > 0);
  out.push(await r.set(k("s"), "x"), await r.set(k("t"), 5));
  out.push(await r.get(k("s")), await r.get(k("t")));
  out.push(await r.getdel(k("s")), await r.getdel(k("s")));
  out.push(await r.del(k("a"), k("c"), k("t"), k("never")));
  out.push(await r.set(k("nx"), 1, { nx: true }), await r.set(k("nx"), 2, { nx: true }));
  // atomic "add one and make sure it expires" used by the OTP caps and the sign-in lockout
  out.push(await r.multi().incr(k("m")).expire(k("m"), 60, "NX").exec());
  out.push(await r.multi().incr(k("m")).expire(k("m"), 60, "NX").exec());
  out.push((await r.ttl(k("m"))) > 0);
  return out;
}

describe("FakeRedis matches real Upstash", () => {
  it("returns identical results for the operations this repo uses", async () => {
    const fake = await scenario(new FakeRedis());
    const live = await scenario(real as unknown as FakeRedis);
    expect(fake).toEqual(live);
  });
});

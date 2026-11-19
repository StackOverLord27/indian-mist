import { afterAll, describe, expect, it } from "vitest";
import { Redis } from "@upstash/redis";
import { allowCheckoutStart, CHECKOUT_STARTS_PER_ACCOUNT, CHECKOUT_STARTS_PER_IP } from "@/lib/attempt-limit";

// The checkout start limit against REAL Upstash. Account and address ids carry an `im_test`
// prefix and random suffix, so nothing real is touched; the counters are removed afterwards.
const id = Math.random().toString(36).slice(2, 10);
const real = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN! });
const keys = new Set<string>();
afterAll(async () => { if (keys.size) await real.del(...keys); });

describe("checkout start limit (live Upstash)", () => {
  it("allows the account allowance, refuses the next, and the counter expires on its own", async () => {
    const user = `im_test_user_${id}`;
    const ip = `im_test_ip_${id}_a`;
    keys.add(`checkout_start:user:${user}`).add(`checkout_start:ip:${ip}`);
    for (let i = 0; i < CHECKOUT_STARTS_PER_ACCOUNT; i++) expect(await allowCheckoutStart(user, ip)).toBe(true);
    expect(await allowCheckoutStart(user, ip)).toBe(false);
    const ttl = await real.ttl(`checkout_start:user:${user}`);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(3600);
  });

  it("limits one address across many accounts", async () => {
    const ip = `im_test_ip_${id}_b`;
    keys.add(`checkout_start:ip:${ip}`);
    let refused = 0;
    for (let i = 0; i < CHECKOUT_STARTS_PER_IP + 2; i++) {
      const user = `im_test_user_${id}_${i}`;
      keys.add(`checkout_start:user:${user}`);
      if (!(await allowCheckoutStart(user, ip))) refused++;
    }
    expect(refused).toBe(2);
  });
});

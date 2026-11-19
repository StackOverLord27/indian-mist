import { describe, expect, it } from "vitest";
import { Types } from "mongoose";
import { orderIdForRazorpayOrder } from "@/lib/order-id";
import { orderNumber } from "@/lib/order-number";

// Razorpay order ids look like "order_" + 14 base62 characters
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
let seed = 12345;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const fakeRazorpayId = () => "order_" + Array.from({ length: 14 }, () => ALPHABET[Math.floor(rnd() * 62)]).join("");

describe("order _id derived from the Razorpay order id", () => {
  it("is a SHA-256 based, valid 24-hex ObjectId, and the same every time for the same order", () => {
    const a = orderIdForRazorpayOrder("order_Abc123Def456Gh");
    expect(Types.ObjectId.isValid(a)).toBe(true);
    expect(a.toHexString()).toMatch(/^[0-9a-f]{24}$/);
    expect(orderIdForRazorpayOrder("order_Abc123Def456Gh").equals(a)).toBe(true);
    expect(orderIdForRazorpayOrder("order_Abc123Def456Gi").equals(a)).toBe(false);
  });

  it("order numbers (last 6 hex characters) are spread evenly over 16 million values", () => {
    const N = 50_000;
    const counts = new Array(16).fill(0); // by each hex digit of the number
    const positions = Array.from({ length: 6 }, () => new Array(16).fill(0));
    for (let i = 0; i < N; i++) {
      const n = orderNumber(orderIdForRazorpayOrder(fakeRazorpayId())).slice(1).toLowerCase();
      expect(n).toMatch(/^[0-9a-f]{6}$/);
      for (let p = 0; p < 6; p++) { const d = parseInt(n[p], 16); positions[p][d]++; counts[d]++; }
    }
    // chi-square, 15 degrees of freedom: 37.7 is the 0.1% limit; a fair spread stays far below it
    for (const pos of positions) {
      const expected = N / 16;
      const chi = pos.reduce((sum, c) => sum + (c - expected) ** 2 / expected, 0);
      expect(chi).toBeLessThan(37.7);
    }
  });

  it("collisions among order numbers follow the birthday maths, nowhere near a pattern", () => {
    const N = 2000; // far more orders than the shop will see in years
    const seen = new Set<string>();
    const ids = new Set<string>();
    let sameNumber = 0;
    for (let i = 0; i < N; i++) {
      const rz = fakeRazorpayId();
      const id = orderIdForRazorpayOrder(rz);
      ids.add(id.toHexString());
      const n = orderNumber(id);
      if (seen.has(n)) sameNumber++;
      seen.add(n);
    }
    expect(ids.size).toBe(N); // the full 24-character ids never collided
    // expected number of equal-number pairs ≈ N²/2 / 16.7M ≈ 0.12; allow a couple
    expect(sameNumber).toBeLessThanOrEqual(2);
  });

  it("existing orders keep their time-based ids and numbers: nothing derives or rewrites them", () => {
    const old = new Types.ObjectId("66a1b2c3d4e5f60718293a4b");
    expect(orderNumber(old)).toBe("#293A4B");
    expect(orderNumber(old.toHexString())).toBe("#293A4B"); // same from the string a page receives
  });
});

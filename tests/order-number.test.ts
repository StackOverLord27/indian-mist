import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import mongoose from "mongoose";
import { orderNumber } from "@/lib/order-number";
import { samePaymentText } from "@/lib/duplicate-note";
import { CheckoutSuccess } from "@/components/checkout/CheckoutSuccess";
import { OrderHistory } from "@/components/profile/OrderHistory";
import type { OrderData } from "@/components/profile/types";

const ID = "6a1e2f9c4b8d3a7e0c57f466".replace(/.{6}$/, "f57466"); // a 24-character id ending in f57466

describe("orderNumber()", () => {
  it("is '#' and the last 6 characters of the id, upper case: #F57466", () => {
    expect(ID).toHaveLength(24);
    expect(orderNumber(ID)).toBe("#F57466");
  });
  it("accepts an ObjectId, and short or odd input, without throwing", () => {
    expect(orderNumber(new mongoose.Types.ObjectId(ID))).toBe("#F57466");
    expect(orderNumber("ab12")).toBe("#AB12");
    expect(orderNumber("")).toBe("#");
  });
  it("is what the shop's notes use too", () => {
    expect(samePaymentText([ID])).toContain("order #F57466 has the same Razorpay payment id");
  });
});

describe("everywhere an order id is shown uses it", () => {
  it("the confirmation page shows the short number with a Copy button, never the 24-character id", () => {
    const html = renderToStaticMarkup(createElement(CheckoutSuccess, { orderId: ID }));
    expect(html).toContain("#F57466");
    expect(html).toContain("Order number");
    expect(html).toContain('aria-label="Copy order number"');
    expect(html).not.toContain(ID);
    expect(html).not.toContain("Order ID");
    expect(renderToStaticMarkup(createElement(CheckoutSuccess, { orderId: null }))).not.toContain("Order number");
  });

  it("My Orders shows the same number", () => {
    const order = {
      _id: ID, status: "PROCESSING", paymentStatus: "PAID", totalAmount: 800, createdAt: new Date().toISOString(),
      items: [{ name: "Shirt", quantity: 1, priceAtPurchase: 800 }],
      shippingAddress: { street: "s", city: "c", state: "s", zipCode: "1", country: "India" },
    } as unknown as OrderData;
    const html = renderToStaticMarkup(createElement(OrderHistory, { orders: [order] }));
    expect(html).toContain("#F57466");
    expect(html).not.toContain(ID);
  });

  it("no source file builds its own short id: the only .slice(-6) on an id lives in order-number.ts", () => {
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(ts|tsx)$/.test(entry.name) && !full.endsWith(path.join("lib", "order-number.ts")) && /slice\(-6\)/.test(fs.readFileSync(full, "utf8"))) hits.push(full);
      }
    };
    walk("src");
    expect(hits).toEqual([]);
  });

  it("the admin orders page, My Orders and the confirmation page import the helper", () => {
    for (const file of ["src/app/admin/orders/page.tsx", "src/components/profile/OrderHistory.tsx", "src/components/checkout/CheckoutSuccess.tsx"]) {
      expect(fs.readFileSync(file, "utf8"), file).toMatch(/from "@\/lib\/order-number"/);
    }
  });
});

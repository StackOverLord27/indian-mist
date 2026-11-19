import { test, expect } from "@playwright/test";

// The e2e server loads the real .env (including SMTP credentials); e2e/serve.mjs replaces them
// with a dead local port and switches the e-mail kill switch on. This test FAILS THE RUN if a
// message submitted through the real contact route could be delivered.
test("no browser test can send real mail: a contact message is refused, not sent", async ({ request }) => {
  const res = await request.post("/api/contact", {
    data: { name: "E2E Isolation", email: "e2e-isolation@example.test", phone: "", topic: "Order support", message: "This message must never leave this machine.", website: "" },
  });
  expect([200]).not.toContain(res.status());
  expect([429, 502]).toContain(res.status()); // 502: the e-mail guard held it back; 429: the shared cap
});

# End-to-end payment tests (Playwright)

Real browser, the real site, Razorpay's real **Test Mode** Checkout window. They add no features: they find defects.

## What they touch (and never touch)
- **Database:** a LOCAL throwaway database `indianmist_e2e` on the local MongoDB (`127.0.0.1:27018`, the podman container used by the unit tests). The runner refuses any other host and never reads `MONGODB_URI` from `.env`.
- **Razorpay:** Test Mode only. The runner refuses to start unless `RAZORPAY_KEY_ID` / `NEXT_PUBLIC_RAZORPAY_KEY_ID` start with `rzp_test_`. Key values are never printed.
- **Redis:** the dev Upstash in `.env` (the owner confirmed it is a dev instance). Each test removes the pending-order keys it created; rate-limit counters expire by themselves.
- **Never** run these with the production site's `.env` database. The app started by the tests gets `MONGODB_URI` from `e2e/serve.mjs`.

## Run
```
npm run test:e2e                         # builds the app, starts it on :3100, runs everything
E2E_SKIP_BUILD=1 npm run test:e2e        # reuse the last build
npm run seed:e2e                         # just (re)seed the local e2e data, to click around by hand
```
Output (screenshots, traces, videos on failure, saved sign-ins) goes to `e2e-artifacts/` (gitignored). `npx playwright show-report e2e-artifacts/report`.

## Real webhooks (scenarios 4 and 5)
Razorpay sends webhooks to the URL registered for Test Mode (`https://<public-host>/api/webhooks/razorpay`, note **webhooks**, plural). To receive them on the e2e app:
1. The tunnel/port-forward must be **public** (a private dev tunnel answers `401 www-authenticate: tunnel`) and must point at the port the e2e app uses.
2. Free that port (stop any other dev server on it) and run:
```
E2E_PORT=3000 E2E_REAL_WEBHOOK=1 npm run test:e2e
```
Without `E2E_REAL_WEBHOOK=1` the tests POST payloads signed with the webhook secret to the local route instead (shape taken from Razorpay's docs).

> **Warning:** any app that receives Razorpay's webhook and shares the Upstash Redis can finalize the pending orders created by these tests. Never leave a production-database server reachable by the registered webhook URL while these tests run.

## Notes
- Sign-in is rate limited (5/minute); sessions are created once by `e2e/global-setup.ts` through the real forms and reused for 8 minutes.
- Test card used: Razorpay's documented Test Mode Visa debit `4100 2800 0000 1007`, any CVV, future expiry; on the mock bank page the tests press **Success** or **Failure**.
- Each scenario reseeds products, settings and clears orders and holds; scenarios run one at a time.

## Admin upload tests (`admin-uploads.e2e.ts`)
They pick photos far above production's limits in the real admin forms and measure what the browser sends. The upload routes are answered by the test, so nothing is written to Cloudinary or the database. The photos are drawn in the browser (no fixtures).

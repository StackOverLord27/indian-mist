# Deploy checklist

Do these in order. Tick each box. Nothing here contains a secret: only names. The values stay in Vercel, never in git, chat or screenshots.

Related: `docs/env.md` (what each variable does), `docs/manual-test-plan.md` (test before going live), `docs/launch-content.md` (content to fill in).

---

## 1. Accounts and plans

- [ ] **Vercel plan.** The free "Hobby" plan is for personal, **non-commercial** use. A shop that takes payments needs the **Pro** plan (or higher). Decide this before launch; moving later means a redeploy.
- [ ] **MongoDB Atlas.** The free **M0** cluster has **no backups** (section 5) and shared limits. Fine for testing; for real orders prefer a paid tier (M10 and up) that has continuous or scheduled backups. If you stay on M0, the manual dump routine in section 5 is **mandatory**.
- [ ] **Razorpay account activated for Live Mode** (KYC and business details approved). Business and GST details are given to Razorpay in their dashboard, not on the site.
- [ ] Upstash Redis, Cloudinary and your SMTP provider on plans that fit the traffic (all have free tiers; check the limits).

## 2. Environment variable NAMES per environment

Set these in Vercel > Project > Settings > Environment Variables. "Prod" = Production, "Prev" = Preview, "Dev" = your machine. Full meaning in `docs/env.md`.

| Name | Prod | Prev | Dev | Value must be |
|---|---|---|---|---|
| `MONGODB_URI` | yes | yes | yes | Prod: the live database. Prev/Dev: **different** databases. Also needed at **build time**. |
| `JWT_ACCESS_SECRET` | yes | yes | yes | long random string, **different per environment** |
| `JWT_REFRESH_SECRET` | yes | yes | yes | long random string, **different** from the access secret and per environment |
| `SUPER_ADMIN_EMAIL` | yes | yes | yes | the one admin e-mail (that account must be signed up on the site) |
| `NEXT_PUBLIC_SITE_URL` | **yes** | **yes** | optional | the public address, no path, e.g. `https://www.yourshop.in`. **The build fails without it.** Set Preview to the preview address or a staging domain. |
| `UPSTASH_REDIS_REST_URL` | yes | yes | optional | a **separate** Redis database for Prev |
| `UPSTASH_REDIS_REST_TOKEN` | yes | yes | optional | as above |
| `RAZORPAY_KEY_ID` | **live** `rzp_live_` | test `rzp_test_` | test | never put live keys in Preview/Dev |
| `RAZORPAY_KEY_SECRET` | live | test | test | |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | live (same as KEY_ID) | test | test | baked into the site at **build time**: change it, then **redeploy** |
| `RAZORPAY_WEBHOOK_SECRET` | the **Live** webhook's secret | only if a test webhook points at Preview | optional | different from the test one |
| `CLOUDINARY_CLOUD_NAME` | yes | yes | yes | ideally a separate account or folder for Prev |
| `CLOUDINARY_API_KEY` | yes | yes | yes | |
| `CLOUDINARY_API_SECRET` | yes | yes | yes | |
| `SMTP_HOST` | yes | yes | optional | |
| `SMTP_PORT` | optional (587) | optional | optional | `465` = TLS from the start; Brevo: `587` |
| `EMAIL_ENABLED` | optional | optional | optional | `false` = kill switch for ALL e-mail |
| `EMAIL_ALLOWLIST` | not read | to test | to test | the only addresses a Preview/local run may e-mail (comma-separated, `@domain.com` allowed) |
| `SMTP_USER` | yes | yes | optional | |
| `SMTP_PASS` | yes | yes | optional | |
| `SMTP_FROM` | yes | yes | optional | a sender on **your domain** (see section 8) |

- [ ] Every name above is set for Production. Open `.env.example` and confirm no name is missing from Vercel.
- [ ] Old names you may still have (`MAIL_*`, `JWT_EXPIRES_IN`, `NEXT_PUBLIC_API_URL`) are **not read** by the code: delete them.
- [ ] `NODE_ENV` is not set by hand.

## 3. MongoDB Atlas

- [ ] **Database user for the app** has only the `readWrite` role on the `IndianMist` database. The user found in the read-only check during the database prompt (`atlasAdmin@admin`) is far more powerful than the app needs; create a new `readWrite` user, put its URI in Vercel, redeploy, and then delete the old one. (`readWrite` is enough: the app builds its own indexes on first use.)
- [ ] **Network access.** Vercel's functions and its **build** machines call Atlas from changing addresses. Options: (a) allow `0.0.0.0/0` and rely on a long random database password (simplest, common); (b) Vercel's Static IPs / Secure Compute (paid) and allow only those; (c) Atlas Private Link on higher tiers. The build **fails on purpose** when the database is unreachable, so if a deploy fails with a database error, check this first.
- [ ] **Indexes exist.** After the first live visit, open Atlas > Browse Collections > `orders` > Indexes: there must be a **unique** index on `razorpayOrderId`. It is what makes "one payment = one order" true. If it is missing, **do not take payments** until it exists. Also expect `stockSettled_1_createdAt_1` (partial) on `orders` (plus the partial `refundStatus_1_createdAt_-1` for the Refund pending tab) and a unique `razorpayOrderId_1` on `unmatchedpayments` (the collection appears after the first unmatched payment or the first index build).
- [ ] **Transactions need a replica set.** Atlas clusters (even M0) are replica sets, so cancelling an order and releasing a stock hold work as all-or-nothing steps. A local MongoDB used for development must also be a replica set (the podman test container is: `replicaSet=rs0`); a plain standalone `mongod` answers "Transaction numbers are only allowed on a replica set" on cancel and on stock release.
- [ ] Connection string uses the database name you intend (`.../IndianMist?...`), not the default `test`.
- [ ] **Remove test data from the live database before launch:** up to 4 stray test orders created when Razorpay's real webhook reached a dev server using the live database during the payment tests (Razorpay order ids `order_TvUvP2hZm99gQK`, `order_TvUuoD3hxz5Dz1`, `order_TvUj5xQPXdFlfJ`, `order_TvUiOkty1r37OL`, customer "Ada Customer"), any test users, any test products. Atlas > Browse Collections > filter > delete by hand (the code never deletes production data).
- [ ] Optional Cloudinary clean-up: `node scripts/reconcile-cloudinary.mjs` (read-only) lists unused files; deleting needs `--delete --confirm=<cloud>/<database>` typed exactly. Only do this with the owner's explicit say-so.

## 4. Razorpay Live Mode

- [ ] Dashboard switched to **Live Mode**. Settings > API Keys > generate **Live** keys. Put them in Vercel **Production only**: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `NEXT_PUBLIC_RAZORPAY_KEY_ID` (same key id).
- [ ] **A NEW Live Mode webhook** (the Test Mode webhook does not carry over):
  - URL: `https://<your-live-domain>/api/webhooks/razorpay` (note **webhooks**, plural).
  - Events: **`payment.captured`** and **`order.paid`** (tick both; the site handles either arriving first, or both).
  - Secret: choose a long random string and set the **same** value as `RAZORPAY_WEBHOOK_SECRET` in Vercel Production. It must differ from the test secret.
  - Active: yes.
- [ ] **Automatic capture is ON** (Settings > Payment Capture). If capture is manual, a payment stays "authorized" and the site never creates the order.
- [ ] **Redeploy** after changing `NEXT_PUBLIC_RAZORPAY_KEY_ID` (it is part of the build).
- [ ] Payment methods you want (cards, UPI, netbanking, wallets) are enabled in Razorpay; the checkout page says "We accept ..." only if true.
- [ ] After go-live, make one **small real payment** with your own card (you can refund it from the Razorpay dashboard), check: order appears, webhook delivery log shows 200, stock fell by one.
- [ ] Never print or paste the live secrets anywhere. If one leaks: rotate it in Razorpay and Vercel and redeploy.

## 5. Domain, HTTPS and the site address

- [ ] Add the domain in Vercel > Domains; point DNS as Vercel says. HTTPS certificates are issued automatically.
- [ ] Set `NEXT_PUBLIC_SITE_URL` to the **final** address (with `https://`, with or without `www` exactly as you will use it) for Production, then redeploy. Pick one version (www or not) and redirect the other to it in Vercel Domains.
- [ ] The site sends `Strict-Transport-Security` for 2 years including subdomains. **Every subdomain of your domain must support HTTPS** (mail, blog, etc.), or browsers will refuse them. If unsure, tell me and we can shorten it.
- [ ] Update Razorpay's webhook URL if the domain changed.
- [ ] Open `/sitemap.xml` and `/robots.txt` on the live domain: the addresses inside are the live domain.
- [ ] (Later) Add the domain to Google Search Console and submit `https://<domain>/sitemap.xml`.

## 6. Backups (M0 has none)

Atlas M0 cannot back up. Do **both** of these until you are on a paid tier:

**A manual dump routine (on your own computer or a small server).** Install the MongoDB Database Tools (`mongodump`). Keep the connection string in an environment variable called `ATLAS_URI` (do not type it into the command line history).

```
# one dump, compressed into a single dated file
mongodump --uri="$ATLAS_URI" --db=IndianMist --gzip --archive="indianmist-$(date +%F).archive.gz"
```

- Run it at least **daily** (orders are the thing you cannot recreate), and always **before** a risky change (running a script, bulk edits, changing the database user).
- Schedule it: a `cron` line on a machine that is always on, for example daily at 02:30: `30 2 * * * /path/to/backup.sh` where the script sets `ATLAS_URI` and runs the command above and deletes dumps older than 30 days. A GitHub Actions scheduled workflow with the URI in a repository secret also works.
- Store the file **off the machine** (an encrypted cloud drive/bucket). A backup on the same laptop is not a backup. Dumps contain customer data (names, addresses, password hashes): keep them private and encrypted.
- **Test a restore once** into a throwaway database: `mongorestore --uri="$OTHER_URI" --gzip --archive=FILE --nsFrom='IndianMist.*' --nsTo='restoretest.*'`. A backup you never restored is a guess.
- What is *not* in the dump: images (they live in Cloudinary: keep the Cloudinary account safe, and optionally download the Media Library now and then) and Redis (temporary data only: OTP codes, rate counters and pending checkouts for up to 24 hours; nothing there needs saving).

**On a paid Atlas tier** switch on Cloud Backup (scheduled snapshots) and/or continuous backup, and still keep a weekly dump.

## 7. Monitoring

None of this is built in; set it up, it takes 30 minutes.

- [ ] **Uptime check** (UptimeRobot, Better Stack, etc.) on `https://<domain>/` every 5 minutes, alert to your phone/e-mail.
- [ ] **Vercel**: turn on e-mail alerts for failed deployments and error spikes; read **Logs** after launch day. Search for these exact phrases and treat each as something to act on:
  - `pending order not found` : a customer paid but the site could not rebuild the order (the Redis record lasted 24 hours and expired, or Redis failed). **Refund or fulfil by hand** using the Razorpay dashboard.
  - `[razorpay webhook]` with `could not create the order` : same family of problem. These payments are also saved in the database: **the Admin dashboard shows a red box "payment(s) received without an order"** with the payment id, amount and time. Look at the dashboard daily; each entry means a customer paid and has no order (fulfil by hand, or refund in Razorpay). The entry disappears by itself if an order for it appears later.
  - `[razorpay webhook] payment attempt failed` : a failed attempt (information only: the customer can retry on the same checkout, and the stock stays held).
  - `[stock] settling order ... failed` / `repairing unsettled orders failed` : the stock of a paid order could not be settled; it is retried automatically (at the latest about two minutes after, the next time anyone loads a product or the cart). Repeated lines mean the database is struggling.
  - `Amount mismatch` notes in admin Orders (Needs review): Razorpay reported a different amount than the order total. Check the payment in Razorpay before shipping.
  - `Webhook not configured` / `Invalid signature` : the webhook secret in Vercel and Razorpay differ.
  - `[security] Refresh token unknown or revoked (token age Ns)` : someone presented a sign-in cookie whose session no longer exists. Single lines are normal (signed out on another device, password reset, a session past its 10-newest cap); a flood from many customers means look at `[auth]` lines below. (Refresh tokens no longer rotate, so the old "replay detected" line and the automatic wipe are gone.)
  - `[auth] sign-in redirect reason=...` : a page was opened with no usable cookie (`no-session-cookies`, `access-token-invalid-and-no-refresh-cookie`). `[auth] renewal refused reason=...` : the reason a session ended (`session-idle-expired`, `session-absolute-max-reached`, `token-expired`, `token-invalid`, `no-refresh-cookie`, `account-missing-or-unverified`). `[auth] renewal failed: server error` : database trouble; customers stay signed in and see a Retry button. These lines never contain tokens, e-mail addresses or ids.
  - `[db] CRITICAL: ... index ... not unique and sparse` (also shown as a red box on the Admin dashboard): the live `orders.razorpayOrderId` index is not the unique one the model declares (Mongoose cannot replace an index of the same name with other options, and used to say nothing). The shop still creates one order per payment by itself, but fix the index: from your machine, with the production `MONGODB_URI` in the environment, run `npm run ensure:indexes` (read-only report), and only then `npm run ensure:indexes -- --apply` (asks you to type the database name; refuses and lists the values if duplicate orders exist; never deletes documents). Duplicate orders for one payment: look for the red "The same payment was recorded twice" note in Admin > Orders and ship only one.
  - `[order] created ... via webhook|verify-payment at <time>` : one line per new order saying which path created it (also shown as small text in the admin order detail). `[order] ... found the order already created via ...` : the second confirmation of the same payment arrived and was ignored (normal).
  - `Rate limiting unavailable` : Redis is down; sign-in and forms answer 503 until it is back.
  - `[cloudinary:delete]` : a photo could not be deleted (an orphan file); harmless but tidy up with the reconcile script.
  - `[csp]` : a browser blocked something the page tried to load (broken Razorpay or image?).
  - `Needs review` notes in admin Orders (promo used beyond its limit, or stock ran out after the hold expired): look at the **Orders** page daily.
- [ ] **Every day (two minutes), Admin dashboard and Admin > Orders:**
  1. **Dashboard: "Payments received without an order" must read 0.** It is always shown (a box with 0, or a red alert listing each payment). Anything above 0 means a customer paid and has no order: fulfil it by hand or refund it in Razorpay, then press **Mark resolved** on its row (it asks first; this only hides it, nothing is sent to Razorpay). If you also create payment links on this Razorpay account, those payments show up here too: mark them resolved. "—" means the check itself failed: reload.
  2. **Dashboard: "Refunds waiting for you"** (also the **Orders > "Refund pending" tab**, count in brackets): every cancelled paid order waits here until you have refunded the money in Razorpay and marked it Refunded (with the Razorpay refund id).
  3. **Orders with a red "Needs review" note**: amount mismatch, promo over its limit, stock ran out, or **"Possible duplicate payment"** (the same account paid for the same items twice within 30 minutes: check with the customer, refund one).
- [ ] **Razorpay dashboard**: Webhooks > delivery log. Failures there mean paid orders are not being created from the webhook.
- [ ] **Atlas**: Alerts for connection spikes, storage, and "cluster paused/unreachable"; turn on the performance advisor e-mails.
- [ ] **Upstash**: usage alert (daily command limit on the free plan). **Cloudinary**: storage/bandwidth alert. **SMTP**: sending-limit alert and check the spam folder with a real sign-up.
- [ ] Look once a week at the `npm audit` report (see the audit section of the final report); only upgrade after running the tests.

## 8. E-mail deliverability (Brevo SMTP relay)

Everything the shop sends goes through `src/lib/email`: sign-up and password-reset codes, contact-form messages, and the customer's order e-mails (order confirmed, shipped, cancelled, refund completed, optionally delivered) and the password-changed notice. Order e-mails go ONLY to the e-mail of the account that owns the order (never the address typed at checkout), each exactly once per order.

- [ ] **Brevo account**: SMTP & API > **SMTP** tab: host `smtp-relay.brevo.com`, port `587`, your **SMTP login** and an **SMTP key** (create one; it is shown once). Put them in Vercel as `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`.
- [ ] **Authenticate your sending domain in Brevo** (Senders, Domains & Dedicated IPs > Domains > add your domain). Brevo shows the DNS records to add at your domain's DNS host (it can add them for you at some hosts):
  1. a **Brevo code** TXT record (proves you own the domain),
  2. a **DKIM** record (one TXT or two CNAME records, as Brevo shows them),
  3. a **DMARC** TXT record on `_dmarc.yourdomain` (Brevo shows a starting value; to begin gently use `v=DMARC1; p=none; rua=mailto:you@yourdomain`, and tighten to `quarantine` once real mail passes). If the domain already has a DMARC record, do not add a second one; edit the existing one.
  SPF: Brevo says a separate SPF record is not needed for authentication (DKIM carries DMARC). Adding `include:spf.brevo.com` to your domain's existing SPF record is harmless if you already publish one.
  Then press "Authenticate" in Brevo (can take up to 24-72 h to propagate). Keep these records as long as you send through Brevo.
- [ ] **`SMTP_FROM` must be an address on that authenticated domain** (or a sender verified in Brevo), for example `no-reply@yourdomain.com`, a plain address, no display name. Brevo refuses (or the mail lands in spam) when the From domain is not verified. Free mailbox domains (gmail.com, ...) cannot be authenticated.
- [ ] **Free plan limit: 300 e-mails per day** (Brevo help centre, "What are the limits of the Free plan?"; unused sends do not roll over, the counter resets daily). When it is reached Brevo stops accepting new messages until the quota resets; the shop sees these as failed sends: a customer asking for a sign-in code gets "Failed to send verification email. Please try again.", a contact message gets "We couldn't send your message", and the failure appears in **Admin > Dashboard > "E-mails that failed"**. The contact form has its own cap (20 an hour, 60 a day across all visitors) so a flood cannot use up the allowance. Upgrade the Brevo plan to lift the daily cap. Set a Brevo usage alert.
- [ ] **Reading failed e-mails**: Admin dashboard > "E-mails that failed (last 7 days)": type, time, attempts, the error code (an SMTP reply such as `550`, or `ETIMEDOUT`, `EAUTH`, `ECONFIG:SMTP_HOST`) and whether it will be retried. A red warning appears when an e-mail failed for good (not counting sign-in codes, which fail now and then and the customer just asks again). **Resend** appears for e-mails the shop can rebuild (order e-mails, once they exist); sign-in codes and contact messages are not stored, so they cannot be resent. Vercel Logs: search `[email]`: `sent type=...`, `... failed: kind=retryable|permanent code=...`, `dropped type=...`, `[contact] global e-mail cap reached`. Logs never contain addresses, codes, message text or credentials.
- [ ] **Test message**: set `EMAIL_ALLOWLIST` to your own address on the Preview/local environment, open the sign-up page, enter that address and check the code arrives (Brevo > Transactional > Logs shows it too). On the live site: sign up with your own address. A recipient not in the allowlist outside production is logged as `dropped`, not sent.
- [ ] **Kill switch**: `EMAIL_ENABLED=false` in Vercel stops all sending immediately after a redeploy (customers then see the normal "could not send" messages).
- [ ] **Order e-mails, one real run** (after the domain is authenticated): place a real (small) order with your own account. Expected: the confirmation arrives once (even if the Razorpay webhook and the browser both confirm); in Admin > Orders open the order: "E-mails to the customer" shows it as sent. Set the order to Shipped (optionally with courier, tracking number and link filled in first): the Shipped e-mail arrives once, and the same details show in My Orders. Cancel it: the e-mail says a refund is due and that refunds take several working days (no date). Record the refund as Refunded: the refund e-mail arrives. Do a password reset: the "password was changed" notice arrives. Setting the same status again, or going Shipped > Processing > Shipped, never sends a second e-mail.
- [ ] **Optional "Delivered" e-mail**: Admin > Site Settings > "Customer e-mails": off by default; tick it only if you want customers e-mailed when you mark an order Completed (Delivered).
- [ ] **Tracking details** (courier, tracking number, tracking link) are optional extras in the order detail: they are never needed to change a status; a link that is not an https:// address is left out (you are told) and the status still changes.
- [ ] **If an e-mail fails**: the order and the status change are saved anyway. A temporary failure (server busy, timeout) is retried by itself up to 4 times (after 1 min, 5 min, 30 min, 2 h, checked whenever someone uses the site or the admin dashboard); after that, or for a permanent failure (for example the address is refused), it shows red under "E-mails that failed" and in the order detail, with **Resend**. Resend sends once, and only e-mails that failed; one that was sent cannot be sent again from here.
- [ ] **Where the owner's e-mails go**: the address saved in Admin > Contact Page, else `SUPER_ADMIN_EMAIL` (set at least one; with neither, the owner alerts below cannot be sent and a `[email] not sent ... no owner address` line is logged). Use a mailbox you read all day: the payment-problem alerts are the ones that cost money if missed. In Gmail/Outlook add a rule that never sends subjects starting `URGENT:` to spam.
- [ ] **E-mails to the owner**: (1) **New order**: one per paid order, with a link that opens that order in the admin. (2) **URGENT payment problems** (subject starts `URGENT:`): a payment received but no order created, the same payment on two orders, a refund you must make after cancelling a paid order, and an order flagged "needs review". Each has the Razorpay order and payment ids and the exact next steps; each is sent once per kind and payment id, however often Razorpay repeats the webhook. (3) **Warning: N e-mails could not be delivered**: at most once a day, only when something failed for good (sign-in codes are not counted). (4) Optional **low-stock** alert: Admin > Site Settings > "Customer e-mails", off by default, one level (units) for all products, one e-mail per drop. The site has no way for a customer to cancel an order, so there is no "customer cancelled" e-mail.
- [ ] **How the free plan's 300 a day is protected**: owner alerts are capped per hour (new order 10, payment problems 30, low stock 10, warning 2); anything over the cap is NOT sent and is logged once an hour (`[email] owner alert capped type=... reason=hourly`); it is still on the dashboard and in Admin > Orders. When the day's e-mails reach 70% of the allowance, new-order and low-stock alerts are held back; payment-problem alerts and the warning go on until 95%, so customers' e-mails and the urgent alerts keep room. Tell the app your real plan limit with `EMAIL_DAILY_LIMIT` (default 300). A held-back payment alert is sent when Razorpay retries the webhook or the problem is seen again.
- [ ] Send a real sign-up code to Gmail, Outlook and a work address and check they land in the inbox, not in spam.

## 9. Content that must be real before launch

See `docs/launch-content.md`. At minimum:

- [ ] Privacy Policy and Terms & Conditions text saved in the admin (until you save, the site shows a generic placeholder).
- [ ] Refund/Cancellation policy and Shipping/Delivery policy written and saved (Razorpay asks for them; the footer links appear automatically).
- [ ] A real business address, phone and e-mail on the Contact page; the old sample address (`123 Forest Lane...`) replaced.
- [ ] Saved placeholder wording in the hero, eco commitment, brand story, trust strip and product delivery text replaced or cleared (run `node scripts/find-placeholder-content.mjs` to list what is still saved).
- [ ] Pricing: shipping fee, free-shipping threshold, GST rate and promo codes checked in Admin > Pricing & Promos, and the trust strip wording matches.

## 10. Go-live order of operations

1. Merge the branch (the owner decides when; nothing has been pushed by me).
2. Set Production env vars (section 2), with **test** Razorpay keys first.
3. Deploy. Run the manual test plan (`docs/manual-test-plan.md`) against it.
4. Fill in the content (section 9). Remove test data (section 3).
5. Switch Razorpay to Live keys + the new Live webhook (section 4). **Redeploy.**
6. One real small payment, then refund it.
7. Turn on monitoring and backups (sections 6 and 7) **before** announcing the shop.

**Rolling back:** Vercel > Deployments > pick the last good one > Promote / Instant Rollback. This does not undo database changes. Indexes added by a release stay (harmless).

## 11. What is deliberately NOT done yet

Know these before you promise customers anything:

- **No order e-mails.** Customers get no confirmation, shipping or cancellation e-mail. They see orders on their Profile page. (You see new orders in Admin > Orders; check it daily or ask for notifications to be built.)
- **No automatic refunds.** Cancelling an order in the admin puts the stock back but does **not** refund the money. The admin asks for confirmation (and says so), then lists the order as **Refund pending**; refund it in the Razorpay dashboard by hand and mark it **Refunded** in the order (optional note and Razorpay refund id). The customer sees "Cancelled, refund in progress" and later "Refunded", with no timeline promised and never your note or the refund id. This is bookkeeping only: nothing is sent to Razorpay and nothing checks that the refund really happened.
- **The Razorpay payment window closes after 14 minutes** (the stock hold is 15; both come from `src/lib/checkout-timing.ts`). Razorpay documents that browsers may pause the timer in a background tab, so a window can occasionally stay open longer; the hold and the "payment after the hold expired" safety net still apply.
- **A failed payment keeps the stock held** until the customer closes the payment window or 15 minutes pass. This is deliberate: Razorpay lets the customer retry on the same checkout, so `payment.failed` is only written to the log.
- **Refunds and chargebacks are not synced** from Razorpay: the site only reacts to successful payments.
- **A payment that arrives more than 24 hours after checkout started** cannot be turned into an order automatically. It is saved as an "unmatched payment" and shown in a red box on the Admin dashboard (see section 7); you fulfil or refund it by hand.
- **Orders created before the stock-record change** (everything before this release) have no per-line record of what was deducted; cancelling one gives back the full ordered quantity, as before. Only a late payment that zeroed the stock could have over-restocked, and no such order is expected before launch.
- **Starting a checkout is limited** to 10 per hour per account and 30 per hour per network address (a friendly message is shown). A shopper who legitimately hits it waits up to an hour or finishes one of the open payments.
- **No GST invoice generation**, no shipping-label or courier integration, no abandoned-cart e-mails.
- **Two admin tabs on the same settings page**: the last save wins (the two pages do not overwrite each other, but one page opened twice can).
- **Existing product photos** in Cloudinary are not re-compressed (only new uploads are shrunk).
- **Admin sign-out**: the 15-minute access cookie stays valid until it expires (the refresh token is killed at once). This applies to every sign-out and password reset, customers included: the 15-minute access token is stateless.
- **Sign-in lifetimes**: customers stay signed in 30 days after their last visit (extended each time the site renews the session), at most 90 days from sign-in; the admin account 7 days and at most 30 days. Refresh tokens do not rotate; a stolen refresh cookie therefore works until sign-out, password reset, or its expiry (the cookie is `HttpOnly` and the database holds only a hash). At most 10 sessions per account are kept (the oldest end).
- **Sign-up and sign-in messages can reveal whether an e-mail has an account** (accepted for now).

## Speed: where the time goes, and what to check in Vercel / Atlas / Upstash
Measured with timing logs on a production build (not left in the code). Per request, as the code makes them:
- **Every `/api/*` request** goes through the proxy: **1 awaited Upstash call** (the rate limiter) plus **1 background Upstash call** (the limiter's analytics). Pages are not rate limited.
- `GET /api/profile` (customer with orders): 1 Upstash + **2 sequential MongoDB round trips** (account and orders together, then the products on those orders). Before: 3 sequential. The checkout pre-fill now asks `?orders=0`: 1 Upstash + **1 MongoDB command**, no order history.
- `POST /api/auth/refresh`: 1 Upstash + 3 sequential MongoDB commands (session row, account, expiry update). With an expired access cookie a page therefore makes 3 requests one after another: profile (401), refresh, profile again.
- **First request of every new server instance** (cold start): the database connection (TCP + TLS + login, several round trips) plus roughly 10-15 extra MongoDB commands that Mongoose sends by itself (`createIndexes` for every index of every model the request touches, and `create` for each collection). These run alongside the request and compete for the 5 pooled connections.
- **Round trips cost the distance between the services.** A request takes about `Upstash distance + MongoDB distance x (number of sequential commands)`. If the function, Atlas and Upstash are in different regions every one of those numbers is 100-250 ms instead of 1-10 ms.

What to check (nothing in the code was changed for regions):
1. Vercel > Project > Settings > Functions > **Function Region**: it must be the region closest to your **Atlas cluster** (Atlas > Cluster > region; for example Mumbai `ap-south-1` is Vercel `bom1`). The `x-vercel-id` header of an API response shows where it ran (`bom1::...`).
2. **Upstash** database region: the same continent as the function (ideally the same region; Upstash > Database > Details). If it is far away, create the database in the function's region (Upstash lets you add a read region, but the rate limiter writes, so the primary must be near).
3. Atlas **free (M0)** clusters can be slow when idle and share resources: a profile that is fast locally but slow on the preview points to distance, not to the code.
4. Optional, owner's decision: set Mongoose `autoIndex: false` and `autoCreate: false` in production and run `npm run ensure:indexes -- --apply` after a deploy that changes indexes. That removes the cold-start burst above, at the price of one more deploy step. Not done here.

## What stays up to a minute stale by design
- Product, collection and home pages refresh when stock changes (an order, a cancellation, a hold taken or released, an expired hold swept), at most once every 5 seconds per server instance. A change that lands inside that gap, or one noticed while a product page is being rendered (the expiry sweep), shows at the latest after the page's own 60-second refresh (`revalidate = 60`).
- `/api/profile` (My Orders, the checkout pre-fill) is never cached: an order status change the shop makes shows on the next load.

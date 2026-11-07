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
| `SMTP_PORT` | optional (587) | optional | optional | `465` = TLS from the start |
| `SMTP_USER` | yes | yes | optional | |
| `SMTP_PASS` | yes | yes | optional | |
| `SMTP_FROM` | yes | yes | optional | a sender on **your domain** (see section 8) |

- [ ] Every name above is set for Production. Open `.env.example` and confirm no name is missing from Vercel.
- [ ] Old names you may still have (`MAIL_*`, `JWT_EXPIRES_IN`, `NEXT_PUBLIC_API_URL`) are **not read** by the code: delete them.
- [ ] `NODE_ENV` is not set by hand.

## 3. MongoDB Atlas

- [ ] **Database user for the app** has only the `readWrite` role on the `IndianMist` database. The user found in the read-only check during the database prompt (`atlasAdmin@admin`) is far more powerful than the app needs; create a new `readWrite` user, put its URI in Vercel, redeploy, and then delete the old one. (`readWrite` is enough: the app builds its own indexes on first use.)
- [ ] **Network access.** Vercel's functions and its **build** machines call Atlas from changing addresses. Options: (a) allow `0.0.0.0/0` and rely on a long random database password (simplest, common); (b) Vercel's Static IPs / Secure Compute (paid) and allow only those; (c) Atlas Private Link on higher tiers. The build **fails on purpose** when the database is unreachable, so if a deploy fails with a database error, check this first.
- [ ] **Indexes exist.** After the first live visit, open Atlas > Browse Collections > `orders` > Indexes: there must be a **unique** index on `razorpayOrderId`. It is what makes "one payment = one order" true. If it is missing, **do not take payments** until it exists. Also expect `stockSettled_1_createdAt_1` (partial) on `orders` and a unique `razorpayOrderId_1` on `unmatchedpayments` (the collection appears after the first unmatched payment or the first index build).
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
  - `[security] Refresh token replay detected` : a stolen/reused sign-in token; occasional single lines can be normal after a sign-out, a flood is not.
  - `Rate limiting unavailable` : Redis is down; sign-in and forms answer 503 until it is back.
  - `[cloudinary:delete]` : a photo could not be deleted (an orphan file); harmless but tidy up with the reconcile script.
  - `[csp]` : a browser blocked something the page tried to load (broken Razorpay or image?).
  - `Needs review` notes in admin Orders (promo used beyond its limit, or stock ran out after the hold expired): look at the **Orders** page daily.
- [ ] **Razorpay dashboard**: Webhooks > delivery log. Failures there mean paid orders are not being created from the webhook.
- [ ] **Atlas**: Alerts for connection spikes, storage, and "cluster paused/unreachable"; turn on the performance advisor e-mails.
- [ ] **Upstash**: usage alert (daily command limit on the free plan). **Cloudinary**: storage/bandwidth alert. **SMTP**: sending-limit alert and check the spam folder with a real sign-up.
- [ ] Look once a week at the `npm audit` report (see the audit section of the final report); only upgrade after running the tests.

## 8. E-mail deliverability

- [ ] `SMTP_FROM` is an address on **your own domain**; the domain has SPF and DKIM set up with the mail provider (they give you the DNS records). Without this, sign-up codes land in spam or never arrive and customers cannot create accounts.
- [ ] Send a real sign-up code to Gmail, Outlook and a work address and check they land in the inbox.

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
- **No automatic refunds.** Cancelling an order in the admin puts the stock back but does **not** refund the money. Refund in the Razorpay dashboard by hand, then cancel in the admin (or the reverse), and keep a note.
- **A failed payment keeps the stock held** until the customer closes the payment window or 15 minutes pass. This is deliberate: Razorpay lets the customer retry on the same checkout, so `payment.failed` is only written to the log.
- **Refunds and chargebacks are not synced** from Razorpay: the site only reacts to successful payments.
- **A payment that arrives more than 24 hours after checkout started** cannot be turned into an order automatically. It is saved as an "unmatched payment" and shown in a red box on the Admin dashboard (see section 7); you fulfil or refund it by hand.
- **Orders created before the stock-record change** (everything before this release) have no per-line record of what was deducted; cancelling one gives back the full ordered quantity, as before. Only a late payment that zeroed the stock could have over-restocked, and no such order is expected before launch.
- **Starting a checkout is limited** to 10 per hour per account and 30 per hour per network address (a friendly message is shown). A shopper who legitimately hits it waits up to an hour or finishes one of the open payments.
- **No GST invoice generation**, no shipping-label or courier integration, no abandoned-cart e-mails.
- **Two admin tabs on the same settings page**: the last save wins (the two pages do not overwrite each other, but one page opened twice can).
- **Existing product photos** in Cloudinary are not re-compressed (only new uploads are shrunk).
- **Admin sign-out**: the 15-minute access cookie stays valid until it expires (the refresh token is killed at once).
- **Sign-up and sign-in messages can reveal whether an e-mail has an account** (accepted for now).

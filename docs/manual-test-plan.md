# Manual test plan (for the owner)

Run this on a **Vercel deployment** with **Razorpay Test Mode** keys. Nothing here uses real money.
The automated suites already prove a lot; this plan only asks you to do what a computer cannot prove from your laptop.

**How to read it**

- **[AUTO]** = already covered by the automated tests (the unit suite `npm test`, or the browser suite `npm run test:e2e`). You may skip these, or do them once for confidence.
- **[MANUAL]** = only you can check this (real e-mail, real photos, phone screens, Razorpay's servers, how it looks).
- Tick each box. If anything differs from "Expected", write down the page, what you clicked, and a screenshot, and stop.

Estimated time: about 2 hours the first time.

---

## 0. Before you start (setup, 20 minutes)

1. **Use a deployment Razorpay can reach.** Razorpay's servers must be able to call your site. A Vercel deployment with *Deployment Protection* turned on shows a Vercel login page to everyone who is not signed in to Vercel, **including Razorpay**, so webhooks would fail and look like a bug in the site. Either test on a deployment with protection off, or add Vercel's "Protection Bypass for Automation" for the webhook, or use your production deployment **while it still has the test keys** (before you switch to live keys).
2. **Environment variables** (Vercel > Project > Settings > Environment Variables) for the environment you are testing: see `docs/deploy-checklist.md`. For this test the Razorpay values must be the **test** ones: `RAZORPAY_KEY_ID` and `NEXT_PUBLIC_RAZORPAY_KEY_ID` start with `rzp_test_`. After changing any `NEXT_PUBLIC_*` value you must **redeploy** (it is baked in at build time).
3. **Webhook in Razorpay (Test Mode):** Dashboard > switch to *Test Mode* > Account & Settings > Webhooks > Add. URL: `https://<your-test-deployment>/api/webhooks/razorpay` (the word is **webhooks**, plural). Events: `payment.captured` and `order.paid`. Secret: the same text as `RAZORPAY_WEBHOOK_SECRET` in Vercel.
4. **Database for this test:** use a separate (non-live) database for Preview/test so test orders never mix with real ones (see the checklist).
5. **Create the admin account:** open `/signup`, sign up with the e-mail you set as `SUPER_ADMIN_EMAIL` (you will test sign-up properly in section 2). That account is the admin; nobody else can be.
6. Have ready: your phone, 3 or 4 real product photos (some 3 MB or bigger), a second e-mail address you can read, and a private/incognito window.
7. Keep Vercel's **Logs** tab open (Project > Logs). You will look at it a few times.

Razorpay Test Mode card for every card test: **4100 2800 0000 1007**, any future expiry, any 3-digit CVV. On the bank page that opens, press **Success** or **Failure**. If Razorpay asks for a mobile number use `9811122233`. If it shows a "Save card" prompt after a failure, do **not** press "Maybe later": that starts a new payment; close the prompt another way.

---

## 1. First look and empty-store states

### 1.1 Empty store [MANUAL] (also [AUTO] for the logic: `tests/launch-content.test.ts`)
Do this only if you can start from an empty test database; otherwise skip to 1.2.
1. Open the home page, `/products`, `/collections`, `/blogs`, `/about`, `/contact`, `/cart`, `/wishlist`.
2. Expected: no crash, no broken boxes, no leftover sample text. Sections with nothing written (trust strip, eco numbers, brand story, hero text, contact details) are simply absent. `/products` says there are no products. `/cart` and `/wishlist` say they are empty. The hero shows "Indian Mist" as its heading.
3. Open `/refund-policy` and `/shipping-policy`. Expected: a "not found" page (they do not exist until you save text).

### 1.2 Pages and links [MANUAL]
1. Home page: header, announcement bar (if you have announcements), hero, sections, footer.
2. Footer: Privacy Policy and Terms & Conditions links are there. Refund and Shipping links appear **only** after you have saved their text (section 12).
3. Click every footer and header link once. Expected: no 404 (except the two optional policies before you write them).

---

## 2. Accounts, e-mail codes and passwords

All of this needs your **real e-mail inbox**, which is why it is manual. (The logic is [AUTO]: `tests/auth-routes.test.ts`.)

### 2.1 Sign up with a code [MANUAL]
1. Incognito window > `/signup`. Enter a name, your second e-mail, and a password with 8+ characters including an upper-case letter, a number and a symbol.
2. Press Create account. Expected: a code screen. Under the button you saw links to Terms and Privacy.
3. Open the e-mail "Your Indian Mist verification code" (check spam; note how long it took; it should be within a minute). Enter the 6-digit code.
4. Expected: you are signed in and taken to the site; the navbar shows you are logged in.
5. Negative: sign up again with the same e-mail. Expected: a clear "already exists" type message, no second account.
6. Negative: request a code, type a wrong code 6 times. Expected: after 5 wrong tries the code is cancelled and you must start again.
7. Vercel Logs: the line `[MAILER] OTP email sent to a***@...` shows a masked address, not the full one.

### 2.2 Sign in and out [MANUAL] (logic [AUTO])
1. Sign out (profile page > Sign out). Sign in with the e-mail and password. Expected: you land on the page you came from (for example open `/checkout` while signed out; after signing in you return there).
2. Wrong password. Expected: "Invalid email or password"; after 10 wrong tries in 15 minutes the account is locked for the rest of that window.
3. Open the site in two tabs, leave both signed in for 20 minutes (the 15-minute session renews itself), then click around in both. Expected: you stay signed in in both tabs. (This is the "two tabs at once" fix.)

### 2.3 Password reset [MANUAL]
1. `/forgot-password` > enter your e-mail > get a code by e-mail > enter code + new password.
2. Expected: success message; you can sign in with the new password and **not** with the old one; any other signed-in device is signed out.
3. Enter an e-mail that has no account. Expected: the same neutral message as for a real one (the site must not reveal who has an account), and no e-mail arrives.

### 2.4 Admin sign-in and sign-out [MANUAL] (sign-in itself [AUTO] in the browser suite)
1. `/admin/login` with the admin e-mail and password. Expected: the dashboard.
2. Try `/admin/login` with a normal customer account. Expected: "Access denied. Admin role required." and no admin page opens (typing `/admin` by hand afterwards must also not show admin data).
3. Press Sign out in the admin sidebar. Expected: back at `/admin/login`. Press the browser Back button, then open `/admin/orders`. Expected: you are sent to the login page, no admin data shown.

---

## 3. Money: payments and orders

Use a normal customer account (not the admin). Make sure at least one product has **stock tracking on with a small stock** (for example 3 units) and one with a size.

### 3.1 Successful card payment [AUTO: browser suite scenario 1] + [MANUAL on your site]
1. Add the product to the bag > Checkout > fill the address > Pay.
2. Razorpay window > card 4100 2800 0000 1007 > Success.
3. Expected: a confirmation page with an order number; **Profile > Orders** shows it as paid; the product's stock fell by the quantity bought.
4. Admin > **Orders**: the order is listed under Processing with the right items, address and total.
5. Razorpay Dashboard (Test Mode) > Payments: the payment is **Captured** for the same amount.

### 3.2 Real webhook delivery from Razorpay's servers [MANUAL — the main reason for this plan]
This proves Razorpay can reach your site. The automated tests only simulate it.
1. Make a payment as in 3.1 but **close the browser tab right after pressing Success** on the bank page (before the confirmation page appears).
2. Wait one minute, then sign in again and open Profile > Orders. Expected: the order exists, exactly once.
3. Razorpay Dashboard > Account & Settings > Webhooks > your webhook > delivery log: the two events `payment.captured` and `order.paid` show a **200** response. If you see 401/403, a login page, or timeouts: deployment protection or a wrong URL/secret (see section 0). If you see 400 "Invalid signature": the secret in Vercel differs from the one in Razorpay (copy-paste it again; stray spaces are tolerated, wrong characters are not).
4. Vercel Logs: no line containing "pending order not found" for this payment.

### 3.3 Failed payment [AUTO: scenario 2] + short manual check
1. Pay with the same card but press **Failure**. Expected: an error message; no order created; try again with Success works.
2. After the failed attempt, look at the product page stock: the units stay held for the checkout window and come back when you close the payment window or after 15 minutes.

### 3.4 Closing the payment window releases the hold [AUTO: scenario 3]
1. Start a payment and close the Razorpay window with the X. Expected: the product's stock goes back at once (reload the product page).

### 3.5 Abandoned payment: the hold releasing by itself [MANUAL]
1. With a product that has 1 unit left, start a checkout and open the Razorpay window, then **close the whole browser tab** (do not press Pay, do not use the X).
2. In another browser, open that product: it should show as unavailable / sold out.
3. Wait **16 minutes**, then reload the product page. Expected: the unit is back on sale (the release happens the next time anyone loads a product or the cart, there is no timer running in the background).
4. Pay for the original checkout **after** the hold has expired is covered in 3.6.

### 3.6 Paying after the hold expired [MANUAL, optional]
1. Start a checkout for the last unit, leave the Razorpay window open for 16 minutes, then pay (card, Success).
2. Expected: the order is still created (the customer paid). If someone else bought that unit meanwhile, the stock simply reads 0 and the order shows a **review note** in admin Orders ("Needs review") for you to resolve by hand.

### 3.7 Two shoppers, last unit [AUTO: scenario 7]
Skip unless you want to see it: two browsers, one unit, both press Pay. Expected: one gets the Razorpay window, the other a clear "out of stock" message.

### 3.8 Promo codes [AUTO: scenario 6 and `tests/checkout-money.test.ts`] + manual setup check
1. Admin > **Pricing & Promos** > add a code (for example `WELCOME10`, 10%, per-user limit 1, total limit 2, minimum order, a future expiry) > Save.
2. Customer: apply it at checkout. Expected: the discount shows, and the amount Razorpay asks for is the discounted amount.
3. Pay, then try the same code again with the same account. Expected: "You have already used this promo code".
4. A second customer uses it (total 2), a third gets "reached its usage limit".
5. Try an expired code and a code below the minimum order. Expected: clear messages.
6. Type 15 wrong codes in a row. Expected: a "too many invalid codes, try again in 10 minutes" message.
7. Free shipping and shipping fee: Pricing > shipping fee and free-shipping threshold. Buy just under and just over the threshold. Expected: the fee appears below the threshold and disappears above it.

### 3.9 Admin order status changes and cancel with restock [AUTO: scenario 9] + manual feel
1. Admin > Orders > open the paid order > change status Processing > Shipped > Delivered (shown on the "Completed" tab). Expected: the tab counts update; the customer sees the new status on Profile > Orders.
2. Cancel a paid order. Expected: status Cancelled, stock goes back **once**, a product that had been marked Sold Out becomes buyable. Try to cancel/change it again: it says a cancelled order cannot be changed.

### 3.9b Stock edge cases and the safety nets [AUTO: `tests/stock-edge-cases.test.ts`] + manual look
1. **Late payment, then cancel** (builds on 3.6): after the late order with a "Needs review" note, cancel it. Expected: the product's stock goes up only by the units that were really taken from the shelf (not by the full ordered quantity).
2. **Payment without an order** [MANUAL, optional, Test Mode, and only on a database you can clean]: start a checkout, then in Upstash (Data Browser) delete the key `pending_order_<razorpay order id>` before paying; pay with the test card. Expected: the payment page says to contact support; the Admin **dashboard** shows a red box "1 payment received without an order" with the payment id (and the amount once Razorpay's webhook arrives). There is no "dismiss" button (an entry only disappears when an order for it exists), so afterwards delete that one document by hand: Atlas > Browse Collections > `unmatchedpayments` > delete. Do not do this on the live shop database.
3. **Wrong amount** (cannot be forced in Test Mode, covered by the automated tests): an order would show "Amount mismatch" in its review note.
4. **Checkout limit** [MANUAL, optional]: press Pay, close the window, press Pay again, 11 times in an hour with the same account. Expected: the 11th shows "You have started checkout several times in the last hour...". Wait an hour (or clear the `checkout_start:*` keys in Upstash) to start again.
5. After any of these, nothing should be stuck: reload the product page, the stock should match what is really on the shelf plus what is held for open checkouts.

### 3.10 Mobile and redirect-based payment methods [MANUAL]
1. On your **phone** (mobile data, not your Wi-Fi), repeat 3.1 with the card.
2. In the Razorpay window try **UPI** (Test Mode shows a way to simulate success/failure) and **Netbanking** (a mock bank page). Expected: after the redirect back, the site shows the order (or, if the redirect is lost, the order appears in Profile > Orders thanks to the webhook).
3. Expected on all of them: no layout overflow, buttons reachable, the pay button text readable.

---

## 4. Admin: photos, forms and Cloudinary (real files) [MANUAL]

The browser suite checked the shrinking in the browser, but it never sent files to Cloudinary. Do this with **real** photos on the deployed site.

1. Admin > **Add Product**. Choose 4 or 5 real photos (include a 3 MB+ photo and one taken with your phone held sideways). Expected: each is previewed; the file names show a small size (about 700 KB or less); phone photos are upright, not rotated.
2. Fill the rest and Save. Expected: success. Open the product page: the photos look sharp, in the right shape, not stretched. Cloudinary Dashboard > Media Library > folder `indian-mist`: the new files are there.
3. Edit the product: remove one photo, set another as the first/primary, add one more, Save. Expected: the page matches; in Cloudinary the removed photo is **gone** a few seconds later and nothing extra is left behind.
4. Try 10 big photos in one go. Expected: either all fit (each smaller) or a clear message says how many to add per save. Never a crash or silent failure.
5. Repeat quickly for: a Category cover photo, a Carousel slide, the Blog cover photo (add then use the remove-cover button), the About page story + gallery photos, the Homepage brand-story photo, the Size chart image.
6. Delete a test product. Expected: it disappears from the shop and its photos disappear from Cloudinary.
7. Size limits: try a photo over 10 MB. Expected: a readable message, nothing uploaded.
8. Run `npm run reconcile:cloudinary` on your computer (read-only) afterwards: it should report no new unused files from this test.

---

## 5. Admin: content and layout

### 5.1 Announcements [AUTO logic] + [MANUAL look]
1. Admin > **Announcements** > add two texts, switch one off, delete one. Expected: the bar at the top of the site changes at once (within seconds), on the home page **and** on `/cart`, `/products`, `/about`.
2. Scroll a long page on phone and on desktop. Expected: the announcement bar and navbar stay together at the top with no gap and no overlap, and when there are no announcements there is no empty strip.

### 5.2 Reordering across pages [AUTO logic] + [MANUAL feel]
1. Make sure you have more than 50 products (or temporarily look at Categories and Carousel which also reorder).
2. Admin > **Products**: drag/arrow a product up and down; go to page 2 and reorder there; reload. Expected: the order persists and matches the shop's `/products` "Featured" order.
3. While a search/category filter is on, reordering is switched off (by design).
4. Open the same list in two tabs, reorder in one, then reorder in the other without reloading. Expected: a clear message that the list changed, and nothing is scrambled.

### 5.3 Collections picker [MANUAL]
1. Admin > **Collections** > new collection > use the product picker: search by name, page through, tick products on different pages, Save.
2. Open the collection on the site: the picked products are all there. Edit it and check the ticks are remembered.

### 5.4 Settings pages do not overwrite each other [AUTO: `tests/admin-settings.test.ts`] + quick manual
1. Open **Site Settings** and **Contact Page** and **Layout & Text** and **Pricing & Promos** each in its own tab.
2. Change one field in each, save each in turn, then reload all four. Expected: all four changes are still there.
3. Clear every item in the homepage trust strip / eco numbers / brand-story tags and save. Expected: the home page shows none of those sections (no placeholder text comes back).
4. Trust strip is exactly what you typed (nothing is added or changed automatically).

### 5.5 Contact form and newsletter [MANUAL: real e-mail]
1. Contact page > send a message. Expected: success message; the message arrives in the mailbox set as the Contact Page e-mail (Admin > Contact Page); if that is empty it goes to the admin e-mail. The sender's address is set as reply-to.
2. Send 6 messages quickly. Expected: the 6th is refused ("too many requests").
3. Home page newsletter bar (near the bottom of the home page) > subscribe with an e-mail; subscribe again with the same e-mail in different capitals. Expected: first "subscribed", second "already subscribed", only one subscriber stored.

### 5.6 Blogs, About, Contact page content [MANUAL look]
Write a short blog post with a cover photo, publish it, view it, unpublish it (it must disappear from `/blogs` and its address must give "not found"). Fill in the Contact page details and the About page, view both. Then Admin > Blog Posts > "Blog page header": the form starts with the current wording; change the three texts, save, open `/blogs` (it changes at once); empty all three, save: the small line and the sentence disappear and the heading reads "Blog". Check that the breadcrumb on `/blogs` is in the same place as on `/about`, on a phone and a laptop.

---

## 6. Search engines, sitemap and policy pages

### 6.1 sitemap and robots [AUTO: `e2e/launch-content.e2e.ts`] + [MANUAL on the real address]
1. Open `https://<your-site>/sitemap.xml`. Expected: addresses start with your real `NEXT_PUBLIC_SITE_URL` (not `localhost`, not a Vercel preview address), include products, collections, published blog posts, and no `/admin`, `/api`, `/cart`, `/checkout`.
2. Open `/robots.txt`. Expected: disallows `/admin`, `/api/`, `/cart`, `/checkout`, `/profile`, `/wishlist`, sign-in pages; has a `Sitemap:` line with your real address.
3. View source of a product page (right-click > View page source): look for `rel="canonical"` with your real address, `og:title`, `og:image`, and a `application/ld+json` block with `"@type":"Product"`.
4. Paste a product URL into Google's Rich Results Test (search.google.com/test/rich-results): Product is detected. Paste the link into WhatsApp: a preview with the photo appears.
5. New products appear in `sitemap.xml` within about an hour (it refreshes hourly).

### 6.2 Policy pages and links [AUTO logic] + [MANUAL]
1. Admin > **Privacy Policy** and **Terms & Conditions**: replace the starting text with your real text (until you save, the live pages show a generic placeholder) and Save. Open both public pages: your text shows.
2. Admin > **Refund Policy** and **Shipping Policy**: they start empty and **do not exist on the site**. Write each text, Save. Expected: `/refund-policy` and `/shipping-policy` now work, a link to each appears in the footer within seconds, and each is in `sitemap.xml` after it refreshes. Clear the text and save: the page and its footer link disappear again.
3. Check: Terms and Privacy links are next to the Pay button at checkout and under the Create account button on sign-up.

---

## 7. Layout on phones and desktop [MANUAL]

Open these on a real phone (portrait) and on a laptop: home, `/products` (filters + infinite scroll), a product page (photo swipe, sizes, add to bag), `/cart`, `/checkout`, `/profile`, `/contact`, a policy page, a blog post, the admin Products and Orders pages.
Expected: no sideways scrolling, text readable, buttons large enough to tap, photos not stretched or blurry, the sticky header not covering content, the footer links reachable.

---

## 8. After the test

1. Delete the test orders and test users from your **test** database (never from the live one).
2. Razorpay Dashboard: leave the Test Mode webhook, but for live you create a **separate** Live Mode webhook (see `docs/deploy-checklist.md`).
3. Tell me anything that did not match "Expected", with screenshots and the Vercel log lines around the time.

## Quick map: what is automated

| Area | Automated by | You still do |
|---|---|---|
| Card success/failure, hold release on close, race for last unit, stale bag, promo limits, admin cancel + restock | browser suite `e2e/payments.e2e.ts` (real Razorpay Test checkout, your local database) | 3.1 and 3.2 once on the deployed site, 3.5, 3.10 |
| Webhook logic (signature, duplicates, order.paid + captured) | unit tests + `scripts/razorpay-test-check.mjs` | 3.2 (real delivery) |
| Stock records, restock after late payment, crash safety (cancel, release, settle), repair pass, unmatched payments, amount check, checkout limit, indexes | `tests/stock-edge-cases.test.ts`, `tests/live/checkout-limit.live.ts` (real Upstash) | 3.9b (look at the dashboard box once) |
| Sign-up/sign-in/reset/rotation | `tests/auth-routes.test.ts` (fake mail) | 2.1 to 2.4 (real mail) |
| Image shrinking in the browser | `e2e/admin-uploads.e2e.ts` | section 4 (real Cloudinary) |
| Pagination, reorder, picker, listings | unit + `e2e/storefront.e2e.ts` | 5.2, 5.3 (feel) |
| SEO, policy pages, empty sections | `tests/launch-content.test.ts`, `tests/legal-policies.test.ts`, `e2e/launch-content.e2e.ts` | 6.1 and 6.2 on the real address |
| Layout, phones | nothing | section 7 |

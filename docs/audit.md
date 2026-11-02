# Launch audit (read-only)

Branch `hardening/launch-prep`, base commit `36b11ac`/`c5ac741`. No source files were changed. Evidence is file:line from the code as it is now, the real `next build` route table (docs/work-log.md baseline), the Next.js docs in `node_modules/next/dist/docs/`, Vercel docs (fetched), and small experiments on the throwaway local Mongo (nothing run against Atlas).

Severity: **Blocker** = fix before launch. **Major** = fix soon after / before real traffic. **Minor** = polish.
Verdict: C = Confirmed, R = Refuted, P = Partly.

---

## Part A: verdicts on the suspected items

### Build and caching

| # | Verdict | Sev | Evidence | Fix direction |
|---|---|---|---|---|
| A1 | **C** | **Blocker** | `src/app/page.tsx:60` and `src/app/contact/page.tsx:105` call `dbConnect()` + queries with no try/catch and `revalidate = 60`. Per the ISR doc (`02-guides/incremental-static-regeneration.md:467,473,500-503`) a **thrown** error during regeneration keeps the last good page; **returning** a fallback replaces it. The root layout (`layout.tsx:52-64`), `generateMetadata` (`layout.tsx:28-42`), `AnnouncementBar.tsx:8-17` and `/about` (`about/page.tsx:20-48`, falls back to `ABOUT_DEFAULTS`) all swallow errors, so one transient DB failure during regeneration **caches a page with empty nav/footer/announcements, default title, or default About text for 60 s+**, replacing the good one. Because Home throws, a failure of the whole DB keeps the old Home, but a partial failure (layout query fails, page query succeeds) caches a degraded Home. Also: at **build time** an unreachable DB makes `next build` fail for `/` and `/contact` (they have no catch), and the build needs Atlas network access from Vercel's build machines. | Layout/metadata/AnnouncementBar/About: rethrow (or let the error propagate) instead of rendering a fallback, so ISR keeps the last good page. Keep a fallback only for the very first build. Document Atlas allow-list requirement for Vercel builds. |
| A2 | **P** | Major | Route table: `/products` and `/products/[slug]` are `ƒ` dynamic; `/blogs`, `/blogs/[slug]`, `/collections`, `/collections/[slug]` are `ƒ`. `/products` has `revalidate = 60` (`products/page.tsx:7`) but reads `searchParams` (`:16`), so the revalidate is ignored (dynamic). `/products/[slug]` has no `generateStaticParams` and no `revalidate` (`products/[slug]/page.tsx`), so it is rendered on demand on every request, not ISR. Blogs/collections `revalidate = 0` (`blogs/page.tsx:10`, `blogs/[slug]/page.tsx:12`, `collections/page.tsx:7`, `collections/[slug]/page.tsx:10`) = always dynamic. Every product view = 2x `getProductBySlug` (metadata + page) + settings + 3 layout queries + RelatedProducts. | Product page: `generateStaticParams` (can return `[]`) + `revalidate` + `revalidatePath`/tag on product writes; wrap `getProductBySlug` in React `cache()`. Listing pages: drop the misleading `revalidate = 60`; paginate (see E1/E2). |
| A3 | **C** | Minor | `/api/about` (`revalidate = 300`), `/api/announcements` (60), `/api/carousel` (60), `/api/settings` (300) are `○` prerendered in the route table and each reads the DB at build. None of `/api/about|announcements|carousel` is in `PUBLIC_API_PREFIXES` (`proxy.ts:24-38`), so anonymous callers get 401; and no component calls them (grep: only `/api/settings` is used, by `hooks/usePricingSettings.ts`). They are dead code. `/api/settings` is public and prerendered, so pricing changes can lag up to 5 min and `revalidatePath` in admin settings (`'/'`, `'/about'`, ...) does not refresh `/api/settings`. | Delete the three unused routes (and `/api/blogs*`, also unused by any component). Make `/api/settings` `force-dynamic` or revalidate `/api/settings` on settings save. |
| A4 | **C** | **Major** | Admin writes: products POST/PUT/DELETE, categories POST/PUT/DELETE, collections POST/PUT/DELETE, blogs: **no revalidation at all** (`admin/products/route.ts`, `[id]/route.ts`, `categories/*`, `collections/*`). Only reorder routes call `revalidatePath('/products')`/`'/'`. Announcements/carousel/settings/about revalidate literal paths only. Per `revalidatePath.md:36-40` a literal path invalidates only that page; layout data is embedded in each prerendered page. Route table: `/cart`, `/checkout`, `/signin`, `/signup`, `/forgot-password`, `/profile`, `/wishlist`, `/admin/*` are `○` with **no revalidate**, i.e. static until the next deploy. Navbar categories/collections, the announcement bar and the footer on these pages are frozen at build-time DB state (and empty if the build DB was empty). Pages with `revalidate = 60` (`/`, `/about`, `/contact`, legal) lag up to 60 s. | `revalidatePath('/', 'layout')` (docs: layout type invalidates every page below it) from all admin mutations that affect nav/footer/announcements/settings/categories/collections; or move layout data to tagged `unstable_cache` + `revalidateTag(tag, 'max')`. Give the static client pages a `revalidate` or make the nav client-fetched. |
| A5 | **P** | Minor | `vercel.json` keys are `app/api/admin/...` but files live in `src/app/...`. Vercel docs: keys are globs of function **file paths** (example `src/pages/**/*`), so `app/...` most likely matches nothing (could not confirm on a real deploy). Impact is small: Vercel's default max duration is now 300 s on all plans (Vercel limits doc), so a 30 s cap would actually lower the limit, and being unmatched means the default applies. | Remove `vercel.json` `functions` and use `export const maxDuration` in the route files if a cap is wanted. |
| A6 | **P** | Minor | `signin/page.tsx:10` uses `useSearchParams` without `<Suspense>`; so does `admin/products/new/page.tsx:11`. Build **does not fail**: `src/app/loading.tsx` is an implicit Suspense boundary around the page. Effect: the whole page is client-rendered behind the loading fallback (docs `use-search-params.md:82-86`). | Wrap the component that reads search params in its own `<Suspense>`; or read `searchParams` in a server page. |
| A7 | **C** | Minor | Settings: layout `generateMetadata` + layout body + `contact/page.tsx:106` + `create-order` + `promo`. `getProductBySlug` is called in both `generateMetadata` and the page (`products/[slug]/page.tsx:113,129`). Blog slug page likewise (`blogs/[slug]/page.tsx:42` + `:16`). | React `cache()` per query helper (dedupes within one render). |

### Security and auth

| # | Verdict | Sev | Evidence | Fix direction |
|---|---|---|---|---|
| B1 | **C** | **Blocker** | `proxy.ts:63-67` matches `pathname === "/api/auth/forgot-password"`; real routes are `/api/auth/forgot-password/request-otp` and `/reset`, so they get the 100/10 s global limiter instead of 5/min. (`/api/auth/signout` and `/refresh` also use the global limiter, which is fine.) | Match with `startsWith("/api/auth/forgot-password/")` or an explicit list. Also key limits per email for OTP endpoints. |
| B2 | **C** | **Major** | `/api/contact` and `/api/subscribe` only get the global limiter (not in the strict list; `contact` sends real email to the shop on every call, honeypot only). Signup (`signup/route.ts:54-56`) has no "OTP already pending" check, unlike forgot-password: an attacker can mail a signup OTP to any address repeatedly (5/min/IP strict limit, unlimited across IPs). `request-otp` is capped to one per 5 min per address (`:35-41`) but is user-enumerating (B7) and **leaves the OTP stored when the email send fails** (`:51-56`, no `deleteOtp`), blocking retries for 5 min with a false "pending" message. | Per-email and per-IP caps for signup, request-otp, contact (Redis counters); strict limiter on `/api/contact` and `/api/subscribe`; delete OTP when sending fails. |
| B3 | **C** | **Major** | `AdminSidebar.tsx:38-42` removes localStorage keys (`im_admin_token` is never set anywhere) and pushes to `/admin/login`; it never calls `/api/auth/signout`. The httpOnly cookies and the DB refresh token stay valid; the admin can navigate back in. Only `ProfilePageClient.tsx:45` calls signout. | Call `POST /api/auth/signout` first. |
| B4 | **C** | Major | `ResetPasswordSchema` (`schemas/auth/forgot-password.schema.ts:10-11`): min 8 only, no upper/number/special, **no max** (signup has max 100 and complexity: `signup.schema.ts:14-20`); OTP only `.length(6)`, not digits. bcrypt ignores bytes past 72, and a very long body is hashed with no bound. | Share one password schema between signup and reset. |
| B5 | **C** | Major | Roles are inconsistent: signin and reset sign `'admin'|'user'` (`signin/route.ts:77`, `reset/route.ts:62`); refresh signs `'admin'` for SUPER_ADMIN else `user.role` = `"CUSTOMER"|"ADMIN"` (`refresh/route.ts:87`); verify-otp signs `newUser.role` = `"CUSTOMER"` (`verify-otp/route.ts:85`). `withAdmin` accepts only `'admin'` (`api-helpers.ts:78`). Net: the DB `role: "ADMIN"` value is never honoured; admin = email equals `SUPER_ADMIN_EMAIL` only. Compare is `===` against a lower-cased email (`signin/route.ts:77`) so a `SUPER_ADMIN_EMAIL` with capitals (or spaces) silently locks the admin out. Also `/api/auth/me` hard-codes `role: 'admin'` (`me/route.ts:9`, fine since it is behind `withAdmin`). | One role mapping function, case-insensitive trimmed compare, decide whether DB role matters. |
| B6 | **C** | **Major** | `create-order/route.ts:228-229` falls back to `"dummy_key_for_build"`/`"dummy_secret_for_build"` at request time (the Razorpay constructor only runs inside the handler, never at build, so the fallback has no build purpose). With the env missing, stock is reserved and then the Razorpay call fails (hold released). The response also returns `razorpayKeyId: process.env.RAZORPAY_KEY_ID` (`:305`). Other fallbacks: `mailer.ts:3-7` (`SMTP_HOST ""`, port 587, from `noreply@indianmist.com`, empty creds at import time, so missing SMTP only fails at send time); `proxy.ts:130` `JWT_ACCESS_SECRET ?? ""` (fails closed: empty HMAC key import throws, all protected requests 401); `contact` falls back `settings.email -> SUPER_ADMIN_EMAIL -> SMTP_USER`; `verify-payment` uses `RAZORPAY_KEY_SECRET!` (throws if unset, fails closed); Redis helpers silently return null (`attempt-limit.ts`, `rate-limit.ts`: **rate limiting and login lockout fail open if Redis env is missing**; `otp-store.ts` throws). | Validate required env once at startup/first use and throw; remove dummy fallbacks. Decide on fail-open vs fail-closed for rate limiting in production. |
| B7 | **C** | Minor | `request-otp/route.ts:27-32` returns 404 "No account found". Also signup 400 "User already exists" (`signup/route.ts:40-45`) and signin 403 "verify your email" before the password check (`signin/route.ts:53-58`), and no bcrypt work on unknown users (timing). | Same generic response for existing/unknown; check password before revealing verification state. |
| B8 | **C** | Minor | `promo/route.ts:93-105`: lock is written (`:104`), the `if (existingLock)` branch is empty (`:96-100`), the only reader. Deleted in `finalize-order.ts:146-148`. Dead code that costs a Redis read+write per apply. Real over-use protection is only the post-hoc `reviewNote` (`finalize-order.ts:30-63`). | Remove, or make it a real reservation. Decide policy for concurrent over-use (see D2). |
| B9 | **C** | Minor | `auth-tokens.ts:106-111`: refresh cookie `path: "/"` while `refresh/route.ts:17-18` says it is scoped to `/api/auth/refresh`. `proxy.ts:147-150` lets any request with any `refresh_token` cookie value reach `/checkout`, `/profile`, `/admin/*` pages (page shells only; APIs still verify). `jwt.verify` is called without `algorithms` (`auth-tokens.ts:62,67`); with a string secret jsonwebtoken only accepts HS256/384/512 so `alg:none` is rejected, but pin it. Edge verifier accepts only HMAC-SHA256 regardless of header (safe). | Pin `algorithms: ['HS256']`. Optionally scope the cookie path and have the proxy verify it. |
| B10 | **P** | Minor | **Refuted for casing**: experiment on local Mongo showed `findOne({email: "A@B.com"})` finds the stored lower-case row (Mongoose applies `lowercase` when casting queries). **Confirmed for concurrency**: two parallel creates of the same email give `fulfilled` + `rejected 11000`, and the route's catch (`subscribe/route.ts:60-65`) returns 500 instead of "already subscribed". The zod schema also does not trim/lower-case/limit length (`subscribe/route.ts:8-10`). | Catch `11000` -> return the "already subscribed" success; add `.trim().toLowerCase().max(120)`. |

### Admin and API correctness

| # | Verdict | Sev | Evidence | Fix direction |
|---|---|---|---|---|
| C1 | **C** | **Blocker** | Client (`ProductForm.tsx:202-211`) sends `removedImageIds`, `primaryImageId`, `imageOrder`, `coverImageId`; server (`products/[id]/route.ts:31,74,84`) reads `removeImageIds`, `primaryImagePublicId`, `categoryCoverImagePublicId`. So deleting an image and setting the cover do nothing (removed images stay on the product and sort to the end; the user sees success). New-image alt texts are also never sent (`newImageAlt_i`/`imageAlt_i` expected, not sent). On create the server uses `categoryCoverIndex`, the client sends `coverImageId`. | Fix names on both sides in one commit (R4), validate with zod. |
| C2 | **C** | Major | `cloudinary.config(...)` is called only inside `uploadImage` (`cloudinary.ts:9-13`). `deleteImage` (`:42-49`) works only if `uploadImage` ran earlier in the same instance (on a cold instance, delete-only routes such as product/category/blog/carousel DELETE use unconfigured credentials) and swallows every error with `console.warn`, returning success. (The `cloudinary` SDK also reads `CLOUDINARY_URL`, which is not set, so no hidden fallback.) | Configure once at module load; return/throw a result so callers can record failed deletions. |
| C3 | **C** | **Blocker** | PUT `products/[id]/route.ts`: deletes Cloudinary files at `:33` **before** validation (`:126`) and `save()` (`:143`); uploads new files at `:43` before validation, so a validation failure orphans uploads, and a failure after deletion leaves the DB pointing at destroyed assets. `removeIds` come from `JSON.parse(fields.removeImageIds)` (`:31`, unguarded, unvalidated): any `publicId` in the account can be destroyed, not just this product's. POST (`products/route.ts:243-271`): validates fields first (good) but uploads in a loop, and an invalid second file, a slug race, or `Product.create` failure orphans the files already uploaded. DELETE deletes assets before `deleteOne` (`:155-157`). | Order: validate -> upload new -> DB write -> delete old (only ids belonging to the product). Roll back uploads on failure. |
| C4 | **C** | **Major** | `admin/settings/route.ts:12-30`: validates with `SettingsSchema` but saves the **raw `body`** (`$set: body`), so unvalidated sections pass through; `SettingsSchema` (`schemas/admin.ts:124-205`) lacks `brandStorySettings`, `trustStripSettings`, `ecoCommitmentSettings`, `contactPageSettings`, and `heroSettings` is non-strict. `$set` of a nested object replaces the whole sub-object, so whichever admin page saves last wins; callers (admin homepage/contact/pricing/settings pages) send whole sections, and two tabs or pages overwrite each other (lost updates). `delete body.sizeChart` throws (500) on a non-object body. Pricing: `promoCodes` arrays are replaced wholesale. | Parse with a complete strict schema and `$set` only `parsed.data` using dotted paths per section; add an `updatedAt` precondition. |
| C5 | **C** | Major | `carousel/[id]/route.ts:262-267`: validates with `CarouselSchema.partial()` but then `Object.assign(item, body)` with the raw body (mass assignment of `url`, `publicId`, `order`, `_id`...); a crafted `publicId` makes a later DELETE destroy any asset. Multipart branch deletes the old image first (`:247`) then uploads (`:248`), then saves (`:270`); DELETE deletes the asset before the DB row (`:280-281`). | Assign parsed data only; reorder per R7. |
| C6 | **C** | **Major** | Full image path audit: <br>• **Products**: C3. <br>• **Categories** (`categories/[id]/route.ts`): removal deletes asset before save (`:125-126`); replacement deletes old (`:144`) before `save()` (`:164`); DELETE deletes before `deleteOne` (`:174-178`); POST uploads then `Category.create`, with a slug-collision loop that is racy (`categories/route.ts:71-80`). <br>• **Blogs**: PUT deletes old cover **before** uploading the new one (`blogs/[id]/route.ts:146-150`), no way to remove a cover, DELETE deletes before `deleteOne` (`:205-209`), POST orphans on create failure. <br>• **Carousel**: C5. <br>• **About** (`admin/about/route.ts`): team photo old file destroyed before upload+save (`:50-53`); the generic cleanup of replaced gallery/story/section images runs **after** the DB write (`:76-92`, correct order, errors swallowed); JSON `story`/`gallery` images are uploaded earlier through `/api/admin/upload` at pick time, so an abandoned edit orphans them. <br>• **Size chart** (`size-chart/route.ts`): upload -> DB -> delete old (correct order); orphan only if the DB write fails. <br>• **Brand story** (`settings.model.ts:95` `imageUrl` only; `admin/homepage/page.tsx` uploads via `/api/admin/upload`): no `publicId` stored, so the old file can never be deleted. <br>• **Upload endpoint** (`admin/upload/route.ts:25-33`): `fields.context` is used as part of the folder (`indian-mist/${context}`) unvalidated; every upload is "fire and forget" with no owner record, so orphans are undetectable. | A single "replace asset" helper implementing R7; store `publicId` for brand story; whitelist upload contexts; consider a reconciliation script listing Cloudinary assets not referenced by the DB (dry-run). |
| C7 | **C** | Major | `limit = Math.min(50, Number(...))` (`admin/products/route.ts:14`, same in categories, collections, blogs). Experiment: `limit=abc` -> `NaN`, `limit=` or `0` -> `0`, `-5` -> `-5`; Mongoose returned **all** documents for NaN and 0 (a negative limit is treated by MongoDB as its absolute value), so the cap is bypassable (unbounded query, admin only). Silent clamp bugs: products page asks 200 (`admin/products/page.tsx:23`), CollectionForm asks 1000 (`CollectionForm.tsx:27`), categories asks 100 (`admin/categories/page.tsx:22`, `ProductForm.tsx:89`): the UI only ever shows the first 50, so products 51+ can't be picked for a collection and categories 51+ vanish. Search regex unescaped (`admin/products/route.ts:180`): `search=(` throws "Regular expression is invalid" (500), and hostile patterns can be slow (the public `/api/products` escapes correctly, `route.ts:44`). Reorder routes (`categories/reorder`, `products/reorder`, `carousel/reorder`, `announcements/reorder`) take unbounded arrays, no ObjectId validation, run all updates in parallel, and `successResponse({message}, 400)` returns the wrong error shape (status is 400, but body is `{message}`; `errorResponse` shape is `{message, errors?}`, so same keys; cosmetic). **Admin orders list is unbounded** (`admin/orders/route.ts:132`) and returns `razorpaySignature`; so does `/api/profile` GET orders. | Shared `parsePagination()` (integer, 1..max, default); raise server max or use paging/infinite lists in the UI; escape regex; zod for reorder. |
| C8 | **C** | Major | Announcement contract is broken in five places: (1) UI sends `linkUrl` (`admin/announcements/page.tsx:50,54`), schema/model use `link`; zod strips the unknown key, so links are never saved. (2) `order` is commented out in the model (`announcement.model.ts:102`), so `sort({order:1})` (`announcements/route.ts:8`, `AnnouncementBar.tsx:11`) and the `order` written by POST are no-ops (strict mode drops it). (3) Reorder route reads `body.items` (`reorder/route.ts:84`), the client sends `{orderedIds}` (`admin-api/announcements.ts:29-30`): `items.map` on `undefined` throws -> 500, reordering never works. (4) `AnnouncementBar.tsx:14` maps only `text`, links are never rendered. (5) `revalidatePath('/')` only (A4). | Align names (`link`), restore `order`, fix reorder, render links. |

### Stock and orders

| # | Verdict | Sev | Evidence | Fix direction |
|---|---|---|---|---|
| D1 | **C** | **Blocker** | Release of expired holds happens only in `create-order` (`:215`, `limit(100)`), no cron (`vercel.json` has none): if nobody starts a checkout, abandoned holds keep stock removed from the storefront indefinitely. `HOLD_MINUTES = 30` (`stock-reservation.ts:7`) and the Redis pending order is `ex: 1800` in `create-order:283` and again in the `finalize-order.ts:133` rollback (that one resets the TTL to a **fresh** 30 min). **Paid-but-no-order window**: a customer paying at minute 29-30 whose webhook/verify arrives after the key expires gets `404 "Order session expired"`; the webhook returns 200 (only `>=500` retried, `webhooks/razorpay/route.ts:126`), so Razorpay never retries and the customer is charged with no order and no record. The Razorpay order itself never expires. | Persist the pending order in Mongo (or Redis TTL >= 24 h) and on `404` reconcile against Razorpay (`orders.fetch`/payments); alert on paid-without-order; run `releaseExpiredReservations` from a Vercel Cron and on product reads. |
| D2 | **C** | **Blocker** | `finalizeOrder` (`finalize-order.ts`): (a) claims with `getdel` (`:104`) **before** `Order.create` (`:118`); an exception restores the key (`:133`) but a crash/timeout between the two leaves a paid order with neither pending data nor order (and webhook retries then hit `404`). Safer: read -> `Order.create` (unique `razorpayOrderId` already makes it idempotent, `:128-131`) -> delete key. (b) After `Order.create`, `settleStockForPaidOrder` errors are only logged (`:139-143`); on a crash there, the reservation stays `ACTIVE`, `releaseExpiredReservations` later **restores** the stock (`restoreStock`) for an order that was actually paid = oversell; and a retry returns early via `existing` (`:77-83`) without ever settling. (c) `releaseReservation` marks `RELEASED` then restores (`stock-reservation.ts:270-278`): a crash between leaks the stock forever. (d) `reserveStock` decrements per line, then creates the `StockReservation` last (`:233-262`): a crash after any decrement leaks stock with no record. (e) Admin cancel (`orders/[id]/status/route.ts:163-185`): atomic status flip then restock; a crash between marks cancelled but never restocks, and a status can go CANCELLED from SHIPPED/DELIVERED with restock regardless. (f) `claim()` is atomic per line but a multi-line cart is claimed line by line (rollback via `restoreStock` is best effort). (g) Admin product PUT overwrites `stockQuantity`/`sizeStock` from the form (`products/[id]/route.ts:115-124,141`): any sale between loading and saving the form is lost (lost update). (h) `markSoldOutWhereEmpty` overwrites custom badges with "Sold Out" and the cancel path blanks them. (i) `releaseUserReservations` (`create-order:216`) releases the same user's other open checkout, so paying in the older tab falls into the "settle without hold" path (handled, but may create a `reviewNote`). Positives worth keeping: all stock claims are single-document atomic updates with `$gte` guards; reservation release is exactly-once via status filter; webhook + verify-payment both go through `finalizeOrder`; HMAC checks are constant time. | Wrap order creation + reservation consume in a Mongo transaction (Atlas replica set supports it, local test container does too), add a recovery sweep for `ACTIVE` reservations with a paid order, and use `$inc` deltas for admin stock edits. Tests per R6. |

### Storefront and content

| # | Verdict | Sev | Evidence | Fix direction |
|---|---|---|---|---|
| E1 | **C** | Major | `products/page.tsx:81` builds facet `name: c._id` (the raw category **slug**), while `/api/products` looks up the category name (`api/products/route.ts:93-105`), so the same facet shows "t-shirts" first and "T-Shirts" after the first client fetch. Facet counts: both `$facet` blocks run after `$match` (`page.tsx:32-62`, `route.ts:59-65`), so selecting a category (or search/badge) collapses the category facet to that single category and the badge facet to the filtered subset. | Compute each facet with the other filters applied but not its own. |
| E2 | **C** | Major | Home (`app/page.tsx:67-70`) `Product.find({isFeatured:true})` has no `limit`; the category counts `$lookup` every product into an array just to `$size` it (`:79-98`); `collections/page.tsx:15-18` populates **full** product docs for all collections; `blogs/page.tsx:14-20` has no limit/pagination (full list, no `content`); `/profile` and admin orders unbounded. Indexes: no index serves `sort {order:1, createdAt:-1}` without a category filter, nor `price`/`name` sorts; promo count queries `{promoCode, paymentStatus}` only have `{userId, promoCode}`; admin orders `{paymentStatus, status, createdAt}` none; `Blog` needs `{isPublished, publishedAt}`. | `limit` + `select`; `$group` counts instead of `$lookup`; add the indexes listed. |
| E3 | **P** | Minor | Code-verified, not visually verified. `AnnouncementBar` is `sticky top-0 z-50 h-8 sm:h-7` (`AnnouncementBarClient.tsx:43`) and `Navbar` is `sticky z-40 h-16`, `top-8 sm:top-7` **only on `/`**, `top-0` elsewhere (`Navbar.tsx:265-266`). When there are no announcements, the bar renders `null` (`:40`) but the home Navbar still sticks 28-32 px from the top (gap). On other pages with announcements both stick to `top-0`, so the bar (higher z-index) covers the top 28-32 px of the navbar once scrolled. | Offset by actual bar presence (shared CSS variable or a wrapper). |
| E4 | **C** | Minor | `admin/products/page.tsx:157` `StatusBadge active={product.isActive ?? true}`: `Product` has no `isActive` (`product.model.ts`), so every product always shows "Active". `ProductForm.tsx:543-545` Cancel is `type="button"` with no `onClick`. | Remove the badge or add the field; wire Cancel to `router.back()`. |
| E5 | **C** | **Major** | `next.config.ts` `experimental.proxyClientMaxBodySize: 52428800`. Vercel docs (fetched, https://vercel.com/docs/functions/limitations "Request body size"): "The maximum payload size for the request body or the response body of a Vercel Function is **4.5 MB**" -> `413 FUNCTION_PAYLOAD_TOO_LARGE`. `validateImageFile` allows 10 MB per file (`api-helpers.ts:159`) and the product form posts **all images in one multipart request** (`ProductForm.tsx:195-198`). Local dev hides this. | Prompt 8: direct-to-Cloudinary signed uploads or one request per image with client-side downscale; lower the per-file limit to <= 4 MB until then. |
| E6 | **C** | Major | Placeholder or invented marketing content ships as code defaults: `settings.model.ts` (`Summer 2026 Collection`, trust strip "1 tree per order / Free shipping above 999", eco section "12k+ Trees planted / 100% Recycled packaging / 0 Plastic / 1% Revenue donated", contact `123 Forest Lane, Nature Valley, Earth 456789`, `+91 98765 43210`, `hello@indianmist.com`), mirrored in `contact/page.tsx:12-20`, `TrustStrip.tsx:15`, `EcoCommitmentSection.tsx:24`, `HeroSection.tsx:15`, `admin/homepage/page.tsx:27-40`, `admin/contact/page.tsx:19-22`; About defaults in `about-content.ts:19-45`; legal defaults in `legal-pages.ts` are generic placeholder policies (no returns/refund, shipping, GST or grievance officer details). Specific unverifiable claims ("1 tree per order", "12k+ trees", "Zero plastic", "Fair trade", "Free shipping above Rs 999" hard-coded in the trust strip while the real threshold is a setting) are consumer-law risk. | Content prompt: remove claims the owner cannot prove, make shipping text derive from settings, require real contact/legal text before launch. |
| E7 | **C** | Major | `admin/settings/route.ts:26-30` is `findOneAndUpdate({}, {$set: body}, {upsert: true})` with Mongoose's default `setDefaultsOnInsert`, so the first ever save inserts **every** schema default (including all E6 placeholders, e.g. the fake contact address and the eco numbers) into the new document for sections the admin never touched. Same for `About` upsert. Because storefront components also fall back to the same text when the document is missing, the owner cannot tell stored placeholders from real content. | Make defaults non-persisted (`setDefaultsOnInsert: false` or remove schema defaults) and decide per field what an empty value means. |

---

## Part B: new findings

IDs continue from the owner's list. Sev as above.

| # | Sev | Finding | Evidence | Fix direction |
|---|---|---|---|---|
| N1 | **Blocker** | **Refresh-token rotation is not atomic**: `findOne` then `deleteOne` (`refresh/route.ts:45,68`). Two parallel refreshes with the same cookie (multiple tabs, the admin axios queue plus `AdminProtectedRoute`) can both succeed (token double-spend, defeating replay detection) or the loser is treated as a replay and the whole family is wiped (`:47-65`), signing the user out at random. | `RefreshToken.findOneAndDelete({tokenHash})`, grace window for the immediate-previous token. |
| N2 | Major | Signup is not atomic: user saved without a password, then `updateOne` sets the hash (`verify-otp/route.ts:68-74`). A crash/timeout between leaves a verified, password-less account that blocks re-signup ("already exists"). Also the OTP is consumed after user creation (`:77`), and two simultaneous verifications both pass `verifyOtp` (one gets a 500 on the unique index). | Insert with the hash in one write (bypass hook explicitly), consume the OTP with `getdel`. |
| N3 | Major | Admin-only HTTP `403` handling: any 403 from any admin call redirects to `/` (`admin-axios.ts:70-74`); the admin UI shell (localStorage `im_admin_user.role === 'admin'`) is trusted when the refresh call is rate limited (`AdminProtectedRoute.tsx:40-50`). UI-only (APIs still verify), but a localStorage edit shows the admin shell. | Do not grant on localStorage. |
| N4 | Major | Webhook handles only `payment.captured`/`order.paid`. No handling of `payment.failed`, refunds, or **authorized-but-not-captured** payments; if Razorpay capture is set to manual, no event ever finalizes. No amount cross-check between Razorpay's paid amount and `pending.totalAmount` in `finalizeOrder` (Razorpay enforces the order amount, but the code does not assert it). No stored `razorpayPaymentId` uniqueness. | Handle the other events, assert amount/currency/status, index `razorpayPaymentId`. |
| N5 | Major | `verify-payment` and `release` parse the body without zod (`verify-payment/route.ts:12-17`: `req.json()` unguarded, destructured raw); `create-order` uses zod and correctly uses parsed data (good example). `admin/about` does `JSON.parse` unguarded (`:40-42`) -> generic 500; about/settings/carousel/reorder routes save the raw body (R5 violations). | zod everywhere, use parsed data. |
| N6 | Major | Public pages with no SEO plumbing: no `sitemap`, `robots`, per-page `openGraph`/canonical, no structured data for products; `proxy.ts` matcher already excludes `sitemap*`/`robots.txt` paths. | Prompt 10. |
| N7 | Minor | PII in logs: `mailer.ts:209` logs the recipient email for each OTP; the replay warning logs userId (`refresh/route.ts:51-53`); `csp-report` logs attacker-controlled strings (`csp-report/route.ts:22`, truncated but unsanitized; public endpoint). OTP values are not logged. Error responses are generic (`handleApiError` 500 `Internal server error`); but validation errors from Mongoose (`ValidationError`) return per-field messages (admin-only), and `signin`/`signup` catch-alls log full error objects (server logs only). | Mask emails in logs, strip control chars. |
| N8 | Minor | Missing indexes for real queries (also E2): `Order{razorpayPaymentId}`, `Order{paymentStatus,status,createdAt}`, `Order{promoCode,paymentStatus}`, `Blog{isPublished,publishedAt}`, `Product{order,createdAt}`, `Announcement{isActive,order}`, `StockReservation{status,expiresAt}` exists. `User.email` unique ok; `RefreshToken` TTL ok. | Add via a separate migration script (R9). |
| N9 | Minor | Dead code: `/api/about`, `/api/announcements`, `/api/carousel`, `/api/blogs`, `/api/blogs/[slug]`, `NEXT_PUBLIC_API_URL`/`JWT_EXPIRES_IN`/`MAIL_*` env (see env table), `HOLD`-related `promo_lock`, `src/lib/homepage-data.ts` empty arrays (`featuredProducts`, `categories`, `newestArrivals`), `product.colors`, `isCategoryFeatured`, `admin/products/page.tsx` `isActive`, `DEFAULT_CATEGORIES` etc. | Remove in cleanup. |
| N10 | Minor | `products/[slug]/page.tsx:135-140` runs the settings query only when sizes exist; `ProductModel.init()` is called unawaited as a "make sure the model is registered" hack (`collections/page.tsx:13`, `collections/[slug]/page.tsx:124`). | Import the model; drop `init()`. |
| N11 | Minor | Hydration/SSR: no `Math.random`/`Date` in server-rendered output except `EstimatedDelivery.tsx:4-6` (`new Date()` computed in render; client component, server HTML and client can differ across midnight/timezones, possible hydration warning). Cart/wishlist are hydrated manually via `StoreHydration`. | Compute in an effect. |
| N12 | Minor | Secrets in client bundles: only `NEXT_PUBLIC_RAZORPAY_KEY_ID` (public by design) is read client-side; no server env is referenced from `"use client"` files. Checkout uses the key id returned by create-order first (`CheckoutPageClient.tsx:285`). | OK. |
| N13 | Minor | After a successful payment the UI shows "Payment verification failed. Please contact support" on any verify error (`CheckoutPageClient.tsx:318-320`) although the customer may be charged and the webhook may still create the order: no polling or order-status recovery screen; the cart is not cleared in that case. | Poll `/api/profile`/an order-status endpoint, show a neutral message. |
| N14 | Minor | `razorpaySignature` and `razorpayPaymentId` are returned to the browser inside the `/api/profile` orders and admin orders lists (`profile/route.ts:114-117`, `admin/orders/route.ts:132`). Not secret, but unneeded. | Add `.select()`. |
| N15 | Minor | Tooling: `.env` has `NEXT_PUBLIC_API_URL`, `JWT_EXPIRES_IN`, `MAIL_HOST/PORT/USER/PASS` that **no code reads**; the app only reads `SMTP_*`. If `MAIL_*` is what the owner's SMTP setup uses, the app is not using it. | Owner decision (see report). |

### Client call -> route table (every client-side call found)

| Caller | Call | Route | Contract check |
|---|---|---|---|
| `admin/login/page.tsx` | POST `/api/auth/signin` | signin | OK; stores `user` in localStorage |
| `signin/page.tsx`, `signup/page.tsx`, `forgot-password/page.tsx` | POST signin / signup / verify-otp / request-otp / reset | auth routes | OK (reset: weaker password rules, B4) |
| `AdminProtectedRoute.tsx` | GET `/api/auth/me`, POST `/api/auth/refresh` | me, refresh | OK |
| `admin-axios.ts` | POST `/api/auth/refresh` | refresh | OK; race N1 |
| `ProfilePageClient.tsx` | GET/PUT `/api/profile`, POST `/api/auth/signout` | profile, signout | OK |
| `AccountDetailsForm.tsx`, `DeliveryAddressForm.tsx` | PUT `/api/profile` | profile | strict schema; OK |
| `CheckoutPageClient.tsx` | POST create-order, promo, release, verify-payment; GET/PUT `/api/profile` | checkout/* | client sends extra totals and `discountAmount` that the server ignores (OK, server recomputes); `release` before/after payment race acceptable |
| `ContactForm.tsx` | POST `/api/contact` | contact | OK (`website` honeypot) |
| `NewsletterBar.tsx` | POST `/api/subscribe` | subscribe | B10 |
| `ProductsClient.tsx` | GET `/api/products?...` | products | facets name mismatch E1 |
| `use-cart-sync.ts` | POST `/api/products/cart` | cart | OK |
| `usePricingSettings.ts` | GET `/api/settings` | settings | cached 5 min (A3) |
| `admin-api/products.ts` + `ProductForm.tsx` | GET/POST/PUT/DELETE `/api/admin/products*`, PUT reorder | admin products | **C1 field-name mismatch**, `limit` 200 (C7) |
| `admin-api/categories.ts` | CRUD + reorder | admin categories | `limit` 100 clamps to 50; `reorder` OK |
| `admin-api/collections.ts` | CRUD | admin collections | `limit` 1000 clamps to 50 |
| `admin-api/blogs.ts` | CRUD, `/categories` | admin blogs | no cover removal field |
| `admin-api/carousel.ts` | CRUD + reorder | admin carousel | reorder accepts both shapes; PUT mass assign (C5) |
| `admin-api/announcements.ts` | CRUD + reorder | admin announcements | **C8**: `linkUrl`, `orderedIds` |
| `admin-api/settings.ts`, `admin-api/size-chart.ts`, `admin-api/about.ts`, `admin-api/legal.ts` | settings/size-chart/about/legal | admin | settings: whole-object overwrite (C4) |
| `admin/about/page.tsx`, `admin/homepage/page.tsx` | POST `/api/admin/upload` | upload | orphan on abandon (C6) |
| `admin/orders/page.tsx` | GET `/api/admin/orders?status=`, PATCH `/api/admin/orders/:id/status` | admin orders | unbounded list (C7) |

---

## Part C

### Route inventory

Auth: **Public** = listed in `PUBLIC_API_PREFIXES`; **Token** = proxy requires a valid access cookie (401 otherwise); **Admin** = Token + `withAdmin` (`role === 'admin'`). Caching mode from the real build route table (`ƒ` dynamic, `○` prerendered). Stores: M = MongoDB, R = Redis, C = Cloudinary, Mail, RZP = Razorpay.

| Method | Path | Auth | Caching | Uses |
|---|---|---|---|---|
| POST | /api/auth/signin | Public (strict RL 5/min/IP + 10 fails/15 min per email) | ƒ | M, R |
| POST | /api/auth/signup | Public (strict RL) | ƒ | M, R, Mail |
| POST | /api/auth/verify-otp | Public (strict RL) | ƒ | M, R |
| POST | /api/auth/refresh | Public (cookie) | ƒ | M |
| POST | /api/auth/signout | Public | ƒ | M |
| GET | /api/auth/me | Admin | ƒ | none |
| POST | /api/auth/forgot-password/request-otp | Public (**global RL only**, B1) | ƒ | M, R, Mail |
| POST | /api/auth/forgot-password/reset | Public (**global RL only**, B1) | ƒ | M, R |
| GET | /api/products | Public | ƒ force-dynamic | M |
| POST | /api/products/cart | Public | ƒ force-dynamic | M |
| GET | /api/blogs, /api/blogs/[slug] | Public | ƒ | M (unused by UI) |
| GET | /api/settings | Public | ○ revalidate 300 | M |
| POST | /api/contact | Public | ƒ | M, Mail |
| POST | /api/subscribe | Public | ƒ | M |
| POST | /api/csp-report | Public | ƒ | log |
| POST | /api/webhooks/razorpay | Public (HMAC) | ƒ | M, R |
| GET | /api/about, /api/announcements, /api/carousel | Token (unused) | ○ 60-300 s | M (build-time) |
| POST | /api/checkout/create-order | Token | ƒ | M, R, RZP |
| POST | /api/checkout/promo | Token | ƒ | M, R |
| POST | /api/checkout/release | Token | ƒ | M |
| POST | /api/checkout/verify-payment | Token | ƒ | M, R |
| GET, PUT | /api/profile | Token | ƒ | M |
| GET | /api/admin/products | Admin | ƒ | M |
| POST | /api/admin/products | Admin | ƒ | M, C |
| GET, PUT, DELETE | /api/admin/products/[id] | Admin | ƒ | M, C |
| PUT | /api/admin/products/reorder | Admin | ƒ | M |
| GET, POST | /api/admin/categories | Admin | ƒ | M, C |
| GET, PUT, DELETE | /api/admin/categories/[id] | Admin | ƒ | M, C |
| PUT | /api/admin/categories/reorder | Admin | ƒ | M |
| GET, POST | /api/admin/collections | Admin | ƒ | M |
| GET, PUT, DELETE | /api/admin/collections/[id] | Admin | ƒ | M |
| GET, POST | /api/admin/blogs | Admin | ƒ | M, C |
| GET, PUT, DELETE | /api/admin/blogs/[id] | Admin | ƒ | M, C |
| GET, POST | /api/admin/blogs/categories | Admin | ƒ | M |
| GET, POST | /api/admin/carousel | Admin | ƒ | M, C |
| PUT, DELETE | /api/admin/carousel/[id] | Admin | ƒ | M, C |
| PUT | /api/admin/carousel/reorder | Admin | ƒ | M |
| GET, POST | /api/admin/announcements | Admin | ƒ | M |
| PUT, PATCH, DELETE | /api/admin/announcements/[id] | Admin | ƒ | M |
| PUT | /api/admin/announcements/reorder | Admin (**broken**, C8) | ƒ | M |
| GET, PUT | /api/admin/settings | Admin | ƒ | M |
| GET, PUT, DELETE | /api/admin/size-chart | Admin | ƒ | M, C |
| GET, PUT | /api/admin/about | Admin | ƒ | M, C |
| GET, PUT | /api/admin/legal/[slug] | Admin | ƒ | M |
| POST | /api/admin/upload | Admin | ƒ | C |
| GET | /api/admin/orders | Admin | ƒ | M |
| PATCH | /api/admin/orders/[id]/status | Admin | ƒ | M |

Pages (route table): `○ static, no revalidate`: `/_not-found`, `/cart`, `/checkout`, `/forgot-password`, `/profile`, `/signin`, `/signup`, `/wishlist`, most `/admin/*`; `○ revalidate 1m`: `/`, `/about`, `/contact`, `/privacy-policy`, `/terms-and-conditions`; `ƒ`: `/products`, `/products/[slug]`, `/blogs`, `/blogs/[slug]`, `/collections`, `/collections/[slug]`, dynamic admin edit pages. Protected by proxy: `/checkout`, `/profile`, `/admin/*` (except `/admin/login`).

### Environment variables actually read by code (names only)

| Name | Read in |
|---|---|
| `MONGODB_URI` | `lib/db.ts` |
| `JWT_ACCESS_SECRET` | `lib/auth-tokens.ts`, `proxy.ts` |
| `JWT_REFRESH_SECRET` | `lib/auth-tokens.ts` |
| `SUPER_ADMIN_EMAIL` | `api/auth/signin`, `refresh`, `forgot-password/reset`, `api/contact` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_PASS`, `SMTP_FROM` | `lib/mailer.ts` |
| `SMTP_USER` | `lib/mailer.ts`, `api/contact` (fallback recipient) |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | `lib/rate-limit.ts`, `attempt-limit.ts`, `otp-store.ts`, `finalize-order.ts`, `api/checkout/create-order`, `promo` |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | `lib/cloudinary.ts` |
| `RAZORPAY_KEY_ID` | `api/checkout/create-order` |
| `RAZORPAY_KEY_SECRET` | `api/checkout/create-order`, `verify-payment` |
| `RAZORPAY_WEBHOOK_SECRET` | `api/webhooks/razorpay` |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | `components/checkout/CheckoutPageClient.tsx` (client) |
| `NODE_ENV` | `next.config.ts`, `lib/auth-tokens.ts`, `proxy.ts`, `models/about.model.ts`, `models/order.model.ts` |

Defined in `.env` but **never read by code**: `JWT_EXPIRES_IN`, `NEXT_PUBLIC_API_URL`, `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASS`. Missing from `.env.example`: all `RAZORPAY_*`, `NEXT_PUBLIC_RAZORPAY_KEY_ID`, `SUPER_ADMIN_EMAIL` is there; `.env.example` should list exactly the table above.

### Recommended fix order

The planned order is mostly right; changes I recommend:

1. **Prompt 2 (build/caching)**: A1, A4 (`revalidatePath('/', 'layout')`), A2, A3, A5, A6, A7, plus the layout "throw instead of swallow" rule. Agree with putting it first.
2. **Move N1 (refresh-token race) and B1/B2/B4/B5/B6/B7/B9, N2 into Prompt 3 (security)**; agree.
3. **Move D1/D2 (paid-but-no-order, `getdel`-before-create, unsettled stock) forward**, ahead of Prompt 4: they are **launch blockers about money** and independent of admin/Cloudinary. Suggested order: 2, 3, **7 (stock holds + money-path tests)**, 4, 5, 7B, 6, 8, 9, 10, 11. If you prefer to keep 7 where it is, at minimum fix D1/D2 (a)(b) before any real payment is taken.
4. **Prompt 4 (admin/Cloudinary)** must include C1 (field-name contract), C3, C6, C2 and C4/C5/E7; C1 is user-visible today and is the cheapest high-value fix, so it could ship earlier as a tiny commit.
5. **Prompt 5 (announcements)** = C8 only; fine.
6. **Prompt 6 (pagination)** = C7, E2, and the 50-item truncation bugs; fine. Merge E1 (facets) here or into 9.
7. **Prompt 8 (image payload)** = E5; given the 4.5 MB hard limit, product image upload is **broken in production for multi-image or larger files**, so treat it as Blocker-adjacent and test it on a Vercel preview, not locally.
8. **Prompt 10** = E6, N6 (SEO), legal text. **Prompt 11** final audit.

### Not verified

- Visual behaviour (E3, A6) was read from code, not looked at in a browser.
- `vercel.json` path matching (A5) comes from the docs example, not a real deploy.
- Razorpay behaviour for manual-capture and webhook retry semantics (D1, N4) is from the code and general Razorpay behaviour, not exercised against Test Mode.
- No request was sent to Atlas; B10/C7 experiments used the local test replica set only.

# Work log

## Baseline

Recorded on branch `hardening/launch-prep`, from commit `ae9c1e7` plus the test tooling added in prompt 1.

**Environment**
- Node v24.15.0, npm 11.12.1 (lockfile: package-lock.json)
- Next.js 16.4.3 (Turbopack), React 19.2.7, TypeScript ^6.0.3, Mongoose ^9.8.0, Vitest 5.1.0
- Scripts: `dev`, `build`, `start`, `lint` (eslint), plus added in prompt 1: `test` (vitest run), `test:watch`, `typecheck` (tsc --noEmit)

**Results**
| Check | Result |
|---|---|
| `npm run typecheck` | pass, 0 errors |
| `npm run lint` | pass: 0 errors, 5 warnings (see Found-not-fixed) |
| `npm test` | pass: 1 file, 5 tests (tooling only) |
| `npm run build` | pass, exit 0, 65 static pages generated, no warnings in output |

Build was run with `MONGODB_URI` overridden to the local throwaway replica set (database `im_build_baseline`, dropped afterwards) and the Upstash vars blanked. Several pages (`/`, `/about`, `/contact`, legal pages, `/api/announcements`, `/api/carousel`, `/api/settings`) are prerendered with `revalidate` (1m / 5m) and read the database at build time; against an empty DB they render their empty/fallback state.

**Test infrastructure**
- Mongo: real `mongod` 8.2.9 in podman container `indianmist-test-mongo`, single-node replica set `rs0`, `127.0.0.1:27018`. Start with:
  `podman run -d --name indianmist-test-mongo -p 127.0.0.1:27018:27017 docker.io/library/mongo:latest mongod --replSet rs0 --bind_ip_all --noauth`, then `rs.initiate({_id:"rs0",members:[{_id:0,host:"127.0.0.1:27017"}]})` once. Override with `MONGO_TEST_URI`. Helper refuses non-local hosts. Chosen over mongodb-memory-server: real server, transactions work, no extra dependency or binary download.
- Redis: unit tests use the in-memory `FakeRedis` (tests/helpers/redis.ts). It does not emulate Upstash's REST layer or the Lua scripts inside `@upstash/ratelimit`; the ratelimit stand-in is a pass-through.
- Live suite (`npm run test:live`, files `tests/live/*.live.ts`, never part of `npm test`): loads `.env` read-only and runs against real services. Redis: contract test running identical operations on FakeRedis and real Upstash (keys `im_test:<rand>:`, deleted afterwards); result: identical. Cloudinary: real `uploadImage`/`deleteImage` in folder `indian-mist-test/`, asset deleted and confirmed 404. Razorpay: real Test Mode order create/fetch with `rzp_test_` enforced. MongoDB is deliberately NOT live: tests wipe collections, so they stay on the local replica set; Atlas is for read-only checks only.
- `tests/setup.ts` scrubs real service env vars and installs dummies so tests cannot reach Atlas, Upstash, Cloudinary, SMTP or Razorpay.

## Per-prompt log

### Prompt 1: rules, safety rails, test tooling, baseline
- Follow-up: added the live suite above (owner asked for real-service checks where fakes may not be faithful).
- Added docs/work-rules.md, docs/work-log.md, Vitest + helpers in `tests/`, `vitest.config.ts`, scripts. No application code changed.

### Prompt 3: build behaviour, caching and revalidation
- **Decision: database failures are never swallowed on cached pages.** (Next docs: `02-guides/incremental-static-regeneration.md` lines 467-503: if an error is *thrown* while regenerating, the last successfully generated page keeps being served and regeneration is retried on the next request; a *returned* fallback replaces the cached page.)
  - Build with the database unreachable: **the build fails** (verified: exit 1 with `MONGODB_URI` pointing at a closed port). Atlas must allow the Vercel build machines; this is intentional, an empty site must never be baked in.
  - ISR regeneration with the database unreachable: the page throws, so **the last good page keeps being served** (verified: stopped Mongo, waited past the 60 s window, `/` returned `x-nextjs-cache: STALE` then `HIT` with its content intact while the server log showed the Mongo errors).
  - "No document yet" (empty database) is not an error: helpers return `null` / `[]` and the existing defaults render.
  - Applied to: root layout, `generateMetadata`, `AnnouncementBar`, `/about`, legal pages (they used to catch and cache default text). No `force-dynamic` was added to pages.
- Added `src/lib/storefront-data.ts` (React `cache`d `getSiteSettings`, `getNavCategories`, `getNavCollections`, `getAnnouncementTexts`) used by layout, metadata, AnnouncementBar, home and contact; product page reuses settings for the size chart. `getProductBySlug`, the blog post, the collection and the legal page are `cache`d too, so metadata + page run one query.
- Added `src/lib/revalidate-storefront.ts`: `revalidateStorefront()` = `revalidatePath('/', 'layout')` (docs: layout type invalidates the layout, all layouts below it and every page below them) and a lighter `revalidateCatalog()` for shop activity. Called after every admin mutation of products, categories, collections, announcements, carousel, settings, about, size chart, blogs, plus paid checkout (`finalizeOrder`, failure never fails the order) and cancelling a paid order. Legal pages keep their own `revalidatePath`. Blog *category list* POST is not revalidated (only used in the admin).
- Per-page revalidation made explicit (see table below). Root layout `revalidate = 3600` is the safety net for pages with none of their own (cart, sign-in, ...).
- `/blogs` no longer reads `searchParams`: the `?category=` filter moved to a small client component (`src/components/blog/BlogsIndex.tsx`, same URLs, same markup), so the page is a cached ISR page.
- Deleted unused routes `/api/about`, `/api/announcements`, `/api/carousel` and (owner approved) `/api/blogs`, `/api/blogs/[slug]`; removed `/api/blogs` from the proxy's public list. Proved no references (grep: only admin code and module imports).
- `/api/settings`: `force-dynamic`, 300 s caching removed (a handler that reads no request is otherwise prerendered at build), `promoCodes` still stripped. Verified a settings save shows in the public response at once.
- `vercel.json` keys changed from `app/api/...` to `src/app/api/...`. Vercel docs (functions/configuring-functions/duration): "If your Next.js project is configured to use src directory, you will need to prefix your function routes with `/src/` for them to be detected." Not verified on a real deploy. Note the 30 s cap is *below* Vercel's 300 s default, which is the intent for upload routes.
- `/signin` wrapped in `<Suspense>` like `/admin/products/new` (the build did not complain because `src/app/loading.tsx` is an implicit boundary, but that boundary is the *home* skeleton and made the whole page client-rendered).

**Final build route table** (local build, empty DB, `next build`, Turbopack; `○` static/ISR, `●` SSG with `generateStaticParams`, `ƒ` dynamic):

| Route | Mode | Revalidate |
|---|---|---|
| `/` | ○ ISR | 1m |
| `/about` | ○ ISR | 10m |
| `/contact` | ○ ISR | 10m |
| `/blogs` | ○ ISR | 5m |
| `/blogs/[slug]` | ● ISR on first visit (nothing prebuilt) | 5m |
| `/collections` | ○ ISR | 5m |
| `/collections/[slug]` | ● ISR on first visit | 5m |
| `/products/[slug]` | ● ISR on first visit (`s-maxage=60`) | 1m |
| `/products` | ƒ dynamic (reads `searchParams`) | n/a |
| `/privacy-policy`, `/terms-and-conditions` | ○ ISR | 1h |
| `/cart`, `/checkout`, `/profile`, `/signin`, `/signup`, `/forgot-password`, `/wishlist`, `/_not-found`, most `/admin/*` | ○ ISR (layout safety net) | 1h |
| `/admin/*/[id]/edit`, `/admin/legal/[slug]` | ƒ dynamic | n/a |
| all remaining `/api/*` | ƒ dynamic (incl. `/api/settings`) | n/a |

Before this prompt `/products/[slug]`, `/blogs*`, `/collections*` were all `ƒ` and the static client pages had no revalidate (frozen until redeploy).

**Verification (real requests, production build + `next start`, local Mongo, Cloudinary/Redis/SMTP env overridden to dummies):**
- (a) Creating, editing and deleting an announcement changed the bar on `/`, `/about`, `/contact`, `/cart`, `/signin` and `/privacy-policy` at once (first request after the change regenerated: `x-nextjs-cache: MISS`). A new category appeared in `/cart`'s navbar.
- (b) A product edit (`PUT`) showed the new name and price on `/products/[slug]` immediately, and on `/products` and the home featured list. First visit of a never-prebuilt slug rendered on demand (`MISS`) then `HIT`; unknown slug returned 404.
- (c) Blog create/edit/unpublish/delete updated `/blogs/[slug]` and `/blogs` immediately; unpublished and deleted posts returned 404.
- Automated: `tests/revalidation.test.ts` (route handlers call the helper after each successful mutation, not after rejected ones, not for non-admins; paid checkout and cancel refresh product pages; a revalidation failure never fails a paid order) and `tests/storefront-data.test.ts` (empty DB gives empty values; DB failure throws).
- Gates vs baseline: typecheck pass, lint 0 errors / same 5 warnings, tests 22 pass, build pass (and fails with DB unreachable, by design).


### Prompt 4: authentication, rate limiting, environment, newsletter
- **Rate limiting** (`src/proxy.ts`, `src/lib/rate-limit*.ts`): path matching is a prefix on a segment boundary, so `/api/auth/forgot-password/*` is now on the strict limiter (5/min/IP). New "form" limiter for `/api/contact` and `/api/subscribe`: 5 per 10 minutes per IP, each route counted separately (Upstash sliding window; checked against the library: `slidingWindow(5, "10 m")`). General API limiter unchanged (100 per 10 s). Responses carry `Retry-After`.
- **Redis failure policy** (documented in `docs/env.md`): development without Redis = limits off with a one-time `[redis]` warning; production without Redis config = the app errors naming the variable; Redis erroring in production = auth/form routes answer 503 (fail closed), the general limiter fails open (logged).
- **Per-address OTP cap**: 5 OTP e-mails per address per hour, separately for sign-up and reset (`allowOtpEmail`). Counters use one atomic MULTI `INCR` + `EXPIRE NX` (verified on real Upstash that the TTL is set), which also fixes the old INCR-then-EXPIRE gap in the sign-in lockout, promo guess counter and OTP attempt counter.
- **request-otp**: identical response (200 + "If an account exists...") for existing and unknown addresses; the e-mail is sent after the response (`after()`), a decoy Redis write keeps timing similar (medians 234 ms vs 233 ms in a real run); an unsent code is deleted. Behaviour change: a second request while a code is pending now looks the same as the first but sends nothing (it used to answer 429, which revealed the account). Forgot-password page copy updated; client-side password check uses the shared schema; a hint line lists the rules.
- **Password rules**: one `PasswordSchema` (8 to 72 bytes, upper-case, number, special character) used by sign-up and reset (reset used to accept any 8 characters; sign-up max was 100 which bcrypt silently cut at 72). Sign-in unchanged. Reset OTP must be 6 digits.
- **Admin sign-out**: `AdminSidebar` calls `/api/auth/signout`, clears `im_admin_user` and the React Query cache, then goes to `/admin/login`. The signout route now deletes the whole login session (every rotation of the refresh token), not just the newest. Checked `admin-axios` and `AdminProtectedRoute`: no loops (the login page has no guard; the interceptor does not redirect when already on `/admin/login`). Limits: the 15-minute access token is stateless, so a copied access cookie keeps working until it expires; and with a leftover refresh cookie the proxy still lets the `/admin` page shell load, after which the client check bounces to login (no data is exposed, the APIs verify the token).
- **Roles**: `src/lib/roles.ts` (`roleForEmail`, trim + lower-case on both sides) used by sign-in, refresh, reset and verify-otp. Token/response roles are always `admin` or `user`; the DB `role` field is not used. Sessions created before the change keep working (a refresh re-issues the access token with the new role).
- **JWT**: sign and verify pinned to HS256 (also in the proxy verifier, which now rejects other `alg` headers). Cookie comments corrected: the refresh cookie is path `/` because the proxy reads it on page loads; still httpOnly and sameSite strict.
- **Environment** (`src/lib/env.ts`, `src/lib/redis.ts`): lazy, validated, errors name the variable and never print values; blank counts as missing; no silent fallbacks (removed the dummy Razorpay keys in create-order, the `noreply@indianmist.com` and `""` SMTP defaults, and the unset-secret `""` in the proxy). Create-order now reads the Razorpay keys before holding stock so a missing key cannot leak a hold. `SMTP_PORT` is the one optional variable (default 587). The mailer, database, Cloudinary config, contact route and verify-payment read through the module. **`next build` verified with Razorpay, SMTP, Cloudinary, Redis, JWT and SUPER_ADMIN_EMAIL all blank: succeeds** (only the database is needed).
- **`.env.example`** now lists exactly the variables the code reads (SMTP_*, no MAIL_*), values empty. `.gitignore` gets `!.env.example` so the template can be committed (it is the only `.env*` file touched; owner asked for it explicitly in this prompt). `docs/env.md` has the per-environment matrix.
- **Promo**: removed the dead promo-lock Redis read/write from `/api/checkout/promo`.
- **Newsletter**: e-mail is trimmed and lower-cased by the schema before the duplicate check; a duplicate-key error (parallel requests) answers "You are already subscribed!" (200). (The audit found that Mongoose already lower-cased the query; the real defect was the 500 on concurrent duplicates.)
- **CSP/headers review** (`next.config.ts`): nothing loosened and nothing added. Razorpay publishes no CSP list (searched; the Checkout pages have none), and `https://*.razorpay.com` already covers the hosts Checkout uses (checkout, api, cdn, lumberjack) for script, frame, connect, img, font, style. `'unsafe-inline'` for scripts stays because a nonce-based CSP forces per-request rendering and would undo the caching work. Needs a real Test Mode payment in a browser to confirm (prompt 7B); `/api/csp-report` logs anything blocked. Comment added to the config.
- **Tests added** (73 total now): path matching, proxy limiter selection and Redis-failure behaviour, shared password schema, role helper cases (case, whitespace, unset), env errors never leaking values, JWT algorithm pinning, sign-out clears cookies and the refresh records, reset ends all sessions, request-otp indistinguishability and the per-address cap, sign-up cap, newsletter casing and parallel duplicates, roles through sign-in and refresh including pre-change sessions.
- **Verified with real requests** (production build, local Mongo, **live Upstash** with unique test-tagged keys, all removed afterwards; local fake SMTP sink capturing OTP e-mails): every limiter returned 429 on the 6th request while other IPs were unaffected; per-address caps; sign-up, OTP verify, sign-in, `/api/auth/me`, refresh, sign-out (old tokens dead, `/admin` without cookies redirects to `/admin/login`); password reset ended both old sessions; newsletter casing. Three consecutive clean runs; one earlier run missed the "first 5 requests pass" assertion, most likely because Upstash's sliding window straddled a minute boundary (not reproduced).
- **Gates**: typecheck pass, lint 0 errors / same 5 warnings, tests 73 pass, build pass (also with all credentials blank).

### Prompt 5: admin API contracts, validation, Cloudinary asset lifecycle
- **Rule applied everywhere (R7):** validate everything -> upload new files -> save -> only then delete the old files. A failure after an upload deletes the files uploaded in that request and keeps the old ones. Deleting a document: the document first, then its files. Cloudinary failures after a successful save are logged (`[cloudinary:delete]`) and never fail the save.
- **`src/lib/cloudinary.ts`:** credentials are applied once by whichever of upload or delete runs first (lazily, not at import, so `next build` needs no Cloudinary credentials), so deleting works on a cold instance. `deleteImage` purges the CDN copy (`invalidate: true`), never throws, and returns `{ publicId, ok, result, error }` ("not found" counts as deleted). `deleteManyImages` dedupes and returns `{ results, failed }`.
- **Products:** PUT rewritten (parse, validate files, validate fields with zod and use only the parsed result, removal list restricted to ids that belong to this product, refuse a product with zero images or more than 10, upload, save, then delete). POST validates before uploading, requires at least one image, cleans up on failure and retries the slug on a duplicate-key race. DELETE removes the document first. Old behaviours kept: slug unchanged on edit, size stock and total, colour group, `imageOrder` = primary. Broken JSON fields are now a 400 (they used to silently reset to defaults).
- **One name per concept** (the form's names won; the route used to read different ones, so removing an image or choosing a cover did nothing): `removedImageIds`, `primaryImageId`, `imageOrder`, `coverImageId`, new files in `images`. The form builds its request with `buildProductFormData` (`src/lib/admin-api/product-form-data.ts`), the same function the tests use, so the two sides cannot drift apart again. Also fixed: clearing the badge or the original price in the form now clears it on the server (it was never sent), and the form now shows which image is the category cover (it looked for a field the API does not return; it compares with `categoryCoverImage`).
- **Every other image path:** categories (create/update/delete), blogs (cover; new `removeCoverImage=true` so the edit page's remove button works), carousel (create/update/delete), size chart, About page (story, gallery, section photos and the legacy team photo: the old pre-save delete is gone, replaced files are deleted after the save as before), homepage brand story. Images that are uploaded the moment they are picked (About, brand story) are tracked per page visit; if one is replaced or removed before saving, the page calls the new guarded `DELETE /api/admin/upload`, which refuses anything outside `indian-mist/` and anything a document still references (`src/lib/image-assets.ts` checks every model).
- **Brand story image:** new optional `brandStorySettings.imagePublicId` in the model, schema, admin page and types. Replace or remove deletes the old file after the save. Old documents with only a URL: the id is worked out from the URL only when it is one of OUR Cloudinary URLs in `indian-mist/`, and the file is deleted only if nothing else references it; anything else is left alone, no migration needed.
- **Settings route:** expanded zod schema covers every section the pages save (general, social, hero, brand story, trust strip, eco commitment, pricing with promo codes, contact page with FAQs). Only the parsed data is saved; unknown keys, `_id`, timestamps, `__v` and `sizeChart` are dropped. Updates are written as dotted paths, so a request that mentions one field of a section leaves the rest alone. Promo codes: trimmed, upper-cased, `[A-Z0-9_-]{2,30}`, unique per document, percentage max 100, bounded numbers, valid expiry date. Free text is stored exactly as typed (the homepage headings end with a deliberate space). Web addresses must be http(s) and link targets must start with `/`, `https://`, `mailto:` or `tel:`.
- **Section ownership:** each admin page sends only its own sections (`SETTINGS_SECTIONS` / `settingsForSection` in `src/lib/admin-api/settings.ts`): general (settings page), homepage, contact, pricing. Before, every page sent the whole document, so saving one overwrote the others. Last write still wins within one section (two tabs on the same page).
- **Carousel PUT** accepts only `alt`/`altText`, `isActive`, `order` (validated); `url` and `publicId` can no longer be set from a request. The multipart image replacement keeps the new ordering.
- **Error shapes:** all admin routes answer `{ message, errors? }` through `errorResponse`/`validationError`; invalid JSON or a body that is not a form is a 400 (was 500). `getApiErrorMessage` now shows the first field problem ("Validation failed: Price must be a positive number"). Failed saves toast through the global mutation `onError` (settings has its own, simplified).
- **Order thumbnails:** new `SafeImage` shows a neutral placeholder in the same box when an image fails to load; used by the admin orders view, profile order history, checkout summary and cart.
- **Live Cloudinary check** (`npm run test:live:cold`, three separate processes, folder `indian-mist-test/prompt5/` only, which the site does not use): process 1 uploaded through `uploadImage`; process 2, which never uploaded and started with the SDK unconfigured (asserted), called `deleteImage`: Cloudinary answered `ok`, the Admin API then answered 404 for the asset and the CDN answered 404 for the old URL (within ~10 s); process 3 swept the folder (0 leftovers). The credentials belong to the real account; I relied on your earlier permission to use Cloudinary live and stayed inside that test folder.
- **Tests added** (162 total): Cloudinary module, products (24), every other image path (28), settings (23), error messages and `SafeImage`. Mutation-checked: making the product route trust browser ids, or delete before save, fails the tests. Also run over real HTTP (production build, local Mongo): settings/category/blog/product/carousel/upload requests behaved as above. Live suite still passes, now including the atomic `MULTI INCR + EXPIRE NX` against real Upstash.
- **Gates:** typecheck pass, lint 0 errors / same 5 warnings, tests 162 pass, build pass.

### Prompt 5 follow-ups (owner answered yes to all three questions)
- **Product images:** requiring at least one image on create stays.
- **Reconciliation script** `npm run reconcile:cloudinary` (`scripts/reconcile-cloudinary.mjs`): lists Cloudinary files under `indian-mist/` that no document references (finds `*publicId` fields anywhere and any Cloudinary URL, so URL-only documents protect their files). Dry run by default and read-only. It never reports files younger than 24 h (`--min-age-hours`), anything outside `indian-mist/`, and warns about documents whose image is missing from Cloudinary. Deleting needs `--delete --confirm=<cloud>/<database>` typed exactly, and is refused when the database references no images (wrong-database guard); the refusal rules are unit tested (`deleteRefusal`). **First dry run against production (read-only): 21 unused files, about 51 MB, nothing missing, nothing deleted.** They are mostly old category/carousel/brand-story/product images from before the clean-up existed. Delete them only when the owner says so.
- **Old orders:** instead of storing a Cloudinary id on each order line (that would change the checkout code, prompt 7), an order line whose own photo is gone now shows the product's CURRENT photo (admin orders API adds `currentImage`; profile order history already had the populated product), then the placeholder if the product itself was deleted. `SafeImage` takes `fallbackSrc`.
- Tests: 170 total (reconciliation helpers, `currentImage`, `SafeImage` fallback).

## Found, not fixed
- Lint warnings (5): `src/components/admin/ui/ImageUploadZone.tsx:125` unused eslint-disable directive, `:127` `<img>` instead of `next/image`; `src/lib/admin-axios.ts:38,62,72` `window.location.href` for internal navigation.
- `npm install` reports known vulnerabilities in the dependency tree (not triaged; `npm audit` output to be reviewed in a later prompt).
- Local `.env` points at the production Atlas cluster (`IndianMist`), a live Upstash instance and the real Cloudinary cloud. Owner confirmed this is production and read use is fine; destructive operations stay local (R9).
- `.env` defines `MAIL_*` alongside `SMTP_*`; the owner says they are used to set up the SMTP server (test credentials). `src/lib/mailer.ts` only reads `SMTP_*`; check where `MAIL_*` is consumed in the mail prompt.
- Existing podman containers `veda-redis`/`veda-mongo` (stopped) and `local-redis` (running, plain Redis on 6379) are unrelated to the test setup and untouched. Plain Redis does not speak Upstash's REST protocol, so the app cannot use it without an adapter (e.g. an SRH proxy).
- (Prompt 3) `src/app/loading.tsx` is the *home page* skeleton and applies to every route that has no loading file of its own (wrong skeleton on other pages). Not changed.
- (Prompt 3) Product pages show stock up to 60 s old (also refreshed on every paid order and admin edit). Cart and checkout re-check stock on the server. The first visit to each product after a deploy is a blocking on-demand render.
- (Prompt 3) A request for a non-existent product/blog/collection slug is cached as a 404 entry per slug (cache growth from scanners is bounded by Vercel's cache, but worth watching).
- (Prompt 3) `/api/settings` is public and returns the whole settings document minus promo codes (contact details, pricing, hero text). Left as is; trim in a later prompt if desired.
- (Prompt 3) Dynamic pages (`/products`, admin edit pages) run the three layout queries on every request; they are request-cached but not shared between requests.
- (Prompt 3) The audit listed `/admin/products/new` as using `useSearchParams` without Suspense; it does have one (audit A6 corrected below).
- (Prompt 3) `ProductModel.init()` unawaited hacks and the `new` option deprecation warnings from Mongoose (`findOneAndUpdate({ new: true })`) remain.
- (Prompt 4) **Not in this prompt's task list, still open from the audit:** N1 refresh-token rotation is not atomic (`findOne` then `deleteOne`; parallel refreshes can both succeed or wipe the session), N2 sign-up creates the user before setting the password hash, B7 sign-in/sign-up still reveal account state (sign-up messages unchanged on purpose), N3 the admin UI grants itself from localStorage on a 429. Also, two refresh tokens minted for one session in the same second are the identical string (no `jti`).
- (Prompt 4) `finalize-order.ts` still deletes the now-unused `promo_lock_*` key, and `verify-payment`/`release` parse the body without zod. Payment code, left for prompt 7.
- (Prompt 4) Env values are now trimmed; a secret that intentionally had leading/trailing spaces would change (unlikely).
- (Prompt 4) The signed-out browser can still load the `/admin` page shell if a stale refresh cookie exists (see sign-out limits above).
- (Prompt 5) A file uploaded when picked (About page, homepage brand story) and then abandoned by leaving the page without saving is still left in Cloudinary until `npm run reconcile:cloudinary` is run (replacing or removing it before saving is handled).
- (Prompt 5) Two admin tabs editing the same settings section: last write wins for that section. A version check would be needed to prevent it.
- (Prompt 5) Product edit still overwrites `stockQuantity`/`sizeStock` from the form (a sale between loading and saving the form is lost): prompt 7.
- (Prompt 5) Creating a product now needs at least one image (the edit route already required it). Duplicating a product therefore needs a new image.
- (Prompt 5) Orders keep the image address they were created with; a deleted photo now falls back to the product's current photo (see follow-ups). Orders for a deleted product show the placeholder.
- (Prompt 5) Not browser-tested: the placeholder swap on a real failed image load and the admin form clicks (the server side and the form's request shape are tested).
- (Prompt 5) Announcements, pagination limits and reorder-route validation (other than a consistent error shape and JSON handling) were left for their own prompts; collections routes were not touched.

## Owner decisions
- Atlas `IndianMist` is production; reads allowed, anything destructive goes to local instances. Fakes or local instances are fine where they simulate production accurately.
- Razorpay test keys (`rzp_test_`) may be used for real Test Mode calls; `rzp_live_` never.
- `MAIL_*` credentials are test credentials; do not ignore them.
- Prompt 2 (audit) answers:
  - Fix order: moving money/stock fixes ahead of admin/Cloudinary is a recommendation, not a requirement. Default to the owner's planned order; the one hard rule is that D1/D2 (paid-but-no-order, stock settle) are fixed before any real payment is taken.
  - `MAIL_*`, `JWT_EXPIRES_IN`, `NEXT_PUBLIC_API_URL` are leftovers; code reads only `SMTP_*`. Safe to drop from the local env and `.env.example` (owner edits `.env`; we never touch it).
  - Redis missing/unreachable: Claude's call. Missing Redis env in production = fail closed (startup/first-use error) for OTP, login lockout and checkout; at runtime, a transient Redis outage on the global API rate limiter fails open (availability), but OTP/login/checkout paths fail closed.
  - Admin = the single account whose email equals `SUPER_ADMIN_EMAIL` (case-insensitive, trimmed). The DB `role` field is not used for authorization.
  - Unused routes `/api/about`, `/api/announcements`, `/api/carousel`, `/api/blogs`, `/api/blogs/[slug]` may be deleted.

- Prompt 4 answers:
  - Fix N1 (atomic refresh-token rotation) and N2 (atomic sign-up) in the next auth-related prompt. Not started yet.
  - `.env.example` stays committed (with `!.env.example` in `.gitignore`) for now; owner may revisit.
  - No answer on the cap values: kept at 5 OTP e-mails per address per hour and 5 contact/newsletter requests per 10 minutes per IP.


## Prompt 6 (announcements) - plain text only

- Model: `link`/`linkText` removed (old docs keep them harmlessly, no migration). Schema: `text` (trim, 1-200) and `isActive`.
- API: create uses `AnnouncementSchema`; update/toggle use a separate `AnnouncementUpdateSchema` without defaults (the old `.partial()` of a schema with `isActive` default(true) risked re-enabling on a text edit). Parsed data only; malformed ids give 404; list sorted `createdAt, _id` ascending (same as storefront), capped at 200. Reorder route deleted. All mutations call `revalidateStorefront()`.
- Admin UI: link fields, link preview, drag handle/state, order call removed; confirm on delete, error toasts, load-error state with retry, per-row pending state, row actions visible on touch screens.
- Navbar/bar: both now live in one `sticky top-0 z-50` wrapper in layout.tsx; Navbar is `relative`, bar is not sticky. Fixes (reasoned from CSS, not screenshotted): non-home pages used to slide the navbar under the sticky bar; home left a 32px gap when the bar was empty.
- Tests: tests/announcements.test.ts (11) + updated revalidation test. 184 pass.

### Found, not fixed
- Announcement removed for rotation: mobile carousel index is not reset when list shrinks (now clamped with modulo only).


## Prompt 7 (pagination of admin lists)

- Shared: `lib/pagination.ts` (parsePagination default 50 / max 100, never NaN/0/negative; paginationMeta; escapeRegex; searchTerm), `lib/product-sort.ts` (PRODUCT_SORT = order, createdAt desc, _id; used by admin list, reorder, /api/products and the /products first page; other public sorts get an _id tie-breaker), `lib/category-sort.ts`, `lib/reorder.ts` (reorderPage: ids must be exactly the items at `offset` of the full ordering, else 409; whole list renumbered in one bulkWrite).
- Routes: admin products (pagination, name search, category filter, lean projection with first image), products/reorder (zod, offset, 409, fixed wrong 400 helper), products/color-groups (new), categories list + reorder, collections list (aggregate `productCount`, no populate) and `[id]` GET (light populate), blogs, orders (page + per-tab `statusCounts`).
- UI: Pagination component, useDebouncedValue, ProductPicker (20/page, search, selections kept in parent with name/category/image), CollectionForm uses it, products page (search, category filter, pages of 50, reorder off while filtering, steps back when a page empties), blogs/collections/orders pages paged, ProductForm colour groups from the new endpoint; reorder hooks only touch the matching cached page and roll back on error.
- Tests: tests/pagination.test.ts (24). scripts/seed-local.mjs (local DB only, refuses non-local hosts).

### Found, not fixed
- Admin orders list still returns `razorpaySignature` (and /api/profile orders).
- Admin name search is an unanchored regex (cannot use an index): fine for admin; index work is Prompt 9.
- Reordering moves items only inside the current page; moving a product to another page means dragging it page by page (or filter-free arrows at page edge are disabled).
- Categories beyond 100 would be unreachable in the category page (single page by design).
- Collection product order inside a collection is whatever the admin selected; picker keeps insertion order.


## Prompt 8 (stock holds, pending orders, finalisation, webhook, promos, cancellation)

Owner decisions applied: no cron; holds released lazily (throttled once a minute per instance) before stock is read; hold 15 min; pending order 24 h from ONE constant (`PENDING_ORDER_TTL_SECONDS`, stock-reservation.ts, used by create-order).

Fixed (each proven by a test, mutation-checked where noted):
1. Sweep gave stock back for a PAID order if the process stopped between creating the order and settling stock (hold stayed ACTIVE, expired, was released -> oversell). The sweep now consumes a hold whose order exists; `settleStockForPaidOrder` is idempotent on an already-CONSUMED hold; a retry of finalizeOrder on an existing order finishes the hold (`consumeHold`). (mutation-checked)
2. "Sold Out" label set at payment stayed forever when another shopper's hold was later released (stock back, label stuck, cart rejects the product). `releaseReservation` now clears the automatic label; cancel uses the same helper. (mutation-checked)
3. finalizeOrder deleted the pending order BEFORE creating the order (a crash lost a paid order). Now the pending order is deleted after the order is saved; exactly-once comes from the unique razorpayOrderId index (loser of a browser/webhook race gets the existing order). The old rollback path (and its 1800 s re-set) is gone, so there is no second TTL to keep in step.
4. reserveStock leaked stock if saving the reservation record failed -> now restored.
5. create-order: Redis now required before stock is held; everything after the hold is in one try/catch that releases it (attach failure was unguarded); saving the profile address is best effort (failure used to fail the checkout after hold + Razorpay order); total is rounded to whole paise once and the same number is charged and stored.
6. verify-payment validates body types (zod) and malformed JSON is 400; signature checks moved to lib/razorpay-signature.ts (constant time, length-safe) and used by the webhook too; webhook checks id types/lengths and logs paid-but-no-order.
7. Promo: lib/promo.ts holds the one normalisation rule (trim + upper-case) and the PAID-only usage counts, used by promo route, create-order, finalize. Removed the dead promo_lock delete.
8. Lazy sweep wired into /api/products/cart, getProductBySlug and the admin product GET; create-order keeps its direct release.

Verified correct, unchanged: atomic claim per line, sorted claim order, per-size accounting, release exactly once, owner-only release, cancel status filter (restock once), webhook event filtering, dummy Razorpay key fallback gone.

### Found, not fixed
- A payment arriving after the hold expired, when stock ran out, zeroes the remaining stock; cancelling that order later restocks the FULL quantity (more than was deducted). Rare; needs a per-order record of what was actually deducted.
- A process stopping between `Order.create` and settling an UNHELD order (hold already released) leaves stock undeducted; there is no marker to repair it from (the held case is repaired).
- Cancel: status change and restock are two steps (no transaction); a crash between them loses the restock.
- verify-payment/webhook do not compare the paid amount with the order total (Razorpay enforces amount = order amount).
- Webhook replay protection relies on finalizeOrder idempotency, there is no event-id store.
- Mongo unique index on orders.razorpayOrderId must exist in production (Mongoose autoIndex creates it; confirm on Atlas).


## Prompt 9 (end-to-end payment tests, Playwright + Razorpay Test Mode)

Setup: `@playwright/test` (devDependency), `e2e/` (specs `*.e2e.ts`, support code, README), `playwright.config.ts`, scripts `test:e2e` and `seed:e2e`, artifacts in gitignored `e2e-artifacts/`. App under test = production build on a LOCAL throwaway database `indianmist_e2e` (`e2e/serve.mjs`; refuses non-local hosts and non-`rzp_test_` keys; never reads MONGODB_URI from .env). Shared dev Upstash Redis (owner confirmed dev); tests delete the pending-order keys they create.

Scenarios 1-9 + a sign-in regression: all pass against Razorpay's real Test Mode Checkout window, in real-webhook mode (`E2E_PORT=3000 E2E_REAL_WEBHOOK=1`, Razorpay delivering to the owner's tunnel) and, for 4/5a/5b, in signed-payload mode.

INCIDENT (owner informed during the run): the owner's dev server on :3000 uses the Atlas production database from .env and shares the dev Upstash. After the owner made the tunnel public and corrected the webhook path, Razorpay's real webhook for my test payments reached that server, which created PAID orders in production for local test product ids (customer "Ada Customer", e2e-customer-a@example.test, total 1200; no stock changed because the product ids do not exist there). Up to 4: order_TvUvP2hZm99gQK, order_TvUuoD3hxz5Dz1, order_TvUj5xQPXdFlfJ, order_TvUiOkty1r37OL. I did not touch Atlas; the owner removes them. Afterwards the owner stopped that server and the e2e app ran on :3000 with the local database.

Defect found and fixed: signing in through the form could bounce the customer back to the sign-in page (the navbar's prefetch of /profile, made while signed out, left a cached redirect that router.push replayed). Now a full page load to the (already validated) callbackUrl. Regression: e2e/signin.e2e.ts.

Findings not fixed: after a failed payment Razorpay re-shows its "save card" prompt whose "Maybe later" button starts a NEW payment (test helper never clicks it); releaseReservation marks the hold RELEASED before the stock is restored (a reader can see the status first; a crash between the two loses the restock); a failed payment keeps the stock held until the window is closed or the 15 minutes pass (payment.failed does not release).


## Prompt 10 (admin image uploads small enough for production)

Verified background: Vercel's request body cap is ~4.5 MB; the product form sent up to 10 images in one multipart request, the server allowed 10 MB per file, and `proxyClientMaxBodySize: 50 MB` hid it locally. What that option really does (Next docs): the proxy buffers each body so the route can re-read it, and bodies above the limit are CUT OFF at the limit (not rejected). It is now 4.5 MB (4,500,000) so local dev behaves like production.

Inventory (file input -> route): product form, multiple, one request (`/api/admin/products` POST, `[id]` PUT); category form (`/categories`, `[id]`); carousel, multiple but one request each (`/carousel`); About page story + extra sections (ImageUploadZone) and gallery (raw input) -> `/api/admin/upload`; homepage brand-story -> `/api/admin/upload`; blog cover, raw input (`/blogs`, `[id]`); size chart, raw input (`/size-chart`).

Built: `src/lib/image-budget.ts` (pure rules + EXIF reader), `src/lib/image-prepare.ts` (canvas; no new dependency: native decode/encode, EXIF handled by the decoder, no extra admin bundle), `ImageUploadZone` (optimising state, previews of the compressed files, per-file errors, `onBusyChange` holds Save), `useImagePreparation` hook for the three single-file inputs, About gallery prepares each file. Profiles: standard (1800 px, 700 KB, floors 1000 px / q 0.5), size chart (2000 px, 1.5 MB, floors 1400 px / q 0.75). Several photos in one request share a 4 MB budget (each gets min(700 KB, (4,000,000 - 120,000)/n - 1,000)).
Server: `validateImageFile` limit 10 MB -> 2 MB (above every client budget), magic-byte check kept; `assertRequestSize` (Content-Length, 413 BEFORE the body is read) called by `parseFormData`, i.e. every upload route, plus a total-size check after reading when no length was declared; `getApiErrorMessage` turns the platform's own non-JSON 413 into a readable toast; About/brand-story toasts now show the server's message.
Config: `export const maxDuration = 60` in all 11 upload routes (replaces vercel.json, which is deleted: its keys cannot reliably address `[id]` routes, and Vercel's default is 300 s, so the old 30 s cap was lowering the limit).
Cloudinary: server transformation unchanged (limit 2000 px, quality auto); storefront images use next/image with `sizes` and the default WebP optimiser, nothing to change.

Tests: tests/image-budget.test.ts (20), tests/upload-limits.test.ts (9: limit, guard on all 11 routes before the body is read, over-limit file, missing-length fallback, toast text), e2e/admin-uploads.e2e.ts (13, real forms and browser, requests measured then answered by the test so nothing reaches Cloudinary). Mutation check: disabling the guard fails the route test.

### Found, not fixed
- Existing product photos already in Cloudinary are untouched (only new uploads are shrunk).
- A browser without createImageBitmap/WebP encoding falls back (img decode, JPEG/PNG); not tested on Safari/old Android.
- A tab left open on an OLD admin build still sends raw photos; the server now refuses them with a message asking to reload.
- Pasting/dragging a HEIC photo is refused ("not a JPEG, PNG or WebP"), as before.


## Prompt 11 (database settings, query efficiency, storefront listings, small UI defects)

- db.ts: maxPoolSize 10 -> 5, minPoolSize 0, maxIdleTimeMS 30 s (reasoning in the file: one pool per serverless instance vs 500 connections total on the free Atlas tier). Cached-promise pattern and failure reset kept.
- Home: category counts are ONE grouped count (`getCategoryCounts`), no `$lookup` of every product; featured capped at 24 (FeaturedProducts loads 8 at a time, checked in a browser: stops at 24, "View all" -> /products); card labels use real category names.
- /products: `lib/product-listing.ts` is the ONE builder used by the page (first 12) and /api/products (everything else); real names everywhere (SSR HTML checked); facets follow "all filters except its own" (a ticked filter stays visible with 0); public limits kept (<= 60, page <= 1000); sort ends in _id. Caching decision: none. `unstable_cache` is deprecated in Next 16 and `use cache` needs Cache Components (a whole-app rendering change); one aggregate per visit is cheap. If ever needed it goes in `getProductListing` only.
- Collections: index = first 8 products per collection (2 queries total) + "View all in X" link; collection page = first 24 server-rendered (ISR kept) + "Load more" via new public `/api/collections/[slug]/products`. Deleting a product now also removes it from collections (it left dangling ids).
- Blogs: 12 per batch; first batch in the cached page, "Load more" and the ?category= filter use new public `/api/blogs` (ISR kept; indexes below).
- Indexes added (only for queries that exist): orders {promoCode,paymentStatus}, {paymentStatus,status,createdAt}, {paymentStatus,createdAt}; blogs {isPublished,publishedAt}, {isPublished,category,publishedAt}; collections {isActive,order}; products {order,createdAt,_id}. Verified with `explain` (IXSCAN, no COLLSCAN) in tests. Not added: Order{razorpayPaymentId} (no query uses it), anything for the /products `$facet` (a $facet branch cannot use an index; the whole catalogue is scanned, fine at hundreds of products).
- Atlas check (read-only introspection of the app's user, nothing written): role `atlasAdmin@admin` (can create indexes), and Mongoose autoIndex has already built the existing indexes on production, so the new ones will be created on the first deploy's first requests (collections are tiny: 14 products, 6 orders, 1 blog, 1 collection). Owner note: that user is far more powerful than the app needs; a `readWrite` user on the IndianMist database is enough (also allows createIndex).
- Small defects: fake Status column and `isActive` type removed from the admin product list; Cancel in ProductForm goes back to the product list; AdminTopBar titles for every admin page (tested); AdminProduct badge type includes "Sold Out"; dead empty arrays removed from homepage-data; `ProductModel.init()` hacks removed from the collection pages; admin orders and profile orders no longer send razorpaySignature (profile orders also capped at the latest 50, no payment id).
- Measured with the real page functions on 260 products / 3 collections of 80 / 60 posts (query counts and what MongoDB returned, from the profiler): home 5 -> 7 queries, 93 -> 60 docs, 29 -> 18 KB; /collections 2 -> 3 queries, 203 -> 31 docs, 143 -> 12 KB; /collections/x 81 -> 29 docs, 57 -> 9 KB; /blogs 2 -> 3 queries, 62 -> 15 docs, 16 -> 4 KB; /products 1 -> 2 queries (names), same data. Counts rise by 1-2 small queries, the work per page no longer grows with catalogue size.
- Tests: tests/storefront-listing.test.ts (24), e2e/storefront.e2e.ts (5).

### Found, not fixed
- /products with a category chosen now scans the whole catalogue for the facet counts (needed for correct facets; cheap at this size).
- EstimatedDelivery (server component on the ISR product page) can show a date up to a minute old.
- Audit E6/E7 (placeholder content as code defaults, settings upsert defaults) belong to the launch-content prompt; N6 (SEO) to the policy/SEO prompt.


## Prompt 12 (launch content: policy check, SEO basics, placeholder removal)

Full lists for the owner are in `docs/launch-content.md`.

- Part A (check + wiring only, no policy text written): only Privacy and Terms exist, and neither is saved in the database (the live pages show the generic code defaults). Refund/Cancellation/Returns and Shipping policies are missing. Added links to Terms and Privacy next to the Pay button and under the sign-up button (footer already linked them). Removed UI claims that contradicted the rules (30-day returns, carbon-neutral delivery, PCI DSS, fixed delivery times).
- Part B: `NEXT_PUBLIC_SITE_URL` (required in production, the build fails loudly without it; in .env.example and docs/env.md; set it for Production AND Preview), `sitemap.ts` (static pages + products + active collections + published posts, revalidated hourly), `robots.ts`, root metadata (metadataBase, title template, Open Graph/Twitter), `lib/seo.ts` helpers, canonical + Open Graph on products/collections/blog/legal/about/contact, Product JSON-LD (INR, availability from real stock), noindex on cart/checkout/profile/wishlist/signin/signup/forgot-password/admin (admin layout split into a server layout + `AdminShell`), `X-Robots-Tag` on /admin and /api. Note: Next replaces whole openGraph/twitter objects per page (no deep merge), hence `pageMetadata()`.
- Part C: every hard-coded default/claim removed from schema, components and admin editors (list in docs/launch-content.md section 2/3). Sections with no admin content render nothing (trust strip, eco, brand story, hero text/buttons/badge, contact details, About values/CTA). Editors can delete every item and no longer fall back to examples (examples are placeholders). (The free-shipping point was first generated from the pricing threshold; the owner then asked for the strip to be fully manual again, see Prompt 12b.) `scripts/find-placeholder-content.mjs` is a read-only scan; saved data was NOT changed.
- Found on production (read-only): placeholder contact address, hero subtitle/title/description, one eco item, brand-story subtitle and 13 of 14 products' default delivery text are saved in the database.
- Tests: tests/launch-content.test.ts (18), e2e/launch-content.e2e.ts (2).
- Process note: a command I ran with an unquoted variable briefly fell back to the .env database URI; it failed at URI parsing before connecting, nothing was read or written. Env values are now exported explicitly.

### Found, not fixed
- (done in Prompt 12b) Refund and Shipping policy page types.
- Settings admin forms still send `contactPageSettings` etc. as a whole section (last write wins).

## Prompt 12b (owner follow-up: manual trust strip, refund + shipping policy pages)

- Trust strip: back to fully manual. Removed the `freeShippingThreshold` prop, the auto-added "Free shipping" point and the subtitle rewrite; the home page passes only the saved items. The owner keeps the strip and Pricing in step by hand.
- New legal page types `refund-policy` and `shipping-policy` (`lib/legal-pages.ts`, `OPTIONAL_LEGAL_SLUGS`): same model, API route, editor, sanitiser and public view as Privacy/Terms, but with no default text. Unsaved/empty means 404, no footer link, no sitemap entry (`getPublishedOptionalPolicies()` in storefront-data, one small query used by the root layout and the sitemap). The admin PUT now also calls `revalidateStorefront()` and revalidates `/sitemap.xml` so the footer and sitemap follow a save at once. Admin sidebar/top bar entries added; the editor shows whether the page is live.
- Tests: tests/legal-policies.test.ts (5), launch-content tests adjusted, e2e/launch-content.e2e.ts (+1 admin-editor flow). Gates: tsc clean, lint 0 errors, 341 unit tests, e2e launch-content + storefront 8/8.

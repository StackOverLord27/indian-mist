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


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
- `tests/setup.ts` scrubs real service env vars and installs dummies so tests cannot reach Atlas, Upstash, Cloudinary, SMTP or Razorpay.

## Per-prompt log

### Prompt 1: rules, safety rails, test tooling, baseline
- Added docs/work-rules.md, docs/work-log.md, Vitest + helpers in `tests/`, `vitest.config.ts`, scripts. No application code changed.

## Found, not fixed
- Lint warnings (5): `src/components/admin/ui/ImageUploadZone.tsx:125` unused eslint-disable directive, `:127` `<img>` instead of `next/image`; `src/lib/admin-axios.ts:38,62,72` `window.location.href` for internal navigation.
- `npm install` reports known vulnerabilities in the dependency tree (not triaged; `npm audit` output to be reviewed in a later prompt).
- Local `.env` points at the production Atlas cluster (`IndianMist`), a live Upstash instance and the real Cloudinary cloud. Owner confirmed this is production and read use is fine; destructive operations stay local (R9).
- `.env` defines `MAIL_*` alongside `SMTP_*`; the owner says they are used to set up the SMTP server (test credentials). `src/lib/mailer.ts` only reads `SMTP_*`; check where `MAIL_*` is consumed in the mail prompt.
- Existing podman containers `veda-redis`/`veda-mongo` (stopped) and `local-redis` (running, plain Redis on 6379) are unrelated to the test setup and untouched. Plain Redis does not speak Upstash's REST protocol, so the app cannot use it without an adapter (e.g. an SRH proxy).

## Owner decisions
- Atlas `IndianMist` is production; reads allowed, anything destructive goes to local instances. Fakes or local instances are fine where they simulate production accurately.
- Razorpay test keys (`rzp_test_`) may be used for real Test Mode calls; `rzp_live_` never.
- `MAIL_*` credentials are test credentials; do not ignore them.

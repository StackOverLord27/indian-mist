# Environment variables

All server variables are read **lazily**, when the code that needs them runs (`src/lib/env.ts`). A missing variable fails that request with an error that names the variable (never its value). `next build` does not need payment, mail or Redis credentials; it only needs the database (the build prerenders pages from it).

`.env.example` lists every variable the code reads. `.env*` files other than `.env.example` are never committed.

## Sign-in sessions (lifetimes)

Not environment variables: fixed in `src/lib/auth-tokens.ts` (`REFRESH_LIFETIME`, `MAX_SESSIONS_PER_USER`).

| | Customers | Admin (`SUPER_ADMIN_EMAIL`) |
|---|---|---|
| Access token (cookie `access_token`) | 15 minutes | 15 minutes |
| Refresh token (cookie `refresh_token`), unused | 30 days, **extended on every use** | 7 days, extended on every use |
| Refresh token, absolute maximum | 90 days from sign-in | 30 days from sign-in |

- The refresh token does **not** rotate. While the session lives, the cookie value stays the same; a renewal (`POST /api/auth/refresh`) only returns a new access token and moves the cookie's and database row's expiry out. A lost response, two tabs or a retry therefore never end a session.
- The database stores only a SHA-256 hash of the token (`RefreshToken`: `expiresAt` = sliding expiry, `absoluteExpiresAt` = hard end, `family` = one sign-in).
- A session ends by: **sign-out** (that one session only; other devices stay signed in), **password reset** (all sessions of the account), going unused for the sliding period, reaching the absolute maximum, or being one of the oldest beyond the **10 newest sessions per account**.
- Both cookies are `HttpOnly`, `Path=/`, `SameSite=Lax` (`Secure` in production): the session survives arriving from an e-mail, another app or a payment return, while cross-site POSTs still carry no cookie. `POST /api/auth/signout` also refuses a request whose `Origin`/`Referer` is another site. Browsers that still hold older `Strict` cookies switch to `Lax` at their next renewal.
- Sessions that were signed in before tokens stopped rotating keep working: the first renewal swaps their old 7-day token, once, for a new-format one in the same session (no sign-out).
- Diagnostics (Vercel logs, never any token, e-mail or id): `[auth] sign-in redirect reason=...` (no cookies at the proxy), `[auth] renewal refused reason=...` (no-refresh-cookie, token-expired, token-invalid, session-idle-expired, session-absolute-max-reached, account-missing-or-unverified), `[auth] renewal failed: server error` (database problem, the customer stays signed in and sees a Retry), `[security] Refresh token unknown or revoked (token age Ns)`.

## Which environment needs what

Vercel environments: **Production** (the live site), **Preview** (every branch/PR deployment), **Development** (`vercel dev` / your machine).

| Variable | Production | Preview | Development | Notes |
|---|---|---|---|---|
| `MONGODB_URI` | required | required | required | Also needed at **build** time. Use a separate database (or cluster) for Preview so previews can never touch live orders. |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | required | required | required | Long random strings. Different per environment (tokens from one environment must not work in another). |
| `NEXT_PUBLIC_SITE_URL` | **required** | **required** | optional (default `http://localhost:3000`) | The public address of the shop, for example `https://www.indianmist.com` (no path). Used for canonical links, Open Graph addresses, `sitemap.xml` and `robots.txt`. A wrong value puts the wrong address in search results, so production fails loudly when it is missing or not a valid `http(s)` address. Set it for the Production AND Preview environments in Vercel. |
| `SUPER_ADMIN_EMAIL` | required | required | required | The admin account. Without it nobody is admin. |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | **required** | required | optional | See "Redis behaviour" below. Use a separate Redis database for Preview. |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `NEXT_PUBLIC_RAZORPAY_KEY_ID` | live keys (`rzp_live_`) | test keys (`rzp_test_`) | test keys | `NEXT_PUBLIC_*` is baked into the browser bundle at build time: set it **before** building, and it must match `RAZORPAY_KEY_ID`. |
| `RAZORPAY_WEBHOOK_SECRET` | required | only if a Preview webhook is configured | optional | Without it the webhook route answers 503. |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | required | required (ideally a separate account/folder) | required | Only the admin image routes need them. |
| `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | required | required | optional | Sign-up/reset codes and contact messages. Without them, sending fails and the cause is logged. |
| `SMTP_PORT` | optional (587) | optional | optional | `465` uses TLS from the start; any other port must offer STARTTLS (the password is never sent in clear text; only `localhost`/`127.0.0.1` is exempt, for a local test server). `SMTP_FROM` must be a plain address (`no-reply@example.com`), no display name or angle brackets; the display names ("Indian Mist", "Indian Mist Website") live in `src/lib/mailer.ts`. |

`NODE_ENV` is set by Next.js (`production` for `next build`/`next start`); do not set it yourself.

Variables that older `.env` files may contain but **the code does not read**: `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASS`, `JWT_EXPIRES_IN`, `NEXT_PUBLIC_API_URL`. Delete them.

## Redis behaviour

Redis (Upstash) holds rate-limit counters, the sign-in lockout, e-mailed OTP codes and pending checkouts.

| Situation | Development | Production |
|---|---|---|
| Variables not set | Rate limits and sign-in lockout are **off**, with a one-time console warning. OTP codes and checkout need Redis and fail with an error naming the variable. | Everything that needs Redis **fails with an error naming the variable** (sign-in, OTP, rate limits). The site refuses to run unprotected. |
| Redis set but not answering | Limits skipped, warning logged. | Sign-in/sign-up/OTP/reset/contact/newsletter answer **503** (fail closed). The general API limiter lets requests through (fail open, logged) so a Redis outage does not take the shop down. |

## Rate limits

Per IP, sliding window (Upstash):

| Routes | Limit |
|---|---|
| `/api/auth/signin`, `/signup`, `/verify-otp`, `/forgot-password/*` | 5 per minute |
| `/api/contact`, `/api/subscribe` (counted separately) | 5 per 10 minutes |
| everything else under `/api` | 100 per 10 seconds |

Also: at most 5 OTP e-mails per address per hour for sign-up and 5 for password reset; 10 failed sign-ins per address per 15 minutes lock that account for the rest of the window.

The IP comes from `x-vercel-forwarded-for` (set by Vercel; a client cannot fake it), then `x-real-ip`, then `x-forwarded-for`.

## Orders: one per payment, and the index check

- An order's database id is derived from its Razorpay order id (`src/lib/order-id.ts`). The browser confirmation and the webhook therefore try to create the SAME `_id`; MongoDB's always-present `_id` index lets exactly one in. This does not depend on Redis, a lock or the `razorpayOrderId` index.
- The model still declares `razorpayOrderId` as unique and sparse. On the first database connection of each server instance the app checks the live index and logs one `[db] CRITICAL` line if it is not unique and sparse; the admin dashboard shows a warning (cached 10 minutes per instance). `npm run ensure:indexes` compares every model's declared indexes with the live ones (read-only by default; `--apply` needs the database name typed and refuses when duplicates exist).

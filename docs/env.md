# Environment variables

All server variables are read **lazily**, when the code that needs them runs (`src/lib/env.ts`). A missing variable fails that request with an error that names the variable (never its value). `next build` does not need payment, mail or Redis credentials; it only needs the database (the build prerenders pages from it).

`.env.example` lists every variable the code reads. `.env*` files other than `.env.example` are never committed.

## Which environment needs what

Vercel environments: **Production** (the live site), **Preview** (every branch/PR deployment), **Development** (`vercel dev` / your machine).

| Variable | Production | Preview | Development | Notes |
|---|---|---|---|---|
| `MONGODB_URI` | required | required | required | Also needed at **build** time. Use a separate database (or cluster) for Preview so previews can never touch live orders. |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | required | required | required | Long random strings. Different per environment (tokens from one environment must not work in another). |
| `SUPER_ADMIN_EMAIL` | required | required | required | The admin account. Without it nobody is admin. |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | **required** | required | optional | See "Redis behaviour" below. Use a separate Redis database for Preview. |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `NEXT_PUBLIC_RAZORPAY_KEY_ID` | live keys (`rzp_live_`) | test keys (`rzp_test_`) | test keys | `NEXT_PUBLIC_*` is baked into the browser bundle at build time: set it **before** building, and it must match `RAZORPAY_KEY_ID`. |
| `RAZORPAY_WEBHOOK_SECRET` | required | only if a Preview webhook is configured | optional | Without it the webhook route answers 503. |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | required | required (ideally a separate account/folder) | required | Only the admin image routes need them. |
| `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | required | required | optional | Sign-up/reset codes and contact messages. Without them, sending fails and the cause is logged. |
| `SMTP_PORT` | optional (587) | optional | optional | `465` uses TLS from the start. |

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

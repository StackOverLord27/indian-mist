# Work rules

- **R1.** Next.js here differs from training data. Before using any Next API read the matching doc in `node_modules/next/dist/docs/`. If a prompt's idea conflicts with docs or repo, docs and repo win; report the difference.
- **R2.** Prompts describe intent and design sketches written by someone who READ the code but never ran it. Verify every claim against the real code before acting.
- **R3.** Smallest correct diff. No drive-by refactors, renames or formatting churn. Match existing style (Tailwind tokens, fonts, folder layout, errorResponse/successResponse helpers). No new dependency unless the prompt allows it or you justify it in the report.
- **R4.** Contracts: when you change an API route, find every caller (components, hooks, src/lib/admin-api, tests) and update both sides in the same commit. When you rename a field, grep the whole repo.
- **R5.** Every route: explicit auth, input validated with zod and the PARSED data used (not the raw body), errors do not leak internals, no unbounded queries.
- **R6.** Money, stock and auth code: reason about concurrency (parallel requests, retries, webhooks), partial failure (crash between two writes) and idempotency, and write tests for them.
- **R7.** External files (Cloudinary): never delete an asset before the database change that stops referencing it has succeeded; never leave newly uploaded assets orphaned when a later step fails.
- **R8.** Secrets: never print, log, commit or paste secret values; never edit or commit .env* files; never expose server-only env to client bundles.
- **R9.** Data safety: no destructive operation against any non-local database. Migrations are separate, idempotent, dry-run-by-default scripts, and only when a prompt asks.
- **R10.** Git: stay on hardening/launch-prep; one commit per prompt (more if natural); never push, force, or rewrite history.
- **R11.** Gate before finishing: typecheck, lint, tests and next build all run, compared with the baseline in docs/work-log.md; no new failures. State explicitly anything you could not run.
- **R12.** Self-review: re-read your whole diff as a hostile reviewer: broken imports, stale callers, missing await, swallowed errors, missing loading/empty/error states in UI, mobile layout, race conditions, forgotten edge cases. Fix what you find BEFORE reporting.
- **R13.** Final report format for every prompt: Summary; Files changed; Behaviour changes visible to the owner/customers; How it was verified (commands and results); Not verified and assumptions; Risks and follow-ups; Decisions needed from the owner. Then STOP and wait.
- **R14.** Ask the owner when a decision is genuinely ambiguous or changes product behaviour. For trivial choices pick the simplest and note it.
- **R15.** Do not do work belonging to other prompts early. Record out-of-scope discoveries in docs/work-log.md under "Found, not fixed".

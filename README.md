# BrandShield AI

**Protect your brand before you publish.**

BrandShield AI is an evidence-first brand governance workspace for reviewing content, approved facts, terminology, and approval decisions. This build prioritises a complete ClaimGuard + Fix-to-Approval workflow and includes a clearly scoped VisualGuard interface.

## Features

- Demo workspace with seeded Northstar Labs brand knowledge.
- Persistent content submissions and version history.
- ClaimGuard deterministic checks for unsupported promises, quantified claims, absolute language, and prohibited terminology.
- Evidence references that can only point to known workspace guideline, fact, or terminology IDs.
- Correction acceptance, false-positive recording, clarification requests, comments, and re-analysis.
- Reviewer inbox, separation-of-duties guard, status transitions, approval decisions, and audit history.
- Dashboard and analytics calculated from persisted records.
- Scoped VisualGuard upload validation with honest unavailable-state messaging.
- Live OpenAI-compatible text and vision provider adapters with structured Zod validation, evidence-ID verification, timeouts, exponential retry, and explicit provider failures.
- Durable Supabase-backed analysis jobs claimed with `FOR UPDATE SKIP LOCKED`, retry/backoff, and a Vercel cron worker endpoint.
- Server-only authorization context and organisation scoping in every route.

## Stack

Next.js App Router, React, TypeScript strict mode, Tailwind CSS, Lucide, Zod, Vitest, Playwright, Sharp, and Supabase Postgres. The repository adapter stores application data in normalized Supabase tables, with a file-backed demo fallback when Supabase credentials are absent and `NEXT_PUBLIC_APP_MODE` is not `live`.

## Run locally

```bash
npm install
copy .env.example .env.local
npm run dev
```

Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`. Set `NEXT_PUBLIC_APP_MODE=demo` to seed the demo workspace on first access. The service-role key is only used by server-side repository code and must never use a `NEXT_PUBLIC_` prefix.

### Apply database migrations

The Supabase CLI is invoked through `npx` and does not need to be installed globally:

```bash
npx supabase login
npm run db:link -- --project-ref <your-project-ref>
npm run db:status
npm run db:push:dry-run
npm run db:push
```

Get the project ref from the Supabase dashboard URL. The CLI may prompt for the database password when linking or pushing; alternatively, set `SUPABASE_DB_PASSWORD` in your shell or CI secret store for that command. Do not add the database password or service-role key to source control. Review the dry-run output and back up production data before applying migrations. Use `db:push` deliberately as a release step, not an automatic side effect of starting the app.

If migrations were previously run manually in the SQL editor, first reconcile the remote migration history with `supabase migration repair` after confirming which versions actually ran. Do not push against an existing manually migrated database until its migration history is reconciled.

### Brand asset storage

Migration `0003_brand_assets_storage_rls.sql` creates a private `brand-assets` bucket limited to PNG, JPEG, WebP, and GIF files up to 8 MiB. Authenticated members can read, upload, update, or delete only objects whose first path segment is their organisation UUID, for example `<organisation-id>/<asset-id>/<filename>`. Keep objects private and use authenticated downloads or short-lived signed URLs; do not make this bucket public.

The existing VisualGuard endpoint currently records upload metadata but does not yet upload file bytes to Supabase Storage. Use the documented object key when wiring that integration. Server requests made with the service-role key bypass Storage RLS; enforce the organisation check in server code and never accept a caller-provided organisation ID without validating membership.

When adding signed downloads, generate the URL on demand only after checking the caller's organization access. Use the shortest practical expiry, typically 60 seconds and never more than 300 seconds. Return the URL to the caller without storing it in a database, logs, or a long-lived cache; persist only the bucket and object path, then request a fresh signed URL when needed.

## Deploy frontend and API separately

This repo can deploy its frontend on Vercel and its existing Next.js API routes on Render. The Vercel app proxies `/api/*` to Render through a same-origin rewrite, so browser requests and the demo cookie stay on the Vercel hostname. Render runs the same codebase as a Node web service; it also serves the Next.js pages, but users should enter through the Vercel URL.

1. Connect this repository to Render as a Blueprint and deploy `render.yaml`. Set the service's `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `LLM_API_KEY`, and `LLM_MODEL` in the Render environment. Apply the Supabase migrations to that same project before using the API. The health endpoint is `/api/health`.
2. In Vercel, set `RENDER_API_URL` to the Render service origin, without a trailing slash. Set the same `NEXT_PUBLIC_APP_MODE`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` on Vercel: current server-rendered pages still read Supabase directly. Also copy `CRON_SECRET` to Vercel if its configured cron should invoke the Render worker. Keep service-role keys server-only.
3. Redeploy Vercel after setting `RENDER_API_URL`; the Next.js rewrite is generated at build time. The rewrite runs before local API route handlers and proxies the request to Render while retaining the Vercel URL. See [Next.js rewrite phases](https://nextjs.org/docs/15/app/api-reference/config/next-config-js/rewrites) and [Render's Next.js deployment guide](https://render.com/docs/deploy-nextjs-app).

The current app still uses demo-cookie authentication, as described below; this split does not add real account or workspace provisioning. For persistent production data, configure the same migrated Supabase project on both hosts. Do not configure only one host: API mutations run on Render while current server-rendered pages read from Vercel.
## Checks

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

The same checks run in GitHub Actions for pushes to `main` and pull requests. Build the production container with:

```bash
docker build --tag brandshield-ai .
docker run --rm --env-file .env.local -p 3000:3000 brandshield-ai
```

The image uses Next.js standalone output and runs as a non-root user. Provide the required Supabase and provider variables through the runtime environment; do not bake secrets into the image.

## Environment and production setup

Configure these variables in your hosting provider's production environment:

- `SUPABASE_URL=https://ctsdioptathslsfdzzxh.supabase.co`: Supabase project URL for server-side database access.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only key used by the repository. Never expose it to client bundles.
- `NEXT_PUBLIC_SUPABASE_URL=https://ctsdioptathslsfdzzxh.supabase.co` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`: public project URL and publishable/anon key used by browser-side Google OAuth.
- `NEXT_PUBLIC_APP_MODE=demo`: seeds and uses the demo workspace. This also keeps deterministic analysis enabled. Set `live` only when live LLM analysis is configured; it prevents demo seeding.
- `APP_BASE_URL=https://brand-shield-ai-rec.vercel.app`: canonical deployed application URL.
- `LLM_BASE_URL`: OpenAI-compatible API base URL; defaults to `https://api.openai.com/v1`.
- `LLM_API_KEY` and `LLM_MODEL`: server-only text analysis provider configuration.
- `VISION_MODEL`: optional server-only vision model. Vision requests are only made when this is set with `LLM_API_KEY`.
- `LLM_TIMEOUT_MS`, `LLM_MAX_ATTEMPTS`: provider timeout and retry controls.
- `ANALYSIS_MAX_ATTEMPTS`: durable job retry limit.
- `ANALYSIS_WORKER_SECRET` or `CRON_SECRET`: protects the background worker endpoint.
- `BRAND_PALETTE`: comma-separated hex colours used for deterministic dominant-colour comparison.

The repository's `.env.example` now contains the non-secret project URLs and demo mode. Copy those values into the corresponding Vercel Production environment variables. Retrieve `SUPABASE_SERVICE_ROLE_KEY` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from the Supabase project API settings; generate a long random value for `CRON_SECRET`. Do not commit these secrets. Vercel project access is not configured in this workspace, so these values have not been added directly to Vercel.

To enable Google sign-in, enable the Google provider in Supabase Auth and add the deployed app URL to Supabase's allowed redirect URLs. The login page redirects back to `/dashboard` after OAuth. **Authentication is still demo-cookie based:** do not enable production user access until the cookie adapter is replaced by verified Supabase sessions. The server repository uses the service-role key, which bypasses RLS, so server access must enforce organisation membership. Keep `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_PASSWORD`, `LLM_API_KEY`, `LLM_MODEL`, and `VISION_MODEL` server-side. The migrations enable RLS for direct client access.

When `NEXT_PUBLIC_APP_MODE=live`, content analysis queues a durable job and the worker calls the configured OpenAI-compatible text endpoint. The provider response must be JSON, pass Zod validation, and cite only retrieved evidence IDs. Transient HTTP 408/409/429/5xx responses and network timeouts retry with bounded exponential backoff; invalid output, unknown citations, missing configuration, and exhausted retries remain explicit failures. Review the selected provider's data-retention and training policy before sending confidential content.

## Known limitations

- Demo authentication uses a local HttpOnly cookie rather than Supabase Auth.
- The repository uses a server-side service-role client, which bypasses RLS; every server route must enforce organisation membership.
- VisualGuard currently validates file type, size, and signature and then requires human review; it does not claim full logo, colour, contrast, OCR, or accessibility compliance.
- The Vercel cron worker is ready, but it needs `CRON_SECRET` or `ANALYSIS_WORKER_SECRET` and a deployed Supabase database with migration `0004_analysis_jobs.sql` applied.
- The local file-backed demo queue is durable on disk but is not a substitute for multi-instance production locking.
- Full Supabase integration tests are present but skip unless `SUPABASE_TEST_URL`, `SUPABASE_TEST_ANON_KEY`, and `SUPABASE_TEST_SERVICE_ROLE_KEY` are configured.
- Playwright E2E tests require the browser install step: `npx playwright install chromium`.

## Security notes

The demo routes derive the organisation from the server-side auth context and never trust an organisation ID from the browser. Production must preserve this pattern with Supabase RLS and server-only service-role usage. Do not commit `.env.local`, keys, uploaded confidential files, or provider payloads.

## Disclosure

This implementation was generated with significant AI assistance and uses open-source Next.js, React, Tailwind CSS, Lucide, Zod, and Vitest. No customer logos, testimonials, performance claims, or third-party proprietary templates are used.

## Team & Contributions

| Name | Role & Contributions |
| :--- | :--- |
| **Vidyansh Shukla** | Full-stack architecture, ClaimGuard deterministic checks, VisualGuard interface, and Supabase integration. |

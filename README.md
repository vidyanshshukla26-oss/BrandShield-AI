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
- Server-only authorization context and organisation scoping in every route.

## Stack

Next.js App Router, React, TypeScript strict mode, Tailwind CSS, Lucide, Zod, Vitest, and Supabase Postgres. The repository adapter stores application data in the normalized Supabase tables.

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

## Checks

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Environment and production setup

Configure these variables in your hosting provider's production environment:

- `SUPABASE_URL`: Supabase project URL for server-side database access.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only key used by the repository. Never expose it to client bundles.
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`: public project URL and publishable/anon key used by browser-side Google OAuth.
- `NEXT_PUBLIC_APP_MODE=live`: prevents demo data from being seeded in production. Use `demo` only for a demo environment.
- `APP_BASE_URL`: canonical deployed application URL.

To enable Google sign-in, enable the Google provider in Supabase Auth and add the deployed app URL to Supabase's allowed redirect URLs. The login page redirects back to `/dashboard` after OAuth. **Authentication is still demo-cookie based:** do not enable production user access until the cookie adapter is replaced by verified Supabase sessions. The server repository uses the service-role key, which bypasses RLS, so server access must enforce organisation membership. Keep `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_PASSWORD`, `LLM_API_KEY`, `LLM_MODEL`, and `VISION_MODEL` server-side. The migrations enable RLS for direct client access.

The current build does not make an LLM network call, even if `LLM_API_KEY` is present. A production adapter must implement the provider call, timeout/retry handling, structured-output validation, evidence-ID verification, and provider data-retention disclosure before live confidential content is processed.

## Known limitations

- Demo authentication uses a local HttpOnly cookie rather than Supabase Auth.
- The repository uses a server-side service-role client, which bypasses RLS; every server route must enforce organisation membership.
- VisualGuard currently validates file type, size, and signature and then requires human review; it does not claim full logo, colour, contrast, OCR, or accessibility compliance.
- No background queue is included; analysis is synchronous for the MVP.
- No live LLM or vision request is made without a future provider adapter.

## Security notes

The demo routes derive the organisation from the server-side auth context and never trust an organisation ID from the browser. Production must preserve this pattern with Supabase RLS and server-only service-role usage. Do not commit `.env.local`, keys, uploaded confidential files, or provider payloads.

## Disclosure

This implementation was generated with significant AI assistance and uses open-source Next.js, React, Tailwind CSS, Lucide, Zod, and Vitest. No customer logos, testimonials, performance claims, or third-party proprietary templates are used.

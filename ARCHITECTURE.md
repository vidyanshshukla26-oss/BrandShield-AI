# BrandShield AI architecture

## Current build

This repository is a Next.js App Router application with TypeScript, Tailwind CSS, Zod validation, server route handlers, and a provider-independent analysis module. Application data is persisted in normalized Supabase Postgres tables. Demo mode seeds the demo workspace into Supabase on first access.

## Core flow

1. A submission creates a durable content version.
2. ClaimGuard retrieves the organisation's approved guidelines, facts, and terminology rules from the store.
3. Deterministic checks create structured findings with only known evidence identifiers.
4. The submission creates a durable `analysis_jobs` row and returns `202 Accepted`; a protected worker claims jobs with database row locking.
5. In live mode, the worker calls the configured OpenAI-compatible text provider with timeout/retry handling and rejects invalid or forged evidence citations.
6. A creator can resolve findings, create a new revision, and re-run analysis.
7. The server state machine prevents high-risk content from entering approval.
8. Reviewers record decisions against an explicit content version.
9. Audit events preserve actor, action, entity, and decision context.

## Production adapter boundary

The server-only repository reads and writes normalized Supabase tables and uses a database function to apply each store mutation in a single transaction. Apply schema migrations with the Supabase CLI (`npm run db:push:dry-run`, then `npm run db:push`) after linking the intended project; migrations are an explicit release step. The app requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; keep the service-role key server-side because it bypasses RLS. Routes must enforce membership and organisation scoping. Set `NEXT_PUBLIC_APP_MODE=live` in production to prevent demo seeding. Demo authentication remains a local cookie and must be replaced with verified Supabase sessions before production use. Storage is private. When signed downloads are implemented, issue URLs only after membership checks with a 60-second default and a 300-second maximum; never persist or long-cache signed URLs, and store only object paths. `LLM_API_KEY` and `VISION_MODEL` are server-only configuration points; this build does not silently substitute demo output for failed live calls.

## Signature features

- **ClaimGuard:** deterministic high-risk claim and terminology checks plus a live OpenAI-compatible provider adapter with bounded retries, timeouts, Zod output validation, and citation verification.
- **VisualGuard:** Sharp-based image metadata, dominant-colour, brightness, palette-distance, and alt-text review checks, plus an optional configured vision model. Automated output remains advisory and human review is explicit.
- **Fix-to-Approval:** revision history, findings, comments, reviewer queue, role checks, approval transitions, and audit history are implemented in the server workflow.

## Operations

`vercel.json` schedules `/api/internal/analysis-worker` every minute. The route accepts Vercel's `Authorization: Bearer $CRON_SECRET` header or the explicit `ANALYSIS_WORKER_SECRET`. Vercel's Hobby plan does not support per-minute schedules, so use Pro/Enterprise or invoke the worker from another scheduler on Hobby.

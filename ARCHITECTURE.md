# BrandShield AI architecture

## Current build

This repository is a Next.js App Router application with TypeScript, Tailwind CSS, Zod validation, server route handlers, and a provider-independent analysis module. Application data is persisted in normalized Supabase Postgres tables. Demo mode seeds the demo workspace into Supabase on first access.

## Core flow

1. A submission creates a durable content version.
2. ClaimGuard retrieves the organisation's approved guidelines, facts, and terminology rules from the store.
3. Deterministic checks create structured findings with only known evidence identifiers.
4. A creator can resolve findings, create a new revision, and re-run analysis.
5. The server state machine prevents high-risk content from entering approval.
6. Reviewers record decisions against an explicit content version.
7. Audit events preserve actor, action, entity, and decision context.

## Production adapter boundary

The server-only repository reads and writes normalized Supabase tables and uses a database function to apply each store mutation in a single transaction. Apply schema migrations with the Supabase CLI (`npm run db:push:dry-run`, then `npm run db:push`) after linking the intended project; migrations are an explicit release step. The app requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; keep the service-role key server-side because it bypasses RLS. Routes must enforce membership and organisation scoping. Set `NEXT_PUBLIC_APP_MODE=live` in production to prevent demo seeding. Demo authentication remains a local cookie and must be replaced with verified Supabase sessions before production use. Add private Storage buckets and signed URLs for uploaded assets. `LLM_API_KEY` and `VISION_MODEL` are server-only configuration points; this build does not silently substitute demo output for failed live calls.

## Signature features

- **ClaimGuard:** deterministic high-risk claim and terminology checks today; the structured schema and provider boundary are ready for a configured evidence-grounded LLM.
- **VisualGuard:** validates supported image MIME types, size, and file signatures, records an asset, and returns an explicit human-review state. Full colour/contrast/vision analysis remains a production follow-up.
- **Fix-to-Approval:** revision history, findings, comments, reviewer queue, role checks, approval transitions, and audit history are implemented in the server workflow.

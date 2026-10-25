# BrandShield AI architecture

## Current build

This repository is a Next.js App Router application with TypeScript, Tailwind CSS, Zod validation, server route handlers, and a provider-independent analysis module. The default mode is intentionally labelled **demo mode**. It persists data in `data/store.json` so the complete workflow can be demonstrated without external credentials.

## Core flow

1. A submission creates a durable content version.
2. ClaimGuard retrieves the organisation's approved guidelines, facts, and terminology rules from the store.
3. Deterministic checks create structured findings with only known evidence identifiers.
4. A creator can resolve findings, create a new revision, and re-run analysis.
5. The server state machine prevents high-risk content from entering approval.
6. Reviewers record decisions against an explicit content version.
7. Audit events preserve actor, action, entity, and decision context.

## Production adapter boundary

Replace the file-backed store with PostgreSQL/Supabase repositories while preserving the route and service interfaces. Add Supabase Auth, private Storage buckets, signed URLs, and RLS policies for every organisation-owned table. `LLM_API_KEY` and `VISION_MODEL` are server-only configuration points; this build does not silently substitute demo output for failed live calls.

## Signature features

- **ClaimGuard:** deterministic high-risk claim and terminology checks today; the structured schema and provider boundary are ready for a configured evidence-grounded LLM.
- **VisualGuard:** validates supported image MIME types, size, and file signatures, records an asset, and returns an explicit human-review state. Full colour/contrast/vision analysis remains a production follow-up.
- **Fix-to-Approval:** revision history, findings, comments, reviewer queue, role checks, approval transitions, and audit history are implemented in the server workflow.

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

Next.js App Router, React, TypeScript strict mode, Tailwind CSS, Lucide, Zod, Vitest. The production target is Supabase Auth/Postgres/Storage plus Vercel. The local demo adapter is file-backed because credentials are not available in this workspace.

## Run locally

```bash
npm install
copy .env.example .env.local
npm run dev
```

Open `http://localhost:3000`, choose **Start a Brand Review**, and continue in demo mode. Data is written to `data/store.json`, which is ignored by Git. Delete that file to reset the demo workspace.

## Checks

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Environment and production setup

Only set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` in server deployment configuration after adding a real Supabase adapter. Keep `LLM_API_KEY`, `LLM_MODEL`, and `VISION_MODEL` server-side. Add database migrations for the tables named in the product brief, enable RLS, and use private Storage buckets with signed URLs.

The current build does not make an LLM network call, even if `LLM_API_KEY` is present. A production adapter must implement the provider call, timeout/retry handling, structured-output validation, evidence-ID verification, and provider data-retention disclosure before live confidential content is processed.

## Known limitations

- Demo authentication uses a local HttpOnly cookie rather than Supabase Auth.
- The file-backed store is not suitable for concurrent or multi-tenant production traffic.
- VisualGuard currently validates file type, size, and signature and then requires human review; it does not claim full logo, colour, contrast, OCR, or accessibility compliance.
- No background queue is included; analysis is synchronous for the MVP.
- No live LLM or vision request is made without a future provider adapter.

## Security notes

The demo routes derive the organisation from the server-side auth context and never trust an organisation ID from the browser. Production must preserve this pattern with Supabase RLS and server-only service-role usage. Do not commit `.env.local`, keys, uploaded confidential files, or provider payloads.

## Disclosure

This implementation was generated with significant AI assistance and uses open-source Next.js, React, Tailwind CSS, Lucide, Zod, and Vitest. No customer logos, testimonials, performance claims, or third-party proprietary templates are used.

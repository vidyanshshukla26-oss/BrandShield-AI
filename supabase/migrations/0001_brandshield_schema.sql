-- BrandShield AI production schema sketch for Supabase/PostgreSQL.
-- Apply after configuring Supabase Auth. All tenant-owned tables carry organisation_id.

create extension if not exists pgcrypto;

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  created_at timestamptz not null default now()
);

create table if not exists organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists organisation_members (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  role text not null check (role in ('owner', 'brand_manager', 'creator', 'reviewer')),
  joined_at timestamptz not null default now(),
  unique (organisation_id, profile_id)
);

create table if not exists brand_guidelines (
  id uuid primary key default gen_random_uuid(), organisation_id uuid not null references organisations(id) on delete cascade,
  title text not null, category text not null, body text not null,
  status text not null check (status in ('draft', 'approved', 'archived')) default 'draft', version integer not null default 1,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists approved_facts (
  id uuid primary key default gen_random_uuid(), organisation_id uuid not null references organisations(id) on delete cascade,
  name text not null, value text not null, description text not null, source text not null, source_url text,
  verified_at timestamptz, review_date timestamptz,
  status text not null check (status in ('draft', 'approved', 'expired', 'archived')) default 'draft', version integer not null default 1
);

create table if not exists terminology_rules (
  id uuid primary key default gen_random_uuid(), organisation_id uuid not null references organisations(id) on delete cascade,
  preferred text not null, prohibited text, explanation text not null,
  status text not null check (status in ('approved', 'draft', 'archived')) default 'draft'
);

create table if not exists brand_assets (
  id uuid primary key default gen_random_uuid(), organisation_id uuid not null references organisations(id) on delete cascade,
  name text not null, kind text not null, storage_path text not null, mime_type text not null, size_bytes bigint not null,
  usage_notes text, created_at timestamptz not null default now()
);

create table if not exists content_submissions (
  id uuid primary key default gen_random_uuid(), organisation_id uuid not null references organisations(id) on delete cascade,
  title text not null, content_type text not null, campaign text, target_audience text, channel text, deadline timestamptz,
  priority text not null check (priority in ('normal', 'high', 'urgent')) default 'normal',
  status text not null check (status in ('draft', 'analysing', 'needs_changes', 'ready_for_review', 'pending_approval', 'approved', 'rejected', 'analysis_failed')) default 'draft',
  creator_id uuid not null references profiles(id), assigned_reviewer_id uuid references profiles(id), current_version_id uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists content_versions (
  id uuid primary key default gen_random_uuid(), submission_id uuid not null references content_submissions(id) on delete cascade,
  version integer not null, body text not null, created_by uuid not null references profiles(id), change_note text,
  created_at timestamptz not null default now(), unique (submission_id, version)
);

alter table content_submissions add constraint content_submissions_current_version_fk foreign key (current_version_id) references content_versions(id) deferrable initially deferred;

create table if not exists analysis_runs (
  id uuid primary key default gen_random_uuid(), submission_id uuid not null references content_submissions(id) on delete cascade,
  content_version_id uuid not null references content_versions(id), provider text not null, status text not null,
  started_at timestamptz not null default now(), completed_at timestamptz, error text
);

create table if not exists findings (
  id uuid primary key default gen_random_uuid(), submission_id uuid not null references content_submissions(id) on delete cascade,
  analysis_run_id uuid not null references analysis_runs(id) on delete cascade, content_version_id uuid not null references content_versions(id),
  category text not null, severity text not null check (severity in ('critical', 'high', 'medium', 'low')), confidence numeric not null check (confidence >= 0 and confidence <= 1),
  excerpt text not null, explanation text not null, evidence_references jsonb not null default '[]'::jsonb, suggested_correction text,
  human_review_required boolean not null default true, status text not null default 'open', resolution_note text, created_at timestamptz not null default now(), resolved_at timestamptz
);

create table if not exists suggested_corrections (
  id uuid primary key default gen_random_uuid(), finding_id uuid not null references findings(id) on delete cascade,
  body text not null, accepted boolean, created_at timestamptz not null default now()
);

create table if not exists review_assignments (
  id uuid primary key default gen_random_uuid(), submission_id uuid not null references content_submissions(id) on delete cascade,
  reviewer_id uuid not null references profiles(id), assigned_at timestamptz not null default now(), completed_at timestamptz
);

create table if not exists review_comments (
  id uuid primary key default gen_random_uuid(), submission_id uuid not null references content_submissions(id) on delete cascade,
  content_version_id uuid not null references content_versions(id), author_id uuid not null references profiles(id), body text not null,
  created_at timestamptz not null default now()
);

create table if not exists approval_decisions (
  id uuid primary key default gen_random_uuid(), submission_id uuid not null references content_submissions(id) on delete cascade,
  content_version_id uuid not null references content_versions(id), reviewer_id uuid not null references profiles(id),
  decision text not null check (decision in ('approved', 'rejected', 'changes_requested')), note text, created_at timestamptz not null default now()
);

create table if not exists audit_events (
  id uuid primary key default gen_random_uuid(), organisation_id uuid not null references organisations(id) on delete cascade,
  actor_id uuid not null references profiles(id), action text not null, entity_type text not null, entity_id uuid not null,
  metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);

create index if not exists organisation_members_profile_idx on organisation_members(profile_id);
create index if not exists content_submissions_org_status_idx on content_submissions(organisation_id, status);
create index if not exists findings_submission_status_idx on findings(submission_id, status);
create index if not exists audit_events_org_created_idx on audit_events(organisation_id, created_at desc);

-- Tenant isolation helper. In production, use this predicate in policies for every table.
create or replace function public.is_org_member(target_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from organisation_members where organisation_id = target_org and profile_id = auth.uid());
$$;

alter table organisations enable row level security;
alter table organisation_members enable row level security;
alter table brand_guidelines enable row level security;
alter table approved_facts enable row level security;
alter table terminology_rules enable row level security;
alter table brand_assets enable row level security;
alter table content_submissions enable row level security;
alter table content_versions enable row level security;
alter table analysis_runs enable row level security;
alter table findings enable row level security;
alter table suggested_corrections enable row level security;
alter table review_assignments enable row level security;
alter table review_comments enable row level security;
alter table approval_decisions enable row level security;
alter table audit_events enable row level security;

create policy organisations_member_read on organisations for select using (public.is_org_member(id));
create policy members_same_org_read on organisation_members for select using (public.is_org_member(organisation_id));
create policy guidelines_member_access on brand_guidelines for all using (public.is_org_member(organisation_id)) with check (public.is_org_member(organisation_id));
create policy facts_member_access on approved_facts for all using (public.is_org_member(organisation_id)) with check (public.is_org_member(organisation_id));
create policy terminology_member_access on terminology_rules for all using (public.is_org_member(organisation_id)) with check (public.is_org_member(organisation_id));
create policy assets_member_access on brand_assets for all using (public.is_org_member(organisation_id)) with check (public.is_org_member(organisation_id));
create policy submissions_member_access on content_submissions for all using (public.is_org_member(organisation_id)) with check (public.is_org_member(organisation_id));
create policy versions_member_access on content_versions for all using (exists (select 1 from content_submissions s where s.id = submission_id and public.is_org_member(s.organisation_id))) with check (exists (select 1 from content_submissions s where s.id = submission_id and public.is_org_member(s.organisation_id)));
create policy runs_member_access on analysis_runs for all using (exists (select 1 from content_submissions s where s.id = submission_id and public.is_org_member(s.organisation_id))) with check (exists (select 1 from content_submissions s where s.id = submission_id and public.is_org_member(s.organisation_id)));
create policy findings_member_access on findings for all using (exists (select 1 from content_submissions s where s.id = submission_id and public.is_org_member(s.organisation_id))) with check (exists (select 1 from content_submissions s where s.id = submission_id and public.is_org_member(s.organisation_id)));
create policy corrections_member_access on suggested_corrections for all using (exists (select 1 from findings f join content_submissions s on s.id = f.submission_id where f.id = finding_id and public.is_org_member(s.organisation_id))) with check (exists (select 1 from findings f join content_submissions s on s.id = f.submission_id where f.id = finding_id and public.is_org_member(s.organisation_id)));
create policy assignments_member_access on review_assignments for all using (exists (select 1 from content_submissions s where s.id = submission_id and public.is_org_member(s.organisation_id))) with check (exists (select 1 from content_submissions s where s.id = submission_id and public.is_org_member(s.organisation_id)));
create policy comments_member_access on review_comments for all using (exists (select 1 from content_submissions s where s.id = submission_id and public.is_org_member(s.organisation_id))) with check (exists (select 1 from content_submissions s where s.id = submission_id and public.is_org_member(s.organisation_id)));
create policy decisions_member_access on approval_decisions for all using (exists (select 1 from content_submissions s where s.id = submission_id and public.is_org_member(s.organisation_id))) with check (exists (select 1 from content_submissions s where s.id = submission_id and public.is_org_member(s.organisation_id)));
create policy audit_member_access on audit_events for all using (public.is_org_member(organisation_id)) with check (public.is_org_member(organisation_id));

create table if not exists analysis_jobs (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  submission_id uuid not null references content_submissions(id) on delete cascade,
  content_version_id uuid not null references content_versions(id) on delete cascade,
  analysis_run_id uuid not null references analysis_runs(id) on delete cascade,
  status text not null check (status in ('queued', 'running', 'completed', 'retry', 'failed')) default 'queued',
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 3 check (max_attempts > 0),
  run_after timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table brand_assets add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists analysis_jobs_claim_idx on analysis_jobs(status, run_after, created_at);
create index if not exists analysis_jobs_submission_idx on analysis_jobs(submission_id, content_version_id, status);

alter table analysis_jobs enable row level security;
create policy analysis_jobs_member_access on analysis_jobs for all
  using (public.is_org_member(organisation_id))
  with check (public.is_org_member(organisation_id));

create or replace function public.claim_brandshield_analysis_job(p_worker_id text)
returns setof public.analysis_jobs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare claimed public.analysis_jobs;
begin
  with candidate as (
    select id from public.analysis_jobs
    where status in ('queued', 'retry') and run_after <= now()
    order by created_at
    for update skip locked
    limit 1
  )
  update public.analysis_jobs job
  set status = 'running', locked_at = now(), locked_by = p_worker_id, attempts = job.attempts + 1, updated_at = now()
  from candidate
  where job.id = candidate.id
  returning job.* into claimed;
  if claimed.id is not null then return next claimed; end if;
  return;
end;
$$;

revoke all on function public.claim_brandshield_analysis_job(text) from public, anon, authenticated;
grant execute on function public.claim_brandshield_analysis_job(text) to service_role;

-- Extend the generic persistence RPC to include the durable analysis queue.
create or replace function public.apply_brandshield_store_changes(p_changes jsonb)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare table_name text; update_columns text; change_set jsonb;
begin
  for table_name in select jsonb_array_elements_text('["analysis_jobs","findings","review_comments","approval_decisions","analysis_runs","content_versions","content_submissions","brand_assets","brand_guidelines","approved_facts","terminology_rules","organisation_members","audit_events","organisations","profiles"]'::jsonb) loop
    change_set := p_changes->'changes'->table_name;
    if change_set is null then continue; end if;
    if jsonb_array_length(change_set->'delete') > 0 then
      execute format('delete from public.%I where id = any (array(select jsonb_array_elements_text($1))::uuid[])', table_name) using change_set->'delete';
    end if;
  end loop;
  for table_name in select jsonb_array_elements_text('["profiles","organisations","organisation_members","brand_guidelines","approved_facts","terminology_rules","brand_assets","content_submissions","content_versions","analysis_runs","analysis_jobs","findings","review_comments","approval_decisions","audit_events"]'::jsonb) loop
    change_set := p_changes->'changes'->table_name;
    if change_set is null or jsonb_array_length(change_set->'upsert') = 0 then continue; end if;
    select string_agg(format('%I = excluded.%I', attribute.attname, attribute.attname), ', ') into update_columns
    from pg_attribute attribute where attribute.attrelid = format('public.%I', table_name)::regclass and attribute.attnum > 0 and not attribute.attisdropped and attribute.attname <> 'id';
    execute format('insert into public.%I select * from jsonb_populate_recordset(null::public.%I, $1) on conflict (id) do update set %s', table_name, table_name, update_columns) using change_set->'upsert';
  end loop;
  if jsonb_array_length(p_changes->'linkSubmissions') > 0 then
    select string_agg(format('%I = excluded.%I', attribute.attname, attribute.attname), ', ') into update_columns
    from pg_attribute attribute where attribute.attrelid = 'public.content_submissions'::regclass and attribute.attnum > 0 and not attribute.attisdropped and attribute.attname <> 'id';
    execute format('insert into public.content_submissions select * from jsonb_populate_recordset(null::public.content_submissions, $1) on conflict (id) do update set %s', update_columns) using p_changes->'linkSubmissions';
  end if;
end $$;

revoke all on function public.apply_brandshield_store_changes(jsonb) from public, anon, authenticated;
grant execute on function public.apply_brandshield_store_changes(jsonb) to service_role;

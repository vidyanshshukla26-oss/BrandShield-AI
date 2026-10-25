alter table organisations
  add column if not exists mode text not null default 'live'
  check (mode in ('demo', 'live'));

alter table profiles add column if not exists avatar text;
alter table profiles add column if not exists created_at timestamptz not null default now();
alter table brand_assets add column if not exists file_name text not null default '';
alter table content_submissions add column if not exists analysis_error text;

update brand_assets set file_name = name where file_name = '';

alter table profiles enable row level security;
drop policy if exists profiles_member_read on profiles;
create policy profiles_member_read on profiles
  for select using (id = auth.uid());

do $$
declare
  profile_auth_fk text;
begin
  select constraint_row.conname
  into profile_auth_fk
  from pg_constraint as constraint_row
  where constraint_row.conrelid = 'public.profiles'::regclass
    and constraint_row.contype = 'f'
    and constraint_row.confrelid = 'auth.users'::regclass;

  if profile_auth_fk is not null then
    execute format('alter table public.profiles drop constraint %I', profile_auth_fk);
  end if;
end
$$;

create or replace function public.apply_brandshield_store_changes(p_changes jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  table_name text;
  update_columns text;
  change_set jsonb;
begin
  for table_name in
    select jsonb_array_elements_text(
      '["findings","review_comments","approval_decisions","analysis_runs","content_versions","content_submissions","brand_assets","brand_guidelines","approved_facts","terminology_rules","organisation_members","audit_events","organisations","profiles"]'::jsonb
    )
  loop
    change_set := p_changes->'changes'->table_name;
    if change_set is null then
      continue;
    end if;
    if jsonb_array_length(change_set->'delete') > 0 then
      execute format(
        'delete from public.%I where id = any (array(select jsonb_array_elements_text($1))::uuid[])',
        table_name
      ) using change_set->'delete';
    end if;
  end loop;

  for table_name in
    select jsonb_array_elements_text(
      '["profiles","organisations","organisation_members","brand_guidelines","approved_facts","terminology_rules","brand_assets","content_submissions","content_versions","analysis_runs","findings","review_comments","approval_decisions","audit_events"]'::jsonb
    )
  loop
    change_set := p_changes->'changes'->table_name;
    if change_set is null or jsonb_array_length(change_set->'upsert') = 0 then
      continue;
    end if;

    select string_agg(format('%I = excluded.%I', attribute.attname, attribute.attname), ', ')
    into update_columns
    from pg_attribute as attribute
    where attribute.attrelid = format('public.%I', table_name)::regclass
      and attribute.attnum > 0
      and not attribute.attisdropped
      and attribute.attname <> 'id';

    execute format(
      'insert into public.%I select * from jsonb_populate_recordset(null::public.%I, $1) on conflict (id) do update set %s',
      table_name,
      table_name,
      update_columns
    ) using change_set->'upsert';
  end loop;

  if jsonb_array_length(p_changes->'linkSubmissions') > 0 then
    select string_agg(format('%I = excluded.%I', attribute.attname, attribute.attname), ', ')
    into update_columns
    from pg_attribute as attribute
    where attribute.attrelid = 'public.content_submissions'::regclass
      and attribute.attnum > 0
      and not attribute.attisdropped
      and attribute.attname <> 'id';

    execute format(
      'insert into public.content_submissions select * from jsonb_populate_recordset(null::public.content_submissions, $1) on conflict (id) do update set %s',
      update_columns
    ) using p_changes->'linkSubmissions';
  end if;
end
$$;

revoke all on function public.apply_brandshield_store_changes(jsonb) from public, anon, authenticated;
grant execute on function public.apply_brandshield_store_changes(jsonb) to service_role;

-- Unified anonymous visitor identity: additive migration only.
-- Existing chat and analytics records are retained. Legacy identifiers are not force-merged.

create table if not exists public.visitor_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  visit_count bigint not null default 0 check (visit_count >= 0),
  classification text not null default 'new'
    check (classification in ('new','casual','returning','regular')),
  updated_at timestamptz not null default now()
);

create index if not exists visitor_profiles_last_seen_idx
  on public.visitor_profiles (last_seen desc);
create index if not exists visitor_profiles_classification_idx
  on public.visitor_profiles (classification);

alter table public.site_page_views
  add column if not exists visitor_id uuid references public.visitor_profiles(id) on delete set null;
create index if not exists site_page_views_visitor_id_created_at_idx
  on public.site_page_views (visitor_id, created_at desc);

create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  visitor_id uuid not null references public.visitor_profiles(id) on delete cascade,
  title text not null default 'AI 科普问答',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ai_conversations_visitor_updated_idx
  on public.ai_conversations (visitor_id, updated_at desc);

alter table public.ai_qa_logs
  add column if not exists conversation_id uuid
    references public.ai_conversations(id) on delete set null;
create index if not exists ai_qa_logs_visitor_created_idx
  on public.ai_qa_logs (visitor_id, created_at desc);
create index if not exists ai_qa_logs_conversation_created_idx
  on public.ai_qa_logs (conversation_id, created_at desc);

alter table public.visitor_profiles enable row level security;
alter table public.ai_conversations enable row level security;

drop policy if exists "Visitors read own visitor profile" on public.visitor_profiles;
create policy "Visitors read own visitor profile"
  on public.visitor_profiles for select to authenticated
  using (id = (select auth.uid()) or public.is_admin());

drop policy if exists "Admins manage visitor profiles" on public.visitor_profiles;
create policy "Admins manage visitor profiles"
  on public.visitor_profiles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Visitors read own AI conversations" on public.ai_conversations;
create policy "Visitors read own AI conversations"
  on public.ai_conversations for select to authenticated
  using (visitor_id = (select auth.uid()) or public.is_admin());

drop policy if exists "Visitors create own AI conversations" on public.ai_conversations;
create policy "Visitors create own AI conversations"
  on public.ai_conversations for insert to authenticated
  with check (visitor_id = (select auth.uid()));

drop policy if exists "Visitors update own AI conversations" on public.ai_conversations;
create policy "Visitors update own AI conversations"
  on public.ai_conversations for update to authenticated
  using (visitor_id = (select auth.uid()) or public.is_admin())
  with check (visitor_id = (select auth.uid()) or public.is_admin());

-- Called by the browser with its authenticated anon session. Identity is always auth.uid().
create or replace function public.record_visitor_page_view(p_page_path text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := auth.uid();
  v_count bigint;
  v_last timestamptz;
  v_classification text;
begin
  if v_id is null then
    raise exception 'Authentication required';
  end if;
  if p_page_path is null or char_length(p_page_path) < 1 or char_length(p_page_path) > 300 then
    raise exception 'Invalid page path';
  end if;

  insert into public.visitor_profiles (id, first_seen, last_seen, visit_count, classification)
  values (v_id, now(), now(), 1, 'new')
  on conflict (id) do update
    set last_seen = now(),
        visit_count = public.visitor_profiles.visit_count + 1,
        updated_at = now()
  returning visit_count, last_seen into v_count, v_last;

  -- Classification is based on observed visits, not a claim about a real person's identity.
  v_classification := case
    when v_count >= 10 and v_last >= now() - interval '30 days' then 'regular'
    when v_count >= 3 then 'returning'
    when v_count >= 2 then 'casual'
    else 'new'
  end;
  update public.visitor_profiles
    set classification = v_classification, updated_at = now()
    where id = v_id;

  insert into public.site_page_views (visitor_key, visitor_id, page_path)
  values (v_id::text, v_id, p_page_path);
end;
$$;

revoke all on function public.record_visitor_page_view(text) from public;
grant execute on function public.record_visitor_page_view(text) to authenticated;

-- AI log reads remain admin-only. Writes are performed by the trusted Edge Function.
drop policy if exists "Admins can read AI QA logs" on public.ai_qa_logs;
create policy "Admins can read AI QA logs"
  on public.ai_qa_logs for select to authenticated
  using (public.is_admin());

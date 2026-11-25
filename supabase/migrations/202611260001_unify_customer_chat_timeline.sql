-- Unified one-customer / one-logical-conversation migration.
-- AI and human messages share chat_conversations/chat_messages.
-- Legacy AI tables remain as an archive for compatibility and audit history.

begin;

-- Keep one canonical AI archive conversation per visitor (oldest row wins).
with ranked as (
  select id, visitor_id,
         first_value(id) over (partition by visitor_id order by created_at, id) as keep_id,
         row_number() over (partition by visitor_id order by created_at, id) as rn
  from public.ai_conversations
)
update public.ai_qa_logs q
set conversation_id = r.keep_id
from ranked r
where q.conversation_id = r.id and r.rn > 1;

with ranked as (
  select id, visitor_id,
         first_value(id) over (partition by visitor_id order by created_at, id) as keep_id,
         row_number() over (partition by visitor_id order by created_at, id) as rn
  from public.ai_conversations
)
update public.ai_qa_logs q
set conversation_id = r.keep_id
from ranked r
where q.visitor_id = r.visitor_id and q.conversation_id is null;

with ranked as (
  select id, row_number() over (partition by visitor_id order by created_at, id) as rn
  from public.ai_conversations
)
delete from public.ai_conversations a
using ranked r
where a.id = r.id and r.rn > 1;

create unique index if not exists ai_conversations_one_per_visitor_uidx
  on public.ai_conversations(visitor_id);

-- Merge any duplicate human conversations into the oldest canonical thread.
with ranked as (
  select id, owner_id,
         first_value(id) over (partition by owner_id order by created_at, id) as keep_id,
         row_number() over (partition by owner_id order by created_at, id) as rn
  from public.chat_conversations
)
update public.chat_messages m
set conversation_id = r.keep_id
from ranked r
where m.conversation_id = r.id and r.rn > 1;

with ranked as (
  select id, row_number() over (partition by owner_id order by created_at, id) as rn
  from public.chat_conversations
)
delete from public.chat_conversations c
using ranked r
where c.id = r.id and r.rn > 1;

create unique index if not exists chat_conversations_one_per_owner_uidx
  on public.chat_conversations(owner_id);

-- Create the canonical shared thread for every existing visitor profile.
insert into public.chat_conversations(owner_id, subject, status)
select p.id, '邻伊 AI 统一咨询', 'open'
from public.visitor_profiles p
where not exists (select 1 from public.chat_conversations c where c.owner_id = p.id)
on conflict (owner_id) do nothing;

-- Extend the existing message model to identify AI messages explicitly.
alter table public.chat_messages
  drop constraint if exists chat_messages_sender_role_check;
alter table public.chat_messages
  add constraint chat_messages_sender_role_check
  check (sender_role = any (array['visitor'::text, 'admin'::text, 'ai'::text]));

alter table public.chat_messages
  drop constraint if exists chat_messages_content_check;
alter table public.chat_messages
  add constraint chat_messages_content_check
  check (char_length(content) >= 1 and char_length(content) <= 12000);

create index if not exists chat_messages_conversation_created_idx
  on public.chat_messages(conversation_id, created_at, id);

-- Backfill the full AI question/answer history into the unified conversation.
-- Original ai_qa_logs rows are retained unchanged.
insert into public.chat_messages(conversation_id, sender_id, sender_role, content, created_at)
select c.id, q.visitor_id, 'visitor', q.question, q.created_at
from public.ai_qa_logs q
join public.chat_conversations c on c.owner_id = q.visitor_id
where q.question is not null and length(q.question) between 1 and 12000;

insert into public.chat_messages(conversation_id, sender_id, sender_role, content, created_at)
select c.id, q.visitor_id, 'ai', q.answer, q.created_at + interval '1 millisecond'
from public.ai_qa_logs q
join public.chat_conversations c on c.owner_id = q.visitor_id
where q.answer is not null and length(q.answer) between 1 and 12000;

-- Keep conversation ordering in sync with messages from either channel.
create or replace function public.touch_chat_conversation_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.chat_conversations
  set updated_at = greatest(updated_at, new.created_at)
  where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists chat_messages_touch_conversation on public.chat_messages;
create trigger chat_messages_touch_conversation
after insert on public.chat_messages
for each row execute function public.touch_chat_conversation_updated_at();

commit;

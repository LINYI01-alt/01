-- Keep the single customer conversation ordered by its latest message.
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

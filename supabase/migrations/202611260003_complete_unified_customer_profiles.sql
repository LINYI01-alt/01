-- Ensure human-chat-only visitors also have a customer profile.
insert into public.visitor_profiles(id, first_seen, last_seen, last_visit_at, visit_count, classification)
select c.owner_id, min(c.created_at), max(c.updated_at), max(c.updated_at), 1, 'returning'
from public.chat_conversations c
left join public.visitor_profiles p on p.id = c.owner_id
where p.id is null
group by c.owner_id
on conflict (id) do nothing;

-- The project already has chat_message_touch_conversation.
-- Remove the redundant trigger added during the first unified-chat rollout.
drop trigger if exists chat_messages_touch_conversation on public.chat_messages;

-- 0011_notification_email_queue.sql
--
-- Emails are a delivery detail of a notification, not a second notification
-- system. `notify_workspace` still writes the in-app row (that is what the bell
-- and the notifications API read), and now also queues one `notification` job so
-- the Railway worker can deliver it over the configured email provider.
--
-- Nothing here claims an email was sent: the worker marks `emailed_at` only
-- after the provider accepts the message, and reports "no email provider
-- configured" otherwise.

create or replace function public.notify_workspace(
  p_workspace_id uuid,
  p_type text,
  p_title text,
  p_body text default null,
  p_link text default null,
  p_severity text default 'info',
  p_user_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  insert into public.notifications (workspace_id, user_id, type, title, body, link, severity, metadata)
  values (
    p_workspace_id,
    p_user_id,
    p_type,
    left(coalesce(p_title, 'Notification'), 200),
    left(p_body, 1000),
    left(p_link, 300),
    coalesce(p_severity, 'info'),
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_id;

  -- Email delivery is queued, never sent inline: the API request returns fast
  -- and the worker owns retries. The dedupe key keeps a retried notification
  -- from queueing twice.
  perform ops.queue_enqueue(
    p_job_type    => 'notification',
    p_payload     => jsonb_build_object('notification_id', v_id),
    p_workspace_id => p_workspace_id,
    p_priority    => 20,
    p_dedupe_key  => 'notification:' || v_id::text,
    p_max_attempts => 3,
    p_scheduled_by => 'notify_workspace'
  );

  return v_id;
end;
$$;

comment on function public.notify_workspace(uuid, text, text, text, text, text, uuid, jsonb) is
  'Creates an in-app notification and queues one email-delivery job for the worker.';

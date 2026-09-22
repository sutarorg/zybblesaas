-- ============================================================================
-- Zybble · 0008 · Row Level Security
--
-- Two layers of defence:
--   1. The SPA talks to /api (Vercel) which uses the secret key and performs its
--      own authorization (workspace membership, role, entitlement).
--   2. The browser also holds the publishable key, so *every* customer table is
--      protected by RLS as if it were directly exposed. Cross-workspace reads
--      and writes must be impossible even with a valid user JWT.
--
-- Supabase evaluates GRANTS before policies: we therefore revoke the automatic
-- grants from `anon`/`authenticated` and grant back only what is required.
-- ============================================================================

-- ###########################################################################
-- # grants (defence in depth — must run before/with the policies)
-- ###########################################################################

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'workspaces', 'workspace_members', 'workspace_invites', 'workspace_preferences',
    'notification_preferences', 'plans', 'billing_customers', 'subscriptions', 'payments', 'invoices',
    'payment_methods', 'usage_counters', 'usage_events', 'geo_places', 'leads', 'lead_emails',
    'lead_social_profiles', 'lead_reviews', 'workspace_leads', 'lead_ai_analyses', 'searches',
    'search_inputs', 'search_leads', 'search_events', 'lists', 'list_leads', 'exports',
    'notifications', 'api_keys', 'ai_conversations', 'ai_messages', 'ai_runs', 'audit_logs'
  ]
  loop
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- The API (Vercel) and the worker (Railway) authenticate with the secret key,
-- which maps to `service_role`: RLS does not apply to it, but table privileges
-- still do. Grant them explicitly so the schema is self-contained and does not
-- depend on the project's default privileges.
grant usage on schema public to service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

grant usage on schema ops to service_role;
grant all privileges on all tables in schema ops to service_role;
grant all privileges on all sequences in schema ops to service_role;
grant execute on all functions in schema ops to service_role;

-- read access required for Realtime Postgres Changes (RLS still filters rows)
grant select on table public.workspaces, public.workspace_members, public.workspace_preferences to authenticated;
grant select on table public.notification_preferences to authenticated;
grant select on table public.plans to anon, authenticated;
grant select on table public.usage_counters, public.usage_events to authenticated;
grant select on table public.searches, public.search_inputs, public.search_leads, public.search_events to authenticated;
grant select on table public.lists, public.list_leads to authenticated;
grant select on table public.exports to authenticated;
grant select on table public.notifications to authenticated;
grant select on table public.leads, public.lead_emails, public.lead_social_profiles, public.lead_reviews to authenticated;
grant select on table public.workspace_leads, public.lead_ai_analyses to authenticated;
grant select on table public.ai_conversations, public.ai_messages, public.ai_runs to authenticated;
grant select on table public.geo_places to authenticated;
grant select on table public.billing_customers, public.subscriptions, public.payments, public.invoices, public.payment_methods to authenticated;
grant select on table public.audit_logs to authenticated;
grant select, update on table public.profiles to authenticated;
grant update on table public.notifications to authenticated;
grant update on table public.notification_preferences to authenticated;
grant update on table public.workspace_preferences to authenticated;

-- `api_keys` is intentionally NOT granted to authenticated: the API returns
-- key metadata through /api/settings/api-keys and the hash must never reach a
-- browser, not even the workspace owner's.

-- ###########################################################################
-- # identity
-- ###########################################################################

drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_self on public.profiles
  for select to authenticated
  using (id = auth.uid() or exists (
    select 1 from public.workspace_members mine
      join public.workspace_members theirs on theirs.workspace_id = mine.workspace_id
     where mine.user_id = auth.uid() and mine.status = 'active'
       and theirs.user_id = profiles.id and theirs.status = 'active'
  ));

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and is_platform_admin = (select p.is_platform_admin from public.profiles p where p.id = auth.uid()));

drop policy if exists workspaces_select_member on public.workspaces;
create policy workspaces_select_member on public.workspaces
  for select to authenticated
  using (public.is_workspace_member(id) or owner_id = auth.uid());

drop policy if exists workspace_members_select_member on public.workspace_members;
create policy workspace_members_select_member on public.workspace_members
  for select to authenticated
  using (public.is_workspace_member(workspace_id) or user_id = auth.uid());

drop policy if exists workspace_preferences_member on public.workspace_preferences;
create policy workspace_preferences_member on public.workspace_preferences
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists workspace_preferences_update_member on public.workspace_preferences;
create policy workspace_preferences_update_member on public.workspace_preferences
  for update to authenticated
  using (public.has_workspace_role(workspace_id, array['owner', 'admin', 'member']))
  with check (public.has_workspace_role(workspace_id, array['owner', 'admin', 'member']));

drop policy if exists notification_preferences_member on public.notification_preferences;
create policy notification_preferences_member on public.notification_preferences
  for select to authenticated
  using (public.is_workspace_member(workspace_id) and (user_id = auth.uid() or public.has_workspace_role(workspace_id, array['owner', 'admin'])));

drop policy if exists notification_preferences_update_own on public.notification_preferences;
create policy notification_preferences_update_own on public.notification_preferences
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ###########################################################################
-- # billing (read-only for owners/admins; every mutation goes through /api)
-- ###########################################################################

drop policy if exists plans_read_all on public.plans;
create policy plans_read_all on public.plans
  for select to anon, authenticated
  using (is_public and is_active);

drop policy if exists billing_customers_read on public.billing_customers;
create policy billing_customers_read on public.billing_customers
  for select to authenticated
  using (public.has_workspace_role(workspace_id, array['owner', 'admin']));

drop policy if exists subscriptions_read on public.subscriptions;
create policy subscriptions_read on public.subscriptions
  for select to authenticated
  using (public.has_workspace_role(workspace_id, array['owner', 'admin']));

drop policy if exists payments_read on public.payments;
create policy payments_read on public.payments
  for select to authenticated
  using (public.has_workspace_role(workspace_id, array['owner', 'admin']));

drop policy if exists invoices_read on public.invoices;
create policy invoices_read on public.invoices
  for select to authenticated
  using (public.has_workspace_role(workspace_id, array['owner', 'admin']));

drop policy if exists payment_methods_read on public.payment_methods;
create policy payment_methods_read on public.payment_methods
  for select to authenticated
  using (public.has_workspace_role(workspace_id, array['owner', 'admin']));

-- ###########################################################################
-- # usage
-- ###########################################################################

drop policy if exists usage_counters_read on public.usage_counters;
create policy usage_counters_read on public.usage_counters
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists usage_events_read on public.usage_events;
create policy usage_events_read on public.usage_events
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

-- ###########################################################################
-- # leads — visible only through a workspace the user belongs to
-- ###########################################################################

drop policy if exists leads_read_via_workspace on public.leads;
create policy leads_read_via_workspace on public.leads
  for select to authenticated
  using (
    deleted_at is null
    and exists (
      select 1
        from public.workspace_leads wl
       where wl.lead_id = leads.id
         and public.is_workspace_member(wl.workspace_id)
    )
  );

drop policy if exists workspace_leads_read on public.workspace_leads;
create policy workspace_leads_read on public.workspace_leads
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists lead_emails_read on public.lead_emails;
create policy lead_emails_read on public.lead_emails
  for select to authenticated
  using (exists (
    select 1 from public.workspace_leads wl
     where wl.lead_id = lead_emails.lead_id and public.is_workspace_member(wl.workspace_id)
  ));

drop policy if exists lead_social_read on public.lead_social_profiles;
create policy lead_social_read on public.lead_social_profiles
  for select to authenticated
  using (exists (
    select 1 from public.workspace_leads wl
     where wl.lead_id = lead_social_profiles.lead_id and public.is_workspace_member(wl.workspace_id)
  ));

drop policy if exists lead_reviews_read on public.lead_reviews;
create policy lead_reviews_read on public.lead_reviews
  for select to authenticated
  using (exists (
    select 1 from public.workspace_leads wl
     where wl.lead_id = lead_reviews.lead_id and public.is_workspace_member(wl.workspace_id)
  ));

drop policy if exists lead_ai_read on public.lead_ai_analyses;
create policy lead_ai_read on public.lead_ai_analyses
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

-- ###########################################################################
-- # searches / lists / exports / notifications
-- ###########################################################################

drop policy if exists searches_read on public.searches;
create policy searches_read on public.searches
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists search_inputs_read on public.search_inputs;
create policy search_inputs_read on public.search_inputs
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists search_leads_read on public.search_leads;
create policy search_leads_read on public.search_leads
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists search_events_read on public.search_events;
create policy search_events_read on public.search_events
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists lists_read on public.lists;
create policy lists_read on public.lists
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists list_leads_read on public.list_leads;
create policy list_leads_read on public.list_leads
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists exports_read on public.exports;
create policy exports_read on public.exports
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists notifications_read on public.notifications;
create policy notifications_read on public.notifications
  for select to authenticated
  using (
    public.is_workspace_member(workspace_id)
    and (user_id is null or user_id = auth.uid())
  );

drop policy if exists notifications_mark_read on public.notifications;
create policy notifications_mark_read on public.notifications
  for update to authenticated
  using (public.is_workspace_member(workspace_id) and (user_id is null or user_id = auth.uid()))
  with check (public.is_workspace_member(workspace_id) and (user_id is null or user_id = auth.uid()));

-- ###########################################################################
-- # AI
-- ###########################################################################

drop policy if exists ai_conversations_read on public.ai_conversations;
create policy ai_conversations_read on public.ai_conversations
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists ai_messages_read on public.ai_messages;
create policy ai_messages_read on public.ai_messages
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists ai_runs_read on public.ai_runs;
create policy ai_runs_read on public.ai_runs
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

-- ###########################################################################
-- # audit log — owners/admins only
-- ###########################################################################

drop policy if exists audit_logs_read on public.audit_logs;
create policy audit_logs_read on public.audit_logs
  for select to authenticated
  using (public.has_workspace_role(workspace_id, array['owner', 'admin']));

-- ###########################################################################
-- # public pricing view (no customer data, safe for anon/authenticated)
-- ###########################################################################

-- (created here and granted at the end of this migration)

create or replace view public.public_plans as
  select code, name, description, price_minor, currency, billing_interval, trial_days, features
    from public.plans
   where is_public and is_active;

grant select on public.public_plans to anon, authenticated;

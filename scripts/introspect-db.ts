import { createTestDb, createUser } from "/home/user/zybblesaas/tests/db/harness";
(async () => {
  const db = await createTestDb();
  const { workspaceId, userId } = await createUser(db, "x@acme.test", { company: "Acme" });
  const [lead] = await db.sql<{id:string}>(`insert into public.leads (slug, business_name, raw_data) values ('l1','L','{}') returning id`);
  await db.sql(`select public.lead_sync_children($1, $2::jsonb)`, [lead.id, JSON.stringify({ emails: [{ email: "Termin@Zahnarzt-Berlin.de", source: "website_scrape", is_primary: true }] })]);
  console.log('type:', JSON.stringify(await db.sql(`select data_type, udt_name from information_schema.columns where table_name='lead_emails' and column_name='email'`)));
  console.log('raw:', JSON.stringify(await db.sql(`select email, email::text as t from public.lead_emails`)));
  console.log('dupe check:', JSON.stringify(await db.sql(`select count(*)::int c from public.lead_emails where email = 'termin@zahnarzt-berlin.de'::citext`)));
  await db.close();
})();

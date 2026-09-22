/**
 * Dev-only: dumps the deployed schema (tables → columns) from the migration
 * files, so server code can be checked against reality instead of assumptions.
 *
 *   npx tsx scripts/schema-dump.ts > /tmp/schema.txt
 */
import { createTestDb } from "../tests/db/harness";

async function main() {
  const db = await createTestDb();
  const tables = await db.sql<{ table_schema: string; table_name: string }>(
    `select table_schema, table_name
       from information_schema.tables
      where table_schema in ('public', 'ops')
        and table_type = 'BASE TABLE'
      order by table_schema, table_name`,
  );

  for (const table of tables) {
    const columns = await db.sql<{ column_name: string; data_type: string; is_nullable: string }>(
      `select column_name, data_type, is_nullable
         from information_schema.columns
        where table_schema = $1 and table_name = $2
        order by ordinal_position`,
      [table.table_schema, table.table_name],
    );
    console.log(`\n### ${table.table_schema}.${table.table_name}`);
    for (const column of columns) {
      console.log(`${column.column_name}\t${column.data_type}\t${column.is_nullable === "YES" ? "null" : "not null"}`);
    }
  }

  const functions = await db.sql<{ schema: string; name: string; args: string; returns: string }>(
    `select n.nspname as schema,
            p.proname as name,
            pg_get_function_arguments(p.oid) as args,
            pg_get_function_result(p.oid) as returns
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public', 'ops')
      order by 1, 2`,
  );
  console.log("\n### functions");
  for (const fn of functions) {
    console.log(`${fn.schema}.${fn.name}(${fn.args}) -> ${fn.returns}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

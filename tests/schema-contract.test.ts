/**
 * Schema contract test.
 *
 * The API layer talks to Postgres through PostgREST/RPC by name, and
 * TypeScript cannot check those names. This test reads the real schema out of
 * the migration files (via PGlite) and then walks every server source file,
 * asserting that:
 *
 *   * every table referenced by `.from("…")` exists,
 *   * every column referenced by select/filter/order exists on that table,
 *   * every RPC function and every named argument exists with the right name.
 *
 * It is deliberately conservative: anything it cannot resolve unambiguously is
 * reported instead of skipped silently.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./db/harness";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const API_DIR = join(ROOT, "api");
const WORKER_DIR = join(ROOT, "worker");

type Schema = {
  tables: Map<string, Set<string>>;
  functions: Map<string, Set<string>>;
};

let schema: Schema;
let files: Array<{ path: string; text: string }> = [];

async function loadSchema(db: TestDb): Promise<Schema> {
  const tables = new Map<string, Set<string>>();
  const columns = await db.sql<{ table_schema: string; table_name: string; column_name: string }>(
    `select table_schema, table_name, column_name
       from information_schema.columns
      where table_schema in ('public', 'ops')`,
  );
  for (const row of columns) {
    const key = `${row.table_schema}.${row.table_name}`;
    if (!tables.has(key)) tables.set(key, new Set());
    tables.get(key)?.add(row.column_name);
  }

  const functions = new Map<string, Set<string>>();
  const rows = await db.sql<{ schema: string; name: string; args: string }>(
    `select n.nspname as schema, p.proname as name, pg_get_function_arguments(p.oid) as args
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public', 'ops')`,
  );
  for (const row of rows) {
    const key = `${row.schema}.${row.name}`;
    if (!functions.has(key)) functions.set(key, new Set());
    for (const argument of (row.args ?? "").split(",")) {
      const name = argument.trim().split(/\s+/)[0];
      if (name) functions.get(key)?.add(name);
    }
  }

  return { tables, functions };
}

function walk(dir: string, extensions: string[]): string[] {
  const out: string[] = [];
  const visit = (current: string) => {
    for (const entry of readdirSync(current)) {
      const full = join(current, entry);
      if (statSync(full).isDirectory()) {
        if (entry === "node_modules" || entry === "dist") continue;
        visit(full);
      } else if (extensions.some((extension) => entry.endsWith(extension))) {
        out.push(full);
      }
    }
  };
  if (statSync(dir, { throwIfNoEntry: false })) visit(dir);
  return out;
}

/** Columns named by `.select("…")`, unwrapping embedded relations. */
function selectColumns(expression: string): Array<{ table: string | null; column: string }> {
  const out: Array<{ table: string | null; column: string }> = [];
  const selectCall = expression.match(/\.select\(\s*"([^"]+)"/);
  if (!selectCall) return out;

  const raw = selectCall[1];
  let depth = 0;
  let token = "";
  const flush = (embeddedTable: string | null) => {
    const name = token.trim();
    token = "";
    if (!name || name === "*") return;
    const clean = name.startsWith("count") ? null : name;
    if (!clean) return;
    const [head] = clean.split(":");
    if (embeddedTable) out.push({ table: embeddedTable, column: head });
    else out.push({ table: null, column: head });
  };

  let embeddedTable: string | null = null;
  for (let index = 0; index < raw.length; index++) {
    const char = raw[index];
    if (char === "(") {
      // "relation!inner(" carries the column list of the embedded table
      const match = token.match(/([\w]+)!?[\w]*$/);
      embeddedTable = match ? match[1] : null;
      token = "";
      depth++;
      continue;
    }
    if (char === ")") {
      flush(embeddedTable);
      embeddedTable = null;
      depth--;
      continue;
    }
    if (char === ",") {
      flush(embeddedTable);
      continue;
    }
    token += char;
  }
  flush(embeddedTable);

  return out;
}

const FILTER_METHODS = ["eq", "neq", "gt", "gte", "lt", "lte", "is", "in", "ilike", "like", "contains", "containedBy", "overlaps", "textSearch", "order"];

function filterColumns(expression: string): Array<{ table: string | null; column: string }> {
  const out: Array<{ table: string | null; column: string }> = [];
  for (const method of FILTER_METHODS) {
    const regex = new RegExp(`\\.${method}\\(\\s*"([^"]+)"`, "g");
    for (const match of expression.matchAll(regex)) {
      const value = match[1];
      if (value.includes("(") || value.startsWith("count")) continue;
      const [head, tableColumn] = value.includes(".") ? value.split(".") : [null, value];
      if (head) {
        // "leads.email_primary" — filter applied to an embedded table
        out.push({ table: head, column: tableColumn });
      } else {
        out.push({ table: null, column: tableColumn });
      }
    }
  }
  return out;
}

function chains(text: string): Array<{ table: string; expression: string }> {
  const out: Array<{ table: string; expression: string }> = [];
  const regex = /\.from\(\s*"([\w]+)"\s*\)/g;
  for (const match of text.matchAll(regex)) {
    const start = match.index ?? 0;
    const rest = text.slice(start + match[0].length);
    // Stop at the next chain so columns cannot bleed between queries.
    const nextChain = rest.search(/\.from\(\s*"[\w]+"\s*\)/);
    const tail = rest.search(/\n\s{4}\}|\n\s*const |\n\s*await /);
    const limit = Math.min(900, rest.length, nextChain === -1 ? 900 : nextChain, tail === -1 ? 900 : tail + 20);
    out.push({ table: match[1], expression: match[0] + rest.slice(0, Math.max(0, limit)) });
  }
  return out;
}

function rpcCalls(text: string): Array<{ name: string; args: string[] }> {
  const out: Array<{ name: string; args: string[] }> = [];
  const regex = /rpc(?:Rows)?\s*(?:<[^>]*>)?\(\s*"([\w]+)"\s*,?\s*(\{[\s\S]{0,400}?\})?/g;
  for (const match of text.matchAll(regex)) {
    const args = [...(match[2] ?? "").matchAll(/(p_[a-z0-9_]+)\s*:/g)].map((argMatch) => argMatch[1]);
    out.push({ name: match[1], args });
  }
  return out;
}

function isKnownTable(name: string): boolean {
  return schema.tables.has(`public.${name}`) || schema.tables.has(`ops.${name}`);
}

function columnsOf(name: string): Set<string> {
  return schema.tables.get(`public.${name}`) ?? schema.tables.get(`ops.${name}`) ?? new Set();
}

beforeAll(async () => {
  const db = await createTestDb();
  schema = await loadSchema(db);
  await db.close();

  files = [
    ...walk(API_DIR, [".ts"]),
    ...walk(WORKER_DIR, [".go"]),
  ].map((path) => ({ path: relative(ROOT, path), text: readFileSync(path, "utf8") }));
}, 120_000);

describe("schema contract", () => {
  it("knows the tables the server code talks about", () => {
    expect(schema.tables.size).toBeGreaterThan(25);
    expect(isKnownTable("searches")).toBe(true);
    expect(isKnownTable("job_queue")).toBe(true);
  });

  it("references only existing tables", () => {
    const problems: string[] = [];
    for (const file of files) {
      for (const chain of chains(file.text)) {
        if (chain.table === "auth") continue; // supabase.auth.admin
        if (!isKnownTable(chain.table)) problems.push(`${file.path}: unknown table "${chain.table}"`);
      }
    }
    expect(problems).toEqual([]);
  });

  it("selects, filters and orders by real columns", () => {
    const problems: string[] = [];
    for (const file of files) {
      for (const chain of chains(file.text)) {
        const own = columnsOf(chain.table);
        for (const { table, column } of [...selectColumns(chain.expression), ...filterColumns(chain.expression)]) {
          const target = table ? columnsOf(table) : own;
          if (target.size === 0) {
            problems.push(`${file.path}: cannot resolve relation "${table}" while checking "${column}"`);
            continue;
          }
          if (!target.has(column)) {
            problems.push(`${file.path}: ${table ? `${table}.` : `${chain.table}.`}${column} does not exist`);
          }
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it("calls only existing RPC functions with matching arguments", () => {
    const problems: string[] = [];
    for (const file of files) {
      for (const call of rpcCalls(file.text)) {
        const fn = schema.functions.get(`public.${call.name}`) ?? schema.functions.get(`ops.${call.name}`);
        if (!fn) {
          problems.push(`${file.path}: unknown function ${call.name}()`);
          continue;
        }
        for (const argument of call.args) {
          if (!fn.has(argument)) problems.push(`${file.path}: ${call.name}() has no argument ${argument}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it("uses only real SQL functions and columns in the Go worker", () => {
    const problems: string[] = [];
    for (const file of files.filter((candidate) => candidate.path.endsWith(".go"))) {
      for (const match of file.text.matchAll(/\b(public|ops)\.([a-z_]+)\s*\(/g)) {
        const key = `${match[1]}.${match[2]}`;
        if (!schema.functions.has(key)) problems.push(`${file.path}: unknown function ${key}()`);
      }
    }
    expect(problems).toEqual([]);
  });
});

#!/usr/bin/env node
/**
 * Diagnose a Supabase DATABASE_URL the way the Railway worker will use it.
 *
 *   node scripts/check-database-url.mjs "$DATABASE_URL"
 *
 * Exits 0 when the host resolves to IPv4 and a TCP+TLS handshake completes;
 * exits 1 with an actionable message otherwise. Never prints the password.
 */
import { lookup } from "node:dns/promises";
import { connect } from "node:net";
import { URL } from "node:url";

const raw = process.argv[2] || process.env.DATABASE_URL || "";
if (!raw) {
  console.error("usage: node scripts/check-database-url.mjs <DATABASE_URL>");
  process.exit(2);
}

let url;
try {
  url = new URL(raw);
} catch {
  console.error("DATABASE_URL is not a valid URL");
  process.exit(1);
}

const host = url.hostname;
const port = Number(url.port || 5432);
const user = url.username || "(none)";
console.log(`host=${host} port=${port} user=${user} sslmode=${url.searchParams.get("sslmode") || "(unset)"}`);

let v4 = [];
let v6 = [];
try {
  const records = await lookup(host, { all: true });
  v4 = records.map((r) => r.address).filter((a) => !a.includes(":"));
  v6 = records.map((r) => r.address).filter((a) => a.includes(":"));
} catch (e) {
  console.error(`DNS failed for ${host}: ${e.message}`);
  process.exit(1);
}
console.log(`A=${v4.length ? v4.join(",") : "(none)"} AAAA=${v6.length ? v6.join(",") : "(none)"}`);

if (v4.length === 0 && v6.length > 0) {
  console.error(
    [
      "FAIL: host is IPv6-only. Railway has no outbound IPv6, so the worker",
      "will loop on 'database connection failed … network is unreachable'.",
      "Fix: Supabase Dashboard → Connect → Session pooler; use that string",
      "(aws-<index>-<region>.pooler.supabase.com:5432, user postgres.<project-ref>).",
    ].join("\n"),
  );
  process.exit(1);
}
if (v4.length === 0) {
  console.error("FAIL: host does not resolve");
  process.exit(1);
}

await new Promise((resolve) => {
  const socket = connect({ host: v4[0], port, timeout: 8000 }, () => {
    console.log(`TCP OK to ${v4[0]}:${port}`);
    socket.destroy();
    resolve();
  });
  socket.on("timeout", () => {
    console.error(`FAIL: TCP timeout to ${v4[0]}:${port}`);
    socket.destroy();
    process.exit(1);
  });
  socket.on("error", (e) => {
    console.error(`FAIL: TCP ${e.message}`);
    process.exit(1);
  });
});

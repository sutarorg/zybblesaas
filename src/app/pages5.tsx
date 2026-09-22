import { useState } from "react";
import { motion } from "framer-motion";
import {
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  Eye,
  EyeOff,
  FileText,
  KeyRound,
  Moon,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  Trash2,
  Users,
} from "lucide-react";
import { PRICING } from "../lib/data";
import { useTheme, type Theme } from "../lib/theme";
import {
  INVOICES,
  NOTIF_DEFAULTS,
  PAYMENT_CARDS,
  PLAN_USAGE,
  TEAM,
  download,
  poolFull,
} from "./data";
import { Card, Meter, Modal, PageHeader, StatusChip } from "./shell";
import { cn } from "../utils/cn";

const inputCls =
  "h-11 w-full rounded-xl border border-line bg-ink/60 px-4 text-sm text-bone placeholder:text-faint outline-none transition-colors focus:border-zest/50";

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", on ? "bg-zest" : "bg-faint/35")}
      aria-pressed={on}
    >
      <span className={cn("absolute top-0.5 size-5 rounded-full transition-all", on ? "left-[22px] bg-ink" : "left-0.5 bg-bone")} />
    </button>
  );
}

/* ================================================================== */
/*  /billing                                                           */
/* ================================================================== */

export function BillingPage() {
  const [preview, setPreview] = useState<(typeof INVOICES)[number] | null>(null);
  const [changed, setChanged] = useState("");

  const flash = (label: string) => {
    setChanged(label);
    setTimeout(() => setChanged(""), 2200);
  };

  return (
    <div>
      <PageHeader title={<>Billing</>} desc="Plan, usage, payment method and invoices — all in one place." />

      {changed && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-4 flex items-center gap-2 rounded-xl border border-zest/40 bg-zest/10 px-4 py-3 font-mono text-[12px] text-zest">
          <CheckCircle2 className="size-4" /> {changed}
        </motion.div>
      )}

      {/* current plan */}
      <Card className="p-5 sm:p-7">
        <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="rounded-md bg-zest px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-ink">{PLAN_USAGE.plan}</span>
              <StatusChip status="active" />
            </div>
            <p className="mt-4 font-display text-4xl font-bold tracking-tight text-bone">
              $49<span className="font-mono text-sm font-normal text-faint">/mo</span>
            </p>
            <p className="mt-1.5 text-[13px] text-sage">
              10,000 enriched leads / month · renews Apr 1 · next invoice $49.00
            </p>
            <div className="mt-5 flex flex-wrap gap-2.5">
              <button
                onClick={() => flash("Switched to annual billing — $39/mo effective Apr 1")}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-zest/40 bg-zest/10 px-4 font-display text-[13px] font-medium text-zest transition-transform hover:scale-[1.03] active:scale-95"
              >
                Go annual — save $120/yr
              </button>
              <button onClick={() => flash("Downgrade scheduled for Apr 1 (keeps quota until then)")} className="inline-flex h-10 items-center rounded-xl border border-line px-4 font-display text-[13px] font-medium text-sage transition-colors hover:text-bone">
                Downgrade
              </button>
            </div>
          </div>
          <div className="space-y-5 rounded-2xl border border-line bg-white/[0.015] p-5">
            {[
              { label: "Enriched leads", used: PLAN_USAGE.used, max: PLAN_USAGE.quota, hint: `${(PLAN_USAGE.quota - PLAN_USAGE.used).toLocaleString()} left` },
              { label: "AI briefs", used: PLAN_USAGE.aiBriefs.used, max: PLAN_USAGE.aiBriefs.quota, hint: `${PLAN_USAGE.aiBriefs.quota - PLAN_USAGE.aiBriefs.used} left` },
              { label: "Seats", used: PLAN_USAGE.seats.used, max: PLAN_USAGE.seats.quota, hint: "1 open" },
            ].map((m) => (
              <div key={m.label}>
                <div className="mb-1.5 flex items-center justify-between text-[12px]">
                  <span className="text-sage">{m.label}</span>
                  <span className="font-mono text-[10.5px] text-faint">
                    {m.used.toLocaleString()}/{m.max.toLocaleString()} · <span className="text-zest">{m.hint}</span>
                  </span>
                </div>
                <Meter value={m.used} max={m.max} />
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* plan picker */}
      <h2 className="mb-3 mt-8 font-display text-lg font-semibold text-bone">Change plan</h2>
      <div className="grid gap-4 lg:grid-cols-3">
        {PRICING.map((p) => {
          const current = p.name === PLAN_USAGE.plan;
          return (
            <div key={p.name} className={cn("relative rounded-2xl border p-6", current ? "border-zest/50 bg-gradient-to-b from-zest/[0.08] to-coal" : "border-line bg-coal")}>
              {current && <span className="absolute -top-3 left-5 rounded-full bg-zest px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-wider text-ink">Current</span>}
              <div className="flex items-baseline justify-between">
                <h3 className="font-display text-lg font-semibold text-bone">{p.name}</h3>
                <span className="font-mono text-[10.5px] text-faint">{p.leads.split(" /")[0]}</span>
              </div>
              <p className="mt-3 font-display text-3xl font-bold text-bone">
                ${p.price}<span className="font-mono text-xs font-normal text-faint">/mo</span>
              </p>
              <p className="mt-2 min-h-[36px] text-[12.5px] leading-relaxed text-sage">{p.blurb}</p>
              <ul className="mt-4 space-y-2 border-t border-line pt-4">
                {p.features.slice(0, 5).map((f) => (
                  <li key={f.label} className={cn("flex items-center gap-2 text-[12px]", f.included ? "text-sage" : "text-faint line-through")}>
                    <Check className={cn("size-3.5 shrink-0", f.included ? "text-zest" : "text-faint")} />
                    {f.label}
                  </li>
                ))}
              </ul>
              <button
                disabled={current}
                onClick={() => flash(p.price === 0 ? "Downgrade to Starter scheduled for cycle end" : `Upgrade to ${p.name} — prorated today`)}
                className={cn(
                  "mt-5 h-10 w-full rounded-xl font-display text-[13px] font-semibold transition-all",
                  current ? "cursor-default bg-white/[0.04] text-faint" : p.accent ? "bg-zest text-ink hover:scale-[1.02] active:scale-95" : "border border-line-strong text-bone hover:border-zest/40"
                )}
              >
                {current ? "Current plan" : p.price > 49 ? "Upgrade to Scale" : p.price === 0 ? "Downgrade" : "Switch to Growth"}
              </button>
            </div>
          );
        })}
      </div>

      {/* payment + invoices */}
      <div className="mt-8 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <Card className="p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-semibold text-bone">Payment method</h3>
            <a href="#/setting?tab=payments" className="font-mono text-[11px] text-zest hover:underline">manage →</a>
          </div>
          {PAYMENT_CARDS.filter((c) => c.isDefault).map((c) => (
            <div key={c.id} className="mt-4 flex items-center gap-4 rounded-2xl border border-line bg-gradient-to-br from-white/[0.04] to-transparent p-5">
              <CreditCard className="size-8 text-zest" />
              <div>
                <p className="font-mono text-[14px] text-bone">{c.brand} ···· {c.last4}</p>
                <p className="mt-0.5 font-mono text-[10.5px] text-faint">expires {c.exp} · {c.holder}</p>
              </div>
              <span className="ml-auto rounded-md bg-zest/10 px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-zest">default</span>
            </div>
          ))}
          <p className="mt-4 font-mono text-[10.5px] leading-relaxed text-faint">
            billed monthly via Stripe · SCA/3-D Secure enforced · VAT invoices issued automatically
          </p>
        </Card>

        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h3 className="font-display text-base font-semibold text-bone">Invoices</h3>
            <span className="font-mono text-[10.5px] text-faint">{INVOICES.length} total</span>
          </div>
          <div className="divide-y divide-line/60">
            {INVOICES.map((inv) => (
              <button key={inv.id} onClick={() => setPreview(inv)} className="flex w-full items-center gap-3.5 px-5 py-3.5 text-left transition-colors hover:bg-white/[0.02]">
                <FileText className="size-4 shrink-0 text-faint" />
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[12.5px] font-medium text-bone">{inv.id}</p>
                  <p className="font-mono text-[10px] text-faint">{inv.date} · {inv.plan}</p>
                </div>
                <span className="font-mono text-[12.5px] text-bone">{inv.amount}</span>
                <StatusChip status="paid" />
              </button>
            ))}
          </div>
        </Card>
      </div>

      {/* invoice preview modal */}
      <Modal open={!!preview} onClose={() => setPreview(null)} title={preview?.id ?? "Invoice"}>
        {preview && (
          <div>
            <div className="rounded-xl border border-line bg-white/[0.02] p-5 font-mono text-[12px] leading-[2] text-sage">
              <div className="flex justify-between text-bone"><span>Zybble Inc.</span><span>{preview.id}</span></div>
              <div className="flex justify-between"><span>Issued</span><span>{preview.date}</span></div>
              <div className="flex justify-between"><span>Billed to</span><span>mara@zybble.io</span></div>
              <div className="my-3 border-t border-dashed border-line" />
              <div className="flex justify-between"><span>{preview.plan}</span><span className="text-bone">{preview.amount}</span></div>
              <div className="flex justify-between"><span>VAT handled (reverse charge)</span><span>—</span></div>
              <div className="my-3 border-t border-dashed border-line" />
              <div className="flex justify-between text-[13px] font-semibold text-zest"><span>Total paid</span><span>{preview.amount}</span></div>
            </div>
            <button onClick={() => download(`${preview.id}.txt`, `ZYBBLE INVOICE ${preview.id}\n${preview.plan}\nTotal: ${preview.amount}\nStatus: PAID`, "text/plain")} className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-zest font-display text-sm font-semibold text-ink transition-transform hover:scale-[1.02] active:scale-95">
              Download receipt
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ================================================================== */
/*  /setting — tabbed workspace                                        */
/* ================================================================== */

const TABS = [
  ["appearance", "Appearance"],
  ["profile", "Profile"],
  ["notifications", "Notifications"],
  ["payments", "Payment methods"],
  ["team", "Team"],
  ["api", "API access"],
  ["preferences", "Preferences"],
  ["privacy", "Data & privacy"],
] as const;

type TabId = (typeof TABS)[number][0];

function SaveBtn({ onSave }: { onSave: () => void }) {
  const [saved, setSaved] = useState(false);
  return (
    <button
      onClick={() => {
        onSave();
        setSaved(true);
        setTimeout(() => setSaved(false), 1800);
      }}
      className={cn(
        "inline-flex h-10 items-center gap-2 rounded-xl px-5 font-display text-[13px] font-semibold transition-all",
        saved ? "bg-zest/15 text-zest" : "bg-zest text-ink hover:scale-[1.02] active:scale-95"
      )}
    >
      {saved ? <><Check className="size-4" /> Saved</> : "Save changes"}
    </button>
  );
}

function randomKey() {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: 3 }, () => Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("")).join("_");
}

export function SettingsPage({ initialTab }: { initialTab?: string }) {
  const { theme, setTheme } = useTheme();
  const [tab, setTab] = useState<TabId>((initialTab as TabId) || "appearance");
  const [notifs, setNotifs] = useState(NOTIF_DEFAULTS);
  const [cards, setCards] = useState(PAYMENT_CARDS);
  const [team, setTeam] = useState(TEAM);
  const [invite, setInvite] = useState("");
  const [apiKey, setApiKey] = useState("zyb_live_8f3k2md9qj4x7w1h");
  const [reveal, setReveal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [addCard, setAddCard] = useState(false);
  const [delModal, setDelModal] = useState(false);
  const [delText, setDelText] = useState("");
  const [cardNum, setCardNum] = useState("");
  const [deleteConfirmText] = useState("DELETE");

  const masked = apiKey.slice(0, 12) + "••••••••••";
  void deleteConfirmText;

  const exportAll = () => {
    const data = {
      workspace: "demo-nova",
      exported_at: new Date().toISOString(),
      lists: ["berlin-dentists-q3", "austin-hvac-gap"],
      sample_records: poolFull("dentists in Berlin").slice(0, 5).map((l) => ({ name: l.name, email: l.email, phone: l.phone, rating: l.rating })),
    };
    download("zybble-workspace-export.json", JSON.stringify(data, null, 2), "application/json");
  };

  return (
    <div>
      <PageHeader title={<>Settings</>} desc="Profile, notifications, payments, team, API — every knob in one drawer." />

      {/* tabs */}
      <div className="mb-6 flex gap-1.5 overflow-x-auto no-bar rounded-2xl border border-line bg-coal p-1.5">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "shrink-0 rounded-xl px-4 py-2.5 font-display text-[12.5px] font-medium transition-all",
              tab === id ? "bg-zest text-ink" : "text-sage hover:bg-white/[0.04] hover:text-bone"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ------------------------------ APPEARANCE ------------------------------ */}
      {tab === "appearance" && (
        <div>
          <div className="grid gap-4 sm:grid-cols-2">
            {(
              [
                {
                  id: "light" as Theme,
                  icon: Sun,
                  label: "Light",
                  desc: "Paper-bright canvas, deep-lime accents. Easy on sunny screens and print-outs.",
                  preview: (
                    <div className="rounded-xl border border-[rgba(16,22,15,0.15)] bg-[#f2f4ee] p-3">
                      <div className="rounded-lg border border-[rgba(16,22,15,0.1)] bg-white p-2.5">
                        <div className="h-1.5 w-2/3 rounded-full bg-[#10160f]/80" />
                        <div className="mt-1.5 h-1.5 w-1/2 rounded-full bg-[#10160f]/25" />
                        <div className="mt-2.5 flex gap-1.5">
                          <span className="h-4 w-8 rounded-md bg-[#4e7a0b]" />
                          <span className="h-4 w-8 rounded-md border border-[rgba(16,22,15,0.15)] bg-white" />
                        </div>
                      </div>
                      <div className="mt-2 flex gap-1.5">
                        <span className="h-6 flex-1 rounded-md border border-[rgba(16,22,15,0.1)] bg-white" />
                        <span className="h-6 flex-1 rounded-md border border-[rgba(16,22,15,0.1)] bg-white" />
                      </div>
                    </div>
                  ),
                },
                {
                  id: "dark" as Theme,
                  icon: Moon,
                  label: "Dark",
                  desc: "The original command-center look — ink canvas with neon-zest signal colors.",
                  preview: (
                    <div className="rounded-xl border border-white/20 bg-[#0e110f] p-3">
                      <div className="rounded-lg border border-white/10 bg-[#151916] p-2.5">
                        <div className="h-1.5 w-2/3 rounded-full bg-[#edefe8]/80" />
                        <div className="mt-1.5 h-1.5 w-1/2 rounded-full bg-[#edefe8]/25" />
                        <div className="mt-2.5 flex gap-1.5">
                          <span className="h-4 w-8 rounded-md bg-[#c9f158]" />
                          <span className="h-4 w-8 rounded-md border border-white/10 bg-[#151916]" />
                        </div>
                      </div>
                      <div className="mt-2 flex gap-1.5">
                        <span className="h-6 flex-1 rounded-md border border-white/10 bg-[#151916]" />
                        <span className="h-6 flex-1 rounded-md border border-white/10 bg-[#151916]" />
                      </div>
                    </div>
                  ),
                },
              ] as const
            ).map((opt) => {
              const active = theme === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => setTheme(opt.id)}
                  className={cn(
                    "group relative rounded-2xl border p-5 text-left transition-all duration-300",
                    active ? "border-zest/60 bg-coal shadow-[0_20px_60px_-30px_rgba(0,0,0,0.4)]" : "border-line bg-coal hover:border-line-strong"
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="theme-check"
                      className="absolute right-4 top-4 grid size-6 place-items-center rounded-full bg-zest"
                    >
                      <Check className="size-3.5 text-ink" strokeWidth={3} />
                    </motion.span>
                  )}
                  <div className="flex items-center gap-2.5">
                    <span className={cn("grid size-9 place-items-center rounded-lg border", active ? "border-zest/40 bg-zest/10 text-zest" : "border-line text-sage")}>
                      <opt.icon className="size-4.5" />
                    </span>
                    <div>
                      <p className="font-display text-[15px] font-semibold text-bone">{opt.label}</p>
                      <p className="font-mono text-[9.5px] uppercase tracking-wider text-faint">{theme === opt.id ? "active" : "switch"}</p>
                    </div>
                  </div>
                  <div className="mt-4">{opt.preview}</div>
                  <p className="mt-4 text-[12.5px] leading-relaxed text-sage">{opt.desc}</p>
                </button>
              );
            })}
          </div>

          <Card className="mt-4 flex items-start gap-4 p-5 sm:items-center sm:p-6">
            <ShieldCheck className="size-6 shrink-0 text-zest" />
            <p className="text-[12.5px] leading-relaxed text-sage">
              <span className="font-semibold text-bone">Instant & everywhere:</span> the theme applies to the
              whole product and the public site, and it's remembered on this device. Console widgets —
              radars, terminals, the live demo — keep the dark engine aesthetic either way.
            </p>
          </Card>
        </div>
      )}

      {/* ------------------------------ PROFILE ------------------------------ */}
      {tab === "profile" && (
        <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
          <Card className="p-5 sm:p-7">
            <div className="flex items-center gap-4">
              <span className="grid size-14 place-items-center rounded-2xl border border-zest/25 bg-gradient-to-br from-zest/15 to-graphite font-display text-lg font-bold text-zest">MV</span>
              <div>
                <p className="font-display text-base font-semibold text-bone">Mara Voss</p>
                <p className="font-mono text-[11px] text-faint">Owner · joined Dec 2025</p>
              </div>
              <button className="ml-auto rounded-lg border border-line px-3.5 py-2 font-mono text-[11px] text-sage transition-colors hover:border-zest/40 hover:text-bone">Change photo</button>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div><label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-faint">Full name</label><input defaultValue="Mara Voss" className={inputCls} /></div>
              <div><label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-faint">Work email</label><input defaultValue="mara@zybble.io" className={inputCls} /></div>
              <div><label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-faint">Company</label><input defaultValue="Studio Nova" className={inputCls} /></div>
              <div><label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-faint">Timezone</label>
                <select className={cn(inputCls, "appearance-none")} defaultValue="Europe/Berlin">
                  {["Europe/Berlin", "Europe/London", "America/New_York", "America/Chicago", "America/Los_Angeles"].map((t) => <option key={t} className="bg-coal">{t}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-6"><SaveBtn onSave={() => {}} /></div>
          </Card>

          <div className="space-y-4">
            <Card className="p-5 sm:p-6">
              <h3 className="flex items-center gap-2.5 font-display text-base font-semibold text-bone"><KeyRound className="size-4.5 text-zest" /> Password</h3>
              <div className="mt-4 space-y-3">
                <input type="password" placeholder="Current password" className={inputCls} />
                <input type="password" placeholder="New password (12+ chars)" className={inputCls} />
              </div>
              <div className="mt-4"><SaveBtn onSave={() => {}} /></div>
            </Card>
            <Card className="flex items-center gap-4 p-5 sm:p-6">
              <ShieldCheck className="size-6 shrink-0 text-zest" />
              <div className="flex-1">
                <p className="text-[13.5px] font-medium text-bone">Two-factor authentication</p>
                <p className="mt-0.5 font-mono text-[10.5px] text-faint">authenticator app · enabled Jan 2026</p>
              </div>
              <span className="rounded-md bg-zest/10 px-2.5 py-1.5 font-mono text-[10px] font-semibold text-zest">ON</span>
            </Card>
          </div>
        </div>
      )}

      {/* ------------------------------ NOTIFICATIONS ------------------------------ */}
      {tab === "notifications" && (
        <Card className="overflow-hidden">
          <div className="border-b border-line px-5 py-4 sm:px-6">
            <h3 className="font-display text-base font-semibold text-bone">Email notifications</h3>
            <p className="mt-0.5 text-[12.5px] text-sage">Sent to mara@zybble.io — instant, never batched (except the digest).</p>
          </div>
          <div className="divide-y divide-line/60">
            {notifs.map((n, i) => (
              <div key={n.id} className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6">
                <div>
                  <p className="text-[13.5px] font-medium text-bone">{n.title}</p>
                  <p className="mt-0.5 text-[12px] text-sage">{n.desc}</p>
                </div>
                <Toggle on={n.on} onChange={(v) => setNotifs((all) => all.map((x, xi) => (xi === i ? { ...x, on: v } : x)))} />
              </div>
            ))}
          </div>
          <div className="border-t border-line px-5 py-4 sm:px-6">
            <SaveBtn onSave={() => {}} />
          </div>
        </Card>
      )}

      {/* ------------------------------ PAYMENTS ------------------------------ */}
      {tab === "payments" && (
        <div>
          <div className="grid gap-4 sm:grid-cols-2">
            {cards.map((c) => (
              <Card key={c.id} className={cn("relative overflow-hidden p-5", c.isDefault && "border-zest/40")}>
                {c.isDefault && <span className="absolute right-4 top-4 rounded-md bg-zest px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-ink">default</span>}
                <CreditCard className="size-8 text-zest" />
                <p className="mt-4 font-mono text-[15px] text-bone">{c.brand} ···· {c.last4}</p>
                <p className="mt-1 font-mono text-[11px] text-faint">expires {c.exp} · {c.holder}</p>
                <div className="mt-5 flex gap-2">
                  {!c.isDefault && (
                    <button onClick={() => setCards((all) => all.map((x) => ({ ...x, isDefault: x.id === c.id })))} className="h-9 rounded-lg border border-line px-3.5 font-mono text-[11px] text-sage transition-colors hover:border-zest/40 hover:text-bone">
                      Set default
                    </button>
                  )}
                  <button
                    disabled={c.isDefault}
                    onClick={() => setCards((all) => all.filter((x) => x.id !== c.id))}
                    className={cn("inline-flex h-9 items-center gap-1.5 rounded-lg border px-3.5 font-mono text-[11px] transition-colors", c.isDefault ? "cursor-not-allowed border-line text-faint" : "border-line text-sage hover:border-red-400/40 hover:text-red-300")}
                  >
                    <Trash2 className="size-3.5" /> Remove
                  </button>
                </div>
              </Card>
            ))}
            <button onClick={() => setAddCard(true)} className="grid min-h-[190px] place-items-center rounded-2xl border border-dashed border-line-strong text-sage transition-colors hover:border-zest/40 hover:text-bone">
              <span className="flex flex-col items-center gap-2.5">
                <Plus className="size-6" />
                <span className="font-mono text-[11.5px]">add payment method</span>
              </span>
            </button>
          </div>
          <Card className="mt-4 flex items-start gap-4 p-5">
            <ShieldCheck className="size-6 shrink-0 text-zest" />
            <p className="text-[12.5px] leading-relaxed text-sage">
              Card data never touches Zybble servers — tokenized directly by Stripe. SCA and 3-D Secure are enforced on every charge.
            </p>
          </Card>

          <Modal open={addCard} onClose={() => setAddCard(false)} title="Add payment method">
            <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-faint">Card number</label>
            <input
              value={cardNum}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, "").slice(0, 16);
                setCardNum(digits.replace(/(.{4})/g, "$1 ").trim());
              }}
              placeholder="4242 4242 4242 4242"
              inputMode="numeric"
              className={cn(inputCls, "font-mono")}
            />
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div><label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-faint">Expiry</label><input placeholder="MM / YY" className={cn(inputCls, "font-mono")} /></div>
              <div><label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-faint">CVC</label><input placeholder="123" inputMode="numeric" className={cn(inputCls, "font-mono")} /></div>
            </div>
            <button
              disabled={cardNum.replace(/\s/g, "").length < 15}
              onClick={() => {
                const last4 = cardNum.replace(/\s/g, "").slice(-4);
                setCards((all) => [...all, { id: `card-${Date.now()}`, brand: cardNum.startsWith("5") ? "Mastercard" : "Visa", last4, exp: "09 / 29", holder: "Mara Voss", isDefault: all.length === 0 }]);
                setAddCard(false);
                setCardNum("");
              }}
              className="mt-6 h-11 w-full rounded-xl bg-zest font-display text-sm font-semibold text-ink transition-transform hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Add card
            </button>
          </Modal>
        </div>
      )}

      {/* ------------------------------ TEAM ------------------------------ */}
      {tab === "team" && (
        <div>
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h3 className="flex items-center gap-2.5 font-display text-base font-semibold text-bone"><Users className="size-4.5 text-zest" /> Members</h3>
              <span className="font-mono text-[10.5px] text-faint">{team.filter((t) => t.status === "active").length} / {PLAN_USAGE.seats.quota} seats used</span>
            </div>
            <div className="divide-y divide-line/60">
              {team.map((m) => (
                <div key={m.email} className="flex flex-wrap items-center gap-3 px-5 py-4">
                  <span className="grid size-9 place-items-center rounded-lg border border-line bg-white/[0.03] font-display text-[11px] font-bold text-zest">
                    {m.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-medium text-bone">{m.name}</p>
                    <p className="truncate font-mono text-[10.5px] text-faint">{m.email}</p>
                  </div>
                  <StatusChip status={m.status} />
                  <select defaultValue={m.role} className="h-9 appearance-none rounded-lg border border-line bg-coal px-3 font-mono text-[11px] text-sage outline-none">
                    <option className="bg-coal">Owner</option>
                    <option className="bg-coal">Admin</option>
                    <option className="bg-coal">Member</option>
                    <option className="bg-coal">Viewer</option>
                  </select>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-2.5 border-t border-line p-4 sm:flex-row sm:p-5">
              <input value={invite} onChange={(e) => setInvite(e.target.value)} placeholder="colleague@company.com" className={cn(inputCls, "sm:flex-1")} />
              <button
                onClick={() => {
                  if (!invite.includes("@")) return;
                  setTeam((t) => [...t, { name: invite, email: invite, role: "Member", status: "invited" }]);
                  setInvite("");
                }}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-zest px-5 font-display text-sm font-semibold text-ink transition-transform hover:scale-[1.02] active:scale-95"
              >
                <Send className="size-4" /> Send invite
              </button>
            </div>
          </Card>
          <p className="mt-4 font-mono text-[11px] leading-relaxed text-faint">
            Growth includes {PLAN_USAGE.seats.quota} seats · Scale includes 10. Invited members count only once accepted.
          </p>
        </div>
      )}

      {/* ------------------------------ API ------------------------------ */}
      {tab === "api" && (
        <div className="space-y-4">
          <Card className="p-5 sm:p-6">
            <div className="flex items-center gap-2.5">
              <KeyRound className="size-5 text-zest" />
              <h3 className="font-display text-base font-semibold text-bone">REST API key</h3>
            </div>
            <p className="mt-2 text-[12.5px] leading-relaxed text-sage">
              Programmatic access to searches, lists and exports. Rate limit: 60 req/min on Growth.
            </p>
            <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
              <code className="flex h-11 flex-1 items-center overflow-x-auto rounded-xl border border-line bg-ink/70 px-4 font-mono text-[12px] text-zest no-bar">
                {reveal ? apiKey : masked}
              </code>
              <div className="flex gap-2.5">
                <button onClick={() => setReveal(!reveal)} className="grid size-11 place-items-center rounded-xl border border-line text-sage transition-colors hover:text-bone" aria-label="Reveal">
                  {reveal ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(apiKey).catch(() => {});
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1400);
                  }}
                  className={cn("grid size-11 place-items-center rounded-xl border transition-colors", copied ? "border-zest/50 bg-zest/10 text-zest" : "border-line text-sage hover:text-bone")}
                  aria-label="Copy"
                >
                  {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                </button>
                <button onClick={() => setApiKey(`zyb_live_${randomKey().replace(/_/g, "")}`.slice(0, 26))} className="inline-flex h-11 items-center gap-2 rounded-xl border border-line px-4 font-mono text-[11.5px] text-sage transition-colors hover:border-amber/40 hover:text-amber">
                  <RefreshCw className="size-4" /> Rotate
                </button>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-line bg-line">
              {[["1,208", "calls this month"], ["99.98%", "success rate"], ["38ms", "p50 latency"]].map(([v, l]) => (
                <div key={l} className="bg-coal px-3 py-3 text-center">
                  <p className="font-display text-base font-bold text-bone">{v}</p>
                  <p className="font-mono text-[8.5px] uppercase tracking-wider text-faint">{l}</p>
                </div>
              ))}
            </div>
          </Card>
          <Card className="overflow-hidden">
            <div className="border-b border-line px-5 py-3.5 font-mono text-[10.5px] text-faint">quickstart</div>
            <pre className="overflow-x-auto bg-[#0a0d0b] p-5 font-mono text-[11.5px] leading-[1.9] text-sage">
{`curl -X POST https://api.zybble.io/v1/searches \\
  -H "Authorization: Bearer $ZYBBLE_KEY" \\
  -d '{
    "query": "dentists in Berlin",
    "email": true,
    "depth": 10
  }'

# → { "job_id": "srch_8xq2", "status": "queued",
#     "poll": "/v1/searches/srch_8xq2" }`}
            </pre>
          </Card>
        </div>
      )}

      {/* ------------------------------ PREFERENCES ------------------------------ */}
      {tab === "preferences" && (
        <Card className="p-5 sm:p-7">
          <h3 className="flex items-center gap-2.5 font-display text-base font-semibold text-bone">
            <SlidersHorizontal className="size-4.5 text-zest" /> Engine defaults
          </h3>
          <p className="mt-1 text-[12.5px] text-sage">Applied to every new search you create — overridable per run.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-faint">Default language</label>
              <select className={cn(inputCls, "appearance-none")} defaultValue="en">
                {["en", "de", "fr", "pt", "es", "nl"].map((l) => <option key={l} className="bg-coal">{l}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-faint">Default depth</label>
              <select className={cn(inputCls, "appearance-none")} defaultValue="10 levels">
                {["4 levels", "8 levels", "10 levels", "12 levels", "16 levels"].map((d) => <option key={d} className="bg-coal">{d}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-faint">Dedupe strictness</label>
              <select className={cn(inputCls, "appearance-none")} defaultValue="Balanced">
                {["Strict (exact domain/phone only)", "Balanced", "Loose (fuzzy name + geo)"].map((d) => <option key={d} className="bg-coal">{d}</option>)}
              </select>
            </div>
            <div className="flex items-center justify-between gap-4 rounded-xl border border-line bg-ink/40 px-4 py-3">
              <div>
                <p className="text-[13px] font-medium text-bone">Email extraction default</p>
                <p className="mt-0.5 text-[11px] text-sage">Crawl official sites on new searches</p>
              </div>
              <Toggle on={true} onChange={() => {}} />
            </div>
          </div>
          <div className="mt-6"><SaveBtn onSave={() => {}} /></div>
        </Card>
      )}

      {/* ------------------------------ PRIVACY ------------------------------ */}
      {tab === "privacy" && (
        <div className="space-y-4">
          <Card className="flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
            <div className="flex-1">
              <h3 className="font-display text-[15px] font-semibold text-bone">Export all workspace data</h3>
              <p className="mt-1 text-[12.5px] leading-relaxed text-sage">GDPR-style full dump: lists, leads, searches, settings — one JSON file, generated instantly.</p>
            </div>
            <button onClick={exportAll} className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-zest/40 bg-zest/10 px-4 font-display text-[13px] font-medium text-zest transition-transform hover:scale-[1.03] active:scale-95">
              Export workspace
            </button>
          </Card>
          <Card className="border-red-400/25 p-5 sm:p-6">
            <h3 className="font-display text-[15px] font-semibold text-red-300">Danger zone</h3>
            <p className="mt-1 max-w-lg text-[12.5px] leading-relaxed text-sage">
              Deleting the workspace removes every list, lead, export and key within 30 days. There is no undo, and we're too honest to pretend there is.
            </p>
            <button onClick={() => setDelModal(true)} className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl border border-red-400/40 bg-red-400/10 px-4 font-display text-[13px] font-medium text-red-300 transition-transform hover:scale-[1.02] active:scale-95">
              <Trash2 className="size-4" /> Delete workspace
            </button>
          </Card>
          <Modal open={delModal} onClose={() => setDelModal(false)} title="Delete workspace — final step">
            <p className="text-[13.5px] leading-relaxed text-sage">
              Type <span className="rounded bg-red-400/10 px-1.5 py-0.5 font-mono text-[12px] text-red-300">DELETE</span> to confirm. Queued and running searches stop immediately.
            </p>
            <input value={delText} onChange={(e) => setDelText(e.target.value)} placeholder="DELETE" className={cn(inputCls, "mt-4 font-mono")} />
            <button
              disabled={delText !== "DELETE"}
              onClick={() => (window.location.hash = "#/")}
              className="mt-4 h-11 w-full rounded-xl bg-red-400 font-display text-sm font-semibold text-ink transition-transform hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:opacity-30"
            >
              Permanently delete
            </button>
          </Modal>
        </div>
      )}
    </div>
  );
}

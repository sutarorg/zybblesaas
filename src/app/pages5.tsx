import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  FileText,
  KeyRound,
  Loader2,
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
import { api, ApiError, type ApiKeyPayload, type Entitlements, type PlanPayload, type Quota } from "../lib/api";
import { useBilling, useApiKeys, usePlans, useSettings, useTeam } from "./hooks";
import { useSession } from "./session";
import { CheckoutDismissed, openSubscriptionCheckout } from "../lib/razorpay";
import { useTheme, type Theme } from "../lib/theme";
import { formatMoney, relTime, shortDate } from "./data";
import { Card, Meter, Modal, PageHeader, StatusChip } from "./shell";
import { cn } from "../utils/cn";

const inputCls =
  "h-11 w-full rounded-xl border border-line bg-ink/60 px-4 text-sm text-bone placeholder:text-faint outline-none transition-colors focus:border-zest/50";

/* ------------------------------------------------------------------ */
/*  shared bits                                                        */
/* ------------------------------------------------------------------ */

function Flash({ tone, children }: { tone: "good" | "warn"; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "mb-4 flex items-center gap-2 rounded-xl border px-4 py-3 font-mono text-[12px]",
        tone === "good" ? "border-zest/40 bg-zest/10 text-zest" : "border-amber/40 bg-amber/10 text-amber",
      )}
    >
      {tone === "good" ? <CheckCircle2 className="size-4 shrink-0" /> : <AlertTriangle className="size-4 shrink-0" />}
      <span>{children}</span>
    </motion.div>
  );
}

function Toggle({ on, onChange, disabled }: { on: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      disabled={disabled}
      className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-40", on ? "bg-zest" : "bg-faint/35")}
      aria-pressed={on}
    >
      <span className={cn("absolute top-0.5 size-5 rounded-full transition-all", on ? "left-[22px] bg-ink" : "left-0.5 bg-bone")} />
    </button>
  );
}

function planPrice(plan: PlanPayload | null | undefined): string {
  if (!plan) return "—";
  // The API quotes minor units (cents) — formatMoney expects the same.
  if (typeof plan.price_minor === "number") return formatMoney(plan.price_minor, plan.currency || "USD");
  return "—";
}

function limitOf(plan: PlanPayload | null | undefined, key: string): number | null {
  const limits = (plan?.limits ?? {}) as Record<string, unknown>;
  const value = limits[key];
  return typeof value === "number" ? value : null;
}

/* ------------------------------------------------------------------ */
/*  /billing                                                           */
/* ------------------------------------------------------------------ */

export function BillingPage() {
  const { me, refresh } = useSession();
  const billing = useBilling();
  const plans = usePlans();
  const [busy, setBusy] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ tone: "good" | "warn"; text: string } | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [showPause, setShowPause] = useState(false);

  const entitlements: Entitlements | null = billing.data?.entitlements ?? me?.entitlements ?? null;
  const subscription = entitlements?.subscription ?? null;
  const plan = billing.data?.plan ?? me?.plan ?? null;
  const quota: Quota | null = me?.quota ?? null;
  const provider = billing.data?.provider ?? null;
  const invoices = billing.data?.invoices ?? [];
  const payments = billing.data?.payments ?? [];
  const methods = billing.data?.methods ?? [];
  const availablePlans = plans.data?.plans ?? [];

  const isConfigured = provider?.configured ?? Boolean(plans.data?.capabilities.checkout);

  const notify = (tone: "good" | "warn", text: string) => {
    setFlash({ tone, text });
    window.setTimeout(() => setFlash(null), 6000);
  };

  const reloadAll = async () => {
    await Promise.all([billing.reload(), plans.reload(), refresh()]);
  };

  /** Creates the subscription server-side, then opens Razorpay Checkout. */
  const upgrade = async (code: "growth" | "scale") => {
    setBusy(code);
    setFlash(null);
    try {
      const checkout = await api.billing.checkout(code, 1);
      const result = await openSubscriptionCheckout({
        key: checkout.keyId,
        subscription_id: checkout.subscriptionId,
        name: checkout.name,
        description: checkout.description,
        currency: checkout.currency,
        prefill: checkout.prefill,
        notes: checkout.notes,
        theme: { color: "#c9f158" },
      });
      const verified = await api.billing.verify(result);
      notify("good", `Payment verified — your plan is now ${verified.plan}.`);
      await reloadAll();
    } catch (cause) {
      if (cause instanceof CheckoutDismissed) notify("warn", "Checkout closed before it completed — nothing was charged.");
      else notify("warn", cause instanceof ApiError ? cause.message : cause instanceof Error ? cause.message : "Checkout could not be completed");
    } finally {
      setBusy(null);
    }
  };

  const action = async (kind: "cancel" | "resume" | "pause" | "refresh", atCycleEnd?: boolean) => {
    setBusy(kind);
    setFlash(null);
    try {
      await api.billing.action({ action: kind, atCycleEnd });
      const messages: Record<typeof kind, string> = {
        cancel: "Cancellation recorded — Razorpay will stop charging at the end of the cycle.",
        resume: "Subscription resumed.",
        pause: "Subscription paused. You keep access until Razorpay confirms the pause.",
        refresh: "Subscription refreshed from Razorpay.",
      };
      notify("good", messages[kind]);
      setConfirmCancel(false);
      setShowPause(false);
      await reloadAll();
    } catch (cause) {
      notify("warn", cause instanceof ApiError ? cause.message : `The ${kind} request failed`);
    } finally {
      setBusy(null);
    }
  };

  const currentCode = plan?.code ?? "starter";
  const subscriptionStatus = subscription?.status ?? (currentCode === "starter" ? "free" : "unknown");

  return (
    <div>
      <PageHeader title={<>Billing</>} desc="Plan, usage, payment method and invoices — all read from Razorpay and your workspace." />

      {flash && <Flash tone={flash.tone}>{flash.text}</Flash>}

      {billing.error && <Flash tone="warn">{billing.error}</Flash>}

      {!billing.loading && !isConfigured && (
        <Flash tone="warn">
          Billing is not connected on this deployment yet (no Razorpay credentials). Your workspace keeps working on the free plan — nothing is charged and no card is
          collected.
        </Flash>
      )}

      {/* current plan */}
      <Card className="p-5 sm:p-7">
        <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="rounded-md bg-zest px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-ink">{plan?.name ?? "Free"}</span>
              <StatusChip status={subscriptionStatus} />
              {subscription?.cancel_at_period_end && <span className="font-mono text-[10.5px] text-amber">cancels at cycle end</span>}
            </div>
            <p className="mt-4 font-display text-4xl font-bold tracking-tight text-bone">
              {planPrice(plan)}
              <span className="font-mono text-sm font-normal text-faint">{plan?.price_minor ? "/mo" : ""}</span>
            </p>
            <p className="mt-1.5 text-[13px] text-sage">
              {limitOf(plan, "leads_per_period")?.toLocaleString() ?? "—"} billable leads per cycle
              {subscription?.current_period_end ? ` · renews ${shortDate(String(subscription.current_period_end))}` : ""}
            </p>
            <div className="mt-5 flex flex-wrap gap-2.5">
              {currentCode === "starter" && (
                <button
                  onClick={() => void upgrade("growth")}
                  disabled={busy !== null || !isConfigured}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-zest/40 bg-zest/10 px-4 font-display text-[13px] font-medium text-zest transition-transform hover:scale-[1.03] active:scale-95 disabled:opacity-40"
                >
                  {busy === "growth" ? <Loader2 className="size-4 animate-spin" /> : null} Upgrade to Growth
                </button>
              )}
              {subscription && (
                <>
                  <button
                    onClick={() => void action("refresh")}
                    disabled={busy !== null}
                    className="inline-flex h-10 items-center gap-2 rounded-xl border border-line px-4 font-display text-[13px] font-medium text-sage transition-colors hover:text-bone disabled:opacity-40"
                  >
                    <RefreshCw className={cn("size-4", busy === "refresh" && "animate-spin")} /> Sync with Razorpay
                  </button>
                  {subscriptionStatus === "paused" || subscriptionStatus === "halted" ? (
                    <button
                      onClick={() => void action("resume")}
                      disabled={busy !== null}
                      className="inline-flex h-10 items-center rounded-xl border border-line px-4 font-display text-[13px] font-medium text-sage hover:text-bone disabled:opacity-40"
                    >
                      Resume
                    </button>
                  ) : (
                    <button
                      onClick={() => setShowPause(true)}
                      disabled={busy !== null}
                      className="inline-flex h-10 items-center rounded-xl border border-line px-4 font-display text-[13px] font-medium text-sage hover:text-bone disabled:opacity-40"
                    >
                      Pause
                    </button>
                  )}
                  {!subscription.cancel_at_period_end && (
                    <button
                      onClick={() => setConfirmCancel(true)}
                      disabled={busy !== null}
                      className="inline-flex h-10 items-center rounded-xl border border-line px-4 font-display text-[13px] font-medium text-sage hover:border-red-400/40 hover:text-red-300 disabled:opacity-40"
                    >
                      Cancel
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
          <div className="space-y-5 rounded-2xl border border-line bg-white/[0.015] p-5">
            {quota ? (
              [
                { label: "Billable leads", used: quota.leads.used, max: quota.leads.included, hint: `${quota.leads.remaining.toLocaleString()} left` },
                { label: "AI runs", used: quota.ai_runs.used, max: quota.ai_runs.included, hint: `${quota.ai_runs.remaining} left` },
                { label: "Seats", used: quota.seats.used, max: quota.seats.included, hint: `${Math.max(0, quota.seats.included - quota.seats.used)} open` },
              ].map((metric) => (
                <div key={metric.label}>
                  <div className="mb-1.5 flex items-center justify-between text-[12px]">
                    <span className="text-sage">{metric.label}</span>
                    <span className="font-mono text-[10.5px] text-faint">
                      {metric.used.toLocaleString()}/{metric.max.toLocaleString()} · <span className="text-zest">{metric.hint}</span>
                    </span>
                  </div>
                  <Meter value={metric.used} max={Math.max(1, metric.max)} />
                </div>
              ))
            ) : (
              <p className="font-mono text-[11.5px] text-faint">usage loads with your workspace…</p>
            )}
          </div>
        </div>
      </Card>

      {/* plan picker */}
      <h2 className="mb-3 mt-8 font-display text-lg font-semibold text-bone">Change plan</h2>
      <div className="grid gap-4 lg:grid-cols-3">
        {(plans.loading ? [] : availablePlans).map((candidate) => {
          const isCurrent = candidate.code === currentCode;
          const upgradeable = candidate.code === "growth" || candidate.code === "scale";
          const leads = limitOf(candidate, "leads_per_period");
          return (
            <div
              key={candidate.code}
              className={cn("relative rounded-2xl border p-6", isCurrent ? "border-zest/50 bg-gradient-to-b from-zest/[0.08] to-coal" : "border-line bg-coal")}
            >
              {isCurrent && <span className="absolute -top-3 left-5 rounded-full bg-zest px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-wider text-ink">Current</span>}
              <div className="flex items-baseline justify-between">
                <h3 className="font-display text-lg font-semibold text-bone">{candidate.name}</h3>
                <span className="font-mono text-[10.5px] text-faint">{leads ? `${leads.toLocaleString()} leads` : ""}</span>
              </div>
              <p className="mt-3 font-display text-3xl font-bold text-bone">
                {planPrice(candidate)}
                <span className="font-mono text-xs font-normal text-faint">{candidate.price_minor ? "/mo" : ""}</span>
              </p>
              <p className="mt-2 min-h-[36px] text-[12.5px] leading-relaxed text-sage">{candidate.description ?? ""}</p>
              <ul className="mt-4 space-y-2 border-t border-line pt-4">
                {[
                  [`${(leads ?? 0).toLocaleString()} billable leads`, true],
                  [`${limitOf(candidate, "ai_runs_per_period") ?? 0} AI runs / cycle`, (limitOf(candidate, "ai_runs_per_period") ?? 0) > 0],
                  [`${limitOf(candidate, "seats") ?? 1} seat${(limitOf(candidate, "seats") ?? 1) === 1 ? "" : "s"}`, true],
                  [`depth ${limitOf(candidate, "max_search_depth") ?? 10} · radius ${limitOf(candidate, "max_radius_km") ?? 10} km`, true],
                  ["grid coverage", (limitOf(candidate, "grid_coverage") ?? 0) > 0],
                  ["API access", (limitOf(candidate, "api_access") ?? 0) > 0],
                ].map(([label, included]) => (
                  <li key={String(label)} className={cn("flex items-center gap-2 text-[12px]", included ? "text-sage" : "text-faint line-through")}>
                    <Check className={cn("size-3.5 shrink-0", included ? "text-zest" : "text-faint")} />
                    {label}
                  </li>
                ))}
              </ul>
              <button
                disabled={isCurrent || busy !== null || !isConfigured || !upgradeable}
                onClick={() => upgradeable && void upgrade(candidate.code as "growth" | "scale")}
                className={cn(
                  "mt-5 h-10 w-full rounded-xl font-display text-[13px] font-semibold transition-all",
                  isCurrent
                    ? "cursor-default bg-white/[0.04] text-faint"
                    : "bg-zest text-ink hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40",
                )}
              >
                {isCurrent ? "Current plan" : busy === candidate.code ? "Opening checkout…" : `Switch to ${candidate.name}`}
              </button>
            </div>
          );
        })}
        {plans.loading && <Card className="p-6 font-mono text-[11.5px] text-faint">loading plans…</Card>}
      </div>

      {/* payment + invoices */}
      <div className="mt-8 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <Card className="p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-semibold text-bone">Payment method</h3>
            <button onClick={() => void action("refresh")} className="font-mono text-[11px] text-zest hover:underline">
              refresh →
            </button>
          </div>
          {methods.length === 0 ? (
            <p className="mt-4 rounded-xl border border-line bg-white/[0.02] p-4 text-[12.5px] leading-relaxed text-sage">
              No method on file yet. Razorpay collects and stores the card during checkout — Zybble never sees or stores card numbers.
            </p>
          ) : (
            methods.map((method) => (
              <div key={method.id} className="mt-4 flex items-center gap-4 rounded-2xl border border-line bg-gradient-to-br from-white/[0.04] to-transparent p-5">
                <CreditCard className="size-8 text-zest" />
                <div>
                  <p className="font-mono text-[14px] text-bone">
                    {method.brand ?? method.type} {method.last4 ? `···· ${method.last4}` : ""}
                  </p>
                  <p className="mt-0.5 font-mono text-[10.5px] text-faint">{method.expiry ? `expires ${method.expiry}` : "managed by Razorpay"}</p>
                </div>
                {method.isDefault && <span className="ml-auto rounded-md bg-zest/10 px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-zest">default</span>}
              </div>
            ))
          )}
          <p className="mt-4 font-mono text-[10.5px] leading-relaxed text-faint">
            Billed in USD through Razorpay. Card details are tokenized by Razorpay; 3-D Secure is enforced on every charge.
          </p>
          {payments.length > 0 && (
            <div className="mt-5 space-y-2">
              <p className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-faint">recent attempts</p>
              {payments.slice(0, 4).map((payment) => (
                <div key={payment.id} className="flex items-center justify-between font-mono text-[11px]">
                  <span className="text-sage">
                    {formatMoney(payment.amount, payment.currency)} · {relTime(payment.createdAt)}
                  </span>
                  <span className={payment.status === "captured" || payment.status === "authorized" ? "text-zest" : "text-amber"}>{payment.status}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h3 className="font-display text-base font-semibold text-bone">Invoices</h3>
            <span className="font-mono text-[10.5px] text-faint">{invoices.length} total</span>
          </div>
          <div className="divide-y divide-line/60">
            {invoices.length === 0 && <p className="px-5 py-10 text-center font-mono text-[11.5px] text-faint">No invoices yet — Razorpay issues them on each charge.</p>}
            {invoices.map((invoice) => (
              <div key={invoice.id} className="flex items-center gap-3.5 px-5 py-3.5">
                <FileText className="size-4 shrink-0 text-faint" />
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[12.5px] font-medium text-bone">{invoice.number}</p>
                  <p className="font-mono text-[10px] text-faint">{invoice.issuedLabel ? shortDate(invoice.issuedLabel) : "—"}</p>
                </div>
                <span className="font-mono text-[12.5px] text-bone">{formatMoney(invoice.amount, invoice.currency)}</span>
                <StatusChip status={invoice.status === "paid" ? "paid" : invoice.status} />
                {invoice.url && (
                  <a href={invoice.url} target="_blank" rel="noreferrer" className="font-mono text-[10.5px] text-zest hover:underline">
                    open
                  </a>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Modal open={confirmCancel} onClose={() => setConfirmCancel(false)} title="Cancel subscription?">
        <p className="text-[13.5px] leading-relaxed text-sage">
          Your plan stays active until the end of the current cycle{subscription?.current_period_end ? ` (${shortDate(String(subscription.current_period_end))})` : ""}, then Razorpay stops
          charging. Your leads, lists and exports stay yours.
        </p>
        <div className="mt-6 flex gap-2.5">
          <button onClick={() => setConfirmCancel(false)} className="h-11 flex-1 rounded-xl border border-line font-display text-sm font-medium text-sage hover:text-bone">
            Keep subscription
          </button>
          <button
            onClick={() => void action("cancel", true)}
            disabled={busy !== null}
            className="h-11 flex-1 rounded-xl bg-red-400/90 font-display text-sm font-semibold text-ink disabled:opacity-40"
          >
            {busy === "cancel" ? "Cancelling…" : "Cancel at cycle end"}
          </button>
        </div>
      </Modal>

      <Modal open={showPause} onClose={() => setShowPause(false)} title="Pause subscription?">
        <p className="text-[13.5px] leading-relaxed text-sage">
          Razorpay pauses billing. Depending on your account this can take a moment to reflect — the status chip always shows what Razorpay reports, never an optimistic
          guess.
        </p>
        <div className="mt-6 flex gap-2.5">
          <button onClick={() => setShowPause(false)} className="h-11 flex-1 rounded-xl border border-line font-display text-sm font-medium text-sage hover:text-bone">
            Keep running
          </button>
          <button onClick={() => void action("pause")} disabled={busy !== null} className="h-11 flex-1 rounded-xl bg-zest font-display text-sm font-semibold text-ink disabled:opacity-40">
            {busy === "pause" ? "Pausing…" : "Pause billing"}
          </button>
        </div>
      </Modal>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  /setting                                                           */
/* ------------------------------------------------------------------ */

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

type SettingsPayload = {
  profile: { id: string; email: string; full_name: string | null; company: string | null; timezone: string | null; locale: string | null; avatar_url: string | null } | null;
  workspace: { id: string; name: string; slug: string };
  role: string | null;
  canManage: boolean;
  preferences: {
    default_language: string | null;
    default_depth: number | null;
    default_radius_km: number | null;
    email_extraction_default: boolean | null;
    dedupe_strictness: string | null;
  } | null;
  notificationPreferences: Record<string, boolean> | null;
};

type TeamPayload = {
  seats: { used: number; included: number; plan: string };
  members: Array<{ id: string; userId: string; email: string; name: string | null; role: string; status: string; joinedAt: string | null; isYou: boolean }>;
  invites: Array<{ id: string; email: string; role: string; expiresAt: string; createdAt: string; expired: boolean }>;
};

const NOTIFICATION_ROWS = [
  ["search_completed", "Search completed", "Email me when a search finishes and its leads are ready."],
  ["search_failed", "Search failed", "Tell me when a search stops with an error."],
  ["export_ready", "Export ready", "Ping me when a generated file is downloadable."],
  ["ai_completed", "AI finished", "Notify me when planning, scoring or analysis completes."],
  ["quota_warnings", "Quota warnings", "Warn me before I run out of billable leads."],
  ["weekly_digest", "Weekly digest", "A Monday summary of new leads and search activity."],
  ["product_updates", "Product updates", "Occasional notes about new Zybble features."],
  ["marketing_tips", "Tips & playbooks", "How-to emails about outbound with Zybble."],
] as const;

export function SettingsPage({ initialTab }: { initialTab?: string }) {
  const { theme, setTheme } = useTheme();
  const { me, user, updatePassword, refresh } = useSession();
  const settings = useSettings();
  const team = useTeam();
  const keys = useApiKeys();
  const billing = useBilling();
  const [tab, setTab] = useState<TabId>((initialTab as TabId) || "appearance");
  const [flash, setFlash] = useState<{ tone: "good" | "warn"; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const payload = (settings.data ?? null) as SettingsPayload | null;
  const teamData = (team.data ?? null) as TeamPayload | null;
  const canManage = payload?.canManage ?? false;

  /** Local drafts, seeded from the server response and saved explicitly. */
  const [profileDraft, setProfileDraft] = useState({ fullName: "", company: "", timezone: "", locale: "" });
  const [prefs, setPrefs] = useState({ defaultLanguage: "en", defaultDepth: 10, defaultRadiusKm: 10, emailExtractionDefault: true, dedupeStrictness: "balanced" });
  const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean>>({});
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member" | "viewer">("member");
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyExpiry, setNewKeyExpiry] = useState<number | null>(90);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [secretCopied, setSecretCopied] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteEmailConfirmed, setDeleteEmailConfirmed] = useState("");
  const [support, setSupport] = useState("support@zybble.com");

  useEffect(() => {
    if (!payload) return;
    setProfileDraft({
      fullName: payload.profile?.full_name ?? "",
      company: payload.profile?.company ?? "",
      timezone: payload.profile?.timezone ?? "UTC",
      locale: payload.profile?.locale ?? "en",
    });
    setPrefs({
      defaultLanguage: payload.preferences?.default_language ?? "en",
      defaultDepth: payload.preferences?.default_depth ?? 10,
      defaultRadiusKm: payload.preferences?.default_radius_km ?? 10,
      emailExtractionDefault: payload.preferences?.email_extraction_default ?? true,
      dedupeStrictness: payload.preferences?.dedupe_strictness ?? "balanced",
    });
    setNotifPrefs(payload.notificationPreferences ?? {});
  }, [payload]);

  useEffect(() => {
    api
      .system()
      .then((system) => {
        const email = (system.support as { email?: string } | undefined)?.email;
        if (email) setSupport(email);
      })
      .catch(() => undefined);
  }, []);

  const notify = (tone: "good" | "warn", text: string) => {
    setFlash({ tone, text });
    window.setTimeout(() => setFlash(null), 5000);
  };

  const run = async (key: string, work: () => Promise<unknown>, success: string) => {
    setBusy(key);
    setFlash(null);
    try {
      await work();
      notify("good", success);
    } catch (cause) {
      notify("warn", cause instanceof ApiError ? cause.message : "That change could not be saved");
    } finally {
      setBusy(null);
    }
  };

  const copySecret = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setSecretCopied(true);
      window.setTimeout(() => setSecretCopied(false), 1600);
    } catch {
      setSecretCopied(false);
    }
  };

  const apiKeys: ApiKeyPayload[] = keys.data?.items ?? [];
  const origin = typeof window === "undefined" ? "" : window.location.origin;

  const exportEverything = async () => {
    setBusy("export");
    setFlash(null);
    try {
      await api.exports.create({ name: "workspace-export.json", format: "json", sourceType: "all" });
      notify("good", "Full workspace export queued — it appears on the Exports page as soon as the worker finishes it.");
    } catch (cause) {
      notify("warn", cause instanceof ApiError ? cause.message : "The export could not be queued");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <PageHeader title={<>Settings</>} desc="Profile, notifications, payments, team and API — everything comes from your workspace." />

      {flash && <Flash tone={flash.tone}>{flash.text}</Flash>}

      {/* tabs */}
      <div className="mb-6 flex gap-1.5 overflow-x-auto no-bar rounded-2xl border border-line bg-coal p-1.5">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "shrink-0 rounded-xl px-4 py-2.5 font-display text-[12.5px] font-medium transition-all",
              tab === id ? "bg-zest text-ink" : "text-sage hover:bg-white/[0.04] hover:text-bone",
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
                    </div>
                  ),
                },
              ] as const
            ).map((option) => {
              const active = theme === option.id;
              return (
                <button
                  key={option.id}
                  onClick={() => setTheme(option.id)}
                  className={cn(
                    "group relative rounded-2xl border p-5 text-left transition-all duration-300",
                    active ? "border-zest/60 bg-coal shadow-[0_20px_60px_-30px_rgba(0,0,0,0.4)]" : "border-line bg-coal hover:border-line-strong",
                  )}
                >
                  {active && (
                    <motion.span layoutId="theme-check" className="absolute right-4 top-4 grid size-6 place-items-center rounded-full bg-zest">
                      <Check className="size-3.5 text-ink" strokeWidth={3} />
                    </motion.span>
                  )}
                  <div className="flex items-center gap-2.5">
                    <span className={cn("grid size-9 place-items-center rounded-lg border", active ? "border-zest/40 bg-zest/10 text-zest" : "border-line text-sage")}>
                      <option.icon className="size-4.5" />
                    </span>
                    <div>
                      <p className="font-display text-[15px] font-semibold text-bone">{option.label}</p>
                      <p className="font-mono text-[9.5px] uppercase tracking-wider text-faint">{active ? "active" : "switch"}</p>
                    </div>
                  </div>
                  <div className="mt-4">{option.preview}</div>
                  <p className="mt-4 text-[12.5px] leading-relaxed text-sage">{option.desc}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ------------------------------ PROFILE ------------------------------ */}
      {tab === "profile" && (
        <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
          <Card className="p-5 sm:p-7">
            <div className="flex items-center gap-4">
              <span className="grid size-14 place-items-center rounded-2xl border border-zest/25 bg-gradient-to-br from-zest/15 to-graphite font-display text-lg font-bold text-zest">
                {(profileDraft.fullName || user?.email || "?").slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate font-display text-base font-semibold text-bone">{profileDraft.fullName || "Unnamed user"}</p>
                <p className="truncate font-mono text-[11px] text-faint">
                  {payload?.role ?? "member"} · {user?.email ?? ""}
                </p>
              </div>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-faint">Full name</label>
                <input value={profileDraft.fullName} onChange={(e) => setProfileDraft({ ...profileDraft, fullName: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-faint">Work email</label>
                <input value={user?.email ?? ""} readOnly className={cn(inputCls, "opacity-60")} />
              </div>
              <div>
                <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-faint">Company</label>
                <input value={profileDraft.company} onChange={(e) => setProfileDraft({ ...profileDraft, company: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-faint">Timezone</label>
                <input value={profileDraft.timezone} onChange={(e) => setProfileDraft({ ...profileDraft, timezone: e.target.value })} placeholder="Europe/Berlin" className={inputCls} />
              </div>
            </div>
            <button
              onClick={() =>
                void run(
                  "profile",
                  async () => {
                    await api.settings.update({ profile: { fullName: profileDraft.fullName, company: profileDraft.company || null, timezone: profileDraft.timezone } });
                    await Promise.all([settings.reload(), refresh()]);
                  },
                  "Profile saved.",
                )
              }
              disabled={busy !== null}
              className="mt-6 inline-flex h-10 items-center gap-2 rounded-xl bg-zest px-5 font-display text-[13px] font-semibold text-ink transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-40"
            >
              {busy === "profile" ? <Loader2 className="size-4 animate-spin" /> : null} Save changes
            </button>
          </Card>

          <div className="space-y-4">
            <Card className="p-5 sm:p-6">
              <h3 className="flex items-center gap-2.5 font-display text-base font-semibold text-bone">
                <KeyRound className="size-4.5 text-zest" /> Password
              </h3>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="New password (8+ characters)"
                className={cn(inputCls, "mt-4")}
              />
              <button
                onClick={() =>
                  void run(
                    "password",
                    async () => {
                      await updatePassword(password);
                      setPassword("");
                    },
                    "Password updated. Use it next time you sign in.",
                  )
                }
                disabled={busy !== null || password.length < 8}
                className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-zest px-5 font-display text-[13px] font-semibold text-ink transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-40"
              >
                {busy === "password" ? <Loader2 className="size-4 animate-spin" /> : null} Update password
              </button>
              <p className="mt-3 font-mono text-[10.5px] leading-relaxed text-faint">
                Password changes are handled by Supabase Auth. Changing the account email needs confirmation from the new address.
              </p>
            </Card>
            <Card className="flex items-center gap-4 p-5 sm:p-6">
              <ShieldCheck className="size-6 shrink-0 text-zest" />
              <div className="flex-1">
                <p className="text-[13.5px] font-medium text-bone">Two-factor authentication</p>
                <p className="mt-0.5 font-mono text-[10.5px] leading-relaxed text-faint">
                  Not offered yet — we will not show a switch that does not protect anything. Sessions are short-lived and every API call re-checks your token.
                </p>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ------------------------------ NOTIFICATIONS ------------------------------ */}
      {tab === "notifications" && (
        <Card className="overflow-hidden">
          <div className="border-b border-line px-5 py-4 sm:px-6">
            <h3 className="font-display text-base font-semibold text-bone">Email notifications</h3>
            <p className="mt-0.5 text-[12.5px] text-sage">
              Delivered through the worker with your provider; in-app notifications always appear in the bell regardless of these switches.
            </p>
          </div>
          <div className="divide-y divide-line/60">
            {NOTIFICATION_ROWS.map(([key, title, desc]) => (
              <div key={key} className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6">
                <div>
                  <p className="text-[13.5px] font-medium text-bone">{title}</p>
                  <p className="mt-0.5 text-[12px] text-sage">{desc}</p>
                </div>
                <Toggle
                  on={notifPrefs[key] ?? true}
                  onChange={(value) =>
                    void run("notifications", async () => {
                      setNotifPrefs((current) => ({ ...current, [key]: value }));
                      await api.settings.update({ notifications: { [key]: value } });
                      await settings.reload();
                    }, "Notification preference saved.")
                  }
                />
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ------------------------------ PAYMENTS ------------------------------ */}
      {tab === "payments" && (
        <div>
          <div className="grid gap-4 sm:grid-cols-2">
            {(billing.data?.methods ?? []).map((method) => (
              <Card key={method.id} className={cn("relative overflow-hidden p-5", method.isDefault && "border-zest/40")}>
                {method.isDefault && (
                  <span className="absolute right-4 top-4 rounded-md bg-zest px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-ink">default</span>
                )}
                <CreditCard className="size-8 text-zest" />
                <p className="mt-4 font-mono text-[15px] text-bone">
                  {method.brand ?? method.type} {method.last4 ? `···· ${method.last4}` : ""}
                </p>
                <p className="mt-1 font-mono text-[11px] text-faint">{method.expiry ? `expires ${method.expiry}` : "no expiry reported"}</p>
              </Card>
            ))}
            {(billing.data?.methods ?? []).length === 0 && (
              <Card className="p-5 sm:p-6">
                <p className="text-[13px] leading-relaxed text-sage">
                  No saved method. Razorpay collects the card during checkout and keeps the token — updating a card therefore means completing a new checkout, which is
                  also how you upgrade a plan.
                </p>
                <a
                  href="#/billing"
                  className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl border border-zest/40 bg-zest/10 px-4 font-display text-[13px] font-medium text-zest"
                >
                  <Plus className="size-4" /> Go to billing
                </a>
              </Card>
            )}
          </div>
          <Card className="mt-4 flex items-start gap-4 p-5">
            <ShieldCheck className="size-6 shrink-0 text-zest" />
            <p className="text-[12.5px] leading-relaxed text-sage">
              Card data never touches Zybble servers: checkout runs on Razorpay's domain and we only ever store the resulting identifiers and status. 3-D Secure is
              enforced by the provider.
            </p>
          </Card>
        </div>
      )}

      {/* ------------------------------ TEAM ------------------------------ */}
      {tab === "team" && (
        <div>
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h3 className="flex items-center gap-2.5 font-display text-base font-semibold text-bone">
                <Users className="size-4.5 text-zest" /> Members
              </h3>
              <span className="font-mono text-[10.5px] text-faint">
                {teamData ? `${teamData.seats.used} / ${teamData.seats.included} seats used` : "loading seats…"}
              </span>
            </div>
            <div className="divide-y divide-line/60">
              {(teamData?.members ?? []).map((member) => (
                <div key={member.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                  <span className="grid size-9 place-items-center rounded-lg border border-line bg-white/[0.03] font-display text-[11px] font-bold text-zest">
                    {(member.name ?? member.email).slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-medium text-bone">
                      {member.name ?? member.email} {member.isYou && <span className="font-mono text-[10px] text-faint">(you)</span>}
                    </p>
                    <p className="truncate font-mono text-[10.5px] text-faint">{member.email}</p>
                  </div>
                  <StatusChip status={member.status} />
                  {canManage && !member.isYou ? (
                    <select
                      value={member.role}
                      onChange={(e) =>
                        void run("team", async () => {
                          await api.settings.setRole(member.id, e.target.value as "owner" | "admin" | "member" | "viewer");
                          await team.reload();
                        }, "Role updated.")
                      }
                      className="h-9 appearance-none rounded-lg border border-line bg-coal px-3 font-mono text-[11px] text-sage outline-none"
                    >
                      <option className="bg-coal">owner</option>
                      <option className="bg-coal">admin</option>
                      <option className="bg-coal">member</option>
                      <option className="bg-coal">viewer</option>
                    </select>
                  ) : (
                    <span className="font-mono text-[11px] text-sage">{member.role}</span>
                  )}
                  {canManage && !member.isYou && (
                    <button
                      onClick={() =>
                        void run("team", async () => {
                          await api.settings.removeMember(member.id);
                          await team.reload();
                        }, "Member removed.")
                      }
                      className="grid size-8 place-items-center rounded-lg border border-line text-faint transition-colors hover:border-red-400/40 hover:text-red-300"
                      aria-label="Remove member"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              ))}
              {(teamData?.members ?? []).length === 0 && <p className="px-5 py-8 text-center font-mono text-[11.5px] text-faint">loading members…</p>}
            </div>
            {canManage && (
              <div className="flex flex-col gap-2.5 border-t border-line p-4 sm:flex-row sm:p-5">
                <input
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  className={cn(inputCls, "sm:flex-1")}
                />
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as typeof inviteRole)}
                  className={cn(inputCls, "appearance-none sm:w-36")}
                >
                  <option className="bg-coal" value="admin">
                    admin
                  </option>
                  <option className="bg-coal" value="member">
                    member
                  </option>
                  <option className="bg-coal" value="viewer">
                    viewer
                  </option>
                </select>
                <button
                  onClick={() =>
                    void run(
                      "invite",
                      async () => {
                        await api.settings.invite({ email: inviteEmail.trim(), role: inviteRole });
                        setInviteEmail("");
                        await team.reload();
                      },
                      "Invitation sent. It appears below until it is accepted.",
                    )
                  }
                  disabled={busy !== null || !inviteEmail.includes("@")}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-zest px-5 font-display text-sm font-semibold text-ink transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-40"
                >
                  {busy === "invite" ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Send invite
                </button>
              </div>
            )}
          </Card>

          {(teamData?.invites ?? []).length > 0 && (
            <Card className="mt-4 overflow-hidden">
              <div className="border-b border-line px-5 py-3.5 font-mono text-[10.5px] text-faint">pending invitations</div>
              <div className="divide-y divide-line/60">
                {(teamData?.invites ?? []).map((invite) => (
                  <div key={invite.id} className="flex items-center gap-3 px-5 py-3.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono text-[12.5px] text-bone">{invite.email}</p>
                      <p className="font-mono text-[10px] text-faint">
                        {invite.role} · expires {relTime(invite.expiresAt)} {invite.expired ? "(expired)" : ""}
                      </p>
                    </div>
                    {canManage && (
                      <button
                        onClick={() =>
                          void run("team", async () => {
                            await api.settings.revokeInvite(invite.id);
                            await team.reload();
                          }, "Invitation revoked.")
                        }
                        className="font-mono text-[10.5px] text-amber hover:underline"
                      >
                        revoke
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}
          <p className="mt-4 font-mono text-[11px] leading-relaxed text-faint">
            Invited members count towards seats only after they accept. Visitors can read; members can run searches; admins can also manage billing and team.
          </p>
        </div>
      )}

      {/* ------------------------------ API ------------------------------ */}
      {tab === "api" && (
        <div className="space-y-4">
          <Card className="p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <KeyRound className="size-5 text-zest" />
                <h3 className="font-display text-base font-semibold text-bone">API keys</h3>
              </div>
              <span className="font-mono text-[10.5px] text-faint">
                {me?.capabilities.apiKeys === false ? "API access is not included in your plan" : "rate limited per key and per plan"}
              </span>
            </div>

            {newSecret && (
              <div className="mt-4 rounded-xl border border-zest/40 bg-zest/[0.07] p-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zest">copy this now — it is shown once</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <code className="flex-1 overflow-x-auto rounded-lg border border-line bg-ink/70 px-3 py-2 font-mono text-[12px] text-zest no-bar">{newSecret}</code>
                  <button
                    onClick={() => void copySecret(newSecret)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 font-mono text-[11px] text-sage hover:text-bone"
                  >
                    {secretCopied ? <Check className="size-3.5 text-zest" /> : <Copy className="size-3.5" />} copy
                  </button>
                  <button onClick={() => setNewSecret(null)} className="font-mono text-[11px] text-faint hover:text-bone">
                    done
                  </button>
                </div>
              </div>
            )}

            <div className="mt-5 divide-y divide-line/60 overflow-hidden rounded-xl border border-line">
              {keys.loading && <p className="px-4 py-6 text-center font-mono text-[11.5px] text-faint">loading keys…</p>}
              {!keys.loading && apiKeys.length === 0 && (
                <p className="px-4 py-6 text-center font-mono text-[11.5px] text-faint">No keys yet. Create one for your scripts and CI jobs.</p>
              )}
              {apiKeys.map((key) => (
                <div key={key.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-bone">
                      {key.name} {key.revoked_at && <span className="font-mono text-[10px] text-amber">revoked</span>}
                    </p>
                    <p className="truncate font-mono text-[10.5px] text-faint">
                      {key.prefix}… · {key.scopes.join(", ")} · {key.last_used_at ? `last used ${relTime(key.last_used_at)}` : "never used"}
                      {key.expires_at ? ` · expires ${relTime(key.expires_at)}` : ""}
                    </p>
                  </div>
                  {!key.revoked_at && (
                    <>
                      <button
                        onClick={() =>
                          void run(
                            `rotate-${key.id}`,
                            async () => {
                              const rotated = await api.keys.rotate(key.id);
                              setNewSecret(rotated.secret);
                              await keys.reload();
                            },
                            "Key rotated — the previous secret no longer works.",
                          )
                        }
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-3 font-mono text-[11px] text-sage hover:border-zest/40 hover:text-bone"
                      >
                        <RefreshCw className="size-3.5" /> rotate
                      </button>
                      <button
                        onClick={() =>
                          void run(
                            `revoke-${key.id}`,
                            async () => {
                              await api.keys.remove(key.id);
                              await keys.reload();
                            },
                            "Key revoked.",
                          )
                        }
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-3 font-mono text-[11px] text-sage hover:border-red-400/40 hover:text-red-300"
                      >
                        <Trash2 className="size-3.5" /> revoke
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
              <input value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} placeholder="Key name (e.g. zapier-prod)" className={cn(inputCls, "sm:flex-1")} />
              <select
                value={newKeyExpiry ?? 0}
                onChange={(e) => setNewKeyExpiry(Number(e.target.value) || null)}
                className={cn(inputCls, "appearance-none sm:w-44")}
              >
                <option className="bg-coal" value={90}>
                  expires in 90 days
                </option>
                <option className="bg-coal" value={365}>
                  expires in 1 year
                </option>
                <option className="bg-coal" value={0}>
                  no expiry
                </option>
              </select>
              <button
                onClick={() =>
                  void run(
                    "create-key",
                    async () => {
                      const created = await api.keys.create({ name: newKeyName.trim(), expiresInDays: newKeyExpiry });
                      setNewSecret(created.secret);
                      setNewKeyName("");
                      await keys.reload();
                    },
                    "Key created. Copy the secret now.",
                  )
                }
                disabled={busy !== null || newKeyName.trim().length < 2}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-zest px-5 font-display text-sm font-semibold text-ink transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-40"
              >
                {busy === "create-key" ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Create key
              </button>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="border-b border-line px-5 py-3.5 font-mono text-[10.5px] text-faint">quickstart</div>
            <pre className="overflow-x-auto bg-[#0a0d0b] p-5 font-mono text-[11.5px] leading-[1.9] text-sage">
{`curl -X POST ${origin}/api/searches \\
  -H "Authorization: Bearer $ZYBBLE_KEY" \\
  -H "content-type: application/json" \\
  -d '{
    "query": "dentists",
    "location": "Berlin",
    "requestedCount": 250,
    "config": { "emailExtraction": true, "depth": 10 }
  }'

# → { "search": { "slug": "…", "status": "queued" } }
# poll  GET ${origin}/api/searches/<slug>
# leads GET ${origin}/api/leads?limit=100`}
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
              <select
                value={prefs.defaultLanguage}
                onChange={(e) => setPrefs({ ...prefs, defaultLanguage: e.target.value })}
                className={cn(inputCls, "appearance-none")}
              >
                {["en", "de", "fr", "pt", "es", "nl", "it"].map((language) => (
                  <option key={language} className="bg-coal">
                    {language}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-faint">Default depth</label>
              <select
                value={prefs.defaultDepth}
                onChange={(e) => setPrefs({ ...prefs, defaultDepth: Number(e.target.value) })}
                className={cn(inputCls, "appearance-none")}
              >
                {[4, 8, 10, 12, 16].map((depth) => (
                  <option key={depth} className="bg-coal" value={depth}>
                    {depth} levels
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-faint">Default radius (km)</label>
              <select
                value={prefs.defaultRadiusKm}
                onChange={(e) => setPrefs({ ...prefs, defaultRadiusKm: Number(e.target.value) })}
                className={cn(inputCls, "appearance-none")}
              >
                {[5, 10, 25, 50, 100].map((radius) => (
                  <option key={radius} className="bg-coal" value={radius}>
                    {radius} km
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-faint">Dedupe strictness</label>
              <select
                value={prefs.dedupeStrictness}
                onChange={(e) => setPrefs({ ...prefs, dedupeStrictness: e.target.value })}
                className={cn(inputCls, "appearance-none")}
              >
                {["strict", "balanced", "loose"].map((value) => (
                  <option key={value} className="bg-coal">
                    {value}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-between gap-4 rounded-xl border border-line bg-ink/40 px-4 py-3">
              <div>
                <p className="text-[13px] font-medium text-bone">Email extraction default</p>
                <p className="mt-0.5 text-[11px] text-sage">Crawl official sites on new searches</p>
              </div>
              <Toggle on={prefs.emailExtractionDefault} onChange={(value) => setPrefs({ ...prefs, emailExtractionDefault: value })} />
            </div>
          </div>
          <button
            onClick={() =>
              void run(
                "preferences",
                async () => {
                  await api.settings.update({
                    preferences: {
                      defaultLanguage: prefs.defaultLanguage,
                      defaultDepth: prefs.defaultDepth,
                      defaultRadiusKm: prefs.defaultRadiusKm,
                      emailExtractionDefault: prefs.emailExtractionDefault,
                      dedupeStrictness: prefs.dedupeStrictness as "strict" | "balanced" | "loose",
                    },
                  });
                  await settings.reload();
                },
                "Preferences saved.",
              )
            }
            disabled={busy !== null}
            className="mt-6 inline-flex h-10 items-center gap-2 rounded-xl bg-zest px-5 font-display text-[13px] font-semibold text-ink transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-40"
          >
            {busy === "preferences" ? <Loader2 className="size-4 animate-spin" /> : null} Save changes
          </button>
        </Card>
      )}

      {/* ------------------------------ PRIVACY ------------------------------ */}
      {tab === "privacy" && (
        <div className="space-y-4">
          <Card className="flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
            <div className="flex-1">
              <h3 className="font-display text-[15px] font-semibold text-bone">Export all workspace data</h3>
              <p className="mt-1 text-[12.5px] leading-relaxed text-sage">
                A complete JSON dump — leads, lists, searches, exports and settings — generated server-side by the worker, then downloadable from the Exports page.
              </p>
            </div>
            <button
              onClick={() => void exportEverything()}
              disabled={busy !== null}
              className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-zest/40 bg-zest/10 px-4 font-display text-[13px] font-medium text-zest transition-transform hover:scale-[1.03] active:scale-95 disabled:opacity-40"
            >
              {busy === "export" ? <Loader2 className="size-4 animate-spin" /> : null} Export workspace
            </button>
          </Card>

          <Card className="border-red-400/25 p-5 sm:p-6">
            <h3 className="font-display text-[15px] font-semibold text-red-300">Delete this workspace</h3>
            <p className="mt-1 max-w-xl text-[12.5px] leading-relaxed text-sage">
              Deletion is a destructive, unrecoverable operation, so it is performed by our team against a verified request rather than by a one-click button. We will
              confirm from this account's email before removing anything, and searches stop immediately once the request is accepted.
            </p>
            <button
              onClick={() => setConfirmDelete(true)}
              className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl border border-red-400/40 bg-red-400/10 px-4 font-display text-[13px] font-medium text-red-300 transition-transform hover:scale-[1.02] active:scale-95"
            >
              <Trash2 className="size-4" /> Request deletion
            </button>
          </Card>
        </div>
      )}

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Request workspace deletion">
        <p className="text-[13.5px] leading-relaxed text-sage">
          Type <span className="rounded bg-red-400/10 px-1.5 py-0.5 font-mono text-[12px] text-red-300">{user?.email ?? "your email"}</span> to confirm, then send the
          request. Queued searches are cancelled and data is removed after verification.
        </p>
        <input
          value={deleteEmailConfirmed}
          onChange={(e) => setDeleteEmailConfirmed(e.target.value)}
          placeholder={user?.email ?? "your email"}
          className={cn(inputCls, "mt-4 font-mono")}
        />
        <a
          href={`mailto:${support}?subject=${encodeURIComponent(`Delete workspace ${payload?.workspace.name ?? ""}`)}&body=${encodeURIComponent(
            `Please delete my workspace (${payload?.workspace.slug ?? "unknown"}) and all data in it.\n\nAccount: ${user?.email ?? ""}\n`,
          )}`}
          onClick={() => setConfirmDelete(false)}
          className={cn(
            "mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl font-display text-sm font-semibold transition-transform",
            deleteEmailConfirmed.trim().toLowerCase() === (user?.email ?? "").toLowerCase() && deleteEmailConfirmed !== ""
              ? "bg-red-400 text-ink hover:scale-[1.02]"
              : "pointer-events-none bg-white/[0.05] text-faint",
          )}
        >
          Send deletion request
        </a>
      </Modal>
    </div>
  );
}

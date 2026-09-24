import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  CreditCard,
  FileDown,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  MoreHorizontal,
  Radar,
  SearchCheck,
  Settings,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { Logo } from "../components/ui";
import { api, ApiError } from "../lib/api";
import { useEngine } from "./engine";
import { useNotifications } from "./hooks";
import { useSession, useWorkspace } from "./session";
import { initials, relTime } from "./data";
import { cn } from "../utils/cn";

/* ------------------------------------------------------------------ */
/*  shared app widgets                                                 */
/* ------------------------------------------------------------------ */

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-2xl border border-line bg-coal", className)}>{children}</div>;
}

export function PageHeader({
  title,
  desc,
  actions,
}: {
  title: ReactNode;
  desc?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 sm:mb-8">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-bone sm:text-3xl">{title}</h1>
        {desc && <p className="mt-1.5 max-w-lg text-[13.5px] leading-relaxed text-sage">{desc}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2.5">{actions}</div>}
    </div>
  );
}

export function Meter({ value, max, tone = "zest" }: { value: number; max: number; tone?: "zest" | "amber" }) {
  const pct = Math.min(100, (value / Math.max(1, max)) * 100);
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className={cn("h-full rounded-full", pct > 90 ? "bg-amber" : tone === "amber" ? "bg-amber" : "bg-zest")}
      />
    </div>
  );
}

export function StatusChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    running: "border-zest/40 bg-zest/10 text-zest",
    queued: "border-line bg-white/[0.04] text-sage",
    complete: "border-zest/40 bg-zest/10 text-zest",
    paused: "border-amber/40 bg-amber/10 text-amber",
    failed: "border-red-400/40 bg-red-400/10 text-red-300",
    ready: "border-zest/40 bg-zest/10 text-zest",
    generating: "border-amber/40 bg-amber/10 text-amber",
    expired: "border-line bg-white/[0.04] text-faint",
    active: "border-zest/40 bg-zest/10 text-zest",
    invited: "border-amber/40 bg-amber/10 text-amber",
    paid: "border-zest/40 bg-zest/10 text-zest",
  };
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-wider", map[status] ?? map.queued)}>
      {status === "running" && <span className="size-1.5 animate-ping-soft rounded-full bg-zest" />}
      {status}
    </span>
  );
}

export function QualityBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1 w-12 overflow-hidden rounded-full bg-white/[0.07]">
        <div className={cn("h-full rounded-full", value >= 90 ? "bg-zest" : value >= 80 ? "bg-amber" : "bg-red-300")} style={{ width: `${value}%` }} />
      </div>
      <span className="font-mono text-[10.5px] text-sage">{value}%</span>
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[85] grid place-items-end bg-ink/80 p-0 backdrop-blur-sm sm:place-items-center sm:p-6"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 60, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-line-strong bg-graphite p-6 sm:rounded-3xl sm:p-7"
          >
            <div className="mb-5 flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold text-bone">{title}</h3>
              <button onClick={onClose} className="grid size-9 place-items-center rounded-lg border border-line text-sage hover:text-bone" aria-label="Close">
                <X className="size-4" />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function EmptyState({ icon: Icon, title, desc, action }: { icon: typeof Radar; title: string; desc: string; action?: ReactNode }) {
  return (
    <div className="grid place-items-center rounded-2xl border border-dashed border-line-strong px-6 py-16 text-center">
      <div className="grid size-12 place-items-center rounded-xl border border-zest/25 bg-zest/[0.07]">
        <Icon className="size-5 text-zest" />
      </div>
      <h3 className="mt-4 font-display text-base font-semibold text-bone">{title}</h3>
      <p className="mt-1.5 max-w-xs text-[13px] text-sage">{desc}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/**
 * A render error inside one page must never unmount the whole app (which
 * shows up as a blank white screen). Keyed by route, so navigating away resets it.
 */
export class PageErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[page crashed]", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="grid place-items-center rounded-2xl border border-amber/40 bg-amber/[0.06] px-6 py-14 text-center">
        <p className="font-display text-lg font-semibold text-bone">This screen hit a problem</p>
        <p className="mt-2 max-w-md font-mono text-[11.5px] leading-relaxed text-amber">{this.state.error.message || "Unexpected error"}</p>
        <button
          onClick={() => this.setState({ error: null })}
          className="mt-5 inline-flex h-10 items-center rounded-xl bg-zest px-4 font-display text-[13px] font-semibold text-ink"
        >
          Try again
        </button>
      </div>
    );
  }
}

/* ------------------------------------------------------------------ */
/*  nav model                                                          */
/* ------------------------------------------------------------------ */

const NAV_MAIN = [
  { slug: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { slug: "findleads", label: "Find leads", icon: SearchCheck },
  { slug: "zybbleai", label: "Zybble AI", icon: Sparkles },
];
const NAV_DATA = [
  { slug: "leads", label: "Leads", icon: Users },
  { slug: "lists", label: "Lists", icon: FolderKanban },
  { slug: "searches", label: "Searches", icon: Radar, badge: true },
  { slug: "exports", label: "Exports", icon: FileDown },
];
const NAV_ACCOUNT = [
  { slug: "billing", label: "Billing", icon: CreditCard },
  { slug: "setting", label: "Settings", icon: Settings },
];

function NavLink({ slug, label, icon: Icon, active, badge }: { slug: string; label: string; icon: typeof Radar; active: boolean; badge: number }) {
  return (
    <a
      href={`#/${slug}`}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[13.5px] font-medium transition-all duration-200",
        active ? "bg-zest/10 text-zest" : "text-sage hover:bg-white/[0.04] hover:text-bone"
      )}
    >
      <Icon className="size-4.5 shrink-0" />
      {label}
      {badge > 0 && (
        <span className="ml-auto rounded-md bg-zest px-1.5 py-0.5 font-mono text-[9.5px] font-bold text-ink">{badge}</span>
      )}
    </a>
  );
}

function QuotaWidget() {
  const { plan, quota, status } = useWorkspace();

  if (status !== "signed_in") {
    return (
      <div className="block rounded-xl border border-line bg-white/[0.02] p-4">
        <p className="font-mono text-[10.5px] text-faint">quota loads with your workspace…</p>
      </div>
    );
  }

  const used = quota?.leads.used ?? 0;
  const included = quota?.leads.included ?? Number(plan?.leads_per_period ?? 0);
  const pct = included > 0 ? Math.min(100, Math.round((used / included) * 100)) : 0;

  return (
    <a href="#/billing" className="block rounded-xl border border-line bg-white/[0.02] p-4 transition-colors hover:border-zest/30">
      <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-faint">
        <span>{plan?.name ?? "Workspace"} quota</span>
        <span className="text-zest">{pct}%</span>
      </div>
      <div className="mt-2.5">
        <Meter value={used} max={Math.max(1, included)} />
      </div>
      <p className="mt-2 font-mono text-[10.5px] text-sage">
        {used.toLocaleString()} / {included.toLocaleString()} leads this cycle
      </p>
    </a>
  );
}

/** Notifications are read from the API; nothing here is seeded. */
function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const { data, reload, error } = useNotifications(8);
  const items = data?.items ?? [];
  const unread = data?.unread ?? 0;

  const markAll = async () => {
    try {
      await api.notifications.mark({ all: true, read: true });
      await reload();
    } catch (cause) {
      if (cause instanceof ApiError) console.warn(cause.message);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((value) => !value)}
        className="relative grid size-8 place-items-center rounded-full border border-line text-faint transition-colors hover:text-bone"
        aria-label="Notifications"
      >
        <Bell className="size-4" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-zest px-1 font-mono text-[9px] font-bold text-ink">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 overflow-hidden rounded-2xl border border-line-strong bg-graphite shadow-2xl">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="font-display text-[13px] font-semibold text-bone">Notifications</span>
            {unread > 0 && (
              <button onClick={() => void markAll()} className="font-mono text-[10.5px] text-zest hover:underline">
                mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 divide-y divide-line/60 overflow-y-auto">
            {error && <p className="px-4 py-3 font-mono text-[11px] text-amber">{error}</p>}
            {!error && items.length === 0 && <p className="px-4 py-6 text-center font-mono text-[11px] text-faint">Nothing yet — searches, exports and billing events land here.</p>}
            {items.map((item) => (
              <a
                key={item.id}
                href={item.link ? `#${item.link.replace(/^#/, "")}` : "#/dashboard"}
                onClick={() => setOpen(false)}
                className={cn("block px-4 py-3 transition-colors hover:bg-white/[0.03]", !item.read && "bg-zest/[0.05]")}
              >
                <p className="text-[12.5px] font-medium text-bone">{item.title}</p>
                {item.body && <p className="mt-0.5 line-clamp-2 text-[11.5px] text-sage">{item.body}</p>}
                <p className="mt-1 font-mono text-[10px] text-faint">{relTime(item.createdAt)}</p>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  shell                                                              */
/* ------------------------------------------------------------------ */

export function AppShell({ route, children }: { route: string; children: ReactNode }) {
  const [more, setMore] = useState(false);
  const { jobs } = useEngine();
  const { user, me, signOut } = useSession();
  const displayName = me?.profile?.full_name ?? user?.fullName ?? user?.email ?? "Your workspace";
  const planName = me?.plan?.name ?? "Workspace";
  const badges = initials(displayName);
  const liveCount = jobs.filter((j) => j.status === "running" || j.status === "queued").length;
  const isActive = (slug: string) => route === slug || route.startsWith(slug.replace(/s$/, "") + "/");

  const tab = (slug: string, label: string, Icon: typeof Radar) => (
    <a
      key={slug}
      href={`#/${slug}`}
      className={cn(
        "flex flex-1 flex-col items-center gap-1 py-2.5 font-mono text-[9.5px] uppercase tracking-wider transition-colors",
        isActive(slug) ? "text-zest" : "text-faint"
      )}
    >
      <Icon className="size-5" strokeWidth={isActive(slug) ? 2 : 1.6} />
      {label}
    </a>
  );

  return (
    <div className="min-h-screen bg-ink font-body text-bone antialiased">
      {/* ---------------- desktop sidebar ---------------- */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col border-r border-line bg-coal/60 backdrop-blur-xl lg:flex">
        <div className="flex h-16 items-center justify-between px-5">
          <a href="#/dashboard" aria-label="dashboard"><Logo /></a>
          <NotificationsBell />
        </div>
        <div className="flex-1 space-y-6 overflow-y-auto px-3.5 pb-4">
          <div>
            <p className="px-3 pb-2 font-mono text-[9.5px] uppercase tracking-[0.2em] text-faint">Workspace</p>
            <nav className="space-y-1">
              {NAV_MAIN.map((n) => (
                <NavLink key={n.slug} {...n} active={route.startsWith(n.slug)} badge={0} />
              ))}
            </nav>
          </div>
          <div>
            <p className="px-3 pb-2 font-mono text-[9.5px] uppercase tracking-[0.2em] text-faint">Data</p>
            <nav className="space-y-1">
              {NAV_DATA.map((n) => (
                <NavLink key={n.slug} {...n} active={route.startsWith(n.slug)} badge={n.badge ? liveCount : 0} />
              ))}
            </nav>
          </div>
          <div>
            <p className="px-3 pb-2 font-mono text-[9.5px] uppercase tracking-[0.2em] text-faint">Account</p>
            <nav className="space-y-1">
              {NAV_ACCOUNT.map((n) => (
                <NavLink key={n.slug} {...n} active={route.startsWith(n.slug) || (n.slug === "setting" && route.startsWith("settings"))} badge={0} />
              ))}
            </nav>
          </div>
        </div>
        <div className="space-y-3 border-t border-line p-3.5">
          <QuotaWidget />
          <div className="flex items-center gap-3 rounded-xl px-2 py-1.5">
            <span className="grid size-9 place-items-center rounded-lg border border-zest/25 bg-zest/[0.08] font-display text-xs font-bold text-zest">{badges}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-bone">{displayName}</p>
              <p className="truncate font-mono text-[10px] text-faint">{planName} plan</p>
            </div>
            <button
              onClick={() => void signOut()}
              aria-label="Sign out"
              className="grid size-8 place-items-center rounded-lg text-faint transition-colors hover:bg-white/[0.05] hover:text-bone"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ---------------- mobile top bar ---------------- */}
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-line bg-ink/85 px-4 backdrop-blur-xl lg:hidden">
        <a href="#/dashboard"><Logo className="scale-90" /></a>
        <div className="flex items-center gap-2.5">
          <a href="#/billing" className="flex items-center gap-2 rounded-full border border-line bg-coal px-3 py-1.5">
            <span className="relative flex size-1.5">
              <span className="absolute size-full animate-ping-soft rounded-full bg-zest" />
              <span className="relative size-1.5 rounded-full bg-zest" />
            </span>
            <span className="font-mono text-[10.5px] text-sage">
              {me?.quota ? `${me.quota.leads.remaining.toLocaleString()} left` : "quota"}
            </span>
          </a>
          <NotificationsBell />
          <span className="grid size-8 place-items-center rounded-full border border-zest/25 bg-zest/[0.08] font-display text-[11px] font-bold text-zest">{badges}</span>
        </div>
      </header>

      {/* ---------------- content ---------------- */}
      <main className="pb-28 pt-[76px] lg:pb-16 lg:pl-[248px] lg:pt-10">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-9">
          <PageErrorBoundary key={route}>{children}</PageErrorBoundary>
        </div>
      </main>

      {/* ---------------- mobile bottom nav ---------------- */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ink/92 backdrop-blur-xl lg:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="flex">
          {tab("dashboard", "Home", LayoutDashboard)}
          {tab("findleads", "Find", SearchCheck)}
          {tab("leads", "Leads", Users)}
          {tab("zybbleai", "AI", Sparkles)}
          <button
            onClick={() => setMore(true)}
            className={cn("flex flex-1 flex-col items-center gap-1 py-2.5 font-mono text-[9.5px] uppercase tracking-wider", more ? "text-zest" : "text-faint")}
          >
            <MoreHorizontal className="size-5" strokeWidth={1.6} />
            More
          </button>
        </div>
      </nav>

      {/* ---------------- more sheet ---------------- */}
      <AnimatePresence>
        {more && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[80] bg-ink/80 backdrop-blur-sm lg:hidden" onClick={() => setMore(false)}>
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-line-strong bg-graphite p-5"
              style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }}
            >
              <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line-strong" />
              <p className="mb-3 px-1 font-mono text-[10px] uppercase tracking-[0.2em] text-faint">Everything else</p>
              <QuotaWidget />
              <div className="mt-4 grid gap-1">
                {[...NAV_DATA.filter((n) => n.slug !== "leads"), ...NAV_ACCOUNT].map((n) => (
                  <a
                    key={n.slug}
                    href={`#/${n.slug}`}
                    onClick={() => setMore(false)}
                    className="flex items-center gap-3.5 rounded-xl px-3 py-3 text-[14px] font-medium text-bone transition-colors hover:bg-white/[0.04]"
                  >
                    <n.icon className="size-4.5 text-zest" />
                    {n.label}
                  </a>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

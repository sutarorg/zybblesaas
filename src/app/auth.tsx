import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  User,
} from "lucide-react";
import { Logo } from "../components/ui";
import { supabaseConfigured } from "../lib/supabase";
import { useSession } from "./session";
import { cn } from "../utils/cn";

/* ------------------------------ shared bits ------------------------------ */

const inputCls =
  "h-12 w-full rounded-xl border border-line bg-ink/60 pl-11 pr-4 text-sm text-bone placeholder:text-faint outline-none transition-colors focus:border-zest/50";

function AuthVisual() {
  return (
    <div className="always-dark relative hidden flex-col justify-between overflow-hidden border-l border-line bg-[#0b0e0c] p-10 lg:flex">
      <div className="pointer-events-none absolute inset-0 map-grid opacity-60" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="relative size-[420px]">
          {[100, 72, 46].map((s) => (
            <span key={s} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.07]" style={{ width: `${s}%`, height: `${s}%` }} />
          ))}
          <div className="absolute inset-0 animate-radar rounded-full" style={{ background: "conic-gradient(from 0deg, transparent 0deg, rgba(201,241,88,0.15) 42deg, rgba(201,241,88,0.4) 58deg, transparent 62deg)" }} />
          <span className="absolute left-1/2 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-zest shadow-[0_0_20px_rgba(201,241,88,0.9)]" />
        </div>
      </div>
      <div className="relative z-10">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-faint">zybble workspace</p>
        <h2 className="mt-4 max-w-sm font-display text-3xl font-bold leading-tight tracking-tight text-bone">
          The map is your pipeline. <span className="text-zest">Signed in, it fires hourly.</span>
        </h2>
      </div>
      <div className="relative z-10 grid grid-cols-3 gap-3">
        {[["Google Maps", "source"], ["36+", "fields/lead"], ["Async", "worker queue"]].map(([v, l]) => (
          <div key={l} className="rounded-xl border border-line bg-ink/60 px-4 py-3.5 backdrop-blur">
            <p className="font-display text-xl font-bold text-zest">{v}</p>
            <p className="mt-0.5 font-mono text-[9px] uppercase tracking-wider text-faint">{l}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function AuthLayout({ children, title, sub }: { children: ReactNode; title: string; sub: string }) {
  return (
    <div className="grid min-h-screen bg-ink font-body text-bone antialiased lg:grid-cols-2">
      <div className="flex flex-col">
        <div className="flex items-center justify-between px-5 pt-5 sm:px-8">
          <a href="#/"><Logo /></a>
          <a href="#/" className="inline-flex items-center gap-1.5 font-mono text-[11px] text-faint transition-colors hover:text-zest">
            <ArrowLeft className="size-3.5" /> back to site
          </a>
        </div>
        <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }} className="w-full max-w-md">
            <h1 className="font-display text-3xl font-bold tracking-tight text-bone">{title}</h1>
            <p className="mt-2 text-[13.5px] leading-relaxed text-sage">{sub}</p>
            {children}
          </motion.div>
        </div>
      </div>
      <AuthVisual />
    </div>
  );
}

function PasswordStrength({ password }: { password: string }) {
  const score =
    (password.length >= 12 ? 1 : 0) +
    (/[A-Z]/.test(password) ? 1 : 0) +
    (/\d/.test(password) ? 1 : 0) +
    (/[^A-Za-z0-9]/.test(password) ? 1 : 0);
  const labels = ["add 12+ chars", "weak", "okay", "strong", "fortress"];
  if (!password) return null;
  return (
    <div className="mt-2.5 flex items-center gap-3">
      <div className="flex flex-1 gap-1">
        {[0, 1, 2, 3].map((i) => (
          <motion.span key={i} initial={false} className={cn("h-1 flex-1 rounded-full transition-colors", i < score ? (score >= 3 ? "bg-zest" : "bg-amber") : "bg-white/[0.08]")} />
        ))}
      </div>
      <span className={cn("font-mono text-[10px]", score >= 3 ? "text-zest" : "text-amber")}>{labels[score]}</span>
    </div>
  );
}

function PasswordInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Lock className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(inputCls, "pr-11")}
      />
      <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-faint transition-colors hover:text-bone" aria-label="Toggle password">
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

function PrimaryAuthBtn({ label, busy }: { label: string; busy: boolean }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="group inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-zest font-display text-[15px] font-semibold text-ink transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : null}
      {busy ? "Please wait…" : label}
      {!busy && <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />}
    </button>
  );
}

function AuthError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber/40 bg-amber/10 px-4 py-3">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber" />
      <p className="text-[12.5px] leading-relaxed text-amber">{message}</p>
    </div>
  );
}

/** Shown when the deployment has no Supabase project configured. */
function UnconfiguredNotice() {
  if (supabaseConfigured) return null;
  return (
    <div className="mt-4 rounded-xl border border-amber/40 bg-amber/10 px-4 py-3 font-mono text-[11.5px] leading-relaxed text-amber">
      Authentication is not configured on this deployment. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (and the server keys on Vercel) before signing in.
    </div>
  );
}

/* ------------------------------ /signin ------------------------------ */

export function SignInPage() {
  const { signIn, status } = useSession();
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "signed_in") window.location.hash = "#/dashboard";
  }, [status]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await signIn(email, pass);
      window.location.hash = "#/dashboard";
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="Welcome back" sub="Sign in with the email and password of your Zybble workspace.">
      <UnconfiguredNotice />
      <form className="mt-8 space-y-4" onSubmit={submit}>
        <div className="relative">
          <Mail className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className={inputCls}
          />
        </div>
        <div>
          <PasswordInput value={pass} onChange={setPass} placeholder="Your password" />
        </div>
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] text-faint">sessions are refreshed automatically</span>
          <a href="#/forgotpassword" className="font-mono text-[11.5px] text-zest hover:underline">
            Forgot password?
          </a>
        </div>
        <PrimaryAuthBtn label="Sign in" busy={busy} />
      </form>

      <AuthError message={error} />

      <p className="mt-8 text-center text-[13px] text-sage">
        New to Zybble?{" "}
        <a href="#/signup" className="font-medium text-zest hover:underline">
          Create a free workspace →
        </a>
      </p>
      <div className="mt-6 flex items-center justify-center gap-2 font-mono text-[9.5px] uppercase tracking-[0.18em] text-faint">
        <ShieldCheck className="size-3.5 text-zest-dim" /> Supabase auth · httpOnly-safe PKCE flow
      </div>
    </AuthLayout>
  );
}

/* ------------------------------ /signup ------------------------------ */

export function SignUpPage() {
  const { signUp, status } = useSession();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkInbox, setCheckInbox] = useState(false);

  useEffect(() => {
    if (status === "signed_in") window.location.hash = "#/dashboard";
  }, [status]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || !accepted) return;
    setBusy(true);
    setError(null);
    try {
      const result = await signUp({ fullName: name, email, password: pass });
      if (result.needsEmailConfirmation) setCheckInbox(true);
      else window.location.hash = "#/dashboard";
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sign-up failed");
    } finally {
      setBusy(false);
    }
  };

  if (checkInbox) {
    return (
      <AuthLayout title="Confirm your email" sub="We sent a confirmation link — the workspace activates the moment you click it.">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mt-8 rounded-2xl border border-zest/40 bg-zest/[0.07] p-6 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-full border border-zest/40 bg-zest/10">
            <CheckCircle2 className="size-7 text-zest" />
          </span>
          <h2 className="mt-5 font-display text-xl font-bold text-bone">Check your inbox</h2>
          <p className="mt-2 font-mono text-[12px] leading-relaxed text-sage">
            confirmation link sent to <span className="text-zest">{email}</span>
            <br />
            the link signs you in automatically.
          </p>
          <a href="#/signin" className="mt-5 inline-block font-mono text-[11.5px] text-zest underline decoration-zest/40 underline-offset-4 hover:decoration-zest">
            back to sign in
          </a>
        </motion.div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Claim your free workspace" sub="One workspace, one email, no card. You start on Starter and can upgrade whenever it earns it.">
      <UnconfiguredNotice />
      <form className="mt-8 space-y-4" onSubmit={submit}>
        <div className="relative">
          <User className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className={inputCls} />
        </div>
        <div className="relative">
          <Mail className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className={inputCls} />
        </div>
        <div>
          <PasswordInput value={pass} onChange={setPass} placeholder="Create password (8+ characters)" />
          <PasswordStrength password={pass} />
        </div>
        <label className="flex items-start gap-2.5 text-[12px] leading-relaxed text-sage">
          <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-0.5 size-3.5 accent-[#c9f158]" />
          <span>
            I accept the{" "}
            <a href="#/terms" className="text-zest hover:underline">
              Terms
            </a>
            ,{" "}
            <a href="#/privacy" className="text-zest hover:underline">
              Privacy Policy
            </a>{" "}
            and the{" "}
            <a href="#/responsible-use" className="text-zest hover:underline">
              Responsible Use
            </a>{" "}
            rules.
          </span>
        </label>
        <PrimaryAuthBtn label="Create workspace" busy={busy} />
      </form>

      <AuthError message={error} />

      <div className="mt-6 rounded-2xl border border-zest/25 bg-zest/[0.05] p-4">
        <div className="flex items-center gap-2.5">
          <Sparkles className="size-4 text-zest" />
          <p className="font-display text-[13.5px] font-semibold text-bone">You start on Starter</p>
        </div>
        <p className="mt-1.5 pl-6 font-mono text-[11px] leading-relaxed text-sage">
          50 billable leads / cycle · email &amp; phone capture · CSV &amp; JSON export · unlimited lists
        </p>
      </div>
      <p className="mt-8 text-center text-[13px] text-sage">
        Already have a workspace?{" "}
        <a href="#/signin" className="font-medium text-zest hover:underline">
          Sign in →
        </a>
      </p>
    </AuthLayout>
  );
}

/* ------------------------------ /forgotpassword ------------------------------ */

export function ForgotPasswordPage() {
  const { requestPasswordReset } = useSession();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The reset email could not be sent");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="Reset access" sub="Enter the email on the workspace — Supabase sends the reset link.">
      <UnconfiguredNotice />
      <AnimatePresence mode="wait">
        {sent ? (
          <motion.div key="ok" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mt-8 rounded-2xl border border-zest/40 bg-zest/[0.07] p-6 text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-full border border-zest/40 bg-zest/10">
              <CheckCircle2 className="size-7 text-zest" />
            </span>
            <h2 className="mt-5 font-display text-xl font-bold text-bone">Check your inbox</h2>
            <p className="mt-2 font-mono text-[12px] leading-relaxed text-sage">
              if an account exists for <span className="text-zest">{email}</span> a reset link is on its way
              <br />
              check spam too — the link expires after a short window.
            </p>
            <button
              onClick={() => setSent(false)}
              className="mt-5 font-mono text-[11.5px] text-zest underline decoration-zest/40 underline-offset-4 hover:decoration-zest"
            >
              use a different email
            </button>
          </motion.div>
        ) : (
          <motion.form key="form" exit={{ opacity: 0, scale: 0.97 }} className="mt-8 space-y-4" onSubmit={submit}>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className={inputCls} />
            </div>
            <PrimaryAuthBtn label="Email me a reset link" busy={busy} />
          </motion.form>
        )}
      </AnimatePresence>
      <AuthError message={error} />
      <p className="mt-8 text-center text-[13px] text-sage">
        Remembered it after all?{" "}
        <a href="#/signin" className="font-medium text-zest hover:underline">
          Back to sign in →
        </a>
      </p>
    </AuthLayout>
  );
}

/* ------------------------------ /resetpassword ------------------------------ */

export function ResetPasswordPage() {
  const { status, updatePassword, user } = useSession();
  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const match = pass.length > 0 && pass === confirm;

  // A recovery link signs the visitor in with a short-lived session, so the
  // page can only change a password when there really is one.
  const hasRecoverySession = status === "signed_in" && Boolean(user);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!match || pass.length < 8 || busy) return;
    setBusy(true);
    setError(null);
    try {
      await updatePassword(pass);
      setDone(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The password could not be updated");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="Choose a new password" sub="This page only works from the reset link in your email.">
      <AnimatePresence mode="wait">
        {done ? (
          <motion.div key="ok" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mt-8 rounded-2xl border border-zest/40 bg-zest/[0.07] p-6 text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-full border border-zest/40 bg-zest/10">
              <Lock className="size-6 text-zest" />
            </span>
            <h2 className="mt-5 font-display text-xl font-bold text-bone">Password updated</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-sage">Use it the next time you sign in.</p>
            <a href="#/signin" className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-zest px-6 font-display text-sm font-semibold text-ink transition-transform hover:scale-[1.03] active:scale-95">
              Sign in with new password <ArrowRight className="size-4" />
            </a>
          </motion.div>
        ) : (
          <motion.form key="form" exit={{ opacity: 0, scale: 0.97 }} className="mt-8 space-y-4" onSubmit={submit}>
            {!hasRecoverySession && (
              <div className="rounded-xl border border-amber/40 bg-amber/10 px-4 py-3 text-[12.5px] leading-relaxed text-amber">
                No active reset link. Open the link from your email (or{" "}
                <a href="#/forgotpassword" className="underline">
                  request a new one
                </a>
                ) to change the password.
              </div>
            )}
            <div>
              <PasswordInput value={pass} onChange={setPass} placeholder="New password (8+ characters)" />
              <PasswordStrength password={pass} />
            </div>
            <div>
              <PasswordInput value={confirm} onChange={setConfirm} placeholder="Repeat new password" />
              {confirm.length > 0 && (
                <p className={cn("mt-2 font-mono text-[11px]", match ? "text-zest" : "text-amber")}>
                  {match ? "✓ passwords match" : "✗ passwords don't match yet"}
                </p>
              )}
            </div>
            <button
              type="submit"
              disabled={!match || pass.length < 8 || busy || !hasRecoverySession}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-zest font-display text-[15px] font-semibold text-ink transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              Update password <ArrowRight className="size-4" />
            </button>
          </motion.form>
        )}
      </AnimatePresence>
      <AuthError message={error} />
    </AuthLayout>
  );
}

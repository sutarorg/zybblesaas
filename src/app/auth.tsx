import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  User,
} from "lucide-react";
import { Logo } from "../components/ui";
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
        {[["200M+", "businesses"], ["36", "fields/lead"], ["120/min", "engine speed"]].map(([v, l]) => (
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

function PrimaryAuthBtn({ label }: { label: string }) {
  return (
    <button type="submit" className="group inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-zest font-display text-[15px] font-semibold text-ink transition-transform hover:scale-[1.02] active:scale-[0.98]">
      {label}
      <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}

/* ------------------------------ /signin ------------------------------ */

export function SignInPage() {
  const [email, setEmail] = useState("mara@zybble.io");
  const [pass, setPass] = useState("");
  return (
    <AuthLayout title="Welcome back" sub="Demo build — any email and password walk right in.">
      <form
        className="mt-8 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          sessionStorage.setItem("zybble_session", "1");
          window.location.hash = "#/dashboard";
        }}
      >
        <div className="relative">
          <Mail className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className={inputCls} />
        </div>
        <div>
          <PasswordInput value={pass} onChange={setPass} placeholder="Your password" />
        </div>
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-[12.5px] text-sage">
            <input type="checkbox" defaultChecked className="size-3.5 accent-[#c9f158]" /> Remember me
          </label>
          <a href="#/forgotpassword" className="font-mono text-[11.5px] text-zest hover:underline">Forgot password?</a>
        </div>
        <PrimaryAuthBtn label="Sign in" />
      </form>

      <div className="my-6 flex items-center gap-3">
        <span className="h-px flex-1 bg-line" />
        <span className="font-mono text-[10px] uppercase tracking-widest text-faint">or continue with</span>
        <span className="h-px flex-1 bg-line" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {["Google", "GitHub"].map((p) => (
          <button key={p} onClick={() => (window.location.hash = "#/dashboard")} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-line font-display text-[13px] font-medium text-sage transition-colors hover:border-zest/30 hover:text-bone">
            <span className="grid size-4.5 place-items-center rounded-full border border-line font-mono text-[9px] text-zest">{p[0]}</span>
            {p}
          </button>
        ))}
      </div>
      <p className="mt-8 text-center text-[13px] text-sage">
        New to Zybble?{" "}
        <a href="#/signup" className="font-medium text-zest hover:underline">Create a free workspace →</a>
      </p>
      <div className="mt-6 flex items-center justify-center gap-2 font-mono text-[9.5px] uppercase tracking-[0.18em] text-faint">
        <ShieldCheck className="size-3.5 text-zest-dim" /> SCA enforced · encrypted at rest
      </div>
    </AuthLayout>
  );
}

/* ------------------------------ /signup ------------------------------ */

export function SignUpPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [ok, setOk] = useState(true);
  return (
    <AuthLayout title="Claim your 50 free leads" sub="One workspace, one email, no card. Upgrades exist for when it becomes a habit.">
      <form
        className="mt-8 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!ok) return;
          sessionStorage.setItem("zybble_session", "1");
          window.location.hash = "#/dashboard";
        }}
      >
        <div className="relative">
          <User className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className={inputCls} />
        </div>
        <div className="relative">
          <Mail className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className={inputCls} />
        </div>
        <div>
          <PasswordInput value={pass} onChange={setPass} placeholder="Create password (12+ chars)" />
          <PasswordStrength password={pass} />
        </div>
        <label className="flex items-start gap-2.5 text-[12px] leading-relaxed text-sage">
          <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} className="mt-0.5 size-3.5 accent-[#c9f158]" />
          <span>
            I accept the <a href="#/terms" className="text-zest hover:underline">Terms</a>,{" "}
            <a href="#/privacy" className="text-zest hover:underline">Privacy Policy</a> and the{" "}
            <a href="#/responsible-use" className="text-zest hover:underline">Responsible Use</a> rules.
          </span>
        </label>
        <PrimaryAuthBtn label="Create workspace" />
      </form>

      <div className="mt-6 rounded-2xl border border-zest/25 bg-zest/[0.05] p-4">
        <div className="flex items-center gap-2.5">
          <Sparkles className="size-4 text-zest" />
          <p className="font-display text-[13.5px] font-semibold text-bone">You're starting on Starter — free forever</p>
        </div>
        <p className="mt-1.5 pl-6 font-mono text-[11px] leading-relaxed text-sage">
          50 enriched leads / mo · email & phone · CSV export · unlimited lists
        </p>
      </div>
      <p className="mt-8 text-center text-[13px] text-sage">
        Already have a workspace?{" "}
        <a href="#/signin" className="font-medium text-zest hover:underline">Sign in →</a>
      </p>
    </AuthLayout>
  );
}

/* ------------------------------ /forgotpassword ------------------------------ */

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  return (
    <AuthLayout title="Reset access" sub="Enter the email on the workspace — a reset link lands in seconds.">
      <AnimatePresence mode="wait">
        {sent ? (
          <motion.div key="ok" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mt-8 rounded-2xl border border-zest/40 bg-zest/[0.07] p-6 text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-full border border-zest/40 bg-zest/10">
              <CheckCircle2 className="size-7 text-zest" />
            </span>
            <h2 className="mt-5 font-display text-xl font-bold text-bone">Check your inbox</h2>
            <p className="mt-2 font-mono text-[12px] leading-relaxed text-sage">
              reset link sent to <span className="text-zest">{email || "your email"}</span>
              <br />valid for 30 minutes — check spam too.
            </p>
            <button onClick={() => setSent(false)} className="mt-5 font-mono text-[11.5px] text-zest underline decoration-zest/40 underline-offset-4 hover:decoration-zest">
              resend email
            </button>
          </motion.div>
        ) : (
          <motion.form key="form" exit={{ opacity: 0, scale: 0.97 }} className="mt-8 space-y-4" onSubmit={(e) => { e.preventDefault(); setSent(true); }}>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className={inputCls} />
            </div>
            <PrimaryAuthBtn label="Email me a reset link" />
          </motion.form>
        )}
      </AnimatePresence>
      <p className="mt-8 text-center text-[13px] text-sage">
        Remembered it after all?{" "}
        <a href="#/signin" className="font-medium text-zest hover:underline">Back to sign in →</a>
      </p>
    </AuthLayout>
  );
}

/* ------------------------------ /resetpassword ------------------------------ */

export function ResetPasswordPage() {
  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const match = pass.length > 0 && pass === confirm;
  return (
    <AuthLayout title="Choose a new password" sub="Token verified — it expires 30 minutes after the email landed.">
      <AnimatePresence mode="wait">
        {done ? (
          <motion.div key="ok" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mt-8 rounded-2xl border border-zest/40 bg-zest/[0.07] p-6 text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-full border border-zest/40 bg-zest/10">
              <Lock className="size-6 text-zest" />
            </span>
            <h2 className="mt-5 font-display text-xl font-bold text-bone">Password updated</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-sage">All other sessions were signed out as a precaution.</p>
            <a href="#/signin" className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-zest px-6 font-display text-sm font-semibold text-ink transition-transform hover:scale-[1.03] active:scale-95">
              Sign in with new password <ArrowRight className="size-4" />
            </a>
          </motion.div>
        ) : (
          <motion.form
            key="form"
            exit={{ opacity: 0, scale: 0.97 }}
            className="mt-8 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (match && pass.length >= 8) setDone(true);
            }}
          >
            <div>
              <PasswordInput value={pass} onChange={setPass} placeholder="New password (12+ chars)" />
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
              disabled={!match || pass.length < 8}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-zest font-display text-[15px] font-semibold text-ink transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Update password <ArrowRight className="size-4" />
            </button>
          </motion.form>
        )}
      </AnimatePresence>
    </AuthLayout>
  );
}

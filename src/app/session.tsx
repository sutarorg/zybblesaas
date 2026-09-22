import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api, ApiError, type MePayload } from "../lib/api";
import { authRedirectTo, supabase, supabaseConfigured } from "../lib/supabase";

/**
 * Session + workspace context.
 *
 * Authentication is real Supabase Auth: the browser signs in, receives a JWT,
 * and every API call proves that JWT to the server. The workspace, plan and
 * entitlements come from `/api/me`, which derives them from the token — the
 * browser never picks its own workspace id.
 */

export type SessionStatus = "loading" | "signed_out" | "signed_in" | "unconfigured";

export type AuthUser = { id: string; email: string; fullName: string | null };

type SessionContextValue = {
  status: SessionStatus;
  user: AuthUser | null;
  me: MePayload | null;
  /** Set when Supabase env vars are missing, or when /api/me failed. */
  error: string | null;
  refresh: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: { fullName: string; email: string; password: string }) => Promise<{ needsEmailConfirmation: boolean }>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  acceptInvite: (token: string) => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>(supabaseConfigured ? "loading" : "unconfigured");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [me, setMe] = useState<MePayload | null>(null);
  const [error, setError] = useState<string | null>(
    supabaseConfigured
      ? null
      : "Supabase is not configured for this build. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY, then redeploy — sign-in cannot work without them.",
  );
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const loadMe = useCallback(async () => {
    try {
      const payload = await api.me();
      if (!mounted.current) return;
      setMe(payload);
      setError(null);
    } catch (cause) {
      if (!mounted.current) return;
      setMe(null);
      setError(cause instanceof ApiError ? cause.message : "Could not load your workspace");
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      setUser(null);
      setMe(null);
      setStatus("signed_out");
      return;
    }
    setUser({
      id: data.session.user.id,
      email: data.session.user.email ?? "",
      fullName: (data.session.user.user_metadata?.full_name as string | undefined) ?? null,
    });
    setStatus("signed_in");
    await loadMe();
  }, [loadMe]);

  useEffect(() => {
    if (!supabase) return;

    let cancelled = false;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session) {
        setUser({
          id: data.session.user.id,
          email: data.session.user.email ?? "",
          fullName: (data.session.user.user_metadata?.full_name as string | undefined) ?? null,
        });
        setStatus("signed_in");
        await loadMe();
      } else {
        setStatus("signed_out");
      }
    })();

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (cancelled) return;
      if (event === "SIGNED_OUT") {
        setUser(null);
        setMe(null);
        setStatus("signed_out");
        return;
      }
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        void refresh();
      }
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, [loadMe, refresh]);

  // A pending team invite in the URL is accepted right after sign-in.
  useEffect(() => {
    if (status !== "signed_in" || !me) return;
    const hash = window.location.hash;
    const match = /[?&]invite=([^&]+)/.exec(hash);
    if (!match) return;
    const token = decodeURIComponent(match[1]);
    window.history.replaceState(null, "", hash.replace(/[?&]invite=[^&]+/, ""));
    void api.settings
      .acceptInvite(token)
      .then(() => loadMe())
      .catch(() => undefined);
  }, [loadMe, me, status]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      if (!supabase) throw new Error("Sign-in is unavailable: Supabase is not configured for this deployment.");
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (signInError) throw new Error(signInError.message);
      await refresh();
    },
    [refresh],
  );

  const signUp = useCallback(
    async ({ fullName, email, password }: { fullName: string; email: string; password: string }) => {
      if (!supabase) throw new Error("Sign-up is unavailable: Supabase is not configured for this deployment.");
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: fullName.trim() || null },
          emailRedirectTo: authRedirectTo("/dashboard"),
        },
      });
      if (signUpError) throw new Error(signUpError.message);
      if (data.session) {
        await refresh();
        return { needsEmailConfirmation: false };
      }
      return { needsEmailConfirmation: true };
    },
    [refresh],
  );

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    setMe(null);
    setStatus("signed_out");
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    if (!supabase) throw new Error("Password reset is unavailable: Supabase is not configured for this deployment.");
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: authRedirectTo("/resetpassword"),
    });
    if (resetError) throw new Error(resetError.message);
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    if (!supabase) throw new Error("Password updates are unavailable: Supabase is not configured for this deployment.");
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) throw new Error(updateError.message);
  }, []);

  const acceptInvite = useCallback(
    async (token: string) => {
      await api.settings.acceptInvite(token);
      await loadMe();
    },
    [loadMe],
  );

  const value = useMemo<SessionContextValue>(
    () => ({ status, user, me, error, refresh, signIn, signUp, signOut, requestPasswordReset, updatePassword, acceptInvite }),
    [acceptInvite, error, me, refresh, requestPasswordReset, signIn, signOut, signUp, status, updatePassword, user],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession must be used inside <SessionProvider>");
  return context;
}

/** Convenience for screens that need a workspace/plan and nothing else. */
export function useWorkspace() {
  const { me, status } = useSession();
  return { workspace: me?.workspace ?? null, plan: me?.plan ?? null, entitlements: me?.entitlements ?? null, quota: me?.quota ?? null, status };
}

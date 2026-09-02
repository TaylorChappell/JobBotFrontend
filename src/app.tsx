import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { Workspace } from "@/workspace";
import { apiFetch, clearSession, getSession, setSession } from "@/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type AccountUser = { id: string; displayName: string; email: string };

export function App() {
  const [user, setUser] = useState<AccountUser | null>(null);
  const [checking, setChecking] = useState(Boolean(getSession()));

  const check = useCallback(async () => {
    if (!getSession()) { setUser(null); setChecking(false); return; }
    try {
      const response = await apiFetch("/api/auth/me");
      if (!response.ok) throw new Error();
      setUser((await response.json() as { user: AccountUser }).user);
    } catch { clearSession(); setUser(null); }
    finally { setChecking(false); }
  }, []);

  useEffect(() => { void check(); const listener = () => void check(); window.addEventListener("applydesk-auth", listener); return () => window.removeEventListener("applydesk-auth", listener); }, [check]);

  if (checking) return <div className="grid min-h-screen place-items-center bg-[#f4f6f8]"><LoaderCircle className="size-6 animate-spin text-cyan-600" /></div>;
  if (!user) return <AuthScreen onAuthenticated={(token, nextUser) => { setSession(token); setUser(nextUser); }} />;
  return <Workspace currentUser={user} onLogout={async () => { await apiFetch("/api/auth/logout", { method: "POST" }).catch(() => null); clearSession(); setUser(null); }} />;
}

function AuthScreen({ onAuthenticated }: { onAuthenticated: (token: string, user: AccountUser) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await apiFetch(`/api/auth/${mode}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ displayName: String(form.get("displayName") || ""), email: String(form.get("email") || ""), password: String(form.get("password") || "") }) });
      const payload = await response.json() as { error?: string; token?: string; user?: AccountUser };
      if (!response.ok || !payload.token || !payload.user) throw new Error(payload.error || "Authentication failed.");
      onAuthenticated(payload.token, payload.user);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Authentication failed."); }
    finally { setBusy(false); }
  }

  return <main className="grid min-h-screen place-items-center bg-[#f4f6f8] p-4"><section className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"><h1 className="text-2xl font-semibold tracking-tight text-slate-950">{mode === "login" ? "Sign in" : "Create account"}</h1><form onSubmit={submit} className="mt-6 space-y-4">{mode === "register" && <AuthField label="Name"><Input name="displayName" required minLength={2} autoComplete="name" className="h-11 border-slate-200 bg-slate-50 text-slate-950 placeholder:text-slate-400 focus-visible:bg-white" /></AuthField>}<AuthField label="Email"><Input name="email" type="email" required autoComplete="email" className="h-11 border-slate-200 bg-slate-50 text-slate-950 placeholder:text-slate-400 focus-visible:bg-white" /></AuthField><AuthField label="Password"><Input name="password" type="password" required minLength={6} autoComplete={mode === "login" ? "current-password" : "new-password"} className="h-11 border-slate-200 bg-slate-50 text-slate-950 focus-visible:bg-white" /></AuthField>{error && <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}<Button type="submit" className="h-11 w-full gap-2 bg-[#0b1220] text-white hover:bg-[#162238]" disabled={busy}>{busy ? "Working…" : mode === "login" ? "Sign in" : "Create account"}<ArrowRight className="size-4" /></Button></form><button type="button" className="mt-5 w-full text-center text-sm font-medium text-cyan-700 hover:text-cyan-900" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>{mode === "login" ? "Create an account" : "Sign in instead"}</button></section></main>;
}

function AuthField({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block space-y-2"><span className="text-sm font-medium text-slate-700">{label}</span>{children}</label>; }

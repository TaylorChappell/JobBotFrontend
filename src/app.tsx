import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ArrowRight, BriefcaseBusiness, LoaderCircle, LockKeyhole, ShieldCheck } from "lucide-react";
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

  if (checking) return <div className="grid min-h-screen place-items-center bg-[#090d16] text-white"><LoaderCircle className="size-6 animate-spin text-cyan-300" /></div>;
  if (!user) return <AuthScreen onAuthenticated={(token, nextUser) => { setSession(token); setUser(nextUser); }} />;
  return <Workspace currentUser={user} onLogout={async () => { await apiFetch("/api/auth/logout", { method: "POST" }).catch(() => null); clearSession(); setUser(null); }} />;
}

const logoUrl = `${import.meta.env.BASE_URL}jobbot-logo.png`;

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

  return <main className="grid min-h-screen bg-[#090d16] lg:grid-cols-[1.05fr_.95fr]"><section className="relative hidden overflow-hidden border-r border-white/10 p-12 lg:flex lg:flex-col lg:justify-between"><div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(34,211,238,.17),transparent_34%),radial-gradient(circle_at_80%_70%,rgba(59,130,246,.16),transparent_35%)]" /><div className="relative flex items-center gap-3"><img src={logoUrl} alt="" className="size-14 object-contain" /><span className="text-xl font-semibold text-white">JobBot</span></div><div className="relative max-w-xl"><p className="text-sm font-semibold uppercase tracking-[.18em] text-cyan-300">Private job workspace</p><h1 className="mt-4 text-5xl font-semibold leading-[1.08] tracking-tight text-white">Apply for the right roles without losing control.</h1><p className="mt-5 max-w-lg text-lg leading-8 text-slate-400">Separate CVs, strict matching rules, review queues, direct-email applications and employer replies in one place.</p><div className="mt-9 grid gap-3 sm:grid-cols-2"><Feature icon={ShieldCheck} text="Private personal workspace" /><Feature icon={BriefcaseBusiness} text="Exact job-track rules" /></div></div><p className="relative text-xs text-slate-600">Your password is hashed. CVs, profile data and connector tokens are encrypted server-side.</p></section><section className="flex items-center justify-center p-6 sm:p-10"><div className="w-full max-w-md"><div className="mb-8 flex items-center gap-3 lg:hidden"><img src={logoUrl} alt="" className="size-12 object-contain" /><span className="text-lg font-semibold text-white">JobBot</span></div><div className="rounded-2xl border border-white/10 bg-white/[.055] p-6 shadow-2xl backdrop-blur sm:p-8"><span className="grid size-11 place-items-center rounded-xl bg-white/8 text-cyan-300"><LockKeyhole className="size-5" /></span><h2 className="mt-5 text-2xl font-semibold text-white">{mode === "login" ? "Sign in" : "Create your account"}</h2><p className="mt-2 text-sm leading-6 text-slate-400">{mode === "login" ? "Open your private application workspace." : "Use at least 12 characters for your password."}</p><form onSubmit={submit} className="mt-6 space-y-4">{mode === "register" && <AuthField label="Name"><Input name="displayName" required minLength={2} autoComplete="name" className="h-11 border-white/10 bg-white/5 text-white placeholder:text-slate-600" /></AuthField>}<AuthField label="Email"><Input name="email" type="email" required autoComplete="email" className="h-11 border-white/10 bg-white/5 text-white placeholder:text-slate-600" /></AuthField><AuthField label="Password"><Input name="password" type="password" required minLength={12} autoComplete={mode === "login" ? "current-password" : "new-password"} className="h-11 border-white/10 bg-white/5 text-white" /></AuthField>{error && <p className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-300">{error}</p>}<Button type="submit" className="h-11 w-full gap-2 bg-cyan-400 text-slate-950 hover:bg-cyan-300" disabled={busy}>{busy ? "Working…" : mode === "login" ? "Sign in" : "Create account"}<ArrowRight className="size-4" /></Button></form><button className="mt-5 w-full text-center text-sm text-slate-400 hover:text-white" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>{mode === "login" ? "No account? Create one" : "Already have an account? Sign in"}</button></div></div></section></main>;
}

function AuthField({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block space-y-2"><span className="text-sm font-medium text-slate-300">{label}</span>{children}</label>; }
function Feature({ icon: Icon, text }: { icon: typeof ShieldCheck; text: string }) { return <div className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[.035] p-3 text-sm text-slate-300"><Icon className="size-4 text-cyan-300" />{text}</div>; }

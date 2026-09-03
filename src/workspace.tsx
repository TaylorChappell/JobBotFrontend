"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  ArrowUpRight, BriefcaseBusiness, Building2, Check, ChevronRight, CircleAlert, CircleCheck, Clock3,
  Database, FileCheck2, FileText, Gauge, Inbox, LayoutDashboard, Link2, LoaderCircle, Mail, MapPin, Navigation,
  LogOut, MoreHorizontal, Plus, Power, RefreshCw, Search, Send, ShieldCheck, Sparkles, Tags, Trash2,
  UploadCloud, UserRound, WandSparkles, X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarHeader, SidebarInset,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger,
} from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { apiFetch } from "@/api";
import type { AccountUser } from "@/app";

type View = "dashboard" | "jobs" | "review" | "applications" | "documents" | "tracks" | "answers" | "inbox" | "integrations" | "profile";
type Profile = {
  firstName: string; lastName: string; phone: string; addressLine1: string; addressLine2: string; townCity: string; postcode: string;
  rightToWork: string; availability: string; transportMode: "public_transport" | "car" | "either"; maxTravelMinutes: number;
  minimumSalary: number | null; portfolioUrl: string; linkedInUrl: string; githubUrl: string; skills: string[];
};
type Track = {
  id: string; name: string; color: string; mode: "auto" | "review" | "discover"; includeTitles: string[]; excludeTitles: string[];
  jobTypes: string[]; maxTravelMinutes: number; minimumSalary: number | null; remotePreference: string; cvDocumentId: string | null;
  coverLetterDocumentId: string | null; active: boolean;
};
type Job = {
  id: string; title: string; company: string; location: string; description: string; source: string; url: string; trackId: string | null;
  fitScore: number; confidence: "high" | "medium" | "low"; reasons: string[]; rejectionReasons: string[];
  applicationMode: "email" | "supported" | "assisted" | "external"; status: string; employmentType: string | null;
  salaryMin: number | null; salaryMax: number | null; discoveredAt: number;
  distanceMiles: number | null; travelMinutes: number | null; recommendedTransport: string | null;
  walkMinutes: number | null; busMinutes: number | null; travelCheckStatus: string; travelCheckReason: string | null; travelCheckedAt: number | null;
  metadata?: { salaryPeriod?: "hour" | "day" | "week" | "year"; salaryMinExact?: number | null; salaryMaxExact?: number | null };
};
type DocumentRow = { id: string; name: string; kind: "cv" | "cover_letter"; contentType: string; size: number; version: number; createdAt: number };
type Application = { id: string; jobId: string; status: string; channel: string; submittedAt: number | null; updatedAt: number; confirmationRef: string | null };
type Answer = { id: string; question: string; answer: string; scope: string; sensitive: boolean; trackId: string | null; updatedAt: number };
type EmailThread = { id: string; gmailThreadId: string; subject: string; correspondent: string; snippet: string; classification: string; unread: boolean; lastMessageAt: number };
type Integration = { provider: string; name: string; ready: boolean; connected: boolean; detail: string };
type Bootstrap = {
  user: { displayName: string; email: string; onboardingComplete: boolean; jobSearchEnabled: boolean; lastJobSearchAt: number | null; nextJobSearchAt: number | null; lastJobSearchMessage: string | null }; profile: Profile; tracks: Track[]; documents: DocumentRow[];
  jobs: Job[]; applications: Application[]; answers: Answer[]; emailThreads: EmailThread[]; integrations: Integration[];
};

const nav: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "dashboard", label: "Overview", icon: LayoutDashboard }, { id: "jobs", label: "Jobs", icon: BriefcaseBusiness },
  { id: "review", label: "Review queue", icon: WandSparkles }, { id: "applications", label: "Applications", icon: Send },
  { id: "inbox", label: "Inbox", icon: Inbox }, { id: "documents", label: "Documents", icon: FileText },
  { id: "tracks", label: "Job tracks", icon: Tags }, { id: "answers", label: "Answer bank", icon: Database },
  { id: "integrations", label: "Integrations", icon: Link2 }, { id: "profile", label: "Profile", icon: UserRound },
];

const emptyTrack: Omit<Track, "id"> = {
  name: "", color: "#38bdf8", mode: "review", includeTitles: [], excludeTitles: [], jobTypes: ["part-time"],
  maxTravelMinutes: 45, minimumSalary: null, remotePreference: "on-site, hybrid or remote", cvDocumentId: null,
  coverLetterDocumentId: null, active: true,
};

const logoUrl = `${import.meta.env.BASE_URL}jobbot-logo.png`;
const availabilitySuggestions = ["Available weekday evenings", "Available weekends", "Available immediately", "Available up to 20 hours per week", "Available during school and college holidays", "Flexible around shift patterns"];
const rightToWorkSuggestions = ["British citizen", "Indefinite leave to remain", "Graduate visa", "Student visa with permitted hours", "Other UK work permission"];
const includeTitleSuggestions = ["retail assistant", "shop assistant", "waiter", "barista", "crew member", "junior game developer", "Unity developer", "IT apprentice", "software apprentice"];
const excludeTitleSuggestions = ["manager", "senior", "lead", "director", "commission only"];
const jobTypeSuggestions = ["part-time", "full-time", "apprenticeship", "entry level", "temporary", "weekend", "evening shifts", "remote"];
const workplaceSuggestions = ["on-site", "hybrid", "remote", "on-site or hybrid", "on-site, hybrid or remote"];

export function Workspace({ currentUser, onLogout }: { currentUser: AccountUser; onLogout: () => void }) {
  const [view, setView] = useState<View>("dashboard");
  const [data, setData] = useState<Bootstrap | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("recommended");
  const [manualOpen, setManualOpen] = useState(false);
  const [trackOpen, setTrackOpen] = useState(false);
  const [answerOpen, setAnswerOpen] = useState(false);
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const response = await apiFetch("/api/bootstrap", { cache: "no-store" });
      if (!response.ok) throw new Error((await response.json()).error || "Could not load your workspace.");
      setData(await response.json() as Bootstrap);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not load your workspace."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") void load(true); };
    const interval = window.setInterval(refresh, 60_000);
    document.addEventListener("visibilitychange", refresh);
    return () => { window.clearInterval(interval); document.removeEventListener("visibilitychange", refresh); };
  }, [load]);

  async function action(key: string, url: string, options: RequestInit, success: string, reload = true) {
    setBusy(key);
    try {
      const response = await apiFetch(url, options);
      const payload = await response.json().catch(() => ({})) as { error?: string; openUrl?: string };
      if (!response.ok) throw new Error(payload.error || "That action could not be completed.");
      if (payload.openUrl) window.open(payload.openUrl, "_blank", "noopener,noreferrer");
      toast.success(success);
      if (reload) await load(true);
      return payload;
    } catch (error) { toast.error(error instanceof Error ? error.message : "That action could not be completed."); return null; }
    finally { setBusy(null); }
  }

  async function scan() {
    setBusy("scan");
    try {
      const response = await apiFetch("/api/jobs/discover", { method: "POST" });
      const result = await response.json() as { error?: string; stored?: number };
      if (!response.ok) throw new Error(result.error || "Discovery failed.");
      const auto = await apiFetch("/api/applications/auto", { method: "POST" }).then((item) => item.json()) as { submitted?: number };
      toast.success(`${result.stored ?? 0} new jobs added${auto.submitted ? ` · ${auto.submitted} auto-applied` : ""}`);
      await load(true);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Discovery failed."); }
    finally { setBusy(null); }
  }

  async function toggleContinuousSearch() {
    const enabling = !data?.user.jobSearchEnabled;
    await action("search-toggle", "/api/search-automation", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ enabled: enabling }) }, enabling ? "Continuous job search turned on" : "Continuous job search turned off");
  }

  const filteredJobs = useMemo(() => {
    const text = query.toLowerCase();
    return (data?.jobs ?? []).filter((job) => {
      const matchesText = !text || `${job.title} ${job.company} ${job.location}`.toLowerCase().includes(text);
      return matchesText && (statusFilter === "all" || job.status === statusFilter);
    });
  }, [data?.jobs, query, statusFilter]);

  if (loading && !data) return <LoadingWorkspace />;
  if (!data) return <LoadFailure onRetry={() => void load()} />;

  const reviewCount = data.jobs.filter((job) => job.status === "recommended").length;
  const unreadCount = data.emailThreads.filter((thread) => thread.unread).length;

  return (
    <SidebarProvider defaultOpen>
      <Sidebar collapsible="offcanvas" className="border-r border-white/8 bg-[#090d16] text-slate-300">
        <SidebarHeader className="px-4 pb-4 pt-5">
          <button className="flex items-center gap-3 text-left" onClick={() => setView("dashboard")}>
            <img src={logoUrl} alt="" className="size-12 object-contain" />
            <span><span className="block text-base font-semibold tracking-tight text-white">JobBot</span><span className="block text-xs text-slate-500">Private workspace</span></span>
          </button>
        </SidebarHeader>
        <SidebarContent className="px-2"><SidebarGroup><SidebarGroupContent><SidebarMenu className="gap-1">
          {nav.map((item) => <SidebarMenuItem key={item.id}><SidebarMenuButton isActive={view === item.id} tooltip={item.label} onClick={() => setView(item.id)} className="h-10 rounded-xl px-3 text-sm text-slate-400 hover:bg-white/6 hover:text-white data-[active=true]:bg-cyan-400/12 data-[active=true]:text-cyan-300"><item.icon className="size-[18px]" /><span>{item.label}</span>{item.id === "review" && reviewCount > 0 && <span className="ml-auto rounded-full bg-cyan-300 px-2 py-0.5 text-[11px] font-bold text-[#061018]">{reviewCount}</span>}{item.id === "inbox" && unreadCount > 0 && <span className="ml-auto size-2 rounded-full bg-emerald-400" />}</SidebarMenuButton></SidebarMenuItem>)}
        </SidebarMenu></SidebarGroupContent></SidebarGroup></SidebarContent>
        <SidebarFooter className="m-3 rounded-2xl border border-white/8 bg-white/[.035] p-3"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-full bg-gradient-to-br from-cyan-300 to-blue-500 text-sm font-bold text-slate-950">{initials(data.user.displayName || currentUser.displayName)}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-white">{data.user.displayName || currentUser.displayName}</span><span className="block truncate text-xs text-slate-500">{data.user.email || currentUser.email}</span></span><button type="button" aria-label="Sign out" title="Sign out" onClick={onLogout} className="grid size-8 place-items-center rounded-lg text-slate-500 transition hover:bg-white/8 hover:text-white"><LogOut className="size-4" /></button></div></SidebarFooter>
      </Sidebar>

      <SidebarInset className="min-w-0 bg-[#f4f6f8]">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200/80 bg-white/88 px-4 backdrop-blur-xl md:px-7">
          <SidebarTrigger className="md:hidden" /><div className="hidden h-5 w-px bg-slate-200 md:block" />
          <div className="relative max-w-xl flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search jobs, companies or locations" className="h-10 border-slate-200 bg-slate-50 pl-9 shadow-none focus-visible:bg-white" /></div>
          <Button variant="outline" size="sm" className="hidden h-10 gap-2 border-slate-200 bg-white sm:flex" onClick={() => void load(true)} disabled={busy !== null}><RefreshCw className="size-4" />Refresh</Button>
          <Button variant="outline" size="sm" aria-pressed={data.user.jobSearchEnabled} title={data.user.jobSearchEnabled ? "Searching now and every 6 hours" : "Run now and every 6 hours"} className={`h-10 gap-2 px-3 ${data.user.jobSearchEnabled ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100" : "border-slate-200 bg-white text-slate-700"}`} onClick={() => void toggleContinuousSearch()} disabled={busy !== null}><Power className={`size-4 ${data.user.jobSearchEnabled ? "text-emerald-600" : "text-slate-500"}`} />{busy === "search-toggle" ? "Updating..." : data.user.jobSearchEnabled ? "Turn off search" : "Turn on search"}</Button>
          <Button size="sm" className="h-10 gap-2 bg-[#0b1220] px-4 text-white hover:bg-[#162238]" onClick={() => void scan()} disabled={busy !== null}><Sparkles className="size-4 text-cyan-300" />{busy === "scan" ? "Scanning…" : "Scan now"}</Button>
        </header>

        <main className="mx-auto w-full max-w-[1500px] p-4 md:p-7">
          <ViewHeader view={view} reviewCount={reviewCount} onAddJob={() => setManualOpen(true)} onAddTrack={() => { setEditingTrack(null); setTrackOpen(true); }} onAddAnswer={() => setAnswerOpen(true)} />
          {view === "dashboard" && <Dashboard data={data} setView={setView} onJobAction={action} busy={busy} />}
          {view === "jobs" && <JobsView jobs={filteredJobs} allJobs={data.jobs} tracks={data.tracks} statusFilter={statusFilter} setStatusFilter={setStatusFilter} onAction={action} busy={busy} />}
          {view === "review" && <ReviewView jobs={filteredJobs.filter((job) => job.status === "recommended")} tracks={data.tracks} onAction={action} busy={busy} />}
          {view === "applications" && <ApplicationsView applications={data.applications} jobs={data.jobs} onAction={action} busy={busy} />}
          {view === "documents" && <DocumentsView documents={data.documents} tracks={data.tracks} onUploaded={() => void load(true)} onAction={action} busy={busy} />}
          {view === "tracks" && <TracksView tracks={data.tracks} documents={data.documents} onEdit={(track) => { setEditingTrack(track); setTrackOpen(true); }} onAction={action} busy={busy} />}
          {view === "answers" && <AnswersView answers={data.answers} tracks={data.tracks} onAdd={() => setAnswerOpen(true)} onAction={action} busy={busy} />}
          {view === "inbox" && <InboxView threads={data.emailThreads} gmail={data.integrations.find((item) => item.provider === "gmail")} onAction={action} busy={busy} />}
          {view === "integrations" && <IntegrationsView integrations={data.integrations} onAction={action} busy={busy} />}
          {view === "profile" && <ProfileView profile={data.profile} onSaved={() => void load(true)} />}
        </main>
      </SidebarInset>

      {manualOpen && <ManualJobDialog open onOpenChange={setManualOpen} onSaved={() => { setManualOpen(false); void load(true); }} />}
      {trackOpen && <TrackDialog open onOpenChange={setTrackOpen} track={editingTrack} documents={data.documents} onSaved={() => { setTrackOpen(false); void load(true); }} />}
      {answerOpen && <AnswerDialog open onOpenChange={setAnswerOpen} tracks={data.tracks} onSaved={() => { setAnswerOpen(false); void load(true); }} />}
      <Toaster position="bottom-right" richColors />
    </SidebarProvider>
  );
}

function LoadingWorkspace() { return <div className="grid min-h-screen place-items-center bg-[#090d16] text-white"><div className="flex items-center gap-3"><LoaderCircle className="size-5 animate-spin text-cyan-300" /><span className="text-sm text-slate-300">Opening your workspace…</span></div></div>; }
function LoadFailure({ onRetry }: { onRetry: () => void }) { return <div className="grid min-h-screen place-items-center bg-slate-100 p-6"><div className="max-w-md rounded-2xl border bg-white p-8 text-center shadow-sm"><CircleAlert className="mx-auto size-8 text-rose-500" /><h1 className="mt-4 text-xl font-semibold">JobBot could not open</h1><p className="mt-2 text-sm text-slate-500">The private workspace or database is temporarily unavailable.</p><Button className="mt-6" onClick={onRetry}>Try again</Button></div></div>; }
function initials(value: string) { return value.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "AD"; }
function jobSalary(job: Job) {
  const minimum = job.metadata?.salaryMinExact ?? job.salaryMin;
  const maximum = job.metadata?.salaryMaxExact ?? job.salaryMax;
  if (!minimum && !maximum) return "Not stated";
  const format = (value: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: Number.isInteger(value) ? 0 : 2, maximumFractionDigits: 2 }).format(value);
  const amount = minimum && maximum && minimum !== maximum ? `${format(minimum)} to ${format(maximum)}` : format(minimum || maximum || 0);
  const suffix = job.metadata?.salaryPeriod === "hour" ? " per hour" : job.metadata?.salaryPeriod === "day" ? " per day" : job.metadata?.salaryPeriod === "week" ? " per week" : " per year";
  return `${amount}${suffix}`;
}
function jobTravel(job: Job) {
  if (job.travelCheckStatus !== "verified") return job.travelCheckReason ? `Travel not verified · ${job.travelCheckReason}` : "Travel not verified";
  if (job.travelMinutes == null || !job.recommendedTransport) return "Travel not verified";
  if (job.recommendedTransport === "Remote") return "Remote, no journey";
  const distance = job.distanceMiles == null ? null : `${job.distanceMiles < 10 ? job.distanceMiles.toFixed(1) : Math.round(job.distanceMiles)} mi`;
  if (job.recommendedTransport === "Bus") return [distance, job.walkMinutes == null ? null : `${job.walkMinutes} min walk`, `${job.busMinutes ?? job.travelMinutes} min by bus`].filter(Boolean).join(" · ");
  return [distance, `${job.walkMinutes ?? job.travelMinutes} min walk`].filter(Boolean).join(" · ");
}
function date(value: number | null) { return value ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(value) : "Not set"; }
function trackFor(tracks: Track[], id: string | null) { return tracks.find((track) => track.id === id); }
function jobFor(jobs: Job[], id: string) { return jobs.find((job) => job.id === id); }

function ViewHeader({ view, reviewCount, onAddJob, onAddTrack, onAddAnswer }: { view: View; reviewCount: number; onAddJob: () => void; onAddTrack: () => void; onAddAnswer: () => void }) {
  const copy: Record<View, [string, string]> = {
    dashboard: ["Good afternoon", "Your application pipeline at a glance."], jobs: ["Job feed", "Every discovered vacancy, scored against your rules."],
    review: ["Review queue", `${reviewCount} ${reviewCount === 1 ? "job needs" : "jobs need"} a decision.`], applications: ["Applications", "Exact records of what was prepared and submitted."],
    documents: ["Documents", "Encrypted CV and cover-letter versions."], tracks: ["Job tracks", "Different rules and documents for different work."],
    answers: ["Answer bank", "Verified answers reused only in the scopes you choose."], inbox: ["Application inbox", "Employer replies linked back to your pipeline."],
    integrations: ["Integrations", "Connect the sources that power discovery and replies."], profile: ["Personal profile", "The factual information used to complete applications."],
  };
  const cta = view === "jobs" ? ["Add job", onAddJob] as const : view === "tracks" ? ["New track", onAddTrack] as const : view === "answers" ? ["Save answer", onAddAnswer] as const : null;
  return <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><p className="mb-1 text-xs font-semibold uppercase tracking-[.16em] text-cyan-700">JobBot</p><h1 className="text-2xl font-semibold tracking-tight text-slate-950 md:text-[30px]">{copy[view][0]}</h1><p className="mt-1 text-sm text-slate-500 md:text-base">{copy[view][1]}</p></div>{cta && <Button onClick={cta[1]} className="gap-2 bg-cyan-500 text-slate-950 hover:bg-cyan-400"><Plus className="size-4" />{cta[0]}</Button>}</div>;
}

type ActionFn = (key: string, url: string, options: RequestInit, success: string, reload?: boolean) => Promise<{ error?: string; openUrl?: string } | null>;

function Dashboard({ data, setView, onJobAction, busy }: { data: Bootstrap; setView: (view: View) => void; onJobAction: ActionFn; busy: string | null }) {
  const submitted = data.applications.filter((item) => item.status === "submitted").length;
  const replies = data.applications.filter((item) => ["reply", "interview"].includes(item.status)).length;
  const interviews = data.applications.filter((item) => item.status === "interview").length;
  const review = data.jobs.filter((item) => item.status === "recommended");
  const readinessParts = [data.user.onboardingComplete, data.documents.some((item) => item.kind === "cv"), data.tracks.some((item) => item.cvDocumentId), data.integrations.some((item) => ["reed", "adzuna", "jooble"].includes(item.provider) && item.connected), data.integrations.some((item) => item.provider === "google_routes" && item.connected), data.integrations.some((item) => item.provider === "gmail" && item.connected)];
  const readiness = Math.round(readinessParts.filter(Boolean).length / readinessParts.length * 100);
  const needsSetup = readiness < 100;
  return <div className="space-y-6">
    {needsSetup && <section className="overflow-hidden rounded-2xl border border-cyan-200 bg-gradient-to-r from-cyan-50 via-white to-blue-50 p-5 shadow-sm"><div className="flex flex-col justify-between gap-5 md:flex-row md:items-center"><div className="flex gap-4"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-cyan-500 text-slate-950"><Gauge className="size-5" /></span><div><h2 className="font-semibold text-slate-950">Finish setup to start applying</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">Complete your profile, upload a CV, assign it to a track, connect a job source and configure Google Routes for verified travel. Gmail is only required for reply tracking and email applications.</p></div></div><div className="min-w-52"><div className="mb-2 flex justify-between text-xs font-medium text-slate-500"><span>Readiness</span><span>{readiness}%</span></div><Progress value={readiness} className="h-2 bg-cyan-100" /><Button variant="link" className="mt-2 h-auto p-0 text-cyan-800" onClick={() => setView("profile")}>Continue setup <ChevronRight className="size-4" /></Button></div></div></section>}

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Metric title="Applications sent" value={submitted} change={submitted ? "Tracked with evidence" : "Ready when you are"} icon={Send} tone="cyan" />
      <Metric title="Needs review" value={review.length} change={review.length ? "Decisions waiting" : "Queue is clear"} icon={WandSparkles} tone="violet" />
      <Metric title="Employer replies" value={replies} change={data.emailThreads.length ? `${data.emailThreads.length} relevant threads` : "Connect Gmail to track"} icon={Mail} tone="emerald" />
      <Metric title="Interviews" value={interviews} change={interviews ? "Keep momentum" : "No interviews logged yet"} icon={CircleCheck} tone="amber" />
    </section>

    <section>
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 p-5"><div><h2 className="font-semibold text-slate-950">Best matches to review</h2><p className="mt-1 text-sm text-slate-500">High-confidence jobs are shown first.</p></div><Button variant="ghost" size="sm" className="gap-1 text-slate-600" onClick={() => setView("review")}>Open queue <ArrowUpRight className="size-4" /></Button></div>
        <div className="divide-y divide-slate-100">{review.length ? review.slice(0, 6).map((job) => <CompactJob key={job.id} job={job} track={trackFor(data.tracks, job.trackId)} onAction={onJobAction} busy={busy} />) : <EmptyState icon={BriefcaseBusiness} title="No jobs waiting" copy="Configure Google Routes, then run a scan after connecting Reed, Adzuna or Jooble, or add a vacancy manually." />}</div>
      </div>
    </section>
  </div>;
}

function Metric({ title, value, change, icon: Icon, tone }: { title: string; value: number; change: string; icon: typeof Send; tone: "cyan" | "violet" | "emerald" | "amber" }) {
  const styles = { cyan: "bg-cyan-50 text-cyan-700", violet: "bg-violet-50 text-violet-700", emerald: "bg-emerald-50 text-emerald-700", amber: "bg-amber-50 text-amber-700" };
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><div><p className="text-sm font-medium text-slate-500">{title}</p><p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{value}</p></div><span className={`grid size-10 place-items-center rounded-xl ${styles[tone]}`}><Icon className="size-5" /></span></div><p className="mt-4 text-xs font-medium text-slate-500">{change}</p></div>;
}

function CompactJob({ job, track, onAction, busy }: { job: Job; track?: Track; onAction: ActionFn; busy: string | null }) {
  const travel = jobTravel(job);
  return <div className="group flex flex-col gap-4 p-5 transition hover:bg-slate-50/70 sm:flex-row sm:items-center"><Score value={job.fitScore} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-slate-950">{job.title}</h3>{job.applicationMode === "email" && <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">Auto-capable</Badge>}</div><p className="mt-1 text-sm text-slate-500">{job.company} · {job.location}</p>{travel && <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-cyan-700"><Navigation className="size-3.5" />{travel}</p>}<div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">{track && <span className="rounded-full bg-slate-100 px-2.5 py-1"><i className="mr-1.5 inline-block size-1.5 rounded-full align-middle" style={{ background: track.color }} />{track.name}</span>}{job.reasons.slice(0, 1).map((reason) => <span key={reason} className="rounded-full bg-slate-100 px-2.5 py-1">{reason}</span>)}</div></div><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => void onAction(`discard-${job.id}`, `/api/jobs/${job.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "discarded" }) }, "Job discarded")} disabled={busy !== null}><X className="size-4" /></Button><Button size="sm" className="gap-2 bg-[#0b1220] text-white hover:bg-[#162238]" onClick={() => void onAction(`prepare-${job.id}`, "/api/applications", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jobId: job.id, action: "prepare" }) }, "Application prepared")} disabled={busy !== null}><Check className="size-4" />Approve</Button></div></div>;
}

function Score({ value }: { value: number }) { return <div className="relative grid size-12 shrink-0 place-items-center rounded-full bg-slate-100"><svg className="absolute inset-0 size-12 -rotate-90" viewBox="0 0 48 48"><circle cx="24" cy="24" r="20" fill="none" stroke="#e2e8f0" strokeWidth="3" /><circle cx="24" cy="24" r="20" fill="none" stroke={value >= 85 ? "#06b6d4" : value >= 60 ? "#8b5cf6" : "#94a3b8"} strokeWidth="3" strokeLinecap="round" strokeDasharray={`${value * 1.256} 126`} /></svg><span className="text-xs font-bold text-slate-800">{value}</span></div>; }

function rejectionCategory(reason: string) {
  if (reason.startsWith("Role level is")) return "Seniority is outside your target";
  if (reason.startsWith("Requires at least")) return "Experience requirement is too high";
  if (reason.startsWith("Estimated journey is")) return "Journey exceeds your maximum";
  if (reason.startsWith("No requested title")) return "No requested title or job type matched";
  if (reason.startsWith("Salary is below")) return "Salary is below your minimum";
  if (reason.startsWith("Excluded term")) return "A hard exclusion matched";
  if (reason.startsWith("Risk flag")) return "A job safety rule was triggered";
  if (/travel|route|bus|postcode/i.test(reason)) return "Travel could not be verified";
  return reason;
}

function JobsView({ jobs, allJobs, tracks, statusFilter, setStatusFilter, onAction, busy }: { jobs: Job[]; allJobs: Job[]; tracks: Track[]; statusFilter: string; setStatusFilter: (value: string) => void; onAction: ActionFn; busy: string | null }) {
  const statuses = ["recommended", "all", "approved", "applied", "discarded"];
  const discarded = allJobs.filter((job) => job.status === "discarded");
  const recommendedCount = allJobs.filter((job) => job.status === "recommended").length;
  const reasonCounts = new Map<string, number>();
  for (const job of discarded) {
    const reasons = job.rejectionReasons.length ? job.rejectionReasons : job.travelCheckReason ? [job.travelCheckReason] : ["Fit score was below the recommendation threshold"];
    for (const reason of new Set(reasons.map(rejectionCategory))) reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
  }
  const topReasons = [...reasonCounts].sort((a, b) => b[1] - a[1]).slice(0, 5);
  return <div className="space-y-4"><div className="flex flex-wrap gap-2">{statuses.map((status) => { const count = status === "all" ? allJobs.length : allJobs.filter((job) => job.status === status).length; return <button key={status} onClick={() => setStatusFilter(status)} className={`rounded-full border px-3.5 py-2 text-sm font-medium capitalize transition ${statusFilter === status ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}>{status} <span className="ml-1 opacity-70">{count}</span></button>; })}</div>{statusFilter === "recommended" && recommendedCount === 0 && discarded.length > 0 && <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><div className="flex gap-3"><CircleAlert className="mt-0.5 size-5 shrink-0 text-amber-700" /><div className="min-w-0 flex-1"><h2 className="font-semibold text-amber-950">No jobs passed your matching rules</h2><p className="mt-1 text-sm leading-6 text-amber-900/75">The scanner found jobs, but rejected them for the reasons below.</p><ul className="mt-3 grid gap-2 sm:grid-cols-2">{topReasons.map(([reason, count]) => <li key={reason} className="flex items-center justify-between gap-3 rounded-xl border border-amber-200/70 bg-white/70 px-3 py-2 text-sm text-amber-950"><span>{reason}</span><span className="shrink-0 font-semibold">{count}</span></li>)}</ul><Button variant="outline" className="mt-4 border-amber-300 bg-white text-amber-900 hover:bg-amber-100" onClick={() => setStatusFilter("discarded")}>View rejected jobs</Button></div></div></section>}<div className="grid gap-4 xl:grid-cols-2">{jobs.length ? jobs.map((job) => <JobCard key={job.id} job={job} track={trackFor(tracks, job.trackId)} onAction={onAction} busy={busy} />) : !(statusFilter === "recommended" && recommendedCount === 0 && discarded.length > 0) && <div className="col-span-full rounded-2xl border border-slate-200 bg-white"><EmptyState icon={Search} title="No jobs match" copy="Change the filter, run a scan or add a vacancy manually." /></div>}</div></div>;
}

function ReviewView({ jobs, tracks, onAction, busy }: { jobs: Job[]; tracks: Track[]; onAction: ActionFn; busy: string | null }) {
  return <div className="grid gap-4 xl:grid-cols-2">{jobs.length ? jobs.sort((a, b) => b.fitScore - a.fitScore).map((job) => <JobCard key={job.id} job={job} track={trackFor(tracks, job.trackId)} onAction={onAction} busy={busy} review />) : <div className="col-span-full rounded-2xl border border-slate-200 bg-white"><EmptyState icon={CircleCheck} title="Review queue clear" copy="There are no undecided jobs. Run a scan to look for new matches." /></div>}</div>;
}

function JobCard({ job, track, onAction, busy, review = false }: { job: Job; track?: Track; onAction: ActionFn; busy: string | null; review?: boolean }) {
  const travel = jobTravel(job);
  return <article className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><div className="flex items-start gap-4"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600"><Building2 className="size-5" /></span><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><div><h2 className="line-clamp-2 font-semibold leading-6 text-slate-950">{job.title}</h2><p className="mt-1 text-sm font-medium text-slate-600">{job.company}</p></div><Score value={job.fitScore} /></div><div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500"><span className="flex items-center gap-1.5"><MapPin className="size-3.5" />{job.location}</span>{job.employmentType && <span className="flex items-center gap-1.5"><Clock3 className="size-3.5" />{job.employmentType}</span>}<span>{jobSalary(job)}</span></div></div></div>
    {travel && <div className="mt-4 flex items-center gap-2 rounded-xl border border-cyan-100 bg-cyan-50 px-3 py-2 text-sm font-medium text-cyan-900"><Navigation className="size-4 shrink-0 text-cyan-600" /><span>{travel}</span></div>}
    <div className="mt-4 flex flex-wrap gap-2">{track && <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600"><i className="mr-1.5 size-1.5 rounded-full" style={{ background: track.color }} />{track.name}</Badge>}<Badge variant="outline" className="border-slate-200 bg-slate-50 capitalize text-slate-600">{job.source}</Badge>{job.applicationMode === "email" && <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">Direct email</Badge>}</div>
    {job.rejectionReasons.length ? <div className="mt-4 rounded-xl border border-rose-100 bg-rose-50 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-rose-500">Why it did not match</p><ul className="mt-2 space-y-1.5">{job.rejectionReasons.map((reason) => <li key={reason} className="flex gap-2 text-sm text-rose-800"><CircleAlert className="mt-0.5 size-3.5 shrink-0" />{reason}</li>)}</ul></div> : <div className="mt-4 rounded-xl bg-slate-50 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Why it matched</p><ul className="mt-2 space-y-1.5">{job.reasons.length ? job.reasons.slice(0, 3).map((reason) => <li key={reason} className="flex gap-2 text-sm text-slate-600"><Check className="mt-0.5 size-3.5 shrink-0 text-cyan-600" />{reason}</li>) : <li className="text-sm text-slate-500">Fit score was below the recommendation threshold.</li>}</ul></div>}
    <div className="mt-auto flex items-center justify-between gap-3 pt-5"><Button variant="ghost" size="sm" className="gap-1.5 text-slate-500" onClick={() => window.open(job.url, "_blank", "noopener,noreferrer")}>View listing <ArrowUpRight className="size-4" /></Button><div className="flex gap-2">{review && <Button variant="outline" size="sm" onClick={() => void onAction(`discard-${job.id}`, `/api/jobs/${job.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "discarded" }) }, "Job discarded")} disabled={busy !== null}>Discard</Button>}<Button size="sm" className="bg-[#0b1220] text-white hover:bg-[#162238]" onClick={() => void onAction(`prepare-${job.id}`, "/api/applications", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jobId: job.id, action: "prepare" }) }, "Application prepared")} disabled={busy !== null}>{busy === `prepare-${job.id}` ? "Preparing…" : "Approve"}</Button></div></div>
  </article>;
}

function ApplicationsView({ applications, jobs, onAction, busy }: { applications: Application[]; jobs: Job[]; onAction: ActionFn; busy: string | null }) {
  return <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><Table><TableHeader><TableRow className="bg-slate-50/70 hover:bg-slate-50/70"><TableHead>Position</TableHead><TableHead>Status</TableHead><TableHead className="hidden md:table-cell">Channel</TableHead><TableHead className="hidden lg:table-cell">Updated</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader><TableBody>{applications.length ? applications.map((application) => { const job = jobFor(jobs, application.jobId); return <TableRow key={application.id}><TableCell><div className="font-medium text-slate-900">{job?.title ?? "Deleted job"}</div><div className="mt-1 text-xs text-slate-500">{job?.company ?? "Unknown employer"}</div></TableCell><TableCell><StatusBadge status={application.status} /></TableCell><TableCell className="hidden capitalize text-slate-500 md:table-cell">{application.channel}</TableCell><TableCell className="hidden text-slate-500 lg:table-cell">{date(application.updatedAt)}</TableCell><TableCell className="text-right"><div className="flex justify-end gap-2">{application.status === "ready" && <Button size="sm" className="gap-2 bg-cyan-500 text-slate-950 hover:bg-cyan-400" onClick={() => void onAction(`submit-${application.id}`, "/api/applications", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jobId: application.jobId, action: "submit" }) }, application.channel === "email" ? "Application sent" : "Employer application opened")} disabled={busy !== null}>{busy === `submit-${application.id}` ? "Working…" : application.channel === "email" ? "Send" : "Open form"}<ArrowUpRight className="size-4" /></Button>}{application.status !== "ready" && job && <Button variant="ghost" size="sm" onClick={() => window.open(job.url, "_blank", "noopener,noreferrer")}><ArrowUpRight className="size-4" /></Button>}</div></TableCell></TableRow>; }) : <TableRow><TableCell colSpan={5} className="p-0"><EmptyState icon={Send} title="No applications yet" copy="Approve a matched job to prepare its application package." /></TableCell></TableRow>}</TableBody></Table></div>;
}

function StatusBadge({ status }: { status: string }) {
  const style = status === "submitted" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : status === "interview" ? "bg-violet-50 text-violet-700 border-violet-200" : status === "rejected" || status === "failed" ? "bg-rose-50 text-rose-700 border-rose-200" : status === "reply" ? "bg-cyan-50 text-cyan-700 border-cyan-200" : "bg-amber-50 text-amber-700 border-amber-200";
  return <Badge variant="outline" className={`capitalize ${style}`}>{status}</Badge>;
}

function DocumentsView({ documents, tracks, onUploaded, onAction, busy }: { documents: DocumentRow[]; tracks: Track[]; onUploaded: () => void; onAction: ActionFn; busy: string | null }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<"cv" | "cover_letter">("cv");
  const [uploading, setUploading] = useState(false);
  async function upload(file: File) {
    setUploading(true);
    try {
      const form = new FormData(); form.append("file", file); form.append("kind", kind);
      const response = await apiFetch("/api/documents", { method: "POST", body: form });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Upload failed.");
      toast.success(`${kind === "cv" ? "CV" : "Cover letter"} uploaded securely`); onUploaded();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Upload failed."); }
    finally { setUploading(false); if (inputRef.current) inputRef.current.value = ""; }
  }
  async function download(document: DocumentRow) {
    try {
      const response = await apiFetch(`/api/documents/${document.id}/download`);
      if (!response.ok) throw new Error("Download failed.");
      const url = URL.createObjectURL(await response.blob());
      const link = window.document.createElement("a"); link.href = url; link.download = document.name; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Download failed."); }
  }
  return <div className="grid gap-6 xl:grid-cols-[.8fr_1.2fr]"><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-semibold text-slate-950">Upload a document</h2><p className="mt-1 text-sm text-slate-500">Files are encrypted before private storage.</p><div className="mt-5 grid grid-cols-2 gap-2"><button className={`rounded-xl border px-3 py-3 text-sm font-medium ${kind === "cv" ? "border-cyan-400 bg-cyan-50 text-cyan-800" : "border-slate-200 text-slate-600"}`} onClick={() => setKind("cv")}>CV</button><button className={`rounded-xl border px-3 py-3 text-sm font-medium ${kind === "cover_letter" ? "border-cyan-400 bg-cyan-50 text-cyan-800" : "border-slate-200 text-slate-600"}`} onClick={() => setKind("cover_letter")}>Cover letter</button></div><button className="mt-4 flex min-h-52 w-full flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 text-center transition hover:border-cyan-400 hover:bg-cyan-50/40" onClick={() => inputRef.current?.click()} disabled={uploading}><span className="grid size-12 place-items-center rounded-full bg-white shadow-sm"><UploadCloud className="size-5 text-cyan-600" /></span><span className="mt-4 font-medium text-slate-800">{uploading ? "Encrypting and uploading…" : "Choose PDF, DOCX or text"}</span><span className="mt-1 text-xs text-slate-500">Maximum 8 MB</span></button><input ref={inputRef} type="file" className="hidden" accept=".pdf,.docx,.txt" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} /></section>
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 p-5"><h2 className="font-semibold text-slate-950">Document library</h2><p className="mt-1 text-sm text-slate-500">Assign documents to a job track before submitting.</p></div><div className="divide-y divide-slate-100">{documents.length ? documents.map((document) => { const uses = tracks.filter((track) => track.cvDocumentId === document.id || track.coverLetterDocumentId === document.id); return <div key={document.id} className="flex items-center gap-4 p-5"><span className={`grid size-11 shrink-0 place-items-center rounded-xl ${document.kind === "cv" ? "bg-cyan-50 text-cyan-700" : "bg-violet-50 text-violet-700"}`}><FileCheck2 className="size-5" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate font-medium text-slate-900">{document.name}</p><Badge variant="outline" className="text-[11px]">v{document.version}</Badge></div><p className="mt-1 text-xs text-slate-500">{document.kind === "cv" ? "CV" : "Cover letter"} · {(document.size / 1024).toFixed(0)} KB · {date(document.createdAt)}</p>{uses.length > 0 && <p className="mt-1 text-xs text-cyan-700">Used by {uses.map((track) => track.name).join(", ")}</p>}</div><div className="flex gap-1"><Button variant="ghost" size="sm" onClick={() => void download(document)}><ArrowUpRight className="size-4" /></Button><Button variant="ghost" size="sm" className="text-slate-400 hover:text-rose-600" onClick={() => void onAction(`delete-doc-${document.id}`, `/api/documents/${document.id}`, { method: "DELETE" }, "Document removed")} disabled={busy !== null}><Trash2 className="size-4" /></Button></div></div>; }) : <EmptyState icon={FileText} title="No documents uploaded" copy="Upload at least one CV, then assign it to the correct job track." />}</div></section></div>;
}

function TracksView({ tracks, documents, onEdit, onAction, busy }: { tracks: Track[]; documents: DocumentRow[]; onEdit: (track: Track) => void; onAction: ActionFn; busy: string | null }) {
  return <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">{tracks.map((track) => { const cv = documents.find((item) => item.id === track.cvDocumentId); const cover = documents.find((item) => item.id === track.coverLetterDocumentId); return <article key={track.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><span className="grid size-11 place-items-center rounded-xl text-white" style={{ background: track.color }}><Tags className="size-5" /></span><div className="flex items-center gap-2"><Badge variant="outline" className={track.active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "text-slate-500"}>{track.active ? "Active" : "Paused"}</Badge><Button variant="ghost" size="sm" onClick={() => onEdit(track)}><MoreHorizontal className="size-4" /></Button></div></div><h2 className="mt-4 font-semibold text-slate-950">{track.name}</h2><p className="mt-1 text-sm capitalize text-slate-500">{track.mode === "auto" ? "Automatic at 90%+ confidence" : track.mode === "review" ? "Review before applying" : "Discovery only"}</p><div className="mt-4 flex flex-wrap gap-1.5">{track.includeTitles.slice(0, 4).map((title) => <span key={title} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">{title}</span>)}{track.includeTitles.length > 4 && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-500">+{track.includeTitles.length - 4}</span>}</div><dl className="mt-5 space-y-3 border-t border-slate-100 pt-4 text-sm"><div className="flex justify-between gap-4"><dt className="text-slate-500">Maximum journey</dt><dd className="font-medium text-slate-800">{track.maxTravelMinutes} min</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-500">CV</dt><dd className={`truncate font-medium ${cv ? "text-slate-800" : "text-amber-700"}`}>{cv?.name ?? "Not assigned"}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-500">Cover letter</dt><dd className="truncate font-medium text-slate-800">{cover?.name ?? "Optional"}</dd></div></dl><div className="mt-5 flex gap-2"><Button variant="outline" className="flex-1" onClick={() => onEdit(track)}>Edit rules</Button><Button variant="ghost" className="text-slate-400 hover:text-rose-600" onClick={() => void onAction(`delete-track-${track.id}`, `/api/tracks/${track.id}`, { method: "DELETE" }, "Track removed")} disabled={busy !== null}><Trash2 className="size-4" /></Button></div></article>; })}</div>;
}

function AnswersView({ answers, tracks, onAdd, onAction, busy }: { answers: Answer[]; tracks: Track[]; onAdd: () => void; onAction: ActionFn; busy: string | null }) {
  return <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><Table><TableHeader><TableRow className="bg-slate-50/70 hover:bg-slate-50/70"><TableHead>Question</TableHead><TableHead>Saved answer</TableHead><TableHead className="hidden md:table-cell">Scope</TableHead><TableHead className="w-16" /></TableRow></TableHeader><TableBody>{answers.length ? answers.map((answer) => <TableRow key={answer.id}><TableCell className="max-w-sm font-medium text-slate-900">{answer.question}</TableCell><TableCell className="max-w-sm truncate text-slate-500">{answer.sensitive ? <span className="inline-flex items-center gap-1.5"><ShieldCheck className="size-4 text-emerald-600" />Saved securely</span> : answer.answer}</TableCell><TableCell className="hidden md:table-cell"><Badge variant="outline">{answer.scope === "track" ? trackFor(tracks, answer.trackId)?.name ?? "Track" : answer.scope}</Badge></TableCell><TableCell><Button variant="ghost" size="sm" className="text-slate-400 hover:text-rose-600" onClick={() => void onAction(`delete-answer-${answer.id}`, `/api/answers/${answer.id}`, { method: "DELETE" }, "Answer removed")} disabled={busy !== null}><Trash2 className="size-4" /></Button></TableCell></TableRow>) : <TableRow><TableCell colSpan={4} className="p-0"><EmptyState icon={Database} title="No saved answers" copy="Save a verified answer after an application asks something new." action="Save your first answer" onAction={onAdd} /></TableCell></TableRow>}</TableBody></Table></div>;
}

function InboxView({ threads, gmail, onAction, busy }: { threads: EmailThread[]; gmail?: Integration; onAction: ActionFn; busy: string | null }) {
  const [replying, setReplying] = useState<EmailThread | null>(null);
  if (!gmail?.connected) {
    return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="grid gap-8 p-7 lg:grid-cols-[1fr_.7fr] lg:items-center"><div><span className="grid size-12 place-items-center rounded-2xl bg-red-50 text-red-600"><Mail className="size-6" /></span><h2 className="mt-5 text-xl font-semibold text-slate-950">Connect Gmail to see employer replies</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">JobBot reads only relevant application messages and can send applications you explicitly approve. Google access can be revoked at any time.</p><div className="mt-5 flex flex-wrap gap-3">{gmail?.ready ? <Button className="gap-2 bg-[#0b1220] text-white hover:bg-[#162238]" onClick={() => void beginGmailConnection()}><Link2 className="size-4" />Connect Gmail</Button> : <Button disabled>Google credentials required</Button>}</div></div><div className="rounded-2xl border border-slate-200 bg-slate-50 p-5"><h3 className="text-sm font-semibold text-slate-900">Permissions used</h3><ul className="mt-4 space-y-3 text-sm text-slate-600"><li className="flex gap-2"><Check className="mt-0.5 size-4 text-emerald-600" />Read recent job-related messages</li><li className="flex gap-2"><Check className="mt-0.5 size-4 text-emerald-600" />Send approved applications and replies</li><li className="flex gap-2"><ShieldCheck className="mt-0.5 size-4 text-cyan-700" />Tokens stored with application-level encryption</li></ul></div></div></section>;
  }

  return <><section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5"><div><h2 className="font-semibold text-slate-950">Relevant Gmail threads</h2><p className="mt-1 text-sm text-slate-500">Automatically synced every 5 minutes. Applications, replies and interview messages from the last 90 days appear here.</p></div><Button variant="outline" className="gap-2" disabled={busy !== null} onClick={() => void onAction("gmail-sync", "/api/connectors/gmail/sync", { method: "POST" }, "Gmail synced")}><RefreshCw className={`size-4 ${busy === "gmail-sync" ? "animate-spin" : ""}`} />Sync now</Button></div><div className="divide-y divide-slate-100">{threads.length ? threads.map((thread) => <article key={thread.id} className="flex gap-4 p-5 transition hover:bg-slate-50/70"><span className={`mt-1 size-2.5 shrink-0 rounded-full ${thread.unread ? "bg-cyan-500" : "bg-slate-200"}`} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><h3 className="truncate font-medium text-slate-900">{thread.subject}</h3><p className="mt-1 truncate text-sm text-slate-500">{thread.correspondent}</p></div><div className="flex items-center gap-2"><StatusBadge status={thread.classification} /><span className="text-xs text-slate-400">{date(thread.lastMessageAt)}</span></div></div><p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">{thread.snippet}</p><div className="mt-3 flex gap-3"><Button size="sm" variant="outline" onClick={() => setReplying(thread)}>Reply here</Button><Button variant="link" className="h-9 p-0 text-cyan-700" onClick={() => window.open(`https://mail.google.com/mail/u/0/#inbox/${encodeURIComponent(thread.gmailThreadId)}`, "_blank", "noopener,noreferrer")}>Open in Gmail <ArrowUpRight className="size-4" /></Button></div></div></article>) : <EmptyState icon={Inbox} title="No relevant messages yet" copy="Gmail is syncing automatically. Matching employer threads will appear here." />}</div></section>{replying && <ReplyDialog thread={replying} onOpenChange={(open) => { if (!open) setReplying(null); }} onAction={onAction} busy={busy} />}</>;
}

function ReplyDialog({ thread, onOpenChange, onAction, busy }: { thread: EmailThread; onOpenChange: (open: boolean) => void; onAction: ActionFn; busy: string | null }) {
  const [body, setBody] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await onAction("gmail-reply", "/api/connectors/gmail/reply", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ emailThreadId: thread.id, body }) }, "Reply sent from Gmail");
    if (result) onOpenChange(false);
  }
  return <Dialog open={Boolean(thread)} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-xl"><form onSubmit={submit}><DialogHeader><DialogTitle>Reply to employer</DialogTitle><DialogDescription>{thread?.subject} · The message will be sent from your connected Gmail account.</DialogDescription></DialogHeader><div className="py-5"><Labeled label="Message"><Textarea autoFocus required className="min-h-48" value={body} onChange={(event) => setBody(event.target.value)} placeholder="Write your reply…" /></Labeled></div><DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={busy !== null || !body.trim()} className="gap-2 bg-[#0b1220] text-white hover:bg-[#162238]"><Send className="size-4" />{busy === "gmail-reply" ? "Sending…" : "Send reply"}</Button></DialogFooter></form></DialogContent></Dialog>;
}

function IntegrationsView({ integrations, onAction, busy }: { integrations: Integration[]; onAction: ActionFn; busy: string | null }) {
  const copy: Record<string, { icon: typeof Link2; description: string; permission: string }> = {
    reed: { icon: Search, description: "Discover UK vacancies through Reed's official job-search API.", permission: "Search only · no account automation" },
    adzuna: { icon: BriefcaseBusiness, description: "Broaden UK vacancy discovery through Adzuna's official API.", permission: "Search only · no account automation" },
    jooble: { icon: Search, description: "Search Jooble's aggregated UK vacancies for listings that Reed and Adzuna may miss.", permission: "Search only · no account automation" },
    google_routes: { icon: Navigation, description: "Verify every local job by walking first, then check a bus journey when the walk exceeds one hour.", permission: "Route checks only · required for local recommendations" },
    gmail: { icon: Mail, description: "Automatically sync employer messages and send approved direct-email applications.", permission: "Automatic sync every 5 minutes · read and send" },
  };
  return <div className="grid gap-4 lg:grid-cols-2">{integrations.filter((item) => item.provider !== "rules").map((item) => { const details = copy[item.provider]; if (!details) return null; const Icon = details.icon; return <article key={item.provider} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-4"><span className="grid size-11 place-items-center rounded-xl bg-slate-100 text-slate-700"><Icon className="size-5" /></span><Badge variant="outline" className={item.connected ? "border-emerald-200 bg-emerald-50 text-emerald-700" : item.ready ? "border-amber-200 bg-amber-50 text-amber-700" : "border-slate-200 bg-slate-50 text-slate-500"}>{item.connected ? "Connected" : item.ready ? "Ready" : "Setup needed"}</Badge></div><h2 className="mt-4 font-semibold text-slate-950">{item.name}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{details.description}</p><div className="mt-4 rounded-xl bg-slate-50 px-3 py-2.5"><p className="text-xs font-medium text-slate-500">{details.permission}</p><p className="mt-1 text-xs text-slate-400">{item.detail}</p></div><div className="mt-5">{item.provider === "gmail" && item.connected ? <Button variant="outline" className="gap-2 border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800" disabled={busy !== null} onClick={() => void onAction("gmail-disconnect", "/api/connectors/gmail", { method: "DELETE" }, "Gmail disconnected")}><LogOut className="size-4" />{busy === "gmail-disconnect" ? "Disconnecting..." : "Disconnect Gmail"}</Button> : item.provider === "gmail" && item.ready ? <Button className="gap-2 bg-[#0b1220] text-white hover:bg-[#162238]" onClick={() => void beginGmailConnection()} disabled={busy !== null}><Link2 className="size-4" />Connect account</Button> : item.connected ? <Button variant="outline" disabled><CircleCheck className="size-4 text-emerald-600" />Active</Button> : <Button variant="outline" disabled>Credentials not configured</Button>}</div></article>; })}</div>;
}

function ProfileView({ profile: initialProfile, onSaved }: { profile: Profile; onSaved: () => void }) {
  const [profile, setProfile] = useState(initialProfile);
  const [saving, setSaving] = useState(false);
  function update<K extends keyof Profile>(key: K, value: Profile[K]) { setProfile((current) => ({ ...current, [key]: value })); }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true);
    try {
      const response = await apiFetch("/api/profile", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(profile) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Profile could not be saved.");
      toast.success("Profile saved securely"); onSaved();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Profile could not be saved."); }
    finally { setSaving(false); }
  }
  return <form onSubmit={save} className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]"><div className="space-y-6"><FormSection title="Identity and contact" copy="Used only to complete applications you approve."><div className="grid gap-4 sm:grid-cols-2"><Labeled label="First name"><Input required value={profile.firstName} onChange={(event) => update("firstName", event.target.value)} /></Labeled><Labeled label="Last name"><Input required value={profile.lastName} onChange={(event) => update("lastName", event.target.value)} /></Labeled><Labeled label="Phone"><Input type="tel" value={profile.phone} onChange={(event) => update("phone", event.target.value)} /></Labeled><div><Labeled label="Right to work"><Input placeholder="e.g. British citizen" value={profile.rightToWork} onChange={(event) => update("rightToWork", event.target.value)} /></Labeled><SuggestionChips items={rightToWorkSuggestions} onPick={(value) => update("rightToWork", value)} /></div></div></FormSection><FormSection title="Home location" copy="Your exact address is encrypted. Job searches use your town or postcode."><div className="grid gap-4 sm:grid-cols-2"><Labeled label="Address line 1" wide><Input value={profile.addressLine1} onChange={(event) => update("addressLine1", event.target.value)} /></Labeled><Labeled label="Address line 2" wide><Input value={profile.addressLine2} onChange={(event) => update("addressLine2", event.target.value)} /></Labeled><Labeled label="Town or city"><Input value={profile.townCity} onChange={(event) => update("townCity", event.target.value)} /></Labeled><Labeled label="Postcode"><Input required value={profile.postcode} onChange={(event) => update("postcode", event.target.value)} /></Labeled></div></FormSection><FormSection title="Links and skills" copy="Optional evidence employers can use to assess your work."><div className="grid gap-4 sm:grid-cols-2"><Labeled label="Portfolio URL"><Input type="url" value={profile.portfolioUrl} onChange={(event) => update("portfolioUrl", event.target.value)} /></Labeled><Labeled label="LinkedIn URL"><Input type="url" value={profile.linkedInUrl} onChange={(event) => update("linkedInUrl", event.target.value)} /></Labeled><Labeled label="GitHub URL"><Input type="url" value={profile.githubUrl} onChange={(event) => update("githubUrl", event.target.value)} /></Labeled><Labeled label="Skills" wide hint="Separate with commas"><Textarea value={profile.skills.join(", ")} onChange={(event) => update("skills", splitList(event.target.value))} placeholder="C#, Unity, customer service, teamwork" /></Labeled></div></FormSection></div><aside className="space-y-6"><FormSection title="Availability and travel" copy="These facts are applied as hard matching constraints."><div className="space-y-4"><div><Labeled label="Availability"><Textarea value={profile.availability} onChange={(event) => update("availability", event.target.value)} placeholder="Weekday evenings and weekends" /></Labeled><SuggestionChips items={availabilitySuggestions} onPick={(value) => update("availability", appendSuggestion(profile.availability, value))} /></div><Labeled label="Transport"><Select value={profile.transportMode} onValueChange={(value) => update("transportMode", value as Profile["transportMode"])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="public_transport">Public transport</SelectItem><SelectItem value="car">Car</SelectItem><SelectItem value="either">Either</SelectItem></SelectContent></Select></Labeled><Labeled label="Maximum journey"><div className="flex items-center gap-3"><Input type="number" min={5} max={240} value={profile.maxTravelMinutes} onChange={(event) => update("maxTravelMinutes", Number(event.target.value))} /><span className="text-sm text-slate-500">minutes</span></div></Labeled><Labeled label="Minimum annual salary" hint="Leave blank if flexible"><Input type="number" min={0} value={profile.minimumSalary ?? ""} onChange={(event) => update("minimumSalary", event.target.value ? Number(event.target.value) : null)} /></Labeled></div></FormSection><Button type="submit" size="lg" className="w-full bg-[#0b1220] text-white hover:bg-[#162238]" disabled={saving}>{saving ? "Saving…" : "Save profile"}</Button></aside></form>;
}

function ManualJobDialog({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (open: boolean) => void; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); setSaving(true);
    try {
      const value = (name: string) => String(form.get(name) ?? "").trim();
      const payload = { url: value("url"), title: value("title"), company: value("company"), location: value("location") || "Not specified", description: value("description"), employmentType: value("employmentType") || null, remoteType: value("remoteType") || null, applyEmail: value("applyEmail") || null, salaryMin: value("salaryMin") ? Number(value("salaryMin")) : null, salaryMax: value("salaryMax") ? Number(value("salaryMax")) : null };
      const response = await apiFetch("/api/jobs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Job could not be added.");
      toast.success("Job scored and added"); onSaved();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Job could not be added."); }
    finally { setSaving(false); }
  }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><form onSubmit={submit}><DialogHeader><DialogTitle>Add a job manually</DialogTitle><DialogDescription>Paste the listing details and JobBot will score it against every active track.</DialogDescription></DialogHeader><div className="grid gap-4 py-5 sm:grid-cols-2"><Labeled label="Listing URL" wide><Input name="url" type="url" required placeholder="https://…" /></Labeled><Labeled label="Job title"><Input name="title" required /></Labeled><Labeled label="Company"><Input name="company" required /></Labeled><Labeled label="Location"><Input name="location" /></Labeled><Labeled label="Employment type"><Input name="employmentType" placeholder="Part-time" /></Labeled><Labeled label="Workplace"><Input name="remoteType" placeholder="On-site, hybrid or remote" /></Labeled><Labeled label="Application email" hint="Enables direct email submission"><Input name="applyEmail" type="email" /></Labeled><Labeled label="Minimum salary"><Input name="salaryMin" type="number" min={0} /></Labeled><Labeled label="Maximum salary"><Input name="salaryMax" type="number" min={0} /></Labeled><Labeled label="Job description" wide><Textarea name="description" required minLength={20} className="min-h-40" placeholder="Paste the vacancy description…" /></Labeled></div><DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={saving} className="bg-[#0b1220] text-white hover:bg-[#162238]">{saving ? "Scoring…" : "Add and score"}</Button></DialogFooter></form></DialogContent></Dialog>;
}

function TrackDialog({ open, onOpenChange, track, documents, onSaved }: { open: boolean; onOpenChange: (open: boolean) => void; track: Track | null; documents: DocumentRow[]; onSaved: () => void }) {
  const [draft, setDraft] = useState<Omit<Track, "id">>(() => track ? ({
    name: track.name, color: track.color, mode: track.mode, includeTitles: [...track.includeTitles], excludeTitles: [...track.excludeTitles],
    jobTypes: [...track.jobTypes], maxTravelMinutes: track.maxTravelMinutes, minimumSalary: track.minimumSalary,
    remotePreference: track.remotePreference, cvDocumentId: track.cvDocumentId, coverLetterDocumentId: track.coverLetterDocumentId, active: track.active,
  }) : ({ ...emptyTrack, includeTitles: [], excludeTitles: [], jobTypes: ["part-time"] }));
  const [saving, setSaving] = useState(false);
  function update<K extends keyof Omit<Track, "id">>(key: K, value: Omit<Track, "id">[K]) { setDraft((current) => ({ ...current, [key]: value })); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true);
    try {
      const response = await apiFetch(track ? `/api/tracks/${track.id}` : "/api/tracks", { method: track ? "PUT" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(draft) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Track could not be saved.");
      toast.success(track ? "Job track updated" : "Job track created"); onSaved();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Track could not be saved."); }
    finally { setSaving(false); }
  }
  const cvs = documents.filter((item) => item.kind === "cv"); const covers = documents.filter((item) => item.kind === "cover_letter");
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl"><form onSubmit={submit}><DialogHeader><DialogTitle>{track ? "Edit job track" : "Create a job track"}</DialogTitle><DialogDescription>Define exactly which roles qualify and which documents they should use.</DialogDescription></DialogHeader><div className="grid gap-5 py-5 sm:grid-cols-2"><Labeled label="Track name"><Input required minLength={2} value={draft.name} onChange={(event) => update("name", event.target.value)} placeholder="General part-time" /></Labeled><Labeled label="Colour"><div className="flex gap-2"><Input type="color" value={draft.color} onChange={(event) => update("color", event.target.value)} className="w-16 p-1" /><Input value={draft.color} onChange={(event) => update("color", event.target.value)} /></div></Labeled><Labeled label="Application mode" wide><Select value={draft.mode} onValueChange={(value) => update("mode", value as Track["mode"])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="review">Review every application</SelectItem><SelectItem value="auto">Auto-submit direct email jobs at 90%+</SelectItem><SelectItem value="discover">Discover only</SelectItem></SelectContent></Select>{draft.mode === "auto" && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs leading-5 text-amber-800">Automation never bypasses external site forms or CAPTCHAs. Only eligible direct-email applications can submit automatically.</p>}</Labeled><div className="sm:col-span-2"><Labeled label="Titles to include" hint="Separate with commas or new lines"><Textarea required value={draft.includeTitles.join(", ")} onChange={(event) => update("includeTitles", splitList(event.target.value))} placeholder="retail assistant, waiter, junior game developer" /></Labeled><SuggestionChips items={includeTitleSuggestions} onPick={(value) => update("includeTitles", appendListItem(draft.includeTitles, value))} /></div><div className="sm:col-span-2"><Labeled label="Titles to exclude" hint="Hard exclusions"><Textarea value={draft.excludeTitles.join(", ")} onChange={(event) => update("excludeTitles", splitList(event.target.value))} placeholder="manager, tattoo artist, senior" /></Labeled><SuggestionChips items={excludeTitleSuggestions} onPick={(value) => update("excludeTitles", appendListItem(draft.excludeTitles, value))} /></div><div><Labeled label="Job types" hint="Separate with commas"><Input value={draft.jobTypes.join(", ")} onChange={(event) => update("jobTypes", splitList(event.target.value))} placeholder="part-time, apprenticeship" /></Labeled><SuggestionChips items={jobTypeSuggestions} onPick={(value) => update("jobTypes", appendListItem(draft.jobTypes, value))} /></div><Labeled label="Maximum journey"><div className="flex items-center gap-2"><Input type="number" min={5} max={240} value={draft.maxTravelMinutes} onChange={(event) => update("maxTravelMinutes", Number(event.target.value))} /><span className="text-sm text-slate-500">min</span></div></Labeled><Labeled label="Minimum salary"><Input type="number" min={0} value={draft.minimumSalary ?? ""} onChange={(event) => update("minimumSalary", event.target.value ? Number(event.target.value) : null)} /></Labeled><div><Labeled label="Remote preference"><Input value={draft.remotePreference} onChange={(event) => update("remotePreference", event.target.value)} /></Labeled><SuggestionChips items={workplaceSuggestions} onPick={(value) => update("remotePreference", value)} /></div><Labeled label="CV"><Select value={draft.cvDocumentId ?? "none"} onValueChange={(value) => update("cvDocumentId", value === "none" ? null : value)}><SelectTrigger><SelectValue placeholder="Select a CV" /></SelectTrigger><SelectContent><SelectItem value="none">No CV assigned</SelectItem>{cvs.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></Labeled><Labeled label="Cover letter"><Select value={draft.coverLetterDocumentId ?? "none"} onValueChange={(value) => update("coverLetterDocumentId", value === "none" ? null : value)}><SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger><SelectContent><SelectItem value="none">No cover letter</SelectItem>{covers.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></Labeled><div className="flex items-center justify-between rounded-xl border border-slate-200 p-4 sm:col-span-2"><div><p className="text-sm font-medium text-slate-900">Track active</p><p className="mt-1 text-xs text-slate-500">Paused tracks are ignored by discovery and matching.</p></div><Switch checked={draft.active} onCheckedChange={(value) => update("active", value)} /></div></div><DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={saving} className="bg-[#0b1220] text-white hover:bg-[#162238]">{saving ? "Saving…" : "Save track"}</Button></DialogFooter></form></DialogContent></Dialog>;
}

function AnswerDialog({ open, onOpenChange, tracks, onSaved }: { open: boolean; onOpenChange: (open: boolean) => void; tracks: Track[]; onSaved: () => void }) {
  const [scope, setScope] = useState("all"); const [trackId, setTrackId] = useState<string | null>(null); const [sensitive, setSensitive] = useState(false); const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); setSaving(true);
    try {
      const response = await apiFetch("/api/answers", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: String(form.get("question") ?? ""), answer: String(form.get("answer") ?? ""), scope, trackId: scope === "track" ? trackId : null, sensitive }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Answer could not be saved.");
      toast.success("Verified answer saved"); onSaved();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Answer could not be saved."); }
    finally { setSaving(false); }
  }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-xl"><form onSubmit={submit}><DialogHeader><DialogTitle>Save a verified answer</DialogTitle><DialogDescription>Reuse a factual answer when future applications ask the same question.</DialogDescription></DialogHeader><div className="space-y-4 py-5"><Labeled label="Application question"><Textarea name="question" required minLength={3} placeholder="Do you have the right to work in the UK?" /></Labeled><Labeled label="Your verified answer"><Textarea name="answer" required className="min-h-28" /></Labeled><div className="grid gap-4 sm:grid-cols-2"><Labeled label="Reuse scope"><Select value={scope} onValueChange={(value) => { setScope(value); if (value !== "track") setTrackId(null); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All applications</SelectItem><SelectItem value="track">One job track</SelectItem><SelectItem value="single">Single-use</SelectItem></SelectContent></Select></Labeled>{scope === "track" && <Labeled label="Job track"><Select value={trackId ?? undefined} onValueChange={setTrackId}><SelectTrigger><SelectValue placeholder="Choose a track" /></SelectTrigger><SelectContent>{tracks.map((track) => <SelectItem key={track.id} value={track.id}>{track.name}</SelectItem>)}</SelectContent></Select></Labeled>}</div><div className="flex items-center justify-between rounded-xl border border-slate-200 p-4"><div><p className="text-sm font-medium text-slate-900">Sensitive answer</p><p className="mt-1 text-xs text-slate-500">Hide its value in the dashboard and keep it encrypted.</p></div><Switch checked={sensitive} onCheckedChange={setSensitive} /></div></div><DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={saving || (scope === "track" && !trackId)} className="bg-[#0b1220] text-white hover:bg-[#162238]">{saving ? "Encrypting…" : "Save answer"}</Button></DialogFooter></form></DialogContent></Dialog>;
}

function FormSection({ title, copy, children }: { title: string; copy: string; children: React.ReactNode }) { return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-semibold text-slate-950">{title}</h2><p className="mt-1 text-sm text-slate-500">{copy}</p><div className="mt-5">{children}</div></section>; }
function Labeled({ label, hint, wide = false, children }: { label: string; hint?: string; wide?: boolean; children: React.ReactNode }) { return <label className={`block space-y-2 ${wide ? "sm:col-span-2" : ""}`}><span className="flex items-center justify-between gap-3 text-sm font-medium text-slate-700"><span>{label}</span>{hint && <span className="text-xs font-normal text-slate-400">{hint}</span>}</span>{children}</label>; }
function SuggestionChips({ items, onPick }: { items: string[]; onPick: (value: string) => void }) { return <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Suggested answers">{items.map((item) => <button key={item} type="button" onClick={() => onPick(item)} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-left text-xs text-slate-600 transition hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-900">{item}</button>)}</div>; }
function EmptyState({ icon: Icon, title, copy, action, onAction }: { icon: typeof Database; title: string; copy: string; action?: string; onAction?: () => void }) { return <div className="flex min-h-52 flex-col items-center justify-center p-8 text-center"><span className="grid size-12 place-items-center rounded-2xl bg-slate-100 text-slate-500"><Icon className="size-5" /></span><h3 className="mt-4 font-semibold text-slate-900">{title}</h3><p className="mt-1 max-w-md text-sm leading-6 text-slate-500">{copy}</p>{action && onAction && <Button variant="outline" className="mt-5" onClick={onAction}>{action}</Button>}</div>; }
function splitList(value: string) { return value.split(/[,\n]/).map((item) => item.trim()).filter(Boolean); }
function appendListItem(items: string[], value: string) { return items.some((item) => item.toLowerCase() === value.toLowerCase()) ? items : [...items, value]; }
function appendSuggestion(current: string, value: string) { return current.toLowerCase().includes(value.toLowerCase()) ? current : [current.trim(), value].filter(Boolean).join("; "); }

async function beginGmailConnection() {
  try {
    const response = await apiFetch("/api/connectors/gmail/start", { method: "POST" });
    const payload = await response.json() as { url?: string; error?: string };
    if (!response.ok || !payload.url) throw new Error(payload.error || "Gmail connection could not start.");
    window.location.assign(payload.url);
  } catch (error) { toast.error(error instanceof Error ? error.message : "Gmail connection could not start."); }
}

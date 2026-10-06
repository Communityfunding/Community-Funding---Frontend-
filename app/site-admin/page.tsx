/* v100_t25_marker — Tier 2.5 fixes */
/* v100_t2_frontend_fix — login payload + error hardening */
"use client";

/* ============================================================
 * CommunityFundings — Site Admin (platform-wide moderation)
 * Apple-inspired: generous space, restrained palette, subtle motion.
 * ============================================================ */

import type { JSX } from "react";
import { useState, useEffect, Suspense, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// A stored admin_id is UI state only. Every request must carry a verified
// Clerk session; the backend checks a separately provisioned admin grant.
function useSiteAdminFetch() {
  const { getToken } = useAuth();
  return useCallback(async (input: RequestInfo | URL, init?: RequestInit) => {
    const token = await getToken();
    if (!token) throw new Error("Sign in to Community Fundings before using administrator tools.");
    const headers = new Headers(init?.headers);
    headers.set("Authorization", `Bearer ${token}`);
    return window.fetch(input, { ...init, headers });
  }, [getToken]);
}

/* ---------- typography: load Geist + Geist Mono via <style jsx global> ---------- */
const GlobalFonts = () => (
  <style jsx global>{`
    @import url("https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700;800&family=Geist+Mono:wght@400;500;600&family=Instrument+Serif:ital@0;1&display=swap");
    .font-display { font-family: "Instrument Serif", ui-serif, Georgia, serif; font-weight: 400; letter-spacing: -0.02em; }
    .font-ui      { font-family: "Geist", -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif; }
    .font-mono    { font-family: "Geist Mono", ui-monospace, "SF Mono", Menlo, monospace; font-feature-settings: "tnum"; }
    .cf-admin *   { font-family: "Geist", -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
    .cf-admin .num { font-family: "Geist Mono", ui-monospace, monospace; font-feature-settings: "tnum"; letter-spacing: -0.02em; }
    @keyframes cf-fade-in   { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
    @keyframes cf-slide-in  { from { opacity: 0; transform: translateX(-8px); } to { opacity: 1; transform: none; } }
    @keyframes cf-pop-in    { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
    @keyframes cf-shimmer   { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } }
    .cf-fade     { animation: cf-fade-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) both; }
    .cf-slide    { animation: cf-slide-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) both; }
    .cf-pop      { animation: cf-pop-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) both; }
    .cf-shimmer  { background: linear-gradient(90deg, #f1f1f3 0%, #e8e8ea 50%, #f1f1f3 100%); background-size: 800px 100%; animation: cf-shimmer 1.5s infinite linear; }
  `}</style>
);

/* ---------- palette (Apple-inspired) ---------- */
const C = {
  bg: "#f5f5f7",
  surface: "#ffffff",
  border: "rgba(0,0,0,0.06)",
  borderStrong: "rgba(0,0,0,0.10)",
  text: "#1d1d1f",
  text2: "#6e6e73",
  text3: "#86868b",
  blue: "#0071e3",
  blueSoft: "rgba(0,113,227,0.08)",
  green: "#30d158",
  orange: "#ff9f0a",
  red: "#ff3b30",
  purple: "#bf5af2",
  pink: "#ff375f",
};

/* ---------- utils ---------- */
const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n || 0);
const fmtShort = (n: number) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(Math.round(n));
};
const fmtRel = (iso: string) => {
  if (!iso) return "";
  const d = new Date(iso).getTime();
  const diff = (Date.now() - d) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
};
const initials = (n: string) => (n || "").split(" ").map((x) => x[0]).join("").toUpperCase().slice(0, 2) || "?";
const gradients = [
  ["#007aff", "#5856d6"], ["#af52de", "#ff2d55"], ["#30d158", "#32ade6"],
  ["#ff9500", "#ff375f"], ["#5ac8fa", "#0071e3"], ["#ff375f", "#af52de"],
  ["#34c759", "#5ac8fa"], ["#ffcc00", "#ff9500"],
];
const hash = (s: string) => {
  let h = 0;
  for (let i = 0; i < (s || "").length; i++) h = (s || "").charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h);
};
const gradientFor = (s: string) => gradients[hash(s) % gradients.length];

/* ---------- icons (minimal, SF-Symbols-esque) ---------- */
const Icon = ({ name, size = 18 }: { name: string; size?: number }) => {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const paths: Record<string, JSX.Element> = {
    home: (<g><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9v11a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9" /></g>),
    chart: (<g><path d="M3 3v18h18" /><path d="M7 14l4-4 4 4 5-6" /></g>),
    campaign: (<g><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></g>),
    users: (<g><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></g>),
    flag: (<g><path d="M4 21V4m0 0h13l-2 4 2 4H4" /></g>),
    card: (<g><rect x="2" y="6" width="20" height="12" rx="2" /><path d="M2 11h20" /></g>),
    clock: (<g><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></g>),
    search: (<g><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></g>),
    arrow_up: (<g><path d="M7 17 17 7" /><path d="M9 7h8v8" /></g>),
    arrow_down: (<g><path d="M7 7l10 10" /><path d="M9 17h8V9" /></g>),
    logout: (<g><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></g>),
    shield: (<g><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /></g>),
    check: (<g><path d="M5 12l5 5L20 7" /></g>),
    x: (<g><path d="M6 6l12 12M18 6 6 18" /></g>),
    trash: (<g><path d="M4 7h16" /><path d="M10 11v6M14 11v6" /><path d="M5 7h14l-1 13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 7z" /><path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" /></g>),
    ban: (<g><circle cx="12" cy="12" r="9" /><path d="m5 5 14 14" /></g>),
    unlock: (<g><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0" /></g>),
    pause: (<g><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></g>),
    play: (<g><path d="M6 4l14 8-14 8V4z" /></g>),
    sparkle: (<g><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" /></g>),
    bell: (<g><path d="M6 8a6 6 0 1 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9" /><path d="M10 21a2 2 0 0 0 4 0" /></g>),
    settings: (<g><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></g>),
  };
  return <svg {...p}>{paths[name]}</svg>;
};

/* ---------- types ---------- */
type Section = "overview" | "campaigns" | "users" | "reports" | "transactions" | "activity";

/* =================================================================== */
/*                              MAIN                                    */
/* =================================================================== */

function SiteAdminContent() {
  const params = useSearchParams();
  const startMode = params.get("mode");
  const [authView, setAuthView] = useState<"login" | "register">(startMode === "register" ? "register" : "login");
  const [adminId, setAdminId] = useState<number | null>(null);
  const [adminName, setAdminName] = useState("");
  const [section, setSection] = useState<Section>("overview");
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  /* boot: restore session */
  useEffect(() => {
    const s = localStorage.getItem("cf_site_admin");
    if (s) {
      try {
        const d = JSON.parse(s);
        setAdminId(d.admin_id);
        setAdminName(d.name);
      } catch {}
    }
  }, []);

  /* toast auto-dismiss */
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const logout = () => {
    localStorage.removeItem("cf_site_admin");
    setAdminId(null);
    setAdminName("");
    setSection("overview");
  };

  const notify = (type: "success" | "error", msg: string) => setToast({ type, msg });

  if (!adminId) {
    return (
      <>
        <GlobalFonts />
        <AuthScreen
          view={authView}
          onSwitch={setAuthView}
          onAuthed={(id, name) => {
            localStorage.setItem("cf_site_admin", JSON.stringify({ admin_id: id, name }));
            setAdminId(id);
            setAdminName(name);
          }}
        />
      </>
    );
  }

  return (
    <>
      <GlobalFonts />
      <div className="cf-admin min-h-screen flex" style={{ background: C.bg, color: C.text }}>
        <Sidebar section={section} setSection={setSection} adminName={adminName} onLogout={logout} />
        <main className="flex-1 min-w-0 overflow-hidden">
          <div className="max-w-[1240px] mx-auto px-10 py-10 cf-fade" key={section}>
            {section === "overview" && <OverviewSection adminId={adminId} notify={notify} />}
            {section === "campaigns" && <CampaignsSection adminId={adminId} notify={notify} />}
            {section === "users" && <UsersSection adminId={adminId} notify={notify} />}
            {section === "reports" && <ReportsSection adminId={adminId} notify={notify} />}
            {section === "transactions" && <TransactionsSection adminId={adminId} notify={notify} />}
            {section === "activity" && <ActivitySection adminId={adminId} />}
          </div>
        </main>
        {toast && (
          <div
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 cf-pop"
            style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 14,
              padding: "12px 18px",
              boxShadow: "0 20px 60px -12px rgba(0,0,0,0.2), 0 4px 16px rgba(0,0,0,0.08)",
              minWidth: 280,
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-white"
                style={{ background: toast.type === "success" ? C.green : C.red }}
              >
                <Icon name={toast.type === "success" ? "check" : "x"} size={14} />
              </div>
              <span className="text-sm font-medium" style={{ color: C.text }}>{toast.msg}</span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/* =================================================================== */
/*                           AUTH SCREEN                                */
/* =================================================================== */

function AuthScreen({
  view, onSwitch, onAuthed,
}: {
  view: "login" | "register";
  onSwitch: (v: "login" | "register") => void;
  onAuthed: (id: number, name: string) => void;
}) {
  const fetch = useSiteAdminFetch();
  const [code, setCode] = useState("");
  const [fn, setFn] = useState("");
  const [ln, setLn] = useState("");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setErr(""); setMsg("");
    if (view === "register") {
      setErr("Public administrator registration is disabled. Contact the project owner for access.");
      return;
    }
    const formatError = (d: any): string => {
      if (!d) return "Authentication failed";
      if (typeof d === "string") return d;
      // Pydantic 422 — d.detail is array of error objects
      if (Array.isArray(d.detail)) {
        return d.detail
          .map((e: any) =>
            typeof e === "string"
              ? e
              : e?.msg
                ? `${e.msg}${e.loc ? ` (${e.loc.join(".")})` : ""}`
                : JSON.stringify(e)
          )
          .join("; ");
      }
      if (typeof d.detail === "string") return d.detail;
      if (d.detail) return JSON.stringify(d.detail);
      if (d.message) return String(d.message);
      return "Authentication failed";
    };
    
    if (!code || !fn || !ln) { setErr("All fields are required."); return; }
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/site-admin/${view}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: code, first_name: fn, last_name: ln }),
      });
      const d = await r.json();
      if (!r.ok) { setErr(formatError(d)); return; }
      onAuthed(d.admin_id, d.name);
    } catch { setErr("Network error — is the backend running?"); }
    finally { setLoading(false); }
  };

  return (
    <div className="cf-admin min-h-screen flex items-center justify-center p-8" style={{
      background: "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(0,113,227,0.08), transparent 70%), #f5f5f7",
    }}>
      <div className="w-full max-w-[420px] cf-pop">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm mb-8 transition-colors" style={{ color: C.text2 }}>
          <span style={{ fontSize: 18 }}>‹</span> Back to site
        </Link>

        <div
          className="relative"
          style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 20,
            padding: 40,
            boxShadow: "0 30px 80px -20px rgba(0,0,0,0.12), 0 6px 24px rgba(0,0,0,0.04)",
          }}
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white" style={{
              background: `linear-gradient(135deg, ${C.blue}, #5856d6)`,
            }}>
              <Icon name="shield" size={20} />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-widest font-semibold" style={{ color: C.text3 }}>Restricted</div>
              <h1 className="text-[22px] font-semibold" style={{ color: C.text, letterSpacing: "-0.02em" }}>
                Site Administration
              </h1>
            </div>
          </div>

          <div className="flex p-0.5 rounded-xl mb-6" style={{ background: "#f0f0f2" }}>
            {(["login", "register"] as const).map((v) => (
              <button
                key={v}
                onClick={() => { onSwitch(v); setErr(""); setMsg(""); }}
                className="flex-1 py-2 text-[13px] font-medium rounded-[10px] transition-all duration-200"
                style={{
                  background: view === v ? C.surface : "transparent",
                  color: view === v ? C.text : C.text2,
                  boxShadow: view === v ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                }}
              >
                {v === "login" ? "Sign In" : "Register"}
              </button>
            ))}
          </div>

          {err && (
            <div className="cf-fade mb-4 px-3.5 py-2.5 text-[13px] rounded-lg" style={{
              background: "rgba(255,59,48,0.08)", color: C.red, border: "1px solid rgba(255,59,48,0.15)",
            }}>{err}</div>
          )}
          {msg && (
            <div className="cf-fade mb-4 px-3.5 py-2.5 text-[13px] rounded-lg" style={{
              background: "rgba(48,209,88,0.08)", color: "#248a3d", border: "1px solid rgba(48,209,88,0.2)",
            }}>{msg}</div>
          )}

          <div className="space-y-4">
            <Field label="Access code" hint="8–10 characters">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 10))}
                maxLength={10}
                placeholder="CF2026ADMN"
                className="num w-full py-3 px-0 bg-transparent outline-none text-[17px] font-medium tracking-[0.15em]"
                style={{ color: C.text }}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="First name">
                <input
                  value={fn} onChange={(e) => setFn(e.target.value)} placeholder="Cade"
                  className="w-full py-3 px-0 bg-transparent outline-none text-[15px]"
                  style={{ color: C.text }}
                />
              </Field>
              <Field label="Last name">
                <input
                  value={ln} onChange={(e) => setLn(e.target.value)} placeholder="Miller"
                  className="w-full py-3 px-0 bg-transparent outline-none text-[15px]"
                  style={{ color: C.text }}
                />
              </Field>
            </div>

            <button
              onClick={submit}
              disabled={loading}
              className="w-full py-3.5 rounded-[12px] text-[15px] font-semibold text-white transition-all duration-200 hover:opacity-90 active:scale-[0.99] disabled:opacity-50"
              style={{
                background: `linear-gradient(180deg, ${C.blue}, #0062c9)`,
                boxShadow: "0 6px 16px rgba(0,113,227,0.25), inset 0 1px 0 rgba(255,255,255,0.15)",
              }}
            >
              {loading ? "Please wait…" : view === "login" ? "Sign In" : "Create Admin Account"}
            </button>
          </div>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: C.text3 }}>
          Authorized personnel only. All actions are logged.
        </p>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: C.text3 }}>{label}</span>
        {hint && <span className="text-[11px]" style={{ color: C.text3 }}>{hint}</span>}
      </div>
      <div style={{ borderBottom: `1px solid ${C.borderStrong}`, transition: "border-color 0.2s" }}
           onFocus={(e) => (e.currentTarget.style.borderColor = C.blue)}
           onBlur={(e) => (e.currentTarget.style.borderColor = C.borderStrong)}>
        {children}
      </div>
    </label>
  );
}

/* =================================================================== */
/*                             SIDEBAR                                  */
/* =================================================================== */

function Sidebar({
  section, setSection, adminName, onLogout,
}: {
  section: Section; setSection: (s: Section) => void; adminName: string; onLogout: () => void;
}) {
  const items: { id: Section; label: string; icon: string }[] = [
    { id: "overview", label: "Overview", icon: "home" },
    { id: "campaigns", label: "Campaigns", icon: "campaign" },
    { id: "users", label: "Users", icon: "users" },
    { id: "reports", label: "Reports", icon: "flag" },
    { id: "transactions", label: "Transactions", icon: "card" },
    { id: "activity", label: "Activity", icon: "clock" },
  ];

  return (
    <aside
      className="w-[240px] shrink-0 min-h-screen flex flex-col"
      style={{ background: C.surface, borderRight: `1px solid ${C.border}` }}
    >
      <div className="px-6 pt-8 pb-6">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div
            className="w-8 h-8 rounded-[9px] flex items-center justify-center text-white transition-transform group-hover:scale-105"
            style={{ background: `linear-gradient(135deg, ${C.blue}, #5856d6)`, boxShadow: "0 4px 10px rgba(0,113,227,0.3)" }}
          >
            <Icon name="shield" size={16} />
          </div>
          <div>
            <div className="text-[15px] font-semibold leading-tight" style={{ color: C.text, letterSpacing: "-0.015em" }}>
              CommunityFundings
            </div>
            <div className="text-[10.5px] uppercase tracking-wider font-semibold" style={{ color: C.text3 }}>
              Admin Console
            </div>
          </div>
        </Link>
      </div>

      <nav className="flex-1 px-3">
        <div className="text-[10px] uppercase tracking-[0.1em] font-semibold px-3 mb-2" style={{ color: C.text3 }}>
          Workspace
        </div>
        <div className="space-y-0.5">
          {items.map((it) => {
            const active = section === it.id;
            return (
              <button
                key={it.id}
                onClick={() => setSection(it.id)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[8px] text-left transition-all duration-150"
                style={{
                  background: active ? C.blueSoft : "transparent",
                  color: active ? C.blue : C.text,
                  fontWeight: active ? 600 : 500,
                }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "#f5f5f7"; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
              >
                <Icon name={it.icon} size={17} />
                <span className="text-[13.5px]">{it.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <div className="p-3 border-t" style={{ borderColor: C.border }}>
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-[10px]" style={{ background: "#fafafa" }}>
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[12px] font-semibold shrink-0"
            style={{ background: `linear-gradient(135deg, ${gradientFor(adminName)[0]}, ${gradientFor(adminName)[1]})` }}
          >
            {initials(adminName)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[12.5px] font-medium truncate" style={{ color: C.text }}>{adminName}</div>
            <div className="text-[11px]" style={{ color: C.text3 }}>Site Admin</div>
          </div>
          <button
            onClick={onLogout}
            className="w-7 h-7 rounded-[7px] flex items-center justify-center transition-all hover:bg-white"
            style={{ color: C.text2 }}
            title="Sign out"
          >
            <Icon name="logout" size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}

/* =================================================================== */
/*                             OVERVIEW                                 */
/* =================================================================== */

function OverviewSection({ adminId, notify }: { adminId: number; notify: (t: "success" | "error", m: string) => void }) {
  const fetch = useSiteAdminFetch();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${API}/api/site-admin/dashboard?admin_id=${adminId}`);
      if (r.ok) setData(await r.json());
      else {
        const detail = await r.json().catch(() => ({}));
        setError(detail?.detail || `Dashboard failed (${r.status})`);
        notify("error", "Failed to load dashboard");
      }
    } catch { setError("Network error — is the backend running?"); notify("error", "Network error"); }
    finally { setLoading(false); }
  }, [adminId, notify]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <PageSkeleton />;
  if (error || !data) {
    return (
      <div className="cf-fade" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 400 }}>
        <div style={{ textAlign: "center", maxWidth: 440, padding: 32, background: C.surface, borderRadius: 20, border: `1px solid ${C.border}`, boxShadow: "0 8px 24px rgba(0,0,0,0.04)" }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: "rgba(255,59,48,0.08)", color: C.red, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <h3 style={{ fontSize: 20, fontWeight: 600, color: C.text, marginBottom: 8, letterSpacing: "-0.01em" }}>Couldn&apos;t load dashboard</h3>
          <p style={{ fontSize: 14, color: C.text2, marginBottom: 20, lineHeight: 1.5 }}>{error}</p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button onClick={load} style={{ padding: "10px 20px", borderRadius: 10, background: C.blue, color: "#fff", fontSize: 14, fontWeight: 500, border: "none", cursor: "pointer", transition: "transform 150ms cubic-bezier(0.16,1,0.3,1)" }} onMouseDown={e => (e.currentTarget.style.transform = "scale(0.97)")} onMouseUp={e => (e.currentTarget.style.transform = "scale(1)")} onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}>Retry</button>
            <button onClick={() => { localStorage.removeItem("cf_site_admin"); location.reload(); }} style={{ padding: "10px 20px", borderRadius: 10, background: "#f5f5f7", color: C.text, fontSize: 14, fontWeight: 500, border: `1px solid ${C.border}`, cursor: "pointer" }}>Sign out &amp; restart</button>
          </div>
        </div>
      </div>
    );
  }

  const { stats, growth, chart, top_campaigns, recent_donations, alerts } = data;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Dashboard"
        title="Overview"
        subtitle="Real-time activity across CommunityFundings"
      />

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total raised" value={fmtCurrency(stats.total_raised)} delta={growth.raised_pct} accent={C.green} big />
        <StatCard label="Active campaigns" value={fmtShort(stats.active_campaigns)} delta={growth.campaigns_pct} accent={C.blue} />
        <StatCard label="Users" value={fmtShort(stats.total_users)} delta={growth.users_pct} accent={C.purple} />
        <StatCard label="Open reports" value={fmtShort(stats.total_reports)} delta={null} accent={C.orange} warn={alerts.new_reports_24h > 0 ? `${alerts.new_reports_24h} new today` : undefined} />
      </div>

      {/* Chart + side cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="col-span-2">
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: C.text3 }}>Donations</div>
              <div className="text-[24px] font-semibold mt-1" style={{ color: C.text, letterSpacing: "-0.02em" }}>
                {fmtCurrency(growth.raised_this_week)}
                <span className="text-[13px] font-normal ml-2" style={{ color: C.text3 }}>this week</span>
              </div>
            </div>
            <Badge>Last 14 days</Badge>
          </div>
          <AreaChart points={chart} />
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-5">
            <div className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: C.text3 }}>Platform health</div>
            <Icon name="sparkle" size={14} />
          </div>
          <div className="space-y-4">
            <HealthRow label="Total donations" value={fmtShort(stats.total_donations)} />
            <HealthRow label="Comments" value={fmtShort(stats.total_comments)} />
            <HealthRow label="Blocked users" value={fmtShort(stats.total_blocked)} tone={stats.total_blocked > 0 ? "warn" : "neutral"} />
            <HealthRow label="Pending review" value={fmtShort(alerts.pending_campaigns)} tone={alerts.pending_campaigns > 0 ? "warn" : "neutral"} />
          </div>
        </Card>
      </div>

      {/* Top campaigns + recent donations */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <SectionHeader title="Top campaigns" hint="by amount raised" />
          <div className="space-y-1">
            {top_campaigns.length === 0 && <EmptyRow label="No active campaigns yet" />}
            {top_campaigns.map((c: any, idx: number) => (
              <Row key={c.id}>
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-7 text-center num text-[12.5px]" style={{ color: C.text3 }}>{idx + 1}</div>
                  <Avatar name={c.title} size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-medium truncate" style={{ color: C.text }}>{c.title}</div>
                    <div className="text-[11.5px]" style={{ color: C.text3 }}>{c.creator_name} · {c.backers} backers</div>
                  </div>
                </div>
                <div className="num text-[13.5px] font-semibold whitespace-nowrap" style={{ color: C.text }}>
                  {fmtCurrency(c.raised)}
                </div>
              </Row>
            ))}
          </div>
        </Card>

        <Card>
          <SectionHeader title="Recent donations" hint="live" />
          <div className="space-y-1">
            {recent_donations.length === 0 && <EmptyRow label="No donations yet" />}
            {recent_donations.map((d: any) => (
              <Row key={d.id}>
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-2 h-2 rounded-full" style={{ background: C.green, boxShadow: "0 0 0 3px rgba(48,209,88,0.15)" }} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium truncate" style={{ color: C.text }}>{d.campaign_title}</div>
                    <div className="text-[11.5px] truncate" style={{ color: C.text3 }}>{d.donor}</div>
                  </div>
                </div>
                <div className="text-right whitespace-nowrap">
                  <div className="num text-[13.5px] font-semibold" style={{ color: C.text }}>+{fmtCurrency(d.amount)}</div>
                  <div className="text-[11px]" style={{ color: C.text3 }}>{fmtRel(d.time)}</div>
                </div>
              </Row>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* =================================================================== */
/*                            CAMPAIGNS                                 */
/* =================================================================== */

function CampaignsSection({ adminId, notify }: { adminId: number; notify: (t: "success" | "error", m: string) => void }) {
  const fetch = useSiteAdminFetch();
  const [data, setData] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const u = `${API}/api/site-admin/campaigns?admin_id=${adminId}&search=${encodeURIComponent(search)}&status=${status}&limit=100`;
      const r = await fetch(u);
      if (r.ok) setData(await r.json());
    } catch {} finally { setLoading(false); }
  }, [adminId, search, status]);

  useEffect(() => {
    const t = setTimeout(load, 220);
    return () => clearTimeout(t);
  }, [load]);

  const action = async (id: number, kind: "delete" | "suspend" | "reinstate", title: string) => {
    if (kind === "delete" && !confirm(`Delete "${title}"? This will archive the campaign.`)) return;
    try {
      const r = await fetch(`${API}/api/site-admin/campaigns/${id}/${kind}?admin_id=${adminId}${kind === "delete" ? "&reason=Removed by admin" : ""}`, { method: "POST" });
      if (r.ok) { notify("success", `Campaign ${kind === "reinstate" ? "reinstated" : kind + "d"}`); load(); }
      else notify("error", `Failed to ${kind}`);
    } catch { notify("error", "Network error"); }
  };

  const filters = [
    { id: "all", label: "All" }, { id: "active", label: "Active" },
    { id: "suspended", label: "Suspended" }, { id: "funded", label: "Funded" },
    { id: "draft", label: "Draft" }, { id: "cancelled", label: "Cancelled" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Platform" title="Campaigns" subtitle={`${data?.total ?? "—"} total`} />

      <div className="flex items-center gap-3">
        <SearchBar value={search} onChange={setSearch} placeholder="Search title or creator…" />
        <FilterChips options={filters} value={status} onChange={setStatus} />
      </div>

      <Card padding="none">
        {loading && <TableSkeleton rows={6} cols={5} />}
        {!loading && data?.campaigns?.length === 0 && <EmptyCard title="No campaigns" subtitle="Nothing matches your filters." />}
        {!loading && data?.campaigns?.length > 0 && (
          <Table>
            <THead cols={["Campaign", "Creator", "Raised", "Status", "Reports", ""]} widths={["40%", "18%", "14%", "12%", "8%", "8%"]} />
            <tbody>
              {data.campaigns.map((c: any) => (
                <Tr key={c.id}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <Avatar name={c.title} size={34} />
                      <div className="min-w-0">
                        <div className="text-[13.5px] font-medium truncate" style={{ color: C.text }}>{c.title}</div>
                        <div className="text-[11.5px]" style={{ color: C.text3 }}>{c.category || "—"} · {c.backers} backers</div>
                      </div>
                    </div>
                  </Td>
                  <Td><span className="text-[13px]" style={{ color: C.text2 }}>{c.creator_name}</span></Td>
                  <Td>
                    <div className="num text-[13px] font-semibold" style={{ color: C.text }}>{fmtCurrency(c.raised)}</div>
                    <div className="text-[11px]" style={{ color: C.text3 }}>of {fmtCurrency(c.goal)}</div>
                  </Td>
                  <Td><StatusPill status={c.status} /></Td>
                  <Td>
                    {c.report_count > 0
                      ? <Pill color={C.red} bg="rgba(255,59,48,0.08)">{c.report_count}</Pill>
                      : <span className="text-[12px]" style={{ color: C.text3 }}>—</span>}
                  </Td>
                  <Td>
                    <div className="flex items-center gap-1.5 justify-end">
                      {c.status !== "suspended" && (
                        <IconButton title="Suspend" onClick={() => action(c.id, "suspend", c.title)}>
                          <Icon name="pause" size={14} />
                        </IconButton>
                      )}
                      {c.status === "suspended" && (
                        <IconButton title="Reinstate" onClick={() => action(c.id, "reinstate", c.title)} tone="positive">
                          <Icon name="play" size={14} />
                        </IconButton>
                      )}
                      <IconButton title="Delete" onClick={() => action(c.id, "delete", c.title)} tone="danger">
                        <Icon name="trash" size={14} />
                      </IconButton>
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}

/* =================================================================== */
/*                              USERS                                   */
/* =================================================================== */

function UsersSection({ adminId, notify }: { adminId: number; notify: (t: "success" | "error", m: string) => void }) {
  const fetch = useSiteAdminFetch();
  const [data, setData] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const u = `${API}/api/site-admin/users?admin_id=${adminId}&search=${encodeURIComponent(search)}&filter_type=${filter}&limit=100`;
      const r = await fetch(u);
      if (r.ok) setData(await r.json());
    } catch {} finally { setLoading(false); }
  }, [adminId, search, filter]);

  useEffect(() => { const t = setTimeout(load, 220); return () => clearTimeout(t); }, [load]);

  const block = async (id: string, name: string) => {
    if (!confirm(`Block "${name}"? They will lose access.`)) return;
    try {
      const r = await fetch(`${API}/api/site-admin/users/${id}/block?admin_id=${adminId}&reason=Policy violation`, { method: "POST" });
      if (r.ok) { notify("success", `${name} blocked`); load(); }
      else { const d = await r.json(); notify("error", d.detail || "Failed"); }
    } catch { notify("error", "Network error"); }
  };
  const unblock = async (id: string, name: string) => {
    try {
      const r = await fetch(`${API}/api/site-admin/users/${id}/unblock?admin_id=${adminId}`, { method: "POST" });
      if (r.ok) { notify("success", `${name} unblocked`); load(); }
    } catch { notify("error", "Network error"); }
  };

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Platform" title="Users" subtitle={`${data?.total ?? "—"} total`} />

      <div className="flex items-center gap-3">
        <SearchBar value={search} onChange={setSearch} placeholder="Search name or email…" />
        <FilterChips
          options={[{ id: "all", label: "All" }, { id: "active", label: "Active" }, { id: "blocked", label: "Blocked" }]}
          value={filter} onChange={setFilter}
        />
      </div>

      <Card padding="none">
        {loading && <TableSkeleton rows={6} cols={5} />}
        {!loading && data?.users?.length === 0 && <EmptyCard title="No users" subtitle="Nothing matches your filters." />}
        {!loading && data?.users?.length > 0 && (
          <Table>
            <THead cols={["User", "Email", "Campaigns", "Raised", "Status", ""]} widths={["28%", "24%", "10%", "14%", "12%", "12%"]} />
            <tbody>
              {data.users.map((u: any) => (
                <Tr key={u.creator_id}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <Avatar name={u.name} size={34} />
                      <div className="min-w-0">
                        <div className="text-[13.5px] font-medium truncate" style={{ color: C.text }}>{u.name}</div>
                        <div className="text-[11px] num truncate" style={{ color: C.text3 }}>{u.creator_id?.slice(0, 24)}</div>
                      </div>
                    </div>
                  </Td>
                  <Td><span className="text-[13px]" style={{ color: C.text2 }}>{u.email || "—"}</span></Td>
                  <Td><span className="num text-[13px] font-medium" style={{ color: C.text }}>{u.campaign_count}</span></Td>
                  <Td><span className="num text-[13px]" style={{ color: C.text }}>{fmtCurrency(u.total_raised)}</span></Td>
                  <Td>{u.is_blocked ? <Pill color={C.red} bg="rgba(255,59,48,0.08)">Blocked</Pill> : <Pill color="#248a3d" bg="rgba(48,209,88,0.08)">Active</Pill>}</Td>
                  <Td>
                    <div className="flex items-center gap-1.5 justify-end">
                      {u.is_blocked
                        ? <IconButton title="Unblock" onClick={() => unblock(u.creator_id, u.name)} tone="positive"><Icon name="unlock" size={14} /></IconButton>
                        : <IconButton title="Block" onClick={() => block(u.creator_id, u.name)} tone="danger"><Icon name="ban" size={14} /></IconButton>}
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}

/* =================================================================== */
/*                             REPORTS                                  */
/* =================================================================== */

function ReportsSection({ adminId, notify }: { adminId: number; notify: (t: "success" | "error", m: string) => void }) {
  const fetch = useSiteAdminFetch();
  const [data, setData] = useState<any>(null);
  const [pending, setPending] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"pending" | "campaigns" | "comments">("pending");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r1, r2] = await Promise.all([
        fetch(`${API}/api/site-admin/reports?admin_id=${adminId}`),
        fetch(`${API}/api/site-admin/pending-campaigns?admin_id=${adminId}`),
      ]);
      if (r1.ok) setData(await r1.json());
      if (r2.ok) setPending(await r2.json());
    } catch {} finally { setLoading(false); }
  }, [adminId]);

  useEffect(() => { load(); }, [load]);

  const approveCampaign = async (id: number, title: string) => {
    const r = await fetch(`${API}/api/site-admin/campaigns/${id}/approve?admin_id=${adminId}`, { method: "POST" });
    if (r.ok) { notify("success", `Approved: ${title}`); load(); }
    else { const d = await r.json().catch(() => ({})); notify("error", d.detail || "Approve failed"); }
  };
  const rejectCampaign = async (id: number, title: string) => {
    const reason = prompt(`Why are you rejecting "${title}"?`);
    if (!reason) return;
    const r = await fetch(`${API}/api/site-admin/campaigns/${id}/reject?admin_id=${adminId}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    if (r.ok) { notify("success", `Rejected: ${title}`); load(); }
    else { const d = await r.json().catch(() => ({})); notify("error", d.detail || "Reject failed"); }
  };

  const delCampaign = async (id: number, title: string) => {
    if (!confirm(`Delete "${title}"?`)) return;
    const r = await fetch(`${API}/api/site-admin/campaigns/${id}/delete?admin_id=${adminId}&reason=Reported content`, { method: "POST" });
    if (r.ok) { notify("success", "Campaign deleted"); load(); }
  };
  const delComment = async (id: number) => {
    if (!confirm("Delete this comment?")) return;
    const r = await fetch(`${API}/api/site-admin/comments/${id}/delete?admin_id=${adminId}`, { method: "POST" });
    if (r.ok) { notify("success", "Comment deleted"); load(); }
  };

  /** Tiered moderation: warning / soft_ban / full_ban */
  const moderate = async (cid: string, name: string, banType: "warning" | "soft_ban" | "full_ban") => {
    const labels = { warning: "warn", soft_ban: "soft-ban (no more comments ever)", full_ban: "FULL ban (deactivates account)" };
    if (banType === "full_ban" && !confirm(`Full-ban ${name}? This deactivates their account.`)) return;
    const reason = banType === "warning" ? "Warning issued for inappropriate content" : "Moderation action";
    const r = await fetch(`${API}/api/site-admin/users/${cid}/moderate?admin_id=${adminId}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ban_type: banType, reason }),
    });
    if (r.ok) {
      const result = await r.json();
      if (result.auto_escalated) {
        notify("error", `${name} auto-full-banned (3 warnings reached)`);
      } else if (banType === "warning") {
        notify("success", `Warning ${result.warning_count}/3 issued to ${name}`);
      } else {
        notify("success", `${name} ${banType === "soft_ban" ? "soft-banned" : "full-banned"}`);
      }
    } else {
      const d = await r.json().catch(() => ({})); notify("error", d.detail || "Failed");
    }
  };

  const pendingCount = pending?.pending?.length || 0;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Moderation" title="Reports" subtitle="Review flagged content and pending campaigns" />

      <div className="flex p-0.5 rounded-[10px] w-fit" style={{ background: "#eaeaec" }}>
        {[
          { id: "pending", label: `Pending Approval (${pendingCount})` },
          { id: "campaigns", label: `Reported Campaigns (${data?.campaigns?.length || 0})` },
          { id: "comments", label: `Reported Comments (${data?.comments?.length || 0})` },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as any)}
            className="px-4 py-1.5 text-[13px] font-medium rounded-[8px] transition-all duration-200"
            style={{
              background: tab === t.id ? C.surface : "transparent",
              color: tab === t.id ? C.text : C.text2,
              boxShadow: tab === t.id ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
            }}
          >{t.label}</button>
        ))}
      </div>

      {loading && <PageSkeleton />}

      {!loading && tab === "pending" && (
        <div className="space-y-3">
          {pendingCount === 0 && <EmptyCard title="Nothing pending" subtitle="All campaigns have been reviewed." icon="check" />}
          {pending?.pending?.map((c: any) => (
            <Card key={c.campaign_id} padding="lg" className="cf-slide">
              <div className="flex items-start gap-4">
                <Avatar name={c.title} size={44} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[15px] font-semibold" style={{ color: C.text }}>{c.title}</span>
                    <Pill color={C.orange} bg="rgba(255,159,10,0.1)">Pending review</Pill>
                    {c.category && <Pill color={C.text2} bg="#f0f0f2">{c.category}</Pill>}
                  </div>
                  <div className="text-[12.5px]" style={{ color: C.text3 }}>
                    By <span style={{ color: C.text2 }}>{c.creator_name}</span>
                    {" "}({c.creator_email}) · Goal <span className="num">{fmtCurrency(c.funding_goal)}</span>
                    {c.location && <> · {c.location}</>}
                  </div>
                  {c.description && (
                    <div className="mt-2 text-[12.5px] rounded-[10px] px-3 py-2.5" style={{ background: "#fafafa", color: C.text2 }}>
                      {c.description.slice(0, 240)}{c.description.length > 240 ? "…" : ""}
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <Button tone="primary" onClick={() => approveCampaign(c.campaign_id, c.title)}>Approve</Button>
                  <Button tone="danger" onClick={() => rejectCampaign(c.campaign_id, c.title)}>Reject</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {!loading && tab === "campaigns" && (
        <div className="space-y-3">
          {data?.campaigns?.length === 0 && <EmptyCard title="All clear" subtitle="No campaigns have been reported." icon="check" />}
          {data?.campaigns?.map((c: any) => (
            <Card key={c.id} padding="lg" className="cf-slide">
              <div className="flex items-start gap-4">
                <Avatar name={c.title} size={44} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[15px] font-semibold" style={{ color: C.text }}>{c.title}</span>
                    <Pill color={C.red} bg="rgba(255,59,48,0.08)">{c.report_count} {c.report_count === 1 ? "report" : "reports"}</Pill>
                  </div>
                  <div className="text-[12.5px]" style={{ color: C.text3 }}>
                    {c.creator_name} · <span className="num">{fmtCurrency(c.raised)}</span> raised · {c.backers} backers
                  </div>
                  {c.reasons && <div className="mt-2 text-[12px]" style={{ color: C.text2 }}>Reasons: <span style={{ color: C.text }}>{c.reasons}</span></div>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button tone="danger" onClick={() => delCampaign(c.id, c.title)}>Delete</Button>
                  <Button tone="neutral" onClick={() => moderate(c.creator_id, c.creator_name, "full_ban")}>Ban creator</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {!loading && tab === "comments" && (
        <div className="space-y-3">
          {data?.comments?.length === 0 && <EmptyCard title="No comments to review" subtitle="Nothing in the moderation queue." icon="check" />}
          {data?.comments?.map((c: any) => (
            <Card key={c.id} padding="lg" className="cf-slide">
              <div className="flex items-start gap-3.5">
                <Avatar name={c.commenter_name} size={38} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[13.5px] font-semibold" style={{ color: C.text }}>{c.commenter_name}</span>
                    <span className="text-[12px]" style={{ color: C.text3 }}>on</span>
                    <span className="text-[13px] font-medium" style={{ color: C.blue }}>{c.campaign_title}</span>
                    <span className="text-[11.5px]" style={{ color: C.text3 }}>· {fmtRel(c.time_created)}</span>
                  </div>
                  <div className="text-[13.5px] rounded-[10px] px-3 py-2.5 mb-2" style={{ background: "#fafafa", color: C.text }}>
                    {c.text}
                  </div>
                  <div className="text-[11.5px]" style={{ color: C.text3 }}>Creator ID: <span className="num">{c.creator_id?.slice(0, 8) || "—"}</span></div>
                </div>
                <div className="flex flex-col gap-1.5 shrink-0" style={{ minWidth: 140 }}>
                  <Button tone="danger" size="sm" onClick={() => delComment(c.id)}>Delete comment</Button>
                  <Button tone="neutral" size="sm" onClick={() => moderate(c.creator_id, c.commenter_name, "warning")}>⚠ Warn</Button>
                  <Button tone="neutral" size="sm" onClick={() => moderate(c.creator_id, c.commenter_name, "soft_ban")}>🤐 Soft ban</Button>
                  <Button tone="danger" size="sm" onClick={() => moderate(c.creator_id, c.commenter_name, "full_ban")}>🚫 Full ban</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* =================================================================== */
/*                          TRANSACTIONS                                */
/* =================================================================== */

function TransactionsSection({ adminId, notify }: { adminId: number; notify: (t: "success" | "error", m: string) => void }) {
  const fetch = useSiteAdminFetch();
  const [data, setData] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const u = `${API}/api/site-admin/transactions?admin_id=${adminId}&search=${encodeURIComponent(search)}&status=${status}&limit=100`;
      const r = await fetch(u);
      if (r.ok) setData(await r.json());
    } catch {} finally { setLoading(false); }
  }, [adminId, search, status]);

  useEffect(() => { const t = setTimeout(load, 220); return () => clearTimeout(t); }, [load]);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Finance" title="Transactions" subtitle="All donations on the platform" />

      {data?.summary && (
        <div className="grid grid-cols-3 gap-4">
          <MiniStat label="Total volume" value={fmtCurrency(data.summary.total_volume)} />
          <MiniStat label="Platform fees" value={fmtCurrency(data.summary.total_fees)} />
          <MiniStat label="Transactions" value={fmtShort(data.summary.total_count)} />
        </div>
      )}

      <div className="flex items-center gap-3">
        <SearchBar value={search} onChange={setSearch} placeholder="Search campaign or donor…" />
        <FilterChips
          options={[
            { id: "all", label: "All" }, { id: "succeeded", label: "Succeeded" },
            { id: "pending", label: "Pending" }, { id: "failed", label: "Failed" },
            { id: "refunded", label: "Refunded" },
          ]}
          value={status} onChange={setStatus}
        />
      </div>

      <Card padding="none">
        {loading && <TableSkeleton rows={6} cols={5} />}
        {!loading && data?.transactions?.length === 0 && <EmptyCard title="No transactions" subtitle="Nothing matches your filters." />}
        {!loading && data?.transactions?.length > 0 && (
          <Table>
            <THead cols={["Amount", "Donor", "Campaign", "Status", "Time"]} widths={["14%", "22%", "32%", "16%", "16%"]} />
            <tbody>
              {data.transactions.map((t: any) => (
                <Tr key={t.id}>
                  <Td>
                    <div className="num text-[14px] font-semibold" style={{ color: C.text }}>{fmtCurrency(t.amount)}</div>
                    <div className="text-[10.5px]" style={{ color: C.text3 }}>fee <span className="num">{fmtCurrency(t.platform_fee)}</span></div>
                  </Td>
                  <Td><span className="text-[13px]" style={{ color: C.text2 }}>{t.donor}</span></Td>
                  <Td>
                    <div className="text-[13px] truncate" style={{ color: C.text }}>{t.campaign_title}</div>
                    {t.stripe_id && <div className="text-[10.5px] num truncate" style={{ color: C.text3 }}>{t.stripe_id}</div>}
                  </Td>
                  <Td><StatusPill status={t.status} /></Td>
                  <Td><span className="text-[13px]" style={{ color: C.text3 }}>{fmtRel(t.time)}</span></Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}

/* =================================================================== */
/*                            ACTIVITY                                  */
/* =================================================================== */

function ActivitySection({ adminId }: { adminId: number }) {
  const fetch = useSiteAdminFetch();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API}/api/site-admin/activity?admin_id=${adminId}&limit=200`);
        if (r.ok) setData(await r.json());
      } catch {} finally { setLoading(false); }
    })();
  }, [adminId]);

  const actionLabel = (a: string) => ({
    delete_campaign: "Deleted campaign",
    suspend_campaign: "Suspended campaign",
    reinstate_campaign: "Reinstated campaign",
    delete_comment: "Deleted comment",
    block_user: "Blocked user",
    unblock_user: "Unblocked user",
  } as Record<string, string>)[a] || a;

  const actionColor = (a: string) => {
    if (a.startsWith("delete") || a === "block_user" || a === "suspend_campaign") return C.red;
    if (a === "unblock_user" || a === "reinstate_campaign") return C.green;
    return C.blue;
  };

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Audit" title="Activity" subtitle="Every admin action, logged forever" />

      <Card padding="none">
        {loading && <PageSkeleton />}
        {!loading && data?.activity?.length === 0 && <EmptyCard title="No activity yet" subtitle="Admin actions will appear here." />}
        {!loading && data?.activity?.length > 0 && (
          <div>
            {data.activity.map((a: any, idx: number) => (
              <div key={a.id} className="flex items-start gap-4 px-6 py-4" style={{ borderBottom: idx < data.activity.length - 1 ? `1px solid ${C.border}` : "none" }}>
                <div className="w-2 h-2 rounded-full mt-2 shrink-0" style={{ background: actionColor(a.action), boxShadow: `0 0 0 4px ${actionColor(a.action)}15` }} />
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px]" style={{ color: C.text }}>
                    <span className="font-semibold">{a.admin_name}</span>{" "}
                    <span style={{ color: C.text2 }}>{actionLabel(a.action).toLowerCase()}</span>
                    {a.target_id && <span className="num ml-1.5 px-1.5 py-0.5 rounded-md text-[11px]" style={{ background: "#f0f0f2", color: C.text2 }}>{a.target_type}:{a.target_id}</span>}
                  </div>
                  {a.details && <div className="text-[12px] mt-0.5" style={{ color: C.text3 }}>{a.details}</div>}
                </div>
                <div className="text-[12px] num whitespace-nowrap" style={{ color: C.text3 }}>{fmtRel(a.time)}</div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

/* =================================================================== */
/*                      SHARED UI PRIMITIVES                            */
/* =================================================================== */

function PageHeader({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {
  return (
    <div>
      {eyebrow && <div className="text-[11px] uppercase tracking-[0.12em] font-semibold mb-1.5" style={{ color: C.text3 }}>{eyebrow}</div>}
      <h1 className="font-display text-[40px] leading-none" style={{ color: C.text }}>{title}</h1>
      {subtitle && <p className="text-[14px] mt-2" style={{ color: C.text2 }}>{subtitle}</p>}
    </div>
  );
}

function Card({ children, className = "", padding = "md" }: { children: React.ReactNode; className?: string; padding?: "none" | "md" | "lg" }) {
  const p = padding === "none" ? "" : padding === "lg" ? "p-6" : "p-5";
  return (
    <div className={`${p} ${className}`} style={{
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16,
      boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
    }}>{children}</div>
  );
}

function SectionHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between mb-4">
      <div className="text-[15px] font-semibold" style={{ color: C.text, letterSpacing: "-0.01em" }}>{title}</div>
      {hint && <div className="text-[11px] uppercase tracking-wider" style={{ color: C.text3 }}>{hint}</div>}
    </div>
  );
}

function StatCard({
  label, value, delta, accent, big, warn,
}: { label: string; value: string; delta: number | null; accent: string; big?: boolean; warn?: string }) {
  const up = delta !== null && delta >= 0;
  return (
    <div className="relative overflow-hidden" style={{
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20,
    }}>
      <div className="absolute top-0 left-0 w-full h-[2px]" style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }} />
      <div className="text-[11px] uppercase tracking-wider font-semibold mb-2" style={{ color: C.text3 }}>{label}</div>
      <div className={`num font-semibold ${big ? "text-[32px]" : "text-[26px]"}`} style={{ color: C.text, letterSpacing: "-0.02em", lineHeight: 1 }}>
        {value}
      </div>
      <div className="mt-3 flex items-center gap-2">
        {delta !== null ? (
          <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-medium num" style={{
            background: up ? "rgba(48,209,88,0.1)" : "rgba(255,59,48,0.1)",
            color: up ? "#248a3d" : C.red,
          }}>
            <Icon name={up ? "arrow_up" : "arrow_down"} size={11} />
            {Math.abs(delta)}%
          </div>
        ) : warn ? (
          <div className="text-[11px] font-medium px-1.5 py-0.5 rounded-md" style={{ background: "rgba(255,159,10,0.12)", color: "#b35900" }}>
            {warn}
          </div>
        ) : null}
        {delta !== null && <span className="text-[11px]" style={{ color: C.text3 }}>vs last week</span>}
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 }}>
      <div className="text-[11px] uppercase tracking-wider font-semibold mb-1.5" style={{ color: C.text3 }}>{label}</div>
      <div className="num text-[22px] font-semibold" style={{ color: C.text, letterSpacing: "-0.02em" }}>{value}</div>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] uppercase tracking-wider font-semibold px-2 py-1 rounded-md" style={{
      background: "#f0f0f2", color: C.text2,
    }}>{children}</span>
  );
}

function Pill({ children, color, bg }: { children: React.ReactNode; color: string; bg: string }) {
  return <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md" style={{ color, background: bg }}>{children}</span>;
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { color: string; bg: string; label: string }> = {
    active:    { color: "#248a3d", bg: "rgba(48,209,88,0.1)", label: "Active" },
    succeeded: { color: "#248a3d", bg: "rgba(48,209,88,0.1)", label: "Succeeded" },
    funded:    { color: "#0562c7", bg: "rgba(0,113,227,0.1)", label: "Funded" },
    pending:   { color: "#b35900", bg: "rgba(255,159,10,0.12)", label: "Pending" },
    pending_review: { color: "#b35900", bg: "rgba(255,159,10,0.12)", label: "Pending" },
    suspended: { color: C.red, bg: "rgba(255,59,48,0.08)", label: "Suspended" },
    cancelled: { color: C.text2, bg: "#f0f0f2", label: "Cancelled" },
    failed:    { color: C.red, bg: "rgba(255,59,48,0.08)", label: "Failed" },
    refunded:  { color: "#7e57c2", bg: "rgba(175,82,222,0.1)", label: "Refunded" },
    partially_refunded: { color: "#7e57c2", bg: "rgba(175,82,222,0.1)", label: "Partial refund" },
    draft:     { color: C.text2, bg: "#f0f0f2", label: "Draft" },
  };
  const s = map[status] || { color: C.text2, bg: "#f0f0f2", label: status };
  return <Pill color={s.color} bg={s.bg}>{s.label}</Pill>;
}

function HealthRow({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "warn" }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[13px]" style={{ color: C.text2 }}>{label}</span>
      <span className="num text-[14px] font-semibold" style={{ color: tone === "warn" ? "#b35900" : C.text }}>{value}</span>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex items-center gap-3 px-2 py-2.5 rounded-[8px] transition-colors"
      onMouseEnter={(e) => (e.currentTarget.style.background = "#fafafa")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >{children}</div>
  );
}

function EmptyRow({ label }: { label: string }) {
  return <div className="text-center py-6 text-[13px]" style={{ color: C.text3 }}>{label}</div>;
}

function EmptyCard({ title, subtitle, icon = "sparkle" }: { title: string; subtitle?: string; icon?: string }) {
  return (
    <div className="text-center py-16 px-6">
      <div className="w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-3" style={{ background: "#f0f0f2", color: C.text3 }}>
        <Icon name={icon} size={20} />
      </div>
      <div className="text-[15px] font-semibold mb-1" style={{ color: C.text }}>{title}</div>
      {subtitle && <div className="text-[13px]" style={{ color: C.text3 }}>{subtitle}</div>}
    </div>
  );
}

function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const [a, b] = gradientFor(name);
  return (
    <div
      className="rounded-[9px] flex items-center justify-center text-white font-semibold shrink-0"
      style={{
        width: size, height: size, fontSize: size * 0.38,
        background: `linear-gradient(135deg, ${a}, ${b})`,
        boxShadow: "inset 0 0 0 0.5px rgba(255,255,255,0.2)",
      }}
    >{initials(name)}</div>
  );
}

function SearchBar({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <div
      className="flex items-center gap-2 px-3.5 h-[36px] rounded-[10px] flex-1 max-w-[420px] transition-all duration-150"
      style={{
        background: C.surface,
        border: `1px solid ${focused ? C.blue : C.border}`,
        boxShadow: focused ? `0 0 0 3px ${C.blueSoft}` : "none",
      }}
    >
      <span style={{ color: C.text3 }}><Icon name="search" size={15} /></span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        className="flex-1 bg-transparent outline-none text-[13.5px]"
        style={{ color: C.text }}
      />
    </div>
  );
}

function FilterChips({ options, value, onChange }: { options: { id: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-1.5">
      {options.map((o) => {
        const active = value === o.id;
        return (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            className="px-3 h-[36px] rounded-[10px] text-[13px] font-medium transition-all duration-150"
            style={{
              background: active ? C.text : C.surface,
              color: active ? C.surface : C.text,
              border: `1px solid ${active ? C.text : C.border}`,
            }}
          >{o.label}</button>
        );
      })}
    </div>
  );
}

function Table({ children }: { children: React.ReactNode }) {
  return <table className="w-full" style={{ borderCollapse: "collapse" }}>{children}</table>;
}

function THead({ cols, widths }: { cols: string[]; widths: string[] }) {
  return (
    <thead>
      <tr style={{ borderBottom: `1px solid ${C.border}` }}>
        {cols.map((c, i) => (
          <th key={i} className="text-left px-5 py-3 text-[11px] uppercase tracking-wider font-semibold"
              style={{ color: C.text3, width: widths[i] }}>{c}</th>
        ))}
      </tr>
    </thead>
  );
}

function Tr({ children }: { children: React.ReactNode }) {
  return (
    <tr
      className="transition-colors"
      style={{ borderBottom: `1px solid ${C.border}` }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "#fafafa")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >{children}</tr>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-5 py-3.5 align-middle">{children}</td>;
}

function Button({
  children, onClick, tone = "neutral", size = "md",
}: { children: React.ReactNode; onClick: () => void; tone?: "neutral" | "danger" | "positive" | "primary"; size?: "sm" | "md" }) {
  const tones: Record<string, { bg: string; color: string; border: string }> = {
    neutral:  { bg: C.surface, color: C.text, border: C.borderStrong },
    primary:  { bg: C.blue, color: "#fff", border: C.blue },
    danger:   { bg: "#fff", color: C.red, border: "rgba(255,59,48,0.25)" },
    positive: { bg: "#fff", color: "#248a3d", border: "rgba(48,209,88,0.3)" },
  };
  const t = tones[tone];
  const h = size === "sm" ? 28 : 32;
  return (
    <button
      onClick={onClick}
      className="px-3 text-[12.5px] font-semibold rounded-[8px] transition-all duration-150 active:scale-[0.97]"
      style={{ background: t.bg, color: t.color, border: `1px solid ${t.border}`, height: h }}
      onMouseEnter={(e) => {
        if (tone === "danger") e.currentTarget.style.background = "rgba(255,59,48,0.05)";
        else if (tone === "positive") e.currentTarget.style.background = "rgba(48,209,88,0.06)";
        else if (tone === "neutral") e.currentTarget.style.background = "#fafafa";
      }}
      onMouseLeave={(e) => { e.currentTarget.style.background = t.bg; }}
    >{children}</button>
  );
}

function IconButton({
  children, onClick, title, tone = "neutral",
}: { children: React.ReactNode; onClick: () => void; title?: string; tone?: "neutral" | "danger" | "positive" }) {
  const color = tone === "danger" ? C.red : tone === "positive" ? "#248a3d" : C.text2;
  return (
    <button
      onClick={onClick}
      title={title}
      className="w-7 h-7 rounded-[7px] flex items-center justify-center transition-all"
      style={{ color, background: "transparent" }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = tone === "danger" ? "rgba(255,59,48,0.08)"
                                         : tone === "positive" ? "rgba(48,209,88,0.1)"
                                         : "#f0f0f2";
      }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >{children}</button>
  );
}

/* ---------- area chart (custom SVG) ---------- */
function AreaChart({ points }: { points: { date: string; amount: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);

  const chartData = useMemo(() => {
    if (!points || points.length === 0) {
      return { path: "", areaPath: "", w: 600, h: 180, xs: [], ys: [], max: 0 };
    }
    const w = 600, h = 180;
    const padT = 10, padB = 20, padL = 0, padR = 0;
    const max = Math.max(...points.map((p) => p.amount), 1);
    const step = (w - padL - padR) / Math.max(points.length - 1, 1);
    const xs = points.map((_, i) => padL + i * step);
    const ys = points.map((p) => h - padB - ((p.amount / max) * (h - padT - padB)));

    // smooth cubic
    let path = `M ${xs[0]},${ys[0]}`;
    for (let i = 1; i < xs.length; i++) {
      const cpx1 = xs[i - 1] + (xs[i] - xs[i - 1]) / 2;
      const cpx2 = cpx1;
      path += ` C ${cpx1},${ys[i - 1]} ${cpx2},${ys[i]} ${xs[i]},${ys[i]}`;
    }
    const areaPath = path + ` L ${xs[xs.length - 1]},${h - padB} L ${xs[0]},${h - padB} Z`;
    return { path, areaPath, w, h, xs, ys, max };
  }, [points]);

  if (!points || points.length === 0) {
    return <div className="h-[180px] flex items-center justify-center text-[13px]" style={{ color: C.text3 }}>No donation data yet</div>;
  }

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${chartData.w} ${chartData.h}`} className="w-full h-[180px]" preserveAspectRatio="none">
        <defs>
          <linearGradient id="area-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.blue} stopOpacity="0.25" />
            <stop offset="100%" stopColor={C.blue} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* gridline */}
        <line x1="0" y1={chartData.h - 20} x2={chartData.w} y2={chartData.h - 20} stroke={C.border} strokeWidth="1" />
        <path d={chartData.areaPath} fill="url(#area-grad)" />
        <path d={chartData.path} fill="none" stroke={C.blue} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {chartData.xs.map((x, i) => (
          <g key={i}>
            <circle cx={x} cy={chartData.ys[i]} r={hover === i ? 5 : 3} fill={C.surface} stroke={C.blue} strokeWidth="2" style={{ transition: "r 0.15s" }} />
            <rect x={x - 15} y="0" width="30" height={chartData.h - 20}
                  fill="transparent"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)} />
          </g>
        ))}
      </svg>
      <div className="flex justify-between mt-1 text-[10.5px] num" style={{ color: C.text3 }}>
        {points.length > 0 && (
          <>
            <span>{new Date(points[0].date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
            <span>{new Date(points[points.length - 1].date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
          </>
        )}
      </div>
      {hover !== null && (
        <div
          className="absolute pointer-events-none cf-pop"
          style={{
            left: `${(chartData.xs[hover] / chartData.w) * 100}%`,
            top: `${(chartData.ys[hover] / chartData.h) * 100}%`,
            transform: "translate(-50%, -120%)",
            background: C.text,
            color: "#fff",
            padding: "6px 10px",
            borderRadius: 8,
            fontSize: 11,
            whiteSpace: "nowrap",
          }}
        >
          <div className="num font-semibold">{fmtCurrency(points[hover].amount)}</div>
          <div style={{ opacity: 0.7 }}>{new Date(points[hover].date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</div>
        </div>
      )}
    </div>
  );
}

/* ---------- skeletons ---------- */
function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-10 w-60 rounded-lg cf-shimmer" />
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-[110px] rounded-2xl cf-shimmer" />)}
      </div>
      <div className="h-[260px] rounded-2xl cf-shimmer" />
    </div>
  );
}

function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="p-5 space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          {Array.from({ length: cols }).map((__, j) => (
            <div key={j} className="h-6 flex-1 rounded cf-shimmer" style={{ maxWidth: j === 0 ? 240 : "none" }} />
          ))}
        </div>
      ))}
    </div>
  );
}

/* =================================================================== */
export default function SiteAdminPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg }}>
        <div className="w-8 h-8 rounded-full border-2" style={{ borderColor: C.border, borderTopColor: C.blue, animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    }>
      <SiteAdminContent />
    </Suspense>
  );
}

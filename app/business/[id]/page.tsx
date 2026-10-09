"use client";
import { defaultBusinessUsername } from "@/lib/businessUsername";

import { useState, useEffect, useRef, useCallback, ChangeEvent } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useUser, useAuth } from "@clerk/nextjs";
import { fetchWithClerkSession } from "@/lib/clerkSessionFetch";
import Image from "next/image";
import Header from "../../components/Header";
import Footer from "../../components/Footer";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const BIZ_STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  live: "bg-green-100 text-green-700",
  funded: "bg-blue-100 text-blue-700",
  expired: "bg-red-100 text-red-600",
  ended: "bg-red-100 text-red-600",
  cancelled: "bg-red-100 text-red-600",
  suspended: "bg-orange-100 text-orange-700",
  pending_review: "bg-yellow-100 text-yellow-700",
  draft: "bg-gray-100 text-gray-600",
};

const BIZ_STATUS_LABEL: Record<string, string> = {
  active: "Live", live: "Live", funded: "Funded", expired: "Ended",
  ended: "Ended", cancelled: "Cancelled", suspended: "Suspended",
  pending_review: "In Review", draft: "Draft",
};

function formatCampaignDate(s: string | null): string {
  if (!s) return "";
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

type Tab = "overview" | "campaigns" | "members" | "finance" | "settings";

interface Membership {
  organization_id: string;
  name: string;
  bio: string;
  logo_url: string | null;
  role: string;
}

interface BizProfile {
  id: string;
  name: string | null;
  bio: string | null;
  avatar_url: string | null;
  phone_number: string | null;
  address: string | null;
  state: string | null;
  time_zone: string | null;
  website: string | null;
}

interface BizCampaign {
  campaign_id: number;
  title: string;
  slug: string | null;
  status: string;
  image_url: string | null;
  category: string | null;
  created_at: string | null;
  raised_amount: number;
  goal_amount: number;
  funding_percentage: number;
  donors_count: number;
}

function BizLiveCard({ c }: { c: BizCampaign }) {
  return (
    <a
      href={c.slug ? `/project/${c.slug}` : "#"}
      className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow border border-gray-100 block"
    >
      <div className="relative h-40 bg-gray-200 flex items-center justify-center text-gray-400">
        {c.image_url ? (
          <Image src={c.image_url} alt={c.title} fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" className="object-cover" unoptimized />
        ) : (
          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        )}
      </div>
      <div className="p-5">
        <div className="flex items-start gap-2 mb-1">
          <h3 className="font-semibold text-gray-900 line-clamp-2 flex-1">{c.title}</h3>
          <span className={`px-2 py-0.5 rounded text-xs font-medium shrink-0 ${BIZ_STATUS_COLORS[c.status] ?? "bg-gray-100 text-gray-600"}`}>
            {BIZ_STATUS_LABEL[c.status] ?? c.status}
          </span>
        </div>
        {c.category && (
          <span className="inline-block bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs mb-3">{c.category}</span>
        )}
        <div className="mt-2">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-gray-700 font-medium">${c.raised_amount.toLocaleString()}</span>
            <span className="text-[#8BC34A] font-medium">{c.funding_percentage}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div className="bg-[#8BC34A] h-1.5 rounded-full" style={{ width: `${Math.min(c.funding_percentage, 100)}%` }} />
          </div>
          <div className="mt-2 text-xs text-gray-500">
            <span>{c.donors_count} backers</span>
          </div>
        </div>
      </div>
    </a>
  );
}

interface OrgMember {
  member_id: string;
  name: string;
  last_name: string;
  username: string;
  avatar_url: string | null;
  role: string;
  email: string;
}

interface PaymentDetail {
  id: string;
  account_type: string;
  account_holder_name: string;
  routing_number_last4: string;
  account_number_last4: string;
  is_verified: boolean;
  is_default: boolean;
}

const roleBadgeStyle = (role: string) => {
  const styles: Record<string, string> = {
    owner: "bg-purple-100 text-purple-700",
    admin: "bg-red-100 text-red-700",
    finance: "bg-yellow-100 text-yellow-700",
    campaign_editor: "bg-blue-100 text-blue-700",
    editor: "bg-blue-100 text-blue-700",
    viewer: "bg-gray-100 text-gray-600",
  };
  return styles[role] ?? "bg-gray-100 text-gray-600";
};

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "campaigns", label: "Campaigns" },
  { key: "members", label: "Members" },
  { key: "finance", label: "Finance" },
  { key: "settings", label: "Settings" },
];

interface RolePermissions {
  tabs: Tab[];
  canEditCampaigns: boolean;
}

const ROLE_PERMISSIONS: Record<string, RolePermissions> = {
  viewer:          { tabs: ["overview"],                                                  canEditCampaigns: false },
  campaign_editor: { tabs: ["overview", "campaigns"],                                    canEditCampaigns: true  },
  finance:         { tabs: ["overview", "finance"],                                      canEditCampaigns: false },
  admin:           { tabs: ["overview", "campaigns", "finance", "settings"],             canEditCampaigns: true  },
  owner:           { tabs: ["overview", "campaigns", "members", "finance", "settings"],  canEditCampaigns: true  },
};

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  finance: "Finance",
  campaign_editor: "Editor",
  viewer: "Viewer",
};

function getPerms(role: string): RolePermissions {
  return ROLE_PERMISSIONS[role] ?? { tabs: ["overview"], canEditCampaigns: false };
}

export default function BusinessDashboard() {
  const { id } = useParams<{ id: string }>();
  const { user, isLoaded } = useUser();
  const { getToken } = useAuth();
  const fetch = useCallback((input: RequestInfo | URL, init?: RequestInit) =>
    fetchWithClerkSession(getToken, input, init), [getToken]);

  const [membership, setMembership] = useState<Membership | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [notAuthorized, setNotAuthorized] = useState(false);
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const t = searchParams.get("tab");
    if (t === "campaigns" || t === "members" || t === "finance" || t === "settings") return t;
    return "overview";
  });

  // Members tab state
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const hasFetchedMembers = useRef(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("viewer");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [inviteSuccess, setInviteSuccess] = useState("");
  const [roleChangeLoading, setRoleChangeLoading] = useState<string | null>(null); // member_id being updated
  const [roleChangeError, setRoleChangeError] = useState("");

  // BizProfile state (overview + pre-populates settings)
  const [bizProfile, setBizProfile] = useState<BizProfile | null>(null);
  const hasFetchedProfile = useRef(false);

  // Campaigns state (fetched once membership loads, used by both overview + campaigns tabs)
  const [campaigns, setCampaigns] = useState<BizCampaign[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [deletingDraft, setDeletingDraft] = useState<number | null>(null);
  type SortKey = "newest" | "most_funded" | "least_funded" | "az";
  const [campaignSort, setCampaignSort] = useState<SortKey>("newest");

  // Settings tab state
  const [settingsName, setSettingsName] = useState("");
  const [settingsBio, setSettingsBio] = useState("");
  const [settingsPhone, setSettingsPhone] = useState("");
  const [settingsAddress, setSettingsAddress] = useState("");
  const [settingsState, setSettingsState] = useState("");
  const [settingsCountry, setSettingsCountry] = useState("United States");
  const [settingsTimezone, setSettingsTimezone] = useState("");
  const [settingsWebsite, setSettingsWebsite] = useState("");
  const [settingsLogoFile, setSettingsLogoFile] = useState<File | null>(null);
  const [settingsLogoPreview, setSettingsLogoPreview] = useState<string | null>(null);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [settingsSuccess, setSettingsSuccess] = useState("");
  const settingsLogoInputRef = useRef<HTMLInputElement | null>(null);

  // Finance tab state
  const [accountType] = useState<"business">("business");
  const [accountHolderName, setAccountHolderName] = useState("");
  const [routingNumber, setRoutingNumber] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [confirmAccountNumber, setConfirmAccountNumber] = useState("");
  const [routingTouched, setRoutingTouched] = useState(false);
  const [savedDetails, setSavedDetails] = useState<PaymentDetail[]>([]);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const hasFetchedPayments = useRef(false);

  // Verify membership on load
  useEffect(() => {
    if (!isLoaded || !user?.id) return;
    const token = localStorage.getItem("cf_backend_token");
    fetch(`${API_URL}/api/organizations/${id}/my-role`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => {
        if (r.status === 403 || r.status === 404) {
          setNotAuthorized(true);
          return null;
        }
        return r.ok ? r.json() : null;
      })
      .then((data) => { if (data) setMembership(data); })
      .catch(() => setNotAuthorized(true))
      .finally(() => setPageLoading(false));
  }, [isLoaded, user?.id, id]);

  // Fetch biz profile once membership is confirmed (overview + pre-populate settings)
  useEffect(() => {
    if (!membership || hasFetchedProfile.current) return;
    hasFetchedProfile.current = true;
    const token = localStorage.getItem("cf_backend_token");
    fetch(`${API_URL}/api/users/${id}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: BizProfile | null) => {
        if (!data) return;
        setBizProfile(data);
        setSettingsName(data.name ?? "");
        setSettingsBio(data.bio ?? "");
        setSettingsPhone(data.phone_number ?? "");
        setSettingsAddress(data.address ?? "");
        setSettingsState(data.state ?? "");
        setSettingsWebsite(data.website ?? "");
        setSettingsTimezone(data.time_zone ?? "");
        setSettingsLogoPreview(data.avatar_url ?? null);
      })
      .catch(() => {});
  }, [membership, id]);

  // Fetch org campaigns whenever the campaigns tab is active (re-fetches on return from draft wizard)
  useEffect(() => {
    if (!membership || (activeTab !== "campaigns" && activeTab !== "overview")) return;
    setCampaignsLoading(true);
    const token = localStorage.getItem("cf_backend_token");
    fetch(`${API_URL}/api/organizations/${id}/campaigns`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setCampaigns(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setCampaignsLoading(false));
  }, [membership, id, activeTab]);

  // Fetch saved payment details when Finance tab first opens
  useEffect(() => {
    if (activeTab !== "finance" || !membership || hasFetchedPayments.current) return;
    hasFetchedPayments.current = true;
    const token = localStorage.getItem("cf_backend_token");
    fetch(`${API_URL}/api/organizations/${id}/payment-details`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setSavedDetails(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [activeTab, membership, id]);

  const handleSavePayment = async () => {
    setPaymentError("");
    setPaymentSuccess(false);
    if (!accountHolderName.trim()) { setPaymentError("Account holder name is required"); return; }
    if (routingNumber.length !== 9) { setPaymentError("Routing number must be exactly 9 digits"); return; }
    if (!accountNumber) { setPaymentError("Account number is required"); return; }
    if (accountNumber !== confirmAccountNumber) { setPaymentError("Account numbers do not match"); return; }

    setPaymentSaving(true);
    const token = localStorage.getItem("cf_backend_token");
    try {
      const res = await fetch(`${API_URL}/api/organizations/${id}/payment-details`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          account_type: accountType,
          account_holder_name: accountHolderName.trim(),
          routing_number: routingNumber,
          account_number: accountNumber,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setPaymentError(err.detail || "Failed to save payment details");
        return;
      }
      const saved = await res.json();
      setSavedDetails((prev) => [saved, ...prev]);
      setPaymentSuccess(true);
      setAccountHolderName("");
      setRoutingNumber("");
      setAccountNumber("");
      setConfirmAccountNumber("");
      setRoutingTouched(false);
    } catch {
      setPaymentError("Network error. Please try again.");
    } finally {
      setPaymentSaving(false);
    }
  };

  // Fetch members when Members tab first opens
  useEffect(() => {
    if (activeTab !== "members" || !membership || hasFetchedMembers.current) return;
    hasFetchedMembers.current = true;
    setMembersLoading(true);
    const token = localStorage.getItem("cf_backend_token");
    fetch(`${API_URL}/api/organizations/${id}/members`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setMembers(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setMembersLoading(false));
  }, [activeTab, membership, id]);

  const handleInvite = async () => {
    setInviteError("");
    setInviteSuccess("");
    if (!inviteEmail.trim()) { setInviteError("Please enter an email address"); return; }
    setInviteLoading(true);
    const token = localStorage.getItem("cf_backend_token");
    try {
      const res = await fetch(`${API_URL}/api/organizations/${id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setInviteError(err.detail || "Failed to invite member");
        return;
      }
      const newMember: OrgMember = await res.json();
      setMembers((prev) => [...prev, newMember]);
      setInviteEmail("");
      setInviteRole("viewer");
      setInviteSuccess(`${newMember.name || newMember.email} has been added as ${ROLE_LABEL[newMember.role] ?? newMember.role}.`);
    } catch {
      setInviteError("Network error. Please try again.");
    } finally {
      setInviteLoading(false);
    }
  };

  const handleRoleChange = async (memberId: string, newRole: string) => {
    setRoleChangeError("");
    setRoleChangeLoading(memberId);
    const token = localStorage.getItem("cf_backend_token");
    try {
      const res = await fetch(`${API_URL}/api/organizations/${id}/members/${memberId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setRoleChangeError((err as { detail?: string }).detail || "Failed to update role");
        return;
      }
      setMembers((prev) => prev.map((m) => m.member_id === memberId ? { ...m, role: newRole } : m));
    } catch {
      setRoleChangeError("Network error. Please try again.");
    } finally {
      setRoleChangeLoading(null);
    }
  };

  const handleSaveSettings = async () => {
    setSettingsError("");
    setSettingsSuccess("");
    setSettingsSaving(true);
    const token = localStorage.getItem("cf_backend_token");
    try {
      let avatarUrl = bizProfile?.avatar_url ?? null;
      if (settingsLogoFile) {
        const form = new FormData();
        form.append("file", settingsLogoFile);
        const uploadRes = await fetch(`${API_URL}/api/uploads/image`, {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: form,
        });
        if (!uploadRes.ok) {
          setSettingsError("Failed to upload logo. Please try again.");
          return;
        }
        const uploadData = await uploadRes.json();
        avatarUrl = uploadData.url;
      }
      const body: Record<string, unknown> = {
        name: settingsName.trim() || null,
        bio: settingsBio.trim() || null,
        phone_number: settingsPhone.trim() || null,
        address: settingsAddress.trim() || null,
        state: settingsState.trim() || null,
        website: settingsWebsite.trim() || null,
        time_zone: settingsTimezone.trim() || null,
        avatar_url: avatarUrl,
      };
      // Recover a newly registered business whose initial profile save failed.
      // Preserve any existing username on successfully loaded profiles.
      if (!bizProfile) body.username = defaultBusinessUsername(id);
      const res = await fetch(`${API_URL}/api/users/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setSettingsError((err as { detail?: string }).detail || "Failed to save settings");
        return;
      }
      const updated: BizProfile = await res.json();
      setBizProfile(updated);
      setSettingsLogoFile(null);
      setSettingsLogoPreview(updated.avatar_url ?? null);
      setSettingsSuccess("Settings saved successfully.");
    } catch {
      setSettingsError("Network error. Please try again.");
    } finally {
      setSettingsSaving(false);
    }
  };

  // ── Loading state ──────────────────────────────────────────────────────────
  if (!isLoaded || pageLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-white">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <svg className="w-8 h-8 animate-spin text-[#8BC34A]" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        </div>
        <Footer />
      </div>
    );
  }

  // ── Not authorized ─────────────────────────────────────────────────────────
  if (notAuthorized || !membership) {
    return (
      <div className="min-h-screen flex flex-col bg-white">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900">Access Denied</h2>
          <p className="text-gray-500 text-sm text-center max-w-sm">
            You are not a member of this organization, or it does not exist.
          </p>
        </div>
        <Footer />
      </div>
    );
  }

  // ── Permissions derived from membership role ──────────────────────────────
  const perms = getPerms(membership.role);
  const visibleTabs = TABS.filter((t) => perms.tabs.includes(t.key));
  // If the current activeTab isn't visible for this role, reset to overview
  const safeTab: Tab = perms.tabs.includes(activeTab) ? activeTab : "overview";

  // ── Dashboard ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />

      {/* Business Header */}
      <div className="bg-[#F5F9F0] border-b border-[#8BC34A]/20">
        <div className="max-w-5xl mx-auto px-6 pt-8 pb-0">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-xl bg-white border border-[#8BC34A]/20 flex items-center justify-center overflow-hidden shrink-0">
              {(bizProfile?.avatar_url || membership.logo_url) ? (
                <Image src={(bizProfile?.avatar_url || membership.logo_url)!} alt={membership.name} width={56} height={56} className="object-cover w-full h-full" />
              ) : (
                <svg className="w-7 h-7 text-[#8BC34A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              )}
            </div>
            <div>
              <h1 className="text-2xl font-serif font-bold text-gray-900">{bizProfile?.name || membership.name || "Unnamed Business"}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {bizProfile?.website && (
                  <a
                    href={bizProfile.website.startsWith("http") ? bizProfile.website : `https://${bizProfile.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[#8BC34A] hover:underline"
                  >
                    {bizProfile.website}
                  </a>
                )}
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${roleBadgeStyle(membership.role)}`}>
                  {ROLE_LABEL[membership.role] ?? membership.role}
                </span>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <nav className="flex space-x-8">
            {visibleTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`pb-4 text-sm font-medium transition-colors ${
                  safeTab === tab.key
                    ? "text-gray-900 border-b-2 border-[#8BC34A]"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-10">

        {/* Overview */}
        {safeTab === "overview" && (() => {
          const sortedCampaigns = [...campaigns].sort((a, b) => {
            if (campaignSort === "most_funded") return b.funding_percentage - a.funding_percentage;
            if (campaignSort === "least_funded") return a.funding_percentage - b.funding_percentage;
            if (campaignSort === "az") return a.title.localeCompare(b.title);
            return b.campaign_id - a.campaign_id; // newest
          });
          return (
            <div className="space-y-8">
              {/* Description */}
              {bizProfile?.bio ? (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">About</h3>
                  <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-wrap">{bizProfile.bio}</p>
                </div>
              ) : (
                <p className="text-gray-400 text-sm italic">No description yet. Add one in Settings.</p>
              )}

              {/* Details grid */}
              {(bizProfile?.phone_number || bizProfile?.address || bizProfile?.state || bizProfile?.time_zone) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {bizProfile?.phone_number && (
                    <div className="flex items-start gap-3 p-4 border border-gray-100 rounded-xl bg-[#F5F9F0]">
                      <svg className="w-4 h-4 text-[#8BC34A] mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      <div>
                        <p className="text-xs text-gray-400 font-medium">Phone</p>
                        <p className="text-sm text-gray-700">{bizProfile.phone_number}</p>
                      </div>
                    </div>
                  )}
                  {(bizProfile?.address || bizProfile?.state) && (
                    <div className="flex items-start gap-3 p-4 border border-gray-100 rounded-xl bg-[#F5F9F0]">
                      <svg className="w-4 h-4 text-[#8BC34A] mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <div>
                        <p className="text-xs text-gray-400 font-medium">Location</p>
                        <p className="text-sm text-gray-700">{[bizProfile?.address, bizProfile?.state].filter(Boolean).join(", ")}</p>
                      </div>
                    </div>
                  )}
                  {bizProfile?.time_zone && (
                    <div className="flex items-start gap-3 p-4 border border-gray-100 rounded-xl bg-[#F5F9F0]">
                      <svg className="w-4 h-4 text-[#8BC34A] mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <p className="text-xs text-gray-400 font-medium">Time Zone</p>
                        <p className="text-sm text-gray-700">{bizProfile.time_zone}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Campaigns section */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold text-gray-800">Campaigns</h3>
                  {campaigns.length > 1 && (
                    <div className="relative">
                      <select
                        value={campaignSort}
                        onChange={(e) => setCampaignSort(e.target.value as typeof campaignSort)}
                        className="pl-3 pr-8 py-1.5 border border-gray-200 rounded-lg text-xs appearance-none bg-white focus:outline-none focus:border-[#8BC34A]"
                      >
                        <option value="newest">Newest first</option>
                        <option value="most_funded">Most funded</option>
                        <option value="least_funded">Least funded</option>
                        <option value="az">A → Z</option>
                      </select>
                      <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  )}
                </div>
                {campaignsLoading ? (
                  <div className="flex justify-center py-10">
                    <svg className="w-5 h-5 animate-spin text-[#8BC34A]" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  </div>
                ) : (() => {
                  const publishedCampaigns = sortedCampaigns.filter((c) => c.status !== "draft" && c.status !== "pending_review");
                  return publishedCampaigns.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">No published campaigns yet.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {publishedCampaigns.map((c) => (
                      <a
                        key={c.campaign_id}
                        href={c.slug ? `/project/${c.slug}` : "#"}
                        className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow border border-gray-100 block"
                      >
                        <div className="relative h-40 bg-gray-200 flex items-center justify-center text-gray-400">
                          {c.image_url ? (
                            <Image src={c.image_url} alt={c.title} fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" className="object-cover" unoptimized />
                          ) : (
                            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          )}
                        </div>
                        <div className="p-5">
                          <div className="flex items-start gap-2 mb-1">
                            <h3 className="font-semibold text-gray-900 line-clamp-2 flex-1">{c.title}</h3>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium shrink-0 ${BIZ_STATUS_COLORS[c.status] ?? "bg-gray-100 text-gray-600"}`}>
                              {BIZ_STATUS_LABEL[c.status] ?? c.status}
                            </span>
                          </div>
                          {c.category && (
                            <span className="inline-block bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs mb-3">{c.category}</span>
                          )}
                          <div className="mt-2">
                            <div className="flex items-center justify-between text-sm mb-1">
                              <span className="text-gray-700 font-medium">${c.raised_amount.toLocaleString()}</span>
                              <span className="text-[#8BC34A] font-medium">{c.funding_percentage}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-1.5">
                              <div className="bg-[#8BC34A] h-1.5 rounded-full" style={{ width: `${Math.min(c.funding_percentage, 100)}%` }} />
                            </div>
                            <div className="mt-2 text-xs text-gray-500">
                              <span>{c.donors_count} backers</span>
                            </div>
                          </div>
                        </div>
                      </a>
                    ))}
                  </div>
                );
                })()}
              </div>

            </div>
          );
        })()}

        {/* Campaigns */}
        {safeTab === "campaigns" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-serif font-bold text-gray-900">Campaigns</h2>
              {perms.canEditCampaigns && (
                <a
                  href={`/business-create-project/${id}/basics`}
                  className="px-5 py-2.5 bg-[#8BC34A] text-white rounded-lg text-sm font-medium hover:bg-[#7CB342] transition-colors"
                >
                  + New Campaign
                </a>
              )}
            </div>

            {campaignsLoading ? (
              <div className="flex justify-center py-16">
                <svg className="w-6 h-6 animate-spin text-[#8BC34A]" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              </div>
            ) : (() => {
              const draftCampaigns = campaigns.filter((c) => c.status === "draft" || c.status === "pending_review");
              const liveCampaigns = campaigns.filter((c) => c.status !== "draft" && c.status !== "pending_review");

              return (
                <div className="space-y-8">
                  {/* Drafts section */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Drafts</h3>
                    {draftCampaigns.length > 0 ? (
                      <div className="space-y-4">
                        {draftCampaigns.map((c) => (
                            <div key={c.campaign_id} className="border border-gray-200 rounded-xl p-6 hover:border-[#8BC34A] transition-colors bg-white">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <h3 className="text-lg font-semibold text-gray-900">{c.title}</h3>
                                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                                    {c.category && (
                                      <span className="bg-gray-100 px-2 py-1 rounded text-xs">{c.category}</span>
                                    )}
                                    {c.created_at && (
                                      <span>Created {formatCampaignDate(c.created_at)}</span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-3 ml-4">
                                  <a
                                    href={`/business-create-project/${id}/basics?draft=${c.campaign_id}`}
                                    className="bg-[#8BC34A] text-white px-5 py-2 rounded-full text-sm font-medium hover:bg-[#7CB342] transition-colors"
                                  >
                                    Continue Editing
                                  </a>
                                  {perms.canEditCampaigns && (
                                    <button
                                      type="button"
                                      disabled={deletingDraft === c.campaign_id}
                                      onClick={async () => {
                                        if (!confirm("Delete this draft? This cannot be undone.")) return;
                                        setDeletingDraft(c.campaign_id);
                                        const token = localStorage.getItem("cf_backend_token");
                                        try {
                                          const res = await fetch(`${API_URL}/api/organizations/${id}/campaigns/drafts/${c.campaign_id}`, {
                                            method: "DELETE",
                                            headers: token ? { Authorization: `Bearer ${token}` } : {},
                                          });
                                          if (res.ok) setCampaigns((prev) => prev.filter((x) => x.campaign_id !== c.campaign_id));
                                        } finally {
                                          setDeletingDraft(null);
                                        }
                                      }}
                                      className="text-gray-400 hover:text-red-500 transition-colors p-2 disabled:opacity-50"
                                      aria-label="Delete draft"
                                    >
                                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-10 border border-dashed border-gray-200 rounded-xl text-center">
                        <svg className="w-8 h-8 text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        <p className="text-sm text-gray-400">No drafts yet.</p>
                      </div>
                    )}
                  </div>

                  {/* Published campaigns */}
                  {liveCampaigns.length > 0 && (
                    <div>
                      {draftCampaigns.length > 0 && (
                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Published</h3>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {liveCampaigns.map((c) => (
                          <BizLiveCard key={c.campaign_id} c={c} />
                        ))}
                      </div>
                    </div>
                  )}

                  {campaigns.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                      <div className="w-14 h-14 rounded-full bg-[#F5F9F0] flex items-center justify-center mb-4">
                        <svg className="w-7 h-7 text-[#8BC34A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                      </div>
                      <p className="text-gray-500 text-sm font-medium mb-1">No campaigns yet</p>
                      {perms.canEditCampaigns && (
                        <p className="text-gray-400 text-xs">Click &ldquo;New Campaign&rdquo; to get started.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* Members — owner only */}
        {safeTab === "members" && (
          <div className="space-y-8">
            <h2 className="text-2xl font-serif font-bold text-gray-900">Members</h2>

            {/* Invite form */}
            <div className="border border-gray-200 rounded-xl p-6 space-y-4">
              <h3 className="text-base font-semibold text-gray-900">Invite a Member</h3>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => { setInviteEmail(e.target.value); setInviteError(""); setInviteSuccess(""); }}
                  placeholder="Email address"
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#8BC34A] focus:ring-1 focus:ring-[#8BC34A]"
                />
                <div className="relative">
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="pl-3 pr-8 py-2.5 border border-gray-200 rounded-lg text-sm appearance-none bg-white focus:outline-none focus:border-[#8BC34A] focus:ring-1 focus:ring-[#8BC34A]"
                  >
                    <option value="admin">Admin</option>
                    <option value="finance">Finance</option>
                    <option value="campaign_editor">Editor</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                <button
                  type="button"
                  onClick={handleInvite}
                  disabled={inviteLoading}
                  className="px-6 py-2.5 bg-[#8BC34A] text-white rounded-lg text-sm font-medium hover:bg-[#7CB342] transition-colors disabled:opacity-50 shrink-0"
                >
                  {inviteLoading ? "Inviting…" : "Invite"}
                </button>
              </div>
              {inviteError && <p className="text-sm text-red-600">{inviteError}</p>}
              {inviteSuccess && <p className="text-sm text-[#8BC34A] font-medium">{inviteSuccess}</p>}
              <p className="text-xs text-gray-400">
                <span className="font-medium">Admin</span> — full access except owner actions &nbsp;·&nbsp;
                <span className="font-medium">Finance</span> — bank &amp; payouts &nbsp;·&nbsp;
                <span className="font-medium">Editor</span> — campaigns only &nbsp;·&nbsp;
                <span className="font-medium">Viewer</span> — read only
              </p>
            </div>

            {/* Member list */}
            {roleChangeError && <p className="text-sm text-red-600">{roleChangeError}</p>}
            {membersLoading ? (
              <div className="flex justify-center py-12">
                <svg className="w-6 h-6 animate-spin text-[#8BC34A]" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              </div>
            ) : (
              <div className="space-y-2">
                {members.map((m) => (
                  <div key={m.member_id} className="flex items-center justify-between px-4 py-3 border border-gray-200 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="relative w-9 h-9 rounded-full overflow-hidden border-2 border-white shadow-sm shrink-0">
                        {m.avatar_url ? (
                          <Image src={m.avatar_url} alt={m.name} fill className="object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-white text-sm font-semibold">
                            {(m.name || m.email)[0]?.toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {[m.name, m.last_name].filter(Boolean).join(" ") || m.email}
                        </p>
                        <p className="text-xs text-gray-400">{m.email}</p>
                      </div>
                    </div>
                    {m.role === "owner" ? (
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${roleBadgeStyle("owner")}`}>Owner</span>
                    ) : (
                      <div className="relative">
                        <select
                          value={m.role}
                          disabled={roleChangeLoading === m.member_id}
                          onChange={(e) => handleRoleChange(m.member_id, e.target.value)}
                          className="pl-2.5 pr-7 py-1 border border-gray-200 rounded-lg text-xs appearance-none bg-white focus:outline-none focus:border-[#8BC34A] disabled:opacity-50"
                        >
                          <option value="admin">Admin</option>
                          <option value="finance">Finance</option>
                          <option value="campaign_editor">Editor</option>
                          <option value="viewer">Viewer</option>
                        </select>
                        <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Finance */}
        {safeTab === "finance" && (
          <div className="space-y-8">
            <h2 className="text-2xl font-serif font-bold text-gray-900">Finance</h2>

            {/* Saved accounts */}
            {savedDetails.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-gray-700">Saved Bank Accounts</h3>
                <div className="space-y-2">
                  {savedDetails.map((d) => (
                    <div key={d.id} className="flex items-center justify-between px-4 py-3 border border-gray-200 rounded-lg bg-[#F5F9F0]">
                      <div className="flex items-center gap-3">
                        <svg className="w-5 h-5 text-[#8BC34A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                        </svg>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{d.account_holder_name}</p>
                          <p className="text-xs text-gray-500 capitalize">{d.account_type} · ••••{d.account_number_last4} · Routing ••••{d.routing_number_last4}</p>
                        </div>
                      </div>
                      {d.is_default && (
                        <span className="text-xs font-medium text-[#8BC34A] bg-[#8BC34A]/10 px-2 py-0.5 rounded-full">Default</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add payment form */}
            <div className="border border-gray-200 rounded-xl p-6 space-y-6">
              <h3 className="text-base font-semibold text-gray-900">Add Bank Account</h3>

              {/* Account holder name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Account Holder Name</label>
                <input
                  type="text"
                  value={accountHolderName}
                  onChange={(e) => setAccountHolderName(e.target.value)}
                  placeholder="Full legal name"
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-[#8BC34A] focus:ring-1 focus:ring-[#8BC34A]"
                />
              </div>

              {/* Routing + account numbers */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Routing Number</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={9}
                    value={routingNumber}
                    onChange={(e) => setRoutingNumber(e.target.value.replace(/\D/g, "").slice(0, 9))}
                    onBlur={() => setRoutingTouched(true)}
                    placeholder="9-digit routing number"
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-1 ${
                      routingTouched && routingNumber.length > 0 && routingNumber.length !== 9
                        ? "border-red-300 focus:border-red-400 focus:ring-red-400"
                        : "border-gray-200 focus:border-[#8BC34A] focus:ring-[#8BC34A]"
                    }`}
                  />
                  {routingTouched && routingNumber.length > 0 && routingNumber.length !== 9 && (
                    <p className="mt-1 text-xs text-red-500">Must be exactly 9 digits</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Account Number</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))}
                    placeholder="Account number"
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-[#8BC34A] focus:ring-1 focus:ring-[#8BC34A]"
                  />
                </div>
              </div>

              {/* Confirm account number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Confirm Account Number</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={confirmAccountNumber}
                  onChange={(e) => setConfirmAccountNumber(e.target.value.replace(/\D/g, ""))}
                  placeholder="Re-enter account number"
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-1 ${
                    confirmAccountNumber && confirmAccountNumber !== accountNumber
                      ? "border-red-300 focus:border-red-400 focus:ring-red-400"
                      : "border-gray-200 focus:border-[#8BC34A] focus:ring-[#8BC34A]"
                  }`}
                />
                {confirmAccountNumber && confirmAccountNumber !== accountNumber && (
                  <p className="mt-1 text-xs text-red-500">Account numbers do not match</p>
                )}
              </div>

              {paymentError && <p className="text-sm text-red-600">{paymentError}</p>}
              {paymentSuccess && <p className="text-sm text-[#8BC34A] font-medium">Bank account saved successfully.</p>}

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleSavePayment}
                  disabled={paymentSaving}
                  className="px-8 py-3 bg-[#8BC34A] text-white rounded-lg font-medium hover:bg-[#7CB342] transition-colors disabled:opacity-50"
                >
                  {paymentSaving ? "Saving..." : "Save Payment Info"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Settings */}
        {safeTab === "settings" && (
          <div className="space-y-8 max-w-2xl">
            <h2 className="text-2xl font-serif font-bold text-gray-900">Settings</h2>

            {/* Logo upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Business Logo</label>
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-xl bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center shrink-0">
                  {settingsLogoPreview ? (
                    <Image src={settingsLogoPreview} alt="Logo preview" width={80} height={80} className="object-cover w-full h-full" />
                  ) : (
                    <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  )}
                </div>
                <div>
                  <input
                    ref={settingsLogoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setSettingsLogoFile(file);
                      setSettingsLogoPreview(URL.createObjectURL(file));
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => settingsLogoInputRef.current?.click()}
                    className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:border-[#8BC34A] hover:text-[#8BC34A] transition-colors"
                  >
                    {settingsLogoPreview ? "Change Logo" : "Upload Logo"}
                  </button>
                  <p className="text-xs text-gray-400 mt-1">PNG, JPG or GIF · max 5 MB</p>
                </div>
              </div>
            </div>

            {/* Profile info */}
            <div className="space-y-5">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Profile</h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Business Name</label>
                <input
                  type="text"
                  value={settingsName}
                  onChange={(e) => setSettingsName(e.target.value)}
                  placeholder="Your business name"
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#8BC34A] focus:ring-1 focus:ring-[#8BC34A]"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700">Description</label>
                  <span className={`text-xs ${settingsBio.length > 2000 ? "text-red-500" : "text-gray-400"}`}>
                    {settingsBio.length}/2000
                  </span>
                </div>
                <textarea
                  value={settingsBio}
                  onChange={(e) => setSettingsBio(e.target.value.slice(0, 2000))}
                  placeholder="Tell people about your organization..."
                  rows={4}
                  maxLength={2000}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#8BC34A] focus:ring-1 focus:ring-[#8BC34A] resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Website</label>
                <input
                  type="url"
                  value={settingsWebsite}
                  onChange={(e) => setSettingsWebsite(e.target.value)}
                  placeholder="https://yourwebsite.com"
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#8BC34A] focus:ring-1 focus:ring-[#8BC34A]"
                />
              </div>
            </div>

            {/* Contact info */}
            <div className="space-y-5">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Contact</h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                <input
                  type="tel"
                  value={settingsPhone}
                  onChange={(e) => setSettingsPhone(e.target.value)}
                  placeholder="(555) 000-0000"
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#8BC34A] focus:ring-1 focus:ring-[#8BC34A]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Street Address</label>
                <input
                  type="text"
                  value={settingsAddress}
                  onChange={(e) => setSettingsAddress(e.target.value)}
                  placeholder="123 Main St"
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#8BC34A] focus:ring-1 focus:ring-[#8BC34A]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">State</label>
                  <input
                    type="text"
                    value={settingsState}
                    onChange={(e) => setSettingsState(e.target.value)}
                    placeholder="e.g. California"
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#8BC34A] focus:ring-1 focus:ring-[#8BC34A]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Country</label>
                  <div className="relative">
                    <select
                      value={settingsCountry}
                      onChange={(e) => setSettingsCountry(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#8BC34A] focus:ring-1 focus:ring-[#8BC34A] appearance-none bg-white"
                    >
                      <option value="United States">United States</option>
                      <option value="Canada">Canada</option>
                      <option value="United Kingdom">United Kingdom</option>
                      <option value="Australia">Australia</option>
                      <option value="Germany">Germany</option>
                      <option value="France">France</option>
                    </select>
                    <svg className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Time Zone</label>
                <input
                  type="text"
                  value={settingsTimezone}
                  onChange={(e) => setSettingsTimezone(e.target.value)}
                  placeholder="e.g. America/Los_Angeles"
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#8BC34A] focus:ring-1 focus:ring-[#8BC34A]"
                />
              </div>
            </div>

            {settingsError && <p className="text-sm text-red-600">{settingsError}</p>}
            {settingsSuccess && <p className="text-sm text-[#8BC34A] font-medium">{settingsSuccess}</p>}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSaveSettings}
                disabled={settingsSaving}
                className="px-8 py-3 bg-[#8BC34A] text-white rounded-lg font-medium hover:bg-[#7CB342] transition-colors disabled:opacity-50"
              >
                {settingsSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        )}

      </main>
      <Footer />
    </div>
  );
}

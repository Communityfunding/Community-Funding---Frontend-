"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import {
  useCampaignDraft,
  saveDraftToBackend,
} from "../store/useCampaignDraft";
import { DraftDebug } from "@/app/create-project/component/draftDebug";

interface CollaboratorUI {
  key: string; // stable key for rendering
  email: string;
  role: "co-creator";
  status: "pending" | "verified";
}

// Debounce utility
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export default function PeoplePage() {
  const router = useRouter();
  const { user } = useUser();

  // Store selectors (hooks)
  const hasHydrated = useCampaignDraft((s) => s.hasHydrated);
  const campaignId = useCampaignDraft((s) => s.draft.campaign_id);
  const vanitySlug = useCampaignDraft((s) => s.draft.vanity_slug);
  const coCreators = useCampaignDraft((s) => s.draft.co_creators);
  const setPeople = useCampaignDraft((s) => s.setPeople);

  // Local state (hooks)
  const [newCollaboratorEmail, setNewCollaboratorEmail] = useState("");

  // ✅ NEW: touched flags (only show required UI after interaction)
  const [urlTouched, setUrlTouched] = useState(false);

  // Slug availability check
  const [slugCheckLoading, setSlugCheckLoading] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [inviteSaving, setInviteSaving] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [continueSaving, setContinueSaving] = useState(false);

  // Debounced slug check
  const checkSlugDebounced = useCallback(
    debounce(async (slug: string, excludeId: number | null) => {
      if (!slug || !slug.trim()) {
        setSlugAvailable(null);
        return;
      }

      setSlugCheckLoading(true);
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
        const params = new URLSearchParams({ slug });
        if (excludeId != null) params.set("campaign_id", String(excludeId));
        const res = await fetch(`${apiUrl}/api/campaigns/check-slug?${params}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setSlugAvailable(data.available);
      } catch (err) {
        console.error("Slug check failed:", err);
        setSlugAvailable(null);
      } finally {
        setSlugCheckLoading(false);
      }
    }, 500),
    []
  );

  // Effect to trigger check when slug changes
  useEffect(() => {
    checkSlugDebounced(vanitySlug || "", campaignId);
  }, [vanitySlug, campaignId, checkSlugDebounced]);

  // Derived state (hook)
  const collaboratorsUI: CollaboratorUI[] = useMemo(() => {
    const list = coCreators ?? [];
    return list.map((c, idx) => ({
      key: `${c.email}-${idx}`,
      email: c.email,
      role: "co-creator",
      status: "pending",
    }));
  }, [coCreators]);

  // ✅ Now it's safe to return early (after hooks)
  if (!hasHydrated) return null;

  const handleVanityChange = (raw: string) => {
    const sanitized = raw.toLowerCase().replace(/[^a-z0-9-]/g, "");
    // write immediately to store so Back works even without Next
    setPeople({ vanity_slug: sanitized });
    // Reset slug check when changing
    setSlugAvailable(null);
  };

  const handleAddCollaborator = async () => {
    const email = newCollaboratorEmail.trim().toLowerCase();
    if (!email) return;

    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!isValidEmail) {
      alert("Please enter a valid email address.");
      return;
    }

    const existing = (coCreators ?? []).some(
      (c) => c.email.trim().toLowerCase() === email
    );
    if (existing) {
      setNewCollaboratorEmail("");
      return;
    }

    const next = [...(coCreators ?? []), { email }];

    setPeople({ co_creators: next });
    setNewCollaboratorEmail("");
    setInviteError(null);

    // Persist to backend so invite emails can send (Resend) — local-only state does not trigger mail.
    setInviteSaving(true);
    try {
      await saveDraftToBackend(user ?? undefined);
    } catch (e) {
      console.error(e);
      setInviteError(
        e instanceof Error ? e.message : "Could not save draft or send invite.",
      );
    } finally {
      setInviteSaving(false);
    }
  };

  const handleRemoveCollaborator = (emailToRemove: string) => {
    const next = (coCreators ?? []).filter(
      (c) => c.email.trim().toLowerCase() !== emailToRemove.trim().toLowerCase()
    );

    setPeople({ co_creators: next });
  };

  const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    newCollaboratorEmail.trim()
  );

  const urlIsValid = (vanitySlug ?? "").trim().length > 0;
  const canContinue = urlIsValid && slugAvailable === true;

  const handleNext = async () => {
    if (!canContinue) return;

    setContinueSaving(true);
    setInviteError(null);
    try {
      await saveDraftToBackend(user ?? undefined);
      router.push("/create-project/payment");
    } catch (e) {
      console.error(e);
      setInviteError(
        e instanceof Error ? e.message : "Could not save draft. Try again.",
      );
    } finally {
      setContinueSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-serif font-bold text-gray-900 mb-2">
        Creator Profile
      </h1>
      <div className="space-y-8">
        {/* Vanity URL */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            URL
          </label>
          <div className="flex">
            <span className="inline-flex items-center px-4 bg-gray-100 border border-r-0 border-gray-300 rounded-l-lg text-gray-500 text-sm">
              communityfundings.com/project/
            </span>
            <input
              type="text"
              value={vanitySlug ?? ""}
              onChange={(e) => handleVanityChange(e.target.value)}
              onBlur={() => setUrlTouched(true)}
              placeholder="my-awesome-project"
              className="flex-1 px-4 py-3 border border-gray-300 rounded-r-lg focus:outline-none focus:ring-2 focus:ring-[#8BC34A] focus:border-transparent"
            />
          </div>
          <p className="mt-2 text-sm text-gray-500">
            Create a custom URL for your project page. Use only lowercase letters,
            numbers, and hyphens.
          </p>
          {urlTouched && !urlIsValid && (
            <p className="mt-2 text-sm text-red-500">
              Please enter a URL to continue.
            </p>
          )}

          {/* Slug Availability Status */}
          {vanitySlug && vanitySlug.trim() && (
            <div className="mt-2">
              {slugCheckLoading ? (
                <p className="text-sm text-gray-500">Checking availability...</p>
              ) : slugAvailable === true ? (
                <p className="text-sm text-green-600">✓ This URL is available!</p>
              ) : slugAvailable === false ? (
                <p className="text-sm text-red-600">✗ This URL is already taken.</p>
              ) : null}
            </div>
          )}
        </div>

        {/* Co-creators */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-4">
            Co-creators
          </label>

          {collaboratorsUI.length > 0 && (
            <div className="space-y-3 mb-6">
              {collaboratorsUI.map((collaborator) => (
                <div
                  key={collaborator.key}
                  className="flex items-center justify-between border border-gray-200 rounded-lg px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {collaborator.email}
                      </p>
                      <p className="text-xs text-gray-500 capitalize">
                        {collaborator.role}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">
                      Pending
                    </span>

                    <button
                      type="button"
                      onClick={() => handleRemoveCollaborator(collaborator.email)}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                      aria-label="Remove co-creator"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Invite co-creator */}
          <div className="border border-gray-200 rounded-lg p-6 bg-gray-50">
            <h4 className="text-sm font-medium text-gray-900 mb-4">
              Invite a co-creator
            </h4>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={newCollaboratorEmail}
                  onChange={(e) => setNewCollaboratorEmail(e.target.value)}
                  placeholder="communityfundings@email.com"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8BC34A] focus:border-transparent bg-white"
                />
              </div>

              <button
                type="button"
                onClick={handleAddCollaborator}
                disabled={!emailIsValid || inviteSaving}
                className="
                  w-full px-4 py-3 rounded-lg font-medium transition-colors
                  border border-[#8BC34A]
                  text-[#8BC34A]
                  bg-white
                  hover:bg-[#F5F9F0]
                  disabled:opacity-40 disabled:cursor-not-allowed
                "
              >
                {inviteSaving ? "Saving…" : "Send Invite"}
              </button>
            </div>

            {inviteError && (
              <p className="mt-2 text-sm text-red-600" role="alert">
                {inviteError}
              </p>
            )}

            <p className="mt-2 text-sm text-gray-500">
              Co-creators can edit this project and manage campaign details. Must be a valid email.
              Invites are sent after your draft is saved to the server (this button and Save &amp; Continue both save).
            </p>
          </div>
        </div>

        {/* Save & Continue */}
        <div className="mt-12 flex justify-between items-center gap-4 flex-wrap">
          <Link
            href={`/create-project/story${useCampaignDraft.getState().draft.campaign_id ? `?draft=${useCampaignDraft.getState().draft.campaign_id}` : ""}`}
            className="text-gray-500 px-8 py-3 rounded-full font-medium border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            Back
          </Link>
          <button
            type="button"
            onClick={handleNext}
            disabled={!canContinue || continueSaving}
            className={[
              "bg-[#8BC34A] text-white px-8 py-3 rounded-full font-medium transition-colors",
              canContinue && !continueSaving
                ? "hover:bg-[#7CB342]"
                : "opacity-50 cursor-not-allowed",
            ].join(" ")}
            aria-disabled={!canContinue || continueSaving}
            title={!canContinue ? "Please fill out the short bio, enter a valid and available URL to continue." : undefined}
          >
            {continueSaving ? "Saving…" : "Save and Continue"}
          </button>
        </div>
      </div>

      <DraftDebug />
    </div>
  );
}

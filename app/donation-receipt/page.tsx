"use client";

/* v100_donate_main — Donation receipt page (3 actions) */

import { Suspense, useEffect, useState} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

type Donation = {
  donation_id: string;
  campaign_id: number;
  campaign_title?: string;
  campaign_url?: string;
  amount: number | string;
  status: string;
  time_created?: string;
  created_at?: string;
  donor_email?: string;
  donor_name?: string;
  creator_name?: string;
  creator_username?: string;
};

function fmtReceiptDate(s: string | undefined | null): string {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) {
    // Try replacing space with T (Postgres timestamp format)
    const d2 = new Date(s.replace(" ", "T"));
    if (!isNaN(d2.getTime())) return d2.toLocaleString();
    return String(s);
  }
  return d.toLocaleString();
}


function _DonationReceiptInner() {
  const params = useSearchParams();
  const router = useRouter();
  const donationId = params.get("donation_id");
  const sessionId = params.get("session_id");

  const [donation, setDonation] = useState<Donation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [redirectIn, setRedirectIn] = useState(15);

  useEffect(() => {
    if (!donationId) {
      setError("No donation ID provided");
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const query = sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : "";
        const token = localStorage.getItem("cf_backend_token");
        const res = await fetch(
          `${API_URL}/api/donations-v2/donation/${encodeURIComponent(donationId)}${query}`,
          { headers: token ? { Authorization: `Bearer ${token}` } : {} }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) setDonation(data);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Failed to load donation");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [donationId, sessionId]);

  // Auto-redirect to home after 15s
  useEffect(() => {
    if (loading || error) return;
    const t = setInterval(() => {
      setRedirectIn((s) => {
        if (s <= 1) {
          clearInterval(t);
          router.push("/");
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [loading, error, router]);

  if (loading) return <CenterMsg msg="Loading your receipt…" />;
  if (error || !donation)
    return <ErrorCard message={error || "Donation not found"} />;

  const amt =
    typeof donation.amount === "string"
      ? parseFloat(donation.amount)
      : donation.amount;
  const campaignHref = donation.campaign_url
    ? `/project/${donation.campaign_url}`
    : `/project/${donation.campaign_id}`;
  const statusLower = (donation.status || "").toLowerCase();
  const isPaid = statusLower === "completed" || statusLower === "succeeded";
  const statusColor =
    statusLower === "completed" || statusLower === "succeeded"
      ? "text-green-600"
      : statusLower === "pending" || statusLower === "processing"
        ? "text-amber-600"
        : statusLower === "failed"
          ? "text-red-600"
          : "text-gray-600";

  return (
    <div className="min-h-screen bg-[#F5FAF5] flex items-center justify-center px-4 py-12">
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden max-w-md w-full">
        {/* Green header */}
        <div className="bg-[#8BC34A] px-8 py-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-[#7CB342] rounded-full flex items-center justify-center">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white mb-1">{isPaid ? "Thank You!" : "Payment status"}</h1>
          <p className="text-white/90">{isPaid ? "Your donation was successful" : "Your payment is not confirmed. Check the status below."}</p>
        </div>

        {/* Body */}
        <div className="px-8 py-8">
          <div className="text-center mb-6">
            <p className="text-4xl font-bold text-gray-900">
              ${isNaN(amt) ? "—" : amt.toFixed(2)}
            </p>
            <p className="text-gray-600 mt-2">
              to {donation.campaign_title || `Campaign #${donation.campaign_id}`}
            </p>
            {donation.creator_name && (
              <p className="text-gray-400 text-sm">by {donation.creator_name}</p>
            )}
          </div>

          <div className="border-t border-gray-100 pt-4 space-y-2.5 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Reference</span>
              <span className="text-gray-900 font-mono">
                #{donation.donation_id}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Status</span>
              <span className={`${statusColor} font-medium capitalize`}>
                {donation.status || "unknown"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Date</span>
              <span className="text-gray-900">
                {fmtReceiptDate(donation.time_created || donation.created_at)}
              </span>
            </div>
            {donation.donor_email && (
              <div className="flex justify-between">
                <span className="text-gray-500">Contact email</span>
                <span className="text-gray-900">{donation.donor_email}</span>
              </div>
            )}
          </div>

          {/* THREE BUTTONS — baked in */}
          <div className="mt-6 space-y-2">
            <Link
              href="/"
              className="block w-full bg-[#8BC34A] hover:bg-[#7CB342] text-white text-center py-3 rounded-lg font-medium transition-colors"
            >
              Back to home
            </Link>
            <Link
              href={campaignHref}
              className="block w-full bg-gray-100 hover:bg-gray-200 text-gray-900 text-center py-3 rounded-lg font-medium transition-colors"
            >
              View campaign
            </Link>
            {/* v100_ledger_btn */}
            <Link
              href="/ledger"
              className="block w-full bg-white border-2 border-[#8BC34A] text-[#8BC34A] hover:bg-[#F0F7E8] text-center py-3 rounded-lg font-medium transition-colors"
            >
              View My Donations
            </Link>
          </div>

          <p className="text-center text-xs text-gray-400 mt-4">
            Redirecting in {redirectIn}s…
          </p>
        </div>
      </div>
    </div>
  );
}

function CenterMsg({ msg }: { msg: string }) {
  return (
    <div className="min-h-screen bg-[#F5FAF5] flex items-center justify-center">
      <div className="text-gray-500">{msg}</div>
    </div>
  );
}

function ErrorCard({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-[#F5FAF5] flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-sm p-8 max-w-md text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Receipt unavailable
        </h1>
        <p className="text-gray-500 mb-4">{message}</p>
        <Link
          href="/"
          className="inline-block bg-[#8BC34A] text-white px-6 py-3 rounded-lg font-medium hover:bg-[#7CB342]"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}

export default function DonationReceiptPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>}>
      <_DonationReceiptInner />
    </Suspense>
  );
}


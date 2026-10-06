"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import {
  useCampaignDraft,
  saveDraftToBackend,
} from "@/app/create-project/store/useCampaignDraft";
import { photosPayloadForApi } from "@/app/create-project/lib/campaignPhotoUpload";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function PaymentPage() {
  const router = useRouter();
  const { user, isLoaded: userLoaded } = useUser();

  const hasHydrated = useCampaignDraft((s) => s.hasHydrated);
  const setPayment = useCampaignDraft((s) => s.setPayment);

  const [contactEmail, setContactEmail] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [accountHolderName, setAccountHolderName] = useState("");
  const [routingNumber, setRoutingNumber] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [confirmAccountNumber, setConfirmAccountNumber] = useState("");
  const [routingTouched, setRoutingTouched] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [openModal, setOpenModal] = useState<"tos" | "organizer" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const hydratedPaymentOnce = useRef(false);
  useEffect(() => {
    if (!hasHydrated || hydratedPaymentOnce.current) return;
    hydratedPaymentOnce.current = true;
    const p = useCampaignDraft.getState().draft.payment;
    setAccountHolderName(p.account_holder_name);
    setRoutingNumber(p.routing_number.replace(/\D/g, "").slice(0, 9));
    setAccountNumber(p.account_number);
    setConfirmAccountNumber(p.confirm_account_number);
  }, [hasHydrated]);

  const routingValid = routingNumber.length === 9;
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim());
  const accountsMatch =
    accountNumber.length > 0 && confirmAccountNumber === accountNumber;

  const canSubmit = useMemo(() => {
    if (!userLoaded || !hasHydrated) return false;
    if (!user?.id) return false;
    return (
      emailVerified &&
      emailOk &&
      accountHolderName.trim().length > 0 &&
      routingValid &&
      accountNumber.length > 0 &&
      accountsMatch &&
      termsAccepted
    );
  }, [
    userLoaded,
    hasHydrated,
    user?.id,
    emailVerified,
    emailOk,
    accountHolderName,
    routingValid,
    accountNumber.length,
    accountsMatch,
    termsAccepted,
  ]);

  const handleVerifyEmail = () => {
    if (contactEmail && emailOk) {
      setEmailVerified(true);
    }
  };

  const handleSubmitForReview = async () => {
    if (!canSubmit || submitting) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      setPayment({
        account_type: "individual",
        account_holder_name: accountHolderName.trim(),
        routing_number: routingNumber,
        account_number: accountNumber,
        confirm_account_number: confirmAccountNumber,
      });

      if (!user?.id) {
        throw new Error("You must be signed in to submit your campaign.");
      }

      await saveDraftToBackend(user);

      const { draft: d } = useCampaignDraft.getState();
      if (!d.campaign_id) {
        throw new Error("Could not save your draft. Please try again.");
      }

      const res = await fetch(`${API_URL}/api/campaigns/finalize`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("cf_backend_token") || ""}`,
        },
        body: JSON.stringify({
          creator_id: user.id,
          campaign_id: d.campaign_id,
          title: d.title,
          vanity_slug: d.vanity_slug,
          category: d.category,
          location: d.location,
          funding_goal_cents: d.funding_goal_cents,
          duration_days: d.duration_days,
          description_html: d.description_html,
          bio: d.bio,
          faqs: d.faqs,
          rewards: d.rewards,
          co_creators: d.co_creators,
          photos: photosPayloadForApi(d.photos),
          payment: {
            account_type: "individual",
            account_holder_name: accountHolderName.trim(),
            routing_number: routingNumber,
            account_number: accountNumber,
            contact_email: contactEmail.trim(),
          },
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Submission failed");
      }

      router.push("/create-project/submitted");
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
    <div className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-serif font-bold text-gray-900 mb-2">
        Payment details
      </h1>
      <p className="text-gray-600 mb-8">
        Connect your Stripe account to receive funds from your campaign.
      </p>

      <div className="space-y-8">
        {/* Contact Email Section */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Contact Email
          </label>
          <p className="text-sm text-gray-500 mb-4">
            This email will be used for important notifications about your campaign and payments.
          </p>

          <div className="border border-gray-200 rounded-lg p-6 bg-gray-50">
            <div className="flex gap-4">
              <div className="flex-1">
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => {
                    setContactEmail(e.target.value);
                    setEmailVerified(false);
                  }}
                  placeholder="your@email.com"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8BC34A] focus:border-transparent bg-white"
                />
              </div>
              <button
                onClick={handleVerifyEmail}
                disabled={emailVerified}
                className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                  emailVerified
                    ? "bg-green-100 text-green-700 cursor-default"
                    : "bg-[#8BC34A] text-white hover:bg-[#7CB342]"
                }`}
              >
                {emailVerified ? (
                  <span className="flex items-center gap-2">
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    Verified
                  </span>
                ) : (
                  "Verify"
                )}
              </button>
            </div>
            {emailVerified && (
              <p className="mt-3 text-sm text-green-600 flex items-center gap-2">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                A verification link has been sent to your email.
              </p>
            )}
          </div>
        </div>

        {/* Bank Account Section */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Bank Account
          </label>
          <p className="text-sm text-gray-500 mb-4">
            Enter your bank details to receive funds. All information is securely encrypted.
          </p>

          <div className="border border-gray-200 rounded-lg p-6 bg-white">
            {/* Account Holder Name */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Account Holder Name
              </label>
              <input
                type="text"
                value={accountHolderName}
                onChange={(e) => setAccountHolderName(e.target.value)}
                placeholder="Enter name as it appears on account"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8BC34A] focus:border-transparent"
              />
            </div>

            {/* Routing Number */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Routing Number
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={routingNumber}
                  onChange={(e) => setRoutingNumber(e.target.value.replace(/\D/g, "").slice(0, 9))}
                  onBlur={() => setRoutingTouched(true)}
                  placeholder="9 digits"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8BC34A] focus:border-transparent pr-12"
                />
                <svg
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
              {routingTouched && !routingValid && (
                <p className="mt-2 text-sm text-red-500">
                  Routing number must be exactly 9 digits.
                </p>
              )}
            </div>

            {/* Account Number */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Account Number
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))}
                  placeholder="Enter account number"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8BC34A] focus:border-transparent pr-12"
                />
                <svg
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
            </div>

            {/* Confirm Account Number */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Confirm Account Number
              </label>
              <input
                type="password"
                value={confirmAccountNumber}
                onChange={(e) => setConfirmAccountNumber(e.target.value.replace(/\D/g, ""))}
                placeholder="Re-enter account number"
                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8BC34A] focus:border-transparent ${
                  confirmAccountNumber && confirmAccountNumber !== accountNumber
                    ? "border-red-300"
                    : "border-gray-300"
                }`}
              />
              {confirmAccountNumber && confirmAccountNumber !== accountNumber && (
                <p className="mt-2 text-sm text-red-500">
                  Account numbers do not match
                </p>
              )}
            </div>
          </div>

          {/* Security Notice */}
          <div className="mt-4 flex items-start gap-3 text-sm text-gray-500">
            <svg
              className="w-5 h-5 text-[#8BC34A] flex-shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
            <p>
              Your bank information is encrypted and stored securely. We use industry-standard security measures to protect your data.
            </p>
          </div>
        </div>

        {/* Terms Agreement */}
        <div className="border border-gray-200 rounded-lg p-6 bg-[#F5F9F0]">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="w-5 h-5 mt-0.5 text-[#8BC34A] rounded focus:ring-[#8BC34A]"
            />
            <span className="text-sm text-gray-700">
              I agree to the{" "}
              <button type="button" onClick={() => setOpenModal("tos")} className="text-[#8BC34A] hover:underline font-medium">
                Terms of Service
              </button>
              . I understand that Community Fundings will collect a 5% platform fee and payment processing fees from successfully funded projects.
            </span>
          </label>
        </div>
      </div>

      {submitError && (
        <p className="mt-6 text-sm text-red-600" role="alert">
          {submitError}
        </p>
      )}

      {/* Submit Button */}
      <div className="mt-12 flex justify-between items-center gap-4 flex-wrap">
        <Link
          href={`/create-project/people${useCampaignDraft.getState().draft.campaign_id ? `?draft=${useCampaignDraft.getState().draft.campaign_id}` : ""}`}
          className="text-gray-500 px-8 py-3 rounded-full font-medium border border-gray-300 hover:bg-gray-50 transition-colors"
        >
          Back
        </Link>
        <button
          type="button"
          disabled={!canSubmit || submitting}
          onClick={handleSubmitForReview}
          title={
            !canSubmit && userLoaded && hasHydrated
              ? "Complete email verification, bank details, and accept the terms to submit."
              : undefined
          }
          className={`px-8 py-3 rounded-full font-medium transition-colors ${
            !canSubmit || submitting
              ? "bg-gray-200 text-gray-500 cursor-not-allowed"
              : "bg-[#8BC34A] text-white hover:bg-[#7CB342]"
          }`}
        >
          {submitting ? "Submitting…" : "Submit for Review"}
        </button>
      </div>
    </div>

    {/* Terms of Service Modal */}
    {openModal === "tos" && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/50" onClick={() => setOpenModal(null)}>
        <div className="relative bg-white rounded-2xl shadow-xl border-4 border-gray-300 w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
          {/* X button */}
          <button
            type="button"
            onClick={() => setOpenModal(null)}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 transition-colors z-10"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Modal Header */}
          <div className="px-6 pt-6 pb-4 border-b border-gray-200">
            <h2 className="font-bold text-gray-900 pr-8">Terms of Service</h2>
          </div>

          {/* Modal Body */}
          <div className="overflow-y-auto px-6 py-6 text-sm text-gray-700 space-y-6" style={{ maxHeight: "55vh" }}>
            <p className="text-xs text-gray-400 font-mono">Effective Date: February 22, 2026 | Jurisdiction: Las Vegas, Nevada</p>
            <p className="text-xs text-gray-500 border-l-4 border-gray-200 pl-3 italic">PLEASE READ THESE TERMS CAREFULLY. BY USING THE PLATFORM YOU AGREE TO BE BOUND BY THEM.</p>
            {[
              { title: "I. PLATFORM ROLE & OVERVIEW", body: ["1.1 Nature of Service. Community Fundings is a crowdfunding platform that connects Campaign Organizers with Backers. We are a facilitator, not a creator, manufacturer, or guarantor.", "1.2 No Guarantee. Community Fundings does not guarantee the success, completion, legality, or quality of any project. Backing a campaign carries inherent risk.", "1.3 Independent Contracts. When a campaign is successfully funded, a contract forms directly between the Organizer and each Backer. Community Fundings is not a party to that contract.", "1.4 Platform Changes. We reserve the right to modify, suspend, or discontinue any part of our services at any time."] },
              { title: "II. ELIGIBILITY", body: ["2.1 Minimum Age. You must be at least 18 years of age. Users 13–17 may use the platform only with verifiable parental consent.", "2.2 Legal Capacity. You represent that you have the legal capacity to enter into a binding agreement.", "2.3 Account Accuracy. You agree to provide accurate, current, and complete information during registration.", "2.4 Account Security. You are responsible for maintaining the confidentiality of your account credentials."] },
              { title: "III. BENEFIT CORPORATION STATUS", body: ["3.1 Mission-Driven Entity. Community Fundings is a Nevada Benefit Corporation (NRS Chapter 78B), legally required to consider stakeholder interests and mission alongside financial performance.", "3.2 Mission Charter. Our mission is to bring creative projects to life and fight inequality.", "3.3 Annual Benefit Statement. We publish an Annual Benefit Statement using aggregated, non-identifiable campaign data.", "3.4 Campaign Rejection. We reserve the right to reject or remove campaigns that contradict our Mission Charter."] },
              { title: "IV. PLATFORM FEES", body: ["4.1 Platform Fee. Community Fundings retains 5% of total funds raised upon successful campaign conclusion. Non-refundable.", "4.2 Processing Fees. Third-party processors charge approximately 2.9% + $0.30 per transaction. Non-refundable.", "4.3 Failed Campaigns. If a campaign does not reach its goal, backers are not charged and no fees are collected.", "4.4 Fee Changes. We reserve the right to modify fees with 30 days' notice.", "4.5 Payouts. Funds are disbursed within 14 business days of successful conclusion, pending KYC completion."] },
              { title: "V. ACCEPTABLE USE POLICY", body: ["5.1 Prohibited Content. You may not use the platform for: illegal activities; weapons; MLM schemes; misleading claims; hate speech; IP violations; or content violating our Non-Discrimination Policy.", "5.2 Honesty Requirement. All campaign representations must be truthful. Organizers must distinguish between finished products and prototypes.", "5.3 Enforcement. Violations may result in campaign removal, account suspension, forfeiture of fees, and/or referral to law enforcement."] },
              { title: "VI. CAMPAIGN ORGANIZER AGREEMENT", body: ["6.1 Independent Creator. Organizers are independent creators. No partnership, joint venture, or employment relationship is created.", "6.2 Fulfillment Obligation. Upon successful funding, Organizers must fulfill all promised rewards or refund backers.", "6.3 Update Requirement. Organizers must post updates at least every 30 days if a project is delayed.", "6.4 Nevada Consumer Protection. Organizers agree to comply with all applicable Nevada consumer protection statutes.", "6.5 Tax Responsibility. Organizers are solely responsible for all applicable taxes. IRS Form 1099-K may apply.", "6.6 IP License. Organizers retain 100% ownership of their work and grant Community Fundings a non-exclusive license to use campaign media for promotion.", "6.7 Indemnification. Organizers agree to hold Community Fundings harmless from claims arising from their project."] },
              { title: "VII. NON-DISCRIMINATION POLICY", body: ["7.1 Commitment. We prohibit discrimination based on race, ethnicity, national origin, religion, sex, gender identity, sexual orientation, disability, age, genetic information, military status, or pregnancy.", "7.2 Zero Tolerance for Hate Speech. Campaigns containing hate speech will be removed immediately without refund of platform fees.", "7.3 Equity Initiatives. We actively seek to highlight campaigns from underrepresented communities.", "7.4 Accessibility. We strive to meet WCAG 2.1 Level AA standards.", "7.5 Reporting. Report violations via the Report this Project button or equity@communityfundings.com."] },
              { title: "VIII. REFUND POLICY", body: ["8.1 Nature of Crowdfunding. Backing a project is not purchasing a finished product.", "8.2 Pre-Campaign Cancellation. Backers may cancel pledges before the campaign deadline via Account Settings.", "8.3 Post-Campaign. Once a campaign is funded and closed, Community Fundings does not issue refunds.", "8.4 Organizer Responsibility. Refund requests after close must go directly to the Campaign Organizer.", "8.5 Fraudulent Campaigns. We reserve the right to issue refunds if a campaign is found fraudulent prior to disbursement.", "8.6 Chargebacks. Unwarranted chargebacks may result in permanent account suspension."] },
              { title: "IX. PRIVACY & COOKIES", body: ["9.1 Data Collection. We collect identifiers, payment info (via processor), creative data, and technical data.", "9.2 Use of Data. Data is used to facilitate crowdfunding, verify identity, and produce social impact reports.", "9.3 Data Sharing. We do not sell personal information. We share only with Organizers (for reward fulfillment), service providers, and as required by law.", "9.4 Nevada/CCPA/GDPR Rights. Contact privacy@communityfundings.com to exercise your data rights.", "9.5 Cookies. We use essential and performance cookies. We honor Global Privacy Control (GPC) signals."] },
              { title: "X. LIMITATION OF LIABILITY", body: ["10.1 No Warranty. THE PLATFORM IS PROVIDED 'AS IS' WITHOUT WARRANTIES OF ANY KIND.", "10.2 Liability Cap. COMMUNITY FUNDINGS' TOTAL LIABILITY SHALL NOT EXCEED PLATFORM FEES COLLECTED FROM YOUR SPECIFIC CAMPAIGN OR $100, WHICHEVER IS GREATER.", "10.3 Exclusion of Damages. WE ARE NOT LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, OR CONSEQUENTIAL DAMAGES."] },
              { title: "XI. GOVERNING LAW & DISPUTES", body: ["11.1 Governing Law. These Terms are governed by Nevada law.", "11.2 Venue. Legal actions must be filed in Clark County, Nevada.", "11.3 Informal Resolution. Both parties agree to attempt mediation for 30 days before filing a formal claim.", "11.4 Class Action Waiver. TO THE EXTENT PERMITTED BY LAW, YOU WAIVE ANY RIGHT TO CLASS ACTION LITIGATION AGAINST COMMUNITY FUNDINGS."] },
            ].map(({ title, body }) => (
              <div key={title}>
                <h3 className="font-bold text-gray-900 text-xs uppercase tracking-wide border-b border-gray-200 pb-1 mb-2">{title}</h3>
                <div className="space-y-1.5">
                  {body.map((p, i) => <p key={i} className="leading-relaxed text-xs text-gray-600">{p}</p>)}
                </div>
              </div>
            ))}
          </div>

          {/* Agree Button */}
          <div className="px-6 py-4 border-t border-gray-200">
            <button
              type="button"
              onClick={() => { setTermsAccepted(true); setOpenModal(null); }}
              className="w-full py-2.5 bg-[#8BC34A] hover:bg-[#7CB342] text-white rounded-lg text-sm font-semibold transition-colors"
            >
              I Agree
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

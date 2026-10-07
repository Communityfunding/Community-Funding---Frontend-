"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import { useParams, useRouter } from "next/navigation";
import Header from "../../components/Header";
import Footer from "../../components/Footer";

type Campaign = {
  campaign_id: number;
  creator_id: string;
  title: string;
  status: string;
  time_created: string;
  url: string;
  updated_at: string;
  description_html: string;
  category: string;
  location: string;
  funding_goal_cents: number;
  duration_days: number;
  amount_raised_cents: number;
  backers: number;
};

type Creator = {
  creator_id: string;
  username?: string | null;
  name: string;
  last_name: string;
  email: string;
  bio?: string;
  avatar_url?: string | null;
  user_type?: number | null;
};

type Faq = {
  question: string;
  answer: string;
  display_order?: number;
};

type Reward = {
  reward_id: number;
  title: string;
  description: string;
  required_amount_cents: number;
};

type CommentId = string | number;
type Comment = {
  comment_id: CommentId;
  comment_text: string;
  creator_id: string;
  username?: string | null;
  campaign_id: number;
  parent_comment_id?: CommentId | null;
  reply_to_comment_id?: CommentId | null;
  reply_to_name?: string | null;
  name?: string;
  last_name?: string;
  avatar_url?: string | null;
  user_type?: number | null;
  time_created: string;
  updated_at?: string | null;
  was_edited?: boolean;
  like_count: number;
  liked_by_viewer: boolean;
  replies: Comment[];
  reply_count: number;
  has_more_replies: boolean;
  is_you: boolean;
  is_friend: boolean;
  is_project_owner: boolean;
  is_project_collaborator: boolean;
};

type Photo = {
  photo_id: number;
  campaign_id: number;
  s3_bucket: string;
  s3_key: string;
  content_type: string;
  is_primary: boolean;
  image_url: string;
};

type CommentsPagination = {
  page: number;
  per_page: number;
  total_parent_comments: number;
  total_pages: number;
};

type Collaborator = {
  collaborator_id: number;
  campaign_id: number;
  email: string;
  status: string;
  time_created: string;
  creator_id: string;
  username?: string | null;
  name: string;
  last_name?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  user_type?: number | null;
};

type ViewerPermissions = {
  is_owner: boolean;
  is_collaborator: boolean;
  has_pending_invite: boolean;
  can_view: boolean;
  can_comment: boolean;
  supports_comment_threads?: boolean;
};

type CampaignPageData = {
  campaign: Campaign;
  creator: Creator | null;
  collaborators: Collaborator[];
  viewer_permissions?: ViewerPermissions;
  viewer_engagement?: {
    is_saved?: boolean;
  };
  faqs: Faq[];
  rewards: Reward[];
  photos: Photo[];
  comments: Comment[];
  comments_pagination: CommentsPagination;
};

const COMMENT_MAX_LENGTH = 1000;

function formatUSD(cents?: number) {
  if (typeof cents !== "number") return "";

  return (cents / 100).toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function formatCampaignStatus(status?: string) {
  if (!status) return "";
  if (status === "pending_review") return "Pending";
  return status
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatCommentDate(dateString?: string) {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatCommentDateTime(dateString?: string) {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatTimeAgo(dateString?: string | null) {
  if (!dateString) return "";
  const date = new Date(dateString);
  const diffMs = Date.now() - date.getTime();
  const seconds = Math.max(1, Math.floor(diffMs / 1000));
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return `${seconds}s ago`;
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30) return `${days}d ago`;

  return formatCommentDate(dateString);
}

function isEdited(comment: Comment) {
  if (typeof comment.was_edited === "boolean") return comment.was_edited;
  if (!comment.updated_at) return false;
  return new Date(comment.updated_at).getTime() - new Date(comment.time_created).getTime() > 5000;
}

function getEditedLabel(comment: Comment) {
  if (!isEdited(comment)) return "";
  return `Last edited ${formatTimeAgo(comment.updated_at)}`;
}

function getCommentAuthor(comment: Comment) {
  return [comment.name, comment.last_name].filter(Boolean).join(" ").trim() || comment.username || comment.creator_id || "Unknown User";
}

function getProfileHref(person?: { username?: string | null; creator_id?: string | null }) {
  if (person?.username) return `/profile/${person.username}`;
  if (person?.creator_id) return `/profile/${person.creator_id}`;
  return "#";
}

function getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("cf_backend_token");
  if (!token || token === "undefined" || token === "null") return {};
  return { Authorization: `Bearer ${token}` };
}

function Avatar({
  name,
  avatarUrl,
  size = "md",
}: {
  name?: string | null;
  avatarUrl?: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClasses =
    size === "sm"
      ? "w-9 h-9 text-xs"
      : size === "lg"
        ? "w-12 h-12 text-base"
        : "w-11 h-11 text-sm";

  if (avatarUrl) {
    const pixelSize = size === "sm" ? 36 : size === "lg" ? 48 : 44;
    return (
      <Image
        src={avatarUrl}
        alt={name || "User"}
        width={pixelSize}
        height={pixelSize}
        className={`${sizeClasses} rounded-full object-cover flex-shrink-0`}
      />
    );
  }

  return (
    <div className={`${sizeClasses} rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-white font-semibold flex-shrink-0`}>
      {name?.[0]?.toUpperCase() ?? "U"}
    </div>
  );
}

function CommentBadges({ comment }: { comment: Comment }) {
  return (
    <>
      {comment.user_type === 0 && (
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
          Business
        </span>
      )}

      {comment.is_you && (
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-600 border border-blue-200">
          You
        </span>
      )}

      {comment.is_friend && !comment.is_you && (
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[#F5F9F0] text-[#6E9E36] border border-[#8BC34A]/20">
          Friend
        </span>
      )}

      {comment.is_project_owner && (
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
          Campaign Owner
        </span>
      )}

      {comment.is_project_collaborator && !comment.is_project_owner && (
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
          Campaign Collaborator
        </span>
      )}
    </>
  );
}

function CommentHeader({ comment, compact = false }: { comment: Comment; compact?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 mb-1">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={getProfileHref(comment)}
            className={`font-semibold text-gray-900 hover:text-[#8BC34A] transition-colors ${compact ? "text-sm" : ""}`}
          >
            {getCommentAuthor(comment)}
          </Link>
          <CommentBadges comment={comment} />
        </div>
        <Link
          href={getProfileHref(comment)}
          className="text-xs text-gray-500 hover:text-[#8BC34A] transition-colors block w-fit"
        >
          {comment.username ? `@${comment.username}` : comment.creator_id}
        </Link>
      </div>

      <span
        title={formatCommentDateTime(comment.time_created)}
        className="text-xs text-gray-500 whitespace-nowrap cursor-default rounded-md border border-transparent hover:border-gray-200 hover:bg-gray-50 px-2 py-1 transition-colors"
      >
        {formatTimeAgo(comment.time_created)}
      </span>
    </div>
  );
}

function CommentMeta({ comment }: { comment: Comment }) {
  const edited = getEditedLabel(comment);
  if (!edited) return null;

  return <p className="text-xs text-gray-400 mt-2">{edited}</p>;
}

function BookmarkButton({
  isSaved,
  isSubmitting,
  onClick,
}: {
  isSaved: boolean;
  isSubmitting: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={isSubmitting}
      aria-label={isSaved ? "Unsave campaign" : "Save campaign"}
      title={isSaved ? "Saved" : "Save campaign"}
      className="inline-flex items-center justify-center w-11 h-11 rounded-full border border-gray-200 bg-white text-gray-700 hover:border-[#8BC34A] hover:text-[#8BC34A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <svg
        className="w-5 h-5"
        viewBox="0 0 24 24"
        fill={isSaved ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M6 3h12a1 1 0 011 1v17l-7-4-7 4V4a1 1 0 011-1z"
        />
      </svg>
    </button>
  );
}

export default function ProjectDetail() {
  // v100_t25_report_button — report campaign state
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportNotes, setReportNotes] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportError, setReportError] = useState("");
  const [reportSuccess, setReportSuccess] = useState(false);

  const { user } = useUser();
  const { getToken } = useAuth();
  // v100_t25_report_button — submit report handler
  const submitReport = async () => {
    if (!user) {
      setReportError("Please sign in to report a campaign");
      return;
    }
    if (!reportReason) {
      setReportError("Please select a reason");
      return;
    }
    setReportError("");
    setReportSubmitting(true);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";
      const cid = (campaign as any)?.campaign_id || (campaign as any)?.id;
      const r = await fetch(`${apiBase}/api/reports/campaign/${cid}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reporter_clerk_id: user.id,
          reason: reportReason,
          notes: reportNotes || undefined,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        setReportSuccess(true);
        setTimeout(() => {
          setShowReportModal(false);
          setReportSuccess(false);
          setReportReason("");
          setReportNotes("");
        }, 1800);
      } else {
        setReportError(typeof d.detail === "string" ? d.detail : "Failed to submit report");
      }
    } catch {
      setReportError("Network error");
    } finally {
      setReportSubmitting(false);
    }
  };
  const router = useRouter();
  const params = useParams<{ url: string }>();
  const url = params?.url;

  const [data, setData] = useState<CampaignPageData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [isSaveSubmitting, setIsSaveSubmitting] = useState(false);

  const [commentText, setCommentText] = useState("");
  const [isCommentSubmitting, setIsCommentSubmitting] = useState(false);

  const [replyingToParentId, setReplyingToParentId] = useState<CommentId | null>(null);
  const [replyingToComment, setReplyingToComment] = useState<Comment | null>(null);
  const [replyText, setReplyText] = useState("");
  const [isReplySubmitting, setIsReplySubmitting] = useState(false);

  const [editingCommentId, setEditingCommentId] = useState<CommentId | null>(null);
  const [commentToRemove, setCommentToRemove] = useState<CommentId | null>(null);
  const [editText, setEditText] = useState("");
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);

  const [commentPage, setCommentPage] = useState(1);
  const [loadingRepliesFor, setLoadingRepliesFor] = useState<CommentId | null>(null);
  const [reportingCommentId, setReportingCommentId] = useState<CommentId | null>(null);
  const [isCampaignReporting, setIsCampaignReporting] = useState(false);
  const [isLeavingCampaign, setIsLeavingCampaign] = useState(false);

  /* v100_donate_main — donation modal state */
  const PRESET_AMOUNTS = [10, 25, 50, 100];
  const [showDonateModal, setShowDonateModal] = useState(false);
  const [donateAmount, setDonateAmount] = useState<string>("25");
  const [donateCustom, setDonateCustom] = useState<string>("");
  const [donorName, setDonorName] = useState<string>("");
  const [donorEmail, setDonorEmail] = useState<string>("");
  const [donateMessage, setDonateMessage] = useState<string>("");
  const [donateAnonymous, setDonateAnonymous] = useState<boolean>(false);
  const [donateLoading, setDonateLoading] = useState<boolean>(false);
  const [donateError, setDonateError] = useState<string>("");
  const [eligibilityAccepted, setEligibilityAccepted] = useState<boolean>(false);

  /* v100_donate_main — Stripe checkout handler */
  async function handleBackProject(amount?: string): Promise<void> {
    setDonateError("");
    const finalAmount = parseFloat(amount || donateCustom || donateAmount);
    if (isNaN(finalAmount) || finalAmount <= 0) {
      setDonateError("Please enter a valid amount");
      return;
    }
    if (!data?.campaign?.campaign_id) {
      setDonateError("Campaign not loaded");
      return;
    }
    setDonateLoading(true);
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const token = user ? await getToken() : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };


      // Guest contributions remain supported; signed-in donors use a verified Clerk token.
      if (user && !token) throw new Error("Your session expired. Please sign in again.");
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/api/donations-v2/create-checkout-session`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          campaign_id: data.campaign.campaign_id,
          amount: finalAmount,
          donor_name: donorName || "Anonymous",
          donor_email: donorEmail || null,
          is_anonymous: donateAnonymous,
          message: donateMessage || null,
          donor_clerk_id: user?.id ?? null, /* v100_donor_link */
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setDonateError(err.detail || `Failed (HTTP ${res.status})`);
        setDonateLoading(false);
        return;
      }
      const out = await res.json();
      if (out.checkout_url) {
        window.location.href = out.checkout_url;
      } else {
        setDonateError("No checkout URL returned");
        setDonateLoading(false);
      }
    } catch (e) {
      setDonateError("Network error — is the backend running?");
      setDonateLoading(false);
    }
  }
  /* /v100_donate_main */

  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "most_liked">("newest");

  async function loadCampaignPage(targetPage: number, targetSortBy: "newest" | "oldest" | "most_liked" = sortBy) {
    if (!url) return;

    try {
      setError(null);
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

      const params = new URLSearchParams({
        page: String(targetPage),
        sort_by: targetSortBy,
      });

      const res = await fetch(`${API_BASE}/api/campaign-page/${url}?${params.toString()}`, {
        cache: "no-store",
        headers: getAuthHeaders(),
      });

      if (!res.ok) throw new Error(`Failed: ${res.status}`);

      const json = (await res.json()) as CampaignPageData;
      setData(json);
      setCommentPage(json.comments_pagination?.page ?? targetPage);
      setSortBy(targetSortBy);
      setCurrentPhotoIndex(0);
    } catch (e: any) {
      setError(e?.message ?? "Unknown error");
    }
  }

  useEffect(() => {
    if (!url) return;
    loadCampaignPage(1);
  }, [url]);

  async function handleToggleSave() {
    if (!url || !user || !data) return;

    try {
      setIsSaveSubmitting(true);
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      const isSaved = Boolean(data.viewer_engagement?.is_saved);

      const res = await fetch(`${API_BASE}/api/saved-campaigns/${url}`, {
        method: isSaved ? "DELETE" : "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Failed to ${isSaved ? "unsave" : "save"} campaign: ${res.status}`);
      }

      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          viewer_engagement: {
            ...(prev.viewer_engagement ?? {}),
            is_saved: !isSaved,
          },
        };
      });
    } catch (err: any) {
      console.error(err);
      alert(err?.message || "Could not update saved state.");
    } finally {
      setIsSaveSubmitting(false);
    }
  }

  async function handleSubmitComment() {
    if (!url || !commentText.trim()) return;

    try {
      setIsCommentSubmitting(true);

      const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

      const res = await fetch(`${API_BASE}/api/campaign-page/${url}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          comment_text: commentText.trim(),
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Failed to post comment: ${res.status}`);
      }

      setCommentText("");
      await loadCampaignPage(1);
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "Could not post comment.";
      alert(msg.length > 200 ? `${msg.slice(0, 200)}…` : msg);
    } finally {
      setIsCommentSubmitting(false);
    }
  }

  async function handleSubmitReply(parentCommentId: CommentId) {
    if (!url || !replyText.trim()) return;

    try {
      setIsReplySubmitting(true);

      const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

      const res = await fetch(`${API_BASE}/api/campaign-page/${url}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          comment_text: replyText.trim(),
          parent_comment_id: parentCommentId,
          reply_to_comment_id: replyingToComment?.comment_id ?? null,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Failed to post reply: ${res.status}`);
      }

      const json = (await res.json()) as { comment: Comment };

      setData((prev) => {
        if (!prev) return prev;

        return {
          ...prev,
          comments: prev.comments.map((comment) =>
            comment.comment_id === parentCommentId
              ? {
                  ...comment,
                  replies: [...comment.replies, json.comment],
                  reply_count: comment.reply_count + 1,
                  has_more_replies: comment.reply_count + 1 > [...comment.replies, json.comment].length,
                }
              : comment
          ),
        };
      });

      setReplyText("");
      setReplyingToParentId(null);
      setReplyingToComment(null);
    } catch (err: any) {
      console.error(err);
      alert(err?.message || "Could not post reply.");
    } finally {
      setIsReplySubmitting(false);
    }
  }

  async function handleDeleteComment(commentId: CommentId) {
    if (!url) return;

    if (commentToRemove !== commentId) return;
    setCommentToRemove(null);

    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

      const res = await fetch(
        `${API_BASE}/api/campaign-page/${url}/comments/${commentId}`,
        {
          method: "DELETE",
          headers: getAuthHeaders(),
        }
      );

      if (!res.ok) {
        throw new Error(`Failed to delete comment: ${res.status}`);
      }

      setData((prev) => {
        if (!prev) return prev;

        return {
          ...prev,
          comments: prev.comments
            .filter((comment) => comment.comment_id !== commentId)
            .map((comment) => {
              const deletedWasReply = comment.replies.some((reply) => reply.comment_id === commentId);
              const updatedReplies = comment.replies.filter((reply) => reply.comment_id !== commentId);
              const updatedReplyCount = deletedWasReply
                ? Math.max(0, comment.reply_count - 1)
                : comment.reply_count;

              return {
                ...comment,
                replies: updatedReplies,
                reply_count: updatedReplyCount,
                has_more_replies: updatedReplyCount > updatedReplies.length,
              };
            }),
        };
      });
    } catch (err) {
      console.error(err);
      alert("Could not delete comment.");
    }
  }

  async function handleEditComment(comment: Comment) {
    setEditingCommentId(comment.comment_id);
    setEditText(comment.comment_text);
  }

  async function handleSaveEditedComment(commentId: CommentId) {
    if (!url || !editText.trim()) return;

    try {
      setIsEditSubmitting(true);
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

      const res = await fetch(`${API_BASE}/api/campaign-page/${url}/comments/${commentId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ comment_text: editText.trim() }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Failed to edit comment: ${res.status}`);
      }

      const json = (await res.json()) as { comment: Comment };

      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          comments: prev.comments.map((comment) => {
            if (comment.comment_id === commentId) return { ...comment, ...json.comment };
            return {
              ...comment,
              replies: comment.replies.map((reply) =>
                reply.comment_id === commentId ? { ...reply, ...json.comment } : reply
              ),
            };
          }),
        };
      });

      setEditingCommentId(null);
      setEditText("");
    } catch (err: any) {
      console.error(err);
      alert(err?.message || "Could not edit comment.");
    } finally {
      setIsEditSubmitting(false);
    }
  }

  async function handleToggleLike(comment: Comment) {
    if (!url || !user) return;

    const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
    const method = comment.liked_by_viewer ? "DELETE" : "POST";

    try {
      const res = await fetch(`${API_BASE}/api/campaign-page/${url}/comments/${comment.comment_id}/like`, {
        method,
        headers: getAuthHeaders(),
      });

      if (!res.ok) throw new Error(`Failed to toggle like: ${res.status}`);

      const json = (await res.json()) as { liked: boolean; like_count: number; comment_id: CommentId };

      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          comments: prev.comments.map((parent) => {
            if (parent.comment_id === json.comment_id) {
              return { ...parent, liked_by_viewer: json.liked, like_count: json.like_count };
            }
            return {
              ...parent,
              replies: parent.replies.map((reply) =>
                reply.comment_id === json.comment_id
                  ? { ...reply, liked_by_viewer: json.liked, like_count: json.like_count }
                  : reply
              ),
            };
          }),
        };
      });
    } catch (err) {
      console.error(err);
      alert("Could not update like.");
    }
  }

  function handleReplyClick(parentComment: Comment, targetComment?: Comment) {
    const target = targetComment ?? parentComment;
    setReplyingToParentId(parentComment.comment_id);
    setReplyingToComment(target);
    setReplyText("");
  }

  async function handleReportComment(comment: Comment) {
    if (!url || !user) return;

    try {
      setReportingCommentId(comment.comment_id);
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

      const res = await fetch(`${API_BASE}/api/campaign-page/${url}/comments/${comment.comment_id}/report`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Failed to report comment: ${res.status}`);
      }

      alert("Comment reported. A snapshot was saved for admin review.");
    } catch (err: any) {
      console.error(err);
      alert(err?.message || "Could not report comment.");
    } finally {
      setReportingCommentId(null);
    }
  }

  async function handleReportCampaign() {
    if (!url) return;

    try {
      setIsCampaignReporting(true);

      const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

      const res = await fetch(`${API_BASE}/api/campaign-page/${url}/report`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Failed to report campaign: ${res.status}`);
      }

      alert("Campaign reported. A snapshot was saved for admin review.");
    } catch (err: any) {
      console.error(err);
      alert(err?.message || "Could not report campaign.");
    } finally {
      setIsCampaignReporting(false);
    }
  }

  async function handleLeaveCampaign() {
    if (!url || !user || !data) return;

    const viewerCollaborator = data.collaborators.find((collaborator) => collaborator.creator_id === user.id);
    if (!viewerCollaborator) {
      alert("Could not find your collaborator record for this campaign.");
      return;
    }

    const confirmed = window.confirm(`Are you sure you want to leave ${data.campaign.title}?`);
    if (!confirmed) return;

    try {
      setIsLeavingCampaign(true);
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

      const res = await fetch(
        `${API_BASE}/api/campaigns/invites/${viewerCollaborator.collaborator_id}/decline`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
        }
      );

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Failed to leave campaign: ${res.status}`);
      }

      router.push("/my-projects");
    } catch (err: any) {
      console.error(err);
      alert(err?.message || "Could not leave campaign.");
    } finally {
      setIsLeavingCampaign(false);
    }
  }

  async function handleLoadMoreReplies(parentCommentId: CommentId) {
    if (!url) return;

    try {
      setLoadingRepliesFor(parentCommentId);

      const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

      const res = await fetch(
        `${API_BASE}/api/campaign-page/${url}/comments/${parentCommentId}/replies`,
        {
          cache: "no-store",
          headers: getAuthHeaders(),
        }
      );

      if (!res.ok) {
        throw new Error(`Failed to load replies: ${res.status}`);
      }

      const json = (await res.json()) as { comment_id: CommentId; replies: Comment[] };

      setData((prev) => {
        if (!prev) return prev;

        return {
          ...prev,
          comments: prev.comments.map((comment) =>
            comment.comment_id === parentCommentId
              ? {
                  ...comment,
                  replies: json.replies,
                  has_more_replies: false,
                }
              : comment
          ),
        };
      });
    } catch (err) {
      console.error(err);
      alert("Could not load replies.");
    } finally {
      setLoadingRepliesFor(null);
    }
  }

  function handleCollapseReplies(parentCommentId: CommentId) {
    setData((prev) => {
      if (!prev) return prev;

      return {
        ...prev,
        comments: prev.comments.map((comment) =>
          comment.comment_id === parentCommentId
            ? {
                ...comment,
                replies: comment.replies.slice(0, 5),
                has_more_replies: comment.reply_count > 5,
              }
            : comment
        ),
      };
    });
  }

  const campaign = data?.campaign;
  const creator = data?.creator;
  const collaborators = data?.collaborators ?? [];
  const viewerPermissions = data?.viewer_permissions;
  const isOwner = viewerPermissions?.is_owner ?? Boolean(user?.id && campaign?.creator_id && user.id === campaign.creator_id);
  const isCollaborator = viewerPermissions?.is_collaborator ?? false;
  const isSaved = data?.viewer_engagement?.is_saved ?? false;
  const isCampaignActive = campaign?.status === "active";
  const isCampaignInactive = campaign?.status === "inactive";
  const isFullyFunded =
    Boolean(
      campaign?.funding_goal_cents &&
      campaign.amount_raised_cents >= campaign.funding_goal_cents
    );

  const fundingBlurb = useMemo(() => {
    if (!campaign) return "";

    if (isCampaignInactive) {
      if (isFullyFunded) {
        return "This campaign ended successfully and reached its funding goal.";
      }

      return "This campaign has ended and did not reach its funding goal.";
    }

    return "All or nothing. This campaign will only be funded if it reaches its goal before the campaign ends.";
  }, [campaign, isCampaignInactive, isFullyFunded]);

  const canViewCampaign = viewerPermissions?.can_view ?? Boolean(campaign && (isCampaignActive || isOwner || isCollaborator));
  const canComment = viewerPermissions?.can_comment ?? Boolean(isCampaignActive);
  const supportsCommentThreads = viewerPermissions?.supports_comment_threads !== false;
  const canEditCampaign = isOwner || isCollaborator;

  const creatorFullName = creator
    ? [creator.name, creator.last_name].filter(Boolean).join(" ").trim()
    : "Unknown";

  const currentPhoto = data?.photos?.[currentPhotoIndex];
  const heroIsVideo =
    (currentPhoto?.content_type ?? "").toLowerCase().startsWith("video/");
  const heroImage =
    currentPhoto?.image_url ??
    "https://community-fundings-assets.s3.us-east-2.amazonaws.com/Hero/placeholderimg.jpeg";

  const totalPhotos = data?.photos?.length ?? 0;

  const goToPrevPhoto = () => {
    if (!totalPhotos) return;
    setCurrentPhotoIndex((prev) => (prev === 0 ? totalPhotos - 1 : prev - 1));
  };

  const goToNextPhoto = () => {
    if (!totalPhotos) return;
    setCurrentPhotoIndex((prev) => (prev === totalPhotos - 1 ? 0 : prev + 1));
  };

  const daysToGo = useMemo(() => {
    if (!campaign?.time_created || typeof campaign?.duration_days !== "number") return null;
    const created = new Date(campaign.time_created);
    const end = new Date(created.getTime() + campaign.duration_days * 24 * 60 * 60 * 1000);
    const diffMs = end.getTime() - Date.now();
    return Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
  }, [campaign?.time_created, campaign?.duration_days]);

  const percentFunded = useMemo(() => {
    if (!campaign?.funding_goal_cents) return 0;
    return Math.min(100, Math.round((campaign.amount_raised_cents / campaign.funding_goal_cents) * 100));
  }, [campaign?.amount_raised_cents, campaign?.funding_goal_cents]);

  const totalCommentPages = data?.comments_pagination?.total_pages ?? 1;

  return (
    <div className="min-h-screen bg-white">
      <Header />

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center text-sm text-[#8BC34A] hover:text-[#7CB342] transition-colors"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>

          {user && (
            <Link
              href="/saved"
              className="text-sm font-medium text-gray-700 hover:text-[#8BC34A] transition-colors"
            >
              View Saved Campaigns
            </Link>
          )}
        </div>

        {!data && !error && <p className="text-gray-600">Loading…</p>}
        {error && <p className="text-red-600">Error: {error}</p>}
        {data && campaign && !canViewCampaign && (
          <div className="max-w-2xl mx-auto py-16">
            <div className="border border-gray-200 rounded-2xl bg-white p-8 text-center">
              <h1 className="text-2xl font-bold text-gray-900 mb-3">You don&apos;t have permission to view this campaign.</h1>
              <p className="text-gray-600 mb-6">
                This campaign isn&apos;t public right now.
              </p>
              <button
                onClick={() => router.back()}
                className="inline-flex items-center justify-center px-5 py-3 bg-[#8BC34A] text-white rounded-lg font-medium hover:bg-[#7CB342] transition-colors"
              >
                Go back
              </button>
            </div>
          </div>
        )}

        {data && campaign && canViewCampaign && (
          <>
            <div className="mb-4 flex items-start justify-between gap-4">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                {campaign.title}
              </h1>

            {user && isCampaignActive && (
              <BookmarkButton
                isSaved={isSaved}
                isSubmitting={isSaveSubmitting}
                onClick={handleToggleSave}
              />
            )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
              <div className="lg:col-span-2">
                <div className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden mb-4">
                  {totalPhotos > 0 && heroIsVideo ? (
                    <video
                      key={heroImage}
                      src={heroImage}
                      controls
                      playsInline
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <Image
                      src={heroImage}
                      alt={campaign.title}
                      fill
                      className="object-cover"
                    />
                  )}

                  {totalPhotos > 1 && (
                    <>
                      <button
                        onClick={goToPrevPhoto}
                        className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 rounded-full flex items-center justify-center shadow-md hover:bg-white transition-colors"
                        aria-label="Previous image"
                      >
                        <svg className="w-5 h-5 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>

                      <button
                        onClick={goToNextPhoto}
                        className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 rounded-full flex items-center justify-center shadow-md hover:bg-white transition-colors"
                        aria-label="Next image"
                      >
                        <svg className="w-5 h-5 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>

                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                        {data?.photos?.map((_, index) => (
                          <button
                            key={index}
                            onClick={() => setCurrentPhotoIndex(index)}
                            className={`w-2.5 h-2.5 rounded-full ${
                              index === currentPhotoIndex ? "bg-white" : "bg-white/50"
                            }`}
                            aria-label={`Go to image ${index + 1}`}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <div className="flex gap-3">
                    <div className="w-12 h-12 rounded-full bg-gray-100 flex-shrink-0 flex items-center justify-center">
                      <svg className="w-6 h-6 text-[#8BC34A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                    </div>
                    <p className="text-sm text-gray-600">Category: <span className="font-medium">{campaign.category}</span></p>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-12 h-12 rounded-full bg-gray-100 flex-shrink-0 flex items-center justify-center">
                      <svg className="w-6 h-6 text-[#8BC34A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2a7 7 0 00-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <p className="text-sm text-gray-600">Location: <span className="font-medium">{campaign.location}</span></p>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-12 h-12 rounded-full bg-gray-100 flex-shrink-0 flex items-center justify-center">
                      <svg className="w-6 h-6 text-[#8BC34A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12h18M3 6h18M3 18h18" />
                      </svg>
                    </div>
                    <p className="text-sm text-gray-600">Status: <span className="font-medium">{formatCampaignStatus(campaign.status)}</span></p>
                  </div>
                </div>

                <section className="mb-10">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">Story</h2>
                  <p className="text-gray-600 mb-8">
                    {campaign.description_html}
                  </p>
                </section>

                <section className="mb-10">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">FAQs</h2>
                  {data.faqs.length === 0 ? (
                    <p className="text-gray-600">No FAQs yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {data.faqs.map((f) => (
                        <div key={f.display_order} className="border border-gray-200 rounded-lg p-4">
                          <div className="font-semibold text-gray-900">{f.question}</div>
                          <div className="text-gray-600 mt-1">{f.answer}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section className="mb-12">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
                    <h2 className="text-2xl font-bold text-gray-900">Comments</h2>

                    <div className="flex items-center gap-2">
                      <label htmlFor="comment-sort" className="text-sm text-gray-600">Sort by</label>
                      <select
                        id="comment-sort"
                        value={sortBy}
                        onChange={(e) => loadCampaignPage(1, e.target.value as "newest" | "oldest" | "most_liked")}
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-[#8BC34A]"
                      >
                        <option value="newest">Newest</option>
                        <option value="oldest">Oldest</option>
                        {supportsCommentThreads && <option value="most_liked">Most liked</option>}
                      </select>
                    </div>
                  </div>

                  <div className="border border-gray-200 rounded-2xl p-5 bg-white mb-6">
                    {user ? (
                      isCampaignActive ? (
                        <>
                          <textarea
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value.slice(0, COMMENT_MAX_LENGTH))}
                            placeholder="Share your thoughts about this campaign..."
                            className="w-full min-h-[120px] border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-700 focus:outline-none focus:border-[#8BC34A] focus:ring-1 focus:ring-[#8BC34A] resize-y"
                          />

                          <div className="flex items-center justify-between mt-3">
                            <p className={`text-xs ${commentText.length >= COMMENT_MAX_LENGTH ? "text-red-600" : "text-gray-500"}`}>
                              {commentText.length}/{COMMENT_MAX_LENGTH}
                            </p>

                            <button
                              onClick={handleSubmitComment}
                              disabled={!canComment || isCommentSubmitting || !commentText.trim() || commentText.length > COMMENT_MAX_LENGTH}
                              className="px-5 py-2.5 bg-[#8BC34A] text-white rounded-lg text-sm font-medium hover:bg-[#7CB342] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {!canComment ? "Comments disabled" : isCommentSubmitting ? "Posting..." : "Post Comment"}
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-5 text-sm text-gray-600">
                          Comments are disabled until this campaign is active.
                        </div>
                      )
                    ) : (
                      <p className="text-sm text-gray-600">
                        {isCampaignActive ? "Please sign in to leave a comment." : "Comments are disabled until this campaign is active."}
                      </p>
                    )}
                  </div>

                  {data.comments.length === 0 ? (
                    <p className="text-gray-600">No comments yet. Be the first to comment.</p>
                  ) : (
                    <>
                      <div className="space-y-4">
                        {data.comments.map((comment) => (
                          <div key={comment.comment_id} className="border border-gray-200 rounded-2xl p-5 bg-white">
                            <div className="flex items-start gap-3">
                              <Avatar
                                name={comment.name}
                                avatarUrl={comment.avatar_url}
                                size="md"
                              />

                              <div className="min-w-0 flex-1">
                                <CommentHeader comment={comment} />

                                <p className="text-sm text-gray-700 whitespace-pre-line mb-3">
                                  {comment.comment_text}
                                </p>

                                <div className="flex flex-wrap items-center gap-4">
                                  {user && supportsCommentThreads && (
                                    <button
                                      onClick={() => handleReplyClick(comment)}
                                      className="text-sm text-[#8BC34A] hover:underline"
                                    >
                                      Reply
                                    </button>
                                  )}

                                  {user && supportsCommentThreads && (
                                    <button
                                      onClick={() => handleToggleLike(comment)}
                                      className={`text-sm hover:underline ${comment.liked_by_viewer ? "text-blue-600" : "text-gray-600"}`}
                                    >
                                      👍 {comment.like_count}
                                    </button>
                                  )}

                                  {!comment.is_you && supportsCommentThreads && (
                                    <button
                                      onClick={() => handleReportComment(comment)}
                                      disabled={reportingCommentId === comment.comment_id}
                                      className="text-sm text-gray-600 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      {reportingCommentId === comment.comment_id ? "Reporting..." : "Report"}
                                    </button>
                                  )}

                                  {comment.is_you && (
                                    <>
                                      <button
                                        onClick={() => handleEditComment(comment)}
                                        className="text-sm text-gray-700 hover:underline"
                                      >
                                        Edit
                                      </button>
                                      <button
                                        onClick={() => setCommentToRemove(comment.comment_id)}
                                        className="text-sm text-red-600 hover:underline"
                                      >
                                        Delete
                                      </button>
                                    </>
                                  )}
                                </div>

                                <CommentMeta comment={comment} />

                                {editingCommentId === comment.comment_id ? (
                                  <div className="mt-4">
                                    <textarea
                                      value={editText}
                                      onChange={(e) => setEditText(e.target.value.slice(0, COMMENT_MAX_LENGTH))}
                                      className="w-full min-h-[90px] border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-700 focus:outline-none focus:border-[#8BC34A] focus:ring-1 focus:ring-[#8BC34A] resize-y"
                                    />
                                    <div className="flex items-center justify-between gap-2 mt-3">
                                      <p className={`text-xs ${editText.length >= COMMENT_MAX_LENGTH ? "text-red-600" : "text-gray-500"}`}>
                                        {editText.length}/{COMMENT_MAX_LENGTH}
                                      </p>
                                      <div className="flex justify-end gap-2">
                                        <button
                                          onClick={() => {
                                            setEditingCommentId(null);
                                            setEditText("");
                                          }}
                                          className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                                        >
                                          Cancel
                                        </button>
                                        <button
                                          onClick={() => handleSaveEditedComment(comment.comment_id)}
                                          disabled={isEditSubmitting || !editText.trim() || editText.length > COMMENT_MAX_LENGTH}
                                          className="px-4 py-2 text-sm bg-[#8BC34A] text-white rounded-lg hover:bg-[#7CB342] disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                          {isEditSubmitting ? "Saving..." : "Save"}
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                ) : null}

                                {replyingToParentId === comment.comment_id && user && (
                                  <div className="mt-4">
                                    <textarea
                                      value={replyText}
                                      onChange={(e) => setReplyText(e.target.value.slice(0, COMMENT_MAX_LENGTH))}
                                      placeholder={replyingToComment ? `Reply to ${getCommentAuthor(replyingToComment)}...` : "Write a reply..."}
                                      className="w-full min-h-[90px] border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-700 focus:outline-none focus:border-[#8BC34A] focus:ring-1 focus:ring-[#8BC34A] resize-y"
                                    />

                                    <div className="flex items-center justify-between gap-2 mt-3">
                                      <p className={`text-xs ${replyText.length >= COMMENT_MAX_LENGTH ? "text-red-600" : "text-gray-500"}`}>
                                        {replyText.length}/{COMMENT_MAX_LENGTH}
                                      </p>

                                      <div className="flex justify-end gap-2">
                                        <button
                                          onClick={() => {
                                            setReplyingToParentId(null);
                                            setReplyingToComment(null);
                                            setReplyText("");
                                          }}
                                          className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                                        >
                                          Cancel
                                        </button>
                                        <button
                                          onClick={() => handleSubmitReply(comment.comment_id)}
                                          disabled={isReplySubmitting || !replyText.trim() || replyText.length > COMMENT_MAX_LENGTH}
                                          className="px-4 py-2 text-sm bg-[#8BC34A] text-white rounded-lg hover:bg-[#7CB342] disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                          {isReplySubmitting ? "Posting..." : "Post Reply"}
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {comment.replies.length > 0 && (
                                  <div className="mt-5 space-y-3 border-l-2 border-gray-100 pl-4">
                                    {comment.replies.map((reply) => (
                                      <div key={reply.comment_id} className="bg-gray-50 rounded-xl p-4">
                                        <div className="flex items-start gap-3">
                                          <Avatar
                                            name={reply.name}
                                            avatarUrl={reply.avatar_url}
                                            size="sm"
                                          />

                                          <div className="min-w-0 flex-1">
                                            <CommentHeader comment={reply} compact />

                                            <p className="text-sm text-gray-700 whitespace-pre-line mb-2">
                                              {reply.reply_to_name ? (
                                                <span className="text-gray-500">Replying to @{reply.reply_to_name} </span>
                                              ) : null}
                                              {reply.comment_text}
                                            </p>

                                            <div className="flex flex-wrap items-center gap-4">
                                              {user && (
                                                <button
                                                  onClick={() => handleReplyClick(comment, reply)}
                                                  className="text-sm text-[#8BC34A] hover:underline"
                                                >
                                                  Reply
                                                </button>
                                              )}

                                              {user && (
                                                <button
                                                  onClick={() => handleToggleLike(reply)}
                                                  className={`text-sm hover:underline ${reply.liked_by_viewer ? "text-blue-600" : "text-gray-600"}`}
                                                >
                                                  👍 {reply.like_count}
                                                </button>
                                              )}

                                              {!reply.is_you && (
                                                <button
                                                  onClick={() => handleReportComment(reply)}
                                                  disabled={reportingCommentId === reply.comment_id}
                                                  className="text-sm text-gray-600 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                  {reportingCommentId === reply.comment_id ? "Reporting..." : "Report"}
                                                </button>
                                              )}

                                              {reply.is_you && (
                                                <>
                                                  <button
                                                    onClick={() => handleEditComment(reply)}
                                                    className="text-sm text-gray-700 hover:underline"
                                                  >
                                                    Edit
                                                  </button>
                                                  <button
                                                    onClick={() => setCommentToRemove(reply.comment_id)}
                                                    className="text-sm text-red-600 hover:underline"
                                                  >
                                                    Delete
                                                  </button>
                                                </>
                                              )}
                                            </div>

                                            <CommentMeta comment={reply} />

                                            {editingCommentId === reply.comment_id ? (
                                              <div className="mt-4">
                                                <textarea
                                                  value={editText}
                                                  onChange={(e) => setEditText(e.target.value.slice(0, COMMENT_MAX_LENGTH))}
                                                  className="w-full min-h-[90px] border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-700 focus:outline-none focus:border-[#8BC34A] focus:ring-1 focus:ring-[#8BC34A] resize-y"
                                                />
                                                <div className="flex items-center justify-between gap-2 mt-3">
                                                  <p className={`text-xs ${editText.length >= COMMENT_MAX_LENGTH ? "text-red-600" : "text-gray-500"}`}>
                                                    {editText.length}/{COMMENT_MAX_LENGTH}
                                                  </p>
                                                  <div className="flex justify-end gap-2">
                                                    <button
                                                      onClick={() => {
                                                        setEditingCommentId(null);
                                                        setEditText("");
                                                      }}
                                                      className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                                                    >
                                                      Cancel
                                                    </button>
                                                    <button
                                                      onClick={() => handleSaveEditedComment(reply.comment_id)}
                                                      disabled={isEditSubmitting || !editText.trim() || editText.length > COMMENT_MAX_LENGTH}
                                                      className="px-4 py-2 text-sm bg-[#8BC34A] text-white rounded-lg hover:bg-[#7CB342] disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                      {isEditSubmitting ? "Saving..." : "Save"}
                                                    </button>
                                                  </div>
                                                </div>
                                              </div>
                                            ) : null}
                                          </div>
                                        </div>
                                      </div>
                                    ))}

                                    {comment.has_more_replies ? (
                                      <button
                                        onClick={() => handleLoadMoreReplies(comment.comment_id)}
                                        disabled={loadingRepliesFor === comment.comment_id}
                                        className="text-sm text-[#8BC34A] hover:underline disabled:opacity-50"
                                      >
                                        {loadingRepliesFor === comment.comment_id
                                          ? "Loading replies..."
                                          : `Load more replies (${comment.reply_count - comment.replies.length} more)`}
                                      </button>
                                    ) : comment.reply_count > 5 ? (
                                      <button
                                        onClick={() => handleCollapseReplies(comment.comment_id)}
                                        className="text-sm text-[#8BC34A] hover:underline"
                                      >
                                        Show fewer replies
                                      </button>
                                    ) : null}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {totalCommentPages > 1 && (
                        <div className="flex justify-center items-center gap-2 mt-8 flex-wrap">
                          {Array.from({ length: totalCommentPages }, (_, i) => i + 1).map((pageNum) => (
                            <button
                              key={pageNum}
                              onClick={() => loadCampaignPage(pageNum)}
                              className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                                pageNum === commentPage
                                  ? "bg-[#8BC34A] text-white border-[#8BC34A]"
                                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                              }`}
                            >
                              {pageNum}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </section>
              </div>

              <div className="lg:col-span-1">
                <div className="sticky top-8">
                  <div className="mb-6">
                    <p className="text-3xl font-bold text-gray-900">
                      {formatUSD(campaign.amount_raised_cents)}
                    </p>
                    <p className="text-sm text-gray-500 mb-2">
                      pledged of {formatUSD(campaign.funding_goal_cents)} goal
                    </p>

                    <div className="w-full bg-gray-100 rounded-full h-2 mb-4 overflow-hidden">
                      <div className="h-2 bg-[#8BC34A]" style={{ width: `${percentFunded}%` }} />
                    </div>

                    <p className="text-2xl font-bold text-gray-900">{campaign.backers}</p>
                    <p className="text-sm text-gray-500 mb-4">backers</p>

                    <p className="text-2xl font-bold text-gray-900">{daysToGo ?? "-"}</p>
                    <p className="text-sm text-gray-500 mb-6">days to go</p>

                    <button
                      /* v100_donate_main — wired onClick */
                      onClick={() => { if (isCampaignActive && !isOwner && !isCollaborator) { setEligibilityAccepted(false); setShowDonateModal(true); } }}
                      disabled={!isCampaignActive || isOwner || isCollaborator}
                      className={`w-full py-3 rounded-lg font-medium transition-colors mb-3 ${
                        isCampaignActive && !isOwner && !isCollaborator
                          ? "bg-[#8BC34A] text-white hover:bg-[#7CB342]"
                          : "bg-gray-200 text-gray-500 cursor-not-allowed"
                      }`}
                    >
                      {isOwner
                        ? "You can't back your own campaign"
                        : isCollaborator
                          ? "You can't back a campaign you're collaborating on"
                          : campaign?.status === "inactive"
                            ? "This campaign has ended"
                            : campaign?.status === "draft"
                              ? "This campaign is still a draft"
                              : campaign?.status === "pending_review"
                                ? "This campaign is pending review"
                                : "Back this campaign"}
                    </button>

                    {canEditCampaign && (
                      <Link
                        href={`/edit-campaign/${campaign.url || campaign.campaign_id}`}
                        className="w-full flex items-center justify-center bg-white text-gray-900 py-3 rounded-lg font-medium border border-gray-300 hover:bg-gray-50 transition-colors mb-3"
                      >
                        Edit Campaign
                      </Link>
                    )}

                    {isCollaborator && !isOwner && (
                      <button
                        onClick={handleLeaveCampaign}
                        disabled={isLeavingCampaign}
                        className="w-full bg-white text-red-600 py-3 rounded-lg font-medium border border-red-200 hover:bg-red-50 transition-colors mb-3 disabled:opacity-50"
                      >
                        {isLeavingCampaign ? "Leaving..." : "Leave Campaign"}
                      </button>
                    )}

                    {isOwner && campaign?.status === "draft" && (
                      <button
                        onClick={async () => {
                          const confirmed = window.confirm("Delete this draft campaign? This cannot be undone.");
                          if (!confirmed) return;
                          try {
                            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/campaign-page/${campaign.url || campaign.campaign_id}`, {
                              method: "DELETE",
                              headers: getAuthHeaders(),
                            });
                            if (!res.ok) {
                              const text = await res.text();
                              throw new Error(text || `Failed to delete draft: ${res.status}`);
                            }
                            router.push("/");
                          } catch (err: any) {
                            console.error(err);
                            alert(err?.message || "Could not delete draft.");
                          }
                        }}
                        className="w-full bg-red-50 text-red-600 py-3 rounded-lg font-medium border border-red-200 hover:bg-red-100 transition-colors mb-3"
                      >
                        Delete Draft
                      </button>
                    )}

                    {!isOwner && !isCollaborator && (
                      <button
                        onClick={handleReportCampaign}
                        disabled={isCampaignReporting}
                        className="w-full bg-white text-gray-900 py-3 rounded-lg font-medium border border-gray-300 hover:bg-gray-50 transition-colors mb-3 disabled:opacity-50"
                      >
                        {isCampaignReporting ? "Reporting..." : "Report this campaign"}
                      </button>
                    )}

                    <p className="text-sm text-gray-600">
                      {fundingBlurb}
                    </p>
                  </div>

                  <div className="border-t border-gray-200 pt-6 mb-6">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 mb-3">
                      Creator
                    </p>
                    {creator ? (
                      <Link
                        href={getProfileHref(creator)}
                        className="flex items-center gap-3 mb-3 group"
                      >
                        <Avatar
                          name={creatorFullName}
                          avatarUrl={creator.avatar_url}
                          size="lg"
                        />

                        <div>
                          <p className="font-semibold text-gray-900 group-hover:text-[#8BC34A] transition-colors">
                            {creatorFullName}
                          </p>
                          <p className="text-xs text-gray-500">
                            {creator.username ? `@${creator.username}` : creator.creator_id}
                          </p>
                        </div>
                      </Link>
                    ) : (
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 rounded-full bg-gray-200" />
                        <div>
                          <p className="font-semibold text-gray-900">Unknown</p>
                        </div>
                      </div>
                    )}

                    <p className="text-sm text-gray-600 mb-4">
                      {creator?.bio ?? "No bio yet."}{" "}
                      {creator && (
                        <Link
                          href={getProfileHref(creator)}
                          className="text-[#8BC34A] hover:underline"
                        >
                          Visit profile
                        </Link>
                      )}
                    </p>

                    {collaborators.length > 0 && (
                      <div className="border-t border-gray-100 pt-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 mb-3">
                          Collaborators
                        </p>
                        <div className="space-y-3">
                          {collaborators.map((collaborator) => {
                            const collaboratorName = [collaborator.name, collaborator.last_name]
                              .filter(Boolean)
                              .join(" ")
                              .trim() || collaborator.username || collaborator.creator_id;

                            return (
                              <Link
                                key={collaborator.collaborator_id}
                                href={getProfileHref(collaborator)}
                                className="flex items-center gap-3 group"
                              >
                                <Avatar
                                  name={collaboratorName}
                                  avatarUrl={collaborator.avatar_url}
                                  size="md"
                                />
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-[#8BC34A] transition-colors">
                                    {collaboratorName}
                                  </p>
                                  <p className="text-xs text-gray-500 truncate">
                                    {collaborator.username ? `@${collaborator.username}` : collaborator.creator_id}
                                  </p>
                                </div>
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end mb-6">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(window.location.href).then(() => {
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        });
                      }}
                      className="inline-flex items-center gap-2 px-5 py-2 bg-[#8BC34A] text-white rounded-lg text-sm font-medium hover:bg-[#7CB342] transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                      </svg>
                      {copied ? "Link Copied!" : "Share"}
                    </button>
                  </div>

                  <div className="border-t border-gray-200 pt-6">
                    <h3 className="font-semibold text-gray-900 mb-2">Rewards</h3>
                    {data.rewards.length === 0 ? (
                      <p className="text-xs text-gray-500">No rewards yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {data.rewards.map((r) => (
                          <div key={r.reward_id} className="border border-gray-200 rounded-lg p-3">
                            <div className="flex items-center justify-between">
                              <p className="font-semibold text-gray-900">{r.title}</p>
                              <p className="text-sm text-gray-700">{formatUSD(r.required_amount_cents)}</p>
                            </div>
                            <p className="text-sm text-gray-600 mt-1">{r.description || "No reward details yet."}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      {/* v100_donate_main — Donation Modal */}
      {commentToRemove !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div role="dialog" aria-modal="true" aria-label="Remove comment" className="bg-white rounded-2xl p-6 max-w-md w-full">
            <h2 className="font-bold text-xl mb-3">{supportsCommentThreads ? "Delete comment?" : "Hide comment?"}</h2>
            <p className="text-sm mb-5">{supportsCommentThreads ? "This permanently removes your comment." : "This hides your comment from the campaign. The record is retained for moderation."}</p>
            <div className="flex gap-3">
              <button onClick={() => setCommentToRemove(null)} className="px-4 py-2 border rounded-lg">Cancel</button>
              <button onClick={() => handleDeleteComment(commentToRemove)} className="px-4 py-2 bg-red-600 text-white rounded-lg">{supportsCommentThreads ? "Delete comment" : "Hide comment"}</button>
            </div>
          </div>
        </div>
      )}
      {showDonateModal && data?.campaign && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) { setShowDonateModal(false); setEligibilityAccepted(false); } }}
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Back this campaign</h2>
                <p className="text-sm text-gray-500 mt-0.5">{data.campaign.title}</p>
              </div>
              <button
                onClick={() => { setShowDonateModal(false); setEligibilityAccepted(false); }}
                className="text-gray-400 hover:text-gray-600 p-1 -mr-1"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            {!eligibilityAccepted ? (
              <div>
                <p className="text-sm font-semibold text-gray-800 mb-2">Before you back this campaign</p>
                <p className="text-xs text-gray-600 mb-4">By proceeding, you acknowledge:</p>
                <ul className="space-y-2.5 mb-5 text-xs text-gray-700">
                  <li className="flex gap-2"><span className="text-[#8BC34A] font-bold">{"•"}</span><span><strong>General Transaction Policies.</strong> Donations are processed securely through Stripe. By proceeding, you authorize Community Fundings to charge your selected payment method. Transactions are final once processed and subject to Community Fundings&apos; Terms of Service.</span></li>
                  <li className="flex gap-2"><span className="text-[#8BC34A] font-bold">{"•"}</span><span><strong>Platform fee.</strong> A 5% platform fee plus standard payment processing fees apply to your donation.</span></li>
                  <li className="flex gap-2"><span className="text-[#8BC34A] font-bold">{"•"}</span><span><strong>No guarantee of delivery.</strong> Community Fundings is not responsible for delivery of rewards or completion of projects by campaign creators.</span></li>
                  <li className="flex gap-2"><span className="text-[#8BC34A] font-bold">{"•"}</span><span><strong>You must be 18+.</strong> You confirm you are at least 18 years old and authorized to use the payment method you provide.</span></li>
                  <li className="flex gap-2"><span className="text-[#8BC34A] font-bold">{"•"}</span><span><strong>Refund policy.</strong> Refund requests are handled per Community Fundings&apos; refund policy and may be limited after a campaign succeeds.</span></li>
                </ul>
                <label className="flex items-start gap-2 mb-5 cursor-pointer text-sm text-gray-700 select-none">
                  <input
                    type="checkbox"
                    checked={eligibilityAccepted}
                    onChange={(e) => setEligibilityAccepted(e.target.checked)}
                    className="mt-0.5 rounded text-[#8BC34A] focus:ring-[#8BC34A]"
                  />
                  <span>I have read and agree to these terms.</span>
                </label>
                <button
                  type="button"
                  disabled={!eligibilityAccepted}
                  onClick={() => setDonateError("")}
                  className="w-full bg-[#8BC34A] text-white py-3 rounded-lg font-medium hover:bg-[#7CB342] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {eligibilityAccepted ? "Continue to donation" : "Please agree to continue"}
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {PRESET_AMOUNTS.map(a => (
                    <button
                      key={a}
                      onClick={() => { setDonateAmount(String(a)); setDonateCustom(""); }}
                      className={`py-2.5 rounded-lg text-sm font-medium transition-colors ${(!donateCustom && parseInt(donateAmount) === a) ? "bg-[#8BC34A] text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                    >
                      ${a}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={donateCustom}
                  onChange={(e) => setDonateCustom(e.target.value)}
                  placeholder="Custom amount"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-[#8BC34A]"
                />
                <input
                  type="text"
                  value={donorName}
                  onChange={(e) => setDonorName(e.target.value)}
                  placeholder="Your name"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-[#8BC34A]"
                />
                <input
                  type="email"
                  value={donorEmail}
                  onChange={(e) => setDonorEmail(e.target.value)}
                  placeholder="Email (for receipt)"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-[#8BC34A]"
                />
                <textarea
                  value={donateMessage}
                  onChange={(e) => setDonateMessage(e.target.value)}
                  placeholder="Add a message (optional)"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-[#8BC34A]"
                />
                <label className="flex items-center gap-2 mb-4 cursor-pointer text-sm text-gray-700 select-none">
                  <input
                    type="checkbox"
                    checked={donateAnonymous}
                    onChange={(e) => setDonateAnonymous(e.target.checked)}
                    className="rounded text-[#8BC34A] focus:ring-[#8BC34A]"
                  />
                  <span>Donate anonymously</span>
                </label>
                {donateError && <p className="text-sm text-red-600 mb-3">{donateError}</p>}
                <button
                  onClick={() => handleBackProject()}
                  disabled={donateLoading}
                  className="w-full bg-[#8BC34A] text-white py-3 rounded-lg font-medium hover:bg-[#7CB342] transition-colors disabled:opacity-50"
                >
                  {donateLoading ? "Processing..." : `Pledge $${parseFloat(donateCustom || donateAmount || "0").toFixed(2)}`}
                </button>
                <p className="text-xs text-gray-500 text-center mt-3">
                  Secure payment via Stripe. A 5% platform fee supports the platform.
                </p>
              </>
            )}
          </div>
        </div>
      )}
      {/* /v100_donate_main */}
      <Footer />
    
      {/* v100_t25fix_marker — Report Campaign button + modal */}
      <>
{/* v100_t25_report_button — Report Campaign button */}
        <div style={{
          position: "fixed",
          bottom: 20,
          right: 20,
          zIndex: 1000,
        }}>
          <button
            onClick={() => {
              if (!user) {
                alert("Please sign in to report a campaign");
                return;
              }
              setShowReportModal(true);
            }}
            style={{
              background: "#fff",
              border: "1px solid #fca5a5",
              color: "#dc2626",
              padding: "10px 18px",
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            }}
            title="Report this campaign"
          >
            ⚠️ Report Campaign
          </button>
        </div>

        {/* v100_t25_report_button — Report Modal */}
        {showReportModal && (
          <div
            onClick={() => !reportSubmitting && setShowReportModal(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 2000,
              padding: 20,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "#fff",
                borderRadius: 16,
                padding: 28,
                maxWidth: 460,
                width: "100%",
                boxShadow: "0 24px 60px rgba(0,0,0,0.25)",
              }}
            >
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6, color: "#111" }}>
                Report this campaign
              </h2>
              <p style={{ fontSize: 13, color: "#666", marginBottom: 18 }}>
                Help us keep the platform safe. Site admins will review your report.
              </p>

              {reportSuccess ? (
                <div style={{
                  background: "#dcfce7", color: "#166534",
                  padding: 14, borderRadius: 10, marginBottom: 12,
                  textAlign: "center", fontWeight: 600,
                }}>
                  ✅ Report submitted. Thank you.
                </div>
              ) : (
                <>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
                    Reason
                  </label>
                  <select
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    style={{
                      width: "100%", padding: "10px 12px", marginBottom: 14,
                      border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14,
                    }}
                  >
                    <option value="">Select a reason…</option>
                    <option value="Spam">Spam</option>
                    <option value="Misleading">Misleading information</option>
                    <option value="Inappropriate">Inappropriate content</option>
                    <option value="Fraud">Suspected fraud</option>
                    <option value="Hate speech">Hate speech</option>
                    <option value="Other">Other</option>
                  </select>

                  <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
                    Additional notes (optional)
                  </label>
                  <textarea
                    value={reportNotes}
                    onChange={(e) => setReportNotes(e.target.value)}
                    rows={3}
                    placeholder="Provide more details to help our review..."
                    style={{
                      width: "100%", padding: "10px 12px", marginBottom: 14,
                      border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14,
                      resize: "vertical", fontFamily: "inherit",
                    }}
                  />

                  {reportError && (
                    <div style={{
                      background: "#fee2e2", color: "#991b1b",
                      padding: 10, borderRadius: 8, marginBottom: 12, fontSize: 13,
                    }}>{reportError}</div>
                  )}

                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button
                      onClick={() => setShowReportModal(false)}
                      disabled={reportSubmitting}
                      style={{
                        padding: "10px 18px", border: "1px solid #d1d5db",
                        background: "#fff", borderRadius: 8, fontSize: 13,
                        fontWeight: 600, color: "#374151", cursor: "pointer",
                      }}
                    >Cancel</button>
                    <button
                      onClick={submitReport}
                      disabled={reportSubmitting || !reportReason}
                      style={{
                        padding: "10px 18px", border: "none",
                        background: reportSubmitting || !reportReason ? "#fca5a5" : "#dc2626",
                        color: "#fff", borderRadius: 8, fontSize: 13,
                        fontWeight: 600, cursor: reportSubmitting || !reportReason ? "not-allowed" : "pointer",
                      }}
                    >{reportSubmitting ? "Submitting…" : "Submit report"}</button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </>
      </div>

  );
}

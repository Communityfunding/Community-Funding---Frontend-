"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import {
  useCampaignDraft,
  saveDraftToBackend,
} from "@/app/create-project/store/useCampaignDraft";
import {
  displayUrlForPhoto,
  isVideoContentType,
  photosPayloadForApi,
  uploadCampaignFilesToS3,
} from "@/app/create-project/lib/campaignPhotoUpload";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
import { DraftDebug } from "@/app/create-project/component/draftDebug";
import LocationAutocomplete from "@/app/create-project/component/LocationAutocomplete";

export default function BasicsPage() {
  const router = useRouter();
  const { user } = useUser();

  const hasHydrated = useCampaignDraft((s) => s.hasHydrated);
  const draft = useCampaignDraft((s) => s.draft);
  const setBasics = useCampaignDraft((s) => s.setBasics);
  const setPhotos = useCampaignDraft((s) => s.setPhotos);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ✅ touched flags (show validation UI only after interaction)
  const [titleTouched, setTitleTouched] = useState(false);
  const [categoryTouched, setCategoryTouched] = useState(false);
  const [locationTouched, setLocationTouched] = useState(false);
  const [fundingTouched, setFundingTouched] = useState(false);
  const [durationTouched, setDurationTouched] = useState(false);

  // Format cents -> dollars string for the input
  const fundingGoalString = useMemo(() => {
    const cents = draft.funding_goal_cents ?? 0;
    if (!cents) return "";
    const dollars = cents / 100;
    return String(dollars);
  }, [draft.funding_goal_cents]);

  // --- image picker local state ---
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [projectImages, setProjectImages] = useState<File[]>([]);
  const [projectImagePreviewUrls, setProjectImagePreviewUrls] = useState<string[]>([]);
  const MAX_MEDIA = 5;

  const openFilePicker = () => fileInputRef.current?.click();

  // ✅ REQUIRED FIELDS
  const titleValid = draft.title.trim().length > 0;
  const categoryValid = (draft.category ?? "").trim().length > 0;
  const locationValid = (draft.location ?? "").trim().length > 0;
  const fundingValid = (draft.funding_goal_cents ?? 0) > 0;

  const durationNum = draft.duration_days ?? 0;

  // Duration validity must consider "empty" input string, not just store value
  const [durationInput, setDurationInput] = useState<string>(() => {
    const v = draft.duration_days ?? 0;
    return v >= 1 && v <= 365 ? String(v) : "";
  });
  // Sync durationInput when store resets (e.g., new campaign)
  useEffect(() => {
    const v = draft.duration_days ?? 0;
    setDurationInput(v >= 1 && v <= 365 ? String(v) : "");
  }, [draft.duration_days]);

  const durationEmpty = durationInput.trim() === "";
  const durationValid = !durationEmpty && durationNum >= 1 && durationNum <= 365;

  const basicsValid = titleValid && categoryValid && locationValid && fundingValid && durationValid;

  const addFiles = (files: FileList | File[]) => {
    const incoming = Array.from(files).filter((f) => {
      const t = f.type;
      if (t.startsWith("image/") || t.startsWith("video/")) return true;
      // Some browsers omit MIME on drag-and-drop; allow common extensions.
      if (!t && /\.(jpe?g|png|gif|webp|mp4|webm|mov)$/i.test(f.name)) return true;
      return false;
    });
    if (incoming.length === 0) return;

    const total = draft.photos.length + projectImages.length;
    const remaining = MAX_MEDIA - total;
    if (remaining <= 0) return;

    const accepted = incoming.slice(0, remaining);
    const newUrls = accepted.map((f) => URL.createObjectURL(f));

    setProjectImages((prev) => [...prev, ...accepted]);
    setProjectImagePreviewUrls((prev) => [...prev, ...newUrls]);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    addFiles(e.target.files);
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!e.dataTransfer.files) return;
    addFiles(e.dataTransfer.files);
  };

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => e.preventDefault();

  const removeImageAt = (idx: number) => {
    setProjectImages((prev) => prev.filter((_, i) => i !== idx));
    setProjectImagePreviewUrls((prev) => {
      const url = prev[idx];
      if (url) URL.revokeObjectURL(url);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const clearAllImages = () => {
    projectImagePreviewUrls.forEach((u) => URL.revokeObjectURL(u));
    setProjectImages([]);
    setProjectImagePreviewUrls([]);
    setPhotos([]);
  };

  const removeSavedPhoto = (idx: number) => {
    setPhotos(draft.photos.filter((_, i) => i !== idx));
  };

  const handleNext = async () => {
    // mark touched so validation UI shows if user tries to continue
    setTitleTouched(true);
    setCategoryTouched(true);
    setLocationTouched(true);
    setFundingTouched(true);
    setDurationTouched(true);

    if (!basicsValid) return;

    setSaveError(null);
    setSaving(true);
    try {
      const campaignId = await saveDraftToBackend(user ?? undefined);
      // Saving may refresh an expired backend session. Use the refreshed
      // token for both uploads and photo metadata instead of a stale copy.
      const token = localStorage.getItem("cf_backend_token");
      if (!token) throw new Error("Could not establish a session with the server.");

      const stored = useCampaignDraft.getState().draft;
      const uploaded =
        projectImages.length > 0
          ? await uploadCampaignFilesToS3(campaignId, projectImages, token)
          : [];

      const mergedDisplay = [...stored.photos, ...uploaded].map((p, i) => ({
        ...p,
        sort_order: i,
        is_primary: i === 0,
      }));

      const photoRes = await fetch(
        `${API_URL}/api/campaigns/drafts/${campaignId}/photos`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            photos: photosPayloadForApi(mergedDisplay),
          }),
        },
      );
      if (!photoRes.ok) {
        const t = await photoRes.text();
        throw new Error(t || "Failed to save photo metadata");
      }

      setPhotos(mergedDisplay);
      projectImagePreviewUrls.forEach((u) => URL.revokeObjectURL(u));
      setProjectImages([]);
      setProjectImagePreviewUrls([]);

      router.push(`/create-project/rewards?draft=${campaignId}`);
    } catch (err) {
      console.error("Failed to save draft:", err);
      setSaveError(
        err instanceof Error ? err.message : "Something went wrong while saving.",
      );
    } finally {
      setSaving(false);
    }
  };

  const categories = [
    "Art",
    "Comics",
    "Crafts",
    "Dance",
    "Design",
    "Environment",
    "Education",
    "Entertainment",
    "Health",
    "Fashion",
    "Film & Video",
    "Food",
    "Games",
    "Journalism",
    "Music",
    "Photography",
    "Publishing",
    "Technology",
    "Theater",
  ];

  const emailIsValid = true; // not used here; keeping file minimal

  if (!hasHydrated) return null;

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-serif font-bold text-gray-900 mb-2">
        Start with the basics
      </h1>
      <p className="text-gray-600 mb-8">
        Make it easy for people to learn about your project.
      </p>

      <div className="space-y-8">
        {/* Project Title */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Project Title{" "}
          </label>
          <input
            type="text"
            value={draft.title}
            onChange={(e) => setBasics({ title: e.target.value })}
            onBlur={() => setTitleTouched(true)}
            placeholder="Enter your project title"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8BC34A] focus:border-transparent"
          />
          <p className="mt-2 text-sm text-gray-500">
            Make it clear, specific, and easy to recognize.
          </p>
          {/* ✅ error only AFTER touched */}
          {titleTouched && !titleValid && (
            <p className="mt-2 text-sm text-red-500">
              Please enter a project title to continue.
            </p>
          )}
        </div>

        {/* Category + Location */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Category
            </label>
            <select
              value={draft.category}
              onChange={(e) => setBasics({ category: e.target.value })}
              onBlur={() => setCategoryTouched(true)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8BC34A] focus:border-transparent bg-white"
            >
              <option value="">Select a category</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            {categoryTouched && !categoryValid && (
              <p className="mt-2 text-sm text-red-500">
                Please select a category to continue.
              </p>
            )}
          </div>

          <LocationAutocomplete
            value={draft.location}
            onChange={(val) => setBasics({ location: val })}
            onBlur={() => setLocationTouched(true)}
            error={locationTouched && !locationValid ? "Please enter a project location to continue." : undefined}
          />
        </div>

        {/* Project Image */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Project images & video (optional)
          </label>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/mp4,video/webm,video/quicktime"
            multiple
            className="hidden"
            onChange={onFileChange}
          />

          <div
            role="button"
            tabIndex={0}
            onClick={openFilePicker}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") openFilePicker();
            }}
            onDrop={onDrop}
            onDragOver={onDragOver}
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 hover:border-[#8BC34A] transition-colors cursor-pointer"
          >
            <div className="flex items-center justify-between mb-4">
              <p className="text-gray-700 font-medium">
                Upload up to {MAX_MEDIA} images or videos
              </p>
              <p className="text-sm text-gray-500">
                {draft.photos.length + projectImages.length}/{MAX_MEDIA}
              </p>
            </div>

            {draft.photos.length === 0 && projectImages.length === 0 ? (
              <div className="text-center">
                <p className="text-gray-600 mb-2">
                  Drag and drop images or videos, or{" "}
                  <span className="text-[#8BC34A] font-medium underline">
                    browse
                  </span>
                </p>
                <p className="text-sm text-gray-400">
                  Images: JPG, PNG, WebP, GIF (max 12MB). Videos: MP4, WebM, MOV
                  (max 100MB). Recommended image size 1024×576 (16:9). Files upload
                  when you save and continue.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {draft.photos.map((p, idx) => {
                  const src = displayUrlForPhoto(p);
                  const isVid = isVideoContentType(p.content_type);
                  return (
                    <div key={`saved-${p.s3_key}-${idx}`} className="relative">
                      {src ? (
                        isVid ? (
                          <video
                            src={src}
                            controls
                            playsInline
                            className="h-28 w-full object-cover rounded-md border bg-black"
                          />
                        ) : (
                          <img
                            src={src}
                            alt={`Project ${idx + 1}`}
                            className="h-28 w-full object-cover rounded-md border"
                          />
                        )
                      ) : (
                        <div className="h-28 w-full rounded-md border bg-gray-100 flex items-center justify-center text-xs text-gray-500">
                          Media
                        </div>
                      )}
                      {idx === 0 && (
                        <span className="absolute bottom-2 left-2 text-[10px] font-medium bg-black/60 text-white px-1.5 py-0.5 rounded">
                          Primary
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeSavedPhoto(idx);
                        }}
                        className="absolute top-2 right-2 bg-white/90 hover:bg-white text-gray-800 rounded-full px-2 py-1 text-xs border"
                      >
                        Remove
                      </button>
                    </div>
                  );
                })}
                {projectImagePreviewUrls.map((url, idx) => {
                  const file = projectImages[idx];
                  const isVid = file?.type?.startsWith("video/");
                  return (
                  <div key={url} className="relative">
                    {isVid ? (
                      <video
                        src={url}
                        controls
                        playsInline
                        className="h-28 w-full object-cover rounded-md border border-dashed border-[#8BC34A] bg-black"
                      />
                    ) : (
                      <img
                        src={url}
                        alt={`New ${idx + 1}`}
                        className="h-28 w-full object-cover rounded-md border border-dashed border-[#8BC34A]"
                      />
                    )}
                    <span className="absolute bottom-2 left-2 text-[10px] font-medium bg-[#8BC34A]/90 text-white px-1.5 py-0.5 rounded">
                      New
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeImageAt(idx);
                      }}
                      className="absolute top-2 right-2 bg-white/90 hover:bg-white text-gray-800 rounded-full px-2 py-1 text-xs border"
                    >
                      Remove
                    </button>
                  </div>
                  );
                })}
              </div>
            )}

            {draft.photos.length + projectImages.length > 0 && (
              <div className="mt-4 flex gap-3">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openFilePicker();
                  }}
                  className="text-sm text-[#8BC34A] font-medium underline"
                >
                  Add more
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    clearAllImages();
                  }}
                  className="text-sm text-gray-600 underline"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>
          <p className="mt-2 text-sm text-gray-500">
            Strong images and short videos help backers connect with your project.
          </p>
          {saveError && (
            <p className="mt-2 text-sm text-red-600" role="alert">
              {saveError}
            </p>
          )}
        </div>

        {/* Funding Goal */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Funding Goal{" "}
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
              $
            </span>
            <input
              type="text"
              value={fundingGoalString}
              onChange={(e) => {
                const raw = e.target.value.replace(/,/g, "");
                const dollars = parseFloat(raw);
                setBasics({
                  funding_goal_cents: Number.isFinite(dollars)
                    ? Math.round(dollars * 100)
                    : 0,
                });
              }}
              onBlur={() => setFundingTouched(true)}
              placeholder="0"
              className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8BC34A] focus:border-transparent"
            />
          </div>
          <p className="mt-2 text-sm text-gray-500">
            Lower, achievable goals increase your chances of success and build early momentum.
          </p>
          {/* ✅ error only AFTER touched */}
          {fundingTouched && !fundingValid && (
            <p className="mt-2 text-sm text-red-500">
              Please enter a funding goal to continue.
            </p>
          )}
        </div>

        {/* Campaign Duration */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Campaign Duration (1-365 days max){" "}
          </label>
          <div className="relative">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="0"
              value={durationInput}
              onChange={(e) => {
                const raw = e.target.value.replace(/\D/g, "");
                setDurationInput(raw);

                if (raw === "") return;

                const num = parseInt(raw, 10);
                const clamped = Math.min(365, Math.max(1, num));
                setBasics({ duration_days: clamped });
              }}
              onBlur={() => {
                setDurationTouched(true);

                if (durationInput.trim() === "") return;

                const num = parseInt(durationInput, 10);
                const clamped = Math.min(365, Math.max(1, num));

                setBasics({ duration_days: clamped });
                setDurationInput(String(clamped));
              }}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8BC34A]"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">
              days
            </span>
          </div>
          <p className="mt-2 text-sm text-gray-500">
            Shorter campaigns create urgency and tend to perform better than longer ones.
          </p>
          {/* ✅ error only AFTER touched */}
          {durationTouched && !durationValid && (
            <p className="mt-2 text-sm text-red-500">
              Please enter a duration between 1 and 365 days to continue.
            </p>
          )}
        </div>
      </div>

      <div className="mt-12 flex justify-end">
        <button
          type="button"
          onClick={handleNext}
          disabled={saving}
          className="bg-[#8BC34A] text-white px-8 py-3 rounded-full font-medium hover:bg-[#7CB342] transition-colors disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save & Continue"}
        </button>
      </div>

      <DraftDebug />
    </div>
  );
}

"use client";

import { useState, useEffect, useRef } from "react";
import { useUser, useReverification } from "@clerk/nextjs";
import Link from "next/link";
import Image from "next/image";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { syncClerkToBackendToken } from "@/lib/backendToken";
import { defaultBusinessUsername } from "@/lib/businessUsername";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const USERNAME_MAX_LENGTH = 30;

const BANNED_WORD_PATTERNS = [
  /\bfuck(?:ing|er|ed|s)?\b/i,
  /\bshit(?:ty|s)?\b/i,
  /\bbitch(?:es)?\b/i,
  /\basshole(?:s)?\b/i,
  /\bdamn\b/i,
];

function normalizeForProfanityCheck(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function containsBlockedWords(value: string) {
  const normalized = normalizeForProfanityCheck(value);
  return BANNED_WORD_PATTERNS.some((pattern) => pattern.test(normalized));
}

function normalizeUsernameInput(value: string) {
  return value.toLowerCase().replace(/[^a-z_]/g, "").replace(/\s+/g, "");
}

function normalizeWebsiteInput(value: string) {
  return value.trim().toLowerCase();
}

function isValidWebsite(value: string) {
  if (!value) return true;
  try {
    const withProtocol = /^https?:\/\//.test(value) ? value : `https://${value}`;
    const url = new URL(withProtocol);
    return !!url.hostname && url.hostname.includes(".");
  } catch {
    return false;
  }
}

type TabType = "account" | "edit-profile" | "payment-methods" | "create-business";

export default function SettingsPage() {
  const { user, isLoaded } = useUser();
  const isGoogleAccount = !!user?.externalAccounts?.some(
    (account) => account.provider === "google"
  );

  const canChangePassword = !!user?.passwordEnabled;
  const shouldShowPasswordSection = canChangePassword;

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [activeTab, setActiveTab] = useState<TabType>("edit-profile");
  const [isDirty, setIsDirty] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const [profileFirstName, setProfileFirstName] = useState("");
  const [profileLastName, setProfileLastName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [address, setAddress] = useState("");
  const [state, setState] = useState("");
  const [country, setCountry] = useState("United States");
  const [timeZone, setTimeZone] = useState("");
  const [website, setWebsite] = useState("");
  const [username, setUsername] = useState("");
  const [aboutYou, setAboutYou] = useState("");
  const [accountType, setAccountType] = useState<0 | 1>(1);
  const [privacyOption1, setPrivacyOption1] = useState(true);
  const [privacyOption2, setPrivacyOption2] = useState(false);

  const allInterests = [
    "Art", "Comics", "Crafts", "Dance", "Design",
    "Entertainment", "Fashion", "Film & Video", "Food", "Games",
    "Journalism", "Music", "Photography", "Publishing",
    "Technology", "Theater",
  ];
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const MAX_INTERESTS = 5;

  const [nameOnCard, setNameOnCard] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [securityCode, setSecurityCode] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [cvc, setCvc] = useState("");
  const [billingFullName, setBillingFullName] = useState("");
  const [billingAddress, setBillingAddress] = useState("");
  const [billingCity, setBillingCity] = useState("");
  const [billingZip, setBillingZip] = useState("");
  const [billingCountry, setBillingCountry] = useState("United States");

  const [bizStep, setBizStep] = useState<"credentials" | "profile">("credentials");
  const [bizClerkId, setBizClerkId] = useState<string | null>(null);
  const [businessEmail, setBusinessEmail] = useState("");
  const [businessPassword, setBusinessPassword] = useState("");
  const [businessConfirmPassword, setBusinessConfirmPassword] = useState("");
  const [showBizPassword, setShowBizPassword] = useState(false);
  const [showBizConfirmPassword, setShowBizConfirmPassword] = useState(false);
  const [bizIsLoading, setBizIsLoading] = useState(false);
  const [bizError, setBizError] = useState("");

  const [businessName, setBusinessName] = useState("");
  const [businessBio, setBusinessBio] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [businessState, setBusinessState] = useState("");
  const [businessTimezone, setBusinessTimezone] = useState("");
  const [businessLogoFile, setBusinessLogoFile] = useState<File | null>(null);
  const [businessLogoPreview, setBusinessLogoPreview] = useState<string | null>(null);
  const [businessErrors, setBusinessErrors] = useState<Record<string, string>>({});
  const [isCreatingBusiness, setIsCreatingBusiness] = useState(false);
  const [businessCreated, setBusinessCreated] = useState(false);
  const businessLogoInputRef = useRef<HTMLInputElement | null>(null);


  useEffect(() => {
    if (!isLoaded || !user) return;

    const clerkName = user.fullName || "";
    const clerkEmail = user.primaryEmailAddress?.emailAddress || "";

    setFullName(clerkName);
    setEmail(clerkEmail);

    setProfileFirstName(user.firstName || "");
    setProfileLastName(user.lastName || "");
    setProfileEmail(clerkEmail);

    setNameOnCard(clerkName);
    setBillingFullName(clerkName);
  }, [isLoaded, user]);

  useEffect(() => {
    if (!isLoaded || !user?.id) return;

    async function fetchCreator() {
      try {
        const res = await fetch(`${API_URL}/api/users/${user!.id}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.name) setProfileFirstName(data.name);
        if (data.last_name) setProfileLastName(data.last_name);
        if (data.email) setProfileEmail(data.email);
        if (data.bio) setAboutYou(data.bio);
        if (data.phone_number) setContactNumber(data.phone_number);
        if (data.address) setAddress(data.address);
        if (data.state) setState(data.state);
        if (data.time_zone) setTimeZone(data.time_zone);
        if (data.website) setWebsite(data.website);
        if (data.username) setUsername(data.username);
        else if (user?.id) setUsername(user.id);
        if (typeof data.user_type === "number") setAccountType(data.user_type === 0 ? 0 : 1);
      } catch (err) {
        console.error("Error fetching creator profile:", err);
      }
    }

    fetchCreator();

    const token = localStorage.getItem("cf_backend_token");
    if (token) {
      fetch(`${API_URL}/api/users/me/interests`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => (res.ok ? res.json() : []))
        .then((data: { name: string }[]) => setSelectedInterests(data.map((d) => d.name)))
        .catch((err) => console.error("Error fetching interests:", err));
    }
  }, [isLoaded, user?.id]);

  const toggleInterest = (name: string) => {
    setSelectedInterests((prev) => {
      if (prev.includes(name)) return prev.filter((i) => i !== name);
      if (prev.length >= MAX_INTERESTS) return prev;
      return [...prev, name];
    });
    setIsDirty(true);
  };

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    if (!isDirty) return;

    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("http") || href.startsWith("#")) return;
      if (!confirm("Are you sure you want to leave? All changes will be lost.")) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [isDirty]);

  async function handleProfileImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!user) return;

    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploadingPhoto(true);

      await user.setProfileImage({ file });
      await user.reload();
      await syncClerkToBackendToken(user);

      setIsDirty(true);
    } catch (err) {
      console.error("Error updating profile image:", err);
      alert("Failed to update profile photo. Please try again.");
    } finally {
      setIsUploadingPhoto(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

   // Step 1: register business user in our database (no Clerk involvement)
 const handleBusinessSignUp = async () => {
   setBizError("");
   const personalEmail = user?.primaryEmailAddress?.emailAddress || "";
   if (!businessEmail.trim()) { setBizError("Business email is required"); return; }
   if (businessEmail.trim().toLowerCase() === personalEmail.toLowerCase()) {
     setBizError("You must use a different email from your personal account");
     return;
   }
   if (!businessPassword) { setBizError("Password is required"); return; }
   if (businessPassword.length < 8) { setBizError("Password must be at least 8 characters"); return; }
   if (businessPassword !== businessConfirmPassword) { setBizError("Passwords do not match"); return; }


   setBizIsLoading(true);
   try {
     const res = await fetch(`${API_URL}/api/auth/register-business`, {
       method: "POST",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify({
         email: businessEmail.trim(),
         name: businessEmail.trim(), // placeholder; overwritten in Step 2 save
         password: businessPassword,
         owner_id: user?.id ?? null,
       }),
     });


     if (!res.ok) {
       const err = await res.json().catch(() => ({}));
       const msg = err.detail || "Failed to create business account";
       setBizError(typeof msg === "string" ? msg : JSON.stringify(msg));
       return;
     }


     const data = await res.json();
     setBizClerkId(data.user?.id ?? null);
     setBizStep("profile");
   } catch (err) {
     setBizError(err instanceof Error ? err.message : "Network error. Please try again.");
   } finally {
     setBizIsLoading(false);
   }
 };


 // Step 3: save business profile to backend using the business Clerk ID
 const handleCreateBusiness = async () => {
   if (!bizClerkId) return;
   if (!businessName.trim()) { setBusinessErrors({ businessName: "Business name is required" }); return; }
   setBusinessErrors({});
   setIsCreatingBusiness(true);
   try {
     const token = localStorage.getItem("cf_backend_token");


     // Upload logo if provided
     let logoUrl: string | null = null;
     if (businessLogoFile) {
       const formData = new FormData();
       formData.append("file", businessLogoFile);
       const uploadRes = await fetch(`${API_URL}/api/uploads/image`, {
         method: "POST",
         headers: token ? { Authorization: `Bearer ${token}` } : {},
         body: formData,
       });
       if (uploadRes.ok) {
         const uploadData = await uploadRes.json();
         logoUrl = uploadData.url ?? null;
       }
     }


     // Save profile to the business Clerk ID (not the individual user's ID)
     const res = await fetch(`${API_URL}/api/users/${bizClerkId}`, {
       method: "PUT",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify({
         username: defaultBusinessUsername(bizClerkId),
         name: businessName,
         bio: businessBio,
         phone_number: businessPhone,
         address: businessAddress,
         state: businessState,
         time_zone: businessTimezone,
         ...(logoUrl ? { avatar_url: logoUrl } : {}),
       }),
     });


     if (!res.ok) {
       const err = await res.json().catch(() => ({}));
       throw new Error(err.detail || "Failed to save business profile");
     }


     setBusinessCreated(true);
   } catch (err) {
     console.error("Error saving business profile:", err);
     alert(err instanceof Error ? err.message : "Failed to save business profile. Please try again.");
   } finally {
     setIsCreatingBusiness(false);
   }
 };



  const updatePasswordWithReverification = useReverification(
    async (currentPw: string, newPw: string) => {
      if (!user) throw new Error("User not loaded");
      await user.updatePassword({
        currentPassword: currentPw,
        newPassword: newPw,
        signOutOfOtherSessions: true,
      });
    }
  );

  const handlePasswordChange = async () => {
    if (!oldPassword) { setPasswordError("Enter your current password."); return; }
    if (!newPassword) { setPasswordError("Enter a new password."); return; }
    setPasswordSaving(true);
    setPasswordError("");
    setPasswordSuccess("");
    try {
      await updatePasswordWithReverification(oldPassword, newPassword);
      await user!.reload();
      setOldPassword("");
      setNewPassword("");
      setPasswordSuccess("Password updated successfully.");
    } catch (err: unknown) {
      let message = "Failed to update password. Please try again.";
      if (err && typeof err === "object" && "errors" in err) {
        const clerkErrors = (err as { errors: Array<{ longMessage?: string; message?: string }> }).errors;
        if (Array.isArray(clerkErrors) && clerkErrors.length > 0) {
          message = clerkErrors[0].longMessage || clerkErrors[0].message || message;
        }
      } else if (err instanceof Error) {
        message = err.message;
      }
      setPasswordError(message);
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleSave = async () => {
    if (!user?.id) return;
    setIsSaving(true);

    try {
      let normalizedUsername = normalizeUsernameInput(username);

      // Auto-fill from first + last name if the user cleared the field
      if (!normalizedUsername) {
        const first = normalizeUsernameInput(profileFirstName);
        const last = normalizeUsernameInput(profileLastName);
        normalizedUsername = [first, last].filter(Boolean).join("_");
        setUsername(normalizedUsername);
      }

      if (!normalizedUsername) {
        throw new Error("Username is required. Please enter a username before saving.");
      }

      const normalizedWebsite = normalizeWebsiteInput(website);

      const valuesToFilter = [
        { label: "First name", value: profileFirstName },
        { label: "Last name", value: profileLastName },
        { label: "Username", value: normalizedUsername },
        { label: "Contact number", value: contactNumber },
        { label: "Address", value: address },
        { label: "State", value: state },
        { label: "Time zone", value: timeZone },
        { label: "Website", value: normalizedWebsite },
        { label: "About you", value: aboutYou },
      ];

      const blockedField = valuesToFilter.find(
        (item) => item.value && containsBlockedWords(item.value)
      );
      if (blockedField) {
        throw new Error(
          `Please remove profanity from ${blockedField.label.toLowerCase()} and try again.`
        );
      }

      if (normalizedUsername && !/^[a-z_]+$/.test(normalizedUsername)) {
        throw new Error("Username can only contain lowercase letters and underscores.");
      }

      if (normalizedUsername.includes(" ")) {
        throw new Error("Username cannot contain spaces.");
      }

      if (normalizedWebsite && !isValidWebsite(normalizedWebsite)) {
        throw new Error("Link is invalid.");
      }

      setUsername(normalizedUsername);
      setWebsite(normalizedWebsite);

      const token = localStorage.getItem("cf_backend_token");

      const requests: Promise<Response>[] = [
        fetch(`${API_URL}/api/users/${user.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: profileFirstName,
            last_name: profileLastName,
            username: normalizedUsername,
            bio: aboutYou,
            phone_number: contactNumber,
            address,
            state,
            time_zone: timeZone,
            website: normalizedWebsite,
            user_type: accountType,
          }),
        }),
      ];

      if (token) {
        requests.push(
          fetch(`${API_URL}/api/users/me/interests`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ interest_names: selectedInterests }),
          })
        );
      }

      const [profileRes] = await Promise.all(requests);
      if (!profileRes.ok) throw new Error("Failed to save profile");

      setIsDirty(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: unknown) {
      console.error("Error saving profile:", err);
      let message = "Failed to save. Please try again.";
      if (err && typeof err === "object" && "errors" in err) {
        const clerkErrors = (err as { errors: Array<{ longMessage?: string; message?: string }> }).errors;
        if (Array.isArray(clerkErrors) && clerkErrors.length > 0) {
          message = clerkErrors[0].longMessage || clerkErrors[0].message || message;
        }
      } else if (err instanceof Error) {
        message = err.message;
      }
      alert(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-white" onInput={() => setIsDirty(true)}>
      <Header />

      <div className="bg-[#F5F9F0]">
        <div className="max-w-4xl mx-auto w-full px-6 pt-8 pb-0">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Settings</h1>

          <div className="border-b border-[#8BC34A]/30">
            <nav className="flex space-x-8">
              <button
                onClick={() => setActiveTab("edit-profile")}
                className={`pb-4 text-sm font-medium transition-colors ${
                  activeTab === "edit-profile"
                    ? "text-gray-900 border-b-2 border-[#8BC34A]"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Edit Profile
              </button>
              <button
                onClick={() => setActiveTab("payment-methods")}
                className={`pb-4 text-sm font-medium transition-colors ${
                  activeTab === "payment-methods"
                    ? "text-gray-900 border-b-2 border-[#8BC34A]"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Payment Methods
              </button>
              <button
                onClick={() => setActiveTab("create-business")}
                className={`pb-4 text-sm font-medium transition-colors ${
                  activeTab === "create-business"
                    ? "text-gray-900 border-b-2 border-[#8BC34A]"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Create Business
              </button>
            </nav>
          </div>
        </div>
      </div>

      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-8">
        {activeTab === "edit-profile" && (
          <div className="space-y-8">
            <h2 className="text-2xl font-serif font-bold text-gray-900">
              Edit Profile
            </h2>

            <div className="relative w-24 h-24">
              {user?.imageUrl ? (
                <Image
                  src={user.imageUrl}
                  alt="Profile"
                  width={96}
                  height={96}
                  className="rounded-full object-cover w-24 h-24"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500" />
              )}

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingPhoto || !user}
                className="absolute bottom-0 right-0 w-7 h-7 bg-[#8BC34A] rounded-full flex items-center justify-center text-white shadow-md hover:bg-[#7CB342] transition-colors disabled:opacity-50"
              >
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
                    d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                  />
                </svg>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleProfileImageChange}
              />
            </div>

            <p className="text-sm text-gray-500 -mt-4">
              {isUploadingPhoto ? "Uploading photo..." : "Click the pencil to change your profile photo."}
            </p>

            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label
                    htmlFor="profileFirstName"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    First Name
                  </label>
                  <input
                    id="profileFirstName"
                    type="text"
                    value={profileFirstName}
                    onChange={(e) => setProfileFirstName(e.target.value)}
                    placeholder="First name"
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-[#8BC34A] focus:ring-1 focus:ring-[#8BC34A]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="profileLastName"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Last Name
                  </label>
                  <input
                    id="profileLastName"
                    type="text"
                    value={profileLastName}
                    onChange={(e) => setProfileLastName(e.target.value)}
                    placeholder="Last name"
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-[#8BC34A] focus:ring-1 focus:ring-[#8BC34A]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label
                    htmlFor="username"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Username
                  </label>
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(normalizeUsernameInput(e.target.value))}
                    placeholder="username"
                    maxLength={USERNAME_MAX_LENGTH}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-[#8BC34A] focus:ring-1 focus:ring-[#8BC34A]"
                  />
                  <p className="mt-2 text-xs text-gray-500">
                    Used in your public profile URL. Lowercase letters and underscores only. Max 30 characters.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="accountType"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Contact Number
                  </label>
                  <input
                    id="contactNumber"
                    type="tel"
                    value={contactNumber}
                    onChange={(e) => setContactNumber(e.target.value.replace(/\D/g, ""))}
                    placeholder="Phone number"
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-[#8BC34A] focus:ring-1 focus:ring-[#8BC34A]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="address"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Address
                  </label>
                  <input
                    id="address"
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Street address"
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-[#8BC34A] focus:ring-1 focus:ring-[#8BC34A]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label
                    htmlFor="state"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    State
                  </label>
                  <input
                    id="state"
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="State"
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-[#8BC34A] focus:ring-1 focus:ring-[#8BC34A]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="country"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Country
                  </label>
                  <div className="relative">
                    <select
                      id="country"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-[#8BC34A] focus:ring-1 focus:ring-[#8BC34A] appearance-none bg-white"
                    >
                      <option value="United States">United States</option>
                      <option value="Canada">Canada</option>
                      <option value="United Kingdom">United Kingdom</option>
                      <option value="Australia">Australia</option>
                      <option value="Germany">Germany</option>
                      <option value="France">France</option>
                    </select>
                    <svg
                      className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label
                      htmlFor="timeZone"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      Time Zone
                    </label>
                    <input
                      id="timeZone"
                      type="text"
                      value={timeZone}
                      onChange={(e) => setTimeZone(e.target.value)}
                      placeholder="GMT-6"
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-[#8BC34A] focus:ring-1 focus:ring-[#8BC34A]"
                    />
                    <p className="mt-2 text-xs text-gray-500">
                      e.g. EST, PST, GMT-6
                    </p>
                  </div>
                  <div>
                    <label
                      htmlFor="website"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      Website
                    </label>
                    <input
                      id="website"
                      type="url"
                      value={website}
                      onChange={(e) => setWebsite(normalizeWebsiteInput(e.target.value))}
                      placeholder="https://example.com"
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-[#8BC34A] focus:ring-1 focus:ring-[#8BC34A]"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label
                  htmlFor="aboutYou"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  About You
                </label>
                <textarea
                  id="aboutYou"
                  value={aboutYou}
                  onChange={(e) => setAboutYou(e.target.value)}
                  placeholder="Enter Description"
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-[#8BC34A] focus:ring-1 focus:ring-[#8BC34A] resize-none"
                />
                <p className="mt-2 text-xs text-gray-500">
                  We suggest a short bio. If it&apos;s 300 characters or less it&apos;ll look great on your profile.
                </p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-2">Your Interests</h3>
                <p className="text-xs text-gray-500 mb-4">
                  Select up to {MAX_INTERESTS} interests. {selectedInterests.length} of {MAX_INTERESTS} selected.
                </p>
                <div className="flex flex-wrap gap-2">
                  {allInterests.map((interest) => {
                    const isSelected = selectedInterests.includes(interest);
                    const isDisabled = !isSelected && selectedInterests.length >= MAX_INTERESTS;
                    return (
                      <button
                        key={interest}
                        type="button"
                        onClick={() => toggleInterest(interest)}
                        disabled={isDisabled}
                        className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                          isSelected
                            ? "bg-[#8BC34A] text-white border-[#8BC34A]"
                            : isDisabled
                              ? "bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed"
                              : "bg-white text-gray-700 border-gray-300 hover:border-[#8BC34A] hover:text-[#8BC34A]"
                        }`}
                      >
                        {isSelected ? `${interest} ×` : interest}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end items-center gap-4 pt-4">
                {saveSuccess && (
                  <span className="text-sm text-green-600 font-medium">Profile saved!</span>
                )}
                <Link
                  href={username ? `/profile/${username}` : user?.id ? `/profile/${user.id}` : "#"}
                  className="px-6 py-3 text-gray-700 font-medium hover:text-gray-900 transition-colors"
                >
                  View Profile
                </Link>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-8 py-3 bg-[#8BC34A] text-white rounded-lg font-medium hover:bg-[#7CB342] transition-colors disabled:opacity-50"
                >
                  {isSaving ? "Saving..." : "Save"}
                </button>
              </div>

              {shouldShowPasswordSection && (
                <div className="border border-gray-200 rounded-xl p-6 space-y-4">
                  <h3 className="text-sm font-medium text-gray-900">Change Password</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label
                        htmlFor="oldPassword"
                        className="block text-sm font-medium text-gray-700 mb-2"
                      >
                        Current Password
                      </label>
                      <input
                        id="oldPassword"
                        type="password"
                        value={oldPassword}
                        onChange={(e) => { setOldPassword(e.target.value); setPasswordError(""); setPasswordSuccess(""); }}
                        placeholder="••••••••"
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-[#8BC34A] focus:ring-1 focus:ring-[#8BC34A]"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="newPassword"
                        className="block text-sm font-medium text-gray-700 mb-2"
                      >
                        New Password
                      </label>
                      <input
                        id="newPassword"
                        type="password"
                        value={newPassword}
                        onChange={(e) => { setNewPassword(e.target.value); setPasswordError(""); setPasswordSuccess(""); }}
                        placeholder="••••••••"
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-[#8BC34A] focus:ring-1 focus:ring-[#8BC34A]"
                      />
                    </div>
                  </div>
                  {passwordError && <p className="text-sm text-red-600">{passwordError}</p>}
                  {passwordSuccess && <p className="text-sm text-[#8BC34A] font-medium">{passwordSuccess}</p>}
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handlePasswordChange}
                      disabled={passwordSaving}
                      className="px-6 py-2.5 bg-[#8BC34A] text-white rounded-lg text-sm font-medium hover:bg-[#7CB342] transition-colors disabled:opacity-50"
                    >
                      {passwordSaving ? "Updating…" : "Update Password"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "payment-methods" && (
          <div className="space-y-8">
            <h2 className="text-2xl font-serif font-bold text-gray-900">
              Edit Payments Details
            </h2>

            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label
                    htmlFor="nameOnCard"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Name on card
                  </label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2">
                      <svg
                        className="w-6 h-4"
                        viewBox="0 0 24 16"
                        fill="none"
                      >
                        <rect width="24" height="16" rx="2" fill="#8BC34A" />
                        <rect x="2" y="4" width="8" height="3" rx="0.5" fill="#FFF" />
                        <rect x="2" y="9" width="5" height="2" rx="0.5" fill="#FFF" opacity="0.7" />
                      </svg>
                    </div>
                    <input
                      id="nameOnCard"
                      type="text"
                      value={nameOnCard}
                      onChange={(e) => setNameOnCard(e.target.value)}
                      placeholder="Thomas.D"
                      className="w-full pl-14 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-[#8BC34A] focus:ring-1 focus:ring-[#8BC34A]"
                    />
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="cardNumber"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Credit card number
                  </label>
                  <div className="relative">
                    <input
                      id="cardNumber"
                      type="text"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      placeholder="Card number"
                      className="w-full px-4 py-3 pr-12 border border-gray-200 rounded-lg focus:outline-none focus:border-[#8BC34A] focus:ring-1 focus:ring-[#8BC34A]"
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
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label
                    htmlFor="securityCode"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Security code
                  </label>
                  <input
                    id="securityCode"
                    type="password"
                    value={securityCode}
                    onChange={(e) => setSecurityCode(e.target.value)}
                    placeholder="******"
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-[#8BC34A] focus:ring-1 focus:ring-[#8BC34A]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="expirationDate"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Expiration date
                  </label>
                  <input
                    id="expirationDate"
                    type="text"
                    value={expirationDate}
                    onChange={(e) => setExpirationDate(e.target.value)}
                    placeholder="MM/YY"
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-[#8BC34A] focus:ring-1 focus:ring-[#8BC34A]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="cvc"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    CVC
                  </label>
                  <input
                    id="cvc"
                    type="text"
                    value={cvc}
                    onChange={(e) => setCvc(e.target.value)}
                    placeholder="CVV"
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-[#8BC34A] focus:ring-1 focus:ring-[#8BC34A]"
                  />
                </div>
              </div>

              <div className="border-t border-gray-200 pt-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">
                  Billing Address
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label
                      htmlFor="billingFullName"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      Full name
                    </label>
                    <input
                      id="billingFullName"
                      type="text"
                      value={billingFullName}
                      onChange={(e) => setBillingFullName(e.target.value)}
                      placeholder="Thomas.D"
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-[#8BC34A] focus:ring-1 focus:ring-[#8BC34A]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="billingAddress"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      Billing address
                    </label>
                    <input
                      id="billingAddress"
                      type="text"
                      value={billingAddress}
                      onChange={(e) => setBillingAddress(e.target.value)}
                      placeholder="4085 Gleason Drives"
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-[#8BC34A] focus:ring-1 focus:ring-[#8BC34A]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label
                      htmlFor="billingCity"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      City
                    </label>
                    <input
                      id="billingCity"
                      type="text"
                      value={billingCity}
                      onChange={(e) => setBillingCity(e.target.value)}
                      placeholder="West Derickshire"
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-[#8BC34A] focus:ring-1 focus:ring-[#8BC34A]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="billingZip"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      Zip
                    </label>
                    <input
                      id="billingZip"
                      type="text"
                      value={billingZip}
                      onChange={(e) => setBillingZip(e.target.value)}
                      placeholder="50703"
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-[#8BC34A] focus:ring-1 focus:ring-[#8BC34A]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="billingCountry"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      Country
                    </label>
                    <div className="relative">
                      <select
                        id="billingCountry"
                        value={billingCountry}
                        onChange={(e) => setBillingCountry(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-[#8BC34A] focus:ring-1 focus:ring-[#8BC34A] appearance-none bg-white"
                      >
                        <option value="United States">United States</option>
                        <option value="Canada">Canada</option>
                        <option value="United Kingdom">United Kingdom</option>
                        <option value="Australia">Australia</option>
                        <option value="Germany">Germany</option>
                        <option value="France">France</option>
                      </select>
                      <svg
                        className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end items-center gap-4 pt-8">
                <Link
                  href={username ? `/profile/${username}` : user?.id ? `/profile/${user.id}` : "#"}
                  className="px-6 py-3 text-gray-700 font-medium hover:text-gray-900 transition-colors"
                >
                  View Profile
                </Link>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-8 py-3 bg-[#8BC34A] text-white rounded-lg font-medium hover:bg-[#7CB342] transition-colors disabled:opacity-50"
                >
                  {isSaving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        )}
        {activeTab === "create-business" && (
          <div className="space-y-8 max-w-xl">
            <h2 className="text-2xl font-serif font-bold text-gray-900">Create Business Account</h2>

            {businessCreated ? (
              <div className="flex flex-col items-center gap-4 py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-[#8BC34A]/10 flex items-center justify-center">
                  <svg className="w-8 h-8 text-[#8BC34A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Business account created!</h3>
                <p className="text-sm text-gray-500">Your business is ready. Go to your business dashboard to start creating campaigns.</p>
                {bizClerkId && (
                  <Link
                    href={`/business/${bizClerkId}`}
                    className="px-6 py-3 bg-[#8BC34A] text-white rounded-lg font-medium hover:bg-[#7CB342] transition-colors"
                  >
                    Go to Business Dashboard
                  </Link>
                )}
              </div>
            ) : bizStep === "credentials" ? (
              <div className="space-y-6">
                <p className="text-sm text-gray-500">
                  Create a separate business account linked to your personal account. Use a different email from your personal account.
                </p>

                <div>
                  <label htmlFor="businessEmail" className="block text-sm font-medium text-gray-700 mb-2">
                    Business Email
                  </label>
                  <input
                    id="businessEmail"
                    type="email"
                    value={businessEmail}
                    onChange={(e) => { setBusinessEmail(e.target.value); setBizError(""); }}
                    placeholder="business@example.com"
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-[#8BC34A] focus:ring-1 focus:ring-[#8BC34A]"
                  />
                </div>

                <div>
                  <label htmlFor="businessPassword" className="block text-sm font-medium text-gray-700 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="businessPassword"
                      type={showBizPassword ? "text" : "password"}
                      value={businessPassword}
                      onChange={(e) => { setBusinessPassword(e.target.value); setBizError(""); }}
                      placeholder="At least 8 characters"
                      className="w-full px-4 py-3 pr-12 border border-gray-200 rounded-lg focus:outline-none focus:border-[#8BC34A] focus:ring-1 focus:ring-[#8BC34A]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowBizPassword((v) => !v)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showBizPassword ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="businessConfirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      id="businessConfirmPassword"
                      type={showBizConfirmPassword ? "text" : "password"}
                      value={businessConfirmPassword}
                      onChange={(e) => { setBusinessConfirmPassword(e.target.value); setBizError(""); }}
                      placeholder="Re-enter password"
                      className={`w-full px-4 py-3 pr-12 border rounded-lg focus:outline-none focus:ring-1 ${
                        businessConfirmPassword && businessConfirmPassword !== businessPassword
                          ? "border-red-300 focus:border-red-400 focus:ring-red-400"
                          : "border-gray-200 focus:border-[#8BC34A] focus:ring-[#8BC34A]"
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowBizConfirmPassword((v) => !v)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showBizConfirmPassword ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                  {businessConfirmPassword && businessConfirmPassword !== businessPassword && (
                    <p className="mt-1 text-xs text-red-500">Passwords do not match</p>
                  )}
                </div>

                {bizError && <p className="text-sm text-red-600">{bizError}</p>}

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleBusinessSignUp}
                    disabled={bizIsLoading}
                    className="px-8 py-3 bg-[#8BC34A] text-white rounded-lg font-medium hover:bg-[#7CB342] transition-colors disabled:opacity-50"
                  >
                    {bizIsLoading ? "Creating..." : "Continue"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <p className="text-sm text-gray-500">
                  Add details for your business profile. You can always update these later in your business dashboard.
                </p>

                {/* Logo upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">Business Logo</label>
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 rounded-xl bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center shrink-0">
                      {businessLogoPreview ? (
                        <Image src={businessLogoPreview} alt="Logo preview" width={80} height={80} className="object-cover w-full h-full" />
                      ) : (
                        <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <input
                        ref={businessLogoInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setBusinessLogoFile(file);
                          setBusinessLogoPreview(URL.createObjectURL(file));
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => businessLogoInputRef.current?.click()}
                        className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:border-[#8BC34A] hover:text-[#8BC34A] transition-colors"
                      >
                        {businessLogoPreview ? "Change Logo" : "Upload Logo"}
                      </button>
                      <p className="text-xs text-gray-400 mt-1">PNG, JPG or GIF · max 5 MB · optional</p>
                    </div>
                  </div>
                </div>

                <div>
                  <label htmlFor="businessName" className="block text-sm font-medium text-gray-700 mb-2">
                    Business Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="businessName"
                    type="text"
                    value={businessName}
                    onChange={(e) => { setBusinessName(e.target.value); setBusinessErrors((prev) => ({ ...prev, businessName: "" })); }}
                    placeholder="Your business name"
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-1 ${
                      businessErrors.businessName
                        ? "border-red-300 focus:border-red-400 focus:ring-red-400"
                        : "border-gray-200 focus:border-[#8BC34A] focus:ring-[#8BC34A]"
                    }`}
                  />
                  {businessErrors.businessName && <p className="mt-1 text-xs text-red-500">{businessErrors.businessName}</p>}
                </div>

                <div>
                  <label htmlFor="businessBio" className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    id="businessBio"
                    value={businessBio}
                    onChange={(e) => setBusinessBio(e.target.value)}
                    placeholder="Tell people about your organization..."
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-[#8BC34A] focus:ring-1 focus:ring-[#8BC34A] resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="businessPhone" className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number
                    </label>
                    <input
                      id="businessPhone"
                      type="tel"
                      value={businessPhone}
                      onChange={(e) => setBusinessPhone(e.target.value.replace(/\D/g, ""))}
                      placeholder="(555) 000-0000"
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-[#8BC34A] focus:ring-1 focus:ring-[#8BC34A]"
                    />
                  </div>
                  <div>
                    <label htmlFor="businessTimezone" className="block text-sm font-medium text-gray-700 mb-2">
                      Time Zone
                    </label>
                    <input
                      id="businessTimezone"
                      type="text"
                      value={businessTimezone}
                      onChange={(e) => setBusinessTimezone(e.target.value)}
                      placeholder="e.g. EST, PST"
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-[#8BC34A] focus:ring-1 focus:ring-[#8BC34A]"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="businessAddress" className="block text-sm font-medium text-gray-700 mb-2">
                    Street Address
                  </label>
                  <input
                    id="businessAddress"
                    type="text"
                    value={businessAddress}
                    onChange={(e) => setBusinessAddress(e.target.value)}
                    placeholder="123 Main St"
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-[#8BC34A] focus:ring-1 focus:ring-[#8BC34A]"
                  />
                </div>

                <div>
                  <label htmlFor="businessState" className="block text-sm font-medium text-gray-700 mb-2">
                    State
                  </label>
                  <input
                    id="businessState"
                    type="text"
                    value={businessState}
                    onChange={(e) => setBusinessState(e.target.value)}
                    placeholder="e.g. California"
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-[#8BC34A] focus:ring-1 focus:ring-[#8BC34A]"
                  />
                </div>

                <div className="flex justify-between items-center pt-2">
                  <button
                    type="button"
                    onClick={() => { setBizStep("credentials"); setBizError(""); }}
                    className="px-6 py-3 text-gray-700 font-medium hover:text-gray-900 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateBusiness}
                    disabled={isCreatingBusiness}
                    className="px-8 py-3 bg-[#8BC34A] text-white rounded-lg font-medium hover:bg-[#7CB342] transition-colors disabled:opacity-50"
                  >
                    {isCreatingBusiness ? "Creating..." : "Create Business"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

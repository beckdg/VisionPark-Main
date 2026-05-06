/**
 * COMPONENT: OwnerProfile
 * PURPOSE: Manage owner identity, business credentials, security, and system notifications.
 */

import React, { useState, useRef, useEffect } from "react";
import {
  User, Mail, Phone, Building, FileText,
  Shield, Bell, Key, Save, CheckCircle,
  Camera, Upload, Eye, EyeOff, RefreshCw, X
} from "lucide-react";
import { apiClient } from "../../api/apiClient";
import { useAuth } from "../../context/AuthContext";

// --- INITIALIZATION HELPER ---
const getInitialProfile = () => {
  const savedData = localStorage.getItem("vp_owner_data");
  let parsedData = {};
  if (savedData) {
    try {
      parsedData = JSON.parse(savedData);
    } catch (e) {
      console.error("Failed to parse owner data", e);
    }
  }

  return {
    name: parsedData.name || "Not available",
    email: parsedData.email || "Not available",
    phone: parsedData.phone || "Not available",
    companyName: parsedData.companyName || "Not available",
    tinNumber: parsedData.tinNumber || "Not available",
    avatar: parsedData.avatar || null,
    profileImagePublicId: parsedData.profileImagePublicId || null,
  };
};

// Reusable Custom Toggle Switch
const Toggle = ({ label, description, enabled, onChange }) => (
  <div className="flex items-center justify-between py-3">
    <div className="pr-4">
      <h4 className="text-sm font-bold text-zinc-900 dark:text-white">{label}</h4>
      <p className="text-[10px] sm:text-xs text-zinc-500 mt-0.5">{description}</p>
    </div>
    <button
      type="button"
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none outline-none ${enabled ? 'bg-emerald-500' : 'bg-zinc-200 dark:bg-zinc-700'}`}
    >
      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${enabled ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  </div>
);

// Helper function to calculate password strength
const getPasswordStrength = (pass) => {
  if (!pass) return null;
  let score = 0;
  if (pass.length >= 6) score += 1;
  if (pass.length >= 8) score += 1;
  if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score += 1;
  if (/[0-9]/.test(pass)) score += 1;
  if (/[^A-Za-z0-9]/.test(pass)) score += 1;

  if (score <= 2) return { label: "Weak", color: "bg-red-500", width: "w-1/3", text: "text-red-500" };
  if (score === 3 || score === 4) return { label: "Fair", color: "bg-amber-500", width: "w-2/3", text: "text-amber-500" };
  return { label: "Strong", color: "bg-emerald-500", width: "w-full", text: "text-emerald-500" };
};

export default function OwnerProfile() {
  const auth = useAuth();
  const [profile, setProfile] = useState(getInitialProfile);
  const [passwords, setPasswords] = useState({ current: "", new: "", confirm: "" });

  // Password Visibility States
  const [showPasswords, setShowPasswords] = useState({ current: false, new: false, confirm: false });

  // Photo & Camera States
  const [photoMenuOpen, setPhotoMenuOpen] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  // Notification States
  const [notifyPayouts, setNotifyPayouts] = useState(true);
  const [notifyOverstays, setNotifyOverstays] = useState(false);
  const [notifyDailySummary, setNotifyDailySummary] = useState(true);

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Refs
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // --- SYNC HELPER ---
  const saveToLocalAndDispatch = (updatedProfile) => {
    localStorage.setItem("vp_owner_data", JSON.stringify(updatedProfile));
    window.dispatchEvent(new CustomEvent("vp_owner_profile_updated"));
  };

  // --- CAMERA LOGIC (WebRTC) ---
  const startCamera = async () => {
    setPhotoMenuOpen(false);
    setIsCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      alert("Camera access denied or unavailable on this device.");
      setIsCameraOpen(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
    }
    setIsCameraOpen(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(
        async (blob) => {
          if (!blob) return;
          try {
            const fd = new FormData();
            fd.append("image", new File([blob], "camera-capture.jpg", { type: "image/jpeg" }));
            const res = await apiClient.postFormData("/uploads/profile-image", fd);
            setProfile((prev) => {
              const updated = {
                ...prev,
                avatar: res?.url || prev.avatar,
                profileImagePublicId: res?.publicId || null,
              };
              saveToLocalAndDispatch(updated);
              return updated;
            });
            if (typeof auth.refreshMe === "function") {
              await auth.refreshMe();
            }
          } catch (err) {
            console.error("Camera upload failed:", err);
            alert(err?.message || "Upload failed.");
          } finally {
            stopCamera();
          }
        },
        "image/jpeg",
        0.92
      );
    }
  };

  // Cleanup camera if component unmounts
  useEffect(() => {
    return () => stopCamera();
  }, []);
  // -----------------------------

  useEffect(() => {
    let isMounted = true;

    const fetchOwnerProfile = async () => {
      try {
        const me = await apiClient.get("/auth/me");
        const ownerProfile = me?.ownerProfile || me?.owner || {};
        const backendProfile = {
          name: me?.name || "Not available",
          email: me?.email || "Not available",
          phone: ownerProfile?.phone || "Not available",
          companyName: ownerProfile?.companyName || "Not available",
          tinNumber: ownerProfile?.tinNumber || "Not available",
          avatar: me?.avatarUrl || me?.profileImageUrl || null,
          profileImagePublicId: me?.profileImagePublicId || null,
        };

        if (!isMounted) return;
        setProfile((prev) => {
          const savedData = localStorage.getItem("vp_owner_data");
          let parsedData = {};
          if (savedData) {
            try {
              parsedData = JSON.parse(savedData) || {};
            } catch {
              parsedData = {};
            }
          }

          const merged = {
            ...backendProfile,
            ...parsedData,
          };

          saveToLocalAndDispatch(merged);
          return { ...prev, ...merged };
        });
      } catch (error) {
        console.error("OwnerProfile fetch failed:", error);
      }
    };

    fetchOwnerProfile();
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleProfileChange = (field, value) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      const max = 10 * 1024 * 1024;
      if (file.size > max) {
        alert("Image must be 10MB or smaller.");
        setPhotoMenuOpen(false);
        e.target.value = null;
        return;
      }
      try {
        const fd = new FormData();
        fd.append("image", file);
        const res = await apiClient.postFormData("/uploads/profile-image", fd);
        setProfile((prev) => {
          const updated = {
            ...prev,
            avatar: res?.url || prev.avatar,
            profileImagePublicId: res?.publicId || null,
          };
          saveToLocalAndDispatch(updated);
          return updated;
        });
        if (typeof auth.refreshMe === "function") {
          await auth.refreshMe();
        }
      } catch (err) {
        console.error("Profile image upload failed:", err);
        alert(err?.message || "Upload failed. Check Cloudinary configuration and try again.");
      }
    }
    setPhotoMenuOpen(false);
    e.target.value = null;
  };

  const removePhoto = async () => {
    const pid = profile.profileImagePublicId;
    if (pid) {
      try {
        await apiClient.deleteWithBody("/uploads", { publicId: pid });
      } catch (err) {
        console.error("Remove cloud photo failed:", err);
      }
    }
    setProfile((prev) => {
      const updated = { ...prev, avatar: null, profileImagePublicId: null };
      saveToLocalAndDispatch(updated);
      return updated;
    });
    if (typeof auth.refreshMe === "function") {
      try {
        await auth.refreshMe();
      } catch {
        /* ignore */
      }
    }
    setPhotoMenuOpen(false);
  };

  const togglePasswordVisibility = (e, field) => {
    e.preventDefault();
    setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }));
  };

  // Prevent copy/paste on passwords
  const disableCopyPaste = (e) => {
    e.preventDefault();
  };

  const generateStrongPassword = (e) => {
    e.preventDefault();
    const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lower = "abcdefghijklmnopqrstuvwxyz";
    const num = "0123456789";
    const special = "!@#$%^&*";
    const all = upper + lower + num + special;

    let pass = upper[Math.floor(Math.random() * upper.length)] +
      lower[Math.floor(Math.random() * lower.length)] +
      num[Math.floor(Math.random() * num.length)] +
      special[Math.floor(Math.random() * special.length)];

    for (let i = 0; i < 8; i++) pass += all[Math.floor(Math.random() * all.length)];
    pass = pass.split('').sort(() => 0.5 - Math.random()).join('');

    setPasswords(prev => ({ ...prev, new: pass, confirm: pass }));
    setShowPasswords(prev => ({ ...prev, new: true, confirm: true }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = {
        name: profile.name,
        email: profile.email,
        avatarUrl: profile.avatar || null,
        owner: {
          phone: profile.phone,
          companyName: profile.companyName,
          tinNumber: profile.tinNumber,
        },
      };

      const updated = await apiClient.patch("/users/owners/me", payload);
      const updatedOwnerProfile = updated?.ownerProfile || updated?.owner || {};
      const nextProfile = {
        name: updated?.name || "Not available",
        email: updated?.email || "Not available",
        phone: updatedOwnerProfile?.phone || "Not available",
        companyName: updatedOwnerProfile?.companyName || "Not available",
        tinNumber: updatedOwnerProfile?.tinNumber || "Not available",
        avatar: updated?.avatarUrl || updated?.profileImageUrl || null,
        profileImagePublicId: updated?.profileImagePublicId || null,
      };

      setProfile(nextProfile);
      saveToLocalAndDispatch(nextProfile);
      if (typeof auth.refreshMe === "function") {
        await auth.refreshMe();
      }
      setIsSaving(false);
      setSaveSuccess(true);
      setPasswords({ current: "", new: "", confirm: "" });
      setShowPasswords({ current: false, new: false, confirm: false });
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error("Owner profile save failed:", error);
      setIsSaving(false);
    }
  };

  const passStrength = getPasswordStrength(passwords.new);

  return (
    <div className="w-full flex flex-col gap-6 animate-in fade-in duration-500 pb-10">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-zinc-900 dark:text-white tracking-tight">Owner Profile</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Manage your identity, business details, and system preferences.</p>
        </div>

        <div className="flex items-center gap-4">
          {saveSuccess && (
            <span className="text-sm font-bold text-emerald-500 flex items-center gap-1 animate-in fade-in slide-in-from-right-4">
              <CheckCircle className="h-4 w-4" /> Saved Successfully
            </span>
          )}
          <button
            type="button" onClick={handleSave} disabled={isSaving}
            className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 px-6 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-emerald-500/20 active:scale-[0.98] disabled:opacity-50 outline-none"
          >
            {isSaving ? "Saving..." : <><Save className="h-5 w-5" /> Save Changes</>}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* LEFT COLUMN: Profile & Business Info */}
        <div className="lg:col-span-2 space-y-6">

          {/* Personal Info Card */}
          <div className="bg-white dark:bg-[#121214] p-6 rounded-2xl border border-zinc-200 dark:border-white/5 shadow-sm">
            <div className="flex items-center gap-2 mb-6 text-emerald-500">
              <User className="h-5 w-5" />
              <h2 className="font-bold text-zinc-900 dark:text-white">Personal Information</h2>
            </div>

            <div className="flex flex-col md:flex-row gap-8">

              {/* Profile Photo Area */}
              <div className="flex flex-col items-center gap-3 shrink-0">
                <div className="relative">
                  <div className="h-28 w-28 rounded-full overflow-hidden border-4 border-zinc-50 dark:border-[#1a1a1c] shadow-lg bg-zinc-100 dark:bg-white/5 relative">
                    {profile.avatar ? (
                      <img src={profile.avatar} alt="Profile" className="h-full w-full object-cover" />
                    ) : (
                      <User className="h-12 w-12 text-zinc-300 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                    )}
                  </div>

                  <button
                    type="button" onClick={() => setPhotoMenuOpen(!photoMenuOpen)}
                    className="absolute -bottom-2 -right-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 p-2 rounded-full shadow-lg transition-transform hover:scale-110 outline-none"
                  >
                    <Camera className="h-4 w-4" />
                  </button>

                  {/* Photo Upload Menu */}
                  {photoMenuOpen && (
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-48 bg-white dark:bg-[#18181b] rounded-xl shadow-xl border border-zinc-200 dark:border-white/10 p-1.5 z-50 animate-in fade-in zoom-in-95">
                      <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2.5 w-full p-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-white/5 rounded-lg outline-none transition-colors">
                        <Upload className="h-4 w-4 text-emerald-500" /> Upload Photo
                      </button>

                      {/* WebRTC Camera Trigger */}
                      <button type="button" onClick={startCamera} className="flex items-center gap-2.5 w-full p-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-white/5 rounded-lg outline-none transition-colors">
                        <Camera className="h-4 w-4 text-blue-500" /> Take Photo
                      </button>

                      {profile.avatar && (
                        <button type="button" onClick={removePhoto} className="flex items-center gap-2.5 w-full p-2.5 text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg outline-none transition-colors border-t border-zinc-100 dark:border-white/5 mt-1">
                          <X className="h-4 w-4" /> Remove Photo
                        </button>
                      )}
                    </div>
                  )}

                  {/* Hidden File Input */}
                  <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
                </div>
              </div>

              {/* Input Fields */}
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Full Name</label>
                  <div className="relative flex items-center bg-zinc-50 dark:bg-[#1a1a1c] border border-zinc-200 dark:border-white/10 rounded-xl focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500 transition-all">
                    <User className="absolute left-4 h-4 w-4 text-zinc-400" />
                    <input
                      type="text" value={profile.name} onChange={(e) => handleProfileChange("name", e.target.value)}
                      className="w-full bg-transparent text-zinc-900 dark:text-white text-sm font-bold pl-11 pr-4 py-3 outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Email Address</label>
                  <div className="relative flex items-center bg-zinc-50 dark:bg-[#1a1a1c] border border-zinc-200 dark:border-white/10 rounded-xl focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500 transition-all">
                    <Mail className="absolute left-4 h-4 w-4 text-zinc-400" />
                    <input
                      type="email" value={profile.email} onChange={(e) => handleProfileChange("email", e.target.value)}
                      className="w-full bg-transparent text-zinc-900 dark:text-white text-sm font-bold pl-11 pr-4 py-3 outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Phone Number</label>
                  <div className="relative flex items-center bg-zinc-50 dark:bg-[#1a1a1c] border border-zinc-200 dark:border-white/10 rounded-xl focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500 transition-all">
                    <Phone className="absolute left-4 h-4 w-4 text-zinc-400" />
                    <input
                      type="tel" value={profile.phone} onChange={(e) => handleProfileChange("phone", e.target.value)}
                      className="w-full bg-transparent text-zinc-900 dark:text-white text-sm font-mono tracking-wider font-bold pl-11 pr-4 py-3 outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Business & Tax Info */}
          <div className="bg-white dark:bg-[#121214] p-6 rounded-2xl border border-zinc-200 dark:border-white/5 shadow-sm">
            <div className="flex items-center gap-2 mb-6 text-blue-500">
              <Building className="h-5 w-5" />
              <h2 className="font-bold text-zinc-900 dark:text-white">Business Details</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Registered Company Name</label>
                <div className="relative flex items-center bg-zinc-50 dark:bg-[#1a1a1c] border border-zinc-200 dark:border-white/10 rounded-xl focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all">
                  <Building className="absolute left-4 h-4 w-4 text-zinc-400" />
                  <input
                    type="text" value={profile.companyName} onChange={(e) => handleProfileChange("companyName", e.target.value)}
                    className="w-full bg-transparent text-zinc-900 dark:text-white text-sm font-bold pl-11 pr-4 py-3 outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">TIN Number</label>
                <div className="relative flex items-center bg-zinc-50 dark:bg-[#1a1a1c] border border-zinc-200 dark:border-white/10 rounded-xl focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all">
                  <FileText className="absolute left-4 h-4 w-4 text-zinc-400" />
                  <input
                    type="text" value={profile.tinNumber} onChange={(e) => handleProfileChange("tinNumber", e.target.value)}
                    className="w-full bg-transparent text-zinc-900 dark:text-white text-sm font-mono tracking-wider font-bold pl-11 pr-4 py-3 outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Security & Notifications */}
        <div className="lg:col-span-1 space-y-6">

          {/* Password Reset */}
          <div className="bg-white dark:bg-[#121214] p-6 rounded-2xl border border-zinc-200 dark:border-white/5 shadow-sm">
            <div className="flex items-center gap-2 mb-6 text-amber-500">
              <Shield className="h-5 w-5" />
              <h2 className="font-bold text-zinc-900 dark:text-white">Security Settings</h2>
            </div>

            <div className="space-y-4">

              {/* Current Password */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Current Password</label>
                <div className="relative flex items-center bg-zinc-50 dark:bg-[#1a1a1c] border border-zinc-200 dark:border-white/10 rounded-xl focus-within:border-amber-500 focus-within:ring-1 focus-within:ring-amber-500 transition-all">
                  <Key className="absolute left-4 h-4 w-4 text-zinc-400" />
                  <input
                    type={showPasswords.current ? "text" : "password"}
                    placeholder="••••••••"
                    value={passwords.current}
                    onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                    onCopy={disableCopyPaste} onPaste={disableCopyPaste} onCut={disableCopyPaste}
                    className="w-full bg-transparent text-zinc-900 dark:text-white text-sm font-bold pl-11 pr-12 py-3 outline-none"
                  />
                  <button
                    type="button"
                    onClick={(e) => togglePasswordVisibility(e, "current")}
                    className="absolute right-2 p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white outline-none rounded-lg transition-colors"
                  >
                    {showPasswords.current ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* New Password & Strength Meter */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">New Password</label>
                  <button type="button" onClick={generateStrongPassword} className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 flex items-center gap-1 outline-none transition-colors">
                    <RefreshCw className="h-3 w-3" /> Auto-generate
                  </button>
                </div>

                <div className="relative flex items-center bg-zinc-50 dark:bg-[#1a1a1c] border border-zinc-200 dark:border-white/10 rounded-xl focus-within:border-amber-500 focus-within:ring-1 focus-within:ring-amber-500 transition-all">
                  <Key className="absolute left-4 h-4 w-4 text-zinc-400" />
                  <input
                    type={showPasswords.new ? "text" : "password"}
                    placeholder="••••••••"
                    value={passwords.new}
                    onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                    onCopy={disableCopyPaste} onPaste={disableCopyPaste} onCut={disableCopyPaste}
                    className="w-full bg-transparent text-zinc-900 dark:text-white text-sm font-bold pl-11 pr-12 py-3 outline-none"
                  />
                  <button
                    type="button"
                    onClick={(e) => togglePasswordVisibility(e, "new")}
                    className="absolute right-2 p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white outline-none rounded-lg transition-colors"
                  >
                    {showPasswords.new ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </button>
                </div>

                {/* Strength Indicator */}
                {passStrength && (
                  <div className="flex flex-col gap-1.5 pt-1 animate-in fade-in">
                    <div className="flex justify-between items-center text-[10px] font-bold">
                      <span className="text-zinc-500">Strength:</span>
                      <span className={passStrength.text}>{passStrength.label}</span>
                    </div>
                    <div className="h-1.5 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden flex">
                      <div className={`h-full ${passStrength.width} ${passStrength.color} transition-all duration-300 rounded-full`}></div>
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm New Password */}
              <div className="space-y-1.5 pt-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Confirm New Password</label>
                <div className="relative flex items-center bg-zinc-50 dark:bg-[#1a1a1c] border border-zinc-200 dark:border-white/10 rounded-xl focus-within:border-amber-500 focus-within:ring-1 focus-within:ring-amber-500 transition-all">
                  <Key className="absolute left-4 h-4 w-4 text-zinc-400" />
                  <input
                    type={showPasswords.confirm ? "text" : "password"}
                    placeholder="••••••••"
                    value={passwords.confirm}
                    onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                    onCopy={disableCopyPaste} onPaste={disableCopyPaste} onCut={disableCopyPaste}
                    className="w-full bg-transparent text-zinc-900 dark:text-white text-sm font-bold pl-11 pr-12 py-3 outline-none"
                  />
                  <button
                    type="button"
                    onClick={(e) => togglePasswordVisibility(e, "confirm")}
                    className="absolute right-2 p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white outline-none rounded-lg transition-colors"
                  >
                    {showPasswords.confirm ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </button>
                </div>
              </div>

            </div>
          </div>

          {/* Notifications */}
          <div className="bg-white dark:bg-[#121214] p-6 rounded-2xl border border-zinc-200 dark:border-white/5 shadow-sm">
            <div className="flex items-center gap-2 mb-2 text-purple-500">
              <Bell className="h-5 w-5" />
              <h2 className="font-bold text-zinc-900 dark:text-white">Notifications</h2>
            </div>

            <div className="divide-y divide-zinc-100 dark:divide-white/5">
              <Toggle
                label="Payout Alerts"
                description="Receive an email when your net earnings are successfully deposited."
                enabled={notifyPayouts}
                onChange={() => setNotifyPayouts(!notifyPayouts)}
              />
              <Toggle
                label="Overstay Warnings"
                description="Get notified if a vehicle triggers a massive penalty multiplier."
                enabled={notifyOverstays}
                onChange={() => setNotifyOverstays(!notifyOverstays)}
              />
              <Toggle
                label="Daily Financial Summary"
                description="A breakdown of daily revenue sent to your email at 11:59 PM."
                enabled={notifyDailySummary}
                onChange={() => setNotifyDailySummary(!notifyDailySummary)}
              />
            </div>
          </div>

        </div>
      </div>

      {/* --- WebRTC CAMERA MODAL --- */}
      {isCameraOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#18181b] rounded-3xl overflow-hidden shadow-2xl border border-white/10 flex flex-col relative">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 absolute top-0 w-full z-10 bg-gradient-to-b from-black/80 to-transparent">
              <h2 className="text-lg font-bold text-white shadow-black drop-shadow-md">Take Profile Photo</h2>
              <button onClick={stopCamera} className="p-2 text-white hover:text-red-400 transition-colors drop-shadow-md outline-none">
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Video Feed */}
            <div className="relative w-full aspect-square bg-black flex items-center justify-center overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover mirror-mode"
                style={{ transform: "scaleX(-1)" }} // Mirror effect for front camera
              />
              {/* Target Overlay UI */}
              <div className="absolute inset-0 border-[6px] border-emerald-500/30 rounded-full m-8 pointer-events-none"></div>
            </div>

            {/* Hidden Canvas to capture the image */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Controls */}
            <div className="p-6 bg-[#18181b] flex items-center justify-center border-t border-white/10">
              <button
                onClick={capturePhoto}
                className="h-16 w-16 bg-white rounded-full border-4 border-zinc-400 hover:border-emerald-500 hover:bg-zinc-100 transition-all flex items-center justify-center outline-none active:scale-95"
              >
                <div className="h-12 w-12 bg-emerald-500 rounded-full"></div>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
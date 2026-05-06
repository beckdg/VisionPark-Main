import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "../../components/layout/Header";
import { useScroll } from "../../context/ScrollContext";
import { useAuth } from "../../context/AuthContext";
import { apiClient } from "../../api/apiClient";
import { resolveDriverProfilePhoto } from "../../utils/resolveDriverProfilePhoto";
import {
  User, Car, CreditCard, Building2, Bell, HelpCircle,
  LogOut, Camera, ChevronRight, ChevronLeft, Fingerprint,
  Check, Image as ImageIcon, Trash2, X, Edit2
} from "lucide-react";

const PAYMENT_OPTIONS = ["Telebirr", "CBE", "COOP", "Bank of Abyssinia"];

export default function DriverProfile() {
  const navigate = useNavigate();
  const auth = useAuth();
  const { setScrolled } = useScroll();

  const galleryInputRef = useRef(null);
  const videoRef = useRef(null);

  useEffect(() => () => setScrolled(false), [setScrolled]);
  const handleScroll = (e) => setScrolled(e.target.scrollTop > 10);

  const [activeView, setActiveView] = useState("main");
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [showLiveCamera, setShowLiveCamera] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);

  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userPhone, setUserPhone] = useState("");
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [vehicleType, setVehicleType] = useState("");
  const [licensePlate, setLicensePlate] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Telebirr");
  const [accountNumber, setAccountNumber] = useState("");
  const [paymentSaveError, setPaymentSaveError] = useState("");
  const [savingPayment, setSavingPayment] = useState(false);
  const [notifications, setNotifications] = useState(true);

  const [editForm, setEditForm] = useState({ name: "", email: "", phone: "" });

  const [editNameError, setEditNameError] = useState("");
  const [editEmailError, setEditEmailError] = useState("");
  const [editPhoneError, setEditPhoneError] = useState("");

  useEffect(() => {
    if (!auth.isAuthenticated || auth.user?.role !== "driver") return;

    const user = auth.user;
    const showEdit = showEditProfile;
    queueMicrotask(() => {
      const d = user.driverProfile || user.driver;
      const lsPhoto = localStorage.getItem("vp_driver_photo");
      setProfilePhoto(resolveDriverProfilePhoto(user, lsPhoto));

      setUserName(user.name || "");
      setUserEmail(user.email || "");
      setUserPhone((d?.phone && String(d.phone).trim()) || "");

      setLicensePlate(
        (d?.licensePlate && String(d.licensePlate).trim()) ||
          localStorage.getItem("vp_driver_license_plate") ||
          ""
      );
      setVehicleType(
        (d?.vehicleType && String(d.vehicleType).trim()) ||
          localStorage.getItem("vp_driver_vehicle") ||
          ""
      );

    const pm = (d?.paymentMethod && String(d.paymentMethod).trim()) || "Telebirr";
    setPaymentMethod(pm);
    setAccountNumber(
      d?.paymentAccount != null && String(d.paymentAccount).trim() !== ""
        ? String(d.paymentAccount).trim()
        : ""
    );

      if (!showEdit) {
        setEditForm({
          name: user.name || "",
          email: user.email || "",
          phone: (d?.phone && String(d.phone).trim()) || "",
        });
      }
    });
  }, [auth.isAuthenticated, auth.user, showEditProfile]);

  // --- 1. SMART NAME VALIDATION ---
  useEffect(() => {
    if (!editForm.name.trim()) setEditNameError("Name cannot be empty.");
    else setEditNameError("");
  }, [editForm.name]);

  // --- 2. SMART CONTEXT-AWARE EMAIL VALIDATION ---
  useEffect(() => {
    const email = editForm.email.trim();
    if (email.length > 0) {
      if (!email.includes('@')) {
        setEditEmailError("Please include an '@' in the email address.");
        return;
      }

      const parts = email.split('@');
      const localPart = parts[0];
      const domainPart = parts[1];

      if (localPart.length === 0) {
        setEditEmailError("Please enter the part before the '@'.");
        return;
      }

      if (!domainPart || domainPart.length === 0) {
        setEditEmailError("Please enter a domain after the '@'.");
        return;
      }

      if (!domainPart.includes('.')) {
        setEditEmailError(`Please complete the domain extension (e.g., ${domainPart}.edu.et, ${domainPart}.com).`);
        return;
      }

      const domainExtensions = domainPart.split('.');
      const tld = domainExtensions[domainExtensions.length - 1];

      if (tld.length < 2) {
        setEditEmailError("Domain extension is too short.");
        return;
      }

      const typos = {
        'gmai.com': 'gmail.com', 'gmal.com': 'gmail.com', 'gmail.co': 'gmail.com', 'gmail.c': 'gmail.com',
        'yaho.com': 'yahoo.com', 'yahoo.co': 'yahoo.com', 'yhoo.com': 'yahoo.com', 'yaho.co': 'yahoo.com',
        'outloo.com': 'outlook.com', 'outlook.co': 'outlook.com',
        'hotmail.co': 'hotmail.com', 'hotmal.com': 'hotmail.com'
      };

      if (typos[domainPart.toLowerCase()]) {
        setEditEmailError(`Did you mean @${typos[domainPart.toLowerCase()]}?`);
        return;
      }

      setEditEmailError("");
    } else {
      setEditEmailError("Email cannot be empty.");
    }
  }, [editForm.email]);

  // --- 3. SMART DELAYED PHONE VALIDATION ---
  useEffect(() => {
    const phoneRaw = editForm.phone.replace(/[\s-]/g, ''); // Strip spaces/dashes

    if (phoneRaw.length === 0) {
      setEditPhoneError("Phone cannot be empty.");
      return;
    }

    const expectedLength = phoneRaw.startsWith('+2519') ? 13 : 10;

    // Instant pass
    if ((phoneRaw.startsWith('+2519') || phoneRaw.startsWith('09')) && phoneRaw.length === expectedLength) {
      setEditPhoneError("");
      return;
    }

    // Instant fail bounds & logic
    if ((phoneRaw.startsWith('+2519') || phoneRaw.startsWith('09')) && phoneRaw.length > expectedLength) {
      setEditPhoneError("Number is too long.");
      return;
    }

    if (phoneRaw.startsWith('+2517') || phoneRaw.startsWith('07')) {
      setEditPhoneError("Only Ethio Telecom (09/+2519) supported.");
      return;
    }

    const isTypingPrefix = ['+', '+2', '+25', '+251', '0'].includes(phoneRaw);
    if (!phoneRaw.startsWith('+2519') && !phoneRaw.startsWith('09') && !isTypingPrefix) {
      setEditPhoneError("Must start with 09 or +2519.");
      return;
    }

    // Clear error instantly while typing a valid prefix
    setEditPhoneError("");

    // Debounce the "Incomplete" warning
    const timer = setTimeout(() => {
      const remaining = expectedLength - phoneRaw.length;
      setEditPhoneError(`Incomplete number. Needs ${remaining} more digits.`);
    }, 1200);

    return () => clearTimeout(timer);
  }, [editForm.phone]);

  // --- EDIT PROFILE SAVE LOGIC ---
  const handleSaveProfile = () => {
    if (editNameError || editEmailError || editPhoneError) return;

    // Save to local storage
    localStorage.setItem("vp_driver_name", editForm.name.trim());
    localStorage.setItem("vp_driver_email", editForm.email.trim());
    localStorage.setItem("vp_driver_phone", editForm.phone.trim());

    // Update local state
    setUserName(editForm.name.trim());
    setUserEmail(editForm.email.trim());
    setUserPhone(editForm.phone.trim());

    // Hide Modal & Broadcast to Header
    setShowEditProfile(false);
    window.dispatchEvent(new Event("vp_profile_updated"));
  };

  const openEditModal = () => {
    setEditForm({ name: userName, email: userEmail, phone: userPhone });
    setShowEditProfile(true);
  };

  // --- LIVE CAMERA LOGIC (WebRTC) ---
  const startCamera = async () => {
    setShowPhotoModal(false);
    setShowLiveCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera access denied", err);
      alert("Unable to access the camera. Please check your permissions.");
      setShowLiveCamera(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
    }
    setShowLiveCamera(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext("2d");

      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

      const dataUrl = canvas.toDataURL("image/jpeg", 0.7);

      try {
        localStorage.setItem("vp_driver_photo", dataUrl);
        setProfilePhoto(dataUrl);
        window.dispatchEvent(new Event("vp_photo_updated"));
      } catch {
        alert("Photo is too large to save in local demo storage.");
      }

      stopCamera();
    }
  };

  useEffect(() => {
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // --- GALLERY UPLOAD LOGIC ---
  const handleGalleryUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = null;
    if (!file) return;

    if (auth.isAuthenticated && auth.user?.role === "driver") {
      const max = 10 * 1024 * 1024;
      if (file.size > max) {
        alert("Image must be 10MB or smaller.");
        setShowPhotoModal(false);
        return;
      }
      try {
        const fd = new FormData();
        fd.append("image", file);
        const res = await apiClient.postFormData("/uploads/profile-image", fd);
        const url = res?.url || null;
        setProfilePhoto(url);
        try {
          if (url) localStorage.setItem("vp_driver_photo", url);
        } catch {
          /* storage quota — cloud URL still set in UI */
        }
        window.dispatchEvent(new Event("vp_photo_updated"));
        if (typeof auth.refreshMe === "function") {
          await auth.refreshMe();
        }
      } catch (err) {
        alert(err?.message || "Upload failed.");
      }
      setShowPhotoModal(false);
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const img = new Image();
      img.src = reader.result;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 800;
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.7);

        try {
          localStorage.setItem("vp_driver_photo", compressedDataUrl);
          setProfilePhoto(compressedDataUrl);
          window.dispatchEvent(new Event("vp_photo_updated"));
        } catch {
          alert("File is too large to save.");
        }
        setShowPhotoModal(false);
      };
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = async () => {
    if (auth.isAuthenticated && auth.user?.role === "driver" && auth.user?.profileImagePublicId) {
      try {
        await apiClient.deleteWithBody("/uploads", { publicId: auth.user.profileImagePublicId });
        if (typeof auth.refreshMe === "function") {
          await auth.refreshMe();
        }
      } catch {
        /* still clear local UI */
      }
    }
    setProfilePhoto(null);
    localStorage.removeItem("vp_driver_photo");
    window.dispatchEvent(new Event("vp_photo_updated"));
    setShowPhotoModal(false);
  };

  const handlePaymentSave = async () => {
    if (paymentMethod !== "Telebirr" && !String(accountNumber).trim()) {
      setPaymentSaveError("Enter your account number for this payment method.");
      return;
    }
    if (!auth.isAuthenticated || auth.user?.role !== "driver") {
      setPaymentSaveError("You must be signed in as a driver to save.");
      return;
    }
    setPaymentSaveError("");
    setSavingPayment(true);
    try {
      await apiClient.patch("/users/drivers/me", {
        driver: {
          paymentMethod,
          paymentAccount: paymentMethod === "Telebirr" ? null : String(accountNumber).trim(),
        },
      });
      if (paymentMethod === "Telebirr") setAccountNumber("");
      if (typeof auth.refreshMe === "function") {
        await auth.refreshMe();
      }
      setActiveView("main");
    } catch (err) {
      setPaymentSaveError(err?.message || "Could not save payment method.");
    } finally {
      setSavingPayment(false);
    }
  };

  const handleLogout = () => {
    auth.logout();
    window.dispatchEvent(new Event("vp_photo_updated"));
    window.dispatchEvent(new Event("vp_profile_updated"));
    navigate("/login", { replace: true });
  };

  if (activeView === "payment") {
    return (
      <div className="relative h-[100dvh] w-full overflow-hidden bg-[#f4f4f5] dark:bg-[#09090b] flex flex-col">
        <Header />
        {/* ✅ Added "auth-page" class */}
        <div className="auth-page flex-1 overflow-y-auto pt-24 px-4 md:px-8 pb-32 md:pb-40 transition-colors duration-500 overscroll-contain" onScroll={handleScroll}>
          <div className="w-full max-w-2xl lg:max-w-3xl mx-auto flex flex-col">
            <div className="flex items-center gap-4 mb-6 md:mb-8">
              <button
                type="button"
                onClick={() => { setPaymentSaveError(""); setActiveView("main"); }}
                className="h-10 w-10 md:h-12 md:w-12 flex items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-white hover:bg-zinc-300 dark:hover:bg-zinc-700 transition outline-none cursor-pointer"
              >
                <ChevronLeft className="h-6 w-6 md:h-7 md:w-7" />
              </button>
              <h2 className="text-2xl md:text-3xl font-bold text-zinc-900 dark:text-white">Payment Method</h2>
            </div>
            {paymentSaveError ? (
              <p className="text-sm font-medium text-red-600 dark:text-red-400 mb-4" role="alert">
                {paymentSaveError}
              </p>
            ) : null}
            <div className="w-full bg-white dark:bg-[#121214]/95 rounded-2xl md:rounded-3xl shadow-sm border border-zinc-200 dark:border-white/5 overflow-hidden mb-6 md:mb-8">
              {PAYMENT_OPTIONS.map((method, index) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => {
                    setPaymentSaveError("");
                    setPaymentMethod(method);
                  }}
                  className={`w-full flex items-center justify-between p-4 md:p-6 text-left transition-colors outline-none cursor-pointer ${index !== PAYMENT_OPTIONS.length - 1 ? 'border-b border-zinc-100 dark:border-white/5' : ''} ${paymentMethod === method ? 'bg-emerald-50 dark:bg-emerald-500/10' : 'hover:bg-zinc-50 dark:hover:bg-white/5'}`}
                >
                  <span className={`text-sm md:text-base lg:text-lg ${paymentMethod === method ? 'font-bold text-emerald-600 dark:text-emerald-400' : 'font-medium text-zinc-700 dark:text-zinc-300'}`}>{method} {method === "Telebirr" && "(Default)"}</span>
                  {paymentMethod === method && <Check className="h-5 w-5 md:h-6 md:w-6 text-emerald-500 shrink-0" />}
                </button>
              ))}
            </div>
            {paymentMethod !== "Telebirr" && (
              <div className="w-full bg-white dark:bg-[#121214]/95 rounded-2xl md:rounded-3xl shadow-sm border border-zinc-200 dark:border-white/5 overflow-hidden mb-6 md:mb-8 p-4 md:p-6 lg:p-8 animate-in fade-in slide-in-from-top-4 duration-300">
                <label className="block text-[10px] md:text-xs lg:text-sm text-zinc-500 dark:text-zinc-400 uppercase font-bold tracking-wider mb-3 md:mb-4 flex items-center gap-1.5"><Building2 className="h-4 w-4 md:h-5 md:w-5" /> {paymentMethod} Account Number</label>
                <input type="text" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="Enter your account number" className="w-full h-14 md:h-16 px-4 md:px-6 rounded-xl md:rounded-2xl bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white outline-none focus:border-emerald-500 focus:shadow-[0_0_15px_rgba(16,185,129,0.2)] transition-all duration-300 text-base md:text-lg lg:text-xl font-mono font-medium" />
              </div>
            )}
            <button
              type="button"
              onClick={handlePaymentSave}
              disabled={savingPayment}
              className="w-full h-14 md:h-16 rounded-xl md:rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-sm md:text-base lg:text-lg tracking-wide uppercase shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] active:scale-[0.98] transition-all outline-none cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {savingPayment ? "Saving…" : "Save & Return"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-[#f4f4f5] dark:bg-[#09090b] flex flex-col">
      <Header />
      {/* ✅ Added "auth-page" class */}
      <div className="auth-page flex-1 overflow-y-auto pt-24 px-4 md:px-8 pb-32 md:pb-40 transition-colors duration-500 overscroll-contain" onScroll={handleScroll}>
        <div className="w-full max-w-2xl lg:max-w-3xl mx-auto flex flex-col">

          {/* PROFILE HEADER SECTION */}
          <div className="relative flex flex-col items-center mb-8 md:mb-10">
            <div className="relative mb-4 md:mb-6 group cursor-pointer" onClick={() => setShowPhotoModal(true)}>
              <div className="h-28 w-28 md:h-36 md:w-36 lg:h-40 lg:w-40 rounded-full overflow-hidden bg-zinc-200 dark:bg-zinc-800 shadow-md flex items-center justify-center transition-transform duration-300 group-hover:scale-105">
                {profilePhoto ? <img src={profilePhoto} alt="Driver" className="h-full w-full object-cover" /> : <User className="h-12 w-12 md:h-16 md:w-16 lg:h-20 lg:w-20 text-zinc-400 dark:text-zinc-500" />}
              </div>
              <div className="absolute bottom-0 right-0 md:bottom-1 md:right-1 h-10 w-10 md:h-12 md:w-12 bg-[#3b82f6] rounded-full flex items-center justify-center text-white shadow-lg border-[3px] border-[#f4f4f5] dark:border-[#09090b]">
                <Camera className="h-4 w-4 md:h-5 md:w-5" />
              </div>
            </div>

            <input type="file" ref={galleryInputRef} onChange={handleGalleryUpload} accept="image/*" className="hidden" />

            <div className="flex items-center gap-3">
              <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-zinc-900 dark:text-white tracking-tight">{userName}</h2>
              <button
                onClick={openEditModal}
                className="p-1.5 md:p-2 bg-zinc-200 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-full transition-colors outline-none"
              >
                <Edit2 className="h-4 w-4 md:h-5 md:w-5" />
              </button>
            </div>
            <p className="text-sm md:text-base lg:text-lg text-zinc-500 dark:text-zinc-400 font-medium mt-1 md:mt-2 tracking-wide">
              {[userPhone, userEmail].filter(Boolean).join(" • ")}
            </p>
          </div>

          <div className="flex flex-col gap-6 md:gap-8">

            {/* VISIONPARK WALLET CARD */}
            <div className="w-full bg-white dark:bg-[#121214]/95 rounded-2xl md:rounded-3xl shadow-sm border border-zinc-200 dark:border-white/5 overflow-hidden">
              <div className="flex items-center justify-between p-4 md:p-6 border-b border-zinc-100 dark:border-white/5">
                <div className="flex items-center gap-4">
                  <div className="h-9 w-9 md:h-12 md:w-12 rounded-xl bg-indigo-500 flex items-center justify-center shrink-0 shadow-sm"><Fingerprint className="h-5 w-5 md:h-6 md:w-6 text-white" /></div>
                  <span className="font-semibold text-zinc-900 dark:text-white text-sm md:text-base lg:text-lg">License Plate</span>
                </div>
                <span className="font-mono font-bold text-zinc-500 dark:text-zinc-400 text-sm md:text-base lg:text-lg uppercase">{licensePlate}</span>
              </div>

              <div className="w-full flex items-center justify-between p-4 md:p-6 gap-4">
                <div className="flex items-center gap-4 shrink-0">
                  <div className="h-9 w-9 md:h-12 md:w-12 rounded-xl bg-emerald-500 flex items-center justify-center shrink-0 shadow-sm"><Car className="h-5 w-5 md:h-6 md:w-6 text-white" /></div>
                  <span className="font-semibold text-zinc-900 dark:text-white text-sm md:text-base lg:text-lg">Vehicle Category</span>
                </div>
                <div className="flex-1 text-right">
                  <span className="text-zinc-500 dark:text-zinc-400 font-medium text-xs md:text-sm lg:text-base leading-snug inline-block break-words">{vehicleType}</span>
                </div>
              </div>
            </div>

            <div className="w-full bg-white dark:bg-[#121214]/95 rounded-2xl md:rounded-3xl shadow-sm border border-zinc-200 dark:border-white/5 overflow-hidden">
              <button
                type="button"
                onClick={() => {
                  setPaymentSaveError("");
                  setActiveView("payment");
                }}
                className="w-full flex items-center justify-between p-4 md:p-6 hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors outline-none cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className="h-9 w-9 md:h-12 md:w-12 rounded-xl bg-blue-500 flex items-center justify-center shrink-0 shadow-sm"><CreditCard className="h-5 w-5 md:h-6 md:w-6 text-white" /></div>
                  <span className="font-semibold text-zinc-900 dark:text-white text-sm md:text-base lg:text-lg">Payment Method</span>
                </div>
                <div className="flex items-center gap-2 max-w-[50%]"><span className="text-zinc-500 dark:text-zinc-400 font-medium text-sm md:text-base lg:text-lg truncate">{paymentMethod}</span><ChevronRight className="h-5 w-5 md:h-6 md:w-6 text-zinc-400 shrink-0" /></div>
              </button>
            </div>

            <div className="w-full bg-white dark:bg-[#121214]/95 rounded-2xl md:rounded-3xl shadow-sm border border-zinc-200 dark:border-white/5 overflow-hidden">
              <button type="button" onClick={() => setNotifications(!notifications)} className="w-full flex items-center justify-between p-4 md:p-6 hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors outline-none cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className="h-9 w-9 md:h-12 md:w-12 rounded-xl bg-orange-500 flex items-center justify-center shrink-0 shadow-sm"><Bell className="h-5 w-5 md:h-6 md:w-6 text-white" /></div>
                  <span className="font-semibold text-zinc-900 dark:text-white text-sm md:text-base lg:text-lg">Push Notifications</span>
                </div>
                <div className={`w-12 h-7 md:w-14 md:h-8 rounded-full p-1 transition-colors duration-300 ease-in-out ${notifications ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-700"}`}>
                  <div className={`w-5 h-5 md:w-6 md:h-6 bg-white rounded-full shadow-md transform transition-transform duration-300 ease-in-out ${notifications ? "translate-x-5 md:translate-x-6" : "translate-x-0"}`}></div>
                </div>
              </button>
            </div>

            <div className="w-full bg-white dark:bg-[#121214]/95 rounded-2xl md:rounded-3xl shadow-sm border border-zinc-200 dark:border-white/5 overflow-hidden">
              <button type="button" className="w-full flex items-center justify-between p-4 md:p-6 border-b border-zinc-100 dark:border-white/5 hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors outline-none cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className="h-9 w-9 md:h-12 md:w-12 rounded-xl bg-zinc-500 dark:bg-zinc-700 flex items-center justify-center shrink-0 shadow-sm"><HelpCircle className="h-5 w-5 md:h-6 md:w-6 text-white" /></div>
                  <span className="font-semibold text-zinc-900 dark:text-white text-sm md:text-base lg:text-lg">Help & Support</span>
                </div>
                <ChevronRight className="h-5 w-5 md:h-6 md:w-6 text-zinc-400" />
              </button>
              <button type="button" onClick={handleLogout} className="w-full flex items-center justify-between p-4 md:p-6 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors outline-none group cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className="h-9 w-9 md:h-12 md:w-12 rounded-xl bg-red-500 flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform"><LogOut className="h-5 w-5 md:h-6 md:w-6 text-white" /></div>
                  <span className="font-semibold text-red-600 dark:text-red-500 text-sm md:text-base lg:text-lg">Sign Out</span>
                </div>
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* --- EDIT PROFILE MODAL --- */}
      {showEditProfile && (
        <div
          className="fixed inset-0 z-[6000] flex items-center justify-center bg-zinc-900/60 dark:bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={() => setShowEditProfile(false)}
        >
          <div
            className="w-full max-w-sm bg-white dark:bg-[#121214] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 border border-zinc-200 dark:border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 md:p-6 border-b border-zinc-200 dark:border-white/10 flex justify-between items-center bg-zinc-50 dark:bg-white/5">
              <h3 className="font-bold text-lg md:text-xl text-zinc-900 dark:text-white">Edit Profile</h3>
              <button onClick={() => setShowEditProfile(false)} className="p-2 -mr-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors rounded-xl hover:bg-zinc-200 dark:hover:bg-white/10 outline-none cursor-pointer active:scale-90">
                <X className="h-5 w-5 md:h-6 md:w-6" />
              </button>
            </div>

            <div className="p-5 md:p-6 flex flex-col gap-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex justify-between">
                  Full Name {editNameError && <span className="text-red-500 text-[10px] mt-0.5 normal-case tracking-normal">{editNameError}</span>}
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className={`w-full bg-zinc-50 dark:bg-white/5 border text-sm rounded-xl px-4 py-3.5 outline-none transition-colors text-zinc-900 dark:text-white 
                    ${editNameError ? 'border-red-500/50 focus:border-red-500 focus:shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'border-zinc-200 dark:border-white/10 focus:border-emerald-500'}`}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex justify-between">
                  Email Address {editEmailError && <span className="text-red-500 text-[10px] mt-0.5 normal-case tracking-normal">{editEmailError}</span>}
                </label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className={`w-full bg-zinc-50 dark:bg-white/5 border text-sm rounded-xl px-4 py-3.5 outline-none transition-colors text-zinc-900 dark:text-white 
                    ${editEmailError ? 'border-red-500/50 focus:border-red-500 focus:shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'border-zinc-200 dark:border-white/10 focus:border-emerald-500'}`}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex justify-between">
                  Phone Number {editPhoneError && <span className="text-red-500 text-[10px] mt-0.5 normal-case tracking-normal">{editPhoneError}</span>}
                </label>
                <input
                  type="tel"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className={`w-full bg-zinc-50 dark:bg-white/5 border text-sm rounded-xl px-4 py-3.5 outline-none font-mono transition-colors text-zinc-900 dark:text-white 
                    ${editPhoneError ? 'border-red-500/50 focus:border-red-500 focus:shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'border-zinc-200 dark:border-white/10 focus:border-emerald-500'}`}
                />
              </div>

              <button
                onClick={handleSaveProfile}
                disabled={!!editNameError || !!editEmailError || !!editPhoneError}
                className="w-full mt-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold py-3.5 rounded-xl transition-all active:scale-95 shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 text-base outline-none cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- PHOTO UPLOAD MODAL --- */}
      {showPhotoModal && (
        <div
          className="fixed inset-0 z-[6000] flex items-center justify-center bg-zinc-900/60 dark:bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={() => setShowPhotoModal(false)}
        >
          <div
            className="w-full max-w-sm bg-white dark:bg-[#121214] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 border border-zinc-200 dark:border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 md:p-6 border-b border-zinc-200 dark:border-white/10 flex justify-between items-center bg-zinc-50 dark:bg-white/5">
              <h3 className="font-bold text-lg md:text-xl text-zinc-900 dark:text-white">Profile Photo</h3>
              <button onClick={() => setShowPhotoModal(false)} className="p-2 -mr-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors rounded-xl hover:bg-zinc-200 dark:hover:bg-white/10 outline-none cursor-pointer active:scale-90">
                <X className="h-5 w-5 md:h-6 md:w-6" />
              </button>
            </div>

            <div className="p-3 md:p-4 space-y-1 md:space-y-2">
              <button
                onClick={startCamera}
                className="w-full flex items-center gap-4 p-4 hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors active:scale-[0.98] outline-none cursor-pointer rounded-xl text-zinc-900 dark:text-white font-medium text-base md:text-lg"
              >
                <div className="h-10 w-10 md:h-12 md:w-12 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <Camera className="h-5 w-5 md:h-6 md:w-6 text-emerald-500" />
                </div>
                Take a Photo
              </button>

              <button
                onClick={() => galleryInputRef.current?.click()}
                className="w-full flex items-center gap-4 p-4 hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors active:scale-[0.98] outline-none cursor-pointer rounded-xl text-zinc-900 dark:text-white font-medium text-base md:text-lg"
              >
                <div className="h-10 w-10 md:h-12 md:w-12 rounded-full bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center shrink-0">
                  <ImageIcon className="h-5 w-5 md:h-6 md:w-6 text-blue-500" />
                </div>
                Choose from Gallery
              </button>

              {profilePhoto && (
                <div className="pt-2 mt-2 border-t border-zinc-100 dark:border-white/5">
                  <button
                    onClick={handleRemovePhoto}
                    className="w-full flex items-center gap-4 p-4 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors active:scale-[0.98] outline-none cursor-pointer rounded-xl text-red-600 dark:text-red-500 font-medium text-base md:text-lg"
                  >
                    <div className="h-10 w-10 md:h-12 md:w-12 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center shrink-0">
                      <Trash2 className="h-5 w-5 md:h-6 md:w-6 text-red-500" />
                    </div>
                    Remove Photo
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- LIVE CAMERA MODAL UI --- */}
      {showLiveCamera && (
        <div className="fixed inset-0 z-[7000] bg-black flex flex-col animate-in fade-in duration-300">

          <div className="flex items-center justify-between p-6 md:p-8 w-full absolute top-0 z-10 bg-gradient-to-b from-black/80 to-transparent">
            <h3 className="text-white font-bold text-lg md:text-xl drop-shadow-md">Take Photo</h3>
            <button onClick={stopCamera} className="p-2 text-white hover:bg-white/20 rounded-full transition-colors outline-none cursor-pointer active:scale-90">
              <X className="h-6 w-6 md:h-8 md:w-8" />
            </button>
          </div>

          <div className="flex-1 relative flex items-center justify-center bg-black overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover scale-x-[-1]"
            />
          </div>

          <div className="p-8 md:p-12 w-full absolute bottom-0 z-10 bg-gradient-to-t from-black/80 to-transparent flex justify-center items-center">
            <button
              onClick={capturePhoto}
              className="h-20 w-20 md:h-24 md:w-24 rounded-full border-[4px] border-white/50 flex items-center justify-center hover:bg-white/20 active:scale-90 transition-all outline-none cursor-pointer group"
            >
              <div className="h-16 w-16 md:h-20 md:w-20 bg-white rounded-full shadow-[0_0_20px_rgba(255,255,255,0.5)] group-hover:shadow-[0_0_30px_rgba(255,255,255,0.8)] transition-shadow"></div>
            </button>
          </div>

        </div>
      )}

    </div>
  );
}
import React, { useState, useEffect, useRef } from "react";
import {
    User, CheckCircle, XCircle, Edit3, Key, Ban,
    Building, Users, Car, RefreshCw, AlertTriangle,
    Save, X, ShieldAlert, Mail, Phone, CalendarClock,
    Camera, UploadCloud, Copy
} from "lucide-react";
import { apiClient } from "../../api/apiClient";

// --- MOCK ACTIVITY LOG ---
const ACTIVITY_LOG = [
    { id: 1, time: "Today, 09:14 AM", action: "Logged In", ip: "196.189.12.45", status: "Success" },
    { id: 2, time: "Yesterday, 04:30 PM", action: "Password Changed", ip: "196.189.12.45", status: "Success" },
    { id: 3, time: "Mar 14, 11:00 AM", action: "Branch Created (Bole)", ip: "197.156.22.10", status: "Success" },
    { id: 4, time: "Mar 12, 08:22 AM", action: "Failed Login Attempt", ip: "102.214.55.12", status: "Failed" },
    { id: 5, time: "Mar 10, 01:15 PM", action: "Attendant Added", ip: "196.189.12.45", status: "Success" },
];

export default function OwnerAccount() {
    // --- COMPONENT STATE ---
    const [accountExists, setAccountExists] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [showReinitModal, setShowReinitModal] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [toastMessage, setToastMessage] = useState("");
    const [toastType, setToastType] = useState("success");

    const [resetPasswordModal, setResetPasswordModal] = useState(null);

    // File input ref for avatar
    const fileInputRef = useRef(null);

    // Form states
    const [ownerData, setOwnerData] = useState({
        name: "",
        email: "",
        phone: "",
        companyName: "",
        tinNumber: "",
        avatar: null,
        createdAt: "",
        lastLogin: "Never",
        status: "Active"
    });

    const [editData, setEditData] = useState({ ...ownerData });

    const [recentOwners, setRecentOwners] = useState([]);

    // Setup form state (when initializing)
    const [setupData, setSetupData] = useState({
        name: "",
        email: "",
        phone: "",
        companyName: "",
        tinNumber: "",
        password: "",
        avatar: null
    });

    const [emailError, setEmailError] = useState("");
    const [phoneError, setPhoneError] = useState("");

    useEffect(() => {
        generatePassword(true);
    }, []);

    // --- VALIDATORS ---
    const validateEmail = (email) => {
        const trimmed = email.trim();
        if (!trimmed) return "";
        if (!trimmed.includes('@')) return "Missing '@' symbol.";
        const parts = trimmed.split('@');
        if (!parts[1] || !parts[1].includes('.')) return "Incomplete domain (e.g. .com, .et).";

        const typos = { 'gmai.com': 'gmail.com', 'yaho.com': 'yahoo.com', 'outloo.com': 'outlook.com' };
        if (typos[parts[1].toLowerCase()]) return `Did you mean @${typos[parts[1].toLowerCase()]}?`;
        return "";
    };

    const validatePhone = (phone) => {
        const raw = phone.replace(/[\s-]/g, '');
        if (!raw) return "";
        const expectedLength = raw.startsWith('+2519') || raw.startsWith('+2517') ? 13 : 10;

        if (!raw.startsWith('+2519') && !raw.startsWith('+2517') && !raw.startsWith('09') && !raw.startsWith('07') && !['+', '+2', '+25', '+251', '0'].includes(raw)) {
            return "Must start with 09, 07, +2519, or +2517.";
        }
        if (raw.length > expectedLength) return "Number is too long.";
        if (raw.length > 3 && raw.length < expectedLength) return `Needs ${expectedLength - raw.length} more digits.`;
        return "";
    };

    // Watch validation for Setup Form
    useEffect(() => { if (!accountExists) setEmailError(validateEmail(setupData.email)); }, [setupData.email, accountExists]);
    useEffect(() => { if (!accountExists) setPhoneError(validatePhone(setupData.phone)); }, [setupData.phone, accountExists]);

    // Watch validation for Edit Form
    useEffect(() => { if (isEditing) setEmailError(validateEmail(editData.email)); }, [editData.email, isEditing]);
    useEffect(() => { if (isEditing) setPhoneError(validatePhone(editData.phone)); }, [editData.phone, isEditing]);

    // --- HELPER FUNCTIONS ---
    const showToast = (msg, type = "success") => {
        setToastMessage(msg);
        setToastType(type);
        setTimeout(() => setToastMessage(""), 4000);
    };

    const generatePassword = (forSetupForm = false) => {
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
        let pass = "";
        for (let i = 0; i < 12; i++) pass += chars.charAt(Math.floor(Math.random() * chars.length));
        if (forSetupForm || !accountExists) setSetupData(prev => ({ ...prev, password: pass }));
        return pass;
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        showToast("Copied to clipboard!");
    };

    // --- AVATAR HANDLING (Supports both Setup and Edit modes) ---
    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = reader.result;
                if (accountExists) {
                    const updatedData = { ...ownerData, avatar: base64String };
                    setOwnerData(updatedData);
                    if (isEditing) setEditData({ ...editData, avatar: base64String });
                } else {
                    setSetupData(prev => ({ ...prev, avatar: base64String }));
                }
                showToast("Profile photo uploaded.");
            };
            reader.readAsDataURL(file);
        }
    };

    const handleRemoveImage = () => {
        if (accountExists) {
            const updatedData = { ...ownerData, avatar: null };
            setOwnerData(updatedData);
            if (isEditing) setEditData({ ...editData, avatar: null });
        } else {
            setSetupData(prev => ({ ...prev, avatar: null }));
        }
        if (fileInputRef.current) fileInputRef.current.value = "";
        showToast("Profile photo removed.");
    };

    // --- MAIN ACTIONS ---
    const mapOwnerProfile = (created) => {
        const o = created?.owner || created?.ownerProfile || {};
        return {
            name: created?.name ?? "",
            email: created?.email ?? "",
            phone: o.phone ?? "",
            companyName: o.companyName ?? "",
            tinNumber: o.tinNumber ?? "",
            avatar: created?.avatarUrl ?? null,
            createdAt: created?.createdAt
                ? new Date(created.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                : new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
            lastLogin: "Never",
            status: created?.status === "inactive" ? "Suspended" : "Active",
        };
    };

    const handleInitializeSubmit = async (e) => {
        e.preventDefault();
        if (emailError || phoneError) return;
        if (!setupData.password || setupData.password.length < 8) {
            showToast("Password must be at least 8 characters.", "error");
            return;
        }

        const owner = {};
        const phoneTrim = setupData.phone.trim();
        if (phoneTrim) owner.phone = phoneTrim;
        const companyTrim = setupData.companyName.trim();
        if (companyTrim) owner.companyName = companyTrim;
        const tinTrim = setupData.tinNumber.trim();
        if (tinTrim) owner.tinNumber = tinTrim;

        const payload = {
            name: setupData.name.trim(),
            email: setupData.email.trim().toLowerCase(),
            password: setupData.password,
            owner,
        };
        if (setupData.avatar && typeof setupData.avatar === "string") {
            payload.avatarUrl = setupData.avatar;
        }

        setIsProcessing(true);
        try {
            const created = await apiClient.post("/users/owners", payload);
            const newData = mapOwnerProfile(created);
            setOwnerData(newData);
            setEditData(newData);
            setRecentOwners((prev) => [
                ...prev,
                {
                    id: String(created?._id ?? created?.id ?? Date.now()),
                    name: newData.name,
                    email: newData.email,
                    companyName: newData.companyName,
                },
            ]);
            setAccountExists(true);
            showToast("Owner account successfully provisioned!");
            setSetupData({
                name: "",
                email: "",
                phone: "",
                companyName: "",
                tinNumber: "",
                password: "",
                avatar: null,
            });
            if (fileInputRef.current) fileInputRef.current.value = "";
        } catch (err) {
            showToast(err?.message || "Failed to create owner.", "error");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleEditSave = () => {
        if (emailError || phoneError) return;
        setIsProcessing(true);
        setTimeout(() => {
            setOwnerData(editData);
            setIsProcessing(false);
            setIsEditing(false);
            showToast("Owner details updated successfully.");
        }, 800);
    };

    const handleResetPassword = () => {
        setIsProcessing(true);
        setTimeout(() => {
            const newPass = generatePassword();
            setResetPasswordModal(newPass);
            setIsProcessing(false);
        }, 1000);
    };

    const handleSuspendToggle = () => {
        setIsProcessing(true);
        const newStatus = ownerData.status === "Active" ? "Suspended" : "Active";
        setTimeout(() => {
            const updatedData = { ...ownerData, status: newStatus };
            setOwnerData(updatedData);
            setIsProcessing(false);
            showToast(newStatus === "Suspended" ? "Account suspended. Login access revoked." : "Account restored.", newStatus === "Suspended" ? "warning" : "success");
        }, 800);
    };

    const handleConfirmReinitialize = () => {
        setIsProcessing(true);
        setTimeout(() => {
            setIsProcessing(false);
            setShowReinitModal(false);
            setAccountExists(false);
            setSetupData({
                name: "",
                email: "",
                phone: "",
                companyName: "",
                tinNumber: "",
                password: "",
                avatar: null,
            });
            generatePassword(true);
            if (fileInputRef.current) fileInputRef.current.value = "";
            showToast("Account purged. Ready for fresh initialization.", "warning");
        }, 1000);
    };

    return (
        <div className="w-full flex flex-col gap-6 animate-in fade-in duration-500 pb-10 relative">

            {/* TOAST NOTIFICATION */}
            {toastMessage && (
                <div className={`fixed top-4 left-1/2 -translate-x-1/2 text-white font-bold text-xs md:text-sm px-6 py-3 rounded-2xl shadow-2xl z-[9000] animate-in slide-in-from-top-4 flex items-center gap-3 w-11/12 md:w-auto text-center justify-center ${toastType === 'error' ? 'bg-red-600' : toastType === 'warning' ? 'bg-amber-500 text-amber-950' : 'bg-zinc-900 dark:bg-white dark:text-zinc-900'
                    }`}>
                    {toastType === 'error' ? <AlertTriangle className="h-5 w-5 shrink-0" /> : <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />}
                    {toastMessage}
                </div>
            )}

            {/* HIDDEN FILE INPUT */}
            <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />

            {/* 1. HEADER */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-zinc-900 dark:text-white tracking-tight flex items-center gap-3">
                        <User className="h-6 w-6 md:h-8 md:w-8 text-indigo-600 dark:text-indigo-500" />
                        Owner Account
                    </h1>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Manage the single VisionPark parking operator account.</p>
                </div>

                <div className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm shrink-0 border shadow-sm ${accountExists
                    ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'
                    : 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20'
                    }`}>
                    {accountExists ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                    {accountExists ? "Account Active" : "Not Initialized"}
                </div>
            </div>

            {/* CONDITIONAL RENDER: IF ACCOUNT EXISTS */}
            {accountExists ? (
                <>
                    {/* 2. OWNER PROFILE CARD */}
                    <div className="bg-white dark:bg-[#121214] rounded-3xl p-6 md:p-8 shadow-sm border border-zinc-200 dark:border-white/5 flex flex-col gap-8 transition-all relative overflow-hidden">

                        {ownerData.status === "Suspended" && (
                            <div className="absolute inset-0 bg-red-500/5 dark:bg-red-500/10 pointer-events-none border-2 border-red-500/20 rounded-3xl z-0"></div>
                        )}

                        <div className="flex flex-col md:flex-row gap-8 items-start relative z-10">

                            <div className="flex flex-col items-center gap-3 shrink-0 mx-auto md:mx-0">
                                <div className="relative group">
                                    <div className="h-28 w-28 rounded-full bg-indigo-600 flex items-center justify-center text-4xl font-black text-white shadow-xl shadow-indigo-600/20 border-4 border-indigo-50 dark:border-indigo-500/20 overflow-hidden">
                                        {ownerData.avatar ? (
                                            <img src={ownerData.avatar} alt="Owner" className="w-full h-full object-cover" />
                                        ) : (
                                            ownerData.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
                                        )}
                                    </div>

                                    <div className="absolute inset-0 bg-black/60 rounded-full opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-2 transition-opacity duration-200">
                                        <button onClick={() => fileInputRef.current?.click()} className="text-white hover:text-indigo-400 outline-none transition-colors" title="Upload Photo">
                                            <Camera className="h-5 w-5" />
                                        </button>
                                        {ownerData.avatar && (
                                            <button onClick={handleRemoveImage} className="text-white hover:text-red-400 outline-none transition-colors" title="Remove Photo">
                                                <X className="h-5 w-5" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <span className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full border ${ownerData.status === "Suspended" ? 'bg-red-100 text-red-600 border-red-200 dark:bg-red-500/20 dark:border-red-500/30' : 'text-zinc-500 bg-zinc-100 dark:bg-white/5 dark:border-white/10'}`}>
                                    {ownerData.status === "Suspended" ? "SUSPENDED" : "System Owner"}
                                </span>
                            </div>

                            <div className="flex-1 w-full">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">

                                    <div className="space-y-1.5 sm:col-span-2">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-1.5"><User className="h-3.5 w-3.5" /> Full Name</label>
                                        {isEditing ? (
                                            <input type="text" value={editData.name} onChange={e => setEditData({ ...editData, name: e.target.value })} className="w-full bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-zinc-900 dark:text-white outline-none focus:border-indigo-500 transition-colors" />
                                        ) : (
                                            <div className="px-4 py-3 bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/5 rounded-xl text-sm font-bold text-zinc-900 dark:text-white">{ownerData.name}</div>
                                        )}
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 flex justify-between">
                                            <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> Email Address</span>
                                            {isEditing && emailError && <span className="text-red-500 normal-case tracking-normal">{emailError}</span>}
                                        </label>
                                        {isEditing ? (
                                            <input type="email" value={editData.email} onChange={e => setEditData({ ...editData, email: e.target.value })} className={`w-full bg-zinc-50 dark:bg-black/40 border ${emailError ? 'border-red-500 focus:ring-red-500/20' : 'border-zinc-200 dark:border-white/10 focus:border-indigo-500'} rounded-xl px-4 py-3 text-sm font-bold text-zinc-900 dark:text-white outline-none transition-colors`} />
                                        ) : (
                                            <div className="px-4 py-3 bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/5 rounded-xl text-sm font-bold text-zinc-900 dark:text-white truncate">{ownerData.email}</div>
                                        )}
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 flex justify-between">
                                            <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> Phone Number</span>
                                            {isEditing && phoneError && <span className="text-red-500 normal-case tracking-normal">{phoneError}</span>}
                                        </label>
                                        {isEditing ? (
                                            <input type="tel" value={editData.phone} onChange={e => setEditData({ ...editData, phone: e.target.value })} className={`w-full bg-zinc-50 dark:bg-black/40 border ${phoneError ? 'border-red-500 focus:ring-red-500/20' : 'border-zinc-200 dark:border-white/10 focus:border-indigo-500'} rounded-xl px-4 py-3 text-sm font-mono font-bold text-zinc-900 dark:text-white outline-none transition-colors`} />
                                        ) : (
                                            <div className="px-4 py-3 bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/5 rounded-xl text-sm font-mono font-bold text-zinc-900 dark:text-white">{ownerData.phone}</div>
                                        )}
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-1.5"><Building className="h-3.5 w-3.5" /> Company Name</label>
                                        {isEditing ? (
                                            <input type="text" value={editData.companyName} onChange={e => setEditData({ ...editData, companyName: e.target.value })} className="w-full bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-zinc-900 dark:text-white outline-none focus:border-indigo-500 transition-colors" />
                                        ) : (
                                            <div className="px-4 py-3 bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/5 rounded-xl text-sm font-bold text-zinc-900 dark:text-white">{ownerData.companyName || "—"}</div>
                                        )}
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-1.5"><ShieldAlert className="h-3.5 w-3.5" /> TIN Number</label>
                                        {isEditing ? (
                                            <input type="text" value={editData.tinNumber} onChange={e => setEditData({ ...editData, tinNumber: e.target.value })} className="w-full bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm font-mono font-bold text-zinc-900 dark:text-white outline-none focus:border-indigo-500 transition-colors" />
                                        ) : (
                                            <div className="px-4 py-3 bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/5 rounded-xl text-sm font-mono font-bold text-zinc-900 dark:text-white">{ownerData.tinNumber || "—"}</div>
                                        )}
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5" /> Account Created</label>
                                        <div className="px-4 py-3 bg-zinc-100/50 dark:bg-white/5 border border-transparent rounded-xl text-sm font-medium text-zinc-500 dark:text-zinc-400 opacity-70 cursor-not-allowed">{ownerData.createdAt || "Just Now"}</div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5" /> Last Login</label>
                                        <div className="px-4 py-3 bg-zinc-100/50 dark:bg-white/5 border border-transparent rounded-xl text-sm font-medium text-zinc-500 dark:text-zinc-400 opacity-70 cursor-not-allowed">{ownerData.lastLogin}</div>
                                    </div>

                                </div>
                            </div>
                        </div>

                        <div className="pt-6 border-t border-zinc-100 dark:border-white/5 flex flex-col sm:flex-row gap-3 relative z-10">
                            {isEditing ? (
                                <>
                                    <button onClick={() => { setIsEditing(false); setEditData(ownerData); }} className="flex-1 py-3 px-4 rounded-xl font-bold text-sm bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-white/5 dark:hover:bg-white/10 dark:text-zinc-300 transition-colors outline-none active:scale-95 flex items-center justify-center gap-2">
                                        <X className="h-4 w-4" /> Cancel
                                    </button>
                                    <button onClick={handleEditSave} disabled={isProcessing || emailError || phoneError} className="flex-[2] py-3 px-4 rounded-xl font-bold text-sm bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 transition-all outline-none active:scale-95 disabled:opacity-70 flex items-center justify-center gap-2">
                                        {isProcessing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                        {isProcessing ? "Saving..." : "Save Changes"}
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button onClick={() => { setEditData(ownerData); setIsEditing(true); }} className="flex-1 py-3 px-4 rounded-xl font-bold text-sm border-2 border-indigo-200 hover:border-indigo-600 text-indigo-700 dark:border-indigo-500/30 dark:hover:border-indigo-500 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-all outline-none active:scale-95 flex items-center justify-center gap-2">
                                        <Edit3 className="h-4 w-4" /> Edit Details
                                    </button>
                                    <button onClick={handleResetPassword} disabled={isProcessing} className="flex-1 py-3 px-4 rounded-xl font-bold text-sm border-2 border-amber-200 hover:border-amber-500 text-amber-700 dark:border-amber-500/30 dark:hover:border-amber-500 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-all outline-none active:scale-95 flex items-center justify-center gap-2 disabled:opacity-70">
                                        {isProcessing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Key className="h-4 w-4" />}
                                        Reset Password
                                    </button>
                                    <button onClick={handleSuspendToggle} disabled={isProcessing} className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm border-2 transition-all outline-none active:scale-95 flex items-center justify-center gap-2 disabled:opacity-70 ${ownerData.status === "Active" ? 'border-red-200 hover:border-red-600 text-red-700 dark:border-red-500/30 dark:hover:border-red-500 dark:text-red-400 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20' : 'border-emerald-200 hover:border-emerald-600 text-emerald-700 dark:border-emerald-500/30 dark:hover:border-emerald-500 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20'}`}>
                                        {isProcessing ? <RefreshCw className="h-4 w-4 animate-spin" /> : ownerData.status === "Active" ? <Ban className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                                        {ownerData.status === "Active" ? "Suspend Account" : "Restore Account"}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* 3. ACCOUNT STATISTICS */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 shrink-0">
                        <div className="bg-white dark:bg-[#121214] p-5 rounded-3xl border border-zinc-200 dark:border-white/5 shadow-sm flex items-center gap-4">
                            <div className="h-12 w-12 rounded-2xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                                <Building className="h-6 w-6" />
                            </div>
                            <div>
                                <p className="text-2xl font-black text-zinc-900 dark:text-white">7</p>
                                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-0.5">Total Branches</p>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-[#121214] p-5 rounded-3xl border border-zinc-200 dark:border-white/5 shadow-sm flex items-center gap-4">
                            <div className="h-12 w-12 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                                <Users className="h-6 w-6" />
                            </div>
                            <div>
                                <p className="text-2xl font-black text-zinc-900 dark:text-white">12</p>
                                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-0.5">Active Attendants</p>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-[#121214] p-5 rounded-3xl border border-zinc-200 dark:border-white/5 shadow-sm flex items-center gap-4">
                            <div className="h-12 w-12 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                                <Car className="h-6 w-6" />
                            </div>
                            <div>
                                <p className="text-2xl font-black text-zinc-900 dark:text-white">4,847</p>
                                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-0.5">Sessions This Month</p>
                            </div>
                        </div>
                    </div>

                    {/* 5. ACTIVITY LOG */}
                    <div className="bg-white dark:bg-[#121214] rounded-3xl shadow-sm border border-zinc-200 dark:border-white/5 overflow-hidden flex flex-col shrink-0">
                        <div className="p-5 md:p-6 border-b border-zinc-100 dark:border-white/5 bg-zinc-50 dark:bg-[#18181b]">
                            <h2 className="text-lg font-black text-zinc-900 dark:text-white flex items-center gap-2">
                                <ShieldAlert className="h-5 w-5 text-indigo-500" /> Owner Audit Log
                            </h2>
                            <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mt-1">Last 5 security & management events</p>
                        </div>
                        <div className="overflow-x-auto w-full custom-scrollbar">
                            <table className="w-full text-left border-collapse min-w-[700px]">
                                <thead>
                                    <tr className="border-b border-zinc-200 dark:border-white/10 text-[10px] uppercase tracking-widest text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-black/20">
                                        <th className="px-6 py-4 font-black">Timestamp</th>
                                        <th className="px-6 py-4 font-black">Action Performed</th>
                                        <th className="px-6 py-4 font-black">IP Address</th>
                                        <th className="px-6 py-4 font-black">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm">
                                    {ACTIVITY_LOG.map((log) => (
                                        <tr key={log.id} className="border-b border-zinc-100 dark:border-white/5 last:border-0 hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors group">
                                            <td className="px-6 py-4 font-mono font-medium text-zinc-500 whitespace-nowrap">{log.time}</td>
                                            <td className="px-6 py-4 font-bold text-zinc-900 dark:text-white whitespace-nowrap">{log.action}</td>
                                            <td className="px-6 py-4 font-mono text-zinc-500 whitespace-nowrap">{log.ip}</td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest ${log.status === "Success" ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'}`}>
                                                    {log.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* DANGER ZONE: RE-INITIALIZE (Collapsed) */}
                    <div className="bg-red-50 dark:bg-red-500/5 rounded-3xl p-6 shadow-sm border border-red-200 dark:border-red-500/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mt-4">
                        <div>
                            <h3 className="text-base font-black text-red-700 dark:text-red-400 flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5" /> Danger Zone: Re-Initialize
                            </h3>
                            <p className="text-xs text-red-600/80 dark:text-red-400/80 font-medium mt-1 max-w-xl">
                                Completely wipes the current owner account credentials. This does not delete physical parking branch data, but revokes the operator's access immediately.
                            </p>
                        </div>
                        <button
                            onClick={() => setShowReinitModal(true)}
                            className="w-full md:w-auto px-6 py-3 rounded-xl font-bold text-sm bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/20 transition-all outline-none active:scale-95 shrink-0 whitespace-nowrap"
                        >
                            Re-initialize Account
                        </button>
                    </div>
                </>
            ) : (
                /* 4. INITIALIZE OWNER ACCOUNT SECTION (If not exists) */
                <div className="bg-white dark:bg-[#121214] rounded-3xl p-6 md:p-10 shadow-sm border border-zinc-200 dark:border-white/5 animate-in fade-in slide-in-from-bottom-4 duration-500">

                    <div className="max-w-2xl mx-auto">
                        <div className="text-center mb-10">
                            <div className="h-16 w-16 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <ShieldAlert className="h-8 w-8" />
                            </div>
                            <h2 className="text-2xl md:text-3xl font-black text-zinc-900 dark:text-white">Initialize Operator</h2>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">Provision the master account for the VisionPark business operator.</p>
                        </div>

                        <form onSubmit={handleInitializeSubmit} className="space-y-6">

                            {/* AVATAR UPLOAD */}
                            <div className="flex justify-center mb-6">
                                {setupData.avatar ? (
                                    <div className="relative group">
                                        <img src={setupData.avatar} alt="Preview" className="h-24 w-24 rounded-full object-cover border-4 border-indigo-50 dark:border-indigo-500/20 shadow-xl" />
                                        <button type="button" onClick={handleRemoveImage} className="absolute -top-1 -right-1 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 shadow-md transition-transform hover:scale-110 outline-none">
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <button type="button" onClick={() => fileInputRef.current?.click()} className="h-24 w-24 rounded-full border-2 border-dashed border-zinc-300 dark:border-zinc-600 flex flex-col items-center justify-center text-zinc-400 hover:text-indigo-500 hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors cursor-pointer bg-zinc-50 dark:bg-white/5 outline-none shadow-sm">
                                        <UploadCloud className="h-6 w-6 mb-1" />
                                        <span className="text-[10px] font-bold uppercase tracking-widest">Photo</span>
                                    </button>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Full Legal Name</label>
                                    <input required type="text" value={setupData.name} onChange={e => setSetupData({ ...setupData, name: e.target.value })} placeholder="e.g. Dawit Bekele" className="w-full bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-white/10 rounded-xl px-4 py-3.5 text-sm font-bold text-zinc-900 dark:text-white outline-none focus:border-indigo-500 transition-colors" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1 flex justify-between">
                                        Phone Number {phoneError && <span className="text-red-500 normal-case tracking-normal">{phoneError}</span>}
                                    </label>
                                    <input required type="tel" value={setupData.phone} onChange={e => setSetupData({ ...setupData, phone: e.target.value })} placeholder="+251 91 234 5678" className={`w-full bg-zinc-50 dark:bg-black/40 border ${phoneError ? 'border-red-500 focus:border-red-500' : 'border-zinc-200 dark:border-white/10 focus:border-indigo-500'} rounded-xl px-4 py-3.5 text-sm font-mono font-bold text-zinc-900 dark:text-white outline-none transition-colors`} />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Company Name</label>
                                    <input type="text" value={setupData.companyName} onChange={e => setSetupData({ ...setupData, companyName: e.target.value })} placeholder="e.g. VisionPark Logistics" className="w-full bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-white/10 rounded-xl px-4 py-3.5 text-sm font-bold text-zinc-900 dark:text-white outline-none focus:border-indigo-500 transition-colors" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">TIN Number</label>
                                    <input type="text" value={setupData.tinNumber} onChange={e => setSetupData({ ...setupData, tinNumber: e.target.value })} placeholder="Tax identification number" className="w-full bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-white/10 rounded-xl px-4 py-3.5 text-sm font-mono font-bold text-zinc-900 dark:text-white outline-none focus:border-indigo-500 transition-colors" />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1 flex justify-between">
                                    Master Email Address {emailError && <span className="text-red-500 normal-case tracking-normal">{emailError}</span>}
                                </label>
                                <input required type="email" value={setupData.email} onChange={e => setSetupData({ ...setupData, email: e.target.value })} placeholder="owner@visionpark.et" className={`w-full bg-zinc-50 dark:bg-black/40 border ${emailError ? 'border-red-500 focus:border-red-500' : 'border-zinc-200 dark:border-white/10 focus:border-indigo-500'} rounded-xl px-4 py-3.5 text-sm font-bold text-zinc-900 dark:text-white outline-none transition-colors`} />
                            </div>

                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between ml-1">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Temporary Password</label>
                                    <button type="button" onClick={() => generatePassword(true)} className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 flex items-center gap-1 outline-none transition-colors">
                                        <RefreshCw className="h-3 w-3" /> Auto-generate
                                    </button>
                                </div>
                                <div className="relative">
                                    <input required type="text" readOnly value={setupData.password} placeholder="Click generate or type..." className="w-full bg-zinc-100 dark:bg-white/5 border border-zinc-300 dark:border-white/20 rounded-xl px-4 py-3.5 text-base font-mono tracking-widest font-black text-indigo-700 dark:text-indigo-400 outline-none" />
                                    <button type="button" onClick={() => copyToClipboard(setupData.password)} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-indigo-500 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 rounded-lg outline-none transition-colors">
                                        <Copy className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>

                            <div className="bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 rounded-xl p-4 flex items-start gap-3 mt-4">
                                <Mail className="h-5 w-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                                <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300 leading-relaxed">
                                    This will send a setup email to the owner with the temporary password. The owner must change their password upon first login.
                                </p>
                            </div>

                            <button
                                type="submit"
                                disabled={isProcessing || !setupData.name || !setupData.email || !setupData.password || setupData.password.length < 8 || emailError || phoneError}
                                className="w-full py-4 rounded-xl font-black text-base tracking-wide bg-indigo-600 hover:bg-indigo-500 text-white shadow-xl shadow-indigo-600/20 transition-all outline-none active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4"
                            >
                                {isProcessing ? <RefreshCw className="h-5 w-5 animate-spin" /> : <ShieldAlert className="h-5 w-5" />}
                                {isProcessing ? "Provisioning..." : "Initialize Account"}
                            </button>

                        </form>
                    </div>
                </div>
            )}

            {recentOwners.length > 0 && (
                <div className="bg-white dark:bg-[#121214] rounded-3xl border border-zinc-200 dark:border-white/5 shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b border-zinc-100 dark:border-white/5 bg-zinc-50 dark:bg-[#18181b] text-[10px] font-black uppercase tracking-widest text-zinc-500">
                        Owners created this session
                    </div>
                    <ul className="divide-y divide-zinc-100 dark:divide-white/10 max-h-48 overflow-y-auto custom-scrollbar">
                        {recentOwners.map((o) => (
                            <li key={o.id} className="px-5 py-3 text-sm font-bold text-zinc-900 dark:text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                                <span>{o.name}</span>
                                <span className="text-xs font-mono text-zinc-500 truncate">
                                    {o.email}
                                    {o.companyName ? ` · ${o.companyName}` : ""}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* --- MODALS --- */}

            {/* Danger: Re-Initialize Modal */}
            {showReinitModal && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowReinitModal(false)}></div>
                    <div className="relative w-full max-w-md bg-white dark:bg-[#18181b] rounded-3xl shadow-2xl border border-zinc-200 dark:border-white/10 p-6 md:p-8 animate-in zoom-in-95 duration-200 flex flex-col items-center text-center">

                        <div className="h-16 w-16 rounded-full bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-500 flex items-center justify-center mb-6">
                            <AlertTriangle className="h-8 w-8" />
                        </div>

                        <h2 className="text-xl md:text-2xl font-black text-zinc-900 dark:text-white mb-2">Re-initialize Account?</h2>
                        <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-8 leading-relaxed">
                            This is a destructive action. The current owner will lose access instantly. Are you absolutely sure you want to proceed?
                        </p>

                        <div className="flex w-full gap-3">
                            <button
                                onClick={() => setShowReinitModal(false)}
                                className="flex-1 py-3.5 rounded-xl font-bold text-sm bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-white/5 dark:hover:bg-white/10 dark:text-zinc-300 transition-colors outline-none active:scale-95"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmReinitialize}
                                disabled={isProcessing}
                                className="flex-1 py-3.5 rounded-xl font-bold text-sm bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/20 transition-all outline-none active:scale-95 flex items-center justify-center gap-2 disabled:opacity-70"
                            >
                                {isProcessing ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Yes, Purge Access"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Success: Password Reset Modal */}
            {resetPasswordModal && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setResetPasswordModal(null)}></div>
                    <div className="relative w-full max-w-sm bg-white dark:bg-[#18181b] rounded-3xl shadow-2xl border border-zinc-200 dark:border-white/10 p-6 md:p-8 animate-in zoom-in-95 duration-200 flex flex-col items-center text-center">

                        <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-500 flex items-center justify-center mb-6">
                            <Key className="h-8 w-8" />
                        </div>

                        <h2 className="text-xl font-black text-zinc-900 dark:text-white mb-2">Password Reset</h2>
                        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-6">
                            The owner's password has been successfully reset. Please provide them with this temporary password.
                        </p>

                        <div className="w-full relative mb-6">
                            <input
                                type="text"
                                readOnly
                                value={resetPasswordModal}
                                className="w-full bg-zinc-100 dark:bg-white/5 border border-zinc-300 dark:border-white/20 rounded-xl px-4 py-4 text-center text-lg font-mono tracking-widest font-black text-indigo-700 dark:text-indigo-400 outline-none"
                            />
                            <button
                                onClick={() => copyToClipboard(resetPasswordModal)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-500/30 rounded-lg outline-none transition-colors"
                            >
                                <Copy className="h-4 w-4" />
                            </button>
                        </div>

                        <button
                            onClick={() => setResetPasswordModal(null)}
                            className="w-full py-3.5 rounded-xl font-bold text-sm bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors outline-none active:scale-95"
                        >
                            Done
                        </button>
                    </div>
                </div>
            )}

            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #52525b; border-radius: 10px; }
            `}</style>
        </div>
    );
}
import React, { useEffect, useMemo, useState } from "react";
import {
    User, Mail, Phone, MapPin,
    ShieldCheck, Clock, Building,
    Lock, AlertCircle, Key, FileText
} from "lucide-react";
import { apiClient } from "../../api/apiClient";

const FALLBACK_AVATAR = "https://i.pravatar.cc/150?u=attendant";
const PLACEHOLDER = "Not available";

export default function AttendantProfile() {
    const [toastMessage, setToastMessage] = useState("");
    const [profile, setProfile] = useState(null);

    const showToast = () => {
        setToastMessage("Please contact your Parking Lot Owner to request changes to your profile.");
        setTimeout(() => setToastMessage(""), 4000);
    };

    useEffect(() => {
        let isMounted = true;

        const fetchProfile = async () => {
            try {
                const me = await apiClient.get("/auth/me");
                const lots = await apiClient.get("/parking/lots");
                const lotRows = Array.isArray(lots) ? lots : [];

                const attendantProfile = me?.attendantProfile || me?.attendant || {};
                const assignedLotId = attendantProfile?.lotId || attendantProfile?.branchId || null;
                const assignedLot = lotRows.find((lot) => String(lot?._id) === String(assignedLotId));

                const branchAddressParts = [
                    assignedLot?.name,
                    assignedLot?.address,
                    assignedLot?.city,
                    assignedLot?.region,
                ].filter(Boolean);

                const nextProfile = {
                    id: me?._id || PLACEHOLDER,
                    name: me?.name || PLACEHOLDER,
                    email: me?.email || PLACEHOLDER,
                    phone: attendantProfile?.phone || PLACEHOLDER,
                    faydaId: attendantProfile?.faydaId || PLACEHOLDER,
                    address: attendantProfile?.address || branchAddressParts.join(", ") || PLACEHOLDER,
                    branch: assignedLot?.name || PLACEHOLDER,
                    shiftStart: attendantProfile?.shiftStart || PLACEHOLDER,
                    shiftEnd: attendantProfile?.shiftEnd || PLACEHOLDER,
                    status: me?.status ? String(me.status).replace(/^./, (m) => m.toUpperCase()) : "Active",
                    avatar: me?.avatarUrl || FALLBACK_AVATAR,
                };

                if (isMounted) {
                    setProfile(nextProfile);
                }
            } catch {
                if (isMounted) {
                    setProfile({
                        id: PLACEHOLDER,
                        name: PLACEHOLDER,
                        email: PLACEHOLDER,
                        phone: PLACEHOLDER,
                        faydaId: PLACEHOLDER,
                        address: PLACEHOLDER,
                        branch: PLACEHOLDER,
                        shiftStart: PLACEHOLDER,
                        shiftEnd: PLACEHOLDER,
                        status: "Active",
                        avatar: FALLBACK_AVATAR,
                    });
                }
            }
        };

        fetchProfile();
        return () => {
            isMounted = false;
        };
    }, []);

    const attendantData = useMemo(
        () =>
            profile || {
                id: PLACEHOLDER,
                name: PLACEHOLDER,
                email: PLACEHOLDER,
                phone: PLACEHOLDER,
                faydaId: PLACEHOLDER,
                address: PLACEHOLDER,
                branch: PLACEHOLDER,
                shiftStart: PLACEHOLDER,
                shiftEnd: PLACEHOLDER,
                status: "Active",
                avatar: FALLBACK_AVATAR,
            },
        [profile]
    );

    // --- REUSABLE READ-ONLY FIELD (Fully Responsive, No Truncation) ---
    const ReadOnlyField = ({ icon: Icon, label, value, isMono = false }) => (
        <div className="space-y-1.5 w-full">
            <label className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-zinc-500 flex items-center justify-between">
                <span>{label}</span>
                <Lock className="h-3 w-3 text-zinc-400 shrink-0 ml-2" />
            </label>
            <div className="flex items-start bg-zinc-50 dark:bg-[#1a1a1c] border border-zinc-200 dark:border-white/10 rounded-xl px-4 py-3.5 transition-all opacity-80 cursor-not-allowed w-full">
                <Icon className="h-5 w-5 text-zinc-400 shrink-0 mr-3 mt-0.5" />
                <span className={`text-sm md:text-base text-zinc-900 dark:text-white break-words w-full leading-relaxed ${isMono ? 'font-mono font-bold tracking-wider' : 'font-bold'}`}>
                    {value}
                </span>
            </div>
        </div>
    );

    return (
        <div className="h-full w-full flex flex-col gap-6 animate-in fade-in duration-500 relative pb-10">

            {/* Toast Notification */}
            {toastMessage && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold text-xs md:text-sm px-6 py-3 rounded-2xl shadow-2xl z-[8000] animate-in slide-in-from-top-4 flex items-start gap-3 w-11/12 md:w-auto text-center justify-center">
                    <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                    <span className="break-words text-left leading-snug">{toastMessage}</span>
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 shrink-0">
                <div className="w-full md:flex-1">
                    <h1 className="text-2xl md:text-3xl font-black text-zinc-900 dark:text-white tracking-tight">My Profile</h1>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 break-words">View your assigned identity, contact details, and shift schedule.</p>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl text-zinc-600 dark:text-zinc-400 font-bold text-xs md:text-sm shrink-0 w-fit">
                    <Lock className="h-4 w-4 shrink-0" /> <span className="break-words">Profile is Read-Only</span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* LEFT COLUMN: Personal Identity */}
                <div className="lg:col-span-2 flex flex-col gap-6">

                    <div className="bg-white dark:bg-[#121214] p-6 md:p-8 rounded-3xl border border-zinc-200 dark:border-white/5 shadow-sm">
                        <div className="flex flex-col lg:flex-row gap-8 items-start">

                            {/* Avatar & Status */}
                            <div className="flex flex-col items-center gap-4 shrink-0 w-full lg:w-auto">
                                <div className="h-32 w-32 rounded-full overflow-hidden border-4 border-emerald-50 dark:border-emerald-500/20 shadow-xl bg-zinc-100 dark:bg-white/5 relative shrink-0">
                                    <img src={attendantData.avatar} alt="Profile" className="h-full w-full object-cover" />
                                </div>
                                <div className="flex flex-col items-center text-center">
                                    <span className="text-xl font-black text-zinc-900 dark:text-white break-words px-2">{attendantData.name}</span>
                                    <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest mt-1">ID: {attendantData.id}</span>
                                </div>
                                <span className="inline-flex items-center px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-xs font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest border border-emerald-200 dark:border-emerald-500/30">
                                    <ShieldCheck className="h-4 w-4 mr-1.5 shrink-0" /> {attendantData.status}
                                </span>
                            </div>

                            {/* Contact Details */}
                            <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-5">
                                <div className="sm:col-span-2">
                                    <ReadOnlyField icon={Mail} label="Email Address" value={attendantData.email} />
                                </div>
                                <ReadOnlyField icon={Phone} label="Phone Number" value={attendantData.phone} isMono={true} />
                                <ReadOnlyField icon={FileText} label="Fayda National ID" value={attendantData.faydaId} isMono={true} />
                                <div className="sm:col-span-2">
                                    <ReadOnlyField icon={MapPin} label="Physical Address" value={attendantData.address} />
                                </div>
                            </div>

                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN: Assignment & Security */}
                <div className="lg:col-span-1 flex flex-col gap-6">

                    {/* Work Assignment Card */}
                    <div className="bg-emerald-500 dark:bg-emerald-500/10 p-6 md:p-8 rounded-3xl border border-emerald-600 dark:border-emerald-500/20 shadow-sm relative overflow-hidden">
                        {/* Decorative Background Icon */}
                        <Building className="absolute -bottom-4 -right-4 h-32 w-32 text-emerald-600 dark:text-emerald-500/20 opacity-20 pointer-events-none shrink-0" />

                        <div className="relative z-10">
                            <h3 className="text-sm font-black uppercase tracking-widest text-emerald-100 dark:text-emerald-500 mb-6 flex items-start gap-2 break-words">
                                <MapPin className="h-4 w-4 shrink-0 mt-0.5" /> Active Assignment
                            </h3>

                            <div className="space-y-5">
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-200 dark:text-emerald-400/70 mb-1">Assigned Branch</p>
                                    <p className="text-lg md:text-xl font-black text-white break-words leading-tight">{attendantData.branch}</p>
                                </div>

                                <div className="bg-emerald-600/50 dark:bg-black/20 rounded-xl p-4 border border-emerald-400/30 dark:border-white/5">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-100 dark:text-emerald-400/70 mb-3 flex items-center gap-1.5">
                                        <Clock className="h-3 w-3 shrink-0" /> Shift Timing
                                    </p>
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                        <div className="text-white font-mono font-black break-words">{attendantData.shiftStart}</div>
                                        <div className="hidden sm:block h-px flex-1 bg-emerald-400/30 dark:bg-emerald-500/30 mx-3"></div>
                                        <div className="sm:hidden text-emerald-200 text-xs font-bold text-center">TO</div>
                                        <div className="text-white font-mono font-black break-words">{attendantData.shiftEnd}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Security Support Card */}
                    <div className="bg-white dark:bg-[#121214] p-6 rounded-3xl border border-zinc-200 dark:border-white/5 shadow-sm">
                        <div className="flex items-start gap-2 mb-4 text-zinc-900 dark:text-white">
                            <Key className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                            <h3 className="font-black text-lg break-words">Security & Access</h3>
                        </div>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6 font-medium leading-relaxed break-words">
                            Your password and profile data are securely managed by your Parking Lot Owner.
                        </p>

                        <button
                            onClick={showToast}
                            className="w-full bg-zinc-100 hover:bg-zinc-200 dark:bg-white/5 dark:hover:bg-white/10 text-zinc-700 dark:text-zinc-300 font-bold py-3.5 px-4 rounded-xl transition-all outline-none active:scale-95 flex items-start justify-center gap-2 text-sm text-left"
                        >
                            <AlertCircle className="h-4 w-4 text-zinc-500 shrink-0 mt-0.5" />
                            <span className="break-words">Request Profile Update</span>
                        </button>
                    </div>

                </div>
            </div>

        </div>
    );
}
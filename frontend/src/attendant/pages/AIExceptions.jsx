import React, { useEffect, useRef, useState } from "react";
import {
    AlertTriangle, Camera, Edit3, CheckCircle,
    Search, CarFront, Hash, Eye, AlertOctagon,
    ChevronRight, X, ShieldAlert, Clock, MapPin,
    ChevronDown, Check
} from "lucide-react";
import { apiClient } from "../../api/apiClient";

// --- VEHICLE OPTIONS (Imported from POS for consistency) ---
const VEHICLE_OPTIONS = [
    { group: "Public Transport", items: ["Public Transport Vehicles | Upto 12 Seats", "Public Transport Vehicles | 13-24 Seats", "Public Transport Vehicles | 25 Seats and above"] },
    { group: "Two Wheelers", items: ["Bicycle | Bicycle", "Motorcycle | Motorcycle"] },
    { group: "Dry Freight", items: ["Dry Freight Vehicles | <35 Quintal", "Dry Freight Vehicles | 36-70 Quintal", "Dry Freight Vehicles | >71 Quintal"] },
    { group: "Liquid Cargo", items: ["Liquid Cargo Vehicles | Upto 28 Liter", "Liquid Cargo Vehicles | Above 28 Liter"] },
    { group: "Machineries", items: ["Machineries | Upto 5000KG weight", "Machineries | 5001-10,000KG weight", "Machineries | Above 10,001KG weight"] }
];

export default function AIExceptions() {
    const [exceptions, setExceptions] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");

    // Resolution State
    const [selectedException, setSelectedException] = useState(null);
    const [manualPlate, setManualPlate] = useState("");
    const [plateError, setPlateError] = useState(false); // ✅ Added inline error tracking

    // CATEGORY DROPDOWN STATE
    const [activeModal, setActiveModal] = useState(null);
    const [correctedCategory, setCorrectedCategory] = useState("Public Transport Vehicles | Upto 12 Seats");

    const [isResolving, setIsResolving] = useState(false);
    const [toastMessage, setToastMessage] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const isFetchingRef = useRef(false);
    const cancelledRef = useRef(false);

    // Optional state placeholders (keeps UI unchanged while still tracking backend state).
    void loading;
    void error;

    const pendingCount = exceptions.filter(e => e.status === "Pending").length;
    const filteredExceptions = exceptions.filter(e =>
        e.status === "Pending" &&
        (e.id.toLowerCase().includes(searchQuery.toLowerCase()) || e.type.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const showToast = (msg) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(""), 4000);
    };

    const fetchExceptions = async () => {
        if (cancelledRef.current || isFetchingRef.current) return;
        isFetchingRef.current = true;
        try {
            const data = await apiClient.get("/attendant/ai-exceptions?status=pending");
            const rows = Array.isArray(data) ? data : [];
            if (cancelledRef.current) return;
            setExceptions(rows);
            setError(null);
        } catch (e) {
            if (!cancelledRef.current) {
                console.error("AIExceptions fetch failed:", e);
                setError(e);
                setExceptions([]);
            }
        } finally {
            isFetchingRef.current = false;
            if (!cancelledRef.current) {
                setLoading(false);
            }
        }
    };

    useEffect(() => {
        cancelledRef.current = false;
        fetchExceptions();
        const pollId = setInterval(fetchExceptions, 10000);

        return () => {
            cancelledRef.current = true;
            clearInterval(pollId);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const openReviewModal = (exception) => {
        setSelectedException(exception);
        setManualPlate(exception.aiGuess === "UNKNOWN" ? "" : exception.aiGuess);
        setPlateError(false); // Reset error state on open
    };

    const handleResolve = async () => {
        // ✅ Inline Validation Check
        if (selectedException.type !== "CATEGORY_MISMATCH" && !manualPlate.trim()) {
            setPlateError(true);
            return;
        }

        setPlateError(false);
        setIsResolving(true);
        try {
            const payload =
                selectedException.type === "CATEGORY_MISMATCH"
                    ? { correctedCategory }
                    : { correctedPlate: manualPlate.trim() };

            await apiClient.post(`/attendant/ai-exceptions/${selectedException.id}/resolve`, payload);

            setExceptions((prev) => prev.filter((e) => e.id !== selectedException.id));
            showToast(`Exception ${selectedException.id} successfully resolved. Database updated.`);
            setSelectedException(null);
        } catch (e) {
            console.error("AIExceptions resolve failed:", e);
        } finally {
            setIsResolving(false);
        }
    };

    // Helper for UI styling
    const getIssueStyles = (type) => {
        switch (type) {
            case "UNREADABLE_PLATE": return { color: "text-red-500", bg: "bg-red-50 dark:bg-red-500/10", border: "border-red-200 dark:border-red-500/20", icon: <AlertOctagon className="h-5 w-5 text-red-500" /> };
            case "EXIT_MISMATCH": return { color: "text-orange-500", bg: "bg-orange-50 dark:bg-orange-500/10", border: "border-orange-200 dark:border-orange-500/20", icon: <ShieldAlert className="h-5 w-5 text-orange-500" /> };
            case "CATEGORY_MISMATCH": return { color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-500/10", border: "border-amber-200 dark:border-amber-500/20", icon: <CarFront className="h-5 w-5 text-amber-500" /> };
            default: return { color: "text-zinc-500", bg: "bg-zinc-50", border: "border-zinc-200", icon: <AlertTriangle className="h-5 w-5" /> };
        }
    };

    // --- REUSABLE SELECTOR BUTTON ---
    const SelectorButton = ({ icon: Icon, label, value, field }) => (
        <div>
            <label className="block text-xs md:text-sm font-bold uppercase tracking-widest text-zinc-500 mb-1.5 ml-1 flex items-center gap-2">
                <Icon className="h-4 w-4" /> {label}
            </label>
            <button
                type="button"
                onClick={() => setActiveModal(field)}
                /* ✅ Glass Premium Green on focus */
                className="w-full h-14 relative flex items-center rounded-xl transition-all duration-300 outline-none cursor-pointer border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-black/40 text-zinc-900 dark:text-white hover:border-emerald-500 hover:shadow-[0_0_15px_rgba(16,185,129,0.15)] focus:border-emerald-500 focus:shadow-[0_0_15px_rgba(16,185,129,0.15)]"
            >
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Icon className="h-5 w-5 text-zinc-400 dark:text-zinc-500" />
                </div>
                <span className="pl-12 pr-10 truncate text-left text-sm md:text-base font-bold w-full">{value}</span>
                <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                    <ChevronDown className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
                </div>
            </button>
        </div>
    );

    return (
        <div className="h-full w-full flex flex-col gap-6 animate-in fade-in duration-500 relative">

            {/* Toast Notification */}
            {toastMessage && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold text-sm px-6 py-3 rounded-2xl shadow-2xl z-[9000] animate-in slide-in-from-top-4 flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" /> {toastMessage}
                </div>
            )}

            {/* HEADER & STATS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 shrink-0">

                <div className="bg-white dark:bg-[#121214] rounded-3xl p-6 shadow-sm border border-zinc-200 dark:border-white/5 flex flex-col justify-center">
                    <h2 className="text-2xl font-black text-zinc-900 dark:text-white flex items-center gap-3">
                        <Eye className="h-7 w-7 text-emerald-500" /> AI Exceptions
                    </h2>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Human review desk for camera anomalies and misreads.</p>
                </div>

                <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-3xl p-6 shadow-sm border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-1">Awaiting Triage</p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-4xl font-black text-emerald-700 dark:text-emerald-500">{pendingCount}</span>
                            <span className="text-sm font-bold text-emerald-600/70 dark:text-emerald-400/70">Flags</span>
                        </div>
                        <p className="text-[10px] font-bold text-emerald-500 mt-1">Requires immediate attention</p>
                    </div>
                    <div className={`h-12 w-12 rounded-full ${pendingCount > 0 ? 'bg-emerald-500 text-white animate-pulse shadow-[0_0_15px_rgba(16,185,129,0.6)]' : 'bg-emerald-200/50 text-emerald-600'} flex items-center justify-center`}>
                        <AlertTriangle className="h-6 w-6" />
                    </div>
                </div>

            </div>

            {/* MAIN LIST AREA */}
            <div className="flex-1 bg-white dark:bg-[#121214] rounded-3xl shadow-sm border border-zinc-200 dark:border-white/5 flex flex-col overflow-hidden">

                {/* Toolbar */}
                <div className="p-4 md:p-6 border-b border-zinc-100 dark:border-white/5 flex items-center gap-4 bg-zinc-50 dark:bg-[#18181b] shrink-0">
                    <div className="relative w-full max-w-md">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
                        <input
                            type="text"
                            placeholder="Search Exception ID or Type..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            /* ✅ Glass Premium Green focus state */
                            className="w-full h-12 pl-12 pr-4 bg-white dark:bg-black/40 border border-zinc-200 dark:border-white/10 rounded-xl text-sm font-bold outline-none focus:bg-emerald-50 dark:focus:bg-emerald-500/10 focus:border-emerald-500 focus:shadow-[0_0_15px_rgba(16,185,129,0.15)] transition-all"
                        />
                    </div>
                </div>

                {/* Exception Queue */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
                    <div className="space-y-4">
                        {filteredExceptions.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
                                <CheckCircle className="h-16 w-16 mb-4 text-emerald-500 opacity-50" />
                                <p className="text-lg font-bold text-zinc-900 dark:text-white">AI is running perfectly.</p>
                                <p className="text-sm">No camera exceptions in the queue.</p>
                            </div>
                        ) : (
                            filteredExceptions.map((exc) => {
                                const styles = getIssueStyles(exc.type);

                                return (
                                    <div key={exc.id} className={`flex flex-col md:flex-row items-center gap-4 p-4 rounded-2xl border transition-all ${styles.bg} ${styles.border}`}>

                                        {/* Tiny Camera Thumbnail Simulator */}
                                        <div className="h-20 w-32 bg-black rounded-xl border border-white/10 shrink-0 relative overflow-hidden flex items-center justify-center group">
                                            <Camera className="h-6 w-6 text-white/50" />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                <span className="text-[10px] font-bold text-white uppercase tracking-widest">Click to View</span>
                                            </div>
                                        </div>

                                        <div className="flex-1 w-full md:w-auto">
                                            <div className="flex items-center gap-2 mb-1">
                                                {styles.icon}
                                                <span className="font-black text-zinc-900 dark:text-white tracking-tight">{exc.type.replace('_', ' ')}</span>
                                                <span className="text-[10px] font-bold text-zinc-500 uppercase ml-2 bg-black/5 dark:bg-white/5 px-2 py-1 rounded-md">{exc.id}</span>
                                            </div>
                                            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{exc.issue}</p>

                                            <div className="flex items-center gap-4 mt-3 text-xs font-bold text-zinc-500">
                                                <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {exc.time}</span>
                                                <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {exc.location}</span>
                                            </div>
                                        </div>

                                        {/* ✅ Premium Black for neutral navigation buttons */}
                                        <button
                                            onClick={() => openReviewModal(exc)}
                                            className="w-full md:w-auto mt-2 md:mt-0 whitespace-nowrap bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 font-bold py-3 px-6 rounded-xl shadow-sm active:scale-95 transition-all outline-none flex items-center justify-center gap-2 text-sm cursor-pointer"
                                        >
                                            <Eye className="h-4 w-4" /> Review & Resolve <ChevronRight className="h-4 w-4" />
                                        </button>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>

            {/* --- REVIEW MODAL (THE HUMAN OVERRIDE DESK) --- */}
            {selectedException && (
                <div className="fixed inset-0 z-[7000] flex items-center justify-center bg-zinc-900/80 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setSelectedException(null)}>
                    <div className="w-full max-w-3xl bg-white dark:bg-[#121214] rounded-3xl shadow-2xl flex flex-col md:flex-row overflow-hidden animate-in zoom-in-95 duration-300 border border-zinc-200 dark:border-white/10 max-h-[90vh]" onClick={(e) => e.stopPropagation()}>

                        {/* LEFT: Camera Evidence */}
                        <div className="w-full md:w-1/2 bg-black p-6 flex flex-col relative shrink-0">
                            <button onClick={() => setSelectedException(null)} className="absolute top-4 left-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors outline-none md:hidden z-10 cursor-pointer">
                                <X className="h-5 w-5 text-white" />
                            </button>

                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2 text-zinc-400 text-xs font-bold uppercase tracking-widest">
                                    <Camera className="h-4 w-4" /> Camera Feed
                                </div>
                                <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-300 text-[10px] font-mono font-bold">
                                    <div className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse"></div> LIVE
                                </div>
                            </div>

                            <div className="flex-1 relative rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900 min-h-[200px] md:min-h-0 flex items-center justify-center">
                                <img src={selectedException.image} alt="Camera Evidence" className="w-full h-full object-cover opacity-70 grayscale-[20%]" />

                                {/* Simulated AI Bounding Box */}
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <div className="w-1/2 h-1/3 border-[3px] border-red-500/80 rounded relative">
                                        <span className="absolute -top-6 left-0 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-t font-mono">
                                            CONFIDENCE: {selectedException.aiConfidence}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <p className="text-zinc-500 text-xs mt-4 text-center font-medium">Use the photo evidence to manually correct the system record.</p>
                        </div>

                        {/* RIGHT: Triage Form */}
                        <div className="w-full md:w-1/2 flex flex-col bg-white dark:bg-[#121214] shrink-0">

                            <div className="p-6 border-b border-zinc-100 dark:border-white/5 flex items-center justify-between">
                                <div>
                                    <h3 className="font-black text-xl text-zinc-900 dark:text-white leading-none">Manual Override</h3>
                                    <p className="text-xs font-bold text-emerald-600 dark:text-emerald-500 mt-1 uppercase tracking-widest">{selectedException.id} • {selectedException.location}</p>
                                </div>
                                <button onClick={() => setSelectedException(null)} className="hidden md:block p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-white/10 rounded-full transition-colors outline-none cursor-pointer"><X className="h-5 w-5" /></button>
                            </div>

                            <div className="flex-1 p-6 space-y-6 overflow-y-auto custom-scrollbar">

                                <div className={`p-4 rounded-xl border ${getIssueStyles(selectedException.type).bg} ${getIssueStyles(selectedException.type).border}`}>
                                    <p className="text-sm font-bold text-zinc-900 dark:text-white mb-1">AI Flag Reason:</p>
                                    <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{selectedException.issue}</p>
                                </div>

                                <div className="space-y-4">

                                    {/* Plate Correction Field with Inline Validation */}
                                    {selectedException.type !== "CATEGORY_MISMATCH" && (
                                        <div>
                                            <label className="block text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2 flex items-center gap-2">
                                                <Hash className="h-4 w-4" /> Correct License Plate
                                            </label>
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <Edit3 className={`h-5 w-5 ${plateError ? 'text-red-500' : 'text-emerald-500'}`} />
                                                </div>
                                                <input
                                                    type="text"
                                                    value={manualPlate}
                                                    onChange={(e) => {
                                                        setManualPlate(e.target.value.toUpperCase());
                                                        if (plateError) setPlateError(false); // Clear error on typing
                                                    }}
                                                    placeholder="Type correct plate..."
                                                    className={`w-full h-14 pl-10 pr-4 rounded-xl bg-zinc-50 dark:bg-black/40 border text-zinc-900 dark:text-white outline-none transition-all font-mono font-black text-xl tracking-wider ${plateError
                                                            ? "border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                                                            : "border-zinc-200 dark:border-white/10 focus:border-emerald-500 focus:bg-emerald-50 dark:focus:bg-emerald-500/10 focus:shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                                                        }`}
                                                    autoFocus
                                                />
                                            </div>

                                            {/* ✅ Inline Warning Message */}
                                            {plateError ? (
                                                <p className="text-[10px] font-bold text-red-500 mt-2 flex items-center gap-1 animate-in slide-in-from-top-1">
                                                    <AlertTriangle className="h-3 w-3" /> License Plate cannot be empty.
                                                </p>
                                            ) : (
                                                <p className="text-[10px] font-bold text-zinc-400 mt-2">
                                                    AI guessed: <span className="font-mono text-zinc-500 line-through">{selectedException.aiGuess}</span>
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    {/* Category Correction Field */}
                                    {selectedException.type === "CATEGORY_MISMATCH" && (
                                        <div>
                                            <SelectorButton icon={CarFront} label="Verify Vehicle Category" value={correctedCategory} field="vehicleType" />
                                            <p className="text-[10px] font-bold text-zinc-400 mt-3 pl-1">AI guessed: <span className="text-zinc-500 line-through">{selectedException.aiGuess}</span></p>
                                        </div>
                                    )}

                                </div>
                            </div>

                            {/* Action Footer */}
                            <div className="p-6 border-t border-zinc-100 dark:border-white/5 bg-zinc-50 dark:bg-[#18181b] shrink-0 flex gap-3">
                                {/* ✅ Premium Black for Cancel */}
                                <button
                                    onClick={() => { setSelectedException(null); setPlateError(false); }}
                                    className="flex-1 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 font-bold py-4 rounded-xl shadow-sm active:scale-95 transition-all outline-none cursor-pointer"
                                >
                                    Cancel
                                </button>

                                {/* ✅ Premium Green for Resolve Action */}
                                <button
                                    onClick={handleResolve}
                                    disabled={isResolving}
                                    className="flex-[2] bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-black py-4 rounded-xl shadow-lg active:scale-95 transition-all outline-none flex items-center justify-center gap-2 text-sm cursor-pointer disabled:opacity-70"
                                >
                                    {isResolving ? (
                                        <span className="animate-pulse">Updating System...</span>
                                    ) : (
                                        <>
                                            <CheckCircle className="h-5 w-5" /> Force Update & Resolve
                                        </>
                                    )}
                                </button>
                            </div>

                        </div>
                    </div>
                </div>
            )}

            {/* --- CATEGORY SELECTOR MODAL --- */}
            {activeModal === 'vehicleType' && (
                <div className="fixed inset-0 z-[8000] flex items-center justify-center bg-zinc-900/60 dark:bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="w-full max-w-sm md:max-w-md lg:max-w-lg bg-white dark:bg-[#121214] rounded-3xl shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-5 md:p-6 border-b border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 rounded-t-3xl shrink-0">
                            <h3 className="text-lg md:text-xl font-bold text-zinc-900 dark:text-white">
                                Select Vehicle Category
                            </h3>
                            <button onClick={() => setActiveModal(null)} className="p-2 -mr-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors rounded-full hover:bg-zinc-200 dark:hover:bg-white/10 outline-none cursor-pointer active:scale-90">
                                <X className="h-5 w-5 md:h-6 md:w-6" />
                            </button>
                        </div>

                        <div className="overflow-y-auto p-3 md:p-4 overscroll-contain custom-scrollbar">
                            {VEHICLE_OPTIONS.map((group, gIndex) => (
                                <div key={gIndex} className="mb-4 last:mb-0">
                                    <h4 className="text-[10px] md:text-[11px] uppercase tracking-widest font-black text-emerald-600 dark:text-emerald-500 px-3 mb-2">{group.group}</h4>
                                    <div className="space-y-1 md:space-y-2">
                                        {group.items.map((item, iIndex) => {
                                            const isSelected = correctedCategory === item;

                                            return (
                                                <button
                                                    key={iIndex}
                                                    onClick={() => {
                                                        setCorrectedCategory(item);
                                                        setActiveModal(null);
                                                    }}
                                                    className={`w-full flex items-center justify-between p-4 rounded-2xl text-left transition-all outline-none cursor-pointer active:scale-[0.98] ${isSelected ? 'bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-500/50 shadow-sm' : 'border border-transparent hover:bg-zinc-50 dark:hover:bg-white/5 hover:border-zinc-200 dark:hover:border-white/10'}`}
                                                >
                                                    <span className={`text-sm md:text-base ${isSelected ? 'font-bold text-emerald-700 dark:text-emerald-400' : 'font-bold text-zinc-700 dark:text-zinc-300'}`}>{item}</span>
                                                    {isSelected && <Check className="h-5 w-5 md:h-6 md:w-6 text-emerald-500 shrink-0" />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
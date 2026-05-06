import React, { useState, useEffect, useRef } from "react";
import {
    CarFront, AlertTriangle, Clock, X, ShieldAlert,
    User, Smartphone, Video, MapPin, CheckCircle,
    Lock, Megaphone, Ban
} from "lucide-react";
import { apiClient } from "../../api/apiClient";

export default function LiveGrid() {
    const [spots, setSpots] = useState([]);
    const [branchName, setBranchName] = useState("Bole Premium Lot");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedSpot, setSelectedSpot] = useState(null);
    const [filter, setFilter] = useState("All");
    const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());

    const [toastMessage, setToastMessage] = useState("");

    const cancelledRef = useRef(false);
    const isFetchingRef = useRef(false);
    const didInitialFetchRef = useRef(false);

    // Avoid eslint "unused vars" for optional loading/error states.
    void loading;
    void error;

    const mapBackendSpotToUiSpot = (b) => {
        const backendStatus = String(b?.status ?? "free").toLowerCase();

        const uiStatus =
            backendStatus === "free"
                ? "Free"
                : backendStatus === "reserved"
                    ? "Reserved"
                    : "Occupied"; // occupied|conflict -> UI Occupied

        const reservation = b?.reservation
            ? {
                name: b?.reservation?.driverName ?? null,
                eta: b?.reservation?.eta ?? null,
                plate: b?.reservation?.plateNumber ?? null,
                phone: b?.reservation?.phone ?? null,
            }
            : null;

        return {
            id: String(b?.id ?? ""),
            branchName: b?.branchName ?? null,
            status: uiStatus,
            category: b?.category ?? null,
            isConflict: Boolean(b?.isConflict),
            expectedDriver: reservation,
            actualPlate: b?.occupancy?.plateNumber ?? null,
            waitingToMove: Boolean(b?.waitingToMove),
        };
    };

    const fetchLiveGrid = async () => {
        if (cancelledRef.current) return;
        if (isFetchingRef.current) return;
        isFetchingRef.current = true;

        try {
            const data = await apiClient.get(`/attendant/live-grid`);
            const backendSpots = Array.isArray(data) ? data : [];
            const mapped = backendSpots
                .map(mapBackendSpotToUiSpot)
                .filter((s) => s && s.id);

            if (cancelledRef.current) return;
            setSpots(mapped);
            setBranchName(mapped[0]?.branchName || "Bole Premium Lot");
            setSelectedSpot((prev) => {
                if (!prev) return prev;
                return mapped.find((s) => s.id === prev.id) ?? null;
            });
            setError(null);
        } catch (e) {
            if (!cancelledRef.current) {
                console.error("LiveGrid live-grid fetch failed:", e);
                setError(e);
            }
        } finally {
            isFetchingRef.current = false;
            if (!didInitialFetchRef.current) {
                didInitialFetchRef.current = true;
                setLoading(false);
            }
        }
    };

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date().toLocaleTimeString()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        cancelledRef.current = false;

        const poll = async () => {
            if (cancelledRef.current) return;
            await fetchLiveGrid();
        };

        poll();
        const intervalId = setInterval(poll, 5000);

        return () => {
            cancelledRef.current = true;
            clearInterval(intervalId);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const freeSpotsList = spots.filter(s => s.status === "Free");

    // --- FUNCTIONALITY LOGIC --- //

    // Conflict: Instruct Squatter to Leave
    const handleInstructToLeave = async () => {
        if (!selectedSpot) return;
        try {
            await apiClient.post(`/attendant/spots/${selectedSpot.id}/instruct-leave`);

            // Optimistic UI update for immediate UX feedback.
            setSpots((prev) => prev.map((s) => (s.id === selectedSpot.id ? { ...s, waitingToMove: true } : s)));
            setSelectedSpot((prev) => (prev ? { ...prev, waitingToMove: true } : prev));
            showToast("Driver instructed to leave. System will auto-restore reservation upon departure.");

            // Refetch to ensure server truth.
            fetchLiveGrid();
        } catch (e) {
            console.error("LiveGrid instruct-leave failed:", e);
        }
    };

    const showToast = (msg) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(""), 4000);
    };

    const stats = {
        total: spots.length,
        free: freeSpotsList.length,
        reserved: spots.filter(s => s.status === "Reserved").length,
        occupied: spots.filter(s => s.status === "Occupied").length,
        conflicts: spots.filter(s => s.isConflict).length,
    };

    const filteredSpots = spots.filter(s => filter === "All" || s.status === filter || (filter === "Conflict" && s.isConflict));

    // ✅ STRICT PRESERVED SPOT COLORS (Do not touch)
    const getSpotStyles = (spot) => {
        if (spot.isConflict) return "bg-purple-600 text-white border-purple-700 shadow-[0_0_20px_rgba(147,51,234,0.8)] animate-pulse z-10";
        if (spot.status === "Free") return "bg-emerald-500 text-white border-emerald-600 shadow-md hover:bg-emerald-400"; // PREMIUM GREEN
        if (spot.status === "Reserved") return "bg-yellow-400 text-zinc-900 border-yellow-500 shadow-md hover:bg-yellow-300"; // PREMIUM YELLOW
        return "bg-red-600 text-white border-red-700 shadow-md hover:bg-red-500"; // PREMIUM RED
    };

    return (
        <div className="h-full w-full flex flex-col lg:flex-row gap-6 animate-in fade-in duration-500 relative overflow-hidden">

            {/* 1. MAIN WORKSPACE */}
            <div className="flex-1 flex flex-col h-full bg-white dark:bg-[#121214] rounded-3xl shadow-sm border border-zinc-200 dark:border-white/5 overflow-hidden transition-all duration-300 min-w-0">
                <div className="p-4 md:p-6 border-b border-zinc-100 dark:border-white/5 flex flex-col xl:flex-row xl:items-center justify-between gap-4 shrink-0 bg-zinc-50 dark:bg-[#18181b]">
                    <div>
                        <h2 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                            <MapPin className="h-5 w-5 text-emerald-500" /> {branchName}
                        </h2>
                        <p className="text-xs md:text-sm text-zinc-500 dark:text-zinc-400 mt-1">Live AI capacity and visual spot monitoring.</p>
                    </div>

                    <div className="flex bg-white dark:bg-black/40 p-1.5 rounded-xl border border-zinc-200 dark:border-white/5 shadow-sm overflow-x-auto custom-scrollbar">
                        {["All", "Free", "Reserved", "Occupied", "Conflict"].map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`flex-none px-3 md:px-4 py-2 rounded-lg text-[10px] md:text-xs font-bold uppercase tracking-wider transition-all outline-none whitespace-nowrap ${filter === f
                                    ? f === 'Conflict' ? 'bg-purple-600 text-white shadow-md'
                                        : f === 'Free' ? 'bg-emerald-500 text-white shadow-md'
                                            : f === 'Reserved' ? 'bg-yellow-400 text-zinc-900 shadow-md'
                                                : f === 'Occupied' ? 'bg-red-600 text-white shadow-md'
                                                    : 'bg-zinc-800 text-white shadow-md'
                                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5'
                                    }`}
                            >
                                {f} {f !== "All" && `(${f === 'Conflict' ? stats.conflicts : stats[f.toLowerCase()]})`}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex-1 p-4 md:p-6 overflow-y-auto overscroll-contain custom-scrollbar bg-zinc-50/50 dark:bg-[#09090b]">
                    {/* ✅ FLUID GRID: Uses auto-fill with a minimum size of 80px/100px. Never squishes, perfectly responsive! */}
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(80px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-3 md:gap-4 auto-rows-max">
                        {filteredSpots.map(spot => (
                            <button
                                key={spot.id}
                                onClick={() => setSelectedSpot(spot)}
                                className={`aspect-square rounded-2xl border-2 flex flex-col items-center justify-center gap-1 md:gap-2 transition-all outline-none active:scale-95 cursor-pointer relative
                                  ${getSpotStyles(spot)}
                                  ${selectedSpot?.id === spot.id ? 'ring-4 ring-blue-500/50 scale-105 shadow-xl z-20' : 'hover:scale-105 hover:shadow-lg'}
                                `}
                            >
                                {spot.waitingToMove && <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-white animate-ping"></div>}
                                <span className="font-mono font-black text-sm md:text-lg tracking-tighter">{spot.id}</span>
                                {spot.isConflict && <AlertTriangle className="h-5 w-5 md:h-6 md:w-6" />}
                                {!spot.isConflict && spot.status === "Reserved" && <Clock className="h-4 w-4 md:h-5 md:w-5 opacity-80" />}
                                {!spot.isConflict && spot.status === "Occupied" && <CarFront className="h-4 w-4 md:h-5 md:w-5 opacity-80" />}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* 2. SIDE PANEL (DESKTOP) / CENTERED MODAL (MOBILE) */}
            {selectedSpot && (
                <>
                    {/* Mobile Background Overlay */}
                    <div className="lg:hidden fixed inset-0 z-[7000] bg-zinc-900/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setSelectedSpot(null)} />

                    {/* ✅ RESPONSIVE CONTAINER: Centered Modal on mobile, Side Panel on Desktop */}
                    <div className="fixed inset-x-4 top-[5vh] bottom-[5vh] m-auto z-[7001] max-w-md lg:static lg:inset-auto lg:m-0 lg:z-auto lg:w-[360px] xl:w-[420px] lg:max-w-none lg:h-full bg-white dark:bg-[#121214] rounded-3xl shadow-2xl border border-zinc-200 dark:border-white/5 flex flex-col shrink-0 animate-in zoom-in-95 lg:zoom-in-100 lg:slide-in-from-right-8 duration-300 overflow-hidden">

                        {/* Premium Green Toast */}
                        {toastMessage && (
                            <div className="absolute top-20 left-4 right-4 bg-emerald-500 text-emerald-950 font-bold text-xs md:text-sm px-4 py-3 rounded-xl shadow-lg z-50 animate-in fade-in slide-in-from-top-4 flex items-center gap-2">
                                <CheckCircle className="h-5 w-5 shrink-0" /> <span className="leading-tight">{toastMessage}</span>
                            </div>
                        )}

                        <div className="p-5 md:p-6 border-b border-zinc-100 dark:border-white/5 flex items-center justify-between bg-zinc-50 dark:bg-[#18181b] rounded-t-3xl shrink-0">
                            <div className="flex items-center gap-3">
                                <div className={`h-10 w-10 rounded-xl flex items-center justify-center text-white shadow-inner ${selectedSpot.isConflict ? 'bg-purple-600' : selectedSpot.status === 'Free' ? 'bg-emerald-500' : selectedSpot.status === 'Reserved' ? 'bg-yellow-400 text-zinc-900' : 'bg-red-600'}`}>
                                    {selectedSpot.isConflict ? <ShieldAlert className="h-5 w-5" /> : <MapPin className="h-5 w-5" />}
                                </div>
                                <div>
                                    <h3 className="font-black text-lg md:text-xl text-zinc-900 dark:text-white leading-none">Spot {selectedSpot.id}</h3>
                                    <p className={`text-[10px] md:text-xs font-bold uppercase tracking-wider mt-1 ${selectedSpot.isConflict ? 'text-purple-600 dark:text-purple-400' : selectedSpot.status === 'Free' ? 'text-emerald-500' : selectedSpot.status === 'Reserved' ? 'text-yellow-600 dark:text-yellow-500' : 'text-red-500'}`}>
                                        {selectedSpot.isConflict ? "Squatter Conflict" : selectedSpot.status}
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setSelectedSpot(null)} className="p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-white/10 rounded-full transition-colors outline-none cursor-pointer">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-6 custom-scrollbar">

                            {/* CAMERA FEED */}
                            <div className="w-full aspect-video bg-black rounded-2xl border border-zinc-200 dark:border-white/10 shadow-inner relative overflow-hidden group">
                                <div className="absolute top-3 left-3 flex items-center gap-2 z-10">
                                    <div className="bg-black/60 backdrop-blur-md px-2 py-1 rounded-md text-[10px] font-bold text-white flex items-center gap-1.5">
                                        <div className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]"></div>
                                        LIVE CAM-04
                                    </div>
                                </div>

                                {selectedSpot.status === "Free" ? (
                                    <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600 bg-zinc-950">
                                        <Video className="h-8 w-8 mb-2 opacity-50" />
                                        <span className="text-xs font-medium tracking-wide uppercase">Spot is empty</span>
                                    </div>
                                ) : (
                                    <div className="w-full h-full relative">
                                        <img src="https://images.unsplash.com/photo-1590674899484-d5640e854abe?auto=format&fit=crop&q=80&w=800" alt="Live Car Feed" className="w-full h-full object-cover opacity-70 grayscale-[30%] contrast-125" />
                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                            <div className={`w-2/3 h-1/2 border-[3px] rounded-lg relative ${selectedSpot.isConflict ? 'border-purple-500/80' : 'border-emerald-500/50'}`}>
                                                <span className={`absolute -top-6 left-0 text-black text-[9px] md:text-[10px] font-bold px-1.5 py-0.5 rounded-t-md ${selectedSpot.isConflict ? 'bg-purple-500 text-white' : 'bg-emerald-500'}`}>
                                                    {selectedSpot.isConflict ? 'UNAUTHORIZED SQUATTER' : 'YOLOv8: VEHICLE 98%'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* SQUATTER CONFLICT (PURPLE UI) */}
                            {selectedSpot.isConflict && (
                                <div className="bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20 rounded-2xl p-4 md:p-5 animate-in fade-in zoom-in duration-300">
                                    <div className="flex items-center gap-2 mb-2 text-purple-700 dark:text-purple-400">
                                        <Megaphone className="h-5 w-5 shrink-0" />
                                        <span className="font-bold text-sm">Conflict: Squatter Detected</span>
                                    </div>

                                    <div className="mb-4 space-y-2">
                                        <div className="text-xs p-2 bg-purple-100 dark:bg-purple-500/20 text-purple-800 dark:text-purple-300 rounded border border-purple-200 dark:border-purple-500/30 break-words">
                                            <span className="font-black">RESERVED FOR:</span> {selectedSpot.expectedDriver?.name} (ETA: {selectedSpot.expectedDriver?.eta})
                                        </div>
                                    </div>

                                    {selectedSpot.waitingToMove ? (
                                        <div className="w-full bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 text-zinc-500 dark:text-zinc-400 py-3 rounded-xl flex items-center justify-center gap-2 text-xs font-medium text-center px-4 animate-pulse">
                                            <Video className="h-4 w-4 shrink-0 text-zinc-400" /> Awaiting camera confirmation of departure...
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            <p className="text-[11px] md:text-xs text-purple-900 dark:text-purple-300 font-medium">Unauthorized vehicle in reserved spot. Instruct driver to leave.</p>
                                            {/* Premium Red Action */}
                                            <button onClick={handleInstructToLeave} className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl shadow-lg active:scale-95 transition-all outline-none flex items-center justify-center gap-2 text-sm cursor-pointer">
                                                <Ban className="h-4 w-4" /> Instruct Driver to Leave
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* REGISTERED USER DATA */}
                            {selectedSpot.expectedDriver && !selectedSpot.isConflict && (
                                <div className="space-y-4 animate-in fade-in duration-300">
                                    <h4 className="text-[10px] md:text-xs font-black uppercase tracking-widest text-zinc-400 border-b border-zinc-100 dark:border-white/5 pb-2">User & Vehicle Data</h4>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center"><User className="h-5 w-5" /></div>
                                            <div>
                                                <p className="text-[9px] md:text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Driver</p>
                                                <p className="text-sm font-bold text-zinc-900 dark:text-white truncate max-w-[150px]">{selectedSpot.expectedDriver.name}</p>
                                            </div>
                                        </div>
                                        {selectedSpot.expectedDriver.phone && (
                                            <button className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center hover:scale-110 transition-transform outline-none cursor-pointer"><Smartphone className="h-4 w-4" /></button>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-1 gap-3">
                                        <div className="bg-zinc-50 dark:bg-white/5 p-3.5 rounded-xl border border-zinc-200 dark:border-white/5 flex justify-between items-center overflow-hidden">
                                            <span className="text-xs font-bold text-zinc-500 shrink-0">License Plate</span>
                                            <span className="font-mono font-bold text-sm text-zinc-900 dark:text-white bg-zinc-200 dark:bg-zinc-800 px-2 py-1 rounded truncate">{selectedSpot.actualPlate || selectedSpot.expectedDriver.plate}</span>
                                        </div>
                                        {selectedSpot.expectedDriver.eta && (
                                            <div className="bg-yellow-50 dark:bg-yellow-500/10 p-3.5 rounded-xl border border-yellow-200 dark:border-yellow-500/20 flex justify-between items-center mt-2">
                                                <span className="text-xs font-bold text-yellow-700 dark:text-yellow-500">Arrival ETA</span>
                                                <span className="font-bold text-yellow-700 dark:text-yellow-400 text-sm">{selectedSpot.expectedDriver.eta}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-5 md:p-6 border-t border-zinc-100 dark:border-white/5 bg-zinc-50 dark:bg-[#18181b] rounded-b-3xl shrink-0 flex flex-col gap-2">
                            {selectedSpot.status === "Free" ? (
                                <div className="w-full bg-zinc-100 dark:bg-white/5 text-zinc-500 dark:text-zinc-400 font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 text-xs text-center px-4">
                                    <Video className="h-4 w-4 shrink-0" /> Spot is empty and awaiting next vehicle.
                                </div>
                            ) : !selectedSpot.isConflict ? (
                                <div className="w-full bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 text-zinc-500 dark:text-zinc-400 py-3 rounded-xl flex items-center justify-center gap-2 text-xs font-medium text-center px-4">
                                    <Lock className="h-4 w-4 shrink-0 text-zinc-400" /> System will automatically clear this spot upon exit.
                                </div>
                            ) : null}
                        </div>

                    </div>
                </>
            )}

        </div>
    );
}
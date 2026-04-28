import React, { useState, useEffect } from "react";
import {
  MapPin, Clock, CheckCircle, AlertTriangle, FileText, Navigation,
  X, Wallet, PlusCircle, Loader2, Download, ExternalLink
} from "lucide-react";
import { useScroll } from "../../context/ScrollContext";
import { apiClient } from "../../api/apiClient";

const DRIVER_LOC = [8.9850, 38.7500];

const formatDate = (value) => {
  if (!value) return "--";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "--";
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const formatTime = (value) => {
  if (!value) return "--:--";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "--:--";
  return dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

function mapSessionToUI(session) {
  const durationSeconds = Number(session?.durationSeconds || 0);
  const depositAmount = Number(session?.depositAmount || 0);
  const parkingAmount = Number(session?.parkingAmount || 0);
  return {
    id: session?._id,
    spotId: session?.spotCode,
    location: session?.branchName,
    lat: 0,
    lon: 0,
    date: formatDate(session?.reservedAt),
    startTime: formatTime(session?.parkedAt),
    endTime: session?.exitedAt ? formatTime(session?.exitedAt) : "--:--",
    status: session?.state === "closed" ? "Completed" : "Expired",
    hours: Math.floor(durationSeconds / 3600),
    minutes: Math.floor((durationSeconds % 3600) / 60),
    seconds: durationSeconds % 60,
    deposit: depositAmount,
    cost: parkingAmount,
    walletRefund: depositAmount - parkingAmount,
    paymentMethod: session?.paymentMethod || "N/A",
  };
}

export default function DriverHistory() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [downloadStatus, setDownloadStatus] = useState(null); // null | 'downloading' | 'success'
  const [pendingMapRoute, setPendingMapRoute] = useState(null); // Controls the external navigation modal
  const { setScrolled } = useScroll();

  const handleScroll = (e) => setScrolled(e.target.scrollTop > 10);

  useEffect(() => () => setScrolled(false), [setScrolled]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErrorMessage("");
      try {
        const response = await apiClient.get("/sessions/my");
        const sessions = Array.isArray(response) ? response : [];
        if (!cancelled) setHistory(sessions.map(mapSessionToUI));
      } catch (error) {
        if (!cancelled) {
          setHistory([]);
          setErrorMessage(error?.message || "Failed to load session history.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = selectedReceipt || downloadStatus || pendingMapRoute ? "hidden" : "unset";
    return () => { document.body.style.overflow = "unset"; };
  }, [selectedReceipt, downloadStatus, pendingMapRoute]);

  const confirmOpenGoogleMaps = () => {
    if (pendingMapRoute) {
      const deepLink = `https://www.google.com/maps/dir/?api=1&origin=$$${DRIVER_LOC[0]},${DRIVER_LOC[1]}&destination=${pendingMapRoute.lat},${pendingMapRoute.lon}&travelmode=driving`;
      window.open(deepLink, "_blank", "noopener,noreferrer");
      setPendingMapRoute(null);
    }
  };

  // ✅ PREMIUM DOWNLOAD SIMULATION
  const handleDownload = () => {
    setDownloadStatus("downloading");

    // Simulate network delay
    setTimeout(() => {
      setDownloadStatus("success");

      // Auto-hide the success message after 2 seconds
      setTimeout(() => {
        setDownloadStatus(null);
      }, 2000);
    }, 2500);
  };

  // Helper to format duration like the Active Session screen (02 : 14 : 45)
  const formatDuration = (h, m, s) => {
    return `${h.toString().padStart(2, "0")} : ${m.toString().padStart(2, "0")} : ${s.toString().padStart(2, "0")}`;
  };

  const totalSpent = history.reduce((sum, session) => sum + Number(session.cost || 0), 0);
  const totalParkedSeconds = history.reduce(
    (sum, session) =>
      sum +
      (Number(session.hours || 0) * 3600 +
        Number(session.minutes || 0) * 60 +
        Number(session.seconds || 0)),
    0
  );
  const totalHours = Math.floor(totalParkedSeconds / 3600);
  const totalMinutes = Math.floor((totalParkedSeconds % 3600) / 60);

  return (
    <div className="relative h-[100dvh] w-full flex flex-col overflow-hidden bg-[#f4f4f5] dark:bg-[#09090b]">

      {/* ✅ SPACER: This pushes the scrolling container down past the fixed global Header.
        Because it is outside of the overflow container, the scrollbar track physically starts
        below this block, preventing it from sliding underneath the top navigation bar.
      */}
      <div className="h-20 md:h-24 w-full shrink-0" />

      {/* ✅ SCROLLING CONTAINER: Applied custom-scrollbar class here */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 pb-32 md:pb-40 overscroll-contain custom-scrollbar" onScroll={handleScroll}>

        {/* Added pt-4 here so the content doesn't sit flush against the invisible spacer boundary */}
        <div className="mx-auto max-w-md md:max-w-2xl lg:max-w-3xl flex flex-col gap-8 pt-4">

          {/* Top Summary Card */}
          <div className="w-full bg-white dark:bg-[#121214]/95 border border-zinc-200 dark:border-white/5 rounded-3xl p-6 md:p-8 lg:p-10 shadow-sm">
            <h2 className="text-xs md:text-sm lg:text-base font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-6 border-b border-zinc-100 dark:border-white/5 pb-4">This Month</h2>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-[10px] md:text-xs lg:text-sm text-zinc-500 dark:text-zinc-400 uppercase font-bold tracking-wider mb-1 flex items-center gap-1.5"><Wallet className="h-3.5 w-3.5 md:h-4 md:w-4" /> Total Spent</p>
                <p className="text-zinc-900 dark:text-white font-bold text-3xl md:text-4xl lg:text-5xl">{totalSpent} <span className="text-sm md:text-base lg:text-lg text-zinc-500 font-normal">ETB</span></p>
              </div>
              <div>
                <p className="text-[10px] md:text-xs lg:text-sm text-zinc-500 dark:text-zinc-400 uppercase font-bold tracking-wider mb-1 flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 md:h-4 md:w-4" /> Time Parked</p>
                <p className="text-zinc-900 dark:text-white font-bold text-3xl md:text-4xl lg:text-5xl">{totalHours}<span className="text-sm md:text-base lg:text-lg text-zinc-500 font-normal">h</span> {totalMinutes}<span className="text-sm md:text-base lg:text-lg text-zinc-500 font-normal">m</span></p>
              </div>
            </div>
          </div>

          {/* Recent Sessions List */}
          <div className="flex flex-col gap-4 lg:gap-5">
            <h2 className="text-xs md:text-sm lg:text-base font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mt-2 ml-2">Recent Sessions</h2>
            {loading && (
              <div className="w-full text-center text-zinc-500 dark:text-zinc-400 text-sm font-medium py-6">
                Loading session history...
              </div>
            )}
            {!loading && errorMessage && (
              <div className="w-full text-center text-red-600 dark:text-red-400 text-sm font-medium py-6">
                {errorMessage}
              </div>
            )}
            {!loading && !errorMessage && history.length === 0 && (
              <div className="w-full text-center text-zinc-500 dark:text-zinc-400 text-sm font-medium py-6">
                No session history found.
              </div>
            )}
            {history.map((session) => (
              <button
                key={session.id}
                type="button"
                onClick={(e) => { e.preventDefault(); setSelectedReceipt(session); }}
                className="w-full text-left bg-white dark:bg-[#121214]/95 border border-zinc-200 dark:border-white/5 rounded-3xl p-5 md:p-6 lg:p-8 shadow-sm transition-all cursor-pointer hover:bg-zinc-50 dark:hover:bg-white/5 active:scale-[0.98] outline-none focus:ring-2 focus:ring-emerald-500/50"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="min-w-0 pr-4">
                    <h3 className="text-zinc-900 dark:text-white font-bold text-base md:text-lg lg:text-xl truncate">Spot {session.spotId}</h3>
                    <p className="text-zinc-500 dark:text-zinc-400 text-xs md:text-sm lg:text-base mt-0.5 truncate">{session.location}</p>
                  </div>
                  <div className="shrink-0">
                    {session.status === "Completed" ? (
                      <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] md:text-xs lg:text-sm font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400"><CheckCircle className="h-3 w-3" /> Completed</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[10px] md:text-xs lg:text-sm font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400"><AlertTriangle className="h-3 w-3" /> Expired</span>
                    )}
                  </div>
                </div>
                <div className="flex justify-between items-end border-t border-zinc-100 dark:border-white/5 pt-4">
                  <div>
                    <p className="text-[10px] md:text-xs lg:text-sm text-zinc-500 dark:text-zinc-400 uppercase font-bold tracking-wider mb-0.5">{session.date}</p>
                    <p className="text-zinc-700 dark:text-zinc-300 text-xs md:text-sm lg:text-base font-medium">
                      {session.status === "Completed" ? `${session.startTime} - ${session.endTime}` : session.startTime}
                    </p>
                  </div>
                  <div>
                    {session.status === "Completed" ? (
                      <p className="text-emerald-600 dark:text-emerald-400 font-bold text-lg md:text-xl lg:text-2xl">{session.cost} ETB</p>
                    ) : (
                      <p className="text-amber-600 dark:text-amber-400 font-bold text-lg md:text-xl lg:text-2xl">{session.cost} ETB</p>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* --- RECEIPT MODAL --- */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-[9999] bg-zinc-900/60 dark:bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setSelectedReceipt(null)}>
          <div className="relative w-full max-w-sm md:max-w-md lg:max-w-lg bg-white dark:bg-[#121214] border border-zinc-200 dark:border-white/10 rounded-3xl shadow-2xl max-h-[85vh] flex flex-col animate-in zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center p-6 md:p-8 pb-4 border-b border-zinc-200 dark:border-white/10 shrink-0">
              <h2 className="text-xl md:text-2xl lg:text-3xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                {selectedReceipt.status === "Completed" ? (
                  <CheckCircle className="h-6 w-6 md:h-8 md:w-8 text-emerald-500" />
                ) : (
                  <AlertTriangle className="h-6 w-6 md:h-8 md:w-8 text-amber-500" />
                )}
                Digital Receipt
              </h2>
              <button type="button" onClick={(e) => { e.preventDefault(); setSelectedReceipt(null); }} className="h-8 w-8 md:h-10 md:w-10 flex items-center justify-center rounded-full bg-zinc-100 dark:bg-white/5 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-white/10 hover:text-zinc-900 dark:hover:text-white cursor-pointer outline-none active:scale-90 transition-transform"><X className="h-5 w-5 md:h-6 md:w-6" /></button>
            </div>

            <div className="overflow-y-auto p-6 md:p-8 flex-1 overscroll-contain custom-scrollbar">
              <p className="text-xs md:text-sm text-zinc-500 dark:text-zinc-400 text-center mb-6 font-mono tracking-wider">{selectedReceipt.id}</p>

              <div className="space-y-4 md:space-y-5">
                <div className="flex justify-between text-sm md:text-base lg:text-lg"><span className="text-zinc-500 dark:text-zinc-400">Location</span><span className="font-bold text-zinc-900 dark:text-white text-right">{selectedReceipt.location}</span></div>
                <div className="flex justify-between text-sm md:text-base lg:text-lg"><span className="text-zinc-500 dark:text-zinc-400">Spot ID</span><span className="font-bold text-zinc-900 dark:text-white">{selectedReceipt.spotId}</span></div>
                <div className="flex justify-between text-sm md:text-base lg:text-lg"><span className="text-zinc-500 dark:text-zinc-400">Date</span><span className="font-bold text-zinc-900 dark:text-white">{selectedReceipt.date}</span></div>

                {/* ✅ TIMING SECTION */}
                <div className="pt-4 border-t border-zinc-200 dark:border-white/10">
                  <div className="flex justify-between text-sm md:text-base lg:text-lg"><span className="text-zinc-500 dark:text-zinc-400">Entry Time</span><span className="font-bold text-zinc-900 dark:text-white">{selectedReceipt.startTime}</span></div>
                  <div className="flex justify-between text-sm md:text-base lg:text-lg mt-2"><span className="text-zinc-500 dark:text-zinc-400">Exit Time</span><span className="font-bold text-zinc-900 dark:text-white">{selectedReceipt.endTime}</span></div>

                  {/* Dynamic Duration Formatter */}
                  {selectedReceipt.status === "Completed" && (
                    <div className="flex justify-between items-center text-sm md:text-base lg:text-lg mt-3 pt-3 border-t border-zinc-100 dark:border-white/5">
                      <span className="text-zinc-500 dark:text-zinc-400">Total Duration</span>
                      <span className="font-bold text-zinc-900 dark:text-white font-mono tracking-wider">
                        {formatDuration(selectedReceipt.hours, selectedReceipt.minutes, selectedReceipt.seconds)}
                      </span>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-zinc-200 dark:border-white/10">
                  <div className="flex justify-between text-sm md:text-base lg:text-lg">
                    <span className="text-zinc-500 dark:text-zinc-400">Upfront Deposit</span>
                    <span className="font-bold text-zinc-900 dark:text-white">{selectedReceipt.deposit} ETB</span>
                  </div>
                  <div className="flex justify-between text-sm md:text-base lg:text-lg mt-2">
                    <span className="text-zinc-500 dark:text-zinc-400">
                      {selectedReceipt.status === "Completed" ? "Total Parking Cost" : "No-Show Penalty"}
                    </span>
                    <span className={`font-bold ${selectedReceipt.status === "Completed" ? "text-zinc-900 dark:text-white" : "text-amber-600 dark:text-amber-500"}`}>
                      - {selectedReceipt.cost} ETB
                    </span>
                  </div>
                </div>

                <div className="pt-4 border-t border-zinc-200 dark:border-white/10 flex justify-between items-center mt-2">
                  <span className="font-bold text-zinc-900 dark:text-white text-base md:text-lg">Refunded to Wallet</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 text-xl md:text-2xl flex items-center gap-1">
                    <PlusCircle className="h-5 w-5" /> {selectedReceipt.walletRefund} ETB
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-3 mt-6 lg:mt-8">
                <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20">
                  <div className="flex flex-col">
                    <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-500">Billed To Merchant</span>
                    <span className="text-sm md:text-base lg:text-lg font-bold text-zinc-900 dark:text-white">VisionPark System</span>
                  </div>
                  <CheckCircle className="h-5 w-5 md:h-6 md:w-6 text-emerald-500" />
                </div>

                <div className="bg-zinc-50 dark:bg-black/40 rounded-xl p-4 md:p-5 text-left border border-zinc-200 dark:border-white/5">
                  <p className="text-sm md:text-base lg:text-lg text-zinc-500 dark:text-zinc-400 mb-1 flex justify-between gap-4">
                    <span className="shrink-0">Paid From:</span> <span className="text-zinc-900 dark:text-white font-bold text-right truncate pl-2">{selectedReceipt.paymentMethod}</span>
                  </p>
                  <p className="text-sm md:text-base lg:text-lg text-zinc-500 dark:text-zinc-400 flex justify-between gap-4">
                    <span className="shrink-0">Time:</span> <span className="text-zinc-900 dark:text-white font-bold text-right">{selectedReceipt.status === "Completed" ? selectedReceipt.endTime : selectedReceipt.startTime}</span>
                  </p>
                </div>
              </div>

            </div>

            <div className="p-6 md:p-8 pt-2 border-t border-zinc-200 dark:border-white/10 shrink-0">
              <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); handleDownload(); }}
                  className="w-full sm:flex-1 h-12 md:h-14 flex items-center justify-center gap-2 rounded-xl border border-zinc-300 dark:border-white/10 text-zinc-700 dark:text-white font-bold text-sm md:text-base hover:bg-zinc-100 dark:hover:bg-white/5 active:scale-95 transition-all outline-none cursor-pointer"
                >
                  <FileText className="h-4 w-4 md:h-5 md:w-5" /> E-Receipt
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setPendingMapRoute({ lat: selectedReceipt.lat, lon: selectedReceipt.lon, name: selectedReceipt.location });
                  }}
                  className="w-full sm:flex-[2] h-12 md:h-14 flex items-center justify-center gap-2 rounded-xl bg-emerald-500 text-zinc-950 font-bold text-sm md:text-base hover:bg-emerald-400 active:scale-95 transition-all outline-none cursor-pointer shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                >
                  <Navigation className="h-4 w-4 md:h-5 md:w-5" /> Navigate to Lot
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── EXTERNAL MAP NAVIGATION MODAL ─────────────────────────────────── */}
      {pendingMapRoute && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-zinc-900/60 dark:bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white dark:bg-[#18181b] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 text-center">
              <div className="mx-auto w-16 h-16 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mb-4 shadow-inner">
                <Navigation className="h-8 w-8" />
              </div>
              <h3 className="font-bold text-xl text-zinc-900 dark:text-white mb-2">Leaving VisionPark</h3>
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-6">
                You are about to leave the VisionPark app to open Google Maps for directions to <strong className="text-zinc-900 dark:text-zinc-300">{pendingMapRoute.name}</strong>. Do you want to continue?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setPendingMapRoute(null)}
                  className="flex-1 py-3 rounded-xl font-bold text-sm bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-white/5 dark:hover:bg-white/10 dark:text-zinc-300 transition-colors outline-none cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmOpenGoogleMaps}
                  className="flex-1 py-3 rounded-xl font-bold text-sm bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 transition-all outline-none cursor-pointer flex items-center justify-center gap-2"
                >
                  Open Maps <ExternalLink className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ✅ PREMIUM DOWNLOADING MODAL */}
      {downloadStatus && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-900/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"></div>

          <div className="relative w-full max-w-xs bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-white/10 rounded-3xl shadow-2xl p-8 flex flex-col items-center gap-4 animate-in zoom-in-95 duration-300">
            {downloadStatus === 'downloading' ? (
              <>
                <div className="h-16 w-16 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center border border-emerald-100 dark:border-emerald-500/20 shadow-inner">
                  <Loader2 className="h-8 w-8 text-emerald-500 animate-spin" />
                </div>
                <div className="text-center">
                  <p className="text-zinc-900 dark:text-white font-bold text-lg">Downloading...</p>
                  <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">Preparing E-Receipt PDF</p>
                </div>
              </>
            ) : (
              <>
                <div className="h-16 w-16 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center border border-emerald-100 dark:border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.2)] animate-in zoom-in duration-300">
                  <Download className="h-8 w-8 text-emerald-500" />
                </div>
                <div className="text-center animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <p className="text-zinc-900 dark:text-white font-bold text-lg">Saved to Device</p>
                  <p className="text-emerald-600 dark:text-emerald-400 font-medium text-sm mt-1">Download Complete</p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
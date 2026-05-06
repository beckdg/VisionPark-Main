import React, { useState, useEffect } from "react";
import {
  Cctv, AlertTriangle, FileText, ShieldAlert,
  CheckCircle, Clock, Maximize2, Video, Camera,
  Activity, MapPin, ChevronRight, Share, Radar, X
} from "lucide-react";
import { apiClient } from "../../api/apiClient";

const CAMERA_BRANCHES = [
  {
    id: "br_01", name: "Adama Bus Terminal Parking", status: "Live",
    cameras: [{ id: "cam_1", name: "Main Gate Camera", zone: "Entry/Exit", status: "Live" }]
  },
  {
    id: "br_02", name: "Bole Airport Parking", status: "Live",
    cameras: [
      { id: "cam_2", name: "Terminal A Entry", zone: "Zone A", status: "Live" },
      { id: "cam_3", name: "Terminal B Exit", zone: "Zone B", status: "Live" },
      { id: "cam_4", name: "Premium Lot", zone: "VIP", status: "Offline" }
    ]
  },
  {
    id: "br_03", name: "Piazza Street Parking", status: "Offline",
    cameras: [{ id: "cam_5", name: "Street View 1", zone: "Street Level", status: "Offline" }]
  }
];

const SYSTEM_ALERTS = [
  { id: 1, type: "Camera Offline", branch: "Piazza Street Parking", camera: "Street View 1", time: "10 mins ago", status: "Active" },
  { id: 2, type: "Vehicle Overstay", branch: "Adama Bus Terminal", camera: "N/A", time: "25 mins ago", status: "Active" },
  { id: 3, type: "Capacity Near Full", branch: "Bole Airport Parking", camera: "N/A", time: "1 hour ago", status: "Acknowledged" },
  { id: 4, type: "LPR Mismatch", branch: "Bole Airport Parking", camera: "Terminal A Entry", time: "2 hours ago", status: "Resolved" },
];

export default function Operations() {
  const [activeTab, setActiveTab] = useState("incidents");
  const [expandedBranch, setExpandedBranch] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [debtRadar, setDebtRadar] = useState([]);
  const [incidentsLoading, setIncidentsLoading] = useState(true);

  // Modal state for viewing files
  const [evidenceModal, setEvidenceModal] = useState(null);
  const toDisplayDate = (isoOrDate) => {
    const d = new Date(isoOrDate);
    if (Number.isNaN(d.valueOf())) return "--";
    return d.toLocaleString();
  };

  // Pull incidents logged by attendants from backend.
  useEffect(() => {
    let cancelled = false;
    const loadReports = async () => {
      try {
        const data = await apiClient.get("/owner/operations/incidents");
        if (cancelled) return;
        setIncidents(Array.isArray(data?.incidents) ? data.incidents : []);
        setDebtRadar(Array.isArray(data?.debtRadar) ? data.debtRadar : []);
      } catch (err) {
        if (cancelled) return;
        console.error("Error loading incidents:", err);
        setIncidents([]);
        setDebtRadar([]);
      } finally {
        if (!cancelled) setIncidentsLoading(false);
      }
    };

    loadReports();
    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  void incidentsLoading;

  const handleDismissDebtRadar = (id) => {
    setDebtRadar(prev => prev.filter(d => d.id !== id));
  };

  const handleMarkResolved = async (inc) => {
    try {
      await apiClient.patch(`/owner/operations/incidents/${inc.id}/status`, { status: "resolved" });
    } catch (e) {
      console.error("Failed to persist resolved status:", e);
    }
    if (inc.isDebtRadar) {
      handleDismissDebtRadar(inc.id);
    } else {
      setIncidents(prev => prev.map(i => i.id === inc.id ? { ...i, status: "resolved", statusLabel: "Resolved" } : i));
    }
  };

  const handleForward = async (inc) => {
    try {
      await apiClient.patch(`/owner/operations/incidents/${inc.id}/status`, { status: "forwarded" });
    } catch (e) {
      console.error("Failed to persist forwarded status:", e);
    }
    if (inc.isDebtRadar) {
      setDebtRadar(prev => prev.map(i => i.id === inc.id ? { ...i, status: "forwarded", statusLabel: "Forwarded to Authority" } : i));
    } else {
      setIncidents(prev => prev.map(i => i.id === inc.id ? { ...i, status: "forwarded", statusLabel: "Forwarded to Authority" } : i));
    }
  };

  // ── Live Matrix ────────────────────────────────────────────────────────────
  const renderLiveMatrix = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 animate-in fade-in duration-300">
      {CAMERA_BRANCHES.map((branch) => {
        const isExpanded = expandedBranch === branch.id;
        const hasMultiple = branch.cameras.length > 1;
        return (
          <div key={branch.id} className={`bg-white dark:bg-[#121214] rounded-2xl border border-zinc-200 dark:border-white/5 shadow-sm overflow-hidden flex flex-col transition-all duration-300 ${isExpanded ? 'lg:col-span-2 xl:col-span-3' : ''}`}>
            <div className="p-4 border-b border-zinc-100 dark:border-white/5 flex items-center justify-between bg-zinc-50 dark:bg-white/5 cursor-pointer" onClick={() => hasMultiple && setExpandedBranch(isExpanded ? null : branch.id)}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${branch.status === 'Live' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400'}`}>
                  <Cctv className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                    {branch.name}
                    {hasMultiple && <span className="px-2 py-0.5 bg-zinc-200 dark:bg-white/10 text-zinc-600 dark:text-zinc-300 rounded-md text-[10px] uppercase tracking-wider">{branch.cameras.length} Cams</span>}
                  </h3>
                  <p className="text-xs text-zinc-500 flex items-center gap-1 mt-0.5">
                    <span className={`h-2 w-2 rounded-full ${branch.status === 'Live' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                    System {branch.status}
                  </p>
                </div>
              </div>
              {hasMultiple && (
                <button type="button" className="p-2 text-zinc-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition-colors outline-none">
                  {isExpanded ? <ChevronRight className="h-5 w-5 rotate-90 transition-transform" /> : <Maximize2 className="h-5 w-5" />}
                </button>
              )}
            </div>
            <div className={`p-4 grid gap-4 ${isExpanded ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1'}`}>
              {(isExpanded ? branch.cameras : [branch.cameras[0]]).map(cam => (
                <div key={cam.id} className="relative aspect-video bg-zinc-900 rounded-xl overflow-hidden group">
                  {cam.status === 'Live' ? (
                    <div className="absolute inset-0 flex items-center justify-center opacity-20 group-hover:opacity-50 transition-opacity">
                      <Cctv className="h-16 w-16 text-emerald-500" />
                    </div>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900/90 text-red-500">
                      <AlertTriangle className="h-10 w-10 mb-2" />
                      <span className="text-sm font-bold uppercase tracking-wider">Connection Lost</span>
                    </div>
                  )}
                  <div className="absolute top-0 left-0 right-0 p-3 bg-gradient-to-b from-black/80 to-transparent flex justify-between items-start">
                    <div>
                      <span className="text-xs font-bold text-white">{cam.name}</span>
                      <span className="text-[10px] text-zinc-300 uppercase tracking-wider block">{cam.zone}</span>
                    </div>
                    {cam.status === 'Live' && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 uppercase bg-black/50 px-2 py-1 rounded-md backdrop-blur-sm">
                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> REC
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );

  // ── System Health ──────────────────────────────────────────────────────────
  const renderSystemHealth = () => (
    <div className="bg-white dark:bg-[#121214] rounded-2xl border border-zinc-200 dark:border-white/5 shadow-sm overflow-hidden animate-in fade-in duration-300">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-white/10 text-xs uppercase tracking-wider text-zinc-500 bg-zinc-50 dark:bg-white/5">
              <th className="px-6 py-4 font-semibold">Alert Type</th>
              <th className="px-6 py-4 font-semibold">Location / Device</th>
              <th className="px-6 py-4 font-semibold">Time</th>
              <th className="px-6 py-4 font-semibold">Status</th>
              <th className="px-6 py-4 font-semibold text-right">Action</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {SYSTEM_ALERTS.map(alert => (
              <tr key={alert.id} className="border-b border-zinc-100 dark:border-white/5 last:border-0 hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors">
                <td className="px-6 py-4 font-bold text-zinc-900 dark:text-white">
                  <div className="flex items-center gap-2">
                    {alert.type.includes('Offline') ? <AlertTriangle className="h-4 w-4 text-red-500" /> : <Activity className="h-4 w-4 text-amber-500" />}
                    {alert.type}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="font-medium text-zinc-700 dark:text-zinc-300 block">{alert.branch}</span>
                  <span className="text-xs text-zinc-500">{alert.camera}</span>
                </td>
                <td className="px-6 py-4 text-zinc-500">{alert.time}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold ${alert.status === 'Active' ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400' :
                    alert.status === 'Acknowledged' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' :
                      'bg-zinc-100 text-zinc-700 dark:bg-white/10 dark:text-zinc-300'
                    }`}>{alert.status}</span>
                </td>
                <td className="px-6 py-4 text-right">
                  {alert.status === 'Active' && <button type="button" className="text-xs font-bold text-emerald-600 hover:text-emerald-500 outline-none">Acknowledge</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ── Incidents tab ──────────────────────────────────────────────────────────
  const renderIncidents = () => {

    const formattedDebtRadar = debtRadar.map(d => ({ ...d, isDebtRadar: true }));

    // FINAL Deduplication before rendering (Ensures no crashes)
    const uniqueCombinedMap = new Map();
    [...formattedDebtRadar, ...incidents].forEach(inc => {
      if (!uniqueCombinedMap.has(inc.id)) {
        uniqueCombinedMap.set(inc.id, inc);
      }
    });

    const combinedList = Array.from(uniqueCombinedMap.values());

    return (
      <div className="flex flex-col gap-6 animate-in fade-in duration-300">

        {/* --- INFORMATIVE GLANCE VIEW --- */}
        {debtRadar.length > 0 && (
          <div className="bg-red-50 dark:bg-red-500/5 border border-red-200 dark:border-red-500/20 rounded-2xl overflow-hidden">
            <div className="flex items-center gap-3 px-5 md:px-6 py-4 border-b border-red-200 dark:border-red-500/20 bg-red-100/50 dark:bg-red-500/10">
              <Radar className="h-5 w-5 text-red-500 shrink-0" />
              <div>
                <h3 className="font-black text-red-700 dark:text-red-400 text-sm uppercase tracking-wider">Debt Radar — Global Watchlist</h3>
                <p className="text-[10px] text-red-500/70 mt-0.5">{debtRadar.length} vehicle{debtRadar.length > 1 ? "s" : ""} flagged. Require action below.</p>
              </div>
            </div>

            <div className="p-4 md:p-5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {debtRadar.map(inc => (
                <div key={`glance-${inc.id}`} className="bg-white dark:bg-black/30 border border-red-200 dark:border-red-500/20 rounded-xl p-3 md:p-4 flex flex-col gap-2 min-w-0">

                  <div className="flex items-center justify-between gap-2 w-full min-w-0">
                    <span className="font-mono font-black text-xs md:text-sm text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-500/20 px-2 py-0.5 rounded tracking-widest truncate min-w-0">
                      {(Array.isArray(inc.plates) && inc.plates[0]) || inc.plate || "UNKNOWN"}
                    </span>
                    <span className="text-[10px] md:text-xs font-bold text-red-500 shrink-0 whitespace-nowrap">
                      {(inc.amount || inc.debtAmount)?.toFixed(2)} ETB
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-[10px] md:text-xs font-medium text-zinc-600 dark:text-zinc-400 min-w-0">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span className="truncate">{inc.branch || "Current Branch"}</span>
                  </div>

                  {(inc.details || inc.reason) && (
                    <p className="text-[10px] md:text-xs text-zinc-500 dark:text-zinc-400 line-clamp-1 italic min-w-0">
                      "{inc.details || inc.reason}"
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-2 mt-1 border-t border-red-100 dark:border-red-500/10 min-w-0 gap-2">
                    <span className="text-[9px] md:text-[10px] text-zinc-400 flex items-center gap-1 truncate">
                      <Clock className="h-2.5 w-2.5 shrink-0" />
                      <span className="truncate">{inc.time || inc.timeFlagged}</span>
                    </span>
                    <span className="text-[9px] md:text-[10px] font-bold text-red-400 animate-pulse shrink-0 whitespace-nowrap">
                      Action Required ↓
                    </span>
                  </div>

                </div>
              ))}
            </div>
          </div>
        )}

        {/* --- MAIN INCIDENTS LIST --- */}
        <div className="flex flex-col gap-4">
          {combinedList.length === 0 && (
            <div className="text-center py-16 text-zinc-400 text-sm font-medium">No incidents reported yet.</div>
          )}

          {combinedList.map(inc => {
            const isDamage = inc.category === 'Property Damage';
            const isDispute = inc.category === 'Customer Dispute';

            let badgeBg = "bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-500";
            if (isDamage) badgeBg = "bg-amber-100 dark:bg-[#452a0a] text-amber-800 dark:text-[#f59e0b]";
            if (isDispute) badgeBg = "bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-500";

            let statusPill = "border border-amber-200 dark:border-[#78350f] text-amber-700 dark:text-[#f59e0b]";
            if (inc.status === "forwarded") statusPill = "border border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-500";
            if (inc.status === "resolved") statusPill = "border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-500";

            // Determine Media Button State
            const hasMedia = inc.hasVideo || inc.hasPhoto || !!inc.file;
            let mediaIcon = <FileText className="h-4 w-4" />;
            let mediaText = "No Evidence Attached";

            if (hasMedia) {
              if (inc.hasVideo && inc.hasPhoto) {
                mediaIcon = <Video className="h-4 w-4" />;
                mediaText = "View Media (Video & Photo)";
              } else if (inc.hasVideo) {
                mediaIcon = <Video className="h-4 w-4" />;
                mediaText = "View Video Evidence";
              } else if (inc.hasPhoto) {
                mediaIcon = <Camera className="h-4 w-4" />;
                mediaText = "View Photo Evidence";
              } else {
                mediaIcon = <Camera className="h-4 w-4" />;
                mediaText = "View Evidence File";
              }
            }

            return (
              <div key={inc.id} className="bg-white dark:bg-[#121214] rounded-2xl border border-zinc-200 dark:border-white/5 shadow-sm p-5 md:p-6 flex flex-col md:flex-row gap-6 relative">

                {/* Left Side: Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-start justify-between gap-4 mb-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className={`text-[10px] md:text-xs font-black px-2 py-1 rounded-[4px] uppercase tracking-wider ${badgeBg}`}>
                        {inc.category}
                      </span>
                      <span className="text-xs text-zinc-500 font-mono tracking-widest">{inc.id}</span>
                    </div>
                    <span className={`px-4 py-1.5 rounded-full text-xs font-bold ${statusPill}`}>
                      {inc.statusLabel || (inc.status === "resolved" ? "Resolved" : inc.status === "forwarded" ? "Forwarded to Authority" : "Pending")}
                    </span>
                  </div>

                  <h3 className="text-lg md:text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2 mb-4">
                    <MapPin className="h-5 w-5 text-zinc-400 shrink-0" />
                    <span className="truncate">{inc.branch} ({inc.zone}, {inc.spot})</span>
                  </h3>

                  <div className="bg-zinc-100 dark:bg-[#18181b] p-4 rounded-xl mb-4 border border-zinc-200 dark:border-transparent">
                    <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 break-words">
                      "{inc.description}"
                    </p>
                    {inc.amount > 0 && (
                      <p className="text-sm font-black text-red-600 dark:text-red-400 mt-2">
                        Unpaid Debt: {inc.amount.toFixed(2)} ETB
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 mt-6">
                    <div>
                      <span className="block text-[10px] uppercase font-bold text-zinc-500 tracking-widest mb-1.5">Date/Time</span>
                      <span className="text-xs md:text-sm font-bold text-zinc-900 dark:text-white">{toDisplayDate(inc.createdAt || inc.date)}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase font-bold text-zinc-500 tracking-widest mb-1.5">Plates Involved</span>
                      <div className="flex flex-wrap gap-2">
                        {(Array.isArray(inc.plates) && inc.plates.length ? inc.plates : (inc.plate ? [inc.plate] : ["UNKNOWN"])).map(p => (
                          <span key={p} className="text-[11px] md:text-xs font-mono font-bold bg-zinc-200 dark:bg-[#18181b] text-zinc-900 dark:text-white px-2 py-1 rounded">
                            {p}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase font-bold text-zinc-500 tracking-widest mb-1.5">Reported By</span>
                      <span className="text-xs md:text-sm font-bold text-zinc-900 dark:text-white">{inc.attendantName}</span>
                    </div>
                  </div>
                </div>

                <div className="hidden md:block w-px bg-zinc-200 dark:bg-zinc-800" />

                {/* Right Side: Action Buttons */}
                <div className="w-full md:w-56 flex flex-col gap-3 shrink-0 border-t md:border-t-0 border-zinc-100 dark:border-white/5 pt-5 md:pt-0 pl-0 md:pl-4">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Actions</h4>

                  <button
                    type="button"
                    onClick={() => hasMedia && setEvidenceModal(inc)}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all outline-none border ${hasMedia ? 'bg-white hover:bg-zinc-50 border-zinc-300 text-zinc-900 dark:bg-[#18181b] dark:border-[#27272a] dark:hover:bg-[#27272a] dark:text-white cursor-pointer' : 'bg-zinc-50 border-zinc-200 text-zinc-400 dark:bg-black/30 dark:border-zinc-800 dark:text-zinc-600 cursor-not-allowed'}`}>
                    {mediaIcon} <span className="truncate">{mediaText}</span>
                  </button>

                  {inc.status !== 'resolved' && (
                    <div className="flex flex-col gap-3 mt-auto pt-4 md:pt-0">
                      <button
                        type="button"
                        onClick={() => handleForward(inc)}
                        className="w-full flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-3 rounded-xl text-sm font-bold transition-all outline-none">
                        <Share className="h-4 w-4" /> Forward to Authority
                      </button>

                      <button
                        type="button"
                        onClick={() => handleMarkResolved(inc)}
                        className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 px-4 py-3 rounded-xl text-sm font-bold transition-all outline-none">
                        <CheckCircle className="h-4 w-4" /> Mark Resolved
                      </button>
                    </div>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full flex flex-col gap-6 animate-in fade-in duration-500 relative">

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-zinc-900 dark:text-white tracking-tight">Operations Center</h1>
          <p className="text-sm md:text-base text-zinc-500 dark:text-zinc-400 mt-1">Real-time edge AI monitoring and operational workflows.</p>
        </div>
      </div>

      <div className="flex p-1 bg-zinc-200/50 dark:bg-[#121214] rounded-2xl w-full md:w-max border border-zinc-200 dark:border-white/5">
        {[
          { key: "matrix", label: "Live Matrix", Icon: Cctv },
          { key: "health", label: "System Health", Icon: Activity },
          {
            key: "incidents", label: "Incidents", Icon: FileText,
            badge: incidents.filter(i => i.status === "pending").length + debtRadar.length
          },
        ].map(({ key, label, Icon, badge }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex-1 md:flex-none relative flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all outline-none ${activeTab === key
              ? 'bg-white dark:bg-zinc-800 text-emerald-600 dark:text-emerald-400 shadow-sm'
              : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
              }`}
          >
            <Icon className="h-4 w-4" /> {label}
            {badge > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center">
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="mt-2">
        {activeTab === "matrix" && renderLiveMatrix()}
        {activeTab === "health" && renderSystemHealth()}
        {activeTab === "incidents" && renderIncidents()}
      </div>

      {/* ── EVIDENCE VIEW MODAL ── */}
      {evidenceModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setEvidenceModal(null)}>
          <div className="bg-white dark:bg-[#121214] rounded-2xl border border-zinc-200 dark:border-white/10 w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 md:p-5 border-b border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5">
              <h3 className="font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                {evidenceModal.hasVideo ? <Video className="h-5 w-5 text-blue-500" /> : <Camera className="h-5 w-5 text-emerald-500" />}
                Evidence Review: {evidenceModal.id}
              </h3>
              <button onClick={() => setEvidenceModal(null)} className="p-1.5 hover:bg-zinc-200 dark:hover:bg-white/10 rounded-lg transition-colors outline-none cursor-pointer">
                <X className="h-5 w-5 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white" />
              </button>
            </div>

            <div className="p-4 md:p-6 bg-zinc-100 dark:bg-black flex items-center justify-center min-h-[300px] max-h-[75vh] overflow-hidden">
              {evidenceModal.file && evidenceModal.file !== "MOCK_FILE_TOO_LARGE" ? (
                evidenceModal.file.startsWith('data:video') ? (
                  <video src={evidenceModal.file} controls autoPlay className="max-w-full max-h-[60vh] rounded-lg shadow-lg" />
                ) : (
                  <img src={evidenceModal.file} alt="Incident Evidence" className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-lg" />
                )
              ) : (
                <div className="text-zinc-500 flex flex-col items-center gap-3 text-center">
                  {evidenceModal.hasVideo ? <Video className="h-12 w-12 opacity-20" /> : <Camera className="h-12 w-12 opacity-20" />}
                  <div>
                    <p className="font-bold text-zinc-700 dark:text-zinc-300">Media Retrieved via Edge Node</p>
                    <p className="text-xs mt-1 max-w-sm">
                      Simulation: The {evidenceModal.hasVideo ? "Video" : "Photo"} file is securely stored on the local edge server. No file data was found in local storage cache.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
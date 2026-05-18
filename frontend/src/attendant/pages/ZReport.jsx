import React, { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
    Wallet, Clock, Banknote,
    CheckCircle, AlertTriangle, Calculator,
    LogOut, FileText, Lock,
    ReceiptText, Download, X
} from "lucide-react";
import { apiClient } from "../../api/apiClient";
import { useAuth } from "../../context/AuthContext";
import { generateZReportPdf } from "../utils/generateZReportPdf";

const formatShiftTime = (value) => {
    if (!value) return "--";
    const date = new Date(value);
    if (Number.isNaN(date.valueOf())) return "--";
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const formatReportDate = (value) => {
    if (!value) return new Date().toLocaleDateString();
    const date = new Date(value);
    if (Number.isNaN(date.valueOf())) return new Date().toLocaleDateString();
    return date.toLocaleDateString();
};

const mapWalkUpToLog = (walkUp) => ({
    id: walkUp?.id ?? "--",
    type: "Walk-Up Deposit",
    amount: Number(walkUp?.amount ?? 0),
    time: formatShiftTime(walkUp?.createdAt),
    plate: walkUp?.plateNumber ?? "--",
});

export default function Shift() {
    const navigate = useNavigate();
    const auth = useAuth();

    const [shiftState, setShiftState] = useState("loading");
    const [reportData, setReportData] = useState(null);
    const [actualCashInput, setActualCashInput] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isStartingShift, setIsStartingShift] = useState(false);
    const [zReport, setZReport] = useState(null);
    const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());
    const [isDownloading, setIsDownloading] = useState(false);
    const [toast, setToast] = useState({ message: "", type: "success" });
    const [loadError, setLoadError] = useState(null);
    const [pdfError, setPdfError] = useState("");

    const cancelledRef = useRef(false);

    const showToast = useCallback((message, type = "success") => {
        setToast({ message, type });
        const timer = setTimeout(() => setToast({ message: "", type: "success" }), 4000);
        return () => clearTimeout(timer);
    }, []);

    const loadCurrentShift = useCallback(async () => {
        setLoadError(null);
        try {
            const data = await apiClient.get("/attendant/shifts/current-z-report");
            if (cancelledRef.current) return;
            setReportData(data);
            setShiftState("active");
        } catch (error) {
            if (cancelledRef.current) return;
            const message = String(error?.message || "Failed to load shift data.");
            if (error?.code === "NOT_FOUND_ERROR" || /no active shift/i.test(message)) {
                setReportData(null);
                setShiftState("pre-shift");
                return;
            }
            setLoadError(message);
            setShiftState("pre-shift");
        }
    }, []);

    useEffect(() => {
        cancelledRef.current = false;
        loadCurrentShift();
        return () => {
            cancelledRef.current = true;
        };
    }, [loadCurrentShift]);

    useEffect(() => {
        if (shiftState !== "active" && shiftState !== "closing") return undefined;
        const timer = setInterval(() => {
            setCurrentTime(new Date().toLocaleTimeString());
        }, 1000);
        return () => clearInterval(timer);
    }, [shiftState]);

    const handleStartShift = async () => {
        setIsStartingShift(true);
        try {
            const data = await apiClient.post("/attendant/shifts/start", {});
            setReportData(data);
            setShiftState("active");
            showToast("Shift started. Register is open.");
        } catch (error) {
            showToast(error?.message || "Unable to start shift.", "error");
        } finally {
            setIsStartingShift(false);
        }
    };

    const handleInitiateClose = () => setShiftState("closing");

    const generateZReport = async () => {
        if (!actualCashInput) {
            showToast("Please enter the physical cash amount.", "error");
            return;
        }

        const actualCash = parseFloat(actualCashInput);
        if (!Number.isFinite(actualCash) || actualCash < 0) {
            showToast("Cash amount must be a valid non-negative number.", "error");
            return;
        }

        setIsSubmitting(true);
        try {
            const result = await apiClient.post("/attendant/shifts/close", {
                cashInHand: actualCash,
            });

            const reconciliation = result?.reconciliation ?? {};
            setZReport({
                id: result?.reportId ?? "--",
                date: formatReportDate(result?.generatedAt),
                startTime: formatShiftTime(result?.shift?.startedAt),
                endTime: formatShiftTime(result?.shift?.closedAt),
                branchName: result?.attendant?.branchName ?? reportData?.attendant?.branchName ?? "Branch",
                operatorName: result?.attendant?.name ?? reportData?.attendant?.name ?? "--",
                expected: Number(reconciliation?.expected ?? result?.totals?.expectedCashInHand ?? 0),
                actual: Number(reconciliation?.actual ?? result?.totals?.submittedCashInHand ?? actualCash),
                variance: Number(reconciliation?.variance ?? result?.totals?.cashDifference ?? 0),
                status: reconciliation?.status ?? "EXACT MATCH",
                transactions: Number(reconciliation?.cashTransactions ?? 0),
            });
            setShiftState("completed");
            showToast("Z-Report generated and shift closed.");
        } catch (error) {
            showToast(error?.message || "Failed to close shift.", "error");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSignOut = () => {
        auth.logout();
        navigate("/login", { replace: true });
    };

    const handleDismissCompleted = () => {
        setZReport(null);
        setReportData(null);
        setActualCashInput("");
        setShiftState("pre-shift");
    };

    const handleCancelZReport = () => {
        if (shiftState === "completed") return;
        setShiftState("active");
        setActualCashInput("");
        loadCurrentShift();
    };

    const executeDownloadPDF = async () => {
        if (!zReport) return;
        setPdfError("");
        setIsDownloading(true);
        try {
            await generateZReportPdf(zReport);
            showToast("Z-Report PDF saved.");
        } catch (error) {
            const message = error?.message || "Could not generate PDF. Try again.";
            setPdfError(message);
            showToast(message, "error");
        } finally {
            setIsDownloading(false);
        }
    };

    const shiftStartedAt = reportData?.shift?.startedAt;
    const branchName = reportData?.attendant?.branchName ?? "Branch";
    const attendantName = reportData?.attendant?.name ?? "--";
    const totals = reportData?.totals ?? {};
    const walkUpLogs = (reportData?.walkUps ?? []).map(mapWalkUpToLog);

    // ── LOADING ───────────────────────────────────────────────────────────────
    if (shiftState === "loading") {
        return (
            <div className="h-full w-full flex items-center justify-center p-6">
                <div className="text-center">
                    <div className="h-12 w-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-sm font-bold text-zinc-500 uppercase tracking-widest">Loading shift data...</p>
                </div>
            </div>
        );
    }

    // ── PRE-SHIFT ─────────────────────────────────────────────────────────────
    if (shiftState === "pre-shift") {
        return (
            <div className="h-full w-full flex items-center justify-center p-6 animate-in fade-in duration-500 relative">
                {toast.message && (
                    <div className={`fixed top-20 left-1/2 -translate-x-1/2 z-[8000] font-bold text-sm px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 ${toast.type === "error" ? "bg-red-600 text-white" : "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900"}`}>
                        {toast.type === "error" ? <AlertTriangle className="h-5 w-5 shrink-0" /> : <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />}
                        <span>{toast.message}</span>
                    </div>
                )}
                <div className="max-w-md w-full bg-white dark:bg-[#121214] rounded-3xl shadow-xl border border-zinc-200 dark:border-white/5 p-8 text-center flex flex-col items-center">
                    <div className="h-20 w-20 bg-emerald-50 dark:bg-emerald-500/10 rounded-full flex items-center justify-center mb-6">
                        <Clock className="h-10 w-10 text-emerald-500" />
                    </div>
                    <h2 className="text-3xl font-black text-zinc-900 dark:text-white mb-2">Start Your Shift</h2>
                    <p className="text-zinc-500 dark:text-zinc-400 font-medium mb-4">
                        Ensure your cash drawer is empty (0.00 ETB) before starting a new session.
                    </p>
                    {loadError && (
                        <p className="text-sm text-red-500 font-medium mb-4">{loadError}</p>
                    )}
                    <button
                        onClick={handleStartShift}
                        disabled={isStartingShift}
                        className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-70 text-emerald-950 font-black text-lg py-4 rounded-2xl shadow-lg shadow-emerald-500/20 active:scale-95 transition-all outline-none cursor-pointer"
                    >
                        {isStartingShift ? "Clocking In..." : "Clock In & Open Register"}
                    </button>
                </div>
            </div>
        );
    }

    // ── Z-REPORT — mounted via createPortal so it escapes the attendant layout
    if (shiftState === "completed" && zReport) {
        const isExact = zReport.variance === 0;
        const isShort = zReport.variance < 0;

        return createPortal(
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                <div className="max-w-md w-full bg-white dark:bg-[#18181b] rounded-2xl shadow-2xl flex flex-col border border-transparent dark:border-white/10 overflow-hidden max-h-[95dvh] overflow-y-auto custom-scrollbar">
                    <div className="bg-emerald-500 p-8 pt-10 flex flex-col items-center justify-center text-zinc-950 relative shrink-0">
                        <button
                            type="button"
                            onClick={handleDismissCompleted}
                            aria-label="Close report"
                            className="absolute top-4 right-4 h-9 w-9 rounded-full bg-zinc-950/15 hover:bg-zinc-950/25 text-zinc-950 flex items-center justify-center transition-colors outline-none cursor-pointer"
                        >
                            <X className="h-5 w-5" />
                        </button>
                        <h2 className="text-3xl font-black font-mono tracking-tight mb-1">VisionPark</h2>
                        <p className="font-bold text-xs opacity-80 uppercase tracking-widest mb-4">{zReport.branchName}</p>
                        <h1 className="text-xl font-black bg-white/20 px-4 py-2 rounded-lg tracking-widest uppercase shadow-sm">End of Shift Z-Report</h1>
                    </div>

                    <div className="p-8 pt-6 font-mono bg-zinc-50 dark:bg-[#121214] shrink-0">
                        <div className="space-y-2 text-sm font-bold text-zinc-500 dark:text-zinc-400 mb-6">
                            <div className="flex justify-between"><span>REPORT ID:</span> <span className="text-zinc-900 dark:text-white">{zReport.id}</span></div>
                            <div className="flex justify-between"><span>DATE:</span>      <span className="text-zinc-900 dark:text-white">{zReport.date}</span></div>
                            <div className="flex justify-between"><span>OPENED:</span>    <span className="text-zinc-900 dark:text-white">{zReport.startTime}</span></div>
                            <div className="flex justify-between"><span>CLOSED:</span>    <span className="text-zinc-900 dark:text-white">{zReport.endTime}</span></div>
                            <div className="flex justify-between"><span>OPERATOR:</span>  <span className="text-zinc-900 dark:text-white">{zReport.operatorName}</span></div>
                        </div>

                        <div className="border-t-2 border-dashed border-zinc-300 dark:border-zinc-700 pt-6 space-y-4 mb-6">
                            <div className="flex justify-between items-center text-sm font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                <span>CASH TRANSACTIONS</span>
                                <span className="text-zinc-900 dark:text-white">{zReport.transactions}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">SYSTEM EXPECTED</span>
                                <span className="text-xl font-black text-zinc-900 dark:text-white">{zReport.expected.toFixed(2)} ETB</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">DECLARED CASH</span>
                                <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">{zReport.actual.toFixed(2)} ETB</span>
                            </div>
                            <div className={`flex justify-between items-center text-xl font-black p-3 mt-4 rounded-lg border-2 ${isExact ? 'border-emerald-500 text-emerald-700 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400' : isShort ? 'border-red-500 text-red-700 bg-red-50 dark:bg-red-500/10 dark:text-red-400' : 'border-blue-500 text-blue-700 bg-blue-50 dark:bg-blue-500/10 dark:text-blue-400'}`}>
                                <span className="text-sm">VARIANCE</span>
                                <span>{zReport.variance > 0 ? '+' : ''}{zReport.variance.toFixed(2)} ETB</span>
                            </div>
                            <div className={`text-center font-black tracking-widest uppercase text-sm mt-4 ${isExact ? 'text-emerald-600 dark:text-emerald-500' : isShort ? 'text-red-600 dark:text-red-500' : 'text-blue-600 dark:text-blue-500'}`}>
                                *** {zReport.status} ***
                            </div>
                        </div>

                        <p className="text-[10px] text-zinc-400 dark:text-zinc-500 text-center font-bold uppercase tracking-widest mt-8">
                            Report automatically synced to Admin Ledger.
                        </p>
                    </div>

                    <div className="w-full h-3 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMiIgaGVpZ2h0PSIxMCI+PHBvbHlnb24gcG9pbnRzPSIwLDEwIDYsMCAxMiwxMCAxMiwxMCAwLDEwIiBmaWxsPSIjZjlmYWZiIi8+PC9zdmc+')] dark:bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMiIgaGVpZ2h0PSIxMCI+PHBvbHlnb24gcG9pbnRzPSIwLDEwIDYsMCAxMiwxMCAxMiwxMCAwLDEwIiBmaWxsPSIjMTIxMjE0Ii8+PC9zdmc+')] shrink-0" />

                    <div className="bg-zinc-100 dark:bg-[#18181b] p-4 flex flex-col gap-3 shrink-0">
                        {pdfError ? (
                            <p className="text-xs font-bold text-red-600 dark:text-red-400 text-center">{pdfError}</p>
                        ) : null}
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={executeDownloadPDF}
                                disabled={isDownloading}
                                className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-400 dark:disabled:bg-blue-800 text-white font-bold py-3.5 rounded-xl active:scale-95 transition-all outline-none flex items-center justify-center gap-1.5 cursor-pointer shadow-sm text-sm disabled:opacity-70"
                            >
                                <Download className={`h-4 w-4 ${isDownloading ? "animate-bounce" : ""}`} />
                                {isDownloading ? "Saving..." : "Save PDF"}
                            </button>
                            <button
                                type="button"
                                onClick={handleSignOut}
                                className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-3.5 rounded-xl active:scale-95 transition-all outline-none flex items-center justify-center gap-1.5 cursor-pointer shadow-sm text-sm"
                            >
                                <LogOut className="h-4 w-4" /> Sign Out
                            </button>
                        </div>
                    </div>
                </div>
            </div>,
            document.body
        );
    }

    // ── ACTIVE / CLOSING ──────────────────────────────────────────────────────
    return (
        <div className="h-full w-full flex flex-col xl:flex-row gap-6 animate-in fade-in duration-500 relative">
            {toast.message && (
                <div className={`fixed top-20 left-1/2 -translate-x-1/2 z-[8000] font-bold text-sm px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 ${toast.type === "error" ? "bg-red-600 text-white" : "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900"}`}>
                    {toast.type === "error" ? <AlertTriangle className="h-5 w-5 shrink-0" /> : <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />}
                    <span>{toast.message}</span>
                </div>
            )}

            <div className="flex-1 xl:max-w-[65%] flex flex-col gap-6">
                <div className="bg-white dark:bg-[#121214] rounded-3xl p-6 shadow-sm border border-zinc-200 dark:border-white/5 shrink-0 flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-black text-zinc-900 dark:text-white flex items-center gap-3">
                            <ReceiptText className="h-7 w-7 text-emerald-500" /> Shift Management
                        </h2>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                            {branchName} · Manage your active till and Z-Report closing.
                        </p>
                    </div>
                    <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-bold">
                        <CheckCircle className="h-5 w-5" /> Shift Active
                    </div>
                </div>

                <div className="flex-1 bg-white dark:bg-[#121214] rounded-3xl shadow-sm border border-zinc-200 dark:border-white/5 p-6 md:p-8 flex flex-col relative overflow-hidden">
                    {shiftState === "active" ? (
                        <div className="space-y-8 flex-1 animate-in fade-in zoom-in-95 duration-300">
                            <div className="flex items-center justify-between p-6 bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-white/10 rounded-2xl">
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-1">Shift Started</p>
                                    <p className="text-xl font-black text-zinc-900 dark:text-white">{formatShiftTime(shiftStartedAt)}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-1">Current Time</p>
                                    <p className="text-xl font-mono font-black text-emerald-600 dark:text-emerald-400">{currentTime}</p>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-500 border-b border-zinc-100 dark:border-white/5 pb-2">Shift Activity Summary</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5">
                                        <p className="text-xs font-bold text-zinc-500 mb-2">Total Walk-Ups</p>
                                        <p className="text-3xl font-black text-zinc-900 dark:text-white">{totals.totalWalkUps ?? 0}</p>
                                    </div>
                                    <div className="p-4 rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5">
                                        <p className="text-xs font-bold text-zinc-500 mb-2">Total Transactions</p>
                                        <p className="text-3xl font-black text-zinc-900 dark:text-white">{totals.totalTransactions ?? 0}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-auto pt-8">
                                <button onClick={handleInitiateClose}
                                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black text-lg py-5 rounded-2xl shadow-lg active:scale-95 transition-all outline-none flex items-center justify-center gap-3 cursor-pointer">
                                    <ReceiptText className="h-6 w-6" /> Generate Z-Report & Close Shift
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6 flex-1 animate-in slide-in-from-right-8 duration-300 flex flex-col justify-center max-w-sm mx-auto w-full">
                            <div className="text-center mb-4">
                                <div className="h-16 w-16 bg-blue-50 dark:bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-500">
                                    <Calculator className="h-8 w-8" />
                                </div>
                                <h3 className="text-2xl font-black text-zinc-900 dark:text-white mb-2">Z-Report Reconciliation</h3>
                                <p className="text-sm text-zinc-500 font-medium">Count the physical cash in your drawer and enter the exact total to finalize your Z-Read.</p>
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2 flex items-center gap-2">
                                    <Banknote className="h-4 w-4" /> Physical Cash Total (ETB)
                                </label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <span className="font-black text-zinc-400 dark:text-zinc-500 group-focus-within:text-emerald-500 transition-colors">ETB</span>
                                    </div>
                                    <input type="text" inputMode="decimal"
                                        value={actualCashInput}
                                        onChange={(e) => setActualCashInput(e.target.value.replace(/[^0-9.]/g, ''))}
                                        placeholder="0.00"
                                        className="w-full h-16 pl-16 pr-4 rounded-xl bg-zinc-50 dark:bg-black/40 border-2 border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white outline-none focus:bg-emerald-50 dark:focus:bg-emerald-500/10 focus:border-emerald-500 focus:shadow-[0_0_15px_rgba(16,185,129,0.15)] font-mono font-black text-2xl tracking-wider transition-all"
                                        autoFocus />
                                </div>
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button onClick={handleCancelZReport}
                                    disabled={isSubmitting}
                                    className="flex-1 py-4 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 rounded-xl font-bold transition-colors outline-none cursor-pointer shadow-sm active:scale-95 disabled:opacity-70">
                                    Cancel
                                </button>
                                <button onClick={generateZReport}
                                    disabled={isSubmitting || !actualCashInput}
                                    className="flex-[2] bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-300 dark:disabled:bg-zinc-800 disabled:text-zinc-500 text-emerald-950 font-black py-4 rounded-xl shadow-lg active:scale-95 transition-all outline-none flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70">
                                    {isSubmitting
                                        ? <span className="animate-pulse">Generating Z-Report...</span>
                                        : <><CheckCircle className="h-5 w-5" /> Submit & Close</>}
                                </button>
                            </div>
                            <div className="mt-4 p-4 rounded-xl bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 flex gap-3 text-xs font-medium text-zinc-500">
                                <Lock className="h-4 w-4 shrink-0 mt-0.5 text-zinc-400" />
                                <p>System expected totals are hidden for security. Variances will be logged automatically on the final report.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="w-full xl:w-[35%] h-[600px] xl:h-auto bg-white dark:bg-[#121214] rounded-3xl shadow-sm border border-zinc-200 dark:border-white/5 flex flex-col shrink-0">
                <div className="p-6 border-b border-zinc-100 dark:border-white/5 flex items-center justify-between shrink-0 bg-zinc-50 dark:bg-[#18181b] rounded-t-3xl">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-blue-500 flex items-center justify-center text-white shadow-inner">
                            <FileText className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="font-black text-xl text-zinc-900 dark:text-white leading-none">Recent Walk-Ups</h3>
                            <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 mt-1">This Session · {attendantName}</p>
                        </div>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3 custom-scrollbar">
                    {walkUpLogs.length === 0 ? (
                        <div className="text-center py-12">
                            <Wallet className="h-10 w-10 text-zinc-300 mx-auto mb-3" />
                            <p className="text-sm font-bold text-zinc-400">No walk-ups registered this shift yet.</p>
                        </div>
                    ) : (
                        walkUpLogs.map((log) => (
                            <div key={log.id} className="bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-white/5 p-4 rounded-2xl flex items-center justify-between hover:border-zinc-300 dark:hover:border-white/10 transition-colors">
                                <div>
                                    <span className="font-mono font-black text-sm text-zinc-900 dark:text-white">{log.plate}</span>
                                    <p className="text-[10px] font-bold text-zinc-500 uppercase mt-1">{log.type}</p>
                                    <p className="text-[10px] font-bold text-zinc-400 mt-1 flex items-center gap-1"><Clock className="h-3 w-3" /> {log.time}</p>
                                </div>
                                <div className="text-right">
                                    <span className="font-black text-emerald-600 dark:text-emerald-400">+{log.amount.toFixed(2)} ETB</span>
                                    <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider mt-1">{log.id}</p>
                                </div>
                            </div>
                        ))
                    )}
                    <div className="pt-4 text-center">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">End of recent logs</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

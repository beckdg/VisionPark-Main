import React, { useState } from "react";
import { createPortal } from "react-dom";
import { X, Download, Loader2, AlertTriangle } from "lucide-react";
import { generateZReportPdf } from "../../attendant/utils/generateZReportPdf";
import { mapOwnerShiftReportToReceipt } from "../utils/mapShiftReportToReceipt";

/**
 * Attendant-identical end-of-shift Z-Report receipt modal.
 * @param {object} apiReport — full owner API report (MongoDB shiftreports)
 */
export default function ShiftZReportReceiptModal({
  apiReport,
  loading,
  error,
  onClose,
}) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [pdfError, setPdfError] = useState("");

  if (!loading && !error && !apiReport) return null;

  const zReport = apiReport ? mapOwnerShiftReportToReceipt(apiReport) : null;
  const isExact = zReport ? zReport.variance === 0 : false;
  const isShort = zReport ? zReport.variance < 0 : false;

  const executeDownloadPDF = async () => {
    if (!zReport) return;
    setPdfError("");
    setIsDownloading(true);
    try {
      await generateZReportPdf(zReport);
    } catch (err) {
      setPdfError(err?.message || "Could not generate PDF.");
    } finally {
      setIsDownloading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="max-w-md w-full bg-white dark:bg-[#18181b] rounded-2xl shadow-2xl flex flex-col border border-transparent dark:border-white/10 overflow-hidden max-h-[95dvh] overflow-y-auto custom-scrollbar">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 p-8">
            <Loader2 className="h-10 w-10 animate-spin text-emerald-500" />
            <p className="text-sm font-bold text-zinc-500 uppercase tracking-widest">Loading Z-Report...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <AlertTriangle className="h-10 w-10 text-red-500 mx-auto mb-3" />
            <p className="text-sm font-bold text-red-600 dark:text-red-400 mb-4">{error}</p>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 font-bold text-sm"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <div className="bg-emerald-500 p-8 pt-10 flex flex-col items-center justify-center text-zinc-950 relative shrink-0">
              <button
                type="button"
                onClick={onClose}
                aria-label="Close report"
                className="absolute top-4 right-4 h-9 w-9 rounded-full bg-zinc-950/15 hover:bg-zinc-950/25 text-zinc-950 flex items-center justify-center transition-colors outline-none cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
              <h2 className="text-3xl font-black font-mono tracking-tight mb-1">VisionPark</h2>
              <p className="font-bold text-xs opacity-80 uppercase tracking-widest mb-4">{zReport.branchName}</p>
              <h1 className="text-xl font-black bg-white/20 px-4 py-2 rounded-lg tracking-widest uppercase shadow-sm">
                End of Shift Z-Report
              </h1>
            </div>

            <div className="p-8 pt-6 font-mono bg-zinc-50 dark:bg-[#121214] shrink-0">
              <div className="space-y-2 text-sm font-bold text-zinc-500 dark:text-zinc-400 mb-6">
                <div className="flex justify-between">
                  <span>REPORT ID:</span>
                  <span className="text-zinc-900 dark:text-white">{zReport.id}</span>
                </div>
                <div className="flex justify-between">
                  <span>DATE:</span>
                  <span className="text-zinc-900 dark:text-white">{zReport.date}</span>
                </div>
                <div className="flex justify-between">
                  <span>OPENED:</span>
                  <span className="text-zinc-900 dark:text-white">{zReport.startTime}</span>
                </div>
                <div className="flex justify-between">
                  <span>CLOSED:</span>
                  <span className="text-zinc-900 dark:text-white">{zReport.endTime}</span>
                </div>
                <div className="flex justify-between">
                  <span>OPERATOR:</span>
                  <span className="text-zinc-900 dark:text-white">{zReport.operatorName}</span>
                </div>
              </div>

              <div className="border-t-2 border-dashed border-zinc-300 dark:border-zinc-700 pt-6 space-y-4 mb-6">
                <div className="flex justify-between items-center text-sm font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  <span>CASH TRANSACTIONS</span>
                  <span className="text-zinc-900 dark:text-white">{zReport.transactions}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    SYSTEM EXPECTED
                  </span>
                  <span className="text-xl font-black text-zinc-900 dark:text-white">
                    {zReport.expected.toFixed(2)} ETB
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    DECLARED CASH
                  </span>
                  <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                    {zReport.actual.toFixed(2)} ETB
                  </span>
                </div>
                <div
                  className={`flex justify-between items-center text-xl font-black p-3 mt-4 rounded-lg border-2 ${
                    isExact
                      ? "border-emerald-500 text-emerald-700 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400"
                      : isShort
                        ? "border-red-500 text-red-700 bg-red-50 dark:bg-red-500/10 dark:text-red-400"
                        : "border-blue-500 text-blue-700 bg-blue-50 dark:bg-blue-500/10 dark:text-blue-400"
                  }`}
                >
                  <span className="text-sm">VARIANCE</span>
                  <span>
                    {zReport.variance > 0 ? "+" : ""}
                    {zReport.variance.toFixed(2)} ETB
                  </span>
                </div>
                <div
                  className={`text-center font-black tracking-widest uppercase text-sm mt-4 ${
                    isExact
                      ? "text-emerald-600 dark:text-emerald-500"
                      : isShort
                        ? "text-red-600 dark:text-red-500"
                        : "text-blue-600 dark:text-blue-500"
                  }`}
                >
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
                  onClick={onClose}
                  className="flex-1 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 font-bold py-3.5 rounded-xl active:scale-95 transition-all outline-none flex items-center justify-center gap-1.5 cursor-pointer shadow-sm text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}

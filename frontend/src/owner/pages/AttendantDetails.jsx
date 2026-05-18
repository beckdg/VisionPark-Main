import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Mail, Phone, MapPin, Clock, ShieldCheck,
  TrendingUp, Receipt, Users, Activity, AlertTriangle,
  FileText, X, Banknote, Wallet, CheckCircle, Loader2
} from "lucide-react";
import { apiClient } from "../../api/apiClient";

const formatEtb = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0.00";
  return n.toFixed(2);
};

const formatDateTime = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.valueOf())) return "—";
  return d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
};

const formatDate = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.valueOf())) return "—";
  return d.toLocaleDateString();
};

const Avatar = ({ name, src }) => {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className="h-20 w-20 md:h-24 md:w-24 rounded-2xl border-2 border-emerald-500/30 object-cover shadow-lg"
      />
    );
  }
  const initials = String(name || "?")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="h-20 w-20 md:h-24 md:w-24 rounded-2xl bg-emerald-500/15 border-2 border-emerald-500/30 flex items-center justify-center text-2xl font-black text-emerald-600 dark:text-emerald-400 shadow-lg">
      {initials}
    </div>
  );
};

const KpiCard = ({ icon: Icon, label, value, sub }) => (
  <div className="bg-white dark:bg-[#121214] rounded-2xl border border-zinc-200 dark:border-white/5 p-5 shadow-sm">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">{label}</p>
        <p className="text-2xl md:text-3xl font-black text-zinc-900 dark:text-white">{value}</p>
        {sub ? <p className="text-xs text-zinc-500 mt-1">{sub}</p> : null}
      </div>
      <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
        <Icon className="h-5 w-5" />
      </div>
    </div>
  </div>
);

const ShiftZReportModal = ({ report, loading, error, onClose }) => {
  if (!report && !loading) return null;

  const reconciliation = report?.reconciliation ?? {};
  const isExact = Number(reconciliation?.variance ?? 0) === 0;
  const isShort = Number(reconciliation?.variance ?? 0) < 0;

  return (
    <div className="fixed inset-0 z-[8000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-zinc-900/60 dark:bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white dark:bg-[#18181b] rounded-2xl shadow-2xl border border-zinc-200 dark:border-white/10 max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 dark:border-white/5 shrink-0">
          <div>
            <h3 className="text-lg font-black text-zinc-900 dark:text-white">Shift Z-Report</h3>
            <p className="text-xs text-zinc-500">{report?.branch?.name ?? "Branch"}</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-white/5 outline-none">
            <X className="h-5 w-5 text-zinc-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-6 custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
              <p className="text-sm font-bold text-zinc-500">Loading report...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <AlertTriangle className="h-10 w-10 text-red-500 mx-auto mb-3" />
              <p className="text-sm font-bold text-red-600 dark:text-red-400">{error}</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-zinc-500 font-bold uppercase text-[10px]">Opened</span><p className="font-mono font-bold">{formatDateTime(report?.shift?.startedAt)}</p></div>
                <div><span className="text-zinc-500 font-bold uppercase text-[10px]">Closed</span><p className="font-mono font-bold">{formatDateTime(report?.shift?.closedAt)}</p></div>
                <div><span className="text-zinc-500 font-bold uppercase text-[10px]">Duration</span><p className="font-bold">{report?.shift?.duration ?? "—"}</p></div>
                <div><span className="text-zinc-500 font-bold uppercase text-[10px]">Generated</span><p className="font-bold">{formatDateTime(report?.generatedAt)}</p></div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  ["Revenue", `${formatEtb(report?.totals?.totalRevenue)} ETB`],
                  ["Walk-Ups", report?.totals?.totalWalkUps ?? 0],
                  ["Transactions", report?.totals?.totalTransactions ?? 0],
                  ["Cash Diff", `${formatEtb(report?.totals?.cashDifference)} ETB`],
                ].map(([label, val]) => (
                  <div key={label} className="p-3 rounded-xl bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10">
                    <p className="text-[10px] font-bold uppercase text-zinc-500">{label}</p>
                    <p className="text-lg font-black text-zinc-900 dark:text-white mt-1">{val}</p>
                  </div>
                ))}
              </div>

              <div className="p-4 rounded-xl border border-zinc-200 dark:border-white/10 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Cash Reconciliation</h4>
                <div className="flex justify-between text-sm"><span className="text-zinc-500">Expected</span><span className="font-bold">{formatEtb(reconciliation?.expected)} ETB</span></div>
                <div className="flex justify-between text-sm"><span className="text-zinc-500">Submitted</span><span className="font-bold text-emerald-600">{formatEtb(reconciliation?.submitted)} ETB</span></div>
                <div className={`flex justify-between text-sm font-black p-3 rounded-lg ${isExact ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" : isShort ? "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400" : "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400"}`}>
                  <span>Variance</span>
                  <span>{Number(reconciliation?.variance) > 0 ? "+" : ""}{formatEtb(reconciliation?.variance)} ETB · {reconciliation?.status}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10">
                  <p className="text-[10px] font-bold uppercase text-zinc-500 flex items-center gap-1"><Banknote className="h-3 w-3" /> Cash Payments</p>
                  <p className="text-lg font-black mt-1">{formatEtb(report?.totals?.cashPaymentsTotal)} ETB</p>
                </div>
                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10">
                  <p className="text-[10px] font-bold uppercase text-zinc-500 flex items-center gap-1"><Wallet className="h-3 w-3" /> Digital Payments</p>
                  <p className="text-lg font-black mt-1">{formatEtb(report?.totals?.digitalPaymentsTotal)} ETB</p>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-3">Walk-Ups ({report?.walkUps?.length ?? 0})</h4>
                {(report?.walkUps ?? []).length === 0 ? (
                  <p className="text-sm text-zinc-400">No walk-ups in this shift.</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                    {report.walkUps.map((w) => (
                      <div key={w.id} className="flex justify-between items-center p-3 rounded-xl bg-zinc-50 dark:bg-black/20 border border-zinc-100 dark:border-white/5 text-sm">
                        <div>
                          <span className="font-mono font-bold">{w.plateNumber}</span>
                          <p className="text-[10px] text-zinc-500 uppercase mt-0.5">{w.paymentMethod} · {formatDateTime(w.createdAt)}</p>
                        </div>
                        <span className="font-black text-emerald-600">+{formatEtb(w.amount)} ETB</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-3">Transactions ({report?.transactions?.length ?? 0})</h4>
                {(report?.transactions ?? []).length === 0 ? (
                  <p className="text-sm text-zinc-400">No digital transactions in this shift.</p>
                ) : (
                  <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                    {report.transactions.map((t) => (
                      <div key={t.id} className="flex justify-between items-center p-3 rounded-xl bg-zinc-50 dark:bg-black/20 border border-zinc-100 dark:border-white/5 text-sm">
                        <div>
                          <span className="font-bold">{t.method}</span>
                          <p className="text-[10px] text-zinc-500 uppercase mt-0.5">{t.status} · {formatDateTime(t.completedAt)}</p>
                        </div>
                        <span className="font-black">{formatEtb(t.amount)} ETB</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default function AttendantDetails() {
  const { attendantId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [zReportId, setZReportId] = useState(null);
  const [zReport, setZReport] = useState(null);
  const [zReportLoading, setZReportLoading] = useState(false);
  const [zReportError, setZReportError] = useState(null);

  const loadDetails = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiClient.get(`/owner/attendants/${attendantId}`);
      setData(result);
    } catch (err) {
      setError(err?.message || "Failed to load attendant details.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [attendantId]);

  useEffect(() => {
    loadDetails();
  }, [loadDetails]);

  const openZReport = async (reportId) => {
    setZReportId(reportId);
    setZReport(null);
    setZReportError(null);
    setZReportLoading(true);
    try {
      const result = await apiClient.get(`/owner/shift-reports/${reportId}`);
      setZReport(result);
    } catch (err) {
      setZReportError(err?.message || "Failed to load Z-report.");
    } finally {
      setZReportLoading(false);
    }
  };

  const closeZReport = () => {
    setZReportId(null);
    setZReport(null);
    setZReportError(null);
  };

  if (loading) {
    return (
      <div className="w-full flex flex-col items-center justify-center min-h-[50vh] gap-4 animate-in fade-in">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-500" />
        <p className="text-sm font-bold uppercase tracking-widest text-zinc-500">Loading attendant profile...</p>
      </div>
    );
  }

  if (error || !data?.attendant) {
    return (
      <div className="w-full max-w-lg mx-auto text-center py-16 animate-in fade-in">
        <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-black text-zinc-900 dark:text-white mb-2">Unable to load attendant</h2>
        <p className="text-sm text-zinc-500 mb-6">{error || "Attendant not found."}</p>
        <button
          type="button"
          onClick={() => navigate("/owner/attendants")}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 text-zinc-950 font-bold"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Attendants
        </button>
      </div>
    );
  }

  const { attendant, stats, shifts, recentIncidents, operations } = data;
  const shiftStatusLabel =
    stats?.currentShiftStatus === "on_shift" ? "On Shift" : "Off Shift";

  return (
    <div className="w-full flex flex-col gap-6 animate-in fade-in slide-in-from-right-4 duration-500">
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #3f3f46; border-radius: 10px; }
        .custom-scrollbar { scrollbar-width: thin; scrollbar-color: #3f3f46 transparent; }
      `}</style>

      <button
        type="button"
        onClick={() => navigate("/owner/attendants")}
        className="inline-flex items-center gap-2 text-sm font-bold text-zinc-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors w-fit outline-none"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Attendant Management
      </button>

      {/* Profile */}
      <div className="bg-white dark:bg-[#121214] rounded-2xl border border-zinc-200 dark:border-white/5 shadow-sm p-6 md:p-8">
        <div className="flex flex-col md:flex-row gap-6 md:items-center">
          <Avatar name={attendant.fullName} src={attendant.profileImage} />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <h1 className="text-2xl md:text-3xl font-black text-zinc-900 dark:text-white">{attendant.fullName}</h1>
              <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${stats?.currentShiftStatus === "on_shift" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400" : "bg-zinc-100 text-zinc-600 dark:bg-white/10 dark:text-zinc-400"}`}>
                <Activity className="h-3 w-3 mr-1" /> {shiftStatusLabel}
              </span>
              <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-white/10 text-xs font-bold text-zinc-600 dark:text-zinc-300 capitalize">
                <ShieldCheck className="h-3 w-3 mr-1" /> {attendant.status}
              </span>
            </div>
            <p className="text-sm text-zinc-500 flex items-center gap-2 mb-4">
              <MapPin className="h-4 w-4 shrink-0" /> {attendant.branch?.name ?? "Unassigned"}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
              <span className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300"><Mail className="h-4 w-4 text-zinc-400" /> {attendant.email}</span>
              <span className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300"><Phone className="h-4 w-4 text-zinc-400" /> {attendant.phone || "—"}</span>
              {attendant.employeeId ? (
                <span className="font-mono text-zinc-600 dark:text-zinc-400">FAN: {attendant.employeeId}</span>
              ) : null}
              <span className="flex items-center gap-2 text-zinc-500"><Clock className="h-4 w-4" /> Joined {formatDate(attendant.joinedAt)}</span>
              {attendant.shiftStart && attendant.shiftEnd ? (
                <span className="text-zinc-500">Schedule: {attendant.shiftStart} – {attendant.shiftEnd}</span>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <KpiCard icon={TrendingUp} label="Total Revenue" value={`${formatEtb(stats?.totalRevenueGenerated)} ETB`} />
        <KpiCard icon={Receipt} label="Shifts Worked" value={stats?.totalShiftsWorked ?? 0} />
        <KpiCard icon={Wallet} label="Avg Shift Revenue" value={`${formatEtb(stats?.averageShiftRevenue)} ETB`} />
        <KpiCard icon={Users} label="Walk-Ups Registered" value={stats?.totalWalkUps ?? 0} />
        <KpiCard icon={Activity} label="Current Status" value={shiftStatusLabel} sub={stats?.lastActiveAt ? `Last active ${formatDateTime(stats.lastActiveAt)}` : null} />
        <KpiCard icon={CheckCircle} label="Conflicts Resolved" value={stats?.totalConflictsHandled ?? 0} />
      </div>

      {/* Shift history */}
      <div className="bg-white dark:bg-[#121214] rounded-2xl border border-zinc-200 dark:border-white/5 shadow-sm overflow-hidden">
        <div className="p-4 md:p-5 border-b border-zinc-100 dark:border-white/5 bg-zinc-50 dark:bg-white/5 flex items-center gap-2">
          <FileText className="h-4 w-4 text-zinc-500" />
          <h2 className="text-xs md:text-sm font-bold uppercase tracking-wider text-zinc-500">Shift History</h2>
        </div>
        {(shifts ?? []).length === 0 ? (
          <div className="p-12 text-center">
            <Receipt className="h-10 w-10 text-zinc-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-zinc-400">No closed shifts recorded yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[900px]">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-white/10 text-[10px] uppercase tracking-wider text-zinc-500">
                  <th className="px-4 py-3 font-semibold">Shift</th>
                  <th className="px-4 py-3 font-semibold">Duration</th>
                  <th className="px-4 py-3 font-semibold">Revenue</th>
                  <th className="px-4 py-3 font-semibold">Walk-Ups</th>
                  <th className="px-4 py-3 font-semibold">Cash Diff</th>
                  <th className="px-4 py-3 font-semibold text-right">Report</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {shifts.map((shift) => {
                  const diff = Number(shift.cashDifference ?? 0);
                  const diffClass =
                    diff === 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : diff < 0
                        ? "text-red-600 dark:text-red-400"
                        : "text-blue-600 dark:text-blue-400";
                  return (
                    <tr key={shift.id} className="border-b border-zinc-100 dark:border-white/5 hover:bg-zinc-50 dark:hover:bg-white/5">
                      <td className="px-4 py-4">
                        <p className="font-bold text-zinc-900 dark:text-white">{formatDateTime(shift.startedAt)}</p>
                        <p className="text-[10px] text-zinc-500">to {formatDateTime(shift.endedAt)}</p>
                      </td>
                      <td className="px-4 py-4 font-medium">{shift.duration}</td>
                      <td className="px-4 py-4 font-black">{formatEtb(shift.totalRevenue)} ETB</td>
                      <td className="px-4 py-4">{shift.totalWalkUps}</td>
                      <td className={`px-4 py-4 font-bold ${diffClass}`}>
                        {diff > 0 ? "+" : ""}{formatEtb(diff)} ETB
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => openZReport(shift.id)}
                          className="text-xs font-bold text-blue-600 hover:text-blue-500 dark:text-blue-400 outline-none"
                        >
                          View Z Report
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Operational insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-[#121214] rounded-2xl border border-zinc-200 dark:border-white/5 p-5 shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-4 flex items-center gap-2">
            <Activity className="h-4 w-4" /> Operational Summary
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-zinc-500">Spot management actions</span><span className="font-bold">{operations?.spotManagementActions ?? 0}</span></div>
            <div className="flex justify-between"><span className="text-zinc-500">Lifetime cash (shifts)</span><span className="font-bold">{formatEtb(operations?.paymentSummary?.cashPaymentsTotal)} ETB</span></div>
            <div className="flex justify-between"><span className="text-zinc-500">Lifetime digital (shifts)</span><span className="font-bold">{formatEtb(operations?.paymentSummary?.digitalPaymentsTotal)} ETB</span></div>
          </div>
        </div>

        <div className="bg-white dark:bg-[#121214] rounded-2xl border border-zinc-200 dark:border-white/5 p-5 shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-4 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> Recent Incidents
          </h3>
          {(recentIncidents ?? []).length === 0 ? (
            <p className="text-sm text-zinc-400">No incidents logged by this attendant.</p>
          ) : (
            <div className="space-y-2 max-h-52 overflow-y-auto custom-scrollbar">
              {recentIncidents.map((inc) => (
                <div key={inc.id} className="p-3 rounded-xl bg-zinc-50 dark:bg-black/20 border border-zinc-100 dark:border-white/5 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="font-bold">{inc.type}</span>
                    <span className="text-[10px] font-bold uppercase text-zinc-500">{inc.status}</span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-1 font-mono">{inc.plate} · {inc.branchName}</p>
                  <p className="text-[10px] text-zinc-400 mt-1">{formatDateTime(inc.createdAt)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {zReportId ? (
        <ShiftZReportModal
          report={zReport}
          loading={zReportLoading}
          error={zReportError}
          onClose={closeZReport}
        />
      ) : null}
    </div>
  );
}

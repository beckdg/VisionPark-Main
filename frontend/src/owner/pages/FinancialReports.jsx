/**
 * COMPONENT: FinancialReports
 * PURPOSE: Track parking revenue, platform fees, payment methods (Pie Chart), and dynamic revenue trends.
 */

import React, { useEffect, useState } from "react";
import {
  Banknote, Download, Calendar, TrendingUp,
  CreditCard, ChevronDown, Check, X, FileText,
  ArrowUpRight, Filter, Info
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, PieChart, Pie, Cell
} from "recharts";
import { apiClient } from "../../api/apiClient";

// --- DROPDOWNS DATA ---
const REGION_GROUPS = [
  { group: "NATIONAL", options: ["All Regions"] },
  { group: "FEDERAL CITIES", options: ["Addis Ababa", "Dire Dawa"] },
  { group: "MAJOR REGIONS", options: ["Oromia Region", "Amhara Region", "Tigray Region", "Somali Region", "Sidama Region"] }
];

const CITIES_BY_REGION = {
  "Addis Ababa": ["Addis Ababa"], "Dire Dawa": ["Dire Dawa"],
  "Oromia Region": ["Adama"], "Amhara Region": ["Bahir Dar"],
  "Tigray Region": ["Mekelle"], "Somali Region": ["Jigjiga"],
  "Sidama Region": ["Hawassa"], "All Regions": ["All Cities"]
};

const BRANCHES_BY_CITY = {
  "Addis Ababa": ["Bole Airport Parking", "Piazza Street Parking", "Meskel Square Parking"],
  "Adama": ["Adama Bus Terminal Parking", "Stadium Parking"],
  "Dire Dawa": ["Dire Dawa Central Parking"],
  "Bahir Dar": ["Bahir Dar Lake Parking"],
  "Mekelle": ["Mekelle City Parking"],
  "Jigjiga": ["Jigjiga Market Parking"],
  "Hawassa": ["Hawassa Park & Ride"],
  "All Cities": ["All Branches"]
};

// (Mock data removed: Financial Reports now fetches real data from the backend.)

// ── Moved outside component to prevent re-render flash ───────────────────────
const DropdownTrigger = ({ label, value, onClick, disabled }) => (
  <button type="button" onClick={onClick} disabled={disabled}
    className={`w-full min-w-0 flex items-center justify-between gap-2 bg-white dark:bg-[#121214] border border-zinc-200 dark:border-white/10 text-sm font-medium rounded-xl px-4 py-2.5 outline-none transition-all shadow-sm ${disabled ? "opacity-50 cursor-not-allowed text-zinc-500" : "text-zinc-900 dark:text-white hover:border-emerald-500 cursor-pointer"}`}>
    <span className="flex items-center gap-2 text-zinc-500 truncate">
      {label} <span className={`font-bold truncate ${disabled ? "text-zinc-500" : "text-zinc-900 dark:text-white"}`}>{value}</span>
    </span>
    <ChevronDown className="h-4 w-4 text-zinc-400 shrink-0" />
  </button>
);

export default function FinancialReports() {
  const [dateRange, setDateRange] = useState("This Month");
  const [region, setRegion] = useState("All Regions");
  const [city, setCity] = useState("All Cities");
  const [branch, setBranch] = useState("All Branches");
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [chartView, setChartView] = useState("daily");

  // --- LIVE DATA STATE (replaces mock data) ---
  const [transactions, setTransactions] = useState([]);
  const [summaryStats, setSummaryStats] = useState({ totalGross: 0, netEarnings: 0 });
  const [paymentBreakdown, setPaymentBreakdown] = useState([]);
  const [chartData, setChartData] = useState({ daily: [], weekly: [], monthly: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const formatCurrency = (num) =>
    new Intl.NumberFormat("en-ET", { style: "currency", currency: "ETB", minimumFractionDigits: 0 }).format(num);

  const buildScopeParams = () => {
    const params = new URLSearchParams();
    params.set("region", region);
    params.set("city", city);
    params.set("branch", branch);
    params.set("dateRange", dateRange);
    return params;
  };

  useEffect(() => {
    let cancelled = false;

    const fetchTransactionsAndAggregates = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = buildScopeParams();
        const data = await apiClient.get(`/transactions?${params.toString()}`);
        if (cancelled) return;

        const txs = Array.isArray(data) ? data : [];

        const normalizedTxs = txs.map((tx, idx) => ({
          id: String(tx?.id ?? tx?._id ?? idx),
          date: tx?.date ?? "--",
          plate: tx?.plate ?? "--",
          branch: tx?.branch ?? "--",
          duration: tx?.duration ?? "--",
          method: tx?.method ?? "--",
          status: tx?.status ?? "Pending",
          amount: Number(tx?.amount ?? 0),
        }));

        setTransactions(normalizedTxs);

        // Summary cards + payment breakdown are derived from "Completed" transactions.
        const completed = normalizedTxs.filter((tx) => String(tx?.status).toLowerCase() === "completed");
        const totalGross = completed.reduce((acc, tx) => acc + Number(tx?.amount ?? 0), 0);
        setSummaryStats({ totalGross, netEarnings: totalGross });

        const byMethod = new Map(); // method => amount
        for (const tx of completed) {
          const method = String(tx?.method ?? "--");
          byMethod.set(method, (byMethod.get(method) ?? 0) + Number(tx?.amount ?? 0));
        }

        const total = totalGross;
        const palette = ["#3b82f6", "#a855f7", "#f97316", "#eab308", "#10b981", "#ef4444", "#06b6d4", "#8b5cf6"];
        const entries = Array.from(byMethod.entries());

        setPaymentBreakdown(
          entries.map(([method, amount], i) => ({
            method,
            amount,
            percentage: total > 0 ? Math.round((amount / total) * 100) : 0,
            color: palette[i % palette.length],
          }))
        );
      } catch (e) {
        if (cancelled) return;
        // Fail silently (per requirement) but keep UI stable.
        console.error("FinancialReports transactions fetch failed:", e);
        setError(e);
        setTransactions([]);
        setSummaryStats({ totalGross: 0, netEarnings: 0 });
        setPaymentBreakdown([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchTransactionsAndAggregates();
    return () => {
      cancelled = true;
    };
  }, [region, city, branch, dateRange]);

  useEffect(() => {
    let cancelled = false;

    const fetchRevenueTrend = async () => {
      try {
        const params = buildScopeParams();
        params.set("range", chartView);
        const data = await apiClient.get(`/reports/revenue?${params.toString()}`);
        if (cancelled) return;

        setChartData((prev) => ({
          ...prev,
          [chartView]: Array.isArray(data) ? data : [],
        }));
      } catch (e) {
        if (cancelled) return;
        console.error("FinancialReports revenue trend fetch failed:", e);
        setChartData((prev) => ({
          ...prev,
          [chartView]: [],
        }));
      }
    };

    fetchRevenueTrend();
    return () => {
      cancelled = true;
    };
  }, [chartView, region, city, branch, dateRange]);

  // ── CUSTOM TOOLTIPS ───────────────────────────────────────────────────────
  // Same dark card base as Dashboard and Analytics.

  const tooltipCard = {
    backgroundColor: "#1c1c1f",
    border: "1px solid #3f3f46",
    borderRadius: "0.75rem",
    padding: "10px 14px",
    boxShadow: "0 10px 25px -5px rgba(0,0,0,0.4)",
  };
  const labelSt = { color: "#a1a1aa", fontWeight: 700, fontSize: 11, marginBottom: 4 };
  const valueSt = (color) => ({ color, fontWeight: 800, fontSize: 14 });

  // Revenue trend — always emerald to match the area stroke
  const RevenueTrendTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={tooltipCard}>
        <p style={labelSt}>{label}</p>
        <p style={valueSt("#34d399")}>{formatCurrency(payload[0].value)}</p>
      </div>
    );
  };

  // Payment methods — value color matches the exact pie slice being hovered
  const PaymentTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const item = payload[0].payload; // full PAYMENT_BREAKDOWN entry
    return (
      <div style={tooltipCard}>
        <p style={labelSt}>{item.method}</p>
        <p style={valueSt(item.color)}>{item.percentage}% — {formatCurrency(item.amount)}</p>
      </div>
    );
  };

  return (
    <div className="w-full flex flex-col gap-6 animate-in fade-in duration-500 relative pb-10">

      {/* ── HEADER ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-zinc-900 dark:text-white tracking-tight">Financial Reports</h1>
          <p className="text-sm md:text-base text-zinc-500 dark:text-zinc-400 mt-1">Track revenue, platform fees, and payment methods.</p>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" className="flex items-center justify-center gap-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-white/5 dark:hover:bg-white/10 text-zinc-900 dark:text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-colors outline-none cursor-pointer">
            <Download className="h-4 w-4" /> Export CSV
          </button>
          <button type="button" className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-emerald-500/20 transition-all outline-none cursor-pointer">
            <FileText className="h-4 w-4" /> Export PDF
          </button>
        </div>
      </div>

      {/* ── FILTERS ── */}
      <div className="bg-zinc-50/50 dark:bg-black/10 p-3 md:p-4 rounded-2xl border border-zinc-200 dark:border-white/5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-emerald-500" />
          <span className="text-xs font-bold uppercase text-zinc-500 tracking-wider">Report Scope</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 w-full">
          <DropdownTrigger label="Region:" value={region} onClick={() => setActiveDropdown("region")} />
          <DropdownTrigger label="City:" value={city} disabled={region === "All Regions"} onClick={() => setActiveDropdown("city")} />
          <DropdownTrigger label="Branch:" value={branch} disabled={city === "All Cities"} onClick={() => setActiveDropdown("branch")} />
          <DropdownTrigger label={<Calendar className="h-4 w-4" />} value={dateRange} onClick={() => setActiveDropdown("date")} />
        </div>
      </div>

      {/* ── SUMMARY CARDS ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <div className="bg-white dark:bg-[#121214] p-6 rounded-2xl border border-zinc-200 dark:border-white/5 shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -right-4 -top-4 h-24 w-24 bg-emerald-500/10 rounded-full blur-2xl" />
          <div className="flex justify-between items-start mb-4 relative z-10">
            <span className="text-sm font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Gross Revenue</span>
            <div className="p-2 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg"><Banknote className="h-5 w-5 text-emerald-500" /></div>
          </div>
          <div className="relative z-10">
            <span className="text-3xl md:text-4xl font-bold text-zinc-900 dark:text-white">{formatCurrency(summaryStats.totalGross)}</span>
            <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-bold mt-2">
              <ArrowUpRight className="h-3 w-3" /> +12.5% from last period
            </div>
          </div>
        </div>

        <div className="bg-emerald-500 p-6 rounded-2xl border border-emerald-400 shadow-lg shadow-emerald-500/20 flex flex-col justify-between text-zinc-950 relative overflow-hidden">
          <div className="absolute -right-4 -bottom-4 h-32 w-32 bg-white/20 rounded-full blur-2xl" />
          <div className="flex justify-between items-start mb-4 relative z-10">
            <span className="text-sm font-bold uppercase tracking-wider opacity-80">Net Earnings</span>
            <div className="p-2 bg-white/20 rounded-lg"><TrendingUp className="h-5 w-5" /></div>
          </div>
          <div className="relative z-10">
            <span className="text-3xl md:text-4xl font-black">{formatCurrency(summaryStats.netEarnings)}</span>
            <div className="flex items-center gap-1 opacity-90 text-xs font-bold mt-2">Ready for Withdrawal</div>
          </div>
        </div>
      </div>

      {/* ── CHARTS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">

        {/* Revenue Trend — Recharts AreaChart */}
        <div className="bg-white dark:bg-[#121214] p-6 rounded-2xl border border-zinc-200 dark:border-white/5 shadow-sm lg:col-span-2 flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <h2 className="text-base font-bold text-zinc-900 dark:text-white">Revenue Trend</h2>
            <div className="flex items-center bg-zinc-100 dark:bg-white/5 p-1 rounded-xl w-max">
              {["daily", "weekly", "monthly"].map(view => (
                <button key={view} type="button" onClick={() => setChartView(view)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold capitalize outline-none transition-colors cursor-pointer ${chartView === view ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm" : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"}`}>
                  {view}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 min-h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData[chartView] || []} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="financeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#52525b" opacity={0.2} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "#71717a", fontSize: 10, fontWeight: "bold" }}
                  axisLine={false}
                  tickLine={false}
                  dy={8}
                />
                <YAxis
                  tickFormatter={v => `${(v / 1000).toFixed(0)}k`}
                  tick={{ fill: "#71717a", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<RevenueTrendTooltip />} />
                <Area
                  type="monotone"
                  dataKey="etb"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fill="url(#financeGradient)"
                  dot={false}
                  activeDot={{ r: 5, fill: "#10b981" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Payment Methods — Recharts PieChart donut */}
        <div className="bg-white dark:bg-[#121214] p-6 rounded-2xl border border-zinc-200 dark:border-white/5 shadow-sm flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-base font-bold text-zinc-900 dark:text-white">Payment Methods</h2>
            <CreditCard className="h-5 w-5 text-zinc-400" />
          </div>

          <div className="flex-1 flex flex-col items-center justify-start gap-4">
            {/* Donut with centered icon */}
            <div className="relative w-[180px] h-[180px] flex items-center justify-center mx-auto">
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
                <CreditCard className="h-6 w-6 text-zinc-400 dark:text-zinc-500" />
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mt-1">Payments</span>
              </div>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius="65%"
                    outerRadius="88%"
                    paddingAngle={3}
                    dataKey="percentage"
                    stroke="none"
                    startAngle={90}
                    endAngle={-270}
                  >
                    {paymentBreakdown.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<PaymentTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Legend */}
            <div className="w-full flex flex-col gap-2">
              {paymentBreakdown.map((method) => (
                <div key={method.method} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: method.color }} />
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">{method.method}</span>
                  </div>
                  <span className="font-bold text-zinc-900 dark:text-white">{method.percentage}%</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 p-3 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-100 dark:border-white/5 flex gap-2 items-start">
            <Info className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
            <p className="text-[10px] text-zinc-500 leading-relaxed">
              <strong className="text-zinc-700 dark:text-zinc-300">VisionPark Wallet</strong> includes unused reservation penalties, under-utilization balances, and overpayments.
            </p>
          </div>
        </div>
      </div>

      {/* ── TRANSACTIONS TABLE ── */}
      <div className="bg-white dark:bg-[#121214] rounded-2xl border border-zinc-200 dark:border-white/5 shadow-sm overflow-hidden flex flex-col">
        <div className="p-5 border-b border-zinc-100 dark:border-white/5 bg-zinc-50 dark:bg-white/5 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
            <FileText className="h-4 w-4" /> Transaction Ledger
          </h2>
        </div>
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-white/10 text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                <th className="px-6 py-4 font-semibold">Transaction ID</th>
                <th className="px-6 py-4 font-semibold">Date & Time</th>
                <th className="px-6 py-4 font-semibold">Details</th>
                <th className="px-6 py-4 font-semibold">Method</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {loading ? (
                <tr className="border-b border-zinc-100 dark:border-white/5 last:border-0">
                  <td colSpan={6} className="px-6 py-6 text-center text-xs text-zinc-500">
                    Loading transactions...
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr className="border-b border-zinc-100 dark:border-white/5 last:border-0">
                  <td colSpan={6} className="px-6 py-6 text-center text-xs text-zinc-500">
                    No transactions found
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-zinc-100 dark:border-white/5 last:border-0 hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 font-mono font-medium text-zinc-600 dark:text-zinc-400">{tx.id}</td>
                    <td className="px-6 py-4 text-zinc-900 dark:text-white">{tx.date}</td>
                    <td className="px-6 py-4">
                      <span className="font-bold text-zinc-900 dark:text-white block">{tx.plate}</span>
                      <span className="text-xs text-zinc-500">{tx.branch} • {tx.duration}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-zinc-100 dark:bg-white/10 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                        {tx.method}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center gap-1">
                        <Check className="h-3 w-3" /> {tx.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-zinc-900 dark:text-white">
                      {formatCurrency(tx.amount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── DROPDOWN MODALS ── */}
      {activeDropdown && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-900/60 dark:bg-black/80 backdrop-blur-sm" onClick={() => setActiveDropdown(null)} />
          <div className="relative w-full max-w-md bg-white dark:bg-[#18181b] rounded-2xl shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-white/5 shrink-0">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
                Select {activeDropdown === "date" ? "Date Range" : activeDropdown === "region" ? "Region" : activeDropdown === "city" ? "City" : "Branch"}
              </h2>
              <button type="button" onClick={() => setActiveDropdown(null)} className="p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-md transition-colors outline-none cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-2 overflow-y-auto flex-1 custom-scrollbar">

              {activeDropdown === "date" && ["Today", "This Week", "This Month", "Last Month", "Year to Date"].map(opt => (
                <button type="button" key={opt} onClick={() => { setDateRange(opt); setActiveDropdown(null); }}
                  className="flex w-full px-4 py-3 rounded-xl text-sm font-medium justify-between hover:bg-zinc-50 dark:hover:bg-white/5 outline-none cursor-pointer text-zinc-700 dark:text-zinc-300">
                  {opt} {dateRange === opt && <Check className="h-4 w-4 text-emerald-500" />}
                </button>
              ))}

              {activeDropdown === "region" && REGION_GROUPS.map(group => (
                <div key={group.group} className="mb-2">
                  <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500">{group.group}</div>
                  <div className="flex flex-col gap-1">
                    {group.options.map(opt => (
                      <button type="button" key={opt}
                        onClick={() => { setRegion(opt); setCity(opt === "All Regions" ? "All Cities" : CITIES_BY_REGION[opt][0]); setBranch(opt === "All Regions" ? "All Branches" : (BRANCHES_BY_CITY[CITIES_BY_REGION[opt][0]]?.[0] || "All Branches")); setActiveDropdown(null); }}
                        className={`flex w-full px-4 py-3 rounded-xl text-sm font-medium justify-between outline-none cursor-pointer ${region === opt ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-white/5"}`}>
                        {opt} {region === opt && <Check className="h-4 w-4 text-emerald-500" />}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              {activeDropdown === "city" && (
                <div className="flex flex-col gap-1 mt-2">
                  <button type="button" onClick={() => { setCity("All Cities"); setBranch("All Branches"); setActiveDropdown(null); }}
                    className={`flex w-full px-4 py-3 rounded-xl text-sm font-medium justify-between outline-none cursor-pointer ${city === "All Cities" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-white/5"}`}>
                    All Cities {city === "All Cities" && <Check className="h-4 w-4 text-emerald-500" />}
                  </button>
                  {CITIES_BY_REGION[region]?.filter(c => c !== "All Cities").map(opt => (
                    <button type="button" key={opt} onClick={() => { setCity(opt); setBranch(BRANCHES_BY_CITY[opt]?.[0] || "All Branches"); setActiveDropdown(null); }}
                      className={`flex w-full px-4 py-3 rounded-xl text-sm font-medium justify-between outline-none cursor-pointer ${city === opt ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-white/5"}`}>
                      {opt} {city === opt && <Check className="h-4 w-4 text-emerald-500" />}
                    </button>
                  ))}
                </div>
              )}

              {activeDropdown === "branch" && (
                <div className="flex flex-col gap-1 mt-2">
                  <button type="button" onClick={() => { setBranch("All Branches"); setActiveDropdown(null); }}
                    className={`flex w-full px-4 py-3 rounded-xl text-sm font-medium justify-between outline-none cursor-pointer ${branch === "All Branches" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-white/5"}`}>
                    All Branches {branch === "All Branches" && <Check className="h-4 w-4 text-emerald-500" />}
                  </button>
                  {BRANCHES_BY_CITY[city]?.filter(b => b !== "All Branches").map(opt => (
                    <button type="button" key={opt} onClick={() => { setBranch(opt); setActiveDropdown(null); }}
                      className={`flex w-full px-4 py-3 rounded-xl text-sm font-medium justify-between outline-none cursor-pointer ${branch === opt ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-white/5"}`}>
                      {opt} {branch === opt && <Check className="h-4 w-4 text-emerald-500" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
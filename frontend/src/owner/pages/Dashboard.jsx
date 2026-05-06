/**
 * Component: Dashboard | Author: RobaByteNinja | Date: 2026-03-17
 *
 * COMPONENT: Dashboard
 * PURPOSE: Global network monitoring and aggregated statistics.
 *
 * ARCHITECTURE CONNECTIONS
 * Layer 5 (Presentation): React UI displaying aggregated system metrics and dynamic custom filters.
 * Layer 4 (Application): FastAPI calculates aggregated revenue, occupancy, and session data.
 * Layer 3 (AI Processing): AI events (vehicle detected) drive the occupancy metrics.
 * Layer 2 (Data Layer): Firebase Realtime Database acts as the source of truth for active sessions.
 * Layer 1 (Physical): Represents the global network of IP cameras updating spot statuses.
 */

import React, { useEffect, useState } from "react";
import {
  Car, CheckCircle, MapPin, TrendingUp,
  Calendar, Clock, Banknote, Filter, ChevronDown, X, Check
} from "lucide-react";
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip,
  AreaChart, Area, XAxis, YAxis, CartesianGrid
} from "recharts";
import { apiClient } from "../../api/apiClient";

// --- STRUCTURED DATA FOR CUSTOM DROPDOWNS ---
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
  "Dire Dawa": ["Dire Dawa Central Parking"],
  "Adama": ["Adama Bus Terminal Parking", "Stadium Parking"],
  "Bahir Dar": ["Lake Tana Parking"],
  "Mekelle": ["Mekelle City Parking"],
  "Jigjiga": ["Jigjiga Market Parking"],
  "Hawassa": ["Hawassa Park & Ride"],
  "All Cities": ["All Branches"]
};

export default function Dashboard() {
  const [region, setRegion] = useState("All Regions");
  const [city, setCity] = useState("All Cities");
  const [branch, setBranch] = useState("All Branches");
  const [activeDropdown, setActiveDropdown] = useState(null);

  // --- LIVE DASHBOARD DATA ---
  const [stats, setStats] = useState(null);
  const [occupancyData, setOccupancyData] = useState(null);
  const [revenueData, setRevenueData] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  const closeDropdown = () => setActiveDropdown(null);

  const handleRegionSelect = (selectedRegion) => {
    let nextCity = "All Cities";
    let nextBranch = "All Branches";
    if (selectedRegion !== "All Regions") {
      const cities = CITIES_BY_REGION[selectedRegion] || [];
      if (cities.length === 1) {
        nextCity = cities[0];
        const branches = BRANCHES_BY_CITY[nextCity] || [];
        if (branches.length === 1) nextBranch = branches[0];
      }
    }
    setRegion(selectedRegion);
    setCity(nextCity);
    setBranch(nextBranch);
    closeDropdown();
  };

  const handleCitySelect = (selectedCity) => {
    let nextBranch = "All Branches";
    if (selectedCity !== "All Cities") {
      const branches = BRANCHES_BY_CITY[selectedCity] || [];
      if (branches.length === 1) nextBranch = branches[0];
    }
    setCity(selectedCity);
    setBranch(nextBranch);
    closeDropdown();
  };

  const buildScopeParams = () => {
    const params = new URLSearchParams();
    if (region && region !== "All Regions") params.set("region", region);
    if (city && city !== "All Cities") params.set("city", city);
    if (branch && branch !== "All Branches") params.set("branch", branch);
    return params;
  };

  useEffect(() => {
    let cancelled = false;

    const safeGet = async (url) => {
      try {
        return await apiClient.get(url);
      } catch (error) {
        // Fail silently: the UI should still render with whatever data we have.
        console.error("Dashboard analytics request failed:", url, error);
        return null;
      }
    };

    (async () => {
      setLoading(true);

      const scopeParams = buildScopeParams();
      const scopeSuffix = scopeParams.toString() ? `?${scopeParams.toString()}` : "";

      const revenueParams = buildScopeParams();
      revenueParams.set("range", "today");
      const revenueSuffix = `?${revenueParams.toString()}`;

      const [dash, occ, rev, act] = await Promise.all([
        safeGet(`/analytics/owner/dashboard${scopeSuffix}`),
        safeGet(`/analytics/owner/occupancy${scopeSuffix}`),
        safeGet(`/analytics/owner/revenue${revenueSuffix}`),
        safeGet(`/analytics/owner/recent-activity${scopeSuffix}`),
      ]);

      if (cancelled) return;

      setStats(dash || null);

      if (Array.isArray(occ)) {
        setOccupancyData(
          occ.map((item) => ({
            name: item?.name,
            value: Number(item?.value ?? 0),
            color: item?.name === "Occupied" ? "#f59e0b" : "#10b981",
          }))
        );
      } else {
        setOccupancyData(null);
      }

      if (Array.isArray(rev)) {
        setRevenueData(
          rev.map((row) => ({
            hour: row?.hour,
            etb: Number(row?.etb ?? 0),
          }))
        );
      } else {
        setRevenueData([]);
      }

      if (Array.isArray(act)) {
        // Map backend analytics contract -> existing table row contract.
        setRecentActivity(
          act.map((row, idx) => ({
            id: row?.id ?? idx,
            plate: row?.plateNumber ?? "--",
            category: row?.vehicleCategory ?? "--",
            branch: row?.branchName ?? "--",
            entry: row?.entryTime ?? "--",
            exit: row?.exitTime ?? "--",
            duration: row?.duration ?? "--",
            payment: row?.paymentMethod ?? "--",
          }))
        );
      } else {
        setRecentActivity([]);
      }

      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [region, city, branch]);

  const occupiedValue =
    occupancyData?.find((d) => d?.name === "Occupied")?.value ?? 0;
  const availableValue =
    occupancyData?.find((d) => d?.name === "Available")?.value ?? 0;
  const totalSpots = occupiedValue + availableValue;
  const fullnessPct =
    totalSpots > 0 ? Math.round((occupiedValue / totalSpots) * 100) : 0;

  // ── CUSTOM TOOLTIPS ────────────────────────────────────────────────────────
  // Same dark card pattern as Analytics — value color matches the data slice/line.

  const tooltipCard = {
    backgroundColor: "#1c1c1f",
    border: "1px solid #3f3f46",
    borderRadius: "0.75rem",
    padding: "10px 14px",
    boxShadow: "0 10px 25px -5px rgba(0,0,0,0.4)",
  };
  const labelSt = { color: "#a1a1aa", fontWeight: 700, fontSize: 11, marginBottom: 4 };
  const valueSt = (color) => ({ color, fontWeight: 800, fontSize: 14 });

  // Donut tooltip — color matches the slice (amber for occupied, emerald for available)
  const OccupancyTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const item = payload[0];
    const color = item.name === "Occupied" ? "#fbbf24" : "#34d399";
    return (
      <div style={tooltipCard}>
        <p style={labelSt}>{item.name}</p>
        <p style={valueSt(color)}>{item.value} Spots</p>
      </div>
    );
  };

  // Revenue tooltip — always emerald to match the area line
  const RevenueTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={tooltipCard}>
        <p style={labelSt}>{label}</p>
        <p style={valueSt("#34d399")}>{payload[0].value.toLocaleString()} ETB</p>
      </div>
    );
  };

  const DropdownTrigger = ({ value, onClick, disabled }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center justify-between bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white text-sm font-medium rounded-xl px-4 py-3 outline-none transition-all ${disabled ? "opacity-50 cursor-not-allowed" : "hover:border-emerald-500 cursor-pointer"}`}
    >
      <span className="truncate pr-4">{value}</span>
      <ChevronDown className="h-5 w-5 text-zinc-400 shrink-0" />
    </button>
  );

  return (
    <div className="w-full flex flex-col gap-6 animate-in fade-in duration-500 relative pb-10">

      {/* ── HEADER + FILTERS ── */}
      <div className="flex flex-col gap-4 w-full">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-zinc-900 dark:text-white tracking-tight">System Dashboard</h1>
            <p className="text-sm md:text-base text-zinc-500 dark:text-zinc-400 mt-1">Real-time overview of your parking infrastructure.</p>
          </div>
          <div className="flex items-center gap-2 bg-white dark:bg-[#121214] px-4 py-2 rounded-xl border border-zinc-200 dark:border-white/5 shadow-sm shrink-0">
            <Calendar className="h-5 w-5 text-emerald-500" />
            <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Today, Oct 24</span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#121214] p-4 rounded-2xl border border-zinc-200 dark:border-white/5 shadow-sm w-full">
          <div className="flex items-center gap-2 mb-3 md:hidden">
            <Filter className="h-4 w-4 text-emerald-500" />
            <span className="text-xs font-bold uppercase text-zinc-500 tracking-wider">Filter Scope</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full">
            <DropdownTrigger value={region} onClick={() => setActiveDropdown("region")} />
            <DropdownTrigger value={city} disabled={region === "All Regions"} onClick={() => setActiveDropdown("city")} />
            <DropdownTrigger value={branch} disabled={city === "All Cities"} onClick={() => setActiveDropdown("branch")} />
          </div>
        </div>
      </div>

      {/* ── KPI CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <div className="bg-white dark:bg-[#121214] p-6 rounded-2xl border border-zinc-200 dark:border-white/5 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <span className="text-sm font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Active Sessions</span>
            <div className="p-2 bg-blue-50 dark:bg-blue-500/10 rounded-lg"><Car className="h-5 w-5 text-blue-500" /></div>
          </div>
          <span className="text-3xl font-bold text-zinc-900 dark:text-white">{stats?.activeSessions ?? 0}</span>
        </div>

        <div className="bg-white dark:bg-[#121214] p-6 rounded-2xl border border-zinc-200 dark:border-white/5 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <span className="text-sm font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Available Spots</span>
            <div className="p-2 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg"><CheckCircle className="h-5 w-5 text-emerald-500" /></div>
          </div>
          <span className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{stats?.availableSpots ?? 0}</span>
        </div>

        <div className="bg-white dark:bg-[#121214] p-6 rounded-2xl border border-zinc-200 dark:border-white/5 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <span className="text-sm font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Occupied Spots</span>
            <div className="p-2 bg-amber-50 dark:bg-amber-500/10 rounded-lg"><MapPin className="h-5 w-5 text-amber-500" /></div>
          </div>
          <span className="text-3xl font-bold text-amber-600 dark:text-amber-500">{stats?.occupiedSpots ?? 0}</span>
        </div>

        <div className="bg-white dark:bg-[#121214] p-6 rounded-2xl border border-zinc-200 dark:border-white/5 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <span className="text-sm font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Revenue Today</span>
            <div className="p-2 bg-indigo-50 dark:bg-indigo-500/10 rounded-lg"><Banknote className="h-5 w-5 text-indigo-500" /></div>
          </div>
          <span className="text-3xl font-bold text-zinc-900 dark:text-white">
            {Number(stats?.revenueToday ?? 0).toLocaleString()} <span className="text-lg font-medium text-zinc-500">ETB</span>
          </span>
        </div>
      </div>

      {/* ── CHARTS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">

        {/* Parking Occupancy — Recharts PieChart donut */}
        <div className="bg-white dark:bg-[#121214] p-6 rounded-2xl border border-zinc-200 dark:border-white/5 shadow-sm flex flex-col">
          <h2 className="text-base font-bold text-zinc-900 dark:text-white mb-4">Parking Occupancy</h2>

          <div className="flex-1 flex flex-col items-center justify-center min-h-[220px]">
            {/* Donut with centered label */}
            <div className="relative w-[180px] h-[180px] flex items-center justify-center mx-auto">
              {/* Centered text — sits above the SVG via absolute positioning */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
                <span className="text-3xl font-black text-zinc-900 dark:text-white">{totalSpots ? fullnessPct : 0}%</span>
                <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest mt-0.5">Full</span>
              </div>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={loading ? [] : (occupancyData || [])}
                    cx="50%"
                    cy="50%"
                    innerRadius="68%"
                    outerRadius="88%"
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                    startAngle={90}
                    endAngle={-270}
                  >
                    {(loading ? [] : occupancyData || []).map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<OccupancyTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-6 mt-4">
              <div className="flex items-center gap-2 text-sm">
                <div className="h-3 w-3 rounded-full bg-amber-500" />
                <span className="text-zinc-600 dark:text-zinc-400">Occupied ({occupiedValue})</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="h-3 w-3 rounded-full bg-emerald-500" />
                <span className="text-zinc-600 dark:text-zinc-400">Available ({availableValue})</span>
              </div>
            </div>
          </div>
        </div>

        {/* Revenue Per Hour — Recharts AreaChart */}
        <div className="bg-white dark:bg-[#121214] p-6 rounded-2xl border border-zinc-200 dark:border-white/5 shadow-sm lg:col-span-2 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-base font-bold text-zinc-900 dark:text-white">Revenue Per Hour</h2>
            <TrendingUp className="h-5 w-5 text-zinc-400" />
          </div>
          <div className="flex-1 min-h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={loading ? [] : revenueData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#52525b"
                  opacity={0.2}
                />
                <XAxis
                  dataKey="hour"
                  tick={{ fill: "#71717a", fontSize: 10, fontWeight: "bold" }}
                  axisLine={false}
                  tickLine={false}
                  dy={8}
                />
                <YAxis
                  tickFormatter={v => `${(v / 1000).toFixed(1)}k`}
                  tick={{ fill: "#71717a", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={<RevenueTooltip />}
                />
                <Area
                  type="monotone"
                  dataKey="etb"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fill="url(#revenueGradient)"
                  dot={false}
                  activeDot={{ r: 5, fill: "#10b981" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── RECENT ACTIVITY TABLE ── */}
      <div className="w-full">
        <div className="bg-white dark:bg-[#121214] p-6 rounded-2xl border border-zinc-200 dark:border-white/5 shadow-sm overflow-hidden flex flex-col w-full">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-base font-bold text-zinc-900 dark:text-white">Recent Activity</h2>
            <Clock className="h-5 w-5 text-zinc-400" />
          </div>
          <div className="overflow-x-auto flex-1 w-full custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-white/10 text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  <th className="pb-3 font-semibold">Plate Number</th>
                  <th className="pb-3 font-semibold">Category</th>
                  <th className="pb-3 font-semibold">Branch</th>
                  <th className="pb-3 font-semibold">Entry / Exit</th>
                  <th className="pb-3 font-semibold">Duration</th>
                  <th className="pb-3 font-semibold">Payment</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {recentActivity.map((session) => (
                  <tr key={session.id} className="border-b border-zinc-100 dark:border-white/5 last:border-0 hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors">
                    <td className="py-4 font-mono font-bold text-zinc-900 dark:text-white">{session.plate}</td>
                    <td className="py-4 text-zinc-600 dark:text-zinc-300">{session.category}</td>
                    <td className="py-4 text-zinc-700 dark:text-zinc-300 font-medium">{session.branch}</td>
                    <td className="py-4">
                      <div className="flex flex-col">
                        <span className="text-zinc-900 dark:text-white">{session.entry}</span>
                        <span className="text-xs text-zinc-500">{session.exit}</span>
                      </div>
                    </td>
                    <td className="py-4 font-medium text-zinc-700 dark:text-zinc-300">{session.duration}</td>
                    <td className="py-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-zinc-100 dark:bg-white/10 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                        {session.payment}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── DROPDOWN MODALS ── */}
      {activeDropdown && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-900/60 dark:bg-black/80 backdrop-blur-sm" onClick={closeDropdown} />
          <div className="relative w-full max-w-md bg-white dark:bg-[#18181b] rounded-2xl shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-white/5 shrink-0">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
                Select {activeDropdown === "region" ? "Region" : activeDropdown === "city" ? "City" : "Branch"}
              </h2>
              <button onClick={closeDropdown} className="p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-md transition-colors cursor-pointer outline-none">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-2 overflow-y-auto overscroll-contain flex-1 custom-scrollbar">

              {activeDropdown === "region" && REGION_GROUPS.map((group) => (
                <div key={group.group} className="mb-2">
                  <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500">{group.group}</div>
                  <div className="flex flex-col gap-1">
                    {group.options.map(opt => (
                      <button key={opt} onClick={() => handleRegionSelect(opt)}
                        className={`flex items-center justify-between w-full px-4 py-3 rounded-xl text-sm font-medium transition-colors outline-none cursor-pointer ${region === opt ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-white/5"}`}>
                        {opt} {region === opt && <Check className="h-4 w-4" />}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              {activeDropdown === "city" && (
                <div className="flex flex-col gap-1 mt-2">
                  <button onClick={() => handleCitySelect("All Cities")}
                    className={`flex items-center justify-between w-full px-4 py-3 rounded-xl text-sm font-medium transition-colors outline-none cursor-pointer ${city === "All Cities" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-white/5"}`}>
                    All Cities {city === "All Cities" && <Check className="h-4 w-4" />}
                  </button>
                  {CITIES_BY_REGION[region]?.filter(c => c !== "All Cities").map(opt => (
                    <button key={opt} onClick={() => handleCitySelect(opt)}
                      className={`flex items-center justify-between w-full px-4 py-3 rounded-xl text-sm font-medium transition-colors outline-none cursor-pointer ${city === opt ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-white/5"}`}>
                      {opt} {city === opt && <Check className="h-4 w-4" />}
                    </button>
                  ))}
                </div>
              )}

              {activeDropdown === "branch" && (
                <div className="flex flex-col gap-1 mt-2">
                  <button onClick={() => { setBranch("All Branches"); closeDropdown(); }}
                    className={`flex items-center justify-between w-full px-4 py-3 rounded-xl text-sm font-medium transition-colors outline-none cursor-pointer ${branch === "All Branches" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-white/5"}`}>
                    All Branches {branch === "All Branches" && <Check className="h-4 w-4" />}
                  </button>
                  {(BRANCHES_BY_CITY[city] || []).filter(c => c !== "All Branches").map(opt => (
                    <button key={opt} onClick={() => { setBranch(opt); closeDropdown(); }}
                      className={`flex items-center justify-between w-full px-4 py-3 rounded-xl text-sm font-medium transition-colors outline-none cursor-pointer ${branch === opt ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-white/5"}`}>
                      {opt} {branch === opt && <Check className="h-4 w-4" />}
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
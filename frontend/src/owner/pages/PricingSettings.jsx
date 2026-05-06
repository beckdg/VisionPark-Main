/**
 * COMPONENT: PricingSettings
 * PURPOSE: Branch-specific configuration for hourly rates and overstay penalty multipliers (backed by API + MongoDB).
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Save, ShieldAlert, Car, CheckCircle,
  ChevronDown, ChevronUp, Check, X, MapPin, Calculator, Clock,
} from "lucide-react";
import { apiClient } from "../../api/apiClient";

const FALLBACK_VEHICLE_GROUPS = [
  {
    group: "Public Transport",
    items: [
      "Public Transport Vehicles | Upto 12 Seats",
      "Public Transport Vehicles | 13-24 Seats",
      "Public Transport Vehicles | 25 Seats and above",
    ],
  },
  {
    group: "Two Wheelers",
    items: ["Bicycle | Bicycle", "Motorcycle | Motorcycle"],
  },
  {
    group: "Dry Freight",
    items: [
      "Dry Freight Vehicles | <35 Quintal",
      "Dry Freight Vehicles | 36-70 Quintal",
      "Dry Freight Vehicles | >71 Quintal",
    ],
  },
  {
    group: "Liquid Cargo",
    items: [
      "Liquid Cargo Vehicles | Upto 28 Liter",
      "Liquid Cargo Vehicles | Above 28 Liter",
    ],
  },
  {
    group: "Machineries",
    items: [
      "Machineries | Upto 5000KG weight",
      "Machineries | 5001-10,000KG weight",
      "Machineries | Above 10,001KG weight",
    ],
  },
];

const DropdownTrigger = ({ label, value, onClick, disabled }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`w-full min-w-0 flex items-center justify-between gap-2 bg-white dark:bg-[#121214] border border-zinc-200 dark:border-white/10 text-sm font-medium rounded-xl px-4 py-2.5 outline-none transition-all shadow-sm ${disabled ? "opacity-50 cursor-not-allowed text-zinc-500" : "text-zinc-900 dark:text-white hover:border-emerald-500 cursor-pointer"}`}
  >
    <span className="flex items-center gap-2 text-zinc-500 truncate">
      {label}{" "}
      <span className={`font-bold truncate ${disabled ? "text-zinc-500" : "text-zinc-900 dark:text-white"}`}>
        {value}
      </span>
    </span>
    <ChevronDown className="h-4 w-4 text-zinc-400 shrink-0" />
  </button>
);

export default function PricingSettings() {
  const [ownerLots, setOwnerLots] = useState([]);
  const [vehicleGroups, setVehicleGroups] = useState(FALLBACK_VEHICLE_GROUPS);
  const [loadError, setLoadError] = useState(null);
  const [configLoading, setConfigLoading] = useState(false);

  const [region, setRegion] = useState("All Regions");
  const [city, setCity] = useState("All Cities");
  const [branchLabel, setBranchLabel] = useState("All Branches");
  const [selectedLotId, setSelectedLotId] = useState(null);
  const [activeDropdown, setActiveDropdown] = useState(null);

  const [rates, setRates] = useState({});
  const [multiplier, setMultiplier] = useState("1.75");

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const allCategories = useMemo(() => vehicleGroups.flatMap((g) => g.items), [vehicleGroups]);

  const regions = useMemo(() => {
    const u = [...new Set(ownerLots.map((l) => l.region).filter(Boolean))].sort();
    return ["All Regions", ...u];
  }, [ownerLots]);

  const citiesForRegion = useMemo(() => {
    if (region === "All Regions") return ["All Cities"];
    const u = [...new Set(ownerLots.filter((l) => l.region === region).map((l) => l.city).filter(Boolean))].sort();
    return ["All Cities", ...u];
  }, [ownerLots, region]);

  const lotsForCity = useMemo(() => {
    if (region === "All Regions" || city === "All Cities") return [];
    return ownerLots
      .filter((l) => l.region === region && l.city === city)
      .slice()
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  }, [ownerLots, region, city]);

  const fetchConfigForLot = useCallback(
    async (lotId) => {
      if (!lotId) return;
      setConfigLoading(true);
      setLoadError(null);
      try {
        const data = await apiClient.get(`/pricing/config?lotId=${encodeURIComponent(lotId)}`);
        const nextRates = data?.rates && typeof data.rates === "object" ? data.rates : {};
        setRates(nextRates);
        const m = data?.overstayMultiplier;
        setMultiplier(m !== undefined && m !== null ? String(m) : "1.75");
      } catch (e) {
        console.error(e);
        setLoadError(e?.message || "Failed to load pricing for this branch.");
        setRates({});
      } finally {
        setConfigLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [lots, cats] = await Promise.all([
          apiClient.get("/parking/lots"),
          apiClient.get("/pricing/vehicle-categories").catch(() => null),
        ]);
        if (cancelled) return;
        setOwnerLots(Array.isArray(lots) ? lots : []);
        if (cats?.groups && Array.isArray(cats.groups) && cats.groups.length) {
          setVehicleGroups(cats.groups);
        }
      } catch (e) {
        if (!cancelled) {
          console.error(e);
          setLoadError(e?.message || "Failed to load parking lots.");
          setOwnerLots([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (selectedLotId) {
      void fetchConfigForLot(selectedLotId);
    }
  }, [selectedLotId, fetchConfigForLot]);

  const handleRateChange = (category, newVal) => {
    setRates((prev) => ({
      ...prev,
      [category]: newVal === "" ? "" : parseFloat(newVal),
    }));
  };

  const adjustMultiplier = (amount) => {
    setMultiplier((prev) => {
      const current = parseFloat(prev || 1);
      const next = Math.max(1, (Number.isFinite(current) ? current : 1) + amount);
      return next.toFixed(2);
    });
  };

  const handleSave = async () => {
    if (!selectedLotId) return;
    const mult = parseFloat(multiplier);
    if (!Number.isFinite(mult) || mult < 1) {
      alert("Overstay multiplier must be at least 1.");
      return;
    }
    const payloadRates = {};
    for (const cat of allCategories) {
      const raw = rates[cat];
      const n = raw === "" || raw === undefined || raw === null ? 0 : Number(raw);
      if (!Number.isFinite(n) || n < 0) {
        alert(`Invalid rate for: ${cat}`);
        return;
      }
      payloadRates[cat] = n;
    }

    setIsSaving(true);
    setSaveSuccess(false);
    setLoadError(null);
    try {
      await apiClient.put(`/pricing/config?lotId=${encodeURIComponent(selectedLotId)}`, {
        overstayMultiplier: mult,
        rates: payloadRates,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) {
      console.error(e);
      alert(e?.message || "Save failed.");
    } finally {
      setIsSaving(false);
    }
  };

  const hasSelection = Boolean(selectedLotId);

  return (
    <div className="w-full flex flex-col gap-6 animate-in fade-in duration-500 pb-10">
      <style>{`
        input[type="number"]::-webkit-inner-spin-button,
        input[type="number"]::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type="number"] {
          -moz-appearance: textfield;
        }
      `}</style>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-zinc-900 dark:text-white tracking-tight">Pricing Settings</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Configure branch-specific hourly rates and overstay penalties. Data is saved per parking lot (branch).
          </p>
        </div>

        <div className="flex items-center gap-4">
          {saveSuccess && (
            <span className="text-sm font-bold text-emerald-500 flex items-center gap-1 animate-in fade-in slide-in-from-right-4">
              <CheckCircle className="h-4 w-4" /> Saved Successfully
            </span>
          )}
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={isSaving || !hasSelection || configLoading}
            className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 px-6 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-emerald-500/20 active:scale-[0.98] disabled:opacity-50 outline-none"
          >
            {isSaving ? "Saving..." : (
              <>
                <Save className="h-5 w-5" /> Save Configuration
              </>
            )}
          </button>
        </div>
      </div>

      {loadError && (
        <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-4 py-3 text-sm text-red-800 dark:text-red-200">
          {loadError}
        </div>
      )}

      {ownerLots.length === 0 && !loadError && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
          No parking lots found. Create a lot under parking inventory first, then return here to set hourly rates.
        </div>
      )}

      <div className="bg-zinc-50/50 dark:bg-black/10 p-3 md:p-4 rounded-2xl border border-zinc-200 dark:border-white/5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <MapPin className="h-4 w-4 text-emerald-500" />
          <span className="text-xs font-bold uppercase text-zinc-500 tracking-wider">Select Target Branch</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
          <DropdownTrigger label="Region:" value={region} onClick={() => setActiveDropdown("region")} />
          <DropdownTrigger
            label="City:"
            value={city}
            disabled={region === "All Regions"}
            onClick={() => setActiveDropdown("city")}
          />
          <DropdownTrigger
            label="Branch:"
            value={branchLabel}
            disabled={city === "All Cities"}
            onClick={() => setActiveDropdown("branch")}
          />
        </div>
      </div>

      {hasSelection ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white dark:bg-[#121214] p-6 rounded-2xl border border-zinc-200 dark:border-white/5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-amber-500">
                  <ShieldAlert className="h-5 w-5" />
                  <h2 className="font-bold text-zinc-900 dark:text-white">Overstay Policy</h2>
                </div>
              </div>
              <p className="text-xs text-zinc-500 leading-relaxed mb-6">
                Applied when a vehicle remains after branch closing. Base hourly rates are multiplied by this value for
                overstay hours (stored on the lot and used by billing flows).
              </p>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Penalty Multiplier</label>
                <div className="relative flex items-center bg-zinc-50 dark:bg-[#1a1a1c] border border-zinc-200 dark:border-white/10 rounded-xl overflow-hidden focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500 transition-all">
                  <input
                    type="number"
                    step="0.05"
                    min="1"
                    value={multiplier}
                    onChange={(e) => setMultiplier(e.target.value)}
                    disabled={configLoading}
                    className="w-full bg-transparent text-zinc-900 dark:text-white text-lg font-bold pl-4 pr-24 py-3 outline-none disabled:opacity-60"
                  />
                  <span className="absolute right-10 top-1/2 -translate-y-1/2 text-zinc-400 font-bold text-sm pointer-events-none">
                    x Rate
                  </span>
                  <div className="absolute right-1 top-1 flex flex-col items-center justify-center h-[calc(100%-8px)] border-l border-zinc-200 dark:border-white/10 bg-white dark:bg-[#121214] rounded-r-lg">
                    <button
                      type="button"
                      onClick={() => adjustMultiplier(0.05)}
                      disabled={configLoading}
                      className="flex-1 px-2 text-zinc-400 hover:text-emerald-500 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
                    >
                      <ChevronUp className="h-3 w-3" strokeWidth={3} />
                    </button>
                    <button
                      type="button"
                      onClick={() => adjustMultiplier(-0.05)}
                      disabled={configLoading}
                      className="flex-1 px-2 text-zinc-400 hover:text-red-500 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors border-t border-zinc-100 dark:border-white/5 disabled:opacity-50"
                    >
                      <ChevronDown className="h-3 w-3" strokeWidth={3} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 p-5 rounded-2xl relative overflow-hidden">
              <div className="absolute -right-6 -top-6 h-24 w-24 bg-amber-500/10 rounded-full blur-2xl" />
              <h4 className="text-sm font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
                <Calculator className="h-4 w-4 text-zinc-400" /> Example Scenario
              </h4>
              <div className="space-y-3 text-xs font-medium text-zinc-600 dark:text-zinc-300">
                <div className="flex justify-between border-b border-zinc-200 dark:border-white/5 pb-2">
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-zinc-400" /> Branch Closes At:
                  </span>
                  <span className="font-bold text-zinc-900 dark:text-white">18:00</span>
                </div>
                <div className="flex justify-between border-b border-zinc-200 dark:border-white/5 pb-2">
                  <span>Driver Parks At:</span>
                  <span className="font-bold text-zinc-900 dark:text-white">16:00</span>
                </div>
                <div className="flex justify-between border-b border-zinc-200 dark:border-white/5 pb-2">
                  <span>Driver Leaves At:</span>
                  <span className="font-bold text-zinc-900 dark:text-white">21:00</span>
                </div>
                <div className="flex justify-between pt-1">
                  <span className="text-amber-600 dark:text-amber-500 font-bold">Total Overstay Time:</span>
                  <span className="text-amber-600 dark:text-amber-500 font-bold">3 Hours</span>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-white/10">
                <p className="text-[10px] text-zinc-500 mb-2">Assuming Base Rate of 20 ETB/hr</p>
                <div className="bg-white dark:bg-[#121214] p-3 rounded-xl border border-zinc-200 dark:border-white/5 space-y-1.5 shadow-sm">
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-500">Normal Fee (2 hrs × 20)</span>
                    <span className="font-bold dark:text-white">40 ETB</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-500">
                      Overstay (3 hrs × {20 * parseFloat(multiplier || 1)} ETB)
                    </span>
                    <span className="font-bold text-amber-500">{3 * (20 * parseFloat(multiplier || 1))} ETB</span>
                  </div>
                  <div className="flex justify-between text-sm pt-2 border-t border-zinc-100 dark:border-white/5 font-black">
                    <span className="text-zinc-900 dark:text-white">Total Payable</span>
                    <span className="text-emerald-600 dark:text-emerald-500">
                      {40 + 3 * (20 * parseFloat(multiplier || 1))} ETB
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-[#121214] rounded-2xl border border-zinc-200 dark:border-white/5 shadow-sm overflow-hidden flex flex-col h-full">
              <div className="p-5 border-b border-zinc-100 dark:border-white/5 bg-zinc-50 dark:bg-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <Car className="h-5 w-5 text-zinc-500 shrink-0" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 truncate">
                    Rates: {branchLabel}
                  </h2>
                </div>
                {configLoading && (
                  <span className="text-xs font-bold text-zinc-400">Loading…</span>
                )}
              </div>
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-white/10 text-[10px] uppercase tracking-widest text-zinc-400 bg-white dark:bg-[#121214]">
                      <th className="px-6 py-4 font-black">Vehicle Category</th>
                      <th className="px-6 py-4 font-black text-right w-36">
                        Base Rate
                        <br />
                        (ETB/Hr)
                      </th>
                      <th className="px-6 py-4 font-black text-right w-36 text-amber-500">
                        Overstay Rate
                        <br />
                        (ETB/Hr)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {vehicleGroups.map((group, gIndex) => (
                      <React.Fragment key={gIndex}>
                        <tr className="bg-zinc-50/80 dark:bg-white/[0.02] border-y border-zinc-100 dark:border-white/5">
                          <td
                            colSpan="3"
                            className="px-6 py-2.5 text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-500"
                          >
                            {group.group}
                          </td>
                        </tr>
                        {group.items.map((cat, index) => {
                          const baseRate = rates[cat] ?? "";
                          const baseNum = parseFloat(baseRate === "" ? 0 : baseRate);
                          const penaltyRate = (baseNum * parseFloat(multiplier || 1)).toFixed(2);
                          return (
                            <tr
                              key={index}
                              className="border-b border-zinc-50 dark:border-white/5 last:border-0 hover:bg-zinc-50 dark:hover:bg-white/[0.04] transition-colors group"
                            >
                              <td className="px-6 py-3.5 font-medium text-zinc-700 dark:text-zinc-300 pl-10">{cat}</td>
                              <td className="px-6 py-3.5 text-right">
                                <div className="flex items-center justify-end">
                                  <div className="relative w-32">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 font-medium text-sm">
                                      ETB
                                    </span>
                                    <input
                                      type="number"
                                      min="0"
                                      disabled={configLoading}
                                      value={rates[cat] === undefined ? "" : rates[cat]}
                                      onChange={(e) => handleRateChange(cat, e.target.value)}
                                      className="w-full bg-white dark:bg-[#1a1a1c] border border-zinc-200 dark:border-white/10 text-right text-zinc-900 dark:text-white font-bold rounded-lg pl-10 pr-3 py-2 outline-none focus:border-emerald-500 focus:bg-white dark:focus:bg-[#121214] focus:ring-1 focus:ring-emerald-500 transition-all disabled:opacity-60"
                                    />
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-3.5 text-right">
                                <div className="inline-flex items-center justify-end w-24 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 font-bold border border-amber-200 dark:border-amber-500/20">
                                  {penaltyRate}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="w-full p-12 bg-white dark:bg-[#121214] border border-zinc-200 dark:border-white/5 rounded-2xl flex flex-col items-center justify-center text-center">
          <MapPin className="h-10 w-10 text-zinc-300 dark:text-zinc-600 mb-4" />
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white">No Branch Selected</h2>
          <p className="text-sm text-zinc-500 mt-1 max-w-md">
            Choose a region, city, and a specific parking lot (branch) to load and edit hourly rates.
          </p>
        </div>
      )}

      {activeDropdown && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setActiveDropdown(null)} />
          <div className="relative w-full max-w-md bg-white dark:bg-[#18181b] rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-5 border-b dark:border-white/5">
              <h2 className="text-xl font-bold dark:text-white">Select {activeDropdown}</h2>
              <button
                type="button"
                onClick={() => setActiveDropdown(null)}
                className="p-2 dark:text-zinc-400 hover:dark:text-white outline-none"
              >
                <X />
              </button>
            </div>
            <div className="p-2 max-h-[60vh] overflow-y-auto overscroll-contain">
              {activeDropdown === "region" &&
                regions.map((o) => (
                  <button
                    key={o}
                    type="button"
                    onClick={() => {
                      setRegion(o);
                      if (o === "All Regions") {
                        setCity("All Cities");
                      } else {
                        const cityOpts = [
                          ...new Set(
                            ownerLots.filter((l) => l.region === o).map((l) => l.city).filter(Boolean)
                          ),
                        ].sort();
                        setCity(cityOpts.length ? cityOpts[0] : "All Cities");
                      }
                      setBranchLabel("All Branches");
                      setSelectedLotId(null);
                      setActiveDropdown(null);
                    }}
                    className={`flex items-center justify-between w-full px-4 py-3.5 rounded-2xl text-sm font-bold transition-all ${region === o ? "bg-emerald-500/10 text-emerald-500" : "dark:text-zinc-300 hover:dark:bg-white/5"}`}
                  >
                    {o} {region === o && <Check className="h-4 w-4" />}
                  </button>
                ))}
              {activeDropdown === "city" &&
                citiesForRegion.map((o) => (
                  <button
                    key={o}
                    type="button"
                    onClick={() => {
                      setCity(o);
                      setBranchLabel("All Branches");
                      setSelectedLotId(null);
                      setActiveDropdown(null);
                    }}
                    className={`flex items-center justify-between w-full px-4 py-3.5 rounded-2xl text-sm font-bold transition-all ${city === o ? "bg-emerald-500/10 text-emerald-500" : "dark:text-zinc-300 hover:dark:bg-white/5"}`}
                  >
                    {o} {city === o && <Check className="h-4 w-4" />}
                  </button>
                ))}
              {activeDropdown === "branch" &&
                (lotsForCity.length > 0 ? (
                  lotsForCity.map((lot) => (
                    <button
                      key={String(lot._id)}
                      type="button"
                      onClick={() => {
                        setBranchLabel(lot.name || "Branch");
                        setSelectedLotId(String(lot._id));
                        setActiveDropdown(null);
                      }}
                      className={`flex items-center justify-between w-full px-4 py-3.5 rounded-2xl text-sm font-bold transition-all ${selectedLotId === String(lot._id) ? "bg-emerald-500/10 text-emerald-500" : "dark:text-zinc-300 hover:dark:bg-white/5"}`}
                    >
                      {lot.name} {selectedLotId === String(lot._id) && <Check className="h-4 w-4" />}
                    </button>
                  ))
                ) : (
                  <div className="p-4 text-center text-zinc-500 text-sm">No lots in this city.</div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

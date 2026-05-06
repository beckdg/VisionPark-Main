/**
 * COMPONENT: ParkingManagement
 * PURPOSE: Manage the physical parking infrastructure (Branches, Zones, Spots) with visual grid generation.
 * STRICT RULE: Premium UI components, custom alerts, dynamic non-clipping tooltips, custom number steppers.
 */

import React, { useState, useEffect } from "react";
import { 
  MapPin, Clock, ShieldAlert, Plus, Trash2, CarFront, 
  X, ChevronDown, ChevronUp, Check, Map, Grid, Settings, CheckCircle
} from "lucide-react"; // ✅ ADDED: ChevronUp for the custom stepper
import { apiClient } from "../../api/apiClient";

// --- REQUIRED CONSTANTS FROM SPECIFICATION ---
const REGION_GROUPS = [
  { group: "FEDERAL CITIES", options: ["Addis Ababa", "Dire Dawa"] },
  { group: "MAJOR REGIONS", options: ["Oromia Region", "Amhara Region", "Tigray Region", "Somali Region", "Sidama Region"] }
];

const CITIES_BY_REGION = {
  "Addis Ababa": ["Addis Ababa"], "Dire Dawa": ["Dire Dawa"],
  "Oromia Region": ["Adama"], "Amhara Region": ["Bahir Dar"],
  "Tigray Region": ["Mekelle"], "Somali Region": ["Jigjiga"], "Sidama Region": ["Hawassa"]
};

const VEHICLE_CATEGORIES = [
  "Public Transport Vehicles | Upto 12 Seats", "Public Transport Vehicles | 13–24 Seats", "Public Transport Vehicles | 25 Seats and above",
  "Bicycle | Bicycle", "Motorcycle | Motorcycle",
  "Dry Freight Vehicles | <35 Quintal", "Dry Freight Vehicles | 36–70 Quintal", "Dry Freight Vehicles | >71 Quintal",
  "Liquid Cargo Vehicles | Upto 28 Liter", "Liquid Cargo Vehicles | Above 28 Liter",
  "Machineries | Upto 5000KG weight", "Machineries | 5001–10,000KG weight", "Machineries | Above 10,001KG weight"
];

const INITIAL_BRANCHES = [];
const isValidObjectId = (id) => typeof id === "string" && /^[a-fA-F0-9]{24}$/.test(id);
const normalizeSpotStatus = (status) => {
  const v = String(status || "").toLowerCase();
  if (v === "reserved") return "Reserved";
  if (v === "occupied") return "Occupied";
  return "Free";
};
const toUiSpot = (spot) => ({
  _id: String(spot?._id || ""),
  id: String(spot?.spotCode || spot?.id || ""),
  status: normalizeSpotStatus(spot?.status),
  allowedCategories: Array.isArray(spot?.allowedCategories) ? spot.allowedCategories : [],
});
const toUiZone = (zone) => ({
  id: String(zone?._id || zone?.id || ""),
  _id: String(zone?._id || zone?.id || ""),
  name: String(zone?.name || ""),
  allowedCategories: Array.isArray(zone?.allowedCategories) ? zone.allowedCategories : [],
  spots: [],
});
const toUiBranch = (lot) => ({
  id: String(lot?._id || lot?.id || ""),
  _id: String(lot?._id || lot?.id || ""),
  lotId: String(lot?._id || lot?.id || ""),
  name: lot?.name || "",
  region: lot?.region || "",
  city: lot?.city || "",
  address: lot?.address || "",
  latitude: lot?.location?.coordinates?.[1] != null ? String(lot.location.coordinates[1]) : "",
  longitude: lot?.location?.coordinates?.[0] != null ? String(lot.location.coordinates[0]) : "",
  serviceType: "Day Service Only",
  openTime: "06:00 AM",
  closeTime: "06:00 PM",
  overstayMultiplier: lot?.overstayMultiplier ?? 1,
  zones: [],
});

// --- UTILITY: Generate Row Letters (A, B, C... Z, AA, AB) ---
const getRowLetter = (index) => {
  let letter = "";
  let temp = index;
  while (temp >= 0) {
    letter = String.fromCharCode(65 + (temp % 26)) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
};

// --- CUSTOM PREMIUM NUMBER INPUT (Replaces ugly browser arrows) ---
const PremiumNumberInput = ({ label, value, onChange, min = 1, max = 100 }) => {
  const handleIncrement = () => onChange(Math.min(max, (parseInt(value) || 0) + 1));
  const handleDecrement = () => onChange(Math.max(min, (parseInt(value) || 0) - 1));

  return (
    <div className="space-y-1.5 w-full">
      <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">{label}</label>
      <div className="relative w-full flex items-center bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500 transition-all overflow-hidden">
        <input 
          required 
          type="number" 
          min={min} 
          max={max} 
          value={value || ''} 
          onChange={(e) => {
            const val = parseInt(e.target.value);
            onChange(isNaN(val) ? '' : val);
          }} 
          className="w-full bg-transparent text-sm text-zinc-900 dark:text-white pl-4 pr-10 py-3 outline-none hide-spin-button font-medium" 
        />
        {/* Custom Stepper Controls */}
        <div className="flex flex-col h-full absolute right-0 top-0 bottom-0 w-8 border-l border-zinc-200 dark:border-white/10 bg-white dark:bg-transparent">
          <button 
            type="button" 
            onClick={handleIncrement} 
            className="flex-1 flex items-center justify-center text-zinc-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors outline-none cursor-pointer"
          >
            <ChevronUp className="h-4 w-4" strokeWidth={2.5} />
          </button>
          <div className="h-[1px] w-full bg-zinc-200 dark:bg-white/10"></div>
          <button 
            type="button" 
            onClick={handleDecrement} 
            className="flex-1 flex items-center justify-center text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors outline-none cursor-pointer"
          >
            <ChevronDown className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
};

// --- CUSTOM PREMIUM TIME PICKER ---
const PremiumTimePicker = ({ label, value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const parts = value?.split(/[: ]/) || ["06", "00", "AM"];
  const currentHour = parts[0] || "06";
  const currentMin = parts[1] || "00";
  const currentPeriod = parts[2] || "AM";

  const hours = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));
  const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));
  const periods = ["AM", "PM"];

  const handleUpdate = (type, val) => {
    let newH = currentHour, newM = currentMin, newP = currentPeriod;
    if (type === 'h') newH = val;
    if (type === 'm') newM = val;
    if (type === 'p') newP = val;
    onChange(`${newH}:${newM} ${newP}`);
  };

  return (
    <div className="space-y-1.5 relative w-full">
      <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">{label}</label>
      <button 
        type="button" onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white text-sm rounded-xl px-4 py-3 outline-none transition-all ${isOpen ? 'border-emerald-500 ring-1 ring-emerald-500' : 'hover:border-emerald-500'}`}
      >
        <span className="truncate pr-4 font-bold">{value}</span>
        <Clock className={`h-4 w-4 shrink-0 ${isOpen ? 'text-emerald-500' : 'text-zinc-400'}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setIsOpen(false)}></div>
          <div className="absolute z-[9999] bottom-[calc(100%+8px)] left-0 p-2 bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-white/10 rounded-2xl shadow-2xl flex gap-1 sm:gap-2 animate-in fade-in slide-in-from-bottom-2 w-full sm:w-[240px]">
            <div className="flex-1 h-40 overflow-y-auto overscroll-contain custom-scrollbar pr-1 flex flex-col gap-1">
              {hours.map(h => (<button key={h} type="button" onClick={() => handleUpdate('h', h)} className={`w-full py-2.5 rounded-lg text-sm font-bold transition-all outline-none shrink-0 ${currentHour === h ? 'bg-emerald-500 text-white shadow-md' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/5'}`}>{h}</button>))}
            </div>
            <div className="flex-1 h-40 overflow-y-auto overscroll-contain custom-scrollbar pr-1 flex flex-col gap-1">
              {minutes.map(m => (<button key={m} type="button" onClick={() => handleUpdate('m', m)} className={`w-full py-2.5 rounded-lg text-sm font-bold transition-all outline-none shrink-0 ${currentMin === m ? 'bg-emerald-500 text-white shadow-md' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/5'}`}>{m}</button>))}
            </div>
            <div className="flex-1 h-40 overflow-y-auto overscroll-contain custom-scrollbar flex flex-col gap-1">
              {periods.map(p => (<button key={p} type="button" onClick={() => handleUpdate('p', p)} className={`w-full py-2.5 rounded-lg text-sm font-bold transition-all outline-none shrink-0 ${currentPeriod === p ? 'bg-emerald-500 text-white shadow-md' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/5'}`}>{p}</button>))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default function ParkingManagement() {
  const [branches, setBranches] = useState(INITIAL_BRANCHES);
  const [selectedBranchId, setSelectedBranchId] = useState(null);
  const [selectedZoneId, setSelectedZoneId] = useState(null);
  
  const [activeDropdown, setActiveDropdown] = useState(null); 

  // Custom Premium Alert Modal State
  const [customAlert, setCustomAlert] = useState(null); // { type: 'success' | 'error', title: '', message: '' }

  // Smart Tooltip State
  const [tooltipConfig, setTooltipConfig] = useState(null);

  // Modals
  const [branchModalOpen, setBranchModalOpen] = useState(false);
  const [zoneModalOpen, setZoneModalOpen] = useState(false);
  const [spotModalOpen, setSpotModalOpen] = useState(false);
  
  // Grid Generator & Spot Management Modals
  const [gridModalOpen, setGridModalOpen] = useState(false);
  const [editSpotModalOpen, setEditSpotModalOpen] = useState(false);
  const [editZoneModalOpen, setEditZoneModalOpen] = useState(false);

  // Forms State
  const [newBranch, setNewBranch] = useState({ name: "", region: "Addis Ababa", city: "Addis Ababa", address: "", latitude: "", longitude: "", serviceType: "Day Service Only", openTime: "06:00 AM", closeTime: "06:00 PM", overstayMultiplier: "1.75" });
  const [newZone, setNewZone] = useState({ name: "", allowedCategories: [] });
  const [newSpot, setNewSpot] = useState({ id: "", status: "Free", allowedCategories: [] });
  const [isSubmittingZone, setIsSubmittingZone] = useState(false);
  const [isSubmittingSpot, setIsSubmittingSpot] = useState(false);
  const [isSubmittingGrid, setIsSubmittingGrid] = useState(false);
  
  const [gridConfig, setGridConfig] = useState({ rows: 10, cols: 12, prefix: "", status: "Free", allowedCategories: [] });
  const [editingSpot, setEditingSpot] = useState(null);
  const [editingZone, setEditingZone] = useState(null);

  const activeBranch = branches.find(b => b.id === selectedBranchId);
  const activeZone = activeBranch?.zones.find(z => z.id === selectedZoneId) || activeBranch?.zones[0];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const lots = await apiClient.get("/parking/lots");
        const mappedLots = Array.isArray(lots) ? lots.map(toUiBranch) : [];

        const lotsWithZones = await Promise.all(
          mappedLots.map(async (branch) => {
            if (!isValidObjectId(branch.lotId)) return branch;
            try {
              const zones = await apiClient.get(`/parking/zones?lotId=${branch.lotId}`);
              const mappedZones = Array.isArray(zones) ? zones.map(toUiZone) : [];
              return { ...branch, zones: mappedZones };
            } catch {
              return branch;
            }
          })
        );

        const hydrated = await Promise.all(
          lotsWithZones.map(async (branch) => {
            const zonesWithSpots = await Promise.all(
              (branch.zones || []).map(async (zone) => {
                if (!isValidObjectId(zone._id || zone.id)) return zone;
                try {
                  const spots = await apiClient.get(`/parking/spots?zoneId=${zone._id || zone.id}`);
                  return { ...zone, spots: Array.isArray(spots) ? spots.map(toUiSpot) : [] };
                } catch {
                  return zone;
                }
              })
            );
            return { ...branch, zones: zonesWithSpots };
          })
        );

        if (!cancelled) {
          setBranches(hydrated);
          setSelectedBranchId(hydrated[0]?.id || null);
          setSelectedZoneId(hydrated[0]?.zones?.[0]?.id || null);
        }
      } catch (error) {
        if (!cancelled) {
          setBranches([]);
          setSelectedBranchId(null);
          setSelectedZoneId(null);
          setCustomAlert({ type: "error", title: "Failed to Load Lots", message: error?.message || "Unable to load lots." });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!activeBranch) {
      setSelectedZoneId(null);
      return;
    }
    if (!activeBranch.zones.some((z) => z.id === selectedZoneId)) {
      setSelectedZoneId(activeBranch.zones[0]?.id || null);
    }
  }, [activeBranch, selectedZoneId]);

  // Hide tooltips dynamically on scroll to prevent "floating" detached tips
  useEffect(() => {
    const handleScroll = () => setTooltipConfig(null);
    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, []);

  const DropdownTrigger = ({ label, value, onClick, disabled }) => (
    <div className="space-y-1.5 w-full">
      <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">{label}</label>
      <button type="button" onClick={onClick} disabled={disabled} className={`w-full flex items-center justify-between bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white text-sm rounded-xl px-4 py-3 outline-none transition-all ${disabled ? 'opacity-50' : 'hover:border-emerald-500'}`}>
        <span className="truncate pr-4">{value || "Select..."}</span>
        <ChevronDown className="h-5 w-5 text-zinc-400 shrink-0" />
      </button>
    </div>
  );

  // --- CRUD OPERATIONS ---
  const handleCreateBranch = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: newBranch.name,
        region: newBranch.region,
        city: newBranch.city,
        address: newBranch.address,
        overstayMultiplier: parseFloat(newBranch.overstayMultiplier || "1.75"),
      };
      if (newBranch.latitude && newBranch.longitude) {
        payload.location = {
          type: "Point",
          coordinates: [Number(newBranch.longitude), Number(newBranch.latitude)],
        };
      }
      const created = await apiClient.post("/parking/lots", payload);
      const nextBranch = toUiBranch(created);
      setBranches((prev) => [...prev, nextBranch]);
      setSelectedBranchId(nextBranch.id);
      setSelectedZoneId(null);
      setBranchModalOpen(false);
      setCustomAlert({ type: "success", title: "Branch Created", message: `Branch "${nextBranch.name}" created successfully.` });
    } catch (error) {
      setCustomAlert({ type: "error", title: "Create Branch Failed", message: error?.message || "Failed to create branch." });
    }
  };

  const handleCreateZone = async (e) => {
    e.preventDefault();
    if (!activeBranch) return;
    if (!isValidObjectId(activeBranch.lotId || activeBranch.id)) {
      setCustomAlert({ type: "error", title: "Invalid Lot", message: "Selected lotId is invalid." });
      return;
    }
    setIsSubmittingZone(true);
    try {
      const payload = {
        lotId: activeBranch.lotId || activeBranch.id,
        name: newZone.name,
      };
      if (newZone.allowedCategories.length > 0) payload.allowedCategories = newZone.allowedCategories;
      const created = await apiClient.post("/parking/zones", payload);
      const createdId = String(created?._id || "");
      const createdZone = {
        id: createdId,
        _id: createdId,
        name: created?.name || newZone.name,
        allowedCategories: Array.isArray(created?.allowedCategories) ? created.allowedCategories : newZone.allowedCategories,
        spots: [],
      };
      const updatedBranches = branches.map((b) => (b.id === activeBranch.id ? { ...b, zones: [...b.zones, createdZone] } : b));
      setBranches(updatedBranches);
      setSelectedZoneId(createdZone.id);
      setZoneModalOpen(false);
      setNewZone({ name: "", allowedCategories: [] });
      setCustomAlert({ type: "success", title: "Zone Created", message: `Zone "${createdZone.name}" created successfully.` });
    } catch (error) {
      setCustomAlert({ type: "error", title: "Create Zone Failed", message: error?.message || "Failed to create zone." });
    } finally {
      setIsSubmittingZone(false);
    }
  };

  const handleUpdateZone = (e) => {
    e.preventDefault();
    (async () => {
      if (!activeBranch || !editingZone) return;
      if (!isValidObjectId(editingZone._id || editingZone.id)) {
        setCustomAlert({ type: "error", title: "Invalid Zone", message: "Selected zoneId is invalid." });
        return;
      }
      const current = activeBranch.zones.find((z) => z.id === editingZone.id);
      const patch = {};
      if (editingZone.name !== current?.name) patch.name = editingZone.name;
      if (Object.keys(patch).length === 0) {
        setEditZoneModalOpen(false);
        return;
      }
      try {
        const updated = await apiClient.patch(`/parking/zones/${editingZone._id || editingZone.id}`, patch);
        const updatedBranches = branches.map((b) => (b.id === activeBranch.id ? {
          ...b,
          zones: b.zones.map((z) => (z.id === editingZone.id ? { ...z, ...toUiZone({ ...z, ...updated }) } : z)),
        } : b));
        setBranches(updatedBranches);
        setEditZoneModalOpen(false);
      } catch (error) {
        setCustomAlert({ type: "error", title: "Update Zone Failed", message: error?.message || "Failed to update zone." });
      }
    })();
  };

  const handleDeleteZone = () => {
    (async () => {
      if (!activeBranch || !editingZone) return;
      if (!isValidObjectId(editingZone._id || editingZone.id)) {
        setCustomAlert({ type: "error", title: "Invalid Zone", message: "Selected zoneId is invalid." });
        return;
      }
      try {
        await apiClient.delete(`/parking/zones/${editingZone._id || editingZone.id}`);
        const updatedBranches = branches.map((b) => (b.id === activeBranch.id ? {
          ...b, zones: b.zones.filter((z) => z.id !== editingZone.id),
        } : b));
        setBranches(updatedBranches);
        setSelectedZoneId(updatedBranches.find((b) => b.id === activeBranch.id)?.zones[0]?.id || null);
        setEditZoneModalOpen(false);
      } catch (error) {
        setCustomAlert({ type: "error", title: "Delete Zone Failed", message: error?.message || "Failed to delete zone." });
      }
    })();
  };

  const handleCreateSpot = async (e) => {
    e.preventDefault();
    if (!activeBranch || !activeZone) return;
    if (!isValidObjectId(activeBranch.lotId || activeBranch.id)) {
      setCustomAlert({ type: "error", title: "Invalid Lot", message: "Selected lotId is invalid." });
      return;
    }
    if (!isValidObjectId(activeZone._id || activeZone.id)) {
      setCustomAlert({ type: "error", title: "Invalid Zone", message: "Selected zoneId is invalid." });
      return;
    }

    if (activeZone.spots.some(s => s.id === newSpot.id)) {
      return setCustomAlert({ type: 'error', title: 'Duplicate Spot ID', message: 'A spot with this ID already exists in this zone.' });
    }

    setIsSubmittingSpot(true);
    try {
      const payload = {
        lotId: activeBranch.lotId || activeBranch.id,
        zoneId: activeZone._id || activeZone.id,
        spotCode: newSpot.id,
      };
      const allowed = newSpot.allowedCategories.length > 0 ? newSpot.allowedCategories : activeZone.allowedCategories;
      if (allowed.length > 0) payload.allowedCategories = allowed;
      const created = await apiClient.post("/parking/spots", payload);
      const uiSpot = toUiSpot({ ...created, allowedCategories: created?.allowedCategories ?? allowed });
      const updatedBranches = branches.map((b) => (b.id === activeBranch.id ? {
        ...b, zones: b.zones.map((z) => (z.id === activeZone.id ? { ...z, spots: [...z.spots, uiSpot] } : z))
      } : b));
      setBranches(updatedBranches);
      setSpotModalOpen(false);
      setNewSpot({ id: "", status: "Free", allowedCategories: [] });
      setCustomAlert({ type: "success", title: "Spot Created", message: `Spot "${uiSpot.id}" created successfully.` });
    } catch (error) {
      setCustomAlert({ type: "error", title: "Create Spot Failed", message: error?.message || "Failed to create spot." });
    } finally {
      setIsSubmittingSpot(false);
    }
  };

  // --- GRID GENERATOR LOGIC ---
  const handleGenerateGrid = async (e) => {
    e.preventDefault();
    if (!activeBranch || !activeZone) return;
    const total = gridConfig.rows * gridConfig.cols;
    
    if (total > 500) {
      return setCustomAlert({ type: 'error', title: 'Limit Exceeded', message: 'Maximum 500 spots per generation to ensure optimal browser performance.' });
    }

    let generated = 0;
    let skipped = 0;
    const lotId = activeBranch.lotId || activeBranch.id;
    const zoneId = activeZone._id || activeZone.id;
    if (!isValidObjectId(lotId)) {
      setCustomAlert({ type: "error", title: "Invalid Lot", message: "Selected lotId is invalid." });
      return;
    }
    if (!isValidObjectId(zoneId)) {
      setCustomAlert({ type: "error", title: "Invalid Zone", message: "Selected zoneId is invalid." });
      return;
    }
    const allowedCategories = gridConfig.allowedCategories.length > 0 ? gridConfig.allowedCategories : activeZone.allowedCategories;
    const candidates = [];
    for (let r = 0; r < gridConfig.rows; r++) {
      const rowStr = getRowLetter(r);
      for (let c = 1; c <= gridConfig.cols; c++) {
        candidates.push(`${gridConfig.prefix}${gridConfig.prefix ? "-" : ""}${rowStr}${c}`);
      }
    }
    // Re-sync spot codes from backend to avoid duplicate create failures when local state is stale.
    let existingCodes = new Set(activeZone.spots.map((s) => s.id));
    try {
      const latestSpots = await apiClient.get(`/parking/spots?zoneId=${zoneId}`);
      if (Array.isArray(latestSpots)) {
        existingCodes = new Set(latestSpots.map((s) => String(s.spotCode || s.id || "")));
        const merged = latestSpots.map(toUiSpot);
        setBranches((prev) =>
          prev.map((b) =>
            b.id === activeBranch.id
              ? {
                  ...b,
                  zones: b.zones.map((z) =>
                    z.id === activeZone.id ? { ...z, spots: merged } : z
                  ),
                }
              : b
          )
        );
      }
    } catch {
      // If list endpoint fails, continue with current UI state.
    }

    const missing = candidates.filter((id) => !existingCodes.has(id));
    skipped += candidates.length - missing.length;
    const createdSpots = [];
    setIsSubmittingGrid(true);
    try {
      let usedBulk = false;
      try {
        const bulkPayload = {
          lotId,
          zoneId,
          spots: missing.map((code) => ({
            spotCode: code,
            ...(allowedCategories.length > 0 ? { allowedCategories } : {}),
          })),
        };
        const bulkResult = await apiClient.post("/parking/spots/bulk", bulkPayload);
        const createdItems = Array.isArray(bulkResult?.created)
          ? bulkResult.created
          : Array.isArray(bulkResult)
            ? bulkResult
            : [];
        createdSpots.push(...createdItems.map(toUiSpot));
        generated = createdSpots.length;
        skipped += Math.max(0, missing.length - generated);
        usedBulk = true;
      } catch {
        usedBulk = false;
      }

      if (!usedBulk) {
        const chunkSize = 20;
        for (let i = 0; i < missing.length; i += chunkSize) {
          const chunk = missing.slice(i, i + chunkSize);
          const results = await Promise.all(
            chunk.map(async (code) => {
              try {
                const payload = { lotId, zoneId, spotCode: code };
                if (allowedCategories.length > 0) payload.allowedCategories = allowedCategories;
                const created = await apiClient.post("/parking/spots", payload);
                return { ok: true, spot: toUiSpot({ ...created, allowedCategories: created?.allowedCategories ?? allowedCategories }) };
              } catch {
                return { ok: false };
              }
            })
          );
          results.forEach((r) => {
            if (r.ok) {
              createdSpots.push(r.spot);
              generated++;
            } else {
              skipped++;
            }
          });
        }
      }
    } finally {
      setIsSubmittingGrid(false);
    }
    const updatedBranches = branches.map((b) => (b.id === activeBranch.id ? {
      ...b, zones: b.zones.map((z) => (z.id === activeZone.id ? { ...z, spots: [...z.spots, ...createdSpots] } : z))
    } : b));
    setBranches(updatedBranches);
    setGridModalOpen(false);
    setCustomAlert({
      type: generated > 0 ? "success" : "error",
      title: generated > 0 ? "Grid Generated" : "Grid Generation Failed",
      message: `${generated} parking spots successfully generated.\n${skipped > 0 ? `(${skipped} skipped or failed)` : ""}`,
    });
  };

  // --- SPOT MANAGEMENT LOGIC ---
  const handleUpdateSpot = (e) => {
    e.preventDefault();
    (async () => {
      if (!activeBranch || !activeZone || !editingSpot) return;
      if (!isValidObjectId(editingSpot._id)) {
        setCustomAlert({ type: "error", title: "Invalid Spot", message: "Selected spotId is invalid." });
        return;
      }
      if (editingSpot.id !== editingSpot.originalId && activeZone.spots.some((s) => s.id === editingSpot.id)) {
        setCustomAlert({ type: "error", title: "Duplicate Spot ID", message: "A spot with this ID already exists." });
        return;
      }
      const original = activeZone.spots.find((s) => s.id === editingSpot.originalId);
      const patch = {};
      if (editingSpot.id !== original?.id) patch.spotCode = editingSpot.id;
      if (JSON.stringify(editingSpot.allowedCategories || []) !== JSON.stringify(original?.allowedCategories || [])) {
        patch.allowedCategories = editingSpot.allowedCategories || [];
      }
      if (Object.keys(patch).length === 0) {
        setEditSpotModalOpen(false);
        return;
      }
      try {
        const updated = await apiClient.patch(`/parking/spots/${editingSpot._id}`, patch);
        const updatedBranches = branches.map((b) => (b.id === activeBranch.id ? {
          ...b,
          zones: b.zones.map((z) => (z.id === activeZone.id ? {
            ...z,
            spots: z.spots.map((s) => (s.id === editingSpot.originalId ? { ...s, ...toUiSpot({ ...s, ...updated }) } : s)),
          } : z)),
        } : b));
        setBranches(updatedBranches);
        setEditSpotModalOpen(false);
      } catch (error) {
        setCustomAlert({ type: "error", title: "Update Spot Failed", message: error?.message || "Failed to update spot." });
      }
    })();
  };

  const handleDeleteSpot = () => {
    (async () => {
      if (!activeBranch || !activeZone || !editingSpot) return;
      if (!isValidObjectId(editingSpot._id)) {
        setCustomAlert({ type: "error", title: "Invalid Spot", message: "Selected spotId is invalid." });
        return;
      }
      try {
        await apiClient.delete(`/parking/spots/${editingSpot._id}`);
        const updatedBranches = branches.map((b) => (b.id === activeBranch.id ? {
          ...b, zones: b.zones.map((z) => (z.id === activeZone.id ? {
            ...z, spots: z.spots.filter((s) => s.id !== editingSpot.originalId),
          } : z)),
        } : b));
        setBranches(updatedBranches);
        setEditSpotModalOpen(false);
      } catch (error) {
        setCustomAlert({ type: "error", title: "Delete Spot Failed", message: error?.message || "Failed to delete spot." });
      }
    })();
  };

  const openSpotEditor = (spot) => {
    setEditingSpot({ ...spot, originalId: spot.id, allowedCategories: spot.allowedCategories || activeZone.allowedCategories, zoneObjectId: activeZone?._id || activeZone?.id });
    setTooltipConfig(null); // Hide tooltip when editing
    setEditSpotModalOpen(true);
  };

  const openGridGenerator = () => {
    setGridConfig({ ...gridConfig, allowedCategories: activeZone.allowedCategories });
    setGridModalOpen(true);
  };

  // --- PREMIUM SPOT STYLING ---
  const getSpotColor = (status) => {
    if (status === 'Free') return 'bg-emerald-50/80 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:border-emerald-500';
    if (status === 'Reserved') return 'bg-amber-50/80 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-400 hover:border-amber-500';
    return 'bg-red-50/80 dark:bg-red-500/10 border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-400 hover:border-red-500';
  };

  // --- SMART TOOLTIP HANDLERS ---
  const handleSpotMouseEnter = (e, spot) => {
    const rect = e.currentTarget.getBoundingClientRect();
    // Clamping logic ensures the tooltip center is never pushed off the left or right edges
    const safeX = Math.min(window.innerWidth - 120, Math.max(120, rect.left + rect.width / 2));
    
    setTooltipConfig({
      spot,
      x: safeX,
      y: rect.top - 8 // Hover slightly above the element
    });
  };

  return (
    <div className="w-full flex flex-col gap-6 animate-in fade-in duration-500 relative">
      
      {/* Required CSS to hide native spin buttons and format custom scrollbars */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #3f3f46; border-radius: 10px; }
        .custom-scrollbar { scrollbar-width: thin; scrollbar-color: #3f3f46 transparent; }
        .hide-spin-button::-webkit-inner-spin-button, .hide-spin-button::-webkit-outer-spin-button { 
          -webkit-appearance: none; margin: 0; 
        }
        .hide-spin-button { -moz-appearance: textfield; }
      `}</style>

      {/* --- SMART PREMIUM PORTAL TOOLTIP --- */}
      {tooltipConfig && tooltipConfig.spot && (
        <div 
          className="fixed z-[10000] pointer-events-none animate-in fade-in zoom-in-95 duration-150 w-56"
          style={{ 
            left: tooltipConfig.x, 
            top: tooltipConfig.y,
            transform: 'translate(-50%, -100%)' // Centers horizontally, anchors bottom to the top of the spot
          }}
        >
          <div className="bg-white/95 dark:bg-[#121214]/95 backdrop-blur-xl border border-zinc-200 dark:border-white/10 shadow-2xl rounded-2xl p-4 flex flex-col gap-2 relative">
            <div className="flex justify-between items-start">
              <span className="font-black text-lg text-zinc-900 dark:text-white leading-none">{tooltipConfig.spot.id}</span>
              <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${tooltipConfig.spot.status === 'Free' ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20' : tooltipConfig.spot.status === 'Reserved' ? 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20' : 'bg-red-50 text-red-600 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20'}`}>
                {tooltipConfig.spot.status}
              </span>
            </div>
            
            <div className="w-full h-px bg-zinc-100 dark:bg-white/5 my-0.5"></div>
            
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Allowed Layout</span>
            <div className="flex flex-col gap-1.5">
               {(tooltipConfig.spot.allowedCategories?.length > 0 ? tooltipConfig.spot.allowedCategories : activeZone.allowedCategories).map((c, i) => (
                  <span key={i} className="text-xs font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
                    <span className="truncate">{c.split('|')[0].trim()}</span>
                  </span>
               ))}
            </div>

            {/* Little pointer triangle */}
            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white/95 dark:bg-[#121214]/95 border-b border-r border-zinc-200 dark:border-white/10 transform rotate-45"></div>
          </div>
        </div>
      )}

      {/* --- CUSTOM PREMIUM ALERT MODAL --- */}
      {customAlert && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-900/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setCustomAlert(null)}></div>
          <div className="relative w-full max-w-sm bg-white dark:bg-[#18181b] rounded-3xl shadow-2xl flex flex-col p-8 animate-in zoom-in-95 duration-300 items-center text-center border border-zinc-200 dark:border-white/10">
             
             <div className={`h-20 w-20 rounded-full flex items-center justify-center mb-5 shadow-inner ${customAlert.type === 'error' ? 'bg-red-50 dark:bg-red-500/10 text-red-500 shadow-red-500/20' : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 shadow-emerald-500/20'}`}>
                {customAlert.type === 'error' ? <ShieldAlert className="h-10 w-10" /> : <CheckCircle className="h-10 w-10" />}
             </div>
             
             <h2 className="text-xl font-black text-zinc-900 dark:text-white mb-2 tracking-tight">{customAlert.title}</h2>
             <p className="text-sm text-zinc-500 mb-8 leading-relaxed text-balance whitespace-pre-line">{customAlert.message}</p>
             
             <button onClick={() => setCustomAlert(null)} className={`w-full font-bold py-3.5 rounded-xl transition-all outline-none shadow-lg active:scale-95 ${customAlert.type === 'error' ? 'bg-red-500 hover:bg-red-400 text-white shadow-red-500/20' : 'bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow-emerald-500/20'}`}>
               Understood
             </button>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-zinc-900 dark:text-white tracking-tight">Parking Management</h1>
          <p className="text-sm md:text-base text-zinc-500 dark:text-zinc-400 mt-1">Configure branches, zones, spots, and grid layouts.</p>
        </div>
        <button onClick={() => setBranchModalOpen(true)} className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-emerald-500/20 transition-all active:scale-95">
          <Plus className="h-5 w-5" /> Create Branch
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full">
        {/* LEFT COLUMN: BRANCHES */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="bg-white dark:bg-[#121214] rounded-2xl border border-zinc-200 dark:border-white/5 shadow-sm h-[600px] flex flex-col">
            <div className="p-5 border-b border-zinc-100 dark:border-white/5"><h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-2"><MapPin className="h-4 w-4" /> Global Branches</h2></div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
              {branches.map(branch => (
                <button key={branch.id} onClick={() => { setSelectedBranchId(branch.id); setSelectedZoneId(branch.zones[0]?.id || null); }} className={`w-full text-left p-4 rounded-xl transition-all border outline-none ${selectedBranchId === branch.id ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/30 shadow-sm" : "bg-transparent border-transparent hover:bg-zinc-50 dark:hover:bg-white/5"}`}>
                  <h3 className={`font-bold text-base truncate ${selectedBranchId === branch.id ? "text-emerald-700 dark:text-emerald-400" : "text-zinc-900 dark:text-white"}`}>{branch.name}</h3>
                  <p className="text-xs text-zinc-500 mt-1">{branch.city}, {branch.region}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: BRANCH DETAILS & ZONES */}
        <div className="lg:col-span-8 flex flex-col gap-6 min-w-0">
          {activeBranch && (
            <div className="bg-white dark:bg-[#121214] rounded-2xl border border-zinc-200 dark:border-white/5 shadow-sm p-6 min-w-0">
              <div className="flex justify-between items-start mb-6 min-w-0">
                <div className="min-w-0 pr-4">
                  <h2 className="text-xl font-bold text-zinc-900 dark:text-white truncate">{activeBranch.name}</h2>
                  <p className="text-sm text-zinc-500 mt-1"><Map className="inline h-3.5 w-3.5 mr-1"/> {activeBranch.address} (Lat: {activeBranch.latitude}, Lng: {activeBranch.longitude})</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={async () => {
                    if (!activeBranch || !isValidObjectId(activeBranch._id || activeBranch.id)) {
                      setCustomAlert({ type: "error", title: "Invalid Lot", message: "Selected lotId is invalid." });
                      return;
                    }
                    try {
                      await apiClient.delete(`/parking/lots/${activeBranch._id || activeBranch.id}`);
                      const nextBranches = branches.filter((b) => b.id !== activeBranch.id);
                      setBranches(nextBranches);
                      setSelectedBranchId(nextBranches[0]?.id || null);
                      setSelectedZoneId(nextBranches[0]?.zones?.[0]?.id || null);
                    } catch (error) {
                      setCustomAlert({ type: "error", title: "Delete Branch Failed", message: error?.message || "Failed to delete branch." });
                    }
                  }} className="p-2 text-zinc-400 hover:text-red-500 bg-zinc-50 dark:bg-white/5 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-[#121214] rounded-2xl border border-zinc-200 dark:border-white/5 shadow-sm flex flex-col overflow-hidden min-w-0">
            <div className="flex border-b border-zinc-100 dark:border-white/5 overflow-x-auto custom-scrollbar">
              {activeBranch?.zones.map(zone => (
                <button key={zone.id} onClick={() => setSelectedZoneId(zone.id)} className={`px-6 py-4 text-sm font-bold whitespace-nowrap transition-colors border-b-2 outline-none ${selectedZoneId === zone.id ? "border-emerald-500 text-emerald-600 dark:text-emerald-400" : "border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-white"}`}>{zone.name}</button>
              ))}
              <button onClick={() => setZoneModalOpen(true)} disabled={!activeBranch} className="px-6 py-4 text-sm font-bold text-emerald-600 hover:text-emerald-500 flex items-center gap-2 whitespace-nowrap disabled:opacity-50"><Plus className="h-4 w-4" /> Add Zone</button>
            </div>

            {activeZone && (
              <div className="p-6">
                
                {/* Zone Settings & Allowed Categories */}
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-8 pb-6 border-b border-zinc-100 dark:border-white/5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2 uppercase tracking-wider text-[10px]"><CarFront className="h-4 w-4 text-zinc-400" /> Default Allowed Categories</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {activeZone.allowedCategories.map((cat, i) => <span key={i} className="px-3 py-1.5 bg-zinc-100 dark:bg-white/5 text-zinc-700 dark:text-zinc-300 text-xs font-medium rounded-full border border-zinc-200 dark:border-white/10">{cat.split('|')[0].trim()}</span>)}
                    </div>
                  </div>
                  <button onClick={() => { setEditingZone(activeZone); setEditZoneModalOpen(true); }} className="text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white flex items-center gap-1.5 bg-zinc-50 dark:bg-white/5 px-4 py-2.5 rounded-xl transition-colors border border-zinc-200 dark:border-white/10 shrink-0"><Settings className="h-4 w-4" /> Zone Settings</button>
                </div>

                {/* Spot Grid System */}
                <div>
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Parking Layout ({activeZone.spots.length} Spots)</h3>
                    <div className="flex flex-wrap items-center gap-2">
                      <button onClick={() => setSpotModalOpen(true)} className="text-xs font-bold bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white px-4 py-2 rounded-xl hover:border-emerald-500 transition-colors flex items-center gap-1.5"><Plus className="h-3.5 w-3.5 text-emerald-500" /> Manual Spot</button>
                      <button onClick={openGridGenerator} className="text-xs font-bold bg-emerald-500 text-zinc-950 px-4 py-2 rounded-xl hover:bg-emerald-400 transition-colors flex items-center gap-1.5 shadow-sm shadow-emerald-500/20 active:scale-95"><Grid className="h-3.5 w-3.5" /> Generate Grid</button>
                    </div>
                  </div>

                  {/* VISUAL PARKING GRID */}
                  <div className="bg-zinc-50 dark:bg-[#09090b] border border-zinc-200 dark:border-white/5 rounded-2xl p-4 sm:p-6 min-h-[300px]">
                    {activeZone.spots.length === 0 ? (
                      <div className="w-full h-full flex flex-col items-center justify-center text-zinc-500 py-10">
                        <Grid className="h-10 w-10 text-zinc-300 dark:text-zinc-700 mb-3" />
                        <p className="text-sm font-medium">No spots created yet.</p>
                        <p className="text-xs mt-1">Generate a grid layout to get started quickly.</p>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-3 justify-start relative">
                        {activeZone.spots.map((spot) => (
                          <button 
                            key={spot.id}
                            onClick={() => openSpotEditor(spot)}
                            onMouseEnter={(e) => handleSpotMouseEnter(e, spot)}
                            onMouseLeave={() => setTooltipConfig(null)}
                            className={`h-12 w-16 sm:h-14 sm:w-20 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all outline-none hover:scale-105 hover:shadow-lg hover:-translate-y-0.5 cursor-pointer ${getSpotColor(spot.status)}`}
                          >
                            <span className="font-mono font-bold text-sm sm:text-base tracking-tighter">{spot.id}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Legend */}
                  <div className="flex items-center gap-5 mt-6 text-[10px] font-black uppercase text-zinc-500 tracking-wider">
                    <span className="flex items-center gap-2"><div className="h-3 w-3 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div> Free</span>
                    <span className="flex items-center gap-2"><div className="h-3 w-3 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"></div> Reserved</span>
                    <span className="flex items-center gap-2"><div className="h-3 w-3 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"></div> Occupied</span>
                  </div>

                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* --- GRID GENERATOR MODAL --- */}
      {gridModalOpen && (
        <div className="fixed inset-0 z-[7000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-900/60 dark:bg-black/80 backdrop-blur-sm" onClick={() => setGridModalOpen(false)}></div>
          <div className="relative w-full max-w-2xl bg-white dark:bg-[#18181b] rounded-3xl shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200 overflow-hidden border border-zinc-200 dark:border-white/10">
            <div className="flex items-center justify-between px-8 py-5 border-b border-zinc-100 dark:border-white/5 shrink-0">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-3"><Grid className="h-6 w-6 text-emerald-500" /> Parking Grid Generator</h2>
              <button onClick={() => setGridModalOpen(false)} className="p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-xl transition-colors bg-zinc-50 dark:bg-white/5"><X className="h-5 w-5" /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 md:grid-cols-2 gap-8 custom-scrollbar">
              {/* Configuration Form */}
              <form id="gridForm" onSubmit={handleGenerateGrid} className="flex flex-col gap-5">
                <div className="grid grid-cols-2 gap-4">
                  {/* ✅ CUSTOM PREMIUM STEPPERS */}
                  <PremiumNumberInput label="Row Count" value={gridConfig.rows} onChange={v => setGridConfig({...gridConfig, rows: v})} />
                  <PremiumNumberInput label="Column Count" value={gridConfig.cols} onChange={v => setGridConfig({...gridConfig, cols: v})} />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase text-zinc-500 tracking-wider">Prefix for Spot ID (Optional)</label>
                  <input type="text" placeholder="e.g. VIP, BUS, A" value={gridConfig.prefix} onChange={e=>setGridConfig({...gridConfig, prefix: e.target.value.toUpperCase()})} className="w-full bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 text-sm rounded-xl px-4 py-3 outline-none focus:border-emerald-500 font-mono transition-colors" />
                  <p className="text-[10px] text-zinc-500 font-medium">Format: Prefix-RowCol (e.g. {gridConfig.prefix ? `${gridConfig.prefix}-A1` : 'A1'})</p>
                </div>

                <DropdownTrigger label="Initial Spot Status" value={gridConfig.status} onClick={() => setActiveDropdown('gridStatus')} />
                <DropdownTrigger label={`Allowed Categories (${gridConfig.allowedCategories.length})`} value={gridConfig.allowedCategories.length > 0 ? "Multiple Selected" : "Inherit From Zone"} onClick={() => setActiveDropdown('gridCategories')} />
              </form>

              {/* Live Preview */}
              <div className="bg-zinc-50 dark:bg-black/20 rounded-2xl border border-zinc-200 dark:border-white/5 p-5 flex flex-col shadow-inner">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-4 shrink-0">Grid Structure Preview</h3>
                <div className="flex-1 overflow-auto custom-scrollbar bg-white dark:bg-[#121214] border border-zinc-200 dark:border-white/5 rounded-xl p-4 shadow-sm">
                  <div className="flex flex-col gap-2.5">
                    {Array.from({ length: Math.min(gridConfig.rows || 1, 5) }).map((_, r) => (
                      <div key={r} className="flex gap-2.5">
                        {Array.from({ length: Math.min(gridConfig.cols || 1, 5) }).map((_, c) => (
                          <div key={c} className={`h-8 w-14 shrink-0 rounded-lg border flex items-center justify-center text-[10px] font-bold font-mono transition-all ${getSpotColor(gridConfig.status)}`}>
                            {gridConfig.prefix ? `${gridConfig.prefix}-` : ''}{getRowLetter(r)}{c + 1}
                          </div>
                        ))}
                        {gridConfig.cols > 5 && <div className="h-8 flex items-center text-zinc-400 text-sm font-black pl-2 tracking-widest">...</div>}
                      </div>
                    ))}
                    {gridConfig.rows > 5 && <div className="text-zinc-400 text-sm font-black pt-2 tracking-widest">...</div>}
                  </div>
                </div>
                <div className="mt-4 text-xs text-zinc-500 font-medium flex items-center justify-between border-t border-zinc-200 dark:border-white/10 pt-4">
                  <span>Total Spots to Generate:</span>
                  <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">{(gridConfig.rows || 0) * (gridConfig.cols || 0)}</span>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-zinc-100 dark:border-white/5 shrink-0 bg-zinc-50 dark:bg-white/5">
              <button form="gridForm" type="submit" className="w-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold py-4 rounded-xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95 text-base">Confirm & Generate Grid</button>
            </div>
          </div>
        </div>
      )}

      {/* --- SPOT MANAGEMENT MODAL --- */}
      {editSpotModalOpen && editingSpot && (
        <div className="fixed inset-0 z-[7000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-900/60 dark:bg-black/80 backdrop-blur-sm" onClick={() => setEditSpotModalOpen(false)}></div>
          <div className="relative w-full max-w-md bg-white dark:bg-[#18181b] rounded-3xl shadow-2xl flex flex-col p-6 animate-in zoom-in-95 duration-200 border border-zinc-200 dark:border-white/10">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-zinc-100 dark:border-white/5">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Edit Spot</h2>
              <button onClick={() => handleDeleteSpot()} className="text-xs font-bold text-red-600 bg-red-50 dark:bg-red-500/10 px-3 py-2 rounded-xl hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors flex items-center gap-1.5"><Trash2 className="h-4 w-4" /> Delete Spot</button>
            </div>
            
            <form onSubmit={handleUpdateSpot} className="flex flex-col gap-5">
              <div className="space-y-1.5"><label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Spot ID</label><input required type="text" value={editingSpot.id} onChange={e=>setEditingSpot({...editingSpot, id: e.target.value.toUpperCase()})} className="w-full bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 text-sm rounded-xl px-4 py-3.5 outline-none focus:border-emerald-500 font-mono font-bold transition-colors" /></div>
              <DropdownTrigger label="Status" value={editingSpot.status} onClick={() => setActiveDropdown('editSpotStatus')} />
              <DropdownTrigger label={`Allowed Categories (${editingSpot.allowedCategories?.length || 0})`} value={editingSpot.allowedCategories?.length > 0 ? "Multiple Selected" : "Select..."} onClick={() => setActiveDropdown('editSpotCategories')} />
              
              <div className="flex gap-3 mt-4 pt-4 border-t border-zinc-100 dark:border-white/5">
                <button type="button" onClick={() => setEditSpotModalOpen(false)} className="flex-1 bg-zinc-100 dark:bg-white/5 text-zinc-700 dark:text-zinc-300 font-bold py-3.5 rounded-xl hover:bg-zinc-200 dark:hover:bg-white/10 transition-colors">Cancel</button>
                <button type="submit" className="flex-[2] bg-emerald-500 text-zinc-950 font-bold py-3.5 rounded-xl hover:bg-emerald-400 shadow-lg shadow-emerald-500/20 transition-all active:scale-95">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- ZONE SETTINGS MODAL --- */}
      {editZoneModalOpen && editingZone && (
        <div className="fixed inset-0 z-[7000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-900/60 dark:bg-black/80 backdrop-blur-sm" onClick={() => setEditZoneModalOpen(false)}></div>
          <div className="relative w-full max-w-md bg-white dark:bg-[#18181b] rounded-3xl shadow-2xl flex flex-col p-8 animate-in zoom-in-95 duration-200 border border-zinc-200 dark:border-white/10">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-6">Zone Settings</h2>
            
            <form onSubmit={handleUpdateZone} className="flex flex-col gap-5">
              <div className="space-y-1.5"><label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Zone Name</label><input required type="text" value={editingZone.name} onChange={e=>setEditingZone({...editingZone, name: e.target.value})} className="w-full bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 text-sm rounded-xl px-4 py-3.5 outline-none focus:border-emerald-500 transition-colors" /></div>
              
              <div className="flex gap-3 mt-4 pt-4 border-t border-zinc-100 dark:border-white/5">
                <button type="button" onClick={handleDeleteZone} className="flex-1 bg-red-500 text-white font-bold py-3.5 rounded-xl hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20">Delete Zone</button>
                <button type="submit" className="flex-[2] bg-emerald-500 text-zinc-950 font-bold py-3.5 rounded-xl hover:bg-emerald-400 transition-all active:scale-95 shadow-lg shadow-emerald-500/20">Save Zone</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- CREATE BRANCH MODAL --- */}
      {branchModalOpen && (
        <div className="fixed inset-0 z-[7000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-900/60 dark:bg-black/80 backdrop-blur-sm" onClick={() => setBranchModalOpen(false)}></div>
          <div className="relative w-full max-w-lg bg-white dark:bg-[#18181b] rounded-3xl shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200 border border-zinc-200 dark:border-white/10 overflow-hidden">
            <div className="flex items-center justify-between px-8 py-5 border-b border-zinc-100 dark:border-white/5 shrink-0">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Create New Branch</h2>
              <button onClick={() => setBranchModalOpen(false)} className="p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-xl bg-zinc-50 dark:bg-white/5 transition-colors"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-8 overflow-y-auto custom-scrollbar">
              <form id="branchForm" onSubmit={handleCreateBranch} className="flex flex-col gap-5">
                <div className="space-y-1.5"><label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Branch Name</label><input required type="text" value={newBranch.name} onChange={e=>setNewBranch({...newBranch, name: e.target.value})} className="w-full bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 text-sm rounded-xl px-4 py-3.5 outline-none focus:border-emerald-500 transition-colors" /></div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <DropdownTrigger label="Region" value={newBranch.region} onClick={() => setActiveDropdown('region')} />
                  <DropdownTrigger label="City" value={newBranch.city} onClick={() => setActiveDropdown('city')} />
                </div>

                <div className="space-y-1.5"><label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Address</label><input required type="text" value={newBranch.address} onChange={e=>setNewBranch({...newBranch, address: e.target.value})} className="w-full bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 text-sm rounded-xl px-4 py-3.5 outline-none focus:border-emerald-500 transition-colors" /></div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5"><label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Latitude</label><input required type="text" placeholder="e.g. 8.9806" value={newBranch.latitude} onChange={e=>setNewBranch({...newBranch, latitude: e.target.value})} className="w-full bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 text-sm rounded-xl px-4 py-3.5 outline-none focus:border-emerald-500 transition-colors" /></div>
                  <div className="space-y-1.5"><label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Longitude</label><input required type="text" placeholder="e.g. 38.7578" value={newBranch.longitude} onChange={e=>setNewBranch({...newBranch, longitude: e.target.value})} className="w-full bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 text-sm rounded-xl px-4 py-3.5 outline-none focus:border-emerald-500 transition-colors" /></div>
                </div>

                <DropdownTrigger label="Service Type" value={newBranch.serviceType} onClick={() => setActiveDropdown('serviceType')} />

                {newBranch.serviceType === "Day Service Only" && (
                  <div className="grid grid-cols-2 gap-4 pt-2 relative">
                    <PremiumTimePicker label="Open Time" value={newBranch.openTime} onChange={(val) => setNewBranch({...newBranch, openTime: val})} />
                    <PremiumTimePicker label="Close Time" value={newBranch.closeTime} onChange={(val) => setNewBranch({...newBranch, closeTime: val})} />
                  </div>
                )}
              </form>
            </div>
            <div className="p-6 border-t border-zinc-100 dark:border-white/5 shrink-0 bg-zinc-50 dark:bg-[#09090b]">
               <button form="branchForm" type="submit" className="w-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold py-4 rounded-xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95 text-base">Create Branch</button>
            </div>
          </div>
        </div>
      )}

      {/* --- CREATE ZONE MODAL --- */}
      {zoneModalOpen && (
        <div className="fixed inset-0 z-[7000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-900/60 dark:bg-black/80 backdrop-blur-sm" onClick={() => setZoneModalOpen(false)}></div>
          <div className="relative w-full max-w-md bg-white dark:bg-[#18181b] rounded-3xl shadow-2xl flex flex-col p-8 animate-in zoom-in-95 duration-200 border border-zinc-200 dark:border-white/10">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Add Zone</h2>
              <button onClick={() => setZoneModalOpen(false)} className="p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-xl bg-zinc-50 dark:bg-white/5 transition-colors"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleCreateZone} className="flex flex-col gap-5">
              <div className="space-y-1.5"><label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Zone Name</label><input required type="text" value={newZone.name} onChange={e=>setNewZone({...newZone, name: e.target.value})} className="w-full bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 text-sm rounded-xl px-4 py-3.5 outline-none focus:border-emerald-500 transition-colors" /></div>
              <DropdownTrigger label={`Allowed Categories (${newZone.allowedCategories.length})`} value={newZone.allowedCategories.length > 0 ? "Multiple Selected" : "Select..."} onClick={() => setActiveDropdown('categories')} />
              <button type="submit" disabled={newZone.allowedCategories.length === 0 || isSubmittingZone} className="w-full mt-4 bg-emerald-500 text-zinc-950 font-bold py-4 rounded-xl disabled:opacity-50 shadow-lg shadow-emerald-500/20 transition-all active:scale-95 text-base">Save Zone</button>
            </form>
          </div>
        </div>
      )}

      {/* --- CREATE SPOT MODAL (Manual) --- */}
      {spotModalOpen && (
        <div className="fixed inset-0 z-[7000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-900/60 dark:bg-black/80 backdrop-blur-sm" onClick={() => setSpotModalOpen(false)}></div>
          <div className="relative w-full max-w-sm bg-white dark:bg-[#18181b] rounded-3xl shadow-2xl flex flex-col p-8 animate-in zoom-in-95 duration-200 border border-zinc-200 dark:border-white/10">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Add Manual Spot</h2>
              <button onClick={() => setSpotModalOpen(false)} className="p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-xl bg-zinc-50 dark:bg-white/5 transition-colors"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleCreateSpot} className="flex flex-col gap-5">
              <div className="space-y-1.5"><label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Spot ID</label><input required type="text" placeholder="e.g. A01" value={newSpot.id} onChange={e=>setNewSpot({...newSpot, id: e.target.value.toUpperCase()})} className="w-full bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 text-sm rounded-xl px-4 py-3.5 outline-none focus:border-emerald-500 font-mono font-bold transition-colors" /></div>
              <DropdownTrigger label="Initial Status" value={newSpot.status} onClick={() => setActiveDropdown('spotStatus')} />
              <DropdownTrigger label={`Allowed Categories (${newSpot.allowedCategories.length || activeZone?.allowedCategories.length})`} value={newSpot.allowedCategories.length > 0 ? "Custom Override" : "Inherit from Zone"} onClick={() => setActiveDropdown('newSpotCategories')} />
              <button type="submit" disabled={isSubmittingSpot} className="w-full mt-4 bg-emerald-500 text-zinc-950 font-bold py-4 rounded-xl disabled:opacity-50 shadow-lg shadow-emerald-500/20 transition-all active:scale-95 text-base">Save Spot</button>
            </form>
          </div>
        </div>
      )}

      {/* --- THE GLOBAL CUSTOM SELECTOR OVERLAY --- */}
      {activeDropdown && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-900/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setActiveDropdown(null)}></div>
          <div className="relative w-full max-w-md bg-white dark:bg-[#18181b] rounded-3xl shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200 overflow-hidden border border-zinc-200 dark:border-white/10">
            <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-100 dark:border-white/5 shrink-0">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Select Option</h2>
              <button onClick={() => setActiveDropdown(null)} className="p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-xl bg-zinc-50 dark:bg-white/5 transition-colors"><X className="h-5 w-5" /></button>
            </div>
            
            <div className="p-2 overflow-y-auto overscroll-contain flex-1 custom-scrollbar">
              
              {/* Standard List Dropdowns */}
              {activeDropdown === 'region' && REGION_GROUPS.map((group) => (
                <div key={group.group} className="mb-4 last:mb-0">
                  <div className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">{group.group}</div>
                  {group.options.map(opt => (
                    <button key={opt} onClick={() => { setNewBranch({...newBranch, region: opt, city: CITIES_BY_REGION[opt][0]}); setActiveDropdown(null); }} className="flex w-full px-4 py-3.5 rounded-2xl text-sm font-medium justify-between hover:bg-zinc-50 dark:hover:bg-white/5 outline-none transition-colors">
                      {opt} {newBranch.region === opt && <Check className="h-4 w-4 text-emerald-500" />}
                    </button>
                  ))}
                </div>
              ))}

              {activeDropdown === 'city' && CITIES_BY_REGION[newBranch.region]?.map(opt => (
                <button key={opt} onClick={() => { setNewBranch({...newBranch, city: opt}); setActiveDropdown(null); }} className="flex w-full px-4 py-3.5 rounded-2xl text-sm font-medium justify-between hover:bg-zinc-50 dark:hover:bg-white/5 outline-none transition-colors">
                  {opt} {newBranch.city === opt && <Check className="h-4 w-4 text-emerald-500" />}
                </button>
              ))}

              {activeDropdown === 'serviceType' && ["Day Service Only", "24 Hour Service"].map(opt => (
                <button key={opt} onClick={() => { setNewBranch({...newBranch, serviceType: opt}); setActiveDropdown(null); }} className="flex w-full px-4 py-3.5 rounded-2xl text-sm font-medium justify-between hover:bg-zinc-50 dark:hover:bg-white/5 outline-none transition-colors">
                  {opt} {newBranch.serviceType === opt && <Check className="h-4 w-4 text-emerald-500" />}
                </button>
              ))}

              {activeDropdown === 'spotStatus' && ["Free", "Reserved", "Occupied"].map(opt => (
                <button key={opt} onClick={() => { setNewSpot({...newSpot, status: opt}); setActiveDropdown(null); }} className="flex w-full px-4 py-3.5 rounded-2xl text-sm font-medium justify-between hover:bg-zinc-50 dark:hover:bg-white/5 outline-none transition-colors">
                  {opt} {newSpot.status === opt && <Check className="h-4 w-4 text-emerald-500" />}
                </button>
              ))}
              
              {activeDropdown === 'gridStatus' && ["Free", "Reserved", "Occupied"].map(opt => (
                <button key={opt} onClick={() => { setGridConfig({...gridConfig, status: opt}); setActiveDropdown(null); }} className="flex w-full px-4 py-3.5 rounded-2xl text-sm font-medium justify-between hover:bg-zinc-50 dark:hover:bg-white/5 outline-none transition-colors">
                  {opt} {gridConfig.status === opt && <Check className="h-4 w-4 text-emerald-500" />}
                </button>
              ))}
              
              {activeDropdown === 'editSpotStatus' && ["Free", "Reserved", "Occupied"].map(opt => (
                <button key={opt} onClick={() => { setEditingSpot({...editingSpot, status: opt}); setActiveDropdown(null); }} className="flex w-full px-4 py-3.5 rounded-2xl text-sm font-medium justify-between hover:bg-zinc-50 dark:hover:bg-white/5 outline-none transition-colors">
                  {opt} {editingSpot.status === opt && <Check className="h-4 w-4 text-emerald-500" />}
                </button>
              ))}

              {/* Multi-Select Category Dropdowns */}
              {(activeDropdown === 'categories' || activeDropdown === 'gridCategories' || activeDropdown === 'editSpotCategories' || activeDropdown === 'newSpotCategories') && (
                <div className="flex flex-col h-full">
                  <div className="flex-1 overflow-y-auto custom-scrollbar pb-2">
                    {VEHICLE_CATEGORIES.map(cat => {
                      let isSelected = false;
                      if (activeDropdown === 'categories') isSelected = newZone.allowedCategories.includes(cat);
                      if (activeDropdown === 'gridCategories') isSelected = gridConfig.allowedCategories.includes(cat);
                      if (activeDropdown === 'editSpotCategories') isSelected = editingSpot.allowedCategories?.includes(cat);
                      if (activeDropdown === 'newSpotCategories') isSelected = newSpot.allowedCategories?.includes(cat);

                      return (
                        <button key={cat} onClick={(e) => {
                          e.preventDefault();
                          if (activeDropdown === 'categories') {
                            setNewZone({...newZone, allowedCategories: isSelected ? newZone.allowedCategories.filter(c => c !== cat) : [...newZone.allowedCategories, cat]});
                          }
                          if (activeDropdown === 'gridCategories') {
                            setGridConfig({...gridConfig, allowedCategories: isSelected ? gridConfig.allowedCategories.filter(c => c !== cat) : [...gridConfig.allowedCategories, cat]});
                          }
                          if (activeDropdown === 'editSpotCategories') {
                            const arr = editingSpot.allowedCategories || [];
                            setEditingSpot({...editingSpot, allowedCategories: isSelected ? arr.filter(c => c !== cat) : [...arr, cat]});
                          }
                          if (activeDropdown === 'newSpotCategories') {
                            const arr = newSpot.allowedCategories || [];
                            setNewSpot({...newSpot, allowedCategories: isSelected ? arr.filter(c => c !== cat) : [...arr, cat]});
                          }
                        }} className="flex w-full px-4 py-3.5 rounded-2xl text-sm font-medium justify-between items-center hover:bg-zinc-50 dark:hover:bg-white/5 outline-none text-left transition-colors">
                          <span className="truncate pr-4 leading-snug">{cat}</span>
                          <div className={`h-5 w-5 shrink-0 rounded border transition-colors flex items-center justify-center ${isSelected ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm' : 'border-zinc-300 dark:border-zinc-600 bg-white dark:bg-[#121214]'}`}>{isSelected && <Check className="h-3.5 w-3.5" />}</div>
                        </button>
                      );
                    })}
                  </div>
                  <div className="p-4 border-t border-zinc-100 dark:border-white/5 mt-2 shrink-0">
                    <button onClick={() => setActiveDropdown(null)} className="w-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold py-3.5 rounded-xl transition-all active:scale-95 shadow-lg shadow-emerald-500/20 text-base">Done</button>
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
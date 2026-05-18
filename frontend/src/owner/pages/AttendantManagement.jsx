/**
 * COMPONENT: AttendantManagement
 * PURPOSE: Manage parking attendants, enforcing Fayda ID formatting, Ethio Telecom numbers, strong passwords, branch assignment, and premium custom shift timings.
 * UX: Validates inputs on blur to avoid annoying the user while they are actively typing.
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Users, Plus, Trash2, Edit2, Mail, Lock, 
  Phone, MapPin, X, Key, ShieldCheck, AlertCircle, 
  RefreshCw, Eye, EyeOff, UploadCloud, Check, ChevronDown, Clock, Sun, Moon, Sunrise,
  Filter, ChevronRight, Loader2
} from "lucide-react";
import { apiClient } from "../../api/apiClient";
import { useAuth } from "../../context/AuthContext";

// --- REQUIRED DATA STRUCTURES FOR DROPDOWNS ---
const REGION_GROUPS = [
  { group: "FEDERAL CITIES", options: ["Addis Ababa", "Dire Dawa"] },
  { group: "MAJOR REGIONS", options: ["Oromia Region", "Amhara Region", "Tigray Region", "Somali Region", "Sidama Region"] }
];

const CITIES_BY_REGION = {
  "Addis Ababa": ["Addis Ababa"], "Dire Dawa": ["Dire Dawa"],
  "Oromia Region": ["Adama"], "Amhara Region": ["Bahir Dar"],
  "Tigray Region": ["Mekelle"], "Somali Region": ["Jigjiga"], "Sidama Region": ["Hawassa"]
};

const isValidObjectId = (id) => typeof id === "string" && /^[a-fA-F0-9]{24}$/.test(id);

const formatFaydaForForm = (faydaId) => {
  const digits = String(faydaId ?? "").replace(/\D/g, "").slice(0, 16);
  return digits.match(/.{1,4}/g)?.join(" ") || "";
};

const formatPhoneForForm = (phone) => {
  // Backend stores: +251 9XX XXX XXX (or similar). UI expects 9 digits only.
  const digits = String(phone ?? "").replace(/\D/g, "");
  const withoutCountry = digits.startsWith("251") ? digits.slice(3) : digits;
  return withoutCountry.slice(0, 9);
};

const formatPhoneForBackend = (nineDigits) => {
  const d = String(nineDigits ?? "").replace(/\D/g, "").slice(0, 9);
  return `+251 ${d.substring(0, 3)} ${d.substring(3, 6)} ${d.substring(6, 9)}`;
};

const lotsMatchingCity = (lots, city) =>
  lots.filter((l) => String(l.city || "").trim() === String(city || "").trim());

/** Prefer lots whose DB city matches the form city; if none match (common with UI presets), list all owner lots. */
const lotsForBranchSelect = (lots, city) => {
  const matched = lotsMatchingCity(lots, city);
  return matched.length > 0 ? matched : lots;
};

const DropdownTrigger = ({ label, value, onClick, disabled }) => (
  <div className="space-y-1.5 w-full min-w-0">
    <label className="text-xs md:text-sm font-bold uppercase tracking-wider text-zinc-500">{label}</label>
    <button 
      type="button" 
      onClick={onClick} 
      disabled={disabled} 
      className={`w-full min-w-0 flex items-center justify-between bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white text-sm md:text-base rounded-xl px-4 py-3 outline-none transition-all ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-emerald-500 cursor-pointer'}`}
    >
      <span className="truncate pr-4">{value || "Select..."}</span>
      <ChevronDown className="h-5 w-5 text-zinc-400 shrink-0" />
    </button>
  </div>
);

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
    <div className="space-y-1.5 relative w-full min-w-0">
      <label className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-500">{label}</label>
      <button 
        type="button" onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between bg-white dark:bg-[#121214] border border-emerald-200 dark:border-emerald-500/30 text-zinc-900 dark:text-white text-sm md:text-base rounded-xl px-4 py-3 outline-none transition-all ${isOpen ? 'border-emerald-500 ring-1 ring-emerald-500' : 'hover:border-emerald-500'}`}
      >
        <span className="truncate pr-4 font-mono font-bold tracking-wide">{value}</span>
        <Clock className={`h-4 w-4 shrink-0 ${isOpen ? 'text-emerald-500' : 'text-zinc-400'}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setIsOpen(false)}></div>
          <div className="absolute z-[9999] bottom-[calc(100%+8px)] left-0 p-2 bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-white/10 rounded-2xl shadow-2xl flex gap-1 sm:gap-2 animate-in fade-in slide-in-from-bottom-2 w-[calc(100vw-32px)] sm:w-[260px] max-w-[280px]">
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

const getShiftLabel = (start, end) => {
  if (start === "06:00 AM" && end === "02:00 PM") return "Morning";
  if (start === "02:00 PM" && end === "10:00 PM") return "Afternoon";
  if (start === "10:00 PM" && end === "06:00 AM") return "Night";
  if (start === "08:00 AM" && end === "06:00 PM") return "Full Day";
  return null; 
};

const AttendantAvatar = ({ name, src }) => {
  if (src) {
    return (
      <img src={src} alt={name} className="h-8 w-8 md:h-10 md:w-10 rounded-full border border-zinc-200 dark:border-white/10 object-cover" />
    );
  }
  const initials = String(name || "?").split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className="h-8 w-8 md:h-10 md:w-10 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-xs font-black text-emerald-700 dark:text-emerald-400">
      {initials}
    </div>
  );
};

export default function AttendantManagement() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [attendants, setAttendants] = useState([]);
  const [branches, setBranches] = useState([]);
  const [branchFilter, setBranchFilter] = useState("all");
  const [listLoading, setListLoading] = useState(true);
  const [ownerLots, setOwnerLots] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingAttendant, setEditingAttendant] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: "", email: "", phone: "", faydaId: "", address: "", password: "",
    region: "Addis Ababa", city: "Addis Ababa", branch: "", lotId: "",
    shiftStart: "06:00 AM", shiftEnd: "02:00 PM"
  });

  const [errors, setErrors] = useState({});
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const fileInputRef = useRef(null);

  const loadAttendants = useCallback(async (branchId = branchFilter) => {
    setListLoading(true);
    try {
      const query =
        branchId && branchId !== "all"
          ? `?branchId=${encodeURIComponent(branchId)}`
          : "";
      const [lots, branchList, attendantsResponse] = await Promise.all([
        apiClient.get("/parking/lots"),
        apiClient.get("/owner/attendants/branches"),
        apiClient.get(`/owner/attendants${query}`),
      ]);

      const resolvedLots = Array.isArray(lots) ? lots : [];
      const list = Array.isArray(attendantsResponse) ? attendantsResponse : [];

      setOwnerLots(resolvedLots);
      setBranches(Array.isArray(branchList) ? branchList : []);
      setAttendants(
        list.map((row) => ({
          id: row.id,
          name: row.fullName,
          email: row.email || "-",
          phone: row.phone || "-",
          faydaId: row.employeeId || "-",
          branch: row.branch?.name || "Unassigned",
          lotId: row.branch?.id || "",
          shiftStart: row.shiftStart || "--:--",
          shiftEnd: row.shiftEnd || "--:--",
          status:
            row.status === "suspended"
              ? "Suspended"
              : row.currentShiftStatus === "on_shift"
                ? "On Shift"
                : "Active",
          avatar: row.profileImage || null,
          totalRevenueGenerated: row.totalRevenueGenerated ?? 0,
          totalShiftsWorked: row.totalShiftsWorked ?? 0,
          address: row.address || "-",
        }))
      );
    } catch {
      setOwnerLots([]);
      setBranches([]);
      setAttendants([]);
    } finally {
      setListLoading(false);
    }
  }, [branchFilter]);

  useEffect(() => {
    loadAttendants(branchFilter);
  }, [branchFilter, loadAttendants]);

  const handleBranchFilterChange = (value) => {
    setBranchFilter(value);
  };

  useEffect(() => {
    if (!isModalOpen || ownerLots.length === 0) return;
    setFormData((prev) => {
      if (prev.lotId) return prev;
      const first = lotsForBranchSelect(ownerLots, prev.city)[0];
      if (!first) return prev;
      return { ...prev, branch: first.name, lotId: String(first._id) };
    });
  }, [isModalOpen, ownerLots]);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert("Profile image must be 10MB or smaller.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setAvatarPreview(URL.createObjectURL(file));
    setAvatarFile(file);
  };

  const handleRemoveImage = (e) => {
    e.preventDefault();
    setAvatarPreview(null);
    setAvatarFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // --- FAYDA ID LOGIC ---
  const handleFaydaChange = (e) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 16) val = val.slice(0, 16);
    const formatted = val.match(/.{1,4}/g)?.join(' ') || val;
    setFormData({ ...formData, faydaId: formatted });
    setErrors((prev) => ({ ...prev, faydaId: null })); // Clear error while typing
  };

  const handleFaydaBlur = () => {
    const val = formData.faydaId.replace(/\D/g, '');
    if (val && val.length !== 16) {
      setErrors((prev) => ({ ...prev, faydaId: "Fayda ID must be exactly 16 digits." }));
    }
  };

  // --- EMAIL LOGIC ---
  const handleEmailChange = (e) => {
    setFormData({ ...formData, email: e.target.value });
    setErrors((prev) => ({ ...prev, email: null })); // Clear error while typing
  };

  const handleEmailBlur = () => {
    const val = formData.email;
    if (val && !val.toLowerCase().endsWith("@gmail.com")) {
      setErrors((prev) => ({ ...prev, email: "Only @gmail.com addresses are allowed." }));
    }
  };

  // --- PHONE LOGIC ---
  const handlePhoneChange = (e) => {
    let val = e.target.value.replace(/\D/g, ''); 
    if (val.length > 9) val = val.slice(0, 9);
    setFormData({ ...formData, phone: val });
    setErrors((prev) => ({ ...prev, phone: null })); // Clear error while typing
  };

  const handlePhoneBlur = () => {
    const val = formData.phone;
    if (val) {
      if (val.length > 0 && val[0] !== '9' && val[0] !== '7') {
        setErrors((prev) => ({ ...prev, phone: "Number must start with 9 or 7." }));
      } else if (val.length < 9) {
        setErrors((prev) => ({ ...prev, phone: "Incomplete phone number. Must be 9 digits." }));
      }
    }
  };

  // --- PASSWORD LOGIC ---
  const checkPasswordStrength = (pass) => {
    if (!pass) return null;
    if (pass.length < 8 || !/[A-Z]/.test(pass) || !/[a-z]/.test(pass) || !/[0-9]/.test(pass) || !/[!@#$%^&*]/.test(pass)) {
      return "Requires 8+ chars, upper, lower, number, and special char.";
    }
    return null;
  };

  const handlePasswordChange = (e) => {
    setFormData({ ...formData, password: e.target.value });
    setErrors((prev) => ({ ...prev, password: null })); // Clear error while typing
  };

  const handlePasswordBlur = () => {
    if (formData.password) {
      setErrors((prev) => ({ ...prev, password: checkPasswordStrength(formData.password) }));
    }
  };

  const generatePassword = (e) => {
    e.preventDefault(); 
    const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lower = "abcdefghijklmnopqrstuvwxyz";
    const num = "0123456789";
    const special = "!@#$%^&*";
    const all = upper + lower + num + special;
    
    let pass = upper[Math.floor(Math.random() * upper.length)] + lower[Math.floor(Math.random() * lower.length)] + num[Math.floor(Math.random() * num.length)] + special[Math.floor(Math.random() * special.length)];
    for (let i = 0; i < 8; i++) pass += all[Math.floor(Math.random() * all.length)];
    pass = pass.split('').sort(() => 0.5 - Math.random()).join('');
    
    setFormData((prev) => ({ ...prev, password: pass }));
    setErrors((prev) => ({ ...prev, password: null }));
    setShowPassword(true); 
  };

  const setQuickShift = (start, end) => {
    setFormData(prev => ({ ...prev, shiftStart: start, shiftEnd: end }));
  };

  const openEditModal = (att) => {
    const lot = ownerLots.find((l) => String(l?._id) === String(att?.lotId));

    setEditingAttendant(att);
    setFormData({
      name: att?.name || "",
      email: att?.email || "",
      phone: formatPhoneForForm(att?.phone || ""),
      faydaId: formatFaydaForForm(att?.faydaId || ""),
      address: att?.address && att.address !== "-" ? att.address : "",
      region: lot?.region || formData.region,
      city: lot?.city || formData.city,
      branch: lot?.name || att?.branch || "",
      lotId: att?.lotId || (lot ? String(lot._id) : ""),
      password: "",
      shiftStart: att?.shiftStart || "06:00 AM",
      shiftEnd: att?.shiftEnd || "02:00 PM",
    });
    setErrors({});
    setActiveDropdown(null);
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setEditingAttendant(null);
    setErrors({});
    setActiveDropdown(null);
  };

  const handleUpdateAttendant = async (e) => {
    e.preventDefault();
    if (editSubmitting) return;
    if (!editingAttendant?.id) return;

    const fVal = formData.faydaId.replace(/\D/g, "");
    const eVal = formData.email;
    const pVal = formData.phone;

    let hasErrors = false;
    if (fVal.length !== 16) hasErrors = true;
    if (!eVal.toLowerCase().endsWith("@gmail.com")) hasErrors = true;
    if (pVal.length !== 9 || (pVal[0] !== "9" && pVal[0] !== "7")) hasErrors = true;
    if (!formData.shiftStart || !formData.shiftEnd) hasErrors = true;
    if (!formData.lotId || !isValidObjectId(formData.lotId)) hasErrors = true;

    if (hasErrors) {
      handleFaydaBlur();
      handleEmailBlur();
      handlePhoneBlur();
      alert(
        !formData.lotId || !isValidObjectId(formData.lotId)
          ? "Please select a valid parking lot (branch) before submitting."
          : "Please fix the errors and ensure a branch and shift time are assigned before submitting."
      );
      return;
    }

    const formattedPhone = formatPhoneForBackend(pVal);
    const payload = {
      name: formData.name.trim(),
      email: formData.email.trim().toLowerCase(),
      attendant: {
        lotId: formData.lotId,
        phone: formattedPhone,
        faydaId: fVal,
        shiftStart: formData.shiftStart,
        shiftEnd: formData.shiftEnd,
        address: formData.address.trim(),
      },
    };

    setEditSubmitting(true);
    try {
      await apiClient.patch(`/users/attendants/${editingAttendant.id}`, payload);

      const lot = ownerLots.find((l) => String(l?._id) === String(formData.lotId));
      const updatedLocal = {
        ...editingAttendant,
        name: payload.name,
        email: payload.email,
        phone: payload.attendant.phone,
        faydaId: payload.attendant.faydaId,
        address: payload.attendant.address,
        lotId: String(payload.attendant.lotId),
        branch: lot?.name || formData.branch,
        shiftStart: payload.attendant.shiftStart,
        shiftEnd: payload.attendant.shiftEnd,
      };

      await loadAttendants(branchFilter);
      alert("Attendant updated successfully.");
      closeEditModal();
    } catch (err) {
      alert(err?.message || "Failed to update attendant.");
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDeleteAttendant = async (att) => {
    if (!att?.id) return;
    const confirmed = window.confirm(`Delete attendant "${att.name}"?`);
    if (!confirmed) return;

    try {
      await apiClient.delete(`/users/attendants/${att.id}`);
      await loadAttendants(branchFilter);
      alert("Attendant deleted successfully.");
      if (editingAttendant?.id === att.id) closeEditModal();
    } catch (err) {
      alert(err?.message || "Failed to delete attendant.");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    const fVal = formData.faydaId.replace(/\D/g, "");
    const eVal = formData.email;
    const pVal = formData.phone;
    const passVal = formData.password;

    let hasErrors = false;
    if (fVal.length !== 16) hasErrors = true;
    if (!eVal.toLowerCase().endsWith("@gmail.com")) hasErrors = true;
    if (pVal.length !== 9 || (pVal[0] !== "9" && pVal[0] !== "7")) hasErrors = true;
    if (checkPasswordStrength(passVal)) hasErrors = true;
    if (!formData.shiftStart || !formData.shiftEnd) hasErrors = true;
    if (!formData.lotId || !isValidObjectId(formData.lotId)) hasErrors = true;

    if (hasErrors) {
      handleFaydaBlur();
      handleEmailBlur();
      handlePhoneBlur();
      handlePasswordBlur();
      alert(
        !formData.lotId || !isValidObjectId(formData.lotId)
          ? "Please select a valid parking lot (branch) before submitting."
          : "Please fix the errors and ensure a branch and shift time are assigned before submitting."
      );
      return;
    }

    const formattedPhone = `+251 ${formData.phone.substring(0, 3)} ${formData.phone.substring(3, 6)} ${formData.phone.substring(6, 9)}`;

    const payload = {
      name: formData.name.trim(),
      email: formData.email.trim().toLowerCase(),
      password: formData.password,
      attendant: {
        lotId: formData.lotId,
        phone: formattedPhone,
        faydaId: fVal,
        shiftStart: formData.shiftStart,
        shiftEnd: formData.shiftEnd,
        address: formData.address.trim(),
      },
    };
    setSubmitting(true);
    try {
      const created = await apiClient.post("/users/attendants", payload);
      const createdUserId = created?._id || created?.id || null;
      let uploadedAvatarUrl = created?.avatarUrl || null;
      if (avatarFile && createdUserId) {
        try {
          const fd = new FormData();
          fd.append("image", avatarFile);
          const uploaded = await apiClient.postFormData(
            `/uploads/users/${createdUserId}/profile-image`,
            fd
          );
          uploadedAvatarUrl = uploaded?.url || uploadedAvatarUrl;
        } catch (uploadErr) {
          console.error("Attendant profile upload failed:", uploadErr);
          alert(
            "Attendant was created, but profile image upload failed. You can upload it later from profile settings."
          );
        }
      }
      const lot = ownerLots.find((l) => String(l._id) === String(created?.attendant?.lotId ?? formData.lotId));
      const displayBranch = lot?.name || formData.branch;
      const avatar = uploadedAvatarUrl || avatarPreview || null;

      const newAttendant = {
        id: String(created?._id ?? created?.id ?? `att_${Date.now()}`),
        name: created?.name ?? formData.name,
        email: created?.email ?? formData.email,
        phone: formattedPhone,
        faydaId: formData.faydaId,
        address: formData.address,
        lotId: String(created?.attendant?.lotId ?? formData.lotId),
        branch: displayBranch,
        shiftStart: formData.shiftStart,
        shiftEnd: formData.shiftEnd,
        status: created?.status === "inactive" ? "Inactive" : "Active",
        avatar,
      };

      await loadAttendants(branchFilter);
      alert("Attendant registered successfully.");
      closeModal();
    } catch (err) {
      alert(err?.message || "Failed to register attendant.");
    } finally {
      setSubmitting(false);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setFormData({
      name: "",
      email: "",
      phone: "",
      faydaId: "",
      address: "",
      password: "",
      region: "Addis Ababa",
      city: "Addis Ababa",
      branch: "",
      lotId: "",
      shiftStart: "06:00 AM",
      shiftEnd: "02:00 PM",
    });
    setAvatarPreview(null);
    setAvatarFile(null);
    setErrors({});
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="w-full flex flex-col gap-6 animate-in fade-in duration-500 relative">
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #3f3f46; border-radius: 10px; }
        .custom-scrollbar { scrollbar-width: thin; scrollbar-color: #3f3f46 transparent; }
      `}</style>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-zinc-900 dark:text-white tracking-tight">Attendant Management</h1>
          <p className="text-sm md:text-base text-zinc-500 dark:text-zinc-400 mt-1">Manage personnel, Fayda IDs, custom shift timings, and branch assignments.</p>
        </div>
        <button type="button" onClick={() => setIsModalOpen(true)} className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-emerald-500/20 outline-none transition-transform active:scale-95">
          <Plus className="h-5 w-5" /> Add Attendant
        </button>
      </div>

      <div className="bg-white dark:bg-[#121214] rounded-2xl border border-zinc-200 dark:border-white/5 shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 md:p-5 border-b border-zinc-100 dark:border-white/5 bg-zinc-50 dark:bg-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-zinc-500" />
            <h2 className="text-xs md:text-sm font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Registered Attendants</h2>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-zinc-400 shrink-0" />
            <select
              value={branchFilter}
              onChange={(e) => handleBranchFilterChange(e.target.value)}
              className="bg-white dark:bg-[#121214] border border-zinc-200 dark:border-white/10 text-sm font-bold rounded-xl px-3 py-2 outline-none focus:border-emerald-500 min-w-[160px]"
            >
              <option value="all">All Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        </div>

        {listLoading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
            <p className="text-sm font-bold text-zinc-500">Loading attendants...</p>
          </div>
        ) : attendants.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 px-4 text-center">
            <Users className="h-10 w-10 text-zinc-300" />
            <p className="text-sm font-bold text-zinc-500">No attendants found for this filter.</p>
          </div>
        ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1100px]">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-white/10 text-[10px] md:text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                <th className="px-4 md:px-6 py-4 font-semibold">Attendant</th>
                <th className="px-4 md:px-6 py-4 font-semibold">Contact Info</th>
                <th className="px-4 md:px-6 py-4 font-semibold">Fayda ID (FAN)</th>
                <th className="px-4 md:px-6 py-4 font-semibold">Assigned Branch</th>
                <th className="px-4 md:px-6 py-4 font-semibold">Shift Time</th>
                <th className="px-4 md:px-6 py-4 font-semibold">Performance</th>
                <th className="px-4 md:px-6 py-4 font-semibold">Status</th>
                <th className="px-4 md:px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-xs md:text-sm">
              {attendants.map((att) => {
                const shiftLabel = getShiftLabel(att.shiftStart, att.shiftEnd);

                return (
                  <tr
                    key={att.id}
                    onClick={() => navigate(`/owner/attendants/${att.id}`)}
                    className="border-b border-zinc-100 dark:border-white/5 last:border-0 hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors cursor-pointer group"
                  >
                    <td className="px-4 md:px-6 py-4">
                      <div className="flex items-center gap-3">
                        <AttendantAvatar name={att.name} src={att.avatar} />
                        <span className="font-bold text-zinc-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">{att.name}</span>
                        <ChevronRight className="h-4 w-4 text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      </div>
                    </td>
                    <td className="px-4 md:px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-zinc-900 dark:text-white flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-zinc-400" /> {att.email}</span>
                        <span className="text-zinc-500 flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-zinc-400" /> {att.phone}</span>
                      </div>
                    </td>
                    <td className="px-4 md:px-6 py-4 font-mono font-medium text-zinc-600 dark:text-zinc-300">{att.faydaId}</td>
                    <td className="px-4 md:px-6 py-4 font-medium text-zinc-700 dark:text-zinc-300">{att.branch}</td>
                    
                    <td className="px-4 md:px-6 py-4 font-medium text-zinc-700 dark:text-zinc-300">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-emerald-500 shrink-0" />
                        <div className="flex flex-col min-w-0">
                          {shiftLabel ? (
                            <>
                              <span className="font-bold text-sm text-zinc-900 dark:text-white">{shiftLabel}</span>
                              <span className="text-[10px] text-zinc-500 truncate">{att.shiftStart} - {att.shiftEnd}</span>
                            </>
                          ) : (
                            <>
                              <span className="font-bold text-xs sm:text-sm text-zinc-900 dark:text-white">{att.shiftStart}</span>
                              <span className="text-[10px] sm:text-xs text-zinc-500 truncate">to {att.shiftEnd}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="px-4 md:px-6 py-4">
                      <div className="flex flex-col gap-0.5 text-xs">
                        <span className="font-bold text-zinc-900 dark:text-white">{Number(att.totalRevenueGenerated || 0).toFixed(2)} ETB</span>
                        <span className="text-zinc-500">{att.totalShiftsWorked ?? 0} shifts</span>
                      </div>
                    </td>
                    <td className="px-4 md:px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-1 md:px-2.5 md:py-1 rounded-md text-[10px] md:text-xs font-bold ${att.status === "On Shift" ? "bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400" : att.status === "Suspended" ? "bg-red-100 dark:bg-red-500/20 text-red-600" : "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400"}`}>
                        <ShieldCheck className="h-3 w-3 mr-1" /> {att.status}
                      </span>
                    </td>
                    <td className="px-4 md:px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        <button title="Reset Password" type="button" className="p-2 text-zinc-400 hover:text-blue-500 bg-zinc-100 dark:bg-white/5 rounded-lg transition-colors outline-none"><Key className="h-4 w-4" /></button>
                        <button
                          title="Edit"
                          type="button"
                          onClick={() => openEditModal(att)}
                          className="p-2 text-zinc-400 hover:text-emerald-500 bg-zinc-100 dark:bg-white/5 rounded-lg transition-colors outline-none"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          title="Delete"
                          type="button"
                          onClick={() => handleDeleteAttendant(att)}
                          className="p-2 text-zinc-400 hover:text-red-500 bg-zinc-100 dark:bg-white/5 rounded-lg transition-colors outline-none"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[7000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-900/60 dark:bg-black/80 backdrop-blur-sm" onClick={closeModal}></div>
          <div className="relative w-full max-w-2xl bg-white dark:bg-[#18181b] rounded-2xl shadow-2xl border border-zinc-200 dark:border-white/10 overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-zinc-100 dark:border-white/5 shrink-0">
              <h2 className="text-lg md:text-xl font-bold text-zinc-900 dark:text-white">Register New Attendant</h2>
              <button type="button" onClick={closeModal} className="p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-md transition-colors outline-none"><X className="h-5 w-5" /></button>
            </div>

            <div className="p-4 md:p-6 overflow-y-auto flex-1 custom-scrollbar">
              <form id="attendantForm" onSubmit={handleSubmit} className="flex flex-col gap-4 md:gap-5">
                
                <div className="flex justify-center mb-2">
                  <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
                  {avatarPreview ? (
                    <div className="relative">
                      <img src={avatarPreview} alt="Preview" className="h-20 w-20 md:h-24 md:w-24 rounded-full object-cover border-4 border-emerald-500 shadow-xl" />
                      <button type="button" onClick={handleRemoveImage} className="absolute -top-1 -right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 shadow-md transition-transform hover:scale-110 outline-none"><X className="h-3 w-3 md:h-4 md:w-4" /></button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="h-20 w-20 md:h-24 md:w-24 rounded-full border-2 border-dashed border-zinc-300 dark:border-zinc-600 flex flex-col items-center justify-center text-zinc-400 hover:text-emerald-500 hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors cursor-pointer bg-zinc-50 dark:bg-white/5 outline-none">
                      <UploadCloud className="h-5 w-5 md:h-6 md:w-6 mb-1" />
                      <span className="text-[10px] font-bold uppercase">Upload Photo</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs md:text-sm font-bold uppercase tracking-wider text-zinc-500">Full Name</label>
                    <input required type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="e.g. Kebede Alemu" className="w-full bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 text-sm md:text-base rounded-xl px-4 py-3 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs md:text-sm font-bold uppercase tracking-wider text-zinc-500">Fayda ID (FAN)</label>
                    <input 
                      required 
                      type="text" 
                      value={formData.faydaId} 
                      onChange={handleFaydaChange} 
                      onBlur={handleFaydaBlur}
                      placeholder="XXXX XXXX XXXX XXXX" 
                      className={`w-full bg-zinc-50 dark:bg-white/5 border ${errors.faydaId ? 'border-red-500' : 'border-zinc-200 dark:border-white/10'} text-sm md:text-base font-mono tracking-widest rounded-xl px-4 py-3 outline-none focus:ring-1 transition-all ${errors.faydaId ? 'focus:ring-red-500' : 'focus:border-emerald-500 focus:ring-emerald-500'}`} 
                    />
                    {errors.faydaId && <p className="text-[10px] md:text-xs text-red-500 font-medium flex items-center gap-1 mt-1 animate-in fade-in"><AlertCircle className="h-3 w-3" /> {errors.faydaId}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs md:text-sm font-bold uppercase tracking-wider text-zinc-500">Gmail Address</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                      <input 
                        required 
                        type="email" 
                        value={formData.email} 
                        onChange={handleEmailChange} 
                        onBlur={handleEmailBlur}
                        placeholder="attendant@gmail.com" 
                        className={`w-full bg-zinc-50 dark:bg-white/5 border ${errors.email ? 'border-red-500' : 'border-zinc-200 dark:border-white/10'} text-sm md:text-base rounded-xl pl-10 pr-4 py-3 outline-none focus:ring-1 transition-all ${errors.email ? 'focus:ring-red-500' : 'focus:border-emerald-500 focus:ring-emerald-500'}`} 
                      />
                    </div>
                    {errors.email && <p className="text-[10px] md:text-xs text-red-500 font-medium flex items-center gap-1 mt-1 animate-in fade-in"><AlertCircle className="h-3 w-3" /> {errors.email}</p>}
                  </div>
                  
                  <div className="space-y-1.5">
                    <label className="text-xs md:text-sm font-bold uppercase tracking-wider text-zinc-500">Phone Number</label>
                    <div className="relative flex items-center">
                      <div className="absolute left-0 top-0 bottom-0 flex items-center justify-center bg-zinc-100 dark:bg-white/5 border-r border-zinc-200 dark:border-white/10 px-3 rounded-l-xl z-10">
                        <span className="text-sm md:text-base font-mono font-bold text-zinc-500">+251</span>
                      </div>
                      <input 
                        required 
                        type="tel" 
                        value={formData.phone} 
                        onChange={handlePhoneChange} 
                        onBlur={handlePhoneBlur}
                        placeholder="9XX XXX XXX" 
                        className={`w-full bg-zinc-50 dark:bg-white/5 border ${errors.phone ? 'border-red-500' : 'border-zinc-200 dark:border-white/10'} text-sm md:text-base font-mono tracking-widest rounded-xl pl-16 pr-4 py-3 outline-none focus:ring-1 transition-all ${errors.phone ? 'focus:ring-red-500' : 'focus:border-emerald-500 focus:ring-emerald-500'}`} 
                      />
                    </div>
                    {errors.phone && <p className="text-[10px] md:text-xs text-red-500 font-medium flex items-center gap-1 mt-1 animate-in fade-in"><AlertCircle className="h-3 w-3" /> {errors.phone}</p>}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs md:text-sm font-bold uppercase tracking-wider text-zinc-500">Physical Address</label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                    <input required type="text" value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} placeholder="e.g. Bole, Kebele 03" className="w-full bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 text-sm md:text-base rounded-xl pl-10 pr-4 py-3 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" />
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-500/5 mt-2">
                  <h3 className="text-xs md:text-sm font-bold text-emerald-700 dark:text-emerald-400 mb-4 flex items-center gap-2">
                    <MapPin className="h-4 w-4" /> Assignment & Custom Shift Details
                  </h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full min-w-0 mb-5">
                    <DropdownTrigger label="Region" value={formData.region} onClick={() => setActiveDropdown('region')} />
                    <DropdownTrigger label="City" value={formData.city} onClick={() => setActiveDropdown('city')} disabled={!formData.region} />
                    <DropdownTrigger label="Assigned Branch" value={formData.branch} onClick={() => setActiveDropdown('branch')} disabled={!formData.city} />
                  </div>

                  <div className="border-t border-emerald-200 dark:border-emerald-500/20 pt-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
                      <label className="text-xs md:text-sm font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-500">Custom Shift Timing</label>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => setQuickShift("06:00 AM", "02:00 PM")} className="px-2 py-1 rounded border border-emerald-300 dark:border-emerald-500/30 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition flex items-center gap-1 active:scale-95"><Sunrise className="h-3 w-3" /> Morning</button>
                        <button type="button" onClick={() => setQuickShift("02:00 PM", "10:00 PM")} className="px-2 py-1 rounded border border-amber-300 dark:border-amber-500/30 text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-500/20 transition flex items-center gap-1 active:scale-95"><Sun className="h-3 w-3" /> Afternoon</button>
                        <button type="button" onClick={() => setQuickShift("10:00 PM", "06:00 AM")} className="px-2 py-1 rounded border border-indigo-300 dark:border-indigo-500/30 text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition flex items-center gap-1 active:scale-95"><Moon className="h-3 w-3" /> Night</button>
                        <button type="button" onClick={() => setQuickShift("08:00 AM", "06:00 PM")} className="px-2 py-1 rounded bg-zinc-800 text-white dark:bg-white dark:text-zinc-900 text-[10px] font-bold uppercase tracking-wider hover:opacity-80 transition active:scale-95">Full Day</button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <PremiumTimePicker label="Shift Start Time" value={formData.shiftStart} onChange={(val) => setFormData({...formData, shiftStart: val})} />
                      <PremiumTimePicker label="Shift End Time" value={formData.shiftEnd} onChange={(val) => setFormData({...formData, shiftEnd: val})} />
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50/50 dark:bg-black/20">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-2">
                    <label className="text-xs md:text-sm font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                      <Lock className="h-3.5 w-3.5" /> Secure Password
                    </label>
                    <button type="button" onClick={generatePassword} className="text-[10px] md:text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 flex items-center gap-1 outline-none self-start sm:self-auto">
                      <RefreshCw className="h-3 w-3" /> Suggest Strong Password
                    </button>
                  </div>
                  
                  <div className="relative">
                    <input 
                      required 
                      type={showPassword ? "text" : "password"} 
                      value={formData.password} 
                      onChange={handlePasswordChange} 
                      onBlur={handlePasswordBlur}
                      placeholder="Enter or generate password" 
                      className={`w-full bg-white dark:bg-[#121214] border ${errors.password ? 'border-red-500' : 'border-zinc-200 dark:border-white/10'} text-sm md:text-base font-mono tracking-wider rounded-xl px-4 py-3 pr-10 outline-none focus:ring-1 transition-all ${errors.password ? 'focus:ring-red-500' : 'focus:border-emerald-500 focus:ring-emerald-500'}`} 
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white outline-none">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.password && <p className="text-[10px] md:text-xs text-red-500 font-medium flex items-center gap-1 mt-2 animate-in fade-in"><AlertCircle className="h-3 w-3" /> {errors.password}</p>}
                  {!errors.password && (formData.password?.length || 0) > 0 && <p className="text-[10px] md:text-xs text-emerald-500 font-bold flex items-center gap-1 mt-2 animate-in fade-in"><Check className="h-3 w-3" /> Password meets security requirements.</p>}
                </div>

              </form>
            </div>
            
            <div className="p-4 md:p-6 border-t border-zinc-100 dark:border-white/5 shrink-0 bg-white dark:bg-[#18181b]">
              <button form="attendantForm" type="submit" disabled={submitting} className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 disabled:pointer-events-none text-zinc-950 font-bold py-3 md:py-3.5 text-sm md:text-base rounded-xl shadow-lg shadow-emerald-500/20 transition-transform active:scale-95 outline-none">
                Register Attendant
              </button>
            </div>
          </div>
        </div>
      )}

      {isEditModalOpen && editingAttendant && (
        <div className="fixed inset-0 z-[7001] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-900/60 dark:bg-black/80 backdrop-blur-sm" onClick={closeEditModal}></div>
          <div className="relative w-full max-w-2xl bg-white dark:bg-[#18181b] rounded-2xl shadow-2xl border border-zinc-200 dark:border-white/10 overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-zinc-100 dark:border-white/5 shrink-0">
              <h2 className="text-lg md:text-xl font-bold text-zinc-900 dark:text-white">Edit Attendant</h2>
              <button type="button" onClick={closeEditModal} className="p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-md transition-colors outline-none">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 md:p-6 overflow-y-auto flex-1 custom-scrollbar">
              <form id="editAttendantForm" onSubmit={handleUpdateAttendant} className="flex flex-col gap-4 md:gap-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs md:text-sm font-bold uppercase tracking-wider text-zinc-500">Full Name</label>
                    <input
                      required
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. Kebede Alemu"
                      className="w-full bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 text-sm md:text-base rounded-xl px-4 py-3 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs md:text-sm font-bold uppercase tracking-wider text-zinc-500">Fayda ID (FAN)</label>
                    <input
                      required
                      type="text"
                      value={formData.faydaId}
                      onChange={handleFaydaChange}
                      onBlur={handleFaydaBlur}
                      placeholder="XXXX XXXX XXXX XXXX"
                      className={`w-full bg-zinc-50 dark:bg-white/5 border ${errors.faydaId ? "border-red-500" : "border-zinc-200 dark:border-white/10"} text-sm md:text-base font-mono tracking-widest rounded-xl px-4 py-3 outline-none focus:ring-1 transition-all ${errors.faydaId ? "focus:ring-red-500" : "focus:border-emerald-500 focus:ring-emerald-500"}`}
                    />
                    {errors.faydaId && (
                      <p className="text-[10px] md:text-xs text-red-500 font-medium flex items-center gap-1 mt-1 animate-in fade-in">
                        <AlertCircle className="h-3 w-3" /> {errors.faydaId}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs md:text-sm font-bold uppercase tracking-wider text-zinc-500">Gmail Address</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                      <input
                        required
                        type="email"
                        value={formData.email}
                        onChange={handleEmailChange}
                        onBlur={handleEmailBlur}
                        placeholder="attendant@gmail.com"
                        className={`w-full bg-zinc-50 dark:bg-white/5 border ${errors.email ? "border-red-500" : "border-zinc-200 dark:border-white/10"} text-sm md:text-base rounded-xl pl-10 pr-4 py-3 outline-none focus:ring-1 transition-all ${errors.email ? "focus:ring-red-500" : "focus:border-emerald-500 focus:ring-emerald-500"}`}
                      />
                    </div>
                    {errors.email && (
                      <p className="text-[10px] md:text-xs text-red-500 font-medium flex items-center gap-1 mt-1 animate-in fade-in">
                        <AlertCircle className="h-3 w-3" /> {errors.email}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs md:text-sm font-bold uppercase tracking-wider text-zinc-500">Phone Number</label>
                    <div className="relative flex items-center">
                      <div className="absolute left-0 top-0 bottom-0 flex items-center justify-center bg-zinc-100 dark:bg-white/5 border-r border-zinc-200 dark:border-white/10 px-3 rounded-l-xl z-10">
                        <span className="text-sm md:text-base font-mono font-bold text-zinc-500">+251</span>
                      </div>
                      <input
                        required
                        type="tel"
                        value={formData.phone}
                        onChange={handlePhoneChange}
                        onBlur={handlePhoneBlur}
                        placeholder="9XX XXX XXX"
                        className={`w-full bg-zinc-50 dark:bg-white/5 border ${errors.phone ? "border-red-500" : "border-zinc-200 dark:border-white/10"} text-sm md:text-base font-mono tracking-widest rounded-xl pl-16 pr-4 py-3 outline-none focus:ring-1 transition-all ${errors.phone ? "focus:ring-red-500" : "focus:border-emerald-500 focus:ring-emerald-500"}`}
                      />
                    </div>
                    {errors.phone && (
                      <p className="text-[10px] md:text-xs text-red-500 font-medium flex items-center gap-1 mt-1 animate-in fade-in">
                        <AlertCircle className="h-3 w-3" /> {errors.phone}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs md:text-sm font-bold uppercase tracking-wider text-zinc-500">Physical Address</label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="e.g. Bole, Kebele 03"
                      className="w-full bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 text-sm md:text-base rounded-xl pl-10 pr-4 py-3 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-500/5 mt-2">
                  <h3 className="text-xs md:text-sm font-bold text-emerald-700 dark:text-emerald-400 mb-4 flex items-center gap-2">
                    <MapPin className="h-4 w-4" /> Assignment & Custom Shift Details
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full min-w-0 mb-5">
                    <DropdownTrigger label="Region" value={formData.region} onClick={() => setActiveDropdown("region")} />
                    <DropdownTrigger label="City" value={formData.city} onClick={() => setActiveDropdown("city")} disabled={!formData.region} />
                    <DropdownTrigger label="Assigned Branch" value={formData.branch} onClick={() => setActiveDropdown("branch")} disabled={!formData.city} />
                  </div>

                  <div className="border-t border-emerald-200 dark:border-emerald-500/20 pt-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
                      <label className="text-xs md:text-sm font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-500">Custom Shift Timing</label>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => setQuickShift("06:00 AM", "02:00 PM")} className="px-2 py-1 rounded border border-emerald-300 dark:border-emerald-500/30 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition flex items-center gap-1 active:scale-95"><Sunrise className="h-3 w-3" /> Morning</button>
                        <button type="button" onClick={() => setQuickShift("02:00 PM", "10:00 PM")} className="px-2 py-1 rounded border border-amber-300 dark:border-amber-500/30 text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-500/20 transition flex items-center gap-1 active:scale-95"><Sun className="h-3 w-3" /> Afternoon</button>
                        <button type="button" onClick={() => setQuickShift("10:00 PM", "06:00 AM")} className="px-2 py-1 rounded border border-indigo-300 dark:border-indigo-500/30 text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition flex items-center gap-1 active:scale-95"><Moon className="h-3 w-3" /> Night</button>
                        <button type="button" onClick={() => setQuickShift("08:00 AM", "06:00 PM")} className="px-2 py-1 rounded bg-zinc-800 text-white dark:bg-white dark:text-zinc-900 text-[10px] font-bold uppercase tracking-wider hover:opacity-80 transition active:scale-95">Full Day</button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <PremiumTimePicker label="Shift Start Time" value={formData.shiftStart} onChange={(val) => setFormData({ ...formData, shiftStart: val })} />
                      <PremiumTimePicker label="Shift End Time" value={formData.shiftEnd} onChange={(val) => setFormData({ ...formData, shiftEnd: val })} />
                    </div>
                  </div>
                </div>
              </form>
            </div>

            <div className="p-4 md:p-6 border-t border-zinc-100 dark:border-white/5 shrink-0 bg-white dark:bg-[#18181b]">
              <button
                form="editAttendantForm"
                type="submit"
                disabled={editSubmitting}
                className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 disabled:pointer-events-none text-zinc-950 font-bold py-3 md:py-3.5 text-sm md:text-base rounded-xl shadow-lg shadow-emerald-500/20 transition-transform active:scale-95 outline-none"
              >
                {editSubmitting ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeDropdown && (
        <div className="fixed inset-0 z-[8000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-900/60 dark:bg-black/80 backdrop-blur-sm" onClick={() => setActiveDropdown(null)}></div>
          
          <div className="relative w-full max-w-md bg-white dark:bg-[#18181b] rounded-2xl shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200 overflow-hidden border border-zinc-200 dark:border-white/10">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-white/5 shrink-0">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
                Select {activeDropdown === 'region' ? 'Region' : activeDropdown === 'city' ? 'City' : 'Branch'}
              </h2>
              <button type="button" onClick={() => setActiveDropdown(null)} className="p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-md transition-colors outline-none"><X className="h-5 w-5" /></button>
            </div>

            <div className="p-2 overflow-y-auto flex-1 custom-scrollbar">
              {activeDropdown === 'region' && REGION_GROUPS.map((group) => (
                <div key={group.group} className="mb-2">
                  <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500">{group.group}</div>
                  <div className="flex flex-col gap-1">
                    {group.options.map(opt => (
                      <button type="button" key={opt} onClick={() => {
                        const firstCity = CITIES_BY_REGION[opt][0];
                        const matching = lotsForBranchSelect(ownerLots, firstCity);
                        const firstLot = matching[0];
                        setFormData({
                          ...formData,
                          region: opt,
                          city: firstCity,
                          branch: firstLot?.name || "",
                          lotId: firstLot ? String(firstLot._id) : "",
                        });
                        setActiveDropdown(null);
                      }} className="flex w-full px-4 py-3 rounded-xl text-sm font-medium justify-between hover:bg-zinc-50 dark:hover:bg-white/5 outline-none transition-colors">
                        {opt} {formData.region === opt && <Check className="h-4 w-4 text-emerald-500" />}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              {activeDropdown === 'city' && CITIES_BY_REGION[formData.region]?.map(opt => (
                <button type="button" key={opt} onClick={() => {
                  const matching = lotsForBranchSelect(ownerLots, opt);
                  const firstLot = matching[0];
                  setFormData({
                    ...formData,
                    city: opt,
                    branch: firstLot?.name || "",
                    lotId: firstLot ? String(firstLot._id) : "",
                  });
                  setActiveDropdown(null);
                }} className="flex w-full px-4 py-3 rounded-xl text-sm font-medium justify-between hover:bg-zinc-50 dark:hover:bg-white/5 outline-none mt-1 transition-colors">
                  {opt} {formData.city === opt && <Check className="h-4 w-4 text-emerald-500" />}
                </button>
              ))}

              {activeDropdown === 'branch' && (
                lotsForBranchSelect(ownerLots, formData.city).length > 0 ? (
                  lotsForBranchSelect(ownerLots, formData.city).map((lot) => (
                    <button type="button" key={String(lot._id)} onClick={() => {
                      setFormData({
                        ...formData,
                        branch: lot.name,
                        lotId: String(lot._id),
                      });
                      setActiveDropdown(null);
                    }} className="flex w-full px-4 py-3 rounded-xl text-sm font-medium justify-between hover:bg-zinc-50 dark:hover:bg-white/5 outline-none mt-1 transition-colors">
                      {lot.name} {formData.lotId === String(lot._id) && <Check className="h-4 w-4 text-emerald-500" />}
                    </button>
                  ))
                ) : (
                  <div className="p-4 text-sm text-zinc-500 text-center">No parking lots found for your account.</div>
                )
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
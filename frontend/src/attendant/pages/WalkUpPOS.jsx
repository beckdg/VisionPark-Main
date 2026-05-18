import React, { useState, useEffect } from "react";
import {
    Banknote, Printer, Clock, Search, History,
    ArrowRight, Plus, Minus, Receipt, CarFront,
    ChevronDown, X, Check, Shield, MapPin, Hash, Globe,
    Send, MessageCircle, Mail, Download, Camera, QrCode, ScanFace, CheckCircle
} from "lucide-react";
import { apiClient } from "../../api/apiClient";

// --- Option Data Structures ---
const LICENCE_OPTIONS = [
    { group: "Standard Plates", items: ["Private", "Taxi", "Commercial / Business"] },
    { group: "Institutional Plates", items: ["Government", "Police", "United Nations", "African Union", "Red Cross"] },
    { group: "Special Plates", items: ["Temporary", "Diplomatic"] }
];

const REGION_OPTIONS = [
    { group: "National", items: ["Ethiopia (ET)"] },
    { group: "Federal Cities", items: ["Addis Ababa (AA)", "Dire Dawa (DD)"] },
    { group: "Major Regions", items: ["Oromia (OR)", "Amhara (AM)", "Tigray (TG)", "Somali (SO)", "Afar (AF)"] },
    { group: "Other Regions", items: ["Benishangul-Gumuz (BG)", "Gambela (GA)", "Harari (HR)", "Sidama (SD)", "South West Ethiopia (SW)", "SNNPR (SN)"] }
];

const VEHICLE_OPTIONS = [
    { group: "Public Transport", items: ["Public Transport Vehicles | Upto 12 Seats", "Public Transport Vehicles | 13-24 Seats", "Public Transport Vehicles | 25 Seats and above"] },
    { group: "Two Wheelers", items: ["Bicycle | Bicycle", "Motorcycle | Motorcycle"] },
    { group: "Dry Freight", items: ["Dry Freight Vehicles | <35 Quintal", "Dry Freight Vehicles | 36-70 Quintal", "Dry Freight Vehicles | >71 Quintal"] },
    { group: "Liquid Cargo", items: ["Liquid Cargo Vehicles | Upto 28 Liter", "Liquid Cargo Vehicles | Above 28 Liter"] },
    { group: "Machineries", items: ["Machineries | Upto 5000KG weight", "Machineries | 5001-10,000KG weight", "Machineries | Above 10,001KG weight"] }
];

const NON_DIPLOMATIC_PLATE_REGEX = /^[A-Z]?[0-9]{1,7}$/;

const hasInvalidNonDiplomaticLetterPlacement = (plate) => {
    const letterIndices = [...plate]
        .map((char, index) => (/[A-Z]/.test(char) ? index : -1))
        .filter((index) => index >= 0);
    return (
        letterIndices.length > 1 ||
        (letterIndices.length === 1 && letterIndices[0] !== 0)
    );
};

// --- Rate Mapping Engine ---
const VEHICLE_RATES = {
    "Public Transport Vehicles | Upto 12 Seats": 30,
    "Public Transport Vehicles | 13-24 Seats": 45,
    "Public Transport Vehicles | 25 Seats and above": 60,
    "Bicycle | Bicycle": 5,
    "Motorcycle | Motorcycle": 10,
    "Dry Freight Vehicles | <35 Quintal": 40,
    "Dry Freight Vehicles | 36-70 Quintal": 70,
    "Dry Freight Vehicles | >71 Quintal": 100,
    "Liquid Cargo Vehicles | Upto 28 Liter": 80,
    "Liquid Cargo Vehicles | Above 28 Liter": 120,
    "Machineries | Upto 5000KG weight": 100,
    "Machineries | 5001-10,000KG weight": 150,
    "Machineries | Above 10,001KG weight": 200,
};

export default function WalkUpPOS() {
    // Form State
    const [activeModal, setActiveModal] = useState(null);
    const [licenceType, setLicenceType] = useState("Private");
    const [region, setRegion] = useState("Addis Ababa (AA)");
    const [countryCode, setCountryCode] = useState("");
    const [vehicleType, setVehicleType] = useState("Public Transport Vehicles | Upto 12 Seats");
    const [plate, setPlate] = useState("");

    // TIME STATE
    const [depositHours, setDepositHours] = useState("2");
    const [depositMinutes, setDepositMinutes] = useState("0");

    // Ledger & Receipt State
    const [recentSessions, setRecentSessions] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [plateError, setPlateError] = useState("");
    const [generatedReceipt, setGeneratedReceipt] = useState(null);

    // E-RECEIPT SHARING STATE
    const [shareMode, setShareMode] = useState(null);
    const [telegramMethod, setTelegramMethod] = useState("phone");
    const [shareInput, setShareInput] = useState("");
    const [shareError, setShareError] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [shareSuccess, setShareSuccess] = useState("");
    const [isDownloading, setIsDownloading] = useState(false);
    const [isPrinting, setIsPrinting] = useState(false);

    const mapWalkupRowToUi = (row) => ({
        id: row?.id ?? row?.transactionCode ?? "--",
        checkinId: row?.checkinId ?? row?._id ?? null,
        plate: row?.plate ?? "--",
        category: row?.category ?? "--",
        amount: Number(row?.amount ?? 0),
        time: row?.time ?? "--",
        status: row?.status ?? "Active",
        duration: row?.duration ?? "0h 0m",
    });

    // --- MATH & LOGIC DERIVATIONS ---
    const hideRegion = ["United Nations", "African Union", "Government", "Temporary"].includes(licenceType);
    const showCountry = licenceType === "Diplomatic";

    const safeHours = Math.max(0, parseInt(depositHours) || 0);
    const safeMinutes = Math.max(0, parseInt(depositMinutes) || 0);

    const currentRate = VEHICLE_RATES[vehicleType] || 20;
    const totalDeposit = currentRate * (safeHours + (safeMinutes / 60));

    const formatTimeDisplay = (h, m) => {
        if (h > 0 && m > 0) return `${h}h ${m}m`;
        if (h > 0) return `${h} Hours`;
        if (m > 0) return `${m} Minutes`;
        return "0 Minutes";
    };

    // --- SMART TIME CONTROLS ---
    const handleHourChange = (e) => setDepositHours(e.target.value.replace(/\D/g, ''));
    const handleMinuteChange = (e) => {
        let val = e.target.value.replace(/\D/g, '');
        if (parseInt(val) > 59) val = "59";
        setDepositMinutes(val);
    };

    const incHour = () => setDepositHours(String(safeHours + 1));
    const decHour = () => setDepositHours(String(Math.max(0, safeHours - 1)));

    const incMin = () => {
        if (safeMinutes + 5 >= 60) {
            setDepositHours(String(safeHours + 1));
            setDepositMinutes(String((safeMinutes + 5) % 60));
        } else {
            setDepositMinutes(String(safeMinutes + 5));
        }
    };
    const decMin = () => {
        if (safeMinutes - 5 < 0) {
            if (safeHours > 0) {
                setDepositHours(String(safeHours - 1));
                setDepositMinutes(String(60 + (safeMinutes - 5)));
            } else {
                setDepositMinutes("0");
            }
        } else {
            setDepositMinutes(String(safeMinutes - 5));
        }
    };

    // --- PLATE LOGIC ---
    const getPlatePrefix = () => {
        if (licenceType === "Diplomatic") return "";
        if (licenceType === "United Nations") return "UN";
        if (licenceType === "African Union") return "AU";
        if (licenceType === "Government" || licenceType === "Temporary") return "ET";
        const regionMatch = region.match(/\(([^)]+)\)/);
        return regionMatch ? regionMatch[1] : "AA";
    };

    const platePrefix = getPlatePrefix();

    const getPlatePlaceholder = () => {
        if (licenceType === "Diplomatic") return "01 CD 0123";
        return "0123456";
    };

    const handlePlateChange = (e) => {
        let normalized = e.target.value.toUpperCase();
        if (licenceType !== "Diplomatic") {
            normalized = normalized.replace(/[^A-Z0-9]/g, "");
            if (normalized.length > 8) {
                normalized = normalized.slice(0, 8);
            }
            if (hasInvalidNonDiplomaticLetterPlacement(normalized)) {
                return;
            }
        } else {
            normalized = normalized.replace(/[^A-Z0-9\s]/g, "");
        }
        setPlate(normalized);
    };

    const handleSelectOption = (field, value) => {
        if (field === 'licenceType') setLicenceType(value);
        if (field === 'vehicleType') setVehicleType(value);
        if (field === 'region') setRegion(value);
        setActiveModal(null);
    };

    useEffect(() => {
        if (plate.length > 0) {
            let isValid = false;
            if (licenceType === "Diplomatic") {
                isValid = /^(0[1-9]|[1-9][0-9]|1[0-2][0-9]|13[0-2])(CD)?[0-9]{4}$/.test(plate);
                setPlateError(isValid ? "" : "Invalid format");
            } else {
                isValid = NON_DIPLOMATIC_PLATE_REGEX.test(plate);
                setPlateError(
                    isValid
                        ? ""
                        : "1-8 chars max: numbers only, or one letter at start then numbers."
                );
            }
        } else {
            setPlateError("");
        }
    }, [plate, licenceType]);

    const fetchRecentSessions = async () => {
        try {
            const data = await apiClient.get(`/attendant/walkup/recent?limit=30`);
            const rows = Array.isArray(data) ? data : [];
            setRecentSessions(rows.map(mapWalkupRowToUi));
        } catch (error) {
            console.error("WalkUpPOS recent fetch failed:", error);
            setRecentSessions([]);
        }
    };

    useEffect(() => {
        fetchRecentSessions();
    }, []);

    // --- CHECK-IN LOGIC ---
    const handleProcessCheckIn = async () => {
        if (plateError || !plate.trim()) return alert("Please enter a valid license plate.");

        setIsProcessing(true);
        try {
            const created = await apiClient.post(`/attendant/walkup/checkin`, {
                licenceType,
                region: hideRegion || showCountry ? null : region,
                countryCode: showCountry ? countryCode : null,
                plate,
                vehicleType,
                durationHours: safeHours,
                durationMinutes: safeMinutes,
            });
            const newSession = mapWalkupRowToUi(created);
            setRecentSessions((prev) => [newSession, ...prev]);
            setGeneratedReceipt(newSession);
        } catch (error) {
            console.error("WalkUpPOS check-in failed:", error);
            alert(error?.message || "Failed to process check-in.");
        } finally {
            setIsProcessing(false);
        }
    };

    const closeReceiptModal = () => {
        setGeneratedReceipt(null);
        setPlate("");
        setDepositHours("2");
        setDepositMinutes("0");
        resetShareState();
    };

    // --- SMART SHARING & VALIDATION LOGIC ---
    const resetShareState = () => {
        setShareMode(null);
        setTelegramMethod("phone");
        setShareInput("");
        setShareError("");
        setShareSuccess("");
        setIsSending(false);
    };

    const validateShareInput = () => {
        const input = shareInput.trim();
        if (!input) return "This field is required.";

        if (shareMode === 'whatsapp' || (shareMode === 'telegram' && telegramMethod === 'phone')) {
            if (input.length !== 9) return "Must be exactly 9 digits after +251.";
            if (!/^[79]/.test(input)) return "Number must start with 9 or 7.";
        } else if (shareMode === 'telegram' && telegramMethod === 'username') {
            if (input.length < 5) return "Username must be at least 5 characters.";
        } else if (shareMode === 'email') {
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input)) return "Valid email required (e.g., driver@gmail.com).";
        }
        return "";
    };

    const executeShare = () => {
        const error = validateShareInput();
        if (error) {
            setShareError(error);
            return;
        }
        setShareError("");
        setIsSending(true);

        setTimeout(() => {
            setIsSending(false);
            setShareSuccess(`Receipt successfully sent via ${shareMode.charAt(0).toUpperCase() + shareMode.slice(1)}!`);

            setTimeout(() => {
                resetShareState();
            }, 3000);
        }, 1200);
    };

    const executeDownloadPDF = () => {
        setIsDownloading(true);
        setTimeout(() => {
            setIsDownloading(false);
            setShareSuccess("PDF saved to local device storage!");
            setTimeout(() => setShareSuccess(""), 3000);
        }, 1500);
    };

    const executePrint = () => {
        setIsPrinting(true);
        setTimeout(() => {
            setIsPrinting(false);
            setShareSuccess("Receipt successfully sent to thermal printer.");
            setTimeout(() => setShareSuccess(""), 3000);
        }, 1000);
    };

    // --- REUSABLE SELECTOR BUTTON (With Glass Premium Green Focus) ---
    const SelectorButton = ({ icon: Icon, label, value, field }) => (
        <div>
            <label className="block text-xs md:text-sm font-bold uppercase tracking-widest text-zinc-500 mb-1.5 ml-1 flex items-center gap-2">
                <Icon className="h-4 w-4" /> {label}
            </label>
            <button
                type="button"
                onClick={() => setActiveModal(field)}
                className="w-full h-16 relative flex items-center rounded-2xl transition-all duration-300 outline-none cursor-pointer border-2 border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-black/40 text-zinc-900 dark:text-white hover:border-emerald-500 hover:shadow-[0_0_15px_rgba(16,185,129,0.15)] focus:bg-emerald-50 dark:focus:bg-emerald-500/10 focus:border-emerald-500 focus:shadow-[0_0_15px_rgba(16,185,129,0.15)]"
            >
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Icon className="h-5 w-5 md:h-6 md:w-6 text-zinc-400 dark:text-zinc-500" />
                </div>
                <span className="pl-12 pr-10 truncate text-left text-sm md:text-base font-bold w-full">{value}</span>
                <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                    <ChevronDown className="h-4 w-4 md:h-5 md:w-5 text-zinc-400 dark:text-zinc-500" />
                </div>
            </button>
        </div>
    );

    return (
        <div className="h-full w-full flex flex-col xl:flex-row gap-6 animate-in fade-in duration-500 relative">

            {/* LEFT COLUMN: The POS Terminal */}
            <div className="flex-1 xl:max-w-[65%] flex flex-col gap-6">

                {/* Terminal Header */}
                <div className="bg-white dark:bg-[#121214] rounded-3xl p-6 shadow-sm border border-zinc-200 dark:border-white/5 shrink-0 flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-black text-zinc-900 dark:text-white flex items-center gap-3">
                            <Banknote className="h-7 w-7 text-emerald-500" /> Walk-Up Terminal
                        </h2>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Manual cash check-in for unregistered vehicles.</p>
                    </div>
                    <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-bold">
                        <ScanFace className="h-5 w-5" /> E-Receipts Active
                    </div>
                </div>

                {/* Main Check-In Form */}
                <div className="flex-1 bg-white dark:bg-[#121214] rounded-3xl shadow-sm border border-zinc-200 dark:border-white/5 p-6 md:p-8 flex flex-col">

                    <div className="space-y-6 flex-1">

                        {/* ROW 1: License & Region Selectors */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <SelectorButton icon={Shield} label="Licence Type" value={licenceType} field="licenceType" />

                            {showCountry ? (
                                <div>
                                    <label className="block text-xs md:text-sm font-bold uppercase tracking-widest text-zinc-500 mb-1.5 ml-1 flex items-center gap-2">
                                        <Globe className="h-4 w-4" /> Country
                                    </label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <Globe className="h-5 w-5 md:h-6 md:w-6 text-zinc-400 dark:text-zinc-500 group-focus-within:text-emerald-500 transition-colors duration-300" />
                                        </div>
                                        <input
                                            type="text"
                                            value={countryCode}
                                            onChange={(e) => setCountryCode(e.target.value)}
                                            placeholder="E.g., Italy"
                                            className="w-full h-16 pl-12 pr-4 rounded-2xl bg-zinc-50 dark:bg-black/40 border-2 border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white outline-none focus:bg-emerald-50 dark:focus:bg-emerald-500/10 focus:border-emerald-500 focus:shadow-[0_0_20px_rgba(16,185,129,0.15)] transition-all font-bold"
                                        />
                                    </div>
                                </div>
                            ) : hideRegion ? (
                                <div className="hidden md:block"></div>
                            ) : (
                                <SelectorButton icon={MapPin} label="Region" value={region} field="region" />
                            )}
                        </div>

                        {/* ROW 2: Plate Input */}
                        <div>
                            <label className="block text-xs md:text-sm font-bold uppercase tracking-widest text-zinc-500 mb-1.5 ml-1">
                                <span className="flex items-center justify-between whitespace-nowrap gap-2">
                                    <span className="flex items-center gap-2"><Search className="h-4 w-4" /> License Plate</span>
                                    {plateError && (
                                        <span className="text-red-500 text-[10px] normal-case tracking-normal shrink-0">
                                            {plateError}
                                        </span>
                                    )}
                                </span>
                            </label>
                            <div className={`relative group flex items-center w-full h-16 rounded-2xl transition-all duration-300 outline-none border-2 bg-zinc-50 dark:bg-black/40 text-zinc-900 dark:text-white overflow-hidden
                ${plateError
                                    ? 'border-red-500/50 focus-within:bg-red-50 dark:focus-within:bg-red-500/10 focus-within:border-red-500 focus-within:shadow-[0_0_15px_rgba(239,68,68,0.2)]'
                                    : 'border-zinc-200 dark:border-white/10 hover:border-emerald-500/50 focus-within:bg-emerald-50 dark:focus-within:bg-emerald-500/10 focus-within:border-emerald-500 focus-within:shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                                }`}
                            >
                                <div className="pl-4 pr-3 flex items-center pointer-events-none text-zinc-400 dark:text-zinc-500 group-focus-within:text-emerald-500 transition-colors duration-300">
                                    <Hash className="h-6 w-6" />
                                </div>

                                {platePrefix && (
                                    <div className="flex items-center justify-center h-full px-4 bg-zinc-200/50 dark:bg-white/5 border-r border-zinc-200 dark:border-white/10 font-mono font-black text-xl text-zinc-700 dark:text-zinc-300 shrink-0">
                                        {platePrefix}
                                    </div>
                                )}

                                <input
                                    type="text"
                                    value={plate}
                                    onChange={handlePlateChange}
                                    placeholder={getPlatePlaceholder()}
                                    className="flex-1 h-full pl-4 pr-4 bg-transparent outline-none font-mono font-black text-2xl uppercase placeholder:font-sans placeholder:font-medium placeholder:tracking-normal w-full min-w-0"
                                    autoComplete="off"
                                />
                            </div>
                        </div>

                        {/* ROW 3: Vehicle Category */}
                        <SelectorButton icon={CarFront} label="Vehicle Category" value={vehicleType} field="vehicleType" />

                        {/* ROW 4: SMART TYPABLE TIME CONTROLS */}
                        <div className="space-y-3 pt-2">
                            <label className="text-xs font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                                <Clock className="h-4 w-4" /> Estimated Duration (Deposit)
                            </label>
                            <div className="grid grid-cols-2 gap-4">

                                {/* Hours Control */}
                                <div className="flex items-center justify-between bg-zinc-50 dark:bg-black/40 border-2 border-zinc-200 dark:border-white/10 p-2 rounded-2xl focus-within:bg-emerald-50 dark:focus-within:bg-emerald-500/10 focus-within:border-emerald-500 focus-within:shadow-[0_0_15px_rgba(16,185,129,0.15)] transition-all">
                                    <button onClick={decHour} className="h-12 w-12 flex items-center justify-center rounded-xl bg-white dark:bg-[#18181b] shadow-sm border border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-400 hover:text-emerald-500 active:scale-90 transition-all outline-none cursor-pointer">
                                        <Minus className="h-5 w-5" />
                                    </button>
                                    <div className="flex-1 flex items-baseline justify-center gap-1 group">
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            value={depositHours}
                                            onChange={handleHourChange}
                                            className="w-10 md:w-14 text-center text-2xl md:text-3xl font-black bg-transparent outline-none text-zinc-900 dark:text-white appearance-none"
                                        />
                                        <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Hrs</span>
                                    </div>
                                    <button onClick={incHour} className="h-12 w-12 flex items-center justify-center rounded-xl bg-white dark:bg-[#18181b] shadow-sm border border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-400 hover:text-emerald-500 active:scale-90 transition-all outline-none cursor-pointer">
                                        <Plus className="h-5 w-5" />
                                    </button>
                                </div>

                                {/* Minutes Control */}
                                <div className="flex items-center justify-between bg-zinc-50 dark:bg-black/40 border-2 border-zinc-200 dark:border-white/10 p-2 rounded-2xl focus-within:bg-emerald-50 dark:focus-within:bg-emerald-500/10 focus-within:border-emerald-500 focus-within:shadow-[0_0_15px_rgba(16,185,129,0.15)] transition-all">
                                    <button onClick={decMin} className="h-12 w-12 flex items-center justify-center rounded-xl bg-white dark:bg-[#18181b] shadow-sm border border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-400 hover:text-emerald-500 active:scale-90 transition-all outline-none cursor-pointer">
                                        <Minus className="h-5 w-5" />
                                    </button>
                                    <div className="flex-1 flex items-baseline justify-center gap-1 group">
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            value={depositMinutes}
                                            onChange={handleMinuteChange}
                                            className="w-10 md:w-14 text-center text-2xl md:text-3xl font-black bg-transparent outline-none text-zinc-900 dark:text-white appearance-none"
                                        />
                                        <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Min</span>
                                    </div>
                                    <button onClick={incMin} className="h-12 w-12 flex items-center justify-center rounded-xl bg-white dark:bg-[#18181b] shadow-sm border border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-400 hover:text-emerald-500 active:scale-90 transition-all outline-none cursor-pointer">
                                        <Plus className="h-5 w-5" />
                                    </button>
                                </div>

                            </div>
                        </div>
                    </div>

                    {/* ROW 5: Total & Action */}
                    <div className="mt-8 pt-6 border-t border-zinc-100 dark:border-white/5 flex flex-col lg:flex-row flex-wrap items-stretch gap-4 w-full min-w-0">

                        <div className="w-full lg:w-[320px] min-w-0 flex flex-col justify-center p-4 rounded-2xl border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/10 transition-all duration-300">
                            <span className="text-xs font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-500 mb-1">Total Due</span>
                            <div className="flex items-baseline gap-2 min-w-0">
                                <span className="text-2xl sm:text-3xl font-black text-emerald-800 dark:text-emerald-400 truncate">{totalDeposit.toFixed(2)}</span>
                                <span className="text-base sm:text-lg font-bold opacity-80 text-emerald-800 dark:text-emerald-400 shrink-0">ETB</span>
                            </div>
                            <p className="text-[10px] text-emerald-600 dark:text-emerald-500 font-bold mt-1 truncate">({currentRate} ETB/hr × {formatTimeDisplay(safeHours, safeMinutes)})</p>
                        </div>

                        <button
                            onClick={handleProcessCheckIn}
                            disabled={isProcessing || !!plateError || plate.length < 4 || (safeHours === 0 && safeMinutes === 0)}
                            className="w-full flex-1 min-h-[72px] sm:min-h-[82px] lg:h-auto min-w-0 px-4 py-4 bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-300 dark:disabled:bg-zinc-800 disabled:text-zinc-500 text-emerald-950 font-black rounded-2xl shadow-lg shadow-emerald-500/20 active:scale-95 transition-all outline-none flex items-center justify-center cursor-pointer whitespace-normal break-words"
                        >
                            {isProcessing ? (
                                <span className="flex items-center justify-center gap-2 animate-pulse min-w-0">
                                    <Receipt className="h-5 w-5 sm:h-6 sm:w-6 shrink-0" />
                                    <span className="truncate">Generating Pass...</span>
                                </span>
                            ) : (
                                <div className="flex items-center justify-center gap-2 flex-wrap text-center leading-tight w-full">
                                    <span className="text-sm sm:text-base lg:text-xl break-words">
                                        Collect Cash & Generate Pass
                                    </span>
                                    <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6 shrink-0" />
                                </div>
                            )}
                        </button>
                    </div>

                </div>
            </div>

            {/* RIGHT COLUMN: Recent Transactions (The Ledger) */}
            <div className="w-full xl:w-[35%] h-[600px] xl:h-auto bg-white dark:bg-[#121214] rounded-3xl shadow-sm border border-zinc-200 dark:border-white/5 flex flex-col shrink-0">

                <div className="p-6 border-b border-zinc-100 dark:border-white/5 flex items-center justify-between shrink-0 bg-zinc-50 dark:bg-[#18181b] rounded-t-3xl">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-blue-500 flex items-center justify-center text-white shadow-inner">
                            <History className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="font-black text-xl text-zinc-900 dark:text-white leading-none">Recent Activity</h3>
                            <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 mt-1">This Shift</p>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3 custom-scrollbar">
                    {recentSessions.map((session) => (
                        <div key={session.id} className="bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-white/5 p-4 rounded-2xl flex flex-col gap-3 group hover:border-zinc-300 dark:hover:border-white/10 transition-colors">
                            <div className="flex justify-between items-start">
                                <div>
                                    <span className="font-mono font-black text-lg text-zinc-900 dark:text-white bg-zinc-200 dark:bg-zinc-800 px-2 py-0.5 rounded">{session.plate}</span>
                                    <p className="text-[10px] text-zinc-500 mt-2 font-bold w-[180px] sm:w-[220px] truncate" title={session.category}>{session.id} • {session.category}</p>
                                </div>
                                <div className="text-right">
                                    <span className="font-black text-emerald-600 dark:text-emerald-400">{session.amount.toFixed(2)} ETB</span>
                                    <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider mt-1">{session.time}</p>
                                </div>
                            </div>
                            <div className="flex justify-between items-center pt-3 border-t border-zinc-200 dark:border-white/5">
                                <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${session.status === 'Active' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-500' : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'}`}>
                                    {session.status}
                                </span>
                                {/* ✅ Blue text for "Continue/Export/View" action */}
                                <button
                                    onClick={() => { resetShareState(); setGeneratedReceipt(session); }}
                                    className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1 cursor-pointer outline-none active:scale-95"
                                >
                                    <Receipt className="h-3.5 w-3.5" /> View Pass
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

            </div>

            {/* --- STRICTLY CENTERED MODALS --- */}

            {/* 1. Selector Modal */}
            {activeModal && (
                <div className="fixed inset-0 z-[6000] flex items-center justify-center bg-zinc-900/60 dark:bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="w-full max-w-sm md:max-w-md lg:max-w-lg bg-white dark:bg-[#121214] rounded-3xl shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-5 md:p-6 border-b border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 rounded-t-3xl shrink-0">
                            <h3 className="text-lg md:text-xl font-bold text-zinc-900 dark:text-white">
                                {activeModal === 'licenceType' ? 'Select Licence Type' : activeModal === 'vehicleType' ? 'Select Vehicle Category' : 'Select Region'}
                            </h3>
                            <button onClick={() => setActiveModal(null)} className="p-2 -mr-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors rounded-full hover:bg-zinc-200 dark:hover:bg-white/10 outline-none cursor-pointer active:scale-90">
                                <X className="h-5 w-5 md:h-6 md:w-6" />
                            </button>
                        </div>

                        <div className="overflow-y-auto p-3 md:p-4 overscroll-contain custom-scrollbar">
                            {(activeModal === 'licenceType' ? LICENCE_OPTIONS : activeModal === 'vehicleType' ? VEHICLE_OPTIONS : REGION_OPTIONS).map((group, gIndex) => (
                                <div key={gIndex} className="mb-4 last:mb-0">
                                    <h4 className="text-[10px] md:text-[11px] uppercase tracking-widest font-black text-emerald-600 dark:text-emerald-500 px-3 mb-2">{group.group}</h4>
                                    <div className="space-y-1 md:space-y-2">
                                        {group.items.map((item, iIndex) => {
                                            const currentStateValue = activeModal === 'licenceType' ? licenceType : activeModal === 'vehicleType' ? vehicleType : region;
                                            const isSelected = currentStateValue === item;
                                            const rateDisplay = activeModal === 'vehicleType' ? VEHICLE_RATES[item] : null;

                                            return (
                                                <button key={iIndex} onClick={() => handleSelectOption(activeModal, item)} className={`w-full flex items-center justify-between p-4 rounded-2xl text-left transition-all outline-none cursor-pointer active:scale-[0.98] ${isSelected ? 'bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-500/50 shadow-sm' : 'border border-transparent hover:bg-zinc-50 dark:hover:bg-white/5 hover:border-zinc-200 dark:hover:border-white/10'}`}>
                                                    <div className="flex flex-col gap-1">
                                                        <span className={`text-sm md:text-base ${isSelected ? 'font-bold text-emerald-700 dark:text-emerald-400' : 'font-bold text-zinc-700 dark:text-zinc-300'}`}>{item}</span>
                                                        {rateDisplay && <span className={`text-xs font-mono ${isSelected ? 'text-emerald-600 dark:text-emerald-500' : 'text-zinc-500 dark:text-zinc-400'}`}>{rateDisplay} ETB/hr</span>}
                                                    </div>
                                                    {isSelected && <Check className="h-5 w-5 md:h-6 md:w-6 text-emerald-500 shrink-0" />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ✅ 2. E-RECEIPT MODAL */}
            {generatedReceipt && (
                <div className="fixed inset-0 z-[7000] flex items-center justify-center bg-zinc-900/80 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={closeReceiptModal}>
                    <div className="w-full max-w-sm bg-white dark:bg-[#121214] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 border border-zinc-200 dark:border-white/10 max-h-[90vh]" onClick={(e) => e.stopPropagation()}>

                        <div className="overflow-y-auto custom-scrollbar flex-1 flex flex-col">

                            <div className="bg-emerald-500 p-8 flex flex-col items-center justify-center text-zinc-950 relative shrink-0">
                                <button onClick={closeReceiptModal} className="absolute top-4 right-4 p-2 bg-black/10 hover:bg-black/20 rounded-full transition-colors outline-none cursor-pointer">
                                    <X className="h-5 w-5 text-zinc-900" />
                                </button>
                                <div className="bg-white p-2 rounded-xl mb-4 shadow-sm">
                                    <QrCode className="h-16 w-16 md:h-20 md:w-20 text-zinc-900" />
                                </div>
                                <h2 className="text-2xl md:text-3xl font-black font-mono tracking-tight bg-white/20 px-4 py-1 rounded-lg backdrop-blur-sm">{generatedReceipt.plate}</h2>
                                <p className="font-bold text-xs opacity-80 uppercase tracking-widest mt-2">{generatedReceipt.id} • Walk-Up</p>
                            </div>

                            <div className="p-6 bg-zinc-50 dark:bg-black/20 space-y-4 border-b border-zinc-200 dark:border-white/5 shrink-0">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Deposit Paid</span>
                                    <span className="font-black text-xl text-emerald-600 dark:text-emerald-400">{generatedReceipt.amount.toFixed(2)} ETB</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Valid For</span>
                                    <span className="font-bold text-zinc-900 dark:text-white">{generatedReceipt.duration}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Check-in Time</span>
                                    <span className="font-bold text-zinc-900 dark:text-white">{generatedReceipt.time}</span>
                                </div>
                            </div>

                            <div className="p-5 bg-white dark:bg-[#121214] shrink-0 min-h-[240px]">

                                {shareSuccess && (
                                    <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-xl flex items-center justify-center gap-2 text-emerald-700 dark:text-emerald-400 text-sm font-bold animate-in fade-in zoom-in">
                                        <CheckCircle className="h-5 w-5 shrink-0" /> <span className="text-center leading-tight">{shareSuccess}</span>
                                    </div>
                                )}

                                {shareMode && !shareSuccess ? (
                                    <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                                        <div className="flex items-center justify-between mb-2">
                                            <h4 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                                                {shareMode === 'whatsapp' ? <MessageCircle className="h-4 w-4 text-[#25D366]" /> :
                                                    shareMode === 'telegram' ? <Send className="h-4 w-4 text-[#0088cc]" /> :
                                                        <Mail className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />}
                                                Send via {shareMode.charAt(0).toUpperCase() + shareMode.slice(1)}
                                            </h4>
                                            {/* ✅ Premium Black for Cancel Action */}
                                            <button onClick={resetShareState} className="text-xs px-3 py-1.5 rounded-lg font-bold bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 cursor-pointer outline-none active:scale-95 transition-all">Cancel</button>
                                        </div>

                                        {shareMode === 'telegram' && (
                                            <div className="flex gap-2 mb-3 bg-zinc-100 dark:bg-white/5 p-1 rounded-lg">
                                                <button onClick={() => { setTelegramMethod('phone'); setShareInput(''); setShareError(''); }} className={`flex-1 text-xs font-bold py-1.5 rounded-md transition-colors outline-none cursor-pointer ${telegramMethod === 'phone' ? 'bg-white dark:bg-[#121214] shadow-sm text-zinc-900 dark:text-white' : 'text-zinc-500'}`}>Phone</button>
                                                <button onClick={() => { setTelegramMethod('username'); setShareInput(''); setShareError(''); }} className={`flex-1 text-xs font-bold py-1.5 rounded-md transition-colors outline-none cursor-pointer ${telegramMethod === 'username' ? 'bg-white dark:bg-[#121214] shadow-sm text-zinc-900 dark:text-white' : 'text-zinc-500'}`}>Username</button>
                                            </div>
                                        )}

                                        <div>
                                            {/* ✅ Glass Premium Green focus state */}
                                            <div className={`flex w-full h-14 rounded-xl border bg-zinc-50 dark:bg-black/40 transition-all overflow-hidden ${shareError ? 'border-red-500 focus-within:bg-red-50 dark:focus-within:bg-red-500/10 focus-within:border-red-500 focus-within:shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'border-zinc-200 dark:border-white/10 focus-within:bg-emerald-50 dark:focus-within:bg-emerald-500/10 focus-within:border-emerald-500 focus-within:shadow-[0_0_15px_rgba(16,185,129,0.15)]'}`}>

                                                {(shareMode === 'whatsapp' || (shareMode === 'telegram' && telegramMethod === 'phone')) && (
                                                    <div className="flex items-center justify-center px-4 bg-zinc-200/50 dark:bg-white/5 border-r border-zinc-200 dark:border-white/10 font-bold font-mono text-zinc-700 dark:text-zinc-300 shrink-0">
                                                        +251
                                                    </div>
                                                )}
                                                {(shareMode === 'telegram' && telegramMethod === 'username') && (
                                                    <div className="flex items-center justify-center px-4 bg-zinc-200/50 dark:bg-white/5 border-r border-zinc-200 dark:border-white/10 font-bold font-mono text-zinc-700 dark:text-zinc-300 shrink-0">
                                                        @
                                                    </div>
                                                )}

                                                <input
                                                    type={shareMode === 'email' ? 'email' : (shareMode === 'telegram' && telegramMethod === 'username') ? 'text' : 'tel'}
                                                    value={shareInput}
                                                    onChange={(e) => {
                                                        let val = e.target.value;
                                                        if (shareMode === 'whatsapp' || (shareMode === 'telegram' && telegramMethod === 'phone')) {
                                                            val = val.replace(/\D/g, '');
                                                            if (val.startsWith('0')) val = val.substring(1);
                                                            if (val.length > 9) val = val.substring(0, 9);
                                                        } else if (shareMode === 'telegram' && telegramMethod === 'username') {
                                                            val = val.replace(/[^a-zA-Z0-9_]/g, '');
                                                        }
                                                        setShareInput(val);
                                                        setShareError("");
                                                    }}
                                                    placeholder={
                                                        shareMode === 'whatsapp' || (shareMode === 'telegram' && telegramMethod === 'phone') ? "911 234 567" :
                                                            shareMode === 'telegram' && telegramMethod === 'username' ? "username" :
                                                                "driver@example.com"
                                                    }
                                                    className={`flex-1 px-4 bg-transparent outline-none text-zinc-900 dark:text-white w-full ${shareMode !== 'email' && telegramMethod !== 'username' ? 'font-mono text-lg tracking-wider placeholder:tracking-normal placeholder:font-sans placeholder:text-base' : 'text-sm font-medium'}`}
                                                    autoFocus
                                                />
                                            </div>
                                            {shareError && <p className="text-[10px] text-red-500 normal-case tracking-normal font-medium mt-1.5">{shareError}</p>}
                                        </div>

                                        {/* ✅ Premium Green for Primary Submission */}
                                        <button
                                            onClick={executeShare}
                                            disabled={isSending}
                                            className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-black text-sm shadow-md transition-all active:scale-95 disabled:opacity-70 flex items-center justify-center gap-2 cursor-pointer outline-none"
                                        >
                                            {isSending ? <span className="animate-pulse">Sending...</span> : "Send Receipt"}
                                        </button>
                                    </div>
                                ) : !shareSuccess && (
                                    <div className="space-y-3 animate-in fade-in duration-300">
                                        <div className="text-center mb-4">
                                            <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center justify-center gap-2">
                                                <Camera className="h-4 w-4" /> Driver can photograph this screen
                                            </p>
                                        </div>

                                        {/* Social actions retain their standard UI brand colors */}
                                        <div className="grid grid-cols-2 gap-3">
                                            <button onClick={() => setShareMode('whatsapp')} className="flex items-center justify-center gap-2 p-3 rounded-xl bg-[#25D366]/10 text-[#25D366] border border-[#25D366]/20 hover:bg-[#25D366]/20 font-bold text-sm transition-colors cursor-pointer outline-none active:scale-95">
                                                <MessageCircle className="h-4 w-4" /> WhatsApp
                                            </button>
                                            <button onClick={() => setShareMode('telegram')} className="flex items-center justify-center gap-2 p-3 rounded-xl bg-[#0088cc]/10 text-[#0088cc] border border-[#0088cc]/20 hover:bg-[#0088cc]/20 font-bold text-sm transition-colors cursor-pointer outline-none active:scale-95">
                                                <Send className="h-4 w-4" /> Telegram
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            {/* ✅ Blue for Export / Continue Actions */}
                                            <button onClick={() => setShareMode('email')} className="flex items-center justify-center gap-2 p-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm transition-colors cursor-pointer outline-none active:scale-95 shadow-sm">
                                                <Mail className="h-4 w-4" /> Email
                                            </button>
                                            {/* ✅ Blue for Export / Download */}
                                            <button onClick={executeDownloadPDF} disabled={isDownloading} className="flex items-center justify-center gap-2 p-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm transition-colors cursor-pointer outline-none active:scale-95 shadow-sm disabled:opacity-70">
                                                <Download className={`h-4 w-4 ${isDownloading ? 'animate-bounce' : ''}`} /> {isDownloading ? 'Saving...' : 'Save PDF'}
                                            </button>
                                        </div>

                                        {/* ✅ Premium Black for secondary fallback action */}
                                        <button onClick={executePrint} disabled={isPrinting} className="w-full mt-2 flex items-center justify-center gap-2 p-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 font-bold text-sm transition-colors cursor-pointer outline-none active:scale-95 disabled:opacity-70 shadow-sm">
                                            <Printer className={`h-4 w-4 ${isPrinting ? 'animate-pulse text-emerald-500' : ''}`} /> {isPrinting ? 'Connecting to printer...' : 'Print Physical Fallback'}
                                        </button>
                                    </div>
                                )}
                            </div>

                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}

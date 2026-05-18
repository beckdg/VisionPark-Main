import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import { apiClient } from "../../api/apiClient";
import { Header } from "../../components/layout/Header";
import { GlassCard } from "../../components/ui/GlassCard";
import {
  User, Mail, Lock, Phone, Car, Hash, MapPin, Globe, Shield, Check, ChevronDown, X, Eye, EyeOff
} from "lucide-react";

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

const hasInvalidNonDiplomaticLetterPlacement = (plate) => {
  const letterIndices = [...plate]
    .map((char, index) => (/[A-Z]/.test(char) ? index : -1))
    .filter((index) => index >= 0);
  return (
    letterIndices.length > 1 ||
    (letterIndices.length === 1 && letterIndices[0] !== 0)
  );
};

const isValidNonDiplomaticPlate = (plate) => {
  if (plate.length < 6 || plate.length > 8) return false;
  if (!/^[A-Z0-9]+$/.test(plate)) return false;
  if (hasInvalidNonDiplomaticLetterPlacement(plate)) return false;

  if (/^[A-Z]/.test(plate)) {
    return /^[A-Z][0-9]+$/.test(plate);
  }

  return /^[0-9]+$/.test(plate);
};

export default function DriverSignUp() {
  const navigate = useNavigate();
  const { setTheme } = useTheme();
  const auth = useAuth();

  useEffect(() => {
    const savedTheme = localStorage.getItem("vp_theme");
    if (!savedTheme) {
      setTheme("light");
    } else {
      setTheme(savedTheme);
    }
  }, [setTheme]);

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    repeatPassword: "",
    phone: "",
    licenceType: "Private",
    vehicleType: "Public Transport Vehicles | Upto 12 Seats",
    region: "Addis Ababa (AA)",
    countryCode: "",
    licensePlate: "",
    agreePolicy: false,
  });

  const [emailError, setEmailError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [plateError, setPlateError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [activeModal, setActiveModal] = useState(null);

  const [showPassword, setShowPassword] = useState(false);
  const [showRepeatPassword, setShowRepeatPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const getPasswordScore = (pass) => {
    let score = 0;
    if (!pass) return 0;
    if (pass.length >= 8) score += 1;
    if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score += 1;
    if (/\d/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;
    if (pass.length >= 12) score += 1;
    return Math.min(score, 5);
  };

  const passwordScore = getPasswordScore(formData.password);
  const isPasswordStrong = passwordScore >= 4;

  const getStrengthUI = (score) => {
    if (score === 0) return { text: "", color: "bg-transparent", textColor: "" };
    if (score <= 2) return { text: "Weak", color: "bg-red-500", textColor: "text-red-500" };
    if (score === 3) return { text: "Fair", color: "bg-amber-500", textColor: "text-amber-500" };
    if (score === 4) return { text: "Good", color: "bg-blue-500", textColor: "text-blue-500" };
    return { text: "Strong", color: "bg-emerald-500", textColor: "text-emerald-500" };
  };

  const strengthData = getStrengthUI(passwordScore);

  const hideRegion = ["United Nations", "African Union", "Government", "Temporary"].includes(formData.licenceType);
  const showCountry = formData.licenceType === "Diplomatic";

  const getPlatePrefix = () => {
    if (formData.licenceType === "Diplomatic") return "";
    if (formData.licenceType === "United Nations") return "UN";
    if (formData.licenceType === "African Union") return "AU";
    if (formData.licenceType === "Government" || formData.licenceType === "Temporary") return "ET";
    const regionMatch = formData.region.match(/\(([^)]+)\)/);
    return regionMatch ? regionMatch[1] : "AA";
  };

  const platePrefix = getPlatePrefix();

  const getPlatePlaceholder = () =>
    formData.licenceType === "Diplomatic" ? "01 CD 0123" : "0123456";

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const handlePlateChange = (e) => {
    let normalized = e.target.value.toUpperCase();
    if (formData.licenceType !== "Diplomatic") {
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
    setFormData((prev) => ({ ...prev, licensePlate: normalized }));
  };

  const handleSelectOption = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setActiveModal(null);
  };

  // Email validation
  useEffect(() => {
    const email = formData.email.trim();
    if (email.length > 0) {
      if (!email.includes("@")) { setEmailError("Please include an '@' in the email address."); return; }
      const [localPart, domainPart] = email.split("@");
      if (!localPart.length) { setEmailError("Please enter the part before the '@'."); return; }
      if (!domainPart || !domainPart.length) { setEmailError("Please enter a domain after the '@'."); return; }
      if (!domainPart.includes(".")) { setEmailError(`Please complete the domain (e.g., ${domainPart}.com).`); return; }
      const tld = domainPart.split(".").at(-1);
      if (tld.length < 2) { setEmailError("Domain extension is too short."); return; }
      const typos = {
        "gmai.com": "gmail.com", "gmal.com": "gmail.com", "gmail.co": "gmail.com", "gmail.c": "gmail.com",
        "yaho.com": "yahoo.com", "yahoo.co": "yahoo.com", "yhoo.com": "yahoo.com",
        "outloo.com": "outlook.com", "outlook.co": "outlook.com",
        "hotmail.co": "hotmail.com", "hotmal.com": "hotmail.com"
      };
      if (typos[domainPart.toLowerCase()]) { setEmailError(`Did you mean @${typos[domainPart.toLowerCase()]}?`); return; }
      setEmailError("");
    } else {
      setEmailError("");
    }
  }, [formData.email]);

  // Phone validation
  useEffect(() => {
    const phoneRaw = formData.phone.replace(/[\s-]/g, "");
    if (!phoneRaw.length) { setPhoneError(""); return; }
    const expectedLength = phoneRaw.startsWith("+2519") ? 13 : 10;
    if ((phoneRaw.startsWith("+2519") || phoneRaw.startsWith("09")) && phoneRaw.length === expectedLength) { setPhoneError(""); return; }
    if ((phoneRaw.startsWith("+2519") || phoneRaw.startsWith("09")) && phoneRaw.length > expectedLength) { setPhoneError("Number is too long."); return; }
    if (phoneRaw.startsWith("+2517") || phoneRaw.startsWith("07")) { setPhoneError("Only Ethio Telecom (09/+2519) supported."); return; }
    const isTypingPrefix = ["+", "+2", "+25", "+251", "0"].includes(phoneRaw);
    if (!phoneRaw.startsWith("+2519") && !phoneRaw.startsWith("09") && !isTypingPrefix) { setPhoneError("Must start with 09 or +2519."); return; }
    const timer = setTimeout(() => {
      const remaining = expectedLength - phoneRaw.length;
      setPhoneError(`Incomplete number. Needs ${remaining} more digits.`);
    }, 1200);
    return () => clearTimeout(timer);
  }, [formData.phone]);

  // Plate validation
  useEffect(() => {
    const plate = formData.licensePlate;

    if (!plate || plate.length < 6) {
      setPlateError("");
      return;
    }

    const timer = setTimeout(() => {
      validatePlate(plate, formData.licenceType);
    }, 300);

    return () => clearTimeout(timer);
  }, [formData.licensePlate, formData.licenceType]);

  // Password match
  useEffect(() => {
    if (formData.repeatPassword && formData.password !== formData.repeatPassword) {
      setPasswordError("Passwords do not match");
    } else {
      setPasswordError("");
    }
  }, [formData.password, formData.repeatPassword]);

  const validatePlate = (plate, type) => {
    let isValid = false;
    if (type === "Diplomatic") {
      isValid = /^(0[1-9]|[1-9][0-9]|1[0-2][0-9]|13[0-2])(CD)?[0-9]{4}$/.test(plate);
      setPlateError(isValid ? "" : "Invalid Diplomatic format.");
    } else {
      isValid = isValidNonDiplomaticPlate(plate);
      setPlateError(
        isValid
          ? ""
          : "Plate must be 6-8 characters: numbers only, or one letter at the start followed by numbers."
      );
    }
    return isValid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError("");
    if (!formData.email.trim()) {
      setSubmitError("Email is required.");
      return;
    }
    if (formData.password.length < 8) {
      setSubmitError("Password must be at least 8 characters.");
      return;
    }
    if (!formData.licensePlate.trim()) {
      setSubmitError("License plate is required.");
      return;
    }
    if (passwordError || !formData.agreePolicy) return;
    setIsSubmitting(true);

    const fullPlate = platePrefix ? `${platePrefix} ${formData.licensePlate}` : formData.licensePlate;
    const normalizedPhone = formData.phone.trim();
    const normalizedRegion = showCountry ? formData.countryCode.trim() : formData.region.trim();

    const payload = {
      name: formData.fullName.trim(),
      email: formData.email.trim(),
      password: formData.password,
      role: "driver",
      driver: {
        licenceType: formData.licenceType,
        licensePlate: fullPlate.trim(),
        vehicleType: formData.vehicleType,
        paymentMethod: "Telebirr",
      },
    };

    if (normalizedPhone) {
      payload.driver.phone = normalizedPhone;
    }
    if (normalizedRegion) {
      payload.driver.region = normalizedRegion;
    }

    try {
      await apiClient.post("/auth/register", payload);
      const loggedInUser = await auth.login(formData.email.trim(), formData.password);
      setIsSubmitting(false);
      setIsSuccess(true);

      if (loggedInUser?.role === "driver") {
        navigate("/driver");
        return;
      }
      navigate("/driver");
    } catch (error) {
      setIsSubmitting(false);
      setIsSuccess(false);
      setSubmitError(error?.message || "Registration failed.");
    }
  };

  const getInputClass = (hasError, isPassword = false) =>
    `block w-full h-12 md:h-14 pl-12 ${isPassword ? "pr-12 tracking-wider font-mono placeholder:font-sans placeholder:tracking-normal" : "pr-4"} rounded-xl text-sm md:text-base transition-all duration-300 outline-none border
    bg-white/50 text-zinc-900 placeholder:text-zinc-400
    dark:bg-black/40 dark:text-white dark:placeholder:text-zinc-600
    ${hasError
      ? "border-red-500/50 focus:border-red-500 focus:shadow-[0_0_15px_rgba(239,68,68,0.2)]"
      : "border-zinc-200 dark:border-white/10 hover:border-zinc-300 dark:hover:border-white/20 focus:border-emerald-500 focus:shadow-[0_0_15px_rgba(16,185,129,0.2)] focus:bg-white/80 dark:focus:bg-black/60"
    }`;

  const SelectorButton = ({ icon: Icon, label, value, field }) => (
    <div className="w-full min-w-0">
      <label className="block text-xs md:text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-1.5 ml-1">{label}</label>
      <button
        type="button"
        onClick={() => setActiveModal(field)}
        className="w-full h-12 md:h-14 relative flex items-center rounded-xl transition-all duration-300 outline-none cursor-pointer border border-zinc-200 dark:border-white/10 bg-white/50 dark:bg-black/40 text-zinc-900 dark:text-white hover:border-emerald-50 hover:shadow-[0_0_15px_rgba(16,185,129,0.2)] hover:bg-white/80 dark:hover:bg-black/60"
      >
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Icon className="h-5 w-5 md:h-6 md:w-6 text-zinc-400 dark:text-zinc-500" /></div>
        <span className="pl-12 pr-10 truncate text-left text-sm md:text-base w-full">{value}</span>
        <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none"><ChevronDown className="h-4 w-4 md:h-5 md:w-5 text-zinc-400 dark:text-zinc-500" /></div>
      </button>
    </div>
  );

  return (
    // FIX: `auth-page` hides the scrollbar on the page root — defined in global CSS
    <div className="auth-page relative min-h-[100dvh] w-full overflow-x-hidden bg-[#f4f4f5] dark:bg-[#09090b] text-zinc-900 dark:text-white flex flex-col font-sans transition-colors duration-500">

      <Header />

      <div className="ambient-glow-primary fixed w-[50vw] h-[50vw] top-[-10%] left-[-10%] pointer-events-none z-0" />
      <div className="ambient-glow-secondary fixed w-[40vw] h-[40vw] bottom-[-10%] right-[-10%] pointer-events-none z-0" />

      <main className="flex-1 flex flex-col px-4 md:px-8 w-full relative pt-28 md:pt-32 pb-16">
        <div className="w-full max-w-xl m-auto flex flex-col items-center">

          <div className="flex flex-col items-center mb-8 mt-4">
            <div className="flex items-center gap-2 mb-6">
              <div className="flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-500 shadow-sm backdrop-blur-sm">
                <Car className="h-6 w-6 md:h-7 md:w-7" />
              </div>
              <span className="font-bold text-2xl md:text-3xl tracking-wide drop-shadow-sm">VisionPark</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold mb-2 text-center drop-shadow-sm">Create Account</h1>
            <p className="text-xs md:text-sm text-zinc-500 dark:text-zinc-400 text-center font-medium">Join VisionPark to reserve spots instantly.</p>
          </div>

          <div className="w-full">
            <GlassCard>
              <form onSubmit={handleSubmit} className="flex flex-col gap-5 md:gap-6 w-full">

                {/* Full Name */}
                <div className="w-full min-w-0">
                  <label className="block text-xs md:text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-1.5 ml-1">Full Name</label>
                  <div className="relative group w-full">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <User className="h-5 w-5 md:h-6 md:w-6 text-zinc-400 dark:text-zinc-500 group-focus-within:text-emerald-500 transition-colors duration-300" />
                    </div>
                    <input type="text" name="fullName" value={formData.fullName} onChange={handleChange} required placeholder="Abebe Bikila" className={getInputClass(false)} />
                  </div>
                </div>

                {/* Email */}
                <div className="w-full min-w-0">
                  <label className="block text-xs md:text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-1.5 ml-1 flex justify-between">
                    Email {emailError && <span className="text-red-500 text-[10px] mt-0.5">{emailError}</span>}
                  </label>
                  <div className="relative group w-full">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 md:h-6 md:w-6 text-zinc-400 dark:text-zinc-500 group-focus-within:text-emerald-500 transition-colors duration-300" />
                    </div>
                    <input type="email" name="email" value={formData.email} onChange={handleChange} required placeholder="driver@example.com" className={getInputClass(!!emailError)} />
                  </div>
                </div>

                {/* Password row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6 w-full">
                  <div className="w-full min-w-0">
                    <label className="block text-xs md:text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-1.5 ml-1">Password</label>
                    <div className="relative group w-full">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Lock className="h-5 w-5 md:h-6 md:w-6 text-zinc-400 dark:text-zinc-500 group-focus-within:text-emerald-500 transition-colors duration-300" />
                      </div>
                      <input
                        type={showPassword ? "text" : "password"}
                        name="password" value={formData.password} onChange={handleChange} required
                        placeholder="Create password"
                        onCopy={e => e.preventDefault()} onPaste={e => e.preventDefault()} onCut={e => e.preventDefault()}
                        className={getInputClass(false, true)}
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 flex items-center pr-4 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer outline-none">
                        {showPassword ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
                      </button>
                    </div>
                    {formData.password && (
                      <div className="mt-2 animate-in fade-in duration-300">
                        <div className="flex gap-1 h-1.5 w-full rounded-full overflow-hidden bg-zinc-200 dark:bg-white/10">
                          {[1, 2, 3, 4, 5].map(level => (
                            <div key={level} className={`flex-1 transition-colors duration-300 ${passwordScore >= level ? strengthData.color : "bg-transparent"}`} />
                          ))}
                        </div>
                        <div className="flex justify-between items-center mt-1.5">
                          <span className="text-[10px] md:text-[11px] text-zinc-500 dark:text-zinc-400">8+ chars, upper, lower, num, symbol</span>
                          <span className={`text-[10px] md:text-[11px] font-bold uppercase tracking-wider ${strengthData.textColor}`}>{strengthData.text}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="w-full min-w-0">
                    <label className="block text-xs md:text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-1.5 ml-1 flex justify-between">
                      Repeat Password {passwordError && <span className="text-red-500 text-[10px] mt-0.5">{passwordError}</span>}
                    </label>
                    <div className="relative group w-full">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Lock className="h-5 w-5 md:h-6 md:w-6 text-zinc-400 dark:text-zinc-500 group-focus-within:text-emerald-500 transition-colors duration-300" />
                      </div>
                      <input
                        type={showRepeatPassword ? "text" : "password"}
                        name="repeatPassword" value={formData.repeatPassword} onChange={handleChange} required
                        placeholder="Confirm password"
                        onCopy={e => e.preventDefault()} onPaste={e => e.preventDefault()} onCut={e => e.preventDefault()}
                        className={getInputClass(!!passwordError, true)}
                      />
                      <button type="button" onClick={() => setShowRepeatPassword(!showRepeatPassword)}
                        className="absolute inset-y-0 right-0 flex items-center pr-4 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer outline-none">
                        {showRepeatPassword ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Phone */}
                <div className="w-full min-w-0">
                  <label className="block text-xs md:text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-1.5 ml-1 flex justify-between">
                    Phone Number {phoneError && <span className="text-red-500 text-[10px] mt-0.5">{phoneError}</span>}
                  </label>
                  <div className="relative group w-full">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Phone className="h-5 w-5 md:h-6 md:w-6 text-zinc-400 dark:text-zinc-500 group-focus-within:text-emerald-500 transition-colors duration-300" />
                    </div>
                    <input type="tel" name="phone" value={formData.phone} onChange={handleChange} required placeholder="+251 91 234 5678" className={getInputClass(!!phoneError)} />
                  </div>
                </div>

                {/* Licence + Vehicle */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6 w-full">
                  <SelectorButton icon={Shield} label="Licence Type" value={formData.licenceType} field="licenceType" />
                  <SelectorButton icon={Car} label="Vehicle Category" value={formData.vehicleType} field="vehicleType" />
                </div>

                {/* Region / Country + Plate */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6 w-full">
                  {showCountry ? (
                    <div className="w-full min-w-0">
                      <label className="block text-xs md:text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-1.5 ml-1">Country</label>
                      <div className="relative group w-full">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <Globe className="h-5 w-5 md:h-6 md:w-6 text-zinc-400 dark:text-zinc-500 group-focus-within:text-emerald-500 transition-colors duration-300" />
                        </div>
                        <input type="text" name="countryCode" value={formData.countryCode} onChange={handleChange} required placeholder="E.g., Italy" className={getInputClass(false)} />
                      </div>
                    </div>
                  ) : hideRegion ? (
                    <div className="hidden md:block w-full min-w-0" />
                  ) : (
                    <SelectorButton icon={MapPin} label="Region" value={formData.region} field="region" />
                  )}

                  <div className="w-full min-w-0">
                    <label className="block text-xs md:text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-1.5 ml-1">
                      License Plate
                    </label>

                    {plateError && (
                      <p className="text-red-500 text-[10px] mb-1 ml-1 whitespace-nowrap">
                        {plateError}
                      </p>
                    )}
                    <div className={`relative group flex items-center w-full h-12 md:h-14 rounded-xl text-sm md:text-base transition-all duration-300 outline-none border bg-white/50 dark:bg-black/40 text-zinc-900 dark:text-white overflow-hidden min-h-[56px]
                      ${plateError
                        ? "border-red-500/50 focus-within:border-red-500 focus-within:shadow-[0_0_15px_rgba(239,68,68,0.2)]"
                        : "border-zinc-200 dark:border-white/10 hover:border-zinc-300 dark:hover:border-white/20 focus-within:border-emerald-500 focus-within:shadow-[0_0_15px_rgba(16,185,129,0.2)] focus-within:bg-white/80 dark:focus-within:bg-black/60"
                      }`}>
                      <div className="pl-4 pr-3 flex items-center pointer-events-none text-zinc-400 dark:text-zinc-500 group-focus-within:text-emerald-500 transition-colors duration-300 shrink-0">
                        <Hash className="h-5 w-5 md:h-6 md:w-6" />
                      </div>
                      {platePrefix && (
                        <div className="flex items-center justify-center h-full px-3 bg-zinc-100 dark:bg-white/5 border-r border-zinc-200 dark:border-white/10 font-mono font-bold text-zinc-700 dark:text-zinc-300 shrink-0">
                          {platePrefix}
                        </div>
                      )}
                      <input
                        type="text" name="licensePlate" value={formData.licensePlate}
                        onChange={handlePlateChange} required
                        placeholder={getPlatePlaceholder()}
                        className="flex-1 h-full pl-3 pr-4 bg-transparent outline-none font-mono placeholder:font-sans placeholder:tracking-normal w-full min-w-0"
                      />
                    </div>
                  </div>
                </div>

                {/* Privacy policy */}
                <div className="flex items-start gap-3 mt-2 p-4 md:p-5 border border-zinc-200 dark:border-white/10 rounded-xl bg-white/50 dark:bg-black/40 select-none w-full min-w-0">
                  <label htmlFor="agreePolicy" className="relative flex items-center justify-center h-5 w-5 shrink-0 rounded-[6px] border border-zinc-300 dark:border-zinc-600 bg-white/50 dark:bg-black/40 transition-all duration-300 hover:border-emerald-500 dark:hover:border-emerald-400 overflow-hidden shadow-sm mt-0.5 cursor-pointer">
                    <input type="checkbox" id="agreePolicy" name="agreePolicy" checked={formData.agreePolicy} onChange={handleChange} className="peer sr-only" />
                    <div className="absolute inset-0 bg-emerald-500 opacity-0 peer-checked:opacity-100 transition-opacity duration-300" />
                    <Check className="h-3.5 w-3.5 text-white absolute scale-0 opacity-0 peer-checked:scale-100 peer-checked:opacity-100 transition-all duration-300 z-10" strokeWidth={4} />
                  </label>
                  <div className="text-xs md:text-sm text-zinc-600 dark:text-zinc-400 leading-snug w-full">
                    <label htmlFor="agreePolicy" className="cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors">I agree to the </label>
                    <a href="/privacy-policy" target="_blank" rel="noopener noreferrer"
                      className="text-zinc-900 dark:text-white underline underline-offset-4 font-medium hover:text-emerald-500 transition-colors z-10 cursor-pointer break-words">
                      Article 26 Privacy Policy
                    </a>
                  </div>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={!!passwordError || !formData.agreePolicy || isSubmitting || isSuccess}
                  className={`group relative w-full h-12 md:h-14 mt-2 flex items-center justify-center rounded-xl font-bold text-sm md:text-base tracking-wide uppercase overflow-hidden transition-all duration-300 outline-none cursor-pointer ${isSuccess
                    ? "bg-emerald-600 text-white shadow-[0_0_20px_rgba(5,150,105,0.5)]"
                    : "bg-emerald-500 text-zinc-950 hover:bg-emerald-400 hover:scale-[1.02] active:scale-95 shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)]"
                    } disabled:opacity-70 disabled:hover:scale-100 disabled:cursor-not-allowed`}
                >
                  {!isSuccess && <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />}
                  {isSubmitting ? (
                    <span className="flex items-center gap-2 animate-pulse">Processing...</span>
                  ) : isSuccess ? (
                    <span className="flex items-center gap-2"><Check className="h-5 w-5" /> Account Created!</span>
                  ) : (
                    "Create Account"
                  )}
                </button>
                {submitError && (
                  <p className="text-center text-xs md:text-sm text-red-500">{submitError}</p>
                )}

                <p className="text-center text-xs md:text-sm text-zinc-600 dark:text-zinc-400 mt-2">
                  Already have an account?{" "}
                  <Link to="/login" className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline underline-offset-4 transition-all">Sign in</Link>
                </p>
              </form>
            </GlassCard>
          </div>
        </div>
      </main>

      {/* Modal — FIX: auth-page on the scroll container hides its inner scrollbar */}
      {activeModal && (
        <div className="fixed inset-0 z-[6000] flex items-center justify-center bg-zinc-900/40 dark:bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div
            className="w-full max-w-sm md:max-w-md bg-white dark:bg-[#121214] rounded-3xl shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-300"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 md:p-6 border-b border-zinc-200 dark:border-white/10">
              <h3 className="text-lg md:text-xl font-bold text-zinc-900 dark:text-white">
                {activeModal === "licenceType" ? "Select Licence Type" : activeModal === "vehicleType" ? "Select Vehicle Category" : "Select Region"}
              </h3>
              <button onClick={() => setActiveModal(null)} className="p-2 -mr-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors rounded-full hover:bg-zinc-100 dark:hover:bg-white/5 outline-none cursor-pointer active:scale-90">
                <X className="h-5 w-5 md:h-6 md:w-6" />
              </button>
            </div>

            {/* FIX: auth-page hides the scrollbar inside the modal option list */}
            <div className="auth-page overflow-y-auto p-3 md:p-4 overscroll-contain">
              {(activeModal === "licenceType" ? LICENCE_OPTIONS : activeModal === "vehicleType" ? VEHICLE_OPTIONS : REGION_OPTIONS).map((group, gIndex) => (
                <div key={gIndex} className="mb-4 last:mb-0">
                  <h4 className="text-[10px] md:text-[11px] uppercase tracking-wider font-bold text-zinc-500 dark:text-zinc-400 px-3 mb-2">{group.group}</h4>
                  <div className="space-y-1 md:space-y-2">
                    {group.items.map((item, iIndex) => {
                      const isSelected = formData[activeModal] === item;
                      return (
                        <button key={iIndex} onClick={() => handleSelectOption(activeModal, item)}
                          className={`w-full flex items-center justify-between p-4 rounded-xl text-left transition-all outline-none cursor-pointer active:scale-[0.98] ${isSelected ? "bg-emerald-50 dark:bg-emerald-500/10" : "hover:bg-zinc-50 dark:hover:bg-white/5 active:bg-zinc-100 dark:active:bg-zinc-800"}`}>
                          <span className={`text-sm md:text-base ${isSelected ? "font-bold text-emerald-600 dark:text-emerald-400" : "font-medium text-zinc-700 dark:text-zinc-300"}`}>{item}</span>
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
    </div>
  );
}
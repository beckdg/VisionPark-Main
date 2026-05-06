import React, { useState, useEffect, useMemo, useCallback, memo, useRef } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import {
    MapPin, Car, ChevronLeft, ChevronRight, Building2,
    Navigation, ExternalLink, X, UserPlus, LogIn, Compass,
    BrainCircuit, Zap, ShieldCheck, ArrowRight, ChevronDown,
    AlertTriangle, CheckCircle
} from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../../api/apiClient";

const DEFAULT_LOC = [9.0249, 38.7468]; // Addis Ababa Center

const normalizeRegionId = (region) => {
    const val = String(region || "").trim().toLowerCase();
    if (val.includes("addis")) return "Addis Ababa";
    if (val.includes("dire")) return "Dire Dawa";
    if (val.includes("oromia")) return "Oromia";
    if (val.includes("amhara")) return "Amhara";
    if (val.includes("tigray")) return "Tigray";
    if (val.includes("somali")) return "Somali";
    if (val.includes("sidama")) return "Sidama";
    return "Addis Ababa";
};

const REGIONS = [
    { id: "Addis Ababa", label: "Addis Ababa", group: "FEDERAL", center: [9.0249, 38.7468] },
    { id: "Dire Dawa", label: "Dire Dawa", group: "FEDERAL", center: [9.5931, 41.8591] },
    { id: "Oromia", label: "Oromia Region (Adama)", group: "MAJOR", center: [8.5414, 39.2689] },
    { id: "Amhara", label: "Amhara Region (Bahir Dar)", group: "MAJOR", center: [11.5940, 37.3875] },
    { id: "Tigray", label: "Tigray Region (Mekelle)", group: "MAJOR", center: [13.4967, 39.4753] },
    { id: "Somali", label: "Somali Region (Jigjiga)", group: "MAJOR", center: [9.3541, 42.7956] },
    { id: "Sidama", label: "Sidama Region (Hawassa)", group: "MAJOR", center: [7.0504, 38.4690] },
];

const FEATURES = [
    { icon: BrainCircuit, title: "Edge AI & LPR", desc: "Our cameras read license plates in milliseconds. Drive in and drive out. No tickets, no queues, no boom barriers." },
    { icon: Zap, title: "Real-Time Tracking", desc: "Live availability syncs straight to your app. Know exactly where to park and how much it costs before you arrive." },
    { icon: ShieldCheck, title: "Smart Enforcement", desc: "Automated Debt Radar catches repeat offenders and logs property damage instantly, keeping the lot safe and fair." }
];

// FIXED: True Haversine formula converting degrees to radians
const mockHaversineDistance = (lat1, lon1, lat2, lon2) => {
    const toRad = x => (x * Math.PI) / 180;
    const R = 6371; // Earth's radius in km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

const driverIcon = L.divIcon({
    className: "custom-driver-marker",
    html: `<div class="relative flex h-8 w-8 items-center justify-center">
    <div class="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-40"></div>
    <div class="h-4 w-4 rounded-full bg-emerald-600 border-2 border-white shadow-md z-10 flex items-center justify-center"></div>
  </div>`,
    iconSize: [32, 32],
});

const createIcon = (isFocused, theme) => L.divIcon({
    className: "custom-p-marker",
    html: `<div class="flex h-10 w-10 items-center justify-center rounded-full border-2 ${isFocused
        ? "border-amber-400 bg-emerald-500 scale-110 z-50 shadow-[0_0_20px_rgba(16,185,129,0.8)]"
        : `${theme === "dark" ? "border-[#09090b]" : "border-white"} bg-emerald-500/80 shadow-md`
        } transition-all duration-300">
    <span class="text-sm font-bold text-zinc-950">P</span>
  </div>`,
    iconSize: [40, 40],
});

function MapCamera({ center, zoom }) {
    const map = useMap();
    useEffect(() => {
        if (center && center.length === 2 && !isNaN(center[0]) && !isNaN(center[1])) {
            map.flyTo(center, zoom, { animate: true, duration: 1.5 });
        }
    }, [center[0], center[1], zoom, map]);
    return null;
}

const ParkingMap = memo(({ areas, focusedAreaId, tileUrl, onMarkerClick, userLocation, selectedRegion }) => {
    const normalIcon = useMemo(() => createIcon(false, tileUrl.includes("dark") ? "dark" : "light"), [tileUrl]);
    const focusedIcon = useMemo(() => createIcon(true, tileUrl.includes("dark") ? "dark" : "light"), [tileUrl]);

    const focusedArea = areas.find(a => a.id === focusedAreaId);

    let mapCenter = userLocation;
    let mapZoom = 13;

    if (selectedRegion === "ALL") {
        mapCenter = [9.145, 40.4896];
        mapZoom = 6;
    } else if (focusedArea) {
        mapCenter = [focusedArea.lat, focusedArea.lon];
        mapZoom = 14;
    }

    return (
        <MapContainer
            center={mapCenter}
            zoom={mapZoom}
            zoomControl={false}
            preferCanvas={true}
            scrollWheelZoom={true}
            doubleClickZoom={true}
            className="h-full w-full outline-none z-0"
        >
            <TileLayer
                attribution='© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'
                url={tileUrl}
                detectRetina={false}
                keepBuffer={4}
                updateWhenIdle={true}
                updateWhenZooming={false}
            />
            <Marker position={userLocation} icon={driverIcon} zIndexOffset={1000} />
            {areas.map((area) => (
                <Marker
                    key={area.id}
                    position={[area.lat, area.lon]}
                    icon={area.id === focusedAreaId && selectedRegion !== "ALL" ? focusedIcon : normalIcon}
                    eventHandlers={{
                        click: () => onMarkerClick(area.id, area.region)
                    }}
                />
            ))}
            <MapCamera center={mapCenter} zoom={mapZoom} />
        </MapContainer>
    );
});

export default function GuestMap() {
    const { theme, setTheme } = useTheme();
    const navigate = useNavigate();

    const [userLocation, setUserLocation] = useState(DEFAULT_LOC);
    const [selectedRegion, setSelectedRegion] = useState("ALL");
    const [allAreas, setAllAreas] = useState([]);
    const [areas, setAreas] = useState([]);
    const [focusedAreaId, setFocusedAreaId] = useState(null);

    // Modal Control States
    const [isRegionMenuOpen, setIsRegionMenuOpen] = useState(false);
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [pendingMapRoute, setPendingMapRoute] = useState(null);

    const [touchStartX, setTouchStartX] = useState(null);
    const [touchEndX, setTouchEndX] = useState(null);

    const [toast, setToast] = useState({ message: "", type: "success" });

    // HTML5 Native Dialog Refs
    const regionModalRef = useRef(null);
    const authModalRef = useRef(null);
    const mapRouteModalRef = useRef(null);

    const showToast = (message, type = "success") => {
        setToast({ message, type });
        setTimeout(() => setToast({ message: "", type: "success" }), 4000);
    };

    useEffect(() => {
        if (!setTheme) return;
        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
        setTheme(mediaQuery.matches ? "dark" : "light");
        const handleChange = (e) => setTheme(e.matches ? "dark" : "light");
        mediaQuery.addEventListener("change", handleChange);
        return () => mediaQuery.removeEventListener("change", handleChange);
    }, [setTheme]);

    const mapTileUrl = useMemo(() =>
        theme === "dark"
            ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        [theme]);

    // Handle HTML5 Dialog Toggles
    useEffect(() => {
        if (isRegionMenuOpen) regionModalRef.current?.showModal();
        else regionModalRef.current?.close();
    }, [isRegionMenuOpen]);

    useEffect(() => {
        if (showAuthModal) authModalRef.current?.showModal();
        else authModalRef.current?.close();
    }, [showAuthModal]);

    useEffect(() => {
        if (pendingMapRoute) mapRouteModalRef.current?.showModal();
        else mapRouteModalRef.current?.close();
    }, [pendingMapRoute]);

    // Initial Auto-Detection (Silent fallback)
    useEffect(() => {
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const lat = position.coords.latitude;
                    const lon = position.coords.longitude;
                    setUserLocation([lat, lon]);

                    let closestRegion = "ALL";
                    let minDistance = Infinity;

                    REGIONS.forEach(r => {
                        const d = mockHaversineDistance(lat, lon, r.center[0], r.center[1]);
                        if (d < minDistance) {
                            minDistance = d;
                            closestRegion = r.id;
                        }
                    });

                    if (minDistance < 150) setSelectedRegion(closestRegion);
                    else setSelectedRegion("ALL");
                },
                (error) => {
                    setUserLocation(DEFAULT_LOC);
                    setSelectedRegion("Addis Ababa");
                },
                { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
            );
        }
    }, []);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const lots = await apiClient.get("/parking/public/lots");
                const mappedLots = Array.isArray(lots)
                    ? lots.map((lot) => ({
                        id: String(lot._id),
                        _id: String(lot._id),
                        region: normalizeRegionId(lot.region),
                        name: lot.name || "Unnamed Parking",
                        lat: lot?.location?.coordinates?.[1] ?? DEFAULT_LOC[0],
                        lon: lot?.location?.coordinates?.[0] ?? DEFAULT_LOC[1],
                        price: Number(lot?.price ?? 0),
                        availableSpaces: Number(lot?.availableSpaces ?? 0),
                    }))
                    : [];

                if (!cancelled) {
                    setAllAreas(mappedLots);
                }
            } catch (error) {
                if (!cancelled) {
                    setAllAreas([]);
                    showToast(error?.message || "Failed to load parking data.", "error");
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        let filteredAreas = allAreas;
        if (selectedRegion !== "ALL") {
            filteredAreas = allAreas.filter(area => area.region === selectedRegion);
            const sorted = filteredAreas.map((area) => {
                const dist = mockHaversineDistance(userLocation[0], userLocation[1], area.lat, area.lon);
                return { ...area, distance: dist };
            }).sort((a, b) => a.distance - b.distance);

            setAreas(sorted);
            if (sorted.length > 0) setFocusedAreaId(sorted[0].id);
            else setFocusedAreaId(null);
        } else {
            const national = allAreas.map((area) => ({
                ...area,
                distance: mockHaversineDistance(userLocation[0], userLocation[1], area.lat, area.lon),
            }));
            setAreas(national);
            setFocusedAreaId(national[0]?.id || null);
        }
    }, [userLocation, selectedRegion, allAreas]);

    const handleRegionChange = (val) => {
        setSelectedRegion(val);
        setIsRegionMenuOpen(false);
    };

    // Explicit GPS Location Button Handler
    const handleLocateMe = () => {
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const lat = position.coords.latitude;
                    const lon = position.coords.longitude;
                    setUserLocation([lat, lon]);

                    let closestRegion = "ALL";
                    let minDistance = Infinity;

                    REGIONS.forEach(r => {
                        const d = mockHaversineDistance(lat, lon, r.center[0], r.center[1]);
                        if (d < minDistance) {
                            minDistance = d;
                            closestRegion = r.id;
                        }
                    });

                    if (minDistance < 150) {
                        setSelectedRegion(closestRegion);
                        showToast(`Location found! Closest region: ${REGIONS.find(r => r.id === closestRegion)?.label}`, "success");
                    } else {
                        setSelectedRegion("ALL");
                        showToast("Location found, but outside major network regions. Showing National map.", "success");
                    }
                },
                (error) => {
                    showToast("Location access denied. Please check your browser settings or select manually.", "error");
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
        } else {
            showToast("Geolocation is not supported by your browser.", "error");
        }
    };

    const handleMarkerClick = useCallback((areaId, region) => {
        if (selectedRegion === "ALL") {
            setSelectedRegion(region);
        }
        setFocusedAreaId(areaId);
    }, [selectedRegion]);

    const activeIndex = areas.findIndex(a => a.id === focusedAreaId);
    const safeActiveIndex = activeIndex >= 0 ? activeIndex : 0;

    const handleNext = useCallback(() => {
        if (selectedRegion === "ALL") return;
        setAreas(prev => {
            if (prev.length <= 1) return prev;
            const idx = prev.findIndex(a => a.id === focusedAreaId);
            const safe = idx >= 0 ? idx : 0;
            const next = (safe + 1) % prev.length;
            setFocusedAreaId(prev[next].id);
            return prev;
        });
    }, [focusedAreaId, selectedRegion]);

    const handlePrev = useCallback(() => {
        if (selectedRegion === "ALL") return;
        setAreas(prev => {
            if (prev.length <= 1) return prev;
            const idx = prev.findIndex(a => a.id === focusedAreaId);
            const safe = idx >= 0 ? idx : 0;
            const prev2 = (safe - 1 + prev.length) % prev.length;
            setFocusedAreaId(prev[prev2].id);
            return prev;
        });
    }, [focusedAreaId, selectedRegion]);

    const getOffset = (index) => {
        if (areas.length === 0) return 0;
        let offset = index - safeActiveIndex;
        const half = Math.floor(areas.length / 2);
        if (offset > half) offset -= areas.length;
        if (offset < -half) offset += areas.length;
        return offset;
    };

    const onTouchStart = (e) => { e.stopPropagation(); setTouchStartX(e.targetTouches[0].clientX); setTouchEndX(null); };
    const onTouchMove = (e) => { e.stopPropagation(); setTouchEndX(e.targetTouches[0].clientX); };
    const onTouchEnd = (e) => {
        e.stopPropagation();
        if (!touchStartX || !touchEndX || selectedRegion === "ALL") return;
        const d = touchStartX - touchEndX;
        if (d > 50) handleNext();
        if (d < -50) handlePrev();
    };

    const confirmOpenGoogleMaps = () => {
        if (pendingMapRoute) {
            window.open(`https://www.google.com/maps/dir/?api=1&origin=${userLocation[0]},${userLocation[1]}&destination=${pendingMapRoute.lat},${pendingMapRoute.lon}&travelmode=driving`, "_blank", "noopener,noreferrer");
            setPendingMapRoute(null);
        }
    };

    const scrollToMap = () => {
        document.getElementById('live-map-section').scrollIntoView({ behavior: 'smooth' });
    };

    return (
        <div className="h-[100dvh] w-full bg-[#f4f4f5] dark:bg-[#09090b] text-zinc-900 dark:text-white font-sans selection:bg-emerald-500/30 overflow-hidden flex flex-col relative">

            {/* ── TOAST NOTIFICATIONS (Responsive Mobile Width) ── */}
            {toast.message && (
                <div className={`fixed top-20 md:top-24 left-1/2 -translate-x-1/2 w-[92vw] max-w-[340px] md:max-w-max font-bold text-xs md:text-sm px-4 md:px-6 py-3 md:py-3.5 rounded-xl md:rounded-2xl shadow-2xl z-[8000] animate-in slide-in-from-top-4 flex items-center gap-3 text-left md:text-center ${toast.type === "error" ? "bg-red-600 text-white" : "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900"}`}>
                    {toast.type === "error" ? <AlertTriangle className="h-5 w-5 shrink-0" /> : <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />}
                    <span className="leading-snug">{toast.message}</span>
                </div>
            )}

            {/* ── CUSTOM STYLES ── */}
            <style>{`
                .guest-scroll::-webkit-scrollbar { width: 6px; }
                .guest-scroll::-webkit-scrollbar-track { background: transparent; }
                .guest-scroll::-webkit-scrollbar-thumb { background-color: rgba(161, 161, 170, 0.4); border-radius: 10px; }
                .dark .guest-scroll::-webkit-scrollbar-thumb { background-color: rgba(82, 82, 91, 0.4); }
                .guest-scroll::-webkit-scrollbar-thumb:hover { background-color: rgba(161, 161, 170, 0.8); }
                .dark .guest-scroll::-webkit-scrollbar-thumb:hover { background-color: rgba(82, 82, 91, 0.8); }

                .leaflet-bottom.leaflet-right { bottom: 24px !important; right: 24px !important; }
                .leaflet-control-attribution {
                    border-radius: 6px !important; padding: 3px 8px !important;
                    background-color: rgba(255,255,255,0.9) !important; backdrop-filter: blur(4px);
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1); font-weight: 500; font-size: 10px !important;
                }
                .dark .leaflet-control-attribution { background-color: rgba(24,24,27,0.9) !important; color: #a1a1aa !important; }
                .dark .leaflet-control-attribution a { color: #34d399 !important; }

                @media (max-width: 768px) {
                    .leaflet-bottom.leaflet-right { bottom: 16px !important; right: 16px !important; }
                    .leaflet-control-attribution { font-size: 8px !important; padding: 2px 6px !important; max-width: 140px; white-space: normal; text-align: right; }
                }
            `}</style>

            {/* ── HEADER ── */}
            <header className="w-full h-16 md:h-20 shrink-0 bg-white/80 dark:bg-[#121214]/80 backdrop-blur-xl border-b border-zinc-200 dark:border-white/10 flex items-center justify-between px-4 md:px-8 z-[5000] shadow-sm">
                <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 md:h-10 md:w-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 shrink-0">
                        <Car className="h-5 w-5 md:h-6 md:w-6" strokeWidth={2.5} />
                    </div>
                    <span className="text-xl md:text-2xl font-black tracking-tight">VisionPark</span>
                </div>
                <div className="flex items-center gap-3 md:gap-4">
                    <button onClick={() => navigate("/login")} className="text-xs md:text-sm font-bold text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-colors outline-none cursor-pointer whitespace-nowrap">Log In</button>
                    <button onClick={() => navigate("/signup")} className="text-[10px] md:text-sm font-bold bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-900 px-3 py-2 md:px-5 md:py-2.5 rounded-lg md:rounded-xl active:scale-95 transition-all outline-none cursor-pointer shadow-md whitespace-nowrap">Sign Up Free</button>
                </div>
            </header>

            {/* ── SCROLLABLE MAIN CONTENT ── */}
            <main className="flex-1 w-full overflow-y-auto overflow-x-hidden guest-scroll relative z-0">

                <div className="ambient-glow-primary fixed w-[50vw] h-[50vw] top-[-10%] left-[-10%] pointer-events-none z-[-1]" />
                <div className="ambient-glow-secondary fixed w-[40vw] h-[40vw] bottom-[-10%] right-[-10%] pointer-events-none z-[-1]" />
                <div className="absolute inset-0 z-[-1] pointer-events-none flex justify-center h-[800px]">
                    <div className="w-full h-full bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_100%)] dark:bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)]"></div>
                </div>

                {/* ── HERO LANDING SECTION ── */}
                <section className="pt-16 pb-12 md:pt-32 md:pb-24 px-4 md:px-6 max-w-7xl mx-auto flex flex-col items-center text-center relative z-10">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-bold text-[10px] md:text-xs uppercase tracking-widest mb-6 border border-emerald-200 dark:border-emerald-500/20">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        National Network Active
                    </div>

                    <h1 className="text-3xl sm:text-5xl lg:text-7xl font-black tracking-tight leading-[1.1] mb-4 md:mb-6 max-w-4xl drop-shadow-sm">
                        The Future of <span className="text-emerald-500">Urban Parking</span> is Here.
                    </h1>

                    <p className="text-sm sm:text-base md:text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mb-8 md:mb-10 leading-relaxed font-medium px-2">
                        VisionPark is a frictionless, automated parking system. We use Edge AI and License Plate Recognition to eliminate tickets, queues, and boom barriers. Just drive in, park, and go.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-3 md:gap-4 w-full sm:w-auto px-4 sm:px-0">
                        <button onClick={scrollToMap} className="w-full sm:w-auto px-6 md:px-8 py-3.5 md:py-4 rounded-xl md:rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-black shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 outline-none cursor-pointer text-sm md:text-base">
                            Explore Live Map <MapPin className="h-4 w-4 md:h-5 md:w-5" />
                        </button>
                        <button onClick={() => navigate("/signup")} className="w-full sm:w-auto px-6 md:px-8 py-3.5 md:py-4 rounded-xl md:rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 hover:bg-zinc-50 dark:hover:bg-zinc-800 font-bold shadow-sm active:scale-95 transition-all flex items-center justify-center gap-2 outline-none cursor-pointer text-sm md:text-base">
                            Create Free Account <ArrowRight className="h-4 w-4 md:h-5 md:w-5" />
                        </button>
                    </div>
                </section>

                {/* ── FEATURES GRID ── */}
                <section className="py-12 md:py-24 bg-white/50 dark:bg-[#121214]/50 backdrop-blur-md border-y border-zinc-200 dark:border-white/5 relative z-10">
                    <div className="max-w-7xl mx-auto px-4 md:px-6">
                        <div className="text-center mb-10 md:mb-16">
                            <h2 className="text-2xl md:text-4xl font-black mb-3 md:mb-4">How VisionPark Works</h2>
                            <p className="text-sm md:text-base text-zinc-500 dark:text-zinc-400 font-medium">A seamless experience powered by advanced computer vision.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
                            {FEATURES.map((feature, idx) => (
                                <div key={idx} className="p-6 md:p-8 rounded-3xl bg-white/80 dark:bg-black/40 backdrop-blur-sm border border-zinc-200 dark:border-white/10 flex flex-col items-start hover:border-emerald-500/50 transition-colors shadow-sm group">
                                    <div className="h-12 w-12 md:h-14 md:w-14 rounded-2xl bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-5 md:mb-6 group-hover:scale-110 transition-transform shadow-sm">
                                        <feature.icon className="h-6 w-6 md:h-7 md:w-7" />
                                    </div>
                                    <h3 className="text-lg md:text-xl font-black mb-2 md:mb-3">{feature.title}</h3>
                                    <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed font-medium text-xs md:text-sm">
                                        {feature.desc}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── LIVE INTERACTIVE MAP SECTION ── */}
                <section id="live-map-section" className="py-12 md:py-24 px-3 md:px-8 max-w-[1600px] mx-auto relative z-10">

                    <div className="text-center mb-8 md:mb-12 px-2">
                        <h2 className="text-2xl sm:text-3xl md:text-5xl font-black mb-3 md:mb-4 drop-shadow-sm">Live Network Status</h2>
                        <p className="text-xs md:text-sm text-zinc-500 dark:text-zinc-400 font-medium max-w-xl mx-auto mb-6 md:mb-8 leading-relaxed">
                            Find available spots across Ethiopia in real-time. Use GPS to find the closest spots, or manually select your region.
                        </p>

                        <div className="flex justify-center items-center gap-3 w-full max-w-md mx-auto relative z-50">
                            <button
                                onClick={handleLocateMe}
                                className="h-[52px] w-[52px] md:h-[60px] md:w-[60px] flex items-center justify-center rounded-xl md:rounded-2xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-zinc-200 dark:border-white/10 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 shadow-sm cursor-pointer transition-colors shrink-0"
                                title="Locate Me (GPS)"
                            >
                                <Navigation className="h-5 w-5 md:h-6 md:w-6" />
                            </button>

                            <button
                                type="button"
                                onClick={() => setIsRegionMenuOpen(true)}
                                className="flex-1 flex items-center justify-between h-[52px] md:h-[60px] pl-4 md:pl-5 pr-2 py-3 md:py-4 rounded-xl md:rounded-2xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm cursor-pointer hover:bg-white dark:hover:bg-zinc-800 transition-colors"
                            >
                                <div className="flex items-center gap-3 truncate">
                                    <MapPin className="h-4 w-4 md:h-5 md:w-5 text-emerald-500 shrink-0" />
                                    <span className="truncate text-xs md:text-sm">
                                        {selectedRegion === "ALL" ? "National (All Regions)" : REGIONS.find(r => r.id === selectedRegion)?.label || selectedRegion}
                                    </span>
                                </div>
                                <div className="bg-zinc-100 dark:bg-white/10 p-1.5 rounded-lg shrink-0">
                                    <ChevronDown className="h-3 w-3 md:h-4 md:w-4 text-zinc-400" />
                                </div>
                            </button>
                        </div>
                    </div>

                    <div className="relative w-full h-[500px] md:h-[750px] rounded-3xl md:rounded-[3rem] overflow-hidden border-4 border-white dark:border-white/5 shadow-2xl bg-zinc-200 dark:bg-zinc-900 group mt-4 md:mt-8">

                        <ParkingMap
                            areas={areas}
                            focusedAreaId={focusedAreaId}
                            tileUrl={mapTileUrl}
                            onMarkerClick={handleMarkerClick}
                            userLocation={userLocation}
                            selectedRegion={selectedRegion}
                        />

                        {selectedRegion !== "ALL" && (
                            <div
                                className="absolute bottom-6 md:bottom-10 w-full z-[1000] h-[200px] md:h-[220px] flex items-center justify-center overflow-hidden animate-in slide-in-from-bottom-10 fade-in duration-500"
                                onTouchStart={onTouchStart}
                                onTouchMove={onTouchMove}
                                onTouchEnd={onTouchEnd}
                            >
                                <button onClick={handlePrev} className="hidden md:flex absolute left-4 md:left-10 z-50 h-14 w-14 bg-white dark:bg-[#1f1f22] border border-zinc-200 dark:border-white/10 rounded-full shadow-xl items-center justify-center text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:scale-105 active:scale-95 transition-all outline-none cursor-pointer">
                                    <ChevronLeft className="h-6 w-6" />
                                </button>

                                <div className="relative w-full max-w-[340px] h-full flex items-center justify-center">
                                    {areas.length === 0 && (
                                        <div className="bg-white/90 dark:bg-zinc-900/90 p-4 md:p-5 rounded-2xl shadow-xl backdrop-blur-xl border border-zinc-200 dark:border-white/10 font-bold text-xs md:text-sm text-center text-zinc-700 dark:text-zinc-300 flex flex-col items-center gap-2 md:gap-3 mx-4">
                                            <AlertTriangle className="h-6 w-6 md:h-8 md:w-8 text-amber-500" />
                                            No parking areas currently registered in this region.
                                        </div>
                                    )}
                                    {areas.map((area, index) => {
                                        const offset = getOffset(index);
                                        const absOffset = Math.abs(offset);
                                        const isFocused = offset === 0;
                                        return (
                                            <div
                                                key={area.id}
                                                onClick={() => handleMarkerClick(area.id, area.region)}
                                                className={`absolute w-[90vw] md:w-[85vw] max-w-[320px] md:max-w-[340px] rounded-2xl md:rounded-3xl p-4 md:p-5 flex gap-4 cursor-pointer transition-all duration-200 ease-out ${isFocused
                                                    ? "bg-white dark:bg-[#1f1f22] border border-emerald-500 shadow-[0_10px_40px_rgba(16,185,129,0.3)] ring-1 ring-emerald-500"
                                                    : "bg-white dark:bg-[#1f1f22] border border-zinc-200 dark:border-white/10 shadow-xl"
                                                    }`}
                                                style={{
                                                    transform: `translate3d(calc(${offset * 100}% + ${offset * 20}px), 0, 0) scale(${isFocused ? 1 : 0.85})`,
                                                    zIndex: 50 - absOffset,
                                                    opacity: absOffset > 1 ? 0 : isFocused ? 1 : 0.7,
                                                    pointerEvents: absOffset > 1 ? "none" : "auto",
                                                    willChange: "transform",
                                                }}
                                            >
                                                <div className="mt-1 flex-shrink-0">
                                                    <Building2 className={`h-6 w-6 md:h-7 md:w-7 ${isFocused ? "text-emerald-500" : "text-zinc-400 dark:text-zinc-500"}`} />
                                                </div>
                                                <div className="flex-1 flex flex-col min-w-0">
                                                    <h3 className={`font-bold text-base md:text-lg leading-tight mb-2 truncate ${isFocused ? "text-zinc-900 dark:text-white" : "text-zinc-700 dark:text-zinc-300"}`}>
                                                        {area.name}
                                                    </h3>
                                                    <div className="flex items-center gap-3 md:gap-4 mb-2 flex-wrap">
                                                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-xs md:text-sm">{area.price.toFixed(1)} ETB / Hr</span>
                                                        <span className="flex items-center gap-1 text-zinc-500 dark:text-zinc-400 text-xs md:text-sm">
                                                            <span className="text-emerald-500 font-bold">P</span> {area.availableSpaces} Spots
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 mb-3 md:mb-4 text-zinc-500 dark:text-zinc-400 text-[10px] md:text-xs font-medium">
                                                        <Compass className="h-3 w-3 md:h-4 md:w-4 text-emerald-500 shrink-0" />
                                                        <span className="truncate">{area.distance?.toFixed(2)} Km from you</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 md:gap-3 mt-auto">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setPendingMapRoute({ lat: area.lat, lon: area.lon, name: area.name }); }}
                                                            className="h-10 w-12 flex items-center justify-center rounded-xl border border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-white hover:bg-zinc-100 dark:hover:bg-white/10 active:scale-90 transition-all outline-none cursor-pointer shrink-0"
                                                        >
                                                            <Navigation className="h-4 w-4 md:h-5 w-5 text-emerald-500" />
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setFocusedAreaId(area.id); setShowAuthModal(true); }}
                                                            className="flex-1 h-10 rounded-xl bg-emerald-500 text-zinc-950 font-bold text-xs md:text-sm hover:bg-emerald-400 active:scale-95 transition-all outline-none cursor-pointer shadow-sm"
                                                        >
                                                            Reserve Spot
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                <button onClick={handleNext} className="hidden md:flex absolute right-4 md:right-10 z-50 h-14 w-14 bg-white dark:bg-[#1f1f22] border border-zinc-200 dark:border-white/10 rounded-full shadow-xl items-center justify-center text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:scale-105 active:scale-95 transition-all outline-none cursor-pointer">
                                    <ChevronRight className="h-6 w-6" />
                                </button>
                            </div>
                        )}
                    </div>
                </section>

                {/* ── FOOTER ── */}
                <footer className="py-6 md:py-8 text-center border-t border-zinc-200 dark:border-white/5 relative z-10 bg-white/50 dark:bg-black/20 backdrop-blur-md mt-auto">
                    <p className="text-zinc-500 dark:text-zinc-400 font-medium text-xs md:text-sm">
                        © 2026 VisionPark Systems.
                    </p>
                </footer>

            </main>

            {/* ── HTML5 NATIVE DIALOG MODALS ── */}

            {/* 1. Region Selection Dialog */}
            <dialog
                ref={regionModalRef}
                onClose={() => setIsRegionMenuOpen(false)}
                onClick={(e) => { if (e.target === regionModalRef.current) setIsRegionMenuOpen(false); }}
                className="p-0 m-auto bg-transparent border-none w-[92vw] md:w-full max-w-sm overflow-visible backdrop:bg-zinc-900/60 dark:backdrop:bg-black/80 backdrop:backdrop-blur-md transition-all"
            >
                <div className="w-full bg-white dark:bg-[#121214] rounded-2xl md:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-zinc-200 dark:border-white/10 max-h-[75vh] md:max-h-[80vh] animate-in zoom-in-95 duration-300">
                    <div className="flex items-center justify-between p-4 md:p-5 border-b border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-[#18181b] shrink-0">
                        <h3 className="font-bold text-zinc-900 dark:text-white flex items-center gap-2 text-sm md:text-base">
                            <MapPin className="h-4 w-4 md:h-5 md:w-5 text-emerald-500" />
                            Select Region
                        </h3>
                        <button onClick={() => setIsRegionMenuOpen(false)} className="p-1.5 hover:bg-zinc-200 dark:hover:bg-white/10 rounded-lg transition-colors outline-none cursor-pointer">
                            <X className="h-4 w-4 md:h-5 md:w-5 text-zinc-500 dark:text-zinc-400" />
                        </button>
                    </div>
                    <div className="overflow-y-auto guest-scroll p-3 space-y-1.5 bg-white dark:bg-[#121214]">
                        <button onClick={() => handleRegionChange("ALL")} className={`w-full px-4 py-3 md:py-3.5 text-left text-xs md:text-sm font-bold rounded-xl transition-colors outline-none cursor-pointer ${selectedRegion === "ALL" ? "text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/20" : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}>
                            National (All Regions)
                        </button>

                        <div className="pt-3 md:pt-4 pb-1.5 md:pb-2 px-3 text-[9px] md:text-[10px] font-black text-zinc-500 tracking-widest uppercase">Federal Cities</div>
                        {REGIONS.filter(r => r.group === "FEDERAL").map(r => (
                            <button key={r.id} onClick={() => handleRegionChange(r.id)} className={`w-full px-4 py-3 md:py-3.5 text-left text-xs md:text-sm font-bold rounded-xl transition-colors outline-none cursor-pointer ${selectedRegion === r.id ? "text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/20" : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}>
                                {r.label}
                            </button>
                        ))}

                        <div className="pt-3 md:pt-4 pb-1.5 md:pb-2 px-3 text-[9px] md:text-[10px] font-black text-zinc-500 tracking-widest uppercase">Major Regions</div>
                        {REGIONS.filter(r => r.group === "MAJOR").map(r => (
                            <button key={r.id} onClick={() => handleRegionChange(r.id)} className={`w-full px-4 py-3 md:py-3.5 text-left text-xs md:text-sm font-bold rounded-xl transition-colors outline-none cursor-pointer ${selectedRegion === r.id ? "text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/20" : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}>
                                {r.label}
                            </button>
                        ))}
                    </div>
                </div>
            </dialog>

            {/* 2. Authentication Required Dialog */}
            <dialog
                ref={authModalRef}
                onClose={() => setShowAuthModal(false)}
                onClick={(e) => { if (e.target === authModalRef.current) setShowAuthModal(false); }}
                className="p-0 m-auto bg-transparent border-none w-[92vw] md:w-full max-w-md overflow-visible backdrop:bg-zinc-900/60 dark:backdrop:bg-black/80 backdrop:backdrop-blur-md transition-all"
            >
                <div className="w-full bg-white dark:bg-[#121214] rounded-2xl md:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-zinc-200 dark:border-white/10 animate-in zoom-in-95 duration-300">
                    <div className="p-5 md:p-8 flex flex-col items-center text-center relative bg-white dark:bg-[#121214]">
                        <button onClick={() => setShowAuthModal(false)} className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 rounded-full transition-colors outline-none cursor-pointer">
                            <X className="h-4 w-4 md:h-5 md:w-5" />
                        </button>

                        <div className="h-14 w-14 md:h-16 md:w-16 bg-emerald-50 dark:bg-emerald-500/10 rounded-full flex items-center justify-center mb-4 md:mb-5 shadow-inner">
                            <Car className="h-6 w-6 md:h-8 md:w-8 text-emerald-500" strokeWidth={2} />
                        </div>

                        <h2 className="text-xl md:text-2xl font-black text-zinc-900 dark:text-white tracking-tight mb-2">Ready to Park?</h2>
                        <p className="text-xs md:text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-6 md:mb-8 leading-relaxed px-2">
                            Create a free VisionPark account to instantly secure spots, get digital receipts, and track your parking time live.
                        </p>

                        <div className="flex flex-col gap-3 w-full">
                            <button onClick={() => navigate("/signup")} className="w-full py-3.5 md:py-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-black shadow-lg shadow-emerald-500/20 active:scale-95 transition-all outline-none flex items-center justify-center gap-2 cursor-pointer text-sm md:text-base">
                                <UserPlus className="h-4 w-4 md:h-5 md:w-5 shrink-0" /> Sign Up & Reserve
                            </button>
                            <button onClick={() => navigate("/login")} className="w-full py-3.5 md:py-4 rounded-xl bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-900 dark:text-white font-bold active:scale-95 transition-all outline-none flex items-center justify-center gap-2 cursor-pointer border border-zinc-200 dark:border-white/5 text-sm md:text-base">
                                <LogIn className="h-4 w-4 md:h-5 md:w-5 shrink-0" /> I already have an account
                            </button>
                        </div>
                    </div>
                </div>
            </dialog>

            {/* 3. Open Google Maps Dialog */}
            <dialog
                ref={mapRouteModalRef}
                onClose={() => setPendingMapRoute(null)}
                onClick={(e) => { if (e.target === mapRouteModalRef.current) setPendingMapRoute(null); }}
                className="p-0 m-auto bg-transparent border-none w-[92vw] md:w-full max-w-sm overflow-visible backdrop:bg-zinc-900/60 dark:backdrop:bg-black/80 backdrop:backdrop-blur-md transition-all"
            >
                <div className="w-full bg-white dark:bg-[#18181b] rounded-2xl md:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-zinc-200 dark:border-white/10 animate-in zoom-in-95 duration-300">
                    <div className="p-5 md:p-6 text-center bg-white dark:bg-[#18181b]">
                        <div className="mx-auto w-14 w-14 md:h-16 md:w-16 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mb-4 shadow-inner">
                            <Navigation className="h-6 w-6 md:h-8 md:w-8" />
                        </div>
                        <h3 className="font-bold text-lg md:text-xl text-zinc-900 dark:text-white mb-2">Leaving VisionPark</h3>
                        <p className="text-xs md:text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-6 px-2">
                            You are about to leave the VisionPark app to open Google Maps for directions to <strong className="text-zinc-900 dark:text-zinc-300">{pendingMapRoute?.name}</strong>. Do you want to continue?
                        </p>
                        <div className="flex gap-2 md:gap-3">
                            <button onClick={() => setPendingMapRoute(null)} className="flex-1 py-3 md:py-3.5 rounded-xl font-bold text-xs md:text-sm bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-white/5 dark:hover:bg-white/10 dark:text-zinc-300 transition-colors outline-none cursor-pointer">
                                Cancel
                            </button>
                            <button onClick={confirmOpenGoogleMaps} className="flex-1 py-3 md:py-3.5 rounded-xl font-bold text-xs md:text-sm bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 transition-all outline-none cursor-pointer flex items-center justify-center gap-2">
                                Open Maps <ExternalLink className="h-4 w-4 shrink-0" />
                            </button>
                        </div>
                    </div>
                </div>
            </dialog>

        </div>
    );
}
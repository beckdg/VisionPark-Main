import React, { useState, useEffect, useMemo, useCallback, memo, useRef } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import {
  MapPin, Car, CheckCircle, AlertTriangle, ChevronDown,
  X, Check, Building2, Navigation, ChevronLeft, ChevronRight, ExternalLink
} from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import { Header } from "../../components/layout/Header";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../../api/apiClient";
import { useAuth } from "../../context/AuthContext";

const DEFAULT_LOC = [9.0249, 38.7468]; // Addis Ababa Center
const PAYMENT_OPTIONS = ["Telebirr", "CBE", "COOP", "Bank of Abyssinia"];
const buildIdempotencyKey = (prefix) =>
  `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
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

// True Haversine formula converting degrees to radians for accurate distance
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

// ─── ICONS ────────────────────────────────────────────────────────
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

// ─── MAP CAMERA ────────────────────────────────────────────────────────
function MapCamera({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center && center.length === 2 && !isNaN(center[0]) && !isNaN(center[1])) {
      map.flyTo(center, zoom, { animate: true, duration: 1.5 });
    }
  }, [center[0], center[1], zoom, map]);
  return null;
}

// ─── THE MAP ────────────────────────────────────────────────────────
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
          eventHandlers={{ click: () => onMarkerClick(area.id, area.region) }}
        />
      ))}
      <MapCamera center={mapCenter} zoom={mapZoom} />
    </MapContainer>
  );
});

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function DriverMap() {
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [userLocation, setUserLocation] = useState(DEFAULT_LOC);
  const [selectedRegion, setSelectedRegion] = useState("ALL");
  const [allAreas, setAllAreas] = useState([]);
  const [areas, setAreas] = useState([]);
  const [focusedAreaId, setFocusedAreaId] = useState(null);

  const [selectedArea, setSelectedArea] = useState(null);
  const [selectedSpot, setSelectedSpot] = useState(null);
  const [uiState, setUiState] = useState("Discovery");

  const [isRegionMenuOpen, setIsRegionMenuOpen] = useState(false);
  const [pendingMapRoute, setPendingMapRoute] = useState(null);

  const driverVehicle = user?.driver?.vehicleType || user?.driverProfile?.vehicleType || "Public Transport Vehicles | Upto 12 Seats";
  const [paymentMethod, setPaymentMethod] = useState("Telebirr");
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentTimestamp, setPaymentTimestamp] = useState(null);

  const [touchStartX, setTouchStartX] = useState(null);
  const [touchEndX, setTouchEndX] = useState(null);

  const [toast, setToast] = useState({ message: "", type: "success" });

  const regionModalRef = useRef(null);
  const mapRouteModalRef = useRef(null);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast({ message: "", type: "success" }), 4000);
  };

  const mapTileUrl = useMemo(() =>
    theme === "dark"
      ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    [theme]);

  useEffect(() => {
    if (isRegionMenuOpen) regionModalRef.current?.showModal();
    else regionModalRef.current?.close();
  }, [isRegionMenuOpen]);

  useEffect(() => {
    if (pendingMapRoute) mapRouteModalRef.current?.showModal();
    else mapRouteModalRef.current?.close();
  }, [pendingMapRoute]);

  // GPS Auto-Detection - Forces fresh location fetch
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
          console.warn("Geolocation failed. Defaulting to Addis Ababa.");
          setUserLocation(DEFAULT_LOC);
          setSelectedRegion("Addis Ababa");
        },
        // maximumAge: 0 forces the browser to not use cache and get a fresh GPS lock
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    }
  }, []);

  // Load parking lots + spots from backend (source of truth)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const lots = await apiClient.get("/parking/lots");
        const mappedLots = Array.isArray(lots)
          ? lots.map((lot) => ({
              id: String(lot._id),
              _id: String(lot._id),
              region: normalizeRegionId(lot.region),
              name: lot.name || "Unnamed Parking",
              lat: lot?.location?.coordinates?.[1] ?? DEFAULT_LOC[0],
              lon: lot?.location?.coordinates?.[0] ?? DEFAULT_LOC[1],
              price: 35.0,
              availableSpaces: 0,
              spots: [],
            }))
          : [];

        // Preferred API from prompt
        let allSpots = [];
        try {
          const spots = await apiClient.get("/parking/spots");
          allSpots = Array.isArray(spots) ? spots : [];
        } catch {
          // Fallback: backend may require zoneId, so hydrate through zones.
          const zonedSpots = [];
          for (const lot of mappedLots) {
            try {
              const zones = await apiClient.get(`/parking/zones?lotId=${lot._id}`);
              if (!Array.isArray(zones)) continue;
              for (const zone of zones) {
                try {
                  const zoneSpots = await apiClient.get(`/parking/spots?zoneId=${zone._id}`);
                  if (Array.isArray(zoneSpots)) zonedSpots.push(...zoneSpots);
                } catch {
                  // skip zone on error
                }
              }
            } catch {
              // skip lot on error
            }
          }
          allSpots = zonedSpots;
        }

        const spotsByLot = allSpots.reduce((acc, spot) => {
          const lotId = String(spot?.lotId || "");
          if (!acc[lotId]) acc[lotId] = [];
          acc[lotId].push({
            id: String(spot?.spotCode || spot?._id || ""),
            _id: String(spot?._id || ""),
            lotId: String(spot?.lotId || ""),
            zoneId: String(spot?.zoneId || ""),
            status: String(spot?.status || "free").toLowerCase(),
            floor: "Ground",
            deposit: 100,
            allowedCategories:
              Array.isArray(spot?.allowedCategories) && spot.allowedCategories.length > 0
                ? spot.allowedCategories
                : ["Public Transport Vehicles | Upto 12 Seats"],
            vehicleType:
              Array.isArray(spot?.allowedCategories) && spot.allowedCategories.length > 0
                ? spot.allowedCategories[0]
                : "Public Transport Vehicles | Upto 12 Seats",
          });
          return acc;
        }, {});

        const hydrated = mappedLots.map((lot) => {
          const lotSpots = spotsByLot[lot._id] || [];
          return {
            ...lot,
            spots: lotSpots,
            availableSpaces: lotSpots.filter((s) => s.status === "free").length,
          };
        });

        if (!cancelled) setAllAreas(hydrated);
      } catch (error) {
        if (!cancelled) {
          setAllAreas([]);
          setAreas([]);
          setFocusedAreaId(null);
          showToast(error?.message || "Failed to load parking data.", "error");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Filter & Haversine Sorting logic
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
      setSelectedArea(null);
      setSelectedSpot(null);
    }
  }, [userLocation, selectedRegion, allAreas]);

  const handleRegionChange = (val) => {
    setSelectedRegion(val);
    setIsRegionMenuOpen(false);
  };

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
          showToast("Location access denied or timed out. Please check your browser settings.", "error");
        },
        // maximumAge: 0 forces fresh location
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
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
    setSelectedArea(null);
    setSelectedSpot(null);
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
      setSelectedArea(null);
      setSelectedSpot(null);
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
      setSelectedArea(null);
      setSelectedSpot(null);
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

  const handleProcessPayment = async () => {
    if (!user?._id || !selectedSpot?._id) {
      showToast("Missing driver or selected spot.", "error");
      return;
    }
    try {
      const timestamp = new Date().toLocaleString();
      const session = await apiClient.post("/sessions/reservations", {
        driverId: user._id,
        lotId: selectedSpot.lotId,
        zoneId: selectedSpot.zoneId,
        spotId: selectedSpot._id,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        idempotencyKey: buildIdempotencyKey("reservation"),
      });
      await apiClient.post("/operations/transactions", {
        sessionId: session?._id,
        amount: 100,
        method: paymentMethod,
        paymentMethod,
        status: "completed",
        type: "reservation_fee",
        idempotencyKey: buildIdempotencyKey("reservation_fee"),
      });
      setPaymentTimestamp(timestamp);
      setUiState("PaymentSuccess");

      setTimeout(
        () =>
          navigate("/driver/session", {
            state: {
              session,
              areaData: selectedArea,
              spotData: selectedSpot,
              paymentMethod,
              paymentTimestamp: timestamp,
            },
          }),
        1200
      );
    } catch (error) {
      const msg = error?.message || "Reservation failed.";
      showToast(msg, "error");
    }
  };

  const confirmOpenGoogleMaps = () => {
    if (pendingMapRoute) {
      window.open(`https://www.google.com/maps/dir/?api=1&origin=${userLocation[0]},${userLocation[1]}&destination=${pendingMapRoute.lat},${pendingMapRoute.lon}&travelmode=driving`, "_blank", "noopener,noreferrer");
      setPendingMapRoute(null);
    }
  };

  const getStatusColor = (status) => {
    if (status === "free") return "text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10";
    if (status === "reserved") return "text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10";
    if (status === "occupied") return "text-red-600 dark:text-red-400 border-red-500/30 bg-red-500/10";
    if (status === "blocked") return "text-zinc-600 dark:text-zinc-300 border-zinc-500/30 bg-zinc-500/10";
    return "";
  };

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-zinc-100 dark:bg-[#09090b]">

      {/* ── CUSTOM STYLES FOR SCROLLBAR & LEAFLET ATTRIBUTION ─────────── */}
      <style>{`
          .custom-scrollbar::-webkit-scrollbar { width: 6px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background-color: rgba(161, 161, 170, 0.4); border-radius: 10px; }
          .dark .custom-scrollbar::-webkit-scrollbar-thumb { background-color: rgba(82, 82, 91, 0.4); }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: rgba(161, 161, 170, 0.8); }
          .dark .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: rgba(82, 82, 91, 0.8); }

          .leaflet-bottom.leaflet-right {
              bottom: 24px !important;
              right: 24px !important;
          }
          .leaflet-control-attribution {
              border-radius: 6px !important;
              padding: 3px 8px !important;
              background-color: rgba(255,255,255,0.9) !important;
              backdrop-filter: blur(4px);
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              font-weight: 500;
              font-size: 10px !important;
          }
          .dark .leaflet-control-attribution {
              background-color: rgba(24,24,27,0.9) !important;
              color: #a1a1aa !important;
          }
          .dark .leaflet-control-attribution a {
              color: #34d399 !important;
          }

          @media (max-width: 768px) {
              .leaflet-bottom.leaflet-right {
                  bottom: 16px !important;
                  right: 16px !important;
              }
              .leaflet-control-attribution {
                  font-size: 8px !important;
                  padding: 2px 6px !important;
                  max-width: 140px;
                  white-space: normal;
                  text-align: right;
              }
          }
      `}</style>

      <Header />

      {/* ── TOAST NOTIFICATIONS ── */}
      {toast.message && (
        <div className={`fixed top-20 md:top-24 left-1/2 -translate-x-1/2 w-[92vw] max-w-[340px] md:max-w-max font-bold text-xs md:text-sm px-4 md:px-6 py-3 md:py-3.5 rounded-xl md:rounded-2xl shadow-2xl z-[8000] animate-in slide-in-from-top-4 flex items-center gap-3 text-left md:text-center ${toast.type === "error" ? "bg-red-600 text-white" : "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900"}`}>
          {toast.type === "error" ? <AlertTriangle className="h-5 w-5 shrink-0" /> : <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />}
          <span className="leading-snug">{toast.message}</span>
        </div>
      )}

      {/* ── FLOATING REGION CONTROL OVERLAY ── */}
      <div className="absolute top-20 md:top-24 left-0 w-full z-[1000] px-4 md:px-8 pointer-events-none flex justify-center">
        <div className="flex items-center gap-3 w-full max-w-[380px] pointer-events-auto">
          <button
            onClick={handleLocateMe}
            className="h-[48px] w-[48px] md:h-[54px] md:w-[54px] rounded-xl md:rounded-2xl bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl shadow-lg flex items-center justify-center text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 border border-zinc-200 dark:border-white/10 shrink-0 transition-colors"
            title="Locate Me (GPS)"
          >
            <Navigation className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={() => setIsRegionMenuOpen(true)}
            className="flex-1 h-[48px] md:h-[54px] rounded-xl md:rounded-2xl bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl shadow-lg flex items-center justify-between px-4 md:px-5 border border-zinc-200 dark:border-white/10 hover:bg-white dark:hover:bg-zinc-800 transition-colors"
          >
            <div className="flex items-center gap-2.5 truncate">
              <MapPin className="h-4 w-4 md:h-5 md:w-5 text-emerald-500 shrink-0" />
              <span className="font-bold text-xs md:text-sm text-zinc-900 dark:text-white truncate">
                {selectedRegion === "ALL" ? "National (All Regions)" : REGIONS.find(r => r.id === selectedRegion)?.label || selectedRegion}
              </span>
            </div>
            <div className="bg-zinc-100 dark:bg-white/10 p-1 rounded-md shrink-0">
              <ChevronDown className="h-3 w-3 md:h-4 md:w-4 text-zinc-400" />
            </div>
          </button>
        </div>
      </div>

      <div className="absolute inset-0 z-0">
        <ParkingMap
          areas={areas}
          focusedAreaId={focusedAreaId}
          tileUrl={mapTileUrl}
          onMarkerClick={handleMarkerClick}
          userLocation={userLocation}
          selectedRegion={selectedRegion}
        />
      </div>

      {/* ── CAROUSEL ──────────────────────────────────────────────────────── */}
      {!selectedArea && selectedRegion !== "ALL" && (
        <div
          className="absolute bottom-24 md:bottom-28 w-full z-[1000] h-[220px] md:h-[280px] flex items-center justify-center overflow-hidden animate-in slide-in-from-bottom-10 fade-in duration-500"
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
                  className={`absolute w-[85vw] max-w-[340px] rounded-3xl p-5 md:p-6 flex gap-4 md:gap-5 cursor-pointer transition-all duration-200 ease-out ${isFocused
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
                    <h3 className={`font-bold text-lg md:text-xl leading-tight mb-2 truncate ${isFocused ? "text-zinc-900 dark:text-white" : "text-zinc-700 dark:text-zinc-300"}`}>
                      {area.name}
                    </h3>
                    <div className="flex items-center gap-4 mb-2">
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-sm">{area.price.toFixed(1)} ETB / Hr</span>
                      <span className="flex items-center gap-1 text-zinc-500 dark:text-zinc-400 text-sm">
                        <span className="text-red-500 font-bold">P</span> {area.availableSpaces} Spaces
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mb-4 text-zinc-500 dark:text-zinc-400 text-xs md:text-sm font-medium">
                      <Navigation className="h-3 w-3 md:h-4 md:w-4 text-emerald-500 shrink-0" fill="currentColor" />
                      <span className="truncate">{area.distance?.toFixed(2)} Km away</span>
                    </div>
                    <div className="flex items-center gap-3 mt-auto">
                      <button
                        onClick={(e) => { e.stopPropagation(); setPendingMapRoute({ lat: area.lat, lon: area.lon, name: area.name }); }}
                        className="h-10 w-12 flex items-center justify-center rounded-xl border border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-white hover:bg-zinc-100 dark:hover:bg-white/10 active:scale-90 transition-all outline-none cursor-pointer shrink-0"
                      >
                        <Navigation className="h-5 w-5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setFocusedAreaId(area.id); setSelectedArea(area); setSelectedSpot(null); setUiState("Discovery"); }}
                        className="flex-1 h-10 rounded-xl bg-zinc-900 dark:bg-[#27272a] text-white font-bold text-sm hover:bg-zinc-800 dark:hover:bg-white/10 active:scale-95 transition-all outline-none cursor-pointer shadow-sm"
                      >
                        Check In
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

      {/* ── FLOATING MODALS ───────────────────────────────────────────────── */}

      {/* 0. NATIVE REGION DIALOG */}
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
          <div className="overflow-y-auto custom-scrollbar p-3 space-y-1.5 bg-white dark:bg-[#121214]">
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

      {/* 1. DISCOVERY PANEL */}
      {selectedArea && !selectedSpot && uiState === "Discovery" && (
        <div className="fixed inset-0 z-[6000] flex items-center justify-center bg-zinc-900/60 dark:bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setSelectedArea(null)}>
          <div className="relative w-full max-w-sm md:max-w-md bg-white dark:bg-[#121214] border border-zinc-200 dark:border-white/10 rounded-3xl shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 md:p-6 border-b border-zinc-200 dark:border-white/10 shrink-0">
              <h2 className="text-xl md:text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <MapPin className="h-6 w-6 text-emerald-500" /> {selectedArea.name}
              </h2>
              <button onClick={() => setSelectedArea(null)} className="p-2 -mr-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors rounded-full hover:bg-zinc-100 dark:hover:bg-white/5 outline-none cursor-pointer active:scale-90">
                <X className="h-5 w-5 md:h-6 md:w-6" />
              </button>
            </div>

            <div className="p-5 md:p-6 overflow-y-auto overscroll-contain flex-1 flex flex-col gap-3 custom-scrollbar">
              {selectedArea.spots.map((spot) => {
                const allowed = Array.isArray(spot.allowedCategories) && spot.allowedCategories.length > 0
                  ? spot.allowedCategories
                  : [spot.vehicleType];
                const isCompatible = allowed.includes(driverVehicle);
                const canSelect = isCompatible && spot.status === "free";
                return (
                  <div
                    key={spot.id}
                    onClick={() => canSelect && setSelectedSpot(spot)}
                    className={`flex flex-col p-4 rounded-xl border transition-all shrink-0 ${canSelect
                      ? "border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 active:scale-[0.98] cursor-pointer"
                      : "border-zinc-200 dark:border-white/5 bg-zinc-200/50 dark:bg-black/40 opacity-70 cursor-not-allowed"
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-zinc-900 dark:text-white font-mono text-base">{spot.id}</span>
                      <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded border ${getStatusColor(spot.status)}`}>{spot.status}</span>
                    </div>
                    {!isCompatible && (
                      <p className="text-[10px] text-red-600 dark:text-red-400 font-bold uppercase tracking-wider mt-2 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> Not compatible
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 2. PAYMENT PANEL */}
      {selectedSpot && uiState === "Discovery" && (
        <div className="fixed inset-0 z-[6000] flex items-center justify-center bg-zinc-900/60 dark:bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setSelectedSpot(null)}>
          <div className="relative w-full max-w-sm md:max-w-md bg-white dark:bg-[#121214] border border-zinc-200 dark:border-white/10 rounded-3xl shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 md:p-6 border-b border-zinc-200 dark:border-white/10 shrink-0">
              <h3 className="text-zinc-900 dark:text-white font-bold text-xl flex items-center gap-2">
                <Car className="h-6 w-6 text-emerald-500" /> Spot {selectedSpot.id}
              </h3>
              <button onClick={() => { setSelectedArea(null); setSelectedSpot(null); }} className="p-2 -mr-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors rounded-full hover:bg-zinc-100 dark:hover:bg-white/5 outline-none cursor-pointer active:scale-90">
                <X className="h-5 w-5 md:h-6 md:w-6" />
              </button>
            </div>

            <div className="p-5 md:p-6 overflow-y-auto overscroll-contain flex-1 space-y-6 custom-scrollbar">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-zinc-100 dark:bg-black/40 rounded-xl p-4 border border-zinc-200 dark:border-white/5">
                  <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-1">Deposit</p>
                  <p className="text-zinc-900 dark:text-white font-bold text-lg">{selectedSpot.deposit} ETB</p>
                </div>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 border-b border-zinc-200 dark:border-white/10 pb-6">
                <span className="font-bold text-zinc-900 dark:text-zinc-300">Vehicle Types:</span>{" "}
                {(Array.isArray(selectedSpot.allowedCategories) && selectedSpot.allowedCategories.length > 0
                  ? selectedSpot.allowedCategories
                  : [selectedSpot.vehicleType]
                ).join(", ")}
              </p>
              <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-500 block">Billed To Merchant</span>
                  <span className="text-sm font-bold text-zinc-900 dark:text-white">VisionPark System</span>
                </div>
                <CheckCircle className="h-5 w-5 text-emerald-500" />
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Pay From (Your Account)</label>
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(true)}
                  className="w-full h-12 px-4 rounded-xl bg-zinc-50 dark:bg-black/60 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white outline-none hover:border-emerald-500 active:scale-[0.98] cursor-pointer flex items-center justify-between transition-all"
                >
                  <span className="font-medium text-sm">{paymentMethod}{paymentMethod === "Telebirr" && " (Default)"}</span>
                  <ChevronDown className="h-4 w-4 text-zinc-400 shrink-0" />
                </button>
              </div>
            </div>
            <div className="p-5 md:p-6 border-t border-zinc-200 dark:border-white/10 shrink-0 flex gap-3">
              <button type="button" onClick={() => setSelectedSpot(null)} className="flex-1 h-12 rounded-xl border border-zinc-300 dark:border-white/10 text-zinc-700 dark:text-white font-bold text-sm hover:bg-zinc-100 dark:hover:bg-white/5 active:scale-95 cursor-pointer outline-none transition-all">
                Back
              </button>
              <button type="button" onClick={handleProcessPayment} className="flex-[2] h-12 rounded-xl bg-emerald-500 text-zinc-950 font-bold text-sm uppercase tracking-wide shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:bg-emerald-400 active:scale-95 cursor-pointer outline-none transition-all">
                Pay {selectedSpot.deposit} ETB
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. PAYMENT SUCCESS */}
      {uiState === "PaymentSuccess" && (
        <div className="fixed inset-0 z-[6000] flex items-center justify-center bg-zinc-900/60 dark:bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm md:max-w-md bg-white dark:bg-[#121214] border border-emerald-500/50 rounded-3xl p-8 shadow-2xl flex flex-col items-center text-center animate-in zoom-in-95 duration-300">
            <CheckCircle className="h-16 w-16 text-emerald-500 mx-auto mb-4 drop-shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">Payment sent successfully</h2>
            <div className="w-full bg-zinc-50 dark:bg-black/40 rounded-xl p-4 text-left border border-zinc-200 dark:border-white/5 mt-6 space-y-1">
              <p className="text-sm text-zinc-600 dark:text-zinc-400 flex justify-between gap-2">
                <span className="shrink-0">Method:</span>
                <span className="text-zinc-900 dark:text-white font-bold text-right truncate">{paymentMethod} via Chapa</span>
              </p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 flex justify-between gap-2">
                <span className="shrink-0">Timestamp:</span>
                <span className="text-zinc-900 dark:text-white font-bold text-right truncate">{paymentTimestamp}</span>
              </p>
            </div>
            <p className="text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider mt-6 animate-pulse">
              Redirecting to Active Session...
            </p>
          </div>
        </div>
      )}

      {/* ── PAYMENT METHOD MODAL ──────────────────────────────────────────── */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-[7000] flex items-center justify-center bg-zinc-900/40 dark:bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setShowPaymentModal(false)}>
          <div className="w-full max-w-sm md:max-w-md bg-white dark:bg-[#121214] rounded-3xl shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 md:p-6 border-b border-zinc-200 dark:border-white/10 shrink-0">
              <h3 className="font-bold text-lg text-zinc-900 dark:text-white">Select Payment Method</h3>
              <button onClick={() => setShowPaymentModal(false)} className="p-2 -mr-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors rounded-full hover:bg-zinc-100 dark:hover:bg-white/5 outline-none cursor-pointer active:scale-90">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto p-3 overscroll-contain flex-1 custom-scrollbar">
              {PAYMENT_OPTIONS.map((method, index) => {
                const isSelected = paymentMethod === method;
                return (
                  <button
                    key={index}
                    onClick={() => { setPaymentMethod(method); setShowPaymentModal(false); }}
                    className={`w-full flex items-center justify-between p-4 rounded-xl text-left transition-all outline-none cursor-pointer active:scale-[0.98] ${isSelected ? "bg-emerald-50 dark:bg-emerald-500/10" : "hover:bg-zinc-50 dark:hover:bg-white/5"
                      }`}
                  >
                    <span className={`text-sm ${isSelected ? "font-bold text-emerald-600 dark:text-emerald-400" : "font-medium text-zinc-700 dark:text-zinc-300"}`}>
                      {method}{method === "Telebirr" && " (Default)"}
                    </span>
                    {isSelected && <Check className="h-5 w-5 text-emerald-500 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── EXTERNAL MAP NAVIGATION MODAL ─────────────────────────────────── */}
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
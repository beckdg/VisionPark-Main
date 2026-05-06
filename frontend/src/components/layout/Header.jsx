import React, { useState, useEffect, useRef } from "react";
import { Car, Moon, Sun, User, Clock, Bell, ChevronDown, LogOut } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import { resolveDriverProfilePhoto } from "../../utils/resolveDriverProfilePhoto";

export function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const auth = useAuth();

  // Route checkers
  const isDriverApp = location.pathname.includes("/driver") || location.pathname.includes("/profile") || location.pathname.includes("/session");
  const isSessionPage = location.pathname.includes("/session");

  // --- GLOBAL STATE SYNCS ---
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [sessionState, setSessionState] = useState(() => localStorage.getItem("vp_session_state") || "Discovery");
  const [secondsLeft, setSecondsLeft] = useState(0);

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Notification Checkers to prevent spam
  const notified5Min = useRef(false);
  const notified3Min = useRef(false);
  const notified1Min = useRef(false);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const sendPushNotification = (title, body) => {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, {
        body: body,
        icon: "https://cdn-icons-png.flaticon.com/512/3204/3204933.png"
      });
    }
  };

  // --- SYNC FROM AUTH (driver) + LOCAL PROFILE EDITS ---
  useEffect(() => {
    const user = auth.user;
    const authed = auth.isAuthenticated;
    queueMicrotask(() => {
      if (!authed || user?.role !== "driver") {
        setUserName("");
        setUserEmail("");
        setProfilePhoto(null);
        return;
      }

      const lsPhoto = localStorage.getItem("vp_driver_photo");
      setProfilePhoto(resolveDriverProfilePhoto(user, lsPhoto));

      setUserName(user.name || "");
      setUserEmail(user.email || "");
    });
  }, [auth.isAuthenticated, auth.user]);

  useEffect(() => {
    const handlePhotoUpdate = () => {
      const ls = localStorage.getItem("vp_driver_photo");
      const u = auth.user;
      if (u?.role === "driver") {
        setProfilePhoto(resolveDriverProfilePhoto(u, ls));
      } else {
        setProfilePhoto(null);
      }
    };
    const handleProfileUpdate = () => {
      setUserName(localStorage.getItem("vp_driver_name") || auth.user?.name || "");
      setUserEmail(localStorage.getItem("vp_driver_email") || auth.user?.email || "");
      handlePhotoUpdate();
    };
    window.addEventListener("vp_photo_updated", handlePhotoUpdate);
    window.addEventListener("vp_profile_updated", handleProfileUpdate);

    return () => {
      window.removeEventListener("vp_photo_updated", handlePhotoUpdate);
      window.removeEventListener("vp_profile_updated", handleProfileUpdate);
    };
  }, [auth.user]);

  // --- GLOBAL TIMER & NOTIFICATION ENGINE ---
  useEffect(() => {
    const syncSession = () => {
      setSessionState(localStorage.getItem("vp_session_state") || "Discovery");
      notified5Min.current = false;
      notified3Min.current = false;
      notified1Min.current = false;
    };

    window.addEventListener("vp_session_changed", syncSession);

    let timer;
    if (sessionState === "Reserved") {
      timer = setInterval(() => {
        const endTimeStr = localStorage.getItem("vp_session_end_time");
        if (endTimeStr) {
          const remaining = Math.floor((parseInt(endTimeStr, 10) - Date.now()) / 1000);

          if (remaining <= 300 && remaining > 295 && !notified5Min.current) {
            sendPushNotification("Time Check", "You have 5 minutes left to arrive at your parking spot.");
            notified5Min.current = true;
          }

          if (remaining <= 180 && remaining > 175 && !notified3Min.current) {
            sendPushNotification("Hurry Up!", "Your parking reservation expires in exactly 3 minutes.");
            notified3Min.current = true;
          }

          if (remaining <= 60 && remaining > 55 && !notified1Min.current) {
            sendPushNotification("Warning: Almost Expired", "Only 1 minute left to arrive at your parking spot!");
            notified1Min.current = true;
          }

          if (remaining <= 0) {
            clearInterval(timer);
            setSessionState("Expired");
            setSecondsLeft(0);
            localStorage.setItem("vp_session_state", "Expired");
            sendPushNotification("Reservation Expired", "Your parking reservation time has run out and the spot has been released.");
            window.dispatchEvent(new Event("vp_session_changed"));
          } else {
            setSecondsLeft(remaining);
          }
        }
      }, 1000);
    }
    return () => {
      clearInterval(timer);
      window.removeEventListener("vp_session_changed", syncSession);
    };
  }, [sessionState]);

  const formatTime = (totalSeconds) => {
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
    const s = (totalSeconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const getTimerStyles = (seconds) => {
    if (seconds > 600) {
      return {
        wrapper: "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 hover:bg-emerald-100 dark:hover:bg-emerald-500/20",
        icon: "text-emerald-600 dark:text-emerald-500",
        text: "text-emerald-700 dark:text-emerald-400"
      };
    } else if (seconds > 300) {
      return {
        wrapper: "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20 hover:bg-amber-100 dark:hover:bg-amber-500/20",
        icon: "text-amber-600 dark:text-amber-500",
        text: "text-amber-700 dark:text-amber-400"
      };
    } else {
      return {
        wrapper: "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20 hover:bg-red-100 dark:hover:bg-red-500/20",
        icon: "text-red-600 dark:text-red-500",
        text: "text-red-700 dark:text-red-400"
      };
    }
  };

  const handleLogout = () => {
    auth.logout();
    setDropdownOpen(false);
    navigate("/login", { replace: true });
  };

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-white/80 dark:bg-[#09090b]/80 backdrop-blur-md border-b border-zinc-200 dark:border-white/10 z-[5000] px-4 md:px-8 flex items-center justify-between transition-colors duration-500">

      <div className="flex items-center gap-2 cursor-pointer transition-transform active:scale-95" onClick={() => navigate("/driver/map")}>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20 shrink-0">
          <Car className="h-5 w-5 text-emerald-600 dark:text-emerald-500" />
        </div>
        <span className="font-bold text-zinc-900 dark:text-white tracking-wide text-base sm:text-lg">
          VisionPark
        </span>
      </div>

      <div className="flex items-center gap-3 md:gap-5">

        {/* DYNAMIC COLOR-CODED TIMER */}
        {sessionState === "Reserved" && isDriverApp && !isSessionPage && (
          <div
            onClick={() => navigate("/driver/session")}
            className={`flex items-center gap-1.5 sm:gap-2 border px-2 sm:px-3 py-1.5 rounded-full cursor-pointer transition-all shadow-sm active:scale-95 ${getTimerStyles(secondsLeft).wrapper}`}
          >
            <Clock className={`h-3.5 w-3.5 sm:h-4 sm:w-4 animate-pulse shrink-0 ${getTimerStyles(secondsLeft).icon}`} />
            <span className={`text-[11px] sm:text-sm font-bold font-mono tracking-wide ${getTimerStyles(secondsLeft).text}`}>
              {formatTime(secondsLeft)}
            </span>
          </div>
        )}

        {isDriverApp && (
          <button className="relative p-2 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors outline-none rounded-full hover:bg-zinc-100 dark:hover:bg-white/5 active:scale-95 shrink-0">
            <Bell className="h-5 w-5 md:h-6 md:w-6" />
            <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-red-500 border border-white dark:border-[#09090b]"></span>
          </button>
        )}

        {isDriverApp && (
          <div className="relative shrink-0" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2.5 p-1 sm:pr-2 rounded-full hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors outline-none active:scale-95"
            >
              <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-full border border-zinc-200 dark:border-white/10 overflow-hidden bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                {profilePhoto ? (
                  <img src={profilePhoto} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  <User className="h-4 w-4 sm:h-5 sm:w-5 text-zinc-400" />
                )}
              </div>
              <span className="font-bold text-sm text-zinc-900 dark:text-white hidden sm:block max-w-[120px] truncate">{userName || "Driver"}</span>
              <ChevronDown className="h-4 w-4 text-zinc-500 shrink-0 hidden sm:block" />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-[#121214] border border-zinc-200 dark:border-white/10 rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top-right">

                <div className="px-4 py-3 border-b border-zinc-100 dark:border-white/5 bg-zinc-50 dark:bg-white/5">
                  <p className="text-sm font-bold text-zinc-900 dark:text-white truncate">{userName || "Driver"}</p>
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 truncate">{userEmail || "Driver account"}</p>
                </div>

                <div className="p-2 space-y-1">
                  <button
                    onClick={() => { setDropdownOpen(false); navigate("/driver/profile"); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/5 rounded-xl transition-colors outline-none cursor-pointer"
                  >
                    <User className="h-4 w-4" /> View Profile
                  </button>

                  <button
                    onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/5 rounded-xl transition-colors outline-none cursor-pointer"
                  >
                    {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                    {theme === "dark" ? "Light Mode" : "Dark Mode"}
                  </button>

                  <div className="h-px w-full bg-zinc-100 dark:bg-white/5 my-1"></div>

                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-bold text-red-600 dark:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors outline-none cursor-pointer"
                  >
                    <LogOut className="h-4 w-4" /> Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </header>
  );
}
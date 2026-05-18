import React, { useState, useEffect } from "react";
import { Outlet, useLocation, useNavigate, NavLink } from "react-router-dom";
import {
  Grid, ScanFace, Banknote, Clock, ShieldAlert,
  FileText, Calculator, Menu, X, Bell,
  LogOut, PanelLeft, Car, Moon, Sun
} from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";

const NAVIGATION = [
  { name: "Live Grid & Map", path: "/attendant/dashboard", icon: Grid },
  { name: "AI Exceptions", path: "/attendant/exceptions", icon: ScanFace },
  { name: "Walk-Up POS", path: "/attendant/pos", icon: Banknote },
  { name: "Overstay Hunter", path: "/attendant/overstays", icon: Clock },
  { name: "Debt Radar", path: "/attendant/enforcement", icon: ShieldAlert },
  { name: "Incident Logger", path: "/attendant/incidents", icon: FileText },
  { name: "Shift Z-Report", path: "/attendant/z-report", icon: Calculator },
];

const DEFAULT_ATTENDANT = {
  name: "Attendant",
  role: "Parking Attendant",
  avatar: "https://i.pravatar.cc/150?u=attendant",
  unreadNotifications: 2
};

// --- SIDEBAR COMPONENT ---
const SidebarContent = ({ collapsed, currentPath, onNavigate, onHover, onLeave, onLogout, attendant }) => (
  <div className="flex flex-col h-full bg-white dark:bg-[#121214] w-full">

    {/* Brand Header */}
    <div className={`h-16 lg:h-20 flex items-center shrink-0 border-b border-zinc-200 dark:border-white/10 transition-all duration-300 ${collapsed ? 'justify-center px-0' : 'px-6 justify-start'}`}>
      <div className="flex items-center gap-2 overflow-hidden whitespace-nowrap">
        <div className="h-8 w-8 shrink-0 rounded-xl bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/30">
          <Car className="h-5 w-5" strokeWidth={2.5} />
        </div>
        <span className={`text-xl font-bold text-zinc-900 dark:text-white tracking-tight transition-all duration-300 overflow-hidden whitespace-nowrap ${collapsed ? 'opacity-0 max-w-0' : 'opacity-100 max-w-[200px]'}`}>
          VisionPark <span className="text-emerald-500">Staff</span>
        </span>
      </div>
    </div>

    {/* Navigation Links */}
    <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1.5 custom-scrollbar relative" onMouseLeave={onLeave}>
      {!collapsed && <p className="px-3 text-[10px] uppercase tracking-widest text-zinc-500 font-black mb-2">Shift Tools</p>}

      {NAVIGATION.map((item) => {
        const isActive = currentPath.includes(item.path);
        const Icon = item.icon;
        return (
          <button
            key={item.name}
            onClick={() => onNavigate(item.path)}
            onMouseEnter={(e) => onHover(e, item.name, collapsed)}
            onMouseLeave={onLeave}
            className={`flex items-center rounded-xl text-sm font-semibold transition-all outline-none cursor-pointer active:scale-[0.98] overflow-hidden whitespace-nowrap w-full
              ${collapsed ? 'justify-center p-3' : 'px-4 py-3.5 gap-3'}
              ${isActive
                ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-white/5 hover:text-zinc-900 dark:hover:text-white"
              }
            `}
          >
            <Icon className={`h-5 w-5 shrink-0 transition-colors ${isActive ? "text-emerald-500" : "text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white"}`} />
            <span className={`transition-all duration-300 overflow-hidden whitespace-nowrap ${collapsed ? 'opacity-0 max-w-0' : 'opacity-100 max-w-[200px]'}`}>
              {item.name}
            </span>
          </button>
        );
      })}
    </nav>

    {/* Footer: Profile & Logout Anchored to Bottom */}
    <div className={`p-4 shrink-0 border-t border-zinc-200 dark:border-white/10 flex flex-col gap-2 ${collapsed ? 'items-center' : ''}`}>
      <NavLink
        to="/attendant/profile"
        className={({ isActive }) => `flex items-center ${collapsed ? 'justify-center p-2' : 'gap-3 p-3'} rounded-xl transition-all outline-none ${isActive ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold" : "hover:bg-zinc-50 dark:hover:bg-white/5"}`}
      >
        <img src={attendant.avatar} alt="Profile" className="h-9 w-9 rounded-full border border-zinc-200 dark:border-white/10 shrink-0 object-cover" />
        {!collapsed && (
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-bold text-zinc-900 dark:text-white truncate">{attendant.name}</span>
            <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-wider truncate">{attendant.role}</span>
          </div>
        )}
      </NavLink>

      <button onClick={onLogout} className={`flex items-center justify-center gap-2 ${collapsed ? 'p-3' : 'p-3 w-full'} text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors font-bold outline-none cursor-pointer`}>
        <LogOut className="h-4 w-4 shrink-0" />
        {!collapsed && <span>Sign Out</span>}
      </button>
    </div>
  </div>
);

export default function AttendantLayout() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem("visionpark_attendant_sidebar_collapsed");
    return saved === "true";
  });

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [hoveredNav, setHoveredNav] = useState(null);

  // ✅ Dynamic Notification State
  const [unreadCount, setUnreadCount] = useState(DEFAULT_ATTENDANT.unreadNotifications);

  const location = useLocation();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const auth = useAuth();
  const user = auth?.user;
  const attendant = {
    name: user?.name || DEFAULT_ATTENDANT.name,
    role: user?.role ? `Parking ${String(user.role).charAt(0).toUpperCase()}${String(user.role).slice(1)}` : DEFAULT_ATTENDANT.role,
    avatar: user?.avatarUrl || DEFAULT_ATTENDANT.avatar,
  };

  useEffect(() => {
    localStorage.setItem("visionpark_attendant_sidebar_collapsed", isSidebarCollapsed);
  }, [isSidebarCollapsed]);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
    setHoveredNav(null);
  }, [location.pathname]);

  // ✅ Backend Hook Ready: Listen for real-time notifications here
  useEffect(() => {
    // Example socket listener:
    // socket.on('new_alert', (data) => setUnreadCount(prev => prev + 1));
  }, []);

  const handleNavigation = (path) => {
    setHoveredNav(null);
    navigate(path);
  };

  const handleLogout = () => {
    auth.logout();
    navigate("/login", { replace: true });
  };

  const handleNavHover = (e, name, isCollapsed) => {
    if (!isCollapsed) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setHoveredNav({ name, top: rect.top + rect.height / 2 });
  };

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const handleNotificationClick = () => {
    // Clear notifications on click (or open a popover panel)
    setUnreadCount(0);
  };

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-[#f4f4f5] dark:bg-[#09090b] transition-colors duration-500 selection:bg-emerald-500/20">

      {/* 1. DESKTOP / TABLET SIDEBAR */}
      <aside
        className={`hidden lg:flex flex-col relative h-full bg-white dark:bg-[#121214] border-zinc-200 dark:border-white/10 transition-[width] duration-300 ease-[cubic-bezier(0.25,0.8,0.25,1)] shrink-0 z-50 border-r shadow-[4px_0_24px_rgba(0,0,0,0.02)] overflow-hidden ${isSidebarCollapsed ? 'w-[80px]' : 'w-[280px]'
          }`}
      >
        <SidebarContent
          collapsed={isSidebarCollapsed}
          currentPath={location.pathname}
          onNavigate={handleNavigation}
          onHover={handleNavHover}
          onLeave={() => setHoveredNav(null)}
          onLogout={handleLogout}
          attendant={attendant}
        />
      </aside>

      {/* FLOATING COLLAPSED TOOLTIPS */}
      {hoveredNav && isSidebarCollapsed && (
        <div
          className="fixed z-[99999] pointer-events-none animate-in fade-in slide-in-from-left-2 duration-150"
          style={{ top: hoveredNav.top, left: "88px", transform: "translateY(-50%)" }}
        >
          <div className="flex items-center">
            <div className="w-0 h-0 border-y-[6px] border-y-transparent border-r-[6px] border-r-emerald-500/20 dark:border-r-emerald-500/20" />
            <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-sm font-semibold px-3 py-2 rounded-xl shadow-lg whitespace-nowrap border border-emerald-500/20 dark:border-emerald-500/20">
              {hoveredNav.name}
            </div>
          </div>
        </div>
      )}

      {/* 2. MOBILE HAMBURGER MENU OVERLAY */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[6000] lg:hidden flex">
          <div
            className="absolute inset-0 bg-zinc-900/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <aside className="relative w-[280px] max-w-[80vw] h-full bg-white dark:bg-[#121214] shadow-2xl flex flex-col animate-in slide-in-from-left duration-300">
            <SidebarContent
              collapsed={false}
              currentPath={location.pathname}
              onNavigate={handleNavigation}
              onHover={() => { }}
              onLeave={() => { }}
              onLogout={handleLogout}
              attendant={attendant}
            />
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-full hover:bg-zinc-100 dark:hover:bg-white/5 outline-none transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </aside>
        </div>
      )}

      {/* 3. MAIN WORKSPACE */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">

        <header className="h-16 lg:h-20 bg-white/95 dark:bg-[#121214]/95 backdrop-blur-md border-b border-zinc-200 dark:border-white/10 flex items-center justify-between px-4 lg:px-8 z-40 shrink-0 transition-colors duration-500">

          <div className="flex items-center gap-3 md:gap-4">
            {/* MOBILE HAMBURGER TOGGLE */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 text-zinc-500 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors outline-none active:scale-95"
            >
              <Menu className="h-6 w-6" />
            </button>

            {/* ✅ MOBILE BRAND LOGO (Visible only on small screens) */}
            <div className="flex lg:hidden items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-emerald-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/30">
                <Car className="h-4 w-4" strokeWidth={2.5} />
              </div>
              <span className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">
                VisionPark <span className="text-emerald-500">Staff</span>
              </span>
            </div>

            {/* Desktop Sidebar Toggle */}
            <div className="relative group hidden lg:flex">
              <button
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="p-2 -ml-2 text-zinc-500 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors outline-none active:scale-95"
              >
                <PanelLeft className={`h-5 w-5 transition-transform duration-300 ${isSidebarCollapsed ? 'rotate-180' : ''}`} />
              </button>

              <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 flex items-center opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 z-[99999]">
                <div className="w-0 h-0 border-y-[6px] border-y-transparent border-r-[6px] border-r-emerald-500/20" />
                <div className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-sm font-semibold px-3 py-2 rounded-xl shadow-lg whitespace-nowrap border border-emerald-500/20">
                  {isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4 relative">

            {/* IN-HEADER THEME TOGGLE */}
            <button
              onClick={toggleTheme}
              className="relative p-2.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5 rounded-full transition-colors outline-none cursor-pointer"
            >
              {theme === "dark" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </button>

            {/* ✅ DYNAMIC Notifications */}
            <button
              onClick={handleNotificationClick}
              className="relative p-2.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5 rounded-full transition-colors outline-none cursor-pointer"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-red-500 border-2 border-white dark:border-[#121214] animate-pulse" />
              )}
            </button>
          </div>
        </header>

        {/* PAGE CONTENT MOUNT POINT */}
        <main className="flex-1 overflow-y-auto overscroll-contain bg-[#f4f4f5] dark:bg-[#09090b] custom-scrollbar">
          <div className="p-4 md:p-8 lg:p-10 max-w-[1600px] mx-auto min-h-full transition-all duration-300 animate-in fade-in">
            <Outlet />
          </div>
        </main>

      </div>
    </div>
  );
}
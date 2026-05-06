import React, { useState, useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Map, Users, Activity, PieChart,
  BarChart3, Tags, Landmark, User, Menu,
  X, Bell, ChevronDown, LogOut, Moon, Sun, Car, PanelLeft
} from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";

const NAVIGATION = [
  {
    group: "Overview",
    items: [
      { name: "Dashboard", path: "/owner/dashboard", icon: LayoutDashboard },
    ]
  },
  {
    group: "Operations",
    items: [
      { name: "Parking Management", path: "/owner/parking", icon: Map },
      { name: "Attendants", path: "/owner/attendants", icon: Users },
      { name: "Operations", path: "/owner/operations", icon: Activity },
    ]
  },
  {
    group: "Insights",
    items: [
      { name: "Analytics", path: "/owner/analytics", icon: PieChart },
      { name: "Financial Reports", path: "/owner/finance", icon: BarChart3 },
    ]
  },
  {
    group: "Configuration",
    items: [
      { name: "Pricing Settings", path: "/owner/pricing", icon: Tags },
      { name: "Payment & Payout", path: "/owner/payout", icon: Landmark },
    ]
  },
  {
    group: "Account",
    items: [
      { name: "Profile", path: "/owner/profile", icon: User },
    ]
  },
];

const ALL_NAV = NAVIGATION.flatMap(g => g.items);

// ── Read owner profile overrides from localStorage (avatar/local edits) ──────
const readOwnerProfileOverrides = () => {
  const savedData = localStorage.getItem("vp_owner_data");
  let parsedData = null;
  if (savedData) {
    try {
      parsedData = JSON.parse(savedData);
    } catch (e) {
      console.error("Failed to parse owner data", e);
    }
  }
  return parsedData && typeof parsedData === "object" ? parsedData : {};
};

const buildOwnerViewModel = (authUser, overrides = {}) => {
  const roleLabel = authUser?.role
    ? `Parking ${String(authUser.role).charAt(0).toUpperCase()}${String(authUser.role).slice(1)}`
    : "Parking Owner";
  return {
    name: overrides?.name || authUser?.name || "Owner",
    avatar:
      overrides?.avatar ||
      authUser?.avatarUrl ||
      `https://i.pravatar.cc/150?u=${encodeURIComponent(
        String(authUser?._id ?? authUser?.id ?? authUser?.email ?? "owner")
      )}`,
    role: roleLabel,
    unreadNotifications: 3,
  };
};

const SidebarContent = ({ collapsed, currentPath, onNavigate, onHover, onLeave, owner }) => (
  <div className="flex flex-col h-full bg-white dark:bg-[#121214] w-full">
    <div className={`h-16 lg:h-20 flex items-center shrink-0 border-b border-zinc-200 dark:border-white/10 transition-all duration-300 ${collapsed ? 'justify-center px-0' : 'px-6 justify-start'}`}>
      <div className="flex items-center gap-2 overflow-hidden whitespace-nowrap">
        <div className="h-8 w-8 shrink-0 rounded-lg bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/30">
          <Car className="h-5 w-5" strokeWidth={2.5} />
        </div>
        <span className={`text-xl font-bold text-zinc-900 dark:text-white tracking-tight transition-all duration-300 overflow-hidden whitespace-nowrap ${collapsed ? 'opacity-0 max-w-0' : 'opacity-100 max-w-[200px]'}`}>
          VisionPark <span className="text-emerald-500">Owner</span>
        </span>
      </div>
    </div>
    <div className={`flex flex-col items-center border-b border-zinc-200 dark:border-white/10 shrink-0 transition-all duration-300 ${collapsed ? 'py-4' : 'py-6'}`}>
      <img src={owner.avatar} alt={owner.name}
        className={`rounded-full border-2 border-emerald-500 shadow-sm object-cover transition-all duration-300 ${collapsed ? 'h-10 w-10 border' : 'h-16 w-16'}`} />
      <div className={`flex flex-col items-center overflow-hidden whitespace-nowrap transition-all duration-300 ${collapsed ? 'opacity-0 max-h-0 mt-0' : 'opacity-100 max-h-[100px] mt-3'}`}>
        <h3 className="font-bold text-zinc-900 dark:text-white">{owner.name}</h3>
        <span className="text-xs text-zinc-500 font-medium uppercase tracking-wider">{owner.role}</span>
      </div>
    </div>
    <nav className="flex-1 overflow-y-auto py-4 px-3 custom-scrollbar" onMouseLeave={onLeave}>
      {NAVIGATION.map((group) => (
        <div key={group.group} className="mb-4">
          <div className={`transition-all duration-300 overflow-hidden ${collapsed ? 'opacity-0 max-h-0 mb-0' : 'opacity-100 max-h-10 mb-1.5'}`}>
            <p className="px-4 text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-600">
              {group.group}
            </p>
          </div>
          <div className="space-y-1">
            {group.items.map((item) => {
              const isActive = currentPath.includes(item.path);
              const Icon = item.icon;
              return (
                <button key={item.name} onClick={() => onNavigate(item.path)}
                  onMouseEnter={(e) => onHover(e, item.name, collapsed)}
                  onMouseLeave={onLeave}
                  className={`flex items-center rounded-xl text-sm font-semibold transition-all outline-none cursor-pointer active:scale-[0.98] overflow-hidden whitespace-nowrap w-full
                    ${collapsed ? 'justify-center p-3' : 'px-4 py-3 gap-3'}
                    ${isActive
                      ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20"
                      : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-white/5 hover:text-zinc-900 dark:hover:text-white border border-transparent"
                    }`}>
                  <Icon className={`h-4 w-4 shrink-0 transition-colors ${isActive ? "text-emerald-500" : "text-zinc-400"}`} />
                  <span className={`transition-all duration-300 overflow-hidden whitespace-nowrap ${collapsed ? 'opacity-0 max-w-0' : 'opacity-100 max-w-[200px]'}`}>
                    {item.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  </div>
);

export default function OwnerLayout() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem("visionpark_sidebar_collapsed");
    return saved === "true";
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [hoveredNav, setHoveredNav] = useState(null);

  const auth = useAuth();

  // ── Live owner profile state (auth + local overrides) ─────────────────────
  const [ownerOverrides, setOwnerOverrides] = useState(readOwnerProfileOverrides);
  const owner = buildOwnerViewModel(auth.user, ownerOverrides);
  const [unreadCount, setUnreadCount] = useState(owner.unreadNotifications);

  useEffect(() => {
    // Listen for custom events emitted by owner profile/admin forms.
    const refresh = () => setOwnerOverrides(readOwnerProfileOverrides());
    window.addEventListener("vp_owner_profile_updated", refresh);
    window.addEventListener("vp_owner_data_updated", refresh);

    return () => {
      window.removeEventListener("vp_owner_profile_updated", refresh);
      window.removeEventListener("vp_owner_data_updated", refresh);
    };
  }, []);

  const location = useLocation();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    localStorage.setItem("visionpark_sidebar_collapsed", isSidebarCollapsed);
  }, [isSidebarCollapsed]);

  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsProfileDropdownOpen(false);
    setHoveredNav(null);
  }, [location.pathname]);

  const handleNavigation = (path) => { setHoveredNav(null); navigate(path); };
  const handleLogout = () => {
    auth.logout();
    setIsProfileDropdownOpen(false);
    navigate("/login", { replace: true });
  };
  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");
  const handleNavHover = (e, name, isCollapsed) => {
    if (!isCollapsed) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setHoveredNav({ name, top: rect.top + rect.height / 2 });
  };

  const currentPage = ALL_NAV.find(n => location.pathname.includes(n.path))?.name ?? "Owner";

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-[#f4f4f5] dark:bg-[#09090b] transition-colors duration-500 selection:bg-emerald-500/20">

      <aside className={`hidden lg:flex flex-col relative h-full bg-white dark:bg-[#121214] border-r border-zinc-200 dark:border-white/10 transition-[width] duration-300 ease-[cubic-bezier(0.25,0.8,0.25,1)] shrink-0 z-50 shadow-[4px_0_24px_rgba(0,0,0,0.02)] overflow-hidden
        ${isSidebarCollapsed ? 'w-[72px]' : 'w-[272px]'}`}>
        <SidebarContent collapsed={isSidebarCollapsed} currentPath={location.pathname}
          onNavigate={handleNavigation} onHover={handleNavHover} onLeave={() => setHoveredNav(null)} owner={owner} />
      </aside>

      {hoveredNav && isSidebarCollapsed && (
        <div className="fixed z-[99999] pointer-events-none animate-in fade-in slide-in-from-left-2 duration-150"
          style={{ top: hoveredNav.top, left: "84px", transform: "translateY(-50%)" }}>
          <div className="flex items-center">
            <div className="w-0 h-0 border-y-[6px] border-y-transparent border-r-[6px] border-r-emerald-500/20" />
            <div className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-sm font-semibold px-3 py-2 rounded-xl shadow-lg whitespace-nowrap border border-emerald-200 dark:border-emerald-500/20">
              {hoveredNav.name}
            </div>
          </div>
        </div>
      )}

      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[6000] lg:hidden flex">
          <div className="absolute inset-0 bg-zinc-900/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setIsMobileMenuOpen(false)} />
          <aside className="relative w-[272px] max-w-[80vw] h-full bg-white dark:bg-[#121214] shadow-2xl flex flex-col animate-in slide-in-from-left duration-300">
            <SidebarContent collapsed={false} currentPath={location.pathname}
              onNavigate={handleNavigation} onHover={() => { }} onLeave={() => { }} owner={owner} />
            <button onClick={() => setIsMobileMenuOpen(false)}
              className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-full hover:bg-zinc-100 dark:hover:bg-white/5 outline-none transition-colors cursor-pointer">
              <X className="h-5 w-5" />
            </button>
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
        <header className="h-16 lg:h-20 bg-white/95 dark:bg-[#121214]/95 backdrop-blur-md border-b border-zinc-200 dark:border-white/10 flex items-center justify-between px-4 lg:px-8 z-40 shrink-0 transition-colors duration-500">
          <div className="flex items-center gap-3 md:gap-4">
            <button onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 text-zinc-500 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors outline-none active:scale-95 cursor-pointer">
              <Menu className="h-6 w-6" />
            </button>
            <div className="flex lg:hidden items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-emerald-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/30">
                <Car className="h-4 w-4" strokeWidth={2.5} />
              </div>
              <span className="text-base font-bold text-zinc-900 dark:text-white tracking-tight">{currentPage}</span>
            </div>
            <div className="relative group hidden lg:flex">
              <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="p-2 -ml-2 text-zinc-500 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors outline-none active:scale-95 cursor-pointer">
                <PanelLeft className={`h-5 w-5 transition-transform duration-300 ${isSidebarCollapsed ? 'rotate-180' : ''}`} />
              </button>
              <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 flex items-center opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 z-[99999]">
                <div className="w-0 h-0 border-y-[6px] border-y-transparent border-r-[6px] border-r-emerald-500/20" />
                <div className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-sm font-semibold px-3 py-2 rounded-xl shadow-lg whitespace-nowrap border border-emerald-200 dark:border-emerald-500/20">
                  {isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-2 md:gap-4 relative">
            <button onClick={() => setUnreadCount(0)}
              className="relative p-2.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5 rounded-full transition-colors outline-none cursor-pointer">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-red-500 border-2 border-white dark:border-[#121214] animate-pulse" />
              )}
            </button>
            <div className="relative">
              <button onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                className="flex items-center gap-3 p-1 pr-2 md:pr-3 rounded-full hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors border border-transparent hover:border-zinc-200 dark:hover:border-white/10 outline-none cursor-pointer">
                <img src={owner.avatar} alt="Profile"
                  className="h-8 w-8 md:h-9 md:w-9 rounded-full object-cover border border-zinc-200 dark:border-white/10" />
                <span className="hidden md:block text-sm font-bold text-zinc-900 dark:text-white">{owner.name}</span>
                <ChevronDown className={`h-4 w-4 text-zinc-500 hidden md:block transition-transform duration-300 ${isProfileDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {isProfileDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsProfileDropdownOpen(false)} />
                  <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-[#18181b] rounded-2xl shadow-xl border border-zinc-200 dark:border-white/10 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-[5000]">
                    <div className="px-4 py-3 border-b border-zinc-100 dark:border-white/5">
                      <p className="text-sm font-bold text-zinc-900 dark:text-white">{owner.name}</p>
                      <p className="text-xs text-zinc-500 truncate">{owner.role}</p>
                    </div>
                    <div className="p-1.5 flex flex-col">
                      <button onClick={() => handleNavigation("/owner/profile")}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-white/5 rounded-xl transition-colors text-left outline-none cursor-pointer">
                        <User className="h-4 w-4" /> View Profile
                      </button>
                      <button onClick={toggleTheme}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-white/5 rounded-xl transition-colors text-left outline-none cursor-pointer">
                        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                        {theme === "dark" ? "Light Mode" : "Dark Mode"}
                      </button>
                    </div>
                    <div className="p-1.5 border-t border-zinc-100 dark:border-white/5">
                      <button onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-bold text-red-600 dark:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors text-left outline-none cursor-pointer">
                        <LogOut className="h-4 w-4" /> Sign Out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto overscroll-contain bg-[#f4f4f5] dark:bg-[#09090b] custom-scrollbar">
          <div className="p-4 md:p-8 lg:p-10 max-w-[1600px] mx-auto min-h-full transition-all duration-300 animate-in fade-in">
            <Outlet context={{ setUnreadCount }} />
          </div>
        </main>
      </div>
    </div>
  );
}
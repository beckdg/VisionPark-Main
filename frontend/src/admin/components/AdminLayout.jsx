import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
    LayoutDashboard, Cpu, Activity, User, Users,
    ScrollText, CreditCard, Database, Bell, Settings,
    UserCircle, Menu, X, ChevronDown, LogOut,
    Moon, Sun, PanelLeft, ShieldAlert, AlertTriangle, CheckCircle
} from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";

const NAVIGATION = [
    {
        group: "Overview",
        items: [
            { name: "Dashboard", path: "/admin/dashboard", icon: LayoutDashboard },
        ]
    },
    {
        group: "AI Infrastructure",
        items: [
            { name: "Platform Analytics", path: "/admin/platform-analytics", icon: Cpu },
            { name: "Network Health", path: "/admin/network-health", icon: Activity },
        ]
    },
    {
        group: "Administration",
        items: [
            { name: "Owner Account", path: "/admin/owner-account", icon: User },
            { name: "Session Manager", path: "/admin/session-manager", icon: Users },
            { name: "Audit Log", path: "/admin/audit-log", icon: ScrollText },
        ]
    },
    {
        group: "System",
        items: [
            { name: "Payment Gateway", path: "/admin/payment-gateway", icon: CreditCard },
            { name: "Backup & Recovery", path: "/admin/backup-recovery", icon: Database },
            { name: "Alert Thresholds", path: "/admin/alert-thresholds", icon: Bell },
            { name: "System Config", path: "/admin/system-config", icon: Settings },
        ]
    },
    {
        group: "Account",
        items: [
            { name: "Admin Profile", path: "/admin/profile", icon: UserCircle },
        ]
    },
];

const ALL_NAV = NAVIGATION.flatMap(g => g.items);

// ── Compute initials from a display name (max 2 chars) ────────────────────────
const getInitials = (name = "") =>
    name
        .split(" ")
        .map(w => w[0] ?? "")
        .join("")
        .slice(0, 2)
        .toUpperCase() || "SA";

// ── Read the live admin profile from localStorage ─────────────────────────────
const readAdminProfile = () => ({
    name: localStorage.getItem("vp_admin_name") || "System Admin",
    avatar: localStorage.getItem("vp_admin_avatar") || null,
    role: "IT Administrator",                         // role is not editable from profile page
});

// ── Avatar component: shows photo if present, initials otherwise ──────────────
const AdminAvatar = ({ avatar, name, className = "", textClass = "" }) => {
    if (avatar) {
        return (
            <img
                src={avatar}
                alt="Profile"
                className={`rounded-full object-cover ${className}`}
            />
        );
    }
    return (
        <div className={`rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold ${className} ${textClass}`}>
            {getInitials(name)}
        </div>
    );
};

const SidebarContent = ({ collapsed, currentPath, onNavigate, onHover, onLeave, admin }) => (
    <div className="flex flex-col h-full bg-white dark:bg-[#18181b] w-full">

        {/* Brand Header */}
        <div className={`h-16 lg:h-20 flex items-center shrink-0 border-b border-zinc-200 dark:border-white/5 transition-all duration-300 ${collapsed ? "justify-center px-0" : "px-6 justify-start"}`}>
            <div className="flex items-center gap-2 overflow-hidden whitespace-nowrap">
                <div className="h-8 w-8 shrink-0 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
                    <ShieldAlert className="h-5 w-5" strokeWidth={2.5} />
                </div>
                <span className={`text-xl font-bold text-zinc-900 dark:text-white tracking-tight transition-all duration-300 overflow-hidden whitespace-nowrap ${collapsed ? "opacity-0 max-w-0" : "opacity-100 max-w-[200px]"}`}>
                    VisionPark <span className="text-indigo-500">Admin</span>
                </span>
            </div>
        </div>

        {/* ── Profile Box — updates when admin name/avatar changes ── */}
        <div className={`flex flex-col items-center border-b border-zinc-200 dark:border-white/5 shrink-0 transition-all duration-300 ${collapsed ? "py-4" : "py-6"}`}>
            <AdminAvatar
                avatar={admin.avatar}
                name={admin.name}
                className={`border-2 border-indigo-500 shadow-sm transition-all duration-300 ${collapsed ? "h-10 w-10 text-[10px]" : "h-16 w-16 text-lg"}`}
            />
            <div className={`flex flex-col items-center overflow-hidden whitespace-nowrap transition-all duration-300 ${collapsed ? "opacity-0 max-h-0 mt-0" : "opacity-100 max-h-[100px] mt-3"}`}>
                <h3 className="font-bold text-zinc-900 dark:text-white">{admin.name}</h3>
                <span className="text-xs text-indigo-500 font-bold uppercase tracking-wider">{admin.role}</span>
            </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 custom-scrollbar" onMouseLeave={onLeave}>
            {NAVIGATION.map((group) => (
                <div key={group.group} className="mb-4">
                    <div className={`transition-all duration-300 overflow-hidden ${collapsed ? "opacity-0 max-h-0 mb-0" : "opacity-100 max-h-10 mb-1.5"}`}>
                        <p className="px-4 text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                            {group.group}
                        </p>
                    </div>
                    <div className="space-y-1">
                        {group.items.map((item) => {
                            const isActive = currentPath.includes(item.path);
                            const Icon = item.icon;
                            return (
                                <button
                                    key={item.name}
                                    onClick={() => onNavigate(item.path)}
                                    onMouseEnter={(e) => onHover(e, item.name, collapsed)}
                                    onMouseLeave={onLeave}
                                    className={`flex items-center rounded-xl text-sm font-semibold transition-all outline-none cursor-pointer active:scale-[0.98] overflow-hidden whitespace-nowrap w-full
                                        ${collapsed ? "justify-center p-3" : "px-4 py-3 gap-3"}
                                        ${isActive
                                            ? "bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-white border border-indigo-200 dark:border-indigo-500/40"
                                            : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-white/5 hover:text-zinc-900 dark:hover:text-white border border-transparent"
                                        }`}
                                >
                                    <Icon className={`h-4 w-4 shrink-0 transition-colors ${isActive ? "text-indigo-400 dark:text-indigo-400" : "text-zinc-400 dark:text-zinc-500"}`} />
                                    <span className={`transition-all duration-300 overflow-hidden whitespace-nowrap ${collapsed ? "opacity-0 max-w-0" : "opacity-100 max-w-[200px]"}`}>
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

export default function AdminLayout() {
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => localStorage.getItem("visionpark_admin_sidebar_collapsed") === "true");
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
    const [hoveredNav, setHoveredNav] = useState(null);
    const [notifCount, setNotifCount] = useState(2);
    const [toast, setToast] = useState(null);

    // ── Live admin profile — re-reads whenever the profile page saves ──────
    const [admin, setAdmin] = useState(readAdminProfile);

    useEffect(() => {
        // Listen for the custom event dispatched by AdminProfile after saving
        const refresh = () => setAdmin(readAdminProfile());
        window.addEventListener("vp_profile_updated", refresh);
        return () => window.removeEventListener("vp_profile_updated", refresh);
    }, []);

    const location = useLocation();
    const navigate = useNavigate();
    const { theme, setTheme } = useTheme();
    const auth = useAuth();

    useEffect(() => {
        localStorage.setItem("visionpark_admin_sidebar_collapsed", isSidebarCollapsed);
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

    const showToast = (message, type = "success") => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 4000);
    };

    const currentPage = ALL_NAV.find(n => location.pathname.includes(n.path))?.name ?? "Admin";

    return (
        <div className="flex h-[100dvh] w-full overflow-hidden bg-[#f4f4f5] dark:bg-[#09090b] transition-colors duration-500">

            {/* ── DESKTOP SIDEBAR ── */}
            <aside className={`hidden lg:flex flex-col relative h-full bg-white dark:bg-[#18181b] border-r border-zinc-200 dark:border-white/5 transition-[width] duration-300 ease-[cubic-bezier(0.25,0.8,0.25,1)] shrink-0 z-50 shadow-[4px_0_24px_rgba(0,0,0,0.02)] overflow-hidden
                ${isSidebarCollapsed ? "w-[72px]" : "w-[272px]"}`}>
                <SidebarContent
                    collapsed={isSidebarCollapsed}
                    currentPath={location.pathname}
                    onNavigate={handleNavigation}
                    onHover={handleNavHover}
                    onLeave={() => setHoveredNav(null)}
                    admin={admin}
                />
            </aside>

            {/* ── COLLAPSED TOOLTIPS ── */}
            {hoveredNav && isSidebarCollapsed && (
                <div
                    className="fixed z-[50] pointer-events-none animate-in fade-in slide-in-from-left-2 duration-150"
                    style={{ top: hoveredNav.top, left: "84px", transform: "translateY(-50%)" }}
                >
                    <div className="flex items-center">
                        <div className="w-0 h-0 border-y-[6px] border-y-transparent border-r-[6px] border-r-indigo-500/20" />
                        <div className="bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 text-sm font-semibold px-3 py-2 rounded-xl shadow-lg whitespace-nowrap border border-indigo-200 dark:border-indigo-500/20">
                            {hoveredNav.name}
                        </div>
                    </div>
                </div>
            )}

            {/* ── MOBILE SIDEBAR DRAWER ── */}
            {isMobileMenuOpen && (
                <div className="fixed inset-0 z-[60] lg:hidden flex">
                    <div
                        className="absolute inset-0 bg-zinc-900/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
                        onClick={() => setIsMobileMenuOpen(false)}
                    />
                    <aside className="relative w-[272px] max-w-[80vw] h-full bg-white dark:bg-[#18181b] shadow-2xl flex flex-col animate-in slide-in-from-left duration-300">
                        <SidebarContent
                            collapsed={false}
                            currentPath={location.pathname}
                            onNavigate={handleNavigation}
                            onHover={() => { }}
                            onLeave={() => { }}
                            admin={admin}
                        />
                        <button
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-full hover:bg-zinc-100 dark:hover:bg-white/5 outline-none transition-colors cursor-pointer"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </aside>
                </div>
            )}

            {/* ── MAIN CONTENT ── */}
            <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">

                <header className="h-16 lg:h-20 bg-white/95 dark:bg-[#18181b]/95 backdrop-blur-md border-b border-zinc-200 dark:border-white/5 flex items-center justify-between px-4 lg:px-8 z-50 shrink-0 transition-colors duration-500 relative">

                    <div className="flex items-center gap-3 md:gap-4">
                        <button
                            onClick={() => setIsMobileMenuOpen(true)}
                            className="lg:hidden p-2 -ml-2 text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors outline-none active:scale-95 cursor-pointer"
                        >
                            <Menu className="h-6 w-6" />
                        </button>

                        <div className="flex lg:hidden items-center gap-2">
                            <div className="h-7 w-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/30">
                                <ShieldAlert className="h-4 w-4" strokeWidth={2.5} />
                            </div>
                            <span className="text-base font-bold text-zinc-900 dark:text-white tracking-tight">
                                {currentPage}
                            </span>
                        </div>

                        <div className="relative group hidden lg:flex">
                            <button
                                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                                className="p-2 -ml-2 text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors outline-none active:scale-95 cursor-pointer"
                            >
                                <PanelLeft className={`h-5 w-5 transition-transform duration-300 ${isSidebarCollapsed ? "rotate-180" : ""}`} />
                            </button>
                        </div>
                    </div>

                    <div className="flex-1" />

                    <div className="flex items-center gap-2 md:gap-4 relative">
                        <button
                            onClick={() => setNotifCount(0)}
                            className="relative p-2.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5 rounded-full transition-colors outline-none cursor-pointer"
                        >
                            <Bell className="h-5 w-5" />
                            {notifCount > 0 && (
                                <span className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-red-500 border-2 border-white dark:border-[#18181b] animate-pulse" />
                            )}
                        </button>

                        {/* ── Profile dropdown — name and avatar update live ── */}
                        <div className="relative">
                            <button
                                onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                                className="flex items-center gap-3 p-1 pr-2 md:pr-3 rounded-full hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors border border-transparent hover:border-zinc-200 dark:hover:border-white/10 outline-none cursor-pointer"
                            >
                                <AdminAvatar
                                    avatar={admin.avatar}
                                    name={admin.name}
                                    className="h-8 w-8 md:h-9 md:w-9 text-xs border border-indigo-500/30 shadow-sm shrink-0"
                                />
                                <span className="hidden md:block text-sm font-bold text-zinc-900 dark:text-white">{admin.name}</span>
                                <ChevronDown className={`h-4 w-4 text-zinc-500 hidden md:block transition-transform duration-300 ${isProfileDropdownOpen ? "rotate-180" : ""}`} />
                            </button>

                            {isProfileDropdownOpen && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setIsProfileDropdownOpen(false)} />
                                    <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-[#18181b] rounded-2xl shadow-xl border border-zinc-200 dark:border-white/10 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-50">
                                        <div className="px-4 py-3 border-b border-zinc-100 dark:border-white/5 flex items-center gap-3">
                                            <AdminAvatar
                                                avatar={admin.avatar}
                                                name={admin.name}
                                                className="h-9 w-9 text-xs border border-indigo-500/20 shrink-0"
                                            />
                                            <div className="min-w-0">
                                                <p className="text-sm font-bold text-zinc-900 dark:text-white truncate">{admin.name}</p>
                                                <p className="text-xs text-indigo-400 font-bold uppercase tracking-wider">{admin.role}</p>
                                            </div>
                                        </div>
                                        <div className="p-1.5 flex flex-col relative">
                                            <button
                                                onClick={() => handleNavigation("/admin/profile")}
                                                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-white/5 rounded-xl transition-colors text-left outline-none cursor-pointer"
                                            >
                                                <UserCircle className="h-4 w-4" /> View Profile
                                            </button>
                                            <button
                                                onClick={toggleTheme}
                                                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-white/5 rounded-xl transition-colors text-left outline-none cursor-pointer"
                                            >
                                                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                                                {theme === "dark" ? "Light Mode" : "Dark Mode"}
                                            </button>
                                        </div>
                                        <div className="p-1.5 border-t border-zinc-100 dark:border-white/5">
                                            <button
                                                onClick={handleLogout}
                                                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-bold text-red-600 dark:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors text-left outline-none cursor-pointer"
                                            >
                                                <LogOut className="h-4 w-4" /> Sign Out
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </header>

                {/* Page content */}
                <main className="flex-1 overflow-y-auto overscroll-contain bg-[#f4f4f5] dark:bg-[#09090b] custom-scrollbar relative">
                    <div className="p-4 md:p-8 lg:p-10 max-w-[1600px] mx-auto min-h-full transition-all duration-300 animate-in fade-in">
                        <Outlet context={{ showToast }} />
                    </div>
                </main>
            </div>

            {/* ── GLOBAL TOAST ── */}
            {toast && createPortal(
                <div className={`fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-6 text-white font-bold text-sm w-11/12 md:w-auto justify-center text-center z-[9999] ${toast.type === "error" ? "bg-red-600" : "bg-zinc-900 dark:bg-white dark:text-zinc-900"}`}>
                    {toast.type === "error" ? <AlertTriangle className="h-5 w-5 shrink-0" /> : <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />}
                    {toast.message}
                </div>,
                document.body
            )}

            <style>{`
                .custom-scrollbar::-webkit-scrollbar       { width: 5px; height: 5px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #52525b; border-radius: 99px; }
            `}</style>
        </div>
    );
}
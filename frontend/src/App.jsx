import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { ThemeProvider } from "./context/ThemeContext";
import { ScrollProvider } from "./context/ScrollContext";
import { AuthProvider, useAuth } from "./context/AuthContext";

// --- 1. LAYOUTS ---
import DriverLayout from "./driver/components/DriverLayout";
import OwnerLayout from "./owner/components/OwnerLayout";
import AttendantLayout from "./attendant/components/AttendantLayout";
import AdminLayout from "./admin/components/AdminLayout";

// --- 2. AUTH & PUBLIC ---
import Login from "./shared/auth/Login";
import DriverSignUp from "./shared/auth/DriverSignUp";
import VerifyEmail from "./shared/auth/VerifyEmail";
import ForgotPassword from "./shared/auth/ForgotPassword";
import PrivacyPolicy from "./shared/pages/PrivacyPolicy";
import GuestMap from "./guest/pages/GuestMap"; // <-- Added Guest Map

// --- 3. ADMIN AUTH ---
import AdminLogin from "./shared/auth/admin/AdminLogin";

// --- 4. DRIVER PAGES ---
import DriverMap from "./driver/pages/DriverMap";
import ActiveSession from "./driver/pages/ActiveSession";
import DriverHistory from "./driver/pages/DriverHistory";
import DriverProfile from "./driver/pages/DriverProfile";
import PaymentSuccess from "./driver/pages/PaymentSuccess";

// --- 5. OWNER PAGES ---
import Dashboard from "./owner/pages/Dashboard";
import ParkingManagement from "./owner/pages/ParkingManagement";
import AttendantManagement from "./owner/pages/AttendantManagement";
import AttendantDetails from "./owner/pages/AttendantDetails";
import Operations from "./owner/pages/Operations";
import Analytics from "./owner/pages/Analytics";
import FinancialReports from "./owner/pages/FinancialReports";
import PricingSettings from "./owner/pages/PricingSettings";
import PayoutSettings from "./owner/pages/PayoutSettings";
import OwnerProfile from "./owner/pages/OwnerProfile";

// --- 6. ATTENDANT PAGES ---
import LiveGrid from "./attendant/pages/LiveGrid";
import AIExceptions from "./attendant/pages/AIExceptions";
import WalkUpPOS from "./attendant/pages/WalkUpPOS";
import Overstays from "./attendant/pages/Overstays";
import Enforcement from "./attendant/pages/Enforcement";
import Incidents from "./attendant/pages/Incidents";
import ZReport from "./attendant/pages/ZReport";
import AttendantProfile from "./attendant/pages/AttendantProfile";

// --- 7. SYSTEM ADMIN PAGES ---
import AdminDashboard from "./admin/pages/Dashboard";
import PlatformAnalytics from "./admin/pages/PlatformAnalytics";
import NetworkHealth from "./admin/pages/NetworkHealth";
import OwnerAccount from "./admin/pages/OwnerAccount";
import SessionManager from "./admin/pages/SessionManager";
import AuditLog from "./admin/pages/AuditLog";
import PaymentGateway from "./admin/pages/PaymentGateway";
import BackupRecovery from "./admin/pages/BackupRecovery";
import AlertThresholds from "./admin/pages/AlertThresholds";
import SystemConfig from "./admin/pages/SystemConfig";
import AdminProfile from "./admin/pages/AdminProfile";
import ProtectedRoute from "./shared/auth/ProtectedRoute";

function LoginRoute() {
  const { isAuthenticated, isBootstrapping, user } = useAuth();
  if (isBootstrapping) {
    return null;
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  if (user?.role === "owner") {
    return <Navigate to="/owner" replace />;
  }
  if (user?.role === "attendant") {
    return <Navigate to="/attendant" replace />;
  }
  if (user?.role === "admin") {
    return <Navigate to="/admin" replace />;
  }
  return <Navigate to="/driver" replace />;
}

function HomeRoute() {
  const { isAuthenticated, isBootstrapping, user } = useAuth();
  if (isBootstrapping) {
    return null;
  }

  if (!isAuthenticated) {
    return <GuestMap />;
  }

  if (user?.role === "owner") {
    return <Navigate to="/owner" replace />;
  }
  if (user?.role === "attendant") {
    return <Navigate to="/attendant" replace />;
  }
  if (user?.role === "admin") {
    return <Navigate to="/admin" replace />;
  }
  return <Navigate to="/driver" replace />;
}

export default function App() {
  useEffect(() => {
    const handleClick = (e) => {
      const anchor = e.target.closest('a');
      if (anchor && anchor.getAttribute('href')) {
        console.warn('🚨 Anchor clicked:', { href: anchor.getAttribute('href'), element: anchor });
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  return (
    <ThemeProvider>
      <ScrollProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>

              {/* ── PUBLIC ROUTES ── */}
              <Route path="/" element={<HomeRoute />} />
              <Route path="/login" element={<LoginRoute />} />
              <Route path="/signup" element={<DriverSignUp />} />
              <Route path="/verify-email" element={<VerifyEmail />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
              <Route
                path="/payment/success"
                element={
                  <ProtectedRoute allowedRoles={["driver"]}>
                    <PaymentSuccess />
                  </ProtectedRoute>
                }
              />

              {/* ── ADMIN AUTH ──
                Sits outside AdminLayout — pre-login page.
                Forgot password is embedded inside AdminLogin as a flow state,
                not a separate route. No public page ever links to /admin/login. */}
              <Route path="/admin/login" element={<LoginRoute />} />

              {/* ── SECTION A: Driver Domain ── */}
              <Route
                path="/driver"
                element={
                  <ProtectedRoute allowedRoles={["driver"]}>
                    <DriverLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Navigate to="map" replace />} />
                <Route path="map" element={<DriverMap />} />
                <Route path="session" element={<ActiveSession />} />
                <Route path="history" element={<DriverHistory />} />
                <Route path="profile" element={<DriverProfile />} />
              </Route>

              {/* ── SECTION B: Owner Domain ── */}
              <Route
                path="/owner"
                element={
                  <ProtectedRoute allowedRoles={["owner"]}>
                    <OwnerLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="parking" element={<ParkingManagement />} />
                <Route path="attendants" element={<AttendantManagement />} />
                <Route path="attendants/:attendantId" element={<AttendantDetails />} />
                <Route path="operations" element={<Operations />} />
                <Route path="analytics" element={<Analytics />} />
                <Route path="finance" element={<FinancialReports />} />
                <Route path="pricing" element={<PricingSettings />} />
                <Route path="payout" element={<PayoutSettings />} />
                <Route path="profile" element={<OwnerProfile />} />
              </Route>

              {/* ── SECTION C: Attendant Domain ── */}
              <Route
                path="/attendant"
                element={
                  <ProtectedRoute allowedRoles={["attendant"]}>
                    <AttendantLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<LiveGrid />} />
                <Route path="exceptions" element={<AIExceptions />} />
                <Route path="pos" element={<WalkUpPOS />} />
                <Route path="overstays" element={<Overstays />} />
                <Route path="enforcement" element={<Enforcement />} />
                <Route path="incidents" element={<Incidents />} />
                <Route path="z-report" element={<ZReport />} />
                <Route path="profile" element={<AttendantProfile />} />
              </Route>

              {/* ── SECTION D: System Admin Domain ──
                Index redirects to dashboard, not analytics, since dashboard
                is now the proper landing page for the admin module. */}
              <Route
                path="/admin"
                element={
                  <ProtectedRoute allowedRoles={["admin"]}>
                    <AdminLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<AdminDashboard />} />
                <Route path="platform-analytics" element={<PlatformAnalytics />} />
                <Route path="network-health" element={<NetworkHealth />} />
                <Route path="owner-account" element={<OwnerAccount />} />
                <Route path="session-manager" element={<SessionManager />} />
                <Route path="audit-log" element={<AuditLog />} />
                <Route path="payment-gateway" element={<PaymentGateway />} />
                <Route path="backup-recovery" element={<BackupRecovery />} />
                <Route path="alert-thresholds" element={<AlertThresholds />} />
                <Route path="system-config" element={<SystemConfig />} />
                <Route path="profile" element={<AdminProfile />} />
              </Route>

            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ScrollProvider>
    </ThemeProvider>
  );
}
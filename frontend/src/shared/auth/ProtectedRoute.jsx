import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function ProtectedRoute({ children, allowedRoles = [] }) {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role === "driver" && user?.emailVerified === false) {
    const encoded = encodeURIComponent(user?.email || "");
    return <Navigate to={`/verify-email?email=${encoded}`} replace />;
  }

  if (user?.mustChangePassword === true) {
    return <Navigate to="/setup-password" replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user?.role)) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-zinc-100 dark:bg-[#09090b] px-4">
        <div className="max-w-md w-full rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#121214] p-6 text-center">
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Not authorized</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Your account does not have permission to access this page.
          </p>
        </div>
      </div>
    );
  }

  return children;
}


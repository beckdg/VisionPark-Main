import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, ShieldCheck, ArrowLeft } from "lucide-react";
import { GlassCard } from "../../components/ui/GlassCard";
import { apiClient } from "../../api/apiClient";
import { useAuth } from "../../context/AuthContext";
import AuthPageShell from "./components/AuthPageShell";
import PasswordFields from "./components/PasswordFields";
import { ErrorBanner } from "./components/AlertBanner";

export default function ResetPassword() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [searchParams] = useSearchParams();
  const resetToken = searchParams.get("resetToken") || "";
  const email = searchParams.get("email") || "";
  const fromProfile = searchParams.get("from") === "profile";

  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [validation, setValidation] = useState({ isValid: false });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!resetToken) {
      setError("Reset session is invalid or expired. Please start again.");
      return;
    }
    if (!validation.isValid) {
      setError("Please meet all password requirements.");
      return;
    }

    setIsLoading(true);
    try {
      await apiClient.post("/auth/reset-password", {
        resetToken,
        password,
      });
      auth.logout();
      setIsSuccess(true);
    } catch (err) {
      setError(err?.message || "Failed to reset password. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!resetToken) {
    return (
      <AuthPageShell title="Reset Session Expired" subtitle="Please request a new password reset code.">
        <GlassCard>
          <ErrorBanner message="Your reset link is invalid or has expired." />
          <Link
            to="/forgot-password"
            className="mt-4 flex w-full h-12 items-center justify-center rounded-xl font-bold text-sm uppercase bg-emerald-500 text-zinc-950 hover:bg-emerald-400 transition-all"
          >
            Start Over
          </Link>
        </GlassCard>
      </AuthPageShell>
    );
  }

  if (isSuccess) {
    return (
      <AuthPageShell>
        <GlassCard>
          <div className="flex flex-col items-center text-center py-4">
            <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 mb-6">
              <ShieldCheck className="h-8 w-8 text-emerald-500" />
            </div>
            <h2 className="text-xl md:text-2xl font-bold mb-2">Password Updated</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-8">
              {fromProfile
                ? "Your password has been updated. Sign in again with your new password."
                : "Your password has been changed successfully. Sign in with your new credentials."}
            </p>
            <button
              type="button"
              onClick={() => navigate("/login", { replace: true })}
              className="w-full h-12 md:h-14 rounded-xl font-bold text-sm uppercase bg-emerald-500 text-zinc-950 hover:bg-emerald-400 transition-all"
            >
              Go to Sign In
            </button>
          </div>
        </GlassCard>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell
      title={fromProfile ? "Set New Password" : "Create New Password"}
      subtitle={email ? `Set a new password for ${email}` : "Set your new password"}
    >
      <GlassCard>
        <ErrorBanner message={error} />
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <PasswordFields
            password={password}
            repeatPassword={repeatPassword}
            onPasswordChange={setPassword}
            onRepeatPasswordChange={setRepeatPassword}
            disabled={isLoading}
            onValidationChange={setValidation}
          />

          <button
            type="submit"
            disabled={isLoading || !validation.isValid}
            className="w-full h-12 md:h-14 flex items-center justify-center gap-2 rounded-xl font-bold text-sm uppercase bg-emerald-500 text-zinc-950 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Updating...
              </>
            ) : (
              "Update Password"
            )}
          </button>

          <Link
            to="/login"
            className="flex items-center justify-center gap-1.5 text-xs md:text-sm text-zinc-600 dark:text-zinc-400 font-medium hover:text-emerald-500 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Cancel & Back to Sign In
          </Link>
        </form>
      </GlassCard>
    </AuthPageShell>
  );
}

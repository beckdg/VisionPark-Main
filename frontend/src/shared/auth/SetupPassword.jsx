import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, ShieldCheck, KeyRound } from "lucide-react";
import { GlassCard } from "../../components/ui/GlassCard";
import { apiClient } from "../../api/apiClient";
import { useAuth } from "../../context/AuthContext";
import AuthPageShell from "./components/AuthPageShell";
import PasswordFields from "./components/PasswordFields";
import { ErrorBanner } from "./components/AlertBanner";

export default function SetupPassword() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [validation, setValidation] = useState({ isValid: false });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const role = auth.user?.role;
  const email = auth.user?.email || "";

  const redirectByRole = () => {
    if (role === "owner") navigate("/owner", { replace: true });
    else if (role === "attendant") navigate("/attendant", { replace: true });
    else if (role === "admin") navigate("/admin", { replace: true });
    else navigate("/driver", { replace: true });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!currentPassword.trim()) {
      setError("Enter your temporary password from the welcome email.");
      return;
    }
    if (!validation.isValid) {
      setError("Please meet all password requirements.");
      return;
    }

    setIsLoading(true);
    try {
      const data = await apiClient.post("/auth/complete-initial-password", {
        currentPassword,
        newPassword: password,
      });

      const token = data?.token;
      const user = data?.user;
      if (!token || !user) {
        throw new Error("Invalid response from server.");
      }

      auth.setSession(token, user);
      redirectByRole();
    } catch (err) {
      setError(err?.message || "Could not update password. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthPageShell
      title="Set Your Password"
      subtitle={
        email
          ? `First-time setup for ${email}. Use your temporary password, then choose a new one.`
          : "Use your temporary password, then choose a new secure password."
      }
    >
      <GlassCard>
        <div className="flex justify-center mb-6">
          <div className="h-14 w-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <ShieldCheck className="h-7 w-7 text-emerald-500" />
          </div>
        </div>

        <ErrorBanner message={error} />

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <label className="block text-xs md:text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-1.5 ml-1">
              Temporary password
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <KeyRound className="h-5 w-5 text-zinc-400 group-focus-within:text-emerald-500 transition-colors" />
              </div>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="From your welcome email"
                className="block w-full h-12 md:h-14 pl-12 pr-4 rounded-xl text-sm border border-zinc-200 dark:border-white/10 bg-white/50 dark:bg-black/40 text-zinc-900 dark:text-white outline-none focus:border-emerald-500"
              />
            </div>
          </div>

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
            disabled={isLoading || !validation.isValid || !currentPassword}
            className="w-full h-12 md:h-14 flex items-center justify-center gap-2 rounded-xl font-bold text-sm uppercase bg-emerald-500 text-zinc-950 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Saving...
              </>
            ) : (
              "Save & Continue"
            )}
          </button>
        </form>
      </GlassCard>
    </AuthPageShell>
  );
}

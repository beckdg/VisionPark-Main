import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, Loader2, ArrowLeft } from "lucide-react";
import { GlassCard } from "../../components/ui/GlassCard";
import { apiClient } from "../../api/apiClient";
import AuthPageShell from "./components/AuthPageShell";
import { ErrorBanner } from "./components/AlertBanner";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      await apiClient.post("/auth/forgot-password", { email: email.trim() });
      const encoded = encodeURIComponent(email.trim());
      navigate(`/verify-reset-otp?email=${encoded}`, { replace: true });
    } catch (err) {
      setError(err?.message || "Unable to process request. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthPageShell
      title="Reset Password"
      subtitle="Enter your account email. We'll send a 6-digit code if an account exists."
    >
      <GlassCard>
        <ErrorBanner message={error} />
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <label className="block text-xs md:text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-1.5 ml-1">
              Email address
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-zinc-400 dark:text-zinc-500 group-focus-within:text-emerald-500 transition-colors" />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                placeholder="you@example.com"
                className="block w-full h-12 md:h-14 pl-12 pr-4 rounded-xl text-sm border border-zinc-200 dark:border-white/10 bg-white/50 dark:bg-black/40 text-zinc-900 dark:text-white outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || !email.trim()}
            className="w-full h-12 md:h-14 flex items-center justify-center gap-2 rounded-xl font-bold text-sm uppercase bg-emerald-500 text-zinc-950 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Sending...
              </>
            ) : (
              "Send Reset Code"
            )}
          </button>

          <Link
            to="/login"
            className="flex items-center justify-center gap-1.5 text-xs md:text-sm text-zinc-600 dark:text-zinc-400 font-medium hover:text-emerald-500 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Sign In
          </Link>
        </form>
      </GlassCard>
    </AuthPageShell>
  );
}

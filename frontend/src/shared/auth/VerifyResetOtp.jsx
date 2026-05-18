import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, RefreshCw, ArrowLeft } from "lucide-react";
import { GlassCard } from "../../components/ui/GlassCard";
import { apiClient } from "../../api/apiClient";
import AuthPageShell from "./components/AuthPageShell";
import OtpInput, { OTP_LENGTH } from "./components/OtpInput";
import { ErrorBanner, SuccessBanner } from "./components/AlertBanner";

const RESEND_COOLDOWN_SEC = 60;

export default function VerifyResetOtp() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const emailFromQuery = searchParams.get("email")?.trim() || "";
  const fromProfile = searchParams.get("from") === "profile";

  const [email, setEmail] = useState(emailFromQuery);
  const [digits, setDigits] = useState(Array(OTP_LENGTH).fill(""));
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SEC);

  useEffect(() => {
    if (emailFromQuery) setEmail(emailFromQuery);
  }, [emailFromQuery]);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setInterval(() => setCooldown((prev) => (prev > 0 ? prev - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const otpValue = useMemo(() => digits.join(""), [digits]);

  const handleVerify = async (event) => {
    event.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!email.trim() || otpValue.length !== OTP_LENGTH) {
      setError("Please enter your email and the 6-digit code.");
      return;
    }

    setIsVerifying(true);
    try {
      const data = await apiClient.post("/auth/verify-password-reset-otp", {
        email: email.trim(),
        otp: otpValue,
      });

      const resetToken = data?.resetToken;
      if (!resetToken) {
        throw new Error("Invalid verification response from server.");
      }

      const params = new URLSearchParams({
        email: email.trim(),
        resetToken,
      });
      if (fromProfile) params.set("from", "profile");
      navigate(`/reset-password?${params.toString()}`, { replace: true });
    } catch (err) {
      setError(err?.message || "Verification failed. Please try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = useCallback(async () => {
    if (cooldown > 0 || isResending) return;
    setError("");
    setSuccessMessage("");

    if (!email.trim()) {
      setError("Email is required to resend the code.");
      return;
    }

    setIsResending(true);
    try {
      await apiClient.post("/auth/resend-password-reset-otp", { email: email.trim() });
      setSuccessMessage("If an account exists, a new code has been sent.");
      setCooldown(RESEND_COOLDOWN_SEC);
      setDigits(Array(OTP_LENGTH).fill(""));
    } catch (err) {
      setError(err?.message || "Unable to resend code. Please try again.");
    } finally {
      setIsResending(false);
    }
  }, [cooldown, email, isResending]);

  return (
    <AuthPageShell
      title={fromProfile ? "Change Password" : "Verify Reset Code"}
      subtitle={
        email
          ? `Enter the 6-digit code sent to ${email}`
          : "Enter the code from your email"
      }
    >
      <GlassCard>
        <ErrorBanner message={error} />
        <SuccessBanner message={successMessage} />

        <form onSubmit={handleVerify} className="flex flex-col gap-5">
          <div>
            <label className="block text-xs md:text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-1.5 ml-1">
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              readOnly={Boolean(emailFromQuery)}
              className="block w-full h-12 px-4 rounded-xl text-sm border border-zinc-200 dark:border-white/10 bg-white/50 dark:bg-black/40 text-zinc-900 dark:text-white outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs md:text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-3 ml-1 text-center">
              Verification code
            </label>
            <OtpInput digits={digits} onChange={setDigits} disabled={isVerifying} />
            <p className="text-center text-[11px] text-zinc-500 dark:text-zinc-400 mt-3">
              Code expires in 10 minutes
            </p>
          </div>

          <button
            type="submit"
            disabled={isVerifying || otpValue.length !== OTP_LENGTH}
            className="w-full h-12 md:h-14 flex items-center justify-center gap-2 rounded-xl font-bold text-sm uppercase bg-emerald-500 text-zinc-950 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
          >
            {isVerifying ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Verifying...
              </>
            ) : (
              "Verify Code"
            )}
          </button>

          <button
            type="button"
            onClick={handleResend}
            disabled={cooldown > 0 || isResending}
            className="w-full h-11 flex items-center justify-center gap-2 rounded-xl text-sm font-semibold border border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-zinc-300 hover:border-emerald-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isResending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
              </>
            )}
          </button>

          <div className="flex items-center justify-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
            {fromProfile ? (
              <Link to="/driver/profile" className="flex items-center gap-1 hover:text-emerald-500">
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to profile
              </Link>
            ) : (
              <>
                <Link to="/forgot-password" className="flex items-center gap-1 hover:text-emerald-500">
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Change email
                </Link>
                <span className="text-zinc-300 dark:text-zinc-700">|</span>
                <Link to="/login" className="hover:text-emerald-500">
                  Sign in
                </Link>
              </>
            )}
          </div>
        </form>
      </GlassCard>
    </AuthPageShell>
  );
}

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Mail, Loader2, Check, AlertCircle, RefreshCw } from "lucide-react";
import { GlassCard } from "../../components/ui/GlassCard";
import { Header } from "../../components/layout/Header";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import { apiClient } from "../../api/apiClient";

const RESEND_COOLDOWN_SEC = 60;
const OTP_LENGTH = 6;

export default function VerifyEmail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setTheme } = useTheme();
  const auth = useAuth();

  const emailFromQuery = searchParams.get("email")?.trim() || "";
  const [email, setEmail] = useState(emailFromQuery);
  const [digits, setDigits] = useState(Array(OTP_LENGTH).fill(""));
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SEC);

  const inputRefs = useRef([]);

  useEffect(() => {
    const savedTheme = localStorage.getItem("vp_theme");
    if (!savedTheme) setTheme("light");
    else setTheme(savedTheme);
  }, [setTheme]);

  useEffect(() => {
    if (emailFromQuery) {
      setEmail(emailFromQuery);
    }
  }, [emailFromQuery]);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const otpValue = useMemo(() => digits.join(""), [digits]);

  const handleDigitChange = (index, value) => {
    const sanitized = value.replace(/\D/g, "").slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[index] = sanitized;
      return next;
    });
    if (sanitized && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleDigitKeyDown = (index, event) => {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (event) => {
    event.preventDefault();
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!pasted) return;
    const next = Array(OTP_LENGTH).fill("");
    for (let i = 0; i < pasted.length; i += 1) {
      next[i] = pasted[i];
    }
    setDigits(next);
    const focusIndex = Math.min(pasted.length, OTP_LENGTH - 1);
    inputRefs.current[focusIndex]?.focus();
  };

  const handleVerify = async (event) => {
    event.preventDefault();
    setError("");
    setSuccessMessage("");

    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setError("Email is required.");
      return;
    }
    if (otpValue.length !== OTP_LENGTH) {
      setError("Please enter the 6-digit verification code.");
      return;
    }

    setIsVerifying(true);
    try {
      const data = await apiClient.post("/auth/verify-email-otp", {
        email: normalizedEmail,
        otp: otpValue,
      });

      const token = data?.token;
      const user = data?.user;
      if (!token || !user) {
        throw new Error("Invalid verification response from server.");
      }

      auth.setSession(token, user);
      setSuccessMessage("Email verified successfully. Redirecting...");
      setTimeout(() => navigate("/driver", { replace: true }), 600);
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

    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setError("Email is required to resend the code.");
      return;
    }

    setIsResending(true);
    try {
      await apiClient.post("/auth/resend-email-otp", { email: normalizedEmail });
      setSuccessMessage("A new verification code has been sent.");
      setCooldown(RESEND_COOLDOWN_SEC);
      setDigits(Array(OTP_LENGTH).fill(""));
      inputRefs.current[0]?.focus();
    } catch (err) {
      setError(err?.message || "Unable to resend code. Please try again.");
    } finally {
      setIsResending(false);
    }
  }, [cooldown, email, isResending]);

  return (
    <div className="auth-page relative min-h-[100dvh] w-full overflow-x-hidden bg-[#f4f4f5] dark:bg-[#09090b] text-zinc-900 dark:text-white flex flex-col font-sans transition-colors duration-500">
      <Header />

      <div className="ambient-glow-primary fixed w-[50vw] h-[50vw] top-[-10%] left-[-10%] pointer-events-none z-0" />
      <div className="ambient-glow-secondary fixed w-[40vw] h-[40vw] bottom-[-10%] right-[-10%] pointer-events-none z-0" />

      <main className="flex-1 flex flex-col px-4 md:px-8 w-full relative pt-28 md:pt-32 pb-16">
        <div className="w-full max-w-md m-auto flex flex-col items-center">
          <div className="flex flex-col items-center mb-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-500 mb-4">
              <Mail className="h-6 w-6" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold mb-2 text-center">Verify Your Email</h1>
            <p className="text-xs md:text-sm text-zinc-500 dark:text-zinc-400 text-center font-medium max-w-sm">
              Enter the 6-digit code we sent to your email to activate your driver account.
            </p>
          </div>

          <GlassCard>
            {error && (
              <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-600 dark:text-red-400">
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                <p className="text-xs md:text-sm leading-relaxed">{error}</p>
              </div>
            )}

            {successMessage && (
              <div className="mb-5 flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-emerald-700 dark:text-emerald-400">
                <Check className="h-5 w-5 shrink-0 mt-0.5" />
                <p className="text-xs md:text-sm leading-relaxed">{successMessage}</p>
              </div>
            )}

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
                <div className="flex justify-center gap-2 md:gap-3" onPaste={handlePaste}>
                  {digits.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => {
                        inputRefs.current[index] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleDigitChange(index, e.target.value)}
                      onKeyDown={(e) => handleDigitKeyDown(index, e)}
                      className="w-11 h-14 md:w-12 md:h-16 text-center text-xl font-bold font-mono rounded-xl border border-zinc-200 dark:border-white/10 bg-white/50 dark:bg-black/40 text-zinc-900 dark:text-white outline-none focus:border-emerald-500 focus:shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                    />
                  ))}
                </div>
                <p className="text-center text-[11px] text-zinc-500 dark:text-zinc-400 mt-3">
                  Code expires in 10 minutes
                </p>
              </div>

              <button
                type="submit"
                disabled={isVerifying || otpValue.length !== OTP_LENGTH}
                className="w-full h-12 md:h-14 flex items-center justify-center gap-2 rounded-xl font-bold text-sm md:text-base uppercase bg-emerald-500 text-zinc-950 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "Verify Email"
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

              <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">
                Wrong email?{" "}
                <Link to="/signup" className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline">
                  Go back to signup
                </Link>
              </p>
            </form>
          </GlassCard>
        </div>
      </main>
    </div>
  );
}

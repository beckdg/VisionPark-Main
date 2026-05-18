import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Mail, Lock, AlertCircle, Loader2, Check } from "lucide-react";
import { GlassCard } from "../../components/ui/GlassCard";
import { Header } from "../../components/layout/Header";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";

export default function Login() {
  const { setTheme } = useTheme();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const navigate = useNavigate();
  const auth = useAuth();

  useEffect(() => {
    const savedTheme = localStorage.getItem("vp_theme");
    if (!savedTheme) setTheme("light");
    else setTheme(savedTheme);
  }, [setTheme]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const user = await auth.login(email, password);
      const role = user?.role;
      if (role === "owner") {
        navigate("/owner");
      } else if (role === "attendant") {
        navigate("/attendant");
      } else if (role === "admin") {
        navigate("/admin");
      } else {
        navigate("/driver");
      }
    } catch (err) {
      const message = err?.message || "Login failed.";
      setError(message);
      if (/verify your email/i.test(message)) {
        const encoded = encodeURIComponent(email.trim());
        setTimeout(() => {
          navigate(`/verify-email?email=${encoded}`, { replace: true });
        }, 1200);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    // Same pattern as AdminLogin — overflow-y-auto on the wrapper, html/body scrollbars
    // hidden in index.css, so only one scrollbar exists. pt-20 on card clears the header.
    <div className="auth-page relative min-h-[100dvh] w-full overflow-y-auto overflow-x-hidden bg-[#f4f4f5] dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100 transition-colors duration-500 flex flex-col items-center justify-center px-4 py-10">
      <Header />

      <div className="ambient-glow-primary fixed w-[50vw] h-[50vw] top-[-10%] left-[-10%] pointer-events-none z-0" />
      <div className="ambient-glow-secondary fixed w-[40vw] h-[40vw] bottom-[-10%] right-[-10%] pointer-events-none z-0" />

      <div className="w-full max-w-[420px] relative z-10 animate-in fade-in zoom-in-95 duration-500 pt-20 pb-6">

        <div className="text-center mb-8">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-zinc-900 dark:text-white drop-shadow-sm">
            Welcome Back
          </h1>
          <p className="text-xs md:text-sm text-zinc-500 dark:text-zinc-400 font-medium tracking-wide mt-2">
            Sign in to your VisionPark account
          </p>
        </div>

        <GlassCard>
          {error && (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-600 dark:text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.1)] animate-in fade-in slide-in-from-top-2 duration-300">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <p className="text-xs md:text-sm leading-relaxed">{error}</p>
            </div>
          )}

          <form onSubmit={onSubmit} className="flex flex-col gap-5">
            <div className="space-y-2">
              <label htmlFor="email" className="text-xs md:text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 ml-1">
                Email Address
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                  <Mail className="h-5 w-5 text-zinc-400 dark:text-zinc-500 group-focus-within:text-emerald-500 transition-colors duration-300" />
                </div>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@visionpark.et"
                  required
                  disabled={isLoading}
                  className={`block w-full h-12 md:h-14 pl-12 pr-4 rounded-xl text-sm md:text-base transition-all duration-300 outline-none
                    bg-white/50 border border-zinc-200 text-zinc-900 placeholder:text-zinc-400
                    dark:bg-black/40 dark:border-white/10 dark:text-white dark:placeholder:text-zinc-600
                    ${error
                      ? 'border-red-500/50 focus:border-red-500 focus:shadow-[0_0_15px_rgba(239,68,68,0.2)]'
                      : 'hover:border-zinc-300 dark:hover:border-white/20 focus:border-emerald-500 focus:shadow-[0_0_15px_rgba(16,185,129,0.2)] focus:bg-white/80 dark:focus:bg-black/60'}`}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-xs md:text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 ml-1">
                Password
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                  <Lock className="h-5 w-5 text-zinc-400 dark:text-zinc-500 group-focus-within:text-emerald-500 transition-colors duration-300" />
                </div>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  disabled={isLoading}
                  onCopy={(e) => e.preventDefault()}
                  onPaste={(e) => e.preventDefault()}
                  onCut={(e) => e.preventDefault()}
                  className={`block w-full h-12 md:h-14 pl-12 pr-12 rounded-xl text-sm md:text-base tracking-wider font-mono placeholder:font-sans placeholder:tracking-normal transition-all duration-300 outline-none
                    bg-white/50 border border-zinc-200 text-zinc-900 placeholder:text-zinc-400
                    dark:bg-black/40 dark:border-white/10 dark:text-white dark:placeholder:text-zinc-600
                    ${error
                      ? 'border-red-500/50 focus:border-red-500 focus:shadow-[0_0_15px_rgba(239,68,68,0.2)]'
                      : 'hover:border-zinc-300 dark:hover:border-white/20 focus:border-emerald-500 focus:shadow-[0_0_15px_rgba(16,185,129,0.2)] focus:bg-white/80 dark:focus:bg-black/60'}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-4 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer outline-none"
                >
                  {showPassword ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
                </button>
              </div>

              <div className="flex items-center justify-between mt-3 px-1">
                <label htmlFor="rememberMe" className="flex items-center gap-2.5 cursor-pointer group select-none">
                  <div className="relative flex items-center justify-center h-5 w-5 rounded-[6px] border border-zinc-300 dark:border-zinc-600 bg-white/50 dark:bg-black/40 transition-all duration-300 group-hover:border-emerald-500 dark:group-hover:border-emerald-400 overflow-hidden shadow-sm">
                    <input
                      type="checkbox"
                      id="rememberMe"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="peer sr-only"
                    />
                    <div className="absolute inset-0 bg-emerald-500 opacity-0 peer-checked:opacity-100 transition-opacity duration-300"></div>
                    <Check className="h-3.5 w-3.5 text-white absolute scale-0 opacity-0 peer-checked:scale-100 peer-checked:opacity-100 transition-all duration-300 z-10" strokeWidth={4} />
                  </div>
                  <span className="text-xs md:text-sm text-zinc-600 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-200 transition-colors">
                    Remember me
                  </span>
                </label>
                <Link to="/forgot-password" className="text-xs md:text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 dark:hover:text-emerald-300 hover:drop-shadow-[0_0_5px_rgba(16,185,129,0.8)] transition-all">
                  Forgot Password?
                </Link>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full h-12 md:h-14 mt-4 flex items-center justify-center rounded-xl bg-emerald-500 text-zinc-950 font-bold text-sm md:text-base tracking-wide uppercase overflow-hidden transition-all duration-300 hover:bg-emerald-400 hover:scale-[1.02] active:scale-95 disabled:opacity-70 disabled:hover:scale-100 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] outline-none cursor-pointer"
            >
              <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Authenticating...</span>
                </div>
              ) : "Sign In"}
            </button>

            <div className="mt-2 text-center text-xs md:text-sm text-zinc-600 dark:text-zinc-400">
              You don't have an account yet?{" "}
              <Link to="/signup" className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline underline-offset-4 transition-all">
                Sign Up
              </Link>
            </div>
          </form>
        </GlassCard>
      </div>
    </div>
  );
}
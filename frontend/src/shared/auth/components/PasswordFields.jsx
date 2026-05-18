import React, { useEffect, useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";

const getPasswordScore = (pass) => {
  let score = 0;
  if (!pass) return 0;
  if (pass.length >= 8) score += 1;
  if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score += 1;
  if (/\d/.test(pass)) score += 1;
  if (/[^A-Za-z0-9]/.test(pass)) score += 1;
  if (pass.length >= 12) score += 1;
  return Math.min(score, 5);
};

const getStrengthUI = (score) => {
  if (score === 0) return { text: "", color: "bg-transparent", textColor: "" };
  if (score <= 2) return { text: "Weak", color: "bg-red-500", textColor: "text-red-500" };
  if (score === 3) return { text: "Fair", color: "bg-amber-500", textColor: "text-amber-500" };
  if (score === 4) return { text: "Good", color: "bg-blue-500", textColor: "text-blue-500" };
  return { text: "Strong", color: "bg-emerald-500", textColor: "text-emerald-500" };
};

export default function PasswordFields({
  password,
  repeatPassword,
  onPasswordChange,
  onRepeatPasswordChange,
  disabled = false,
  onValidationChange,
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [showRepeatPassword, setShowRepeatPassword] = useState(false);
  const [matchError, setMatchError] = useState("");

  const passwordScore = getPasswordScore(password);
  const strengthData = getStrengthUI(passwordScore);
  const isPasswordStrong = passwordScore >= 4;

  useEffect(() => {
    if (repeatPassword && password !== repeatPassword) {
      setMatchError("Passwords do not match");
    } else {
      setMatchError("");
    }
  }, [password, repeatPassword]);

  useEffect(() => {
    onValidationChange?.({
      isValid: isPasswordStrong && !matchError && Boolean(password && repeatPassword),
      isPasswordStrong,
      matchError,
    });
  }, [isPasswordStrong, matchError, password, repeatPassword, onValidationChange]);

  const inputClass = (hasError) =>
    `block w-full h-12 md:h-14 pl-12 pr-12 rounded-xl text-sm md:text-base font-mono transition-all duration-300 outline-none border bg-white/50 dark:bg-black/40 text-zinc-900 dark:text-white ${
      hasError
        ? "border-red-500/50 focus:border-red-500"
        : "border-zinc-200 dark:border-white/10 focus:border-emerald-500 focus:shadow-[0_0_15px_rgba(16,185,129,0.2)]"
    }`;

  return (
    <>
      <div>
        <label className="block text-xs md:text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-1.5 ml-1">
          New Password
        </label>
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Lock className="h-5 w-5 text-zinc-400 dark:text-zinc-500 group-focus-within:text-emerald-500 transition-colors" />
          </div>
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            required
            disabled={disabled}
            placeholder="Create new password"
            autoComplete="new-password"
            onCopy={(e) => e.preventDefault()}
            onPaste={(e) => e.preventDefault()}
            onCut={(e) => e.preventDefault()}
            className={inputClass(false)}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 pr-4 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors outline-none cursor-pointer"
          >
            {showPassword ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
          </button>
        </div>
        {password && (
          <div className="mt-2">
            <div className="flex gap-1 h-1.5 w-full rounded-full overflow-hidden bg-zinc-200 dark:bg-white/10">
              {[1, 2, 3, 4, 5].map((level) => (
                <div
                  key={level}
                  className={`flex-1 transition-colors duration-300 ${
                    passwordScore >= level ? strengthData.color : "bg-transparent"
                  }`}
                />
              ))}
            </div>
            <div className="flex justify-between items-center mt-1.5">
              <span className="text-[10px] md:text-[11px] text-zinc-500 dark:text-zinc-400">
                8+ chars, upper, lower, num, symbol
              </span>
              <span className={`text-[10px] md:text-[11px] font-bold uppercase ${strengthData.textColor}`}>
                {strengthData.text}
              </span>
            </div>
          </div>
        )}
      </div>

      <div>
        <label className="block text-xs md:text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-1.5 ml-1 flex justify-between">
          Repeat Password
          {matchError && <span className="text-red-500 text-[10px]">{matchError}</span>}
        </label>
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Lock className="h-5 w-5 text-zinc-400 dark:text-zinc-500 group-focus-within:text-emerald-500 transition-colors" />
          </div>
          <input
            type={showRepeatPassword ? "text" : "password"}
            value={repeatPassword}
            onChange={(e) => onRepeatPasswordChange(e.target.value)}
            required
            disabled={disabled}
            placeholder="Confirm new password"
            autoComplete="new-password"
            onCopy={(e) => e.preventDefault()}
            onPaste={(e) => e.preventDefault()}
            onCut={(e) => e.preventDefault()}
            className={inputClass(!!matchError)}
          />
          <button
            type="button"
            onClick={() => setShowRepeatPassword(!showRepeatPassword)}
            className="absolute inset-y-0 right-0 pr-4 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors outline-none cursor-pointer"
          >
            {showRepeatPassword ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
          </button>
        </div>
      </div>
    </>
  );
}

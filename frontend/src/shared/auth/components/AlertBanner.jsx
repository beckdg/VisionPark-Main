import React from "react";
import { AlertCircle, Check } from "lucide-react";

export function ErrorBanner({ message }) {
  if (!message) return null;
  return (
    <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-600 dark:text-red-400">
      <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
      <p className="text-xs md:text-sm leading-relaxed">{message}</p>
    </div>
  );
}

export function SuccessBanner({ message }) {
  if (!message) return null;
  return (
    <div className="mb-5 flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-emerald-700 dark:text-emerald-400">
      <Check className="h-5 w-5 shrink-0 mt-0.5" />
      <p className="text-xs md:text-sm leading-relaxed">{message}</p>
    </div>
  );
}

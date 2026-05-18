import React, { useEffect } from "react";
import { Header } from "../../../components/layout/Header";
import { useTheme } from "../../../context/ThemeContext";

export default function AuthPageShell({ title, subtitle, children }) {
  const { setTheme } = useTheme();

  useEffect(() => {
    const savedTheme = localStorage.getItem("vp_theme");
    if (!savedTheme) setTheme("light");
    else setTheme(savedTheme);
  }, [setTheme]);

  return (
    <div className="auth-page relative min-h-[100dvh] w-full overflow-x-hidden bg-[#f4f4f5] dark:bg-[#09090b] text-zinc-900 dark:text-white flex flex-col font-sans transition-colors duration-500">
      <Header />
      <div className="ambient-glow-primary fixed w-[50vw] h-[50vw] top-[-10%] left-[-10%] pointer-events-none z-0" />
      <div className="ambient-glow-secondary fixed w-[40vw] h-[40vw] bottom-[-10%] right-[-10%] pointer-events-none z-0" />
      <main className="flex-1 flex flex-col px-4 md:px-8 w-full relative pt-28 md:pt-32 pb-16">
        <div className="w-full max-w-md m-auto flex flex-col items-center">
          {(title || subtitle) && (
            <div className="flex flex-col items-center mb-8">
              {title && (
                <h1 className="text-2xl md:text-3xl font-bold mb-2 text-center">{title}</h1>
              )}
              {subtitle && (
                <p className="text-xs md:text-sm text-zinc-500 dark:text-zinc-400 text-center font-medium max-w-sm">
                  {subtitle}
                </p>
              )}
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}

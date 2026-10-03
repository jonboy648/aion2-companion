import { NavLink, Outlet } from "react-router-dom";
import { isMockEngine } from "@/engine/api";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Home", end: true },
  { to: "/build", label: "Build" },
  { to: "/daevanion", label: "Daevanion" },
  { to: "/codex", label: "Codex" },
  { to: "/keybinds", label: "Keybinds" },
  { to: "/crafting", label: "Crafting" },
  { to: "/roadmap", label: "Road Map" },
];

export const DISCLAIMER = "Fan project, not affiliated with NCSOFT. Game data and icons © NCSOFT.";

export function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-border-soft bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <NavLink to="/" className="flex items-center gap-2 text-gold no-underline" aria-label="Become Cube home">
            <img src="/favicon.svg" alt="" className="size-7" />
            <span className="text-[17px] font-semibold tracking-wide">Become Cube</span>
          </NavLink>
          <nav aria-label="Main" className="flex flex-wrap gap-1">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  cn(
                    "rounded-md px-3 py-1.5 text-sm no-underline transition-colors",
                    isActive ? "bg-surface3 text-gold" : "text-dim hover:bg-surface2 hover:text-foreground",
                  )
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          {isMockEngine && (
            <span className="ml-auto rounded-full border border-warn/40 bg-warn/10 px-2.5 py-0.5 text-xs text-warn" title="VITE_ENGINE=mock">
              mock data
            </span>
          )}
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <Outlet />
      </main>
      <footer className="border-t border-border-soft px-4 py-5 text-center text-xs text-faint">{DISCLAIMER}</footer>
    </div>
  );
}

import { useEffect } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { trackHit } from "@/lib/analytics";
import { isMockEngine } from "@/engine/api";
import { FactionEmblem } from "@/components/game/Ornaments";
import { FactionThemeProvider, useFaction, type Faction } from "@/components/game/faction";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Home", end: true },
  { to: "/guide", label: "Start here" },
  { to: "/build", label: "Build" },
  { to: "/daevanion", label: "Daevanion" },
  { to: "/compare", label: "Compare" },
  { to: "/codex", label: "Codex" },
  { to: "/keybinds", label: "Keybinds" },
  { to: "/crafting", label: "Crafting" },
  { to: "/roadmap", label: "Road Map" },
];

export const DISCLAIMER = "Fan project, not affiliated with NCSOFT. Game data and icons © NCSOFT.";

const THEMES: { key: Faction | "auto"; label: string }[] = [
  { key: "auto", label: "Auto" },
  { key: "elyos", label: "Elyos" },
  { key: "asmodian", label: "Asmodian" },
  { key: "neutral", label: "Ether" },
];

/** Auto = follow the loaded character's faction; the others pin a theme. */
function ThemePicker() {
  const { override, setOverride } = useFaction();
  const current = override ?? "auto";
  return (
    <div role="group" aria-label="Colour theme" className="mt-3 flex flex-wrap items-center justify-center gap-1.5 text-xs">
      <span className="text-faint">Theme</span>
      {THEMES.map((t) => (
        <button
          key={t.key}
          type="button"
          aria-pressed={current === t.key}
          onClick={() => setOverride(t.key === "auto" ? null : (t.key as Faction))}
          className="game-tab px-2.5 py-1 text-xs"
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export const PRIVACY_NOTE =
  "We count visits anonymously (no cookies, no IP stored) and keep a log of searched character names (public game data) to improve the site.";

function Shell() {
  const { faction } = useFaction();
  const { pathname } = useLocation();
  useEffect(() => trackHit(pathname), [pathname]);
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-[color-mix(in_srgb,var(--metal)_40%,var(--border-soft))] bg-bg/90 shadow-[0_6px_18px_-10px_rgb(0_0_0/0.6)] backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5">
          <NavLink to="/" className="flex items-center gap-2 text-gold no-underline" aria-label="Become Cube home">
            <FactionEmblem faction={faction} size={30} className="drop-shadow-[0_0_6px_rgb(var(--ether)/0.6)]" />
            <span className="font-display text-[18px] font-bold tracking-wider">Become Cube</span>
          </NavLink>
          <nav aria-label="Main" className="flex flex-wrap gap-1.5">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={cn("game-tab px-3 py-1.5 text-sm font-medium no-underline")}>
                {n.label}
              </NavLink>
            ))}
          </nav>
          {isMockEngine && (
            <span className="ml-auto rounded border border-warn/50 bg-warn/10 px-2.5 py-0.5 text-xs text-warn" title="VITE_ENGINE=mock">
              mock data
            </span>
          )}
        </div>
        <div aria-hidden className="h-px bg-gradient-to-r from-transparent via-[var(--metal)] to-transparent opacity-70" />
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <Outlet />
      </main>
      <footer className="px-4 pb-6 pt-2 text-center text-xs text-faint">
        <div aria-hidden className="mx-auto mb-4 h-px max-w-6xl bg-gradient-to-r from-transparent via-[var(--metal)] to-transparent opacity-60" />
        {DISCLAIMER}
        <details className="mx-auto mt-2 max-w-xl">
          <summary className="cursor-pointer text-faint hover:text-foreground">Privacy</summary>
          <p className="mt-1.5 text-dim">{PRIVACY_NOTE}</p>
        </details>
        <ThemePicker />
      </footer>
    </div>
  );
}

export function Layout() {
  return (
    <FactionThemeProvider>
      <Shell />
    </FactionThemeProvider>
  );
}

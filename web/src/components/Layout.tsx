import { useEffect, useRef } from "react";
import { NavLink, Outlet, useLocation, useNavigationType } from "react-router-dom";
import { trackHit } from "@/lib/analytics";
import { isMockEngine } from "@/engine/api";
import { BrandCrest } from "@/components/ui/brand-crest";
import "./site-footer.css";
import { FactionThemeProvider, useFaction, type Faction } from "@/components/game/faction";
import { SiteNavigation } from "./SiteNavigation";
import { NAVIGATION_GROUPS } from "./navigation";
import { NavigationLink } from "./NavigationLink";
import { TimerStrip } from "@/features/timers/TimerStrip";

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
  "We count visits anonymously (no cookies, no IP stored). Characters you look up appear on the public Board with their public armory info (name, class, server, level, Combat Power); the max-potential DPS shown there is an unverified estimate from the visitor's browser.";

function Shell() {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();
  const previousPath = useRef(pathname);
  useEffect(() => trackHit(pathname), [pathname]);
  useEffect(() => {
    if (previousPath.current !== pathname && navigationType !== "POP") {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }
    previousPath.current = pathname;
  }, [pathname, navigationType]);
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-[color-mix(in_srgb,var(--metal)_40%,var(--border-soft))] bg-bg/90 shadow-[0_6px_18px_-10px_rgb(0_0_0/0.6)] backdrop-blur">
        <div className="site-header-bar">
          <NavLink to="/" className="brand-home flex items-center gap-2 text-gold no-underline" aria-label="Become Cube home">
            <BrandCrest />
            <span className="font-display text-[18px] font-bold tracking-wider">Become Cube</span>
          </NavLink>
          <SiteNavigation />
          {isMockEngine && (
            <span className="rounded border border-warn/50 bg-warn/10 px-2.5 py-0.5 text-xs text-warn" title="VITE_ENGINE=mock">
              mock data
            </span>
          )}
        </div>
        <TimerStrip />
        <div aria-hidden className="h-px bg-gradient-to-r from-transparent via-[var(--metal)] to-transparent opacity-70" />
      </header>
      <main className="relative z-10 mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <Outlet />
      </main>
      <footer className="site-footer">
        <div className="site-footer-inner">
          <div className="site-footer-grid">
            <div>
              <NavLink to="/" className="site-footer-brand"><BrandCrest /><span>Become Cube</span></NavLink>
              <p className="site-footer-description">Your character. Your build. Your next step.</p>
            </div>
            {NAVIGATION_GROUPS.map((group, index) => (
              <nav key={group.label} aria-label={["Footer build tools", "Footer guides", "Footer community"][index]}>
                <h2>{group.label}</h2>
                {group.label === "Plan" && <NavLink to="/guide">Start here</NavLink>}
                {group.items.map((item) => (
                  <NavigationLink key={item.to} item={item} />
                ))}
                {group.label === "World" && <>
                  <NavLink to="/board">Board</NavLink>
                  <NavLink to="/maps">Map resources and legacy pins</NavLink>
                </>}
              </nav>
            ))}
          </div>
          <div className="site-footer-bottom"><p>{DISCLAIMER}</p><ThemePicker /></div>
          <details className="site-footer-privacy"><summary>Privacy</summary><p>{PRIVACY_NOTE}</p></details>
        </div>
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

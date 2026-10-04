import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Faction = "neutral" | "asmodian" | "elyos";

/** Armory raceId 1 = Elyos, 2 = Asmodians; raceName is "Elyos" / "Asmodians". Anything else = neutral. */
export function factionOf(race: string | number | null | undefined): Faction {
  if (race == null) return "neutral";
  const r = String(race).trim().toLowerCase();
  if (r === "2" || r.startsWith("asmo")) return "asmodian";
  if (r === "1" || r.startsWith("elyo")) return "elyos";
  return "neutral";
}

const OVERRIDE_KEY = "aion2c.faction-override";

interface Ctx {
  /** theme actually applied */
  faction: Faction;
  /** from the active character (null on pages without one) */
  fromCharacter: Faction | null;
  setFromCharacter: (f: Faction | null) => void;
  override: Faction | null;
  setOverride: (f: Faction | null) => void;
}

const FactionContext = createContext<Ctx>({ faction: "neutral", fromCharacter: null, setFromCharacter: () => {}, override: null, setOverride: () => {} });

function loadOverride(): Faction | null {
  try {
    const v = localStorage.getItem(OVERRIDE_KEY);
    return v === "asmodian" || v === "elyos" || v === "neutral" ? v : null;
  } catch {
    return null;
  }
}

/** Sets <html data-faction> from the active character (auto) unless the visitor picked a theme in the footer. */
export function FactionThemeProvider({ children }: { children: ReactNode }) {
  const [fromCharacter, setFromCharacter] = useState<Faction | null>(null);
  const [override, setOverrideState] = useState<Faction | null>(loadOverride);
  const faction: Faction = override ?? fromCharacter ?? "neutral";
  useEffect(() => {
    document.documentElement.dataset.faction = faction;
    const meta = document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute("content", faction === "elyos" ? "#070d1f" : faction === "asmodian" ? "#0e0810" : "#0a1224");
  }, [faction]);
  const value = useMemo<Ctx>(
    () => ({
      faction,
      fromCharacter,
      setFromCharacter,
      override,
      setOverride: (f) => {
        setOverrideState(f);
        try {
          if (f) localStorage.setItem(OVERRIDE_KEY, f);
          else localStorage.removeItem(OVERRIDE_KEY);
        } catch {
          /* private mode: the choice just lasts for this visit */
        }
      },
    }),
    [faction, fromCharacter, override],
  );
  return <FactionContext.Provider value={value}>{children}</FactionContext.Provider>;
}

export function useFaction() {
  return useContext(FactionContext);
}

/** Call from a character page: applies that character's faction theme while mounted. */
export function useCharacterFaction(race: string | number | null | undefined) {
  const { setFromCharacter } = useFaction();
  const f = race == null ? null : factionOf(race);
  useEffect(() => {
    setFromCharacter(f);
    return () => setFromCharacter(null);
  }, [f, setFromCharacter]);
}

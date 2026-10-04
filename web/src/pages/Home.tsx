import { useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, GitCompareArrows, Network, Wrench, X } from "lucide-react";
import { LogoCloud } from "@/components/ui/logo-cloud-2";
import RuixenMoonChat, { type MoonQuickAction } from "@/components/ui/ruixen-moon-chat";
import { ClassEmblem } from "@/components/game/ClassEmblem";
import { SectionTitle } from "@/components/game/SectionTitle";
import { SearchBox } from "@/features/build/SearchBox";
import { characterPath, clearRecent, loadRecent } from "@/features/build/helpers";
import { useAsync } from "@/hooks/useAsync";
import { listClasses } from "@/engine/api";
import { ARMORY_REGIONS } from "@/lib/armory";

const regionName = (code: string) => ARMORY_REGIONS.find((r) => r.code === code)?.name ?? code.toUpperCase();
const CLASS_ART_POSITION: Record<string, string> = {
  gladiator: "50% 0%", templar: "50% 0%", assassin: "50% 15%", ranger: "50% 5%",
  sorcerer: "50% 10%", spiritmaster: "50% 10%", cleric: "50% 10%", chanter: "50% 12%",
};
const QUICK_ACTIONS: readonly MoonQuickAction[] = [
  { label: "Start here", href: "/guide", icon: <BookOpen className="size-4" />, featured: true },
  { label: "Build by hand", href: "/build", icon: <Wrench className="size-4" /> },
  { label: "Compare", href: "/compare", icon: <GitCompareArrows className="size-4" /> },
  { label: "Daevanion", href: "/daevanion", icon: <Network className="size-4" /> },
];

function Recent() {
  const [items, setItems] = useState(loadRecent);
  if (items.length === 0) return null;
  return (
    <div className="home-recent mt-5" aria-label="Recent searches">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-sans text-xs font-medium text-dim">Recent searches</h2>
        <button
          type="button"
          aria-label="Clear recent searches"
          title="Clear recent searches"
          onClick={() => {
            clearRecent();
            setItems([]);
          }}
          className="home-recent-clear"
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      </div>
      <ul className="flex flex-wrap gap-2">
        {items.map((r) => (
          <li key={`${r.name}-${r.serverId}`}>
            <Link
              to={characterPath(r)}
              className="home-recent-link"
            >
              <strong className="font-medium">{r.name}</strong>
              <span className="text-xs text-dim">
                {r.serverName} - {regionName(r.region)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Home() {
  const classes = useAsync(() => listClasses(), []);
  return (
    <div className="original-home-page">
      <RuixenMoonChat
        title="Become Cube"
        description="Import a character from the official armory and find your best Aion 2 build."
        actions={QUICK_ACTIONS}
        recent={<Recent />}
      >
        <SearchBox />
      </RuixenMoonChat>

      <section aria-labelledby="classes-h" className="mb-8">
        <SectionTitle id="classes-h" caption="Pick a class, enter level and stats, get the same analysis.">
          No character? Build one by hand
        </SectionTitle>
        {classes.error && <p className="text-sm text-error">{classes.error}</p>}
        <LogoCloud
          className="mx-auto max-w-3xl"
          aria-label="Classes"
          loading={classes.loading}
          items={(classes.data ?? []).map((c) => ({
            id: c.key,
            title: c.name,
            href: `/build?class=${c.key}`,
            logo: {
              src: `/brand/classes/${c.key}-640.webp`,
              srcSet: `/brand/classes/${c.key}-320.webp 320w, /brand/classes/${c.key}-640.webp 640w`,
              sizes: "110px",
              objectPosition: CLASS_ART_POSITION[c.key] ?? "50% 0%",
              alt: "",
              width: 640,
              height: 640,
            },
            fallback: <ClassEmblem classKey={c.key} size={40} />,
          }))}
        />
      </section>
    </div>
  );
}

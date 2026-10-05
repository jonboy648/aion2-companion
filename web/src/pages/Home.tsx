import { useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, GitCompareArrows, Megaphone, Network, Wrench, X } from "lucide-react";
import { LogoCloud } from "@/components/ui/logo-cloud-2";
import RuixenMoonChat, { type MoonQuickAction } from "@/components/ui/ruixen-moon-chat";
import { ClassEmblem } from "@/components/game/ClassEmblem";
import { SearchBox } from "@/features/build/SearchBox";
import { characterPath, clearRecent, loadRecent } from "@/features/build/helpers";
import { useAsync } from "@/hooks/useAsync";
import { listClasses } from "@/engine/api";
import { ARMORY_REGIONS } from "@/lib/armory";

const regionName = (code: string) => ARMORY_REGIONS.find((r) => r.code === code)?.name ?? code.toUpperCase();
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
      <aside className="home-launch-banner" aria-label="Launch announcement">
        <Megaphone size={16} aria-hidden />
        <p><strong>Become Cube goes live tonight.</strong><span> Our Aion 2 companion is opening to the community.</span></p>
        <Link to="/guide">Start here <BookOpen size={14} aria-hidden /></Link>
      </aside>
      <RuixenMoonChat
        title="Become Cube"
        description="Import a character from the official armory and find your best Aion 2 build."
        actions={QUICK_ACTIONS}
        recent={<Recent />}
      >
        <SearchBox />
      </RuixenMoonChat>

      <section aria-labelledby="classes-h" className="home-classes mb-8">
        <div className="home-class-heading"><div>
          <h2 id="classes-h">No character? Build one by hand</h2>
          <p>Pick a class, enter level and stats, get the same analysis.</p>
        </div><span>8 classes</span></div>
        {classes.error && <p className="text-sm text-error">{classes.error}</p>}
        <LogoCloud
          shaderCaptions
          className="home-class-cards"
          aria-label="Classes"
          loading={classes.loading}
          items={(classes.data ?? []).map((c) => ({
            id: c.key,
            title: c.name,
            href: `/build?class=${c.key}`,
            logo: {
                src: `/brand/classes/${c.key}-cutout.png`,
                objectPosition: "50% 100%",
              alt: "",
              width: 1254,
              height: 1254,
            },
            fallback: <ClassEmblem classKey={c.key} size={40} />,
          }))}
        />
      </section>
    </div>
  );
}

import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Gem, X } from "lucide-react";
import { AuroraBackground } from "@/components/fancy/aurora-background";
import { SpotlightCard } from "@/components/fancy/spotlight-card";
import { Badge } from "@/components/ui/badge";
import { ClassEmblem } from "@/components/game/ClassEmblem";
import { OrnateDivider, WingMark } from "@/components/game/Ornaments";
import { SectionTitle } from "@/components/game/SectionTitle";
import { SearchBox } from "@/features/build/SearchBox";
import { ROLE_LABEL, characterPath, clearRecent, loadRecent } from "@/features/build/helpers";
import { useAsync } from "@/hooks/useAsync";
import { listClasses } from "@/engine/api";
import { ARMORY_REGIONS } from "@/lib/armory";

const regionName = (code: string) => ARMORY_REGIONS.find((r) => r.code === code)?.name ?? code.toUpperCase();

function Recent() {
  const [items, setItems] = useState(loadRecent);
  if (items.length === 0) return null;
  return (
    <div className="mt-5" aria-label="Recent searches">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-display text-xs font-semibold uppercase tracking-widest text-faint">Recent searches</h2>
        <button
          type="button"
          onClick={() => {
            clearRecent();
            setItems([]);
          }}
          className="inline-flex items-center gap-1 text-xs text-faint hover:text-foreground"
        >
          <X className="size-3" /> Clear
        </button>
      </div>
      <ul className="flex flex-wrap gap-2">
        {items.map((r) => (
          <li key={`${r.name}-${r.serverId}`}>
            <Link
              to={characterPath(r)}
              className="inline-flex items-center gap-2 game-chip rounded-md border border-[var(--metal-lo)] bg-surface2 px-3 py-1.5 text-sm text-foreground no-underline transition-colors hover:border-[var(--metal-hi)] hover:text-gold"
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
    <>
      <AuroraBackground className="mb-8">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-6 -z-0 hidden justify-between px-6 text-[var(--metal)] opacity-25 sm:flex">
          <WingMark className="!h-28 !w-60" />
          <WingMark flip className="!h-28 !w-60" />
        </div>
        <div className="relative mx-auto max-w-3xl px-4 py-10 text-center sm:py-16">
          <Badge tone="gold" className="mb-4">
            <Gem className="mr-1.5 size-3" /> Free Aion 2 build companion
          </Badge>
          <h1 className="text-3xl font-bold leading-tight tracking-wide sm:text-[2.6rem]">
            Find your best <span className="ether-text">Aion 2 build</span>
          </h1>
          <OrnateDivider className="mx-auto mt-4 max-w-xs" />
          <p className="mx-auto mt-3 max-w-xl text-sm text-dim sm:text-base">
            Import a character from the official armory and compare boss, AoE, leveling and burst playstyles: stigmas, rotation, Daevanion and your next stat upgrades.
          </p>
          <Link to="/guide" className="game-btn mt-4 h-9 px-4 text-gold no-underline" data-variant="secondary">
            New to Aion 2? Start here <ArrowRight className="size-3.5" />
          </Link>
          <div className="mx-auto mt-7 max-w-2xl text-left">
            <SearchBox />
            <Recent />
          </div>
        </div>
      </AuroraBackground>

      <section aria-labelledby="classes-h" className="mb-8">
        <SectionTitle id="classes-h" caption="Pick a class, enter level and stats, get the same analysis.">
          No character? Build one by hand
        </SectionTitle>
        {classes.error && <p className="text-sm text-error">{classes.error}</p>}
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {classes.loading &&
            Array.from({ length: 8 }, (_, i) => <li key={i} className="ornate h-24 animate-pulse motion-reduce:animate-none" />)}
          {classes.data?.map((c) => {
            return (
              <li key={c.key}>
                <Link to={`/build?class=${c.key}`} aria-label={c.name} className="block no-underline">
                  <SpotlightCard className="h-full">
                    <div className="flex items-center gap-3 p-4">
                      <ClassEmblem classKey={c.key} size={48} />
                      <span className="min-w-0">
                        <span className="block truncate font-display font-bold tracking-wide text-foreground">{c.name}</span>
                        <span className="text-xs text-dim">{ROLE_LABEL[c.role]}</span>
                      </span>
                    </div>
                  </SpotlightCard>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}

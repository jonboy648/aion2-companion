import { useState } from "react";
import { Link } from "react-router-dom";
import { Crosshair, Gem, HeartPulse, Music, Shield, Sparkles, Sword, Swords, WandSparkles, X, type LucideIcon } from "lucide-react";
import { AuroraBackground } from "@/components/fancy/aurora-background";
import { SpotlightCard } from "@/components/fancy/spotlight-card";
import { Badge } from "@/components/ui/badge";
import { SearchBox } from "@/features/build/SearchBox";
import { ROLE_LABEL, characterPath, clearRecent, loadRecent } from "@/features/build/helpers";
import { useAsync } from "@/hooks/useAsync";
import { listClasses } from "@/engine/api";
import { ARMORY_REGIONS } from "@/lib/armory";

const CLASS_ICON: Record<string, LucideIcon> = {
  gladiator: Swords,
  templar: Shield,
  assassin: Sword,
  ranger: Crosshair,
  sorcerer: WandSparkles,
  spiritmaster: Sparkles,
  cleric: HeartPulse,
  chanter: Music,
};

const regionName = (code: string) => ARMORY_REGIONS.find((r) => r.code === code)?.name ?? code.toUpperCase();

function Recent() {
  const [items, setItems] = useState(loadRecent);
  if (items.length === 0) return null;
  return (
    <div className="mt-5" aria-label="Recent searches">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-faint">Recent searches</h2>
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
              className="inline-flex items-center gap-2 rounded-full border border-border bg-bg/60 px-3 py-1.5 text-sm text-foreground no-underline transition-colors hover:border-gold hover:text-gold"
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
        <div className="mx-auto max-w-3xl px-4 py-10 text-center sm:py-16">
          <Badge tone="gold" className="mb-4">
            <Gem className="mr-1.5 size-3" /> Free Aion 2 build companion
          </Badge>
          <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Find your best <span className="bg-gradient-to-r from-gold-lo via-gold-hi to-gold bg-clip-text text-transparent">Aion 2 build</span>
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-dim sm:text-base">
            Import a character from the official armory and compare boss, AoE, leveling and burst playstyles: stigmas, rotation, Daevanion and your next stat upgrades.
          </p>
          <div className="mx-auto mt-7 max-w-2xl text-left">
            <SearchBox />
            <Recent />
          </div>
        </div>
      </AuroraBackground>

      <section aria-labelledby="classes-h" className="mb-8">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2 border-l-4 border-gold pl-3">
          <div>
            <h2 id="classes-h" className="text-xl font-semibold">
              No character? Build one by hand
            </h2>
            <p className="text-sm text-dim">Pick a class, enter level and stats, get the same analysis.</p>
          </div>
        </div>
        {classes.error && <p className="text-sm text-error">{classes.error}</p>}
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {classes.loading &&
            Array.from({ length: 8 }, (_, i) => <li key={i} className="h-24 animate-pulse rounded-lg border border-border-soft bg-surface motion-reduce:animate-none" />)}
          {classes.data?.map((c) => {
            const Icon = CLASS_ICON[c.key] ?? Sparkles;
            return (
              <li key={c.key}>
                <Link to={`/build?class=${c.key}`} aria-label={c.name} className="block no-underline">
                  <SpotlightCard className="h-full transition-colors hover:border-gold-lo">
                    <div className="flex items-center gap-3 p-4">
                      <span className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-gold-lo/60 bg-gold/10 text-gold">
                        <Icon className="size-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-foreground">{c.name}</span>
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

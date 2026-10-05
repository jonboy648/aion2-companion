import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { IconFrame, rarityOf } from "@/components/game/IconFrame";
import { OrnateCard } from "@/components/game/OrnateCard";
import { loadSets } from "./data";
import { catLabel, iconUrl, type ItemSet } from "./logic";
import "./items.css";

/** /items/sets: every item set with its piece bonuses and member items. */
export function SetsView() {
  const [state, setState] = useState<{ sets: ItemSet[] | null; error: string | null }>({ sets: null, error: null });
  useEffect(() => {
    let live = true;
    loadSets().then(
      (sets) => live && setState({ sets, error: null }),
      (e: unknown) => live && setState({ sets: null, error: e instanceof Error ? e.message : String(e) }),
    );
    return () => {
      live = false;
    };
  }, []);
  if (state.error) return <p role="alert" className="text-sm text-warn">Could not load item sets: {state.error}</p>;
  if (!state.sets) return <p className="text-sm text-dim">Loading item sets...</p>;
  return (
    <div className="space-y-5">
      {state.sets.map((s) => (
        <OrnateCard key={s.key} className="p-4">
          <h2 className="font-display text-xl font-semibold">{s.name}</h2>
          <p className="text-xs text-dim">{s.type} set - {s.items.length} items</p>
          <ul className="mt-3 space-y-1 text-sm">
            {s.bonuses.map((b) => (
              <li key={b.pieces}>
                <span className="font-semibold text-gold">{b.pieces} pieces</span> {b.text}
              </li>
            ))}
          </ul>
          <ul className="mt-3 flex flex-wrap gap-2">
            {s.items.map((i) => (
              <li key={i.id}>
                <Link to={`/items/${i.id}`} title={`${i.n} (${catLabel(i.cat)})`} className="block no-underline">
                  <IconFrame url={iconUrl(i.i)} name={i.n} size={40} rarity={rarityOf(i.g)} alt={i.n} />
                </Link>
              </li>
            ))}
          </ul>
        </OrnateCard>
      ))}
    </div>
  );
}

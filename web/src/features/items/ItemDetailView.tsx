import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { IconFrame, rarityOf } from "@/components/game/IconFrame";
import { OrnateCard } from "@/components/game/OrnateCard";
import { loadItem, loadSets, type ItemPage } from "./data";
import { GradeText } from "./ItemTable";
import { atEnchant, catLabel, fmtNum, groupOfCat, iconUrl, statLabel, type EnchantTables, type ItemDetail, type ItemRow, type ItemSet, type Stat } from "./logic";

const pct = (n: number) => `${fmtNum(n)}%`;

/** "446 - 604" for a min/max attack line, else the number. */
const range = (lo: number | undefined, hi: number) => (lo !== undefined && lo !== hi ? `${fmtNum(lo)} - ${fmtNum(hi)}` : fmtNum(hi));

function mainRows(item: ItemDetail, enchant: EnchantTables) {
  const series = item.enchant_group ? enchant.series[item.enchant_group] : undefined;
  return item.main.map((s) => {
    const bonus = series?.[s.id];
    return {
      id: s.id,
      base: range(s.min, s.v),
      max: bonus && item.max_enchant ? range(s.min === undefined ? undefined : atEnchant(s.min, bonus, item.max_enchant), atEnchant(s.v, bonus, item.max_enchant)) : null,
    };
  });
}

function EnchantTable({ item, enchant }: { item: ItemDetail; enchant: EnchantTables }) {
  const series = item.enchant_group ? enchant.series[item.enchant_group] : undefined;
  const odds = item.odds_group ? enchant.odds[item.odds_group] : undefined;
  if (!item.max_enchant) return null;
  const stats = item.main.filter((s) => series?.[s.id]);
  return (
    <details className="ornate p-4">
      <summary className="cursor-pointer font-display text-lg font-semibold">Enchant +1 to +{item.max_enchant}</summary>
      <div className="mt-3 max-h-[60vh] overflow-auto rounded-md border border-border-soft">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wider text-faint">
            <tr>
              <th scope="col" className="px-2 py-1.5">Level</th>
              {stats.map((s) => (
                <th key={s.id} scope="col" className="px-2 py-1.5 text-right">{statLabel(s.id)}</th>
              ))}
              {odds && <th scope="col" className="px-2 py-1.5 text-right">Success chance</th>}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: item.max_enchant }, (_, i) => i + 1).map((lv) => (
              <tr key={lv} className="border-t border-border-soft">
                <td className="px-2 py-1 tabular-nums">+{lv}</td>
                {stats.map((s) => (
                  <td key={s.id} className="px-2 py-1 text-right tabular-nums">
                    {range(s.min === undefined ? undefined : atEnchant(s.min, series![s.id], lv), atEnchant(s.v, series![s.id], lv))}
                  </td>
                ))}
                {odds && <td className="px-2 py-1 text-right tabular-nums text-dim">{odds[lv - 1] === undefined ? "" : pct(odds[lv - 1])}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!series && <p className="mt-2 text-xs text-dim">Per-level stats are not in our data for this item.</p>}
      {odds && <p className="mt-2 text-xs text-dim">Success chance is the client's chance of going from the previous level to this one.</p>}
    </details>
  );
}

function ExceedTable({ item, enchant }: { item: ItemDetail; enchant: EnchantTables }) {
  const ex = item.exceed_group ? enchant.exceed[item.exceed_group] : undefined;
  if (!ex) return null;
  const ids = [...new Set(ex.levels.flatMap((l) => Object.keys(l)))];
  return (
    <details className="ornate p-4">
      <summary className="cursor-pointer font-display text-lg font-semibold">Exceed +1 to +{ex.levels.length}</summary>
      <div className="mt-3 overflow-x-auto rounded-md border border-border-soft">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wider text-faint">
            <tr>
              <th scope="col" className="px-2 py-1.5">Level</th>
              {ids.map((id) => (
                <th key={id} scope="col" className="whitespace-nowrap px-2 py-1.5 text-right">{statLabel(id)}</th>
              ))}
              <th scope="col" className="whitespace-nowrap px-2 py-1.5 text-right">Success chance</th>
            </tr>
          </thead>
          <tbody>
            {ex.levels.map((l, i) => (
              <tr key={i} className="border-t border-border-soft">
                <td className="px-2 py-1 tabular-nums">+{i + 1}</td>
                {ids.map((id) => (
                  <td key={id} className="px-2 py-1 text-right tabular-nums">{l[id] === undefined ? "" : fmtNum(l[id])}</td>
                ))}
                <td className="px-2 py-1 text-right tabular-nums text-dim">{ex.odds[i] === undefined ? "" : pct(ex.odds[i])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function RandomStats({ item }: { item: ItemDetail }) {
  if (!item.subs.length) return null;
  const total = item.subs.reduce((n, s) => n + (s.w ?? 0), 0);
  const chance = (s: Stat) => (s.w && total ? `${fmtNum(Math.round((s.w / total) * 1000) / 10)}%` : "");
  return (
    <OrnateCard className="p-4">
      <h2 className="font-display text-lg font-semibold">{item.sub_random ? "Random stats" : "Extra stats"}</h2>
      <p className="mt-1 text-sm text-dim">
        {item.sub_random
          ? `${item.sub_count ? `Rolls ${item.sub_count} lines` : "Rolls lines"} from this pool when the item binds. Each line's value falls in the range shown.`
          : "Fixed lines on this item."}
      </p>
      <div className="mt-3 overflow-x-auto rounded-md border border-border-soft">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wider text-faint">
            <tr>
              <th scope="col" className="px-2 py-1.5">Stat</th>
              <th scope="col" className="px-2 py-1.5 text-right">Range</th>
              {total > 0 && <th scope="col" className="px-2 py-1.5 text-right" title="Weight in the pool">Pool weight</th>}
            </tr>
          </thead>
          <tbody>
            {item.subs.map((s, i) => (
              <tr key={`${s.id}-${i}`} className="border-t border-border-soft">
                <td className="px-2 py-1">{statLabel(s.id)}</td>
                <td className="whitespace-nowrap px-2 py-1 text-right tabular-nums">{range(s.min, s.v)}</td>
                {total > 0 && <td className="px-2 py-1 text-right tabular-nums text-dim">{chance(s)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </OrnateCard>
  );
}

export function ItemBody({ page }: { page: Extract<ItemPage, { kind: "gear" }> }) {
  const { item, cat, enchant } = page;
  const group = groupOfCat(cat);
  const rows = mainRows(item, enchant);
  const hasMax = rows.some((r) => r.max);
  return (
    <>
      <p className="mb-4 text-sm text-dim">
        <Link to="/items">Items</Link>
        {group && (
          <>
            {" / "}
            <Link to={`/items/${group.key}`}>{group.label}</Link>
          </>
        )}
        {" / "}
        <Link to={`/items/${cat}`}>{catLabel(cat)}</Link>
      </p>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div className="space-y-5">
          <OrnateCard className="p-4">
            <div className="flex items-center gap-3">
              <IconFrame url={iconUrl(item.icon)} fallbackUrl={iconUrl(item.icon_alt)} name={item.name} size={64} rarity={rarityOf(item.grade)} eager alt="" />
              <div className="min-w-0">
                <div className="text-sm">
                  <GradeText grade={item.grade} className="font-semibold" /> {catLabel(cat).toLowerCase()}
                </div>
                <div className="text-xs text-dim">
                  Item level {item.il} - needs level {item.equip_level}
                  {item.class_lock.length ? ` - ${item.class_lock.join(", ")} only` : ""}
                </div>
              </div>
            </div>
            <h2 className="mt-4 font-display text-lg font-semibold">Stats</h2>
            <div className="mt-1 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wider text-faint">
                  <tr>
                    <th scope="col" className="py-1 pr-2">Stat</th>
                    <th scope="col" className="px-2 py-1 text-right">+0</th>
                    {hasMax && <th scope="col" className="py-1 pl-2 text-right">+{item.max_enchant}</th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t border-border-soft">
                      <td className="py-1 pr-2">{statLabel(r.id)}</td>
                      <td className="whitespace-nowrap px-2 py-1 text-right tabular-nums">{r.base}</td>
                      {hasMax && <td className="whitespace-nowrap py-1 pl-2 text-right tabular-nums text-gold">{r.max ?? ""}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
              <dt className="text-dim">Max enchant</dt>
              <dd className="text-right tabular-nums">{item.max_enchant ? `+${item.max_enchant}` : "None"}</dd>
              {item.max_exceed ? (
                <>
                  <dt className="text-dim">Max exceed</dt>
                  <dd className="text-right tabular-nums">+{item.max_exceed}</dd>
                </>
              ) : null}
              {item.mana_slots ? (
                <>
                  <dt className="text-dim">Mana stone slots</dt>
                  <dd className="text-right tabular-nums">{item.mana_slots}</dd>
                </>
              ) : null}
              {item.god_slots ? (
                <>
                  <dt className="text-dim">God stone slots</dt>
                  <dd className="text-right tabular-nums">{item.god_slots}</dd>
                </>
              ) : null}
            </dl>
            <h2 className="mt-4 font-display text-lg font-semibold">Where to get it</h2>
            {item.sources.length ? (
              <ul className="mt-1 flex flex-wrap gap-1.5">
                {item.sources.map((s) => (
                  <li key={s} className="rounded border border-border-soft px-2 py-0.5 text-sm">{s}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-dim">No source listed.</p>
            )}
            <Link to={`/gear-viewer?pin=${item.id}`} className="game-tab mt-4 inline-block px-3 py-1.5 text-sm no-underline">
              Compare in the gear viewer
            </Link>
          </OrnateCard>
        </div>
        <div className="min-w-0 space-y-5">
          {item.set && <SetCard setKey={item.set} />}
          <RandomStats item={item} />
          <EnchantTable item={item} enchant={enchant} />
          <ExceedTable item={item} enchant={enchant} />
        </div>
      </div>
    </>
  );
}

function Crumbs({ cat }: { cat: string }) {
  const group = groupOfCat(cat);
  return (
    <p className="mb-4 text-sm text-dim">
      <Link to="/items">Items</Link>
      {group && (
        <>
          {" / "}
          <Link to={`/items/${group.key}`}>{group.label}</Link>
        </>
      )}
      {" / "}
      <Link to={`/items/${cat}`}>{catLabel(cat)}</Link>
    </p>
  );
}

/** Consumables, materials and currency: what the client tells us is a name, grade, level, icon and description. */
export function MiscBody({ row, cat }: { row: ItemRow; cat: string }) {
  return (
    <>
      <Crumbs cat={cat} />
      <OrnateCard className="max-w-xl p-4">
        <div className="flex items-center gap-3">
          <IconFrame url={iconUrl(row.i)} name={row.n} size={64} rarity={rarityOf(row.g)} eager alt="" />
          <div className="min-w-0">
            <div className="text-sm">
              <GradeText grade={row.g} className="font-semibold" /> {catLabel(cat).toLowerCase()}
            </div>
            <div className="text-xs text-dim">{row.el > 1 ? `Needs level ${row.el}` : "No level requirement"}</div>
          </div>
        </div>
        <h2 className="mt-4 font-display text-lg font-semibold">Description</h2>
        <p className="mt-1 whitespace-pre-line text-sm">{row.d || "No description in the client data."}</p>
        {row.d?.includes("…") && <p className="mt-2 text-xs text-dim">… marks a number the client works out from skill tables, which we do not show yet.</p>}
      </OrnateCard>
    </>
  );
}

/** The set an item belongs to, with its bonuses. */
function SetCard({ setKey }: { setKey: string }) {
  const [set, setSet] = useState<ItemSet | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    loadSets().then(
      (all) => live && setSet(all.find((s) => s.key === setKey) ?? null),
      () => live && setSet(null),
    );
    return () => {
      live = false;
    };
  }, [setKey]);
  if (!set) return null;
  return (
    <OrnateCard className="p-4">
      <h2 className="font-display text-lg font-semibold">Set: {set.name}</h2>
      <ul className="mt-2 space-y-1 text-sm">
        {set.bonuses.map((b) => (
          <li key={b.pieces}>
            <span className="font-semibold text-gold">{b.pieces} pieces</span> {b.text}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-dim">
        {set.items.length} items in this set. <Link to="/items/sets">All item sets</Link>
      </p>
    </OrnateCard>
  );
}

/** /items/:id */
export function ItemDetailView({ id }: { id: number }) {
  const [state, setState] = useState<{ id: number; page: ItemPage | null; error: string | null } | null>(null);
  useEffect(() => {
    let live = true;
    loadItem(id).then(
      (page) => live && setState({ id, page, error: null }),
      (e: unknown) => live && setState({ id, page: null, error: e instanceof Error ? e.message : String(e) }),
    );
    return () => {
      live = false;
    };
  }, [id]);
  const cur = state && state.id === id ? state : null;
  const p = cur?.page;
  const name = p ? (p.kind === "gear" ? p.item.name : p.row.n) : "";
  useEffect(() => {
    if (p) document.title = `${name} (${p.kind === "gear" ? p.item.grade : p.row.g} ${catLabel(p.cat)}) | Become Cube`;
  }, [p, name]);
  return (
    <>
      <PageHeader title={p ? name : "Item"} />
      {!cur ? (
        <p className="text-sm text-dim">Loading item...</p>
      ) : cur.error ? (
        <p role="alert" className="text-sm text-warn">Could not load this item: {cur.error}</p>
      ) : cur.page ? (
        cur.page.kind === "gear" ? <ItemBody page={cur.page} /> : <MiscBody row={cur.page.row} cat={cur.page.cat} />
      ) : (
        <p className="text-sm text-dim">
          No item {id} in our data. <Link to="/items">Browse items</Link>
        </p>
      )}
    </>
  );
}

import { useEffect } from "react";
import { Link, NavLink, useParams } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { OrnateCard } from "@/components/game/OrnateCard";
import { ItemDetailView } from "@/features/items/ItemDetailView";
import { ItemList } from "@/features/items/ItemList";
import { INDEX, OTHER_TOTAL, TOTAL, resolveKey } from "@/features/items/logic";
import { SetsView } from "@/features/items/SetsView";
import { cn } from "@/lib/utils";
import { NotFoundPage } from "./NotFoundPage";

/** game-tab already styles aria-current="page", which NavLink sets on the active link */
const chip = "game-tab px-2.5 py-1 text-xs no-underline";

/** Category tree: each group heading links to the whole group, its categories sit under it as chips. */
function Tree() {
  return (
    <nav aria-label="Item categories" className="space-y-3">
      <NavLink to="/items" end className={chip}>
        All categories
      </NavLink>
      {INDEX.groups.map((g) => (
        <div key={g.key}>
          <h2 className="text-sm font-semibold">
            <NavLink to={`/items/${g.key}`} end className={({ isActive }) => cn("hover:text-gold no-underline", isActive && "text-gold")}>
              {g.label}
            </NavLink>
          </h2>
          {g.kind === "sets" ? (
            <p className="mt-1 text-xs text-faint">{g.count} sets with piece bonuses</p>
          ) : (
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {g.cats.map((c) => (
                <li key={c.key}>
                  <NavLink to={`/items/${c.key}`} className={chip}>
                    {c.label} <span className="text-faint">{c.count}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </nav>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-5 lg:grid-cols-[17rem_minmax(0,1fr)]">
      <aside>
        <OrnateCard className="p-4 lg:sticky lg:top-20">
          <Tree />
        </OrnateCard>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** /items, /items/:group, /items/:category and /items/:id. */
export function ItemsPage() {
  const { key } = useParams();
  const r = resolveKey(key);
  useEffect(() => {
    if (r.kind === "cat") document.title = `Aion 2 ${r.cat.label} items | Become Cube`;
    if (r.kind === "group") document.title = `Aion 2 ${r.group.label.toLowerCase()} | Become Cube`;
    if (r.kind === "sets") document.title = "Aion 2 item sets and set bonuses | Become Cube";
  }, [r]);

  if (r.kind === "unknown") return <NotFoundPage />;
  if (r.kind === "item") return <ItemDetailView id={r.id} />;
  const title = r.kind === "root" ? "Items" : r.kind === "sets" ? "Item sets" : r.kind === "group" ? r.group.label : r.cat.label;
  const caption =
    r.kind === "root"
      ? `${(TOTAL + OTHER_TOTAL).toLocaleString("en-US")} items from the game client: equipment, consumables, materials and sets. Pick a category, or search them all.`
      : r.kind === "sets"
        ? "Armor-style sets and their bonuses for wearing 2 or 4 pieces."
        : r.kind === "group"
        ? `${r.group.cats.reduce((n, c) => n + c.count, 0).toLocaleString("en-US")} items in ${r.group.label.toLowerCase()}.`
        : `${r.cat.count.toLocaleString("en-US")} items. Click a column to sort, click an item for its stats and random stat ranges.`;
  return (
    <>
      <PageHeader title={title} caption={caption}>
        <Link to="/gear-viewer" className="game-tab px-3 py-1.5 text-sm no-underline">
          Gear viewer
        </Link>
      </PageHeader>
      <Shell>
        {r.kind === "root" ? (
          <ItemList lazy caption="Search results across all items" />
        ) : r.kind === "sets" ? (
          <SetsView />
        ) : r.kind === "group" ? (
          <ItemList key={r.group.key} keys={r.group.cats.map((c) => c.key)} caption={`${r.group.label} items`} classFilter={r.group.key === "weapons"} />
        ) : (
          <ItemList key={r.cat.key} keys={[r.cat.key]} caption={`${r.cat.label} items`} classFilter={false} />
        )}
      </Shell>
    </>
  );
}

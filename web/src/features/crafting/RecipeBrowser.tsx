import { useMemo, useState } from "react";
import { Minus, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Recipe } from "@/lib/types";
import { cn } from "@/lib/utils";
import { clampQty, gradeColor, MAX_QTY, type QtyMap } from "./useCrafting";

function RecipeCard({
  recipe,
  qty,
  expand,
  onQty,
}: {
  recipe: Recipe;
  qty: number;
  expand: boolean;
  onQty: (n: number) => void;
}) {
  const mats = expand && recipe.base_materials.length > 0 ? recipe.base_materials : recipe.materials;
  const color = gradeColor(recipe.grade);
  const inList = qty > 0;
  return (
    <li
      className={cn(
        "ornate border-border-soft p-3.5 transition-colors",
        inList ? "border-gold-lo bg-surface2" : "border-border-soft hover:border-border",
      )}
    >
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[15px] font-semibold" style={{ color }}>
              {recipe.name}
            </h3>
            {recipe.output_qty > 1 && <span className="text-xs text-dim">x{recipe.output_qty}</span>}
          </div>
          <p className="mt-0.5 text-xs text-faint">
            {recipe.profession}
            {recipe.grade ? ` · ${recipe.grade}` : ""}
            {recipe.level != null ? ` · level ${recipe.level}` : ""}
            {recipe.item_level != null ? ` · item level ${recipe.item_level}` : ""}
          </p>
        </div>

        <div className="flex items-center gap-1.5" role="group" aria-label={`Quantity of ${recipe.name} to craft`}>
          <Button
            variant="secondary"
            size="icon"
            className="size-8"
            aria-label={`Fewer ${recipe.name}`}
            disabled={qty <= 0}
            onClick={() => onQty(qty - 1)}
          >
            <Minus />
          </Button>
          <input
            inputMode="numeric"
            aria-label={`${recipe.name} quantity`}
            value={qty}
            onChange={(e) => onQty(clampQty(Number(e.target.value.replace(/\D/g, ""))))}
            className="h-8 w-14 game-input text-center text-sm tabular-nums "
          />
          <Button variant={inList ? "secondary" : "default"} size="icon" className="size-8" aria-label={`More ${recipe.name}`} disabled={qty >= MAX_QTY} onClick={() => onQty(qty + 1)}>
            <Plus />
          </Button>
        </div>
      </div>

      <details className="group mt-2.5">
        <summary className="cursor-pointer select-none text-xs text-cyan marker:text-faint">
          {mats.length} {expand ? "base materials" : "materials"} per craft
        </summary>
        <ul className="mt-2 grid gap-x-4 gap-y-0.5 text-[13px] text-dim sm:grid-cols-2">
          {mats.map((m) => (
            <li key={m.item} className="flex justify-between gap-2 border-b border-border-soft/60 py-0.5">
              <span className="truncate">{m.item}</span>
              <span className="tabular-nums text-foreground">{m.qty}</span>
            </li>
          ))}
          {mats.length === 0 && <li className="text-faint">No material data for this recipe.</li>}
        </ul>
        {recipe.source_url && (
          <a href={recipe.source_url} target="_blank" rel="noreferrer noopener" className="mt-2 inline-block text-xs">
            Source
          </a>
        )}
      </details>
    </li>
  );
}

export function RecipeBrowser({
  recipes,
  qty,
  expand,
  onQty,
}: {
  recipes: Recipe[];
  qty: QtyMap;
  expand: boolean;
  onQty: (id: number, n: number) => void;
}) {
  const [q, setQ] = useState("");
  const [prof, setProf] = useState<string>("all");
  const professions = useMemo(() => [...new Set(recipes.map((r) => r.profession))].sort(), [recipes]);
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return recipes
      .filter((r) => prof === "all" || r.profession === prof)
      .filter((r) => !needle || r.name.toLowerCase().includes(needle) || r.materials.some((m) => m.item.toLowerCase().includes(needle)))
      .sort((a, b) => (b.item_level ?? 0) - (a.item_level ?? 0) || a.name.localeCompare(b.name));
  }, [recipes, q, prof]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="flex min-w-[200px] flex-1 items-center gap-2 game-input px-2.5 focus-within:border-gold">
          <Search aria-hidden className="size-4 text-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search recipes or materials"
            aria-label="Search recipes or materials"
            className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-faint"
          />
        </label>
        <div role="group" aria-label="Profession" className="flex flex-wrap gap-1.5">
          {["all", ...professions].map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={prof === p}
              onClick={() => setProf(p)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                prof === p ? "border-gold bg-gold/15 text-gold" : "border-border bg-surface2 text-dim hover:text-foreground",
              )}
            >
              {p === "all" ? "All" : p}
            </button>
          ))}
        </div>
      </div>
      <p className="mb-2 text-xs text-faint" aria-live="polite">
        {shown.length} of {recipes.length} recipes
      </p>
      <ul className="space-y-2.5">
        {shown.map((r) => (
          <RecipeCard key={r.id} recipe={r} qty={qty[String(r.id)] ?? 0} expand={expand} onQty={(n) => onQty(r.id, n)} />
        ))}
      </ul>
      {shown.length === 0 && <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-dim">No recipe matches "{q}".</p>}
    </div>
  );
}

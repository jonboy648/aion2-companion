import { SectionTitle } from "@/components/game/SectionTitle";
import { AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RecipeBrowser } from "@/features/crafting/RecipeBrowser";
import { ShoppingList } from "@/features/crafting/ShoppingList";
import { useCrafting } from "@/features/crafting/useCrafting";
import { ClassSelect } from "@/features/keybinds/ClassSelect";
import { useToolsClass } from "@/features/keybinds/useToolsClass";

export function CraftingPage() {
  const tc = useToolsClass();
  const c = useCrafting(tc.classKey);
  const recipeCount = Object.keys(c.state.qty).length;
  const err = tc.error ?? c.error;

  return (
    <>
      <PageHeader title="Crafting" caption="Browse recipes, add what you want to craft, and get one combined shopping checklist.">
        <ClassSelect classes={tc.classes} value={tc.classKey} onChange={tc.setClassKey} />
      </PageHeader>

      {err && (
        <div role="alert" className="mb-4 flex items-start gap-2.5 rounded-lg border border-error/40 bg-error/10 px-3.5 py-3 text-sm">
          <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-error" />
          <div>
            <p className="font-medium">Could not load recipes.</p>
            <p className="text-xs text-dim">{err}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
        <section aria-label="Recipes">
          <SectionTitle className="mb-3">Recipes</SectionTitle>
          {c.recipes === null && !err ? (
            <div className="space-y-2.5" aria-busy="true" aria-label="Loading recipes">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-24 animate-pulse ornate" />
              ))}
            </div>
          ) : c.recipes && c.recipes.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-dim">
              No crafting recipes are in the data for this class yet.
            </p>
          ) : c.recipes ? (
            <RecipeBrowser recipes={c.recipes} qty={c.state.qty} expand={c.state.expand} onQty={c.setQty} />
          ) : null}
        </section>

        <Card className="lg:sticky lg:top-20">
          <CardHeader>
            <CardTitle>Shopping list</CardTitle>
            <CardDescription>All materials for the recipes you added, summed. Ticks are remembered in this browser.</CardDescription>
          </CardHeader>
          <CardContent>
            <ShoppingList
              items={c.items}
              checked={c.checked}
              busy={c.listBusy}
              expand={c.state.expand}
              recipeCount={recipeCount}
              onToggle={c.toggleChecked}
              onExpand={c.setExpand}
              onClearChecked={c.clearChecked}
              onClearAll={c.clearAll}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}

export default CraftingPage;

"""Crafting helpers (P9). Pure functions over GameData.recipes; no Qt, no I/O."""
from aion2c.models import GameData, Recipe, RecipeMaterial


def sorc_recipes(gd: GameData) -> list[Recipe]:
    """Recipes relevant to a Sorcerer: sorc_relevant True or None (None = unverified, see `is_unverified`)."""
    return [r for r in gd.recipes if r.sorc_relevant is not False]


def is_unverified(r: Recipe) -> bool:
    """True when relevance to the Sorcerer is not established (sorc_relevant is None)."""
    return r.sorc_relevant is None


def shopping_list(gd: GameData, recipe_ids_qty: dict[int, int], expand: bool = True) -> list[RecipeMaterial]:
    """Sum materials for `qty` crafts of each recipe id.

    expand=True uses `base_materials` (falls back to `materials` when a recipe has none);
    expand=False uses `materials`. Merged by item name, sorted by name. Unknown ids and qty <= 0 are skipped.
    """
    by_id = {r.id: r for r in gd.recipes}
    totals: dict[str, int] = {}
    for rid, qty in recipe_ids_qty.items():
        r = by_id.get(int(rid))
        if r is None or qty <= 0:
            continue
        mats = (r.base_materials or r.materials) if expand else r.materials
        for m in mats:
            totals[m.item] = totals.get(m.item, 0) + m.qty * qty
    return [RecipeMaterial(item, q, None) for item, q in sorted(totals.items(), key=lambda kv: kv[0].lower())]


def search(gd: GameData, text: str) -> list[Recipe]:
    """Case-insensitive substring match on recipe name, output item or profession. Empty text = all."""
    t = text.strip().lower()
    if not t:
        return list(gd.recipes)
    return [
        r for r in gd.recipes
        if t in r.name.lower() or t in r.output_item.lower() or t in r.profession.lower()
    ]

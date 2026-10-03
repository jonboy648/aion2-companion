# Aion 2 crafting notes (fetched 2026-10-03)

## Professions (names conflict across sites)
- aion2hub / aion2kina calculator: Blacksmithing, Tailoring, Jewelcrafting, Alchemy, Cooking.
- metabot.gg / wikily.gg: Blacksmithing, Armorsmithing, Handicrafting, Alchemy, Cooking. Treated as the same five (Tailoring=Armorsmithing, Jewelcrafting=Handicrafting; inferred from overlapping product lists, not stated).
- aion2kina.com guide (300 levels, level-200 specialization, 4 professions) contradicts the rest and looks Aion-1 style. Not used.
- Sorcerer weapon is a spellbook/tome (Alchemy). Orbs are also Alchemy but are another mage weapon (likely Cleric/other; not verified for Sorcerer).

## Mechanics
- Unlock: upgrade/specialty quest appears at character level 10 (metabot), recommended at 45.
- Mastery 1-100 per profession. Novice 1-50 = 8,809 XP, Professional 51-100 = 82,680 more XP. At 50, take upgrade quest and craft a test item (Blacksmith: 6 Orichalcum Ingot + 3 Odyle); the reward lifts cap to 100.
- Each recipe has its own required proficiency. Higher gap vs recipe gives better success chance (search-engine summary, single source).
- XP per craft: NOT stated anywhere found.
- "Splendent" = proc variant (about 25% on helm note) when crafting the base item.
- Chain: Truth Spellbook (Common) -> Splendent Truth -> Artisan's Splendent Truth Spellbook -> Wise Dragon Lord Spellbook, with Magic Crystal x3, Refining Stones, Odyle.

## Sorcerer-relevant data captured (27 recipes, aion2hub.com direct components + expanded base)
- Spellbooks (Alchemy): Truth (Common) 3 direct; Lava Heart Tome, True Genesis (+Splendent), White, Ebony, Wise Dragon Lord (+Splendent) spellbooks. Wise: Artisan's Splendent Truth Spellbook x1, Ultimate Refining Stone x6, Enhanced Durable Balaur Scale x41, Wrathful Mind x3, Will x3, Ego x20, Radiant Ruby x15, Radiant Odyle x9; 46 crafts, Balaur's Essence x82 base.
- Orbs: Wise and Ebony Dragon Lord Orb captured (same shape, Sapphire instead of Ruby).
- Armor (Tailoring/Armorsmithing): Wise Dragon Lord 6 slots + Genesis samples. CAVEAT: sources do not say cloth vs leather; Wise Breastplate uses Tanned Leather + Orichalcum, so sorc_relevant is null for armor.
- Accessories (Jewelcrafting/Handicrafting): Wise necklace, earrings, ring (sorc_relevant true, generic).
- Food: 3 Dark Dragon dishes + White Dragon tea (Cooking, Epic). Manastone: Superior Abyssal Manastone (Alchemy, Rare).
- MP/attack potions: no recipe pages extracted (gap).

## Material sources
- Artisan's Ultimate Refining Stone, Wrathful Mind/Will/Ego, Balaur's Essence: party dungeons (Krao Cave), Ludra raid; Balaur's Essence also some field monsters (metabot). Per-material source field left null; aion2hub says it shows gather locations but not extracted.
- Refining Stones for enhancement: field drops (metabot).

## Item level / stats
- Dragon Lord crafted IL 62-102 in tiers 62/70/78/86/94/102 (metabot). Per-recipe IL, stats, mastery level: null (not in the static pages).

## Data availability and license
- No public JSON endpoint found. aion2hub robots.txt disallows /api/ (only icon paths allowed); recipe pages are server-rendered HTML (I fetched ~27 pages, 1.5 s apart, allowed by robots). 
- aion2kina: 894 recipes in calculator (38 pages); GitHub PFG199/Aion2Kina is README only (no data, no license). Grachy/aion2-craft has sampleData.ts only, no license.
- aion2db.gg: crafting list (367 recipes), no API documented.
- aion2hub: 604 Global recipes + 1,080 KR/TW. Site footer: unofficial fan companion, no data license stated; game data is NCSOFT's. Treat as reference only; for a shipped app, get permission or rebuild from official/own data.

# Become Cube (Aion 2 companion)

A fan site that reads a player's public Aion 2 character and recommends how to build it, using the game's own skill and item numbers.

## Language

### Recommendations

**Character recommendation**:
The full, connected build advice for one looked-up character: stigmas, skill ranks, specialties, Daevanion, rotation and gear, all for one playstyle.
_Avoid_: top changes, tips

**Class guide**:
General build advice for a class, not tied to any looked-up character: built for a typical level-45 character with good obtainable gear, with notes on what changes as gear improves; shown on Codex and Guide pages.
_Avoid_: class build, meta build

**Playstyle**:
A kind of content a build is optimized for (for example Boss or AoE farming), defined by how many targets and how long the fight lasts.
_Avoid_: mode, scenario (scenario is the engine's fight model behind a playstyle)

**Boss**, **Timed boss**, **Leveling**, **AoE horde**, **PvP**:
The five playstyles: a party boss fight of a few minutes; a solo boss raced against the clock (about a minute); questing pulls of two or three mobs; timed horde content at the four-target cap; fights against players (one preset, with a duel variant).
_Avoid_: Burst (a burst opener is part of PvP, not its own playstyle), farming

**Preset**:
An in-game saved set of skills, stigmas, specialties and gear that a player switches between for free; one build plan is meant to become one preset.
_Avoid_: loadout, profile

**Role toolkit**:
For a tank, healer or support class: the defensive and party cooldowns to take and when to use them, plus the defense floors their content expects; shown beside their DPS build.
_Avoid_: support build, utility

**DPS build**:
A build the engine chooses by maximizing damage per second for a playstyle.
_Avoid_: best build, optimal build

**Role build**:
The build a tank, healer or support class plays for its role (Templar, Cleric, Chanter), shown first for those classes, with the DPS build as a secondary view. Spiritmaster is a solo summoner with no ally-facing kit, so its role build is its DPS build.
_Avoid_: support build, community build

**Build plan**:
The complete target build for one playstyle (stigmas, skill ranks, specialties, Daevanion, gear); never a partial build.
_Avoid_: target, loadout

**Next step**:
One change on the way from the character's current build to the build plan, ordered so the build stays complete and playable after every step: free changes first, then by gain per cost.
_Avoid_: tip, top change

**Rotation**:
The recommended opener and cast priority for a playstyle, chosen by the engine's math; a recommendation, not a reading of how the player actually plays. A rotation is **reviewed** once it has been cross-checked against the top community rotations (differences explained) and confirmed in game.
_Avoid_: combo (in UI copy "combo" is fine), cast order

**Peer**:
Another looked-up character of the same class on the Board, used for comparison. A **friend** is any Board character the player picks to compare side by side.
_Avoid_: rival, competitor

**Starting point**:
Where a character recommendation begins: Fresh (build from nothing), Partial (keep what the character has and finish it) or Rebuild (respec everything); guessed from the character and switchable.
_Avoid_: mode, reset

**Gear choice**:
The per-slot decision a character recommendation is built around: keep the current item, a picked item, or the best obtainable item.
_Avoid_: gear mode, BIS toggle

### Potential

**Best with your gear**:
The best DPS build using the character's current gear and only the Daevanion nodes they have opened: the strongest arrangement of what they already have.
_Avoid_: current DPS, realistic DPS

**Ceiling**:
The DPS build with best-in-slot obtainable gear at max enchant and Exceed and every Daevanion point spent; an upper bound, not a promise.
_Avoid_: max DPS, fully geared (UI label only)

### Damage numbers

**Current build** / **Best build with your gear**:
The two DPS figures on the character page. Current build is the character exactly as imported (its own stigmas, skill ranks, opened Daevanion nodes, real stats) with the rotation searched. Best build with your gear is the optimizer's plan for the same gear and stats: stigmas, ranks and specialties re-chosen, plus any unspent points the player typed in.
_Avoid_: potential DPS, max DPS (max potential is the separate best-in-slot gear view)

**Weapon attack** (the engine's `attack` input):
The midpoint of the stat sheet's Max and Min Attack before Amp Ratio: the weapon's range plus every flat Attack line. It excludes Attack Bonus (the engine adds opened Daevanion nodes' Attack Bonus itself; the level and wing share is unmeasured and left out) and the Amp Ratio and weapon-boost multipliers, which the damage formula applies. See `docs/adr/0003-imported-characters-use-stat-sheet-stats.md`.
_Avoid_: total attack, attack stat

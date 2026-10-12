# Approved native macro editor integration

Jon approved `docs/prototypes/native-macro.html` and asked to integrate it, then
invoked the implement workflow. This is the bounded integration of that approved
preview, not approval of the older, broader backend planner draft.

## Scope

- Current worktree: `D:\Aion2-level-planner`, branch `codex/native-macro-rules`.
- Integration review base: `18a3f193bfcbaa70e14b8138568ae8b8888e1f74`.
- Replace the existing Keybinds page and Class Guide Quickslots consumer with one
  shared React editor, using the existing theme, components and skill icons.
- Keep Home, navigation, Character, maps, API contracts and engine math unchanged.
- Commit locally after tests and independent review. No push or deployment.

## Observable requirements

- Four placement rows (3 above, 0 below) and a separate twelve-action hotbar.
  Distinguish Quick Use action IDs from physical slot IDs and keyboard bindings.
- Add Macro offers bottom-row column choices. A four-skill column produces one
  linked macro entry, not four flattened steps. Rebinding keeps its action ID.
- Use native-style vertical entries with skill icon, effective rank, name,
  binding badge and independent 10-9900 ms delay; allow removal and reordering.
- One initially unassigned Macro activation binding and saved named
  configurations. Do not auto-create separate Boss/AoE/Leveling F-key bindings.
- Start from client default assignments and acquired/equipped skills only.
  Do not pass context alternatives or armory ranks off as an imported hotbar.
- Retain fixed contexts and level/region/stigma gates; exclude unacquired skills,
  passive/proc skills and independently assignable chain follow-ups. Charge roots
  remain acquired hotbar skills; flag their native macro handling as unverified
  instead of turning a legacy simulator policy into a universal game prohibition.
- Local readiness toggles select the highest eligible row (0 toward 3). They
  do not rewrite entry identity or bottom-row presentation and do not simulate
  native retries, timing, execution order or DPS.
- Evaluate the client AION 1 mouse restriction against the activation binding,
  not every mouse-bound column. Detect primary and alternate binding conflicts.
- Isolate storage by character identity. Preserve legacy records with notice;
  never guess their hotkeys or silently move class-only pins. Reject malformed
  records without crashing or destroying them, and preserve unavailable saved
  assignments with visible issues after a build changes.
- Copy/download the edited native setup, not legacy worker rotation instructions.
- Changes are immediate and local, without a new optimizer search or worker
  round-trip per edit. Keep stale Guide controls disabled, loading/error/retry
  states truthful, and keyboard/dialog access and 390px horizontal scrolling usable.

## Test boundaries

Previously agreed boundaries: component interactions, persisted browser settings,
existing hook input/output and public engine I/O. Use test-first vertical slices
for changed behavior. Finish with TypeScript, the web suite, production build,
desktop/mobile browser checks, and separate Standards/Spec reviews.

## Evidence boundary

The approved prototype and screenshots establish the visual target. Derived
client help establishes row priority, delay bounds, activation restrictions and
non-guaranteed execution order. A column-linked website configuration is a
planning model, not a recovered game save format. Exact scheduler behavior and
native set/entry capacity remain unverified; storage bounds are website safeguards.
No private export, personal settings or game combat logs are shipped.

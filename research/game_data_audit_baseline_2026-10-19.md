# Issue #27: Source Baseline, 2026-10-19

Repository: `D:/Aion2-level-planner`, branch `codex/character-workflow-prototype`, HEAD `2103226801c54698c49c74b00039cd18e357ee09`. Local code and committed derived artifacts only; no browser, private export, regeneration, or game-runtime checks. The integrator independently reran the parity reproduction and drift command below; both exited 0.

- **Provenance:** `docs/adr/0001-game-numbers-from-private-client-export.md:3` establishes the derived-data boundary; lines 9-10 preserve unmatched community values and server-side estimates. `app/aion2c/data/build_gamedata.py:469` applies derived numbers/details over existing inputs. Line 473 constructs `data_version` from build date and dump label, not an installed patch identifier.
- **Versions:** `web/public/engine/manifest.json:12` reports `2026-10-05+aion2app-2026-09-18`; lines 23-25 report fingerprint `b53f606b2436`, build `2026-10-06T23:28:38+00:00`, 37 modules. All eight class files have schema 1 and build `2026-10-05T13:14:30+00:00` (e.g. `app/aion2c/data/classes/sorcerer/gamedata.json:1`). `app/aion2c/data/client_progression.json:1` has schema 1, 50 level rows, source `client export 2026-10-04`; `app/aion2c/data/client_quick_use.json:2` has schema 1, 12 actions/eight classes. Both have `client_version: null`; installed patch remains unknown.
- **Verified:** Eight app class JSONs equal their shipped `web/public/engine/classes/` counterparts semantically. ZIP `PY_DATA` bytes equal source for `stat_sheet.json`, `client_progression.json`, and `client_quick_use.json`; item JSONs also match semantically. The following read-only reproduction runs from repository root:

```powershell
@'
import json, runpy, zipfile
from pathlib import Path
b = runpy.run_path('web/scripts/bundle_engine.py', run_name='audit')
j = lambda p: json.loads(Path(p).read_bytes())
m = j('web/public/engine/manifest.json')
keys = sorted(p.parent.name for p in Path('app/aion2c/data/classes').glob('*/gamedata.json'))
assert keys == sorted(m['classes']) == sorted(p.stem for p in Path('web/public/engine/classes').glob('*.json'))
assert len(keys) == 8
for k in keys:
    assert j(f'app/aion2c/data/classes/{k}/gamedata.json') == j(f'web/public/engine/classes/{k}.json')
assert j('app/aion2c/data/items.json') == j('web/public/engine/items.json')
with zipfile.ZipFile('web/public/engine/aion2c.zip') as z:
    parts = []
    for mod in b['MODULES']:
        p = b['module_file'](mod)
        name = p.relative_to(b['APP']).as_posix()
        packed = z.read(name)
        assert p.read_bytes().replace(b'\r\n', b'\n') == packed.replace(b'\r\n', b'\n')
        if p.read_bytes() != packed: print('newline-only:', name)
        parts.append((name, packed))
    for d in b['PY_DATA']:
        raw = (b['PKG']/'data'/d).read_bytes()
        assert raw == z.read('aion2c/data/'+d)
        parts.append(('data/'+d, raw))
    parts.append(('data/items.json', (b['PKG']/'data/items.json').read_bytes()))
    assert b['fingerprint'](parts) == m['engine_version']
print('parity passed; source fingerprint:', b['engine_fingerprint']())
'@ | python -B -
```

- **Fingerprint:** Source yields `399fd191562b`. Only `app/aion2c/keybinds/quick_use.py:1` differs from its archive member: 126 CRLF versus LF endings. Archived modules plus source data reproduce the manifest hash. Hashing uses bytes (`web/scripts/bundle_engine.py:73`); this mismatch does not demonstrate semantic drift.
- **Drift:** From `app/`, `python -B -m aion2c.data.client_export --check` exited 0: 248 matched, 11 declared unmatched, zero mismatches across eight classes. Its scope excludes unavailable ranks/charge extremes (`app/aion2c/data/client_export.py:597`) and does not establish cooldown/MP correctness.
- **Consumers inspected:** Bundle copying (`web/scripts/bundle_engine.py:118`) feeds worker registration (`web/src/engine/worker.ts:91`, `app/aion2c/webapi.py:45`) and builder loading (`web/src/features/build/useClassData.ts:37`). Separate web progression generation/consumption is `web/scripts/build_progression.mjs:314` -> `web/src/features/progression/data.json:3` -> `web/src/features/progression/progression.ts:19` -> `web/src/pages/ManualBuild.tsx:102`; its `clientVersion` is also null. Python consumers: `app/aion2c/progression.py:20`, `app/aion2c/keybinds/quick_use.py:28`.
- **Pending:** Tests were inspected, not executed: `app/tests/test_client_drift.py:35`, `app/tests/test_engine_qt_free.py:64`, `app/tests/test_progression.py:165` (may read private export), `app/tests/test_quick_use.py:133`. `web/scripts/make_fixtures.py:30` intentionally truncates ranks/boards/recipes to 3/2/6; fixtures cannot establish completeness. Remaining #27 work includes field coverage, independent export/patch provenance, regional/server/in-game validation, and browser/cache behavior. This is a first baseline, not full game-validity evidence.

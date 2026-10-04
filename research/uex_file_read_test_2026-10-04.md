# uex / CUE4Parse read test against the AION2 Steam install (2026-10-04)

Status: keyless test complete, result: nothing mounts without the pak AES key. See "Run 2" at the end; it supersedes "Why I stopped".

## What I did
1. Read uex README.md, CLAUDE.md, profiles.example.json, Uex.csproj, Core/ProviderManager.cs, Core/Aion2Dat.cs, and CUE4Parse's GameTypes/Aion2 sources.
2. Installed .NET 10 privately with Microsoft's dotnet-install.ps1 (-Channel 10.0 -InstallDir D:\Aion2-tools\dotnet -NoPath). Result: SDK 10.0.401 at D:\Aion2-tools\dotnet\dotnet.exe. No PATH or machine-wide change.
3. External submodule folder was empty. Copied D:\Aion2-tools\CUE4Parse (HEAD 6b8909b "Verse update") into D:\Aion2-tools\uex\external\CUE4Parse. No source edits to uex or CUE4Parse.
4. `D:\Aion2-tools\dotnet\dotnet.exe build src/Uex -c Release` in D:\Aion2-tools\uex: 0 errors, 649 warnings (all in CUE4Parse code), 30 s.
5. No profiles.json created yet (it needs the install path plus a usmap and AES key that I do not have, see below). Nothing written to D:\Aion2 other than this report, nothing under D:\SteamLibrary touched, nothing committed.

## Why I stopped
The task requires the game and the Steam launcher to be not running. At the start of the run `tasklist` showed steam.exe (PID 40416), steamservice.exe and several steamwebhelper.exe running. AION2.exe was not running. I did not kill Steam (not my process to stop, and global rules forbid killing other sessions' processes). I did not read the install. Close Steam and re-run, or tell me the Steam client being idle is acceptable.

## Findings from source and docs (no install access needed)
- Version drift: uex pins CUE4Parse commit ec6595e (gitlink). That commit is NOT in the local clone (`git cat-file -t ec6595e` -> fatal: Not a valid object name). The clone is at 6b8909b. It built, but uex's own notes say source moves under it (renamed classes), so a mismatch is a risk only if runtime behavior differs. The copy leaves uex `git status` showing ` M external/CUE4Parse`; do not commit it.
- Game id: EGame.GAME_Aion2 (GAME_UE5_3 + 5) exists in this clone.
- Two separate secrets are involved:
  1. Pak/IoStore AES key (profile `aesKey`). uex README says it comes from a working FModel setup (AppSettings.json AesKeys.mainKey). Neither tool ships this key and I will not obtain it from any source outside the tools, docs and install files. Whether this install's containers are encrypted at all is only knowable by reading the install headers. If they are encrypted and no key is supplied, ProviderManager throws "mounted 0 files ... Check the AES key and game version" for the encrypted containers.
  2. Per-.dat keys for the Data tables (Table, L10N): Aion2DatFileEncryption.Initialize finds `/key_manifest.dat` inside the mounted VFS and derives keys from it (BLAKE3 with a constant in CUE4Parse). So decoding tables needs no extra key, but only if the container holding key_manifest.dat mounts first (which needs the pak AES key if encrypted).
- usmap (profile `usmap`): optional in code (`p.Usmap is not null`), but UE5 unversioned-property .uasset/.uexp (e.g. UI assets) generally need it. Neither repo ships an AION2 .usmap (only CUE4Parse test fixtures for UE5_8/UE6_0, which do not match). Generating one needs a running game process (dumper), which is forbidden here. So: .dat tables/L10N/map data should be decodable without a usmap, while UObject packages (.uasset) likely will not deserialize properties.
- uex dispatch (Core/Aion2Dat.cs) decodes only .dat under /data/table/, /data/mapdatahierarchy/, /data/worldmap/, /data/mapevent/, /data/map*. Localization readers exist in CUE4Parse (FAion2L10NFile, Aion2DatFileEncryption.L10N.cs) but uex's dispatch has no explicit L10N directory, so L10N .dat would be raw-copied unless it lies under one of those paths; to be checked on real data.
- First mount downloads Oodle and zlib DLLs into uex's .uex-cache. That is a one-time network fetch by the tool (the README documents it).
- Install layout seen without opening any pak (directory listing only): D:\SteamLibrary\steamapps\common\AION2\Aion2\Content\Paks holds global.* and many pakchunkN-Windows[_0_P] sets each with .pak/.sig/.ucas/.utoc; root has Manifest_UFSFiles_Win64.txt, Manifest_NonUFSFiles_Win64.txt, Manifest_DebugFiles_Win64.txt. uex's `exportRoots` default for aion2 is AION2/Content/Data and AION2/Content/UI.

## Not yet answered (needs the install read)
- Count of readable files per container/path; whether containers are encrypted; whether key_manifest.dat mounts; which Table/L10N .dat decode; whether skill/item/stat tables and localization appear; exact errors.

## Next step once Steam is closed
Create D:\Aion2-tools\uex\profiles.json (gitignored) with paksDir = the Paks path above, usmap null, aesKey null first; run `D:\Aion2-tools\dotnet\dotnet.exe run --project src/Uex -c Release -- doctor --profile aion2`, then `list`/`search` and `export --only AION2/Content/Data` into <private export root>. Record the first error verbatim to learn whether an AES key is required.

## Run 2 (Steam and AION2.exe confirmed not running via tasklist before and after)
This section supersedes "Why I stopped" and the PARTIAL status above. Result: nothing mounts without the pak AES key.

Setup: profiles.json at <private export root>\profiles.json (not in any git repo; passed with --config). Profile: game GAME_Aion2, paksDir D:/SteamLibrary/steamapps/common/AION2/Aion2/Content/Paks, usmap null, aesKey null, outputDir <private export root>/out. Run as `D:\Aion2-tools\dotnet\dotnet.exe D:\Aion2-tools\uex\src\Uex\bin\Release\net10.0\uex.dll <cmd> --profile aion2 --config ...`. Oodle (oodle-data-shared.dll) and zlib-ng2.dll downloaded fine into .uex-cache.

Commands and results (all exit 1, identical error; first error verbatim):
- doctor: `error: Profile 'aion2': mounted 0 files from D:/SteamLibrary/steamapps/common/AION2/Aion2/Content/Paks. Check the AES key and game version.`
- list AION2/Content/Data, search *.dat --limit 5, export --only AION2/Content/Data: the same error. No out directory was created; zero files exported.

Why (read-only header scan of the install with Python; Paks has 1011 files, 81 GB):
- 252 .pak: all footers version 11, encrypted-index flag 1, encryption key GUID all zeros (main key).
- 253 .utoc IoStore containers, 690,488 TOC entries total. Container flags: 216 with 15 (compressed+encrypted+signed+indexed), 11 with 14 (encrypted+signed+indexed), 25 with 12 (signed+indexed, not encrypted), global.utoc with 4. All key GUIDs zero. So 227 containers, including every large one (pakchunk10000_0_P 59,072 entries; pakchunk70000_0_P 31,611; pakchunk30000_0_P 18,761), are encrypted. The 26 unencrypted ones are global.utoc and 25 stubs with one entry and a 48-byte .ucas: nothing usable.
- Without the key CUE4Parse mounts none of the encrypted containers and uex raises the 0-files error (the AES-key failure the README predicts).

Consequences (from the code; not run, since nothing mounts):
- key_manifest.dat lives inside the encrypted containers, so the .dat Table/L10N key derivation cannot start. Readable files per container: 0 everywhere. Decoded tables: none. Skill/item/stat tables and localization: not observed.
- The install's non-Paks files (156: executables, DLLs, movies, plugins; no ini/json/crypto/key files) contain no key. The key would only exist inside AION2.exe or the running game. Pulling it from there is key extraction from a protected binary, outside what the tools, docs and install data provide and adjacent to the anti-cheat (NCGuard bb64.dll ships in the install). I did not attempt it.

Conclusion: uex and CUE4Parse build and run, and understand AION2's .dat formats, but cannot read any game data from this install without the main AES key (normally from an existing FModel setup, AppSettings.json AesKeys.mainKey). With the key in profiles.json (aesKey), rerun doctor then export --only AION2/Content/Data. A usmap is needed only for .uasset property data, not for .dat tables.

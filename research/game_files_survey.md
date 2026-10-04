# AION 2 install survey (read-only, D: drive only)

Surveyed 2026-10-04. Nothing was modified, run, or attached to. Files were opened read-only (share-read) for header/footer bytes only.

## 1. Install path
`D:\SteamLibrary\steamapps\common\AION2` (Steam app 3393110, "AION 2", installdir AION2). Total about 87.6 GB (81.55 GiB by recursive file sum).
Not present: D:\Games, D:\Steam, D:\PurpleLauncher, D:\NCSOFT, D:\PlayNC. D:\Aion2 is the companion-app repo, not the game. D:\Aion2-size-baseline, D:\Aion2-visual-polish and D:\AION2_AutoSim were not inspected.

Steam manifest `D:\SteamLibrary\steamapps\appmanifest_3393110.acf`: buildid 25650019, lastupdated 1790859990 (about 2026-10-01 UTC).

## 2. Folder tree (bytes)
```
AION2\
  Manifest_DebugFiles_Win64.txt          188
  Manifest_NonUFSFiles_Win64.txt         12,846
  Manifest_UFSFiles_Win64.txt            641,035   (6,989 entries, tab-separated path + timestamp)
  Aion2\                                 87,280,005,809
    InstallLog.txt                       20
    Binaries\Win64\                      232,521,704  (AION2.exe 156,067,608; tbb*, libcurl, libpwagent, libpwlog, z.dll, NCTinyUpdater.dll, OpenImageDenoise.dll, game_presence dll)
    Content\                             86,827,228,541
      Movies\                            36,065,333   (1 .mp4, 3 .bk2)
      Paks\                              86,790,683,152  (see section 3)
        L10N\Text\{de-DE,en-US,es-ES,fr-FR,ja-JP,ko-KR,pt-BR,ru-RU}\  one pakchunk5xx000 pak/sig/ucas(48 B stub)/utoc each, ~3.7-4.6 MB pak
        L10N\Voice\
      Splash\                            480,056
    Plugins\                             220,255,544  (DLSS 87.4M, FSR 60.6M, PurpleCommunitySdk 34.4M, StreamlineCore 13.7M, Wwise 10.8M, NCGuardSDK 7.7M, NcGPA 3.6M, NcCrashReportSdk 1.4M, PurpleOverlaySdk 0.6M)
  Engine\                                283,909,345
    Binaries\ThirdParty\ (CEF3 etc.)     227,882,726
    Binaries\Win64\                      5,578,024 (CrashReportClient.exe, CrashReportClientEditor.exe, EpicWebHelper.exe)
    Extras\Redist\en-us\UEPrereqSetup_x64.exe  50,444,088
    Extras\Steam\ (installscript.vdf, UninstallCleanup.bat)
    Content\Slate\                       326
```

## 3. Data container format
Extensions by count and total size (whole install):

| ext | count | bytes |
|---|---|---|
| .ucas | 267 | 74,556,724,784 |
| .pak | 322 | 12,099,613,072 |
| .dll | 77 | 474,118,656 |
| .exe | 5 | 210,695,248 |
| .utoc | 267 | 164,290,851 |
| .mp4 | 1 | 27,429,673 |
| .dat | 2 | 20,826,976 (both CEF icudtl.dat, not game data) |
| .bk2 | 3 | 8,635,660 |
| .sig | 266 | 878,056 |
| .txt | 4 | 654,089 |
| .bin | 2 | 213,899 (CEF snapshots) |
| .bmp/.log/.bat/.vdf/.cur | 1 each | small |

No loose .json, .csv, .xml, .db, .sqlite, .loc, .locres, .ini or .uasset on disk. All game content is inside Unreal containers in `Aion2\Content\Paks` (flat `pakchunkNNNN[_sN]-Windows[_0_P].{pak,utoc,ucas,sig}` plus `global.utoc/.ucas`). Largest: pakchunk0-Windows_0_P.pak 3,041,243,638; pakchunk240001-Windows_0_P.pak 1,629,978,626; pakchunk403000-Windows_0_P.ucas 1,037,342,704. Many chunks come as a base (`-Windows`) and patch (`-Windows_0_P`) pair. Format: Unreal IoStore (.utoc/.ucas, TOC version 5) plus a companion .pak per chunk (pak v11) and a .sig per container.

The UFS manifest (`Manifest_UFSFiles_Win64.txt`) lists cooked virtual paths (they live in the paks, not on disk). Aion2 content roots: `AION2/Content/UI` (254 entries), `System` (60), `Material` (49), `BG` (39), `WwiseAudio` (33), `UnrealData` (26), `FX` (21), `StartUpData` (16), `Map`, `NSModule`, `Character`. Manifest extension mix: .res 3438, .uexp 1131, .uasset 1127, .png 438, .svg 242, .uplugin 171, .ubulk 138, .ini 110, .locres 53, .locmeta 17, .dat 16.

Custom table folder (virtual path): `Aion2/Content/StartUpData/Table/` with .dat files (custom binary, not UE DataTable): CVResource_StartUp.dat, InputAction_StartUp.dat, InputEvent_StartUp.dat, InputKeyMapping_StartUp.dat, key_manifest.dat, PackageList_StartUp.dat, ResourcePak_StartUp.dat, String_StartUp.dat, and `L10N/<locale>/L10NString.dat` for de-DE, en-US, es-ES, fr-FR, ja-JP, ko-KR, pt-BR, ru-RU. The 3,438 `.res` entries may be the game's own resource/table blobs; not inspected.
UE DataTables (virtual): `AION2/Content/UnrealData/` GameSyncDataTable, PackageResources, PakGroupDataTable, UI_CursorTable, UI_PatchDialogDataTable, UI_TextScrollStyleDataTable, UI_TextStyleDataTable (.uasset/.uexp). All UI/patch related; none skill/item/stat.

## 4. Engine
Unreal Engine. Evidence: `Engine\` folder (Binaries/Content/Extras), `Aion2\Binaries\Win64\AION2.exe` (manifest names it `Aion2-Win64-Shipping.exe`, with Aion2-Win64-Shipping.pdb), UEPrereqSetup_x64.exe, CrashReportClient.exe, EpicWebHelper.exe, .uasset/.uexp/.ubulk/.uplugin, IoStore. Engine version string was not found as text in the exe (UE4/UE5 regex matched nothing). IoStore TOC v5, pak footer v11, Starship Slate icons and Streamline plugins suggest UE5, but that is inference, not confirmed. Third party: Wwise, CEF3, DLSS/FSR/Streamline, NCSoft SDKs (NCGuardSDK, NcPlatformSdk, PurpleCommunitySdk, PurpleOverlaySdk, NcGPA, NcCrashReportSdk). AION2.exe PE sections are named `.ncg0` to `.ncg6`, consistent with an NCGuard-protected executable.

## 5. Encryption
Read-only header/footer bytes:
- All 266 .pak files share the same footer: magic 0x5A6F12E1, pak version 11, encrypted-index flag = 1, encryption key GUID all zeros. pakchunk0-Windows_0_P.pak: index offset 0xB5455349, index size 16,848 (multiple of 16, consistent with AES). pakchunk0-Windows.pak: index offset 0x02065269, size 0x11290. Pak indexes are encrypted.
- .utoc headers: magic `2d 3d 3d 2d` repeated (the "-==-==-==-==-==-" string), version 5, header size 0x90, compression block size 65536, one partition. Container flags: global.utoc 0x04 (Signed only); pakchunk0-Windows_0_P.utoc and pakchunk0-Windows.utoc 0x0f (Compressed, Encrypted, Signed, Indexed); pakchunk403000-Windows_0_P.utoc 0x0e (Encrypted, Signed, Indexed; not compressed). Encryption key GUID in the utoc headers is all zeros. Game content containers are encrypted, signed IoStore.
- 266 .sig files (pakchunk0-Windows_0_P.sig starts `aa 2d 83 73 01 00 00 00 00 02 00 00 ...`): the paks are signed.
- Pak data region starts `00 00 00 00 00 00 00 00 a0 90 99 01 ...`, not plaintext-readable.
- No AES key was looked for or tested (out of scope).

## 6. Client version
Not visible as text. No version file on disk; AION2.exe has blank PE FileVersion/ProductVersion. Proxies only: Steam buildid 25650019 (appmanifest_3393110.acf, updated about 2026-10-01); Aion2-Win64-Shipping.exe/pdb timestamp 2026-09-30T12:33:36Z in the manifests; `Aion2\InstallLog.txt` contains only `639264022315970000` (.NET ticks, about 2026-10-01).

## 7. Plain-text skill/item/stat tables
Not found. No .json/.csv/.xml/.db/.sqlite anywhere in the install. The only plain-text files:
- `D:\SteamLibrary\steamapps\common\AION2\Manifest_UFSFiles_Win64.txt`, `Manifest_NonUFSFiles_Win64.txt`, `Manifest_DebugFiles_Win64.txt` (file lists only)
- `D:\SteamLibrary\steamapps\common\AION2\Aion2\InstallLog.txt` (20 bytes)
- `D:\SteamLibrary\steamapps\common\AION2\Aion2\Binaries\Win64\logs\VoiceChatSDK_2026-10-01_00-12-52.log` (3,696 bytes, voice chat SDK log)

Any skill/item/stat data would be inside the encrypted containers (probably the .dat tables under StartUpData/Table, .res blobs, and string paks under `Paks\L10N\Text\<locale>\`). A filename search of the UFS manifest for skill/item/stat/table found only UE Slate icons and WaveTable.uplugin, so gameplay tables are not exposed as named assets there.

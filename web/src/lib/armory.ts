/**
 * Armory client: talks to the Cloudflare Worker proxy (see proxy/CONTRACT.md), never to NCSoft directly.
 * Mock mode (VITE_ENGINE=mock) returns the DarthThot fixtures; otherwise it calls the proxy.
 * The proxy URL is a public build-time value: VITE_ARMORY_PROXY_URL (CI fills it from repo variable ARMORY_PROXY_URL).
 */
import { isMockEngine } from "@/engine/api";
import rawFx from "@/fixtures/armory_raw.json";
import searchFx from "@/fixtures/armory_search.json";
import type { ArmoryRaw, ArmoryRegion, ArmorySearchHit } from "@/lib/types";

export const ARMORY_REGIONS: { code: ArmoryRegion; name: string }[] = [
  { code: "nae", name: "NA East" },
  { code: "naw", name: "NA West" },
  { code: "eu", name: "EU" },
  { code: "la", name: "South America" },
  { code: "as", name: "Asia" },
];

export const PROXY_URL: string = (import.meta.env.VITE_ARMORY_PROXY_URL ?? "").replace(/\/+$/, "");

export class ArmoryError extends Error {}

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const strip = (s: string) => (s ?? "").replace(/<[^>]+>/g, "");

async function getJson(path: string, params: Record<string, string | number>): Promise<any> {
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
  let res: Response;
  try {
    res = await fetch(`${PROXY_URL}${path}?${qs}`, { headers: { Accept: "application/json" } });
  } catch {
    throw new ArmoryError("Could not reach the armory proxy. Check your connection and try again.");
  }
  if (res.status === 429) throw new ArmoryError("Too many requests. Wait a minute and try again.");
  if (!res.ok) throw new ArmoryError(`The armory answered ${res.status}. It may be down; try again later.`);
  try {
    return await res.json();
  } catch {
    throw new ArmoryError("The armory sent something that is not JSON (it may be down or changed).");
  }
}

/** Find characters by name. region undefined = try all five regions. */
export async function search(name: string, region?: ArmoryRegion): Promise<ArmorySearchHit[]> {
  name = name.trim();
  if (!name) throw new ArmoryError("Type a character name first.");
  if (isMockEngine) {
    await delay(250);
    // fixture rows are already in the post-processed shape (tags stripped, id decoded)
    return structuredClone(searchFx.list) as unknown as ArmorySearchHit[];
  }
  if (!PROXY_URL) throw new ArmoryError("Armory proxy is not configured (VITE_ARMORY_PROXY_URL).");
  const regions = region ? [region] : ARMORY_REGIONS.map((r) => r.code);
  const settled = await Promise.allSettled(regions.map((r) => getJson("/search", { keyword: name, region: r, page: 1, size: 100 })));
  const out: ArmorySearchHit[] = [];
  settled.forEach((s, i) => {
    if (s.status !== "fulfilled") return;
    const rows = Array.isArray(s.value) ? s.value : (s.value?.list ?? []);
    for (const row of rows) {
      let id = row.characterId ?? "";
      try {
        id = decodeURIComponent(id);
      } catch {
        /* keep as is */
      }
      out.push({
        characterId: id,
        name: strip(row.name),
        level: row.level ?? null,
        serverId: row.serverId ?? null,
        serverName: row.serverName ?? "",
        pcId: row.pcId ?? null,
        race: row.race ?? null,
        region: row.region || regions[i],
      });
    }
  });
  if (!out.length) {
    const bad = settled.find((s) => s.status === "rejected") as PromiseRejectedResult | undefined;
    if (bad && settled.every((s) => s.status === "rejected")) throw bad.reason;
  }
  return out;
}

/** info + equipment + the Daevanion boards that have open nodes, as webapi.import_character expects. */
/** `fresh` asks the proxy to re-read the armory instead of its 10-minute cache (the proxy still rate-limits this per entry). */
export async function fetchCharacter(characterId: string, serverId: number | string, region: ArmoryRegion, fresh = false): Promise<ArmoryRaw> {
  if (isMockEngine) {
    await delay(400);
    return structuredClone(rawFx) as unknown as ArmoryRaw;
  }
  if (!PROXY_URL) throw new ArmoryError("Armory proxy is not configured (VITE_ARMORY_PROXY_URL).");
  const common = { characterId, serverId, region, ...(fresh ? { fresh: 1 } : {}) };
  const info = await getJson("/info", common);
  if (!info || typeof info !== "object" || !info.profile) {
    throw new ArmoryError("The armory has no profile for that character (wrong region or server?).");
  }
  // equipment and every Daevanion board are independent: ask for them all at once (the armory handles the burst, and the
  // old 400 ms pauses between requests added about three seconds to every character load)
  const boardIds: (string | number)[] = (info.daevanion?.boardList ?? []).filter((b: { openNodeCount?: number }) => b.openNodeCount).map((b: { id: string | number }) => b.id);
  const [equipmentRaw, ...boards] = await Promise.all([
    getJson("/equipment", common),
    ...boardIds.map((id) => getJson("/daevanion", { ...common, boardId: id })),
  ]);
  const equipment = equipmentRaw ?? {};
  const daevanion: Record<string, Record<string, unknown>> = {};
  boardIds.forEach((id, i) => {
    daevanion[String(id)] = boards[i];
  });
  return { info, equipment, daevanion };
}

export interface ArmoryIcon {
  icon: string | null;
  name: string;
  grade: string;
}
export interface ArmoryExtras {
  /** equipped slot name ("MainHand") -> official icon URL (hotlinked from NCSoft's CDN) */
  gearIcons: Record<string, string>;
  pet: ArmoryIcon | null;
  wing: ArmoryIcon | null;
  wingSkin: ArmoryIcon | null;
}

const asIcon = (o: unknown, fallbackGrade = ""): ArmoryIcon | null => {
  if (!o || typeof o !== "object") return null;
  const r = o as Record<string, unknown>;
  if (typeof r.name !== "string" || !r.name) return null;
  return { icon: typeof r.icon === "string" ? r.icon : null, name: r.name, grade: typeof r.grade === "string" ? r.grade : fallbackGrade };
};

/** What the engine summary drops: per-slot gear icon URLs and the pet / wings, read straight from the raw armory payload. */
export function armoryExtras(raw: ArmoryRaw): ArmoryExtras {
  const eq = (raw.equipment ?? {}) as { equipment?: { equipmentList?: Record<string, unknown>[] }; petwing?: Record<string, unknown> };
  const gearIcons: Record<string, string> = {};
  for (const e of eq.equipment?.equipmentList ?? []) {
    if (typeof e.slotPosName === "string" && typeof e.icon === "string") gearIcons[e.slotPosName] = e.icon;
  }
  const pw = eq.petwing ?? {};
  return { gearIcons, pet: asIcon(pw.pet, "Epic"), wing: asIcon(pw.wing), wingSkin: asIcon(pw.wingSkin) };
}

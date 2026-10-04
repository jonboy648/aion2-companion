import { PageHeader } from "@/components/PageHeader";
import { PartyMap } from "@/features/maps/PartyMap";

interface MapSite {
  name: string;
  url: string;
  what: string;
  note: string;
}

/** Community maps we link to. We host and copy no map art or marker data; each site's content is theirs. */
export const MAP_SITES: MapSite[] = [
  {
    name: "AION2 Hub maps",
    url: "https://aion2hub.com/maps",
    what: "Zone maps for the Elyos, Asmodian and Abyss areas with hidden cubes, teleports and gathering nodes.",
    note: "Marks which zones are Korea/Taiwan only (its page was checked against the Global client on 2026-09-19).",
  },
  {
    name: "Questlog map",
    url: "https://questlog.gg/aion-2/en/map",
    what: "Interactive map with bosses, dungeons, portals and resources.",
    note: "Check which zones exist in the Global version; we have not verified its coverage.",
  },
];

/** Links out to community maps. Unofficial; not affiliated with those sites or NCSOFT. */
export function Maps() {
  return (
    <>
      <PageHeader title="Maps" caption="Unofficial community maps. We link to them and do not host or copy any map art." />
      <PartyMap />
      <ul className="space-y-3">
        {MAP_SITES.map((s) => (
          <li key={s.url} className="ornate p-5">
            <a href={s.url} target="_blank" rel="noopener noreferrer" className="font-display text-lg font-semibold">
              {s.name} <span aria-hidden>↗</span>
            </a>
            <p className="mt-1 text-sm">{s.what}</p>
            <p className="mt-1 text-xs text-dim">{s.note}</p>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-xs text-dim">Not affiliated with these sites or NCSOFT. The maps and their data belong to their owners; open them for the latest version.</p>
    </>
  );
}

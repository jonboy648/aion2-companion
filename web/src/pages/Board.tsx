import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { GameTabs } from "@/components/game";
import { PageHeader } from "@/components/PageHeader";
import { ago, fetchBoard, REGION_LABEL, type BoardRow, type BoardSort } from "@/lib/board";

type View = "recent" | "power" | "gear" | "dps";

const CLASSES = ["Gladiator", "Templar", "Assassin", "Ranger", "Sorcerer", "Spiritmaster", "Cleric", "Chanter"];

const num = (n: number | null) => (n === null ? "-" : n.toLocaleString("en-US"));

function Row({ r, rank, view }: { r: BoardRow; rank: number; view: View }) {
  const to = `/c/${r.region}/${r.server_id}/${encodeURIComponent(r.name)}`;
  return (
    <tr className="border-t border-border/60">
      {view !== "recent" && <td className="w-10 py-2 pr-2 text-right text-dim tabular-nums">{rank}</td>}
      <td className="py-2 pr-3">
        <Link to={to} className="font-medium">
          {r.name}
        </Link>
        <div className="text-xs text-dim">
          {r.class_name}
          {r.level ? ` · Lv ${r.level}` : ""} · {r.server_name || "server " + r.server_id} · {REGION_LABEL[r.region] ?? r.region}
          {view !== "gear" && r.item_level != null ? ` · IL ${r.item_level}` : ""}
        </div>
      </td>
      <td className="py-2 text-right tabular-nums">
        {view === "recent" ? <span className="text-dim">{ago(r.last_seen)}</span> : <span className="text-gold">{num(view === "power" ? r.combat_power : view === "gear" ? r.item_level : r.max_dps)}</span>}
      </td>
    </tr>
  );
}

/** Public board: the latest characters looked up on the site, and a top list by Combat Power or max-potential DPS. */
export function Board() {
  const [view, setView] = useState<View>("recent");
  const [cls, setCls] = useState("");
  const [rows, setRows] = useState<BoardRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setRows(null);
    setError(null);
    fetchBoard(view as BoardSort, view === "recent" ? "" : cls).then(
      (r) => live && setRows(r),
      (e) => live && setError(e instanceof Error ? e.message : String(e)),
    );
    return () => {
      live = false;
    };
  }, [view, cls]);

  return (
    <>
      <PageHeader title="Board" caption="Recent lookups and the top characters. Public armory info only." />
      <GameTabs
        label="Board view"
        value={view}
        onChange={setView}
        tabs={[
          { key: "recent", label: "Recent" },
          { key: "power", label: "Top Combat Power" },
          { key: "gear", label: "Top Gear Score" },
          { key: "dps", label: "Top max-potential DPS" },
        ]}
      />
      {view !== "recent" && (
        <label className="mt-3 flex items-center gap-2 text-sm text-dim">
          Class
          <select value={cls} onChange={(e) => setCls(e.target.value)} className="rounded border border-border bg-surface px-2 py-1 text-foreground">
            <option value="">All</option>
            {CLASSES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      )}
      {view === "gear" && <p className="mt-3 text-xs text-dim">Gear score is the character's item level (IL), read from the official armory.</p>}
      {view === "dps" && (
        <p className="mt-3 text-xs text-dim">
          Max-potential DPS is the site's estimate for the boss playstyle with obtainable gear, computed in each visitor's browser. It is not verified and is only comparable within a class.
        </p>
      )}
      <div className="mt-4">
        {error ? (
          <p role="alert" className="text-sm text-dim">{error}</p>
        ) : rows === null ? (
          <p className="text-sm text-dim">Loading...</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-dim">{view === "dps" ? "Nobody has calculated their max potential yet. Open a character and press Calculate max potential." : view === "gear" ? "No gear scores recorded yet. They appear as characters are looked up." : "Nothing here yet."}</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {rows.map((r, i) => (
                <Row key={`${r.region}/${r.server_id}/${r.name}`} r={r} rank={i + 1} view={view} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { ProgressPanel } from "@/features/build/BuildResults";
import { loadRecent } from "@/features/build/helpers";
import { useClassData } from "@/features/build/useClassData";
import { CompareView } from "@/features/compare/CompareView";
import { SlotPicker } from "@/features/compare/SlotPicker";
import { TARGET_PLAN_KEY, buildCopyPlan, comparePath, parseTriplet, type Side, type Triplet, type TargetPlan } from "@/features/compare/logic";
import { useCompareSlot, type SlotState } from "@/features/compare/useCompareSlot";
import { saveJson, storeActiveBuild } from "@/features/keybinds/activeBuild";
import type { ArmoryRegion } from "@/lib/types";

/** When /compare is opened bare, side A defaults to the most recently viewed character. */
function recentTriplet(): Triplet | null {
  const r = loadRecent()[0];
  return r ? { region: r.region as ArmoryRegion, serverId: String(r.serverId), name: r.name } : null;
}

function SlotStatus({ label, s }: { label: string; s: SlotState }) {
  if (s.phase === "error") {
    return (
      <p role="alert" className="text-sm text-error">
        {label}: {s.error}
      </p>
    );
  }
  if (s.phase === "lookup" || s.phase === "import") return <ProgressPanel title={`Loading ${label}`} message={s.message} steps={[]} />;
  return null;
}

/** Shareable route /#/compare/:a/:b, each a "region~serverId~name" segment ("-" = empty slot). */
export function Compare() {
  const { a: pa, b: pb } = useParams();
  const nav = useNavigate();
  const [fallbackA] = useState(() => (pa === undefined && pb === undefined ? recentTriplet() : null));
  const ta = parseTriplet(pa) ?? fallbackA;
  const tb = parseTriplet(pb);
  const sa = useCompareSlot(ta);
  const sb = useCompareSlot(tb);
  const da = useClassData(sa.imp?.build.class_key);
  const db = useClassData(sb.imp?.build.class_key);
  const [copied, setCopied] = useState<{ plan: TargetPlan; warnings: string[] } | { error: string } | null>(null);

  // the main nav is sticky and wraps on phones: park the sticky identity bar right under it
  useEffect(() => {
    const header = document.querySelector("header");
    if (!header) return;
    const set = () => document.documentElement.style.setProperty("--nav-h", `${Math.round(header.getBoundingClientRect().height)}px`);
    set();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(set) : null;
    ro?.observe(header);
    window.addEventListener("resize", set);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", set);
      document.documentElement.style.removeProperty("--nav-h");
    };
  }, []);

  useEffect(() => setCopied(null), [pa, pb]);

  function onCopy(from: Side) {
    const theirs = from === "a" ? sa.imp : sb.imp;
    const mine = from === "a" ? sb.imp : sa.imp;
    if (!theirs) return;
    const res = buildCopyPlan(mine, theirs);
    if (!res.ok) {
      setCopied({ error: res.reason });
      return;
    }
    storeActiveBuild(res.plan.build); // the same hand-off Keybinds, Crafting and Road Map read
    saveJson(TARGET_PLAN_KEY, res.plan);
    setCopied({ plan: res.plan, warnings: res.warnings });
  }

  const ready = sa.imp && sb.imp;
  const classKey = copied && "plan" in copied ? copied.plan.build.class_key : "sorcerer";
  return (
    <>
      <PageHeader title="Compare characters" caption="Put two armory characters side by side, then copy a build you like as your target plan." />

      <div className="grid gap-4 sm:grid-cols-2">
        <SlotPicker key={`a-${pa ?? ""}`} label="Character A" current={ta} onPick={(t) => nav(comparePath(t, tb))} />
        <SlotPicker key={`b-${pb ?? ""}`} label="Character B" current={tb} onPick={(t) => nav(comparePath(ta, t))} />
      </div>

      <div className="mt-4 space-y-3">
        <SlotStatus label="Character A" s={sa} />
        <SlotStatus label="Character B" s={sb} />
        {(!ta || !tb) && <p className="text-sm text-dim">Pick two characters to compare. Everything is read from the official armory.</p>}
      </div>

      {copied && (
        <div role="status" className="ornate mt-4 border-gold/40 bg-gold/5 p-3 text-sm">
          {"error" in copied ? (
            <p className="text-warn">{copied.error}</p>
          ) : (
            <>
              <p>
                Saved <strong className="text-gold">{copied.plan.build.name}</strong> as your target plan: {Object.keys(copied.plan.build.skill_ranks).length} skill ranks,{" "}
                {copied.plan.build.stigmas.length} stigmas, {copied.plan.build.daevanion_nodes.length} Daevanion nodes. Keybinds, Crafting and Road Map now use it.
              </p>
              {copied.warnings.map((w) => (
                <p key={w} className="mt-1 text-warn">
                  {w}
                </p>
              ))}
              <p className="mt-2 flex flex-wrap gap-3">
                <Link to="/keybinds" className="text-cyan">Open Keybinds</Link>
                <Link to="/roadmap" className="text-cyan">Open Road Map</Link>
                <Link to="/crafting" className="text-cyan">Open Crafting</Link>
                <Link to={`/build?class=${classKey}`} className="text-cyan">Manual build</Link>
              </p>
            </>
          )}
        </div>
      )}

      {ready && (
        <div className="mt-4">
          <CompareView a={{ imp: sa.imp!, extras: sa.extras, cmp: sa.cmp, data: da }} b={{ imp: sb.imp!, extras: sb.extras, cmp: sb.cmp, data: db }} onCopy={onCopy} />
        </div>
      )}
    </>
  );
}

import { Badge } from "@/components/ui/badge";
import { ClassEmblem } from "@/components/game/ClassEmblem";
import { IconFrame, rarityOf } from "@/components/game/IconFrame";
import { FactionEmblem } from "@/components/game/Ornaments";
import { factionOf } from "@/components/game/faction";
import { XpBar } from "@/components/game/XpBar";
import { SpotlightCard } from "@/components/fancy/spotlight-card";
import type { ArmoryExtras } from "@/lib/armory";
import type { ImportResult } from "@/lib/types";
import type { ClassData } from "./useClassData";
import { SkillIcon } from "./SkillIcon";
import { fmtDps, slotLabel } from "./helpers";
import { useState } from "react";
import { boardTotal } from "@/features/daevanion/logic";

function Portrait({ url, name }: { url: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="relative size-24 shrink-0 overflow-hidden rounded-lg border-2 border-[var(--metal)] bg-surface3 shadow-[0_0_26px_-2px_rgb(var(--ether)/0.55),inset_0_0_10px_rgb(0_0_0/0.5)] sm:size-28">
      {url && !failed ? (
        <img src={url} alt={`${name} portrait`} referrerPolicy="no-referrer" onError={() => setFailed(true)} className="size-full object-cover" />
      ) : (
        <div className="flex size-full items-center justify-center font-display text-3xl font-bold text-gold">{name.slice(0, 1).toUpperCase()}</div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 frame px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-faint">{label}</div>
      <div className="truncate font-display text-xl font-bold text-gold">{value}</div>
    </div>
  );
}

/** Profile, gear, stigmas and Daevanion progress for an imported armory character. */
export function CharacterCard({ imp, data, extras }: { imp: ImportResult; data: ClassData; extras?: ArmoryExtras | null }) {
  const { profile, gear, stigmas, daevanion_summary: dv } = imp;
  const boards = extras?.boards ? extras.boards.map((b) => ({ board: b.name, open: b.open, total: b.total }))
    : dv.boards.map((b) => {
      const board = Object.values(data.gd?.daevanion ?? {}).find((board) => board.name.toLowerCase() === b.board.toLowerCase());
      return { board: b.board, open: b.open, total: board ? boardTotal(board) : null };
    });
  const groupOf = (slot: string) => {
    if (["MainHand", "SubHand"].includes(slot)) return "Weapons";
    if (["Torso", "Pants", "Helmet", "Shoulder", "Gloves", "Boots", "Cape"].includes(slot)) return "Armor";
    if (/^(Belt|Necklace|Earring\d*|Ring\d*|Bracelet\d*|Amulet)$/.test(slot)) return "Accessories";
    return "Other equipment";
  };
  return (
    <SpotlightCard className="mb-6 !rounded-lg" data-testid="character-card">
      <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div className="min-w-0">
          <div className="flex items-start gap-4">
            <Portrait url={profile.profile_image} name={profile.name} />
            <div className="min-w-0">
              <h2 className="truncate text-2xl font-bold leading-tight text-gold">{profile.name}</h2>
              <p className="mt-0.5 flex items-center gap-2 text-sm text-dim">
                <ClassEmblem classKey={profile.class_key} size={26} />
                <span>
                  {profile.class_name}
                  {profile.race ? ` - ${profile.race}` : ""}
                </span>
                {profile.race && <FactionEmblem faction={factionOf(profile.race)} size={22} />}
              </p>
              <p className="text-sm text-dim">
                {profile.server}
                {profile.level != null ? ` - Lv ${profile.level}` : ""}
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Stat label="Combat power" value={profile.combat_power != null ? fmtDps(profile.combat_power) : "n/a"} />
            <Stat label="Item level" value={profile.item_level != null ? String(profile.item_level) : "n/a"} />
          </div>

          <section className="mt-4" aria-label="Stigmas and Daevanion">
          <h3 className="mb-2 mt-5 text-xs font-semibold uppercase text-faint">Stigmas</h3>
          {stigmas.length === 0 ? (
            <p className="text-sm text-dim">No stigmas equipped.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-2">
              {stigmas.map((s) => (
                <li key={s.name} className="flex min-w-0 items-center gap-2 frame p-2">
                  <SkillIcon name={s.name} url={s.key ? data.icons[s.key] : null} size={38} rarity="rare" />
                  <span className="min-w-0">
                    <span className="block truncate text-[13px]">{s.name}</span>
                    <span className="text-[11px] text-dim">Rank {extras?.skills?.find((skill) => skill.category === "Dp" && skill.acquired && skill.equipped && skill.name === s.name)?.rank ?? s.rank}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}

          <h3 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-faint">Daevanion</h3>
          <p className="mb-2 text-sm text-dim">
            <span className="font-semibold text-gold">{dv.matched}</span> of {dv.open} open nodes matched
          </p>
          <ul className="space-y-1.5">
            {boards.map((b) => (
              <li key={b.board} className="flex items-center gap-3 text-[13px]">
                <span className="w-20 shrink-0 text-dim">{b.board}</span>
                {b.total !== null && <XpBar className="flex-1" small value={b.open} max={b.total} label={`${b.board} owned nodes`} />}
                <span className="w-14 shrink-0 text-right tabular-nums text-dim">
                  {b.open}/{b.total ?? "?"}
                </span>
              </li>
            ))}
          </ul>
          </section>
        </div>

        <section className="min-w-0" aria-label="Equipment and companions">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint">Gear</h3>
          <div aria-label="Equipped gear">
          {["Weapons", "Armor", "Accessories", "Other equipment"].map((group) => {
            const pieces = gear.filter((g) => groupOf(g.slot) === group);
            if (!pieces.length) return null;
            return <section key={group} aria-label={group} className="mb-4">
            <h4 className="mb-2 text-xs font-semibold text-dim">{group}</h4>
            <ul className="grid gap-1.5 sm:grid-cols-2">
            {pieces.map((g) => {
              return (
                <li key={g.slot} className="frame flex min-w-0 items-center gap-2.5 px-2 py-1.5">
                  <IconFrame url={extras?.gearIcons[g.slot]} name={slotLabel(g.slot)} size={40} rarity={rarityOf(g.grade)} alt="" title={`${g.grade} ${slotLabel(g.slot)}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] text-faint">{slotLabel(g.slot)}</span>
                    <span className="block truncate text-[13px]" title={`${g.name} (${g.grade})`}>
                      {g.name}
                    </span>
                  </span>
                  {g.enchant > 0 && <Badge tone="gold">+{g.enchant}</Badge>}
                  {g.exceed > 0 && <Badge tone="info">E{g.exceed}</Badge>}
                </li>
              );
            })}
            </ul></section>;
          })}
          </div>
          {extras && (extras.pet || extras.wing || extras.wingSkin) && (
            <>
              <h3 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-faint">Pet and wings</h3>
              <ul className="grid gap-1.5 sm:grid-cols-2" aria-label="Pet and wings">
                {[
                  { k: "Wings", v: extras.wing },
                  { k: "Wing skin", v: extras.wingSkin },
                  { k: "Pet", v: extras.pet },
                ].map(({ k, v }) =>
                  v ? (
                    <li key={k} className="frame flex min-w-0 items-center gap-2.5 px-2 py-1.5">
                      <IconFrame url={v.icon} name={v.name} size={40} rarity={rarityOf(v.grade)} alt="" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[11px] text-faint">{k}</span>
                        <span className="block truncate text-[13px]">{v.name}</span>
                        {v.level !== undefined && <span className="text-xs text-dim">Lv {v.level}</span>}
                        {v.enchantLevel !== undefined && <span className="text-xs text-dim">Enhancement +{v.enchantLevel}</span>}
                      </span>
                    </li>
                  ) : null,
                )}
              </ul>
            </>
          )}
        </section>
        {extras?.titles && <section aria-label="Equipped titles" className="border-t border-border pt-4 lg:col-span-2">
          <h3 className="mb-3 text-sm font-semibold text-gold">Equipped titles</h3>
          <ul className="grid gap-4 sm:grid-cols-3">
            {extras.titles.map((title) => <li key={`${title.category}-${title.id}`} className="min-w-0">
              <span className="text-xs text-dim">{title.category}</span>
              <p className="text-sm font-semibold">{title.name}</p>
              <ul className="mt-1 text-xs text-dim">{title.equippedEffects.map((effect, i) => <li key={i}>{effect}</li>)}</ul>
              {title.collectionEffects.map((effect, i) => <p key={i} className="mt-1 text-xs text-faint">Collection: {effect}</p>)}
            </li>)}
          </ul>
        </section>}
        {extras?.attributes && <section aria-label="Attributes" className="border-t border-border pt-4 lg:col-span-2">
          <h3 className="mb-3 text-sm font-semibold text-gold">Attributes</h3>
          <dl className="grid gap-4 sm:grid-cols-3">
            {extras.attributes.map((attribute) => <div key={attribute.key} className="min-w-0">
              <dt className="flex items-baseline justify-between gap-2 text-sm"><span>{attribute.name}</span><span className="font-semibold tabular-nums text-gold">{attribute.value}</span></dt>
              <dd className="mt-1 text-xs text-dim">{attribute.effects.map((effect, i) => <p key={i}>{effect}</p>)}</dd>
            </div>)}
          </dl>
        </section>}
        {extras?.skills && <div className="grid gap-5 border-t border-border pt-4 lg:col-span-2 md:grid-cols-2">
          {[{ category: "Active", label: "Active skills" }, { category: "Passive", label: "Passive skills" }].map(({ category, label }) => (
            <section key={category} aria-label={label}>
              <h3 className="mb-3 text-sm font-semibold text-gold">{label}</h3>
              <ul className="grid gap-2 sm:grid-cols-2">
                {extras.skills!.filter((s) => s.category === category && s.acquired && s.rank > 0).map((s) => (
                  <li key={s.id} className="flex min-w-0 items-center gap-2 py-1">
                    <SkillIcon name={s.name} url={s.icon} size={32} rarity="rare" />
                    <span className="min-w-0"><span className="block text-sm">{s.name}</span><span className="text-xs text-dim">Rank {s.rank}</span></span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>}
      </div>
    </SpotlightCard>
  );
}

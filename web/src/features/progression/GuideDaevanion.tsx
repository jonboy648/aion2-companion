import { useEffect, useId, useRef, useState } from "react";
import { ArrowUpRight, Lock } from "lucide-react";
import { Link } from "react-router-dom";
import { ART, nodeFrame, startIcon } from "@/features/daevanion/art";
import { formatEffect, SKILL_BONUS_CAP } from "@/features/daevanion/logic";
import type { CharacterBuild, DaevanionBoard, DaevanionNode, GameData, IconUrls } from "@/lib/types";
import "./GuideDaevanion.css";

interface Props {
  gd: GameData;
  icons: IconUrls;
  level: number;
  build?: CharacterBuild;
  path?: number[];
  unlocked: boolean;
}

export function GuideDaevanion({ gd, icons, level, build, path, unlocked }: Props) {
  const descriptionId = useId();
  const currencyBoards = Object.values(gd.daevanion)
    .filter((board) => board.currency === "daevanion")
    .sort((a, b) => a.unlock_level - b.unlock_level || a.name.localeCompare(b.name));
  const boards = currencyBoards.filter((board) => board.unlock_level <= level);
  const selected = new Set(build?.daevanion_nodes ?? []);
  const suggested = new Set(unlocked ? path ?? [] : []);

  return (
    <section className="guide-daevanion reference-panel" aria-label="Daevanion" aria-describedby={descriptionId}>
      <div className="guide-daevanion-heading reference-panel-heading">
        <h2>Daevanion</h2>
        <span className="guide-daevanion-readonly">Read only</span>
      </div>
      <p id={descriptionId} className="sr-only">
        Read-only Daevanion boards. Node buttons show details. Selected nodes are from the supplied build;
        suggested nodes are not purchased.
      </p>
      <div className="reference-panel-body">
      {boards.length > 0 ? (
        <>
          <div className="guide-daevanion-legend" role="group" aria-label="Daevanion legend">
            <span><i className="guide-daevanion-selected-key" aria-hidden />Selected</span>
            <span><i className="guide-daevanion-suggested-key" aria-hidden />Suggested</span>
          </div>
          {!unlocked && (
            <p className="guide-daevanion-quest"><Lock size={14} aria-hidden />Daevanion quest incomplete</p>
          )}
          <div className="guide-daevanion-boards">
            {boards.map((board) => (
              <ReadOnlyBoard key={`${gd.class_key}/${board.key}`} board={board} gd={gd} icons={icons}
                selected={selected} suggested={suggested} />
            ))}
          </div>
        </>
      ) : (
        <p className="guide-daevanion-empty">
          {currencyBoards.length > 0
            ? `Daevanion unlocks at level ${currencyBoards[0].unlock_level}.`
            : "No Daevanion Crystal boards available."}
        </p>
      )}
      </div>
    </section>
  );
}

interface BoardProps {
  board: DaevanionBoard;
  gd: GameData;
  icons: IconUrls;
  selected: ReadonlySet<number>;
  suggested: ReadonlySet<number>;
}

function ReadOnlyBoard({ board, gd, icons, selected, suggested }: BoardProps) {
  const detailId = useId();
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const nodes = Object.values(board.nodes).sort((a, b) => a.y - b.y || a.x - b.x || a.id - b.id);
  const minX = nodes.length ? Math.min(...nodes.map((node) => node.x)) : 0;
  const minY = nodes.length ? Math.min(...nodes.map((node) => node.y)) : 0;
  const columns = nodes.length ? Math.max(...nodes.map((node) => node.x)) - minX + 1 : 1;
  const rows = nodes.length ? Math.max(...nodes.map((node) => node.y)) - minY + 1 : 1;
  const activeId = focused ?? hovered;
  const active = activeId === null ? undefined : board.nodes[String(activeId)];

  useEffect(() => {
    if (activeId === null) return;
    const doc = surfaceRef.current?.ownerDocument;
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setFocused(null);
        setHovered(null);
      }
    };
    doc?.addEventListener("keydown", dismiss);
    return () => doc?.removeEventListener("keydown", dismiss);
  }, [activeId]);

  function state(node: DaevanionNode) {
    if (node.id === board.start_id) return "start";
    if (selected.has(node.id)) return "selected";
    return suggested.has(node.id) ? "suggested" : "unselected";
  }

  return (
    <section className="guide-daevanion-board" aria-label={`${board.name} board (read only)`}>
      <div className="guide-daevanion-board-heading">
        <h3>
          <Link to={`/daevanion?class=${encodeURIComponent(gd.class_key)}`}
            aria-label={`${board.name}: open full Daevanion planner`} title="Open full Daevanion planner">
            {board.name}<ArrowUpRight size={14} aria-hidden />
          </Link>
        </h3>
        <span>Level {board.unlock_level}</span>
      </div>
      {nodes.length > 0 ? (
        <div className="guide-daevanion-board-surface" ref={surfaceRef} onMouseLeave={() => setHovered(null)}
          style={{ aspectRatio: `${columns} / ${rows}` }}>
          <div className="guide-daevanion-grid" role="group" aria-label={`${board.name} node details`}
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`, aspectRatio: `${columns} / ${rows}`,
              backgroundImage: `url("${ART.background}")` }}>
            {nodes.map((node) => {
              const status = state(node);
              const isStart = status === "start";
              const icon = isStart ? startIcon(gd.class_key) : node.skill_key ? icons[node.skill_key] : null;
              const label = status === "suggested" ? "suggested, not selected"
                : status === "unselected" ? "not selected" : status === "start" ? "start node" : "selected";
              return (
                <button key={node.id} type="button" className="guide-daevanion-node"
                  data-node-id={node.id} data-state={status}
                  aria-label={`Inspect ${node.name}, cost ${node.cost} Daevanion Crystals, ${label}`}
                  aria-describedby={active?.id === node.id ? detailId : undefined}
                  title={`${node.name}\nCost: ${node.cost} Daevanion Crystals`}
                  style={{ gridColumn: node.x - minX + 1, gridRow: node.y - minY + 1 }}
                  onFocus={() => setFocused(node.id)} onBlur={() => setFocused(null)}
                  onMouseEnter={() => setHovered(node.id)}
                  onClick={() => setFocused(node.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      setFocused(null);
                      setHovered(null);
                    }
                  }}>
                  <img className="guide-daevanion-frame" alt="" aria-hidden draggable={false} loading="lazy" decoding="async"
                    src={nodeFrame(node.rarity, isStart ? "start" : status === "selected" ? "selected" : "locked")} />
                  {icon && <img className="guide-daevanion-node-icon" src={icon} alt="" aria-hidden draggable={false} loading="lazy" decoding="async" />}
                </button>
              );
            })}
          </div>
          {active && (
            <div id={detailId} role="tooltip" className="guide-daevanion-detail"
              data-placement={active.y - minY < rows / 2 ? "bottom" : "top"}>
              <NodeInfo node={active} gd={gd} state={state(active)} />
            </div>
          )}
        </div>
      ) : <p className="guide-daevanion-empty">No node data available.</p>}
    </section>
  );
}

function NodeInfo({ node, gd, state }: { node: DaevanionNode; gd: GameData; state: string }) {
  const skill = node.skill_key ? gd.skills[node.skill_key] : undefined;
  return (
    <>
      <strong>{node.name}</strong>
      <div className="guide-daevanion-detail-meta">
        {node.rarity && <span>{node.rarity}</span>}
        <span>Cost: {node.cost} Daevanion Crystals</span>
        <span>{state === "suggested" ? "Suggested / Not selected"
          : state === "selected" ? "Selected" : state === "start" ? "Start node" : "Not selected"}</span>
      </div>
      {node.skill_key && <p>{skill?.name ?? node.skill_key}: +1 skill rank (max +{SKILL_BONUS_CAP} per skill).</p>}
      {node.effects.length > 0 && (
        <ul>
          {node.effects.map((effect, index) => (
            <li key={index}><span>{effect.stat}</span><span>{formatEffect(effect.value, effect.unit)}</span></li>
          ))}
        </ul>
      )}
      {!node.skill_key && node.effects.length === 0 && <p>No listed effects.</p>}
    </>
  );
}

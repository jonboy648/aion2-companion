import { useMemo, useState } from "react";
import type { DaevanionBoard, DaevanionNode, IconUrls } from "@/lib/types";
import { nodeList, nodeState, rarityColor, type NodeState } from "./logic";
import { ART, nodeFrame, startIcon } from "./art";

const CELL = 62;
const PAD = 38;

/** Shield outline centred on (0,0), about 38 x 46 units. */
const SHIELD = "M0,-23 L18,-16 L18,5 C18,15 9,21 0,26 C-9,21 -18,15 -18,5 L-18,-16 Z";
/** Game tile size inside a cell (the client grid uses square frames with ~4px slot padding). */
const TILE = 50;
const HEX = "M0,-24 L21,-12 L21,12 L0,24 L-21,12 L-21,-12 Z";

interface Props {
  board: DaevanionBoard;
  selected: ReadonlySet<number>;
  available: ReadonlySet<number>;
  /** whole board dimmed because the character's level is below the unlock level */
  locked: boolean;
  icons: IconUrls;
  /** nodes proposed by Max power path */
  suggested?: ReadonlySet<number>;
  focusId: number | null;
  onToggle: (node: DaevanionNode) => void;
  onFocus: (node: DaevanionNode | null) => void;
  /** class key for the start-node icon */
  classKey?: string;
}

export function BoardSvg({ board, selected, available, locked, icons, suggested, focusId, onToggle, onFocus, classKey }: Props) {
  /** the board+class whose game art failed to load; it falls back to the drawn shapes. Keyed so a
   *  different board or class (or a remount) tries the art again instead of staying stuck. */
  const artKey = `${board.key}|${classKey ?? ""}`;
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const artOk = failedKey !== artKey;
  const onArtError = () => setFailedKey(artKey);
  const nodes = useMemo(() => nodeList(board), [board]);
  const geom = useMemo(() => {
    const xs = nodes.map((n) => n.x);
    const ys = nodes.map((n) => n.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const w = (Math.max(...xs) - minX) * CELL + PAD * 2;
    const h = (Math.max(...ys) - minY) * CELL + PAD * 2;
    const pos = (n: DaevanionNode) => ({ cx: (n.x - minX) * CELL + PAD, cy: (n.y - minY) * CELL + PAD });
    return { w, h, pos };
  }, [nodes]);

  const edges = useMemo(() => {
    const seen = new Set<string>();
    const out: { a: DaevanionNode; b: DaevanionNode }[] = [];
    for (const a of nodes)
      for (const id of a.adjacent) {
        const b = board.nodes[String(id)];
        if (!b) continue;
        const k = a.id < b.id ? `${a.id}-${b.id}` : `${b.id}-${a.id}`;
        if (seen.has(k)) continue;
        seen.add(k);
        out.push({ a, b });
      }
    return out;
  }, [nodes, board]);

  const lit = (id: number) => id === board.start_id || selected.has(id);

  return (
    <svg
      viewBox={`0 0 ${geom.w} ${geom.h}`}
      className="block h-auto w-full min-w-[520px] select-none sm:min-w-0"
      role="group"
      aria-label={`${board.name} board`}
      data-testid="daevanion-board"
      data-art={artOk ? "game" : "fallback"}
    >
      <defs>
        <radialGradient id={`bg-${board.key}`} cx="50%" cy="50%" r="70%">
          <stop offset="0%" stopColor="#1f2a52" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#0b1020" stopOpacity="0" />
        </radialGradient>
        <clipPath id="node-icon-clip">
          <circle r="12" />
        </clipPath>
      </defs>
      <rect width={geom.w} height={geom.h} fill="#0b1118" />
      {artOk && <image href={ART.background} width={geom.w} height={geom.h} preserveAspectRatio="xMidYMid slice" onError={onArtError} />}
      <rect width={geom.w} height={geom.h} fill={`url(#bg-${board.key})`} />
      <g opacity={locked ? 0.4 : 1}>
        {edges.map(({ a, b }) => {
          const pa = geom.pos(a);
          const pb = geom.pos(b);
          const on = lit(a.id) && lit(b.id);
          if (artOk) {
            // game style: no drawn paths, just a short bridge across the slot gap between tiles
            const dx = Math.sign(pb.cx - pa.cx);
            const dy = Math.sign(pb.cy - pa.cy);
            const h = TILE / 2 - 2;
            return (
              <line
                key={`${a.id}-${b.id}`}
                x1={pa.cx + dx * h}
                y1={pa.cy + dy * h}
                x2={pb.cx - dx * h}
                y2={pb.cy - dy * h}
                stroke={on ? "#f2cf7e" : "#3a5566"}
                strokeWidth={on ? 4 : 2}
                strokeLinecap="round"
                opacity={on ? 1 : 0.6}
                data-edge={on ? "lit" : "dim"}
              />
            );
          }
          return (
            <line
              key={`${a.id}-${b.id}`}
              x1={pa.cx}
              y1={pa.cy}
              x2={pb.cx}
              y2={pb.cy}
              stroke={on ? "#e0b458" : "#2a3563"}
              strokeWidth={on ? 3 : 2}
              strokeLinecap="round"
              opacity={on ? 0.95 : 0.7}
            />
          );
        })}
        {nodes.map((n) => {
          const { cx, cy } = geom.pos(n);
          const st = nodeState(board, selected, available, n.id);
          return (
            <NodeShape
              key={n.id}
              node={n}
              cx={cx}
              cy={cy}
              state={st}
              locked={locked}
              icon={n.skill_key ? icons[n.skill_key] ?? null : null}
              focused={focusId === n.id}
              suggested={suggested?.has(n.id) ?? false}
              onToggle={onToggle}
              onFocus={onFocus}
              art={artOk}
              classKey={classKey}
              onArtError={onArtError}
            />
          );
        })}
      </g>
    </svg>
  );
}

interface NodeProps {
  node: DaevanionNode;
  cx: number;
  cy: number;
  state: NodeState;
  locked: boolean;
  icon: string | null;
  focused: boolean;
  suggested: boolean;
  onToggle: (n: DaevanionNode) => void;
  onFocus: (n: DaevanionNode | null) => void;
  art: boolean;
  classKey?: string;
  onArtError: () => void;
}

function NodeShape({ node, cx, cy, state, locked, icon, focused, suggested, onToggle, onFocus, art, classKey, onArtError }: NodeProps) {
  const color = rarityColor(node.rarity);
  const isSkill = node.node_type === "skill";
  const scale = state === "start" ? 1.15 : isSkill ? 1.18 : node.rarity.toLowerCase() === "unique" ? 1.1 : 0.9;
  const fill = state === "selected" ? color : "#111831";
  const fillOpacity = state === "selected" ? 0.32 : 1;
  const strokeOpacity = state === "locked" ? 0.38 : 1;
  const label =
    state === "start"
      ? "Start node"
      : `${node.name}, ${node.rarity}, cost ${node.cost}, ${state === "selected" ? "selected" : state === "available" ? "available" : "locked"}`;
  const interactive = state === "available" || state === "selected";

  return (
    <g
      transform={art ? `translate(${cx} ${cy})` : `translate(${cx} ${cy}) scale(${scale})`}
      role={state === "start" ? "img" : "button"}
      aria-label={label}
      aria-pressed={state === "start" ? undefined : state === "selected"}
      aria-disabled={state === "locked" || locked || undefined}
      tabIndex={state === "start" ? -1 : 0}
      data-node-id={node.id}
      data-state={state}
      className="outline-none"
      style={{ cursor: interactive && !locked ? "pointer" : "default" }}
      onClick={() => onToggle(node)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle(node);
        }
      }}
      onMouseEnter={() => onFocus(node)}
      onMouseLeave={() => onFocus(null)}
      onFocus={() => onFocus(node)}
      onBlur={() => onFocus(null)}
    >
      <title>{label}</title>
      {/* generous invisible hit area for touch */}
      <circle r="30" fill="transparent" />
      {art ? (
        <GameTile node={node} state={state} icon={icon} focused={focused} suggested={suggested} classKey={classKey} onArtError={onArtError} />
      ) : (
      <>
      {(focused || state === "available") && state !== "start" && (
        <path
          d={SHIELD}
          transform="scale(1.28)"
          fill="none"
          stroke={focused ? "#f2cf7e" : color}
          strokeWidth={focused ? 2.4 : 1.4}
          strokeDasharray={focused ? undefined : "3 3"}
          opacity={focused ? 0.95 : 0.55}
        />
      )}
      {suggested && state !== "selected" && <path d={SHIELD} transform="scale(1.4)" fill="#4cc3e8" fillOpacity="0.14" stroke="#4cc3e8" strokeWidth="2" />}
      {state === "start" ? (
        <>
          <path d={HEX} fill="#1a1405" stroke="#f2cf7e" strokeWidth="3" />
          <path d="M0,-11 L10,0 L0,11 L-10,0 Z" fill="#e0b458" />
        </>
      ) : (
        <>
          <path
            d={SHIELD}
            fill={fill}
            fillOpacity={fillOpacity}
            stroke={color}
            strokeOpacity={strokeOpacity}
            strokeWidth={state === "selected" ? 3 : 2.4}
            strokeLinejoin="round"
          />
          {state === "selected" && <path d={SHIELD} transform="scale(1.16)" fill="none" stroke="#f2cf7e" strokeWidth="1.8" />}
          {isSkill && icon ? (
            <g clipPath="url(#node-icon-clip)" opacity={state === "locked" ? 0.45 : 1} transform="translate(0 1)">
              <image href={icon} x="-12" y="-12" width="24" height="24" preserveAspectRatio="xMidYMid slice" />
            </g>
          ) : (
            <text
              y="5"
              textAnchor="middle"
              fontSize={isSkill ? 12 : 13}
              fontWeight={600}
              fill={state === "locked" ? "#6b7699" : state === "selected" ? "#e8ebf6" : color}
              opacity={strokeOpacity > 0.5 ? 1 : 0.8}
            >
              {isSkill ? "S" : node.cost}
            </text>
          )}
        </>
      )}
      </>
      )}
    </g>
  );
}

interface TileProps {
  node: DaevanionNode;
  state: NodeState;
  icon: string | null;
  focused: boolean;
  suggested: boolean;
  classKey?: string;
  onArtError: () => void;
}

/** One node drawn with the client's own frames and FX textures. */
function GameTile({ node, state, icon, focused, suggested, classKey, onArtError }: TileProps) {
  const T = TILE / 2;
  const color = rarityColor(node.rarity);
  if (state === "start") {
    const cls = startIcon(classKey);
    return (
      <g data-art-role="start">
        <image href={ART.startBg} x={-36} y={-36} width={72} height={72} onError={onArtError} />
        <image href={nodeFrame(node.rarity, state)} x={-T - 2} y={-T - 2} width={TILE + 4} height={TILE + 4} data-art-role="frame" onError={onArtError} />
        {cls && <image href={cls} x={-17} y={-17} width={34} height={34} data-art-role="class-icon" onError={onArtError} />}
      </g>
    );
  }
  return (
    <g>
      {suggested && state !== "selected" && (
        <rect x={-T - 6} y={-T - 6} width={TILE + 12} height={TILE + 12} rx={8} fill="#4cc3e8" fillOpacity={0.16} stroke="#4cc3e8" strokeWidth={2} data-art-role="suggested" />
      )}
      {state === "available" && (
        <>
          <image href={ART.availableFill} x={-T - 4} y={-T - 4} width={TILE + 8} height={TILE + 8} opacity={0.55} style={{ mixBlendMode: "screen" }} onError={onArtError} />
          <rect x={-T - 3} y={-T - 3} width={TILE + 6} height={TILE + 6} rx={6} fill="none" stroke={color} strokeWidth={1.6} strokeDasharray="4 3" opacity={0.85} data-art-role="available" />
        </>
      )}
      {state === "selected" && (
        <image href={ART.selectRing} x={-T - 9} y={-T - 9} width={TILE + 18} height={TILE + 18} style={{ mixBlendMode: "screen" }} data-art-role="selected-glow" onError={onArtError} />
      )}
      <image
        href={nodeFrame(node.rarity, state)}
        x={-T}
        y={-T}
        width={TILE}
        height={TILE}
        opacity={state === "locked" ? 0.5 : 1}
        data-art-role="frame"
        onError={onArtError}
      />
      {node.node_type === "skill" && icon && (
        <g clipPath="url(#node-icon-clip)" opacity={state === "locked" ? 0.45 : 1}>
          <image href={icon} x="-12" y="-12" width="24" height="24" preserveAspectRatio="xMidYMid slice" onError={onArtError} />
        </g>
      )}
      {focused && <rect x={-T - 4} y={-T - 4} width={TILE + 8} height={TILE + 8} rx={6} fill="none" stroke="#f2cf7e" strokeWidth={2.6} data-art-role="focus" />}
    </g>
  );
}

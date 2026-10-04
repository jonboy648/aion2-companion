import { useMemo } from "react";
import { gamedata, iconUrls, roadmap } from "@/engine/api";
import { useToolsClass } from "@/features/keybinds/useToolsClass";
import { useAsync } from "@/hooks/useAsync";
import type { CharacterBuild, ClassInfo, DaevanionBoard, IconUrls, RoadmapItem } from "@/lib/types";
import { boardProgress, type BoardProgress } from "./personal";

export interface GuideData {
  classKey: string | null;
  setClassKey: (k: string) => void;
  classes: ClassInfo[];
  /** the character the visitor loaded elsewhere on the site, if any */
  build: CharacterBuild | null;
  roadmapItems: RoadmapItem[];
  icons: IconUrls;
  /** lower-cased skill name -> skill key, for matching road map text to icons */
  skillKeys: Map<string, string>;
  boards: BoardProgress[];
  boardData: Record<string, DaevanionBoard>;
}

/** Everything the guide needs from the engine. Each piece degrades to empty so the static guide always renders. */
export function useGuideData(): GuideData {
  const tc = useToolsClass();
  const classKey = tc.classKey;
  const region = tc.build?.region ?? "global";
  const showKr = tc.build?.show_kr;
  const rm = useAsync<RoadmapItem[]>(() => (classKey ? roadmap(classKey, region, tc.build) : Promise.resolve([])), [classKey, region, showKr]);
  const gd = useAsync(() => (classKey ? gamedata(classKey) : Promise.resolve(null)), [classKey]);
  const ic = useAsync<IconUrls>(() => (classKey ? iconUrls(classKey) : Promise.resolve({})), [classKey]);

  const skillKeys = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of Object.values(gd.data?.skills ?? {})) m.set(s.name.toLowerCase(), s.key);
    return m;
  }, [gd.data]);

  const boardData = gd.data?.daevanion ?? {};
  const boards = useMemo(() => (tc.build && gd.data && tc.build.class_key === classKey ? boardProgress(gd.data.daevanion, tc.build) : []), [tc.build, gd.data]);

  return {
    classKey,
    setClassKey: tc.setClassKey,
    classes: tc.classes,
    build: tc.build,
    roadmapItems: rm.data ?? [],
    icons: ic.data ?? {},
    skillKeys,
    boards,
    boardData,
  };
}

import type { FullBuild } from "@/lib/types";
import { fmtDps } from "./helpers";

export const buildGoal = (fb: FullBuild) => fb.objective ?? fb.playstyle.scenario.objective ?? "damage";
export const goalUnit = (fb: FullBuild) => buildGoal(fb) === "stagger" ? "gauge/s" : "DPS";
export const goalScore = (fb: FullBuild) => fb.objective_score ?? (buildGoal(fb) === "stagger" ? fb.result.stagger_per_s ?? null : fb.result.dps);
export const currentGoalScore = (fb: FullBuild) => fb.current_objective_score ?? (buildGoal(fb) === "stagger" ? null : fb.current_dps);
export const formatGoalScore = (score: number | null) => score === null ? "Unavailable" : `~${fmtDps(score)}`;
export const goalPlaystyleName = (fb: FullBuild) => buildGoal(fb) === "stagger" ? fb.playstyle.name.replace(/\bDPS\b/g, "Stagger") : fb.playstyle.name;

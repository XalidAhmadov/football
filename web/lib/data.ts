// Tournament prediction data + small helpers.
import predictions from "@/data/predictions.json";

export type TeamPrediction = {
  team: string;
  group: string;
  elo: number;
  qualify: number;
  r16: number;
  qf: number;
  sf: number;
  final: number;
  title: number;
};

export const STAGES = [
  { key: "qualify", label: "Advance (R32)", short: "R32" },
  { key: "r16", label: "Round of 16", short: "R16" },
  { key: "qf", label: "Quarter-final", short: "QF" },
  { key: "sf", label: "Semi-final", short: "SF" },
  { key: "final", label: "Final", short: "Final" },
  { key: "title", label: "Champion", short: "Title" },
] as const;

export type StageKey = (typeof STAGES)[number]["key"];

export const TEAMS: TeamPrediction[] = (predictions as TeamPrediction[])
  .slice()
  .sort((a, b) => b.title - a.title);

/** Teams grouped by their World Cup group, each group ordered by qualify odds. */
export function byGroup(): Record<string, TeamPrediction[]> {
  const groups: Record<string, TeamPrediction[]> = {};
  for (const t of TEAMS) (groups[t.group] ??= []).push(t);
  for (const g of Object.keys(groups)) groups[g].sort((a, b) => b.qualify - a.qualify);
  return groups;
}

export const TEAM_NAMES: string[] = TEAMS.map((t) => t.team).sort((a, b) =>
  a.localeCompare(b),
);

export function fmtPct(p: number, digits = 1): string {
  if (p > 0 && p < 0.001) return "<0.1%";
  return `${(p * 100).toFixed(digits)}%`;
}

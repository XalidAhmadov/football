"use client";

import { useState } from "react";
import { TEAMS, STAGES, StageKey, fmtPct, TeamPrediction } from "@/lib/data";
import { flag } from "@/lib/flags";

type SortKey = StageKey | "elo";

export default function TitleRace() {
  const [sort, setSort] = useState<SortKey>("title");

  const rows = [...TEAMS].sort((a, b) => b[sort] - a[sort]);
  const max = Math.max(...rows.map((r) => r[sort]));

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/40">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wider text-slate-400">
            <th className="px-4 py-3 font-medium">#</th>
            <th className="px-4 py-3 font-medium">Team</th>
            <SortableHead label="Elo" k="elo" sort={sort} setSort={setSort} />
            {STAGES.map((s) => (
              <SortableHead
                key={s.key}
                label={s.short}
                k={s.key}
                sort={sort}
                setSort={setSort}
              />
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((t, i) => (
            <Row key={t.team} t={t} rank={i + 1} sort={sort} max={max} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SortableHead({
  label,
  k,
  sort,
  setSort,
}: {
  label: string;
  k: SortKey;
  sort: SortKey;
  setSort: (k: SortKey) => void;
}) {
  const active = sort === k;
  return (
    <th className="px-3 py-3 text-right font-medium">
      <button
        onClick={() => setSort(k)}
        className={`tabular-nums transition-colors hover:text-emerald-300 ${
          active ? "text-emerald-400" : "text-slate-400"
        }`}
      >
        {label}
        {active ? " ↓" : ""}
      </button>
    </th>
  );
}

function Row({
  t,
  rank,
  sort,
  max,
}: {
  t: TeamPrediction;
  rank: number;
  sort: SortKey;
  max: number;
}) {
  const sortVal = t[sort];
  const isPct = sort !== "elo";
  return (
    <tr className="group border-t border-white/5 hover:bg-white/5">
      <td className="px-4 py-2.5 text-slate-500 tabular-nums">{rank}</td>
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <span className="text-lg leading-none">{flag(t.team)}</span>
          <span className="font-medium text-slate-100">{t.team}</span>
          <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">
            {t.group}
          </span>
        </div>
        {/* progress bar reflects the currently sorted metric */}
        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400"
            style={{ width: `${max > 0 ? (sortVal / max) * 100 : 0}%` }}
          />
        </div>
      </td>
      <td className="px-3 py-2.5 text-right tabular-nums text-slate-400">{t.elo}</td>
      {STAGES.map((s) => {
        const v = t[s.key];
        const highlighted = !isPct ? false : sort === s.key;
        return (
          <td
            key={s.key}
            className={`px-3 py-2.5 text-right tabular-nums ${
              highlighted ? "font-semibold text-emerald-300" : "text-slate-300"
            }`}
          >
            {fmtPct(v)}
          </td>
        );
      })}
    </tr>
  );
}

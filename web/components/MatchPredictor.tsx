"use client";

import { useMemo, useState } from "react";
import { TEAM_NAMES } from "@/lib/data";
import { predictMatch } from "@/lib/predict";
import { flag } from "@/lib/flags";

export default function MatchPredictor() {
  const [teamA, setTeamA] = useState("Argentina");
  const [teamB, setTeamB] = useState("France");
  const [neutral, setNeutral] = useState(true);

  const pred = useMemo(
    () => predictMatch(teamA, teamB, neutral),
    [teamA, teamB, neutral],
  );

  const swap = () => {
    setTeamA(teamB);
    setTeamB(teamA);
  };

  const pct = (p: number) => `${(p * 100).toFixed(1)}%`;

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-5 sm:p-6">
      {/* selectors */}
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-end">
        <TeamSelect label="Team A" value={teamA} onChange={setTeamA} />
        <button
          onClick={swap}
          title="Swap teams"
          className="mx-auto rounded-lg border border-white/10 px-3 py-2 text-slate-400 transition-colors hover:bg-white/5 hover:text-emerald-300"
        >
          ⇄
        </button>
        <TeamSelect label="Team B" value={teamB} onChange={setTeamB} />
      </div>

      <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-slate-400">
        <input
          type="checkbox"
          checked={neutral}
          onChange={(e) => setNeutral(e.target.checked)}
          className="h-4 w-4 accent-emerald-500"
        />
        Neutral venue {neutral ? "" : `(home advantage to ${teamA})`}
      </label>

      {/* expected goals */}
      <div className="mt-6 flex items-center justify-center gap-6 text-center">
        <Side team={teamA} xg={pred.xgA} />
        <div className="text-xs uppercase tracking-widest text-slate-500">
          xG
          <div className="mt-1 text-2xl font-light text-slate-600">vs</div>
        </div>
        <Side team={teamB} xg={pred.xgB} />
      </div>

      {/* win / draw / loss bar */}
      <div className="mt-6">
        <div className="flex h-9 w-full overflow-hidden rounded-lg text-xs font-semibold">
          <div
            className="flex items-center justify-center bg-emerald-500/90 text-emerald-950"
            style={{ width: `${pred.pWin * 100}%` }}
          >
            {pred.pWin > 0.08 ? pct(pred.pWin) : ""}
          </div>
          <div
            className="flex items-center justify-center bg-slate-600 text-slate-100"
            style={{ width: `${pred.pDraw * 100}%` }}
          >
            {pred.pDraw > 0.08 ? pct(pred.pDraw) : ""}
          </div>
          <div
            className="flex items-center justify-center bg-sky-500/90 text-sky-950"
            style={{ width: `${pred.pLoss * 100}%` }}
          >
            {pred.pLoss > 0.08 ? pct(pred.pLoss) : ""}
          </div>
        </div>
        <div className="mt-2 flex justify-between text-xs text-slate-500">
          <span>{teamA} win</span>
          <span>Draw {pct(pred.pDraw)}</span>
          <span>{teamB} win</span>
        </div>
      </div>

      {/* most likely scorelines */}
      <div className="mt-6">
        <div className="mb-2 text-xs uppercase tracking-wider text-slate-500">
          Most likely scorelines
        </div>
        <div className="flex flex-wrap gap-2">
          {pred.topScores.map((s, i) => (
            <div
              key={i}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm"
            >
              <span className="font-semibold text-slate-100 tabular-nums">
                {s.a}–{s.b}
              </span>
              <span className="ml-2 text-slate-500 tabular-nums">
                {pct(s.p)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TeamSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex w-full flex-col gap-1">
      <span className="text-xs uppercase tracking-wider text-slate-500">
        {label}
      </span>
      <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2">
        <span className="text-lg leading-none">{flag(value)}</span>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent text-sm text-slate-100 outline-none"
        >
          {TEAM_NAMES.map((t) => (
            <option key={t} value={t} className="bg-slate-900">
              {t}
            </option>
          ))}
        </select>
      </div>
    </label>
  );
}

function Side({ team, xg }: { team: string; xg: number }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-3xl leading-none">{flag(team)}</span>
      <span className="mt-2 max-w-28 truncate text-sm text-slate-300">{team}</span>
      <span className="mt-1 text-3xl font-light tabular-nums text-emerald-300">
        {xg.toFixed(2)}
      </span>
    </div>
  );
}

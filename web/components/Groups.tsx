import { byGroup, fmtPct } from "@/lib/data";
import { flag } from "@/lib/flags";

export default function Groups() {
  const groups = byGroup();
  const keys = Object.keys(groups).sort();

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {keys.map((g) => (
        <div
          key={g}
          className="rounded-2xl border border-white/10 bg-slate-900/40 p-4"
        >
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-200">Group {g}</h3>
            <span className="text-[10px] uppercase tracking-wider text-slate-500">
              advance odds
            </span>
          </div>
          <ul className="space-y-2.5">
            {groups[g].map((t, i) => (
              <li key={t.team}>
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-2 truncate">
                    <span className="text-base leading-none">{flag(t.team)}</span>
                    <span
                      className={
                        i < 2 ? "font-medium text-slate-100" : "text-slate-400"
                      }
                    >
                      {t.team}
                    </span>
                  </span>
                  <span className="tabular-nums text-slate-400">
                    {fmtPct(t.qualify, 0)}
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                  <div
                    className={`h-full rounded-full ${
                      i < 2
                        ? "bg-gradient-to-r from-emerald-500 to-teal-400"
                        : "bg-slate-600"
                    }`}
                    style={{ width: `${t.qualify * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

import TitleRace from "@/components/TitleRace";
import Groups from "@/components/Groups";
import MatchPredictor from "@/components/MatchPredictor";
import { TEAMS, fmtPct } from "@/lib/data";
import { flag } from "@/lib/flags";

export default function Home() {
  const podium = TEAMS.slice(0, 3);
  const order = [1, 0, 2]; // silver, gold, bronze visual order

  return (
    <div className="min-h-full bg-slate-950 text-slate-200">
      {/* header */}
      <header className="sticky top-0 z-10 border-b border-white/10 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">🏆</span>
            <span className="font-semibold tracking-tight text-slate-100">
              World Cup 2026 Predictor
            </span>
          </div>
          <nav className="hidden gap-6 text-sm text-slate-400 sm:flex">
            <a href="#race" className="transition-colors hover:text-emerald-300">
              Title race
            </a>
            <a href="#predict" className="transition-colors hover:text-emerald-300">
              Match predictor
            </a>
            <a href="#groups" className="transition-colors hover:text-emerald-300">
              Groups
            </a>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-16 px-5 py-12">
        {/* hero / podium */}
        <section>
          <p className="text-sm font-medium uppercase tracking-widest text-emerald-400">
            Monte Carlo forecast · 20,000 simulations
          </p>
          <h1 className="mt-2 max-w-2xl text-4xl font-bold tracking-tight text-slate-50 sm:text-5xl">
            Who lifts the trophy in 2026?
          </h1>
          <p className="mt-3 max-w-2xl text-slate-400">
            An Elo + Dixon-Coles Poisson model rates every nation, simulates the rest
            of the live tournament from the current group standings, and turns it into
            each team&apos;s odds of going all the way.
          </p>

          <div className="mt-10 grid grid-cols-3 gap-3 sm:gap-5">
            {order.map((idx, pos) => {
              const t = podium[idx];
              const heights = ["sm:mt-8", "", "sm:mt-12"]; // gold tallest
              const medals = ["🥈", "🥇", "🥉"];
              return (
                <div
                  key={t.team}
                  className={`flex flex-col items-center rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900 to-slate-900/40 p-4 text-center ${heights[pos]}`}
                >
                  <span className="text-2xl">{medals[pos]}</span>
                  <span className="mt-2 text-4xl leading-none">{flag(t.team)}</span>
                  <span className="mt-2 font-semibold text-slate-100">{t.team}</span>
                  <span className="mt-1 text-2xl font-bold tabular-nums text-emerald-300">
                    {fmtPct(t.title)}
                  </span>
                  <span className="text-xs text-slate-500">to win</span>
                </div>
              );
            })}
          </div>
        </section>

        {/* title race table */}
        <section id="race" className="scroll-mt-20">
          <SectionTitle
            kicker="Full field"
            title="Title race"
            desc="Every qualified nation's path through the bracket. Tap a column to re-rank."
          />
          <TitleRace />
        </section>

        {/* match predictor */}
        <section id="predict" className="scroll-mt-20">
          <SectionTitle
            kicker="Interactive"
            title="Match predictor"
            desc="Pick any two nations — the Dixon-Coles model computes expected goals, outcome odds, and the likeliest scorelines live in your browser."
          />
          <MatchPredictor />
        </section>

        {/* groups */}
        <section id="groups" className="scroll-mt-20">
          <SectionTitle
            kicker="12 groups"
            title="Group stage"
            desc="Odds of finishing top-2 (or as one of the 8 best third-placed teams) and advancing to the round of 32."
          />
          <Groups />
        </section>
      </main>

      <footer className="border-t border-white/10">
        <div className="mx-auto max-w-5xl px-5 py-8 text-sm text-slate-500">
          Built on the{" "}
          <code className="rounded bg-white/5 px-1 text-slate-400">model.py</code>{" "}
          engine — Elo ratings, time-decay weighting, and a Dixon-Coles low-score
          correction. Forecast updates as real matches are played.
        </div>
      </footer>
    </div>
  );
}

function SectionTitle({
  kicker,
  title,
  desc,
}: {
  kicker: string;
  title: string;
  desc: string;
}) {
  return (
    <div className="mb-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
        {kicker}
      </p>
      <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-50">
        {title}
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-slate-400">{desc}</p>
    </div>
  );
}

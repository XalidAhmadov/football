// Match prediction math — a faithful TypeScript port of model.py.
// Elo gap -> expected goals (Poisson) -> Dixon-Coles corrected outcome probs.
import ratings from "@/data/ratings.json";
import goalsModel from "@/data/goals_model.json";

export const HFA = 65.0; // home-field advantage in Elo points

const RATINGS = ratings as Record<string, number>;
const GM = goalsModel as { intercept: number; coef: number; rho: number };

export function rating(team: string): number {
  return RATINGS[team] ?? 1500.0;
}

/** exp(intercept + coef * gap/100) — Elo gap mapped to expected goals. */
export function expectedGoals(eloGap: number): number {
  return Math.exp(GM.intercept + (GM.coef * eloGap) / 100.0);
}

function poissonPmf(k: number, lambda: number): number {
  // exp(-l) * l^k / k!
  let logp = -lambda + k * Math.log(lambda);
  for (let i = 2; i <= k; i++) logp -= Math.log(i);
  return Math.exp(logp);
}

/** Joint scoreline distribution with the Dixon-Coles low-score correction. */
export function scoreMatrix(lh: number, la: number, rho = GM.rho, n = 11): number[][] {
  const ph = Array.from({ length: n }, (_, k) => poissonPmf(k, lh));
  const pa = Array.from({ length: n }, (_, k) => poissonPmf(k, la));
  const m: number[][] = ph.map((h) => pa.map((a) => h * a));
  m[0][0] *= 1 - lh * la * rho;
  m[0][1] *= 1 + lh * rho;
  m[1][0] *= 1 + la * rho;
  m[1][1] *= 1 - rho;
  let total = 0;
  for (const row of m) for (const v of row) total += Math.max(v, 0);
  return m.map((row) => row.map((v) => Math.max(v, 0) / total));
}

export type MatchPrediction = {
  teamA: string;
  teamB: string;
  xgA: number;
  xgB: number;
  pWin: number; // A wins
  pDraw: number;
  pLoss: number; // B wins
  topScores: { a: number; b: number; p: number }[];
};

export function predictMatch(teamA: string, teamB: string, neutral = true): MatchPrediction {
  const ra = rating(teamA);
  const rb = rating(teamB);
  const hfa = neutral ? 0 : HFA;
  const xgA = expectedGoals(ra - rb + hfa);
  const xgB = expectedGoals(rb - ra - hfa);
  const m = scoreMatrix(xgA, xgB);

  let pWin = 0;
  let pDraw = 0;
  let pLoss = 0;
  const flat: { a: number; b: number; p: number }[] = [];
  for (let a = 0; a < m.length; a++) {
    for (let b = 0; b < m[a].length; b++) {
      const p = m[a][b];
      flat.push({ a, b, p });
      if (a > b) pWin += p;
      else if (a === b) pDraw += p;
      else pLoss += p;
    }
  }
  flat.sort((x, y) => y.p - x.p);
  return {
    teamA,
    teamB,
    xgA,
    xgB,
    pWin,
    pDraw,
    pLoss,
    topScores: flat.slice(0, 5),
  };
}

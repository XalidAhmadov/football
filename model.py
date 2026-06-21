"""
World Cup 2026 prediction - Match Model (the engine).

  1. Elo ratings  -> each team's current strength (importance- & margin-weighted).
  2. Poisson goals model -> Elo gap to expected goals, with two refinements:
       * exponential TIME-DECAY weighting (recent games matter more)
       * DIXON-COLES low-score correction (fixes under-predicted draws)
"""
import os
import json
import urllib.request
import numpy as np
import pandas as pd
from sklearn.linear_model import PoissonRegressor
from scipy.stats import poisson
from scipy.optimize import minimize_scalar

DATA_URL = "https://raw.githubusercontent.com/martj42/international_results/master/results.csv"
DATA_PATH = os.path.join(os.path.dirname(__file__), "data", "results.csv")
HFA = 65.0
HALF_LIFE_YEARS = 2.0   # a match this old gets half the weight in calibration


# --------------------------------------------------------------------------- data
def load_data():
    if not os.path.exists(DATA_PATH):
        os.makedirs(os.path.dirname(DATA_PATH), exist_ok=True)
        urllib.request.urlretrieve(DATA_URL, DATA_PATH)
    df = pd.read_csv(DATA_PATH, parse_dates=["date"])
    return df.sort_values("date").reset_index(drop=True)


# ------------------------------------------------------------------- Elo (unchanged)
def importance_weight(tournament: str) -> float:
    t = str(tournament).lower()
    if "friendly" in t:
        return 20.0
    if "qualif" in t:
        return 40.0
    if t == "fifa world cup":
        return 60.0
    if any(f in t for f in ["uefa euro", "copa am", "african cup of nations",
                            "afc asian cup", "gold cup", "confederations"]):
        return 50.0
    if "nations league" in t:
        return 40.0
    return 30.0


def gd_multiplier(goal_diff: int) -> float:
    gd = abs(goal_diff)
    if gd <= 1:
        return 1.0
    if gd == 2:
        return 1.5
    if gd == 3:
        return 1.75
    return 1.75 + (gd - 3) / 8.0


def compute_elo(df: pd.DataFrame):
    ratings: dict[str, float] = {}
    pre_home = np.full(len(df), np.nan)
    pre_away = np.full(len(df), np.nan)
    for i, r in enumerate(df.itertuples(index=False)):
        rh = ratings.get(r.home_team, 1500.0)
        ra = ratings.get(r.away_team, 1500.0)
        pre_home[i], pre_away[i] = rh, ra
        if pd.isna(r.home_score) or pd.isna(r.away_score):
            continue
        hfa = 0.0 if r.neutral else HFA
        exp_home = 1.0 / (1.0 + 10 ** ((ra - rh - hfa) / 400.0))
        if r.home_score > r.away_score:
            sh = 1.0
        elif r.home_score < r.away_score:
            sh = 0.0
        else:
            sh = 0.5
        k = importance_weight(r.tournament) * gd_multiplier(r.home_score - r.away_score)
        delta = k * (sh - exp_home)
        ratings[r.home_team] = rh + delta
        ratings[r.away_team] = ra - delta
    df = df.copy()
    df["home_elo_pre"] = pre_home
    df["away_elo_pre"] = pre_away
    return ratings, df


# ----------------------------------------------------------- goals model + refinements
def _calib_frame(df, years):
    cutoff = df.date.max() - pd.Timedelta(days=365 * years)
    d = df[(df.date >= cutoff) & df.home_score.notna() & df.home_elo_pre.notna()].copy()
    nd = (~d.neutral.values).astype(float)
    d["home_gap"] = d.home_elo_pre.values - d.away_elo_pre.values + HFA * nd
    d["away_gap"] = d.away_elo_pre.values - d.home_elo_pre.values - HFA * nd
    age_days = (d.date.max() - d.date).dt.days.values
    d["w"] = 0.5 ** (age_days / (365.0 * HALF_LIFE_YEARS))
    return d


def fit_goals_model(df: pd.DataFrame, years: int = 5):
    d = _calib_frame(df, years)
    X = np.concatenate([d.home_gap.values, d.away_gap.values]).reshape(-1, 1) / 100.0
    y = np.concatenate([d.home_score.values, d.away_score.values])
    w = np.concatenate([d.w.values, d.w.values])
    model = PoissonRegressor(alpha=1e-6, max_iter=500)
    model.fit(X, y, sample_weight=w)
    return {"intercept": float(model.intercept_), "coef": float(model.coef_[0]), "rho": 0.0}


def _tau(x, y, lh, la, rho):
    t = np.ones_like(lh, dtype=float)
    m = (x == 0) & (y == 0); t[m] = 1 - lh[m] * la[m] * rho
    m = (x == 0) & (y == 1); t[m] = 1 + lh[m] * rho
    m = (x == 1) & (y == 0); t[m] = 1 + la[m] * rho
    m = (x == 1) & (y == 1); t[m] = 1 - rho
    return t


def fit_rho(df: pd.DataFrame, goals_model: dict, years: int = 5):
    """Dixon-Coles correlation: MLE on the four low-score cells (time-weighted)."""
    d = _calib_frame(df, years)
    b0, b1 = goals_model["intercept"], goals_model["coef"]
    lh = np.exp(b0 + b1 * d.home_gap.values / 100.0)
    la = np.exp(b0 + b1 * d.away_gap.values / 100.0)
    x = d.home_score.values.astype(int)
    y = d.away_score.values.astype(int)
    w = d.w.values

    def negll(rho):
        t = _tau(x, y, lh, la, rho)
        if np.any(t <= 0):
            return 1e12
        return -np.sum(w * np.log(t))

    return float(minimize_scalar(negll, bounds=(-0.25, 0.25), method="bounded").x)


# ----------------------------------------------------------------- prediction helpers
def expected_goals(elo_gap: float, goals_model: dict) -> float:
    return float(np.exp(goals_model["intercept"] + goals_model["coef"] * elo_gap / 100.0))


def score_matrix(lh: float, la: float, rho: float = 0.0, n: int = 11) -> np.ndarray:
    ph = poisson.pmf(np.arange(n), lh)
    pa = poisson.pmf(np.arange(n), la)
    Mx = np.outer(ph, pa)
    Mx[0, 0] *= 1 - lh * la * rho
    Mx[0, 1] *= 1 + lh * rho
    Mx[1, 0] *= 1 + la * rho
    Mx[1, 1] *= 1 - rho
    Mx = np.clip(Mx, 0.0, None)
    return Mx / Mx.sum()


def outcome_probs(lh: float, la: float, rho: float = 0.0, n: int = 11):
    Mx = score_matrix(lh, la, rho, n)
    return float(np.tril(Mx, -1).sum()), float(np.trace(Mx)), float(np.triu(Mx, 1).sum())


def predict_match(team_a, team_b, ratings, gm, neutral=True):
    ra, rb = ratings.get(team_a, 1500.0), ratings.get(team_b, 1500.0)
    hfa = 0.0 if neutral else HFA
    lam_a = expected_goals(ra - rb + hfa, gm)
    lam_b = expected_goals(rb - ra - hfa, gm)
    pa, pd_, pb = outcome_probs(lam_a, lam_b, gm.get("rho", 0.0))
    return {"xg": (round(lam_a, 2), round(lam_b, 2)),
            "p_win": round(pa, 3), "p_draw": round(pd_, 3), "p_loss": round(pb, 3)}


# --------------------------------------------------------------------------- build
def build(save=True):
    df = load_data()
    ratings, df = compute_elo(df)
    gm = fit_goals_model(df)
    gm["rho"] = fit_rho(df, gm)
    if save:
        out = os.path.dirname(__file__)
        json.dump(ratings, open(os.path.join(out, "ratings.json"), "w"))
        json.dump(gm, open(os.path.join(out, "goals_model.json"), "w"))
    return ratings, gm, df


if __name__ == "__main__":
    ratings, gm, df = build()
    print(f"Goals model: log(xG) = {gm['intercept']:.3f} + {gm['coef']:.3f}*(gap/100)")
    print(f"Dixon-Coles rho = {gm['rho']:.4f}  (negative -> more low-scoring draws)\n")
    for a, b in [("Spain", "Saudi Arabia"), ("Netherlands", "Sweden"),
                 ("Germany", "Ivory Coast")]:
        p = predict_match(a, b, ratings, gm)
        print(f"  {a} vs {b}: xG {p['xg']}  |  "
              f"W {p['p_win']:.0%} / D {p['p_draw']:.0%} / L {p['p_loss']:.0%}")

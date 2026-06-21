"""Temporal holdout: does Dixon-Coles improve out-of-sample accuracy?
Train on matches before a cutoff, test on the most recent 12 months."""
import numpy as np
import pandas as pd
from sklearn.linear_model import PoissonRegressor
import model as M

df = M.load_data()
ratings, df = M.compute_elo(df)                       # causal pre-match Elos
played = df[df.home_score.notna() & df.home_elo_pre.notna()].copy()
cutoff = played.date.max() - pd.Timedelta(days=365)   # last year = test
train, test = played[played.date < cutoff], played[played.date >= cutoff]
print(f"Train matches: {len(train):,}   Test matches (last 12 mo): {len(test):,}\n")

# --- fit goals model + rho on TRAIN only (with time decay) ---
nd = (~train.neutral.values).astype(float)
hg = train.home_elo_pre.values - train.away_elo_pre.values + M.HFA * nd
ag = train.away_elo_pre.values - train.home_elo_pre.values - M.HFA * nd
age = (train.date.max() - train.date).dt.days.values
w = 0.5 ** (age / (365.0 * M.HALF_LIFE_YEARS))
mod = PoissonRegressor(alpha=1e-6, max_iter=500)
mod.fit(np.concatenate([hg, ag]).reshape(-1, 1) / 100.0,
        np.concatenate([train.home_score.values, train.away_score.values]),
        sample_weight=np.concatenate([w, w]))
gm = {"intercept": float(mod.intercept_), "coef": float(mod.coef_[0])}
rho = M.fit_rho(train, gm)
print(f"Fitted on train -> rho = {rho:.4f}\n")

# --- expected goals on TEST ---
ndt = (~test.neutral.values).astype(float)
lh = np.exp(gm["intercept"] + gm["coef"] * (test.home_elo_pre.values - test.away_elo_pre.values + M.HFA * ndt) / 100.0)
la = np.exp(gm["intercept"] + gm["coef"] * (test.away_elo_pre.values - test.home_elo_pre.values - M.HFA * ndt) / 100.0)
hs, as_ = test.home_score.values, test.away_score.values
outcome = np.where(hs > as_, 0, np.where(hs == as_, 1, 2))   # 0 home win, 1 draw, 2 away win

def eval_rho(r):
    P = np.array([M.outcome_probs(lh[k], la[k], r) for k in range(len(test))])
    probs = P[np.arange(len(test)), outcome]
    logloss = -np.mean(np.log(np.clip(probs, 1e-9, 1)))
    acc = np.mean(P.argmax(1) == outcome)
    return logloss, acc, P[:, 1].mean()      # mean predicted draw prob

ll0, acc0, draw0 = eval_rho(0.0)             # independent Poisson
ll1, acc1, draw1 = eval_rho(rho)             # Dixon-Coles
actual_draw = np.mean(outcome == 1)

print(f"{'Metric':<28}{'Independent':>14}{'Dixon-Coles':>14}")
print("-" * 56)
print(f"{'Log-loss (lower=better)':<28}{ll0:>14.4f}{ll1:>14.4f}")
print(f"{'Outcome accuracy':<28}{acc0:>13.1%}{acc1:>13.1%}")
print(f"{'Predicted draw rate':<28}{draw0:>13.1%}{draw1:>13.1%}")
print(f"\nActual draw rate in test set: {actual_draw:.1%}")
print(f"Draw-rate error:  independent {abs(draw0-actual_draw):.1%}  vs  Dixon-Coles {abs(draw1-actual_draw):.1%}")

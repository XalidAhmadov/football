# World Cup 2026 — Match & Tournament Predictor

A football prediction system that forecasts the 2026 FIFA World Cup from 5 years
of international match data. It rates every national team, predicts any matchup,
and runs a Monte Carlo simulation of the full 48-team tournament to produce each
team's odds of advancing and lifting the trophy.

Because the tournament is live, the simulator starts from the **actual current
group standings** and predicts the rest — so the forecast can be checked against
real results as matches are played.

## How it works

**1. Match model (`model.py`) — the engine**
- **Elo ratings** rate each team's strength, updated match-by-match over the full
  history of international results, weighting World Cup games far above friendlies
  (like the official football Elo system) and bigger wins more heavily.
- **Poisson goals model** turns the Elo gap between two teams into expected goals
  for each side, then into win/draw/loss probabilities and full scoreline
  distributions. Two refinements are applied:
  - **Exponential time-decay weighting** — recent matches count for more in
    calibration (2-year half-life).
  - **Dixon-Coles low-score correction** — adds a correlation term (ρ) that fixes
    the well-known tendency of independent Poisson to under-predict low-scoring
    draws (0-0, 1-1).

**2. Tournament simulator (`tournament.py`) — the wrapper**
- Reads the live group state, simulates remaining group games thousands of times,
  computes final standings, and picks the top 2 of each group plus the 8 best
  third-placed teams.
- Applies FIFA's **official 2026 round-of-32 bracket** (including third-place
  slotting) and plays out the knockouts to a champion.
- Aggregates over all simulations into per-team stage-by-stage probabilities.

## Validation (`evaluate.py`)
Out-of-sample test on the most recent 12 months of matches (956 games the model
was not trained on), independent Poisson vs Dixon-Coles:

| Metric                      | Independent | Dixon-Coles |
|-----------------------------|:-----------:|:-----------:|
| Log-loss (lower = better)   |   0.8478    |   0.8464    |
| Outcome accuracy            |    61.6%    |    61.6%    |
| Predicted draw rate         |    21.4%    |    22.3%    |
| (actual draw rate: 23.4%)   |             |             |

Dixon-Coles lowers log-loss and roughly halves the draw-rate calibration error
(2.0% → 1.1%). Accuracy is unchanged because the correction sharpens probabilities
rather than flipping the favorite. The effect on aggregate title odds is small
(within simulation noise) — the gain shows up at the single-match level.

## Data
[`martj42/international_results`](https://github.com/martj42/international_results) —
every international match since 1872, updated continuously. Downloaded automatically
on first run.

## Run it
```bash
pip install -r requirements.txt
python model.py             # build ratings + sample match predictions
python evaluate.py          # holdout validation (independent vs Dixon-Coles)
python tournament.py 20000  # 20,000 tournament simulations -> predictions.json
```

## Modeling choices (transparent simplifications)
- Group tiebreakers: points → goal difference → goals for → random (FIFA then uses
  head-to-head, which rarely changes the top-2/third split).
- The 8 best thirds are slotted via a valid matching of FIFA's published eligibility
  lists rather than the full 495-scenario table; effect on title odds is negligible.
- Knockout draws resolved by a mildly strength-weighted shootout; knockout games
  treated as neutral venues.

## Possible extensions
- Team-specific attack/defense ratings (bivariate Poisson) instead of a single
  Elo-driven rate.
- A live backtest that logs each prediction and scores it against the real result.

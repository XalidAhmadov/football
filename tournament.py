"""
World Cup 2026 - Tournament Simulator (wraps the match model).
Starts from the LIVE group state and Monte-Carlo simulates the rest through to
the champion, using the official FIFA 2026 bracket. Uses the refined match model
(Dixon-Coles + time-decay). Pass use_dc=False to compare against plain Poisson.
"""
import json
from functools import lru_cache
import numpy as np
import pandas as pd
import model as M

GROUPS = {
    "A": {"Mexico", "South Korea", "South Africa", "Czech Republic"},
    "B": {"Canada", "Switzerland", "Qatar", "Bosnia and Herzegovina"},
    "C": {"Brazil", "Morocco", "Scotland", "Haiti"},
    "D": {"United States", "Australia", "Paraguay", "Turkey"},
    "E": {"Germany", "Ecuador", "Ivory Coast", "Curaçao"},
    "F": {"Netherlands", "Japan", "Tunisia", "Sweden"},
    "G": {"Belgium", "Iran", "Egypt", "New Zealand"},
    "H": {"Spain", "Uruguay", "Saudi Arabia", "Cape Verde"},
    "I": {"France", "Senegal", "Norway", "Iraq"},
    "J": {"Argentina", "Austria", "Algeria", "Jordan"},
    "K": {"Portugal", "Colombia", "Uzbekistan", "DR Congo"},
    "L": {"England", "Croatia", "Panama", "Ghana"},
}
R32 = {
    73: (("R", "A"), ("R", "B")), 74: (("W", "E"), ("3", frozenset("ABCDF"))),
    75: (("W", "F"), ("R", "C")), 76: (("W", "C"), ("R", "F")),
    77: (("W", "I"), ("3", frozenset("CDFGH"))), 78: (("R", "E"), ("R", "I")),
    79: (("W", "A"), ("3", frozenset("CEFHI"))), 80: (("W", "L"), ("3", frozenset("EHIJK"))),
    81: (("W", "D"), ("3", frozenset("BEFIJ"))), 82: (("W", "G"), ("3", frozenset("AEHIJ"))),
    83: (("R", "K"), ("R", "L")), 84: (("W", "H"), ("R", "J")),
    85: (("W", "B"), ("3", frozenset("EFGIJ"))), 86: (("W", "J"), ("R", "H")),
    87: (("W", "K"), ("3", frozenset("DEIJL"))), 88: (("R", "D"), ("R", "G")),
}
TREE = {89: (74, 77), 90: (73, 75), 91: (76, 78), 92: (79, 80), 93: (83, 84),
        94: (81, 82), 95: (86, 88), 96: (85, 87), 97: (89, 90), 98: (93, 94),
        99: (91, 92), 100: (95, 96), 101: (97, 98), 102: (99, 100), 104: (101, 102)}
THIRD_SLOTS = [(m, s[1][1]) for m, s in R32.items() if s[1][0] == "3"]
STAGES = ["qualify", "r16", "qf", "sf", "final", "title"]


@lru_cache(maxsize=None)
def _outcome(la_r, lb_r, rho_r):
    return M.outcome_probs(la_r, lb_r, rho_r)


def advance_prob(a, b, ratings, gm, rho):
    ea, eb = ratings[a], ratings[b]
    la = M.expected_goals(ea - eb, gm)
    lb = M.expected_goals(eb - ea, gm)
    pa, pdraw, _ = _outcome(round(la, 2), round(lb, 2), round(rho, 3))
    return pa + pdraw * (1.0 / (1.0 + 10 ** ((eb - ea) / 600.0)))


def assign_thirds(qualified):
    slots = sorted(THIRD_SLOTS, key=lambda s: len(s[1] & qualified))
    out, used = {}, set()
    def bt(i):
        if i == len(slots):
            return True
        m, elig = slots[i]
        for g in sorted(qualified):
            if g not in used and g in elig:
                used.add(g); out[m] = g
                if bt(i + 1):
                    return True
                used.discard(g); out.pop(m, None)
        return False
    if not bt(0):
        for (m, _), g in zip(slots, sorted(qualified)):
            out[m] = g
    return out


def run(n_sims=20000, seed=0, use_dc=True):
    rng = np.random.default_rng(seed)
    ratings, gm, df = M.build(save=False)
    rho = gm["rho"] if use_dc else 0.0

    wc = df[(df.tournament == "FIFA World Cup") & (df.date.dt.year == 2026)].copy()
    team2grp = {t: g for g, ts in GROUPS.items() for t in ts}

    base = {t: [0, 0, 0] for t in team2grp}
    remaining = []
    for r in wc.itertuples(index=False):
        if pd.isna(r.home_score):
            hfa = 0.0 if r.neutral else M.HFA
            lh = M.expected_goals(ratings[r.home_team] - ratings[r.away_team] + hfa, gm)
            la = M.expected_goals(ratings[r.away_team] - ratings[r.home_team] - hfa, gm)
            remaining.append((r.home_team, r.away_team, lh, la))
        else:
            hs, as_ = int(r.home_score), int(r.away_score)
            base[r.home_team][1] += hs - as_; base[r.home_team][2] += hs
            base[r.away_team][1] += as_ - hs; base[r.away_team][2] += as_
            if hs > as_:   base[r.home_team][0] += 3
            elif hs < as_: base[r.away_team][0] += 3
            else:          base[r.home_team][0] += 1; base[r.away_team][0] += 1

    # pre-sample remaining group scorelines from the (DC-corrected) joint distribution
    n_rem = len(remaining)
    H = np.empty((n_rem, n_sims), dtype=np.int64)
    A = np.empty((n_rem, n_sims), dtype=np.int64)
    for i, (_, _, lh, la) in enumerate(remaining):
        mat = M.score_matrix(lh, la, rho)
        side = mat.shape[0]
        idx = rng.choice(mat.size, size=n_sims, p=mat.ravel())
        H[i], A[i] = idx // side, idx % side

    tally = {t: dict.fromkeys(STAGES, 0) for t in team2grp}
    later = list(range(89, 103)) + [104]

    for s in range(n_sims):
        stand = {t: base[t][:] for t in base}
        for i, (h, a, _, _) in enumerate(remaining):
            hs, as_ = int(H[i, s]), int(A[i, s])
            stand[h][1] += hs - as_; stand[h][2] += hs
            stand[a][1] += as_ - hs; stand[a][2] += as_
            if hs > as_:   stand[h][0] += 3
            elif hs < as_: stand[a][0] += 3
            else:          stand[h][0] += 1; stand[a][0] += 1

        winners, runners, thirds, pool = {}, {}, {}, []
        for g, teams in GROUPS.items():
            order = sorted(teams, key=lambda t: (stand[t][0], stand[t][1],
                                                 stand[t][2], rng.random()), reverse=True)
            winners[g], runners[g], thirds[g] = order[0], order[1], order[2]
            pool.append((g, stand[order[2]][0], stand[order[2]][1], stand[order[2]][2]))

        pool.sort(key=lambda x: (x[1], x[2], x[3], rng.random()), reverse=True)
        qual = {g for g, *_ in pool[:8]}
        slot_assign = assign_thirds(qual)

        for g in GROUPS:
            tally[winners[g]]["qualify"] += 1
            tally[runners[g]]["qualify"] += 1
        for g in qual:
            tally[thirds[g]]["qualify"] += 1

        def resolve(slot, m):
            if slot[0] == "W": return winners[slot[1]]
            if slot[0] == "R": return runners[slot[1]]
            return thirds[slot_assign[m]]

        wbm = {}
        for m, (sa, sb) in R32.items():
            ta, tb = resolve(sa, m), resolve(sb, m)
            wbm[m] = ta if rng.random() < advance_prob(ta, tb, ratings, gm, rho) else tb
            tally[wbm[m]]["r16"] += 1
        for m in later:
            ta, tb = wbm[TREE[m][0]], wbm[TREE[m][1]]
            w = ta if rng.random() < advance_prob(ta, tb, ratings, gm, rho) else tb
            wbm[m] = w
            if m <= 96:    tally[w]["qf"] += 1
            elif m <= 100: tally[w]["sf"] += 1
            elif m <= 102: tally[w]["final"] += 1
            else:          tally[w]["title"] += 1

    rows = [{"team": t, "group": team2grp[t], "elo": round(ratings[t]),
             **{k: d[k] / n_sims for k in STAGES}} for t, d in tally.items()]
    rows.sort(key=lambda x: -x["title"])
    return rows


if __name__ == "__main__":
    import sys
    N = int(sys.argv[1]) if len(sys.argv) > 1 else 20000
    rows = run(N, use_dc=True)
    json.dump(rows, open("predictions.json", "w"), indent=2)
    print(f"\nWorld Cup 2026 title odds (refined model, {N:,} sims)\n")
    print(f"{'Team':<22}{'Champion':>10}{'Final':>8}{'QF':>8}{'AdvR32':>9}")
    print("-" * 57)
    for r in rows[:16]:
        print(f"{r['team']:<22}{r['title']:>9.1%}{r['final']:>8.1%}{r['qf']:>8.1%}{r['qualify']:>9.1%}")

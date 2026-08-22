"""Sauvegarde de démonstration pour les captures des stores.

    python3 docs/store/demo-data.py

Écrit `skull-scores-demo.json` à côté de ce fichier. Le document ne contient que
de la saisie brute — mises, plis, bonus : les scores, eux, sont recalculés par
l'app au moment de l'import (`backup-repo.persistScores`), donc les captures
montrent toujours ce que le moteur calcule vraiment.

Quatre joueurs, quatre parties terminées — de quoi remplir statistiques et
classement, qui demandent trois parties — et une partie arrêtée au milieu de la
manche 7, pour l'accueil et les deux écrans de saisie.
"""

import json
import pathlib
import random

random.seed(7)

MS_DAY = 86_400_000
BASE = 1_754_000_000_000  # début août 2026

RULESET = {
    "edition": "current",
    "advancedCards": True,
    "scoring": "classic",
    "rascalCannonball": False,
    "pirateAbilities": True,
    "roundsPlan": list(range(1, 11)),
}

PLAYERS = [
    {"id": 1, "name": "Lou", "emoji": "🦜", "color": "#E8785A"},
    {"id": 2, "name": "Marin", "emoji": "⚓", "color": "#4FA8A0"},
    {"id": 3, "name": "Zoé", "emoji": "🔱", "color": "#D9A24E"},
    {"id": 4, "name": "Ravi", "emoji": "🏴", "color": "#9083C7"},
]

IDS = [p["id"] for p in PLAYERS]

# Chaque joueur a sa main : Lou annonce juste, Ravi surestime, Zoé joue le zéro.
SKILL = {1: 0.72, 2: 0.55, 3: 0.6, 4: 0.42}


def entry(player_id, bid, tricks):
    return {
        "playerId": player_id,
        "bid": bid,
        "tricks": tricks,
        "bidModifier": 0,
        "rascalBet": 0,
        "cannonball": False,
        "customBonus": 0,
    }


def deal_tricks(cards):
    """Répartit `cards` plis entre les quatre joueurs."""
    counts = {i: 0 for i in IDS}
    for _ in range(cards):
        counts[random.choice(IDS)] += 1
    return counts


def bids_for(tricks, cards):
    """Chacun annonce, plus ou moins bien selon sa main."""
    out = {}
    for pid in IDS:
        if random.random() < SKILL[pid]:
            out[pid] = tricks[pid]
        else:
            drift = random.choice([-1, 1])
            out[pid] = max(0, min(cards, tricks[pid] + drift))
    return out


def bonuses_for(round_number, tricks, bids):
    """Quelques captures, seulement là où la mise est tenue — sinon rien ne compte."""
    events = []
    exact = [pid for pid in IDS if bids[pid] == tricks[pid] and tricks[pid] > 0]
    if not exact or round_number < 4:
        return events
    if random.random() < 0.45:
        events.append(
            {"playerId": random.choice(exact), "type": random.choice(
                ["yellow14", "green14", "purple14", "black14"]), "count": 1, "allyPlayerId": None}
        )
    if round_number >= 7 and random.random() < 0.35:
        events.append(
            {"playerId": random.choice(exact),
             "type": random.choice(["mermaidCapturesSkullKing", "skullKingCapturesPirate"])
             if not any(e["type"] in ("mermaidCapturesSkullKing", "skullKingCapturesPirate")
                        for e in events) else "black14",
             "count": 1, "allyPlayerId": None}
        )
    return events


def make_round(round_number, played=True):
    cards = round_number
    tricks = deal_tricks(cards)
    bids = bids_for(tricks, cards)
    return {
        "roundNumber": round_number,
        "cardsDealt": cards,
        "destroyedTricks": 0,
        "forced": False,
        "entries": [
            entry(pid, bids[pid], tricks[pid] if played else None) for pid in IDS
        ],
        "bonusEvents": bonuses_for(round_number, tricks, bids) if played else [],
    }


games = []

# — Quatre parties terminées, étalées sur cinq semaines ————————————————
for index, day in enumerate([2, 9, 16, 23]):
    created = BASE + day * MS_DAY + 20 * 3_600_000
    games.append({
        "id": index + 1,
        "createdAt": created,
        "finishedAt": created + 47 * 60_000,
        "status": "finished",
        "ruleset": RULESET,
        "currentRound": 10,
        "currentPhase": "results",
        "seats": [{"playerId": pid, "seatIndex": i} for i, pid in enumerate(IDS)],
        "rounds": [make_round(n) for n in range(1, 11)],
    })

# — Une partie en cours, arrêtée au milieu de la manche 7 ——————————————
current = BASE + 30 * MS_DAY + 20 * 3_600_000 + 25 * 60_000
rounds = [make_round(n) for n in range(1, 7)]

# La manche 7 : annonces posées, plis en cours de saisie, deux captures.
tricks7 = {1: 3, 2: 2, 3: 2, 4: 0}
bids7 = {1: 3, 2: 2, 3: 1, 4: 0}
rounds.append({
    "roundNumber": 7,
    "cardsDealt": 7,
    "destroyedTricks": 0,
    "forced": False,
    "entries": [entry(pid, bids7[pid], tricks7[pid]) for pid in IDS],
    "bonusEvents": [
        {"playerId": 1, "type": "skullKingCapturesPirate", "count": 1, "allyPlayerId": None},
        {"playerId": 1, "type": "yellow14", "count": 1, "allyPlayerId": None},
        # Pas de sirène sur le Skull King ici : il capture déjà un pirate, et le
        # moteur refuse les deux dans la même manche (§4.2).
        {"playerId": 2, "type": "green14", "count": 1, "allyPlayerId": None},
    ],
})

games.append({
    "id": 5,
    "createdAt": current,
    "finishedAt": None,
    "status": "in_progress",
    "ruleset": RULESET,
    "currentRound": 7,
    "currentPhase": "results",
    "seats": [{"playerId": pid, "seatIndex": i} for i, pid in enumerate(IDS)],
    "rounds": rounds,
})

document = {
    "app": "skull-scores",
    "version": 1,
    "exportedAt": current,
    "players": [
        {**p, "createdAt": BASE, "archivedAt": None} for p in PLAYERS
    ],
    "games": games,
}

out = pathlib.Path(__file__).with_name("skull-scores-demo.json")
out.write_text(json.dumps(document, ensure_ascii=False, indent=2), encoding="utf-8")
print("écrit :", out)

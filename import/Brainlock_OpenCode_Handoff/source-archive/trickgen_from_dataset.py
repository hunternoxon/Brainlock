from __future__ import annotations

import csv
import json
import random
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Dict, List, Optional, Sequence, Set, Tuple


# ------------------------------------------------------------
# Dataset schema (from your Numbers sheet)
# Columns:
#   trick_name, type_variables, stance_variables, level_variables
# ------------------------------------------------------------

LEVEL_ORDER = ["Noob", "Beginner", "Amateur", "Pro", "Sponsd"]
LEVEL_TO_RATING = {
    "Noob": 2,
    "Beginner": 4,
    "Amateur": 6,
    "Pro": 8,
    "Sponsd": 10,
}

# Skill (1-10) determines the highest level we allow.
def max_level_for_skill(skill: int) -> str:
    s = max(1, min(10, int(skill)))
    if s <= 2:
        return "Noob"
    if s <= 4:
        return "Beginner"
    if s <= 6:
        return "Amateur"
    if s <= 8:
        return "Pro"
    return "Sponsd"


def allowed_levels(skill: int) -> Set[str]:
    cap = max_level_for_skill(skill)
    idx = LEVEL_ORDER.index(cap)
    return set(LEVEL_ORDER[: idx + 1])


# Tags are split by '|', for example: "Grind|Combo" => {"Grind","Combo"}
def split_tags(type_variables: str) -> Set[str]:
    return set([t.strip() for t in type_variables.split("|") if t.strip()])


# Obstacle inventory gates which tags can appear in a session.
# You can extend these (quarterpipe, bowl, vert, etc) without changing the dataset.
OBSTACLE_TO_TAGS = {
    "flat": {"Mount", "Flip", "Freestyle"},
    "manual_pad": {"Manual", "Freestyle"},  # manuals often overlap with freestyle-style tricks
    "ledge": {"Grind"},
    "rail": {"Grind"},
    "transition": {"Air", "Stall"},
    "stairs": {"Flip", "Mount"},  # heuristically allow jump/flip lines
}


@dataclass(frozen=True)
class Constraints:
    skill: int = 5
    obstacles: Tuple[str, ...] = ("flat", "ledge", "rail", "manual_pad")

    # Style toggles
    allow_flips: bool = True
    allow_grinds: bool = True
    allow_manuals: bool = True
    allow_freestyle: bool = True
    allow_air: bool = True
    allow_stalls: bool = True

    # Session pacing
    session_length: int = 25
    manual_frequency: float = 0.20
    grind_frequency: float = 0.25

    # Hard excludes
    banned_tricks: Tuple[str, ...] = ()
    banned_words: Tuple[str, ...] = ()

    # If provided, force stance distribution (otherwise dataset stances are fair game)
    allowed_stances: Tuple[str, ...] = ("Normal", "Switch", "Fakie", "Nollie")


@dataclass
class TrickRow:
    trick_name: str
    type_variables: str
    stance_variables: str
    level_variables: str

    @property
    def tags(self) -> Set[str]:
        return split_tags(self.type_variables)

    @property
    def rating(self) -> int:
        base = LEVEL_TO_RATING.get(self.level_variables, 5)
        # Simple bump for combos (keeps pacing more interesting)
        if "Combo" in self.tags:
            base += 1
        return min(10, base)


def load_dataset_csv(path: str | Path) -> List[TrickRow]:
    rows: List[TrickRow] = []
    with open(path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            rows.append(TrickRow(
                trick_name=str(r["trick_name"]).strip(),
                type_variables=str(r["type_variables"]).strip(),
                stance_variables=str(r["stance_variables"]).strip(),
                level_variables=str(r["level_variables"]).strip(),
            ))
    return rows


def violates_banned_words(name: str, banned_words: Set[str]) -> bool:
    lower = name.lower()
    return any(bw.lower() in lower for bw in banned_words)


def allowed_by_obstacles(tags: Set[str], obstacles: Sequence[str]) -> bool:
    allowed_tag_pool: Set[str] = set()
    for o in obstacles:
        allowed_tag_pool |= OBSTACLE_TO_TAGS.get(o, set())
    # If a trick has ANY primary tag that is incompatible, reject it.
    primary = {"Mount", "Flip", "Grind", "Manual", "Freestyle", "Air", "Stall"}
    primary_present = tags & primary
    if not primary_present:
        return False
    return len(primary_present & allowed_tag_pool) > 0


def passes_style_toggles(tags: Set[str], c: Constraints) -> bool:
    if "Flip" in tags and not c.allow_flips:
        return False
    if "Grind" in tags and not c.allow_grinds:
        return False
    if "Manual" in tags and not c.allow_manuals:
        return False
    if "Freestyle" in tags and not c.allow_freestyle:
        return False
    if "Air" in tags and not c.allow_air:
        return False
    if "Stall" in tags and not c.allow_stalls:
        return False
    return True


def choose_with_pacing(rng: random.Random, pool: List[TrickRow], desired: Dict[str, int]) -> Optional[TrickRow]:
    # desired counts by primary tag: Manual, Grind, etc
    # We bias selection if we still need to hit quota.
    if not pool:
        return None

    # Build weights
    weights: List[float] = []
    for tr in pool:
        tags = tr.tags
        w = 1.0

        # Make underrepresented categories more likely
        for key, remaining in desired.items():
            if remaining > 0 and key in tags:
                w *= 1.6

        # Slight bias to keep rating near current pace (handled outside too)
        w *= 1.0 + (tr.rating * 0.05)

        weights.append(w)

    return rng.choices(pool, weights=weights, k=1)[0]


def generate_session(
    dataset: List[TrickRow],
    constraints: Constraints,
    seed: Optional[int] = None
) -> Dict:
    rng = random.Random(seed)
    c = constraints

    allowed_lvls = allowed_levels(c.skill)
    banned_tricks = set([t.lower() for t in c.banned_tricks])
    banned_words = set(c.banned_words)
    allowed_stances = set(c.allowed_stances)

    # Initial filter
    base_pool: List[TrickRow] = []
    for tr in dataset:
        if tr.level_variables not in allowed_lvls:
            continue
        if tr.stance_variables not in allowed_stances:
            continue
        if tr.trick_name.lower() in banned_tricks:
            continue
        if violates_banned_words(tr.trick_name, banned_words):
            continue
        if not allowed_by_obstacles(tr.tags, c.obstacles):
            continue
        if not passes_style_toggles(tr.tags, c):
            continue
        base_pool.append(tr)

    # Quotas for pacing
    manual_target = max(0, int(round(c.session_length * c.manual_frequency)))
    grind_target = max(0, int(round(c.session_length * c.grind_frequency)))
    desired = {
        "Manual": manual_target,
        "Grind": grind_target,
    }

    # Difficulty pacing: easy-mid-hard
    def band(r: int) -> str:
        if r <= 4:
            return "easy"
        if r <= 7:
            return "mid"
        return "hard"

    targets = {
        "easy": max(1, int(round(c.session_length * 0.25))),
        "mid": max(1, int(round(c.session_length * 0.55))),
        "hard": max(1, c.session_length - max(1, int(round(c.session_length * 0.25))) - max(1, int(round(c.session_length * 0.55)))),
    }
    counts = {"easy": 0, "mid": 0, "hard": 0}

    # De-dupe by trick_name
    seen: Set[str] = set()
    session: List[TrickRow] = []

    attempts = 0
    max_attempts = c.session_length * 200

    while len(session) < c.session_length and attempts < max_attempts:
        attempts += 1

        # Prefer tricks that help us hit quotas
        candidate = choose_with_pacing(rng, base_pool, desired)
        if candidate is None:
            break

        if candidate.trick_name in seen:
            continue

        b = band(candidate.rating)

        # Soft enforcement of difficulty distribution
        if counts[b] >= targets[b]:
            if rng.random() < 0.60:
                continue

        # Accept
        seen.add(candidate.trick_name)
        session.append(candidate)
        counts[b] += 1

        # Reduce desired counters
        for k in list(desired.keys()):
            if desired[k] > 0 and k in candidate.tags:
                desired[k] -= 1

    return {
        "seed": seed,
        "constraints": asdict(constraints),
        "pool_size": len(base_pool),
        "difficulty_counts": counts,
        "tricks": [
            {
                "trick_name": t.trick_name,
                "type_variables": t.type_variables,
                "stance_variables": t.stance_variables,
                "level_variables": t.level_variables,
                "tags": sorted(list(t.tags)),
                "rating": t.rating,
            }
            for t in session
        ],
    }


if __name__ == "__main__":
    # Example usage:
    dataset_path = Path(__file__).with_name("goskateboard_tricks_extracted.csv")
    data = load_dataset_csv(dataset_path)

    c = Constraints(
        skill=6,
        obstacles=("flat", "ledge", "rail", "manual_pad"),
        session_length=25,
        manual_frequency=0.20,
        grind_frequency=0.25,
    )

    out = generate_session(data, c, seed=42)
    for i, t in enumerate(out["tricks"], start=1):
        print(f"{i:02d}. {t['trick_name']}  [{t['level_variables']}]  ({t['type_variables']})")

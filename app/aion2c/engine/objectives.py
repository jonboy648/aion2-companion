"""Per-scenario scoring; HP damage and modeled gauge retain separate units."""
from dataclasses import replace

from aion2c.models import CharacterBuild, GameData, Scenario, SimResult, total_rank


def validate_objective(objective: str) -> str:
    if objective not in ("damage", "stagger"):
        raise ValueError(f"unknown objective: {objective!r}; expected 'damage' or 'stagger'")
    return objective


def score(result: SimResult, scenario: Scenario) -> float:
    return result.dps if validate_objective(scenario.objective) == "damage" else result.stagger_per_s


def objective_unit(objective: str) -> str:
    return "DPS" if validate_objective(objective) == "damage" else "gauge/s"


def with_stagger_coverage(result: SimResult, gd: GameData, scenario: Scenario, candidates,
                         build: CharacterBuild) -> SimResult:
    """An uncast candidate with unknown gauge still limits the recommendation.

    Searching away from missing data is not evidence of complete class coverage.
    Keep this independent of whichever cast log wins the search.
    """
    if scenario.objective != "stagger":
        return result
    from aion2c.data.loader import allowed_skills
    from aion2c.engine.simulator import stigma_gates
    from aion2c.specs import active_options

    allowed = {skill.key for skill in allowed_skills(gd, build.region, build.show_kr)}
    gates = stigma_gates(gd)
    missing = []
    seen = set()
    for entry in candidates:
        key, charge = entry.skill_key, entry.charge_level
        while key and (key, charge) not in seen:
            seen.add((key, charge))
            skill = gd.skills.get(key)
            if (skill is None or key not in allowed
                    or skill.unlock_level is not None and skill.unlock_level > build.level
                    or gates.get(key) is not None and gates[key] not in build.stigmas):
                break
            rule = gd.rules.get(key)
            if rule and rule.requires_spec:
                owner, option = rule.requires_spec
                owner_skill = gd.skills.get(owner)
                if owner_skill is None or option not in active_options(
                        gd, build, owner_skill, total_rank(gd, build, owner_skill))[0]:
                    break
            if rule and rule.charge_levels:
                tier = next((level for level in rule.charge_levels if level.level == charge),
                            rule.charge_levels[-1] if charge == 0 else None)
                amount = tier.stagger_gauge if tier else None
            else:
                amount = skill.stagger_gauge
            if amount is None:
                missing.append(f"Stagger amount unavailable: {skill.name}; omitted from gauge score.")
            key, charge = (rule.chain_next if rule else None), 0
    if not missing:
        return result
    return replace(result, warnings=tuple(dict.fromkeys((*result.warnings, *missing))), confidence="unknown")

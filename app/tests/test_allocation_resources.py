"""Resource accounting through the existing browser API, not a refund promise."""
from copy import deepcopy

import pytest

from aion2c import webapi


def test_rank_inventory_does_not_invent_a_refundable_wallet():
    build = {
        "name": "resources", "region": "global", "level": 45,
        "class_key": "sorcerer", "stigma_unlocked": True,
        "skill_ranks": {"flame-arrow": 8, "blaze": 5,
                        "element-enhancement": 3, "steel-barrier": 6},
        "bonus_ranks": {"flame-arrow": 2, "steel-barrier": 1},
        "skill_points": None, "stigma_points": 3,
    }
    before = deepcopy(build)
    response = webapi.level_progression(build)
    ledger = response["allocation_resources"]
    # Independently worked costs: core (13 + 5), stigma (3 + 7).
    assert ledger["rank_cost"] == {"skill": 18, "stigma": 10}
    assert ledger["unspent"] == {"skill": None, "stigma": 3}
    assert ledger["refunds"] == {
        "status": "unverified", "skill": None, "stigma": None,
        "daevanion": None, "battle": None,
    }
    assert ledger["reset_cost"]["amount"] is None
    assert response["budget"]["skill"] == 203  # level baseline stays separate
    assert build == before


def test_chain_followups_do_not_triple_the_heads_point_cost():
    response = webapi.level_progression({
        "name": "chain", "region": "global", "level": 45,
        "class_key": "assassin",
        "skill_ranks": {"quick-slice": 7, "breaking-slice": 7, "swift-slice": 7},
    })
    assert response["allocation_resources"]["rank_cost"] == {"skill": 9, "stigma": 0}


def test_reported_rank_above_paid_cost_table_does_not_become_a_capped_refund():
    ledger = webapi.level_progression({
        "name": "reported bonus", "region": "global", "level": 45,
        "skill_ranks": {"flame-arrow": 11},
    })["allocation_resources"]
    assert ledger["rank_cost"]["skill"] is None
    assert any("flame-arrow" in issue for issue in ledger["issues"])


def test_unknown_rank_source_is_reported_without_inventing_its_currency():
    ledger = webapi.level_progression({
        "name": "unknown", "region": "global", "level": 45,
        "skill_ranks": {"unmapped-skill": 3, "flame-arrow": 5},
    })["allocation_resources"]
    assert ledger["rank_cost"] == {"skill": None, "stigma": None}
    assert any("unmapped-skill" in issue for issue in ledger["issues"])


def test_rank_above_character_level_is_not_reported_as_known_paid_investment():
    response = webapi.level_progression({
        "name": "level gate", "region": "global", "level": 20,
        "skill_ranks": {"flame-arrow": 10},
    })
    assert response["allocation_resources"]["rank_cost"]["skill"] is None
    assert response["allocation_resources"]["issues"]
    assert response["issues"]  # existing legality explanation is retained


def test_missing_acquisition_rows_are_not_purchase_evidence():
    ledger = webapi.level_progression({
        "name": "unknown acquisition", "region": "global", "level": 45,
        "skill_ranks": {"firebomb": 3},
    })["allocation_resources"]
    assert ledger["rank_cost"]["skill"] is None
    assert any("acquisition" in issue for issue in ledger["issues"])


def test_node_inventory_separates_currencies_and_does_not_charge_for_starts():
    build = {
        "name": "boards", "region": "global", "level": 45,
        # Source witnesses:4875/5444 are free starts;4867/5433 cost1 in their own pool.
        "daevanion_nodes": [4875, 4867, 4867, 5444, 5433],
    }
    before = deepcopy(build)
    ledger = webapi.level_progression(build)["allocation_resources"]
    assert ledger["node_cost"] == {"daevanion": 1, "battle": 1}
    assert build == before


def test_unknown_node_does_not_get_silently_ignored_or_assigned_a_currency():
    ledger = webapi.level_progression({
        "name": "new node", "region": "global", "level": 45,
        "daevanion_nodes": [4867, 99999999],
    })["allocation_resources"]
    assert ledger["node_cost"] == {"daevanion": None, "battle": None}
    assert ledger["issues"]


def test_disconnected_nodes_do_not_claim_a_valid_known_pool():
    ledger = webapi.level_progression({
        "name": "disconnected", "region": "global", "level": 45,
        "daevanion_nodes": [4866],  # needs4867 to reach Nezekan's start4875
    })["allocation_resources"]
    assert ledger["node_cost"] == {"daevanion": None, "battle": 0}
    assert any("connected" in issue for issue in ledger["issues"])


def test_nodes_on_a_locked_board_do_not_claim_legal_owned_points():
    ledger = webapi.level_progression({
        "name": "locked board", "region": "global", "level": 11,
        "daevanion_nodes": [4867],  # Nezekan opens at12
    })["allocation_resources"]
    assert ledger["node_cost"]["daevanion"] is None
    assert any("level" in issue for issue in ledger["issues"])


def test_global_acquisition_data_does_not_certify_korean_paid_costs():
    ledger = webapi.level_progression({
        "name": "regional evidence", "region": "korea", "level": 45,
        "skill_ranks": {"flame-arrow": 8},
    })["allocation_resources"]
    assert ledger["rank_cost"]["skill"] is None
    assert any("Global" in issue for issue in ledger["issues"])


def test_unacquired_entries_and_missing_defaults_are_not_purchases():
    ledger = webapi.level_progression({
        "name": "not acquired", "region": "global", "level": 45,
        "skill_ranks": {"unmapped-skill": 0, "firebomb": 0},
        "stigmas": ["element-enhancement"],
    })["allocation_resources"]
    assert ledger["rank_cost"] == {"skill": 0, "stigma": 0}


def test_negative_rank_does_not_slice_the_cost_table_from_its_end():
    ledger = webapi.level_progression({
        "name": "invalid rank", "region": "global", "level": 45,
        "skill_ranks": {"flame-arrow": -1},
    })["allocation_resources"]
    assert ledger["rank_cost"]["skill"] is None
    assert ledger["issues"]


@pytest.mark.parametrize("rank", [True, 1.5, "2", None])
def test_noninteger_rank_payload_is_rejected_with_a_clear_api_error(rank):
    with pytest.raises(ValueError, match="ranks.*integer"):
        webapi.level_progression({
            "name": "invalid type", "region": "global", "level": 45,
            "skill_ranks": {"flame-arrow": rank},
        })


@pytest.mark.parametrize("pool", ["skill", "stigma"])
@pytest.mark.parametrize("points", [-1, True, 1.5, "3"])
def test_invalid_unspent_values_stay_unknown_instead_of_becoming_a_wallet(pool, points):
    ledger = webapi.level_progression({
        "name": "invalid wallet", "region": "global", "level": 45,
        f"{pool}_points": points,
    })["allocation_resources"]
    assert ledger["unspent"][pool] is None
    assert any(f"{pool} points" in issue for issue in ledger["issues"])


def test_locked_stigma_ranks_are_not_a_verified_paid_pool():
    response = webapi.level_progression({
        "name": "locked stigmas", "region": "global", "level": 45,
        "stigma_unlocked": False, "skill_ranks": {"element-enhancement": 3},
    })
    assert response["allocation_resources"]["rank_cost"]["stigma"] is None
    assert response["allocation_resources"]["issues"]
    assert response["issues"]


def test_requested_rank_needs_its_own_acquisition_row_not_just_a_skill_schedule():
    ledger = webapi.level_progression({
        "name": "partial acquisition", "region": "global", "level": 45,
        "skill_ranks": {"dodge": 10},  # the source only grants rank1
    })["allocation_resources"]
    assert ledger["rank_cost"]["skill"] is None
    assert any("acquisition" in issue for issue in ledger["issues"])


def test_global_board_costs_are_not_certified_for_korean_characters():
    ledger = webapi.level_progression({
        "name": "regional board", "region": "korea", "level": 45,
        "daevanion_nodes": [4867],
    })["allocation_resources"]
    assert ledger["node_cost"] == {"daevanion": None, "battle": 0}
    assert any("Global" in issue for issue in ledger["issues"])

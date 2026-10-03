import pytest

from aion2c.keybinds.layout import recommend_stacks
from aion2c.models import KEY_LABELS, Priority, PriorityEntry


def pr(*keys):
    return Priority(tuple(PriorityEntry(k) for k in keys))


BIG = ("element-enhancement", "hellfire", "blaze", "firestorm", "frost-burst", "winters-shackles", "flame-arrow")


def cd(gd, k):
    return gd.skills[k].ranks[0].cooldown_s.value


def test_stack_max4(sorc_gd, default_build, sorc_bar):
    stacks = recommend_stacks(sorc_gd, default_build, pr(*BIG), sorc_bar)
    assert stacks
    assert all(1 <= len(s.stack) <= 4 for s in stacks)
    assert all(s.key_label in KEY_LABELS for s in stacks)
    assert len({s.key_label for s in stacks}) == len(stacks)
    assert len([s for s in stacks if len(s.stack) > 1]) >= 1


def test_zero_cd_last(sorc_gd, default_build, sorc_bar):
    stacks = recommend_stacks(sorc_gd, default_build, pr(*BIG), sorc_bar)
    for s in stacks:
        for k in s.stack[:-1]:
            assert cd(sorc_gd, k) > 0, (s, k)
    fa = next(s for s in stacks if "flame-arrow" in s.stack)
    assert fa.stack[-1] == "flame-arrow"


def test_manual_not_in_macro(sorc_gd, default_build, sorc_bar):
    stacks = recommend_stacks(sorc_gd, default_build, pr(*BIG), sorc_bar)
    hf = [s for s in stacks if "hellfire" in s.stack]
    assert len(hf) == 1 and hf[0].stack == ("hellfire",)
    assert hf[0].key_label == "4"  # user's label kept


def test_keeps_user_labels(sorc_gd, default_build, sorc_bar):
    stacks = recommend_stacks(sorc_gd, default_build, pr("firestorm", "flame-arrow"), sorc_bar)
    labels = {s.key_label for s in stacks}
    assert labels & {"1", "2"}


def test_chain_children_explicit_when_no_auto_chain(sorc_gd, default_build, sorc_bar):
    p = pr("blaze", "flame-arrow")
    on = recommend_stacks(sorc_gd, default_build, p, sorc_bar, auto_chain=True)
    off = recommend_stacks(sorc_gd, default_build, p, sorc_bar, auto_chain=False)
    assert not any("burst" in s.stack for s in on)
    st = next(s for s in off if "flame-arrow" in s.stack)
    assert st.stack == ("blaze", "pyroclasm", "burst", "flame-arrow")


def test_level_gate_and_unknown_skill(sorc_gd, default_build, sorc_bar):
    import dataclasses

    low = dataclasses.replace(default_build, level=1)
    stacks = recommend_stacks(sorc_gd, low, pr("hellfire", "nope", "flame-arrow"), sorc_bar)
    assert not any("nope" in s.stack for s in stacks)
    assert any("flame-arrow" in s.stack for s in stacks)
    assert all(s.key_label in KEY_LABELS for s in stacks)


@pytest.mark.parametrize("n", [0, 1])
def test_empty_priority(sorc_gd, default_build, sorc_bar, n):
    stacks = recommend_stacks(sorc_gd, default_build, pr(*(["flame-arrow"] * n)), sorc_bar)
    assert all(len(s.stack) <= 4 for s in stacks)

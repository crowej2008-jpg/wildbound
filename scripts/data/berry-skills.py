# R6d: berry skills by star (1-5; the Commons have one fixed skill), hand-ported like the plates and
# trinkets. exec'd by build-kit-overrides.py, which provides the DSL helpers plus berry(id, stars) and
# bnote(text). A berry's star picks one skill (each star's skill replaces the one below). Source texts:
# packages/content/equipment/berries.json (from the dump's _berries note). Readings: PORT-REPORT "Berry skills".

STARS = (1, 2, 3, 4, 5)
ALLIES = {"side": "ally", "rule": "all"}


def per_star(fn, values):
    return {s: fn(*v) if isinstance(v, tuple) else fn(v) for s, v in zip(STARS, values)}


def dodge(tag, hits):
    """'A dodge buff for N hits within 1 turn': a 100 % reduction consumed by the next hit, per hit."""
    return [give(SELF, buff(f"{tag}-{n}", "dmgRdct", 1.0, big=1, consumeOnHit=True)) for n in range(hits)]


# --- the Commons (no stars) ----------------------------------------------------------------------
berry("berry-lum-berry", {1: {"statMods": [{"field": "hp", "add": 500}]}})
berry("berry-mago-berry", {1: {"statMods": [{"field": "pAtk", "add": 100}]}})
berry("berry-oran-berry", {1: {"statMods": [{"field": "sAtk", "add": 100}]}})

# --- Basic ---------------------------------------------------------------------------------------
berry("berry-bergamot-berry", per_star(lambda a: {"triggers": [
    trig("turnStart", [give(SELF, buff("robust", "atkPct", a, stacks=5))], condition={"round": {"from": 3}})]},
    [0.025, 0.04, 0.06, 0.08, 0.1]))

berry("berry-nanab-berry", per_star(lambda below, regen, turns: {"triggers": [
    trig("hpBelow", [heal(SELF, round(regen * turns, 4), "targetMaxHp", over=turns)], hpBelow=below)]},
    [(0.1, 0.05, 2), (0.15, 0.06, 2), (0.2, 0.06, 3), (0.22, 0.08, 3), (0.25, 0.1, 3)]))

berry("berry-florafree-berry", per_star(lambda r: {"triggers": [
    trig("onDeath", [heal(ALLIES, r, "casterSAtk")])]}, [0.5, 0.6, 0.8, 1.0, 1.2]))

berry("berry-peach-berry", per_star(lambda every, hits: {"triggers": [
    trig("turnStart", dodge("shadow-clone", hits), condition={"round": {"from": 4, "every": every}})]},
    [(6, 1), (5, 1), (4, 1), (3, 1), (3, 2)]))
bnote("Dodges (Peach, Cirio) are a one-hit 100 % damage reduction each, for one round (the hit still lands for 1).")


# --- Intermediate / Greater ----------------------------------------------------------------------
def _siphon(ls, boost, boost_turns=3):
    out = {"statMods": [{"field": "lifesteal", "add": ls}]}
    if boost:
        out["triggers"] = [trig("battleStart", [give(SELF, buff("siphon-dmg", "dmgBoost", boost, turns=boost_turns))])]
    return out


berry("berry-petaya-berry", per_star(_siphon, [(0.08, 0), (0.12, 0), (0.12, 0.08), (0.16, 0.12), (0.2, 0.15)]))
berry("berry-strong-dragon-fire-fruit", per_star(_siphon, [(0.1, 0), (0.14, 0), (0.14, 0.12), (0.18, 0.15), (0.22, 0.18)]))
bnote("Siphon Life: the lifesteal is a plain stat for the battle; 'DMG Boost within 3 turns' runs from the start.")


def _counter(below, rate):
    return {"triggers": [
        trig("hpBelow", [give(SELF, buff("berry-thorn", kind="stack", turns=2, stacks=1))], hpBelow=below),
        trig("onHit", [dmg(T, rate=rate, type="P")], condition={"selfHasTag": "berry-thorn"})]}


berry("berry-micle-berry", per_star(_counter, [(0.15, 0.5), (0.15, 0.6), (0.2, 0.7), (0.25, 0.8), (0.25, 1.0)]))
berry("berry-strong-secret-fruit", per_star(_counter, [(0.25, 0.6), (0.25, 0.7), (0.3, 0.8), (0.3, 0.95), (0.4, 1.1)]))


def _wide_defense(share, regen):
    effs = [shield(ALLIES, share, "casterAtk")]
    if regen:
        effs.append(heal(ALLIES, round(regen * 3, 4), "targetMaxHp", over=3))
    return {"triggers": [trig("onDeath", effs)]}


berry("berry-lemon-fruit-intermediate", per_star(_wide_defense, [(0.8, 0), (0.9, 0), (1.0, 0), (1.2, 0.03), (1.5, 0.03)]))
berry("berry-lemon-fruit", per_star(_wide_defense, [(0.9, 0), (1.0, 0), (1.1, 0), (1.35, 0.04), (1.65, 0.05)]))
bnote("Lemon Fruit: the shield is a share of the holder's attack (shields read ATK, not S.ATK alone); its 2 / 3-turn "
      "limit and 'cannot be stacked' are not kept.")

berry("berry-tamato-berry", per_star(lambda below, h: {"triggers": [
    trig("hpBelow", [heal(SELF, h, "targetMaxHp")], hpBelow=below, maxFires=1)]},
    [(0.1, 0.1), (0.15, 0.12), (0.2, 0.15), (0.22, 0.18), (0.25, 0.2)]))


def _tomato(below, h, again):
    effs = [heal(SELF, h, "targetMaxHp")]
    if again:
        effs.append(heal(SELF, round(h * again, 4), "targetMaxHp", over=again))
    return {"triggers": [trig("hpBelow", effs, hpBelow=below)]}


berry("berry-strong-tomato-fruit", per_star(_tomato, [(0.2, 0.12, 0), (0.25, 0.15, 0), (0.25, 0.15, 1), (0.3, 0.18, 1), (0.3, 0.18, 2)]))
bnote("Strong - Tomato Fruit: 'restores it again at the end of the next turn(s)' as a heal over 1 / 2 turns.")


def _refreshing(below, rdct, turns):
    return {"triggers": [trig("hpBelow", [
        {"op": "cleanse", "target": SELF},
        give(SELF, buff("refreshing-immune", kind="immune", turns=turns)),
        give(SELF, buff("refreshing-rdct", "dmgRdct", rdct, turns=turns)),
    ], hpBelow=below)]}


berry("berry-pear-berry", per_star(_refreshing, [(0.1, 0.2, 2), (0.15, 0.25, 2), (0.15, 0.3, 2), (0.2, 0.35, 2), (0.2, 0.35, 3)]))
bnote("Pear Berry: 'immunity to all debuffs' as the control immunity (DoTs and stat cuts still land).")

berry("berry-cheri-berry", per_star(lambda n, a, turns: {"triggers": [trig("onDeath", [
    {"op": "cleanse", "target": {"side": "ally", "rule": "highest_atk", "n": n}},
    give({"side": "ally", "rule": "highest_atk", "n": n}, buff("healing-tinkle-atk", "atkPct", a, turns=turns, stacks=1)),
])]}, [(1, 0.2, 2), (1, 0.25, 2), (1, 0.3, 2), (2, 0.3, 2), (2, 0.3, 3)]))

berry("berry-spelon-berry", per_star(lambda below, c, cp: {"triggers": [trig("hpBelow", [
    give(SELF, buff("focus-energy-crit", "crit", c, turns=3)),
    give(SELF, buff("focus-energy-cp", "critPower", cp, turns=3)),
], hpBelow=below)]}, [(0.1, 0.5, 0.05), (0.1, 0.6, 0.1), (0.12, 0.7, 0.2), (0.15, 0.85, 0.28), (0.15, 1.0, 0.35)]))

berry("berry-cirio-berry", per_star(lambda below, hits: {"triggers": [
    trig("hpBelow", dodge("substitute", hits), hpBelow=below)]},
    [(0.2, 1), (0.25, 1), (0.3, 1), (0.4, 1), (0.5, 2)]))

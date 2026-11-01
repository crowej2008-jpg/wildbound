# R6b part 2: exclusive-trinket skills (Lv 10 / 20 / 30 / 40), hand-ported like the plates. exec'd by
# build-kit-overrides.py, which provides the DSL helpers plus trinket(kid, tiers) and tnote(text). Each tier
# replaces the one below (applyTrinketSkills), so every tier is complete on its own.
# Source texts: scripts/data/trinket-skills-source.json. Readings: docs/PORT-REPORT.md "Trinket skills".

TIERS = (10, 20, 30, 40)


def per_tier(fn, values):
    """{10: fn(v10), 20: fn(v20), ...} from four values (tuples are spread into fn)."""
    return {t: fn(*v) if isinstance(v, tuple) else fn(v) for t, v in zip(TIERS, values)}


ATTACKS = ("afterNormal", "afterBasic", "afterUlt")

# --- batch 1: the meta six (Origin Lugia has no trinket) -------------------------------------------
trinket("god-ash-pikachu", per_tier(lambda amt, turns, n: {"triggers": [
    trig(on, [give(SELF, buff("ruse-basic", "skillBoost", amt, turns=turns, stacks=n))]) for on in ATTACKS]},
    [(0.1, 2, 2), (0.15, 2, 2), (0.15, 10, 3), (0.15, 10, 3)]))
tnote("God Ash-Pikachu (Ruse): the S.DEF ignore (10-35 %) has no effect (DEF has no effect); the Basic Skill "
      "bonus is +x % basic-skill damage per attack, its 'rounds' read as Pikachu's own turns.")

trinket("wobbuffet", per_tier(lambda share: {"triggers": [
    trig("onHit", [{"op": "damage", "target": T, "basis": "eventDamage", "share": share, "trueDamage": True}])]},
    [0.24, 0.48, 0.72, 0.96]))
tnote("Wobbuffet (Mirror Coat): the bounce is true damage of the hit's damage (shield included), to the attacker.")

trinket("greninja", per_tier(lambda amt, undisp: {"triggers": [
    trig("onDealDamage", [give(SELF, buff("shadow-sneak-crit", "crit", amt, turns=5, stacks=1, undisp=undisp)),
                          give(SELF, buff("shadow-sneak-cp", "critPower", amt, turns=5, stacks=1, undisp=undisp))],
         condition={"targetHasTag": "shuriken"})]},
    [(0.1, False), (0.18, False), (0.18, True), (0.25, True)]))


def _mass_healing(hp, regen, turns):
    return {"statMods": [{"field": "hp", "mult": 1 + hp}],
            "triggers": [trig("turnStart", [heal(SELF, regen, "targetMaxHp")], condition={"round": {"until": turns}})]}


trinket("shiny-blastoise", per_tier(_mass_healing, [(0.2, 0.05, 4), (0.28, 0.07, 4), (0.35, 0.1, 5), (0.4, 0.15, 5)]))
tnote("Shiny Blastoise (Mass Healing): 'the first 4 / 5 turns' read as big rounds 1-4 / 1-5.")

trinket("psyduck", per_tier(lambda rate: {"triggers": [
    trig("turnStart", [heal(SELF, rate, "targetMaxHp")], condition={"selfControlled": True})]},
    [0.08, 0.12, 0.16, 0.2]))
tnote("Psyduck (Psycho Shift): the heal is modelled; moving its mitigation buffs to 3 enemies is not (no buff-transfer op).")

trinket("mimikyu", per_tier(lambda amt: {"triggers": [
    trig("afterUlt", [give(SELF, buff("mimikyu-trinket-atk", "atkPct", amt, stacks=4)),
                      give(SELF, buff("mimikyu-trinket-cp", "critPower", amt, stacks=4))])]},
    [0.06, 0.07, 0.08, 0.1]))

# --- batch 2 -------------------------------------------------------------------------------------
trinket("dialga", per_tier(lambda amt: {"triggers": [
    trig("afterUlt", [give(SELF, buff("primal-force", "dmgBoost", amt, stacks=4))])]}, [0.08, 0.1, 0.13, 0.16]))


def _darkrai_ruse(amt, extra):
    t = [trig("turnStart", [give(SELF, buff("darkrai-ruse", "atkPct", amt, turns=10, stacks=8))], condition={"round": {"from": 2}})]
    if extra:
        t.append(trig("turnStart", [give(SELF, buff("darkrai-ruse", "atkPct", amt, turns=10, stacks=8))],
                      condition={"round": {"from": 2}, "selfHasTag": "darkrai-immune"}))
    return {"triggers": t}


trinket("darkrai", per_tier(_darkrai_ruse, [(0.03, False), (0.03, True), (0.04, True), (0.05, True)]))
tnote("Darkrai (Ruse): +x % ATK a turn from round 2, 8 stacks (24-40 %); the extra stack 'while immune to control' "
      "reads a 'darkrai-immune' tag, which nothing gives yet — so it does not fire.")


def _enrage(rage_hit, rage_basic):
    t = [trig("afterUlt", [give(SELF, buff("ho-oh-enrage", kind="stack", turns=2))]),
         trig("onHit", [rage(SELF, rage_hit)], condition={"selfHasTag": "ho-oh-enrage"})]
    if rage_basic:
        t.append(trig("afterBasic", [rage(SELF, rage_basic)]))
    return {"triggers": t}


trinket("ho-oh", per_tier(_enrage, [(50, 0), (75, 75), (100, 100), (100, 125)]))
tnote("Ho-Oh (Enrage): the 'mark' for 2 turns after the ult is the window in which each hit taken gives Rage.")

trinket("groudon", per_tier(lambda c, cp: {"damageMods": [
    {"tag": "groudon-trinket", "crit": c, "critPower": cp, "condition": {"targetClass": "adept"}}]},
    [(0.12, 0.06), (0.16, 0.08), (0.2, 0.1), (0.24, 0.12)]))


def _sleep(below, regen, turns):
    return {"triggers": [trig("hpBelow", [heal(SELF, 0.15, "targetMaxHp"),
                                          heal(SELF, round(regen * turns, 4), "targetMaxHp", over=turns)],
                              hpBelow=below, maxFires=1)]}


trinket("snorlax", per_tier(_sleep, [(0.3, 0.08, 2), (0.35, 0.1, 2), (0.35, 0.1, 3), (0.4, 0.15, 3)]))


def _last_out(amt, sdef):
    return {"triggers": [trig("onHit", [give(T, buff("last-out-cut", "sAtk", -amt, turns=5, stacks=3)),
                                       give(SELF, buff("last-out", "sAtk", amt, turns=5, stacks=3))])]}


trinket("yveltal", per_tier(_last_out, [(0.05, False), (0.1, False), (0.1, True), (0.2, True)]))
tnote("Yveltal (Last out): the S.ATK steal as -x % / +x % S.ATK (5 turns, 3 stacks); the S.DEF half has no effect.")

trinket("lugia", {t: {} for t in TIERS})
tnote("Lugia (Enhanced Lifesteal): not modelled — lifesteal cannot grow with damage taken yet.")

trinket("keldeo", per_tier(lambda share: {"triggers": [
    trig("afterUlt", [{"op": "damage", "target": T, "basis": "targetMaxHp", "share": share}])]},
    [0.04, 0.06, 0.08, 0.12]))
tnote("Keldeo (Unwavering Will): the extra max-HP hit goes to the ult's first target.")

# --- batch 3 -------------------------------------------------------------------------------------
ALLY_ALL = {"side": "ally", "rule": "all"}
_STRIKER = {"targetClass": "striker"}


def _order(below, atk, crit, cp):
    return {"triggers": [trig("onHit", [give(ALLY_ALL, buff("hoopa-order-atk", "atkPct", atk, turns=2, stacks=1), condition=_STRIKER),
                                       give(ALLY_ALL, buff("hoopa-order-crit", "crit", crit, turns=2, stacks=1), condition=_STRIKER),
                                       give(ALLY_ALL, buff("hoopa-order-cp", "critPower", cp, turns=2, stacks=1), condition=_STRIKER)],
                              condition={"selfHpBelow": below})]}


trinket("hoopa", per_tier(_order, [(0.1, 0.05, 0.4, 0.05), (0.15, 0.1, 0.45, 0.1), (0.2, 0.15, 0.5, 0.15), (0.3, 0.25, 0.6, 0.25)]))
trinket("shiny-hoopa", per_tier(_order, [(0.2, 0.05, 0.4, 0.05), (0.3, 0.1, 0.45, 0.1), (0.4, 0.15, 0.4, 0.15), (0.5, 0.25, 0.6, 0.25)]))


def _mewtwo(cp, turns, undisp, bomb):
    t = [trig("battleStart", [give(SELF, buff("mewtwo-trinket-cp", "critPower", cp, turns=turns, undisp=undisp))])]
    if bomb:
        bomb_dot = dot({"rule": "frontline"}, "mental-bomb", 0.8, basis="casterAtk", turns=1, type_="S")
        bomb_dot["dot"]["undispellable"] = True
        t.append(trig("afterUlt", [bomb_dot]))
    return {"triggers": t}


trinket("mewtwo", per_tier(_mewtwo, [(0.1, 4, False, False), (0.15, 4, True, False), (0.2, 5, True, False), (0.25, 6, True, True)]))
trinket("shiny-mewtwo", {40: _mewtwo(0.25, 6, True, True)})
tnote("Mewtwo / Shiny Mewtwo: the Mental Bomb (80 % S.ATK after 3 turns) as a 1-round DoT on the front row; "
      "'no new bomb while held' is not enforced. Shiny Mewtwo's source lists a skill only at Lv 40.")

trinket("jirachi", per_tier(lambda cut: {"triggers": [
    trig("afterUlt", [give(T, buff("universal-power-heal-cut", "receiveHealBoost", -cut, turns=3, stacks=1))])]},
    [0.5, 0.6, 0.7, 0.75]))
tnote("Jirachi (Predict Future): the healing cut goes on the ult's first target for 3 turns; the Doom Desire boost has "
      "no effect (Doom Desire's detonation is not modelled).")

trinket("solgaleo", per_tier(lambda amt: {"triggers": [
    trig("turnStart", [give(SELF, buff("cosmic-power-atk", "atkPct", amt, stacks=7)),
                       give(SELF, buff("cosmic-power-cp", "critPower", amt, stacks=7))])]},
    [0.02, 0.03, 0.05, 0.07]))
tnote("Solgaleo (Cosmic Power): 'must hit' has no effect (no dodge).")

trinket("meloetta", per_tier(lambda amt: {"triggers": [
    trig("onDealDamage", [give(SELF, buff("dream-shake", "atkPct", amt, stacks=10))])]},
    [0.02, 0.03, 0.04, 0.05]))

trinket("arceus", per_tier(lambda n: {"triggers": [
    trig("afterUlt", [{"op": "cleanse", "target": SELF, "count": n}])]}, [1, 2, 3, 4]))
tnote("Arceus (Refresh): the S.DEF ignore below 50 % HP has no effect (DEF has no effect).")

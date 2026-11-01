# R6a part 2: plate skills (tiers 6 / 12 / 18), hand-ported like E3. exec'd by build-kit-overrides.py,
# which provides the DSL helpers and plate(kid, tiers). Source texts: plate-skills-source.json.
# Readings and approximations are listed in docs/PORT-REPORT.md ("Plate skills").
BACK = {"side": "ally", "rule": "all", "rowFilter": "back"}
ON_ULT = {"eventSlot": "ult"}

plate("god-ash-pikachu", {
    6: {"damageMods": [{"tag": "plate-shield-breaker", "dmg": 0.3, "condition": {"targetShielded": True}}]},
    12: {"triggers": [trig("afterUlt", [
        dmg({"rule": "random", "n": 2}, rate=1.35, type="S"),
        give({"rule": "random", "n": 2}, buff("pika-heal-cut", "receiveHealBoost", -0.5, turns=2)),
    ])]},
    18: {"triggers": [trig("afterUlt", [
        give(T, buff("pika-heal-block", "receiveHealBoost", -1.0, turns=2)),
        give(T, buff("pika-rage-block", kind="rageBlock", turns=1)),
    ], chance=0.3)]},
})

plate("wobbuffet", {
    6: {"triggers": [trig("afterUlt", [heal(SELF, 0.2, "targetMaxHp")])]},
    12: {"skills": {"ult": skill("S", 1.8, "row", counter=True)}},
    18: {"counterShare": 0.8},
})

plate("greninja", {
    6: {"triggers": [trig("onCrit", [dmg(T, rate=0.7, type="P", trueDamage=True)], condition=ON_ULT)]},
    12: {"triggers": [trig("onCrit", [{"op": "extraAction", "target": SELF, "slot": "normal"}], perTurn=1,
                           condition={"eventSlot": slot}) for slot in ("normal", "basic")]},
    18: {"triggers": [trig("onCrit", [dmg({"rule": "backline"}, rate=1.35, type="P")], condition={"eventSlot": slot})
                      for slot in ("normal", "basic")]},
})

plate("shiny-blastoise", {
    6: {"skills": {"ult": skill("P", 1.35, "backline", effects=[
        give(SELF, buff("shell-ult", "pRdct", 0.45, turns=4, stacks=1)),
        give(SELF, buff("shell-ult-s", "sRdct", 0.3, turns=4, stacks=1)),
    ])}},
    12: {"triggers": [trig("afterUlt", [
        shield(BACK, 0.24, "casterHp"),
        give(BACK, buff("tide-guard-atk", "atkPct", 0.2, turns=3, stacks=1)),
    ])]},
    18: {},
})

plate("psyduck", {
    6: {"triggers": [trig("afterUlt", [give(T, buff("psy-sdef", "sRdct", -0.3, big=2, stacks=1))])]},
    12: {"damageMods": [{"tag": "psy-plate-ult", "slot": "ult", "dmg": 0.2}, {"tag": "psy-plate-basic", "slot": "basic", "dmg": 0.2}]},
    18: {"skills": {
        "basic": skill("S", 1.0, "frontline", effects=[control(T, "zenControlPlus")]),
        "ult": skill("S", 1.65, "frontline", effects=[control(T, "zenControlPlus")]),
    }},
})


import copy as _copy
_KITS = {}
for _f in ("water", "fire", "grass", "light", "dark"):
    for _k in json.loads((Path(__file__).parents[2] / "packages/content/kits" / f"{_f}.json").read_text()):
        _KITS[_k["id"]] = _k


def base_skill(kid, slot):
    """The kit's own skill (hand port if any, else the shipped kit) — copied, ready to change."""
    src = K[kid]["skills"][slot] if kid in K and "skills" in K[kid] else _KITS[kid]["skills"][slot]
    return _copy.deepcopy(src)


def edited(kid, slot, fn):
    s = base_skill(kid, slot)
    fn(s)
    return s


ALL_ALLIES = {"side": "ally", "rule": "all"}

# --- batch 2 -------------------------------------------------------------------------------------
plate("mimikyu", {
    6: {"skills": {"ult": edited("mimikyu", "ult", lambda s: s.update(rates=[1.35]))}},
    12: {"skills": {"ult": skill("P", 1.35, "all", effects=[
        control(T, "stun", 0.3),
        give(ALL_ALLIES, buff("disguise-rate", "basicRate", 0.2, big=3)),
    ])}},
    18: {"skills": {"basic": skill("P", 1.25, "all", effects=[dmg(T, basis="targetMissingHp", share=0.1)])}},
})

# Dialga: the owner's change fills the whole team's Rage after the ultimate (2026-10-31), so the
# plate's "backline to 300" (12) and "frontline +200" (18) add nothing; 6 doubles the Rage cut.
plate("dialga", {
    6: {"skills": {"ult": edited("dialga", "ult", lambda s: s["effects"][0].update(delta=-400))}},
    12: {},
    18: {},
})


def _darkrai_ult(s):
    s["ignoreDefense"] = 0.18


plate("darkrai", {
    6: {"skills": {"ult": edited("darkrai", "ult", _darkrai_ult)},
        "damageMods": [{"tag": "nightmare-plate", "slot": "ult", "dmg": 0.2, "scale": {"resource": "nightmare"}}]},
    12: {"triggers": [trig("afterUlt", [control(T, "stun", 0.5)], condition={"round": {"from": 2}})]},
    18: {"skills": {"normal": edited("darkrai", "normal", lambda s: s.update(rates=[1.35]))}},
})


def _hooh_rage(s):
    s["effects"][0]["delta"] = -250


def _hooh_fire(s):
    _hooh_rage(s)
    s["effects"][1]["dot"]["share"] = 1.55


plate("ho-oh", {
    6: {"skills": {"basic": edited("ho-oh", "basic", lambda s: s.update(rates=[1.65]))}},
    12: {"skills": {"ult": edited("ho-oh", "ult", _hooh_rage)}},
    18: {"skills": {"ult": edited("ho-oh", "ult", _hooh_fire)}},
})

plate("groudon", {
    6: {"triggers": [trig(on, [rage(T, -500)]) for on in ("afterNormal", "afterBasic", "afterUlt")]},
    12: {"damageMods": [{"tag": "groudon-vs-skill", "dmg": 0.18, "condition": {"targetClass": "adept"}}]},
    18: {"damageMods": [{"tag": "precipice-plate", "slot": "ult", "dmg": 0.15, "scale": "targetRage", "cap": 0.15}]},
})

plate("snorlax", {
    6: {"triggers": [trig("afterUlt", [give(SELF, buff("snorlax-plate-rdct", "dmgRdct", 0.5, turns=1))])]},
    12: {"triggers": [trig("afterUlt", [give(ALL_ALLIES, buff("snorlax-protect", "dmgRdct", 0.7, big=1, consumeOnHit=True))])]},
    18: {"triggers": [trig("afterUlt", [give(SELF, buff("snorlax-dauntless", kind="endure", turns=2))], cooldown=4)]},
})

# --- batch 3 -------------------------------------------------------------------------------------
ENEMY_ALL = {"rule": "all"}

plate("yveltal", {
    6: {"triggers": [trig("afterUlt", [give(ENEMY_ALL, buff("petrify-slow", "spd", -20, turns=2),
                                            condition={"targetHasTag": "petrify"})])]},
    12: {},
    18: {"damageMods": [{"tag": "yveltal-vs-debuffed", "slot": "ult", "dmg": 0.3, "condition": {"targetHasDot": True}}]},
})

plate("lugia", {
    6: {"statMods": [{"field": "lifesteal", "add": 0.12}]},
    12: {},
    18: {"triggers": [trig("afterUlt", [give(ENEMY_ALL, buff("lugia-rdct-down", "dmgRdct", -0.15, turns=2))])]},
})

plate("keldeo", {
    6: {"triggers": [trig("afterUlt", [give(T, buff("keldeo-heal-block", "receiveHealBoost", -1.0, turns=1))], group="keldeo-hb")]},
    12: {"damageMods": [{"tag": "keldeo-vs-shield", "dmg": 0.4, "condition": {"targetShielded": True}}]},
    18: {"dropGroups": ["keldeo-hb"],
         "triggers": [trig("afterUlt", [give(T, buff("keldeo-heal-block", "receiveHealBoost", -1.0, turns=2))], group="keldeo-hb")]},
})

plate("shiny-hoopa", {
    6: {"triggers": [trig("afterUlt", [{"op": "resource", "target": ENEMY_ALL, "tag": "flame", "delta": 1}])]},
    12: {"triggers": [trig("afterUlt", [dot(ENEMY_ALL, "sacred-fire", 1.25, turns=2, stacks=1, type_="S")])]},
    18: {"skills": {"ult": edited("shiny-hoopa", "ult", lambda s: s["effects"][1].update(count=2))}},
})


def _smt_ult(s):
    s["rates"] = [1.2]
    s["ignoreDefense"] = 0.35


plate("shiny-mewtwo", {
    6: {"skills": {"ult": edited("shiny-mewtwo", "ult", _smt_ult)}},
    12: {"damageMods": [
        {"tag": "smt-vs-def", "slot": "ult", "dmg": 0.35, "condition": {"targetClass": "guardian"}},
        {"tag": "smt-vs-atk", "slot": "ult", "dmg": 0.1, "condition": {"targetClass": "striker"}},
    ]},
    18: {"triggers": [trig("afterUlt", [give(SELF, buff("smt-crit", "crit", 0.2, turns=4, stacks=1))])]},
})

# --- batch 4 -------------------------------------------------------------------------------------
plate("hoopa", {
    6: {"triggers": [trig("afterUlt", [{"op": "resource", "target": ENEMY_ALL, "tag": "flame", "delta": 1}])]},
    12: {"triggers": [trig("afterUlt", [dot(ENEMY_ALL, "sacred-fire", 1.25, turns=2, stacks=1, type_="S")])]},
    18: {"skills": {"ult": edited("hoopa", "ult", lambda s: s["effects"][1].update(count=2))}},
})


def _mt_ult(s):
    s["rates"] = [1.0]
    s["ignoreDefense"] = 0.35


plate("mewtwo", {
    6: {"skills": {"ult": edited("mewtwo", "ult", _mt_ult)}},
    12: {"damageMods": [
        {"tag": "mt-vs-def", "slot": "ult", "dmg": 0.35, "condition": {"targetClass": "guardian"}},
        {"tag": "mt-vs-atk", "slot": "ult", "dmg": 0.1, "condition": {"targetClass": "striker"}},
    ]},
    18: {"triggers": [trig("afterUlt", [give(SELF, buff("mt-crit", "crit", 0.2, turns=4, stacks=1))])]},
})

plate("jirachi", {
    6: {"triggers": [trig("afterUlt", [give(T, buff("doom-desire-rdct", "dmgRdct", -0.2, big=1))])]},
    12: {"triggers": [trig("afterBasic", [heal(SELF, 0.3, "targetMissingHp")])]},
    18: {},
})

plate("solgaleo", {
    6: {"triggers": [trig("afterUlt", [give(SELF, buff("solgaleo-crit", "crit", 0.15, stacks=4))])]},
    12: {"skills": {"basic": skill("P", 1.4, "row", ignoreDefense=0.2, effects=[dmg(T, basis="targetMaxHp", share=0.06)])}},
    18: {"triggers": [trig("onCrit", [{"op": "extraAction", "target": SELF, "slot": "basic"}], perTurn=1,
                           condition={"eventSlot": "basic"})]},
})

plate("meloetta", {
    6: {"triggers": [trig("afterUlt", [give(ALL_ALLIES, buff("song-satk", "atkPct", 0.2, turns=2))])]},
    12: {"skills": {"ult": edited("meloetta", "ult", lambda s: s["effects"][0]["buff"].update(amount=0.4))}},
    18: {"triggers": [trig("afterUlt", [control(T, "sleep", 0.3)])]},
})

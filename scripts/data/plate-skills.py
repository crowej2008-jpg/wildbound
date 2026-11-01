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

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

# --- batch 5 -------------------------------------------------------------------------------------
for _kid, _per in (("arceus", 0.02), ("shiny-arceus", 0.05)):
    plate(_kid, {
        6: {"damageMods": [{"tag": f"{_kid}-vs-controlled", "dmg": 0.15, "condition": {"targetControlled": True}}]},
        12: {"triggers": [trig(on, [give(SELF, buff(f"{_kid}-mark-crit", "crit", _per, stacks=20))]) for on in ("afterBasic", "afterUlt")]},
        18: {},
    })


def _kyogre(shield_, heal_, low=None):
    def fn(s):
        for e in s["effects"]:
            if e["op"] == "shield":
                e["share"] = shield_
            if e["op"] == "heal":
                e["rate"] = heal_
        if low:
            extra = []
            for e in s["effects"]:
                if e["op"] in ("shield", "heal"):
                    e["condition"] = {"selfHpAbove": 0.35}
                    hi = _copy.deepcopy(e)
                    hi["condition"] = {"selfHpBelow": 0.35}
                    if hi["op"] == "shield":
                        hi["share"] = low[0]
                    else:
                        hi["rate"] = low[1]
                    extra.append(hi)
            s["effects"] += extra
    return fn


for _kid in ("kyogre", "shiny-kyogre"):
    plate(_kid, {
        6: {"skills": {"ult": edited(_kid, "ult", _kyogre(1.5, 0.3))}},
        12: {"skills": {"ult": edited(_kid, "ult", _kyogre(1.5, 0.45))}},
        18: {"skills": {"ult": edited(_kid, "ult", _kyogre(1.5, 0.45, low=(1.8, 0.6)) if _kid == "kyogre" else _kyogre(1.8, 0.6))}},
    })

plate("deoxys", {
    6: {"triggers": [trig("afterUlt", [give(T, buff("deoxys-taunt-atk", "atkPct", -0.15, turns=1))], group="deoxys-atk")]},
    12: {"skills": {"ult": edited("deoxys", "ult", lambda s: s.update(rates=[2.1]))}},
    18: {"dropGroups": ["deoxys-atk"], "triggers": [trig("afterUlt", [
        give(T, buff("deoxys-taunt-atk", "atkPct", -0.15, big=1)),
        give(T, buff("deoxys-taunt-atk-2", "atkPct", -0.15, big=2)),
    ], group="deoxys-atk")]},
})

# --- batch 6 -------------------------------------------------------------------------------------
def _silence(chance):
    def fn(s):
        for e in s["effects"]:
            if e["op"] == "control" and e["control"]["kind"] == "silence":
                e["control"]["chance"] = chance
    return fn


for _kid, _sil in (("mew", 0.7), ("shiny-mew", 0.5)):
    plate(_kid, {
        6: {"triggers": [trig("afterUlt", [give(SELF, buff(f"{_kid}-ctrl", "controlBoost", 0.2, turns=3, stacks=2))])]},
        12: {"triggers": [trig("afterUlt", [give(SELF, buff(f"{_kid}-immune", kind="immune", turns=2))], chance=0.7)]},
        18: {"skills": {"ult": edited(_kid, "ult", _silence(_sil))},
             "triggers": [trig("afterUlt", [rage(SELF, 500)], chance=0.5)]},
    })


def _shields(share):
    def fn(s):
        for e in s.get("effects", []):
            if e["op"] == "shield":
                e["share"] = share
    return fn


for _kid, _rdct, _sh in (("cresselia", 0.1, 2.0), ("shiny-cresselia", 0.12, 2.4)):
    _basic = edited(_kid, "basic", _shields(_sh))
    _normal = base_skill(_kid, "normal")
    _normal["effects"] = _normal.get("effects", []) + [e for e in _basic["effects"] if e["op"] == "shield"]
    plate(_kid, {
        6: {"triggers": [trig("afterUlt", [give(ALL_ALLIES, buff(f"{_kid}-rdct", "dmgRdct", _rdct, turns=2))])]},
        12: {"skills": {"basic": _basic, "normal": _normal}},
        18: {"triggers": [trig("afterUlt", [control({"rule": "random", "n": 1}, "stun", 0.5)])]},
    })

plate("celebi", {
    6: {},
    12: {"triggers": [trig("afterUlt", [give(BACK, buff("celebi-atk", "atkPct", 0.12, turns=2))])]},
    18: {"triggers": [trig("afterUlt", [rage({"side": "ally", "rule": "random", "n": 3, "excludeSelf": True}, 250)])]},
})

plate("manaphy", {
    6: {"triggers": [trig("afterUlt", [give(ALL_ALLIES, buff("manaphy-crit", "crit", 0.15, turns=2)),
                                       give(ALL_ALLIES, buff("manaphy-critpow", "critPower", 0.1, turns=2))])]},
    12: {"triggers": [trig("afterUlt", [{"op": "dispel", "target": T, "count": 99}])]},
    18: {"triggers": [trig("afterUlt", [heal(ALL_ALLIES, 0.8, "casterSAtk")])]},
})

# --- batch 7 -------------------------------------------------------------------------------------
ATTACKS = ("afterNormal", "afterBasic", "afterUlt")
FROST = {"targetHasTag": "frost"}

plate("infernape", {
    6: {},
    12: {"triggers": [trig(on, [dot(T, "flame", 0.45, turns=2, stacks=3, type_="S"),
                                dot(T, "flame", 0.45, turns=2, stacks=3, type_="S", chance=0.5)]) for on in ("afterNormal", "afterBasic")]},
    18: {"triggers": [trig(on, [dmg(T, basis="casterCurrentHp", share=0.1, condition={"targetHasTag": "critSeal"})]) for on in ATTACKS]},
})


def _frost_hits(chance):
    return [trig(on, [dmg(ENEMY_ALL, rate=0.6, type="S", condition=FROST),
                      control(ENEMY_ALL, "freeze", chance, condition=FROST)], group="kyurem-frost") for on in ATTACKS]


for _kid in ("black-kyurem", "shiny-kyurem"):
    plate(_kid, {
        6: {"triggers": _frost_hits(0.15)},
        12: {"dropGroups": ["kyurem-frost"], "triggers": _frost_hits(0.2),
             "skills": {"ult": edited(_kid, "ult", lambda s: s["effects"][0]["control"].update(chance=0.4))}},
        18: {},
    })


def _shaymin_all(s):
    s["rule"] = "all"
    s.pop("targets", None)
    for e in s["effects"]:
        e["target"] = ENEMY_ALL


def _shaymin_seed(s):
    _shaymin_all(s)
    s["effects"][0]["delta"] = 3


plate("shaymin", {
    6: {"skills": {"ult": edited("shaymin", "ult", _shaymin_all)}},
    12: {"skills": {"ult": edited("shaymin", "ult", _shaymin_seed)}},
    18: {"triggers": [trig(on, [give(SELF, buff("shaymin-ctrl-immune", kind="immune", turns=2))]) for on in ATTACKS]},
})

plate("victini", {
    6: {"triggers": [trig("afterUlt", [give(T, buff("victini-critres", "critRes", -0.2, turns=3, stacks=1)),
                                       give(T, buff("victini-block", "block", -0.3, turns=3, stacks=1))])]},
    12: {"triggers": [trig("turnEnd", [rage({"rule": "same_position"}, -250)])]},
    18: {"triggers": [trig(on, [dot(T, "magma-armor", 0.2, turns=3, stacks=6, type_="P", chance=0.5)]) for on in ATTACKS]},
})

plate("palkia", {
    6: {"triggers": [trig("afterUlt", [give(SELF, buff("subspace-rdct", "dmgRdct", 0.5, turns=1))])]},
    12: {"triggers": [trig("afterUlt", [give(SELF, buff("subspace-crit", "crit", 0.2, turns=3, stacks=6)),
                                        give(SELF, buff("subspace-critpow", "critPower", 0.1, turns=3, stacks=6))])]},
    18: {"triggers": [trig("afterUlt", [give(SELF, buff("subspace-steadfast", kind="endure", turns=1))])]},
})

# --- batch 8 -------------------------------------------------------------------------------------
plate("giratina", {
    6: {"statMods": [{"field": "lifesteal", "add": 0.2}]},
    12: {"skills": {"ult": edited("giratina", "ult", lambda s: s.update(ignoreDefense=0.15))}},
    18: {"triggers": [trig("onKill", [rage(SELF, fill=True)]),
                      trig("afterUlt", [give(T, buff("giratina-heal-block", "receiveHealBoost", -1.0, big=2))])]},
})

plate("zygarde", {
    6: {"triggers": [trig("afterUlt", [give(SELF, buff("zygarde-rdct", "dmgRdct", 0.15, turns=2))])]},
    12: {"triggers": [trig("afterUlt", [give(SELF, buff("zygarde-ult-up", "ultBoost", 0.1, stacks=99))])]},
    18: {"triggers": [trig("afterUlt", [heal(SELF, 0.08, "targetMissingHp", condition={"selfHpBelow": 0.5})])]},
})

plate("xerneas", {
    6: {"triggers": [trig("afterUlt", [give(SELF, buff("xerneas-crit", "crit", 0.3, turns=3))])]},
    12: {"triggers": [trig("onCrit", [heal(ALL_ALLIES, 1.0, "casterSAtk")], condition=ON_ULT, perTurn=1)]},
    18: {"triggers": [trig("afterUlt", [give(BACK, buff("xerneas-back-crit", "crit", 0.15, turns=3)),
                                        give(BACK, buff("xerneas-back-critpow", "critPower", 0.15, turns=3))])]},
})


def _lunala(stage):
    """Moongeist hit = the ult's SPD cut + shallow sleep (one 50% roll in the port: both effects)."""
    def fn(s):
        for e in s["effects"]:
            if e.get("chance") == 0.5:
                e["chance"] = 0.7
            if e["op"] == "control" and e["control"].get("chance") == 0.5:
                e["control"]["chance"] = 0.7
            if stage >= 18 and e["op"] == "buff" and e["buff"].get("field") == "spd":
                e["buff"]["amount"] = -20
                e["buff"]["bigRounds"] = 2
        if stage >= 12:
            s["effects"].append(give({"event": True}, buff("moongeist-rageblock", kind="rageBlock", big=1), chance=0.7))
    return fn


plate("lunala", {
    6: {"skills": {"ult": edited("lunala", "ult", _lunala(6))}},
    12: {"skills": {"ult": edited("lunala", "ult", _lunala(12))}},
    18: {"skills": {"ult": edited("lunala", "ult", _lunala(18))}},
})

plate("wind-god-pidgeot", {
    6: {"skills": {"ult": edited("wind-god-pidgeot", "ult", lambda s: s.update(rates=[2.5]))}},
    12: {"triggers": [trig("afterUlt", [{"op": "extraAction", "target": SELF, "slot": "ult", "noRage": True}],
                           chance=0.5, perTurn=1, condition={"targetControlled": True})]},
    # Blind (25% miss for 2 turns) has no hit/dodge stat: read as -25% DMG dealt, the expected value.
    18: {"skills": {"basic": edited("wind-god-pidgeot", "basic", lambda s: s.setdefault("effects", []).append(
        give({"event": True}, buff("pidgeot-blind", "dmgBoost", -0.25, turns=2), chance=0.6)))}},
})



# --- batch 9 -------------------------------------------------------------------------------------
def _sgap_ult(s):
    s["effects"][0]["buff"]["amount"] = -1.0  # Healing Reduction -> Healing Block


plate("shiny-god-ash-pikachu", {
    6: {"damageMods": [{"tag": "plate-shield-breaker", "dmg": 0.3, "condition": {"targetShielded": True}}]},
    12: {"triggers": [trig("afterUlt", [
        dmg({"rule": "random", "n": 2}, rate=1.6, type="S"),
        give({"rule": "random", "n": 2}, buff("pika-heal-cut-x", "receiveHealBoost", -0.5, turns=2)),
    ])]},
    18: {"skills": {"ult": edited("shiny-god-ash-pikachu", "ult", _sgap_ult)}},
})

_OFFER = {"selfHasTag": "offer-of-power"}
plate("shiny-charizard", {
    6: {"skills": {"ult": edited("shiny-charizard", "ult", lambda s: s["effects"].append(
        give({"event": True}, buff("charizard-vuln", "dmgRdct", -0.2, turns=1, stacks=1))))}},
    12: {"triggers": [trig("afterUlt", [give(SELF, buff("charizard-critpow", "critPower", 0.15, turns=2))]),
                      trig("afterUlt", [give(BACK, buff("blaze-crit-offer", "crit", 0.1, turns=2, stacks=1))],
                           condition=_OFFER)]},
    18: {"damageMods": [{"tag": "charizard-vs-def", "slot": "ult", "dmg": 0.25,
                         "condition": {"targetClass": "guardian", **_OFFER}}]},
})


def _sraichu(stage):
    def fn(s):
        s["rates"] = [1.8]
        for e in s["effects"]:
            if e["op"] == "control" and e["control"]["kind"] == "paralysis":
                e["control"]["chance"] = 0.5
        if stage >= 18:
            s["targets"] = 4
            s["effects"].append(give({"event": True}, buff("short-circuit-ult", kind="rageBlock", big=1), chance=0.7))
    return fn


def _sraichu_basic(s):
    s["rates"] = [1.5]
    s["effects"][0]["control"]["chance"] = 0.5


plate("shiny-raichu", {
    6: {"skills": {"ult": edited("shiny-raichu", "ult", _sraichu(6))}},
    12: {"skills": {"basic": edited("shiny-raichu", "basic", _sraichu_basic)}},
    18: {"skills": {"ult": edited("shiny-raichu", "ult", _sraichu(18))}},
})

plate("shiny-gengar", {
    6: {"damageMods": [{"tag": "sgengar-vs-atk", "slot": "ult", "dmg": 0.3, "condition": {"targetClass": "striker"}},
                       {"tag": "sgengar-vs-skill", "slot": "ult", "dmg": 0.1, "condition": {"targetClass": "adept"}}]},
    12: {"triggers": [trig("afterUlt", [give({"rule": "backline"}, buff("sgengar-ctrlres", "controlRes", -0.2, turns=2, stacks=1)),
                                        control({"rule": "backline"}, "silence")])]},
    18: {"triggers": [trig("afterUlt", [rage(SELF, 150)], condition={"targetControlled": True}, perTurn=1),
                      trig("afterUlt", [rage(T, -400)], condition={"targetControlled": True}, chance=0.35)]},
})


def _poison_ult(kid, sure, extra):
    def fn(s):
        p = next(e for e in s["effects"] if e["op"] == "dot")
        s["effects"] = [_copy.deepcopy(p) for _ in range(sure)] + [{**_copy.deepcopy(p), "chance": extra}]
        if sure >= 3 or kid == "all":
            s["rule"] = "all"
            s.pop("targets", None)
    return fn


plate("shiny-venusaur", {
    6: {"skills": {"ult": edited("shiny-venusaur", "ult", _poison_ult("v", 2, 0.6))}},
    12: {"skills": {"ult": edited("shiny-venusaur", "ult", _poison_ult("all", 2, 0.6))}},
    18: {"skills": {"ult": edited("shiny-venusaur", "ult", _poison_ult("all", 3, 0.8))}},
})


def _sdarkrai(stage):
    def fn(s):
        s["ignoreDefense"] = 0.18
        if stage >= 18:
            s["rates"] = [1.95]
            for e in s["effects"]:
                if e["op"] == "resource" and e["tag"] == "nightmare":
                    e["delta"] = 2
    return fn


plate("shiny-darkrai", {
    6: {"skills": {"ult": edited("shiny-darkrai", "ult", _sdarkrai(6))},
        "damageMods": [{"tag": "nightmare-plate", "slot": "ult", "dmg": 0.05, "scale": {"resource": "nightmare"}}]},
    12: {"triggers": [trig("afterUlt", [control(T, "stun", 0.7)],
                           condition={"selfStackAtLeast": {"tag": "nightmare", "n": 2}})]},
    18: {"skills": {"ult": edited("shiny-darkrai", "ult", _sdarkrai(18))}},
})


# --- batch 10 ------------------------------------------------------------------------------------
def _offer_of_power():
    return trig("afterUlt", [
        {"op": "damage", "target": SELF, "basis": "casterCurrentHp", "share": 0.2, "trueDamage": True},
        rage(SELF, fill=True),
        give(SELF, buff("offer-of-power", "ultBoost", 0.5, turns=2, stacks=1, undisp=True)),
    ], cooldown=4)


def _vs_def(mult):
    return lambda s: s["bonusVs"].update(mult=mult)


def _raikou_ult(s):
    s["effects"][0]["condition"]["targetHpBelow"] = 0.25
    s["effects"].append({**_copy.deepcopy(s["effects"][0]),
                         "condition": {"targetHpBelow": 0.35, "targetClass": "guardian"}})


plate("raikou", {
    6: {"skills": {"normal": edited("raikou", "normal", _vs_def(1.5)), "basic": edited("raikou", "basic", _vs_def(1.5))}},
    12: {"skills": {"ult": edited("raikou", "ult", _raikou_ult)}},
    18: {"triggers": [trig("afterUlt", [{"op": "damage", "target": T, "basis": "targetMissingHp", "share": 0.15,
                                         "trueDamage": True}])]},
})


def _entei(stage):
    def fn(s):
        s["rates"] = [0.95 if stage < 18 else 1.15]
        s["effects"][0]["share"] = 0.1
    return fn


plate("entei", {
    6: {"triggers": [_offer_of_power()]},
    12: {"skills": {"ult": edited("entei", "ult", _entei(12))}},
    18: {"skills": {"ult": edited("entei", "ult", _entei(18))},
         "triggers": [trig("afterUlt", [give(SELF, buff("entei-crit", "crit", 0.15, turns=2)),
                                        give(SELF, buff("entei-critpow", "critPower", 0.08, turns=2))])]},
})

_THORN = {"selfHasTag": "thorn"}
plate("suicune", {
    6: {"skills": {"basic": edited("suicune", "basic", lambda s: s["effects"][0].update(chance=0.5))},
        "triggers": [trig("afterNormal", [give(SELF, buff("thorn", kind="stack", turns=3, stacks=1))], chance=0.1),
                     trig("onHit", [dmg({"event": True}, rate=0.75, type="S", trueDamage=True)], condition=_THORN)]},
    12: {"triggers": [trig("afterUlt", [give(SELF, buff("suicune-block", "block", 0.2, turns=2, stacks=1))]),
                      trig("onHit", [dmg({"event": True}, rate=0.15, type="S", trueDamage=True)], condition=_THORN)]},
    18: {"triggers": [trig("afterUlt", [give(SELF, buff("suicune-rdct", "dmgRdct", 0.25, turns=2, stacks=1))])]},
})


def _zapdos_ult(s):
    s["effects"][0]["control"]["chance"] = 0.35


plate("zapdos", {
    6: {"triggers": [trig("afterUlt", [{"op": "extraAction", "target": SELF, "slot": "normal", "noRage": True}],
                          maxFires=3)]},
    12: {"triggers": [trig("afterUlt", [give({"rule": "frontline"}, buff("zapdos-thunder", kind="stack", turns=2, stacks=1))]),
                      trig("onDealDamage", [dmg({"event": True}, rate=0.3, type="P", trueDamage=True)],
                           condition={"targetHasTag": "zapdos-thunder"})]},
    18: {"skills": {"ult": edited("zapdos", "ult", _zapdos_ult)},
         "damageMods": [{"tag": "zapdos-plate-ult", "slot": "ult", "dmg": 0.35}],
         "triggers": [trig("afterUlt", [give(SELF, buff("zapdos-mult", "dmgBoost", 0.15, turns=3, stacks=1))])]},
})


def _burn_stacks(n, chance=None):
    def fn(s):
        for e in s.get("effects", []):
            if e["op"] == "dot" and e["tag"] == "burning":
                e["dot"]["maxStacks"] = n
                if chance is not None and "chance" in e:
                    e["chance"] = chance
    return fn


plate("moltres", {
    6: {"triggers": [trig("afterUlt", [give({"rule": "backline"}, buff("moltres-burn-amp", "dotTaken", 0.3, turns=10, stacks=1))])]},
    12: {"skills": {"basic": edited("moltres", "basic", _burn_stacks(3)), "ult": edited("moltres", "ult", _burn_stacks(3))}},
    18: {"skills": {"basic": edited("moltres", "basic", _burn_stacks(3, 1.0))},
         "damageMods": [{"tag": "moltres-basic-burn", "slot": "basic", "dmg": 0.28, "condition": {"targetHasTag": "burning"}}],
         "triggers": [trig("onHit", [dot({"event": True}, "burning", 0.3, turns=3, stacks=3, true=True)], chance=0.3)]},
})

plate("articuno", {
    6: {"skills": {"basic": edited("articuno", "basic", lambda s: s["effects"].append(rage({"event": True}, -250)))}},
    12: {"skills": {"ult": edited("articuno", "ult", lambda s: s.update(targets=4))}},
    18: {"skills": {"ult": edited("articuno", "ult", lambda s: s.update(targets=4, lifesteal=0.15))},
         "triggers": [trig("afterUlt", [give(ENEMY_ALL, buff("articuno-slow", "spd", -25, turns=2, stacks=1))])]},
})

# --- readings (docs/PORT-REPORT.md "Plate skills") -----------------------------------------------
note("God Ash-Pikachu 12: the two extra targets are picked at random, separately for the hit and the heal cut.")
note("Greninja 12: the +25 % Crit / Crit Intensity against [Shuriken] targets is not modelled (no per-target crit mod).")
note("Shiny Blastoise 6: 'increases P.ATK DMG RDCT by 50 %' read as x1.5 (30 % -> 45 %); 18 (Regrowth Mark heals him when allies hit marked enemies) not modelled — no ally-hit trigger yet.")
note("Psyduck 6: 'S.DEF -30 %' read as +30 % S.ATK damage taken (sRdct -0.3).")
note("Dialga 12 / 18 (Rage to backline / frontline): no effect — the owner's ultimate already fills the team.")
note("Darkrai 12: 'after 2 [Nightmare] stacks' read as from round 2 on; 18 read as the normal attack at 135 %.")
note("Snorlax 12: one hit at 70 % reduction (consumed on the hit), no damage transfer; 18: endure 2 turns, every 4.")
note("Yveltal 12 (ult burns to 100 %) and Lugia 12 (SKILL allies' DMG Boost — no amount given): not modelled; Yveltal 18 'debuffed' read as carrying a DoT.")
note("Keldeo 12: the 'ignores 20 % DEF' half is not modelled (no per-target DEF ignore on damage mods).")
note("Shiny Hoopa 12: Sacred Fire at Ho-Oh's 125 % S.ATK for 2 turns (the text gives no number).")
note("Shiny Mewtwo 18: 'before the Ultimate' applied right after it (no before-ult trigger), so it helps the next.")
note("Jirachi 18 (Doom Desire's missing-HP damage to 50 %): not modelled (no target-missing-HP damage scale).")
note("Solgaleo 12: the extra-damage line raised to 6 % max HP; 'ignores 20 % P.DEF' as the basic's ignore DEF.")
note("Meloetta 6: 'S.ATK +20 %' as ATK +20 % for 2 turns (no duration given); 18: the sleep chance (not given) is 30 %.")
note("Arceus / Shiny Arceus 6: 'ignores 15 % S.DEF vs controlled' as +15 % damage; 12: Crit per mark as a stack (up to 20) gained with each mark; 18 ('attack and restrain all enemies') not modelled — no restrain kind.")
note("Deoxys 6 gives no amount: -15 % ATK for 1 turn; 18: -30 % in the first round, -15 % in the second.")
note("Cresselia / Shiny Cresselia 12: the shields (200 % / 240 % S.ATK) also come after normal attacks.")
note("Celebi 6 (overheal -> 70 % shield) not modelled — no overheal hook.")
note("Infernape 6 (a Flame layer upgraded to undispellable Blaze) not modelled; 18 without the self HP cost.")
note("Black / Shiny Kyurem 18 (+35 % per target [Frost] stack, then clear it) not modelled — no per-target-stack scale.")
note("Palkia: [Subspace] opens with the ultimate, so its plate effects follow the ultimate.")
note("Giratina 18: 'stays at max Rage after a kill spree' read as a full Rage refill on each kill; the Healing Block is 2 big rounds.")
note("Zygarde 12: +10 % ult boost per ultimate as a stacking buff (cap 99, never expires); 18's 'no HP cost above 50 %' has nothing to remove (the port never charges the 8 % HP), so only the below-50 % 8 % lost-HP heal is modelled.")
note("Xerneas 12: the ult-crit heal (100 % S.ATK, all allies) fires once per turn; the follow-up normal / basic 80 % heal is not modelled.")
note("Lunala: [Moongeist hit] is both ult effects (SPD cut + shallow sleep), so 6 raises both chances to 70 %; 12 adds a 70 % 1-round Rage block.")
note("Wind God Pidgeot 18: Blind (25 % miss, 2 turns) has no hit / dodge stat — read as -25 % DMG dealt, the expected value.")

note("Shiny God Ash-Pikachu: as God Ash-Pikachu (12 at 160 % S.ATK); 18 turns the ult's -50 % healing into a full block.")
note("Shiny Charizard 12: 'before the Ultimate, +15 % Crit INT' applied right after it (no before-ult trigger), 2 turns; the Offer-of-Power backline Crit 15 % -> 25 % as +10 % while Offer of Power is up.")
note("Shiny Raichu 6: 'increase Ultimate damage by 180 %' read as the ult rate to 180 % (from 160 %); 18: [Short Circuit] for 1 round (no duration given).")
note("Shiny Gengar 12: the Silence lands on every ult target, 1 turn (no chance or duration given); 18: the +150 Rage (250 -> 400) once per ult when any target is controlled.")
note("Shiny Venusaur 12 / 18: the ult hits all enemies; poison stacks are separate guaranteed applications plus one chance roll.")
note("Shiny Darkrai 6: Nightmare 15 % -> 20 % per stack (+5 %); 12: the 70 % stun once 2 Nightmare stacks are held.")

note("Raikou 6: the vs-[DEF] bonus on normal / basic read as x1.5 (from x1.3); 18: the 15 % missing-HP true damage lands right after the ult (not at round end, and whether or not it killed).")
note("Entei 12 / 18: 'base damage to 15 % / further +20 %' read as the ult rate +15 / +35 points (80 % -> 95 % -> 115 %); 18's Crit / Crit DMG land after the ult (no before-ult trigger), 2 turns.")
note("Suicune: [Thorn] 60 % -> 135 % -> 150 % as extra true hits (+75 %, +15 %) while Thorn is up; 12's S.DEF steal not modelled (DEF has no effect).")
note("Zapdos 6: 'up to 3 times' read as 3 times a battle; 12: [Thunder]'s extra true damage comes only on Zapdos's own hits (no hook for other attackers); 18's DMG Multiplier as DMG Boost.")
note("Moltres 6: the +30 % taken applies to all DoTs (no per-tag DoT amp); 18: '+100 % stacking chance' — basic burn to 100 %, plus a second 30 % on-hit roll.")
note("Articuno 6: read as the basic skill (the freezing skill).")

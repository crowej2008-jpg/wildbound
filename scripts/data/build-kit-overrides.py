#!/usr/bin/env python3
"""E3: hand ports of the 68 kits whose sheet text the parser could not express (or mis-read).

Writes scripts/data/kit-overrides.json, which scripts/port-skills.mjs applies. Each kit here replaces
its three skills and the entries of its Passive / Talent 3 / Talent 4 rows; Talent 1 (Rage) and
Talent 2 (HP / ATK %) stay parsed. Conventions (docs/ASSUMPTIONS.md #58):
- `T` (the event target) inside a skill means "this skill's own targets".
- A self buff "for N turns" applied during the holder's own action is written N + 1 turns, because
  turns tick at the end of the holder's own turn (same rule as the held items, #57).
- Anything the engine still cannot express is listed in `notModelled` with the sheet's words.

Run: python3 scripts/data/build-kit-overrides.py && node scripts/port-skills.mjs
"""
import json
from pathlib import Path

T = {"event": True}
SELF = {"side": "ally", "rule": "self"}
ALLIES = {"side": "ally", "rule": "all"}
BACK_ALLIES = {"side": "ally", "rule": "all", "rowFilter": "back"}
FRONT_ALLIES = {"side": "ally", "rule": "all", "rowFilter": "front"}
ENEMIES = {"rule": "all"}
CONTROL_KINDS = ["control", "silence", "confusion", "paralysis", "disarm", "noBasic", "noCrit"]


def skill(type_, rates, rule="column", **kw):
    out = {"type": type_, "rates": rates if isinstance(rates, list) else [rates], "rule": rule}
    out.update({k: v for k, v in kw.items() if v is not None})
    return out


def buff(tag, field=None, amount=None, turns=None, big=None, stacks=None, undisp=False, kind="stat", **kw):
    b = {"tag": tag, "kind": kind}
    if field is not None:
        b["field"] = field
    if amount is not None:
        b["amount"] = amount
    if turns is not None:
        b["turns"] = turns
    if big is not None:
        b["bigRounds"] = big
    if stacks is not None:
        b["maxStacks"] = stacks
    if undisp:
        b["undispellable"] = True
    b.update(kw)
    return b


def give(target, b, **kw):
    return {"op": "buff", "target": target, "buff": b, **kw}


def control(target, kind, chance=None, **kw):
    return {"op": "control", "target": target, "control": {"kind": kind, "chance": chance}, **kw}


def dot(target, tag, share, basis="casterAtk", turns=2, stacks=None, true=False, type_=None, **kw):
    d = {"share": share, "basis": basis, "turns": turns}
    if stacks:
        d["maxStacks"] = stacks
    if true:
        d["trueDamage"] = True
    if type_:
        d["type"] = type_
    return {"op": "dot", "target": target, "tag": tag, "dot": d, **kw}


def heal(target, rate, basis, **kw):
    return {"op": "heal", "target": target, "rate": rate, "basis": basis, **kw}


def shield(target, share, basis="casterAtk", **kw):
    return {"op": "shield", "target": target, "share": share, "basis": basis, **kw}


def dmg(target, **kw):
    return {"op": "damage", "target": target, **kw}


def rage(target, delta=None, **kw):
    e = {"op": "rage", "target": target, **kw}
    if delta is not None:
        e["delta"] = delta
    return e


def trig(on, effects=None, **kw):
    t = {"on": on, **kw}
    if effects:
        t["effects"] = effects
    return t


def bundle(crit, critRes, critPower, block, blockPower, guardBreak):
    pairs = [("crit", crit), ("critRes", critRes), ("critPower", critPower), ("block", block),
             ("blockPower", blockPower), ("guardBreak", guardBreak)]
    return [{"field": f, "add": v} for f, v in pairs if v]


def per_turn_dmg(step, cap, tag="tick-dmgBoost"):
    """'each turn increases DMG Boost by X%, capping at Y%'."""
    return trig("turnStart", [give(SELF, buff(tag, "dmgBoost", step, turns=99, stacks=round(cap / step)))])


def engage_rdct(amount=0.12, turns=2):
    """'Gains 12% DMG Reduction upon entering combat for 2 turns'."""
    return trig("battleStart", [give(SELF, buff("engage-dmgRdct", "dmgRdct", amount, turns=turns))])


def ally_rdct_stacks(step, stacks, undisp=True):
    """'Per turn inflicts 1 buff for all allies, each buff provides DMG RDCT by 3%. Stacks up to 4'."""
    return trig("turnStart", [give(ALLIES, buff("ally-dmgRdct", "dmgRdct", step, turns=99, stacks=stacks, undisp=undisp))])


def backline_shield_once(share=0.32):
    """'After the start, adding a shield of 32% of its own HP to the back row of friendly units,
    +50% to the back-row unit in the same column; once per battle'."""
    return trig("battleStart", [
        shield(BACK_ALLIES, share, "casterHp"),
        shield({"side": "ally", "rule": "same_position", "rowFilter": "back"}, share * 0.5, "casterHp"),
    ], maxFires=1)


def offer_of_power(cd=4):
    """[Offer of Power]: after the ultimate — lose 20% current HP, refill Rage, +50% ultimate damage
    for 1 turn; cooldown 4 turns; cannot be dispelled."""
    return trig("afterUlt", [
        dmg(SELF, basis="casterCurrentHp", share=0.2, trueDamage=True),
        rage(SELF, fill=True),
        give(SELF, buff("offer-of-power", "ultBoost", 0.5, turns=2, stacks=1, undisp=True)),
    ], cooldown=cd)


SHEET_SLOTS = ["Basic Attack", "Ult", "Basic Skill", "Passive", "Talent 3", "Talent 4"]
K = {}


def kit(kid, normal, ult, basic, statMods=(), triggers=(), damageMods=(), set_=None, notModelled=()):
    o = {"slots": SHEET_SLOTS, "skills": {"normal": normal, "basic": basic, "ult": ult}}
    if statMods:
        o["statMods"] = list(statMods)
    if triggers:
        o["triggers"] = list(triggers)
    if damageMods:
        o["damageMods"] = list(damageMods)
    if set_:
        o["set"] = set_
    if notModelled:
        o["notModelled"] = list(notModelled)
    K[kid] = o


# ---------------------------------------------------------------- Origins
kit("calyrex",
    skill("P", 1.1),
    skill("P", 1.0, "all", effects=[
        {"op": "resource", "target": T, "tag": "frost", "delta": 1, "max": 1},
        control(SELF, "freeze", condition={"selfStackAtLeast": {"tag": "frost", "n": 1}}),
    ]),
    skill("P", 1.2, effects=[control(T, "freeze", 0.4)]),
    statMods=bundle(0.06, 0.22, 0.06, 0.6, 0.25, 0.15),
    triggers=[
        trig("onHit", [control(T, "freeze")], chance=0.25),
        ally_rdct_stacks(0.05, 4),
        trig("turnStart", [give(ALLIES, buff("leycrest-critRes", "critRes", 0.05, turns=99, stacks=4, endsWithSource=True))]),
    ],
    notModelled=["Ult: 'Freeze yourself … when holding Frost' — read as Calyrex holding Frost (it never gains it itself)"])

kit("necrozma",
    skill("S", 1.3),
    skill("S", 1.1, "all", effects=[{"op": "resource", "target": SELF, "tag": "light-energy", "consume": 99}]),
    skill("S", 1.3, effects=[{"op": "cleanse", "target": {"side": "ally", "rule": "random", "n": 1, "filters": ["controlled"]}, "kinds": CONTROL_KINDS}]),
    statMods=bundle(0.6, 0.3, 0.2, 0.06, 0.06, 0.21),
    triggers=[
        trig("afterNormal", [{"op": "resource", "target": SELF, "tag": "light-energy", "delta": 2}]),
        trig("afterBasic", [{"op": "resource", "target": SELF, "tag": "light-energy", "delta": 2}]),
        trig("roundStart", [give(SELF, buff("round-dmgBoost", "dmgBoost", 0.025, turns=99, stacks=4))]),
        trig("turnStart", [
            {"op": "cleanse", "target": SELF, "kinds": CONTROL_KINDS},
            {"op": "resource", "target": SELF, "tag": "light-energy", "consume": 1},
        ], condition={"selfControlled": True, "selfStackAtLeast": {"tag": "light-energy", "n": 1}}),
    ],
    damageMods=[{"tag": "light-energy", "slot": "ult", "atk": 0.3, "scale": {"resource": "light-energy"}}])

kit("origin-lugia",
    skill("P", 1.1, hasTag="darkness-confinement"),
    skill("P", 1.3, "all", effects=[
        control({"rule": "random", "n": 1, "rowFilter": "back"}, "darkness-confinement", condition={"enemiesAtLeast": 2}),
    ]),
    skill("P", 1.1, hasTag="darkness-confinement", effects=[
        rage(T, -125, condition={"targetHasTag": "darkness-confinement"}),
        give(T, buff("confined-atk", "atkPct", -0.1, turns=2), condition={"targetHasTag": "darkness-confinement"}),
    ]),
    statMods=bundle(0.06, 0.22, 0.06, 0.6, 0.25, 0.15),
    triggers=[
        trig("battleStart", [give(SELF, buff("origin-lugia-endure", kind="endure", undisp=True))]),
        trig("onEndure", [control(SELF, "confinement"), rage(SELF, 150)], maxFires=1),
        ally_rdct_stacks(0.05, 4),
    ],
    damageMods=[{"tag": "origin-lugia-guard", "role": "defend", "type": "P", "dmg": 0.15, "scale": "selfMissingHp", "cap": 0.15}],
    notModelled=[
        "Ult: a confined unit 'takes damage only from Origin Lugia'",
        "Passive: backline allies' 70%-strength copy of the P.ATK damage reduction",
        "Talent 4: the first other ally to take lethal damage stays at 1 HP and is imprisoned; +20 SPD while an imprisoned enemy is on the field",
    ])

kit("origin-rayquaza",
    skill("S", 1.2),
    skill("S", 1.3, "all", effects=[
        give(SELF, buff("rayquaza-guard", "dmgRdct", 0.1, turns=99, stacks=1, consumeOnHit=True)),
        give({"side": "ally", "rule": "all", "hasTag": "delta-link", "excludeSelf": True}, buff("delta-airflow", "dmgRdct", 0.3, turns=99, stacks=2, consumeOnHit=True)),
    ]),
    skill("S", 1.2, "row"),
    statMods=bundle(0.15, 0.32, 0.15, 0.06, 0.06, 0.51),
    triggers=[
        trig("battleStart", [
            give({"side": "ally", "rule": "same_position", "excludeSelf": True}, buff("delta-link", kind="stack", turns=99, undisp=True)),
            give({"side": "ally", "rule": "same_position", "excludeSelf": True}, buff("delta-stream", "dmgRdct", 0.3, turns=99, stacks=1, consumeOnHit=True)),
        ]),
        trig("roundStart", [give(SELF, buff("round-dmgBoost", "dmgBoost", 0.025, turns=99, stacks=4))]),
        trig("onAllyCrit", [dmg(T, rate=0.3, type="S")], condition={"actorHasTag": "delta-link"}),
    ],
    notModelled=[
        "Ult/Passive: the link moves to a new ally when the linked one dies; the link picks 'the closest ally, preferring the one below'",
        "Passive: the linked ally does not drop below 1 HP on its first turn and restores 25% of lost HP from its second turn",
    ])

kit("shadow-mewtwo",
    skill("S", 1.2, "frontline"),
    skill("S", 1.2, "all", effects=[
        dmg(T, basis="targetMaxHp", share=0.12, condition={"targetClass": "guardian"}),
        give({"rule": "all", "rowFilter": "front"}, buff("heal-cut", "receiveHealBoost", -0.3, turns=2)),
        give(SELF, buff("doubled-basic", kind="stack", turns=99)),
    ]),
    skill("S", 1.5, "frontline", effects=[give(T, buff("heal-block", "receiveHealBoost", -1, turns=2))]),
    statMods=bundle(0.15, 0.32, 0.15, 0.06, 0.06, 0.51),
    triggers=[
        trig("afterBasic", [
            {"op": "splash", "target": T, "share": 0.1},
            give(T, buff("deepen", "dmgRdct", -0.1, turns=2, stacks=1)),
            {"op": "dispel", "target": SELF, "kinds": ["doubled-basic"]},
        ]),
    ],
    damageMods=[{"tag": "doubled-basic", "slot": "basic", "atk": 1.0, "condition": {"selfHasTag": "doubled-basic"}}])

kit("zacian",
    skill("S", 1.2, "same_position", effects=[give(SELF, buff("armor-break-atk", "atkPct", 0.2, turns=3), condition={"targetHasTag": "shattered-armor"})]),
    skill("P", 1.5, "row", effects=[dmg(T, basis="casterLostTotal", share=0.4)]),
    skill("P", 1.4, "same_position", effects=[
        give(SELF, buff("armor-break-atk", "atkPct", 0.2, turns=3), condition={"targetHasTag": "shattered-armor"}),
        give(T, buff("shattered-armor", "pDef", -0.1, turns=3, stacks=3)),
        give(T, buff("shattered-armor-s", "sDef", -0.1, turns=3, stacks=3)),
    ]),
    statMods=bundle(0.15, 0.32, 0.15, 0.06, 0.06, 0.51),
    damageMods=[{"tag": "zacian-guard", "role": "defend", "dmg": 0.5, "scale": "selfMissingHp", "cap": 0.3}],
    notModelled=[])

# ---------------------------------------------------------------- Mythics
kit("wind-god-pidgeot",
    skill("P", 1.0),
    skill("P", 2.0, "column", hasTag=None, rowFilter=None, filters=None, effects=None, condition=None),
    skill("P", 1.2, "row"),
    statMods=bundle(0.08, 0.08, 0.11, 0.06, 0.06, 0.38),
    triggers=[per_turn_dmg(0.015, 0.06)],
    notModelled=["Talent 4: +2% permanent DMG Deepening each time an enemy is controlled (4 per round, cap 26%) — 'DMG Deepening' on whom is unclear"])
K["wind-god-pidgeot"]["skills"]["ult"] = skill("P", 2.0, "backline", targets=1)

for kid, ult_rate in (("black-kyurem", 2.5), ("shiny-kyurem", 2.8)):
    frost = [
        dot(T, "frost", 0.3, turns=3, stacks=2, type_="S"),
        give(T, buff("frost-ctrlres", "controlRes", -0.15, turns=3, stacks=2)),
    ]
    talent4 = [trig("onHit", [dot(T, "frost", 0.3, turns=3, stacks=2, type_="S"), give(T, buff("frost-ctrlres", "controlRes", -0.15, turns=3, stacks=2)), control(T, "freeze", chance=0.25)])]
    mods = []
    if kid == "shiny-kyurem":
        talent4[0]["effects"][2] = control(T, "freeze", chance=0.25)
        mods = [{"field": "basicRate", "add": 0.2}]
    kit(kid,
        skill("S", 1.0, "backline", targets=1, effects=frost),
        skill("S", ult_rate, "backline", targets=1, effects=[control(T, "freeze", 0.3)] + frost),
        skill("S", 1.2, "backline", targets=1, effects=[control(T, "freeze")] + frost),
        statMods=bundle(0.45, 0.08, 0.12, 0.06, 0.06, 0.1) + mods,
        triggers=[engage_rdct(0.12, 2)] + talent4)

for kid in ("kyogre", "shiny-kyogre"):
    stacking = kid == "shiny-kyogre"
    kit(kid,
        skill("S", 1.0, effects=[give(T, buff("kyogre-atk", "atkPct", -0.08, turns=1))]),
        skill("S", 0, "column", effects=[
            shield(ALLIES, 1.35, "casterAtk"),
            {"op": "heal", "target": ALLIES, "rate": 0.3, "basis": "casterSAtk", "over": 2},
        ]),
        skill("S", 1.2, effects=[give(T, buff("kyogre-atk", "atkPct", -0.08, turns=1))]),
        statMods=bundle(0.06, 0.38, 0.06, 0.09, 0.09, 0.08),
        triggers=[
            backline_shield_once(),
            trig("turnStart", [give(SELF, buff("tide-guard", "dmgRdct", 0.55, turns=1))], condition={"round": {"from": 3}}),
        ],
        notModelled=[] if stacking else ["Ult: 'the healing effect cannot be stacked' (regen instances always stack)"])
    K[kid]["skills"]["ult"]["rates"] = [0]

for kid, ult_rate, ult_rule, chance, t4 in (
        # Owner 2026-10-31: "every fallen enemy" counts every enemy that falls, not only Mew's kills.
        ("mew", 1.5, "backline", 0.5, trig("onEnemyDeath", [rage(SELF, 250)])),
        ("shiny-mew", 1.0, "all", 0.25, trig("onEnemyDeath", [rage(SELF, 500)]))):
    kit(kid,
        skill("P", 1.0),
        skill("P", ult_rate, ult_rule, effects=[control(T, "silence", chance)]),
        skill("P", 1.2, effects=[control(T, "silence")]),
        statMods=bundle(0.08, 0.08, 0.11, 0.06, 0.06, 0.38),
        triggers=[engage_rdct(), t4])

for kid, ult_rate, shield_share in (("cresselia", 2.1, 1.5), ("shiny-cresselia", 2.3, 1.8)):
    sleepers = [
        control({"rule": "random", "n": 1}, "shallowSleep"),
        control({"rule": "random", "n": 1}, "nap"),
    ]
    kit(kid,
        skill("S", 1.0),
        skill("S", ult_rate, "highest_atk", effects=[control(T, "sleep")] + sleepers + [
            give(T, buff("dream-vuln", "dmgRdct", -0.3, turns=2))]),
        skill("S", 1.2, effects=[
            shield({"side": "ally", "rule": "lowest_hp", "n": 1}, shield_share, "casterAtk"),
            shield(SELF, shield_share, "casterAtk"),
        ]),
        statMods=bundle(0.08, 0.08, 0.11, 0.06, 0.06, 0.38),
        triggers=[engage_rdct(), trig("onHit", [give(T, buff("moon-atk", "atkPct", -0.12, turns=2, stacks=1))])],
        notModelled=["Ult: the Shallow Sleep / Nap victims' +30% damage taken — applied to the Sleep target only; shields 'for 1 turn' last until broken"])

kit("jirachi",
    skill("S", 1.0),
    skill("S", 1.45, "row", effects=[give(T, buff("doom-desire", kind="stack", big=1, undisp=True))]),
    skill("S", 1.45, effects=[give(T, buff("universal-power", kind="stack", turns=4))]),
    statMods=bundle(0.08, 0.08, 0.11, 0.06, 0.06, 0.38),
    triggers=[
        trig("onKill", [give(SELF, buff("wish-satk", "atkPct", 0.2, turns=6))]),
    ],
    notModelled=["Ult: [Doom Desire] 'at the end of this turn deals 25% of lost HP' and [Universal Power] +30% to it — needs a per-target end-of-round detonation"])
K["jirachi"]["triggers"] = [trig("onKill", [give(SELF, buff("wish-satk", "atkPct", 0.2, turns=6))])]

kit("solgaleo",
    skill("P", 1.0),
    skill("P", 1.5, "backline"),
    skill("P", 1.4, "row", effects=[dmg(T, basis="targetMaxHp", share=0.03)]),
    statMods=bundle(0.45, 0.08, 0.12, 0.06, 0.06, 0.1),
    triggers=[
        trig("battleStart", [give(SELF, buff("sunsteel-rage", kind="rageBlock", turns=999, undisp=True))]),
        trig("turnStart", [rage(SELF, fill=True, force=True)], condition={"round": {"from": 2, "every": 3}}),
        trig("afterUlt", [
            give(SELF, buff("sunsteel-basic", "basicRate", 1, turns=4)),
            give(SELF, buff("sunsteel-dmg", "dmgBoost", 0.2, turns=4)),
        ]),
    ],
    notModelled=["Ult: +25% ultimate damage for each target removed (needs per-cast kill counting)"])

kit("lunala",
    skill("S", 1.0),
    skill("S", 1.2, "frontline", effects=[
        give(T, buff("moongeist-spd", "spd", -10, big=1), chance=0.5),
        control(T, "shallowSleep", chance=0.5),
    ]),
    skill("S", 1.5, "highest_spd", filters=["fullRage"], effects=[
        control(T, "stun", chance=None, **{"chance": 0.7}) if False else {"op": "control", "target": T, "control": {"kind": "stun", "chance": None}, "chance": 0.7},
        give(T, buff("ghost-seal", kind="rageBlock", big=1, undisp=True), chance=0.7),
    ]),
    statMods=bundle(0.08, 0.08, 0.11, 0.06, 0.06, 0.38),
    triggers=[
        engage_rdct(),
        trig("battleStart", [give(SELF, buff("lunar-first", "basicRate", 0.6, big=1))]),
    ],
    set_={"basicRate": 0.6},
    notModelled=["Basic Skill: the 70% Ghost Seal applies only when no enemy has full Rage (applied either way); the two rolls are independent"])

kit("deoxys",
    skill("S", 1.0),
    skill("S", 1.9, "row", effects=[control(T, "taunt")]),
    skill("S", 1.2, effects=[give(SELF, buff("deoxys-guard", "dmgRdct", 0.15, turns=3))]),
    statMods=bundle(0.06, 0.08, 0.06, 0.45, 0.125, 0.08),
    triggers=[
        ally_rdct_stacks(0.03, 4),
        trig("turnStart", [{"op": "extraAction", "target": SELF, "slot": "ult", "noRage": True}], condition={"round": {"from": 3, "every": 4}}),
    ],
    notModelled=["Talent 4: the 2-turn mark on the lowest-HP enemy that takes 110% of the damage Deoxys takes"])

kit("meloetta",
    skill("S", 1.0),
    skill("S", 1.4, "backline", effects=[give(ALLIES, buff("song-lifesteal", "lifesteal", 0.2, turns=2))]),
    skill("S", 1.2, "row", effects=[{"op": "breakShield", "target": T, "chance": 0.6}]),
    statMods=bundle(0.45, 0.08, 0.12, 0.06, 0.06, 0.1),
    triggers=[trig("battleStart", [give(SELF, buff("first-song-spd", "spd", 30, turns=99))]),
              trig("afterUlt", [{"op": "dispel", "target": SELF, "kinds": ["first-song-spd"]}], maxFires=1)],
    damageMods=[{"tag": "melody", "dmg": 0.3, "condition": {"targetControlled": True}}])

kit("snorlax",
    skill("P", 1.0, effects=[rage(T, -300)]),
    skill("P", 1.35, "random", targets=3, effects=[rage(T, -500)]),
    skill("P", 1.2, effects=[rage(T, -500)]),
    statMods=bundle(0.06, 0.38, 0.06, 0.09, 0.09, 0.08),
    triggers=[
        backline_shield_once(),
        trig("battleStart", [give(SELF, buff("snorlax-start-spd", "spd", 10, turns=99)), give(SELF, buff("snorlax-start-cr", "controlRes", 0.3, turns=99))]),
        trig("onHit", [heal(SELF, 0.05, "targetMaxHp")], chance=0.5),
    ],
    damageMods=[
        # Owner 2026-10-31: "make it 2% damage per 1% lost" — no cap.
        {"tag": "snorlax-desperation", "slot": "ult", "dmg": 2.0, "scale": "selfMissingHp"},
        {"tag": "snorlax-grit", "slot": "basic", "dmg": 0.3, "condition": {"selfHpBelowTarget": True}},
    ])

kit("psyduck",
    skill("S", 1.0),
    skill("S", 1.65, "frontline", effects=[control(T, "zenControl")]),
    skill("S", 1.0, "frontline", effects=[control(T, "zenControl")]),
    statMods=bundle(0.08, 0.08, 0.11, 0.06, 0.06, 0.38),
    triggers=[engage_rdct()],
    damageMods=[{"tag": "psy-controlled", "slot": "ult", "dmg": 0.5, "condition": {"targetControlled": True}}],
    notModelled=["Talent 4: +10% basic-skill chance and +6% S.ATK per controlled enemy (needs a count of controlled enemies)"])

for kid, share, cap_note, t4 in (("shiny-venusaur", 0.02, "2500%", True), ("venusaur", 0.01, "1250%", False)):
    poison = [
        dot(T, "poison", share, basis="targetMaxHp", turns=10, stacks=25, true=True),
        dot(T, "poison", share, basis="targetMaxHp", turns=10, stacks=25, true=True, chance=0.5),
    ]
    trig_list = [per_turn_dmg(0.02, 0.08)] if t4 else []
    if t4:
        trig_list.append(trig("hpBelow", [dot(ENEMIES, "poison", share, basis="targetMaxHp", turns=10, stacks=25, true=True)] * 4, hpBelow=0.5, maxFires=1))
    kit(kid,
        skill("S", 1.0),
        skill("S", 0.9, "random", targets=4, effects=poison),
        skill("S", 1.2, effects=[dot(T, "poison", share, basis="targetMaxHp", turns=10, stacks=25, true=True)]),
        statMods=bundle(0.1, 0.08, 0.125, 0.06, 0.06, 0.425) if t4 else bundle(0.08, 0, 0.1, 0.06, 0, 0.35),
        triggers=trig_list,
        notModelled=[f"Ult: the poison's total-damage cap ({cap_note} of S.ATK)"])

kit("shiny-blastoise",
    skill("P", 1.0),
    skill("P", 1.35, "backline", effects=[give(SELF, buff("shell-ult", "pRdct", 0.3, turns=4, stacks=1))]),
    skill("P", 1.2, effects=[give(SELF, buff("shell-basic", "pRdct", 0.2, turns=3, stacks=1))]),
    statMods=bundle(0.06, 0.1, 0.06, 0.5, 0.16, 0.1),
    triggers=[
        trig("battleStart", [shield(BACK_ALLIES, 0.36, "casterHp"),
                             shield({"side": "ally", "rule": "same_position", "rowFilter": "back"}, 0.18, "casterHp")], maxFires=1),
        trig("turnStart", [give({"side": "ally", "rule": "all", "rowFilter": "front"}, buff("tide-wall", "dmgRdct", 0.23, big=1))]),
    ],
    notModelled=["Talent 4: 'allies at the same line' read as the front row (Blastoise's own row is not tracked)"])

for kid, crit, rate_t, ult_targets in (("shiny-charizard", 0.15, 1.0, "all"), ("charizard", 0.1, 1.35, "frontline")):
    kit(kid,
        skill("P", 1.0),
        skill("P", rate_t, ult_targets, effects=[give(BACK_ALLIES, buff("blaze-crit", "crit", crit, turns=2, stacks=1))]),
        skill("P", 1.2),
        statMods=bundle(0.5, 0.1, 0.135, 0.06, 0.06, 0.135) if kid == "shiny-charizard" else bundle(0.4, 0.08, 0.1, 0, 0, 0.1),
        triggers=[offer_of_power()] + ([trig("battleStart", [give(SELF, buff("blaze-lifesteal", "lifesteal", 0.24, turns=4))])] if kid == "shiny-charizard" else []))

for kid, rate_u, chance in (("shiny-raichu", 1.6, 0.3), ("raichu", 1.45, 0.15)):
    kit(kid,
        skill("S", 1.0),
        skill("S", rate_u, "random", targets=3, effects=[control(T, "paralysis", chance)]),
        skill("S", 1.2, effects=[control(T, "paralysis", 0.25)]),
        statMods=bundle(0.5, 0.1, 0.135, 0.06, 0.06, 0.135) if kid == "shiny-raichu" else bundle(0.4, 0.08, 0.1, 0, 0, 0.1),
        triggers=[trig("battleStart", [give({"rule": "same_position"}, buff("short-circuit", kind="rageBlock", turns=3, undisp=True))])] if kid == "shiny-raichu" else [])

for kid, normal_rate_buff, ult_rate, ult_heal, basic_extra in (
        ("shiny-god-ash-pikachu", 0.4, 2.1, ("healBoost", -0.5), dmg(T, basis="targetMissingHp", share=0.2)),
        ("god-ash-pikachu", 0.1, 1.85, ("receiveHealBoost", -0.5), dmg(T, basis="targetCurrentHp", share=0.06))):
    rate_buff = buff("pika-rate", "basicRate", normal_rate_buff, turns=11, stacks=2)
    kit(kid,
        skill("S", 1.0, effects=[give(SELF, rate_buff)]),
        skill("S", ult_rate, "lowest_hp", effects=[give(T, buff("pika-heal-cut", "receiveHealBoost", -0.5, turns=2)), give(SELF, rate_buff)]),
        skill("S", 1.25, effects=[basic_extra]),
        statMods=bundle(0.08, 0.08, 0.11, 0.06, 0.06, 0.38),
        triggers=[
            trig("battleStart", [give({"rule": "same_position"}, buff("thunder-mark", "dmgRdct", -0.18, big=2))]),
            trig("onKill", [{"op": "extraAction", "target": SELF, "slot": "normal"}], perTurn=1),
        ],
        notModelled=["Basic Skill: the extra attack fires on any kill this turn, not only of the lowest-HP target"])

kit("mimikyu",
    skill("P", 1.0),
    skill("P", 1.0, "all", effects=[control(T, "stun", 0.15), give(ALLIES, buff("disguise-rate", "basicRate", 0.1, big=2))]),
    skill("P", 0.8, "all"),
    statMods=bundle(0.08, 0.08, 0.11, 0.06, 0.06, 0.38),
    # Owner 2026-10-31: "make the extra attacks give rage" (the sheet: they do not).
    triggers=[trig("afterBasic", [{"op": "extraAction", "target": SELF, "slot": "roll"}], perTurn=1)])

kit("wobbuffet",
    skill("S", 1.0, effects=[give(SELF, buff("wobble-guard", "dmgRdct", 0.15, turns=3))]),
    # E5: Counter — the server reflects 75% of the HP lost last round (kb, 124,772 hits), not the
    # sheet's 50%; a separate HP change that passes shields (engine applyCounterReflect).
    skill("S", 1.6, "row", counter=True),
    skill("S", 1.2, effects=[give(SELF, buff("wobble-guard", "dmgRdct", 0.15, turns=3))]),
    statMods=bundle(0.06, 0.38, 0.06, 0.09, 0.09, 0.08),
    triggers=[ally_rdct_stacks(0.03, 4)],
    set_={"safeguard": {"active": 3, "cycle": 6}})

kit("xerneas",
    skill("S", 1.0),
    skill("S", 1.65, "row", effects=[give(SELF, buff("geomancy-critPower", "critPower", 0.25, turns=2))]),
    skill("S", 1.2),
    statMods=bundle(0.45, 0.08, 0.12, 0.06, 0.06, 0.1),
    triggers=[
        engage_rdct(),
        trig("onCrit", [{"op": "cleanse", "target": SELF, "count": 1}]),
        trig("hpBelow", [heal(ALLIES, 1.2, "casterSAtk"), {"op": "cleanse", "target": ALLIES}], hpBelow=0.5, maxFires=1),
    ],
    notModelled=["Basic Skill purifies 3 debuffs on a crit (the crit trigger cleanses 1 for both slots)",
                 "Ult: the +25% Crit Intensity applies from this ultimate on (buffs land after the hits)"])

kit("giratina",
    skill("S", 1.0),
    skill("S", 2.5, "lowest_hp", recastOnKill={"max": 1}),
    skill("S", 1.35),
    statMods=bundle(0.08, 0.08, 0.11, 0.06, 0.06, 0.38),
    triggers=[trig("onAllyDeath", [give(SELF, buff("distortion-satk", "atkPct", 0.07, turns=99, stacks=3))])])

kit("zygarde",
    skill("P", 1.0),
    skill("P", 1.0, "all", effects=[dmg(T, basis="casterCurrentHp", share=0.08, condition={"selfHpAbove": 0.5})]),
    skill("P", 1.2),
    statMods=bundle(0.06, 0.08, 0.06, 0.45, 0.125, 0.08),
    triggers=[
        backline_shield_once(),
        trig("roundStart", [give(BACK_ALLIES, buff("zygarde-guard", "dmgRdct", 0.04, turns=99, stacks=4))]),
    ],
    damageMods=[{"tag": "zygarde-core", "slot": "basic", "dmg": 0.2, "condition": {"selfHpAboveTarget": True}}],
    notModelled=["Ult: the 8% current HP it spends (the damage to all targets is modelled; the cost is not)"])

kit("palkia",
    skill("P", 1.0),
    skill("P", 1.5, "frontline", effects=[control(T, "taunt"), give(SELF, buff("warp-domain", kind="stack", turns=4))]),
    skill("P", 1.2, effects=[rage(T, -150)]),
    statMods=bundle(0.06, 0.38, 0.06, 0.09, 0.09, 0.08),
    triggers=[
        ally_rdct_stacks(0.03, 4),
        trig("onHit", [give(ALLIES, buff("warp-crit", "crit", 0.1, turns=4, stacks=6)), give(ALLIES, buff("warp-critPower", "critPower", 0.05, turns=4, stacks=6))],
             condition={"selfHasTag": "warp-domain"}),
        trig("onHit", [heal(SELF, 0.1, "targetMaxHp")], condition={"selfHasTag": "warp-domain"}, cooldown=2),
    ],
    notModelled=["Ult: the crit stacks count hits from any enemy, not only the taunted ones"])

kit("dialga",
    skill("P", 1.0),
    # Owner 2026-10-31: the ultimate fills every team member's Rage to the max, Dialga included
    # (after its own cost is paid — see the afterUlt trigger below).
    skill("P", 1.6, "row", effects=[rage(T, -200)]),
    skill("P", 1.35, effects=[rage(SELF, 300)]),
    statMods=bundle(0.08, 0.08, 0.11, 0.06, 0.06, 0.38),
    triggers=[engage_rdct(), trig("afterBasic", [{"op": "extraAction", "target": SELF, "slot": "normal"}], perTurn=1),
              trig("afterUlt", [rage(ALLIES, fill=True)])],
    damageMods=[{"tag": "roar-of-time", "dmg": 0.3, "scale": "selfRage", "cap": 0.3}])

kit("keldeo",
    skill("S", 1.0),
    skill("S", 1.85, "row"),
    skill("S", 1.4, effects=[give(SELF, buff("resolute-satk", "atkPct", 0.1, turns=3))]),
    statMods=bundle(0.08, 0.08, 0.11, 0.06, 0.06, 0.38),
    triggers=[
        trig("onAllyDeath", [{"op": "resource", "target": SELF, "tag": "resolve", "delta": 1, "max": 3}, rage(SELF, 250)]),
        trig("turnStart", [heal(SELF, 0.15, "targetMaxHp", perResource="resolve")], condition={"selfStackAtLeast": {"tag": "resolve", "n": 1}}),
    ],
    damageMods=[
        {"tag": "keldeo-shieldbreak", "slot": "ult", "dmg": 0.3, "condition": {"targetShielded": True}},
        {"tag": "resolve-max", "dmg": 0.45, "condition": {"selfStackAtLeast": {"tag": "resolve", "n": 3}}},
    ])

magma = [dot(T, "magma-armor", 0.2, turns=3, stacks=6, type_="P"),
         give(T, buff("magma-armor-pdef", "pDef", -0.1, turns=3, stacks=6)),
         give(T, buff("magma-armor-sdef", "sDef", -0.1, turns=3, stacks=6))]
kit("victini",
    skill("P", 1.0, effects=magma),
    skill("P", 1.35, "frontline", effects=magma * 3),
    skill("P", 1.2, effects=magma),
    statMods=bundle(0.06, 0.38, 0.06, 0.09, 0.09, 0.08),
    triggers=[ally_rdct_stacks(0.03, 4), trig("battleStart", [shield(BACK_ALLIES, 1.5, "casterAtk")])],
    notModelled=["Magma Armor's DEF cut is its own 6-layer stack beside the DoT (they can fall out of step); the battle-start shield's 2-turn limit"])

kit("infernape",
    skill("S", 1.0),
    skill("S", 0.6, "all", effects=[
        dot(T, "flame", 0.45, turns=2, stacks=3, type_="S"), dot(T, "flame", 0.45, turns=2, stacks=3, type_="S"),
        control(T, "critSeal", 0.75),
    ]),
    skill("S", 1.2, effects=[dot(T, "flame", 0.45, turns=2, stacks=3, type_="S", chance=0.8)]),
    statMods=bundle(0.08, 0.08, 0.11, 0.06, 0.06, 0.38),
    triggers=[
        per_turn_dmg(0.015, 0.06),
        trig("battleStart", [give(SELF, buff("fireproof", kind="immune", turns=999, undisp=True, immuneTo=["burning", "flame"]))]),
        trig("onDealDamage", [give(T, buff("blaze-vuln", "dotTaken", 0.4, turns=2, endsWithSource=True))]),
    ],
    notModelled=["Talent 4: the Flame-damage bonus is a flat 40% (the sheet scales it with Infernape's missing HP up to 40%);"])

kit("greninja",
    skill("P", 1.0, effects=[give(SELF, buff("shinobi-rate", "basicRate", 0.2, turns=3))]),
    skill("P", 1.35, "frontline", effects=[
        give(T, buff("shuriken", "critRes", -0.25, turns=3, stacks=1)),
        give(SELF, buff("shinobi-spd", "spd", 10, turns=3)),
    ]),
    skill("P", 1.35, effects=[give(SELF, buff("shinobi-rate", "basicRate", 0.2, turns=3))]),
    statMods=bundle(0.45, 0.08, 0.12, 0.06, 0.06, 0.1),
    triggers=[
        trig("battleStart", [give(SELF, buff("opening-spd", "spd", 20, turns=1))]),
        trig("onCrit", [dmg(T, rate=0.8, type="P")], condition={"targetHasTag": "shuriken"}),
        trig("onCrit", [heal(SELF, 0.75, "casterAtk"), give(SELF, buff("ninja-crit", "crit", 0.05, turns=999)), give(SELF, buff("ninja-cp", "critPower", 0.05, turns=999))],
             perTurn=1),
    ],
    notModelled=["Talent 4 fires on the first crit of a turn; the sheet needs 2 crits in one turn"])

kit("celebi",
    skill("S", 1.0, effects=[{"op": "heal", "target": {"side": "ally", "rule": "lowest_hp", "n": 1}, "rate": 0.4, "basis": "casterSAtk", "over": 2}]),
    skill("S", 0, "column", effects=[heal(ALLIES, 2.0, "casterSAtk", bonusVs={"condition": {"targetHpBelow": 0.3}, "mult": 1.25})]),
    skill("S", 1.2, effects=[{"op": "heal", "target": {"side": "ally", "rule": "lowest_hp", "n": 1}, "rate": 0.4, "basis": "casterSAtk", "over": 2}]),
    statMods=bundle(0.08, 0.08, 0.11, 0.06, 0.06, 0.38),
    triggers=[engage_rdct(), trig("onHit", [heal(SELF, 0.4, "eventDamage")], chance=0.7)])

kit("ho-oh",
    skill("S", 1.0, effects=[rage(T, -200, chance=0.6)]),
    skill("S", 1.45, "row", effects=[
        rage(T, -150),
        dot(T, "sacred-fire", 1.25, turns=2, stacks=1, type_="S"),
        give(T, buff("sacred-fire-heal", "receiveHealBoost", -0.5, turns=2, stacks=1)),
    ]),
    skill("S", 1.0, "row", effects=[rage({"rule": "random", "n": 1}, -200)]),
    statMods=bundle(0.08, 0.08, 0.11, 0.06, 0.06, 0.38),
    triggers=[trig("onDeath", [dot(ENEMIES, "infinite-fire", 2.0, turns=2, stacks=1, type_="S")])],
    notModelled=["Sacred Fire / Infinite Fire 'ignite after one turn' as one tick at the target's next turn start"])

kit("groudon",
    skill("P", 1.1, "lowest_hp"),
    skill("P", 2.1, "highest_atk", effects=[give(T, buff("no-heal", "receiveHealBoost", -1, turns=2))]),
    skill("P", 1.45, "lowest_hp"),
    statMods=bundle(0.45, 0.08, 0.12, 0.06, 0.06, 0.1),
    triggers=[
        trig("battleStart", [shield(SELF, 1.75, "casterAtk"), give(SELF, buff("drought-dmg", "dmgBoost", 0.1, turns=3))]),
        trig("onKill", [shield(SELF, 1.75, "casterAtk")]),
    ],
    damageMods=[{"tag": "precipice", "slot": "ult", "dmg": 0.35, "scale": "targetRage", "cap": 0.35}])

kit("rayquaza",
    skill("S", 1.0, lifesteal=0.3),
    skill("S", 0.6, "all", effects=[
        give(T, buff("dragon-mark", kind="stack", big=3, undisp=True)),
    ]),
    skill("S", 1.2, lifesteal=0.3),
    statMods=bundle(0.08, 0.08, 0.11, 0.06, 0.06, 0.38),
    triggers=[
        per_turn_dmg(0.015, 0.06),
    ],
    damageMods=[{"tag": "sky-satk", "atk": 0.3, "scale": "selfHp", "cap": 0.3}],
    notModelled=[
        "Ult: the mark's end-of-turn 1 / turn 2 strikes (90% / 115% S.ATK, +25% vs backline, 10% / 60% healing) and 'cannot ultimate while marked'",
    ])
K["rayquaza"]["skills"]["ult"]["effects"] = [give(T, buff("dragon-mark", kind="stack", big=3, undisp=True))]

kit("lugia",
    skill("P", 1.0, effects=[give(SELF, buff("aeroblast-rate", "basicRate", 0.05, turns=999))]),
    skill("P", 1.25, "all", lifesteal=0.08),
    skill("P", 1.0, "frontline", lifesteal=0.08, effects=[give(SELF, buff("aeroblast-rate", "basicRate", 0.05, turns=999))]),
    statMods=bundle(0.08, 0.08, 0.11, 0.06, 0.06, 0.38),
    triggers=[
        per_turn_dmg(0.015, 0.06),
        trig("battleStart", [give(SELF, buff("lugia-endure", kind="endure", undisp=True))]),
        trig("onEndure", [give(SELF, buff("lugia-shelter", kind="invulnerable", big=1, undisp=True))], maxFires=1),
    ],
    damageMods=[{"tag": "lugia-wrath", "dmg": 1.0, "scale": "selfMissingHp", "cap": 1.0}])

kit("entei",
    skill("P", 1.0),
    skill("P", 0.8, "all", effects=[dmg({"rule": "highest_hp", "n": 1}, basis="targetCurrentHp", share=0.08, trueDamage=True)]),
    skill("P", 1.2),
    statMods=bundle(0.45, 0.08, 0.12, 0.06, 0.06, 0.1),
    triggers=[
        trig("battleStart", [give({"rule": "same_position"}, buff("sacred-mark", "dmgRdct", -0.12, turns=2, undisp=True))]),
        trig("onDeath", [give(BACK_ALLIES, buff("entei-crit", "crit", 0.15, turns=2, undisp=True))]),
        trig("onCrit", [dmg({"rule": "random", "n": 1}, basis="targetCurrentHp", share=0.1)], perTurn=1),
    ],
    notModelled=["Ult: 'if it crits' is read per hit of any slot, once a turn"])

kit("suicune",
    skill("S", 1.0),
    skill("S", 2.5, effects=[
        control(ENEMIES, "taunt"),
        give(SELF, buff("thorn", kind="stack", turns=3, stacks=1)),
        # DEF on (owner, 2026-11-01): steals 10% S.DEF (2 turns; the sheet gives no duration).
        give(T, buff("suicune-sdef-steal", "sDef", -0.1, turns=2, stacks=1)),
        give(SELF, buff("suicune-sdef-gain", "sDef", 0.1, turns=2, stacks=1)),
    ]),
    skill("S", 1.2, effects=[give(SELF, buff("thorn", kind="stack", turns=3, stacks=1), chance=0.3)]),
    statMods=bundle(0.06, 0.08, 0.06, 0.45, 0.125, 0.08),
    triggers=[
        ally_rdct_stacks(0.03, 4),
        trig("onHit", [dmg(T, rate=0.6, type="S", trueDamage=True)], condition={"selfHasTag": "thorn"}),
        trig("onHit", [give(T, buff("aurora-gb", "guardBreak", -0.05, turns=2, stacks=1))]),
        trig("onHit", [heal(SELF, 0.12, "targetMaxHp")], perTurn=1),
    ],
    notModelled=["Ult: the 10% S.DEF steal lasts 2 turns (no duration given)", "Talent 4: the heal fires on the first hit of a turn, not the fourth"])

kit("raikou",
    skill("S", 1.0, effects=[give(T, buff("short-circuit", kind="rageBlock", turns=1))],
          bonusVs={"condition": {"targetClass": "guardian"}, "mult": 1.3}),
    skill("S", 2.1, effects=[
        dmg(T, basis="targetCurrentHp", share=1.0, trueDamage=True, condition={"targetHpBelow": 0.2}),
    ]),
    skill("S", 1.2, effects=[give(T, buff("short-circuit", kind="rageBlock", turns=1))],
          bonusVs={"condition": {"targetClass": "guardian"}, "mult": 1.3}),
    statMods=bundle(0.45, 0.08, 0.12, 0.06, 0.06, 0.1),
    triggers=[per_turn_dmg(0.015, 0.06), offer_of_power(),
              trig("onKill", [dmg({"rule": "all"}, rate=1.5, type="S")], perTurn=1)],
    notModelled=["Ult: 'when the target is slain' fires on any kill (once a turn)", "Talent 4: [channeling] focus target"])

kit("moltres",
    skill("P", 1.0),
    skill("P", 1.35, "backline", effects=[dot(T, "burning", 0.3, turns=3, stacks=2, true=True)],
          bonusVs={"condition": {"targetStackAtLeast": {"tag": "burning", "n": 2}}, "mult": 1.35}),
    skill("P", 1.2, effects=[dot(T, "burning", 0.3, turns=3, stacks=2, true=True, chance=0.8)]),
    statMods=bundle(0.08, 0.08, 0.11, 0.06, 0.06, 0.38),
    triggers=[
        trig("battleStart", [give(SELF, buff("fireproof", kind="immune", turns=999, undisp=True, immuneTo=["burning", "flame"]))]),
        trig("battleStart", [dot(ENEMIES, "burning", 0.3, turns=3, stacks=2, true=True)]),
        trig("onHit", [dot(T, "burning", 0.3, turns=3, stacks=2, true=True)], chance=0.3),
    ],
)

kit("articuno",
    skill("S", 1.0),
    skill("S", 1.35, "random", targets=3, effects=[
        control(T, "freeze", 0.18),
        give(SELF, buff("chill-guard", "dmgRdct", 0.1, turns=4, stacks=1)),
        give(SELF, buff("chill-cr", "critRes", 0.1, turns=4, stacks=1)),
    ]),
    skill("S", 1.2, effects=[control(T, "freeze")]),
    statMods=bundle(0.06, 0.38, 0.06, 0.09, 0.09, 0.08),
    triggers=[
        ally_rdct_stacks(0.03, 4),
        trig("battleStart", [give(SELF, buff("ice-body", kind="immune", turns=999, undisp=True, immuneTo=["freeze"]))]),
        trig("onDeath", [control(T, "freeze"), control({"rule": "random", "n": 2}, "freeze")]),
        trig("onHit", [give(ALLIES, buff("frost-boost", "controlBoost", 0.08, turns=3, stacks=2)),
                       give(SELF, buff("frost-boost-self", "controlBoost", 0.12, turns=3, stacks=3))]),
    ],
)

kit("zapdos",
    skill("P", 1.0),
    skill("P", 1.2, "frontline", effects=[control(T, "paralysis", 0.2), give(BACK_ALLIES, buff("zap-crit", "crit", 0.1, big=2))]),
    skill("P", 1.2, effects=[control(T, "paralysis", 0.8)]),
    statMods=bundle(0.45, 0.08, 0.12, 0.06, 0.06, 0.1),
    triggers=[
        trig("battleStart", [give(SELF, buff("zap-spd", "spd", 20, turns=2)), give(SELF, buff("zap-cb", "controlBoost", 0.3, turns=2)),
                             give(SELF, buff("static", kind="immune", turns=999, undisp=True, immuneTo=["paralysis"]))]),
        trig("onHit", [control(T, "paralysis")], chance=0.35),
    ],
)

# ---------------------------------------------------------------- Epics and Rares
kit("gyarados",
    skill("P", 1.0),
    skill("P", 1.9, "row", recastOnKill={"max": 1}, effects=[
        dmg(T, basis="casterLostLastRound", share=0, trueDamage=True, condition={"round": {"from": 99}}),
        give(SELF, buff("gyara-dmg", "dmgBoost", 0.1, turns=3, stacks=1)),
    ]),
    skill("P", 1.2, effects=[rage(T, -125, steal=True, chance=0.5)]),
    statMods=bundle(0.08, 0.08, 0.11, 0.06, 0.06, 0.38),
    triggers=[offer_of_power()],
    damageMods=[{"tag": "gyara-rage", "atk": 0.6, "scale": "selfMissingHp", "cap": 0.5}],
    notModelled=["Ult: the recast is not tied to Offer of Power"])
K["gyarados"]["skills"]["ult"]["effects"] = [
    dmg(T, basis="casterMissingHp", share=0.1, trueDamage=True),
    give(SELF, buff("gyara-dmg", "dmgBoost", 0.1, turns=3, stacks=1)),
]

kit("blaziken",
    skill("S", 1.0),
    skill("S", 2.1, recastOnKill={"max": 1}, effects=[dmg(T, basis="targetMissingHp", share=0.08, trueDamage=True)]),
    skill("S", 1.2),
    statMods=bundle(0.45, 0.08, 0.12, 0.06, 0.06, 0.1),
    triggers=[offer_of_power()],
    notModelled=["Talent 4: the recast is not tied to Offer of Power"])

kit("swampert",
    skill("S", 1.0),
    skill("S", 1.35, "backline", effects=[dot(T, "foresight", 0.8, turns=2, stacks=1, true=True)]),
    skill("S", 1.2, effects=[give(T, buff("foresight", kind="stack", turns=2))]),
    statMods=bundle(0.1, 0.08, 0.125, 0.06, 0.06, 0.425))

kit("sceptile",
    skill("S", 1.0),
    skill("S", 1.9, "row", effects=[
        dot(T, "bleed", 0.2, turns=4, stacks=4, true=True),
        give(T, buff("malignant-wounds", "dotTaken", 0.18, turns=2, stacks=1)),
    ]),
    skill("S", 1.2, effects=[give(T, buff("malignant-wounds", "dotTaken", 0.18, turns=1, stacks=1))]),
    statMods=bundle(0.1, 0.08, 0.125, 0.06, 0.06, 0.425))

kit("feraligatr",
    skill("P", 1.0),
    skill("P", 1.35, "row"),
    skill("P", 1.2, effects=[shield(SELF, 0.05, "casterHp")]),
    statMods=bundle(0.06, 0.1, 0.06, 0.5, 0.16, 0.1),
    notModelled=["Ult: [Protect] — shares 25% of the damage the ally above takes for 2 turns (damage sharing)"])

kit("dragonite",
    skill("S", 1.0),
    skill("S", 1.35, "backline", effects=[{"op": "dispel", "target": T, "count": 1}]),
    skill("S", 1.2, effects=[{"op": "dispel", "target": T, "count": 1}]),
    statMods=bundle(0.5, 0.1, 0.135, 0.06, 0.06, 0.135))

kit("metagross",
    skill("P", 1.0),
    skill("P", 2.1, "backline", targets=1, effects=[control(T, "mindControl", 0.3)]),
    skill("P", 1.2, effects=[control(T, "mindControl")]),
    statMods=bundle(0.06, 0.425, 0.06, 0.09, 0.1, 0.08))

kit("garchomp",
    skill("P", 1.0),
    skill("P", 1.35, "frontline", effects=[give(T, buff("garchomp-pdef-cut", "pDef", -0.35, turns=2, stacks=1)),
                                           give(T, buff("garchomp-sdef-cut", "sDef", -0.35, turns=2, stacks=1))]),
    skill("P", 1.2, effects=[give(T, buff("vulnerability", "dmgRdct", -0.1, turns=2, stacks=1))]),
    statMods=bundle(0.06, 0.425, 0.06, 0.09, 0.1, 0.08),
    notModelled=["Ult: the −35% P.DEF / S.DEF lasts 2 turns (no duration given)"])

kit("hydreigon",
    skill("P", 1.0),
    skill("P", 1.9, "row", bonusVs={"condition": {"targetHasDot": True}, "mult": 1.2},
          effects=[give(SELF, buff("hydra-dmg", "dmgBoost", 0.1, turns=3, stacks=1))]),
    skill("P", 1.2, bonusVs={"condition": {"targetHasDot": True}, "mult": 1.18}),
    statMods=bundle(0.1, 0.08, 0.125, 0.06, 0.06, 0.425),
    triggers=[trig("battleStart", [give(BACK_ALLIES, buff("hydra-crit", "crit", 0.18, turns=2)), give(BACK_ALLIES, buff("hydra-cp", "critPower", 0.09, turns=2))])])

kit("gardevoir",
    skill("S", 1.0),
    skill("S", 1.35, "frontline", ignoreDefense=0.1, effects=[give(ALLIES, buff("gardevoir-atk", "atkPct", 0.1, turns=10, stacks=3))]),
    skill("S", 1.2, ignoreDefense=0.1),
    statMods=bundle(0.08, 0.08, 0.11, 0.06, 0.06, 0.38) + [{"field": "sRdct", "add": 0.25}, {"field": "pRdct", "add": 0.1}])

kit("slaking",
    skill("P", 1.0),
    skill("P", 1.9, "random", targets=2, effects=[
        {"op": "heal", "target": SELF, "rate": 0.03, "basis": "targetMaxHp", "over": 3},
        {"op": "heal", "target": {"side": "ally", "rule": "lowest_hp", "n": 1}, "rate": 0.03, "basis": "targetMaxHp", "over": 3, "condition": {"targetHasDot": True}},
    ]),
    skill("P", 1.2),
    statMods=bundle(0.06, 0.08, 0.06, 0.45, 0.125, 0.08),
    triggers=[
        trig("battleStart", [give(SELF, buff("dauntless", kind="endure", undisp=True))]),
        trig("onEndure", [give(SELF, buff("dauntless-shelter", kind="invulnerable", big=1, undisp=True))], maxFires=1),
        trig("roundEnd", [heal(SELF, 0.2, "targetMaxHp")], condition={"selfHasTag": "dauntless-shelter"}),
    ],
    notModelled=["Ult: Regrowth's 'cannot be stacked' and the DoT condition checked on the healed ally"])

kit("salamence",
    skill("P", 1.0),
    skill("P", 2.1, lifesteal=0.3),
    skill("P", 1.2, lifesteal=0.1),
    statMods=bundle(0.45, 0.08, 0.12, 0.06, 0.06, 0.1),
    triggers=[trig("onAllyDeath", [give(SELF, buff("last-stand", "atkPct", 0.24, turns=999, undisp=True))],
                   condition={"otherAlliesAtMost": 0}, maxFires=1)])

for kid in ("gengar",):
    kit(kid,
        skill("S", 1.0),
        skill("S", 1.35, "backline", effects=[
            rage(SELF, 125, condition={"targetControlled": True}),
            control(T, "flinch"),
        ]),
        skill("S", 1.2, effects=[control(T, "flinch")]),
        statMods=bundle(0.45, 0.08, 0.12, 0.06, 0.06, 0.1),
        triggers=[trig("onHit", [shield(SELF, 0.45, "casterAtk")], condition={"targetClass": "striker"})],
        notModelled=["Ult: the 12.5% Rage fires per target already controlled (the sheet: once if any)"])

kit("shiny-darkrai",
    skill("P", 1.0, lifesteal=0.2),
    skill("P", 1.75, "row", lifesteal=0.4, effects=[{"op": "resource", "target": SELF, "tag": "nightmare", "delta": 1, "max": 2},
                                                    # DEF on: each Nightmare stack ignores 12% DEF (a stack-capped buff beside it).
                                                    give(SELF, buff("nightmare-ignore", "ignoreDefense", 0.12, stacks=2))]),
    skill("P", 1.35, lifesteal=0.2),
    statMods=bundle(0.45, 0.08, 0.12, 0.06, 0.06, 0.1),
    triggers=[
        per_turn_dmg(0.015, 0.06),
        trig("turnStart", [
            {"op": "cleanse", "target": SELF, "kinds": CONTROL_KINDS},
            shield(SELF, 3.25, "casterAtk"),
            give(SELF, buff("dark-void-immune", kind="immune", turns=3)),
        ], condition={"selfControlled": True}),
    ],
    damageMods=[{"tag": "nightmare", "slot": "ult", "dmg": 0.15, "scale": {"resource": "nightmare"}}],
    notModelled=[])

kit("shiny-arceus",
    skill("S", 1.0, effects=[{"op": "resource", "target": SELF, "tag": "sanction", "delta": 1, "max": 999}]),
    skill("S", 1.0, "all", effects=[{"op": "resource", "target": SELF, "tag": "sanction", "delta": 1, "max": 999}]),
    skill("S", 1.2, "row", effects=[{"op": "resource", "target": SELF, "tag": "sanction", "delta": 1, "max": 999}]),
    statMods=bundle(0.45, 0.08, 0.12, 0.06, 0.06, 0.1),
    triggers=[
        per_turn_dmg(0.015, 0.06),
        trig("onHit", [{"op": "resource", "target": SELF, "tag": "sanction", "delta": 1, "max": 999},
                       give(SELF, buff("judgment-satk", "atkPct", 0.2, turns=2))], chance=0.5),
    ],
    damageMods=[{"tag": "sanction", "atk": 0.075, "scale": {"resource": "sanction"}}],
    notModelled=["Sanction's +5% Crit Intensity per layer (the +7.5% S.ATK per layer is modelled)"])


# ------------------------------------------------------------------ E4: Origin skill levels
# Source (kb/pokemon-growth.md, hero_origin_skill_up_json): only the six Origins level skills — the
# ult, basic skill, EXC passive and Talent 4, LV.2 for 50 and LV.3 for 100 of the Origin's own shards.
# Each row's triggers / mods carry `group`; a level replaces its row's group (engine applySkillLevels).
SHEET = json.loads((Path(__file__).parent / "pokemon-skills.json").read_text())
ROW_SLOT = {"ult": "Ult", "basic": "Basic Skill", "passive": "Passive", "talent4": "Talent 4"}


def g(obj, group):
    return {**obj, "group": group}


def sheet_text(kid, slot):
    for c in SHEET:
        if c["name"].lower().replace(" ", "-") == kid:
            for s_ in c["slots"]:
                if s_["slot"] == slot:
                    notes = [n.strip() for n in s_.get("notes", "").split("|") if n.strip()]
                    notes = [n.split(")", 1)[1].strip() if n.startswith("(LV.") else n for n in notes]
                    return s_["name"], [s_["desc"]] + notes
    raise SystemExit(f"no sheet text {kid} {slot}")


def levels(kid, rows):
    """rows: {row: {'2': {...}, '3': {...}}} → kit levels with the sheet's text per level."""
    out = {}
    for row in ("ult", "basic", "passive", "talent4"):
        name, text = sheet_text(kid, ROW_SLOT[row])
        out[row] = {"name": name, "text": text, **rows.get(row, {})}
    K[kid]["levels"] = out


def lv(skill_=None, triggers=None, damageMods=None):
    d = {}
    if skill_ is not None:
        d["skill"] = skill_
    if triggers is not None:
        d["triggers"] = triggers
    if damageMods is not None:
        d["damageMods"] = damageMods
    return d


# Calyrex ------------------------------------------------------------------------------------------
cal_ult = lambda extra: skill("P", 1.0, "all", effects=[
    {"op": "resource", "target": T, "tag": "frost", "delta": 1, "max": 1},
    control(SELF, "freeze", condition={"selfStackAtLeast": {"tag": "frost", "n": 1}}),
] + extra)
cal_basic = lambda extra: skill("P", 1.2, effects=[control(T, "freeze", 0.4)] + extra)
resist = give({"side": "ally", "rule": "lowest_hp", "n": 1}, buff("resistance-shield", kind="invulnerable", turns=2, consumeOnHit=True))
cal_passive = g(trig("onHit", [control(T, "freeze")], chance=0.25), "passive")
cal_heal = g(trig("roundEnd", [heal(SELF, 0.05, "targetMaxHp", perTagged={"side": "enemy", "tag": "freeze", "max": 3})]), "passive")
cal_rage = g(trig("roundEnd", [rage(SELF, 125, perTagged={"side": "enemy", "tag": "freeze", "max": 3})]), "passive")
cal_t4 = lambda amount, block: g(trig("turnStart", [give(ALLIES, buff("leycrest-critRes", "critRes", amount, turns=99, stacks=4, endsWithSource=True))]
                                      + ([give(ALLIES, buff("leycrest-block", "block", block, turns=99, stacks=4, endsWithSource=True))] if block else [])), "talent4")
kit("calyrex", skill("P", 1.1), cal_ult([]), cal_basic([]),
    statMods=bundle(0.06, 0.22, 0.06, 0.6, 0.25, 0.15),
    triggers=[cal_passive, ally_rdct_stacks(0.05, 4), cal_t4(0.05, 0)],
    notModelled=["Ult: 'Freeze yourself … when holding Frost' — read as Calyrex holding Frost (it never gains it itself)",
                 "Ult LV.3: Frost lasting 2 turns changes nothing modelled",
                 "Basic Skill LV.3: the 10% max-HP heal after the resistance shield ends"])
cal_l3_basic_trig = g(trig("battleStart", [give(SELF, buff("calyrex-opening", "basicRate", 1, big=2))]), "basic")
levels("calyrex", {
    "ult": {"2": lv(cal_ult([give(T, buff("calyrex-atk", "atkPct", -0.2, turns=1))])),
            "3": lv(cal_ult([give(T, buff("calyrex-atk", "atkPct", -0.2, turns=1))]))},
    "basic": {"2": lv(cal_basic([resist]), []), "3": lv(cal_basic([resist]), [cal_l3_basic_trig])},
    "passive": {"2": lv(triggers=[cal_passive, cal_heal]), "3": lv(triggers=[cal_passive, cal_heal, cal_rage])},
    "talent4": {"2": lv(triggers=[cal_t4(0.05, 0.05)]), "3": lv(triggers=[cal_t4(0.08, 0.08)])},
})

# Necrozma -----------------------------------------------------------------------------------------
nec_ult = lambda consume, ignore=None: skill("S", 1.1, "all", ignoreDefense=ignore, effects=([{"op": "resource", "target": SELF, "tag": "light-energy", "consume": 99}] if consume else []))
nec_basic = lambda rule, kinds: skill("S", 1.3, rule, effects=[{"op": "cleanse", "target": {"side": "ally", "rule": "random", "n": 1, "filters": ["controlled"]}, **({"kinds": kinds} if kinds else {})}])
nec_gain = [g(trig("afterNormal", [{"op": "resource", "target": SELF, "tag": "light-energy", "delta": 2}]), "passive"),
            g(trig("afterBasic", [{"op": "resource", "target": SELF, "tag": "light-energy", "delta": 2}]), "passive")]
nec_mod = lambda per: g({"tag": "light-energy", "slot": "ult", "atk": per, "scale": {"resource": "light-energy"}}, "passive")
nec_t4 = lambda consume, lifesteal: g(trig("turnStart", [{"op": "cleanse", "target": SELF, "kinds": CONTROL_KINDS}]
                                           + ([{"op": "resource", "target": SELF, "tag": "light-energy", "consume": 1}] if consume else [])
                                           + ([give(SELF, buff("necrozma-absorb", "lifesteal", 0.5, turns=2))] if lifesteal else []),
                                           condition={"selfControlled": True, "selfStackAtLeast": {"tag": "light-energy", "n": 1}}), "talent4")
kit("necrozma", skill("S", 1.3), nec_ult(True), nec_basic("column", CONTROL_KINDS),
    statMods=bundle(0.6, 0.3, 0.2, 0.06, 0.06, 0.21),
    triggers=nec_gain + [trig("roundStart", [give(SELF, buff("round-dmgBoost", "dmgBoost", 0.025, turns=99, stacks=4))]), nec_t4(True, False)],
    damageMods=[nec_mod(0.3)])
nec_l3_gain = g(trig("turnStart", [{"op": "resource", "target": SELF, "tag": "light-energy", "delta": 2}], condition={"allyUnderControl": True}, perTurn=1), "passive")
levels("necrozma", {
    "ult": {"2": lv(nec_ult(True, 0.3)), "3": lv(nec_ult(False, 0.3))},
    "basic": {"2": lv(nec_basic("row", CONTROL_KINDS)), "3": lv(nec_basic("row", None))},
    "passive": {"2": lv(triggers=nec_gain, damageMods=[nec_mod(0.45)]), "3": lv(triggers=nec_gain + [nec_l3_gain], damageMods=[nec_mod(0.45)])},
    "talent4": {"2": lv(triggers=[nec_t4(True, True)]), "3": lv(triggers=[nec_t4(False, True)])},
})

# Origin Lugia -------------------------------------------------------------------------------------
CONFINED = {"rule": "random", "n": 1, "rowFilter": "back", "hasTag": "darkness-confinement"}
ol_ult = lambda extra: skill("P", 1.3, "all", effects=[
    control({"rule": "random", "n": 1, "rowFilter": "back"}, "darkness-confinement", condition={"enemiesAtLeast": 2})] + extra)
ol_basic = lambda drain, extra: skill("P", 1.1, hasTag="darkness-confinement", effects=[
    rage(T, -drain, condition={"targetHasTag": "darkness-confinement"}),
    give(T, buff("confined-atk", "atkPct", -0.1, turns=2), condition={"targetHasTag": "darkness-confinement"}),
] + extra)
ol_endure = [g(trig("battleStart", [give(SELF, buff("origin-lugia-endure", kind="endure", undisp=True))]), "passive"),
             g(trig("onEndure", [control(SELF, "confinement"), rage(SELF, 150)], maxFires=1), "passive")]
ol_guard = g({"tag": "origin-lugia-guard", "role": "defend", "type": "P", "dmg": 0.15, "scale": "selfMissingHp", "cap": 0.15}, "passive")
ol_feather = lambda healr: [
    g(trig("onEnemyUlt", [give(SELF, buff("feather-dance", "pRdct", 0.1, turns=99, stacks=2))]), "passive"),
    g(trig("roundEnd", [heal(ALLIES, healr, "casterAtk"), {"op": "dispel", "target": SELF, "kinds": ["feather-dance"], "count": 1}],
           condition={"selfStackAtLeast": {"tag": "feather-dance", "n": 1}}), "passive"),
]
kit("origin-lugia", skill("P", 1.1, hasTag="darkness-confinement"), ol_ult([]), ol_basic(125, []),
    statMods=bundle(0.06, 0.22, 0.06, 0.6, 0.25, 0.15),
    triggers=ol_endure + [ally_rdct_stacks(0.05, 4)],
    damageMods=[ol_guard],
    notModelled=[
        "Ult: a confined unit 'takes damage only from Origin Lugia'",
        "Ult LV.2 / LV.3: the −20% ATK and −250 Rage land with the confinement, not when it ends",
        "Passive: backline allies' 70%-strength copy of the P.ATK damage reduction",
        "Talent 4 (all levels): the first ally(s) to take lethal damage stay at 1 HP and are imprisoned; +20 SPD while an imprisoned enemy is on the field",
    ])
levels("origin-lugia", {
    "ult": {"2": lv(ol_ult([give(CONFINED, buff("dark-prison-atk", "atkPct", -0.2, turns=3))])),
            "3": lv(ol_ult([give(CONFINED, buff("dark-prison-atk", "atkPct", -0.2, turns=3)), rage(CONFINED, -250)]))},
    "basic": {"2": lv(ol_basic(125, [give(SELF, buff("dark-rate", "basicRate", 0.2, turns=99, stacks=3))])),
              "3": lv(ol_basic(200, [give(SELF, buff("dark-rate", "basicRate", 0.2, turns=99, stacks=3))]))},
    "passive": {"2": lv(triggers=ol_endure + ol_feather(0.6), damageMods=[ol_guard]),
                "3": lv(triggers=ol_endure + ol_feather(0.75), damageMods=[ol_guard])},
})

# Origin Rayquaza ----------------------------------------------------------------------------------
LINKED = {"side": "ally", "rule": "all", "hasTag": "delta-link", "excludeSelf": True}
OR_PICK = {"side": "ally", "rule": "same_position", "excludeSelf": True}
or_ult = lambda amount, stacks: skill("S", 1.3, "all", effects=[
    give(SELF, buff("rayquaza-guard", "dmgRdct", 0.1, turns=99, stacks=1, consumeOnHit=True)),
    give(LINKED, buff("delta-airflow", "dmgRdct", amount, turns=99, stacks=stacks, consumeOnHit=True)),
])
or_basic = lambda extra: skill("S", 1.2, "row", effects=extra)
or_link = g(trig("battleStart", [give(OR_PICK, buff("delta-link", kind="stack", turns=99, undisp=True))]), "ult")
or_stream = g(trig("battleStart", [give(OR_PICK, buff("delta-stream", "dmgRdct", 0.3, turns=99, stacks=1, consumeOnHit=True))]), "passive")
or_crit = g(trig("turnStart", [give(LINKED, buff("thunder-crit", "crit", 0.05, turns=99, stacks=3))]), "passive")
or_t4 = lambda r: g(trig("onAllyCrit", [dmg(T, rate=r, type="S")], condition={"actorHasTag": "delta-link"}), "talent4")
kit("origin-rayquaza", skill("S", 1.2), or_ult(0.3, 2), or_basic([]),
    statMods=bundle(0.15, 0.32, 0.15, 0.06, 0.06, 0.51),
    triggers=[or_link, or_stream, trig("roundStart", [give(SELF, buff("round-dmgBoost", "dmgBoost", 0.025, turns=99, stacks=4))]), or_t4(0.3)],
    notModelled=[
        "Ult/Passive: the link moves to a new ally when the linked one dies; the link picks 'the closest ally, preferring the one below'",
        "Passive: the linked ally does not drop below 1 HP on its first turn and restores 25% of lost HP from its second turn",
        "Basic Skill LV.3 / Passive LV.3 / Talent 4 LV.3: the Thunderstorm count and the link target's attack bonus; Passive LV.2's +10% Crit Intensity after 3 stacks",
    ])
levels("origin-rayquaza", {
    "ult": {"2": lv(or_ult(0.5, 2)), "3": lv(or_ult(0.5, 3))},
    "basic": {"2": lv(or_basic([dmg(T, basis="targetMissingHp", share=0.3)])), "3": lv(or_basic([dmg(T, basis="targetMissingHp", share=0.3)]))},
    "passive": {"2": lv(triggers=[or_stream, or_crit]), "3": lv(triggers=[or_stream, or_crit])},
    "talent4": {"2": lv(triggers=[or_t4(0.5)]), "3": lv(triggers=[or_t4(0.5)])},
})

# Shadow Mewtwo ------------------------------------------------------------------------------------
FRONT_FOES = {"rule": "all", "rowFilter": "front"}
sm_ult = lambda turns, second: skill("S", 1.2, "all", effects=[
    dmg(T, basis="targetMaxHp", share=0.12, condition={"targetClass": "guardian"}),
    give(FRONT_FOES, buff("heal-cut", "receiveHealBoost", -0.3, turns=turns)),
] + ([give(FRONT_FOES, buff("heal-cut-2", "receiveHealBoost", -0.2, turns=turns), condition={"selfStackAtLeast": {"tag": "mewtwo-ults", "n": 1}}),
      {"op": "resource", "target": SELF, "tag": "mewtwo-ults", "delta": 1}] if second else []) + [
    give(SELF, buff("doubled-basic", kind="stack", turns=99)),
])
sm_basic = lambda share, cap: skill("S", 1.5, "frontline", effects=[give(T, buff("heal-block", "receiveHealBoost", -1, turns=2))] + (
    [dmg(T, basis="targetMaxHp", share=share, capRate=cap, type="S"), dmg(T, basis="targetMaxHp", share=0.12, condition={"targetClass": "guardian"})] if share else []))
sm_doubled = [g(trig("afterBasic", [{"op": "dispel", "target": SELF, "kinds": ["doubled-basic"]}]), "ult")]
sm_doubled_mod = g({"tag": "doubled-basic", "slot": "basic", "atk": 1.0, "condition": {"selfHasTag": "doubled-basic"}}, "ult")
sm_ult_l3_trig = g(trig("afterUlt", [give({"rule": "random", "n": 1, "rowFilter": "front"}, buff("heal-ban", "receiveHealBoost", -1, turns=1))], chance=0.5), "ult")
sm_splash = lambda share: g(trig("afterBasic", [{"op": "splash", "target": T, "share": share}]), "passive")
sm_gb = g(trig("afterUlt", [give(SELF, buff("psystrike-gb", "guardBreak", 0.1, turns=999, stacks=3))]), "passive")
sm_t4 = lambda d, b: g(trig("afterBasic", [give(T, buff("deepen", "dmgRdct", -d, turns=2, stacks=1))] + (
    [give(T, buff("deepen-block", "block", -b, turns=2, stacks=1)), give(T, buff("deepen-bp", "blockPower", -b, turns=2, stacks=1))] if b else [])), "talent4")
kit("shadow-mewtwo", skill("S", 1.2, "frontline"), sm_ult(2, False), sm_basic(0, 0),
    statMods=bundle(0.15, 0.32, 0.15, 0.06, 0.06, 0.51),
    triggers=sm_doubled + [sm_splash(0.1), sm_t4(0.1, 0)],
    damageMods=[sm_doubled_mod],
    notModelled=["Basic Skill LV.2 / LV.3: the max-HP bonus applies even when the hit is blocked"])
levels("shadow-mewtwo", {
    "ult": {"2": lv(sm_ult(2, True), sm_doubled, [sm_doubled_mod]), "3": lv(sm_ult(3, True), sm_doubled + [sm_ult_l3_trig], [sm_doubled_mod])},
    "basic": {"2": lv(sm_basic(0.08, 0.8)), "3": lv(sm_basic(0.1, 1.0))},
    "passive": {"2": lv(triggers=[sm_splash(0.1), sm_gb]), "3": lv(triggers=[sm_splash(0.2), sm_gb])},
    "talent4": {"2": lv(triggers=[sm_t4(0.1, 0.1)]), "3": lv(triggers=[sm_t4(0.2, 0.2)])},
})

# Zacian -------------------------------------------------------------------------------------------
z_atk = give(SELF, buff("armor-break-atk", "atkPct", 0.2, turns=3), condition={"targetHasTag": "shattered-armor"})
z_ult = lambda rate, drain_chance: skill("P", rate, "row", effects=[dmg(T, basis="casterLostTotal", share=0.4)] + (
    [rage(T, -250, **({"chance": drain_chance} if drain_chance < 1 else {}))] if drain_chance else []))
z_basic = lambda rate, per=-0.1: skill("P", rate, "same_position", effects=[
    z_atk, give(T, buff("shattered-armor", "pDef", per, turns=3, stacks=3)), give(T, buff("shattered-armor-s", "sDef", per, turns=3, stacks=3))])
z_fall = lambda heal_r, atk: [g(trig(on, [heal(SELF, heal_r, "targetMaxHp"), give(SELF, buff("zacian-fallen", "atkPct", atk, turns=999, stacks=99))]), "passive")
                              for on in ("onEnemyDeath", "onAllyDeath")]
z_guard = lambda per, cap: g({"tag": "zacian-guard", "role": "defend", "dmg": per, "scale": "selfMissingHp", "cap": cap}, "talent4")
kit("zacian", skill("S", 1.2, "same_position", effects=[z_atk]), z_ult(1.5, 0), z_basic(1.4),
    statMods=bundle(0.15, 0.32, 0.15, 0.06, 0.06, 0.51),
    damageMods=[z_guard(0.5, 0.3)],
    notModelled=["Basic Skill: Shattered Armor's −10% / −20% DEF per layer read as LV.1 / LV.2+",
                 "Passive LV.2+: counts every death, not only deaths to a direct attack",
                 "Talent 4 LV.2: lifesteal of 1% per 1% HP lost (lifesteal cannot scale with HP yet)"])
levels("zacian", {
    "ult": {"2": lv(z_ult(1.5, 0.7)), "3": lv(z_ult(1.7, 1))},
    "basic": {"2": lv(z_basic(1.4, -0.2)), "3": lv(z_basic(1.6, -0.2))},
    "passive": {"2": lv(triggers=z_fall(0.1, 0.2)), "3": lv(triggers=z_fall(0.2, 0.3))},
    "talent4": {"2": lv(damageMods=[z_guard(0.5, 0.3)]), "3": lv(damageMods=[z_guard(0.75, 0.42)])},
})

# ------------------------------------------------------------------ R6a: plate skills
# Source texts (hero_stone_skill_json, English from _text): scripts/data/plate-skills-source.json.
PLATE_SRC = {(x["species"], x["tier"]): x["en"] for x in json.loads((Path(__file__).parent / "plate-skills-source.json").read_text())["skills"]}
PL = {}


def plate(kid, tiers):
    """tiers: {6: {...}, 12: {...}, 18: {...}} — each: skills / triggers / damageMods / statMods / dropGroups."""
    out = {}
    for tier, d in tiers.items():
        out[str(tier)] = {"text": PLATE_SRC[(kid, tier)], **d}
    PL[kid] = out


PLATE_NOTES = []


def note(text):
    """A plate-skill reading or gap, listed in docs/PORT-REPORT.md under "Plate skills"."""
    PLATE_NOTES.append(text)


exec((Path(__file__).parent / "plate-skills.py").read_text())

# ------------------------------------------------------------------ R6b: trinket skills
# Source texts (hero_weapon_json skill_list → skill tables, English from _text):
# scripts/data/trinket-skills-source.json. The client shows the last skill listed at a level.
TRINKET_SRC = {}
for _x in json.loads((Path(__file__).parent / "trinket-skills-source.json").read_text())["skills"]:
    TRINKET_SRC[(_x["species"], _x["level"])] = _x["descEn"] or _x["desc"]
TR = {}
TRINKET_NOTES = []


def trinket(kid, tiers):
    """tiers: {10: {...}, 20: {...}, 30: {...}, 40: {...}} — each replaces the one below (same keys as plate)."""
    TR[kid] = {str(t): {"text": TRINKET_SRC[(kid, t)], **d} for t, d in tiers.items()}


def tnote(text):
    """A trinket-skill reading or gap, listed in docs/PORT-REPORT.md under "Trinket skills"."""
    TRINKET_NOTES.append(text)


_TS = Path(__file__).parent / "trinket-skills.py"
if _TS.exists():
    exec(_TS.read_text())

OUT = Path(__file__).with_name("kit-overrides.json")
OUT.write_text(json.dumps({"_note": "Generated by scripts/data/build-kit-overrides.py (E3 hand ports). Do not edit by hand.", **K, "_plates": PL, "_plateNotes": PLATE_NOTES, "_trinkets": TR, "_trinketNotes": TRINKET_NOTES}, indent=1) + "\n")
print(f"wrote {len(K)} hand-ported kits -> {OUT}")

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

# --- batch 4 -------------------------------------------------------------------------------------
trinket("shiny-arceus", per_tier(lambda n: {"triggers": [
    trig("afterUlt", [{"op": "cleanse", "target": SELF, "count": n}])]}, [1, 2, 3, 4]))

trinket("kyogre", per_tier(lambda r: {"triggers": [trig("onHit", [rage(SELF, r)])]}, [50, 65, 80, 100]))
tnote("Kyogre (Frustration): '+Rage when hit, without the passive's high DMG Reduction' — the Rage comes on every hit "
      "(the passive's reduction window is not checked).")

trinket("deoxys", per_tier(lambda r: {"triggers": [trig("onBlock", [heal(SELF, r, "targetMaxHp")])]},
                           [0.04, 0.055, 0.07, 0.09]))

def _mew(chance, after_attack):
    t = [trig("afterBasic", [rage(SELF, 125)]),
         trig("afterBasic", [give(SELF, buff("mew-trinket-immune", kind="immune", turns=2))], chance=chance)]
    if after_attack:
        t = [trig(on, [rage(SELF, 125)]) for on in ATTACKS] + [
            trig("afterUlt", [rage(SELF, 125)]),
            trig("afterUlt", [give(SELF, buff("mew-trinket-immune", kind="immune", turns=2))], chance=chance)]
    return {"triggers": t}


trinket("mew", per_tier(_mew, [(0.35, False), (0.35, False), (0.55, False), (0.55, True)]))
tnote("Mew (Control Immunity Chance): Lv 10-30 — +125 Rage and the immunity roll after the basic skill; Lv 40 — "
      "+125 Rage after every attack, +125 more and the roll after the ult. The immunity is to every control.")

trinket("cresselia", per_tier(lambda amt, n: {"triggers": [
    trig(on, [give({"rule": "random", "n": n}, buff("lunar-blade", "atkPct", -amt, stacks=99))]) for on in ("afterNormal", "afterBasic")]},
    [(0.05, 1), (0.12, 1), (0.18, 1), (0.18, 2)]))
tnote("Cresselia (Lunar Blade): 'stackable' with no cap or duration — the ATK cut stacks for the battle.")

trinket("celebi", per_tier(lambda r: {"triggers": [
    trig("afterUlt", [rage({"side": "ally", "rule": "all", "excludeSelf": True}, r, condition={"targetRageAbove": 0.6})])]},
    [100, 200, 300, 400]))
tnote("Celebi (Drips of Life): the Rage goes to every ally above 60 % Rage, not one (no 'pick one matching' rule).")


def _tinkle(rdct, immune):
    effs = [give({"side": "ally", "rule": "all"}, buff("healing-tinkle", "dmgRdct", rdct, turns=2, stacks=1),
                 condition={"targetRageAbove": 0.75})]
    if immune:
        effs.append(give({"side": "ally", "rule": "all"}, buff("healing-tinkle-immune", kind="immune", turns=2),
                         condition={"targetRageAbove": 0.75}))
    return {"triggers": [trig("afterUlt", effs)]}


trinket("manaphy", per_tier(_tinkle, [(0.08, False), (0.08, True), (0.12, True), (0.18, True)]))
tnote("Shiny Kyogre, Shiny Mew and Shiny Cresselia list no trinket skills in the source.")

# --- batch 5 -------------------------------------------------------------------------------------
trinket("infernape", per_tier(lambda below, share, undisp: {"triggers": [
    trig("hpBelow", [shield(SELF, share, "casterHp")], hpBelow=below)]},
    [(0.35, 0.25, False), (0.4, 0.3, False), (0.45, 0.3, True), (0.5, 0.35, True)]))
tnote("Infernape (Meditation): the shield comes each time HP falls below the line (re-arms above it); its 3-turn limit and 'cannot be dispelled' are not kept (shields have neither).")


def _blizzard(cut, dmg_up, slow):
    out = {"damageMods": [{"tag": "blizzard", "dmg": dmg_up, "condition": {"targetHasTag": "frost"}}],
           "triggers": [trig("onDealDamage", [give(T, buff("blizzard-heal-cut", "receiveHealBoost", -cut, turns=2, stacks=1))],
                             condition={"targetHasTag": "frost"})]}
    if slow:
        out["triggers"].append(trig("onDealDamage", [give(T, buff("blizzard-slow", "spd", -slow, turns=2, stacks=1))],
                                    condition={"targetHasTag": "frost"}))
    return out


trinket("black-kyurem", per_tier(_blizzard, [(0.1, 0.08, 0), (0.12, 0.12, 0), (0.15, 0.15, 2), (0.15, 0.18, 4)]))
tnote("Shiny Kyurem lists no trinket skills in the source.")

trinket("shaymin", per_tier(lambda h: {"triggers": [trig(on, [heal(SELF, h, "casterSAtk")]) for on in ATTACKS]} if h else {},
                            [0, 0, 0.3, 0.5]))
tnote("Shaymin (Sweet Scent): the S.DEF cut on [Leech Seed] targets has no effect (DEF has no effect); Lv 30 / 40 heal after each attack.")

trinket("victini", per_tier(lambda turns: {"triggers": [
    trig("battleStart", [give(SELF, buff("victini-dauntless", kind="endure", turns=turns))])]}, [3, 4, 4, 4]))
tnote("Victini (Rise from the Dead): [Dauntless] for the first 3 / 4 turns; the dodges and their healing (Lv 20+) are "
      "not modelled (no dodge).")

_DOT_TAGS = [["burning", "burn"], ["burning", "burn", "flame"], ["burning", "burn", "flame", "poison"],
             ["burning", "burn", "flame", "poison", "leech-seed"]]
trinket("palkia", per_tier(lambda tags: {"triggers": [
    trig("battleStart", [give(SELF, buff("palkia-immune-dots", kind="immune", turns=999, undisp=True, immuneTo=tags))])]},
    _DOT_TAGS))
tnote("Palkia (Immune): the DoTs cannot be applied to it (rather than landing for no damage).")

trinket("giratina", per_tier(lambda h, a: {"triggers": [
    trig("onKill", [heal(SELF, h, "targetMaxHp"), give(SELF, buff("giratina-rains", "sAtk", a, stacks=99))])]},
    [(0.1, 0.02), (0.15, 0.03), (0.2, 0.04), (0.25, 0.05)]))

trinket("zygarde", {t: {} for t in TIERS})
tnote("Zygarde (Power Construct): not modelled — [Activity] by HP share, the basic-skill chance per layer and the "
      "consuming hit need a resource fed by HP.")

trinket("xerneas", per_tier(lambda a, cp: {"statMods": [{"field": "sAtk", "mult": 1 + a}] + (
    [{"field": "critPower", "add": cp}] if cp else [])}, [(0.05, 0), (0.1, 0.1), (0.15, 0.1), (0.2, 0.2)]))
tnote("Xerneas (Nature Power): always on — 'while free of dispellable debuffs' is not checked.")

trinket("lunala", {t: {} for t in TIERS})
tnote("Lunala (Magic Coat): not modelled — the S.ATK reduction grows with cumulative HP lost (no such counter yet).")

trinket("wind-god-pidgeot", per_tier(lambda atk, rd, cap: {"triggers": [
    trig("onInflictControl", [give(SELF, buff("gale-atk", "atkPct", atk, stacks=round(cap / atk)))] +
         ([give(SELF, buff("gale-prdct", "pRdct", rd, stacks=round(cap / atk)))] if rd else []), perTurn=3)]},
    [(0.01, 0, 0.2), (0.01, 0.01, 0.2), (0.01, 0.01, 0.3), (0.02, 0.01, 0.4)]))
tnote("Wind God Pidgeot (Gale Spell): 3 a turn (not a big round); the cap is in stacks of the ATK gain.")

# --- batch 6 -------------------------------------------------------------------------------------
trinket("shiny-god-ash-pikachu", per_tier(lambda amt, turns, n: {"triggers": [
    trig(on, [give(SELF, buff("ruse-basic", "skillBoost", amt, turns=turns, stacks=n))]) for on in ATTACKS]},
    [(0.1, 2, 2), (0.15, 2, 2), (0.15, 10, 3), (0.15, 10, 3)]))
tnote("Shiny God Ash-Pikachu: as God Ash-Pikachu.")

trinket("shiny-charizard", per_tier(lambda amt, turns: {"triggers": [
    trig("onDealDamage", [give(ALLY_ALL, buff("def-killer", "dmgBoost", amt, turns=turns, stacks=1))],
         condition={"targetClass": "guardian"})]},
    [(0.15, 1), (0.2, 2), (0.25, 2), (0.3, 2)]))
tnote("Shiny Charizard (DEF Pokémon Killer): the allies' boost counts against every target, not only [DEF] ones "
      "(a buff cannot carry a target condition).")

trinket("shiny-raichu", per_tier(lambda amt, turns, n: {"triggers": [
    trig("onCrit", [give(T, buff("crit-res-down", "critRes", -amt, turns=turns, stacks=n))])]},
    [(0.08, 3, 1), (0.1, 4, 1), (0.12, 4, 2), (0.15, 5, 2)]))

_SG_IMMUNE = [["freeze"], ["freeze", "mindControl", "confusion"], ["freeze", "mindControl", "confusion", "stun"],
              ["freeze", "mindControl", "confusion", "stun", "poison"]]
trinket("shiny-gengar", per_tier(lambda tags: {"triggers": [
    trig("battleStart", [give(SELF, buff("shiny-gengar-immune", kind="immune", turns=999, undisp=True, immuneTo=tags))])]},
    _SG_IMMUNE))
tnote("Shiny Gengar (Immune): Confusion covers the mind control kind too.")

trinket("shiny-venusaur", {t: {} for t in TIERS})
tnote("Shiny Venusaur (Impair DEF): no effect — DEF has no effect.")

trinket("shiny-darkrai", per_tier(_darkrai_ruse, [(0.04, False), (0.05, True), (0.06, True), (0.08, True)]))
tnote("Shiny Darkrai: as Darkrai (4-8 % a stack, 8 stacks).")


def _raikou(atk, r):
    return {"triggers": [
        trig("onKill", [give(SELF, buff("raikou-kill-satk", "sAtk", atk, turns=2, stacks=1)), rage(SELF, r)],
             condition=ON_ULT, perTurn=1),
        trig("onDeath", [give(ENEMY_ALL, buff("short-circuit-death", kind="rageBlock", big=1))])]}


trinket("raikou", per_tier(_raikou, [(0.1, 125), (0.15, 125), (0.2, 250), (0.25, 250)]))

trinket("entei", per_tier(lambda a, b: {"triggers": [
    trig("battleStart", [give(SELF, buff("entei-enh", "critPower", a, turns=2))]),
    trig("afterUlt", [give(SELF, buff("entei-enh-ult", "critPower", b, turns=2))])]},
    [(0.1, 0.05), (0.15, 0.07), (0.2, 0.09), (0.25, 0.12)]))

trinket("suicune", per_tier(lambda ch, amt: {"triggers": [
    trig("onHit", [give(T, buff("thorn-rdct-down", "dmgRdct", -amt, turns=2, stacks=1))],
         condition={"selfHasTag": "thorn"}, chance=ch)]},
    [(0.5, 0.05), (0.65, 0.08), (0.8, 0.12), (0.9, 0.15)]))

trinket("zapdos", per_tier(lambda ls: {"statMods": [{"field": "lifesteal", "add": ls}]}, [0.08, 0.1, 0.12, 0.15]))

trinket("moltres", per_tier(lambda amt: {"triggers": [
    trig("onDealDamage", [give(T, buff("burning-amp", "dotTaken", amt, turns=2, stacks=1))],
         condition={"targetHasTag": "burning"})]},
    [0.15, 0.22, 0.28, 0.35]))


def _articuno(cb, slow, turns):
    effs = [give(ALLY_ALL, buff("articuno-cb", "controlBoost", cb, turns=999))]
    if slow:
        effs.append(give(ENEMY_ALL, buff("articuno-trinket-slow", "spd", -slow, turns=turns)))
    return {"triggers": [trig("battleStart", effs)]}


trinket("articuno", per_tier(_articuno, [(0.15, 0, 0), (0.2, 2, 4), (0.24, 6, 4), (0.28, 10, 6)]))


def _endgame(step):
    return {"triggers": [trig("turnStart", [
        {"op": "removeBuff", "target": SELF, "tag": "endgame"},
        give(SELF, buff("endgame", "sAtk", step * 3, turns=1), condition={"enemiesDeadAtLeast": 5}),
        give(SELF, buff("endgame", "sAtk", step * 2, turns=1), condition={"enemiesDeadAtLeast": 4}),
        give(SELF, buff("endgame", "sAtk", step, turns=1), condition={"enemiesDeadAtLeast": 3}),
    ])]}


trinket("rayquaza", per_tier(_endgame, [0.03, 0.06, 0.09, 0.12]))
tnote("Rayquaza (Enhanced End-game): re-set each turn from the fallen enemies (the first matching line wins).")

# --- batch 7 -------------------------------------------------------------------------------------
trinket("metagross", per_tier(lambda below, r, _turns: {"triggers": [
    trig("onHit", [rage(T, -r)], condition={"selfHpBelow": below})]},
    [(0.15, 100, 2), (0.2, 150, 2), (0.25, 200, 2), (0.3, 250, 3)]))
tnote("Metagross (Reduces Rage at Low HP): each hit taken below the line cuts the attacker's Rage; the 'lasting N turns' has no separate effect.")

trinket("garchomp", per_tier(lambda amt, turns, n: {"triggers": [
    trig("onDealDamage", [give(T, buff("garchomp-rdct-cut", "dmgRdct", -amt, turns=turns, stacks=n))], condition=ON_ULT)]},
    [(0.05, 2, 2), (0.07, 3, 2), (0.08, 3, 3), (0.1, 4, 3)]))


def _hydreigon(amt):
    effs = [{"op": "removeBuff", "target": SELF, "tag": "hydra-benefit"}]
    for k in range(6, 0, -1):
        effs.append(give(SELF, buff("hydra-benefit", "atkPct", round(amt * k, 4), turns=1, undisp=True),
                         condition={"enemiesDeadAtLeast": k}))
    return {"triggers": [trig("turnStart", effs)]}


trinket("hydreigon", per_tier(_hydreigon, [0.06, 0.08, 0.1, 0.12]))
tnote("Hydreigon (Benefit from Damage): counts the fallen enemies only (living ones under the HP line are not counted).")

trinket("gyarados", per_tier(lambda below, gb, c: {"triggers": [
    trig("turnStart", [give(SELF, buff("impasse-gb", "guardBreak", gb, turns=1)),
                       give(SELF, buff("impasse-crit", "crit", c, turns=1))], condition={"selfHpBelow": below})]},
    [(0.15, 0.35, 0.15), (0.2, 0.45, 0.18), (0.25, 0.55, 0.24), (0.35, 0.6, 0.3)]))

trinket("gardevoir", per_tier(lambda start, gb, c, n: {"triggers": [
    trig("turnStart", [give(SELF, buff("endurance-gb", "guardBreak", gb, stacks=n)),
                       give(SELF, buff("endurance-crit", "crit", c, stacks=n))], condition={"round": {"from": start}})]},
    [(4, 0.08, 0.05, 3), (4, 0.1, 0.07, 3), (3, 0.12, 0.08, 3), (3, 0.15, 0.09, 4)]))
tnote("Gardevoir (Endurance): one stack a turn from the starting round.")

trinket("gengar", per_tier(lambda tags: {"triggers": [
    trig("battleStart", [give(SELF, buff("gengar-immune", kind="immune", turns=999, undisp=True, immuneTo=tags))])]},
    _SG_IMMUNE))

trinket("raichu", per_tier(lambda amt, turns, n: {"triggers": [
    trig("onCrit", [give(T, buff("crit-res-down", "critRes", -amt, turns=turns, stacks=n))])]},
    [(0.04, 3, 3), (0.06, 4, 3), (0.07, 4, 4), (0.08, 5, 4)]))

trinket("charizard", per_tier(lambda amt, turns: {"triggers": [
    trig("onDealDamage", [give(ALLY_ALL, buff("def-killer", "dmgBoost", amt, turns=turns, stacks=1))],
         condition={"targetClass": "guardian"})]},
    [(0.15, 1), (0.2, 2), (0.25, 2), (0.3, 2)]))

trinket("blastoise", per_tier(_mass_healing, [(0.2, 0.04, 4), (0.28, 0.05, 4), (0.35, 0.05, 5), (0.4, 0.07, 5)]))

trinket("venusaur", {t: {} for t in TIERS})
tnote("Venusaur (Impair DEF): no effect — DEF has no effect. Charizard / Raichu / Blastoise / Gengar: as their Shiny forms at their own numbers.")

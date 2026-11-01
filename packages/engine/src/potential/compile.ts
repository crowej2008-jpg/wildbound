import type { Condition, DamageMod, Effect, StatMod, TargetSel, TriggerDef, TriggerOn } from '../combat/types';
import type { PotentialEffect, PotentialOption, PotentialSpecies, PotentialState, PotentialTable, PotentialTeam } from './types';

/** What a Pokémon's Potential adds to its battle spec. */
export interface PotentialBattle {
  statMods: StatMod[];
  triggers: TriggerDef[];
  damageMods: DamageMod[];
}

const SELF: TargetSel = { side: 'ally', rule: 'self' };
const ALLIES: TargetSel = { side: 'ally', rule: 'all' };
const EVENT: TargetSel = { event: true };

/** Turn a Pokémon's picks into stat mods, triggers and damage mods for one battle lineup. */
export function compilePotential(
  table: PotentialTable,
  species: PotentialSpecies | undefined,
  state: PotentialState | undefined,
  team: PotentialTeam,
): PotentialBattle {
  const out: PotentialBattle = { statMods: [], triggers: [], damageMods: [] };
  if (!species || !state) return out;
  const byId = new Map(table.options.map((o) => [o.id, o]));
  state.picks.forEach((pick, tier) => {
    if (!pick) return;
    const option = byId.get(species.tiers[tier]?.[pick.option] ?? -1);
    if (!option) return;
    const v = option.values[Math.min(pick.lv, option.values.length) - 1] ?? 0;
    addOption(out, option, v, team);
  });
  return out;
}

function statMod(field: StatMod['field'], v: number, mult?: boolean): StatMod {
  return mult ? { field, mult: 1 + v } : { field, add: v };
}

function addOption(out: PotentialBattle, option: PotentialOption, v: number, team: PotentialTeam): void {
  const e: PotentialEffect = option.effect;
  const tag = `potential-${option.id}`;
  switch (e.kind) {
    case 'stat':
      out.statMods.push(statMod(e.field, e.negate ? -v : v, e.mult));
      if (e.extra) out.statMods.push({ field: e.extra.field, add: e.extra.add });
      return;
    case 'factionAllies': {
      const n = Math.min(e.cap, team.allies.filter((a) => a.faction === team.faction).length);
      if (n > 0) out.statMods.push(statMod(e.field, v * n, e.mult));
      return;
    }
    case 'classAlly':
      if (team.allies.some((a) => a.className === e.allyClass)) out.statMods.push(statMod(e.field, v, e.mult));
      return;
    case 'classAllyDmg':
      if (team.allies.some((a) => a.className === e.allyClass)) {
        out.damageMods.push({ tag, role: e.role, dmg: v, condition: { targetClass: e.vs } });
      }
      return;
    case 'alive': {
      const on: Condition = {
        ...(e.atLeast !== undefined ? { alliesAliveAtLeast: e.atLeast } : {}),
        ...(e.below !== undefined ? { alliesAliveBelow: e.below } : {}),
      };
      const off: Condition = e.atLeast !== undefined ? { alliesAliveBelow: e.atLeast } : { alliesAliveAtLeast: e.below ?? 0 };
      const apply: Effect = { op: 'buff', target: SELF, buff: { tag, kind: 'stat', field: e.field, amount: v, undispellable: true } };
      const remove: Effect = { op: 'removeBuff', target: SELF, tag };
      // Re-checked at the start, each round and whenever an ally falls.
      for (const when of ['battleStart', 'roundStart', 'onAllyDeath'] as TriggerOn[]) {
        out.triggers.push({ on: when, condition: on, effects: [apply] });
        out.triggers.push({ on: when, condition: off, effects: [remove] });
      }
      return;
    }
    case 'event': {
      const target = e.target === 'self' ? SELF : e.target === 'allies' ? ALLIES : EVENT;
      const effects: Effect[] = [];
      if (e.act === 'buff' && e.field) {
        const buff = {
          tag,
          kind: 'stat' as const,
          field: e.field,
          amount: e.negate ? -v : v,
          ...(e.turns !== undefined ? { turns: e.turns } : {}),
          ...(e.bigRounds !== undefined ? { bigRounds: e.bigRounds } : {}),
          ...(e.maxStacks !== undefined ? { maxStacks: e.maxStacks } : {}),
        };
        // "No stacking" options refresh: the old copy goes, the new one starts its full duration.
        if (e.maxStacks === undefined) effects.push({ op: 'removeBuff', target, tag });
        effects.push({ op: 'buff', target, buff });
      } else if (e.act === 'heal') {
        effects.push({ op: 'heal', target, rate: v, basis: 'targetMaxHp' });
      } else if (e.act === 'damage') {
        effects.push({ op: 'damage', target, basis: 'casterMissingHp', share: v });
      }
      const ons: TriggerOn[] =
        e.on === 'afterAttack'
          ? ['afterNormal', 'afterBasic', 'afterUlt']
          : e.on === 'afterNonUlt'
            ? ['afterNormal', 'afterBasic']
            : [e.on];
      for (const on of ons) {
        out.triggers.push({
          on,
          effects,
          ...(e.hitBy ? { condition: { eventSlot: e.hitBy } } : {}),
          ...(e.perTurn !== undefined ? { perTurn: e.perTurn } : {}),
        });
      }
      return;
    }
  }
}

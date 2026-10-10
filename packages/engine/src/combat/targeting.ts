import { randInt } from '../rng';
import type { BattleContext, Combatant, SkillDef } from './types';

/**
 * Targeting (measured â€” stats-and-combat.md 5):
 * - single-target column rule: the enemy front-row unit in the attacker's own
 *   column; else the nearest front column (ties to the lower column); else the
 *   back row by the same rule. lowest HP plays no part.
 * - multi-target skills take the first N of that ordering, or a declared shape.
 * Confined (untargetable) units are skipped; dead rows fall through.
 */
export function selectTargets(ctx: BattleContext, attacker: Combatant, skill: SkillDef): Combatant[] {
  const enemies = ctx.units.filter((u) => u.side !== attacker.side && u.alive);
  const pickable = enemies.filter((u) => !isUntargetable(u));

  switch (skill.rule) {
    case 'self':
      return [attacker];
    case 'all':
      return pickable;
    case 'lowest_hp':
      return pickable
        .slice()
        .sort((a, b) => a.hp / a.base.hp - b.hp / b.base.hp)
        .slice(0, skill.targets ?? pickable.length);
    case 'random': {
      const n = Math.min(skill.targets ?? 1, pickable.length);
      const pool = [...pickable];
      const out: Combatant[] = [];
      for (let i = 0; i < n && pool.length > 0; i += 1) {
        const idx = randInt(ctx.rng, pool.length);
        out.push(pool.splice(idx, 1)[0]!);
      }
      return out;
    }
    case 'row': {
      const first = firstColumnTarget(pickable, attacker.column);
      if (!first) return [];
      return pickable.filter((u) => u.row === first.row);
    }
    case 'column':
    default: {
      if (skill.targets !== undefined && skill.targets > 1) {
        const ownColumn = pickable.filter((u) => u.column === attacker.column);
        return ownColumn.length > 0
          ? orderedByColumn(ownColumn)
          : orderedByColumn(pickable).slice(0, skill.targets);
      }
      const t = firstColumnTarget(pickable, attacker.column);
      return t ? [t] : [];
    }
  }
}

function firstColumnTarget(pickable: Combatant[], column: number): Combatant | undefined {
  const front = pickable.filter((u) => u.row === 'front');
  const inColumn = front.find((u) => u.column === column);
  if (inColumn) return inColumn;
  const nearestFront = nearestByColumn(front, column)[0];
  if (nearestFront) return nearestFront;
  const back = pickable.filter((u) => u.row === 'back');
  const backInColumn = back.find((u) => u.column === column);
  if (backInColumn) return backInColumn;
  return nearestByColumn(back, column)[0];
}

/** Nearest column by column distance (ties to the lower column), row order kept. */
function nearestByColumn(units: Combatant[], column: number): Combatant[] {
  return units.slice().sort((a, b) => dist(a.column, column) - dist(b.column, column) || a.column - b.column);
}

function dist(a: number, b: number): number {
  return Math.abs(a - b);
}

function isUntargetable(u: Combatant): boolean {
  return u.buffs.some((b) => b.kind === 'control' && b.tag === 'confinement');
}

/** Column-major order: front row by column, then back row by column. */
export function orderedByColumn(units: Combatant[]): Combatant[] {
  return units.slice().sort((a, b) => {
    if (a.row === 'front' && b.row === 'back') return -1;
    if (a.row === 'back' && b.row === 'front') return 1;
    return a.column - b.column;
  });
}
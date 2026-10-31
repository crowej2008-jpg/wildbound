import { randInt } from '../rng';
import { evalCondition, hasDot, isControlled } from './conditions';
import type {
  BattleContext,
  Combatant,
  SkillDef,
  TargetFilter,
  TargetRule,
  TargetSel,
} from './types';

/**
 * Targeting (measured — stats-and-combat.md 5):
 * - single-target column rule: the enemy front-row unit in the attacker's own
 *   column; else the nearest front column (ties to the lower column); else the
 *   back row by the same rule. lowest HP plays no part.
 * - multi-target skills take the first N of that ordering, or a declared shape.
 * Confined (untargetable) units are skipped; dead rows fall through.
 *
 * M9 adds a side (enemy/ally), a row filter, candidate predicates and the
 * frontline/backline/highest-stat/same-position/adjacent rules. All of it is
 * additive: an omitted field keeps the M1 behaviour.
 */
export function selectTargets(ctx: BattleContext, attacker: Combatant, skill: SkillDef): Combatant[] {
  // A skill `condition` gates its special shape: when false, it falls back to a
  // plain column pick (documented in docs/ASSUMPTIONS.md, M9).
  const gated = !skill.condition || evalCondition(skill.condition, ctx, attacker, undefined);
  return selectFor(ctx, attacker, {
    side: skill.side,
    rule: gated ? skill.rule : 'column',
    n: gated ? skill.targets : undefined,
    rowFilter: gated ? skill.rowFilter : undefined,
    filters: gated ? skill.filters : undefined,
    hasTag: gated ? skill.hasTag : undefined,
  });
}

/** General selector used by skills and (from M9.2) effect riders. */
export function selectFor(ctx: BattleContext, self: Combatant, sel: TargetSel): Combatant[] {
  if (sel.condition && !evalCondition(sel.condition, ctx, self, undefined)) return [];

  const side = sel.side ?? 'enemy';
  const friendly = side === 'ally';
  // M9.6: a taunt forces enemy-side targeting onto the taunter.
  if (!friendly) {
    const taunter = taunterFor(ctx, self);
    if (taunter) return [taunter];
  }
  let pool = ctx.units.filter((u) => u.alive && (friendly ? u.side === self.side : u.side !== self.side));
  if (!friendly) pool = pool.filter((u) => !isUntargetable(u));
  if (sel.excludeSelf) pool = pool.filter((u) => u !== self);
  if (sel.rowFilter) pool = pool.filter((u) => u.row === sel.rowFilter);
  if (sel.filters && sel.filters.length > 0) {
    const narrowed = pool.filter((u) => sel.filters!.every((f) => matchesFilter(f, u)));
    if (narrowed.length > 0) pool = narrowed; // an empty narrowing never blanks the skill
  }
  if (sel.hasTag) {
    const tag = sel.hasTag;
    const tagged = pool.filter((u) => u.buffs.some((b) => b.tag === tag || b.tag.startsWith(`${tag}#`)) || (u.resources?.[tag] ?? 0) > 0);
    if (tagged.length > 0) pool = tagged;
  }
  return applyRule(ctx, self, sel.rule ?? 'column', sel.n, pool);
}

/** The living enemy a `taunt` buff on `self` points at (by id or key). */
export function taunterFor(ctx: BattleContext, self: Combatant): Combatant | undefined {
  const b = self.buffs.find((x) => x.kind === 'taunt');
  if (!b) return undefined;
  return ctx.units.find((u) => u.alive && u.side !== self.side && (u.id === b.source || u.key === b.source));
}

function applyRule(
  ctx: BattleContext,
  self: Combatant,
  rule: TargetRule,
  n: number | undefined,
  pool: Combatant[],
): Combatant[] {
  switch (rule) {
    case 'self':
      return [self];
    case 'all':
      return pool;
    case 'lowest_hp':
      return byRatio(pool, true).slice(0, n ?? 1);
    case 'highest_hp':
      return byRatio(pool, false).slice(0, n ?? 1);
    case 'highest_atk':
      return pool
        .slice()
        .sort((a, b) => attackOf(b) - attackOf(a) || a.position - b.position)
        .slice(0, n ?? 1);
    case 'highest_spd':
      return pool
        .slice()
        .sort((a, b) => b.base.spd - a.base.spd || a.position - b.position)
        .slice(0, n ?? 1);
    case 'random':
      return pickRandom(ctx, pool, n ?? 1);
    case 'frontline': {
      const front = pool.filter((u) => u.row === 'front');
      return (front.length > 0 ? front : pool).slice(0, n ?? (front.length > 0 ? front.length : 1));
    }
    case 'backline': {
      const back = pool.filter((u) => u.row === 'back');
      return (back.length > 0 ? back : pool).slice(0, n ?? (back.length > 0 ? back.length : 1));
    }
    case 'same_position':
      return samePosition(self, pool);
    case 'adjacent':
      return adjacent(self, pool);
    case 'row': {
      const first = firstColumnTarget(pool, self.column);
      if (!first) return [];
      return pool.filter((u) => u.row === first.row);
    }
    case 'column':
    default: {
      if (n !== undefined && n > 1) {
        const ownColumn = pool.filter((u) => u.column === self.column);
        return ownColumn.length > 0
          ? orderedByColumn(ownColumn)
          : orderedByColumn(pool).slice(0, n);
      }
      const t = firstColumnTarget(pool, self.column);
      return t ? [t] : [];
    }
  }
}

function matchesFilter(f: TargetFilter, u: Combatant): boolean {
  if (f === 'dot') return hasDot(u);
  if (f === 'controlled') return isControlled(u);
  if (f === 'debuffed') return u.buffs.some((b) => b.kind === 'stat' && (b.amount ?? 0) < 0);
  if (f === 'fullRage') return u.rage >= 1000;
  if (f === 'shielded') return u.shieldHp > 0;
  return true;
}

function attackOf(u: Combatant): number {
  return Math.max(u.base.pAtk, u.base.sAtk);
}

function byRatio(pool: Combatant[], ascending: boolean): Combatant[] {
  const ratio = (u: Combatant): number => (u.maxHp > 0 ? u.hp / u.maxHp : 0);
  return pool
    .slice()
    .sort((a, b) => (ascending ? ratio(a) - ratio(b) : ratio(b) - ratio(a)) || a.position - b.position);
}

function pickRandom(ctx: BattleContext, pool: Combatant[], n: number): Combatant[] {
  const count = Math.min(n, pool.length);
  const rest = [...pool];
  const out: Combatant[] = [];
  for (let i = 0; i < count && rest.length > 0; i += 1) {
    out.push(rest.splice(randInt(ctx.rng, rest.length), 1)[0]!);
  }
  return out;
}

/** The enemy at the caster's own column (same row preferred) — Zacian's symmetric pick. */
function samePosition(self: Combatant, pool: Combatant[]): Combatant[] {
  const sameColumn = pool.filter((u) => u.column === self.column);
  const pick = sameColumn.find((u) => u.row === self.row) ?? sameColumn[0];
  if (pick) return [pick];
  return nearestByColumn(pool, self.column).slice(0, 1);
}

/** The main column target plus the same-row neighbours one column either side. */
function adjacent(self: Combatant, pool: Combatant[]): Combatant[] {
  const main = firstColumnTarget(pool, self.column);
  if (!main) return [];
  const near = pool.filter((u) => u.row === main.row && Math.abs(u.column - main.column) <= 1);
  return orderedByColumn(near.length > 0 ? near : [main]);
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

import type {
  BattleContext,
  BattleStrategies,
  BattleStrategy,
  Combatant,
  KitDef,
  SkillDef,
  SkillSlot,
} from './types';

/**
 * Squad strategies (M10.5). `StrategyId` was inert data from M3 to M10.4; this
 * module gives it meaning, **opt-in and additive** so every measured M9 behaviour
 * is unchanged: a side with no strategy (or `balanced`) fights exactly as before.
 *
 * What a strategy changes — the *action slot*, never the kit:
 * - The slot is still chosen by the measured rules: the ultimate when the bar is
 *   full, otherwise the `basicReplace` roll. `rollSkillSlot` is always called, so
 *   every strategy consumes the RNG identically and only the *choice* differs
 *   (balanced stays byte-identical to the pre-M10.5 engine).
 * - `aggressive` wants a **damaging** skill, so it never takes the filler roll and
 *   drops to its damaging `basic` when its real skill is support.
 * - `defensive` wants a **support** skill (heal / shield / ally-side), and holds
 *   its ultimate while the whole squad is above `strategyUltHoldHp` — it banks
 *   Rage with normal skills and commits once a Wild is actually hurt.
 *
 * Targeting rules stay exactly as the M9 kits declare them: a strategy must not
 * rewrite a kit's `rule`, or the port would stop being faithful.
 */

export type SkillRole = 'damage' | 'support' | 'neutral';

/** What a skill is *for*: support when it heals/shields or acts on its own side. */
export function skillRole(skill: SkillDef): SkillRole {
  if (skill.heal || skill.shield || skill.side === 'ally') return 'support';
  return skill.rates.some((rate) => rate > 0) ? 'damage' : 'neutral';
}

/** One side's strategy (`balanced` when the caller passed none). */
export function sideStrategy(strategies: BattleStrategies | undefined, side: Combatant['side']): BattleStrategy {
  return strategies?.[side] ?? 'balanced';
}

/** True while no living ally of `u` is at or below `holdHp` of its max HP. */
export function squadHealthy(ctx: BattleContext, u: Combatant, holdHp: number): boolean {
  return !ctx.units.some((x) => x.side === u.side && x.alive && x.hp / x.maxHp <= holdHp);
}

/**
 * A defensive squad's ultimate discipline: hold it while the squad is healthy.
 * Always false for the other strategies, so their timing is untouched.
 */
export function holdsUltimate(ctx: BattleContext, u: Combatant, strategy: BattleStrategy): boolean {
  return strategy === 'defensive' && squadHealthy(ctx, u, ctx.settings.strategyUltHoldHp);
}

/**
 * The slot a unit acts with: the measured `roll` unless the strategy overrides it.
 * `ultUsable` is false when the ultimate is unavailable (bar not full, silenced, or
 * held back), which keeps the ultimate out of every candidate slate.
 */
export function chooseSlot(
  strategy: BattleStrategy,
  kit: KitDef,
  ultUsable: boolean,
  roll: SkillSlot,
): SkillSlot {
  if (strategy === 'balanced') return roll;
  const wanted: SkillRole = strategy === 'aggressive' ? 'damage' : 'support';
  const slate: SkillSlot[] = ultUsable ? ['ult', 'normal', 'basic'] : ['normal', 'basic'];
  const preferred = slate.find((slot) => skillRole(kit.skills[slot]) === wanted);
  if (preferred) return preferred;
  // Nothing of the wanted role is on the kit: `aggressive` still refuses the filler
  // (it would rather use its real skill), while `defensive` keeps the measured roll
  // — a kit with no support skill has nothing for it to prefer.
  if (strategy === 'aggressive') return ultUsable ? 'ult' : 'normal';
  return roll;
}

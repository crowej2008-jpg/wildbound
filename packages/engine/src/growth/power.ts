import type { CoreStats, PercentLines } from '../model';
import type { PowerWeights } from './types';

/**
 * Power (M2, PROMPT §5 / docs/design/wilds.md). Mirrors the reference shape:
 *
 *   F = Σ core_rate/10 × stat                (flat core contribution)
 *   A = Σ power_rate/10 × (percent × scale)  (additive percent contribution)
 *   E = Σ ext_rate/100000 × (percent × scale)(percent-of-power extension)
 *   Power = floor(F × (1 + E) + A)
 *
 * `percent` is authored as fractions (0.35 == 35%); `scale` converts to the
 * formula's hundredths-of-a-percent units, and its magnitude only shifts the
 * constant part of the result.
 */
export function computePower(core: CoreStats, percent: Partial<PercentLines>, weights: PowerWeights): number {
  let flat = 0;
  flat += (weights.core.hp / 10) * core.hp;
  flat += (weights.core.pAtk / 10) * core.pAtk;
  flat += (weights.core.sAtk / 10) * core.sAtk;
  flat += (weights.core.pDef / 10) * core.pDef;
  flat += (weights.core.sDef / 10) * core.sDef;
  flat += (weights.core.spd / 10) * core.spd;

  let additive = 0;
  let extension = 0;
  for (const key of Object.keys(weights.percent) as (keyof PercentLines)[]) {
    const row = weights.percent[key];
    const value = percent[key];
    if (!row || value === undefined) continue;
    const scaled = value * weights.scale;
    additive += (row.powerRate / 10) * scaled;
    extension += (row.extRate / 100000) * scaled;
  }

  return Math.floor(flat * (1 + extension) + additive);
}

/** Team Power is the plain sum of member Power (PROMPT §5). */
export function teamPower(members: number[]): number {
  return members.reduce((sum, value) => sum + value, 0);
}

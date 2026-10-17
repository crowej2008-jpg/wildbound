import { describe, expect, it } from 'vitest';
import { applyEffects } from './effects';
import { makeCtx, sheet, skill, unit } from './fixtures';
import { tickRegen } from './dot';
import type { Combatant } from './types';

/** M9.2: effect riders — buff/heal/shield/cleanse/dispel/immune/rage/revive/damage. */

function scene(): { caster: Combatant; ally: Combatant; enemy: Combatant; ctx: ReturnType<typeof makeCtx> } {
  const caster = unit({ key: 'a', side: 'attackers', position: 1, sheet: sheet({ hp: 1000, pAtk: 300 }) });
  const ally = unit({ key: 'b', side: 'attackers', position: 2, sheet: sheet({ hp: 1000 }) });
  const enemy = unit({ key: 'd', side: 'defenders', position: 4, sheet: sheet({ hp: 1000 }) });
  return { caster, ally, enemy, ctx: makeCtx({ units: [caster, ally, enemy], deterministic: true }) };
}

describe('M9.2 buff / heal / shield riders', () => {
  it('buffs every ally through a side:ally selector', () => {
    const s = skill({
      slot: 'normal',
      effects: [
        { op: 'buff', target: { side: 'ally', rule: 'all' }, buff: { tag: 'atkUp', kind: 'stat', field: 'pAtk', amount: 0.2, turns: 2 } },
      ],
    });
    const { caster, ally, ctx } = scene();
    applyEffects(ctx, caster, s, []);
    expect(caster.buffs.some((b) => b.tag === 'atkUp')).toBe(true);
    expect(ally.buffs.some((b) => b.tag === 'atkUp')).toBe(true);
  });

  it('heals and shields allies', () => {
    const s = skill({
      slot: 'normal',
      effects: [
        { op: 'heal', target: { side: 'ally', rule: 'lowest_hp' }, rate: 0.25 },
        { op: 'shield', target: { side: 'ally', rule: 'lowest_hp' }, share: 0.3, basis: 'casterHp' },
      ],
    });
    const { caster, ally, ctx } = scene();
    ally.hp = 100;
    applyEffects(ctx, caster, s, []);
    expect(ally.hp).toBe(350); // +25% of max 1000
    expect(ally.shieldHp).toBe(300); // 30% of caster max HP
  });

  it('heal-over-time becomes a regen buff that ticks', () => {
    const s = skill({
      slot: 'normal',
      effects: [{ op: 'heal', target: { side: 'ally', rule: 'all' }, rate: 0.2, over: 2 }],
    });
    const { caster, ally, ctx } = scene();
    ally.hp = 500;
    applyEffects(ctx, caster, s, []);
    expect(ally.buffs.some((b) => b.kind === 'regen')).toBe(true);
    const before = ally.hp;
    tickRegen(ctx, ally);
    expect(ally.hp).toBe(before + 100); // (0.2 × 1000) / 2 per tick
  });
});

describe('M9.2 cleanse / dispel / immunity', () => {
  it('cleanse strips negative buffs but not undispellable ones', () => {
    const s = skill({ slot: 'normal', effects: [{ op: 'cleanse', target: { side: 'ally', rule: 'all' } }] });
    const { caster, ally, ctx } = scene();
    ally.buffs.push({ tag: 'stun', kind: 'control', source: 'x', turns: 1 });
    ally.buffs.push({ tag: 'cursed', kind: 'stat', source: 'x', field: 'pAtk', amount: -0.3, turns: 3 });
    ally.buffs.push({ tag: 'sealed', kind: 'control', source: 'x', turns: 5, undispellable: true });
    applyEffects(ctx, caster, s, []);
    expect(ally.buffs.some((b) => b.tag === 'stun')).toBe(false);
    expect(ally.buffs.some((b) => b.tag === 'cursed')).toBe(false);
    expect(ally.buffs.some((b) => b.tag === 'sealed')).toBe(true);
  });

  it('dispel strips positive buffs from enemies', () => {
    const s = skill({ slot: 'normal', effects: [{ op: 'dispel', target: { side: 'enemy', rule: 'all' } }] });
    const { caster, enemy, ctx } = scene();
    enemy.buffs.push({ tag: 'atkUp', kind: 'stat', source: 'x', field: 'pAtk', amount: 0.5, turns: 2 });
    enemy.buffs.push({ tag: 'shieldBuff', kind: 'immune', source: 'x', turns: 2 });
    applyEffects(ctx, caster, s, []);
    expect(enemy.buffs.some((b) => b.tag === 'atkUp')).toBe(false);
    expect(enemy.buffs.some((b) => b.tag === 'shieldBuff')).toBe(false);
  });

  it('an immunity buff blocks a guaranteed control', () => {
    const s = skill({
      slot: 'normal',
      effects: [{ op: 'control', target: { side: 'enemy' }, control: { kind: 'stun', chance: null } }],
    });
    const { caster, enemy, ctx } = scene();
    enemy.buffs.push({ tag: 'safeguard', kind: 'immune', source: 'x' });
    applyEffects(ctx, caster, s, []);
    expect(enemy.buffs.some((b) => b.tag === 'stun')).toBe(false);
    expect(ctx.events.some((e) => e.type === 'immunity')).toBe(true);
  });
});

describe('M9.2 rage / revive / damage riders', () => {
  it('steals rage from an enemy and gives it to the caster', () => {
    const s = skill({ slot: 'normal', effects: [{ op: 'rage', target: { side: 'enemy' }, delta: 200, steal: true }] });
    const { caster, enemy, ctx } = scene();
    caster.rage = 0;
    enemy.rage = 500;
    applyEffects(ctx, caster, s, []);
    expect(enemy.rage).toBe(300);
    expect(caster.rage).toBe(200);
  });

  it('revives a dead ally once', () => {
    const s = skill({ slot: 'normal', effects: [{ op: 'revive', target: { side: 'ally' }, hpPct: 0.5, once: true }] });
    const { caster, ally, ctx } = scene();
    ally.alive = false;
    ally.hp = 0;
    applyEffects(ctx, caster, s, []);
    expect(ally.alive).toBe(true);
    expect(ally.hp).toBe(500);
  });

  it('deals a secondary damage instance', () => {
    const s = skill({ slot: 'normal', effects: [{ op: 'damage', target: { side: 'enemy' }, rate: 1.0, type: 'P' }] });
    const { caster, enemy, ctx } = scene();
    const before = enemy.hp;
    applyEffects(ctx, caster, s, []);
    expect(enemy.hp).toBe(before - 300); // caster pAtk 300
  });

  it('chance riders never land in deterministic mode', () => {
    const s = skill({
      slot: 'normal',
      effects: [{ op: 'buff', target: { side: 'ally', rule: 'all' }, chance: 1, buff: { tag: 'x', kind: 'stat', field: 'spd', amount: 0.1, turns: 1 } }],
    });
    const { caster, ctx } = scene();
    applyEffects(ctx, caster, s, []);
    expect(caster.buffs.some((b) => b.tag === 'x')).toBe(false);
  });
});

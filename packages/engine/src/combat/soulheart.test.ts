import { describe, expect, it } from 'vitest';
import { runBattle } from './battle';
import { applyControl } from './control';
import { computeDamage } from './damage';
import { kit, makeCtx, sheet, spec, unit } from './fixtures';
import {
  soulheartBattleStart,
  soulheartRoundEnd,
  soulheartRoundStart,
  soulheartTurnStart,
} from './soulheart';
import { effective } from './stats';
import { applyHeal } from './sustain';
import type { Combatant, SoulheartHooks, SpecInput } from './types';

function hooked(hooks: SoulheartHooks, over: { hp?: number; sheetHp?: number } = {}): Combatant {
  const u = unit({
    key: 'a',
    side: 'attackers',
    position: 1,
    sheet: sheet({ hp: over.sheetHp ?? 1000 }),
    hp: over.hp,
  });
  u.soulheart = hooks;
  return u;
}

describe('Soul-heart battle-start hooks', () => {
  it('applies guards, multipliers and the start shield', () => {
    const u = hooked(
      {
        startDmgRdct: 0.1,
        firstRoundDmgRdct: 0.25,
        spiritDefMult: 1.5,
        firstRoundSpiritDefMult: 2,
        spiritAtkMult: 1.1,
        sAtkMult: 1.2,
        startShield: 0.25,
      },
      { sheetHp: 1000 },
    );
    u.base.spiritDef = 200;
    u.base.spiritAtk = 100;
    u.base.sAtk = 100;
    const ctx = makeCtx({ units: [u] });

    soulheartBattleStart(ctx);

    expect(u.shieldHp).toBe(250);
    expect(effective(u.base, u.buffs, 'dmgRdct')).toBeCloseTo(0.35);
    expect(effective(u.base, u.buffs, 'spiritDef')).toBeCloseTo(500);
    expect(effective(u.base, u.buffs, 'spiritAtk')).toBeCloseTo(110);
    expect(effective(u.base, u.buffs, 'sAtk')).toBeCloseTo(120);
    expect(u.buffs.some((b) => b.tag === 'soulheartFirstGuard')).toBe(true);
  });
});

describe('Soul-heart round cadence', () => {
  it('grants puncture and immunity only on the authored third rounds', () => {
    const u = hooked({ punctureEvery: 3, controlImmunityEvery: 3 });
    const foe = unit({ key: 'd', side: 'defenders', position: 4 });
    const ctx = makeCtx({ units: [u, foe] });

    soulheartRoundStart(ctx);
    expect(u.buffs.some((b) => b.kind === 'puncture')).toBe(false);
    expect(u.buffs.some((b) => b.kind === 'immune')).toBe(false);

    ctx.round = 3;
    soulheartRoundStart(ctx);
    expect(u.buffs.some((b) => b.kind === 'puncture')).toBe(true);
    expect(u.buffs.some((b) => b.kind === 'immune')).toBe(true);

    applyControl(ctx, foe, [u], { kind: 'stun', chance: null });
    expect(u.buffs.some((b) => b.kind === 'control')).toBe(false);
    expect(ctx.events.some((e) => e.type === 'immunity' && e.unit === u.key)).toBe(true);

    ctx.round = 4;
    soulheartRoundStart(ctx);
    expect(u.buffs.some((b) => b.kind === 'puncture')).toBe(false);
    expect(u.buffs.some((b) => b.kind === 'immune')).toBe(false);
  });

  it('heals on the authored end rounds and at the start of the holder turn', () => {
    const u = hooked({ roundHeal: { rounds: [4, 8], rate: 0.25 }, turnHeal: 0.1 }, { hp: 500 });
    const ctx = makeCtx({ units: [u] });

    soulheartRoundEnd(ctx, 3);
    expect(u.hp).toBe(500);
    soulheartRoundEnd(ctx, 4);
    expect(u.hp).toBe(750);
    soulheartRoundEnd(ctx, 5);
    expect(u.hp).toBe(750);
    soulheartTurnStart(ctx, u);
    expect(u.hp).toBe(850);
  });
});

describe('Soul-heart damage and sustain hooks', () => {
  it('adds damage while the attacker carries a shield', () => {
    const atk = unit({ key: 'a', side: 'attackers', position: 1, shieldHp: 100, sheet: sheet({ pAtk: 200 }) });
    atk.soulheart = { shieldedDmgBonus: 0.5 };
    const def = unit({ key: 'd', side: 'defenders', position: 4, sheet: sheet({ hp: 1000 }) });
    const ctx = makeCtx({ units: [atk, def], deterministic: true });

    const out = computeDamage(
      {
        attacker: atk,
        defender: def,
        skill: atk.kit.skills.normal,
        hitIndex: 0,
        team: { attackersPower: 100, defendersPower: 100 },
      },
      ctx,
    );

    expect(out.dmg).toBe(300);
  });

  it('turns overhealing into a shield', () => {
    const u = hooked({ overhealShield: 0.5 }, { hp: 950 });
    const ctx = makeCtx({ units: [u] });

    applyHeal(ctx, u, 200);

    expect(u.hp).toBe(1000);
    expect(u.shieldHp).toBe(75);
  });

  it('paralyses on hit and heals the defender when attacked', () => {
    const atk: SpecInput = spec({ id: 'a', side: 'attackers', position: 1, kit: kit() });
    atk.soulheart = { paralysisChance: 1 };
    const def = spec({ id: 'd', side: 'defenders', position: 4, kit: kit() });
    def.soulheart = { onHitHeal: { chance: 1, rate: 0.05 } };

    const result = runBattle({ attackers: [atk], defenders: [def], seed: 3 });

    expect(
      result.events.some((e) => e.type === 'control' && e.tgt === 'defenders:4' && e.kind === 'paralysis' && e.landed),
    ).toBe(true);
    expect(result.events.some((e) => e.type === 'heal' && e.tgt === 'defenders:4')).toBe(true);
  });

  it('punctures an enemy start shield on the cadence round', () => {
    const atk = spec({ id: 'a', side: 'attackers', position: 1, kit: kit() });
    atk.soulheart = { punctureEvery: 1 };
    const def = spec({ id: 'd', side: 'defenders', position: 4, kit: kit() });
    def.soulheart = { startShield: 0.8 };

    const result = runBattle({ attackers: [atk], defenders: [def], seed: 1, deterministic: true });
    const firstHit = result.events.find((e) => e.type === 'hit' && e.tgt === 'defenders:4');

    expect(firstHit && firstHit.type === 'hit' ? firstHit.hpAfter : 1000).toBeLessThan(1000);
  });
});

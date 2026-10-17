import { describe, expect, it } from 'vitest';
import { runBattle } from './battle';
import { kit, makeCtx, sheet, spec, unit } from './fixtures';
import { takeTurn } from './skills';
import { fireTriggers } from './triggers';

/** M9.4: talent triggers, rage shorthands and the recursion cap. */

const team = { attackersPower: 100, defendersPower: 100 };

describe('M9.4 trigger gates', () => {
  it('applies the buff shorthand on battle start', () => {
    const k = kit({
      talents: { triggers: [{ on: 'battleStart', buff: { tag: 'ready', kind: 'stat', field: 'pAtk', amount: 0.5, turns: 99 } }] },
    });
    const a = unit({ key: 'a', side: 'attackers', position: 1, kit: k });
    const ctx = makeCtx({ units: [a], deterministic: true });
    fireTriggers(ctx, a, 'battleStart');
    expect(a.buffs.some((b) => b.tag === 'ready')).toBe(true);
  });

  it('applies the rage shorthand', () => {
    const k = kit({ talents: { triggers: [{ on: 'turnStart', rage: 200 }] } });
    const a = unit({ key: 'a', side: 'attackers', position: 1, kit: k, rage: 0 });
    const ctx = makeCtx({ units: [a], deterministic: true });
    fireTriggers(ctx, a, 'turnStart');
    expect(a.rage).toBe(200);
  });

  it('honours the per-turn cap and resets each big round', () => {
    const k = kit({ talents: { triggers: [{ on: 'onHit', perTurn: 1, rage: 100 }] } });
    const a = unit({ key: 'a', side: 'attackers', position: 1, kit: k, rage: 0 });
    const ctx = makeCtx({ units: [a], deterministic: true });
    fireTriggers(ctx, a, 'onHit');
    fireTriggers(ctx, a, 'onHit');
    expect(a.rage).toBe(100);
    ctx.round = 2;
    fireTriggers(ctx, a, 'onHit');
    expect(a.rage).toBe(200);
  });

  it('honours the cooldown in big rounds', () => {
    const k = kit({ talents: { triggers: [{ on: 'onHit', cooldown: 2, rage: 100 }] } });
    const a = unit({ key: 'a', side: 'attackers', position: 1, kit: k, rage: 0 });
    const ctx = makeCtx({ units: [a], deterministic: true });
    fireTriggers(ctx, a, 'onHit');
    fireTriggers(ctx, a, 'onHit');
    expect(a.rage).toBe(100);
    ctx.round = 3;
    fireTriggers(ctx, a, 'onHit');
    expect(a.rage).toBe(200);
  });

  it('latches hpBelow and re-arms once HP climbs back', () => {
    const k = kit({ talents: { triggers: [{ on: 'hpBelow', hpBelow: 0.5, rage: 100 }] } });
    const a = unit({ key: 'a', side: 'attackers', position: 1, kit: k, rage: 0, sheet: sheet({ hp: 1000 }), hp: 400 });
    const ctx = makeCtx({ units: [a], deterministic: true });
    fireTriggers(ctx, a, 'hpBelow');
    fireTriggers(ctx, a, 'hpBelow');
    expect(a.rage).toBe(100);
    a.hp = 600; // above the threshold: re-arm
    fireTriggers(ctx, a, 'hpBelow');
    expect(a.rage).toBe(100);
    a.hp = 400;
    fireTriggers(ctx, a, 'hpBelow');
    expect(a.rage).toBe(200);
  });

  it('never lands a chance trigger in deterministic mode', () => {
    const k = kit({ talents: { triggers: [{ on: 'turnStart', chance: 1, rage: 100 }] } });
    const a = unit({ key: 'a', side: 'attackers', position: 1, kit: k, rage: 0 });
    const ctx = makeCtx({ units: [a], deterministic: true });
    fireTriggers(ctx, a, 'turnStart');
    expect(a.rage).toBe(0);
  });
});

describe('M9.4 triggers inside a battle', () => {
  it('fires battle-start and turn-start triggers from the loop', () => {
    const k = kit({
      talents: {
        triggers: [
          { on: 'battleStart', buff: { tag: 'ready', kind: 'stat', field: 'pAtk', amount: 0.5, turns: 99 } },
          { on: 'turnStart', rage: 100 },
        ],
      },
    });
    const a = spec({ id: 'a', side: 'attackers', position: 1, kit: k, sheet: sheet() });
    const d = spec({ id: 'd', side: 'defenders', position: 4, kit: kit(), sheet: sheet({ hp: 5000 }) });
    const res = runBattle({ attackers: [a], defenders: [d], seed: 1, deterministic: true });
    expect(res.events.some((e) => e.type === 'buffApplied' && e.tag === 'ready')).toBe(true);
    expect(res.events.some((e) => e.type === 'rageChange' && e.delta === 100)).toBe(true);
  });

  it('retaliates from an on-hit trigger', () => {
    const k = kit({ talents: { triggers: [{ on: 'onHit', effects: [{ op: 'damage', target: { side: 'enemy' }, rate: 0.5 }] }] } });
    const a = unit({ key: 'a', side: 'attackers', position: 1, sheet: sheet({ pAtk: 200 }) });
    const d = unit({ key: 'd', side: 'defenders', position: 4, kit: k, sheet: sheet({ hp: 1000 }) });
    const ctx = makeCtx({ units: [a, d], deterministic: true });
    takeTurn(ctx, a, { bigRound: 1, team });
    expect(a.hp).toBe(900); // 0.5 × 200 retaliation
  });

  it('fires an on-kill trigger when the target dies', () => {
    const k = kit({ talents: { triggers: [{ on: 'onKill', rage: 300 }] } });
    const a = unit({ key: 'a', side: 'attackers', position: 1, kit: k, sheet: sheet({ pAtk: 500 }), rage: 0 });
    const d = unit({ key: 'd', side: 'defenders', position: 4, sheet: sheet({ hp: 100 }), hp: 100 });
    const ctx = makeCtx({ units: [a, d], deterministic: true });
    takeTurn(ctx, a, { bigRound: 1, team });
    expect(d.alive).toBe(false);
    expect(a.rage).toBeGreaterThanOrEqual(300);
  });

  it('fires an on-death trigger for the dying unit', () => {
    const k = kit({
      talents: {
        triggers: [
          { on: 'onDeath', effects: [{ op: 'damage', target: { side: 'enemy' }, rate: 1.0, type: 'S' }] },
        ],
      },
    });
    const a = unit({ key: 'a', side: 'attackers', position: 1, sheet: sheet({ pAtk: 100, hp: 1000 }) });
    const d = unit({ key: 'd', side: 'defenders', position: 4, kit: k, sheet: sheet({ hp: 100, sAtk: 100 }), hp: 100 });
    const ctx = makeCtx({ units: [a, d], deterministic: true });
    takeTurn(ctx, a, { bigRound: 1, team });
    expect(d.alive).toBe(false);
    expect(a.hp).toBe(900); // the corpse's parting shot
  });

  it('caps trigger nesting so two retaliations cannot loop', () => {
    const retaliate = (): ReturnType<typeof kit> =>
      kit({ talents: { triggers: [{ on: 'onHit', effects: [{ op: 'damage', target: { side: 'enemy' }, rate: 0.1 }] }] } });
    const a = unit({ key: 'a', side: 'attackers', position: 1, kit: retaliate(), sheet: sheet({ hp: 10000, pAtk: 100 }) });
    const d = unit({ key: 'd', side: 'defenders', position: 4, kit: retaliate(), sheet: sheet({ hp: 10000, sAtk: 100 }) });
    const ctx = makeCtx({ units: [a, d], deterministic: true, settings: { triggerDepthCap: 2 } });
    takeTurn(ctx, a, { bigRound: 1, team });
    expect(a.hp).toBeLessThan(10000);
    expect(d.hp).toBeLessThan(10000);
    expect(a.hp).toBeGreaterThan(0); // terminates instead of overflowing the stack
  });

  it('a rageStart talent overrides the class default', () => {
    const k = kit({ talents: { rageStart: 1000 } }); // guardian default is 500
    const a = spec({ id: 'a', side: 'attackers', position: 1, kit: k, sheet: sheet() });
    const d = spec({ id: 'd', side: 'defenders', position: 4, kit: kit(), sheet: sheet({ hp: 5000 }) });
    const res = runBattle({ attackers: [a], defenders: [d], seed: 1, deterministic: true });
    const firstAction = res.events.find((e) => e.type === 'action');
    expect(firstAction && firstAction.type === 'action' ? firstAction.skill : null).toBe('ult');
  });
});

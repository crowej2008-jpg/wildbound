import { describe, expect, it } from 'vitest';
import { channelHit } from './damage';
import { kit, makeCtx, sheet, unit } from './fixtures';

/** R9 (owner, 2026-11-02): a `lethalHits` kit's direct hits are fatal. */

describe('lethal hits', () => {
  const lethal = () => unit({ key: 'a', side: 'attackers', position: 1, kit: kit({ talents: { lethalHits: true } }) });

  it('one direct hit defeats a full-HP target through shields, invulnerability and endure', () => {
    const a = lethal();
    const d = unit({ key: 'd', side: 'defenders', position: 4, sheet: sheet({ hp: 1e9 }) });
    d.shieldHp = 5e8;
    d.buffs.push({ tag: 'inv', kind: 'invulnerable', source: 'd' }, { tag: 'end', kind: 'endure', source: 'd' });
    const ctx = makeCtx({ units: [a, d], deterministic: true });
    channelHit(ctx, a, d, 1);
    expect(d.alive).toBe(false);
    expect(d.hp).toBe(0);
    expect(d.shieldHp).toBe(5e8);
  });

  it('a damage-over-time tick or a reflect is not a lethal hit', () => {
    const a = lethal();
    const d = unit({ key: 'd', side: 'defenders', position: 4, sheet: sheet({ hp: 1000 }) });
    const ctx = makeCtx({ units: [a, d], deterministic: true });
    channelHit(ctx, a, d, 10, { kind: 'dot' });
    channelHit(ctx, a, d, 10, { kind: 'reflect' });
    expect(d.hp).toBe(980);
    expect(d.alive).toBe(true);
  });

  it('a zero-damage hit stays harmless and an undying side is held at 1 HP', () => {
    const a = lethal();
    const d = unit({ key: 'd', side: 'defenders', position: 4, sheet: sheet({ hp: 1000 }) });
    const ctx = makeCtx({ units: [a, d], deterministic: true });
    channelHit(ctx, a, d, 0);
    expect(d.hp).toBe(1000);
    ctx.rules = { undyingDefenders: true };
    channelHit(ctx, a, d, 5);
    expect(d.hp).toBe(1);
    expect(d.alive).toBe(true);
  });

  it('a plain kit deals only its damage', () => {
    const a = unit({ key: 'a', side: 'attackers', position: 1 });
    const d = unit({ key: 'd', side: 'defenders', position: 4, sheet: sheet({ hp: 1000 }) });
    const ctx = makeCtx({ units: [a, d], deterministic: true });
    channelHit(ctx, a, d, 10);
    expect(d.hp).toBe(990);
  });
});

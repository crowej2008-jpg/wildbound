import { describe, expect, it } from 'vitest';
import { initialAccount3 } from './account3';
import { buildWildTeam, fielded } from './battle';
import { buildConfig } from './config';
import { createInitialState } from './save';
import { treasureAura } from './treasure-skills';
import { bossHpLeft } from './park';

function account() {
  const config = buildConfig();
  const state = createInitialState(config);
  const gyms = Object.fromEntries(config.account3.treasures.list.map((t) => [`gym-${t.gym}`, true]));
  state.campaign = { ...state.campaign, gyms };
  const a3 = initialAccount3();
  for (const t of config.account3.treasures.list) a3.treasures[String(t.type)] = { level: 200, accessory: 50, refine: 50, star: 0, faction: null };
  return { config, state: { ...state, account3: a3 } };
}

describe('trainer-treasure battle skills', () => {
  it('no treasures, no aura', () => {
    const config = buildConfig();
    expect(treasureAura(config, createInitialState(config))).toBeNull();
  });

  it('levelled treasures give shields, heals, ATK windows and foe debuffs', () => {
    const { config, state } = account();
    const aura = treasureAura(config, state)!;
    expect(aura).not.toBeNull();
    expect(aura.allies.soulheart.startShield).toBeGreaterThan(0.1);
    expect(aura.allies.soulheart.roundHeal?.rounds[0]).toBe(1);
    expect(aura.allies.roundEffects.some((e) => e.field === 'atkPct' && (e.add ?? 0) > 0)).toBe(true);
    expect(aura.foeBack.some((e) => e.field === 'atkPct' && (e.add ?? 0) < 0)).toBe(true);
    expect(aura.foeFront.some((e) => e.field === 'dmgRdct' && (e.add ?? 0) < 0)).toBe(true);
    const team = buildWildTeam(fielded(state, 'campaign'), 'attackers', config, state);
    expect(team.foe?.front.length).toBeGreaterThan(0);
    expect(team.specs[0]?.soulheart?.startShield).toBeGreaterThan(0);
  });

  it('park helpers still import cleanly', () => {
    expect(typeof bossHpLeft).toBe('function');
  });
});

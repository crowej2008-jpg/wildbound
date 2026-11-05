import { describe, expect, it } from 'vitest';
import { xpForLevel } from '@wildbound/engine';
import { buildConfig } from './config';
import { challengeSquad, claimJointMilestone, exploreWild, levelSquadSkill, prepareJointTeam, prepareWild, squadSkillLines, teleportWild } from './joint-team';
import { buildJointTeamView } from './joint-team-view';
import { createInitialState } from './save';

// Wednesday 12:00 UTC: a battle day, inside the Wild Area window.
const NOW = Date.UTC(2026, 10, 11, 12);

function account() {
  const config = buildConfig();
  config.now = () => NOW;
  const state = createInitialState(config);
  state.profile.level = 45;
  state.profile.xp = xpForLevel(45, config.xpCurve);
  state.serverEpoch = NOW - 20 * 86_400_000;
  state.roster = state.roster.map((w) => ({ ...w, level: 120, stars: w.stars + 5 }));
  return { config, state };
}

describe('Joint Team', () => {
  it('opens on server day 15 at level 45 and offers three rival squads', () => {
    const { config, state } = account();
    expect(challengeSquad(config, { ...state, serverEpoch: NOW }, NOW, 0).ok).toBe(false);
    const view = buildJointTeamView(config, state, NOW);
    expect(view.unlocked).toBe(true);
    expect(view.battles.opponents).toHaveLength(3);
    expect(view.battles.battlesLeft).toBe(3);
  });

  it('a challenge scores Team Points win or lose and pays Core Skill Stones; milestones claim', () => {
    const { config, state } = account();
    const out = challengeSquad(config, state, NOW, 0, 5);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.value.points).toBeGreaterThanOrEqual(60);
    expect(out.value.state.jointTeam!.battles).toBe(1);
    const claim = claimJointMilestone(config, out.value.state, NOW, 'p', 1);
    expect(claim.ok).toBe(true);
    let s = out.value.state;
    for (let i = 0; i < 2; i += 1) {
      const r = challengeSquad(config, s, NOW, 1, i);
      if (r.ok) s = r.value.state;
    }
    expect(challengeSquad(config, s, NOW, 0).ok).toBe(false);
  });

  it('squad skills cost Core Skill Stones and add account lines', () => {
    const { config, state } = account();
    const s = { ...prepareJointTeam(config, state, NOW).state, currencies: { ...state.currencies, coreSkillStone: 1000 } };
    const up = levelSquadSkill(config, s, NOW, 'crit');
    expect(up.ok).toBe(true);
    if (up.ok) expect(squadSkillLines(config, up.value)).toEqual([{ kind: 'percent', field: 'crit', base: 0.001, perLevel: 0 }]);
  });

  it('the Wild Area spends energy per explore, pays points and drops, and teleports', () => {
    const { config, state } = account();
    let s = prepareWild(config, state, NOW).state;
    expect(s.wildArea!.energy).toBe(120);
    let points = 0;
    for (let i = 0; i < 8; i += 1) {
      const r = exploreWild(config, s, NOW, 1, i + 1);
      if (!r.ok) break;
      s = r.value.state;
      points += r.value.points;
      if (s.wildArea!.guess) s = { ...s, wildArea: { ...s.wildArea!, guess: null } };
    }
    expect(s.wildArea!.energy).toBeLessThan(120);
    expect(s.wildArea!.points).toBeGreaterThanOrEqual(points);
    const tele = teleportWild(config, { ...s, currencies: { ...s.currencies, teleporter: 3 } }, NOW);
    expect(tele.ok).toBe(true);
    if (tele.ok) expect(tele.value.wildArea!.zone).toBe(Math.min(3, s.wildArea!.zone + 1));
  });
});

import { describe, expect, it } from 'vitest';
import { CAMPAIGN, CHAPTERS, GYMS, STAGES } from './index';
import { gymByChapter } from './campaign';
import { WILDS } from './species';

/**
 * M13.0a campaign volume and gate shape: 182 chapters x 10 stages, 60 gyms at
 * every third chapter, one gate per gym, and every enemy resolves to a species.
 */
describe('campaign content', () => {
  const speciesIds = new Set(WILDS.map((wild) => wild.id));

  it('has 182 chapters and 1,820 stages in chapter order', () => {
    expect(CHAPTERS).toHaveLength(182);
    expect(STAGES).toHaveLength(1820);
    for (const chapter of CHAPTERS) {
      const stages = STAGES.filter((stage) => stage.chapter === chapter.number);
      expect(stages, `chapter ${chapter.number}`).toHaveLength(10);
      expect(stages.map((stage) => stage.index)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    }
  });

  it('places one gym gate on the first stage of every third chapter', () => {
    const gated = STAGES.filter((stage) => stage.gate);
    expect(gated).toHaveLength(60);
    expect(GYMS).toHaveLength(60);
    for (const gym of GYMS) {
      expect(gym.index).toBe(gym.chapter / 3);
      expect(gym.chapter % 3).toBe(0);
      expect(gym.id).toBe(`gym-${gym.index}`);
      expect(gymByChapter(gym.chapter)?.id).toBe(gym.id);
      const stage = STAGES.find((candidate) => candidate.id === `c${gym.chapter}-1`);
      expect(stage?.gate?.gymId).toBe(gym.id);
      expect(stage?.chapter).toBe(gym.chapter);
      expect(stage?.index).toBe(1);
    }
    expect(gated[0]?.id).toBe('c3-1');
    expect(gated.at(-1)?.id).toBe('c180-1');
  });

  it('keeps every stage and gym enemy inside the roster and tuning caps', () => {
    for (const stage of STAGES) {
      expect(stage.enemies.length).toBeGreaterThan(0);
      expect(stage.enemies.length).toBeLessThanOrEqual(6);
      for (const enemy of stage.enemies) {
        expect(speciesIds.has(enemy.speciesId), `${stage.id}: ${enemy.speciesId}`).toBe(true);
        expect(enemy.level).toBeGreaterThanOrEqual(1);
        expect(enemy.level).toBeLessThanOrEqual(135);
        expect(enemy.stars).toBeGreaterThanOrEqual(1);
        expect(enemy.stars).toBeLessThanOrEqual(10);
        expect(enemy.stage).toBeGreaterThanOrEqual(0);
        expect(enemy.stage).toBeLessThanOrEqual(2);
      }
    }
    for (const gym of GYMS) {
      expect(gym.enemies).toHaveLength(6);
      for (const enemy of gym.enemies) {
        expect(speciesIds.has(enemy.speciesId), `${gym.id}: ${enemy.speciesId}`).toBe(true);
      }
    }
  });

  it('uses a flat 200-gem chapter chest', () => {
    expect(CAMPAIGN.chapterChestGems).toBe(200);
  });
});

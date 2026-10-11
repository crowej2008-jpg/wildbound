import { GROWTH } from '@wildbound/content';
import type { ProgressTables } from '@wildbound/engine';

/** The growth progress tables (from validated content) the client displays costs from. */
export const PROGRESS: ProgressTables = {
  levelUp: GROWTH.levelUp,
  starUp: GROWTH.starUp,
  evolve: GROWTH.evolve,
  respawn: GROWTH.respawn,
  maxLevelByStage: GROWTH.maxLevelByStage,
  maxStars: GROWTH.maxStars,
};

import { CAMPAIGN } from './tuning';
import type { ChapterMetaJson, GymJson } from './schemas';

/**
 * Campaign metadata (M13.0a): the 182-chapter index and the 60 Victory Road gym
 * gates. Stage rows live in `stages.ts`; these tables are the display + gate
 * layer the client and server share.
 */
export const CHAPTERS: ChapterMetaJson[] = [...CAMPAIGN.chapters].sort((a, b) => a.number - b.number);
export const GYMS: GymJson[] = [...CAMPAIGN.gyms].sort((a, b) => a.index - b.index);

export function chapterByNumber(number: number): ChapterMetaJson | undefined {
  return CHAPTERS.find((chapter) => chapter.number === number);
}

export function gymById(id: string): GymJson | undefined {
  return GYMS.find((gym) => gym.id === id);
}

export function gymByChapter(chapter: number): GymJson | undefined {
  return GYMS.find((gym) => gym.chapter === chapter);
}

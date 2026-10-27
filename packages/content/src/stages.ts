import campaign from '../stages/campaign.json';
import chapter1 from '../stages/chapter1.json';
import chapter2 from '../stages/chapter2.json';
import chapter3 from '../stages/chapter3.json';
import { stageSchema, type StageJson } from './schemas';

/**
 * Campaign stages (M5), grouped by chapter on disk and validated on load. The
 * content package never reads the filesystem; both the client and the CLI import
 * the same JSON at build time.
 */
const RAW: unknown[] = [...chapter1, ...chapter2, ...chapter3, ...campaign];

export const STAGES: StageJson[] = RAW.map((stage) => stageSchema.parse(stage));

export function stageById(id: string): StageJson | undefined {
  return STAGES.find((s) => s.id === id);
}

/** Stage ids in campaign order (chapter, then index). */
export function orderedStages(): StageJson[] {
  return [...STAGES].sort((a, b) => ((a.chapter ?? 0) - (b.chapter ?? 0)) || ((a.index ?? 0) - (b.index ?? 0)));
}

export function chapterNumbers(): number[] {
  return [...new Set(STAGES.map((s) => s.chapter ?? 0))].sort((a, b) => a - b);
}

export function stagesInChapter(chapter: number): StageJson[] {
  return STAGES.filter((s) => (s.chapter ?? 0) === chapter).sort((a, b) => ((a.index ?? 0) - (b.index ?? 0)));
}

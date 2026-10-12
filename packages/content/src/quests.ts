import daily from '../quests/daily.json';
import { questSchema, type QuestJson } from './schemas';

/** Daily quests (M5), validated on load. */
const RAW: unknown[] = daily;

export const QUESTS: QuestJson[] = RAW.map((quest) => questSchema.parse(quest));

export function questById(id: string): QuestJson | undefined {
  return QUESTS.find((q) => q.id === id);
}

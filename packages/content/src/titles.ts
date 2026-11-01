import raw from '../titles/titles.json';
import { titlesSchema, type TitlesJson, type TitleJson } from './titles-schema';

/** R8: the source title catalogue (85 permanent, 15 × 7-day, 2 × 14-day). */
export const TITLES: TitlesJson = titlesSchema.parse(raw);

const BY_ID = new Map(TITLES.map((title) => [title.id, title]));

export function titleById(id: string): TitleJson | undefined {
  return BY_ID.get(id);
}

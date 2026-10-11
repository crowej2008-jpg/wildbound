import type { WildClass } from '../model';
import type { Squad } from './types';
import { SQUAD_SIZE } from './types';

export interface SquadCandidate {
  id: string;
  speciesId: string;
  className: WildClass;
  power: number;
  stars: number;
  level: number;
}

/**
 * Auto Formation (PROMPT §7.2, docs/design/account.md). Deterministic:
 *  1. one instance per species (keep the strongest),
 *  2. keep saved members that are still eligible,
 *  3. fill free slots by power desc (tie: stars, level, id),
 *  4. sort Guardians to the front row, strongest-first within each row.
 */
export function autoFormation(candidates: SquadCandidate[], current: (string | null)[]): Squad {
  const unique = dedupeBySpecies(candidates);
  const byId = new Map(unique.map((c) => [c.id, c]));

  const chosen: SquadCandidate[] = [];
  const usedSpecies = new Set<string>();
  const usedIds = new Set<string>();

  for (const id of current) {
    if (!id || usedIds.has(id)) continue;
    const candidate = byId.get(id);
    if (!candidate || usedSpecies.has(candidate.speciesId)) continue;
    chosen.push(candidate);
    usedSpecies.add(candidate.speciesId);
    usedIds.add(id);
  }

  for (const candidate of unique) {
    if (chosen.length >= SQUAD_SIZE) break;
    if (usedIds.has(candidate.id) || usedSpecies.has(candidate.speciesId)) continue;
    chosen.push(candidate);
    usedSpecies.add(candidate.speciesId);
    usedIds.add(candidate.id);
  }

  chosen.sort(compareFormation);
  const squad: Squad = Array.from({ length: SQUAD_SIZE }, () => null);
  chosen.forEach((candidate, index) => {
    squad[index] = candidate.id;
  });
  return squad;
}

/** Guardians first (front row), then strongest-first. */
function compareFormation(a: SquadCandidate, b: SquadCandidate): number {
  const aGuard = a.className === 'guardian' ? 0 : 1;
  const bGuard = b.className === 'guardian' ? 0 : 1;
  if (aGuard !== bGuard) return aGuard - bGuard;
  if (b.power !== a.power) return b.power - a.power;
  if (b.stars !== a.stars) return b.stars - a.stars;
  if (b.level !== a.level) return b.level - a.level;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function dedupeBySpecies(candidates: SquadCandidate[]): SquadCandidate[] {
  const best = new Map<string, SquadCandidate>();
  for (const candidate of candidates) {
    const prev = best.get(candidate.speciesId);
    if (!prev || candidate.power > prev.power) best.set(candidate.speciesId, candidate);
  }
  return [...best.values()];
}

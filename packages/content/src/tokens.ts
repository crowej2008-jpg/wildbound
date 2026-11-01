import { z } from 'zod';
import raw from '../tuning/tokens.json';

/**
 * R8: the source's six Trainer Tokens (scripts/import-tokens.mjs, celestica_trial_token_json). PvP-only stat lines
 * in five levels; each level needs its Gods Trials season's Suppression Treasure total and spends the token's own
 * fragments.
 */
export const tokensSchema = z.object({
  _note: z.string().optional(),
  tokens: z
    .array(
      z.object({
        id: z.number().int(),
        name: z.string().min(1),
        season: z.number().int().min(1),
        fragment: z.number().int(),
        fragmentName: z.string().min(1),
        levels: z
          .array(
            z.object({
              level: z.number().int().min(1),
              treasureTotal: z.number().int().min(0).max(60),
              cost: z.number().int().min(1),
              lines: z.array(z.object({ field: z.string().min(1), value: z.number().positive() })).min(1),
            }),
          )
          .length(5),
      }),
    )
    .length(6),
});

export const TOKENS = tokensSchema.parse(raw);
export type TokensJson = z.infer<typeof tokensSchema>;
export type TokenJson = TokensJson['tokens'][number];

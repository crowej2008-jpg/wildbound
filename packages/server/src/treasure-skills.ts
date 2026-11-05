import type { AccountState, RoundEffect, SpecInput } from '@wildbound/engine';

type SoulheartHooks = NonNullable<SpecInput['soulheart']>;
import { treasureSkillLevel } from './account3';
import type { GameConfig } from './config';

/**
 * Trainer-treasure battle skills, read from the source skill text at the treasure's skill level and expressed with the
 * engine's existing hooks (round effects and Soul-heart hooks). What the hooks can't express is left out:
 * Quick Claw and the current-HP strikes of Parasitic Seed / Axe of Oppression, stun / silence / healing-block
 * chances, and Guardian Shield's "blocks N hits" rule (its shield is a share of each unit's own HP). See
 * docs/design/account-systems-3.md.
 */

export interface TreasureAura {
  /** Effects on every allied unit. */
  allies: { roundEffects: RoundEffect[]; soulheart: SoulheartHooks };
  /** Effects on the first two allied units (Soul Pendant's control immunity). */
  firstTwo: SoulheartHooks;
  /** Effects on the foe's front (positions 4–6) and back row (1–3). */
  foeFront: RoundEffect[];
  foeBack: RoundEffect[];
}

const MAX_ROUNDS = 20;

function num(text: string, re: RegExp): number {
  const m = text.match(re);
  return m ? Number(m[1]) : 0;
}

/** Rounds a skill fires on: round 1, then every `cooldown` rounds. */
function casts(cooldown: number): number[] {
  const out: number[] = [];
  for (let r = 1; r <= MAX_ROUNDS; r += Math.max(1, cooldown)) out.push(r);
  return out;
}

function repeated(tag: string, field: RoundEffect['field'], add: number, lasting: number, cooldown: number): RoundEffect[] {
  return casts(cooldown).map((r) => ({ tag: `${tag}:${r}`, field, add, fromRound: r, bigRounds: lasting }));
}

export function treasureAura(config: GameConfig, state: AccountState | undefined): TreasureAura | null {
  if (!state?.account3) return null;
  const aura: TreasureAura = { allies: { roundEffects: [], soulheart: {} }, firstTwo: {}, foeFront: [], foeBack: [] };
  let any = false;
  for (const t of config.account3.treasures.list) {
    const lv = treasureSkillLevel(config, state, t.type);
    if (lv < 1) continue;
    const text = t.skills.find((k) => k.level === lv)?.text ?? '';
    const cooldown = num(text, /[Cc]ooldown (?:of )?(\d+)/) || 4;
    switch (t.type) {
      case 2: {
        // Guardian Shield: a shield worth X% of HP at the start.
        const pct = num(text, /value of which is (\d+)%/);
        if (pct) {
          aura.allies.soulheart.startShield = Math.max(aura.allies.soulheart.startShield ?? 0, pct / 100);
          any = true;
        }
        break;
      }
      case 3: {
        // Life Seed: +X% healing received and a heal of Y% (of lost HP; here of max HP × 0.5) for 3 rounds.
        const boost = num(text, /healing effect by (\d+)%/);
        const heal = num(text, /restore (\d+)% of the lost HP/);
        if (boost) aura.allies.roundEffects.push(...repeated('treasure:lifeSeed', 'receiveHealBoost', boost / 100, 3, cooldown));
        if (heal) {
          const rounds = casts(cooldown).flatMap((r) => [r, r + 1, r + 2]);
          aura.allies.soulheart.roundHeal = { rounds, rate: (heal / 100) * 0.5 };
        }
        any = any || !!boost || !!heal;
        break;
      }
      case 4: {
        // Parasitic Seed: the foe's back row loses X% ATK for 2 rounds.
        const down = num(text, /ATK by (\d+)%/);
        if (down) {
          aura.foeBack.push(...repeated('treasure:parasitic', 'atkPct', -down / 100, 2, cooldown));
          any = true;
        }
        break;
      }
      case 5: {
        // Soul Pendant: allies +X% ATK for 2 rounds; control immunity on 2 allies each cast.
        const up = num(text, /ATK by (\d+)%/);
        if (up) aura.allies.roundEffects.push(...repeated('treasure:pendant', 'atkPct', up / 100, 2, cooldown));
        aura.firstTwo.controlImmunityEvery = cooldown;
        any = true;
        break;
      }
      case 6: {
        // Axe of Oppression: the foe's front row takes X% more damage for 2 rounds.
        const bonus = num(text, /causes (\d+)% Bonus DMG/);
        if (bonus) {
          aura.foeFront.push(...repeated('treasure:axe', 'dmgRdct', -bonus / 100, 2, cooldown));
          any = true;
        }
        break;
      }
      default:
        break;
    }
  }
  return any ? aura : null;
}

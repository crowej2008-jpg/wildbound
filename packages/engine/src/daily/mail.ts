import type { Rewards } from '../economy/rewards';

/**
 * System mail (M5, PROMPT §7.9). Letters carry attachments (rewards), expire,
 * and are claimed one at a time or all at once. Pure data + helpers.
 */

export interface MailItem {
  id: string;
  /** i18n keys so the client renders localised subject/body text. */
  subjectKey: string;
  bodyKey: string;
  grants: Rewards;
  createdAt: number;
  expiresAt: number;
  claimed: boolean;
}

/** Build a letter, defaulting `expiresAt` to `createdAt + ttlMs`. */
export function createMail(input: {
  id: string;
  subjectKey: string;
  bodyKey: string;
  grants: Rewards;
  createdAt: number;
  ttlMs?: number;
  expiresAt?: number;
}): MailItem {
  const expiresAt = input.expiresAt ?? input.createdAt + (input.ttlMs ?? 0);
  return {
    id: input.id,
    subjectKey: input.subjectKey,
    bodyKey: input.bodyKey,
    grants: input.grants,
    createdAt: input.createdAt,
    expiresAt,
    claimed: false,
  };
}

/** Drop letters whose expiry has passed (claims must happen before the deadline). */
export function pruneMail(list: readonly MailItem[], now: number): MailItem[] {
  return list.filter((m) => m.expiresAt > now);
}

export function unclaimedMail(list: readonly MailItem[]): MailItem[] {
  return list.filter((m) => !m.claimed);
}

/** Has anything to claim right now (used for a red-dot indicator). */
export function hasClaimableMail(list: readonly MailItem[]): boolean {
  return list.some((m) => !m.claimed);
}

export function claimMail(list: readonly MailItem[], id: string): MailItem[] {
  return list.map((m) => (m.id === id ? { ...m, claimed: true } : m));
}

export function claimAllMail(list: readonly MailItem[]): MailItem[] {
  return list.map((m) => (m.claimed ? m : { ...m, claimed: true }));
}

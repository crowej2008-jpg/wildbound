export const en = {
  'appName': 'Wildbound',
  'tagline': 'Collect. Grow. Battle.',
  'nav.home': 'Home',
  'nav.wilds': 'Wilds',
  'nav.combat': 'Combat',
  'nav.summon': 'Summon',
  'nav.more': 'More',
  'comingLater.badge': 'Coming later',
  'home.welcome': 'Welcome to Wildbound',
  'home.intro':
    'A rebuild of a mobile monster-collector design: build a squad of six original Wilds and let seeded, automatic turn-based battles play out — replayable, deterministic, and testable in the Build Lab.',
  'home.scope.note': 'The screens below arrive milestone by milestone. Every milestone ends with passing checks and a commit.',
  'home.galleryLink': 'Browse all 36 Wilds',
  'hud.beta': 'Milestone 2',
  'gallery.title': 'Wild Gallery',
  'gallery.subtitle': 'Every original Wild, rendered from its seed at each evolution stage.',
  'gallery.stage': 'Stage',
  'gallery.power': 'Power',
  'gallery.stat.hp': 'HP',
  'gallery.stat.pAtk': 'P.ATK',
  'gallery.stat.sAtk': 'S.ATK',
  'gallery.stat.spd': 'SPD',
  'gallery.maxLevel': 'max lv',
  'faction.ember': 'Ember',
  'faction.tide': 'Tide',
  'faction.grove': 'Grove',
  'faction.volt': 'Volt',
  'faction.frost': 'Frost',
  'faction.shade': 'Shade',
  'class.striker': 'Striker',
  'class.guardian': 'Guardian',
  'class.adept': 'Adept',
  'tier.common': 'Common',
  'tier.rare': 'Rare',
  'tier.epic': 'Epic',
  'tier.legendary': 'Legendary',
  'tier.supreme': 'Supreme',
  'tier.mythic': 'Mythic',
} as const;

export type StringKey = keyof typeof en;

export function t(key: StringKey): string {
  return en[key];
}

export type FactionKey = 'ember' | 'tide' | 'grove' | 'volt' | 'frost' | 'shade';
export type ClassKey = 'striker' | 'guardian' | 'adept';
export type TierKey = 'common' | 'rare' | 'epic' | 'legendary' | 'supreme' | 'mythic';

export const factionLabel: Record<FactionKey, string> = {
  ember: en['faction.ember'],
  tide: en['faction.tide'],
  grove: en['faction.grove'],
  volt: en['faction.volt'],
  frost: en['faction.frost'],
  shade: en['faction.shade'],
};

export const classLabel: Record<ClassKey, string> = {
  striker: en['class.striker'],
  guardian: en['class.guardian'],
  adept: en['class.adept'],
};

export const tierLabel: Record<TierKey, string> = {
  common: en['tier.common'],
  rare: en['tier.rare'],
  epic: en['tier.epic'],
  legendary: en['tier.legendary'],
  supreme: en['tier.supreme'],
  mythic: en['tier.mythic'],
};

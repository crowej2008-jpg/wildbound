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
  'hud.beta': 'Milestone 0',
} as const;

export type StringKey = keyof typeof en;

export function t(key: StringKey): string {
  return en[key];
}
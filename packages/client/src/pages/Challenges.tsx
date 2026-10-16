import { Link } from 'react-router-dom';
import { t } from '../i18n';

/** Combat hub (M8): entry points into every PvE mode. */
const MODES = [
  { to: '/tower', icon: '🗼', title: 'pve.tower' as const, desc: 'pve.tower.desc' as const },
  { to: '/trials', icon: '⚖', title: 'pve.trials' as const, desc: 'pve.trials.desc' as const },
  { to: '/boss', icon: '🐉', title: 'pve.boss' as const, desc: 'pve.boss.desc' as const },
  { to: '/dungeons', icon: '⛰', title: 'pve.dungeons' as const, desc: 'pve.dungeons.desc' as const },
  { to: '/crystal', icon: '💠', title: 'pve.crystal' as const, desc: 'pve.crystal.desc' as const },
  { to: '/combat/training', icon: '⚔', title: 'pve.training' as const, desc: 'pve.training.desc' as const },
];

export default function Challenges() {
  return (
    <main className="main">
      <h1 className="page-title">{t('pve.title')}</h1>
      <p className="muted">{t('pve.subtitle')}</p>
      <div className="town-grid">
        {MODES.map((mode) => (
          <Link key={mode.to} className="town-tile town-tile-wide" to={mode.to}>
            <span className="town-icon" aria-hidden>
              {mode.icon}
            </span>
            <span className="town-label">{t(mode.title)}</span>
            <span className="muted town-desc">{t(mode.desc)}</span>
          </Link>
        ))}
      </div>
    </main>
  );
}

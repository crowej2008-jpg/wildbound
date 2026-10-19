import { NavLink } from 'react-router-dom';
import { t } from '../i18n';

const TABS = [
  { to: '/', key: 'nav.home' as const },
  { to: '/wilds', key: 'nav.wilds' as const },
  { to: '/combat', key: 'nav.combat' as const },
  { to: '/pvp', key: 'nav.pvp' as const },
  { to: '/summon', key: 'nav.summon' as const },
  { to: '/more', key: 'nav.more' as const },
];

export default function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Primary">
      {TABS.map((tab) => (
        <NavLink key={tab.to} to={tab.to} end={tab.to === '/'}>
          {t(tab.key)}
        </NavLink>
      ))}
    </nav>
  );
}
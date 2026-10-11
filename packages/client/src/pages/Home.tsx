import { Link } from 'react-router-dom';
import { t } from '../i18n';

const LINKS = [
  { to: '/wilds', label: 'Wilds' },
  { to: '/squad', label: 'Squad editor' },
  { to: '/gallery', label: t('home.galleryLink') },
];

const ROADMAP = [
  { label: 'Battle screen', milestone: 'M4' },
  { label: 'Campaign + idle', milestone: 'M5' },
  { label: 'Summoning', milestone: 'M6' },
  { label: 'Build Lab', milestone: 'M10' },
];

export default function Home() {
  return (
    <main className="main">
      <section className="card">
        <h1>{t('home.welcome')}</h1>
        <p>{t('home.intro')}</p>
        <p>{t('home.scope.note')}</p>
        <div className="home-links">
          {LINKS.map((link) => (
            <Link key={link.to} className="gallery-link" to={link.to}>
              {link.label}
            </Link>
          ))}
        </div>
        <div className="chip-list">
          {ROADMAP.map((item) => (
            <span key={item.milestone} className="chip">
              {item.label} · {item.milestone}
            </span>
          ))}
        </div>
      </section>
    </main>
  );
}

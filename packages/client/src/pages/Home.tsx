import { Link } from 'react-router-dom';
import { t } from '../i18n';

const ROADMAP = [
  { label: 'Summoning', milestone: 'M6' },
  { label: 'Campaign + idle', milestone: 'M5' },
  { label: 'Squad editor', milestone: 'M3' },
  { label: 'Build Lab', milestone: 'M10' },
];

export default function Home() {
  return (
    <>
      <header className="hud">
        <span className="hud-title">{t('appName')}</span>
        <span className="hud-tagline">
          {t('tagline')} · {t('hud.beta')}
        </span>
      </header>
      <main className="main">
        <section className="card">
          <h1>{t('home.welcome')}</h1>
          <p>{t('home.intro')}</p>
          <p>{t('home.scope.note')}</p>
          <p>
            <Link className="gallery-link" to="/gallery">
              {t('home.galleryLink')}
            </Link>
          </p>
          <div className="chip-list">
            {ROADMAP.map((item) => (
              <span key={item.milestone} className="chip">
                {item.label} · {item.milestone}
              </span>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
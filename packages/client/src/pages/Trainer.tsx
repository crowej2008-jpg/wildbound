import { Link } from 'react-router-dom';
import { MATERIAL_CURRENCY_IDS } from '@wildbound/engine';
import { currencyLabel, t } from '../i18n';
import { useServer } from '../server/ServerProvider';

/**
 * Trainer tab (M11.1). Replaces the More tab as the player-facing home for the
 * account card and the M11 collection materials. Debug tools stay reachable at
 * `/more` from the Travel card.
 */
export default function Trainer() {
  const { snapshot } = useServer();
  if (!snapshot) return <main className="main"><p className="muted">Loading account…</p></main>;

  const { profile, roster, currencies, campaign } = snapshot.state;
  const stars = Object.values(campaign.stars).reduce((sum, value) => sum + value, 0);

  return (
    <main className="main">
      <h1 className="page-title">{t('trainer.title')}</h1>
      <p className="muted">{t('trainer.subtitle')}</p>

      <section className="card">
        <h2 className="section-title">{t('trainer.profile')}</h2>
        <div className="stat-grid">
          <div className="stat-row">
            <span className="muted">{t('trainer.name')}</span>
            <strong>{profile.name}</strong>
          </div>
          <div className="stat-row">
            <span className="muted">{t('wild.level')}</span>
            <strong>{profile.level}</strong>
          </div>
          <div className="stat-row">
            <span className="muted">{t('trainer.roster')}</span>
            <strong>{roster.length}</strong>
          </div>
          <div className="stat-row">
            <span className="muted">{t('trainer.campaignStars')}</span>
            <strong>{stars}</strong>
          </div>
        </div>
      </section>

      <section className="card">
        <h2 className="section-title">{t('trainer.materials')}</h2>
        <p className="muted">{t('trainer.materialsNote')}</p>
        <div className="material-grid">
          {MATERIAL_CURRENCY_IDS.map((id) => (
            <div key={id} className="material-row">
              <span className="muted">{currencyLabel[id]}</span>
              <strong>{currencies[id].toLocaleString()}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h2 className="section-title">{t('trainer.travel')}</h2>
        <div className="row-actions">
          <Link className="btn" to="/squad">{t('trainer.squad')}</Link>
          <Link className="btn" to="/mail">{t('trainer.mail')}</Link>
          <Link className="btn" to="/quests">{t('trainer.quests')}</Link>
          <Link className="btn" to="/gallery">{t('trainer.gallery')}</Link>
          <Link className="btn" to="/more">{t('trainer.more')}</Link>
        </div>
      </section>

      <section className="card">
        <h2 className="section-title">{t('trainer.vip')}</h2>
        <p className="muted">{t('trainer.vipLater')}</p>
      </section>

      <section className="card">
        <h2 className="section-title">{t('trainer.titles')}</h2>
        <p className="muted">{t('trainer.titlesLater')}</p>
      </section>
    </main>
  );
}

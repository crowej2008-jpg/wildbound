import { t } from '../i18n';
import { useServer } from '../server/ServerProvider';

/** M11.10: VIP tier, perks and the daily supply claim on the Trainer screen. */
export default function VipPanel() {
  const { snapshot, busy, call } = useServer();
  if (!snapshot) return null;
  const view = snapshot.vip;
  const claim = async () => {
    await call((server) => server.claimVipDaily(), (value) => value.snapshot);
  };

  return (
    <section className="card">
      <h2 className="section-title">{t('trainer.vip')}</h2>
      <p className="muted">{t('trainer.vipNote')}</p>
      <div className="gear-head">
        <strong>
          {t('trainer.vip.badge')} {view.tier} · {view.name}
        </strong>
        <span className="chip">{t('trainer.vip.xp')}: {view.xp.toLocaleString()}</span>
      </div>
      <p className="muted">
        {view.next
          ? `${t('trainer.vip.next')}: ${view.next.name} · ${view.next.remaining.toLocaleString()} XP`
          : t('trainer.vip.max')}
      </p>
      <div className="stat-grid">
        <div className="stat-row">
          <span className="muted">{t('trainer.vip.idle')}</span>
          <strong>+{view.idleCapBonusHours}h</strong>
        </div>
        <div className="stat-row">
          <span className="muted">{t('trainer.vip.shop')}</span>
          <strong>{Math.round(view.shopDiscount * 100)}%</strong>
        </div>
        <div className="stat-row">
          <span className="muted">{t('trainer.vip.daily')}</span>
          <strong>{view.dailyTickets} {t('trainer.vip.ticketsPerDay')}</strong>
        </div>
      </div>
      <div className="row-actions">
        {view.canClaim ? (
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void claim()}>
            {t('trainer.vip.claim')} · {view.dailyTickets} {t('trainer.vip.ticketsPerDay')}
          </button>
        ) : view.claimedToday ? (
          <p className="muted">{t('trainer.vip.claimed')}</p>
        ) : (
          <p className="muted">{t('trainer.vip.locked')}</p>
        )}
      </div>
    </section>
  );
}

import { t } from '../i18n';
import { useServer } from '../server/ServerProvider';

/**
 * R8: the source's VIP 0–40 on the Trainer screen. Privilege XP comes from daily activity (no purchases);
 * the perks Wildbound has a system for are live, the rest are listed as coming.
 */
export default function VipPanel() {
  const { snapshot } = useServer();
  if (!snapshot) return null;
  const view = snapshot.vip;
  const p = view.perks;
  const pct = (v: number) => `+${Math.round(v * 100)}%`;
  return (
    <section className="card">
      <h2 className="section-title">{t('trainer.vip')}</h2>
      <p className="muted">{t('trainer.vipNote').replace('{xp}', String(view.dailyActivityXp))}</p>
      <div className="gear-head">
        <strong>
          {t('trainer.vip.badge')} {view.level}
        </strong>
        <span className="chip">
          {t('currency.privilegeXp')}: {view.xp.toLocaleString()}
        </span>
      </div>
      <p className="muted">
        {view.next
          ? `${t('trainer.vip.next')}: VIP ${view.next.level} · ${view.next.remaining.toLocaleString()} ${t('currency.privilegeXp')}`
          : t('trainer.vip.max')}
      </p>
      <div className="stat-grid">
        <div className="stat-row">
          <span className="muted">{t('trainer.vip.idleCap')}</span>
          <strong>{p.idleCapHours} h</strong>
        </div>
        <div className="stat-row">
          <span className="muted">{t('trainer.vip.idleBonus')}</span>
          <strong>{pct(p.idleCandyBonus)}</strong>
        </div>
        <div className="stat-row">
          <span className="muted">{t('trainer.vip.quick')}</span>
          <strong>
            {p.quickCombat} ({p.quickCombatFree} {t('trainer.vip.free')})
          </strong>
        </div>
        <div className="stat-row">
          <span className="muted">{t('trainer.vip.arenaBuys')}</span>
          <strong>{p.arenaBuys}</strong>
        </div>
      </div>
      <p className="muted">
        {t('trainer.vip.coming')
          .replace('{dungeons}', String(p.dungeonBuys))
          .replace('{refreshes}', String(p.dailyShopRefreshes))
          .replace('{bag}', String(p.bag))}
      </p>
    </section>
  );
}

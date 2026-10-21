import { t } from '../../i18n';
import type { GearPanelProps } from './types';

/** M11.8: the species-signature trinket card, shown under Held Items. */
export default function TrinketPanel({ wildId, view, busy, run, reload }: GearPanelProps) {
  const trinket = view.trinket;
  const act = async () => {
    if (await run((server) => server.upgradeTrinket(wildId))) await reload();
  };

  return (
    <div className="gear-row">
      <div className="gear-head">
        <strong>{trinket.name}</strong>
        <span className="chip">{t('gear.sub.trinkets')}</span>
      </div>
      <p className="muted">
        {t('gear.trinket.level')} {trinket.level}/{trinket.maxLevel}
      </p>
      <p className="muted">
        {trinket.linesAreNext ? t('gear.trinket.next') : t('gear.trinket.final')}: {trinket.linesText.join(' · ')}
      </p>
      <p className="muted">
        {t('currency.starShard')}: {view.starShards.toLocaleString()}
      </p>
      <div className="row-actions">
        {trinket.cost !== null ? (
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void act()}>
            {t('gear.trinket.advance')} · {trinket.cost.toLocaleString()} {t('currency.starShard')}
          </button>
        ) : (
          <p className="muted">{t('gear.trinket.max')}</p>
        )}
      </div>
      <p className="muted">{t('gear.trinket.shared')}</p>
      <p className="muted">{t('gear.trinket.shiny')}</p>
    </div>
  );
}

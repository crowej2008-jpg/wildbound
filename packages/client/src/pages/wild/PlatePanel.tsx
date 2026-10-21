import { factionLabel, t } from '../../i18n';
import type { GearPanelProps } from './types';

/** M11.7: the element-keyed plate card, shown as a sub-tab of Held Items. */
export default function PlatePanel({ wildId, view, busy, run, reload }: GearPanelProps) {
  const plate = view.plate;
  const act = async () => {
    if (await run((server) => server.upgradePlate(wildId))) await reload();
  };
  const currency = plate.cost?.currency === 'plateFragment' ? t('currency.plateFragment') : t('currency.plateBottle');

  return (
    <div className="gear-row">
      <div className="gear-head">
        <strong>{plate.name}</strong>
        <span className="chip">{factionLabel[plate.faction]}</span>
      </div>
      <p className="muted">
        {t('gear.plate.stage')} {plate.stage}/{plate.maxStage}
      </p>
      <p className="muted">
        {plate.linesAreNext ? t('gear.plate.next') : t('gear.plate.final')}: {plate.linesText.join(' · ')}
      </p>
      <div className="cost-row">
        <span>
          {t('currency.plateBottle')} {view.plateBottles.toLocaleString()}
        </span>
        <span>
          {t('currency.plateFragment')} {view.plateFragments.toLocaleString()}
        </span>
      </div>
      <div className="row-actions">
        {plate.cost ? (
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void act()}>
            {t('gear.plate.advance')} · {plate.cost.amount.toLocaleString()} {currency}
          </button>
        ) : (
          <p className="muted">{t('gear.plate.max')}</p>
        )}
      </div>
      <p className="muted">{t('gear.plate.skillSwap')}</p>
    </div>
  );
}

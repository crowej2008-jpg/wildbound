import { t } from '../../i18n';
import type { GearPanelProps } from './types';

/** R6b: the source's exclusive trinket card, shown under Held Items. */
export default function TrinketPanel({ wildId, view, busy, run, reload }: GearPanelProps) {
  const trinket = view.trinket;
  const act = async () => {
    if (await run((server) => server.upgradeTrinket(wildId))) await reload();
  };

  if (!trinket.available) {
    return (
      <div className="gear-row">
        <p className="muted">{t('gear.trinket.none')}</p>
      </div>
    );
  }
  const cost = trinket.cost;
  const lock = trinket.locked;
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
        {cost && cost.item > 0 ? ` · ${cost.itemName}: ${cost.haveItem.toLocaleString()}` : ''}
        {cost?.chestName ? ` · ${cost.chestName}: ${cost.haveChests.toLocaleString()}` : ''}
      </p>
      {lock ? (
        <p className="muted">
          {lock.reason === 'roster'
            ? t('gear.trinket.lockRoster').replace('{count}', String(lock.count)).replace('{level}', String(lock.level))
            : t('gear.trinket.lockStars').replace('{stars}', String(lock.stars))}
        </p>
      ) : null}
      <div className="row-actions">
        {cost !== null ? (
          <button type="button" className="btn btn-primary" disabled={busy || !!lock} onClick={() => void act()}>
            {t('gear.trinket.advance')} · {cost.starShard.toLocaleString()} {t('currency.starShard')}
            {cost.item > 0 ? ` + ${cost.item.toLocaleString()} ${cost.itemName}` : ''}
          </button>
        ) : (
          <p className="muted">{t('gear.trinket.max')}</p>
        )}
      </div>
      {cost && cost.chestsUsed > 0 && cost.chestName ? (
        <p className="muted">
          {t('gear.trinket.usesChests').replace('{n}', cost.chestsUsed.toLocaleString()).replace('{chest}', cost.chestName)}
        </p>
      ) : null}
      <p className="muted">{t('gear.trinket.shared')}</p>
    </div>
  );
}

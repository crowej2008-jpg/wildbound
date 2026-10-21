import { t, tierLabel } from '../../i18n';
import type { GearPanelProps } from './types';

export default function HeldItemPanel({ wildId, view, className, busy, run, reload }: GearPanelProps) {
  if (!view.unlocks.relic) {
    return (
      <section className="card">
        <p className="muted">
          {t('gear.locked')} {tierLabel[view.requirements.relic]}
        </p>
      </section>
    );
  }

  const items = view.relics.filter((relic) => relic.className === className);
  const act = async (action: Parameters<GearPanelProps['run']>[0]) => {
    if (await run(action)) await reload();
  };

  return (
    <section className="card">
      <p className="muted">
        {t('currency.heldItemShard')}: {view.heldItemShards.toLocaleString()}
      </p>
      {items.length === 0 ? (
        <p className="muted">{t('gear.noItems')}</p>
      ) : (
        <ul className="gear-list">
          {items.map((item) => {
            const worn = item.equippedOn === wildId;
            const elsewhere = item.equippedOn !== null && item.equippedOn !== wildId;
            return (
              <li key={item.instanceId} className="gear-row">
                <div className="gear-head">
                  <strong>{item.name}</strong>
                  <span className={`chip tier-${item.tier}`}>{tierLabel[item.tier]}</span>
                  {worn && <span className="chip chip-on">{t('gear.equip')}</span>}
                  {elsewhere && <span className="chip">{t('gear.inUse')}</span>}
                </div>
                <p className="muted">
                  Lv{item.level}/{item.maxLevel} · {t('gear.refine')} {item.refine}/{item.maxRefine}
                </p>
                <p className="muted">{item.effectText}</p>
                <div className="row-actions">
                  <button
                    type="button"
                    className={worn ? 'btn' : 'btn btn-primary'}
                    disabled={busy}
                    onClick={() => {
                      if (worn) {
                        void act((server) => server.equipRelic(wildId, null));
                        return;
                      }
                      if (elsewhere && !window.confirm(t('gear.confirmMove'))) return;
                      void act((server) => server.equipRelic(wildId, item.instanceId, elsewhere));
                    }}
                  >
                    {worn ? t('gear.unequip') : t('gear.equip')}
                  </button>
                  {item.levelCost && (
                    <button
                      type="button"
                      className="btn"
                      disabled={busy}
                      onClick={() => void act((server) => server.levelRelic(item.instanceId))}
                    >
                      {t('gear.level')} · {item.levelCost.shards.toLocaleString()} {t('currency.heldItemShard')}
                    </button>
                  )}
                  {item.refineCost && (
                    <button
                      type="button"
                      className="btn"
                      disabled={busy}
                      onClick={() => void act((server) => server.refineRelic(item.instanceId))}
                    >
                      {t('gear.refine')} · {item.refineCost.gold.toLocaleString()} {t('currency.gold')} ·{' '}
                      {item.refineCost.shards.toLocaleString()} {t('currency.heldItemShard')}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

import { t } from '../../i18n';
import type { GearPanelProps } from './types';

export default function BerryPanel({ wildId, view, busy, run, reload }: GearPanelProps) {
  if (!view.unlocks.charms) {
    return (
      <section className="card">
        <p className="muted">
          {t('gear.locked')} {view.requirements.charms}★
        </p>
      </section>
    );
  }

  const act = async (action: Parameters<GearPanelProps['run']>[0]) => {
    if (await run(action)) await reload();
  };
  const equipped = view.charms.find((berry) => berry.defId === view.loadout.charm);

  return (
    <section className="card">
      <p className="muted">
        {t('gear.equip')}: {equipped?.name ?? t('gear.empty')}
      </p>
      {view.loadout.charm && (
        <button
          type="button"
          className="btn"
          disabled={busy}
          onClick={() => void act((server) => server.equipCharm(wildId, null))}
        >
          {t('gear.unequip')}
        </button>
      )}

      <hr className="divider" />
      {view.charms.length === 0 ? (
        <p className="muted">{t('gear.noItems')}</p>
      ) : (
        <ul className="gear-list">
          {view.charms.map((berry) => {
            const wornHere = view.loadout.charm === berry.defId;
            const elsewhere = berry.equippedOn !== null && berry.equippedOn !== wildId;
            const canUpgrade = berry.maxStars > 0 && berry.stars < berry.maxStars && berry.count >= view.costs.charmUpgradeCopies;
            return (
              <li key={berry.defId} className="gear-row">
                <div className="gear-head">
                  <strong>{berry.name}</strong>
                  <span className="chip">
                    {berry.stars}★{berry.maxStars > 0 ? `/${berry.maxStars}★` : ''}
                  </span>
                  <span className="muted">
                    x{berry.count} · {t('gear.stars')}
                  </span>
                  {wornHere && <span className="chip chip-on">{t('gear.equip')}</span>}
                  {elsewhere && <span className="chip">{t('gear.inUse')}</span>}
                </div>
                <div className="row-actions">
                  <button
                    type="button"
                    className={wornHere ? 'btn' : 'btn btn-primary'}
                    disabled={busy || elsewhere}
                    onClick={() =>
                      void act((server) => server.equipCharm(wildId, wornHere ? null : berry.defId))
                    }
                  >
                    {wornHere ? t('gear.unequip') : t('gear.equip')}
                  </button>
                  {canUpgrade && (
                    <button
                      type="button"
                      className="btn"
                      disabled={busy}
                      onClick={() => void act((server) => server.upgradeCharm(berry.defId))}
                    >
                      {t('gear.berry.upgrade')} · {view.costs.charmUpgradeCopies} {t('gear.berry.copies')}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="muted">
        {t('gear.berry.dismantle')}: {t('comingLater.badge')}
      </p>
    </section>
  );
}

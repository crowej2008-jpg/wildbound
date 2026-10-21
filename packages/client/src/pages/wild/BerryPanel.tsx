import { t } from '../../i18n';
import type { GearPanelProps } from './types';

export default function BerryPanel({ wildId, view, busy, run, reload }: GearPanelProps) {
  if (!view.unlocks.charms) {
    return (
      <section className="card">
        <p className="muted">
          {t('gear.locked')} {view.requirements.charms}★.
        </p>
      </section>
    );
  }

  const act = async (action: Parameters<GearPanelProps['run']>[0]) => {
    if (await run(action)) await reload();
  };
  const slots = Array.from({ length: view.charmSlots }, (_, index) => view.loadout.charms[index] ?? null);

  return (
    <section className="card">
      <p className="muted">
        {t('currency.berryEssence')}: {view.berryEssence.toLocaleString()}
      </p>
      <p className="muted">{t('gear.berry.slots')}</p>
      <div className="chip-list">
        {slots.map((id, slot) => {
          const berry = view.charms.find((item) => item.defId === id);
          return (
            <span key={slot} className="chip">
              {slot + 1}. {berry?.name ?? t('gear.empty')}
              {id && (
                <button
                  type="button"
                  className="btn"
                  disabled={busy}
                  onClick={() => void act((server) => server.equipCharm(wildId, slot, null))}
                >
                  {t('gear.unequip')}
                </button>
              )}
            </span>
          );
        })}
      </div>

      <hr className="divider" />
      {view.charms.length === 0 ? (
        <p className="muted">{t('gear.noItems')}</p>
      ) : (
        <ul className="gear-list">
          {view.charms.map((berry) => {
            const spare = berry.count - berry.equippedOn.length;
            const canUpgrade = berry.upgradeEssence !== null && spare >= berry.upgradeCopies;
            return (
              <li key={berry.defId} className="gear-row">
                <div className="gear-head">
                  <strong>{berry.name}</strong>
                  <span className="chip">
                    {berry.stars}
                    {berry.maxStars > 0 ? `/${berry.maxStars}` : ''}★
                  </span>
                  <span className="muted">
                    x{berry.count} · {spare} {t('gear.berry.spare')}
                  </span>
                  {berry.equippedOn.includes(wildId) && <span className="chip chip-on">{t('gear.equip')}</span>}
                  {berry.equippedOn.some((id) => id !== wildId) && <span className="chip">{t('gear.inUse')}</span>}
                </div>
                <div className="row-actions">
                  {slots.map((id, slot) => {
                    const wornHere = id === berry.defId;
                    return (
                      <button
                        key={slot}
                        type="button"
                        className={wornHere ? 'btn' : 'btn btn-primary'}
                        disabled={busy}
                        onClick={() =>
                          void act((server) =>
                            server.equipCharm(wildId, slot, wornHere ? null : berry.defId),
                          )
                        }
                      >
                        {wornHere ? t('gear.unequip') : t('gear.equip')} {slot + 1}
                      </button>
                    );
                  })}
                  {canUpgrade && (
                    <button
                      type="button"
                      className="btn"
                      disabled={busy}
                      onClick={() => void act((server) => server.upgradeCharm(berry.defId))}
                    >
                      {t('gear.berry.upgrade')} · {berry.upgradeCopies} {t('gear.berry.copies')} +{' '}
                      {berry.upgradeEssence} {t('currency.berryEssence')}
                    </button>
                  )}
                  {spare > 0 && (
                    <button
                      type="button"
                      className="btn"
                      disabled={busy}
                      onClick={() => void act((server) => server.dismantleCharm(berry.defId))}
                    >
                      {t('gear.berry.dismantle')} · +{berry.dismantleEssence}
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

import { t } from '../../i18n';
import type { GearPanelProps } from './types';

export default function SoulHeartPanel({ wildId, view, busy, run, reload }: GearPanelProps) {
  if (!view.unlocks.cores) {
    return (
      <section className="card">
        <p className="muted">
          {t('gear.locked')} {view.requirements.cores}★
        </p>
      </section>
    );
  }

  const act = async (action: Parameters<GearPanelProps['run']>[0]) => {
    if (await run(action)) await reload();
  };

  return (
    <section className="card">
      <div className="chip-list">
        {view.loadout.cores.map((id, index) => {
          const core = view.cores.find((item) => item.instanceId === id);
          return (
            <span key={index} className="chip">
              {index + 1}. {core ? core.name : t('gear.empty')}
            </span>
          );
        })}
      </div>

      <hr className="divider" />
      {view.cores.length === 0 ? (
        <p className="muted">{t('gear.noItems')}</p>
      ) : (
        <ul className="gear-list">
          {view.cores.map((core) => {
            const wornHere = view.loadout.cores[core.socket] === core.instanceId;
            const elsewhere = core.equippedOn !== null && core.equippedOn !== wildId;
            return (
              <li key={core.instanceId} className="gear-row">
                <div className="gear-head">
                  <strong>{core.name}</strong>
                  <span className="chip">
                    {t('gear.socket')} {core.socket + 1}
                  </span>
                  <span className="chip">{core.stars}★</span>
                  {wornHere && <span className="chip chip-on">{t('gear.equip')}</span>}
                  {elsewhere && <span className="chip">{t('gear.inUse')}</span>}
                </div>
                <div className="row-actions">
                  <button
                    type="button"
                    className={wornHere ? 'btn' : 'btn btn-primary'}
                    disabled={busy}
                    onClick={() => {
                      if (wornHere) {
                        void act((server) => server.equipCore(wildId, core.socket, null));
                        return;
                      }
                      if (elsewhere && !window.confirm(t('gear.confirmMove'))) return;
                      void act((server) => server.equipCore(wildId, core.socket, core.instanceId, elsewhere));
                    }}
                  >
                    {wornHere ? t('gear.unequip') : t('gear.equip')}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="muted">
        {t('gear.starUp')}: {t('comingLater.badge')}
      </p>
    </section>
  );
}

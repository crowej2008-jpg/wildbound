import { useState } from 'react';
import { t, tierLabel } from '../../i18n';
import type { GearPanelProps } from './types';

export default function OrbsPanel({ wildId, view, busy, run, reload }: GearPanelProps) {
  const [socket, setSocket] = useState(0);

  if (!view.unlocks.runes) {
    return (
      <section className="card">
        <p className="muted">
          {t('gear.locked')} {view.requirements.runes}★
        </p>
      </section>
    );
  }

  const act = async (action: Parameters<GearPanelProps['run']>[0]) => {
    if (await run(action)) await reload();
  };

  return (
    <section className="card">
      <p className="muted">{t('gear.socket')}</p>
      <div className="chip-list">
        {view.loadout.runes.map((id, index) => {
          const rune = view.runes.find((item) => item.instanceId === id);
          return (
            <button
              key={index}
              type="button"
              className={socket === index ? 'chip chip-active' : 'chip'}
              onClick={() => setSocket(index)}
            >
              {index + 1}. {rune ? rune.name : t('gear.empty')}
            </button>
          );
        })}
        {view.loadout.runes[socket] && (
          <button
            type="button"
            className="chip"
            disabled={busy}
            onClick={() => void act((server) => server.equipRune(wildId, socket, null))}
          >
            {t('gear.unequip')}
          </button>
        )}
      </div>

      <hr className="divider" />
      <p className="muted">{t('gear.setProgress')}</p>
      <div className="chip-list">
        {view.runeSets.map((set) => (
          <span key={set.id} className="chip">
            {set.name} {set.equipped}/{set.pieces}
          </span>
        ))}
      </div>

      <hr className="divider" />
      {view.runes.length === 0 ? (
        <p className="muted">{t('gear.noItems')}</p>
      ) : (
        <ul className="gear-list">
          {view.runes.map((rune) => {
            const wornHere = view.loadout.runes[socket] === rune.instanceId;
            const elsewhere = rune.equippedOn !== null && rune.equippedOn !== wildId;
            return (
              <li key={rune.instanceId} className="gear-row">
                <div className="gear-head">
                  <strong>{rune.name}</strong>
                  <span className={`chip tier-${rune.tier}`}>{tierLabel[rune.tier]}</span>
                  <span className="muted">
                    Lv{rune.level}/{rune.maxLevel}
                  </span>
                  {wornHere && <span className="chip chip-on">{t('gear.equip')}</span>}
                  {elsewhere && <span className="chip">{t('gear.inUse')}</span>}
                </div>
                <p className="muted">{rune.setName}</p>
                <div className="row-actions">
                  <button
                    type="button"
                    className={wornHere ? 'btn' : 'btn btn-primary'}
                    disabled={busy}
                    onClick={() => {
                      if (wornHere) {
                        void act((server) => server.equipRune(wildId, socket, null));
                        return;
                      }
                      if (elsewhere && !window.confirm(t('gear.confirmMove'))) return;
                      void act((server) => server.equipRune(wildId, socket, rune.instanceId, elsewhere));
                    }}
                  >
                    {wornHere ? t('gear.unequip') : t('gear.equip')}
                  </button>
                  {rune.level < rune.maxLevel && (
                    <button
                      type="button"
                      className="btn"
                      disabled={busy}
                      onClick={() => void act((server) => server.levelRune(rune.instanceId))}
                    >
                      {t('gear.level')}
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

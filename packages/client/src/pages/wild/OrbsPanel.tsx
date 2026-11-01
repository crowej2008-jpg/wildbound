import { useCallback, useEffect, useState } from 'react';
import type { OrbsPanelView, OrbView } from '@wildbound/server';
import { t, tKey } from '../../i18n';
import { useServer } from '../../server/ServerProvider';

/**
 * R3: the source's orbs — 8 sockets (2 rows × 4 gear pieces) with defensive / offensive families,
 * sets that switch on at their lowest orb's level, levelling with copies + Gold (Quick Upgrade fuses
 * lower copies), lock and dismantle.
 */
const PIECES = ['gear.orbs.core', 'gear.orbs.cube', 'gear.orbs.trinket', 'gear.orbs.wings'] as const;

function statName(field: string): string {
  const label = tKey(`stat.${field}`);
  return label === `stat.${field}` ? field : label;
}

function lineText(l: { field: string; value: number }): string {
  if (['hp', 'pAtk', 'sAtk'].includes(l.field)) return `${statName(l.field)} +${Math.round(l.value).toLocaleString()}`;
  return `${statName(l.field)} +${(Math.round(l.value * 10000) / 100).toString()}%`;
}

function OrbLine({ orb }: { orb: OrbView }) {
  return (
    <span>
      <strong>
        {orb.name} +{orb.level}
      </strong>{' '}
      <span className="chip">{tKey(`gear.orbs.colour.${orb.colour}`)}</span>{' '}
      <span className="muted">{[...orb.flat, ...orb.lines].map(lineText).join(' · ')}</span>
    </span>
  );
}

export default function OrbsPanel({ wildId, onChange }: { wildId: string; onChange?: () => Promise<unknown> }) {
  const { call, run, busy } = useServer();
  const [view, setView] = useState<OrbsPanelView | null>(null);
  const [picking, setPicking] = useState<number | null>(null);

  const reload = useCallback(async () => {
    const result = await call((server) => server.getOrbs(wildId));
    if (result.ok) setView(result.value);
  }, [call, wildId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const act = async (action: Parameters<typeof run>[0]) => {
    if (await run(action)) {
      await reload();
      await onChange?.();
    }
  };

  if (!view) return <section className="card"><p className="muted">{t('gear.orbs.loading')}</p></section>;
  if (!view.systemOpen) {
    return (
      <section className="card">
        <p className="muted">
          {t('gear.orbs.opensAt')} {view.playerLevelNeeded}
        </p>
      </section>
    );
  }
  const byId = new Map(view.orbs.map((o) => [o.id, o]));

  return (
    <section className="card">
      <p className="muted">
        {t('gear.orbs.balance')}: {view.orbEssence.toLocaleString()} · {t('currency.gold')}: {view.gold.toLocaleString()}
      </p>
      <ul className="gear-list">
        {view.sockets.map((s) => {
          const orb = s.orbId ? byId.get(s.orbId) : undefined;
          const fits = view.orbs.filter((o) => o.equippedOn === null && (s.family === 'any' || o.family === s.family));
          return (
            <li key={s.socket} className="gear-row" data-testid={`orb-socket-${s.socket}`}>
              <div className="gear-head">
                <strong>
                  {t(PIECES[s.socket % 4]!)} · {s.socket < 4 ? 'α' : 'β'}
                </strong>
                <span className="chip">{tKey(`gear.orbs.family.${s.family}`)}</span>
                {!s.open && <span className="chip">{t('gear.locked')}</span>}
              </div>
              {orb ? <OrbLine orb={orb} /> : <p className="muted">{t('gear.orbs.empty')}</p>}
              {s.open && (
                <div className="row-actions">
                  {orb && (
                    <button type="button" className="btn" disabled={busy} onClick={() => void act((server) => server.equipOrb(wildId, s.socket, null))}>
                      {t('gear.orbs.remove')}
                    </button>
                  )}
                  <button type="button" className="btn" disabled={busy || fits.length === 0} onClick={() => setPicking(picking === s.socket ? null : s.socket)}>
                    {t('gear.orbs.choose')} ({fits.length})
                  </button>
                </div>
              )}
              {picking === s.socket && (
                <div className="row-actions">
                  {fits.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      className="chip"
                      disabled={busy}
                      onClick={() => {
                        setPicking(null);
                        void act((server) => server.equipOrb(wildId, s.socket, o.id));
                      }}
                    >
                      {o.name} +{o.level} · {tKey(`gear.orbs.colour.${o.colour}`)}
                    </button>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <h3>{t('gear.orbs.sets')}</h3>
      {view.sets.length === 0 ? (
        <p className="muted">{t('gear.orbs.noSet')}</p>
      ) : (
        view.sets.map((set) => (
          <div key={set.id} className="gear-row">
            <strong>{set.name}</strong>
            {set.tiers.map((tier) => (
              <p key={tier.level} className={tier.active ? '' : 'muted'}>
                +{tier.level}: {tier.text}
              </p>
            ))}
          </div>
        ))
      )}

      <h3>{t('gear.orbs.bag')}</h3>
      <ul className="gear-list">
        {view.orbs.map((o) => (
          <li key={o.id} className="gear-row">
            <OrbLine orb={o} />
            <div className="row-actions">
              <span className="muted">
                {o.copies} {t('gear.orbs.copies')}
              </span>
              {o.levelGold !== null && (
                <>
                  <button type="button" className="btn" disabled={busy || o.copies < 2} onClick={() => void act((server) => server.levelOrb(o.id))}>
                    {t('gear.orbs.levelUp')} · {o.levelGold.toLocaleString()}
                  </button>
                  <button type="button" className="btn" disabled={busy} onClick={() => void act((server) => server.levelOrb(o.id, true))}>
                    {t('gear.orbs.quick')}
                  </button>
                </>
              )}
              <button type="button" className="btn" disabled={busy} onClick={() => void act((server) => server.lockOrb(o.id))}>
                {o.locked ? t('gear.orbs.unlock') : t('gear.orbs.lock')}
              </button>
              {o.dismantleEssence !== null && !o.locked && o.equippedOn === null && (
                <button type="button" className="btn" disabled={busy} onClick={() => void act((server) => server.dismantleOrbs([o.id]))}>
                  {t('gear.orbs.dismantle')} · {o.dismantleEssence.toLocaleString()}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

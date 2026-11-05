import { useCallback, useEffect, useState } from 'react';
import type { EventsView } from '@wildbound/server';
import { t } from '../i18n';
import { useServer } from '../server/ServerProvider';
import WeekendEvents from './WeekendEvents';

const rewardText = (r: Record<string, number>) =>
  Object.entries(r)
    .map(([k, v]) => `${t(`currency.${k}` as 'currency.gold')} ×${v}`)
    .join(', ');

/** M16 Events: Shovel Carnival and the Merge Event on the server-day clock. */
export default function Events() {
  const { call, busy } = useServer();
  const [view, setView] = useState<EventsView | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    const r = await call((s) => s.getEvents());
    if (r.ok) setView(r.value);
  }, [call]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const act = async (p: Promise<{ ok: boolean }>, msg: string) => {
    const r = await p;
    if (r.ok) setStatus(msg);
    await refresh();
  };
  if (!view) return <p className="muted">…</p>;
  const sh = view.shovel;
  const mg = view.merge;
  return (
    <div className="page events">
      <h1 className="page-title">{t('events.title')}</h1>
      <p className="muted">{t('events.day').replace('{day}', String(view.serverDay))}</p>

      <section className="card" data-testid="shovel">
        <h2>{t('events.shovel')}</h2>
        <p data-testid="shovel-state">
          {sh.window.active ? t('events.daysLeft').replace('{n}', String(sh.window.daysLeft)) : t('events.startsIn').replace('{n}', String(sh.window.startsIn))}
        </p>
        <p className="muted">
          {t('events.pool')} {sh.pool} · {t('events.credits')} {sh.credits} · {t('currency.treasureShovel')} {sh.shovels} · {t('currency.treasurePiece')} {sh.pieces}
        </p>
        {sh.window.active && (
          <>
            {([1, 10] as const).map((n) => (
              <button key={n} type="button" className="btn btn-primary" disabled={busy || sh.shovels < n} onClick={() => void act(call((s) => s.spinShovel(n), (v) => v.snapshot), t('events.spun'))}>
                {t('events.spin')} ×{n}
              </button>
            ))}
            <h3>{t('events.shovelShop')}</h3>
            <ul className="plain-list">
              {sh.shop.map((r) => (
                <li key={r.tier}>
                  {r.price} {t('currency.gems')} · {r.left}{' '}
                  <button type="button" className="btn" disabled={busy || r.left < 1} onClick={() => void act(call((s) => s.buyShovels(r.tier), (v) => v), t('events.bought'))}>
                    {t('joint.buy')}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
        <h3>{t('events.milestones')}</h3>
        <ul className="plain-list">
          {sh.milestones.map((m) => (
            <li key={m.credits}>
              {m.credits} — {rewardText(m.rewards)}{' '}
              <button type="button" className="btn" disabled={busy || m.claimed || sh.credits < m.credits} onClick={() => void act(call((s) => s.claimShovelMilestone(m.credits), (v) => v.snapshot), t('events.claimed'))}>
                {m.claimed ? '✓' : t('events.claim')}
              </button>
            </li>
          ))}
        </ul>
        <h3>{t('events.exchange')}</h3>
        <ul className="plain-list">
          {sh.exchange.map((r) => (
            <li key={r.id}>
              {r.name} — {r.price}
              {r.left !== null ? ` · ${r.left}` : ''}{' '}
              <button type="button" className="btn" disabled={busy || sh.pieces < r.price || (r.left !== null && r.left < 1)} onClick={() => void act(call((s) => s.exchangeShovel(r.id), (v) => v.snapshot), t('events.bought'))}>
                {t('joint.buy')}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="card" data-testid="merge">
        <h2>{t('events.merge')}</h2>
        <p data-testid="merge-state">
          {mg.window.active ? t('events.daysLeft').replace('{n}', String(mg.window.daysLeft)) : t('events.startsIn').replace('{n}', String(mg.window.startsIn))}
        </p>
        <ul className="plain-list">
          {mg.phases.map((p) => (
            <li key={p.id}>
              <strong>{t(`events.phase.${p.id}` as 'events.phase.berry')}</strong> — {t('events.points')} {p.points}
              {p.rank > 0 ? ` · #${p.rank}` : ''}
              {p.running && (
                <button type="button" className="btn btn-primary" disabled={busy || p.have < p.perPoint * 10} onClick={() => void act(call((s) => s.contributeMerge(Math.floor(p.have / p.perPoint) * p.perPoint), (v) => v), t('events.contributed'))}>
                  {t('events.contribute')} ({t(`currency.${p.currency}` as 'currency.gold')} {p.have})
                </button>
              )}
              {p.claimable && (
                <button type="button" className="btn" disabled={busy} onClick={() => void act(call((s) => s.claimMerge(p.id), (v) => v.snapshot), t('events.claimed'))}>
                  {t('events.claim')}
                </button>
              )}
            </li>
          ))}
        </ul>
        <p className="muted">{t('events.mergeNote')}</p>
      </section>
      <WeekendEvents />
      {status && (
        <p className="status-box" data-testid="events-status">
          {status}
        </p>
      )}
    </div>
  );
}

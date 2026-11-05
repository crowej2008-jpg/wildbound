import { useCallback, useEffect, useState } from 'react';
import type { WeekendView } from '@wildbound/server';
import { t } from '../i18n';
import { useServer } from '../server/ServerProvider';

const rewardText = (r: Record<string, number>) =>
  Object.entries(r)
    .map(([k, v]) => `${t(`currency.${k}` as 'currency.gold')} ×${v}`)
    .join(', ');

/** Weekend Bash (Elven Treasure, Bingo) and the Flower Event, shown on the Events page. */
export default function WeekendEvents() {
  const { call, busy } = useServer();
  const [view, setView] = useState<WeekendView | null>(null);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    const r = await call((s) => s.getWeekend());
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
  if (!view) return null;
  const e = view.elven;
  const b = view.bingo;
  const f = view.flower;
  return (
    <>
      <section className="card" data-testid="elven">
        <h2>{t('wk.elven')}</h2>
        <p data-testid="elven-state">
          {e.open ? `${t('wk.round')} ${e.round} · ${t('wk.flipped')} ${e.flips} / ${e.tiles}` : t('wk.elvenClosed')} · {t('currency.elvenTreasure')} {e.treasures} · {t('currency.milk')} {e.milk}
        </p>
        {e.nextGrand && <p className="muted">{t('wk.grand')}: {rewardText(e.nextGrand)}</p>}
        {e.open && (
          <>
            <button type="button" className="btn btn-primary" disabled={busy || e.treasures < 1} onClick={() => void call((s) => s.flipElven(), (v) => v.snapshot).then((r) => { if (r.ok) setStatus(r.value.grand ? t('wk.grandFound') : t('wk.flippedOne')); void refresh(); })}>
              {t('wk.flip')}
            </button>{' '}
            {e.price !== null && (
              <button type="button" className="btn" disabled={busy} onClick={() => void act(call((s) => s.buyElven(1), (v) => v), t('events.bought'))}>
                {t('wk.buyOne').replace('{p}', String(e.price))}
              </button>
            )}
          </>
        )}
        <h3>{t('wk.petExchange')}</h3>
        <ul className="plain-list">
          {e.exchange.map((r) => (
            <li key={r.id}>
              {r.name} — {r.price}{' '}
              <button type="button" className="btn" disabled={busy || e.milk < r.price} onClick={() => void act(call((s) => s.buyWeekendExchange('elven', r.id), (v) => v.snapshot), t('events.bought'))}>
                {t('joint.buy')}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="card" data-testid="bingo">
        <h2>{t('wk.bingo')}</h2>
        <p data-testid="bingo-state">
          {b.open ? t('wk.bingoOpen') : t('wk.bingoClosed')} · {t('currency.strawberrySauce')} {b.sauce} · {t('currency.strawberryCake')} {b.cake}
        </p>
        <div className="bingo-card" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 2.5rem)', gap: '0.25rem' }}>
          {Array.from({ length: 16 }, (_, i) => i + 1).map((n) => (
            <span key={n} className={`chip ${b.marked.includes(n) ? 'chip-on' : ''}`} data-testid={`bingo-${n}`}>
              {b.marked.includes(n) ? '✓' : n}
            </span>
          ))}
        </div>
        {b.open && (
          <p>
            {([1, 5] as const).map((n) => (
              <button key={n} type="button" className="btn btn-primary" disabled={busy || b.sauce < n || b.full} onClick={() => void call((s) => s.drawBingo(n), (v) => v.snapshot).then((r) => { if (r.ok) setStatus(`${t('wk.opened')} ${r.value.numbers.join(', ')}`); void refresh(); })}>
                {t('wk.open')} ×{n}
              </button>
            ))}{' '}
            {b.shop.map((r) => (
              <button key={r.tier} type="button" className="btn" disabled={busy || r.left < 1} onClick={() => void act(call((s) => s.buySauce(r.tier, 1), (v) => v), t('events.bought'))}>
                {t('wk.buySauce').replace('{p}', String(r.price)).replace('{n}', String(r.left))}
              </button>
            ))}{' '}
            {b.full && (
              <button type="button" className="btn" disabled={busy} onClick={() => void act(call((s) => s.resetBingo(), (v) => v), t('wk.newCard'))}>
                {t('wk.reset')}
              </button>
            )}
          </p>
        )}
        <ul className="plain-list">
          {b.lines.map((l) => (
            <li key={l.id}>
              {t('wk.line')} {l.cells.join('-')} — {l.rewards ? rewardText(l.rewards) : t('wk.wildcard')}{' '}
              {l.wildcard && !l.claimed && (
                <select aria-label={t('wk.wildcard')} value={picks[l.id] ?? ''} onChange={(ev) => setPicks({ ...picks, [l.id]: ev.target.value })}>
                  <option value="">{t('wk.wildcard')}</option>
                  {l.wildcard.map((o) => (
                    <option key={o.id} value={o.id}>
                      {rewardText(o.rewards)}
                    </option>
                  ))}
                </select>
              )}{' '}
              <button type="button" className="btn" disabled={busy || !l.done || l.claimed || (!!l.wildcard && !picks[l.id])} onClick={() => void act(call((s) => s.claimBingoLine(l.id, picks[l.id]), (v) => v.snapshot), t('events.claimed'))}>
                {l.claimed ? '✓' : t('events.claim')}
              </button>
            </li>
          ))}
        </ul>
        <h3>{t('wk.cakeExchange')}</h3>
        <ul className="plain-list">
          {b.exchange.map((r) => (
            <li key={r.id}>
              {r.name} — {r.price}{' '}
              <button type="button" className="btn" disabled={busy || b.cake < r.price} onClick={() => void act(call((s) => s.buyWeekendExchange('bingo', r.id), (v) => v.snapshot), t('events.bought'))}>
                {t('joint.buy')}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="card" data-testid="flower">
        <h2>{t('wk.flower')}</h2>
        <p data-testid="flower-state">
          {t('wk.flowers')} {f.flowers}
          {f.rank ? ` · #${f.rank}` : ''}
        </p>
        <ul className="plain-list">
          {f.tasks.map((x) => (
            <li key={x.label}>
              {x.label}: {x.value} — {x.steps.map(([at, fl]) => `${x.value >= at ? '✓' : ''}${at}→${fl}`).join(' · ')}
            </li>
          ))}
        </ul>
        <ul className="plain-list">
          {f.milestones.map((m) => (
            <li key={m.flowers}>
              {m.flowers} — {rewardText(m.rewards)}{' '}
              <button type="button" className="btn" disabled={busy || m.claimed || f.flowers < m.flowers} onClick={() => void act(call((s) => s.claimFlowerMilestone(m.flowers), (v) => v.snapshot), t('events.claimed'))}>
                {m.claimed ? '✓' : t('events.claim')}
              </button>
            </li>
          ))}
        </ul>
        {f.lastWeek?.claimable && (
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void act(call((s) => s.claimFlowerRank(), (v) => v.snapshot), t('events.claimed'))}>
            {t('wk.claimFlowerRank').replace('{r}', String(f.lastWeek.rank))}
          </button>
        )}
      </section>
      {status && <p className="status-box" data-testid="weekend-status">{status}</p>}
    </>
  );
}

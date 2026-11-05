import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ParadiseView } from '@wildbound/server';
import RewardLine from '../components/RewardLine';
import { formatDuration, t } from '../i18n';
import { useServer } from '../server/ServerProvider';

/** Pokémon Paradise (M14.3): explore, track and catch; the Park's Dex, gear and shop. */

type Tab = 'explore' | 'dex' | 'gear' | 'shop';
const STEPS = ['paradise.step.trace', 'paradise.step.footprint', 'paradise.step.drop', 'paradise.step.pokemon'] as const;
const pct = (v: number) => `${Math.round(v * 1000) / 10}%`;

export default function Paradise() {
  const { call, busy } = useServer();
  const [view, setView] = useState<ParadiseView | null>(null);
  const [tab, setTab] = useState<Tab>('explore');
  const [status, setStatus] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await call((s) => s.getParadise());
    if (res.ok) setView(res.value);
  }, [call]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const after = async (ok: boolean, message?: string) => {
    if (ok && message) setStatus(message);
    await refresh();
  };

  const explore = async () => {
    setStatus(null);
    await after((await call((s) => s.exploreParadise(), (v) => v)).ok);
  };
  const trackOn = async (scanner: boolean) => {
    const res = await call((s) => s.trackParadise(scanner), (v) => v.snapshot);
    await after(res.ok, res.ok ? (res.value.success ? t('paradise.tracked') : t('paradise.lost')) : undefined);
  };
  const throwBall = async (ball: 'poke' | 'advanced' | 'master') => {
    const res = await call((s) => s.throwParadiseBall(ball), (v) => v.snapshot);
    await after(res.ok, res.ok ? (res.value.caught ? t('paradise.caught') : t('paradise.fled')) : undefined);
  };

  if (!view) return <p className="muted">…</p>;
  const enc = view.encounter;

  return (
    <div className="page paradise">
      <Link className="text-link" to="/combat">
        {t('pve.title')}
      </Link>
      <h1 className="page-title">{t('paradise.title')}</h1>
      {!view.unlocked ? (
        <section className="card">
          <p data-testid="paradise-locked">{t('paradise.locked')}</p>
        </section>
      ) : (
        <>
          <section className="card">
            <p data-testid="paradise-summary">
              {t('paradise.park')} {view.season} · {t('paradise.endsIn')} {formatDuration(view.endsInMs)} · {t('paradise.stamina')} {view.stamina} /{' '}
              {view.maxStamina}
            </p>
            <p className="muted">
              {t('paradise.points')} {view.points} · {t('paradise.exp')} {view.exp} · {t('paradise.stars')} {view.stars} · {t('currency.ballAdvanced')}{' '}
              {view.balls.advanced} · {t('currency.ballMaster')} {view.balls.master} · {t('currency.scanner')} {view.balls.scanners}
            </p>
            <div className="chip-row">
              {(['explore', 'dex', 'gear', 'shop'] as Tab[]).map((k) => (
                <button key={k} type="button" className={`btn ${tab === k ? 'btn-primary' : ''}`} data-testid={`paradise-tab-${k}`} onClick={() => setTab(k)}>
                  {t(`paradise.tab.${k}` as 'paradise.tab.explore')}
                </button>
              ))}
            </div>
          </section>

          {tab === 'explore' && (
            <section className="card">
              <p className="muted">
                {t('paradise.scenes')} {view.scenes.map((s) => `${s.name}${s.open ? '' : ` (${t('paradise.gearAt')} ${s.gearLevel})`}`).join(' · ')}
              </p>
              {!enc ? (
                <button type="button" className="btn btn-primary" data-testid="paradise-explore" disabled={busy || view.stamina < 1} onClick={() => void explore()}>
                  {t('paradise.explore')}
                </button>
              ) : (
                <div data-testid="paradise-encounter">
                  <p>
                    {enc.name} — {t(STEPS[enc.step]!)}
                  </p>
                  {enc.step < 3 ? (
                    <p>
                      <button type="button" className="btn btn-primary" data-testid="paradise-track" disabled={busy} onClick={() => void trackOn(false)}>
                        {t('paradise.track')} ({pct(view.trackChance)})
                      </button>{' '}
                      <button type="button" className="btn" disabled={busy || view.balls.scanners < 1} onClick={() => void trackOn(true)}>
                        {t('paradise.scan')}
                      </button>
                    </p>
                  ) : (
                    <p>
                      <button type="button" className="btn btn-primary" data-testid="paradise-throw" disabled={busy} onClick={() => void throwBall('poke')}>
                        {t('paradise.ball.poke')} ({pct(enc.chances.poke)})
                      </button>{' '}
                      <button type="button" className="btn" disabled={busy || view.balls.advanced < 1} onClick={() => void throwBall('advanced')}>
                        {t('paradise.ball.advanced')} ({pct(enc.chances.advanced)})
                      </button>{' '}
                      <button type="button" className="btn" disabled={busy || view.balls.master < 1} onClick={() => void throwBall('master')}>
                        {t('paradise.ball.master')}
                      </button>
                    </p>
                  )}
                  <button type="button" className="btn" disabled={busy} onClick={async () => after((await call((s) => s.leaveParadiseRoute(), (v) => v)).ok)}>
                    {t('paradise.leave')}
                  </button>
                </div>
              )}
            </section>
          )}

          {tab === 'dex' && (
            <section className="card">
              <ul className="plain-list" data-testid="paradise-dex">
                {view.dex.map((d) => (
                  <li key={d.id}>
                    {d.caught ? '✓ ' : ''}
                    {d.name} {d.star}★ — {d.logged.map((l, i) => (l ? t(STEPS[i]!) : '·')).join(' / ')}
                  </li>
                ))}
              </ul>
              <h2 className="section-title">{t('paradise.starRewards')}</h2>
              <ul className="plain-list">
                {view.starRewards.map((r) => (
                  <li key={r.stars}>
                    {r.stars}★ <RewardLine rewards={r.rewards} />
                    {r.boxes > 0 ? ` +${r.boxes} ${t('paradise.box')}` : ''}{' '}
                    <button
                      type="button"
                      className="btn"
                      disabled={busy || r.claimed || view.stars < r.stars}
                      onClick={async () => after((await call((s) => s.claimParadiseStars(r.stars), (v) => v.snapshot)).ok, t('paradise.claimed'))}
                    >
                      {r.claimed ? t('paradise.done') : t('paradise.claim')}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {tab === 'gear' && (
            <section className="card">
              <ul className="plain-list">
                {view.gear.map((g) => (
                  <li key={g.type}>
                    {g.name} Lv {g.level}{' '}
                    {g.nextExp !== null ? (
                      <button
                        type="button"
                        className="btn"
                        disabled={busy || view.exp < g.nextExp}
                        onClick={async () => after((await call((s) => s.upgradeParadiseGear(g.type), (v) => v)).ok)}
                      >
                        {t('paradise.upgrade')} ({g.nextExp} {t('paradise.exp')})
                      </button>
                    ) : (
                      <span className="muted">{t('paradise.max')}</span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {tab === 'shop' && (
            <section className="card">
              <ul className="plain-list">
                {view.shop.map((r) => (
                  <li key={r.id}>
                    <RewardLine rewards={r.rewards} />
                    {r.boxes > 0 ? ` ${t('paradise.box')}` : ''} — {r.points ? `${r.points} ${t('paradise.points')}` : `${r.exp} ${t('paradise.exp')}`} · {t('paradise.left')} {r.left}{' '}
                    <button
                      type="button"
                      className="btn"
                      disabled={busy || r.locked || r.left < 1 || (r.points ?? 0) > view.points || (r.exp ?? 0) > view.exp}
                      onClick={async () => after((await call((s) => s.buyParadiseShop(r.id), (v) => v.snapshot)).ok, t('paradise.bought'))}
                    >
                      {r.locked ? t('paradise.lockedOffer') : t('paradise.buy')}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
      {status && (
        <p className="status-box" data-testid="paradise-status">
          {status}
        </p>
      )}
    </div>
  );
}

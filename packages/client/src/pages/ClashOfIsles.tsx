import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { BattleView, IslesView } from '@wildbound/server';
import BattleReplay from '../components/BattleReplay';
import RewardLine from '../components/RewardLine';
import { t } from '../i18n';
import { useServer } from '../server/ServerProvider';

/** Clash of Isles (M14.5): take islands from CPU guilds, hold one for Isle Tokens, climb the season ranking. */
export default function ClashOfIsles() {
  const { call, busy } = useServer();
  const [view, setView] = useState<IslesView | null>(null);
  const [boost, setBoost] = useState(1);
  const [fight, setFight] = useState<{ battle: BattleView; text: string } | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await call((s) => s.getIsles());
    if (res.ok) setView(res.value);
  }, [call]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const done = async (ok: boolean, msg?: string) => {
    if (ok && msg) setStatus(msg);
    await refresh();
  };

  if (fight) {
    return (
      <BattleReplay
        view={fight.battle}
        attackerLabel={t('combat.team.attackers')}
        defenderLabel={t('isles.title')}
        resultExtra={
          <section className="card result-rewards">
            <strong data-testid="isles-outcome">{fight.text}</strong>
            <button type="button" className="btn btn-primary" onClick={() => { setFight(null); void refresh(); }}>
              {t('joint.back')}
            </button>
          </section>
        }
      />
    );
  }
  if (!view) return <p className="muted">…</p>;
  const areas = [...new Set(view.islands.map((i) => i.area))];

  return (
    <div className="page clash-of-isles">
      <Link className="text-link" to="/combat">
        {t('pve.title')}
      </Link>
      <h1 className="page-title">{t('isles.title')}</h1>
      {!view.unlocked ? (
        <section className="card">
          <p data-testid="isles-locked">{t('isles.locked')}</p>
        </section>
      ) : (
        <>
          <section className="card">
            <p data-testid="isles-summary">
              {t('isles.attempts')} {view.attempts} (+{view.vouchers}) · {t('isles.power')} {view.power} · {t('isles.fatigue')} −{Math.round(view.fatigue * 100)}% · {t('isles.points')}{' '}
              {view.points} · {t('joint.rank')} #{view.rank} · {t('currency.islandCoin')} {view.tokens}
            </p>
            {!view.seasonDay ? <p className="muted">{t('isles.monday')}</p> : null}
            {view.held ? (
              <p>
                {t('isles.holding')} {view.held.tier} #{view.held.id} ({view.held.tokens} / 5 min) — {view.held.pendingMinutes} min{' '}
                <button type="button" className="btn btn-primary" disabled={busy} onClick={async () => done((await call((s) => s.collectIsland(), (v) => v.snapshot)).ok, t('isles.collected'))}>
                  {t('isles.collect')}
                </button>
              </p>
            ) : (
              <p className="muted">{t('isles.none')}</p>
            )}
            <p>
              {t('isles.boost')}{' '}
              {[1, 2, 3, 4].map((n) => (
                <button key={n} type="button" className={`btn ${boost === n ? 'btn-primary' : ''}`} onClick={() => setBoost(n)}>
                  {n} {n > 1 ? `(+${[0, 0, 20, 50, 80][n]}%)` : ''}
                </button>
              ))}{' '}
              <Link className="text-link" to="/squad?mode=isles">
                {t('joint.editTeam')}
              </Link>
            </p>
            <ul className="plain-list">
              {view.tasks.map((x) => (
                <li key={x.challenges}>
                  {t('isles.task').replace('{n}', String(x.challenges))} <RewardLine rewards={x.rewards} />{' '}
                  <button type="button" className="btn" disabled={busy || x.claimed || !x.ready} onClick={async () => done((await call((s) => s.claimIslesTask(x.challenges), (v) => v.snapshot)).ok, t('joint.claimed'))}>
                    {x.claimed ? '✓' : t('joint.claim')}
                  </button>
                </li>
              ))}
            </ul>
            {view.lastRank !== null ? (
              <button type="button" className="btn btn-primary" onClick={async () => done((await call((s) => s.claimIslesSeason(), (v) => v.snapshot)).ok, t('joint.claimed'))}>
                {t('joint.season')} #{view.lastRank}
              </button>
            ) : null}
          </section>
          {areas.map((a) => (
            <section key={a} className="card isles-area" data-area={a}>
              <h2 className="section-title">
                {t('isles.area')} {a}
              </h2>
              {view.islands
                .filter((i) => i.area === a)
                .map((i) => (
                  <button
                    key={i.id}
                    type="button"
                    className={`btn isles-island ${i.held ? 'btn-primary' : ''}`}
                    data-island={i.id}
                    disabled={busy || i.held || !view.seasonDay || (view.attempts + view.vouchers < boost)}
                    onClick={async () => {
                      const r = await call((s) => s.attackIsland(i.id, boost), (v) => v.snapshot);
                      if (r.ok) setFight({ battle: r.value.battle, text: `${r.value.win ? (r.value.captured ? t('isles.captured') : t('isles.shieldDown')) : t('joint.lost')} +${r.value.points}` });
                    }}
                  >
                    {i.tier} · {i.tokens} · 🛡{i.shields}
                  </button>
                ))}
            </section>
          ))}
        </>
      )}
      {status && (
        <p className="status-box" data-testid="isles-status">
          {status}
        </p>
      )}
    </div>
  );
}

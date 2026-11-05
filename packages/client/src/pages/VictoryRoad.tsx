import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { VictoryRoadView } from '@wildbound/server';
import RewardLine from '../components/RewardLine';
import { t } from '../i18n';
import { useServer } from '../server/ServerProvider';

/** Victory Road (M14.1): 60 gyms in 8 regions — progress chests, gym tasks, badges and their perks. */

export default function VictoryRoad() {
  const { call, busy } = useServer();
  const [view, setView] = useState<VictoryRoadView | null>(null);
  const [area, setArea] = useState(1);
  const [status, setStatus] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await call((s) => s.getVictoryRoad());
    if (res.ok) setView(res.value);
  }, [call]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const done = async (ok: boolean) => {
    if (ok) setStatus(t('victory.claimed'));
    await refresh();
  };

  if (!view) return <p className="muted">…</p>;
  const current = view.areas.find((a) => a.id === area) ?? view.areas[0]!;

  return (
    <div className="page victory-road">
      <Link className="text-link" to="/campaign">
        {t('victory.backToCampaign')}
      </Link>
      <h1 className="page-title">{t('victory.title')}</h1>
      <section className="card">
        <p data-testid="victory-summary">
          {t('victory.badges')} {view.badges} / 60 · {t('victory.afk')} +{Math.round(view.afk * 100)}%
        </p>
        <button
          type="button"
          className="btn btn-primary"
          data-testid="victory-daily"
          disabled={busy || view.badges === 0 || view.dailyClaimed}
          onClick={async () => done((await call((s) => s.claimBadgeDaily(), (v) => v.snapshot)).ok)}
        >
          {view.dailyClaimed ? t('victory.dailyDone') : t('victory.daily').replace('{n}', String(view.dailyGems))}
        </button>
        <div className="chip-row">
          {view.areas.map((a) => (
            <button key={a.id} type="button" className={`btn ${a.id === current.id ? 'btn-primary' : ''}`} onClick={() => setArea(a.id)}>
              {a.name}
            </button>
          ))}
        </div>
      </section>

      {current.gyms.map((g) => (
        <section key={g.index} className={`card victory-gym gym-${g.status}`} data-gym={g.index}>
          <h2 className="section-title">
            {g.index}. {g.name} — {g.badge} {g.status === 'beaten' ? '✓' : ''}
          </h2>
          <p className="muted">
            {t(`victory.status.${g.status}` as 'victory.status.locked')}
            {g.chapter ? ` · ${t('victory.gate')} ${g.chapter}-1` : ''} · {t('victory.progress')} {g.progress}%
          </p>
          <p>
            {t('victory.perk')} {g.perkText}
          </p>
          {g.task ? (
            <p>
              {t('victory.task')} {g.task.desc} {g.task.tracked ? '' : `(${t('victory.untracked')})`} — <RewardLine rewards={g.task.rewards} />{' '}
              <button
                type="button"
                className="btn"
                disabled={busy || !g.task.done || g.task.claimed}
                onClick={async () => done((await call((s) => s.claimVictoryTask(g.index), (v) => v.snapshot)).ok)}
              >
                {g.task.claimed ? t('victory.done') : t('victory.claim')}
              </button>
            </p>
          ) : null}
          <p>
            {g.chests.map((c) => (
              <button
                key={c.progress}
                type="button"
                className="btn"
                data-chest={`${g.index}-${c.progress}`}
                disabled={busy || !c.ready || c.claimed}
                onClick={async () => done((await call((s) => s.claimVictoryChest(g.index, c.progress), (v) => v.snapshot)).ok)}
              >
                {c.progress}%{c.claimed ? ' ✓' : ''}: <RewardLine rewards={c.rewards} />
                {c.titleCard ? ` + ${c.titleCard}` : ''}
              </button>
            ))}
          </p>
        </section>
      ))}

      {status && (
        <p className="status-box" data-testid="victory-status">
          {status}
        </p>
      )}
    </div>
  );
}

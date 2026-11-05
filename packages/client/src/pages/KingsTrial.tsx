import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { GymBattleResult, KingsTrialView } from '@wildbound/server';
import BattleReplay from '../components/BattleReplay';
import RewardLine from '../components/RewardLine';
import { t } from '../i18n';
import { useServer } from '../server/ServerProvider';

/** King's Trial (M14.2): 36 Elite Four / Champion fights unlocked by Champion Points. */

type Tab = 'trainers' | 'points' | 'weekly';

export default function KingsTrial() {
  const { call, busy } = useServer();
  const [view, setView] = useState<KingsTrialView | null>(null);
  const [tab, setTab] = useState<Tab>('trainers');
  const [area, setArea] = useState(1);
  const [fight, setFight] = useState<GymBattleResult | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await call((s) => s.getKingsTrial());
    if (res.ok) setView(res.value);
  }, [call]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const done = async (ok: boolean) => {
    if (ok) setStatus(t('kings.claimed'));
    await refresh();
  };

  if (fight) {
    return (
      <BattleReplay
        view={fight.battle}
        attackerLabel={t('combat.team.attackers')}
        defenderLabel={t('kings.title')}
        resultExtra={
          <section className={`card result-rewards ${fight.win ? 'result-win' : 'result-lose'}`}>
            <div className="result-banner">
              <strong data-testid="kings-outcome">{fight.win ? t('kings.won') : t('kings.lost')}</strong>
            </div>
            {fight.firstClear ? <RewardLine rewards={fight.rewards} /> : null}
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setFight(null);
                void refresh();
              }}
            >
              {t('kings.back')}
            </button>
          </section>
        }
      />
    );
  }

  if (!view) return <p className="muted">…</p>;
  const current = view.areas.find((a) => a.id === area) ?? view.areas[0]!;

  return (
    <div className="page kings-trial">
      <Link className="text-link" to="/victory-road">
        {t('victory.title')}
      </Link>
      <h1 className="page-title">{t('kings.title')}</h1>
      <section className="card">
        <p data-testid="kings-points">
          {t('kings.points')} {view.points.toLocaleString()}
          {view.readyPoints > 0 ? ` (+${view.readyPoints} ${t('kings.ready')})` : ''}
        </p>
        <button type="button" className="btn btn-primary" data-testid="kings-claim-all" disabled={busy || view.readyPoints === 0} onClick={async () => done((await call((s) => s.claimTrialAchievements(), (v) => v)).ok)}>
          {t('kings.claimAll')}
        </button>
        <div className="chip-row">
          {(['trainers', 'points', 'weekly'] as Tab[]).map((k) => (
            <button key={k} type="button" className={`btn ${tab === k ? 'btn-primary' : ''}`} data-testid={`kings-tab-${k}`} onClick={() => setTab(k)}>
              {t(`kings.tab.${k}` as 'kings.tab.trainers')}
            </button>
          ))}
        </div>
      </section>

      {tab === 'trainers' && (
        <>
          <section className="card chip-row">
            {view.areas.map((a) => (
              <button key={a.id} type="button" className={`btn ${a.id === current.id ? 'btn-primary' : ''}`} onClick={() => setArea(a.id)}>
                {a.name}
              </button>
            ))}
          </section>
          {current.trainers.map((tr) => (
            <section key={tr.index} className="card kings-trainer" data-trainer={tr.index}>
              <h2 className="section-title">
                {tr.name} {tr.beaten ? '✓' : ''}
              </h2>
              <p className="muted">
                {tr.unlocked ? `${t('kings.progress')} ${tr.progress}% · ${tr.points.toLocaleString()} ${t('kings.pointsNeeded')}` : t('kings.locked')}
              </p>
              {tr.perkText ? <p>{tr.perkText}</p> : null}
              <p>
                {tr.chests.map((c) => (
                  <button
                    key={c.progress}
                    type="button"
                    className="btn"
                    disabled={busy || !c.ready || c.claimed}
                    onClick={async () => done((await call((s) => s.claimTrialChest(tr.index, c.progress), (v) => v.snapshot)).ok)}
                  >
                    {c.progress}%{c.claimed ? ' ✓' : ''}: <RewardLine rewards={c.rewards} />
                  </button>
                ))}
              </p>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy || !tr.unlocked || tr.progress < 100}
                onClick={async () => {
                  const res = await call((s) => s.challengeKingsTrial(tr.index), (v) => v.snapshot);
                  if (res.ok) setFight(res.value);
                }}
              >
                {tr.beaten ? t('kings.rematch') : t('kings.challenge')}
              </button>
            </section>
          ))}
        </>
      )}

      {tab === 'points' && (
        <section className="card">
          <h2 className="section-title">{t('kings.achievements')}</h2>
          <ul className="plain-list">
            {view.achievements.map((a) => (
              <li key={a.event} className={a.tracked ? '' : 'muted'}>
                {a.desc}: {a.tracked ? a.have.toLocaleString() : '—'} · {a.claimed} / {a.total}
                {a.next ? ` · ${t('kings.next')} ${a.next.value.toLocaleString()} (+${a.next.points})` : ''}
              </li>
            ))}
          </ul>
          <h2 className="section-title">{t('kings.milestones')}</h2>
          <ul className="plain-list">
            {view.milestones.map((m) => (
              <li key={m.index}>
                {m.points.toLocaleString()} {t('kings.pointsShort')}: <RewardLine rewards={m.rewards} />{' '}
                <button
                  type="button"
                  className="btn"
                  disabled={busy || m.claimed || view.points < m.points}
                  onClick={async () => done((await call((s) => s.claimTrialMilestone(m.index), (v) => v.snapshot)).ok)}
                >
                  {m.claimed ? '✓' : t('kings.claim')}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === 'weekly' && (
        <section className="card">
          <h2 className="section-title">{t('kings.weekly')}</h2>
          <ul className="plain-list">
            {view.weekly.map((w) => (
              <li key={w.id} className={w.tracked ? '' : 'muted'}>
                {w.desc} — {w.tracked ? `${Math.min(w.have, w.value)} / ${w.value}` : t('kings.untracked')} · +{w.points} {t('kings.pointsShort')}{' '}
                <RewardLine rewards={w.rewards} />{' '}
                <button
                  type="button"
                  className="btn"
                  disabled={busy || w.claimed || !w.tracked || w.have < w.value}
                  onClick={async () => done((await call((s) => s.claimTrialWeekly(w.id), (v) => v.snapshot)).ok)}
                >
                  {w.claimed ? '✓' : t('kings.claim')}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {status && (
        <p className="status-box" data-testid="kings-status">
          {status}
        </p>
      )}
    </div>
  );
}

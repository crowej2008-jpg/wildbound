import { useCallback, useEffect, useState } from 'react';
import type { TowerBattleResult, TowerView } from '@wildbound/server';
import BattleReplay from '../components/BattleReplay';
import RewardLine from '../components/RewardLine';
import { formatDuration, t } from '../i18n';
import { useServer } from '../server/ServerProvider';

/** Tower (M8, PROMPT §7.6): climb floors, sweep, milestone chests. */
export default function PveTower() {
  const { call, snapshot, busy } = useServer();
  const [view, setView] = useState<TowerView | null>(null);
  const [battle, setBattle] = useState<TowerBattleResult | null>(null);
  const [swept, setSwept] = useState(false);

  const refresh = useCallback(async () => {
    const result = await call((s) => s.getTower());
    if (result.ok) setView(result.value);
  }, [call]);

  useEffect(() => {
    void refresh();
  }, [refresh, snapshot?.state.pve.tower.floor]);

  const onClimb = async (kind: 'normal' | 'hard' = 'normal') => {
    const result = await call((s) => s.challengeTower(undefined, kind), (v) => v.snapshot);
    if (result.ok) setBattle(result.value);
  };

  const onSweep = async () => {
    setSwept(false);
    const result = await call((s) => s.sweepTower(), (v) => v.snapshot);
    if (result.ok) {
      setSwept(true);
      await refresh();
    }
  };

  if (battle) {
    return (
      <BattleReplay
        view={battle.battle}
        attackerLabel={t('combat.team.attackers')}
        defenderLabel={`${t('tower.floor')} ${battle.floor}`}
        resultExtra={
          <section className={`card result-rewards ${battle.win ? 'result-win' : 'result-lose'}`}>
            <div className="result-banner">
              <strong>{battle.win ? t('tower.victory') : t('tower.defeat')}</strong>
            </div>
            {battle.win ? <RewardLine rewards={battle.rewards} /> : null}
            <button type="button" className="btn btn-primary" onClick={() => setBattle(null)}>
              {t('tower.back')}
            </button>
          </section>
        }
      />
    );
  }

  return (
    <main className="main">
      <h1 className="page-title">{t('pve.tower')}</h1>
      <p className="muted">{t('pve.tower.desc')}</p>

      {view ? (
        <section className="card">
          <div className="stat-row">
            <span className="stat">
              <span className="muted">{t('tower.floor')}</span>
              <strong>{view.floor}</strong>
            </span>
            <span className="stat">
              <span className="muted">{t('tower.next')}</span>
              <strong>{view.nextFloor}</strong>
            </span>
            <span className="stat">
              <span className="muted">{t('tower.enemyLevel')}</span>
              <strong>{view.nextEnemyLevel}</strong>
            </span>
          </div>
          <div className="stat-row">
            <span className="stat">
              <span className="muted">{t('tower.climbsLeft')}</span>
              <strong>{view.climbsLeft}</strong>
            </span>
            <span className="stat">
              <span className="muted">{t('tower.sweepsLeft')}</span>
              <strong>{view.sweepsLeft}</strong>
            </span>
          </div>
          <div className="stage-actions">
            <button type="button" className="btn btn-primary" disabled={busy || view.climbsLeft <= 0} onClick={() => void onClimb()}>
              {t('tower.climb')}
            </button>
            <button type="button" className="btn" disabled={busy || view.sweepsLeft <= 0 || view.floor <= 0} onClick={() => void onSweep()}>
              {t('tower.sweep')}
            </button>
          </div>
          {swept && <p className="muted">{t('tower.swept')}</p>}
          <p className="muted">
            {t('tower.dayReset')}: {formatDuration(view.dayResetMs)}
          </p>
        </section>
      ) : (
        <p className="muted">{t('combat.loading')}</p>
      )}

      {view && (
        <section className="card" data-tower="hard">
          <h2 className="section-title">{t('tower.hard')}</h2>
          <div className="stat-row">
            <span className="stat">
              <span className="muted">{t('tower.floor')}</span>
              <strong>
                {view.hard.floor}/{view.hard.top}
              </strong>
            </span>
            <span className="stat">
              <span className="muted">{t('tower.enemyLevel')}</span>
              <strong>{view.hard.nextEnemyLevel}</strong>
            </span>
            <span className="stat">
              <span className="muted">{t('tower.climbsLeft')}</span>
              <strong>{view.hard.climbsLeft}</strong>
            </span>
          </div>
          {view.hard.rule && (
            <p className="muted">
              {t('tower.rule')}: {view.hard.rule}
            </p>
          )}
          <button type="button" className="btn btn-primary" disabled={busy || view.hard.climbsLeft <= 0} onClick={() => void onClimb('hard')}>
            {t('tower.climbHard')}
          </button>
        </section>
      )}

      {view &&
        ([
          ['tower.milestones', view.milestones],
          ['tower.hardMilestones', view.hard.milestones],
        ] as const).map(([title, rows]) => (
          <section key={title} className="card">
            <h2 className="section-title">{t(title)}</h2>
            <ul className="plain-list">
              {rows.map((m) => (
                <li key={m.floor} className="milestone-row">
                  <span>
                    {t('tower.floor')} {m.floor}
                  </span>
                  <RewardLine rewards={m.rewards} />
                  {m.extras.length > 0 && <span className="muted">{m.extras.join(' · ')}</span>}
                </li>
              ))}
            </ul>
          </section>
        ))}
    </main>
  );
}

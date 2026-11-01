import { useCallback, useEffect, useState } from 'react';
import type { WorldBossBattleResult, WorldBossView } from '@wildbound/server';
import BattleReplay from '../components/BattleReplay';
import RewardLine from '../components/RewardLine';
import { formatDuration, t } from '../i18n';
import { useServer } from '../server/ServerProvider';

/** World Boss (M8, PROMPT §7.6): damage scoring, milestones, ghost-ladder rank. */
export default function WorldBoss() {
  const { call, snapshot, busy } = useServer();
  const [view, setView] = useState<WorldBossView | null>(null);
  const [battle, setBattle] = useState<WorldBossBattleResult | null>(null);

  const refresh = useCallback(async () => {
    const result = await call((s) => s.getWorldBoss());
    if (result.ok) setView(result.value);
  }, [call]);

  useEffect(() => {
    void refresh();
  }, [refresh, snapshot?.state.pve.worldBoss.attempts]);

  const onFight = async () => {
    const result = await call((s) => s.challengeWorldBoss(), (v) => v.snapshot);
    if (result.ok) {
      setBattle(result.value);
      await refresh();
    }
  };

  const onClaim = async (index: number) => {
    const result = await call((s) => s.claimWorldBossMilestone(index), (v) => v.snapshot);
    if (result.ok) await refresh();
  };

  if (battle) {
    return (
      <BattleReplay
        view={battle.battle}
        attackerLabel={t('combat.team.attackers')}
        defenderLabel={battle.name}
        resultExtra={
          <section className="card result-rewards result-win">
            <div className="result-banner">
              <strong>{t('boss.damage')}: {battle.damage.toLocaleString()}</strong>
            </div>
            <p className="muted">
              {t('boss.rank')} #{battle.rank} {t('boss.ghosts')}
            </p>
            <button type="button" className="btn btn-primary" onClick={() => setBattle(null)}>
              {t('boss.back')}
            </button>
          </section>
        }
      />
    );
  }

  return (
    <main className="main">
      <h1 className="page-title">{t('pve.boss')}</h1>
      <p className="muted">{t('pve.boss.desc')}</p>

      {view ? (
        <section className="card">
          <h2 className="section-title">{view.open ? `${t('boss.today')}: ${view.name}` : t('boss.closed')}</h2>
          <div className="stat-row">
            <span className="stat">
              <span className="muted">{t('boss.attempts')}</span>
              <strong>
                {view.attemptsLeft}/{view.attemptsPerWindow}
              </strong>
            </span>
            <span className="stat">
              <span className="muted">{t('boss.score')}</span>
              <strong>{view.score.toLocaleString()}</strong>
            </span>
            <span className="stat">
              <span className="muted">{t('boss.damage')}</span>
              <strong>{view.bestDamage.toLocaleString()}</strong>
            </span>
            <span className="stat">
              <span className="muted">{t('boss.lastDamage')}</span>
              <strong>{view.lastDamage.toLocaleString()}</strong>
            </span>
            <span className="stat">
              <span className="muted">{t('boss.rank')}</span>
              <strong>#{view.rank}</strong>
            </span>
          </div>
          <div className="stage-actions">
            <button type="button" className="btn btn-primary" disabled={busy || !view.open || view.attemptsLeft <= 0} onClick={() => void onFight()}>
              {t('boss.fight')}
            </button>
          </div>
          <p className="muted">
            {(view.open ? t('boss.closesIn') : t('boss.opensIn'))}: {formatDuration(view.windowMs)} ·{' '}
            {t('boss.windows')}: {view.windows.map((w) => `${w.startHour}:00–${w.endHour}:00`).join(', ')} UTC
          </p>
          <p className="muted">
            {t('boss.rankRewards')}:{' '}
            {view.rankRewards.map((r, i) => {
              const from = i === 0 ? 1 : view.rankRewards[i - 1]!.upToRank + 1;
              return `#${from === r.upToRank ? r.upToRank : `${from}–${r.upToRank}`}`;
            }).join(' · ')}
          </p>
        </section>
      ) : (
        <p className="muted">{t('combat.loading')}</p>
      )}

      {view && (
        <section className="card">
          <h2 className="section-title">{t('boss.milestones')}</h2>
          <ul className="plain-list">
            {view.milestones.map((m) => (
              <li key={m.index} className="milestone-row">
                <span>{m.damage.toLocaleString()}</span>
                <span className="milestone-rewards">
                  <RewardLine rewards={m.rewards} />
                </span>
                <button
                  type="button"
                  className="btn"
                  disabled={busy || !m.reached || m.claimed}
                  onClick={() => void onClaim(m.index)}
                >
                  {m.claimed ? t('boss.claimed') : t('boss.claim')}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

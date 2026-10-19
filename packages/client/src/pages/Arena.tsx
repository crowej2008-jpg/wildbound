import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ArenaBattleResult, ArenaView } from '@wildbound/server';
import BattleReplay from '../components/BattleReplay';
import RewardLine from '../components/RewardLine';
import { currencyLabel, formatDuration, t } from '../i18n';
import { useServer } from '../server/ServerProvider';

/** Arena (M10, PROMPT §7.7): credits, three matched ghosts, daily chests. */
export default function Arena() {
  const { call, snapshot, busy } = useServer();
  const [view, setView] = useState<ArenaView | null>(null);
  const [battle, setBattle] = useState<ArenaBattleResult | null>(null);

  const refresh = useCallback(async () => {
    const result = await call((s) => s.getArena());
    if (result.ok) setView(result.value);
  }, [call]);

  const arena = snapshot?.state.pvp.arena;

  useEffect(() => {
    void refresh();
  }, [refresh, arena?.attempts, arena?.bought, arena?.credits, arena?.battleCount, arena?.opponentSeed]);

  const onChallenge = async (index: number) => {
    const result = await call((s) => s.challengeArena(index), (v) => v.snapshot);
    if (result.ok) {
      setBattle(result.value);
      await refresh();
    }
  };

  const onRefresh = async () => {
    await call((s) => s.refreshArena(), (v) => v);
    await refresh();
  };

  const onBuy = async () => {
    await call((s) => s.buyArenaAttempts(1), (v) => v.snapshot);
    await refresh();
  };

  const onClaimChest = async (index: number) => {
    await call((s) => s.claimArenaChest(index), (v) => v.snapshot);
    await refresh();
  };

  const onClaimAchievement = async (index: number) => {
    await call((s) => s.claimArenaAchievement(index), (v) => v.snapshot);
    await refresh();
  };

  if (battle) {
    return (
      <BattleReplay
        view={battle.battle}
        defenderLabel={`${t('arena.opponent')} ${battle.opponentIndex + 1}`}
        resultExtra={
          <section className="card arena-result">
            <h2 className="section-title">
              {battle.win ? t('arena.win') : t('arena.lose')} · {t('arena.creditsNow')}{' '}
              {battle.creditsAfter.toLocaleString()}
            </h2>
            <p className="muted">
              {t('arena.credits')} {battle.creditsBefore.toLocaleString()} → {battle.creditsAfter.toLocaleString()} ·{' '}
              {t('arena.place')} #{battle.place.toLocaleString()} · {t('arena.attempts')} {battle.attemptsLeft}
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setBattle(null);
                void refresh();
              }}
            >
              {t('arena.back')}
            </button>
          </section>
        }
      />
    );
  }

  if (!view) {
    return (
      <main className="main">
        <h1 className="page-title">{t('arena.title')}</h1>
        <p className="muted">{t('combat.loading')}</p>
      </main>
    );
  }

  return (
    <main className="main">
      <div className="page-head">
        <h1 className="page-title">{t('arena.title')}</h1>
        <Link className="text-link" to="/arena/rankings">
          {t('arena.rankings')} →
        </Link>
      </div>

      {!view.unlocked ? (
        <section className="card">
          <p className="muted">
            {t('arena.locked')} {view.chapter}
          </p>
        </section>
      ) : (
        <>
          <p className="muted">{t('arena.subtitle')}</p>

          <section className="card">
            <div className="stat-row">
              <span className="stat">
                <span className="muted">{t('arena.credits')}</span>
                <strong>{view.credits.toLocaleString()}</strong>
              </span>
              <span className="stat">
                <span className="muted">{t('arena.ranking')}</span>
                <strong>#{view.place.toLocaleString()}</strong>
              </span>
              <span className="stat">
                <span className="muted">{t('arena.bestPlace')}</span>
                <strong>{view.bestPlace > 0 ? `#${view.bestPlace.toLocaleString()}` : t('arena.none')}</strong>
              </span>
              <span className="stat">
                <span className="muted">{t('arena.attempts')}</span>
                <strong>
                  {view.attemptsTotal - view.attempts}/{view.attemptsTotal}
                </strong>
              </span>
            </div>
            <div className="stage-actions">
              <button type="button" className="btn" disabled={busy} onClick={() => void onRefresh()}>
                {t('arena.refresh')}
              </button>
              <button type="button" className="btn" disabled={busy} onClick={() => void onBuy()}>
                {t('arena.buyAttempt')} ({view.attemptPrice.toLocaleString()} {currencyLabel.gems})
              </button>
              <Link className="btn" to="/squad?mode=arenaDefence">
                {t('arena.defenceEdit')}
              </Link>
            </div>
            <p className="muted">
              {view.defence.count > 0
                ? `${t('arena.defence')}: ${view.defence.count} · ${t('combat.teamPower')} ${view.defence.power.toLocaleString()}`
                : t('arena.defenceNone')}
            </p>
            <p className="muted">
              {t('arena.weekReset')}: {formatDuration(view.weekResetMs)} · {t('arena.dayReset')}:{' '}
              {formatDuration(view.dayResetMs)}
            </p>
          </section>

          <section className="card">
            <h2 className="section-title">{t('arena.opponents')}</h2>
            <ul className="plain-list">
              {view.opponents.map((opp) => (
                <li key={opp.index} className="milestone-row">
                  <span>
                    {t('arena.opponent')} {opp.index + 1}
                    <span className="muted">
                      {' '}
                      · {t('wild.level')}
                      {opp.level} · {t('wild.power')} {opp.power.toLocaleString()}
                    </span>
                  </span>
                  <span className="milestone-rewards muted">{opp.names.join(' · ')}</span>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy || !view.canChallenge}
                    onClick={() => void onChallenge(opp.index)}
                  >
                    {t('arena.challenge')}
                  </button>
                </li>
              ))}
            </ul>
            {!view.canChallenge && <p className="muted">{t('arena.noAttempts')}</p>}
          </section>

          <section className="card">
            <h2 className="section-title">{t('arena.chests')}</h2>
            <ul className="plain-list">
              {view.chests.map((chest) => (
                <li key={chest.index} className="milestone-row">
                  <span>
                    {chest.battles} {t('arena.battles')}
                  </span>
                  <span className="milestone-rewards">
                    <RewardLine rewards={chest.reward} />
                  </span>
                  <button
                    type="button"
                    className="btn"
                    disabled={busy || !chest.reached || chest.claimed}
                    onClick={() => void onClaimChest(chest.index)}
                  >
                    {chest.claimed ? t('arena.claimed') : chest.reached ? t('arena.claim') : t('arena.notReached')}
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="card">
            <h2 className="section-title">{t('arena.achievements')}</h2>
            <ul className="plain-list">
              {view.achievements.map((ach) => (
                <li key={ach.index} className="milestone-row">
                  <span>
                    {t('arena.topPlace')} {ach.place}
                  </span>
                  <span className="milestone-rewards">
                    <RewardLine rewards={ach.reward} />
                  </span>
                  <button
                    type="button"
                    className="btn"
                    disabled={busy || !ach.reached || ach.claimed}
                    onClick={() => void onClaimAchievement(ach.index)}
                  >
                    {ach.claimed ? t('arena.claimed') : ach.reached ? t('arena.claim') : t('arena.notReached')}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </main>
  );
}

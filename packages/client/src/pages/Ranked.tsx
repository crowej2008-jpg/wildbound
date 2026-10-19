import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { RankedMatchResult, RankedView } from '@wildbound/server';
import BattleReplay from '../components/BattleReplay';
import RewardLine from '../components/RewardLine';
import { currencyLabel, factionLabel, formatDuration, t } from '../i18n';
import { useServer } from '../server/ServerProvider';

/**
 * Ranked (M10.3, PROMPT §7.7): the region ladder, the season's weather, the
 * best-of series and the tier / challenge-gift claims.
 */
export default function Ranked() {
  const { call, snapshot, busy } = useServer();
  const [view, setView] = useState<RankedView | null>(null);
  const [match, setMatch] = useState<RankedMatchResult | null>(null);
  const [game, setGame] = useState(0);

  const refresh = useCallback(async () => {
    const result = await call((s) => s.getRanked());
    if (result.ok) setView(result.value);
  }, [call]);

  const ranked = snapshot?.state.pvp.ranked;

  useEffect(() => {
    void refresh();
  }, [
    refresh,
    ranked?.attempts,
    ranked?.bought,
    ranked?.score,
    ranked?.tier,
    ranked?.matches,
    ranked?.season,
    ranked?.phase,
  ]);

  const onStart = async () => {
    const result = await call((s) => s.startRankedMatch(), (v) => v.snapshot);
    if (result.ok) {
      setGame(0);
      setMatch(result.value);
      await refresh();
    }
  };

  const onBuy = async () => {
    await call((s) => s.buyRankedAttempts(1), (v) => v.snapshot);
    await refresh();
  };

  const onClaimTier = async (index: number) => {
    await call((s) => s.claimRankedTier(index), (v) => v.snapshot);
    await refresh();
  };

  const onClaimGift = async (index: number) => {
    await call((s) => s.claimRankedGift(index), (v) => v.snapshot);
    await refresh();
  };

  if (match) {
    const index = Math.min(game, match.battles.length - 1);
    const battle = match.battles[index]!;
    return (
      <BattleReplay
        key={index}
        view={battle}
        defenderLabel={`${t('ranked.rival')} ${index + 1}`}
        resultExtra={
          <section className="card ranked-series">
            <h2 className="section-title">
              {match.win ? t('ranked.win') : t('ranked.lose')} · {t('ranked.series')} {match.wins}–{match.losses}
              {match.promoted ? ` · ${t('ranked.promoted')}` : ''}
            </h2>
            <p className="muted">
              {t('ranked.score')} {match.scoreBefore.toLocaleString()} → {match.scoreAfter.toLocaleString()} ·{' '}
              {t('ranked.rankNow')} {view?.tiers[match.tierAfter]?.name ?? ''} · {t('ranked.attempts')}{' '}
              {match.attemptsLeft}
            </p>
            <ul className="plain-list">
              {match.battles.map((gameBattle, i) => (
                <li key={i} className="milestone-row">
                  <span>
                    {t('ranked.game')} {i + 1}
                  </span>
                  <span className="milestone-rewards muted">
                    {gameBattle.winner === 'attackers' ? t('ranked.wins') : t('ranked.losses')} · {gameBattle.rounds}
                  </span>
                  <button
                    type="button"
                    className="btn"
                    disabled={i === game}
                    onClick={() => setGame(i)}
                  >
                    {t('ranked.watch')}
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setMatch(null);
                void refresh();
              }}
            >
              {t('ranked.back')}
            </button>
          </section>
        }
      />
    );
  }

  if (!view) {
    return (
      <main className="main">
        <h1 className="page-title">{t('ranked.title')}</h1>
        <p className="muted">{t('combat.loading')}</p>
      </main>
    );
  }

  if (!view.unlocked) {
    return (
      <main className="main">
        <h1 className="page-title">{t('ranked.title')}</h1>
        <section className="card">
          <p className="muted">
            {t('ranked.locked')} {view.chapter}
          </p>
        </section>
      </main>
    );
  }

  const floor = view.floor;
  const ceiling = view.nextScore ?? view.score;
  const span = Math.max(1, ceiling - floor);
  const share = Math.max(0, Math.min(1, (view.score - floor) / span));

  return (
    <main className="main">
      <h1 className="page-title">{t('ranked.title')}</h1>
      <p className="muted">{t('ranked.subtitle')}</p>

      <section className="card">
        <div className="stat-row">
          <span className="stat">
            <span className="muted">{t('ranked.region')}</span>
            <strong>{view.phaseName}</strong>
          </span>
          <span className="stat">
            <span className="muted">{t('ranked.format')}</span>
            <strong>
              {view.teams}×{view.teamSize}
            </strong>
          </span>
          <span className="stat">
            <span className="muted">{t('ranked.tier')}</span>
            <strong>{view.tierName}</strong>
          </span>
          <span className="stat">
            <span className="muted">{t('ranked.score')}</span>
            <strong>{view.score.toLocaleString()}</strong>
          </span>
        </div>

        <div className="progress ranked-bar">
          <span className="progress-fill" style={{ width: `${Math.round(share * 100)}%` }} />
        </div>
        <p className="muted">
          {view.nextScore === null
            ? t('ranked.topTier')
            : `${t('ranked.nextRank')}: ${view.tiers[view.tierIndex + 1]?.name ?? ''} · ${view.nextScore.toLocaleString()}`}
        </p>
        {view.atThreshold && (
          <p className="result-banner result-win">
            <strong>{t('ranked.promotion')}</strong>
          </p>
        )}

        <p className="muted">
          {t('ranked.weather')}: {factionLabel[view.weatherCurrent]} ({t('ranked.weatherNow')}) →{' '}
          {factionLabel[view.weatherNext]} ({t('ranked.weatherNext')}) ·{' '}
          {Math.round(view.weatherDmg * 100)}% {t('ranked.weatherBonus')}
        </p>

        <div className="stat-row">
          <span className="stat">
            <span className="muted">{t('ranked.attempts')}</span>
            <strong>
              {view.attemptsTotal - view.attempts}/{view.attemptsTotal}
            </strong>
          </span>
          <span className="stat">
            <span className="muted">{t('ranked.seasonEnds')}</span>
            <strong>{formatDuration(view.seasonEndsMs)}</strong>
          </span>
        </div>
        <div className="stage-actions">
          <button type="button" className="btn btn-primary" disabled={busy || !view.canChallenge} onClick={() => void onStart()}>
            {t('ranked.start')}
          </button>
          <button type="button" className="btn" disabled={busy} onClick={() => void onBuy()}>
            {t('ranked.buyAttempt')} ({view.attemptPrice.toLocaleString()} {currencyLabel.gems})
          </button>
          <Link className="btn" to="/squad?mode=arenaAttack">
            {t('ranked.lineup')}
          </Link>
        </div>
        {!view.canChallenge && <p className="muted">{t('ranked.noAttempts')}</p>}
        <p className="muted">
          {view.squad.count > 0
            ? `${t('ranked.lineup')}: ${view.squad.count} · ${t('combat.teamPower')} ${view.squad.power.toLocaleString()}`
            : t('ranked.lineupNone')}
        </p>
      </section>

      <section className="card">
        <h2 className="section-title">{t('ranked.stats')}</h2>
        <div className="stat-row">
          <span className="stat">
            <span className="muted">{t('ranked.matches')}</span>
            <strong>{view.matches}</strong>
          </span>
          <span className="stat">
            <span className="muted">{t('ranked.wins')}</span>
            <strong>{view.wins}</strong>
          </span>
          <span className="stat">
            <span className="muted">{t('ranked.losses')}</span>
            <strong>{view.losses}</strong>
          </span>
          <span className="stat">
            <span className="muted">{t('ranked.winRate')}</span>
            <strong>{Math.round(view.winRate * 100)}%</strong>
          </span>
          <span className="stat">
            <span className="muted">{t('ranked.streak')}</span>
            <strong>
              {view.streak} / {view.bestStreak}
            </strong>
          </span>
        </div>
      </section>

      <section className="card">
        <h2 className="section-title">{t('ranked.tiers')}</h2>
        <ul className="plain-list">
          {view.tiers.map((tier) => (
            <li key={tier.index} className="milestone-row">
              <span>
                {tier.name}
                <span className="muted"> · {tier.score.toLocaleString()}</span>
              </span>
              <span className="milestone-rewards muted">{tier.coin.toLocaleString()} {currencyLabel.arenaToken}</span>
              <button
                type="button"
                className="btn"
                disabled={busy || tier.claimed || !tier.reached}
                onClick={() => void onClaimTier(tier.index)}
              >
                {tier.claimed ? t('ranked.claimed') : tier.reached ? t('ranked.claim') : t('ranked.notReached')}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2 className="section-title">{t('ranked.gifts')}</h2>
        <ul className="plain-list">
          {view.gifts.map((gift) => (
            <li key={gift.index} className="milestone-row">
              <span>
                {gift.matches} {t('ranked.matches')}
              </span>
              <span className="milestone-rewards">
                <RewardLine rewards={gift.reward} />
              </span>
              <button
                type="button"
                className="btn"
                disabled={busy || gift.claimed || !gift.reached}
                onClick={() => void onClaimGift(gift.index)}
              >
                {gift.claimed ? t('ranked.claimed') : gift.reached ? t('ranked.claim') : t('ranked.notReached')}
              </button>
            </li>
          ))}
        </ul>
      </section>

      {view.paused && <p className="muted">{t('ranked.paused')}</p>}
    </main>
  );
}

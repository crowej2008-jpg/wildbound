import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { RiftBattleResult, RiftView } from '@wildbound/server';
import BattleReplay from '../components/BattleReplay';
import RewardLine from '../components/RewardLine';
import { formatDuration, t } from '../i18n';
import { useServer } from '../server/ServerProvider';

/** Rift Arena — Rift Barriers (M13.4): the weekly 250-floor climb, lives, chests. */

export default function RiftArena() {
  const { call, claim, busy } = useServer();
  const [view, setView] = useState<RiftView | null>(null);
  const [fought, setFought] = useState<RiftBattleResult | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await call((s) => s.getRift());
    if (res.ok) setView(res.value);
  }, [call]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const challenge = async () => {
    setStatus(null);
    const res = await call((s) => s.challengeRift(), (v) => v.snapshot);
    if (res.ok) setFought(res.value);
  };

  const openChest = async (challenges: number) => {
    setStatus(null);
    const res = await claim((s) => s.claimRiftChest(challenges));
    if (res.ok) setStatus(t('rift.chestClaimed'));
    await refresh();
  };

  if (fought) {
    return (
      <BattleReplay
        view={fought.battle}
        attackerLabel={t('combat.team.attackers')}
        defenderLabel={`${t('rift.floor')} ${fought.floor}`}
        resultExtra={
          <section className={`card result-rewards ${fought.win ? 'result-win' : 'result-lose'}`}>
            <div className="result-banner">
              <strong data-testid="rift-outcome">{fought.win ? t('rift.cleared') : t('rift.failed')}</strong>
            </div>
            {fought.win ? <RewardLine rewards={fought.rewards} /> : null}
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setFought(null);
                void refresh();
              }}
            >
              {t('rift.back')}
            </button>
          </section>
        }
      />
    );
  }

  if (!view) return <p className="muted">…</p>;

  return (
    <div className="page rift-arena">
      <Link className="text-link" to="/explore">
        {t('hoopa.backToExplore')}
      </Link>
      <h1 className="page-title">{t('rift.title')}</h1>

      {!view.unlocked ? (
        <section className="card">
          <p data-testid="rift-locked">{t('rift.locked')}</p>
        </section>
      ) : (
        <>
          <section className="card rift-season">
            <p data-testid="rift-season">
              {view.seasonOpen ? t('rift.seasonEnds') : t('rift.seasonOpens')} {formatDuration(view.countdownMs)}
            </p>
            <p className="muted">
              {t('rift.difficulty')} {view.difficulty} · {t('rift.sync')} {view.syncLevel}
            </p>
          </section>

          <section className="card rift-climb">
            <h2 className="section-title">{t('rift.barriers')}</h2>
            <p>
              {t('rift.highest')} <strong data-testid="rift-highest">{view.highest}</strong> / {view.floors} ·{' '}
              {t('rift.lives')} <strong data-testid="rift-lives">{view.lives}</strong> / {view.livesPerDay}
            </p>
            {view.nextFloor !== null ? (
              <>
                <p>
                  {t('rift.floor')} {view.nextFloor} · {view.track === 'easy' ? t('rift.easy') : t('rift.advanced')}
                  {view.nextIsBoss ? ` · ${t('rift.boss')}` : ''}
                </p>
                <div className="muted">
                  {t('rift.drops')}: <RewardLine rewards={view.nextDrops} />
                </div>
                {view.nextFloorReward && view.track === 'easy' && (
                  <div className="muted">
                    {t('rift.floorReward').replace('{n}', String(view.nextFloorReward.floor))}:{' '}
                    <RewardLine rewards={view.nextFloorReward.rewards} />
                  </div>
                )}
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy || !view.seasonOpen || view.lives <= 0}
                  onClick={() => void challenge()}
                >
                  {t('rift.challenge')}
                </button>
              </>
            ) : (
              <p>{t('rift.allCleared')}</p>
            )}
            <p className="muted">
              {t('currency.timeCoin')}: {view.timeCoins} · {t('currency.timeCredit')}: {view.timeCredits} ·{' '}
              {t('rift.coinsNote').replace('{n}', String(view.coinToGold))}
            </p>
            <p className="muted">{t('rift.rankingLater')}</p>
          </section>

          <section className="card rift-chests">
            <h2 className="section-title">
              {t('rift.chests')} ({view.challenges})
            </h2>
            <ul className="plain-list">
              {view.chests.map((chest) => (
                <li key={chest.challenges} className="milestone-row" data-chest={chest.challenges}>
                  <span>{t('rift.chestAt').replace('{n}', String(chest.challenges))}</span>
                  <RewardLine rewards={chest.rewards} />
                  <button
                    type="button"
                    className="btn"
                    disabled={busy || !chest.claimable}
                    onClick={() => void openChest(chest.challenges)}
                  >
                    {chest.claimed ? t('rift.claimed') : t('rift.claim')}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      {status && <p className="status-box">{status}</p>}
    </div>
  );
}

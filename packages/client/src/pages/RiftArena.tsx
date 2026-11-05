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

  const buy = async (id: string) => {
    setStatus(null);
    const res = await claim((s) => s.buyRiftMerchant(id));
    if (res.ok) setStatus(t('rift.bought'));
    await refresh();
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

          <section className="card rift-milestones">
            <h2 className="section-title">{t('rift.milestones')}</h2>
            <ul className="plain-list">
              {view.milestones.map((m) => (
                <li key={m.floor} className="milestone-row" data-milestone={m.floor}>
                  <span>
                    {t('rift.floor')} {m.floor}
                  </span>
                  <span>
                    <RewardLine rewards={m.rewards} />
                    {m.extra && <span className="muted"> {m.extra}</span>}
                  </span>
                  <span className="muted">{m.reached ? t('rift.reached') : ''}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="card rift-merchant">
            <h2 className="section-title">{t('rift.merchant')}</h2>
            <ul className="shop-list">
              {view.merchant.map((o) => (
                <li key={o.id} className="shop-item" data-offer={o.id}>
                  <div className="shop-item-info">
                    <span className="shop-item-name">{o.name}</span>
                    <RewardLine rewards={o.grants} />
                    {o.extra && <span className="muted">{o.extra}</span>}
                    <span className="muted">
                      {o.price.toLocaleString()} {t(o.currency === 'gems' ? 'currency.gems' : 'currency.timeCoin')} ·{' '}
                      {o.open
                        ? t('rift.left').replace('{n}', String(o.left)).replace('{m}', String(o.limit))
                        : t('rift.opensAt').replace('{n}', String(o.unlockFloor))}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy || !o.open || o.left <= 0 || !o.affordable}
                    onClick={() => void buy(o.id)}
                  >
                    {t('rift.buy')}
                  </button>
                </li>
              ))}
            </ul>
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

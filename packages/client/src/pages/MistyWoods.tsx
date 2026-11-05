import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { MistyStepResultView, MistyView } from '@wildbound/server';
import BattleReplay from '../components/BattleReplay';
import RewardLine from '../components/RewardLine';
import { formatDuration, t } from '../i18n';
import { useServer } from '../server/ServerProvider';

/** Misty Woods (M13.6): a 4-chapter map, HP carried between fights, fountains, tombstones, shop, hires. */

type TileKey =
  | 'misty.tile.fight'
  | 'misty.tile.boss'
  | 'misty.tile.start'
  | 'misty.tile.tombstone'
  | 'misty.tile.fountain'
  | 'misty.tile.hire'
  | 'misty.tile.shop';

export default function MistyWoods() {
  const { call, busy } = useServer();
  const [view, setView] = useState<MistyView | null>(null);
  const [fought, setFought] = useState<MistyStepResultView | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await call((s) => s.getMisty());
    if (res.ok) setView(res.value);
  }, [call]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const step = async (nodeId: number) => {
    setStatus(null);
    const res = await call((s) => s.stepMisty(nodeId), (v) => v.snapshot);
    if (!res.ok) return;
    if (res.value.battle) setFought(res.value);
    else {
      setStatus(t(`misty.resolved.${res.value.tile}` as 'misty.resolved.fountain'));
      await refresh();
    }
  };

  const hireOne = async (speciesId: string) => {
    const res = await call((s) => s.hireMisty(speciesId), (v) => v);
    if (res.ok) setStatus(t('misty.hired'));
    await refresh();
  };

  const shop = async (kind: 'heal' | 'revive') => {
    const res = await call((s) => s.mistyShop(kind), (v) => v);
    if (res.ok) setStatus(t(kind === 'heal' ? 'misty.healed' : 'misty.revived'));
    await refresh();
  };

  if (fought?.battle) {
    return (
      <BattleReplay
        view={fought.battle}
        attackerLabel={t('combat.team.attackers')}
        defenderLabel={t('misty.title')}
        resultExtra={
          <section className={`card result-rewards ${fought.win ? 'result-win' : 'result-lose'}`}>
            <div className="result-banner">
              <strong data-testid="misty-outcome">{fought.win ? t('misty.won') : t('misty.lost')}</strong>
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
              {t('misty.back')}
            </button>
          </section>
        }
      />
    );
  }

  if (!view) return <p className="muted">…</p>;

  return (
    <div className="page misty-woods">
      <Link className="text-link" to="/explore">
        {t('hoopa.backToExplore')}
      </Link>
      <h1 className="page-title">{t('misty.title')}</h1>

      {!view.unlocked ? (
        <section className="card">
          <p data-testid="misty-locked">{t('misty.locked')}</p>
        </section>
      ) : (
        <>
          <section className="card">
            <p data-testid="misty-chapter">
              {t('misty.chapter')} {view.chapter} / 4 · {t('misty.resets')} {formatDuration(view.cycleEndsInMs)}
            </p>
            <p className="muted">
              {t('currency.forestCoin')}: {view.forestCoin.toLocaleString()} · {t('currency.gems')}: {view.gems.toLocaleString()}
              {view.chapter === 4 && view.chapter4Locked ? ` · ${t('misty.ch4Locked')}` : ''}
            </p>
          </section>

          <section className="card misty-team">
            <h2 className="section-title">{t('misty.team')}</h2>
            <ul className="plain-list">
              {view.team.map((u) => (
                <li key={u.id} data-unit={u.id}>
                  {u.name}
                  {u.helper ? ` (${t('misty.helper')})` : ''} —{' '}
                  {u.fallen ? <span className="muted">{t('misty.fallen')}</span> : `${Math.round(u.hp * 100)}% HP`}
                </li>
              ))}
            </ul>
          </section>

          {view.hireOffer && (
            <section className="card misty-hire">
              <h2 className="section-title">{t('misty.hireTitle')}</h2>
              <ul className="plain-list">
                {view.hireOffer.map((h) => (
                  <li key={h.speciesId}>
                    {h.name}{' '}
                    <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void hireOne(h.speciesId)}>
                      {t('misty.hire')}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {view.atShop && (
            <section className="card misty-shop">
              <h2 className="section-title">{t('misty.shopTitle')}</h2>
              <button type="button" className="btn" disabled={busy || view.gems < view.shop.healAll} onClick={() => void shop('heal')}>
                {t('misty.buyHeal').replace('{n}', String(view.shop.healAll))}
              </button>{' '}
              <button
                type="button"
                className="btn"
                disabled={busy || view.gems < view.shop.revive || !view.team.some((u) => u.fallen)}
                onClick={() => void shop('revive')}
              >
                {t('misty.buyRevive').replace('{n}', String(view.shop.revive))}
              </button>
            </section>
          )}

          <section className="card misty-map">
            <h2 className="section-title">{t('misty.map')}</h2>
            <ol className="plain-list misty-floors">
              {view.floors.map((row) => (
                <li key={row.floor} className="misty-floor">
                  <span className="muted">
                    {t('misty.floor')} {row.floor}
                  </span>{' '}
                  {row.nodes.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      className={`btn misty-node ${n.here ? 'btn-primary' : ''}`}
                      data-node={n.id}
                      data-tile={n.tile}
                      disabled={busy || !n.reachable}
                      onClick={() => void step(n.id)}
                    >
                      {t(`misty.tile.${n.tile}` as TileKey)}
                      {n.done ? ' ✓' : ''}
                      {n.forestCoin > 0 ? ` · ${n.forestCoin}` : ''}
                    </button>
                  ))}
                </li>
              ))}
            </ol>
          </section>
        </>
      )}

      {status && (
        <p className="status-box" data-testid="misty-status">
          {status}
        </p>
      )}
    </div>
  );
}

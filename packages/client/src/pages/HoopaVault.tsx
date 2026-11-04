import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Rewards } from '@wildbound/engine';
import type { BattleView, HoopaCardView, HoopaVaultView } from '@wildbound/server';
import BattleReplay from '../components/BattleReplay';
import RewardLine from '../components/RewardLine';
import { t } from '../i18n';
import { useServer } from '../server/ServerProvider';

/** Hoopa's Vault (M13.3): daily keys, a floor and multiplier, route cards, the Exit Guardian. */

type QualityKey = 'hoopa.quality.rare' | 'hoopa.quality.epic' | 'hoopa.quality.legendary' | 'hoopa.quality.supreme' | 'hoopa.quality.mythic';
type OrbKey = 'hoopa.orb.purple' | 'hoopa.orb.orange' | 'hoopa.orb.red';
type CardKey = 'hoopa.card.strong' | 'hoopa.card.normal' | 'hoopa.card.buff' | 'hoopa.card.blessing';

function cardText(card: HoopaCardView): string {
  const parts = [`+${card.escape} ${t('hoopa.escape')}`];
  if (card.enemyMult > 1) parts.push(t('hoopa.card.tougher'));
  if (card.attackBoost > 0) parts.push(`+${Math.round(card.attackBoost * 100)}% ${t('hoopa.card.attack')}`);
  if (card.dropBoost > 0) parts.push(`+${Math.round(card.dropBoost * 100)}% ${t('hoopa.card.drops')}`);
  return parts.join(' · ');
}

interface Fought {
  battle: BattleView;
  win: boolean;
  /** Route: 'caught' / 'lost' end the run. Guardian: always over. */
  ended: 'caught' | 'lost' | 'guardian' | null;
  rewards: Rewards;
  /** Held items / orbs banked or kept by this fight. */
  extra: number;
}

export default function HoopaVault() {
  const { call, claim, busy } = useServer();
  const [view, setView] = useState<HoopaVaultView | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [floor, setFloor] = useState(1);
  const [multiplier, setMultiplier] = useState(1);
  const [fought, setFought] = useState<Fought | null>(null);

  const refresh = useCallback(async () => {
    const res = await call((s) => s.getHoopaVault());
    if (res.ok) {
      setView(res.value);
      setFloor((f) => Math.min(Math.max(1, f), res.value.nextFloor));
      setMultiplier((m) => (m > res.value.maxMultiplier ? 1 : m));
    }
  }, [call]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const claimKeys = async () => {
    setStatus(null);
    const res = await claim((s) => s.claimVaultKeys());
    if (res.ok) setStatus(t('hoopa.keysClaimed'));
    await refresh();
  };

  const enter = async () => {
    setStatus(null);
    await call((s) => s.startVaultRun(floor, multiplier), (v) => v);
    await refresh();
  };

  const exit = async () => {
    const res = await call((s) => s.exitVaultRun(), (v) => v);
    if (res.ok) setStatus(t('hoopa.exited'));
    await refresh();
  };

  const route = async (card: HoopaCardView['card']) => {
    setStatus(null);
    const res = await call((s) => s.fightVaultRoute(card), (v) => v.snapshot);
    if (res.ok)
      setFought({
        battle: res.value.battle,
        win: res.value.win,
        ended: res.value.ended,
        rewards: res.value.drops,
        extra: res.value.items.length + res.value.orbs.length,
      });
  };

  const guardian = async () => {
    setStatus(null);
    const res = await call((s) => s.fightVaultGuardian(), (v) => v.snapshot);
    if (res.ok)
      setFought({
        battle: res.value.battle,
        win: res.value.win,
        ended: 'guardian',
        rewards: res.value.kept,
        extra: res.value.items.length + res.value.orbs.length,
      });
  };

  if (fought) {
    const outcome =
      fought.ended === 'guardian'
        ? fought.win
          ? t('hoopa.result.escaped')
          : t('hoopa.result.guardianLost')
        : fought.ended === 'caught'
          ? t('hoopa.result.caught')
          : fought.ended === 'lost'
            ? t('hoopa.result.lost')
            : t('hoopa.result.routeWon');
    return (
      <BattleReplay
        view={fought.battle}
        attackerLabel={t('combat.team.attackers')}
        defenderLabel={t('hoopa.title')}
        resultExtra={
          <section className={`card result-rewards ${fought.win ? 'result-win' : 'result-lose'}`}>
            <div className="result-banner">
              <strong data-testid="hoopa-outcome">{outcome}</strong>
            </div>
            {fought.win ? <RewardLine rewards={fought.rewards} /> : null}
            {fought.win && fought.extra > 0 ? (
              <p className="muted">{t('hoopa.result.items').replace('{n}', String(fought.extra))}</p>
            ) : null}
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setFought(null);
                void refresh();
              }}
            >
              {t('hoopa.back')}
            </button>
          </section>
        }
      />
    );
  }

  if (!view) return <p className="muted">…</p>;

  const run = view.run;
  return (
    <div className="page hoopa-vault">
      <Link className="text-link" to="/explore">
        {t('hoopa.backToExplore')}
      </Link>
      <h1 className="page-title">{t('hoopa.title')}</h1>

      {!view.unlocked ? (
        <section className="card">
          <p data-testid="hoopa-locked">
            {t('hoopa.locked').replace('{day}', String(view.unlockDay)).replace('{now}', String(view.serverDay))}
          </p>
        </section>
      ) : (
        <>
          <section className="card hoopa-keys">
            <p>
              {t('currency.vaultKey')}: <strong data-testid="hoopa-keys">{view.keys}</strong> · {t('hoopa.highest')}{' '}
              {view.highest} / {view.floors}
            </p>
            <button type="button" className="btn btn-primary" disabled={busy || !view.keysClaimable} onClick={() => void claimKeys()}>
              {view.keysClaimable ? t('hoopa.claimKeys').replace('{n}', String(view.freeKeysPerDay)) : t('hoopa.keysDone')}
            </button>
          </section>

          {!run ? (
            <section className="card hoopa-start">
              <h2 className="section-title">{t('hoopa.start')}</h2>
              <label>
                {t('hoopa.floor')}{' '}
                <input
                  type="number"
                  min={1}
                  max={view.nextFloor}
                  value={floor}
                  onChange={(event) => setFloor(Math.min(view.nextFloor, Math.max(1, Number(event.target.value) || 1)))}
                />
              </label>
              <div className="hoopa-mult" role="group" aria-label={t('hoopa.multiplier')}>
                {[1, 3, 5].map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={`btn ${multiplier === m ? 'btn-primary' : ''}`}
                    disabled={m > view.maxMultiplier}
                    aria-pressed={multiplier === m}
                    onClick={() => setMultiplier(m)}
                  >
                    ×{m}
                  </button>
                ))}
              </div>
              {view.bandNote && <p className="muted">{view.bandNote}</p>}
              <button type="button" className="btn btn-primary" disabled={busy || view.keys < multiplier} onClick={() => void enter()}>
                {t('hoopa.enter').replace('{n}', String(multiplier))}
              </button>
              {view.upcoming.length > 0 && (
                <ul className="plain-list muted">
                  {view.upcoming.map((u) => (
                    <li key={u.floor}>
                      {t('hoopa.floor')} {u.floor}: {u.note}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : (
            <section className="card hoopa-run" data-testid="hoopa-run">
              <h2 className="section-title">
                {t('hoopa.floor')} {run.floor} · ×{run.multiplier}
              </h2>
              <p>
                {t('hoopa.escape')} <strong data-testid="hoopa-escape">{run.escape}</strong> / {run.target} · {t('hoopa.hoopa')}{' '}
                {run.hoopa}
                {!run.atGuardian && ` · ${t('hoopa.roundCap')} ${run.roundCap}`}
              </p>
              <div className="hoopa-bag">
                {t('hoopa.bag')}: <RewardLine rewards={run.bag} />
                {run.items.length + run.orbs.length > 0 && (
                  <ul className="plain-list" data-testid="hoopa-bag-items">
                    {run.items.map((item, i) => (
                      <li key={`i${i}`}>
                        {item.name} <span className="muted">({t(`hoopa.quality.${item.quality}` as QualityKey)})</span>
                      </li>
                    ))}
                    {run.orbs.map((orb, i) => (
                      <li key={`o${i}`}>{t(`hoopa.orb.${orb.colour}` as OrbKey).replace('{n}', String(orb.level))}</li>
                    ))}
                  </ul>
                )}
              </div>
              {run.atGuardian ? (
                <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void guardian()}>
                  {t('hoopa.guardian').replace('{n}', String(run.guardianRounds))}
                </button>
              ) : (
                <ul className="hoopa-cards plain-list">
                  {run.offer.map((card) => (
                    <li key={card.card} data-card={card.card}>
                      <strong>{t(`hoopa.card.${card.card}` as CardKey)}</strong> <span className="muted">{cardText(card)}</span>{' '}
                      <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void route(card.card)}>
                        {t('hoopa.go')}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <button type="button" className="btn" disabled={busy} onClick={() => void exit()}>
                {t('hoopa.exit')}
              </button>
            </section>
          )}
        </>
      )}

      {status && (
        <p className="status-box" data-testid="hoopa-status">
          {status}
        </p>
      )}
    </div>
  );
}

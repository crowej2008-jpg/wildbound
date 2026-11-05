import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { BerryGroveView, GroveFightResult } from '@wildbound/server';
import BattleReplay from '../components/BattleReplay';
import RewardLine from '../components/RewardLine';
import { formatDuration, t } from '../i18n';
import { useServer } from '../server/ServerProvider';

/** Berry Grove (M13.8): plant seeds, harvest berries; Grove Guardians and the daily Grove Boss pay seeds and materials. */

type SeedKey = 'grove.seed.common' | 'grove.seed.basic' | 'grove.seed.intermediate' | 'grove.seed.greater';
type MaterialKey =
  | 'currency.berryEssence'
  | 'currency.berryMulchBlue'
  | 'currency.berryMulchPurple'
  | 'currency.berryMulchOrange'
  | 'currency.berryMulchRed'
  | 'currency.reforgePotion';

export default function BerryGrove() {
  const { call, busy } = useServer();
  const [view, setView] = useState<BerryGroveView | null>(null);
  const [fight, setFight] = useState<(GroveFightResult & { kind: 'guardian' | 'boss' }) | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [seed, setSeed] = useState<string>('common');

  const refresh = useCallback(async () => {
    const res = await call((s) => s.getBerryGrove());
    if (res.ok) setView(res.value);
  }, [call]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const plant = async (plot: number) => {
    setStatus(null);
    const res = await call((s) => s.plantGrove(plot, seed), (v) => v);
    if (res.ok) setStatus(t('grove.planted'));
    await refresh();
  };

  const harvest = async (plot?: number) => {
    setStatus(null);
    const res = await call((s) => s.harvestGrove(plot), (v) => v.snapshot);
    if (res.ok) setStatus(t('grove.harvested').replace('{n}', String(res.value.berries.length)));
    await refresh();
  };

  const guardian = async () => {
    setStatus(null);
    const res = await call((s) => s.challengeGroveGuardian(), (v) => v.snapshot);
    if (res.ok) setFight({ ...res.value, kind: 'guardian' });
  };

  const boss = async () => {
    setStatus(null);
    const res = await call((s) => s.fightGroveBoss(), (v) => v.snapshot);
    if (res.ok) setFight({ ...res.value, kind: 'boss' });
  };

  if (fight) {
    const done = fight.kind === 'boss' || fight.win;
    return (
      <BattleReplay
        view={fight.battle}
        attackerLabel={t('combat.team.attackers')}
        defenderLabel={fight.kind === 'boss' ? t('grove.boss') : `${t('grove.guardians')} ${fight.stage}`}
        resultExtra={
          <section className={`card result-rewards ${done ? 'result-win' : 'result-lose'}`}>
            <div className="result-banner">
              <strong data-testid="grove-outcome">
                {fight.kind === 'boss'
                  ? t('grove.bossDone').replace('{p}', String(Math.round((fight.share ?? 0) * 100)))
                  : fight.win
                    ? t('grove.guardianWon')
                    : t('grove.guardianLost')}
              </strong>
            </div>
            {Object.keys(fight.rewards).length > 0 ? <RewardLine rewards={fight.rewards} /> : null}
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setFight(null);
                void refresh();
              }}
            >
              {t('grove.back')}
            </button>
          </section>
        }
      />
    );
  }

  if (!view) return <p className="muted">…</p>;
  const anyRipe = view.plots.some((p) => p.seed && p.ripeInMs === 0);

  return (
    <div className="page berry-grove">
      <Link className="text-link" to="/explore">
        {t('hoopa.backToExplore')}
      </Link>
      <h1 className="page-title">{t('grove.title')}</h1>

      {!view.unlocked ? (
        <section className="card">
          <p data-testid="grove-locked">{t('grove.locked')}</p>
        </section>
      ) : (
        <>
          <section className="card">
            <p className="muted" data-testid="grove-materials">
              {(Object.entries(view.materials) as [string, number][])
                .map(([k, v]) => `${t(`currency.${k}` as MaterialKey)}: ${v.toLocaleString()}`)
                .join(' · ')}
            </p>
            <p className="muted">
              {t('grove.resets')} {formatDuration(view.resetsInMs)} ·{' '}
              <Link className="text-link" to="/squad?mode=berryGrove">
                {t('grove.editTeam')}
              </Link>
            </p>
          </section>

          <section className="card grove-garden">
            <h2 className="section-title">{t('grove.garden')}</h2>
            <p>
              {t('grove.seedPick')}{' '}
              {view.seeds.map((s) => (
                <button
                  key={s.tier}
                  type="button"
                  className={`btn ${seed === s.tier ? 'btn-primary' : ''}`}
                  data-seed={s.tier}
                  onClick={() => setSeed(s.tier)}
                >
                  {t(`grove.seed.${s.tier}` as SeedKey)} ×{s.have} ({s.growHours}h)
                </button>
              ))}
            </p>
            <ul className="plain-list grove-plots">
              {view.plots.map((p) => (
                <li key={p.index} className="grove-plot" data-plot={p.index}>
                  {t('grove.plot')} {p.index + 1}:{' '}
                  {p.seed === null ? (
                    <button
                      type="button"
                      className="btn"
                      disabled={busy || (view.seeds.find((s) => s.tier === seed)?.have ?? 0) < 1}
                      onClick={() => void plant(p.index)}
                    >
                      {t('grove.plant')}
                    </button>
                  ) : p.ripeInMs === 0 ? (
                    <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void harvest(p.index)}>
                      {t('grove.harvest')} ({t(`grove.seed.${p.seed}` as SeedKey)})
                    </button>
                  ) : (
                    <span className="muted">
                      {t(`grove.seed.${p.seed}` as SeedKey)} — {t('grove.ripeIn')} {formatDuration(p.ripeInMs ?? 0)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <button type="button" className="btn" disabled={busy || !anyRipe} onClick={() => void harvest()}>
              {t('grove.harvestAll')}
            </button>
          </section>

          <section className="card grove-guardians">
            <h2 className="section-title">{t('grove.guardians')}</h2>
            <p data-testid="grove-stage">
              {t('grove.stage')} {view.guardians.stage} / {view.guardians.stages} · {t('grove.winsToday')} {view.guardians.winsToday} /{' '}
              {view.guardians.winsPerDay}
            </p>
            {view.guardians.block === null ? (
              <p className="muted">
                {t('grove.firstClear')} <RewardLine rewards={view.guardians.nextReward} />
              </p>
            ) : (
              <p className="muted">{view.guardians.block === 'top' ? t('grove.allBeaten') : t('grove.doneToday')}</p>
            )}
            <button type="button" className="btn btn-primary" data-testid="grove-guardian" disabled={busy || view.guardians.block !== null} onClick={() => void guardian()}>
              {t('grove.challenge')}
            </button>
          </section>

          <section className="card grove-boss">
            <h2 className="section-title">{t('grove.boss')}</h2>
            <p>
              {view.boss.name} · Lv {view.boss.level} · {t('grove.fightsLeft')} {view.boss.fightsLeft} / {view.boss.fightsPerDay} · {t('grove.best')}{' '}
              {Math.round(view.boss.bestShare * 100)}%
            </p>
            <p className="muted">
              {t('grove.fullPay')} <RewardLine rewards={view.boss.fullPay} />
            </p>
            <button type="button" className="btn btn-primary" data-testid="grove-boss" disabled={busy || view.boss.fightsLeft <= 0} onClick={() => void boss()}>
              {t('grove.fightBoss')}
            </button>
          </section>
        </>
      )}

      {status && (
        <p className="status-box" data-testid="grove-status">
          {status}
        </p>
      )}
    </div>
  );
}

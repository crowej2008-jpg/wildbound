import { useEffect, useMemo, useState } from 'react';
import { ECONOMY, STAGES } from '@wildbound/content';
import {
  accruedMinutes,
  bestIdleStage,
  isZeroRewards,
  orderStages,
  pendingIdle,
  type Rewards,
  type StageDef,
} from '@wildbound/engine';
import RewardLine from '../components/RewardLine';
import { currencyLabel, t } from '../i18n';
import { useServer } from '../server/ServerProvider';

const ORDERED = orderStages(STAGES as StageDef[]);
const CAP_MINUTES = Math.round(ECONOMY.idle.capHours * 60);

/** Idle income screen (M5, PROMPT §7.4): accrued rewards, claim, quick-collect. */
export default function Idle() {
  const { snapshot, claim, busy } = useServer();
  const [, setTick] = useState(0);
  const [granted, setGranted] = useState<Rewards | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const state = snapshot?.state;
  const offset = state?.debugClockOffset ?? 0;
  const now = Date.now() + offset * 60_000;
  const rate = useMemo(() => (state ? bestIdleStage(state.campaign, ORDERED)?.idlePerMinute ?? {} : {}), [state]);
  const lastClaimAt = state?.idle.lastClaimAt ?? now;
  const pending = state ? pendingIdle(rate, lastClaimAt, now, CAP_MINUTES) : {};
  const accrued = accruedMinutes(lastClaimAt, now, CAP_MINUTES);
  const day = new Date(now).toISOString().slice(0, 10);
  const quickLeft =
    state && state.idle.quickClaimDay === day
      ? Math.max(0, ECONOMY.idle.quickCollectDailyLimit - state.idle.quickClaims)
      : ECONOMY.idle.quickCollectDailyLimit;

  const onClaim = async (quick: boolean) => {
    setGranted(null);
    const result = await claim((s) => s.claimIdle(quick));
    if (result.ok) setGranted(result.value.granted);
  };

  return (
    <main className="main">
      <h1 className="page-title">{t('idle.title')}</h1>
      <p className="muted">{t('idle.subtitle')}</p>

      <section className="card">
        <h2 className="section-title">{t('idle.accruing')}</h2>
        {state?.idle.bestStageId ? (
          <>
            <p className="muted">
              {t('idle.from')} {ORDERED.find((s) => s.id === state.idle.bestStageId)?.name ?? state.idle.bestStageId}
            </p>
            <div className="idle-bar">
              <div className="idle-bar-fill" style={{ width: `${Math.min(100, (accrued / CAP_MINUTES) * 100)}%` }} />
            </div>
            <p className="muted">
              {accrued} / {CAP_MINUTES} {t('idle.minutes')}
            </p>
            <RewardLine rewards={pending} />
          </>
        ) : (
          <p className="muted">{t('idle.locked')}</p>
        )}
      </section>

      <section className="card">
        <div className="row-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || isZeroRewards(pending)}
            onClick={() => void onClaim(false)}
          >
            {t('idle.claim')}
          </button>
          <button
            type="button"
            className="btn"
            disabled={busy || quickLeft <= 0 || (state?.currencies.gems ?? 0) < ECONOMY.idle.quickCollectGems}
            onClick={() => void onClaim(true)}
          >
            {t('idle.quick')} · {ECONOMY.idle.quickCollectGems} {currencyLabel.gems}
          </button>
        </div>
        <p className="muted">
          {t('idle.quickLeft')}: {quickLeft} / {ECONOMY.idle.quickCollectDailyLimit}
        </p>
        {granted && <RewardLine rewards={granted} />}
      </section>
    </main>
  );
}

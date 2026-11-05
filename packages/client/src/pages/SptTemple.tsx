import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { BattleView, TempleView } from '@wildbound/server';
import BattleReplay from '../components/BattleReplay';
import { t } from '../i18n';
import { useServer } from '../server/ServerProvider';

/** M18.1 SPT Temple: six thrones; take one by beating its evolved guardian, then train it to keep it. */
export default function SptTemple() {
  const { call, busy } = useServer();
  const [view, setView] = useState<TempleView | null>(null);
  const [step, setStep] = useState(1);
  const [fight, setFight] = useState<{ battle: BattleView; text: string } | null>(null);
  const refresh = useCallback(async () => {
    const r = await call((s) => s.getTemple());
    if (r.ok) setView(r.value);
  }, [call]);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (fight)
    return (
      <BattleReplay
        view={fight.battle}
        attackerLabel={t('combat.team.attackers')}
        defenderLabel={t('pvp.temple')}
        resultExtra={
          <section className="card result-rewards">
            <strong data-testid="temple-outcome">{fight.text}</strong>
            <button type="button" className="btn btn-primary" onClick={() => { setFight(null); void refresh(); }}>
              {t('joint.back')}
            </button>
          </section>
        }
      />
    );
  if (!view) return <p className="muted">…</p>;
  if (!view.unlocked)
    return (
      <div className="page temple">
        <h1 className="page-title">{t('pvp.temple')}</h1>
        <p className="muted" data-testid="temple-locked">{t('temple.locked')}</p>
      </div>
    );
  const go = async (seatId: string) => {
    const r = await call((s) => s.challengeSeat(seatId, step), (v) => v.snapshot);
    if (r.ok) setFight({ battle: r.value.battle, text: r.value.took ? t('temple.took') : r.value.win ? t('temple.trained') : t('temple.failed') });
    else await refresh();
  };
  return (
    <div className="page temple">
      <Link className="text-link" to="/pvp">{t('nav.pvp')}</Link>
      <h1 className="page-title">{t('pvp.temple')}</h1>
      <p className="muted" data-testid="temple-summary">
        {t('temple.place').replace('{p}', String(view.place))}
        {view.cooldownMin > 0 ? ` · ${t('temple.cooldown').replace('{m}', String(view.cooldownMin))}` : ''}
      </p>
      {view.lost && <p className="status-box">{t('temple.lost').replace('{s}', view.lost)}</p>}
      <Link className="text-link" to="/squad?mode=temple">{t('temple.team')}</Link>
      <p>
        {t('temple.step')}{' '}
        <select aria-label={t('temple.step')} value={step} onChange={(e) => setStep(Number(e.target.value))}>
          {view.steps.map((n) => (
            <option key={n} value={n}>
              +{n}
            </option>
          ))}
        </select>
      </p>
      <ul className="plain-list" data-testid="temple-seats">
        {view.seats.map((s) => (
          <li key={s.id} className="card">
            <strong>{s.name}</strong> — {s.you ? t('temple.yours') : t('temple.cpu')} · {t('temple.evolution')} {s.evolution} · {t('temple.needs').replace('{n}', String(s.arenaTop))}
            {s.nextChallenge !== null && <span className="muted"> · {t('temple.nextChallenge').replace('{n}', String(s.nextChallenge))}</span>}{' '}
            <button type="button" className="btn btn-primary" disabled={busy || !s.eligible || view.cooldownMin > 0} onClick={() => void go(s.id)}>
              {s.you ? t('temple.train') : t('temple.challenge')}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

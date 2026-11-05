import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { BattleView, ClashView } from '@wildbound/server';
import BattleReplay from '../components/BattleReplay';
import { t } from '../i18n';
import { useServer } from '../server/ServerProvider';

const DAYS = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** M18.2 Cross-Server Clash: tryouts, the Sunday final and predictions. */
export default function Clash() {
  const { call, busy } = useServer();
  const [view, setView] = useState<ClashView | null>(null);
  const [stake, setStake] = useState(500);
  const [fight, setFight] = useState<{ battle: BattleView; text: string } | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    const r = await call((s) => s.getClash());
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
        defenderLabel={t('pvp.clash')}
        resultExtra={
          <section className="card result-rewards">
            <strong data-testid="clash-outcome">{fight.text}</strong>
            <button type="button" className="btn btn-primary" onClick={() => { setFight(null); void refresh(); }}>
              {t('joint.back')}
            </button>
          </section>
        }
      />
    );
  if (!view) return <p className="muted">…</p>;
  if (!view.open)
    return (
      <div className="page clash">
        <h1 className="page-title">{t('pvp.clash')}</h1>
        <p className="muted" data-testid="clash-locked">{t('clash.locked')}</p>
      </div>
    );
  const play = async () => {
    const r = await call((s) => s.playClashRound(), (v) => v.snapshot);
    if (r.ok) setFight({ battle: r.value.battle, text: r.value.win ? t('clash.won') : t('clash.lost') });
    else await refresh();
  };
  const simple = async (p: Promise<{ ok: boolean }>, msg: string) => {
    const r = await p;
    if (r.ok) setStatus(msg);
    await refresh();
  };
  const d = view.today;
  return (
    <div className="page clash">
      <Link className="text-link" to="/pvp">{t('nav.pvp')}</Link>
      <h1 className="page-title">{t('pvp.clash')}</h1>
      <p className="muted" data-testid="clash-summary">
        {t('clash.day').replace('{d}', DAYS[view.weekday] ?? '')} · {view.format} · {t('clash.place').replace('{p}', String(view.arenaPlace))} · {t('clash.sunday').replace('{q}', view.sundayQualified ? t('clash.yes') : t('clash.no'))}
      </p>
      {view.qualified === false && <p className="status-box">{t('clash.notQualified')}</p>}
      <Link className="text-link" to="/squad?mode=clash">{t('clash.team')}</Link>
      {view.rounds.length === 0 ? (
        <p className="muted" data-testid="clash-no-cup">{t('clash.noCup')}</p>
      ) : (
        <>
          <section className="card">
            {d?.out ? (
              <p>{t('clash.out')}</p>
            ) : d?.champion ? (
              <p>{t('clash.champion')}</p>
            ) : (
              <button type="button" className="btn btn-primary" disabled={busy || view.qualified === false} onClick={() => void play()}>
                {t('clash.play')}
              </button>
            )}
            {d && d.contest > 0 && <p className="muted">{t('clash.score')}: {d.score} ({d.contest}/3)</p>}
          </section>
          <ul className="plain-list" data-testid="clash-rounds">
            {view.rounds.map((r) => (
              <li key={r.step} className="card">
                <strong>{r.kind === 'score' ? t('clash.score') : r.thirdPlace ? t('clash.third') : `${t('clash.knockout')} ${r.step - (view.weekday === 7 ? 0 : 1)}`}</strong> — {r.started ? '✓' : t('clash.opensAt').replace('{t}', r.time)}
                {d?.won.includes(r.step) ? ' · ★' : ''}
                {r.featured && (
                  <p className="muted">
                    {r.featured.players.map((p, i) => (
                      <button key={p.name} type="button" className="btn" disabled={busy || r.started || (!!r.featured!.bet && r.featured!.bet.pick !== i) || view.coins < stake} onClick={() => void simple(call((s) => s.placeClashBet(r.step, i as 0 | 1, stake), (v) => v), t('events.bought'))}>
                        {t('clash.bet').replace('{n}', `${p.name} (${(p.power / 1e6).toFixed(1)}M)`).replace('{s}', String(stake))}
                        {r.featured!.winner === i ? ' ✓' : ''}
                      </button>
                    ))}
                    {r.featured.bet ? ` · ${r.featured.bet.stake}` : ''}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      <section className="card">
        <p data-testid="clash-coins">
          {t('currency.predictionCoin')} {view.coins}{' '}
          <select aria-label="stake" value={stake} onChange={(e) => setStake(Number(e.target.value))}>
            {[100, 500, 1000, 2000, 4000].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </p>
        <button type="button" className="btn" disabled={busy || !view.coinsClaimable} onClick={() => void simple(call((s) => s.claimGuessCoins(), (v) => v.snapshot), t('events.claimed'))}>
          {t('clash.claimCoins')}
        </button>{' '}
        <button type="button" className="btn" disabled={busy} onClick={() => void simple(call((s) => s.claimClashBets(), (v) => v.snapshot), t('events.claimed'))}>
          {t('clash.claimBets')}
        </button>
      </section>
      {status && <p className="status-box">{status}</p>}
    </div>
  );
}

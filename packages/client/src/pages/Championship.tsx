import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { BattleView, ChampionshipView } from '@wildbound/server';
import BattleReplay from '../components/BattleReplay';
import { t } from '../i18n';
import { useServer } from '../server/ServerProvider';

const DAYS = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** M18.3 World Championship (floor ladders + Master Ball knockout) and the League Championship. */
export default function Championship() {
  const { call, busy } = useServer();
  const [view, setView] = useState<ChampionshipView | null>(null);
  const [fight, setFight] = useState<{ battle: BattleView; text: string } | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    const r = await call((s) => s.getChampionship());
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
        defenderLabel={t('pvp.championship')}
        resultExtra={
          <section className="card result-rewards">
            <strong data-testid="champ-outcome">{fight.text}</strong>
            <button type="button" className="btn btn-primary" onClick={() => { setFight(null); void refresh(); }}>
              {t('joint.back')}
            </button>
          </section>
        }
      />
    );
  if (!view) return <p className="muted">…</p>;
  const w = view.world;
  const L = view.league;
  const climb = async (stage: number) => {
    const r = await call((s) => s.climbWorldFloor(stage), (v) => v.snapshot);
    if (r.ok) setFight({ battle: r.value.battle, text: r.value.win ? t('champ.won') : t('champ.lost') });
    else await refresh();
  };
  const ko = async () => {
    const r = await call((s) => s.playWorldKnockout(), (v) => v.snapshot);
    if (r.ok) setFight({ battle: r.value.battle, text: r.value.win ? t('champ.won') : t('champ.lost') });
    else await refresh();
  };
  const simple = async (p: Promise<{ ok: boolean }>, msg: string) => {
    const r = await p;
    if (r.ok) setStatus(msg);
    await refresh();
  };
  return (
    <div className="page championship">
      <Link className="text-link" to="/pvp">{t('nav.pvp')}</Link>
      <h1 className="page-title">{t('pvp.championship')}</h1>
      <Link className="text-link" to="/squad?mode=championship">{t('champ.team')}</Link>

      <section className="card" data-testid="champ-world">
        <h2>{t('champ.world')}</h2>
        <p className="muted" data-testid="champ-world-summary">
          {w.playWeek ? t('champ.playWeek') : t('champ.rewardWeek')} · {t('champ.league').replace('{g}', String(w.group))} · {t('champ.rank').replace('{r}', String(w.rank)).replace('{n}', String(w.field))}
        </p>
        <ul className="plain-list">
          {w.tiers.map((tier) => (
            <li key={tier.stage}>
              <strong>{tier.name}</strong> — {tier.cleared} / {tier.total} ·{' '}
              {tier.next ? t('champ.floor').replace('{f}', String(tier.next.floor)).replace('{l}', String(tier.next.level)) : t('champ.done')}{' '}
              <button type="button" className="btn" disabled={busy || !tier.open || !tier.next} onClick={() => void climb(tier.stage)}>
                {tier.open ? t('champ.climb') : t('champ.closed')}
              </button>
            </li>
          ))}
        </ul>
        <h3>{t('champ.knockout')}</h3>
        {w.knockout.place !== null ? (
          <p>{t('champ.place').replace('{p}', String(w.knockout.place))}</p>
        ) : w.knockout.eligible ? (
          <p>
            {w.knockout.nextAt ? t('champ.koNext').replace('{t}', w.knockout.nextAt) : ''}{' '}
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void ko()}>
              {t('champ.koPlay')}
            </button>
          </p>
        ) : (
          <p className="muted">{t('champ.notTop8')}</p>
        )}
        {w.claimable && (
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void simple(call((s) => s.claimWorldReward(), (v) => v.snapshot), t('events.claimed'))}>
            {t('champ.claim')}
          </button>
        )}
      </section>

      <section className="card" data-testid="champ-league">
        <h2>{t('champ.leagueTitle')}</h2>
        {!L.open ? (
          <p className="muted">{t('champ.leagueLocked')}</p>
        ) : (
          <>
            {L.qualified === false && <p className="muted">{t('champ.leagueNotIn')}</p>}
            <ul className="plain-list">
              {L.days.map((d) => (
                <li key={d.weekday}>
                  {DAYS[d.weekday]} · {t(`champ.leagueDay.${d.kind}` as 'champ.leagueDay.ko')} — {d.done ? `${d.wins}W ${d.losses}L ${d.passed ? '✓' : '✗'}` : '—'}
                </li>
              ))}
            </ul>
            {L.place !== null && <p>{t('champ.place').replace('{p}', String(L.place))}</p>}
            <button type="button" className="btn btn-primary" disabled={busy || L.place !== null} onClick={() => void call((s) => s.playLeagueDay(), (v) => v.snapshot).then((r) => { if (r.ok) setStatus(r.value.passed ? t('champ.won') : t('champ.lost')); void refresh(); })}>
              {t('champ.playDay')}
            </button>{' '}
            {L.claimable && (
              <button type="button" className="btn" disabled={busy} onClick={() => void simple(call((s) => s.claimLeagueReward(), (v) => v.snapshot), t('events.claimed'))}>
                {t('champ.claim')}
              </button>
            )}
          </>
        )}
      </section>
      {status && <p className="status-box">{status}</p>}
    </div>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { BattleView, RelicBattlefieldView } from '@wildbound/server';
import BattleReplay from '../components/BattleReplay';
import { t } from '../i18n';
import { useServer } from '../server/ServerProvider';

const TYPE_ICON: Record<number, string> = { 1: '·', 2: '◆', 3: '★', 4: '▩', 5: '♜' };

/** M17 Relic Battlefield: take grids from three CPU guilds on the source map. */
export default function RelicBattlefield() {
  const { call, busy } = useServer();
  const [view, setView] = useState<RelicBattlefieldView | null>(null);
  const [fight, setFight] = useState<{ battle: BattleView; text: string } | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    const r = await call((s) => s.getRelic());
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
        defenderLabel={t('relic.title')}
        resultExtra={
          <section className="card result-rewards">
            <strong data-testid="relic-outcome">{fight.text}</strong>
            <button type="button" className="btn btn-primary" onClick={() => { setFight(null); void refresh(); }}>
              {t('joint.back')}
            </button>
          </section>
        }
      />
    );
  if (!view) return <p className="muted">…</p>;
  if (!view.joined)
    return (
      <div className="page relic">
        <h1 className="page-title">{t('relic.title')}</h1>
        <p className="muted" data-testid="relic-locked">{t('gw.needGuild')}</p>
        <Link className="btn" to="/guild">{t('home.link.guild')}</Link>
      </div>
    );
  const attack = async (index: number) => {
    const r = await call((s) => s.attackGrid(index), (v) => v.snapshot);
    if (r.ok) setFight({ battle: r.value.battle, text: r.value.captured ? t('relic.captured') : r.value.win ? t('relic.won') : t('relic.lost') });
    else await refresh();
  };
  const explore = async () => {
    const r = await call((s) => s.exploreRelic(), (v) => v.snapshot);
    if (r.ok) setStatus(t(`relic.event.${r.value.event.type}` as 'relic.event.3').replace('{n}', String(r.value.event.value)));
    await refresh();
  };
  const rows = [...new Set(view.grids.map((g) => Math.floor((g.index - 1) / 10)))];
  return (
    <div className="page relic">
      <Link className="text-link" to="/guild">{t('home.link.guild')}</Link>
      <h1 className="page-title">{t('relic.title')}</h1>
      <p className="muted" data-testid="relic-summary">
        {view.open ? t('relic.day').replace('{d}', String(view.day)) : t('relic.closed')} · {t('relic.stamina')} {view.stamina} / {view.staminaMax} · {t('relic.condition')} {view.condition}% · {t('relic.score')} {view.score}
      </p>
      <Link className="text-link" to="/squad?mode=relic">{t('relic.team')}</Link>{' '}
      <button type="button" className="btn" disabled={busy || !view.open || view.exploreReadyIn > 0} onClick={() => void explore()}>
        {t('relic.explore')}
        {view.exploreReadyIn > 0 ? ` (${view.exploreReadyIn}s)` : ''}
      </button>
      <section className="card">
        <h2>{t('relic.standings')}</h2>
        <ol data-testid="relic-standings">
          {view.standings.map((s) => (
            <li key={s.name}>
              {s.you ? <strong>{s.name}</strong> : s.name} — {s.score}
            </li>
          ))}
        </ol>
      </section>
      <section className="card relic-map" data-testid="relic-map">
        {rows.map((r) => (
          <div key={r} className="chip-row">
            {view.grids
              .filter((g) => Math.floor((g.index - 1) / 10) === r)
              .map((g) => (
                <button
                  key={g.index}
                  type="button"
                  className={`btn relic-grid ${g.owner === 'you' ? 'btn-primary' : ''}`}
                  title={`#${g.index} · ${g.owner} · ${g.score}/30 min${g.progress ? ` · ${g.progress}/${g.needed}` : ''}`}
                  disabled={busy || !g.attackable}
                  onClick={() => void attack(g.index)}
                >
                  {TYPE_ICON[g.type]}
                  {g.index}
                </button>
              ))}
          </div>
        ))}
        <p className="muted">{t('relic.legend')}</p>
      </section>
      <section className="card">
        <h2>{t('relic.tasks')}</h2>
        <ul className="plain-list">
          {view.tasks.map((x) => (
            <li key={x.id}>
              {t(`relic.task.${x.event}` as 'relic.task.1').replace('{n}', String(x.target))} — {Math.min(x.progress, x.target)} / {x.target}{' '}
              <button type="button" className="btn" disabled={busy || x.claimed || x.progress < x.target} onClick={() => void call((s) => s.claimRelicTask(x.id), (v) => v.snapshot).then(() => refresh())}>
                {x.claimed ? '✓' : t('events.claim')}
              </button>
            </li>
          ))}
        </ul>
      </section>
      {view.lastWeek && !view.lastWeek.claimed && (
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void call((s) => s.claimRelicSeason(), (v) => v.snapshot).then(() => refresh())}>
          {t('relic.claimSeason').replace('{p}', String(view.lastWeek.place))}
        </button>
      )}
      {status && <p className="status-box" data-testid="relic-status">{status}</p>}
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { lastActor, lastTarget, replayTo, type BattleEvent } from '@wildbound/engine';
import type { BattleView } from '@wildbound/server';
import BattleField, { type BattlePopup } from '../components/BattleField';
import ResultPanel from '../components/ResultPanel';
import { describeEvent } from '../combat/events';
import { t } from '../i18n';
import { useServer } from '../server/ServerProvider';

const SPEEDS = [1, 2, 4] as const;
const BASE_DELAY = 550;

function popupFor(event: BattleEvent | undefined): BattlePopup | null {
  if (!event) return null;
  switch (event.type) {
    case 'hit':
      return {
        key: event.tgt,
        text: event.missed ? t('combat.missed') : `−${event.dmg}`,
        kind: event.missed ? 'miss' : event.crit ? 'crit' : event.blocked ? 'block' : 'hit',
      };
    case 'reflect':
      return { key: event.tgt, text: `−${event.dmg}`, kind: 'hit' };
    case 'heal':
      return { key: event.tgt, text: `+${event.amount}`, kind: 'heal' };
    case 'shield':
      return { key: event.tgt, text: `+${event.amount}`, kind: 'shield' };
    default:
      return null;
  }
}

/** Battle screen: replays a recorded log (M4). See docs/design/battle-ui.md. */
export default function Combat() {
  const { startBattle, busy } = useServer();
  const [view, setView] = useState<BattleView | null>(null);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(1);

  useEffect(() => {
    let cancelled = false;
    void startBattle('campaign').then((result) => {
      if (!cancelled && result.ok) setView(result.value);
    });
    return () => {
      cancelled = true;
    };
  }, [startBattle]);

  const events = view?.events ?? [];
  const units = view?.units ?? [];
  const seeds = useMemo(() => new Map(units.map((u) => [u.key, u])), [units]);
  const state = useMemo(() => replayTo(units, events, index), [units, events, index]);
  const finalState = useMemo(() => replayTo(units, events, events.length), [units, events]);
  const nameOf = useCallback((key: string) => seeds.get(key)?.name ?? key, [seeds]);

  const current = index > 0 ? events[index - 1] : undefined;
  const popup = useMemo(() => popupFor(current), [current]);
  const actorKey = lastActor(events, index - 1);
  const targetKey = lastTarget(events, index - 1);
  const done = view !== null && index >= events.length;

  useEffect(() => {
    if (!view || !playing) return;
    if (index >= view.events.length) {
      setPlaying(false);
      return;
    }
    const id = window.setTimeout(() => setIndex((i) => Math.min(i + 1, view.events.length)), BASE_DELAY / speed);
    return () => window.clearTimeout(id);
  }, [view, playing, index, speed]);

  const restart = () => {
    setPlaying(false);
    setIndex(0);
  };
  const cycleSpeed = () => setSpeed((s) => SPEEDS[(SPEEDS.indexOf(s as (typeof SPEEDS)[number]) + 1) % SPEEDS.length] ?? 1);

  if (!view) {
    return (
      <main className="main">
        <h1 className="page-title">{t('combat.title')}</h1>
        <p className="muted">{busy ? t('combat.loading') : t('combat.empty')}</p>
      </main>
    );
  }

  const round = state.round;
  const maxRounds = events.filter((e) => e.type === 'roundStart').length;

  return (
    <main className="main">
      <Link className="text-link" to="/squad">← {t('squad.title')}</Link>
      <div className="page-head">
        <h1 className="page-title">{t('combat.title')}</h1>
        <span className="muted">
          {t('combat.round')} {Math.max(1, round)} / {Math.max(maxRounds, 1)}
        </span>
      </div>
      <p className="muted">{t('combat.subtitle')}</p>

      <div className="battle-teams">
        <span className="muted">{t('combat.team.defenders')}</span>
        <span className="muted">
          {t('combat.teamPower')} {view.teams.defenders.power.toLocaleString()}
        </span>
      </div>
      <BattleField state={state} seeds={seeds} actorKey={actorKey} targetKey={targetKey} popup={popup} popupIndex={index} />
      <div className="battle-teams">
        <span className="muted">{t('combat.team.attackers')}</span>
        <span className="muted">
          {t('combat.teamPower')} {view.teams.attackers.power.toLocaleString()}
        </span>
      </div>

      <div className="battle-controls">
        <button type="button" className="btn" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0} aria-label={t('combat.stepBack')}>
          ◀◀
        </button>
        <button type="button" className="btn btn-primary" onClick={() => setPlaying((p) => !p)} disabled={done}>
          {playing ? t('combat.pause') : t('combat.play')}
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => {
            setPlaying(false);
            setIndex((i) => Math.min(i + 1, events.length));
          }}
          disabled={done}
          aria-label={t('combat.stepForward')}
        >
          ▶▶
        </button>
        <button type="button" className="btn" onClick={cycleSpeed}>
          {t('combat.speed')} {speed}×
        </button>
        <button type="button" className="btn" onClick={restart}>
          {t('combat.restart')}
        </button>
        <button type="button" className="btn" onClick={() => { setPlaying(false); setIndex(events.length); }} disabled={done}>
          {t('combat.skip')}
        </button>
      </div>

      {done && <ResultPanel view={view} finalState={finalState} />}

      <details className="card battle-log">
        <summary>{t('combat.log')}</summary>
        <ol>
          {events.map((e, i) => (
            <li key={i} className={i === index - 1 ? 'log-current' : undefined}>
              {describeEvent(e, nameOf)}
            </li>
          ))}
        </ol>
      </details>
    </main>
  );
}

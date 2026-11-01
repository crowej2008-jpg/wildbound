import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { lastActor, lastTarget, replayTo, type BattleEvent } from '@wildbound/engine';
import type { BattleView } from '@wildbound/server';
import BattleField, { type BattlePopup } from './BattleField';
import ResultPanel from './ResultPanel';
import { describeEvent } from '../combat/events';
import { t, strategyLabel } from '../i18n';

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

interface BattleReplayProps {
  view: BattleView;
  /** Team labels (defaults to the M4 attacker/echo wording). */
  attackerLabel?: string;
  defenderLabel?: string;
  backTo?: { to: string; label: string };
  /** Extra content shown once playback finishes (e.g. reward summary). */
  resultExtra?: ReactNode;
  /** Fired once when playback first reaches the end. */
  onFinished?: () => void;
  /** R9: false hides Skip to end (the World Boss below VIP 14). */
  canSkip?: boolean;
}

/**
 * Replay a recorded battle log (PROMPT §6/§8). Folds the immutable event list —
 * it never re-simulates. Reused by the M4 demo Combat screen and the M5 campaign
 * stage battles. See docs/design/battle-ui.md.
 */
export default function BattleReplay({
  view,
  attackerLabel,
  defenderLabel,
  backTo,
  resultExtra,
  onFinished,
  canSkip,
}: BattleReplayProps) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(1);

  const events = view.events;
  const units = view.units;
  const seeds = useMemo(() => new Map(units.map((u) => [u.key, u])), [units]);
  const state = useMemo(() => replayTo(units, events, index), [units, events, index]);
  const finalState = useMemo(() => replayTo(units, events, events.length), [units, events]);
  const nameOf = useCallback((key: string) => seeds.get(key)?.name ?? key, [seeds]);

  const current = index > 0 ? events[index - 1] : undefined;
  const popup = useMemo(() => popupFor(current), [current]);
  const actorKey = lastActor(events, index - 1);
  const targetKey = lastTarget(events, index - 1);
  const done = index >= events.length;

  useEffect(() => {
    if (!playing) return;
    if (index >= events.length) {
      setPlaying(false);
      return;
    }
    const id = window.setTimeout(() => setIndex((i) => Math.min(i + 1, events.length)), BASE_DELAY / speed);
    return () => window.clearTimeout(id);
  }, [playing, index, speed, events.length]);

  useEffect(() => {
    if (done) onFinished?.();
  }, [done, onFinished]);

  const cycleSpeed = () => setSpeed((s) => SPEEDS[(SPEEDS.indexOf(s as (typeof SPEEDS)[number]) + 1) % SPEEDS.length] ?? 1);
  const round = state.round;
  const maxRounds = events.filter((e) => e.type === 'roundStart').length;

  return (
    <main className="main">
      {backTo && (
        <Link className="text-link" to={backTo.to}>
          ← {backTo.label}
        </Link>
      )}
      <div className="page-head">
        <h1 className="page-title">{t('combat.title')}</h1>
        <span className="muted">
          {t('combat.round')} {Math.max(1, round)} / {Math.max(maxRounds, 1)}
        </span>
      </div>

      <div className="battle-teams">
        <span className="muted">
          {defenderLabel ?? t('combat.team.defenders')} · {strategyLabel[view.strategies.defenders]}
        </span>
        <span className="muted">
          {t('combat.teamPower')} {view.teams.defenders.power.toLocaleString()}
        </span>
      </div>
      <BattleField state={state} seeds={seeds} actorKey={actorKey} targetKey={targetKey} popup={popup} popupIndex={index} />
      <div className="battle-teams">
        <span className="muted">
          {attackerLabel ?? t('combat.team.attackers')} · {strategyLabel[view.strategies.attackers]}
        </span>
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
        <button type="button" className="btn" onClick={() => { setPlaying(false); setIndex(0); }}>
          {t('combat.restart')}
        </button>
        {canSkip !== false && (
          <button type="button" className="btn" onClick={() => { setPlaying(false); setIndex(events.length); }} disabled={done}>
            {t('combat.skip')}
          </button>
        )}
      </div>

      {done && (
        <>
          <ResultPanel view={view} finalState={finalState} />
          {resultExtra}
        </>
      )}

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

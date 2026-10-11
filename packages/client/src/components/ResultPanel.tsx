import type { BattleEvent, ReplayState } from '@wildbound/engine';
import type { BattleView } from '@wildbound/server';
import { t } from '../i18n';

interface ResultPanelProps {
  view: BattleView;
  finalState: ReplayState;
}

interface Tally {
  dealt: number;
  taken: number;
  healed: number;
}

function tally(events: BattleEvent[]): Map<string, Tally> {
  const stats = new Map<string, Tally>();
  const get = (key: string): Tally => {
    let row = stats.get(key);
    if (!row) {
      row = { dealt: 0, taken: 0, healed: 0 };
      stats.set(key, row);
    }
    return row;
  };
  for (const e of events) {
    if (e.type === 'hit') {
      get(e.src).dealt += e.dmg;
      get(e.tgt).taken += e.dmg;
    } else if (e.type === 'reflect') {
      get(e.tgt).taken += e.dmg;
    } else if (e.type === 'heal') {
      get(e.tgt).healed += e.amount;
    }
  }
  return stats;
}

/** Compact post-battle summary: winner, rounds, per-unit tallies (PROMPT §8). */
export default function ResultPanel({ view, finalState }: ResultPanelProps) {
  const stats = tally(view.events);
  const names = new Map(view.units.map((u) => [u.key, u]));
  const rows = [...view.units].sort((a, b) => (stats.get(b.key)?.dealt ?? 0) - (stats.get(a.key)?.dealt ?? 0));
  const win = view.winner === 'attackers';
  return (
    <section className={`card result-panel ${win ? 'result-win' : 'result-lose'}`} aria-live="polite">
      <div className="result-banner">
        <strong>{win ? t('combat.win.attackers') : t('combat.win.defenders')}</strong>
        <span className="muted">
          {t('combat.rounds')} {view.rounds} · {t('combat.seed')} {view.seed}
        </span>
      </div>
      <table className="result-table">
        <thead>
          <tr>
            <th scope="col">{t('combat.team.attackers')}</th>
            <th scope="col">{t('combat.result.dealt')}</th>
            <th scope="col">{t('combat.result.taken')}</th>
            <th scope="col">{t('combat.result.healed')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => {
            const alive = finalState.units.find((s) => s.key === u.key)?.alive ?? u.alive;
            const row = stats.get(u.key);
            return (
              <tr key={u.key} className={alive ? '' : 'unit-dead-row'} data-side={u.side}>
                <td>
                  {names.get(u.key)?.name ?? u.key}
                  {!alive && <span className="muted"> · {t('combat.knockedOut')}</span>}
                </td>
                <td>{row?.dealt ?? 0}</td>
                <td>{row?.taken ?? 0}</td>
                <td>{row?.healed ?? 0}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

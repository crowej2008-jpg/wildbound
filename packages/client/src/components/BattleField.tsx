import { COMBAT_SETTINGS } from '@wildbound/content';
import type { ReplayState } from '@wildbound/engine';
import type { BattleUnitSeed } from '@wildbound/server';
import WildPortrait from '../art/WildPortrait';
import { species } from '../wilds';

export interface BattlePopup {
  key: string;
  text: string;
  kind: 'hit' | 'crit' | 'block' | 'miss' | 'heal' | 'shield';
}

interface BattleFieldProps {
  state: ReplayState;
  seeds: Map<string, BattleUnitSeed>;
  actorKey: string | null;
  targetKey: string | null;
  popup: BattlePopup | null;
  popupIndex: number;
}

/** Two halves; back rows (positions 1-3) sit behind the front rows (4-6). */
export default function BattleField({ state, seeds, actorKey, targetKey, popup, popupIndex }: BattleFieldProps) {
  return (
    <div className="battle-field">
      <TeamHalf side="defenders" state={state} seeds={seeds} actorKey={actorKey} targetKey={targetKey} popup={popup} popupIndex={popupIndex} />
      <div className="battle-vs" aria-hidden="true">VS</div>
      <TeamHalf side="attackers" state={state} seeds={seeds} actorKey={actorKey} targetKey={targetKey} popup={popup} popupIndex={popupIndex} />
    </div>
  );
}

interface HalfProps extends BattleFieldProps {
  side: 'attackers' | 'defenders';
}

function TeamHalf({ side, state, seeds, ...rest }: HalfProps) {
  const units = state.units.filter((u) => u.side === side);
  const back = units.filter((u) => u.position <= 3).sort((a, b) => a.position - b.position);
  const front = units.filter((u) => u.position >= 4).sort((a, b) => a.position - b.position);
  const rows = side === 'defenders' ? [back, front] : [front, back];
  return (
    <div className={`battle-half battle-half-${side}`}>
      {rows.map((row, i) => (
        <div className="battle-row" key={`${side}-row-${i}`}>
          {row.map((u) => (
            <UnitCard key={u.key} state={u} seed={seeds.get(u.key)} {...rest} />
          ))}
        </div>
      ))}
    </div>
  );
}

interface UnitCardProps extends Omit<BattleFieldProps, 'state' | 'seeds'> {
  state: ReplayState['units'][number];
  seed: BattleUnitSeed | undefined;
}

function UnitCard({ state, seed, actorKey, targetKey, popup, popupIndex }: UnitCardProps) {
  const meta = seed ? species(seed.speciesId) : undefined;
  const hpPct = state.maxHp > 0 ? Math.max(0, (state.hp / state.maxHp) * 100) : 0;
  const ragePct = Math.min(100, (state.rage / COMBAT_SETTINGS.rageMax) * 100);
  const classes = ['battle-unit'];
  if (!state.alive) classes.push('unit-dead');
  if (actorKey === state.key) classes.push('unit-actor');
  if (targetKey === state.key) classes.push('unit-target');
  const showPopup = popup && popup.key === state.key;
  return (
    <div className={classes.join(' ')} data-key={state.key} data-side={state.side}>
      {showPopup && (
        <span key={popupIndex} className={`popup popup-${popup.kind}`}>
          {popup.text}
        </span>
      )}
      <div className="battle-portrait">
        {meta ? <WildPortrait species={meta} stage={seed?.stage ?? 0} size={40} /> : <span className="muted">?</span>}
        {state.shield > 0 && <span className="shield-badge" title={`Shield ${state.shield}`}>◈{state.shield}</span>}
      </div>
      <span className="battle-unit-name">{seed?.name ?? state.key}</span>
      <div className="bar bar-hp">
        <span className="bar-fill" style={{ width: `${hpPct}%` }} />
      </div>
      <div className="bar bar-rage">
        <span className="bar-fill" style={{ width: `${ragePct}%` }} />
      </div>
      {state.buffs.length > 0 && (
        <div className="unit-buffs">
          {state.buffs.slice(0, 3).map((tag) => (
            <span className="buff-chip" key={tag}>
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

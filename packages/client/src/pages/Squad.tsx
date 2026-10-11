import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  emptySquad,
  FRONT_ROW_SLOTS,
  SQUAD_MODES,
  STRATEGIES,
  type SquadMode,
  type StrategyId,
} from '@wildbound/engine';
import WildPortrait from '../art/WildPortrait';
import { squadModeLabel, strategyLabel, t } from '../i18n';
import { useServer } from '../server/ServerProvider';
import { species } from '../wilds';

export default function Squad() {
  const { snapshot, run, busy } = useServer();
  const [mode, setMode] = useState<SquadMode>('campaign');
  const [selected, setSelected] = useState<number>(0);

  if (!snapshot) return <main className="main"><p className="muted">Loading account…</p></main>;

  const squad = snapshot.state.squads[mode];
  const strategy = snapshot.state.strategies[mode];
  const byId = new Map(snapshot.state.roster.map((w) => [w.id, w]));

  const place = (instanceId: string) => {
    const next = [...squad];
    next[selected] = instanceId;
    void run((s) => s.saveSquad(mode, next, strategy));
  };
  const clearSlot = (index: number) => {
    const next = [...squad];
    next[index] = null;
    void run((s) => s.saveSquad(mode, next, strategy));
  };

  const placedSpecies = new Set(
    squad.filter((id): id is string => id !== null).map((id) => byId.get(id)?.speciesId).filter((x): x is string => Boolean(x)),
  );

  const candidates = [...snapshot.state.roster].sort(
    (a, b) => (snapshot.power[b.id] ?? 0) - (snapshot.power[a.id] ?? 0),
  );

  const slot = (index: number) => {
    const id = squad[index];
    const wild = id ? byId.get(id) : undefined;
    const meta = wild ? species(wild.speciesId) : undefined;
    return (
      <div className="slot-wrap" key={index}>
        <button
          type="button"
          className={`squad-slot ${selected === index ? 'slot-selected' : ''} ${id ? 'slot-filled' : ''}`}
          onClick={() => {
            if (id && selected === index) clearSlot(index);
            else setSelected(index);
          }}
          aria-label={`Slot ${index + 1}`}
        >
          {meta && wild ? (
            <>
              <WildPortrait species={meta} stage={wild.evolutionStage} size={44} />
              <span className="slot-name">{meta.name}</span>
              <span className="slot-sub">
                {t('wild.level')}
                {wild.level}
              </span>
            </>
          ) : (
            <span className="slot-empty">{t('squad.empty')}</span>
          )}
        </button>
      </div>
    );
  };

  return (
    <main className="main">
      <Link className="text-link" to="/wilds">← {t('wilds.title')}</Link>
      <div className="page-head">
        <h1 className="page-title">{t('squad.title')}</h1>
        <span className="muted">
          {t('wilds.teamPower')} {snapshot.teamPower[mode].toLocaleString()}
        </span>
      </div>
      <p className="muted">{t('squad.subtitle')}</p>

      <div className="filter-row">
        {SQUAD_MODES.map((m) => (
          <button
            key={m}
            type="button"
            className={mode === m ? 'chip chip-active' : 'chip'}
            onClick={() => {
              setMode(m);
              setSelected(0);
            }}
          >
            {squadModeLabel[m]}
          </button>
        ))}
      </div>

      <section className="card">
        <h2 className="section-title">{t('squad.front')}</h2>
        <div className="squad-row">{FRONT_ROW_SLOTS.map((i) => slot(i))}</div>
        <h2 className="section-title">{t('squad.back')}</h2>
        <div className="squad-row">{[3, 4, 5].map((i) => slot(i))}</div>

        <div className="row-actions">
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void run((s) => s.autoFormation(mode))}>
            {t('squad.auto')}
          </button>
          <button type="button" className="btn" disabled={busy} onClick={() => void run((s) => s.saveSquad(mode, emptySquad(), strategy))}>
            {t('squad.clear')}
          </button>
        </div>

        <div className="strategy-row">
          <span className="muted">{t('squad.strategy')}</span>
          {STRATEGIES.map((s: StrategyId) => (
            <button
              key={s}
              type="button"
              className={strategy === s ? 'chip chip-active' : 'chip'}
              disabled={busy}
              onClick={() => void run((server) => server.setStrategy(mode, s))}
            >
              {strategyLabel[s]}
            </button>
          ))}
        </div>
      </section>

      <h2 className="section-title">{t('squad.pick')}</h2>
      {candidates.length === 0 ? (
        <p className="muted">{t('squad.noCandidates')}</p>
      ) : (
        <ul className="candidate-list">
          {candidates.map((wild) => {
            const meta = species(wild.speciesId);
            if (!meta) return null;
            const used = placedSpecies.has(wild.speciesId) && squad[selected] !== wild.id;
            return (
              <li key={wild.id}>
                <button
                  type="button"
                  className="candidate"
                  disabled={busy || used}
                  onClick={() => place(wild.id)}
                >
                  <WildPortrait species={meta} stage={wild.evolutionStage} size={40} />
                  <span className="candidate-name">{meta.name}</span>
                  <span className="candidate-power">{(snapshot.power[wild.id] ?? 0).toLocaleString()}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

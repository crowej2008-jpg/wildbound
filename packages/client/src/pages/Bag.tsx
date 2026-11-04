import { useCallback, useEffect, useState } from 'react';
import type { DrawResult } from '@wildbound/engine';
import type { BagActionResult, BagBoxView, BagView, GameServer, Result } from '@wildbound/server';
import { currencyLabel, t, tierLabel, type CurrencyKey, type StringKey, type TierKey } from '../i18n';
import { useServer } from '../server/ServerProvider';
import { species } from '../wilds';

const nameOf = (speciesId: string, star?: number): string => {
  const meta = species(speciesId);
  return (star !== undefined ? meta?.stars.find((c) => c.star === star)?.name : undefined) ?? meta?.name ?? speciesId;
};
const boxName = (id: string): string => t(`bag.box.${id}` as StringKey);
const pct = (value: number): string => `${(value * 100).toFixed(2)}%`;

interface Outcome {
  draws: DrawResult[];
  shards: Record<string, number>;
  boxes: Record<string, number>;
}

/** The rows of a box: chances for a random box, a pick button per row for a choice box. */
function BoxCard({
  box,
  busy,
  onOpen,
  onChoose,
}: {
  box: BagBoxView;
  busy: boolean;
  onOpen: (times: number) => void;
  onChoose: (speciesId: string) => void;
}) {
  const choice = box.kind !== 'random';
  return (
    <section className="card bag-box" data-box={box.id}>
      <h2 className="section-title">
        {boxName(box.id)}
        {!box.autoOpen && <span className="muted"> ×{box.have}</span>}
      </h2>
      <p className="muted">{t(box.autoOpen ? 'bag.autoOpen' : choice ? 'bag.choose' : 'bag.random')}</p>
      {!box.autoOpen && !choice && (
        <div className="summon-actions">
          <button type="button" className="btn btn-primary" disabled={busy || box.have < 1} onClick={() => onOpen(1)}>
            {t('bag.open')}
          </button>
          <button type="button" className="btn" disabled={busy || box.have < 2} onClick={() => onOpen(Math.min(999, box.have))}>
            {t('bag.openAll')}
          </button>
        </div>
      )}
      <details className="summon-rates" open={choice && box.have > 0}>
        <summary>{t('bag.contents')}</summary>
        <ul className="rate-list">
          {box.rows.map((row) => (
            <li key={`${row.species}-${row.star}`}>
              <span>
                {box.kind === 'chooseShards'
                  ? `${nameOf(row.species)} ${t('bag.shards')} ×${row.amount}`
                  : `${nameOf(row.species, row.star)} ${row.star}★`}
              </span>
              {row.probability !== null ? (
                <span className="muted">{pct(row.probability)}</span>
              ) : (
                <button type="button" className="btn" disabled={busy || box.have < 1} onClick={() => onChoose(row.species)}>
                  {t('bag.pick')}
                </button>
              )}
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}

/** R9: the Bag — generic Pokémon shards compose into boxes; Pokémon boxes open (source item_compound / item_hero). */
export default function Bag() {
  const { call, busy, snapshot } = useServer();
  const [view, setView] = useState<BagView | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const refresh = useCallback(async () => {
    const result = await call((s) => s.getBag());
    if (result.ok) setView(result.value);
  }, [call]);

  useEffect(() => {
    void refresh();
  }, [refresh, snapshot?.state.currencies]);

  const act = async (step: (s: GameServer) => Promise<Result<BagActionResult>>) => {
    setOutcome(null);
    const result = await call(step, (v) => v.snapshot);
    if (result.ok) {
      setOutcome({ draws: result.value.draws, shards: result.value.shards, boxes: result.value.boxes });
      await refresh();
    }
  };

  if (!view) {
    return (
      <main className="main">
        <h1 className="page-title">{t('bag.title')}</h1>
        <p className="muted">{t('combat.loading')}</p>
      </main>
    );
  }

  return (
    <main className="main">
      <h1 className="page-title">{t('bag.title')}</h1>
      <p className="muted">{t('bag.subtitle')}</p>

      <section className="card" data-testid="bag-compose">
        <h2 className="section-title">{t('bag.compose')}</h2>
        <ul className="quest-list">
          {view.recipes.map((r) => (
            <li key={r.from} className="quest-row" data-recipe={r.from}>
              <div className="quest-info">
                <span className="quest-name">
                  {currencyLabel[r.from as CurrencyKey]}: {r.have.toLocaleString()} / {r.count}
                </span>
                <span className="muted">→ {boxName(r.box)}</span>
              </div>
              <button type="button" className="btn btn-primary" disabled={busy || r.makes < 1} onClick={() => void act((s) => s.composeBag(r.from, 1))}>
                {t('bag.make1')}
              </button>
              <button type="button" className="btn" disabled={busy || r.makes < 2} onClick={() => void act((s) => s.composeBag(r.from, r.makes))}>
                {t('bag.makeAll')} ({r.makes})
              </button>
            </li>
          ))}
        </ul>
      </section>

      {outcome && (
        <section className="card summon-results" data-testid="bag-result">
          <h2 className="section-title">{t('summon.results')}</h2>
          <ul className="draw-grid">
            {outcome.draws.map((draw, i) => (
              <li key={i} className={`draw-card tier-${draw.tier}`}>
                <span className="draw-name">
                  {nameOf(draw.speciesId, draw.star)} {draw.star}★
                </span>
                <span className="chip">{tierLabel[draw.tier as TierKey]}</span>
                {draw.isNew && <span className="chip chip-new">{t('summon.new')}</span>}
              </li>
            ))}
            {Object.entries(outcome.shards).map(([id, n]) => (
              <li key={id} className="draw-card">
                {nameOf(id)} {t('bag.shards')} ×{n}
              </li>
            ))}
            {Object.entries(outcome.boxes).map(([id, n]) => (
              <li key={id} className="draw-card">
                {boxName(id)} ×{n}
              </li>
            ))}
          </ul>
        </section>
      )}

      {view.boxes.map((box) => (
        <BoxCard
          key={box.id}
          box={box}
          busy={busy}
          onOpen={(times) => void act((s) => s.openBagBox(box.id, times))}
          onChoose={(id) => void act((s) => s.chooseBagBox(box.id, id))}
        />
      ))}
    </main>
  );
}

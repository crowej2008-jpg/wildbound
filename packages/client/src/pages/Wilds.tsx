import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FACTIONS } from '@wildbound/content';
import type { Faction } from '@wildbound/engine';
import WildPortrait from '../art/WildPortrait';
import { classLabel, factionLabel, t, tierLabel } from '../i18n';
import { useServer } from '../server/ServerProvider';
import { species } from '../wilds';

type Filter = Faction | 'all';
type Sort = 'power' | 'recent';

export default function Wilds() {
  const { snapshot } = useServer();
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('power');

  const rows = useMemo(() => {
    if (!snapshot) return [];
    return snapshot.state.roster
      .map((wild) => ({ wild, meta: species(wild.speciesId), power: snapshot.power[wild.id] ?? 0 }))
      .filter((row) => row.meta !== undefined && (filter === 'all' || row.meta.faction === filter))
      .sort((a, b) => (sort === 'power' ? b.power - a.power : b.wild.acquiredAt - a.wild.acquiredAt));
  }, [snapshot, filter, sort]);

  if (!snapshot) {
    return (
      <main className="main">
        <p className="muted">Loading account…</p>
      </main>
    );
  }

  return (
    <main className="main">
      <div className="page-head">
        <h1 className="page-title">{t('wilds.title')}</h1>
        <Link className="text-link" to="/squad">
          {t('wilds.squadLink')}
        </Link>
      </div>
      <p className="muted">
        {t('wilds.subtitle')} · {t('wilds.teamPower')} {snapshot.teamPower.campaign.toLocaleString()}
      </p>

      <div className="filter-row">
        <button type="button" className={filter === 'all' ? 'chip chip-active' : 'chip'} onClick={() => setFilter('all')}>
          {t('wilds.filter.all')}
        </button>
        {FACTIONS.map((faction) => (
          <button
            key={faction}
            type="button"
            className={filter === faction ? 'chip chip-active' : 'chip'}
            onClick={() => setFilter(faction)}
          >
            {factionLabel[faction]}
          </button>
        ))}
      </div>
      <div className="filter-row">
        <span className="muted">{t('wilds.sort.power')}:</span>
        <button type="button" className={sort === 'power' ? 'chip chip-active' : 'chip'} onClick={() => setSort('power')}>
          {t('wilds.sort.power')}
        </button>
        <button type="button" className={sort === 'recent' ? 'chip chip-active' : 'chip'} onClick={() => setSort('recent')}>
          {t('wilds.sort.recent')}
        </button>
      </div>

      {rows.length === 0 ? (
        <section className="card">
          <p>{t('wilds.empty')}</p>
        </section>
      ) : (
        <ul className="roster">
          {rows.map(({ wild, meta, power }) => (
            <li key={wild.id}>
              <Link className="roster-item" to={`/wilds/${wild.id}`}>
                {meta && <WildPortrait species={meta} stage={wild.evolutionStage} size={64} />}
                <span className="roster-info">
                  <span className="roster-name">
                    {meta?.name} {wild.locked && <span className="lock-dot" title={t('wild.locked')}>●</span>}
                  </span>
                  <span className="roster-sub">
                    {meta && `${classLabel[meta.class]} · ${meta.stages[wild.evolutionStage] ?? ''}`}
                  </span>
                  <span className="roster-chips">
                    {meta && <span className={`chip tier-${meta.tier}`}>{tierLabel[meta.tier]}</span>}
                    <span className="chip">
                      {t('wild.level')}
                      {wild.level}
                    </span>
                    <span className="chip">
                      {wild.stars}★
                    </span>
                  </span>
                </span>
                <span className="roster-power">
                  <span className="roster-power-value">{power.toLocaleString()}</span>
                  <span className="roster-power-label">{t('wild.power')}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

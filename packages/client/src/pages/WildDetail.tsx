import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { effectiveLevelCap, formNames, levelUpCost, type StarCard } from '@wildbound/engine';
import { evolutionView, type EvolutionRequirement } from '@wildbound/server';
import WildPortrait from '../art/WildPortrait';
import { classLabel, factionLabel, t, tierLabel } from '../i18n';
import { PROGRESS } from '../progress';
import { useServer } from '../server/ServerProvider';
import { cardFor, formFor, species, topStar } from '../wilds';
import BerryPanel from './wild/BerryPanel';
import HeldItemPanel from './wild/HeldItemPanel';
import OrbsPanel from './wild/OrbsPanel';
import PotentialPanel from './wild/PotentialPanel';
import SoulHeartPanel from './wild/SoulHeartPanel';
import StatSheet from './wild/StatSheet';
import { useEquipment } from './wild/useEquipment';

type Tab = 'upgrade' | 'evolve' | 'potential' | 'orbs' | 'soulHearts' | 'berries' | 'heldItems';

const TABS: { id: Tab; key: 'wild.tab.upgrade' | 'wild.tab.evolve' | 'wild.tab.potential' | 'wild.tab.orbs' | 'wild.tab.soulHearts' | 'wild.tab.berries' | 'wild.tab.heldItems' }[] = [
  { id: 'upgrade', key: 'wild.tab.upgrade' },
  { id: 'evolve', key: 'wild.tab.evolve' },
  { id: 'potential', key: 'wild.tab.potential' },
  { id: 'orbs', key: 'wild.tab.orbs' },
  { id: 'soulHearts', key: 'wild.tab.soulHearts' },
  { id: 'berries', key: 'wild.tab.berries' },
  { id: 'heldItems', key: 'wild.tab.heldItems' },
];

export default function WildDetail() {
  const { id = '' } = useParams();
  const { snapshot, run, busy } = useServer();
  const [tab, setTab] = useState<Tab>('upgrade');
  const gear = useEquipment(id);

  const wild = snapshot?.state.roster.find((w) => w.id === id);
  const meta = wild ? species(wild.speciesId) : undefined;

  const view = useMemo(() => {
    if (!wild || !meta || !snapshot) return null;
    const card = cardFor(meta, wild.stars);
    const top = topStar(meta);
    const crystal = snapshot.state.pve.linkCrystal ?? { unlocked: false, level: 0 };
    const atTopStage = wild.stars >= top && wild.level >= card.maxLevel;
    const cap = effectiveLevelCap({ stars: wild.stars, atTopStage }, card.maxLevel, crystal);
    const nextCost = levelUpCost(wild.level, Math.min(cap, wild.level + 1), PROGRESS);
    const tenCost = levelUpCost(wild.level, Math.min(cap, wild.level + 10), PROGRESS);
    const evolution = evolutionView(
      snapshot.state,
      (speciesId) => {
        const s = species(speciesId);
        return s ? { faction: s.faction, stars: s.stars as StarCard[] } : undefined;
      },
      wild.id,
    );
    return { card, top, cap, nextCost, tenCost, evolution };
  }, [wild, meta, snapshot]);

  if (!snapshot) return <main className="main"><p className="muted">Loading account…</p></main>;
  if (!wild || !meta || !view) {
    return (
      <main className="main">
        <p className="muted">That Wild could not be found.</p>
        <Link className="text-link" to="/wilds">{t('wild.back')}</Link>
      </main>
    );
  }

  const power = snapshot.power[wild.id] ?? 0;
  const currencies = snapshot.state.currencies;
  const atCap = wild.level >= view.cap;
  const forms = formNames(meta.stars as StarCard[]);
  const form = formFor(meta, wild.stars);
  const evolution = view.evolution;

  return (
    <main className="main">
      <Link className="text-link" to="/wilds">
        ← {t('wild.back')}
      </Link>

      <section className="card wild-detail-hero">
        <WildPortrait species={meta} stage={form} size={132} label={meta.name} />
        <div className="wild-detail-info">
          <h1 className="page-title">{meta.name}</h1>
          <div className="chip-list">
            <span className="chip">{classLabel[meta.class]}</span>
            <span className={`chip tier-${meta.tier}`}>{tierLabel[meta.tier]}</span>
            <span className="chip">{factionLabel[meta.faction]}</span>
            <span className="chip">{view.card.name}</span>
          </div>
          <p className="wild-power-lg">
            {t('wild.power')} <strong>{power.toLocaleString()}</strong>
          </p>
          <p className="muted">
            {t('wild.level')}
            {wild.level} / {view.cap} · {wild.stars}★ / {view.top}★
            {wild.locked && ` · ${t('wild.locked')}`}
          </p>
        </div>
      </section>

      <div className="row-actions">
        <button
          type="button"
          className="btn"
          disabled={busy}
          onClick={() => void run((s) => s.toggleLock(wild.id))}
        >
          {wild.locked ? t('wild.unlock') : t('wild.lock')}
        </button>
        <button
          type="button"
          className="btn btn-danger"
          disabled={busy || wild.locked}
          onClick={() => {
            if (window.confirm(t('wild.respawnConfirm'))) void run((s) => s.respawn(wild.id));
          }}
        >
          {t('wild.respawn')}
        </button>
      </div>

      {gear.view && <StatSheet view={gear.view} />}
      {gear.error && <p className="muted">{gear.error}</p>}

      <div className="tabs tabs-scroll">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={tab === entry.id ? 'tab tab-active' : 'tab'}
            onClick={() => setTab(entry.id)}
          >
            {t(entry.key)}
          </button>
        ))}
      </div>

      {tab !== 'upgrade' && tab !== 'evolve' && (
        !gear.view ? (
          <section className="card">
            <p className="muted">Loading gear…</p>
          </section>
        ) : (
          <>
            {tab === 'potential' && (
              <PotentialPanel wildId={id} view={gear.view} className={meta.class} busy={busy} run={run} reload={gear.reload} />
            )}
            {tab === 'orbs' && (
              <OrbsPanel wildId={id} view={gear.view} className={meta.class} busy={busy} run={run} reload={gear.reload} />
            )}
            {tab === 'soulHearts' && (
              <SoulHeartPanel wildId={id} view={gear.view} className={meta.class} busy={busy} run={run} reload={gear.reload} />
            )}
            {tab === 'berries' && (
              <BerryPanel wildId={id} view={gear.view} className={meta.class} busy={busy} run={run} reload={gear.reload} />
            )}
            {tab === 'heldItems' && (
              <HeldItemPanel wildId={id} view={gear.view} className={meta.class} busy={busy} run={run} reload={gear.reload} />
            )}
          </>
        )
      )}

      {tab === 'upgrade' ? (
        <section className="card">
          {atCap ? (
            <p className="muted">{t('wild.upgrade.maxLevel')}</p>
          ) : (
            <>
              <div className="cost-row">
                <span>{t('wild.upgrade.candy')} {view.nextCost.candy.toLocaleString()}</span>
                <span>{t('wild.upgrade.gold')} {view.nextCost.gold.toLocaleString()}</span>
              </div>
              <div className="row-actions">
                <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void run((s) => s.levelUp(wild.id, 1))}>
                  +1
                </button>
                <button type="button" className="btn" disabled={busy} onClick={() => void run((s) => s.levelUp(wild.id, 10))}>
                  +10 ({view.tenCost.candy.toLocaleString()})
                </button>
                <button type="button" className="btn" disabled={busy} onClick={() => void run((s) => s.levelUp(wild.id, 999))}>
                  Max
                </button>
              </div>
            </>
          )}
          <p className="wallet muted">
            {t('wild.upgrade.candy')} {currencies.candy.toLocaleString()} · {t('wild.upgrade.gold')} {currencies.gold.toLocaleString()}
          </p>
        </section>
      ) : tab === 'evolve' ? (
        <section className="card">
          {!evolution || evolution.blocked === 'max_star' || !evolution.next ? (
            <p className="muted">{t('wild.evolve.maxed')}</p>
          ) : evolution.blocked === 'awakening' ? (
            <p className="muted">
              {evolution.next.star}★ {t('wild.evolve.awakening')}
            </p>
          ) : (
            <>
              <p>
                {t('wild.evolve.next')}: <strong>{evolution.next.name}</strong> · {evolution.next.star}★ ·{' '}
                {t('wild.evolve.levelCap')} {evolution.next.maxLevel}
              </p>
              <p className="muted">{t('wild.evolve.requires')}:</p>
              <ul className="fodder-list">
                {evolution.requirements.map((req, index) => (
                  <li key={index} className={req.have >= req.count ? 'fodder-row fodder-met' : 'fodder-row'}>
                    {fodderLabel(req, meta.name)} · {req.have}/{req.count}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy || !evolution.ready}
                onClick={() => void run((s) => s.evolve(wild.id))}
              >
                {t('wild.evolve.cta')} → {evolution.next.star}★
              </button>
              <p className="muted">{t('wild.evolve.fodderNote')}</p>
            </>
          )}
          <div className="evolve-preview">
            {forms.map((stageName, stage) => (
              <figure key={stage} className={stage === form ? 'stage-figure stage-current' : 'stage-figure'}>
                <WildPortrait species={meta} stage={stage} size={72} />
                <figcaption>{stageName}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}

/** "2 × 5★ Darkrai" or "4 × 5★ Grass Pokémon". */
function fodderLabel(req: EvolutionRequirement, ownName: string): string {
  const who = req.own ? ownName : req.faction ? `${factionLabel[req.faction]} ${t('wild.evolve.anyOf')}` : t('wild.evolve.any');
  return `${req.count} × ${req.star}★ ${who}`;
}

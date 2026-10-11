import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  canEvolve,
  evolveCheck,
  levelCapOf,
  levelUpCost,
  starUpCost,
} from '@wildbound/engine';
import WildPortrait from '../art/WildPortrait';
import { classLabel, t, tierLabel } from '../i18n';
import { PROGRESS } from '../progress';
import { useServer } from '../server/ServerProvider';
import { species } from '../wilds';

type Tab = 'upgrade' | 'evolve';

export default function WildDetail() {
  const { id = '' } = useParams();
  const { snapshot, run, busy } = useServer();
  const [tab, setTab] = useState<Tab>('upgrade');

  const wild = snapshot?.state.roster.find((w) => w.id === id);
  const meta = wild ? species(wild.speciesId) : undefined;

  const view = useMemo(() => {
    if (!wild || !meta) return null;
    const cap = levelCapOf(wild, PROGRESS);
    const nextCost = levelUpCost(wild.level, Math.min(cap, wild.level + 1), PROGRESS);
    const tenCost = levelUpCost(wild.level, Math.min(cap, wild.level + 10), PROGRESS);
    const star = starUpCost(wild.stars, PROGRESS);
    const evolve = evolveCheck(wild, meta.stages.length, PROGRESS);
    return {
      cap,
      nextCost,
      tenCost,
      star,
      info: 'reason' in evolve ? null : evolve,
      canEvolve: canEvolve(wild, meta.stages.length, PROGRESS),
    };
  }, [wild, meta]);

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
  const atMaxStars = wild.stars >= PROGRESS.maxStars;

  return (
    <main className="main">
      <Link className="text-link" to="/wilds">
        ← {t('wild.back')}
      </Link>

      <section className="card wild-detail-hero">
        <WildPortrait species={meta} stage={wild.evolutionStage} size={132} label={meta.name} />
        <div className="wild-detail-info">
          <h1 className="page-title">{meta.name}</h1>
          <div className="chip-list">
            <span className="chip">{classLabel[meta.class]}</span>
            <span className={`chip tier-${meta.tier}`}>{tierLabel[meta.tier]}</span>
            <span className="chip">{meta.stages[wild.evolutionStage]}</span>
          </div>
          <p className="wild-power-lg">
            {t('wild.power')} <strong>{power.toLocaleString()}</strong>
          </p>
          <p className="muted">
            {t('wild.level')}
            {wild.level} / {view.cap} · {wild.stars}★ / {PROGRESS.maxStars}★
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

      <div className="tabs">
        <button type="button" className={tab === 'upgrade' ? 'tab tab-active' : 'tab'} onClick={() => setTab('upgrade')}>
          {t('wild.tab.upgrade')}
        </button>
        <button type="button" className={tab === 'evolve' ? 'tab tab-active' : 'tab'} onClick={() => setTab('evolve')}>
          {t('wild.tab.evolve')}
        </button>
      </div>

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
          <hr className="divider" />
          {atMaxStars ? (
            <p className="muted">{t('wild.stars')}: {wild.stars}★ / {PROGRESS.maxStars}★</p>
          ) : (
            <>
              <div className="cost-row">
                <span>{t('wild.upgrade.starCost')} {view.star.shards.toLocaleString()}</span>
                <span>{t('wild.upgrade.gold')} {view.star.gold.toLocaleString()}</span>
              </div>
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void run((s) => s.starUp(wild.id, 1))}>
                {t('wild.upgrade.star')} → {wild.stars + 1}★
              </button>
            </>
          )}
          <p className="wallet muted">
            {t('wild.upgrade.candy')} {currencies.candy.toLocaleString()} · {t('wild.upgrade.gold')} {currencies.gold.toLocaleString()} · {t('wild.upgrade.starCost')} {currencies.shard.toLocaleString()}
          </p>
        </section>
      ) : (
        <section className="card">
          {view.info === null ? (
            <p className="muted">{t('wild.evolve.maxed')}</p>
          ) : (
            <>
              <p>
                {t('wild.evolve.next')}: <strong>{meta.stages[(wild.evolutionStage + 1)]}</strong>
              </p>
              <p className="muted">
                {t('wild.evolve.requires')}: {t('wild.evolve.levelReq')}
                {view.info.minLevel} · {view.info.minStars} {t('wild.evolve.starReq')}
              </p>
              <div className="cost-row">
                <span>{t('wild.upgrade.candy')} {view.info.candy.toLocaleString()}</span>
                <span>{t('wild.upgrade.gold')} {view.info.gold.toLocaleString()}</span>
                <span>{t('currency.stone')} {view.info.stones.toLocaleString()}</span>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy || !view.canEvolve}
                onClick={() => void run((s) => s.evolve(wild.id))}
              >
                {t('wild.evolve.cta')}
              </button>
            </>
          )}
          <div className="evolve-preview">
            {meta.stages.map((stageName, stage) => (
              <figure key={stage} className={stage === wild.evolutionStage ? 'stage-figure stage-current' : 'stage-figure'}>
                <WildPortrait species={meta} stage={stage} size={72} />
                <figcaption>{stageName}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

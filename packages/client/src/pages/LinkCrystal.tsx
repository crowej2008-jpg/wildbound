import { useCallback, useEffect, useState } from 'react';
import type { LinkCrystalView } from '@wildbound/server';
import { currencyLabel, t } from '../i18n';
import { useServer } from '../server/ServerProvider';

/** Link Crystal (M8, PROMPT §7.1): shared endgame growth for top-form Wilds. */
export default function LinkCrystal() {
  const { call, snapshot, busy } = useServer();
  const [view, setView] = useState<LinkCrystalView | null>(null);
  const [raised, setRaised] = useState(false);

  const refresh = useCallback(async () => {
    const result = await call((s) => s.getLinkCrystal());
    if (result.ok) setView(result.value);
  }, [call]);

  useEffect(() => {
    void refresh();
  }, [refresh, snapshot?.state.pve.linkCrystal.level]);

  const onUpgrade = async () => {
    setRaised(false);
    const result = await call((s) => s.upgradeLinkCrystal(), (v) => v);
    if (result.ok) {
      setRaised(true);
      await refresh();
    }
  };

  if (!view) {
    return (
      <main className="main">
        <h1 className="page-title">{t('crystal.title')}</h1>
        <p className="muted">{t('combat.loading')}</p>
      </main>
    );
  }

  if (!view.unlocked) {
    return (
      <main className="main">
        <h1 className="page-title">{t('crystal.title')}</h1>
        <p className="muted">{t('crystal.locked')}</p>
      </main>
    );
  }

  return (
    <main className="main">
      <h1 className="page-title">{t('crystal.title')}</h1>
      <p className="muted">{t('crystal.note')}</p>
      <section className="card">
        <div className="stat-row">
          <span className="stat">
            <span className="muted">{t('crystal.level')}</span>
            <strong>{view.level}</strong>
          </span>
          <span className="stat">
            <span className="muted">{t('crystal.cap')}</span>
            <strong>{view.cap}</strong>
          </span>
          <span className="stat">
            <span className="muted">{t('crystal.topStage')}</span>
            <strong>{view.topStageCount}</strong>
          </span>
          <span className="stat">
            <span className="muted">
              {t('crystal.qualifying')} ({view.starThreshold}★)
            </span>
            <strong>{view.qualifying}</strong>
          </span>
        </div>
        <p className="muted">
          {t('crystal.cost')}: {view.cost.candy.toLocaleString()} {currencyLabel.candy} ·{' '}
          {view.cost.gold.toLocaleString()} {currencyLabel.gold} · {view.cost.stones} {currencyLabel.stone}
        </p>
        <div className="stage-actions">
          <button type="button" className="btn btn-primary" disabled={busy || !view.canUpgrade} onClick={() => void onUpgrade()}>
            {view.canUpgrade ? t('crystal.upgrade') : t('crystal.maxed')}
          </button>
        </div>
        {raised && <p className="muted">{t('crystal.upgraded')}</p>}
      </section>
    </main>
  );
}

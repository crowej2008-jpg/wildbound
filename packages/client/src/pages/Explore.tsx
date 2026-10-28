import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ExploreGateView, ExploreModeView, ExploreView } from '@wildbound/server';
import { t } from '../i18n';
import { useServer } from '../server/ServerProvider';

/** Explore hub (M13.0b): eight mode shells with their gates and reset cadence. */

function resetLabel(reset: ExploreModeView['reset']): string {
  switch (reset) {
    case 'daily':
      return t('explore.reset.daily');
    case 'weekly':
      return t('explore.reset.weekly');
    case 'permanent':
      return t('explore.reset.permanent');
  }
}

function gateLabel(gate: ExploreGateView): string {
  switch (gate.gate.kind) {
    case 'campaign':
      return `${t('explore.requirement.campaign')} ${gate.gate.chapter}-${gate.gate.stage}`;
    case 'level':
      return `${t('explore.requirement.level')} ${gate.required}`;
    case 'serverDay':
      return `${t('explore.requirement.serverDay')} ${gate.required}`;
  }
}

function statusChip(mode: ExploreModeView): string {
  return mode.status === 'live'
    ? t('explore.status.live')
    : `${t('explore.status.planned')} · ${t('explore.arrives')} ${mode.arrivesIn}`;
}

export default function Explore() {
  const { call } = useServer();
  const [view, setView] = useState<ExploreView | null>(null);

  const refresh = useCallback(async () => {
    const result = await call((s) => s.getExplore());
    if (result.ok) setView(result.value);
  }, [call]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!view) {
    return (
      <main className="main">
        <h1 className="page-title">{t('explore.title')}</h1>
        <p className="muted">{t('explore.loading')}</p>
      </main>
    );
  }

  return (
    <main className="main">
      <h1 className="page-title">{t('explore.title')}</h1>
      <p className="muted">{t('explore.subtitle')}</p>
      <div className="explore-meta">
        <span className="chip">
          {t('explore.serverDay')} {view.serverDay}
        </span>
        <span className="muted">{view.serverDayNote}</span>
      </div>
      <div className="explore-grid">
        {view.modes.map((mode) => {
          const unmet = mode.gates.find((gate) => !gate.met);
          return (
            <Link
              key={mode.id}
              className={`explore-card ${mode.unlocked ? 'is-open' : 'is-locked'}`}
              to={`/explore/${mode.id}`}
            >
              <div className="explore-card-head">
                <span className="explore-sigil" aria-hidden>
                  {mode.sigil}
                </span>
                <div className="explore-card-title">
                  <h2>{mode.name}</h2>
                  <p className="muted">{mode.tagline}</p>
                </div>
              </div>
              <p className="explore-desc">{mode.description}</p>
              <div className="explore-facts">
                <span className="chip">{mode.scale}</span>
                <span className="chip">{resetLabel(mode.reset)}</span>
                <span className={`chip ${mode.unlocked ? 'chip-on' : ''}`}>
                  {mode.unlocked ? t('explore.unlocked') : t('explore.locked')}
                </span>
                <span className={`chip explore-status ${mode.status}`}>{statusChip(mode)}</span>
              </div>
              {unmet ? (
                <p className="muted explore-gate-line">
                  {t('explore.gateSummary')}: {gateLabel(unmet)}
                </p>
              ) : null}
              <span className="text-link">{t('explore.preview')}</span>
            </Link>
          );
        })}
      </div>
    </main>
  );
}

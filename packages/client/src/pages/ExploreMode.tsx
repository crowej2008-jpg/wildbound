import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { ExploreGateView, ExploreModeView, ExploreView } from '@wildbound/server';
import { formatDuration, t } from '../i18n';
import { useServer } from '../server/ServerProvider';

/** One Explore mode shell (M13.0b): gates, scale, reset cadence and planned scope. */

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

export default function ExploreMode() {
  const { id } = useParams<{ id: string }>();
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

  const mode = view.modes.find((candidate) => candidate.id === id);
  if (!mode) {
    return (
      <main className="main">
        <h1 className="page-title">{t('explore.title')}</h1>
        <p className="muted">{t('explore.notFound')}</p>
        <Link className="text-link" to="/explore">
          {t('explore.back')}
        </Link>
      </main>
    );
  }

  return (
    <main className="main">
      <p>
        <Link className="text-link" to="/explore">
          {t('explore.back')}
        </Link>
      </p>
      <div className="explore-detail-head">
        <span className="explore-sigil explore-sigil-lg" aria-hidden>
          {mode.sigil}
        </span>
        <div>
          <h1 className="page-title">{mode.name}</h1>
          <p className="muted">{mode.tagline}</p>
        </div>
      </div>
      <p>{mode.description}</p>
      <div className="explore-facts">
        <span className="chip">{mode.scale}</span>
        <span className="chip">{resetLabel(mode.reset)}</span>
        {mode.nextResetMs !== null ? (
          <span className="chip">
            {t('explore.resetIn')} {formatDuration(mode.nextResetMs)}
          </span>
        ) : null}
        <span className={`chip ${mode.unlocked ? 'chip-on' : ''}`}>
          {mode.unlocked ? t('explore.unlocked') : t('explore.locked')}
        </span>
        <span className={`chip explore-status ${mode.status}`}>
          {mode.status === 'live'
            ? t('explore.status.live')
            : `${t('explore.status.planned')} · ${t('explore.arrives')} ${mode.arrivesIn}`}
        </span>
      </div>

      <h2 className="section-title">{t('explore.gates')}</h2>
      <ul className="plain-list">
        {mode.gates.map((gate, index) => (
          <li key={`${gate.gate.kind}-${index}`} className="milestone-row">
            <span>{gateLabel(gate)}</span>
            <span className={`chip ${gate.met ? 'chip-on' : ''}`}>
              {gate.met ? t('explore.met') : t('explore.unmet')}
            </span>
          </li>
        ))}
      </ul>

      <h2 className="section-title">{t('explore.features')}</h2>
      <ul className="plain-list">
        {mode.features.map((feature) => (
          <li key={feature} className="milestone-row">
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      {mode.status === 'planned' ? (
        <p className="muted">
          {t('explore.plannedNote')} {mode.arrivesIn}.
        </p>
      ) : null}
    </main>
  );
}

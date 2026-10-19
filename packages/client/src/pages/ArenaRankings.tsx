import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ArenaRankingsView } from '@wildbound/server';
import RewardLine from '../components/RewardLine';
import { formatDuration, t } from '../i18n';
import { useServer } from '../server/ServerProvider';

/** Arena Rankings (M10, PROMPT §7.7): the player's place against ghost places. */
export default function ArenaRankings() {
  const { call, snapshot } = useServer();
  const [view, setView] = useState<ArenaRankingsView | null>(null);

  const refresh = useCallback(async () => {
    const result = await call((s) => s.getArenaRankings());
    if (result.ok) setView(result.value);
  }, [call]);

  useEffect(() => {
    void refresh();
  }, [refresh, snapshot?.state.pvp.arena.credits]);

  return (
    <main className="main">
      <Link className="text-link" to="/arena">
        ← {t('arena.title')}
      </Link>
      <h1 className="page-title">{t('arena.rankings.title')}</h1>
      <p className="muted">{t('arena.rankings.subtitle')}</p>

      {!view ? (
        <p className="muted">{t('combat.loading')}</p>
      ) : (
        <>
          <section className="card">
            <div className="stat-row">
              <span className="stat">
                <span className="muted">{t('arena.ranking')}</span>
                <strong>#{view.place.toLocaleString()}</strong>
              </span>
              <span className="stat">
                <span className="muted">{t('arena.credits')}</span>
                <strong>{view.credits.toLocaleString()}</strong>
              </span>
              <span className="stat">
                <span className="muted">{t('arena.bestPlace')}</span>
                <strong>{view.bestPlace > 0 ? `#${view.bestPlace.toLocaleString()}` : t('arena.none')}</strong>
              </span>
            </div>
            <p className="muted">
              {t('arena.weekReset')}: {formatDuration(view.weekResetMs)}
            </p>
          </section>

          <section className="card">
            <h2 className="section-title">{t('arena.rankings.bands')}</h2>
            <ul className="plain-list">
              {view.bands.map((band) => (
                <li key={band.index} className="milestone-row">
                  <span>
                    {t('arena.rankings.bandPlace')} #{band.place.toLocaleString()}
                  </span>
                  <span className="milestone-rewards">
                    <RewardLine rewards={band.reward} />
                  </span>
                  <span className="muted">
                    {t('arena.rankings.minCredits')} {band.minCredits.toLocaleString()}
                  </span>
                  {band.current && <span className="chip chip-on">{t('arena.rankings.current')}</span>}
                </li>
              ))}
            </ul>
          </section>

          <section className="card">
            <h2 className="section-title">{t('arena.ranking')}</h2>
            <ul className="plain-list">
              {view.entries.map((entry) => (
                <li key={entry.place} className="milestone-row">
                  <span>#{entry.place.toLocaleString()}</span>
                  <span className="milestone-rewards">
                    {entry.name}
                    {entry.you && <span className="chip chip-on"> {t('arena.rankings.you')}</span>}
                  </span>
                  <span className="muted">
                    {entry.credits !== null ? `${entry.credits.toLocaleString()} ${t('arena.credits')}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <p className="muted">{t('arena.worshipLater')}</p>
        </>
      )}
    </main>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { PvpHubCardView, PvpHubId, PvpHubView } from '@wildbound/server';
import { currencyLabel, t, type StringKey } from '../i18n';
import { useServer } from '../server/ServerProvider';

/**
 * PvP hub (M10.5, PROMPT §7.7): one card per PvP entry point. The server sends
 * structured numbers (never prose), so every label here comes from the i18n
 * table. Modes the reference ships that are still pending render an honest
 * "coming later" card — no dead buttons. See docs/design/pvp.md.
 */

const COPY: Record<
  PvpHubId,
  { title: StringKey; desc: StringKey; icon: string }
> = {
  arena: { title: 'arena.title', desc: 'arena.subtitle', icon: '🏟' },
  ranked: { title: 'ranked.title', desc: 'ranked.subtitle', icon: '🏅' },
  clash: { title: 'pvp.clash', desc: 'pvp.clash.desc', icon: '🌐' },
  championship: { title: 'pvp.championship', desc: 'pvp.championship.desc', icon: '👑' },
  temple: { title: 'pvp.temple', desc: 'pvp.temple.desc', icon: '🛕' },
  shop: { title: 'shop.title', desc: 'shop.subtitle', icon: '🛒' },
};

/** The card's live status line, assembled from the view's numbers. */
function statusLine(card: PvpHubCardView): string {
  const status = card.status;
  switch (status.kind) {
    case 'arena':
      return `${status.credits.toLocaleString()} ${t('arena.credits')} · #${status.place.toLocaleString()} · ${
        status.attemptsLeft
      }/${status.attemptsPerDay} ${t('arena.attempts')}`;
    case 'ranked':
      return `${status.region} · ${status.tier} · ${status.score} ${t('ranked.score')} · ${status.attemptsLeft}/${
        status.attemptsPerDay
      } ${t('ranked.attempts')}`;
    case 'shop':
      return `${status.tokens.toLocaleString()} ${currencyLabel.arenaToken}`;
    case 'locked':
      return `${t('pvp.status.locked')} ${status.chapter}`;
    default:
      return t('pvp.status.soon');
  }
}

export default function Pvp() {
  const { call } = useServer();
  const [view, setView] = useState<PvpHubView | null>(null);

  const refresh = useCallback(async () => {
    const result = await call((s) => s.getPvpHub());
    if (result.ok) setView(result.value);
  }, [call]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!view) {
    return (
      <main className="main">
        <h1 className="page-title">{t('pvp.title')}</h1>
        <p className="muted">{t('combat.loading')}</p>
      </main>
    );
  }

  return (
    <main className="main">
      <h1 className="page-title">{t('pvp.title')}</h1>
      <p className="muted">{t('pvp.subtitle')}</p>
      <div className="town-grid">
        {view.cards.map((card) => {
          const copy = COPY[card.id];
          const body = (
            <>
              <span className="town-icon" aria-hidden>
                {copy.icon}
              </span>
              <span className="town-label">{t(copy.title)}</span>
              <span className="muted town-desc">{t(copy.desc)}</span>
              <span className="muted town-desc">{statusLine(card)}</span>
            </>
          );
          return card.route === null ? (
            <div key={card.id} className="town-tile town-tile-wide" aria-disabled="true">
              {body}
            </div>
          ) : (
            <Link key={card.id} className="town-tile town-tile-wide" to={card.route}>
              {body}
            </Link>
          );
        })}
      </div>
    </main>
  );
}

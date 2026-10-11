import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CURRENCY_IDS } from '@wildbound/engine';
import { currencyLabel, t } from '../i18n';
import { useServer } from '../server/ServerProvider';

/** A UTC clock, so the header time matches the server's clock domain (PROMPT §5). */
function formatUtc(date: Date): string {
  return `${date.toISOString().slice(11, 19)} UTC`;
}

/**
 * Persistent top HUD (PROMPT §11): brand + UTC clock, the player card, and
 * currency pills that debug-grant on the `+` button.
 */
export default function Hud() {
  const { snapshot, run, busy } = useServer();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <header className="hud">
      <div className="hud-top">
        <Link to="/" className="hud-brand">
          {t('appName')}
        </Link>
        <span className="hud-tagline">{t('hud.beta')}</span>
        <span className="hud-clock">{formatUtc(now)}</span>
      </div>
      {snapshot && (
        <div className="hud-player-row">
          <span className="hud-player">
            {snapshot.state.profile.name} · {t('wild.level')}
            {snapshot.state.profile.level}
          </span>
          <div className="currency-bar">
            {CURRENCY_IDS.map((id) => (
              <span key={id} className={`currency-pill currency-${id}`}>
                <span className="currency-amount">{snapshot.state.currencies[id].toLocaleString()}</span>
                <span className="currency-name">{currencyLabel[id]}</span>
                <button
                  type="button"
                  className="currency-add"
                  disabled={busy}
                  aria-label={`Grant ${currencyLabel[id]}`}
                  onClick={() => void run((s) => s.grantCurrency(id))}
                >
                  +
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}

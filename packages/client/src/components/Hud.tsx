import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ECONOMY } from '@wildbound/content';
import { CURRENCY_IDS, levelProgress } from '@wildbound/engine';
import { currencyLabel, t } from '../i18n';
import { useServer } from '../server/ServerProvider';

/** A UTC clock, so the header time matches the server's clock domain (PROMPT §5). */
function formatUtc(date: Date): string {
  return `${date.toISOString().slice(11, 19)} UTC`;
}

/** Trainer XP progress bar (M5). */
function XpBar({ xp }: { xp: number }) {
  const { level, into, need } = levelProgress(xp, ECONOMY.xp);
  const pct = need > 0 ? Math.min(100, (into / need) * 100) : 100;
  return (
    <span className="hud-xp" title={`${into} / ${need} ${t('reward.xp')}`}>
      <span className="hud-xp-bar">
        <span className="hud-xp-fill" style={{ width: `${pct}%` }} />
      </span>
      <span className="hud-xp-text">
        {t('wild.level')}
        {level}
      </span>
    </span>
  );
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
          <span className="hud-player">{snapshot.state.profile.name}</span>
          <XpBar xp={snapshot.state.profile.xp} />
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

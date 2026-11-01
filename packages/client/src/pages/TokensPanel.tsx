import { t } from '../i18n';
import { useServer } from '../server/ServerProvider';

/**
 * R8: the source's six Trainer Tokens on the Trainer screen. PvP-only boosts; each level needs its Gods Trials
 * season's Suppression Treasure total (Gods Trials arrives in M13) and the token's own fragments.
 */
export default function TokensPanel() {
  const { snapshot, busy, run } = useServer();
  if (!snapshot) return null;
  return (
    <section className="card">
      <h2 className="section-title">{t('trainer.tokens')}</h2>
      <p className="muted">{t('tokens.note')}</p>
      <div className="gear-list">
        {snapshot.tokens.map((token) => (
          <div key={token.id} className="gear-row" data-token-id={token.id}>
            <div className="gear-head">
              <strong>{token.name}</strong>
              <span className="chip">
                {t('tokens.level')} {token.level}/{token.maxLevel}
              </span>
            </div>
            <p className="muted">{token.current ?? t('tokens.inactive')}</p>
            {token.next && (
              <>
                <p className="muted">
                  {t('tokens.next')}: {token.next.text}
                </p>
                <p className="muted">
                  {t('tokens.treasure')
                    .replace('{season}', String(token.season))
                    .replace('{have}', String(token.treasureTotal))
                    .replace('{need}', String(token.next.treasureTotal))}{' '}
                  · {token.fragmentName} {token.fragments}/{token.next.cost}
                </p>
                <div className="row-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy || token.blocked !== null}
                    onClick={() => void run((server) => server.levelToken(token.id))}
                  >
                    {t('tokens.levelUp')}
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

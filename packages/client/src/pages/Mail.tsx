import type { MailItem } from '@wildbound/engine';
import RewardLine from '../components/RewardLine';
import { t, tKey } from '../i18n';
import { useServer } from '../server/ServerProvider';

function expiry(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** System mail (M5, PROMPT §7.9): letters carrying reward attachments. */
export default function Mail() {
  const { snapshot, claim, busy } = useServer();
  const mail: MailItem[] = snapshot?.state.mail ?? [];
  const unclaimed = mail.filter((m) => !m.claimed);

  return (
    <main className="main">
      <div className="page-head">
        <h1 className="page-title">{t('mail.title')}</h1>
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy || unclaimed.length === 0}
          onClick={() => void claim((s) => s.claimAllMail())}
        >
          {t('mail.claimAll')}
        </button>
      </div>

      {mail.length === 0 ? (
        <p className="muted">{t('mail.empty')}</p>
      ) : (
        <ul className="mail-list">
          {mail.map((m) => (
            <li key={m.id} className={`card mail-item ${m.claimed ? 'mail-claimed' : ''}`}>
              <div className="mail-head">
                <strong>{tKey(m.subjectKey)}</strong>
                <span className="muted">{t('mail.expires')} {expiry(m.expiresAt)}</span>
              </div>
              <p className="muted">{tKey(m.bodyKey)}</p>
              <RewardLine rewards={m.grants} />
              <button
                type="button"
                className="btn"
                disabled={busy || m.claimed}
                onClick={() => void claim((s) => s.claimMail(m.id))}
              >
                {m.claimed ? t('mail.claimed') : t('mail.claim')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

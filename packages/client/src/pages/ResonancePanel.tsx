import { WILDS } from '@wildbound/content';
import { t } from '../i18n';
import { useServer } from '../server/ServerProvider';

/** M11.9: the account resonance board on the Trainer screen. */
export default function ResonancePanel() {
  const { snapshot, busy, run } = useServer();
  if (!snapshot) return null;
  const view = snapshot.resonance;
  const roster = snapshot.state.roster;
  const names = new Map(WILDS.map((wild) => [wild.id, wild.name]));
  const nextSlot = view.unlocked + 1;

  return (
    <section className="card">
      <h2 className="section-title">{t('trainer.resonance')}</h2>
      <p className="muted">{t('trainer.resonanceNote')}</p>
      <p className="muted">
        {t('trainer.resonance.crystal')}:{' '}
        {view.crystalUnlocked
          ? `${t('wild.level')} ${view.crystalLevel}`
          : t('trainer.resonance.crystalLocked')}
      </p>

      <div className="gear-list">
        {view.entries.map((entry) => {
          const selected = entry.wildId ?? '';
          return (
            <div key={entry.slot} className="gear-row">
              <div className="gear-head">
                <strong>
                  {t('trainer.resonance.slot')} {entry.slot + 1}
                </strong>
                {!entry.unlocked && <span className="chip">{t('trainer.resonance.locked')}</span>}
              </div>
              {entry.unlocked ? (
                <>
                  <label className="muted">
                    {t('trainer.resonance.slot')} {entry.slot + 1}
                    <select
                      aria-label={`${t('trainer.resonance.slot')} ${entry.slot + 1}`}
                      value={selected}
                      disabled={busy}
                      onChange={(event) =>
                        void run((server) =>
                          server.setResonanceSlot(entry.slot, event.target.value || null),
                        )
                      }
                    >
                      <option value="">{t('trainer.resonance.empty')}</option>
                      {roster.map((wild) => (
                        <option key={wild.id} value={wild.id}>
                          {names.get(wild.speciesId) ?? wild.speciesId} · {t('wild.level')} {wild.level}
                        </option>
                      ))}
                    </select>
                  </label>
                  {entry.wildId ? (
                    <p className="muted">
                      {t('trainer.resonance.bonus')}:{' '}
                      {entry.bonusText.length > 0
                        ? entry.bonusText.join(' · ')
                        : t('trainer.resonance.noBonus')}
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="muted">{t('trainer.resonance.lockedNote')}</p>
              )}
            </div>
          );
        })}
      </div>

      <div className="cost-row">
        <span>
          {t('currency.resonationShard')}: {view.balance.toLocaleString()}
        </span>
        {view.nextUnlockCost !== null && (
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={() => void run((server) => server.unlockResonanceSlot())}
          >
            {t('trainer.resonance.open')} {nextSlot} · {view.nextUnlockCost.toLocaleString()}{' '}
            {t('currency.resonationShard')}
          </button>
        )}
      </div>
    </section>
  );
}

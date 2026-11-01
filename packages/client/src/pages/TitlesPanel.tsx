import { useState } from 'react';
import type { TitleSlot } from '@wildbound/engine';
import { t } from '../i18n';
import { useServer } from '../server/ServerProvider';

/** R8: three title slots plus the source's 102 titles on the Trainer screen. */
export default function TitlesPanel() {
  const { snapshot, busy, run } = useServer();
  const [filter, setFilter] = useState<TitleSlot>('common');
  if (!snapshot) return null;
  const view = snapshot.titles;
  const rows = view.rows.filter((row) => row.slot === filter);

  return (
    <section className="card">
      <h2 className="section-title">{t('trainer.titles')}</h2>
      <p className="muted">{t('titles.note')}</p>
      <p className="muted">
        {t('titles.owned')}: {view.ownedCount}
      </p>

      <div className="gear-list">
        {view.slots.map((slot) => (
          <div key={slot.slot} className="gear-row">
            <div className="gear-head">
              <strong>{slot.label}</strong>
              {slot.expiresAt !== null && (
                <span className="chip">
                  {t('titles.expires')} {new Date(slot.expiresAt).toLocaleDateString()}
                </span>
              )}
            </div>
            <select
              aria-label={slot.label}
              value={slot.titleId ?? ''}
              disabled={busy}
              onChange={(event) =>
                void run((server) =>
                  server.setTitleSlot(slot.slot, event.target.value || null),
                )
              }
            >
              <option value="">{t('titles.empty')}</option>
              {view.rows
                .filter((row) => row.slot === slot.slot && row.owned)
                .map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
            </select>
            {slot.bonusText.length > 0 && (
              <p className="muted">{slot.bonusText.join(' · ')}</p>
            )}
          </div>
        ))}
      </div>

      <div className="row-actions" role="tablist" aria-label={t('titles.catalogue')}>
        {(['common', 'premium', 'rare'] as TitleSlot[]).map((slot) => (
          <button
            key={slot}
            type="button"
            role="tab"
            aria-selected={filter === slot}
            className={filter === slot ? 'btn btn-primary' : 'btn'}
            onClick={() => setFilter(slot)}
          >
            {slot === 'common' ? t('titles.common') : slot === 'premium' ? t('titles.premium') : t('titles.rare')}
          </button>
        ))}
      </div>

      <div className="gear-list">
        {rows.map((row) => (
          <div key={row.id} className="gear-row" data-title-id={row.id}>
            <div className="gear-head">
              <strong>{row.name}</strong>
              {row.durationDays !== null && (
                <span className="chip">
                  {row.durationDays} {t('titles.days')}
                </span>
              )}
              {row.maxStage > 1 && (
                <span className="chip">
                  {row.maxStage} {t('titles.stages')}
                </span>
              )}
            </div>
            <p className="muted">{row.bonusText.join(' · ')}</p>
            {row.owned && (
              <p className="muted">
                {t('titles.stage')} {row.stage}/{row.maxStage}
                {row.expiresAt !== null
                  ? ` · ${t('titles.expires')} ${new Date(row.expiresAt).toLocaleDateString()}`
                  : ` · ${t('titles.permanent')}`}
              </p>
            )}
            {!row.owned && row.earn && <p className="muted">{row.earn}</p>}
            {!row.owned &&
              (row.earnedHere ? (
                <p className="muted">
                  {t('titles.earnedHere')}: {row.earnedHere}
                </p>
              ) : (
                row.cards === 0 && <p className="muted">{t('titles.comingLater')}</p>
              ))}
            <div className="row-actions">
              {row.action && (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy || !row.canAct}
                  onClick={() => void run((server) => server.activateTitle(row.id))}
                >
                  {row.action === 'activate'
                    ? t('titles.activate')
                    : row.action === 'upgrade'
                      ? t('titles.upgrade')
                      : t('titles.continue')}
                  {row.nextCost !== null ? ` · ${t('titles.cards')} ${row.cards}/${row.nextCost}` : ''}
                </button>
              )}
              {row.owned && row.action === null && (
                <span className="muted">{t('titles.maxed')}</span>
              )}
              {row.owned && row.equippedSlot === null && (
                <button
                  type="button"
                  className="btn"
                  disabled={busy}
                  onClick={() => void run((server) => server.setTitleSlot(row.slot, row.id))}
                >
                  {t('titles.equip')}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

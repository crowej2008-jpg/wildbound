import { useCallback, useEffect, useState } from 'react';
import type { OriginSkillsView } from '@wildbound/server';
import { t } from '../../i18n';
import { useServer } from '../../server/ServerProvider';

const ROW_LABEL = {
  ult: 'origin.row.ult',
  basic: 'origin.row.basic',
  passive: 'origin.row.passive',
  talent4: 'origin.row.talent4',
} as const;

/**
 * E4: an Origin's four levelling skill rows (ult, basic skill, passive, Talent 4). LV.2 / LV.3 cost
 * 50 / 100 of the Origin's own shards (source: hero_origin_skill_up_json).
 */
export default function OriginSkillsPanel({ wildId, name }: { wildId: string; name: string }) {
  const { call, run, busy } = useServer();
  const [view, setView] = useState<OriginSkillsView | null>(null);

  const reload = useCallback(async () => {
    const result = await call((server) => server.getOriginSkills(wildId));
    if (result.ok) setView(result.value);
  }, [call, wildId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (!view) return <section className="card"><p className="muted">{t('origin.loading')}</p></section>;

  return (
    <section className="card">
      <p className="muted">
        {name} {t('origin.shards')}: {view.shards.toLocaleString()}
      </p>
      <ul className="gear-list">
        {view.rows.map((row) => (
          <li key={row.row} className="gear-row">
            <div className="gear-head">
              <strong>{row.name}</strong>
              <span className="chip">{t(ROW_LABEL[row.row])}</span>
              <span className="chip">LV.{row.level}/3</span>
            </div>
            {row.text.map((line, i) => (
              <p key={i} className={i < row.level ? '' : 'muted'}>
                {i > 0 && <strong>LV.{i + 1}: </strong>}
                {line}
              </p>
            ))}
            <div className="row-actions">
              {row.cost === null ? (
                <span className="muted">{t('origin.maxed')}</span>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy || view.shards < row.cost}
                  onClick={async () => {
                    if (await run((server) => server.upgradeOriginSkill(wildId, row.row))) await reload();
                  }}
                >
                  {t('origin.upgrade')} LV.{row.level + 1} · {row.cost} {t('origin.shards')}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <p className="muted">{t('origin.noSource')}</p>
    </section>
  );
}

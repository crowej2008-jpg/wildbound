import { t } from '../../i18n';
import type { GearPanelProps } from './types';

export default function PotentialPanel({ wildId, view, className, busy, run, reload }: GearPanelProps) {
  if (!view.unlocks.talents) {
    return (
      <section className="card">
        <p className="muted">
          {t('gear.locked')} {view.requirements.talents}
        </p>
      </section>
    );
  }

  const act = async (action: Parameters<GearPanelProps['run']>[0]) => {
    if (await run(action)) await reload();
  };
  const trees = view.trees.filter((tree) => tree.className === className);
  const current = view.loadout.treeId;
  const firstOpen = view.loadout.talents.findIndex((picked) => picked < 0);

  return (
    <section className="card">
      <p className="muted">
        {t('gear.potential.path')}: {current ? trees.find((tree) => tree.id === current)?.name ?? current : t('gear.potential.choose')}
      </p>
      <p className="muted">
        {t('gear.potential.duplicates')}: {view.fodderCount} · {t('gear.potential.shards')}: {view.potentialShards.toLocaleString()}
      </p>
      <div className="chip-list">
        {trees.map((tree) => (
          <button
            key={tree.id}
            type="button"
            className={current === tree.id ? 'chip chip-active' : 'chip'}
            disabled={busy}
            onClick={() => {
              if (current === tree.id) return;
              if (current && !window.confirm(t('gear.potential.switch'))) return;
              void act((server) => server.chooseTalentTree(wildId, tree.id));
            }}
          >
            {tree.name}
          </button>
        ))}
        {current && (
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() => void act((server) => server.resetTalents(wildId))}
          >
            {t('gear.potential.reset')} · {view.costs.talentResetGems} {t('currency.gems')} · +
            {view.talentResetRefund} {t('currency.potentialShard')}
          </button>
        )}
      </div>

      {current && (
        <ul className="gear-list">
          {view.talentTiers.map((tier) => {
            const pickable = firstOpen === -1 || tier.tier <= firstOpen;
            const alreadyPicked = tier.options.some((option) => option.chosen);
            const cost = alreadyPicked
              ? view.costs.talentRespecShards
              : view.costs.talentShardBase + tier.tier * view.costs.talentShardPerTier;
            const shortOnShards = view.potentialShards < cost;
            const shortOnFodder = !alreadyPicked && view.fodderCount < view.costs.talentFodderPerTier;
            return (
              <li key={tier.tier} className="gear-row">
                <div className="gear-head">
                  <strong>
                    {t('gear.potential.tier')} {tier.tier + 1}
                  </strong>
                  <span className="chip">
                    {alreadyPicked ? t('gear.potential.respec') : t('gear.potential.cost')} {cost.toLocaleString()}{' '}
                    {t('currency.potentialShard')}
                  </span>
                  {!alreadyPicked && (
                    <span className="chip">
                      {t('gear.potential.fodder')} {view.costs.talentFodderPerTier}
                    </span>
                  )}
                  {!pickable && <span className="chip">{t('gear.potential.locked')}</span>}
                  {pickable && (shortOnShards || shortOnFodder) && (
                    <span className="chip">{t('gear.potential.short')}</span>
                  )}
                </div>
                <div className="row-actions">
                  {tier.options.map((option, index) => (
                    <button
                      key={option.blockId}
                      type="button"
                      className={option.chosen ? 'chip chip-active' : 'chip'}
                      disabled={busy || !pickable || (!option.chosen && (shortOnShards || shortOnFodder))}
                      onClick={() => void act((server) => server.allocateTalent(wildId, tier.tier, index))}
                    >
                      {option.text}
                    </button>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

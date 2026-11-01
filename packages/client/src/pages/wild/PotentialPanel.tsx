import { useCallback, useEffect, useState } from 'react';
import type { PotentialFodderView, PotentialView } from '@wildbound/server';
import { t } from '../../i18n';
import { useServer } from '../../server/ServerProvider';

/**
 * R4: the source's Potential — nine tiers of three options. A tier opens at 6 + N stars; Unlock
 * takes its fodder and Potential Shards (option at Lv 1), Level Up takes it to Lv 6 with shards.
 */
function fodderText(f: PotentialFodderView): string {
  const who = f.req.own ? t('gear.potential.ownCopy') : f.req.faction ? t(`faction.${f.req.faction}`) : t('gear.potential.any');
  return `${f.have}/${f.req.count} × ${f.req.star}★ ${who}`;
}

export default function PotentialPanel({ wildId, onChange }: { wildId: string; onChange?: () => Promise<unknown> }) {
  const { call, run, busy } = useServer();
  const [view, setView] = useState<PotentialView | null>(null);
  const [choice, setChoice] = useState<Record<number, number>>({});

  const reload = useCallback(async () => {
    const result = await call((server) => server.getPotential(wildId));
    if (result.ok) setView(result.value);
  }, [call, wildId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const act = async (action: Parameters<typeof run>[0]) => {
    if (await run(action)) {
      await reload();
      await onChange?.();
    }
  };

  if (!view) return <section className="card"><p className="muted">{t('gear.potential.loading')}</p></section>;
  if (!view.hasTree) return <section className="card"><p className="muted">{t('gear.potential.none')}</p></section>;
  if (!view.panelOpen) {
    return (
      <section className="card">
        <p className="muted">
          {t('gear.potential.opensAt')} {view.tiers[0]?.unlockStar}★
        </p>
      </section>
    );
  }

  const developed = view.tiers.some((tier) => tier.pick !== null);
  return (
    <section className="card">
      <p className="muted">
        {t('gear.potential.shards')}: {view.shards.toLocaleString()} · {t('gear.potential.cores')}: {view.cores}
      </p>
      <ul className="gear-list">
        {view.tiers.map((tier) => {
          const picked = tier.pick;
          const selected = picked?.option ?? choice[tier.tier] ?? 0;
          return (
            <li key={tier.tier} className="gear-row" data-testid={`potential-tier-${tier.tier + 1}`}>
              <div className="gear-head">
                <strong>
                  {t('gear.potential.tier')} {tier.tier + 1}
                </strong>
                <span className="chip">{tier.unlockStar}★</span>
                {picked && <span className="chip">Lv.{picked.lv}/6</span>}
                {!tier.open && <span className="chip">{t('gear.potential.locked')}</span>}
              </div>
              <div className="row-actions">
                {tier.options.map((option, index) => (
                  <button
                    key={option.id}
                    type="button"
                    className={selected === index ? 'chip chip-active' : 'chip'}
                    disabled={busy || picked !== null || !tier.open}
                    aria-pressed={selected === index}
                    onClick={() => setChoice((c) => ({ ...c, [tier.tier]: index }))}
                  >
                    {option.name}
                  </button>
                ))}
              </div>
              <p className={picked ? '' : 'muted'}>{tier.options[selected]?.text}</p>
              {picked ? (
                <div className="row-actions">
                  {tier.levelShards === null ? (
                    <span className="muted">{t('gear.potential.maxed')}</span>
                  ) : (
                    <button
                      type="button"
                      className="btn"
                      disabled={busy || view.shards < tier.levelShards}
                      onClick={() => void act((server) => server.levelPotential(wildId, tier.tier))}
                    >
                      {t('gear.potential.levelUp')} · {tier.levelShards.toLocaleString()} {t('currency.potentialShard')}
                    </button>
                  )}
                </div>
              ) : (
                tier.open && (
                  <div className="row-actions">
                    <span className="muted">
                      {tier.fodder.map(fodderText).join(' · ')}
                      {tier.coresNeeded > 0 && ` · ${t('gear.potential.coresNeeded')} ${tier.coresNeeded}`}
                    </span>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={busy || !tier.canUnlock}
                      onClick={() => void act((server) => server.unlockPotential(wildId, tier.tier, selected))}
                    >
                      {t('gear.potential.unlock')} · {tier.unlockShards.toLocaleString()} {t('currency.potentialShard')}
                    </button>
                  </div>
                )
              )}
            </li>
          );
        })}
      </ul>
      {developed && (
        <button
          type="button"
          className="btn"
          disabled={busy || view.gems < view.resetGems}
          onClick={() => {
            if (!window.confirm(t('gear.potential.resetConfirm'))) return;
            void act((server) => server.resetPotential(wildId));
          }}
        >
          {t('gear.potential.reset')} · {view.resetGems} {t('currency.gems')}
        </button>
      )}
    </section>
  );
}

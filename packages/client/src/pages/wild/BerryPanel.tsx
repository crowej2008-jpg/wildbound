import { useCallback, useEffect, useState } from 'react';
import type { BerriesPanelView, BerryView } from '@wildbound/server';
import { t, tKey } from '../../i18n';
import { useServer } from '../../server/ServerProvider';

/**
 * R6d: the source's berries — two slots (never two of one type), and per berry the four source tabs:
 * Cultivate (Berry Essence grows the lines to their caps), Breakthrough (+1…+4, trainer level and Mulch;
 * opens a line), Elevation (stars from spare 1★ berries and Gold) and Reforge (re-roll a line's kind).
 */

function statName(field: string): string {
  const label = tKey(`stat.${field}`);
  return label === `stat.${field}` ? field : label;
}

function amount(field: string, value: number): string {
  if (['hp', 'pAtk', 'sAtk'].includes(field)) return Math.round(value).toLocaleString();
  return `${(Math.round(value * 10000) / 100).toString()}%`;
}

function BerryCard({
  berry,
  view,
  act,
  busy,
  onEquip,
}: {
  berry: BerryView;
  view: BerriesPanelView;
  act: (fn: Parameters<ReturnType<typeof useServer>['run']>[0]) => Promise<void>;
  busy: boolean;
  onEquip?: () => void;
}) {
  const stars = berry.maxStar > 0 ? `${berry.star}★` : t('gear.berry.fixed');
  return (
    <div className="gear-row" data-berry={berry.id}>
      <div className="gear-head">
        <strong>
          {berry.name}
          {berry.stage > 0 ? ` (+${berry.stage})` : ''}
        </strong>
        <span className="chip">{tKey(`gear.berry.tier.${berry.tier}`)}</span> <span className="chip">{stars}</span>
        {berry.locked ? <span className="chip">{t('gear.berry.locked')}</span> : null}
      </div>
      {berry.skill ? (
        <p className="muted">
          <strong>{berry.skill.name}:</strong> {berry.skill.text}
        </p>
      ) : null}
      {berry.cultivatable ? (
        <p className="muted">
          {statName('hp')} +{berry.stats.hp.toLocaleString()} · {statName('pAtk')} +{berry.stats.pAtk.toLocaleString()} ·{' '}
          {statName('sAtk')} +{berry.stats.sAtk.toLocaleString()}
        </p>
      ) : null}
      {berry.lines.length > 0 ? (
        <ul className="berry-lines">
          {berry.lines.map((l, i) => (
            <li key={i}>
              {statName(l.field)} {amount(l.field, l.value)} / {amount(l.field, l.cap)}{' '}
              <button
                type="button"
                className="btn btn-small"
                disabled={busy || view.reforgePotions < l.reforgeCost}
                onClick={() => void act((s) => s.reforgeBerry(berry.id, i))}
              >
                {t('gear.berry.reforge')} · {l.reforgeCost}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="row-actions">
        {onEquip ? (
          <button type="button" className="btn btn-primary" disabled={busy} onClick={onEquip}>
            {t('gear.berry.carry')}
          </button>
        ) : null}
        {berry.cultivatable ? (
          <>
            <button
              type="button"
              className="btn"
              disabled={busy || view.essence < view.cultivateEssence || berry.progress >= 1}
              onClick={() => void act((s) => s.cultivateBerry(berry.id, 1))}
            >
              {t('gear.berry.cultivate')} · {view.cultivateEssence}
            </button>
            <button
              type="button"
              className="btn"
              disabled={busy || view.essence < view.cultivateEssence * view.fastCultivateTimes || berry.progress >= 1}
              onClick={() => void act((s) => s.cultivateBerry(berry.id, view.fastCultivateTimes))}
            >
              {t('gear.berry.fast')} ×{view.fastCultivateTimes}
            </button>
          </>
        ) : null}
        {berry.breakthrough ? (
          <button
            type="button"
            className="btn"
            disabled={busy || !berry.breakthrough.open || (view.mulch[berry.breakthrough.currency] ?? 0) < berry.breakthrough.amount}
            onClick={() => void act((s) => s.breakthroughBerry(berry.id))}
          >
            {t('gear.berry.breakthrough')} +{berry.breakthrough.stage} · {berry.breakthrough.amount}{' '}
            {tKey(`currency.${berry.breakthrough.currency}`)}
            {berry.breakthrough.open ? '' : ` (${t('gear.berry.trainerLv')} ${berry.breakthrough.trainerLevel})`}
          </button>
        ) : null}
        {berry.elevate ? (
          <button
            type="button"
            className="btn"
            disabled={
              busy ||
              berry.elevate.freeSame < berry.elevate.sameCopies ||
              berry.elevate.freeAny < berry.elevate.anyCopies ||
              view.gold < berry.elevate.gold
            }
            onClick={() => void act((s) => s.elevateBerry(berry.id))}
          >
            {t('gear.berry.elevate')} · {berry.elevate.sameCopies}+{berry.elevate.anyCopies} {t('gear.berry.copies')} ·{' '}
            {berry.elevate.gold.toLocaleString()} {t('currency.gold')}
          </button>
        ) : null}
        <button type="button" className="btn" disabled={busy} onClick={() => void act((s) => s.lockBerry(berry.id, !berry.locked))}>
          {berry.locked ? t('gear.berry.unlock') : t('gear.berry.lock')}
        </button>
        {berry.dismantleEssence !== null ? (
          <button type="button" className="btn" disabled={busy} onClick={() => void act((s) => s.dismantleBerries([berry.id]))}>
            {t('gear.berry.dismantle')} · {berry.dismantleEssence}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function BerryPanel({ wildId, onChange }: { wildId: string; onChange?: () => Promise<unknown> }) {
  const { call, run, busy } = useServer();
  const [view, setView] = useState<BerriesPanelView | null>(null);
  const [picking, setPicking] = useState<number | null>(null);

  const reload = useCallback(async () => {
    const result = await call((server) => server.getBerries(wildId));
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

  if (!view) return <section className="card"><p className="muted">{t('gear.berry.loading')}</p></section>;
  if (!view.unlocked) {
    return (
      <section className="card">
        <p className="muted">
          {t('gear.locked')} {view.starsNeeded}★.
        </p>
      </section>
    );
  }
  const byId = new Map(view.berries.map((b) => [b.id, b]));
  const carriedTypes = (slot: number) =>
    new Set(view.slots.filter((id, i) => i !== slot && id).map((id) => byId.get(id!)?.typeId));
  return (
    <section className="card">
      <h3>{t('gear.berry.slots')}</h3>
      <p className="muted">
        {t('currency.berryEssence')}: {view.essence.toLocaleString()} · {t('currency.reforgePotion')}:{' '}
        {view.reforgePotions.toLocaleString()} · {t('gear.berry.trainerLv')} {view.trainerLevel}
      </p>
      {view.slots.map((id, slot) => {
        const berry = id ? byId.get(id) : undefined;
        return (
          <div key={slot} className="gear-slot" aria-label={`${t('gear.berry.slot')} ${slot + 1}`}>
            <span className="muted">
              {t('gear.berry.slot')} {slot + 1}
            </span>
            {berry ? (
              <>
                <BerryCard berry={berry} view={view} act={act} busy={busy} />
                <button type="button" className="btn" disabled={busy} onClick={() => void act((s) => s.equipBerry(wildId, slot, null))}>
                  {t('gear.berry.remove')}
                </button>
              </>
            ) : (
              <button type="button" className="btn" disabled={busy} onClick={() => setPicking(slot)}>
                {t('gear.berry.choose')}
              </button>
            )}
            {picking === slot ? (
              <div className="berry-picker">
                {view.berries
                  .filter((b) => !b.equippedOn && !carriedTypes(slot).has(b.typeId))
                  .map((b) => (
                    <BerryCard
                      key={b.id}
                      berry={b}
                      view={view}
                      act={act}
                      busy={busy}
                      onEquip={() => {
                        setPicking(null);
                        void act((s) => s.equipBerry(wildId, slot, b.id));
                      }}
                    />
                  ))}
              </div>
            ) : null}
          </div>
        );
      })}
      <h3>{t('gear.berry.bag')}</h3>
      {view.berries.filter((b) => !b.equippedOn).length === 0 ? <p className="muted">{t('gear.berry.none')}</p> : null}
      {view.berries
        .filter((b) => !b.equippedOn)
        .map((b) => (
          <BerryCard key={b.id} berry={b} view={view} act={act} busy={busy} />
        ))}
    </section>
  );
}

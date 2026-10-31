import { useState } from 'react';
import type { RelicView } from '@wildbound/server';
import { factionLabel, t, tierLabel } from '../../i18n';
import PlatePanel from './PlatePanel';
import TrinketPanel from './TrinketPanel';
import type { GearPanelProps } from './types';

type SubTab = 'held' | 'plates' | 'trinkets';

const TIER_RANK = ['common', 'rare', 'epic', 'legendary', 'supreme', 'mythic', 'origin'];

/** A per-ten-thousand value as a percent: 1067 → "10.67%". */
function pct(value: number, scale: number): string {
  return `${((value / scale) * 100).toFixed(2)}%`;
}

function fill(text: string, values: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));
}

/** Held Items, Plates and Trinkets share the Wild screen's Held Items tab. */
export default function HeldItemPanel(props: GearPanelProps) {
  const { wildId, view, className, busy, run, reload } = props;
  const [sub, setSub] = useState<SubTab>('held');
  // The source's equip list: this class only, best quality first, then level.
  const items = view.relics
    .filter((relic) => relic.className === className)
    .sort(
      (a, b) =>
        Number(b.equippedOn === wildId) - Number(a.equippedOn === wildId) ||
        TIER_RANK.indexOf(b.tier) - TIER_RANK.indexOf(a.tier) ||
        b.level - a.level,
    );
  const act = async (action: Parameters<GearPanelProps['run']>[0]) => {
    if (await run(action)) await reload();
  };

  return (
    <section className="card">
      <div className="tabs tabs-scroll">
        {(
          [
            ['held', 'gear.sub.held'],
            ['plates', 'gear.sub.plates'],
            ['trinkets', 'gear.sub.trinkets'],
          ] as const
        ).map(([id, key]) => (
          <button
            key={id}
            type="button"
            className={sub === id ? 'tab tab-active' : 'tab'}
            onClick={() => setSub(id)}
          >
            {t(key)}
          </button>
        ))}
      </div>

      {sub === 'held' &&
        (!view.unlocks.relic ? (
          <p className="muted">
            {t('gear.locked')} {tierLabel[view.requirements.relic]}
          </p>
        ) : (
          <>
            <p className="muted">
              {t('currency.heldItemShard')}: {view.heldItemShards.toLocaleString()} · {t('currency.resetterShard')}:{' '}
              {view.resetterShards.toLocaleString()} · {t('currency.heldItemResetter')}:{' '}
              {view.heldItemResetters.toLocaleString()}
            </p>
            {view.resetterShards >= view.resetterCompound && (
              <div className="row-actions">
                <button
                  type="button"
                  className="btn"
                  disabled={busy}
                  onClick={() => void act((server) => server.compoundResetters(1))}
                >
                  {fill(t('held.compound'), { count: view.resetterCompound })}
                </button>
              </div>
            )}
            {items.length === 0 ? (
              <p className="muted">{t('gear.noItems')}</p>
            ) : (
              <ul className="gear-list">
                {items.map((item) => (
                  <HeldRow key={item.instanceId} item={item} {...props} act={act} />
                ))}
              </ul>
            )}
          </>
        ))}

      {sub === 'plates' && <PlatePanel {...props} />}
      {sub === 'trinkets' && <TrinketPanel {...props} />}
    </section>
  );
}

interface RowProps extends GearPanelProps {
  item: RelicView;
  act: (action: Parameters<GearPanelProps['run']>[0]) => Promise<void>;
}

function HeldRow({ item, wildId, view, busy, act }: RowProps) {
  const scale = view.heldScale;
  const worn = item.equippedOn === wildId;
  const elsewhere = item.equippedOn !== null && item.equippedOn !== wildId;
  const refineLabel =
    item.refineCost === null
      ? null
      : item.refineCost === 0
        ? t('held.refineFree')
        : `${item.refineCost} ${t('held.resetters')}`;

  return (
    <li className="gear-row">
      <div className="gear-head">
        <strong>{item.name}</strong>
        <span className={`chip tier-${item.tier}`}>{tierLabel[item.tier]}</span>
        <span className="chip">
          Lv{item.level}/{item.maxLevel}
        </span>
        {worn && <span className="chip chip-on">{t('gear.equip')}</span>}
        {elsewhere && <span className="chip">{t('gear.inUse')}</span>}
        {item.locked && <span className="chip">{t('held.locked')}</span>}
      </div>

      <p className="held-main">
        {item.main.map((m) => (
          <span key={m.name}>
            {m.name} +{m.percent ? pct(m.value, scale) : m.value.toLocaleString()}{' '}
          </span>
        ))}
      </p>

      <p className="muted">
        {t('held.lines')}
        {item.refineSlots > 0 &&
          ` · ${t('held.slots')} ${item.refineSlotsUsed}/${item.refineSlots} · ${t('held.refinesLeft')} ${item.refines}/${item.maxRefine}`}
      </p>
      <ul className="held-lines">
        {item.lines.map((line) => (
          <li key={line.slot} className={line.counts ? 'held-line' : 'held-line muted'}>
            <span>
              {line.name} +{pct(line.value, scale)}
            </span>{' '}
            <small className="muted">
              ({pct(line.min, scale)}–{pct(line.max, scale)})
              {!line.counts && line.faction && ` · ${fill(t('held.otherFaction'), { faction: factionLabel[line.faction] })}`}
            </small>
            {worn && line.refinable && refineLabel && !item.pending && (
              <button
                type="button"
                className="btn btn-small"
                disabled={busy}
                onClick={() => void act((server) => server.refineRelic(item.instanceId, line.slot))}
              >
                {t('gear.refine')} · {refineLabel}
              </button>
            )}
          </li>
        ))}
      </ul>
      {!worn && item.refineSlots > 0 && <p className="muted">{t('held.wearOnly')}</p>}

      {item.pending && (
        <div className="held-pending">
          <p>
            {t('held.newLine')} ({item.lines[item.pending.slot]?.name}): <strong>{item.pending.name}</strong> +
            {pct(item.pending.value, scale)}{' '}
            <small className="muted">
              ({pct(item.pending.min, scale)}–{pct(item.pending.max, scale)})
            </small>
          </p>
          <div className="row-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={() => void act((server) => server.settleRefine(item.instanceId, true))}
            >
              {t('held.keep')}
            </button>
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() => void act((server) => server.settleRefine(item.instanceId, false))}
            >
              {t('held.drop')}
            </button>
          </div>
        </div>
      )}

      {item.skill && (
        <p className="muted">
          <strong>{item.skill.name}</strong>: {item.skill.text}
          {!item.skill.active && ` (${t('held.skillInactive')})`}
          {item.skill.standIn && (
            <small>
              {' '}
              ({t('held.standIn')}: {item.skill.standIn})
            </small>
          )}
        </p>
      )}

      <div className="row-actions">
        <button
          type="button"
          className={worn ? 'btn' : 'btn btn-primary'}
          disabled={busy}
          onClick={() => {
            if (worn) {
              void act((server) => server.equipRelic(wildId, null));
              return;
            }
            if (elsewhere && !window.confirm(t('gear.confirmMove'))) return;
            void act((server) => server.equipRelic(wildId, item.instanceId, elsewhere));
          }}
        >
          {worn ? t('gear.unequip') : t('gear.equip')}
        </button>
        {item.levelCost === null ? (
          <span className="muted">{t('held.maxLevel')}</span>
        ) : item.levelGate > view.resonanceLevel ? (
          <span className="muted">{fill(t('held.needResonance'), { level: item.levelGate })}</span>
        ) : (
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() => void act((server) => server.levelRelic(item.instanceId))}
          >
            {t('gear.level')} · {item.levelCost.toLocaleString()} {t('currency.heldItemShard')}
          </button>
        )}
        <button
          type="button"
          className="btn"
          disabled={busy}
          onClick={() => void act((server) => server.lockRelic(item.instanceId))}
        >
          {item.locked ? t('held.unlock') : t('held.lock')}
        </button>
        {item.equippedOn === null && !item.locked && (
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() => {
              if (!window.confirm(fill(t('held.confirmDismantle'), { shards: item.dismantleShards }))) return;
              void act((server) => server.dismantleRelics([item.instanceId]));
            }}
          >
            {t('held.dismantle')}
          </button>
        )}
      </div>
    </li>
  );
}

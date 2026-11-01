import { useCallback, useEffect, useState } from 'react';
import type { FashionSlot } from '@wildbound/content';
import type { FashionView } from '@wildbound/server';
import { currencyLabel, t } from '../i18n';
import { useServer } from '../server/ServerProvider';

const SLOTS: FashionSlot[] = ['mount', 'backDecor', 'follower', 'outfit'];
const STONE = { mount: 'mountStone', backDecor: 'backDecorStone', follower: 'followerStone' } as const;
const pct = (v: number) => `${Math.round(v * 1000) / 10}%`;

/**
 * R8: Mount / Back Decor / Follower / Outfits on the Trainer screen. The pieces and sets are the source's; the level
 * curve and piece stats are made up (owner, 2026-11-01). Pieces come from events (M15).
 */
export default function FashionPanel() {
  const { call, run, snapshot, busy } = useServer();
  const [view, setView] = useState<FashionView | null>(null);
  const [slot, setSlot] = useState<FashionSlot>('mount');

  const refresh = useCallback(async () => {
    const result = await call((s) => s.getFashion());
    if (result.ok) setView(result.value);
  }, [call]);

  useEffect(() => {
    void refresh();
  }, [refresh, snapshot?.state.fashion, snapshot?.state.currencies]);

  if (!view) return null;
  const sets = view.sets.filter((s) => s.reached !== null);
  return (
    <section className="card">
      <h2 className="section-title">{t('trainer.fashion')}</h2>
      <p className="muted">{t('fashion.note')}</p>
      <div className="gear-list">
        {view.ladders.map((l) => (
          <div key={l.slot} className="gear-row" data-fashion-ladder={l.slot}>
            <div className="gear-head">
              <strong>{t(`fashion.slot.${l.slot}`)}</strong>
              <span className="chip">
                Lv.{l.level} · {t('fashion.tier').replace('{tier}', String(l.tier)).replace('{star}', String(l.star))}
              </span>
            </div>
            <p className="muted">
              HP +{l.current.hp.toLocaleString()} · {t('fashion.attack')} +{l.current.atk.toLocaleString()} · HP {pct(l.current.pct)} ·{' '}
              {t('fashion.attack')} {pct(l.current.pct)}
            </p>
            {l.next ? (
              <div className="row-actions">
                <span className="muted">
                  {currencyLabel[STONE[l.slot]]} {l.stones.toLocaleString()}/{l.cost.toLocaleString()}
                </span>
                <button type="button" className="btn btn-primary" disabled={busy || l.stones < l.cost} onClick={() => void run((s) => s.levelFashion(l.slot, 1))}>
                  {t('fashion.levelUp')}
                </button>
                <button type="button" className="btn" disabled={busy || l.stones < l.cost} onClick={() => void run((s) => s.levelFashion(l.slot, 10))}>
                  {t('fashion.levelUp10')}
                </button>
              </div>
            ) : (
              <p className="muted">{t('fashion.max')}</p>
            )}
          </div>
        ))}
      </div>

      <div className="row-actions" role="tablist" aria-label={t('fashion.pieces')}>
        {SLOTS.map((s) => (
          <button key={s} type="button" role="tab" aria-selected={slot === s} className={slot === s ? 'btn btn-primary' : 'btn'} onClick={() => setSlot(s)}>
            {t(`fashion.slot.${s}`)}
          </button>
        ))}
      </div>
      <div className="gear-list">
        {view.pieces
          .filter((p) => p.slot === slot)
          .map((p) => (
            <div key={p.index} className="gear-row" data-fashion-piece={`${p.slot}:${p.index}`}>
              <div className="gear-head">
                <strong>{p.name}</strong>
                {p.owned && !p.free && <span className="chip">{p.star}★</span>}
                {p.worn && <span className="chip">{t('fashion.worn')}</span>}
              </div>
              {!p.free && (
                <p className="muted">
                  {p.bonus.pct > 0 ? `${p.bonus.pctStat === 'hpPct' ? t('fashion.pokemonHp') : t('fashion.pokemonAttack')} +${pct(p.bonus.pct)} · ` : ''}
                  HP +{p.bonus.hp.toLocaleString()} · {t('fashion.attack')} +{p.bonus.atk.toLocaleString()}
                  {p.owned ? '' : ` · ${t('fashion.eventRewards')}`}
                </p>
              )}
              <div className="row-actions">
                {p.nextCost !== null && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy || p.shards < p.nextCost}
                    onClick={() => void run((s) => s.ascendFashionPiece(p.slot, p.index))}
                  >
                    {p.owned ? t('fashion.ascend') : t('fashion.activate')} · {t('fashion.shards')} {p.shards}/{p.nextCost}
                  </button>
                )}
                {p.owned && !p.worn && (
                  <button type="button" className="btn" disabled={busy} onClick={() => void run((s) => s.wearFashionPiece(p.slot, p.index))}>
                    {t('fashion.wear')}
                  </button>
                )}
              </div>
            </div>
          ))}
      </div>
      <p className="muted">
        {t('fashion.sets').replace('{n}', String(sets.length))}
        {sets.length > 0 ? `: ${sets.map((s) => `${s.name} (${s.reached})`).join(' · ')}` : ''}
      </p>
    </section>
  );
}

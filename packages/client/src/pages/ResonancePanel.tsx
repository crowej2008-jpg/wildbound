import { useState } from 'react';
import { t } from '../i18n';
import { useServer } from '../server/ServerProvider';

/**
 * R7: the source's Resonance on the Trainer screen — the top six set the crystal level (until it evolves at
 * Lv 340, then it is levelled directly), and every Pokémon in a slot takes that level.
 */
export default function ResonancePanel() {
  const { snapshot, busy, run } = useServer();
  const [picking, setPicking] = useState<number | null>(null);
  if (!snapshot) return null;
  const view = snapshot.resonance;
  const now = Date.now();

  return (
    <section className="card">
      <h2 className="section-title">{t('trainer.resonance')}</h2>
      <p className="muted">{view.evolved ? t('resonance.noteEvolved') : t('resonance.note')}</p>
      <p>
        <strong>
          {t('resonance.crystalLevel')}: {view.crystalLevel}
        </strong>
        {view.evolved && view.cap !== null ? ` / ${view.cap}` : ''}
      </p>
      {!view.evolved ? (
        <button type="button" className="btn btn-primary" disabled={busy || !view.canEvolve} onClick={() => void run((s) => s.evolveResonance())}>
          {t('resonance.evolve')} ({t('resonance.evolveNeeds').replace('{level}', String(view.evolutionLevel))})
        </button>
      ) : null}
      {view.evolved && view.pokemonNeeded ? (
        <p className="muted">
          {t('resonance.needStars')
            .replace('{stars}', String(view.pokemonNeeded.stars))
            .replace('{have}', String(view.pokemonNeeded.have))
            .replace('{need}', String(view.pokemonNeeded.need))}
        </p>
      ) : null}
      {view.upgrade ? (
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void run((s) => s.upgradeResonance())}>
          {t('resonance.upgrade')} · {view.upgrade.candy.toLocaleString()} {t('currency.candy')} ·{' '}
          {view.upgrade.gold.toLocaleString()} {t('currency.gold')} · {view.upgrade.stones.toLocaleString()} {t('currency.stone')}
        </button>
      ) : null}

      <h3>{t('resonance.topSix')}</h3>
      <ul className="resonance-top">
        {view.topSix.map((w) => (
          <li key={w.wildId}>
            {w.name} · {t('wild.level')} {w.level}
          </li>
        ))}
      </ul>

      <h3>
        {t('resonance.slots')} {view.slots.length}/{view.maxSlots}
      </h3>
      <p className="muted">
        {t('currency.resonationShard')}: {view.balances.resonationShard.toLocaleString()}
      </p>
      <div className="gear-list">
        {view.slots.map((slot) => (
          <div key={slot.slot} className="gear-row" aria-label={`${t('trainer.resonance.slot')} ${slot.slot + 1}`}>
            <div className="gear-head">
              <strong>
                {t('trainer.resonance.slot')} {slot.slot + 1}
              </strong>
              <span>{slot.wildName ?? t('trainer.resonance.empty')}</span>
            </div>
            {slot.wildId ? (
              <>
                <p className="muted">
                  {t('resonance.ownLevel')}: {slot.ownLevel}
                </p>
                <button type="button" className="btn" disabled={busy} onClick={() => void run((s) => s.setResonanceSlot(slot.slot, null))}>
                  {t('resonance.takeOut')}
                </button>
              </>
            ) : slot.cooldownEndsAt && slot.cooldownEndsAt > now ? (
              <>
                <p className="muted">
                  {t('resonance.cooldown').replace('{hours}', String(Math.ceil((slot.cooldownEndsAt - now) / 3_600_000)))}
                </p>
                <button type="button" className="btn" disabled={busy} onClick={() => void run((s) => s.clearResonanceCooldown(slot.slot))}>
                  {t('resonance.clear')} · {slot.clearGems} {t('currency.gems')}
                </button>
              </>
            ) : picking === slot.slot ? (
              <select
                aria-label={t('resonance.choose')}
                defaultValue=""
                onChange={(event) => {
                  const id = event.target.value;
                  setPicking(null);
                  if (id) void run((s) => s.setResonanceSlot(slot.slot, id));
                }}
              >
                <option value="">{t('resonance.choose')}</option>
                {view.candidates.map((c) => (
                  <option key={c.wildId} value={c.wildId}>
                    {c.name} · {t('wild.level')} {c.level}
                  </option>
                ))}
              </select>
            ) : (
              <button type="button" className="btn" disabled={busy} onClick={() => setPicking(slot.slot)}>
                {t('resonance.choose')}
              </button>
            )}
          </div>
        ))}
      </div>
      {view.nextSlot ? (
        <button type="button" className="btn" disabled={busy} onClick={() => void run((s) => s.buyResonanceSlot())}>
          {t('trainer.resonance.open')} ·{' '}
          {view.balances.resonationShard >= view.nextSlot.shards
            ? `${view.nextSlot.shards} ${t('currency.resonationShard')}`
            : `${view.nextSlot.gems} ${t('currency.gems')}`}
        </button>
      ) : null}
    </section>
  );
}

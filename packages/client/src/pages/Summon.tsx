import { useCallback, useEffect, useMemo, useState } from 'react';
import { WILDS } from '@wildbound/content';
import type { DrawResult, MachineId, Tier } from '@wildbound/engine';
import type { GachaMachineView, GachaView } from '@wildbound/server';
import RewardLine from '../components/RewardLine';
import { currencyLabel, t, tierLabel, type CurrencyKey, type TierKey } from '../i18n';
import { useServer } from '../server/ServerProvider';
import { species } from '../wilds';

const tierName = (tier: Tier): string => tierLabel[tier as TierKey];
const pct = (value: number): string => `${(value * 100).toFixed(2)}%`;

/** `mm:ss` (or `h:mm:ss`) until an epoch, for the free-draw cooldown. */
function formatWait(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function ProgressBar({ value, className }: { value: number; className: string }) {
  return (
    <span className={`progress ${className}`}>
      <span className="progress-fill" style={{ width: `${Math.min(100, value * 100)}%` }} />
    </span>
  );
}

/** One summon machine card (M6, PROMPT §7.5/§8). */
function MachineCard({
  machine,
  now,
  busy,
  onDraw,
  onClaim,
}: {
  machine: GachaMachineView;
  now: number;
  busy: boolean;
  onDraw: (count: number) => void;
  onClaim: () => void;
}) {
  const freeReady = machine.freeRemaining > 0 && now >= machine.nextFreeAt;
  const ticket = machine.ticket as CurrencyKey;
  return (
    <section className="card summon-machine" data-machine={machine.id}>
      <h2 className="section-title">{t(machine.id === 'premium' ? 'summon.machine.premium' : 'summon.machine.common')}</h2>

      <p className="muted">
        {t('summon.ticket')}: {currencyLabel[ticket]}
        {machine.gemPerDraw !== null && <> · {machine.gemPerDraw} {currencyLabel.gems} {t('summon.perDraw')}</>}
      </p>

      <p className="summon-free">
        {t('summon.free')}: <strong>{machine.freeRemaining}</strong> / {machine.freePerDay}
        {' · '}
        {freeReady ? t('summon.freeReady') : `${t('summon.freeCooldown')} ${formatWait(machine.nextFreeAt - now)}`}
      </p>

      <div className="summon-box">
        <div className="summon-box-head">
          <span>{t('summon.box')}</span>
          <span className="muted">
            {machine.boxCredits} / {machine.boxCreditsNeeded}
          </span>
        </div>
        <ProgressBar value={machine.boxProgress} className="box-bar" />
        <RewardLine rewards={machine.boxRewards} />
        <button
          type="button"
          className="btn btn-primary"
          disabled={!machine.boxReady || busy}
          onClick={onClaim}
        >
          {machine.boxReady ? t('summon.boxReady') : t('summon.boxClaim')}
        </button>
      </div>

      {machine.pityThreshold > 0 && (
        <div className="summon-pity">
          <div className="summon-box-head">
            <span>{t('summon.pity')}</span>
            <span className="muted">
              {machine.pityProgress !== 0 ? Math.round(machine.pityProgress * 100) : 0}%
            </span>
          </div>
          <ProgressBar value={machine.pityProgress} className="pity-bar" />
          <p className="muted">{t('summon.pityNote')}</p>
        </div>
      )}

      <div className="summon-actions">
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => onDraw(1)}>
          {t('summon.draw1')}
        </button>
        <button type="button" className="btn" disabled={busy} onClick={() => onDraw(10)}>
          {t('summon.draw10')}
        </button>
      </div>

      <details className="summon-rates">
        <summary>{t('summon.rates')}</summary>
        <ul className="rate-list">
          {machine.tierRates.map((row) => (
            <li key={row.tier}>
              <span>{tierName(row.tier)}</span>
              <span className="muted">{pct(row.probability)}</span>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}

/** Summoning screen: two machines, pity/box, wish, rates and history (M6). */
export default function Summon() {
  const { busy, summon, claim, run, getGacha } = useServer();
  const [view, setView] = useState<GachaView | null>(null);
  const [draws, setDraws] = useState<DrawResult[]>([]);
  const [wishDraft, setWishDraft] = useState('');
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const refresh = useCallback(async () => {
    const result = await getGacha();
    if (result.ok) setView(result.value);
  }, [getGacha]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const wishOptions = useMemo(
    () =>
      [...WILDS].sort(
        (a, b) => (a.tier < b.tier ? -1 : a.tier > b.tier ? 1 : a.name.localeCompare(b.name)),
      ),
    [],
  );

  const doDraw = async (machine: MachineId, count: number) => {
    const result = await summon(machine, count);
    if (result.ok) {
      setDraws(result.value.draws);
      await refresh();
    }
  };

  const doClaim = async (machine: MachineId) => {
    const result = await claim((s) => s.claimGachaBox(machine));
    if (result.ok) await refresh();
  };

  const doWish = async (speciesId: string | null) => {
    const ok = await run((s) => s.setWish(speciesId));
    if (ok) await refresh();
  };

  if (!view) {
    return (
      <main className="main">
        <h1 className="page-title">{t('summon.title')}</h1>
        <p className="muted">{t('combat.loading')}</p>
      </main>
    );
  }

  const premium = view.machines.find((m) => m.id === 'premium');

  return (
    <main className="main">
      <h1 className="page-title">{t('summon.title')}</h1>
      <p className="muted">{t('summon.subtitle')}</p>

      {view.machines.map((machine) => (
        <MachineCard
          key={machine.id}
          machine={machine}
          now={now}
          busy={busy}
          onDraw={(count) => void doDraw(machine.id, count)}
          onClaim={() => void doClaim(machine.id)}
        />
      ))}

      {premium?.wish && (
        <section className="card summon-wish">
          <h2 className="section-title">{t('summon.wish')}</h2>
          <p className="muted">{t('summon.wishNote')}</p>
          <div className="summon-wish-row">
            <select
              className="input"
              value={wishDraft}
              onChange={(event) => setWishDraft(event.target.value)}
              aria-label={t('summon.wish')}
            >
              <option value="">{t('summon.wishNone')}</option>
              {wishOptions.map((wild) => (
                <option key={wild.id} value={wild.id}>
                  {wild.name} ({tierName(wild.tier)})
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || wishDraft === ''}
              onClick={() => void doWish(wishDraft)}
            >
              {t('summon.wishSet')}
            </button>
            <button type="button" className="btn" disabled={busy} onClick={() => void doWish(null)}>
              {t('summon.wishClear')}
            </button>
          </div>
          {view.wishedSpeciesId && (
            <p className="muted">
              {t('summon.wish')}: <strong>{species(view.wishedSpeciesId)?.name ?? view.wishedSpeciesId}</strong>
            </p>
          )}
        </section>
      )}

      {draws.length > 0 && (
        <section className="card summon-results">
          <h2 className="section-title">{t('summon.results')}</h2>
          <ul className="draw-grid">
            {draws.map((draw, i) => (
              <li key={i} className={`draw-card tier-${draw.tier}`}>
                <span className="draw-name">{species(draw.speciesId)?.name ?? draw.speciesId}</span>
                <span className="chip">{tierName(draw.tier)}</span>
                {draw.isNew && <span className="chip chip-new">{t('summon.new')}</span>}
                {draw.guaranteed && <span className="chip">{t('summon.guaranteed')}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card summon-history">
        <h2 className="section-title">{t('summon.history')}</h2>
        {view.history.length === 0 ? (
          <p className="muted">{t('summon.historyEmpty')}</p>
        ) : (
          <ul className="history-list">
            {[...view.history].reverse().map((entry, i) => (
              <li key={i} className="history-row">
                <span className="chip">{entry.machine === 'premium' ? 'P' : 'C'}</span>
                <span className="history-name">{species(entry.speciesId)?.name ?? entry.speciesId}</span>
                <span className={`chip tier-${entry.tier}`}>{tierName(entry.tier)}</span>
                {entry.isNew && <span className="chip chip-new">{t('summon.new')}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

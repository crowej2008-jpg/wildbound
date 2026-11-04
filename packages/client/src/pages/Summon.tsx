import { useCallback, useEffect, useState } from 'react';
import type { DrawResult, Faction, GachaGroup, MachineId, Tier } from '@wildbound/engine';
import type { GachaMachineView, GachaView } from '@wildbound/server';
import RewardLine from '../components/RewardLine';
import { currencyLabel, factionLabel, t, tierLabel, type CurrencyKey, type StringKey, type TierKey } from '../i18n';
import { useServer } from '../server/ServerProvider';
import { species } from '../wilds';

const tierName = (tier: Tier): string => tierLabel[tier as TierKey];
const groupName = (group: GachaGroup): string => t(`summon.group.${group}` as StringKey);
const pct = (value: number): string => `${(value * 100).toFixed(2)}%`;
const nameOf = (speciesId: string, star: number): string => {
  const meta = species(speciesId);
  return meta?.stars.find((c) => c.star === star)?.name ?? meta?.name ?? speciesId;
};

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

function drawLabel(count: number): string {
  if (count === 1) return t('summon.draw1');
  if (count === 10) return t('summon.draw10');
  return `${t('summon.drawMany')}${count}`;
}

/** One gacha card (R9: the source's Common / Premium Gacha). */
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
  const multi = machine.counts.filter((n) => n > 10);
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
        <button type="button" className="btn btn-primary" disabled={!machine.boxReady || busy} onClick={onClaim}>
          {machine.boxReady ? t('summon.boxReady') : t('summon.boxClaim')}
        </button>
      </div>

      <div className="summon-actions">
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => onDraw(1)}>
          {drawLabel(1)}
        </button>
        <button type="button" className="btn" disabled={busy} onClick={() => onDraw(10)}>
          {drawLabel(10)}
        </button>
      </div>
      {multi.length > 0 && (
        <div className="summon-actions summon-multi">
          {multi.map((n) => (
            <button key={n} type="button" className="btn" disabled={busy} onClick={() => onDraw(n)}>
              {drawLabel(n)}
            </button>
          ))}
          <p className="muted">{t('summon.multiNote')}</p>
        </div>
      )}

      <details className="summon-rates">
        <summary>{t('summon.rates')}</summary>
        <ul className="rate-list">
          {machine.groupRates.map((row) => (
            <li key={row.group}>
              <span>{groupName(row.group)}</span>
              <span className="muted">{pct(row.probability)}</span>
            </li>
          ))}
        </ul>
        <ul className="rate-list rate-rows">
          {machine.probabilities.map((row, i) => (
            <li key={i}>
              <span>
                {nameOf(row.speciesId, row.star)} {row.star}★
              </span>
              <span className="muted">{pct(row.probability)}</span>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}

function DrawCard({ draw }: { draw: DrawResult }) {
  return (
    <li className={`draw-card tier-${draw.tier}`}>
      <span className="draw-name">
        {nameOf(draw.speciesId, draw.star)} {draw.star}★
      </span>
      <span className="chip">{tierName(draw.tier)}</span>
      {draw.isNew && <span className="chip chip-new">{t('summon.new')}</span>}
    </li>
  );
}

/** Summoning screen (R9): the two gachas, the Wishing Well, the Supreme Gift, rates and history. */
export default function Summon() {
  const { busy, summon, claim, run, call, getGacha } = useServer();
  const [view, setView] = useState<GachaView | null>(null);
  const [draws, setDraws] = useState<DrawResult[]>([]);
  const [wishDraft, setWishDraft] = useState<Faction | ''>('');
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

  const doWish = async (faction: Faction | null) => {
    const ok = await run((s) => s.setWishFaction(faction));
    if (ok) await refresh();
  };

  const doGift = async () => {
    const result = await call((s) => s.openSupremeGift(), (v) => v.snapshot);
    if (result.ok) {
      setDraws([result.value.draw]);
      await refresh();
    }
  };

  if (!view) {
    return (
      <main className="main">
        <h1 className="page-title">{t('summon.title')}</h1>
        <p className="muted">{t('combat.loading')}</p>
      </main>
    );
  }

  const well = view.wishingWell;
  const gift = view.supremeGift;

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

      <section className="card summon-wish" data-testid="wishing-well">
        <h2 className="section-title">{t('summon.well')}</h2>
        <p className="muted">{t('summon.wellNote')}</p>
        {well.unlocked ? (
          <div className="summon-wish-row">
            <select
              className="input"
              value={wishDraft}
              onChange={(event) => setWishDraft(event.target.value as Faction | '')}
              aria-label={t('summon.well')}
            >
              <option value="">{t('summon.wellNone')}</option>
              {well.factions.map((f) => (
                <option key={f} value={f}>
                  {factionLabel[f]}
                </option>
              ))}
            </select>
            <button type="button" className="btn btn-primary" disabled={busy || wishDraft === ''} onClick={() => void doWish(wishDraft || null)}>
              {t('summon.wellSet')}
            </button>
            <button type="button" className="btn" disabled={busy} onClick={() => void doWish(null)}>
              {t('summon.wellClear')}
            </button>
          </div>
        ) : (
          <p className="muted">
            {t('summon.wellLocked')} <strong>{well.draws}</strong> / {well.unlockDraws}
          </p>
        )}
        {well.faction && (
          <p className="muted">
            {t('summon.wellCurrent')}: <strong>{factionLabel[well.faction]}</strong>
          </p>
        )}
      </section>

      <section className="card summon-gift" data-testid="supreme-gift">
        <h2 className="section-title">{t('summon.gift')}</h2>
        <p className="muted">{t('summon.giftNote')}</p>
        <div className="summon-box-head">
          <span>{t('summon.vipCredits')}</span>
          <span className="muted">
            {gift.credits} / {gift.needed}
          </span>
        </div>
        <ProgressBar value={gift.credits / gift.needed} className="box-bar" />
        <p className="muted">
          {t('summon.giftVip')} {gift.vipLevel} (VIP {gift.playerVip})
        </p>
        <button type="button" className="btn btn-primary" disabled={!gift.ready || busy} onClick={() => void doGift()}>
          {t('summon.giftOpen')}
        </button>
      </section>

      {draws.length > 0 && (
        <section className="card summon-results">
          <h2 className="section-title">{t('summon.results')}</h2>
          <ul className="draw-grid">
            {draws.map((draw, i) => (
              <DrawCard key={i} draw={draw} />
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
                <span className="chip">{entry.machine === 'premium' ? 'P' : entry.machine === 'common' ? 'C' : 'G'}</span>
                <span className="history-name">
                  {nameOf(entry.speciesId, entry.star)} {entry.star}★
                </span>
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

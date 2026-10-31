import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type {
  SkyPillarBattleResult,
  SkyPillarConditionView,
  SkyPillarFloorView,
  SkyPillarStageView,
  SkyPillarSweepResult,
  SkyPillarView,
} from '@wildbound/server';
import BattleReplay from '../components/BattleReplay';
import RewardLine from '../components/RewardLine';
import { formatDuration, t } from '../i18n';
import { useServer } from '../server/ServerProvider';

/** Sky Pillar (M13.2): 180 floors, star grades, proofs, sweeps and chests. */

function starsText(stars: number): string {
  return `${'★'.repeat(stars)}${'☆'.repeat(Math.max(0, 3 - stars))}`;
}

function conditionText(condition: SkyPillarConditionView): string {
  switch (condition.kind) {
    case 'knockoutsAtMost':
      return `${t('skyPillar.condition.knockouts')} ≤ ${condition.value}`;
    case 'hpAtLeast':
      return `${t('skyPillar.condition.hp')} ≥ ${condition.value}%`;
    case 'roundsAtMost':
      return `${t('skyPillar.condition.rounds')} ≤ ${condition.value}`;
  }
}

function FloorButton({
  floor,
  selected,
  onPick,
}: {
  floor: SkyPillarFloorView;
  selected: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      className={`sky-floor ${selected ? 'is-selected' : ''} ${floor.unlocked ? '' : 'is-locked'} ${
        floor.cleared ? 'is-cleared' : ''
      }`}
      aria-pressed={selected}
      onClick={onPick}
    >
      <span className="sky-floor-number">{floor.floor}</span>
      <span className="sky-floor-stars">
        {floor.unlocked ? `${floor.stars}/${floor.maxStars}` : `Lv ${floor.playerLevel}`}
      </span>
    </button>
  );
}

function StageRow({
  stage,
  busy,
  proofs,
  onChallenge,
}: {
  stage: SkyPillarStageView;
  busy: boolean;
  proofs: number;
  onChallenge: () => void;
}) {
  const needsProof = stage.stars === 0;
  const disabled = busy || !stage.unlocked || (needsProof && proofs < 1);
  return (
    <li className={`sky-stage ${stage.unlocked ? '' : 'is-locked'}`}>
      <div className="sky-stage-head">
        <strong>{t('skyPillar.stage')} {stage.stage}</strong>
        <span className={`sky-stars ${stage.stars > 0 ? 'is-earned' : ''}`}>{starsText(stage.stars)}</span>
        <button type="button" className="btn btn-primary btn-sm" disabled={disabled} onClick={onChallenge}>
          {!stage.unlocked
            ? t('skyPillar.locked')
            : stage.stars > 0
              ? t('skyPillar.rechallenge')
              : t('skyPillar.challenge')}
        </button>
      </div>
      <div className="sky-stage-meta">
        <span className="muted">
          {t('skyPillar.pass')}: <RewardLine rewards={stage.pass} />
        </span>
        <span className="muted">
          {t('skyPillar.sweepPay')}: <RewardLine rewards={stage.sweep} />
        </span>
      </div>
      <div className="sky-conditions">
        <span className="muted">{t('skyPillar.conditions')}:</span>
        {stage.conditions.map((condition, index) => (
          <span key={`${condition.kind}-${index}`} className="chip">
            {conditionText(condition)}
          </span>
        ))}
      </div>
    </li>
  );
}

export default function SkyPillar() {
  const { call, claim, busy } = useServer();
  const [view, setView] = useState<SkyPillarView | null>(null);
  const [selectedFloor, setSelectedFloor] = useState<number | undefined>(undefined);
  const [battle, setBattle] = useState<SkyPillarBattleResult | null>(null);
  const [swept, setSwept] = useState<SkyPillarSweepResult | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const refresh = useCallback(
    async (floor?: number) => {
      const result = await call((s) => s.getSkyPillar(floor));
      if (result.ok) setView(result.value);
    },
    [call],
  );

  useEffect(() => {
    void refresh(selectedFloor);
  }, [refresh, selectedFloor]);

  const pickFloor = (floor: number) => {
    setStatus(null);
    setSelectedFloor(floor);
  };

  const doChallenge = async (stage: number) => {
    if (!view) return;
    setStatus(null);
    setSwept(null);
    const result = await call(
      (s) => s.challengeSkyPillar(view.selectedFloor, stage),
      (value) => value.snapshot,
    );
    if (result.ok) {
      setBattle(result.value);
      await refresh(view.selectedFloor);
    }
  };

  const doSweep = async () => {
    setStatus(null);
    setSwept(null);
    const result = await call((s) => s.sweepSkyPillar(), (value) => value.snapshot);
    if (result.ok) {
      setSwept(result.value);
      await refresh(selectedFloor);
    }
  };

  const doClaimChest = async (stars: number) => {
    if (!view) return;
    setStatus(null);
    const result = await claim((s) => s.claimSkyPillarChest(view.selectedFloor, stars));
    if (result.ok) {
      setStatus(t('skyPillar.chestClaimed'));
      await refresh(view.selectedFloor);
    }
  };

  if (battle) {
    return (
      <BattleReplay
        view={battle.battle}
        attackerLabel={t('combat.team.attackers')}
        defenderLabel={`${t('skyPillar.floor')} ${battle.floor} · ${t('skyPillar.stage')} ${battle.stage}`}
        resultExtra={
          <section className={`card result-rewards ${battle.win ? 'result-win' : 'result-lose'}`}>
            <div className="result-banner">
              <strong>{battle.win ? t('skyPillar.victory') : t('skyPillar.defeat')}</strong>
              <span className={`sky-stars ${battle.stars > 0 ? 'is-earned' : ''}`}>
                {starsText(battle.stars)}
              </span>
            </div>
            <p className="muted">
              {t('skyPillar.best')}: {starsText(battle.bestStars)}
              {battle.firstClear ? ` · ${t('skyPillar.firstClear')}` : ''}
            </p>
            {battle.firstClear ? <RewardLine rewards={battle.rewards} /> : null}
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setBattle(null);
                void refresh(battle.floor);
              }}
            >
              {t('skyPillar.back')}
            </button>
          </section>
        }
      />
    );
  }

  if (!view) {
    return (
      <main className="main">
        <h1 className="page-title">{t('skyPillar.title')}</h1>
        <p className="muted">{t('skyPillar.loading')}</p>
      </main>
    );
  }

  const detail = view.detail;
  const wings = [...new Set(view.floors.map((floor) => floor.wing))];

  return (
    <main className="main">
      <p>
        <Link className="text-link" to="/explore">
          {t('explore.back')}
        </Link>
      </p>
      <div className="explore-detail-head">
        <span className="explore-sigil explore-sigil-lg" aria-hidden>
          SP
        </span>
        <div>
          <h1 className="page-title">{t('skyPillar.title')}</h1>
          <p className="muted">{t('skyPillar.tagline')}</p>
        </div>
      </div>
      <div className="explore-facts">
        <span className="chip">
          {t('skyPillar.proofs')} {view.proofs}/{view.maxProofs}
        </span>
        <span className="chip">
          {view.nextProofMs > 0
            ? `${t('skyPillar.nextProof')} ${formatDuration(view.nextProofMs)}`
            : t('skyPillar.proofFull')}
        </span>
        <span className="chip">
          {t('skyPillar.totalStars')} {view.totalStars}/{view.totalStages * 3}
        </span>
        <span className={`chip ${view.unlocked ? 'chip-on' : ''}`}>
          {view.unlocked ? t('explore.unlocked') : t('explore.locked')}
        </span>
        <span className="chip explore-status live">{t('explore.status.live')}</span>
      </div>

      {!view.unlocked ? (
        <section className="card">
          <h2 className="section-title">{t('skyPillar.lockedTitle')}</h2>
          <p className="muted">{t('skyPillar.lockedNote')}</p>
          <ul className="plain-list">
            {view.gates.map((gate, index) => (
              <li key={`${gate.gate.kind}-${index}`} className="milestone-row">
                <span>
                  {gate.gate.kind === 'campaign'
                    ? `${t('explore.requirement.campaign')} ${gate.gate.chapter}-${gate.gate.stage}`
                    : gate.gate.kind === 'level'
                      ? `${t('explore.requirement.level')} ${gate.gate.level}`
                      : `${t('explore.requirement.serverDay')} ${gate.gate.day}`}
                </span>
                <span className={`chip ${gate.met ? 'chip-on' : ''}`}>
                  {gate.met ? t('explore.met') : t('explore.unmet')}
                </span>
              </li>
            ))}
          </ul>
          <Link className="btn" to="/campaign">
            {t('skyPillar.goCampaign')}
          </Link>
        </section>
      ) : (
        <>
          <section className="card">
            <div className="sky-summary">
              <span>
                <span className="muted">{t('skyPillar.nextStage')}</span>
                <strong>
                  {view.nextStage
                    ? `${t('skyPillar.floor')} ${view.nextStage.floor} · ${t('skyPillar.stage')} ${view.nextStage.stage}`
                    : t('skyPillar.complete')}
                </strong>
              </span>
              <span>
                <span className="muted">{t('skyPillar.clearedStages')}</span>
                <strong>
                  {view.clearedStages}/{view.totalStages}
                </strong>
              </span>
              <span>
                <span className="muted">{t('skyPillar.roundLimit')}</span>
                <strong>{view.roundLimit}</strong>
              </span>
            </div>
            <div className="stage-actions">
              <button
                type="button"
                className="btn"
                disabled={busy || !view.canSweep || !view.bestSweep}
                onClick={() => void doSweep()}
              >
                {t('skyPillar.sweep')}
              </button>
              <span className="muted">
                {view.bestSweep
                  ? `${t('skyPillar.sweepTarget')} ${t('skyPillar.floor')} ${view.bestSweep.floor} · ${t(
                      'skyPillar.stage',
                    )} ${view.bestSweep.stage}`
                  : t('skyPillar.noSweep')}
              </span>
            </div>
            {view.bestSweep ? (
              <p className="muted">
                {t('skyPillar.sweepPay')}: <RewardLine rewards={view.bestSweep.rewards} />
              </p>
            ) : null}
            {swept ? (
              <div className="sky-sweep-result">
                <span className="muted">
                  {t('skyPillar.swept')} {t('skyPillar.floor')} {swept.floor} · {t('skyPillar.stage')}{' '}
                  {swept.stage}
                </span>
                <RewardLine rewards={swept.granted} />
              </div>
            ) : null}
            {status ? <p className="muted">{status}</p> : null}
          </section>

          {wings.map((wing) => (
            <section key={wing} className="card sky-wing">
              <h2 className="section-title">
                {t('skyPillar.wing')} {wing} ·{' '}
                {view.floors.find((floor) => floor.wing === wing)?.wingName ?? ''}
              </h2>
              <div className="sky-floor-grid">
                {view.floors
                  .filter((floor) => floor.wing === wing)
                  .map((floor) => (
                    <FloorButton
                      key={floor.floor}
                      floor={floor}
                      selected={floor.floor === view.selectedFloor}
                      onPick={() => pickFloor(floor.floor)}
                    />
                  ))}
              </div>
            </section>
          ))}

          {detail ? (
            <section className="card sky-detail">
              <div className="shop-head">
                <h2 className="section-title">
                  {t('skyPillar.floor')} {detail.floor} · {detail.wingName}
                </h2>
                <span className={`chip ${detail.unlocked ? 'chip-on' : ''}`}>
                  {detail.unlocked
                    ? t('explore.unlocked')
                    : view.playerLevel < detail.playerLevel
                      ? `${t('skyPillar.playerLevel')} ${detail.playerLevel}`
                      : `${t('skyPillar.clearPrevious')} ${detail.floor - 1}`}
                </span>
              </div>
              <p className="muted">
                {t('skyPillar.floorStars')}: {detail.stars}/{detail.maxStars}
                {detail.cleared ? ` · ${t('skyPillar.cleared')}` : ''}
              </p>
              <div className="sky-chests">
                {detail.chests.map((chest) => (
                  <div key={chest.stars} className="sky-chest">
                    <span className={`sky-stars ${chest.stars > 0 ? 'is-earned' : ''}`}>
                      {chest.stars}★
                    </span>
                    <RewardLine rewards={chest.rewards} />
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={busy || chest.claimed || !chest.claimable}
                      onClick={() => void doClaimChest(chest.stars)}
                    >
                      {chest.claimed
                        ? t('skyPillar.claimed')
                        : chest.claimable
                          ? t('skyPillar.claim')
                          : t('skyPillar.chestLocked')}
                    </button>
                  </div>
                ))}
              </div>
              <ul className="plain-list sky-stages">
                {detail.stages.map((stage) => (
                  <StageRow
                    key={stage.stage}
                    stage={stage}
                    busy={busy}
                    proofs={view.proofs}
                    onChallenge={() => void doChallenge(stage.stage)}
                  />
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </main>
  );
}

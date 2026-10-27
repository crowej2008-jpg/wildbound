import { useMemo, useState } from 'react';
import { CHAPTERS as CHAPTER_INDEX, GYMS, STAGES } from '@wildbound/content';
import type { GymJson } from '@wildbound/content';
import {
  gateOf,
  isGymAvailable,
  isGymCleared,
  isUnlocked,
  orderStages,
  starsOf,
  type StageDef,
} from '@wildbound/engine';
import type { GymBattleResult, StageBattleResult } from '@wildbound/server';
import BattleReplay from '../components/BattleReplay';
import RewardLine from '../components/RewardLine';
import { t } from '../i18n';
import { useServer } from '../server/ServerProvider';

const ORDERED = orderStages(STAGES as StageDef[]);
const CHAPTER_NUMBERS = CHAPTER_INDEX.map((chapter) => chapter.number);
const GYM_BY_ID = new Map<string, GymJson>(GYMS.map((gym) => [gym.id, gym]));

function chapterMeta(number: number) {
  return CHAPTER_INDEX.find((chapter) => chapter.number === number);
}

function firstOpenChapter(stars: Record<string, number>): number {
  const stage = ORDERED.find((candidate) => (stars[candidate.id] ?? 0) === 0);
  return stage?.chapter ?? CHAPTER_INDEX[CHAPTER_INDEX.length - 1]?.number ?? 1;
}

function Stars({ n }: { n: number }) {
  return (
    <span className="stars" aria-label={`${n}/3`}>
      {[1, 2, 3].map((i) => (
        <span key={i} className={i <= n ? 'star star-on' : 'star'}>
          ★
        </span>
      ))}
    </span>
  );
}

type BattleResult =
  | { kind: 'stage'; result: StageBattleResult }
  | { kind: 'gym'; result: GymBattleResult };

/** Campaign map (M5, M13.0a): 182 chapters, ten stages each, Victory Road gym gates. */
export default function Campaign() {
  const { snapshot, challengeStage, challengeGym, claim, busy } = useServer();
  const [battle, setBattle] = useState<BattleResult | null>(null);
  const [swept, setSwept] = useState<string | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null);

  const stars = snapshot?.state.campaign.stars ?? {};
  const gyms = snapshot?.state.campaign.gyms ?? {};
  const chapter = selectedChapter ?? firstOpenChapter(stars);
  const meta = chapterMeta(chapter);
  const chapterStages = useMemo(() => ORDERED.filter((stage) => stage.chapter === chapter), [chapter]);
  const gateStage = chapterStages.find((stage) => gateOf(stage));
  const gateId = gateStage ? gateOf(gateStage) : null;
  const gate = gateId ? GYM_BY_ID.get(gateId) : undefined;
  const gateCleared = gateId ? isGymCleared({ stars, gyms }, gateId) : false;
  const gateAvailable = gateId && snapshot ? isGymAvailable(snapshot.state.campaign, ORDERED, gateId) : false;

  const onChallenge = async (stage: StageDef) => {
    const result = await challengeStage(stage.id);
    if (result.ok) setBattle({ kind: 'stage', result: result.value });
  };

  const onChallengeGym = async (gym: GymJson) => {
    const result = await challengeGym(gym.id);
    if (result.ok) setBattle({ kind: 'gym', result: result.value });
  };

  const onSweep = async (stage: StageDef) => {
    setSwept(null);
    const result = await claim((s) => s.sweepStage(stage.id));
    if (result.ok) setSwept(stage.id);
  };

  if (battle?.kind === 'stage') {
    const stage = ORDERED.find((candidate) => candidate.id === battle.result.stageId);
    return (
      <BattleReplay
        view={battle.result.battle}
        attackerLabel={t('campaign.you')}
        defenderLabel={stage?.name ?? t('campaign.enemy')}
        resultExtra={
          <section className={`card result-rewards ${battle.result.win ? 'result-win' : 'result-lose'}`}>
            <div className="result-banner">
              <strong>{battle.result.win ? t('campaign.victory') : t('campaign.defeat')}</strong>
              {battle.result.win && <Stars n={battle.result.stars} />}
            </div>
            {battle.result.win ? (
              <>
                {battle.result.firstClear && <p className="muted">{t('campaign.firstClear')}</p>}
                <RewardLine rewards={battle.result.rewards} />
              </>
            ) : (
              <p className="muted">{t('campaign.retry')}</p>
            )}
            <button type="button" className="btn btn-primary" onClick={() => setBattle(null)}>
              {t('campaign.back')}
            </button>
          </section>
        }
      />
    );
  }

  if (battle?.kind === 'gym') {
    return (
      <BattleReplay
        view={battle.result.battle}
        attackerLabel={t('campaign.you')}
        defenderLabel={GYM_BY_ID.get(battle.result.gymId)?.name ?? t('campaign.gym')}
        resultExtra={
          <section className={`card result-rewards ${battle.result.win ? 'result-win' : 'result-lose'}`}>
            <div className="result-banner">
              <strong>{battle.result.win ? t('campaign.gymVictory') : t('campaign.gymDefeat')}</strong>
            </div>
            {battle.result.win ? (
              <>
                <p className="muted">
                  {battle.result.firstClear ? t('campaign.gymFirstClear') : t('campaign.gymPractice')}
                </p>
                <RewardLine rewards={battle.result.rewards} />
              </>
            ) : (
              <p className="muted">{t('campaign.retry')}</p>
            )}
            <button type="button" className="btn btn-primary" onClick={() => setBattle(null)}>
              {t('campaign.back')}
            </button>
          </section>
        }
      />
    );
  }

  return (
    <main className="main">
      <h1 className="page-title">{t('campaign.title')}</h1>
      <p className="muted">{t('campaign.subtitle')}</p>

      <div className="chapter-picker">
        <button
          type="button"
          className="btn"
          disabled={chapter <= 1}
          onClick={() => setSelectedChapter(chapter - 1)}
          aria-label={t('campaign.previousChapter')}
        >
          ‹
        </button>
        <label className="chapter-select">
          <span className="muted">{t('campaign.chapter')}</span>
          <select
            value={chapter}
            onChange={(event) => setSelectedChapter(Number(event.target.value))}
            aria-label={t('campaign.selectChapter')}
          >
            {CHAPTER_NUMBERS.map((number) => {
              const chapterInfo = chapterMeta(number);
              return (
                <option key={number} value={number}>
                  {number}. {chapterInfo?.name ?? `Chapter ${number}`}
                </option>
              );
            })}
          </select>
        </label>
        <button
          type="button"
          className="btn"
          disabled={chapter >= CHAPTER_NUMBERS.length}
          onClick={() => setSelectedChapter(chapter + 1)}
          aria-label={t('campaign.nextChapter')}
        >
          ›
        </button>
      </div>

      <section className="card">
        <h2 className="section-title">
          {t('campaign.chapter')} {chapter} · {meta?.name ?? ''}
        </h2>
        <p className="muted">
          {meta?.region ?? ''} · {chapterStages.length} {t('campaign.stages')}
        </p>

        {gate && (
          <div className="gate-card">
            <div>
              <strong>
                {t('campaign.gymGate')}: {gate.name}
              </strong>
              <p className="muted">
                {gate.region} · {t('campaign.enemies')}: {gate.enemies.length} ·{' '}
                <span className={gateCleared ? 'chip chip-on' : 'chip'}>
                  {gateCleared
                    ? t('campaign.gymCleared')
                    : gateAvailable
                      ? t('campaign.gymAvailable')
                      : t('campaign.gymLocked')}
                </span>
              </p>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!gateAvailable || busy}
              onClick={() => void onChallengeGym(gate)}
            >
              {gateCleared ? t('campaign.gymReplay') : t('campaign.gymChallenge')}
            </button>
          </div>
        )}

        <ul className="stage-list">
          {chapterStages.map((stage) => {
            const unlocked = snapshot ? isUnlocked(snapshot.state.campaign, ORDERED, stage.id) : false;
            const cleared = (stars[stage.id] ?? 0) > 0;
            const stageGateId = gateOf(stage);
            const blockedByGate = Boolean(stageGateId) && !isGymCleared({ stars, gyms }, stageGateId!);
            return (
              <li key={stage.id} className="stage-row" data-locked={!unlocked}>
                <div className="stage-info">
                  <span className="stage-name">
                    {stage.index}. {stage.name}
                  </span>
                  <span className="muted">
                    {t('campaign.enemies')}: {stage.enemies.length} · {t('campaign.idle')}{' '}
                    {stage.idlePerMinute.gold ?? 0}/min
                  </span>
                  {blockedByGate && (
                    <span className="muted">
                      {t('campaign.gymBlocksStage')} {GYM_BY_ID.get(stageGateId!)?.name ?? stageGateId}
                    </span>
                  )}
                </div>
                <Stars n={starsOf({ stars }, stage.id)} />
                <div className="stage-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={!unlocked || busy}
                    onClick={() => void onChallenge(stage)}
                  >
                    {cleared ? t('campaign.replay') : t('campaign.challenge')}
                  </button>
                  <button
                    type="button"
                    className="btn"
                    disabled={!cleared || busy}
                    onClick={() => void onSweep(stage)}
                  >
                    {t('campaign.sweep')}
                  </button>
                </div>
                {swept === stage.id && <span className="muted">{t('campaign.swept')}</span>}
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}

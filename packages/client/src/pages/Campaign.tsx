import { useMemo, useState } from 'react';
import { STAGES } from '@wildbound/content';
import { isUnlocked, orderStages, starsOf, type StageDef } from '@wildbound/engine';
import type { StageBattleResult } from '@wildbound/server';
import BattleReplay from '../components/BattleReplay';
import RewardLine from '../components/RewardLine';
import { t } from '../i18n';
import { useServer } from '../server/ServerProvider';

const ORDERED = orderStages(STAGES as StageDef[]);
const CHAPTERS = [...new Set(ORDERED.map((s) => s.chapter))].sort((a, b) => a - b);

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

/** Campaign map (M5, PROMPT §7.6): chapters of stages, challenge + sweep. */
export default function Campaign() {
  const { snapshot, challengeStage, claim, busy } = useServer();
  const [battle, setBattle] = useState<StageBattleResult | null>(null);
  const [swept, setSwept] = useState<string | null>(null);

  const stars = snapshot?.state.campaign.stars ?? {};
  const byId = useMemo(() => new Map(ORDERED.map((s) => [s.id, s])), []);

  const onChallenge = async (stage: StageDef) => {
    const result = await challengeStage(stage.id);
    if (result.ok) setBattle(result.value);
  };

  const onSweep = async (stage: StageDef) => {
    setSwept(null);
    const result = await claim((s) => s.sweepStage(stage.id));
    if (result.ok) setSwept(stage.id);
  };

  if (battle) {
    const stage = byId.get(battle.stageId);
    return (
      <BattleReplay
        view={battle.battle}
        attackerLabel={t('campaign.you')}
        defenderLabel={stage?.name ?? t('campaign.enemy')}
        resultExtra={
          <section className={`card result-rewards ${battle.win ? 'result-win' : 'result-lose'}`}>
            <div className="result-banner">
              <strong>{battle.win ? t('campaign.victory') : t('campaign.defeat')}</strong>
              {battle.win && <Stars n={battle.stars} />}
            </div>
            {battle.win ? (
              <>
                {battle.firstClear && <p className="muted">{t('campaign.firstClear')}</p>}
                <RewardLine rewards={battle.rewards} />
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

      {CHAPTERS.map((chapter) => (
        <section key={chapter} className="card">
          <h2 className="section-title">
            {t('campaign.chapter')} {chapter}
          </h2>
          <ul className="stage-list">
            {ORDERED.filter((s) => s.chapter === chapter).map((stage) => {
              const unlocked = snapshot ? isUnlocked(snapshot.state.campaign, ORDERED, stage.id) : false;
              const cleared = (stars[stage.id] ?? 0) > 0;
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
      ))}
    </main>
  );
}

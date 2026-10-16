import { useCallback, useEffect, useState } from 'react';
import type { TrialBattleResult, TrialCardView } from '@wildbound/server';
import BattleReplay from '../components/BattleReplay';
import RewardLine from '../components/RewardLine';
import { t } from '../i18n';
import { useServer } from '../server/ServerProvider';

/** Trials (M8, PROMPT §7.6): five rule-bending challenges, one reward per day. */
export default function PveTrials() {
  const { call, snapshot, busy } = useServer();
  const [cards, setCards] = useState<TrialCardView[]>([]);
  const [battle, setBattle] = useState<TrialBattleResult | null>(null);

  const refresh = useCallback(async () => {
    const result = await call((s) => s.getTrials());
    if (result.ok) setCards(result.value);
  }, [call]);

  useEffect(() => {
    void refresh();
  }, [refresh, snapshot?.state.profile.level]);

  const onFight = async (trial: TrialCardView) => {
    const result = await call((s) => s.challengeTrial(trial.id), (v) => v.snapshot);
    if (result.ok) setBattle(result.value);
  };

  if (battle) {
    const card = cards.find((c) => c.id === battle.trialId);
    return (
      <BattleReplay
        view={battle.battle}
        attackerLabel={t('combat.team.attackers')}
        defenderLabel={card?.name ?? t('pve.trials')}
        resultExtra={
          <section className={`card result-rewards ${battle.win ? 'result-win' : 'result-lose'}`}>
            <div className="result-banner">
              <strong>{battle.win ? t('trials.victory') : t('trials.defeat')}</strong>
            </div>
            {battle.win ? (
              <>
                {!battle.firstToday && <p className="muted">{t('trials.rewardNote')}</p>}
                <RewardLine rewards={battle.rewards} />
              </>
            ) : null}
            <button type="button" className="btn btn-primary" onClick={() => setBattle(null)}>
              {t('trials.back')}
            </button>
          </section>
        }
      />
    );
  }

  return (
    <main className="main">
      <h1 className="page-title">{t('pve.trials')}</h1>
      <p className="muted">{t('pve.trials.desc')}</p>
      {cards.map((card) => (
        <section key={card.id} className="card">
          <div className="stat-row">
            <h2 className="section-title">{card.name}</h2>
            <span className={card.open ? 'chip chip-on' : 'chip'}>
              {card.clearedToday ? t('trials.cleared') : card.open ? t('trials.open') : t('trials.closed')}
            </span>
          </div>
          <p className="muted">{card.tagline}</p>
          <p className="chip">{card.ruleDetail}</p>
          <p className="muted">{t('trials.rewardNote')}</p>
          <RewardLine rewards={card.preview} />
          <div className="stage-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || !card.open}
              onClick={() => void onFight(card)}
            >
              {card.locked ? t('trials.locked') : t('trials.fight')}
            </button>
          </div>
        </section>
      ))}
    </main>
  );
}

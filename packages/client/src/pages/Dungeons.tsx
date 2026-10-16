import { useCallback, useEffect, useState } from 'react';
import type { DungeonBattleResult, DungeonCardView } from '@wildbound/server';
import BattleReplay from '../components/BattleReplay';
import RewardLine from '../components/RewardLine';
import { t, weekdayLabel } from '../i18n';
import { useServer } from '../server/ServerProvider';

/** Daily Dungeons (M8, PROMPT §7.6): seven weekday dungeons, one reward per day. */
export default function Dungeons() {
  const { call, snapshot, busy } = useServer();
  const [cards, setCards] = useState<DungeonCardView[]>([]);
  const [battle, setBattle] = useState<DungeonBattleResult | null>(null);

  const refresh = useCallback(async () => {
    const result = await call((s) => s.getDungeons());
    if (result.ok) setCards(result.value);
  }, [call]);

  useEffect(() => {
    void refresh();
  }, [refresh, snapshot?.state.pve.dungeons.day]);

  const onEnter = async (dungeon: DungeonCardView) => {
    const result = await call((s) => s.challengeDungeon(dungeon.id), (v) => v.snapshot);
    if (result.ok) setBattle(result.value);
  };

  if (battle) {
    const card = cards.find((c) => c.id === battle.dungeonId);
    return (
      <BattleReplay
        view={battle.battle}
        attackerLabel={t('combat.team.attackers')}
        defenderLabel={card?.name ?? t('pve.dungeons')}
        resultExtra={
          <section className={`card result-rewards ${battle.win ? 'result-win' : 'result-lose'}`}>
            <div className="result-banner">
              <strong>{battle.win ? t('dungeon.victory') : t('dungeon.defeat')}</strong>
            </div>
            {battle.win ? (
              <>
                {!battle.firstToday && <p className="muted">{t('dungeon.rewardNote')}</p>}
                <RewardLine rewards={battle.rewards} />
              </>
            ) : null}
            <button type="button" className="btn btn-primary" onClick={() => setBattle(null)}>
              {t('dungeon.back')}
            </button>
          </section>
        }
      />
    );
  }

  return (
    <main className="main">
      <h1 className="page-title">{t('pve.dungeons')}</h1>
      <p className="muted">{t('pve.dungeons.desc')}</p>
      {cards.map((card) => (
        <section key={card.id} className="card">
          <div className="stat-row">
            <h2 className="section-title">{card.name}</h2>
            <span className={card.open ? 'chip chip-on' : 'chip'}>
              {card.clearedToday ? t('dungeon.cleared') : card.open ? t('dungeon.today') : t('dungeon.closed')}
            </span>
          </div>
          <p className="muted">
            {weekdayLabel[card.weekday] ?? ''} · {card.desc}
          </p>
          <RewardLine rewards={card.rewards} />
          <div className="stage-actions">
            <button type="button" className="btn btn-primary" disabled={busy || !card.open} onClick={() => void onEnter(card)}>
              {t('dungeon.enter')}
            </button>
          </div>
        </section>
      ))}
    </main>
  );
}
